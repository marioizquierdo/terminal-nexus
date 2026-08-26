export * from "./types.ts"
export { CITIZEN_CONTENT } from "./citizen.ts"
export { RAVEL_CONTENT } from "./ravel.ts"
export { PROVING_GROUND_CONTENT } from "./proving-grounds.ts"

import type { ContentDef } from "./types.ts"
import { CITIZEN_CONTENT } from "./citizen.ts"
import { RAVEL_CONTENT } from "./ravel.ts"
import { PROVING_GROUND_CONTENT } from "./proving-grounds.ts"

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
 * The fixture registry. Gate 1A held Citizens alone, so that nothing which happened could be blamed
 * on balance; Gate 1B adds Ravels, so that something which happens can be blamed on *contrast*.
 * The Proving Grounds roster (unit-design-architecture spike) adds a third, faction-neutral set for a
 * different reason again: not contrast, but coverage — a batch of deliberately varied unit mechanics
 * to stress the content/kernel boundary. All three are disposable bench content, not Commander Armies.
 */
export const FIXTURE_REGISTRY: ContentRegistry = createRegistry([
  ...CITIZEN_CONTENT,
  ...RAVEL_CONTENT,
  ...PROVING_GROUND_CONTENT,
])
