// The Grid: coordinates, layers, footprints, and placement.
//
// Canon: engine.md 3.4 (layers are render order), 3.4.1 (collision is a composed mask),
// 3.5 (coordinates, anchor, footprint, facing), 3.6 (Manhattan distance, four-way movement).
//
// Coordinate convention, used by every module without exception:
//   (0,0) is the north-west tile, x grows east, y grows south, "n" points toward y - 1.

export type Coord = Readonly<{ x: number; y: number }>

/** Offsets relative to an entity's anchor. `[{x:0,y:0}]` for a one-tile actor. */
export type Footprint = readonly Coord[]

export type Direction = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"

/** The five layers, in render order. Lower numbers draw first. */
export type GridLayer = "terrain" | "obstacles" | "workers" | "units" | "air"

/** Layers that can hold entities. `terrain` is a property of a tile, not an entity slot. */
export type EntityLayer = Exclude<GridLayer, "terrain">

export const ENTITY_LAYERS: readonly EntityLayer[] = ["obstacles", "workers", "units", "air"]

export type TerrainId = "terrain.plain" | "terrain.rock" | "terrain.deposit"

export type TerrainKind = Readonly<{
  id: TerrainId
  /** A ground mover can never enter an impassable tile. */
  impassable: boolean
  /** Immutable terrain cannot be attacked (engine.md 3.6). */
  destructible: boolean
}>

export const TERRAIN: Readonly<Record<TerrainId, TerrainKind>> = {
  "terrain.plain": { id: "terrain.plain", impassable: false, destructible: false },
  "terrain.rock": { id: "terrain.rock", impassable: true, destructible: false },
  "terrain.deposit": { id: "terrain.deposit", impassable: false, destructible: false },
}

export function isTerrainId(value: string): value is TerrainId {
  return Object.prototype.hasOwnProperty.call(TERRAIN, value)
}

/** The immutable part of the Grid: its size and its terrain, row-major from the north-west. */
export type GridTerrain = Readonly<{
  width: number
  height: number
  /** Row-major, `y * width + x`. */
  tiles: readonly TerrainId[]
}>

export type Placement = Readonly<{
  layer: EntityLayer
  anchor: Coord
  footprint: Footprint
  facing: Direction
}>

/**
 * A tile still cooling after a death — engine.md 4.3's settle rule, earned by Milestone 1
 * playtesting. Lives here rather than in `occupancy.ts` because it is data the state hashes, not
 * mechanism.
 */
export type VacatedEntry = Readonly<{ layer: EntityLayer; x: number; y: number; until: number }>
