// How a trial is printed (docs/system-design/testing-ground.md, reading a trial): for each map, three small tables —
// the outcome, how the armies engaged, what a tick cost when it was measured — a row per variant, a `*` where a row
// differs from the one it is compared with by more than chance; then the battles worth watching, each with the command
// that watches it. Pure: lines of text.

import type { Variant } from "../scenario/variant.ts"
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

type Row = Readonly<{ name: string; cell: TrialCell; reference: TrialCell | undefined }>

/**
 * A trial's summary. For each map: the outcome (side A's win rate and its interval, how soon battles were decided,
 * the first strike, units lost, the supply each army cost), how the armies engaged (the share that ever struck, the
 * median second they first did, units idle and stalled a battle, target switches a unit), and, when it was measured,
 * what a tick cost; each row against the first variant's, or with a baseline against the same variant before. Then
 * the battles worth watching.
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
    lines.push(`  ${"engagement".padEnd(width)}  ${"struck A/B".padEnd(11)} ${"first A/B".padEnd(12)} ${"idle A/B".padEnd(9)} ${"stalled A/B".padEnd(12)} switches A/B`)
    for (const { name, cell } of rows) {
      const { A, B } = cell.armies
      lines.push(
        `  ${name.padEnd(width)}  ${pair(percent(A.struck), percent(B.struck)).padEnd(11)} ${pair(seconds(A.firstStrike), seconds(B.firstStrike)).padEnd(12)} ` +
          `${pair(A.idle.toFixed(1), B.idle.toFixed(1)).padEnd(9)} ${pair(A.stalled.toFixed(1), B.stalled.toFixed(1)).padEnd(12)} ` +
          `${pair(A.switches.toFixed(1), B.switches.toFixed(1))}`,
      )
    }
    if (rows.some(({ cell }) => cell.cost !== undefined)) {
      lines.push(`  ${"cost".padEnd(width)}  ${"ms/tick".padEnd(9)} ${"fields/tick".padEnd(12)} settled/tick`)
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
          `  ${name.padEnd(width)}  ${`${fixed(cost.msPerTick, 3)}${msMark}`.padEnd(9)} ${`${fixed(cost.fieldsPerTick, 1)}${fieldMark}`.padEnd(12)} ${fixed(cost.settledPerTick, 0)}`,
        )
      }
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
