// A trial (docs/system-design/testing-ground.md): the same maps played over many seeds, as they are and as variants
// change them (another unit, another army, a tuned number, other ground), each battle recorded as every battle is
// (`battle.ts`), and what they say summed up per map and variant — how often each army won, how soon battles were
// decided, how many units ever struck and how soon, how many stood stalled — beside the first variant, with how sure
// each difference is. Optionally each seed is also played with the map mirrored and the sides swapped, so a result is
// the army's and not its end's; and a trial may state what it expects, so it can be kept as a test.
//
// Pure: the same trial plays the same battles on every machine. Reading files and printing are the command's.

import type { ContentRegistry } from "../content/index.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { supplyCostOf } from "../content/supply.ts"
import { loadScenario } from "../scenario/load.ts"
import type { ScenarioDefinition } from "../scenario/types.ts"
import type { Variant } from "../scenario/variant.ts"
import { applyVariant, mirrored, shuffled } from "../scenario/variant.ts"
import type { PlayerId } from "../state/types.ts"
import type { BattleRecord, SideRecord } from "./battle.ts"
import { measureScenario } from "./suites.ts"

const TICKS_PER_SECOND = 12

/** What a trial expects of one measure, on the maps and variants it names (every one when it names none). */
export type Expectation = Readonly<{
  map?: string
  variant?: string
  /** One of `TRIAL_MEASURES`. */
  measure: string
  atLeast?: number
  atMost?: number
}>

export type TrialSpec = Readonly<{
  id: string
  /** What the trial is played to answer, in a sentence. */
  question?: string
  /** Map ids. */
  maps: readonly string[]
  seeds: readonly number[]
  /** Each side's units shuffled among their slots by the seed (`shuffled`). */
  shuffle?: boolean
  /** Each seed played again with the map mirrored and the sides swapped (`mirrored`). */
  swap?: boolean
  /** By name, in order; the first is what the others are compared with. None: the maps as they are. */
  variants?: Readonly<Record<string, Variant>>
  /**
   * A round robin instead (`"melee": "trooper:12"`): every army against every other on each map, each side's one-tile
   * places filled by it front to back, every pair played as a variant named `melee vs mix` (from both ends with
   * `swap`). The summary then ranks the armies on each map, which says whether the best army depends on the ground.
   */
  armies?: Readonly<Record<string, string>>
  /** What every variant starts from (a tune for the whole trial, say), each variant's own on top of it. */
  base?: Variant
  expect?: readonly Expectation[]
}>

/** One battle of a trial, its sides named by army: `A` is whatever the map places as side A, at whichever end; with the
 *  supply each army's units take (`supplyCostOf`), the game's own price of an army, so armies are compared at a cost. */
export type TrialBattle = Readonly<{
  map: string
  variant: string
  seed: number
  swapped: boolean
  battle: BattleRecord
  supply: Readonly<Record<PlayerId, number>>
}>

/** `variant` on top of `base`: its own parts win, its tunes, sets and armies added to the base's. */
export function onTopOf(base: Variant | undefined, variant: Variant): Variant {
  if (base === undefined) return variant
  return {
    ...base,
    ...variant,
    ...(base.set === undefined && variant.set === undefined ? {} : { set: { ...base.set, ...variant.set } }),
    ...(base.army === undefined && variant.army === undefined ? {} : { army: { ...base.army, ...variant.army } }),
    ...(base.tune === undefined && variant.tune === undefined ? {} : { tune: { ...base.tune, ...variant.tune } }),
    ...(base.terrain === undefined && variant.terrain === undefined ? {} : { terrain: { ...base.terrain, ...variant.terrain } }),
    ...(base.targets === undefined && variant.targets === undefined ? {} : { targets: { ...base.targets, ...variant.targets } }),
  }
}

/** The variants a trial plays, by name, in order: its own, or every pair of its armies, each on top of its base. */
export function trialVariants(spec: TrialSpec): Readonly<Record<string, Variant>> {
  const own = ownVariants(spec)
  return Object.fromEntries(Object.entries(own).map(([name, variant]) => [name, onTopOf(spec.base, variant)]))
}

function ownVariants(spec: TrialSpec): Readonly<Record<string, Variant>> {
  if (spec.armies === undefined) return spec.variants ?? { "as built": {} }
  const names = Object.keys(spec.armies)
  const pairs: Record<string, Variant> = {}
  names.forEach((a, index) => {
    for (const b of names.slice(index + 1)) pairs[`${a} vs ${b}`] = { army: { A: spec.armies?.[a] as string, B: spec.armies?.[b] as string } }
  })
  return pairs
}

/** The battles a trial plays, in order: map, variant, seed, then the mirrored one. */
export function trialRuns(spec: TrialSpec): { map: string; variant: string; seed: number; swapped: boolean }[] {
  const variants = Object.keys(trialVariants(spec))
  return spec.maps.flatMap((map) =>
    variants.flatMap((variant) => spec.seeds.flatMap((seed) => [false, ...(spec.swap === true ? [true] : [])].map((swapped) => ({ map, variant, seed, swapped })))),
  )
}

/** A record with its sides swapped and its winner with them: what a mirrored battle says of each army. */
function swapSides(battle: BattleRecord): BattleRecord {
  const winner = battle.winner === "A" ? "B" : battle.winner === "B" ? "A" : null
  return { ...battle, winner, sides: { A: battle.sides.B, B: battle.sides.A } }
}

/** One battle of a trial: the map as the variant makes it, shuffled and mirrored as asked, played and recorded. */
export function playTrialBattle(
  scenario: ScenarioDefinition,
  variant: Variant,
  seed: number,
  options: Readonly<{ shuffle?: boolean; swapped?: boolean; registry?: ContentRegistry }> = {},
): Readonly<{ battle: BattleRecord; supply: Readonly<Record<PlayerId, number>> }> {
  const made = applyVariant(scenario, options.registry ?? FIXTURE_REGISTRY, variant)
  const opened = loadScenario(made.scenario, { registry: made.registry }).state
  const supplyOfSide = (player: PlayerId): number =>
    opened.entities.filter((entity) => entity.player === player).reduce((sum, entity) => sum + supplyCostOf(made.registry.get(entity.contentId)), 0)
  const supply = { A: supplyOfSide("A"), B: supplyOfSide("B") }
  let map = options.shuffle === true ? shuffled(made.scenario, made.registry, seed) : made.scenario
  if (options.swapped === true) map = mirrored(map, made.registry)
  const { battle } = measureScenario(map, seed, made.registry)
  return { battle: options.swapped === true ? swapSides(battle) : battle, supply }
}

/** Plays a whole trial; `maps` holds each map it names, `each` hears of every battle as it is played. */
export function playTrial(
  spec: TrialSpec,
  maps: ReadonlyMap<string, ScenarioDefinition>,
  each: (battle: TrialBattle, index: number, total: number) => void = () => {},
): TrialBattle[] {
  const runs = trialRuns(spec)
  return runs.map((run, index) => {
    const scenario = maps.get(run.map)
    if (scenario === undefined) throw new Error(`trial ${spec.id}: no map "${run.map}"`)
    const variant = trialVariants(spec)[run.variant] ?? {}
    const battle: TrialBattle = { ...run, ...playTrialBattle(scenario, variant, run.seed, { ...(spec.shuffle === undefined ? {} : { shuffle: spec.shuffle }), swapped: run.swapped }) }
    each(battle, index, runs.length)
    return battle
  })
}

// --- What a trial's battles say --------------------------------------------------------------------------------------

type Interval = Readonly<{ share: number; low: number; high: number }>

/** A share of `n` with its 95% interval (Wilson's): what a win rate over a few dozen battles can and cannot say. */
export function wilson(hits: number, n: number): Interval {
  if (n === 0) return { share: 0, low: 0, high: 1 }
  const z = 1.96
  const p = hits / n
  const centre = (p + (z * z) / (2 * n)) / (1 + (z * z) / n)
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n)
  return { share: p, low: Math.max(0, centre - half), high: Math.min(1, centre + half) }
}

const mean = (values: readonly number[]): number => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length)
function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
}
function standardError(values: readonly number[]): number {
  if (values.length < 2) return 0
  const average = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1) / values.length)
}

export type ArmyCell = Readonly<{
  /** The share of its units that ever struck. */
  struck: number
  /** The median second its striking units first struck. */
  firstStrike: number | null
  /** Units stalled (blocked five seconds or more in a run), a battle. */
  stalled: number
  /** Seconds its units stood blocked, a battle. */
  blocked: number
  /** Units fielded and lost, a battle. */
  fielded: number
  lost: number
  /** The supply its units took as the battle opened, a battle: what the army cost. */
  supply: number
}>

/** What one map's battles under one variant say. */
export type TrialCell = Readonly<{
  map: string
  variant: string
  battles: number
  wins: Readonly<Record<PlayerId, Interval>>
  draws: number
  /** Battles that ran out of time with no winner. */
  timeouts: number
  /** Median seconds to a result, over the battles that had one. */
  decided: number | null
  /** Every battle's length in ticks, for a comparison's spread. */
  lengths: readonly number[]
  /** Median second of the first strike of the battle. */
  contact: number | null
  armies: Readonly<Record<PlayerId, ArmyCell>>
}>

function armyCell(sides: readonly SideRecord[], supply: readonly number[]): ArmyCell {
  const fielded = sides.reduce((sum, side) => sum + side.fielded, 0)
  const strikes = sides.flatMap((side) => side.firstStrikes ?? [])
  const firstStrike = median(strikes)
  return {
    struck: fielded === 0 ? 0 : strikes.length / fielded,
    firstStrike: firstStrike === null ? null : firstStrike / TICKS_PER_SECOND,
    stalled: mean(sides.map((side) => side.stalled)),
    blocked: mean(sides.map((side) => side.blockedTicks)) / TICKS_PER_SECOND,
    fielded: mean(sides.map((side) => side.fielded)),
    lost: mean(sides.map((side) => side.lost)),
    supply: mean(supply),
  }
}

/** The cells of a trial's battles, map by map and variant by variant, in the order they were played. */
export function trialCells(battles: readonly TrialBattle[]): TrialCell[] {
  const groups = new Map<string, TrialBattle[]>()
  for (const battle of battles) {
    const key = `${battle.map}\u0000${battle.variant}`
    groups.set(key, [...(groups.get(key) ?? []), battle])
  }
  return [...groups.values()].map((group) => {
    const records = group.map((each) => each.battle)
    const n = records.length
    const won = (player: PlayerId): number => records.filter((record) => record.winner === player).length
    const ended = records.filter((record) => record.winner !== null).map((record) => record.ticks)
    const decided = median(ended)
    const contacts = records.flatMap((record) => {
      const firsts = [record.sides.A.firstContact, record.sides.B.firstContact].filter((tick): tick is number => tick !== null)
      return firsts.length === 0 ? [] : [Math.min(...firsts)]
    })
    const contact = median(contacts)
    const first = group[0] as TrialBattle
    return {
      map: first.map,
      variant: first.variant,
      battles: n,
      wins: { A: wilson(won("A"), n), B: wilson(won("B"), n) },
      draws: n - won("A") - won("B"),
      timeouts: records.filter((record) => record.reason === "tick-limit").length,
      decided: decided === null ? null : decided / TICKS_PER_SECOND,
      lengths: records.map((record) => record.ticks),
      contact: contact === null ? null : contact / TICKS_PER_SECOND,
      armies: {
        A: armyCell(records.map((record) => record.sides.A), group.map((each) => each.supply?.A ?? 0)),
        B: armyCell(records.map((record) => record.sides.B), group.map((each) => each.supply?.B ?? 0)),
      },
    }
  })
}

/** The measures a trial's expectations may name, each read from a cell. */
export const TRIAL_MEASURES: Readonly<Record<string, (cell: TrialCell) => number | null>> = {
  winA: (cell) => cell.wins.A.share,
  winB: (cell) => cell.wins.B.share,
  draws: (cell) => cell.draws / cell.battles,
  /** How far apart the two armies' win rates are: near 0 on a map where neither should have the edge. */
  imbalance: (cell) => Math.abs(cell.wins.A.share - cell.wins.B.share),
  timeouts: (cell) => cell.timeouts / cell.battles,
  decidedSeconds: (cell) => cell.decided,
  contactSeconds: (cell) => cell.contact,
  struckA: (cell) => cell.armies.A.struck,
  struckB: (cell) => cell.armies.B.struck,
  firstStrikeA: (cell) => cell.armies.A.firstStrike,
  firstStrikeB: (cell) => cell.armies.B.firstStrike,
  stalledA: (cell) => cell.armies.A.stalled,
  stalledB: (cell) => cell.armies.B.stalled,
}

/** Each expectation checked on each cell it names: a line per failure, none when the trial holds. */
export function unmet(spec: TrialSpec, cells: readonly TrialCell[]): string[] {
  const failures: string[] = []
  for (const expectation of spec.expect ?? []) {
    const read = TRIAL_MEASURES[expectation.measure]
    if (read === undefined) {
      failures.push(`no measure "${expectation.measure}" (${Object.keys(TRIAL_MEASURES).join(", ")})`)
      continue
    }
    const named = cells.filter((cell) => (expectation.map === undefined || cell.map === expectation.map) && (expectation.variant === undefined || cell.variant === expectation.variant))
    if (named.length === 0) failures.push(`${expectation.measure}: no battles of ${expectation.map ?? "any map"} under ${expectation.variant ?? "any variant"}`)
    for (const cell of named) {
      const value = read(cell)
      const low = expectation.atLeast !== undefined && (value === null || value < expectation.atLeast)
      const high = expectation.atMost !== undefined && (value === null || value > expectation.atMost)
      if (low || high) {
        const bound = [expectation.atLeast === undefined ? null : `at least ${expectation.atLeast}`, expectation.atMost === undefined ? null : `at most ${expectation.atMost}`].filter((part) => part !== null).join(" and ")
        failures.push(`${cell.map}, ${cell.variant}: ${expectation.measure} is ${value === null ? "none" : round(value, 2)}, expected ${bound}`)
      }
    }
  }
  return failures
}

const round = (value: number, places: number): number => Math.round(value * 10 ** places) / 10 ** places
const percent = (share: number): string => `${Math.round(share * 100)}%`
const seconds = (value: number | null): string => (value === null ? "—" : `${value.toFixed(1)}s`)

/** Whether two shares of battles differ by more than chance would make them (a two-sided test at about 95%). */
export function sharesDiffer(a: Interval, aN: number, b: Interval, bN: number): boolean {
  const pooled = (a.share * aN + b.share * bN) / (aN + bN)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / aN + 1 / bN))
  return se === 0 ? a.share !== b.share : Math.abs(a.share - b.share) / se > 1.96
}

/** The least change in how long battles last worth a mark: a battle a twentieth shorter or longer. Seeds that play
 *  alike make a smaller change certain, and still not worth a reader's attention. */
export const LENGTH_CHANGE = 0.05

/** Whether two sets of lengths differ by more than their spread would make them (about two standard errors), and by
 *  at least `LENGTH_CHANGE` of the longer. */
export function lengthsDiffer(a: readonly number[], b: readonly number[]): boolean {
  const gap = Math.abs(mean(a) - mean(b))
  if (gap < LENGTH_CHANGE * Math.max(mean(a), mean(b))) return false
  const se = Math.sqrt(standardError(a) ** 2 + standardError(b) ** 2)
  return se === 0 || gap / se > 2
}

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

/**
 * A trial's summary: for each map, a row per variant — A's win rate with its interval, how soon battles were decided,
 * the first strike of the battle, the share of each army's units that ever struck and the median second they first did,
 * the units stalled and lost a battle — a `*` on a win rate or a time that differs from the first variant's by more than
 * chance (or, against a baseline, from the same variant as it played before); then, over two maps or more, which
 * variant did best for side A on each, which says whether the choice of army is a choice at all.
 */
export function trialLines(spec: TrialSpec, cells: readonly TrialCell[], baseline?: readonly TrialCell[]): string[] {
  const lines = [`trial ${spec.id}${spec.question === undefined ? "" : ` — ${spec.question}`}`, trialPlan(spec), ""]
  const variants = [...new Set(cells.map((cell) => cell.variant))]
  const width = Math.max(8, ...variants.map((name) => name.length + (baseline === undefined ? 0 : 9)))
  const row = (cell: TrialCell, name: string, reference: TrialCell | undefined): string => {
    const winMark = reference !== undefined && sharesDiffer(cell.wins.A, cell.battles, reference.wins.A, reference.battles) ? "*" : " "
    const timeMark = reference !== undefined && lengthsDiffer(cell.lengths, reference.lengths) ? "*" : " "
    const wins = `${percent(cell.wins.A.share)}${winMark} [${percent(cell.wins.A.low)}–${percent(cell.wins.A.high)}]`
    const { A, B } = cell.armies
    return (
      `  ${name.padEnd(width)}  ${wins.padEnd(16)} ${`${seconds(cell.decided)}${timeMark}`.padEnd(8)} ${seconds(cell.contact).padEnd(8)} ` +
      `${`${percent(A.struck)}/${percent(B.struck)}`.padEnd(11)} ${`${seconds(A.firstStrike)}/${seconds(B.firstStrike)}`.padEnd(12)} ` +
      `${`${A.stalled.toFixed(1)}/${B.stalled.toFixed(1)}`.padEnd(12)} ${`${A.lost.toFixed(1)}/${B.lost.toFixed(1)} of ${A.fielded.toFixed(0)}/${B.fielded.toFixed(0)}`.padEnd(19)} ${A.supply.toFixed(0)}/${B.supply.toFixed(0)}` +
      (cell.timeouts > 0 ? `  ${cell.timeouts} ran out of time` : "")
    )
  }
  for (const map of [...new Set(cells.map((cell) => cell.map))]) {
    lines.push(map)
    lines.push(`  ${"variant".padEnd(width)}  ${"A wins".padEnd(16)} decided  contact  struck A/B  first A/B    stalled A/B  lost A/B           supply A/B`)
    const mine = cells.filter((cell) => cell.map === map)
    const first = mine[0] as TrialCell
    for (const cell of mine) {
      if (baseline === undefined) {
        lines.push(row(cell, cell.variant, cell === first ? undefined : first))
        continue
      }
      // Against a baseline, each variant beside itself as it played before.
      const before = baseline.find((other) => other.map === map && other.variant === cell.variant)
      if (before !== undefined) lines.push(row(before, `${cell.variant} (before)`, undefined))
      lines.push(row(cell, cell.variant, before))
    }
    lines.push("")
  }
  const maps = [...new Set(cells.map((cell) => cell.map))]
  if (maps.length >= 2 && variants.length >= 2) {
    const best = maps.map((map) => {
      const mine = cells.filter((cell) => cell.map === map)
      const top = Math.max(...mine.map((cell) => cell.wins.A.share))
      return { map, names: mine.filter((cell) => cell.wins.A.share === top).map((cell) => cell.variant) }
    })
    lines.push("best for side A, map by map")
    for (const { map, names } of best) lines.push(`  ${map}: ${names.join(", ")}`)
    const everywhere = variants.filter((name) => best.every(({ names }) => names.includes(name)))
    lines.push(
      everywhere.length > 0
        ? `  ${everywhere.join(", ")} did best on every map: on these maps the choice is no choice`
        : `  no variant did best on every map: what to field depends on the ground`,
    )
    lines.push("")
  }
  lines.push(
    baseline === undefined
      ? "* differs from the first variant by more than chance (about 95%; a time by a twentieth or more too); [low–high] is A's win rate's 95% interval"
      : "* differs from the same variant before by more than chance (about 95%; a time by a twentieth or more too); [low–high] is A's win rate's 95% interval",
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

/** A round robin's summary: each map's armies ranked, what each beat; then whether one army led on every map. */
export function standingLines(spec: TrialSpec, cells: readonly TrialCell[]): string[] {
  const table = standings(spec, cells)
  const lines = [`trial ${spec.id}${spec.question === undefined ? "" : ` — ${spec.question}`}`, `${trialPlan(spec)}, every army against every other`, ""]
  const width = Math.max(6, ...Object.keys(spec.armies ?? {}).map((name) => name.length))
  for (const [map, rows] of table) {
    lines.push(map)
    for (const row of rows) lines.push(`  ${row.army.padEnd(width)}  ${percent(row.points).padStart(4)} of points  beats ${row.beat.length === 0 ? "none" : row.beat.join(", ")}`)
    lines.push("")
  }
  const leaders = [...table].map(([map, rows]) => ({ map, leader: rows[0]?.army ?? "", top: rows[0]?.points ?? 0, tied: rows.filter((row) => row.points === rows[0]?.points).map((row) => row.army) }))
  const distinct = new Set(leaders.map((each) => each.tied.join(" = ")))
  lines.push("the best army, map by map")
  for (const { map, tied } of leaders) lines.push(`  ${map}: ${tied.join(" = ")}`)
  const always = Object.keys(spec.armies ?? {}).filter((army) => leaders.every((each) => each.tied.includes(army)))
  lines.push(
    always.length > 0
      ? `  ${always.join(", ")} led on every map: on this ground the choice of army is no choice`
      : `  ${distinct.size} different leaders over ${leaders.length} maps: the best army depends on the ground`,
  )
  const beaten = Object.keys(spec.armies ?? {}).filter((army) => [...table.values()].every((rows) => (rows.find((row) => row.army === army)?.beat.length ?? 0) === 0))
  if (beaten.length > 0) lines.push(`  ${beaten.join(", ")} beat no army on any map: never worth fielding here`)
  return lines
}

/** `"1-12"`, `"1,3,5"` or `"1-4,9"` as seeds. */
export function parseSeeds(text: string): number[] {
  const seeds: number[] = []
  for (const part of text.split(",").map((each) => each.trim()).filter((each) => each.length > 0)) {
    const range = /^(\d+)-(\d+)$/.exec(part)
    if (range !== null) {
      const from = Number(range[1])
      const to = Number(range[2])
      if (to < from) throw new Error(`seeds ${part}: the range runs backwards`)
      for (let seed = from; seed <= to; seed += 1) seeds.push(seed)
    } else if (/^\d+$/.test(part)) seeds.push(Number(part))
    else throw new Error(`seeds are "1-12", "1,3,5" or "1-4,9", not "${part}"`)
  }
  if (seeds.length === 0) throw new Error("no seeds")
  return seeds
}
