// The armies the game ships, loaded once: `all` (the buildings and Nexus powers any Commander may use, and
// the bench content its levels put on the Grid) and `vasse` (her Commander and her campaign), checked against the
// content the game has and the maps a level can name. A broken army stops the game where it starts, with every
// problem named (`load.ts`).
//
// Adding an army is a folder under `armies/` with its `army.json`, and one line here: the game reads only
// the armies this file lists, imported with the code — there is no mod loader looking for folders on disk.

import all from "../../armies/all/army.json" with { type: "json" }
import vasse from "../../armies/vasse/army.json" with { type: "json" }
import { MAPS } from "../build/maps.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import type { MissionDefinition } from "../mission/types.ts"
import { loadArmies } from "./load.ts"
import type { Armies, Level } from "./types.ts"

export * from "./types.ts"
export { loadArmies } from "./load.ts"
export type { LoadWorld } from "./load.ts"

/** Every army the game ships, checked and resolved. */
export const ARMIES: Armies = loadArmies([all, vasse], { registry: FIXTURE_REGISTRY, maps: MAPS })

/** A level of a shipped campaign by its id. Throws for one no army has: what names it is code that expects it. */
export function campaignLevel(id: string): Level {
  const level = ARMIES.levels.find((candidate) => candidate.id === id)
  if (level === undefined) throw new Error(`no army has the level "${id}"`)
  return level
}

/** PERIMETER: the first level of Vasse's campaign, the one the game opens when nothing names another. */
export const PERIMETER_LEVEL: Level = campaignLevel("vasse-test-1")

/** PERIMETER's mission, by the name the shell and the tests have always used for it. */
export const PERIMETER: MissionDefinition = PERIMETER_LEVEL.mission
