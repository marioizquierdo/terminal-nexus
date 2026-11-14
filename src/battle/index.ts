// The battle: two Commander Armies on one map, script against script, model against model, or any mix
// (docs/system-design/battles.md). `round.ts` plays a round, `brief.ts` says what a side knows, `build-actions.ts` reads build actions and build files,
// `players.ts` has the scripted players, and `playToEnd` plays a whole battle with players in hand.

import { briefOf } from "./brief.ts"
import type { Player } from "./players.ts"
import { beginBattle, playRound } from "./round.ts"
import type { BattleSetup, BattleState, Side, BuildActions } from "./types.ts"

export * from "./types.ts"
export * from "./maps.ts"
export { briefOf, briefText } from "./brief.ts"
export type { DrawMap } from "./brief.ts"
export type { Brief, BriefBuilding, BriefCard, BriefData } from "./brief.ts"
export { actionsFor, entryFits, readBuildActions, readBuildFile } from "./build-actions.ts"
export type { BuildEntry, ReadBuildActions, ReadBuildFile, RoundSelector } from "./build-actions.ts"
export { inFormation, SCRIPTED, scriptedName, scriptedNames, scriptedPlayer } from "./players.ts"
export type { Player } from "./players.ts"
export { restoredOf, roundOpening } from "./round-opening.ts"
export type { Callup, Restored, RoundOpeningInput } from "./round-opening.ts"
export { checkBuildActions, handOf, incomeOf, mapOf, musterOf, beginBattle, placementsOf, playRound, standingOf, titleOf, zonePoint } from "./round.ts"
export { armyOf, battleArmy, loadoutOf, restrictedTo } from "./sides.ts"
export type { BattleArmy } from "./sides.ts"

/** A whole battle, each side's plans from its player, round by round until it ends. */
export function playToEnd(setup: BattleSetup, players: Readonly<Record<Side, Player>>): BattleState {
  let state = beginBattle(setup)
  while (state.result === null) {
    const plans: Record<Side, BuildActions> = { A: players.A(briefOf(state, "A").data), B: players.B(briefOf(state, "B").data) }
    state = playRound(state, plans).state
  }
  return state
}
