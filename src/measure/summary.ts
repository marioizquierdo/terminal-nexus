// A measurement in plain words (docs/system-design/measurement.md): what each scenario did, how the duels went —
// who beat whom, how evenly a mirror split between the two ends of the map, whether an early lucky hand or an early
// lead predicted the winner, how long units stood blocked and how tight armies met — and how each campaign level
// played by each plan. Lines of text, so the command prints them and a report quotes them.

import type { Side } from "../duel/index.ts"
import type { BattleRecord } from "./battle.ts"
import type { Measurement } from "./spec.ts"
import type { DuelMeasure } from "./suites.ts"
import { luckOf } from "./suites.ts"

const both = (battle: BattleRecord, read: (side: BattleRecord["sides"]["A"]) => number): number => read(battle.sides.A) + read(battle.sides.B)

const mean = (values: readonly number[]): number => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length)

const fixed = (value: number, digits = 1): string => value.toFixed(digits)

const percent = (part: number, whole: number): string => (whole === 0 ? "-" : `${Math.round((100 * part) / whole)}%`)

/** Blocked ticks, the longest run and stalled units over a list of battles. */
function stalls(battles: readonly BattleRecord[]): string {
  const blocked = battles.reduce((sum, battle) => sum + both(battle, (side) => side.blockedTicks), 0)
  const longest = Math.max(0, ...battles.map((battle) => Math.max(battle.sides.A.longestBlocked, battle.sides.B.longestBlocked)))
  const stalled = battles.reduce((sum, battle) => sum + both(battle, (side) => side.stalled), 0)
  return `blocked ${blocked} unit-ticks, longest ${longest}, stalled units ${stalled}`
}

/** Of duels where the two sides differ by `score`, how many the higher side won. */
function predicted(duels: readonly DuelMeasure[], score: (duel: DuelMeasure, side: Side) => number): Readonly<{ decided: number; right: number }> {
  let decided = 0
  let right = 0
  for (const duel of duels) {
    if (duel.result.winner === null) continue
    const a = score(duel, "A")
    const b = score(duel, "B")
    if (a === b) continue
    decided += 1
    if ((a > b ? "A" : "B") === duel.result.winner) right += 1
  }
  return { decided, right }
}

/**
 * How lucky a side's first two hands were. **By the cards it kept, as they did in every other duel**: each card's
 * share of the duels won by a side that kept it, in the duels besides this one, added up over its first two rounds; a
 * card no other duel kept counts as even, a half. Rarity cannot say it: the Nexus Pulse deals both sides the same
 * rarities each round, so they never differ by it. Only when no card is named (a result written before they were)
 * does it fall back to the rarity of what was kept.
 */
export function luckByCards(duels: readonly DuelMeasure[]): (duel: DuelMeasure, side: Side) => number {
  const named = duels.some((duel) => duel.rounds.some((round) => round.sides.A.keptId !== undefined))
  if (!named) return (duel, side) => duel.rounds.slice(0, 2).reduce((sum, round) => sum + luckOf(round.sides[side].kept), 0)
  // Every card's duels kept in and won, over all of them; each duel's own taken out when it is judged.
  const tally = new Map<string, { kept: number; won: number }>()
  const own = (duel: DuelMeasure): Map<string, { kept: number; won: number }> => {
    const mine = new Map<string, { kept: number; won: number }>()
    for (const side of ["A", "B"] as const) {
      const cards = new Set(duel.rounds.map((round) => round.sides[side].keptId).filter((id): id is string => typeof id === "string"))
      for (const id of cards) {
        const entry = mine.get(id) ?? { kept: 0, won: 0 }
        entry.kept += 1
        if (duel.result.winner === side) entry.won += 1
        mine.set(id, entry)
      }
    }
    return mine
  }
  const owns = new Map(duels.map((duel) => [duel, own(duel)] as const))
  for (const mine of owns.values()) {
    for (const [id, entry] of mine) {
      const total = tally.get(id) ?? { kept: 0, won: 0 }
      total.kept += entry.kept
      total.won += entry.won
      tally.set(id, total)
    }
  }
  return (duel, side) => {
    const mine = owns.get(duel) ?? new Map()
    return duel.rounds.slice(0, 2).reduce((sum, round) => {
      const id = round.sides[side].keptId
      if (typeof id !== "string") return sum
      const total = tally.get(id) ?? { kept: 0, won: 0 }
      const kept = total.kept - (mine.get(id)?.kept ?? 0)
      const won = total.won - (mine.get(id)?.won ?? 0)
      return sum + (kept === 0 ? 0.5 : won / kept)
    }, 0)
  }
}

/** How far a side led after round 2: its Nexus's share of health left, less the enemy's, then damage dealt. */
const earlyLead = (duel: DuelMeasure, side: Side): number => {
  const round = duel.rounds[Math.min(1, duel.rounds.length - 1)]
  if (round === undefined) return 0
  const enemy: Side = side === "A" ? "B" : "A"
  const share = (who: Side): number => round.sides[who].nexus / Math.max(1, round.sides[who].nexusMost)
  const dealt = (who: Side): number => duel.rounds.slice(0, 2).reduce((sum, played) => sum + played.battle.sides[who].dealt, 0)
  return (share(side) - share(enemy)) * 1_000_000 + dealt(side) - dealt(enemy)
}

export function summaryLines(measurement: Measurement): string[] {
  const lines: string[] = []
  lines.push(`measurement "${measurement.spec}" on ${measurement.date}, build ${measurement.build}, routes: ${measurement.routing}`)
  if (measurement.question !== undefined) lines.push(`the question: ${measurement.question}`)
  if (measurement.msPerTick !== null) {
    const jobs = (measurement.jobs ?? 1) > 1 ? `, with ${measurement.jobs} processes side by side` : ""
    lines.push(`a tick took ${fixed(measurement.msPerTick, 3)} ms on average on this machine${jobs}`)
  }

  if (measurement.scenarios.length > 0) {
    lines.push("", "Scenarios (how often side A won, the ticks a run took, A's first strike, how long units stood blocked):")
    const byScenario = new Map<string, BattleRecord[]>()
    for (const run of measurement.scenarios) {
      const list = byScenario.get(run.scenario)
      if (list === undefined) byScenario.set(run.scenario, [run.battle])
      else list.push(run.battle)
    }
    for (const [scenario, battles] of byScenario) {
      const won = battles.filter((battle) => battle.winner === "A").length
      const lost = battles.filter((battle) => battle.winner === "B").length
      lines.push(
        `  ${scenario.padEnd(32)} A won ${won}/${battles.length}, lost ${lost}; ${fixed(mean(battles.map((battle) => battle.ticks)), 0)} ticks; first contact ${fixed(mean(battles.map((battle) => battle.sides.A.firstContact ?? battle.ticks)), 0)}; ${stalls(battles)}`,
      )
    }
  }

  if (measurement.duels.length > 0) {
    const duels = measurement.duels
    lines.push("", `Duels: ${duels.length} on ${duels[0]?.map ?? "?"}, each pairing from both ends`)
    const byNexus = duels.filter((duel) => duel.result.by === "nexus").length
    lines.push(`  ${byNexus} ended by a Nexus falling; ${fixed(mean(duels.map((duel) => duel.rounds.length)))} rounds on average`)
    const overBy = (round: number): number => duels.filter((duel) => duel.rounds.length <= round).length
    lines.push(`  over by the end of round 1: ${overBy(1)}, round 2: ${overBy(2)}, round 3: ${overBy(3)}`)
    const commanders = [...new Set(duels.flatMap((duel) => [duel.commanders.A, duel.commanders.B]))].sort()
    for (const a of commanders) {
      for (const b of commanders) {
        if (a >= b) continue
        const games = duels.filter((duel) => (duel.commanders.A === a && duel.commanders.B === b) || (duel.commanders.A === b && duel.commanders.B === a))
        const wins = (name: string): number => games.filter((duel) => duel.result.winner !== null && duel.commanders[duel.result.winner] === name).length
        lines.push(`  ${a} v ${b}: ${a} ${wins(a)}, ${b} ${wins(b)}, draw ${games.length - wins(a) - wins(b)}`)
      }
    }
    const mirrors = duels.filter((duel) => duel.commanders.A === duel.commanders.B)
    const west = mirrors.filter((duel) => duel.result.winner === "A").length
    const east = mirrors.filter((duel) => duel.result.winner === "B").length
    lines.push(`  mirrors: ${mirrors.length}, side A (west) won ${west}, side B (east) ${east}, draws ${mirrors.length - west - east}`)
    const luck = predicted(duels, luckByCards(duels))
    const lead = predicted(duels, earlyLead)
    lines.push(`  the luckier first two hands won ${luck.right} of ${luck.decided} duels they differed in (${percent(luck.right, luck.decided)})`)
    lines.push(`  the side ahead after round 2 won ${lead.right} of ${lead.decided} (${percent(lead.right, lead.decided)})`)
    const battles = duels.flatMap((duel) => duel.rounds.map((round) => round.battle))
    lines.push(`  ${battles.length} battles: ${stalls(battles)}`)
    const spreads = battles.flatMap((battle) => [battle.sides.A.spreadAtContact, battle.sides.B.spreadAtContact]).filter((spread): spread is number => spread !== null)
    lines.push(`  armies met the enemy ${fixed(mean(spreads))} columns from their middle on average`)
  }

  if (measurement.levels.length > 0) {
    lines.push("", "Campaign levels (verdict, round it ended, the Commander's falls by round, units lost):")
    for (const level of measurement.levels) {
      const falls = level.rounds.filter((round) => round.battle.sides.A.commanderFellAt !== null).map((round) => round.round)
      const lost = level.rounds.reduce((sum, round) => sum + round.battle.sides.A.lost, 0)
      lines.push(
        `  ${level.level.padEnd(16)} ${level.plan.padEnd(16)} ${level.ended.verdict} in round ${level.ended.round}; falls ${falls.length === 0 ? "none" : falls.join(", ")}; lost ${lost}; ${stalls(level.rounds.map((round) => round.battle))}`,
      )
    }
  }
  return lines
}
