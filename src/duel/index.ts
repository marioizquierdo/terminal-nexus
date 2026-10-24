// The duel: two Commander Armies on one map, script against script, model against model, or any mix
// (docs/system-design/duels.md). `round.ts` plays a round, `brief.ts` says what a side knows, `plan.ts` reads a plan,
// `players.ts` has the scripted players, and `playDuel` plays a whole duel with players in hand.

import { briefOf } from "./brief.ts"
import type { Player } from "./players.ts"
import { newDuel, playRound } from "./round.ts"
import type { DuelSetup, DuelState, Side, SidePlan } from "./types.ts"

export * from "./types.ts"
export * from "./maps.ts"
export { briefOf, briefText } from "./brief.ts"
export type { Brief, BriefBuilding, BriefCard, BriefData } from "./brief.ts"
export { readPlan } from "./plan.ts"
export type { ReadPlan } from "./plan.ts"
export { inFormation, SCRIPTED, scriptedName, scriptedNames, scriptedPlayer } from "./players.ts"
export type { Player } from "./players.ts"
export { handOf, mapOf, musterOf, newDuel, placementsOf, playRound, standingOf, titleOf, zonePoint } from "./round.ts"
export { armyOf, duelArmy, loadoutOf, restrictedTo } from "./sides.ts"
export type { DuelArmy } from "./sides.ts"

/** A whole duel, each side's plans from its player, round by round until it ends. */
export function playDuel(setup: DuelSetup, players: Readonly<Record<Side, Player>>): DuelState {
  let state = newDuel(setup)
  while (state.result === null) {
    const plans: Record<Side, SidePlan> = { A: players.A(briefOf(state, "A").data), B: players.B(briefOf(state, "B").data) }
    state = playRound(state, plans).state
  }
  return state
}
