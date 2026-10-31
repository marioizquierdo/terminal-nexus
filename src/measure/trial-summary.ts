// How a trial is printed (docs/system-design/testing-ground.md, reading a trial): for each map, three small tables —
// the outcome, how the armies engaged, what a tick cost when it was measured — a row per variant, a `*` where a row
// differs from the one it is compared with by more than chance; what stalled units were queued behind; the battles
// worth watching, each with the command that watches it; and a round robin's standings. Pure: lines of text.

import type { Variant } from "../scenario/variant.ts"
import type { StallHead } from "./battle.ts"
import type { Notable, TrialCell } from "./trial-cells.ts"
import { sharesDiffer, valuesDiffer } from "./trial-cells.ts"
import type { TrialSpec } from "./trial.ts"
import { trialVariants } from "./trial.ts"

const percent = (share: number): string => `${Math.round(share * 100)}%`
const seconds = (value: number | null): string => (value === null ? "—" : `${value.toFixed(1)}s`)
const pair = (a: string, b: string): string => `${a}/${b}`
const fixed = (value: number | null, places: number): string => (value === null ? "—" : value.toFixed(places))

/** How the battles of a trial were played, in words. */
export function trialPlan(spec: TrialSpec): string {
  const seeds = spec.seeds.length
  const ways = spec.swap === true ? 2 : 1
  const base = spec.base === undefined ? [] : describeVariant(spec.base)
  return (
    `${seeds * ways} battles a variant: ${seeds} seed${seeds === 1 ? "" : "s"}${spec.swap === true ? ", from both ends" : ""}` +
    `${spec.shuffle === true ? ", each side shuffled by the seed" : ""}${base.length === 0 ? "" : `; every variant with ${base.join(", ")}`}`
  )
}

/** A variant in a few words: `trooper.maxHp=60`, `A army trooper:6,skyraider:6`. */
export function describeVariant(variant: Variant): string[] {
  return [
    ...Object.entries(variant.tune ?? {}).map(([key, value]) => `${key}=${String(value)}`),
    ...Object.entries(variant.set ?? {}).map(([key, value]) => `${key}=${value}`),
    ...Object.entries(variant.army ?? {}).map(([side, army]) => `${side} army ${army ?? ""}`),
    ...Object.entries(variant.terrain ?? {}).map(([from, to]) => `"${from}" as ${to}`),
    ...Object.entries(variant.targets ?? {}).map(([side, area]) => `${side} target ${area?.x},${area?.y} ${area?.width}x${area?.height}`),
    ...(variant.ticks === undefined ? [] : [`${variant.ticks} ticks`]),
  ]
}

const quoted = (text: string): string => (/^[\w.,:=/-]+$/.test(text) ? text : `'${text.replaceAll("'", "'\\''")}'`)

/** The `grid` options that make `variant` of a map: what a command line needs to watch one battle of it. */
export function variantFlags(variant: Variant): string[] {
  const flags: string[] = []
  const joined = (entries: Readonly<Record<string, unknown>>): string => Object.entries(entries).map(([key, value]) => `${key}=${String(value)}`).join(",")
  if (variant.set !== undefined) flags.push("--set", quoted(joined(variant.set)))
  if (variant.army?.A !== undefined) flags.push("--army-a", quoted(variant.army.A))
  if (variant.army?.B !== undefined) flags.push("--army-b", quoted(variant.army.B))
  if (variant.tune !== undefined) flags.push("--tune", quoted(joined(variant.tune)))
  if (variant.terrain !== undefined) flags.push("--terrain", quoted(joined(variant.terrain)))
  for (const side of ["A", "B"] as const) {
    const area = variant.targets?.[side]
    if (area !== undefined) flags.push(`--target-${side.toLowerCase()}`, `${area.x},${area.y},${area.width},${area.height}`)
  }
  if (variant.ticks !== undefined) flags.push("--ticks", String(variant.ticks))
  return flags
}

/** The command that watches one battle of a trial (add `--headless --log-level info` to read it instead). */
export function watchCommand(spec: TrialSpec, battle: Readonly<{ map: string; variant: string; seed: number; swapped: boolean }>): string {
  const variant = trialVariants(spec)[battle.variant] ?? {}
  return ["grid", battle.map, "--seed", String(battle.seed), ...(spec.shuffle === true ? ["--shuffle"] : []), ...(battle.swapped ? ["--swap"] : []), ...variantFlags(variant)].join(" ")
}

const HEADS: readonly StallHead[] = [
  "an ally striking",
  "an ally walking to its target",
  "an ally with no target",
  "an enemy",
  "a building",
  "no route to its enemy",
  "settling after a step",
  "terrain or the edge",
  "a ring of waiters",
]

/** What a cell's stalled units were queued behind, both armies together, most first; null with no stall. */
function stallLine(cell: TrialCell): string | null {
  const counts = HEADS.map((head) => ({ head, count: (cell.armies.A.stallHeads[head] ?? 0) + (cell.armies.B.stallHeads[head] ?? 0) })).filter((each) => each.count > 0)
  if (counts.length === 0) return null
  const total = counts.reduce((sum, each) => sum + each.count, 0)
  return counts
    .sort((a, b) => b.count - a.count)
    .map((each) => `${each.head} ${percent(each.count / total)}`)
    .join(", ")
}

type Row = Readonly<{ name: string; cell: TrialCell; reference: TrialCell | undefined }>

/**
 * A trial's summary. For each map: the outcome (side A's win rate and its interval, how soon battles were decided,
 * the first strike, units lost, the supply each army cost), how the armies engaged (the share that ever struck, the
 * median second they first did, units idle and stalled a battle, target switches a unit, seconds blocked), and, when it
 * was measured, what a tick cost; each row against the first variant's, or with a baseline against the same variant
 * before. Then what stalled units were queued behind, and the battles worth watching.
 */
export function trialLines(
  spec: TrialSpec,
  cells: readonly TrialCell[],
  options: Readonly<{ baseline?: readonly TrialCell[]; notable?: readonly Notable[]; before?: string }> = {},
): string[] {
  const { baseline } = options
  const before = options.before ?? "before"
  const lines = [`trial ${spec.id}${spec.question === undefined ? "" : ` — ${spec.question}`}`, trialPlan(spec), ""]
  const variants = [...new Set(cells.map((cell) => cell.variant))]
  const width = Math.max(10, ...variants.map((name) => name.length + (baseline === undefined ? 0 : before.length + 3)))
  for (const map of [...new Set(cells.map((cell) => cell.map))]) {
    const mine = cells.filter((cell) => cell.map === map)
    const first = mine[0] as TrialCell
    const rows: Row[] = mine.flatMap((cell): Row[] => {
      if (baseline === undefined) return [{ name: cell.variant, cell, reference: cell === first ? undefined : first }]
      const earlier = baseline.find((other) => other.map === map && other.variant === cell.variant)
      return [...(earlier === undefined ? [] : [{ name: `${cell.variant} (${before})`, cell: earlier, reference: undefined }]), { name: cell.variant, cell, reference: earlier }]
    })
    const mark = (differs: boolean): string => (differs ? "*" : " ")
    lines.push(map)
    lines.push(`  ${"outcome".padEnd(width)}  ${"A wins".padEnd(17)} ${"decided".padEnd(8)} ${"contact".padEnd(7)}  ${"lost A/B".padEnd(18)} supply A/B`)
    for (const { name, cell, reference } of rows) {
      const wins = `${percent(cell.wins.A.share)}${mark(reference !== undefined && sharesDiffer(cell.wins.A, cell.battles, reference.wins.A, reference.battles))} [${percent(cell.wins.A.low)}–${percent(cell.wins.A.high)}]`
      const decided = `${seconds(cell.decided)}${mark(reference !== undefined && valuesDiffer(cell.lengths, reference.lengths))}`
      const { A, B } = cell.armies
      const lost = `${A.lost.toFixed(1)}/${B.lost.toFixed(1)} of ${A.fielded.toFixed(0)}/${B.fielded.toFixed(0)}`
      lines.push(
        `  ${name.padEnd(width)}  ${wins.padEnd(17)} ${decided.padEnd(8)} ${seconds(cell.contact).padEnd(7)}  ${lost.padEnd(18)} ${pair(A.supply.toFixed(0), B.supply.toFixed(0))}` +
          (cell.timeouts > 0 ? `  ${cell.timeouts} ran out of time` : ""),
      )
    }
    lines.push(`  ${"engagement".padEnd(width)}  ${"struck A/B".padEnd(11)} ${"first A/B".padEnd(12)} ${"idle A/B".padEnd(9)} ${"stalled A/B".padEnd(12)} ${"switches A/B".padEnd(13)} blocked A/B`)
    for (const { name, cell } of rows) {
      const { A, B } = cell.armies
      lines.push(
        `  ${name.padEnd(width)}  ${pair(percent(A.struck), percent(B.struck)).padEnd(11)} ${pair(seconds(A.firstStrike), seconds(B.firstStrike)).padEnd(12)} ` +
          `${pair(A.idle.toFixed(1), B.idle.toFixed(1)).padEnd(9)} ${pair(A.stalled.toFixed(1), B.stalled.toFixed(1)).padEnd(12)} ` +
          `${pair(A.switches.toFixed(1), B.switches.toFixed(1)).padEnd(13)} ${pair(`${A.blocked.toFixed(0)}s`, `${B.blocked.toFixed(0)}s`)}`,
      )
    }
    if (rows.some(({ cell }) => cell.cost !== undefined)) {
      lines.push(`  ${"cost".padEnd(width)}  ${"ms/tick".padEnd(9)} ${"fields/tick".padEnd(12)} ${"settled/tick".padEnd(13)} route calls/tick`)
      for (const { name, cell, reference } of rows) {
        const cost = cell.cost
        if (cost === undefined) continue
        const prior = reference?.cost
        const msMark = mark(prior !== undefined && valuesDiffer(cost.perBattle.map((each) => each.ms), prior.perBattle.map((each) => each.ms)))
        const fieldMark = mark(
          prior !== undefined && cost.fieldsPerTick !== null && prior.fieldsPerTick !== null &&
            valuesDiffer(cost.perBattle.map((each) => each.fields ?? 0), prior.perBattle.map((each) => each.fields ?? 0)),
        )
        lines.push(
          `  ${name.padEnd(width)}  ${`${fixed(cost.msPerTick, 3)}${msMark}`.padEnd(9)} ${`${fixed(cost.fieldsPerTick, 1)}${fieldMark}`.padEnd(12)} ` +
            `${fixed(cost.settledPerTick, 0).padEnd(13)} ${fixed(cost.routeCallsPerTick, 1)}`,
        )
      }
    }
    for (const { name, cell } of rows) {
      const stalls = stallLine(cell)
      if (stalls !== null) lines.push(`  stalled behind (${name}): ${stalls}`)
    }
    lines.push("")
  }
  const notable = options.notable ?? []
  if (notable.length > 0) {
    lines.push("worth watching")
    for (const each of notable.slice(0, 12)) lines.push(`  ${each.why}, ${each.variant}`, `    ${watchCommand(spec, each)}`)
    if (notable.length > 12) lines.push(`  and ${notable.length - 12} more (--json lists them all)`)
    lines.push("")
  }
  lines.push(
    `* differs from ${baseline === undefined ? "the first variant" : `the same variant (${before})`} by more than chance (about 95%; a time or a cost by a twentieth or more too)`,
    "[low–high] is A's win rate's 95% interval · idle and stalled: units a battle that stood 5 s not trying, and trying in vain · switches: new targets a unit while its old one stood",
  )
  return lines
}

/** An army's standing on one map of a round robin: its share of points (a win one, a draw half) over its battles. */
export type Standing = Readonly<{ army: string; points: number; battles: number; beat: readonly string[] }>

/** Each map's round robin, the armies ranked by their share of points, the best first. */
export function standings(spec: TrialSpec, cells: readonly TrialCell[]): ReadonlyMap<string, readonly Standing[]> {
  const names = Object.keys(spec.armies ?? {})
  const byMap = new Map<string, Standing[]>()
  for (const map of [...new Set(cells.map((cell) => cell.map))]) {
    const rows = names.map((army) => {
      let points = 0
      let battles = 0
      const beat: string[] = []
      for (const other of names) {
        if (other === army) continue
        const asA = cells.find((cell) => cell.map === map && cell.variant === `${army} vs ${other}`)
        const asB = cells.find((cell) => cell.map === map && cell.variant === `${other} vs ${army}`)
        const cell = asA ?? asB
        if (cell === undefined) continue
        const won = (asA !== undefined ? cell.wins.A.share : cell.wins.B.share) * cell.battles
        const lost = (asA !== undefined ? cell.wins.B.share : cell.wins.A.share) * cell.battles
        points += won + (cell.battles - won - lost) / 2
        battles += cell.battles
        if (won > lost) beat.push(other)
      }
      return { army, points: battles === 0 ? 0 : points / battles, battles, beat }
    })
    byMap.set(map, rows.sort((a, b) => b.points - a.points || (a.army < b.army ? -1 : 1)))
  }
  return byMap
}

/** A round robin's summary: each map's armies ranked, what each beat; then which led where, and any that beat none. */
export function standingLines(spec: TrialSpec, cells: readonly TrialCell[]): string[] {
  const table = standings(spec, cells)
  const lines = [`trial ${spec.id}${spec.question === undefined ? "" : ` — ${spec.question}`}`, `${trialPlan(spec)}, every army against every other`, ""]
  const width = Math.max(6, ...Object.keys(spec.armies ?? {}).map((name) => name.length))
  for (const [map, rows] of table) {
    lines.push(map)
    for (const row of rows) lines.push(`  ${row.army.padEnd(width)}  ${percent(row.points).padStart(4)} of points  beats ${row.beat.length === 0 ? "none" : row.beat.join(", ")}`)
    lines.push("")
  }
  lines.push("the leader, map by map")
  for (const [map, rows] of table) lines.push(`  ${map}: ${rows.filter((row) => row.points === rows[0]?.points).map((row) => row.army).join(" = ")}`)
  const beaten = Object.keys(spec.armies ?? {}).filter((army) => [...table.values()].every((rows) => (rows.find((row) => row.army === army)?.beat.length ?? 0) === 0))
  if (beaten.length > 0) lines.push(`  beat no army on any map: ${beaten.join(", ")}`)
  lines.push("", "--cells prints every pairing's own tables: how each fight went, not only who won")
  return lines
}
