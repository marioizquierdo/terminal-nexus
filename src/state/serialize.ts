import type { GridTerrain, TerrainId } from "../grid/types.ts"
import { isTerrainId } from "../grid/types.ts"
import { canonicalJson, hashOf } from "./canonical.ts"
import type { MatchState } from "./types.ts"
import { SCHEMA_VERSION } from "./types.ts"

export function serializeState(state: MatchState): string {
  return canonicalJson(state)
}

export function hashState(state: MatchState): string {
  return hashOf(state)
}

/**
 * `parse(serialize(state))` must hash identically — one of the Section 3.9 determinism checks.
 * The parse is defensive rather than trusting: a state read back from disk is untrusted input.
 */
export function parseState(text: string): MatchState {
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== "object" || parsed === null) throw new Error("state is not an object")
  const record = parsed as Record<string, unknown>
  if (record["schemaVersion"] !== SCHEMA_VERSION) {
    throw new Error(`unsupported state schema version ${String(record["schemaVersion"])}`)
  }
  const grid = record["grid"]
  if (typeof grid !== "object" || grid === null) throw new Error("state has no grid")
  const gridRecord = grid as Record<string, unknown>
  const tiles = gridRecord["tiles"]
  if (!Array.isArray(tiles)) throw new Error("grid has no tiles")
  for (const tile of tiles) {
    if (typeof tile !== "string" || !isTerrainId(tile)) {
      throw new Error(`unknown terrain id in serialized state: ${String(tile)}`)
    }
  }
  const terrain: GridTerrain = {
    width: Number(gridRecord["width"]),
    height: Number(gridRecord["height"]),
    tiles: tiles as readonly TerrainId[],
  }
  if (terrain.tiles.length !== terrain.width * terrain.height) {
    throw new Error("serialized grid tile count does not match its dimensions")
  }
  return { ...(parsed as MatchState), grid: terrain }
}
