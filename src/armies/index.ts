// The armies the game ships (`src/shipped.ts`), loaded once and checked against the content the game has. A broken army
// stops the game where it starts, with every problem named (`load.ts`). docs/system-design/army-authoring.md is the
// guide to writing one.

import { ARMY_FILES } from "../shipped.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { loadArmies } from "./load.ts"
import type { Armies } from "./types.ts"

export * from "./types.ts"
export { loadArmies } from "./load.ts"
export type { GameFiles, LoadWorld } from "./load.ts"
export { ARMY_FILES } from "../shipped.ts"
export { EFFECTS, addsOf, applyEffect, creditsOf, lasts } from "./effects.ts"
export { ACTION_KEYS, ACTION_LABEL_MAX, ORDERS, actionKey, fittingsWith, fitterOf, modeIn, modeSet, startingModes } from "./actions.ts"
export type { BuildingRow, Callup, EffectKind, Loadout } from "./effects.ts"
export { DEFAULT_SCHEDULE, dealable, dealHand, rarityOrder, slotsFor, weightOf } from "./deal.ts"
export type { Deal } from "./deal.ts"
export { ACTS, EARLIEST_ROUND, LEANS, MAX_LEANS, MAX_ROUNDS, PICK_WORTH, ROUND_CREDITS, dealtBy, pickWorth, roundCredits } from "./curve.ts"
export type { Lean } from "./curve.ts"

/** Every army the game ships, checked and resolved. */
export const ARMIES: Armies = loadArmies({ armies: ARMY_FILES }, { registry: FIXTURE_REGISTRY })
