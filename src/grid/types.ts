// The Grid: coordinates, layers, footprints, and placement.
//
// The design is in grid.md: layers are render order, collision is a composed mask, coordinates have an
// anchor, a footprint and a facing, and distance is Manhattan with four-way movement.
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
  /** Immutable terrain cannot be attacked (grid.md). */
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

/**
 * How the rules measure the Grid (grid.md): what one row counts against one column in every distance, and what
 * one tile of content — a range, a radius, a speed — is worth in that count. Integers only.
 *
 * A terminal cell is about twice as tall as it is wide, and the rules have always counted a row as a column, so a
 * reach is drawn twice as tall as it is wide and a unit walking down crosses the screen twice as fast as one
 * walking across. The Ground Experiment (the Commander round 6) lets the rules agree with the screen instead:
 *
 * - `{ row: 1, tile: 1 }`, `SQUARE` (`coords.ts`) — as the rules have always measured: a step is a tile either way.
 * - `{ row: 2, tile: 1 }` — rows count double: a row counts two columns, so a range 4 reaches 4 columns across and
 *   2 rows up, and a step up or down takes twice as long as a step across.
 * - `{ row: 2, tile: 2 }` — sideways doubled: the same count with every content number doubled in it, so a range 4
 *   reaches 4 rows up and 8 columns across, and a step across takes half as long as a step up or down.
 *
 * A battle carries its measure in its state (`MatchState.measure`), absent when it is `SQUARE`.
 */
export type GridMeasure = Readonly<{ row: 1 | 2; tile: 1 | 2 }>

export type Placement = Readonly<{
  layer: EntityLayer
  anchor: Coord
  footprint: Footprint
  facing: Direction
}>

/**
 * A tile still cooling after a death — the settle rule of pulse.md, earned by the first
 * playtests. Lives here rather than in `occupancy.ts` because it is data the state hashes, not
 * mechanism.
 */
export type VacatedEntry = Readonly<{ layer: EntityLayer; x: number; y: number; until: number }>
