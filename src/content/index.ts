export * from "./types.ts"
export { CITIZEN_CONTENT } from "./citizen.ts"
export { RAVEL_CONTENT } from "./ravel.ts"
export { PROVING_GROUND_CONTENT } from "./proving-grounds.ts"
export { COMMANDER_CONTENT } from "./commanders.ts"

import type { ContentDef, ProductionRecipe } from "./types.ts"
import { CITIZEN_CONTENT } from "./citizen.ts"
import { RAVEL_CONTENT } from "./ravel.ts"
import { PROVING_GROUND_CONTENT } from "./proving-grounds.ts"
import { COMMANDER_CONTENT } from "./commanders.ts"

export type ContentRegistry = Readonly<{
  get(id: string): ContentDef
  has(id: string): boolean
  ids(): readonly string[]
}>

export function createRegistry(definitions: readonly ContentDef[]): ContentRegistry {
  const byId = new Map<string, ContentDef>()
  for (const definition of definitions) {
    if (byId.has(definition.id)) throw new Error(`duplicate content id: ${definition.id}`)
    byId.set(definition.id, definition)
  }
  return {
    get(id: string): ContentDef {
      const definition = byId.get(id)
      if (definition === undefined) throw new Error(`unknown content id: ${id}`)
      return definition
    },
    has: (id: string) => byId.has(id),
    ids: () => [...byId.keys()].sort(),
  }
}

/**
 * The fixture registry. The first battles held Citizens alone, so that nothing which happened could be
 * blamed on balance; the Ravels were added so that something which happens can be blamed on *contrast*.
 * The Proving Grounds roster (from the unit-architecture spike) adds a third, faction-neutral set for a
 * different reason again: not contrast, but coverage — a batch of deliberately varied unit mechanics
 * to stress the content/kernel boundary. All three are disposable bench content, not Commander Armies.
 * Beside them stands the one named Commander, Vasse (`./commanders.ts`), at the size PERIMETER needs:
 * a Commander, which is still not a Commander Army.
 */
export const FIXTURE_REGISTRY: ContentRegistry = createRegistry([
  ...CITIZEN_CONTENT,
  ...RAVEL_CONTENT,
  ...PROVING_GROUND_CONTENT,
  ...COMMANDER_CONTENT,
])

/**
 * `registry`, with each named building given a production recipe — how a battle opts its buildings into
 * training (step 6C's Barracks, in PERIMETER). The shared content carries none, so every other map that
 * has the same building on it resolves exactly as it did. Throws for an unknown id, or one that is not a
 * structure, or a recipe whose output is a structure or unknown.
 */
export function withProduction(
  registry: ContentRegistry,
  recipes: Readonly<Record<string, ProductionRecipe>>,
): ContentRegistry {
  const definitions = registry.ids().map((id) => {
    const definition = registry.get(id)
    const recipe = recipes[id]
    return recipe === undefined ? definition : { ...definition, production: recipe }
  })
  for (const [id, recipe] of Object.entries(recipes)) {
    if (!registry.has(id)) throw new Error(`production: unknown building "${id}"`)
    if (registry.get(id).layer !== "obstacles") throw new Error(`production: "${id}" is not a building`)
    if (!registry.has(recipe.output)) throw new Error(`production: "${id}" trains the unknown "${recipe.output}"`)
    if (registry.get(recipe.output).layer === "obstacles") throw new Error(`production: "${id}" trains "${recipe.output}", a building`)
    for (const [field, value] of [["quantity", recipe.quantity], ["intervalTicks", recipe.intervalTicks], ["perPulse", recipe.perPulse]] as const) {
      if (!Number.isInteger(value) || value <= 0) throw new Error(`production: "${id}" ${field} must be a positive integer, received ${value}`)
    }
  }
  return createRegistry(definitions)
}
