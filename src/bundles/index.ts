// The bundles the game ships, loaded once: `common` (the buildings and Nexus powers any Commander may use, and
// the bench content its levels put on the Grid) and `vasse` (her Commander and her campaign), checked against the
// content the game has and the maps a level can name. A broken bundle stops the game where it starts, with every
// problem named (`load.ts`).
//
// Adding a bundle is a folder under `bundles/` with its `bundle.json`, and one line here: the game reads only
// the bundles this file lists, imported with the code — there is no mod loader looking for folders on disk.

import common from "../../bundles/common/bundle.json" with { type: "json" }
import vasse from "../../bundles/vasse/bundle.json" with { type: "json" }
import { MAPS } from "../build/maps.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import type { MissionDefinition } from "../mission/types.ts"
import { loadBundles } from "./load.ts"
import type { Bundles, Level } from "./types.ts"

export * from "./types.ts"
export { loadBundles } from "./load.ts"
export type { LoadWorld } from "./load.ts"

/** Every bundle the game ships, checked and resolved. */
export const BUNDLES: Bundles = loadBundles([common, vasse], { registry: FIXTURE_REGISTRY, maps: MAPS })

/** A level of a shipped campaign by its id. Throws for one no bundle has: what names it is code that expects it. */
export function bundleLevel(id: string): Level {
  const level = BUNDLES.levels.find((candidate) => candidate.id === id)
  if (level === undefined) throw new Error(`no bundle has the level "${id}"`)
  return level
}

/** PERIMETER: the first level of Vasse's campaign, the one the game opens when nothing names another. */
export const PERIMETER_LEVEL: Level = bundleLevel("vasse-test-1")

/** PERIMETER's mission, by the name the shell and the tests have always used for it. */
export const PERIMETER: MissionDefinition = PERIMETER_LEVEL.mission
