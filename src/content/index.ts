export * from "./types.ts"
export { CITIZEN_CONTENT } from "./citizen.ts"
export { RAVEL_CONTENT } from "./ravel.ts"
export { PROVING_GROUND_CONTENT } from "./proving-grounds.ts"
export { ARMY_CONTENT } from "./army-content.ts"
export { FITTED_MARK, baseContentId, fittedId, fittingsOf } from "./fitted.ts"

import type { ContentDef, ProductionRecipe } from "./types.ts"
import { FITTED_MARK, baseContentId, fittedId, fittingsOf } from "./fitted.ts"
import { CITIZEN_CONTENT } from "./citizen.ts"
import { RAVEL_CONTENT } from "./ravel.ts"
import { PROVING_GROUND_CONTENT } from "./proving-grounds.ts"
import { ARMY_CONTENT } from "./army-content.ts"

export type ContentRegistry = Readonly<{
  get(id: string): ContentDef
  has(id: string): boolean
  /** The ids it was made from: never a fitted id (`fittedId`), which it resolves from one of these. */
  ids(): readonly string[]
  /** How it resolves a **fitted id** — a building's content id with what that one building carries (`fittedId`) —
   *  from the definition of its base. Absent: it resolves none, and knows only the ids it was made from. */
  fitter?: Fitter
}>

/**
 * How a registry resolves a fitted id: `base` (its base's definition, as this registry holds it) with each of
 * `fittings` applied, in order — or `null` when they are not ones its building can carry together, in that order. The
 * result's `id` is set by the registry. The army loader makes the game's from every building card's actions
 * (`src/armies/load.ts`); the content layer only calls it.
 */
export type Fitter = (base: ContentDef, fittings: readonly string[]) => ContentDef | null

/** `definition` carrying `fittings` by `registry`'s fitter, its id the fitted one — or `null` when the registry
 *  resolves none, or not these. For a definition the registry does not hold as such: a building's with the recipe its
 *  card gives it in a battle, to say on its card what its wave becomes. */
export function refitted(registry: ContentRegistry, definition: ContentDef, fittings: readonly string[]): ContentDef | null {
  if (fittings.length === 0) return definition
  const made = registry.fitter?.(definition, fittings) ?? null
  return made === null ? null : { ...made, id: fittedId(definition.id, fittings) }
}

/** A registry of `definitions`, resolving fitted ids by `fitter` when given. Throws for a duplicate id, a fitted id
 *  among them, or a `roundsOut` that is not a whole number from 0 or is on something that is not a Commander. */
export function createRegistry(definitions: readonly ContentDef[], fitter?: Fitter): ContentRegistry {
  const byId = new Map<string, ContentDef>()
  for (const definition of definitions) {
    if (byId.has(definition.id)) throw new Error(`duplicate content id: ${definition.id}`)
    if (definition.roundsOut !== undefined) {
      if (definition.commander !== true) throw new Error(`${definition.id}: only a Commander sits rounds out, and it is not one`)
      if (!Number.isInteger(definition.roundsOut) || definition.roundsOut < 0)
        throw new Error(`${definition.id}: roundsOut must be a whole number from 0, received ${definition.roundsOut}`)
    }
    if (definition.id.includes(FITTED_MARK)) throw new Error(`${definition.id}: a content id may not hold "${FITTED_MARK}", which marks what a building carries`)
    byId.set(definition.id, definition)
  }
  // Each fitted id resolved once, the first time it is asked for: the same definition object every time after, as a
  // base id's is.
  const fitted = new Map<string, ContentDef | null>()
  const resolve = (id: string): ContentDef | undefined => {
    const own = byId.get(id)
    if (own !== undefined || fitter === undefined || !id.includes(FITTED_MARK)) return own
    if (!fitted.has(id)) {
      const base = byId.get(baseContentId(id))
      const made = base === undefined ? null : fitter(base, fittingsOf(id))
      fitted.set(id, made === null ? null : { ...made, id })
    }
    return fitted.get(id) ?? undefined
  }
  return {
    get(id: string): ContentDef {
      const definition = resolve(id)
      if (definition === undefined) throw new Error(`unknown content id: ${id}`)
      return definition
    },
    has: (id: string) => resolve(id) !== undefined,
    ids: () => [...byId.keys()].sort(),
    ...(fitter === undefined ? {} : { fitter }),
  }
}

/** `registry`, resolving fitted ids by `fitter`: the same definitions. */
export function withFitter(registry: ContentRegistry, fitter: Fitter): ContentRegistry {
  return createRegistry(
    registry.ids().map((id) => registry.get(id)),
    fitter,
  )
}

/** The engine's own content, written in TypeScript: the bench rosters the bench maps and the kernel's tests stand on. */
export const BENCH_CONTENT: readonly ContentDef[] = [...CITIZEN_CONTENT, ...RAVEL_CONTENT, ...PROVING_GROUND_CONTENT]

/**
 * Every piece of content the game has: the bench's and every army's, as one registry (the name is the first battles':
 * all of it was fixtures then). The first battles held Citizens alone, so that nothing which happened could be
 * blamed on balance; the Ravels were added so that something which happens can be blamed on *contrast*.
 * The Proving Grounds roster (from the unit-architecture spike) adds a third, faction-neutral set for a
 * different reason again: not contrast, but coverage — a batch of deliberately varied unit mechanics
 * to stress the content/kernel boundary. All three are disposable bench content, not Commander Armies.
 * Beside them stands everything the army files define as data (`./army-content.ts`): the Commanders, and the units
 * and buildings their armies and factions bring.
 */
export const FIXTURE_REGISTRY: ContentRegistry = createRegistry([...BENCH_CONTENT, ...ARMY_CONTENT.map((entry) => entry.definition)])

/**
 * `registry`, with each named building given a production recipe — how a battle opts its buildings into
 * spawning units in waves (a campaign's buildings, each as its army says: `src/match/training.ts`). The
 * shared content carries none, so every other map that has the same building on it resolves exactly as it
 * did. **A building makes its units one way in a battle**: one given a recipe loses any `spawn` of its own,
 * the periodic spawner the bench Hatchery has, so the recipe alone decides what it makes and when. Throws
 * for an unknown id, or one that is not a structure, a recipe whose output is a structure or unknown, or
 * one of its numbers that is not a positive whole number.
 */
export function withProduction(
  registry: ContentRegistry,
  recipes: Readonly<Record<string, ProductionRecipe>>,
): ContentRegistry {
  for (const [id, recipe] of Object.entries(recipes)) {
    if (!registry.has(id)) throw new Error(`production: unknown building "${id}"`)
    if (registry.get(id).layer !== "obstacles") throw new Error(`production: "${id}" is not a building`)
    if (!registry.has(recipe.output)) throw new Error(`production: "${id}" spawns the unknown "${recipe.output}"`)
    if (registry.get(recipe.output).layer === "obstacles") throw new Error(`production: "${id}" spawns "${recipe.output}", a building`)
    for (const field of ["perWave", "waves", "firstTicks", "intervalTicks"] as const) {
      const value = recipe[field]
      if (!Number.isInteger(value) || value <= 0) throw new Error(`production: "${id}" ${field} must be a positive integer, received ${value}`)
    }
    if (recipe.exit !== undefined && recipe.exit !== "ground") throw new Error(`production: "${id}" exit must be "ground" or absent, received ${String(recipe.exit)}`)
  }
  const definitions = registry.ids().map((id) => {
    const definition = registry.get(id)
    const recipe = recipes[id]
    if (recipe === undefined) return definition
    const { spawn: _ownSpawn, ...rest } = definition
    return { ...rest, production: recipe }
  })
  // What a building carries is resolved from its base as this registry holds it, recipe and all.
  return createRegistry(definitions, registry.fitter)
}
