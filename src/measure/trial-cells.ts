// What a trial's battles say (docs/system-design/testing-ground.md, reading a trial): one cell for each map and variant,
// each army's share of wins with its interval, how soon battles were decided, how many units ever struck and how soon,
// how many stood idle or stalled, how often units switched targets, what a battle cost to play when it was measured;
// whether two cells differ by more than chance; what a trial expects of them; and which battles are worth watching.
// A new measure is a field read from the battle's record here (`armyCell`), a name in `TRIAL_MEASURES`, and a column in
// `trial-summary.ts`. Pure.

import type { SideRecord } from "./battle.ts"
import type { TrialBattle, TrialSpec } from "./trial.ts"
import type { PlayerId } from "../state/types.ts"

const TICKS_PER_SECOND = 12

export type Interval = Readonly<{ share: number; low: number; high: number }>

/** A share of `n` with its 95% interval (Wilson's): what a win rate over a few dozen battles can and cannot say. */
export function wilson(hits: number, n: number): Interval {
  if (n === 0) return { share: 0, low: 0, high: 1 }
  const z = 1.96
  const p = hits / n
  const centre = (p + (z * z) / (2 * n)) / (1 + (z * z) / n)
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n)
  return { share: p, low: Math.max(0, centre - half), high: Math.min(1, centre + half) }
}

export const mean = (values: readonly number[]): number => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length)

export function median(values: readonly number[]): number | null {
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

/** Whether two shares of battles differ by more than chance would make them (a two-sided test at about 95%). */
export function sharesDiffer(a: Interval, aN: number, b: Interval, bN: number): boolean {
  const pooled = (a.share * aN + b.share * bN) / (aN + bN)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / aN + 1 / bN))
  return se === 0 ? a.share !== b.share : Math.abs(a.share - b.share) / se > 1.96
}

/** The least change in a measure worth a mark: a twentieth. Seeds that play alike make a smaller change certain, and
 *  still not worth a reader's attention. */
export const LEAST_CHANGE = 0.05

/** Whether two sets of values (battle lengths, a tick's cost) differ by more than their spread would make them (about
 *  two standard errors), and by at least `LEAST_CHANGE` of the larger mean. */
export function valuesDiffer(a: readonly number[], b: readonly number[]): boolean {
  const gap = Math.abs(mean(a) - mean(b))
  if (gap === 0 || gap < LEAST_CHANGE * Math.max(Math.abs(mean(a)), Math.abs(mean(b)))) return false
  const se = Math.sqrt(standardError(a) ** 2 + standardError(b) ** 2)
  return se === 0 || gap / se > 2
}

export type ArmyCell = Readonly<{
  /** The share of its units that ever struck. */
  struck: number
  /** The median second its striking units first struck. */
  firstStrike: number | null
  /** Units that stood idle five seconds or more at a stretch, a battle: not moving, not striking, not even blocked. */
  idle: number
  /** Units stalled (blocked five seconds or more in a run), a battle. */
  stalled: number
  /** Seconds its units stood blocked, a battle. */
  blocked: number
  /** Target switches (a new target while the one held still stood) for each unit fielded, a battle. */
  switches: number
  /** Units fielded and lost, a battle. */
  fielded: number
  lost: number
  /** The supply its units took as the battle opened, a battle: what the army cost. */
  supply: number
}>

/** What a tick cost, over the battles that were measured: milliseconds (the machine's), and the kernel's route work
 *  (the same on every machine, so it compares two algorithms where a clock compares two machines). */
export type CostCell = Readonly<{
  msPerTick: number
  fieldsPerTick: number | null
  settledPerTick: number | null
  /** Each battle's milliseconds a tick and fields a tick, for a comparison's spread. */
  perBattle: readonly Readonly<{ ms: number; fields: number | null }>[]
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
  cost?: CostCell
}>

function armyCell(sides: readonly SideRecord[], supply: readonly number[]): ArmyCell {
  const fielded = sides.reduce((sum, side) => sum + side.fielded, 0)
  const strikes = sides.flatMap((side) => side.firstStrikes ?? [])
  const firstStrike = median(strikes)
  return {
    struck: fielded === 0 ? 0 : strikes.length / fielded,
    firstStrike: firstStrike === null ? null : firstStrike / TICKS_PER_SECOND,
    idle: mean(sides.map((side) => side.idle ?? 0)),
    stalled: mean(sides.map((side) => side.stalled)),
    blocked: mean(sides.map((side) => side.blockedTicks)) / TICKS_PER_SECOND,
    switches: mean(sides.map((side) => (side.fielded === 0 ? 0 : (side.switches ?? 0) / side.fielded))),
    fielded: mean(sides.map((side) => side.fielded)),
    lost: mean(sides.map((side) => side.lost)),
    supply: mean(supply),
  }
}

function costCell(group: readonly TrialBattle[]): CostCell | undefined {
  const measured = group.flatMap((each) => (each.cost === undefined || each.cost.ticks === 0 ? [] : [each.cost]))
  if (measured.length === 0) return undefined
  const ticks = measured.reduce((sum, cost) => sum + cost.ticks, 0)
  const per = (pick: (cost: (typeof measured)[number]) => number | undefined): number | null =>
    measured.every((cost) => pick(cost) !== undefined) ? measured.reduce((sum, cost) => sum + (pick(cost) as number), 0) / ticks : null
  return {
    msPerTick: measured.reduce((sum, cost) => sum + cost.ms, 0) / ticks,
    fieldsPerTick: per((cost) => cost.fields),
    settledPerTick: per((cost) => cost.settled),
    perBattle: measured.map((cost) => ({ ms: cost.ms / cost.ticks, fields: cost.fields === undefined ? null : cost.fields / cost.ticks })),
  }
}

/** The battles of a trial grouped map by map and variant by variant, in the order they were played. */
function groupsOf(battles: readonly TrialBattle[]): TrialBattle[][] {
  const groups = new Map<string, TrialBattle[]>()
  for (const battle of battles) {
    const key = `${battle.map}\u0000${battle.variant}`
    groups.set(key, [...(groups.get(key) ?? []), battle])
  }
  return [...groups.values()]
}

/** The cells of a trial's battles, map by map and variant by variant, in the order they were played. */
export function trialCells(battles: readonly TrialBattle[]): TrialCell[] {
  return groupsOf(battles).map((group) => {
    const records = group.map((each) => each.battle)
    const n = records.length
    const won = (player: PlayerId): number => records.filter((record) => record.winner === player).length
    const decided = median(records.filter((record) => record.winner !== null).map((record) => record.ticks))
    const contact = median(
      records.flatMap((record) => {
        const firsts = [record.sides.A.firstContact, record.sides.B.firstContact].filter((tick): tick is number => tick !== null)
        return firsts.length === 0 ? [] : [Math.min(...firsts)]
      }),
    )
    const first = group[0] as TrialBattle
    const cost = costCell(group)
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
      ...(cost === undefined ? {} : { cost }),
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
  idleA: (cell) => cell.armies.A.idle,
  idleB: (cell) => cell.armies.B.idle,
  stalledA: (cell) => cell.armies.A.stalled,
  stalledB: (cell) => cell.armies.B.stalled,
  switchesA: (cell) => cell.armies.A.switches,
  switchesB: (cell) => cell.armies.B.switches,
  /** The kernel's route work, the same on every machine: what an algorithm's cost is held to (never the clock, which
   *  is the machine's). Needs `--profile`. */
  fieldsPerTick: (cell) => cell.cost?.fieldsPerTick ?? null,
}

const round = (value: number, places: number): number => Math.round(value * 10 ** places) / 10 ** places

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
        const bound = [expectation.atLeast === undefined ? null : `at least ${expectation.atLeast}`, expectation.atMost === undefined ? null : `at most ${expectation.atMost}`]
          .filter((part) => part !== null)
          .join(" and ")
        failures.push(`${cell.map}, ${cell.variant}: ${expectation.measure} is ${value === null ? "none" : round(value, 2)}, expected ${bound}`)
      }
    }
  }
  return failures
}

/** A battle worth watching, and why. */
export type Notable = Readonly<{ map: string; variant: string; seed: number; swapped: boolean; why: string }>

/**
 * For each cell, the battles a reader should watch: the one that went against the cell's majority (an upset), the
 * slowest and the one with the most stalled units, each when it stands out.
 * A trial's numbers say that something happens; one battle watched says why.
 */
export function notableBattles(battles: readonly TrialBattle[]): Notable[] {
  const found: Notable[] = []
  for (const group of groupsOf(battles)) {
    const pick = (battle: TrialBattle, why: string): void => {
      if (!found.some((each) => each.map === battle.map && each.variant === battle.variant && each.seed === battle.seed && each.swapped === battle.swapped)) {
        found.push({ map: battle.map, variant: battle.variant, seed: battle.seed, swapped: battle.swapped, why })
      }
    }
    const winsA = group.filter((each) => each.battle.winner === "A").length
    const winsB = group.filter((each) => each.battle.winner === "B").length
    const majority = winsA > winsB ? "A" : winsB > winsA ? "B" : null
    const upset = majority === null ? undefined : group.find((each) => each.battle.winner !== null && each.battle.winner !== majority)
    if (upset !== undefined) pick(upset, `an upset: ${upset.battle.winner} won where ${majority} mostly does`)
    const by = (score: (each: TrialBattle) => number): TrialBattle | undefined => {
      const scored = group.map((each) => ({ each, score: score(each) })).sort((a, b) => b.score - a.score)
      const top = scored[0]
      const typical = median(scored.map((entry) => entry.score)) ?? 0
      return top !== undefined && top.score > 0 && top.score > typical * 1.5 ? top.each : undefined
    }
    const slowest = by((each) => each.battle.ticks)
    if (slowest !== undefined) pick(slowest, `the slowest: ${(slowest.battle.ticks / TICKS_PER_SECOND).toFixed(0)}s (${slowest.battle.reason})`)
    const stalls = (each: TrialBattle): number => each.battle.sides.A.stalled + each.battle.sides.B.stalled
    const stalled = by(stalls)
    if (stalled !== undefined) pick(stalled, `the most stalled: ${stalls(stalled)} units`)
  }
  return found
}
