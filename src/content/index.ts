export * from "./types.ts"
export { CITIZEN_CONTENT } from "./citizen.ts"

import type { ContentDef } from "./types.ts"
import { CITIZEN_CONTENT } from "./citizen.ts"

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

/** The Gate 1A fixture registry: Citizens only, so nothing can be blamed on balance. */
export const FIXTURE_REGISTRY: ContentRegistry = createRegistry(CITIZEN_CONTENT)
