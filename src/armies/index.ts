// The armies and campaigns the game ships (`files.ts`), loaded once and checked against the content the game has and
// the maps a level can name. A broken army or campaign stops the game where it starts, with every problem named
// (`load.ts`). docs/system-design/army-authoring.md is the guide to writing one.

import { ARMY_FILES, CAMPAIGN_FILES } from "../shipped.ts"
import { MAPS } from "../build/maps.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import type { MissionDefinition } from "../mission/types.ts"
import { loadArmies } from "./load.ts"
import type { Armies, Level } from "./types.ts"

export * from "./types.ts"
export { loadArmies } from "./load.ts"
export type { GameFiles, LoadWorld } from "./load.ts"
export { ARMY_FILES, CAMPAIGN_FILES } from "../shipped.ts"
export { EFFECTS, applyEffect, creditsOf, lasts } from "./effects.ts"
export type { BuildingRow, Callup, EffectKind, Loadout } from "./effects.ts"
export { DEFAULT_SCHEDULE, dealable, dealHand, rarityOrder, slotsFor, weightOf } from "./deal.ts"
export type { Deal } from "./deal.ts"
export { ACTS, EARLIEST_ROUND, LEANS, MAX_LEANS, MAX_ROUNDS, PICK_WORTH, ROUND_CREDITS, dealtBy, pickWorth, roundCredits } from "./curve.ts"
export type { Lean } from "./curve.ts"

/** Every army and campaign the game ships, checked and resolved. */
export const ARMIES: Armies = loadArmies({ armies: ARMY_FILES, campaigns: CAMPAIGN_FILES }, { registry: FIXTURE_REGISTRY, maps: MAPS })

/** A level of a shipped campaign by its id. Throws for one no army has: what names it is code that expects it. */
export function campaignLevel(id: string): Level {
  const level = ARMIES.levels.find((candidate) => candidate.id === id)
  if (level === undefined) throw new Error(`no army has the level "${id}"`)
  return level
}

/** PERIMETER: the first level of Vasse's campaign (`campaigns/vasse`), the one the game opens when nothing names
 *  another. */
export const PERIMETER_LEVEL: Level = campaignLevel("vasse-test-1")

/** PERIMETER's mission, by the name the shell and the tests have always used for it. */
export const PERIMETER: MissionDefinition = PERIMETER_LEVEL.mission
