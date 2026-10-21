// What one kind of unit or building did, round by round, in each campaign level (docs/system-design/measurement.md):
// how many hits it landed on the enemy, the damage they dealt, what it killed and when it first hit. Read from each
// round's events, so a sentence that tells the owner "watch the Nexus shoot in round 3" is checked against the round
// it happens in before it is written (the `remeasure` skill). Pure, like the rest of `src/measure/`.

import type { PlayableLevel } from "../cli/levels.ts"
import type { DomainEvent } from "../events/types.ts"
import type { MatchState, PlayerId } from "../state/types.ts"
import { PLAYERS } from "../state/types.ts"
import type { LevelMeasure, LevelPlan } from "./suites.ts"
import { playLevel } from "./suites.ts"

/** What every entity of one content id on one side did in one battle. */
export type UnitTally = Readonly<{
  /** How many of it stood on the Grid at some moment. */
  stood: number
  /** Attacks it launched, heals left out. */
  shots: number
  /** Its hits on the enemy, and the damage they dealt. */
  hits: number
  damage: number
  /** Enemies it killed. */
  kills: number
  /** The tick of its first hit, or null. */
  firstHit: number | null
}>

/** Each side's tally; null for a side it never stood on. */
export type UnitSides = Readonly<Record<PlayerId, UnitTally | null>>

export type UnitLevelMeasure = Readonly<{
  level: string
  plan: string
  ended: LevelMeasure["ended"]
  rounds: readonly Readonly<{ round: number; sides: UnitSides }>[]
}>

/** What every entity of `contentId` did in one battle, from its states (to know which entity is which) and events. */
export function tallyUnit(states: readonly MatchState[], events: readonly DomainEvent[], contentId: string): UnitSides {
  // Every entity that stood at some moment, by side; `mine` only those of `contentId`.
  const sideOf = new Map<string, PlayerId>()
  const mine = new Map<string, PlayerId>()
  for (const state of states) {
    for (const entity of state.entities) {
      sideOf.set(entity.id, entity.player)
      if (entity.contentId === contentId) mine.set(entity.id, entity.player)
    }
  }
  const sides: Record<PlayerId, { stood: number; shots: number; hits: number; damage: number; kills: number; firstHit: number | null }> = {
    A: { stood: 0, shots: 0, hits: 0, damage: 0, kills: 0, firstHit: null },
    B: { stood: 0, shots: 0, hits: 0, damage: 0, kills: 0, firstHit: null },
  }
  for (const player of mine.values()) sides[player].stood += 1
  const enemyOf = (player: PlayerId, entity: string): boolean => {
    const theirs = sideOf.get(entity)
    return theirs !== undefined && theirs !== player
  }
  for (const event of events) {
    if (event.kind === "attack.launched") {
      const player = mine.get(event.attacker)
      if (player !== undefined && event.attackKind !== "heal") sides[player].shots += 1
    } else if (event.kind === "damage.applied") {
      const player = mine.get(event.source)
      if (player === undefined || !enemyOf(player, event.entity)) continue
      const tally = sides[player]
      tally.hits += 1
      tally.damage += event.amount
      tally.firstHit ??= event.tick
    } else if (event.kind === "entity.died") {
      const player = event.killer === null ? undefined : mine.get(event.killer)
      if (player !== undefined && event.player !== player) sides[player].kills += 1
    }
  }
  const out = (player: PlayerId): UnitTally | null => (sides[player].stood === 0 ? null : sides[player])
  return { A: out(PLAYERS[0] as PlayerId), B: out(PLAYERS[1] as PlayerId) }
}

/** Plays `level` by `plan` to its end and says, round by round, what `contentId` did. */
export function measureUnit(level: PlayableLevel, plan: LevelPlan, contentId: string): UnitLevelMeasure {
  const rounds: { round: number; sides: UnitSides }[] = []
  const ended = playLevel(level, plan, ({ round, states, events }) => {
    rounds.push({ round, sides: tallyUnit(states, events, contentId) })
  })
  return { level: level.id, plan: plan.name, ended, rounds }
}

/** One side's round in a few words: "-" when it stood and did nothing. */
function tallyWords(tally: UnitTally, ticksPerSecond: number): string {
  if (tally.hits === 0 && tally.kills === 0) return tally.shots === 0 ? "-" : `${tally.shots} shots, no hit`
  const first = tally.firstHit === null ? "" : `, first hit at ${(tally.firstHit / ticksPerSecond).toFixed(1)} s`
  return `${tally.hits} hits, ${tally.damage} damage, ${tally.kills} kills${first}`
}

/** What `contentId` did, one line per level and plan, its rounds one after another. */
export function unitLines(contentId: string, measures: readonly UnitLevelMeasure[], ticksPerSecond: number): string[] {
  const lines = [
    `What ${contentId} did in each round of each campaign level: hits on the enemy, their damage, kills and the`,
    `moment of its first hit ("-": it stood and did nothing; "absent": it never stood; "B:" is the other side's).`,
  ]
  for (const measure of measures) {
    const rounds = measure.rounds.map(({ round, sides }) => {
      const said = PLAYERS.flatMap((player) => {
        const tally = sides[player]
        if (tally === null) return []
        const words = tallyWords(tally, ticksPerSecond)
        return [player === "A" ? words : `B: ${words}`]
      })
      return `    round ${round}: ${said.length === 0 ? "absent" : said.join("; ")}`
    })
    lines.push(`  ${measure.level}, ${measure.plan}: ${measure.ended.verdict} in round ${measure.ended.round}`, ...rounds)
  }
  return lines
}
