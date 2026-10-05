// The registry a campaign's battle runs on: each building that makes units given a production recipe from what
// its army says it spawns (`spawns` on its card, `armies/all/army.json`), so it spawns them in waves
// (`src/pulse/production.ts`). What a building spawns is the building's own — the unit, how many a wave, how
// many waves a round, the seconds between them — and when the first wave comes is every building's, one tuned
// number the caller hands in. Nothing else carries a recipe: a grid scenario's buildings, or a building no
// level offers, spawn nothing this way.

import type { BuildingSpawns } from "../armies/types.ts"
import type { ContentRegistry, ProductionRecipe } from "../content/index.ts"
import { withProduction } from "../content/index.ts"
import { TICKS_PER_SECOND } from "../scenario/load.ts"

/** The recipe a building's spawns become in a battle: its waves, the first `firstTicks` into the round and
 *  each after it `secondsBetween` later. */
export function spawnRecipe(spawns: BuildingSpawns, firstTicks: number): ProductionRecipe {
  return {
    output: spawns.unit,
    perWave: spawns.perWave,
    waves: spawns.waves,
    firstTicks,
    intervalTicks: spawns.secondsBetween * TICKS_PER_SECOND,
  }
}

/** `registry`, with each building in `spawns` (by its content id) spawning as it says, its first wave
 *  `firstTicks` into the round. `registry` itself when nothing spawns. */
export function spawningRegistry(
  registry: ContentRegistry,
  spawns: Readonly<Record<string, BuildingSpawns>>,
  firstTicks: number,
): ContentRegistry {
  const entries = Object.entries(spawns)
  if (entries.length === 0) return registry
  return withProduction(registry, Object.fromEntries(entries.map(([structure, own]) => [structure, spawnRecipe(own, firstTicks)])))
}
