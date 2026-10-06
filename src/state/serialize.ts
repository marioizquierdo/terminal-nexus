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
 * `parse(serialize(state))` must hash identically — one of the determinism checks (testing.md).
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
  if (record["targets"] !== undefined) checkTargets(record["targets"], terrain)
  return { ...(parsed as MatchState), grid: terrain }
}

/** A side's target as a state holds it: a rectangle of whole tiles on the Grid, for side A or B — and the
 *  record absent rather than empty when no side has one (`MatchState.targets`). */
function checkTargets(targets: unknown, grid: GridTerrain): void {
  if (typeof targets !== "object" || targets === null || Array.isArray(targets)) throw new Error("state targets is not an object")
  const sides = Object.keys(targets)
  if (sides.length === 0) throw new Error("state targets is empty: a state with no target has none")
  for (const side of sides) {
    if (side !== "A" && side !== "B") throw new Error(`state targets names the unknown side ${side}`)
    const area = (targets as Record<string, unknown>)[side]
    if (typeof area !== "object" || area === null) throw new Error(`state target for ${side} is not an area`)
    const { x, y, width, height } = area as Record<string, unknown>
    const whole = [x, y, width, height].every((value) => typeof value === "number" && Number.isInteger(value))
    if (!whole || (width as number) < 1 || (height as number) < 1) throw new Error(`state target for ${side} is not a rectangle of whole tiles`)
    const inside = (x as number) >= 0 && (y as number) >= 0 && (x as number) + (width as number) <= grid.width && (y as number) + (height as number) <= grid.height
    if (!inside) throw new Error(`state target for ${side} reaches off the ${grid.width}x${grid.height} Grid`)
  }
}
