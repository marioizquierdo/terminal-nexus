// Coordinates, footprints and distance on the Grid (grid.md).
//
// **A row counts two columns.** A tile is one terminal cell, and a cell is about twice as tall as it is wide, so the
// rules count the ground the way the screen shows it: a row up or down counts `ROW_DISTANCE` columns in every
// distance, and a step up or down, a whole row, takes twice the time of a step across (`stepLength`). So:
//
// - **a reach is as wide as it is tall on screen**: a reach of 6 covers 6 columns either side and 3 rows up and
//   down (`src/grid/reach.ts` draws it);
// - **every step covers its distance at one pace**: "in range" and "reachable in that time" agree, so eleven rows
//   down are as far, and as long a walk, as twenty-two columns across;
// - **touching is not a distance**: two tiles touch when they share a side (`gridSteps` is 1), one row up as much
//   as one column across. Melee reaches what touches it, a unit stands beside what it touches, and every reach of
//   1 or more covers what touches (`footprintWithin`), so a reach of 1 means touching.
//
// Every distance in the game is worked out here and in `reach.ts`, never by hand: the kernel, the rules between
// rounds, the Build Phase and the screen all ask these functions.

import type { Coord, Direction, Footprint, GridTerrain } from "./types.ts"

/**
 * What one row up or down counts against one column across, in every distance and every step: two, as a cell is
 * about twice as tall as it is wide. A unit stands on whole tiles, so a step up or down is a whole row, and takes
 * twice as long as a step across.
 */
export const ROW_DISTANCE = 2

/**
 * The four directions a mover may step in, in a fixed order: the compass points, never a diagonal (grid.md). A unit
 * that cuts corners is a unit whose next tile a viewer cannot predict; four-way steps read as up, down, left or
 * right.
 */
export const DIRECTIONS: readonly Direction[] = ["n", "e", "s", "w"]

const DIRECTION_VECTORS: Readonly<Record<Direction, Coord>> = {
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
  nw: { x: -1, y: -1 },
}

export function step(from: Coord, direction: Direction): Coord {
  const vector = DIRECTION_VECTORS[direction]
  return { x: from.x + vector.x, y: from.y + vector.y }
}

/**
 * How far `dx` columns across and `dy` rows down go along each axis, both counted in columns: `across` is `dx`,
 * and `down` is `dy` rows of `ROW_DISTANCE` columns each. Signed, east and south positive. The one place a row is
 * weighed: a distance (`gridDistance`), the way straight at a tile (`directionOf`), and a slope read off the map
 * (the raid's trail, the raid panel's bearing) all start from it.
 */
export function inColumns(dx: number, dy: number): Readonly<{ across: number; down: number }> {
  return { across: dx, down: dy * ROW_DISTANCE }
}

/**
 * The distance between two tiles: the columns across, plus `ROW_DISTANCE` for each row up or down (`inColumns`).
 * Every range, reach and radius in the game is counted in it, to the nearest tile of a footprint
 * (`footprintDistance`). A tracer or a trail may still draw a diagonal; that is a picture of a way, not a distance.
 */
export function gridDistance(a: Coord, b: Coord): number {
  const { across, down } = inColumns(b.x - a.x, b.y - a.y)
  return Math.abs(across) + Math.abs(down)
}

/**
 * Four-way steps between two tiles, a row counting one like a column: 1 is touching along a side. What touching
 * means — melee's reach, a unit standing beside another, a way that ends next to its target — and never a
 * distance.
 */
export function gridSteps(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/**
 * How far one step in `direction` goes: 1 across a column, `ROW_DISTANCE` up or down a row — `gridDistance` from
 * where it starts to where it lands. A step takes time in proportion (`stepCost`, `src/pulse/movement.ts`), so
 * every step covers its distance at one pace.
 */
export function stepLength(direction: Direction): number {
  return direction === "n" || direction === "s" ? ROW_DISTANCE : 1
}

/**
 * The compass point straight at `to` from `from`, of the four a mover steps in: along the axis that is further in
 * columns (`inColumns`), so a mover heads along the screen's own diagonal — two columns across for every row down.
 * An exact tie prefers east or west; a zero vector gives `fallback`.
 */
export function directionOf(from: Coord, to: Coord, fallback: Direction = "s"): Direction {
  const { across, down } = inColumns(to.x - from.x, to.y - from.y)
  if (across === 0 && down === 0) return fallback
  if (Math.abs(across) >= Math.abs(down)) return across > 0 ? "e" : "w"
  return down > 0 ? "s" : "n"
}

/**
 * A footprint's bounding box, in tiles. Offsets are authored from `(0,0)` (see `rectFootprint`), so
 * the extent is one past the largest offset on each axis.
 *
 * Shared rather than re-derived: the loader needs it to turn a centre tile into an anchor, and the
 * effect system needs it to size a collapse to the thing that died. Two private copies of
 * `Math.max(...) + 1` is how those two quietly disagree about what a 3x2 unit is.
 */
export function footprintExtent(footprint: Footprint): { width: number; height: number } {
  let width = 0
  let height = 0
  for (const offset of footprint) {
    if (offset.x + 1 > width) width = offset.x + 1
    if (offset.y + 1 > height) height = offset.y + 1
  }
  return { width, height }
}

/** The tiles a footprint anchored at `anchor` spans on the map: its first and last column and row. */
export type FootprintBox = Readonly<{ left: number; right: number; top: number; bottom: number }>

/** The box round the tiles a footprint anchored at `anchor` covers, in the map's own coordinates. */
export function footprintBox(anchor: Coord, footprint: Footprint): FootprintBox {
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const offset of footprint) {
    left = Math.min(left, anchor.x + offset.x)
    right = Math.max(right, anchor.x + offset.x)
    top = Math.min(top, anchor.y + offset.y)
    bottom = Math.max(bottom, anchor.y + offset.y)
  }
  return { left, right, top, bottom }
}

/**
 * The offset from a footprint's anchor to the tile a scenario calls its **centre** — the one tile a
 * placement symbol occupies, however many tiles the entity actually covers.
 *
 * `floor((extent - 1) / 2)` on each axis, so an odd extent has a true middle (a 3-wide unit centres
 * on its second column) and an even one leans north-west (a 2-wide unit centres on its first). Even
 * extents have no exact centre and something has to break the tie; leaning consistently one way
 * keeps the answer predictable, which matters more than which way it leans.
 */
export function footprintCentre(footprint: Footprint): Coord {
  const { width, height } = footprintExtent(footprint)
  return { x: Math.floor((width - 1) / 2), y: Math.floor((height - 1) / 2) }
}

/** Absolute tiles an entity anchored at `anchor` occupies. */
export function tilesOf(anchor: Coord, footprint: Footprint): Coord[] {
  const tiles: Coord[] = []
  for (const offset of footprint) {
    tiles.push({ x: anchor.x + offset.x, y: anchor.y + offset.y })
  }
  return tiles
}

/**
 * The distance between two footprints (`gridDistance`), from the nearest occupied tile of one to the nearest of
 * the other (grid.md). Range is measured this way, so a large structure is easier to reach because it is large.
 */
export function footprintDistance(
  anchorA: Coord,
  footprintA: Footprint,
  anchorB: Coord,
  footprintB: Footprint,
): number {
  return nearestPair(anchorA, footprintA, anchorB, footprintB, gridDistance)
}

/** Four-way steps between the nearest tiles of two footprints (`gridSteps`): 1 when they touch along a side. */
export function footprintSteps(anchorA: Coord, footprintA: Footprint, anchorB: Coord, footprintB: Footprint): number {
  return nearestPair(anchorA, footprintA, anchorB, footprintB, gridSteps)
}

/** The least of `measure` between a tile of one footprint and a tile of the other. */
function nearestPair(
  anchorA: Coord,
  footprintA: Footprint,
  anchorB: Coord,
  footprintB: Footprint,
  measure: (a: Coord, b: Coord) => number,
): number {
  let best = Number.POSITIVE_INFINITY
  for (const offsetA of footprintA) {
    const a = { x: anchorA.x + offsetA.x, y: anchorA.y + offsetA.y }
    for (const offsetB of footprintB) {
      const b = { x: anchorB.x + offsetB.x, y: anchorB.y + offsetB.y }
      const found = measure(a, b)
      if (found < best) best = found
    }
  }
  return best
}

/**
 * Whether footprint B is within a reach of `radius` of footprint A: its nearest tile no further than `radius`
 * (`footprintDistance`) — or, for any reach of 1 or more, touching A along a side (`footprintSteps`), as the tile
 * straight above does, two away. So a reach of 1 is touching, and from 2 on the tiles touching are within it
 * anyway. Every reach the game measures is asked this way: a shot and a heal, an aura, a blast, the reach a unit
 * turns to fight within, a worker's nerve, a contact trigger, the build range and the room a building keeps.
 * Melee asks only whether it touches (`inAttackRange`, `src/pulse/shared.ts`).
 */
export function footprintWithin(
  anchorA: Coord,
  footprintA: Footprint,
  anchorB: Coord,
  footprintB: Footprint,
  radius: number,
): boolean {
  if (footprintDistance(anchorA, footprintA, anchorB, footprintB) <= radius) return true
  return radius >= 1 && footprintSteps(anchorA, footprintA, anchorB, footprintB) <= 1
}

/** The tile of `tiles` nearest `from` (`gridDistance`), the first listed on a tie; `null` when there are none. */
export function nearestTile(from: Coord, tiles: readonly Coord[]): Coord | null {
  let best: Coord | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const tile of tiles) {
    const distance = gridDistance(from, tile)
    if (distance < bestDistance) {
      best = tile
      bestDistance = distance
    }
  }
  return best
}

/**
 * The tile of a footprint nearest `from` (`nearestTile`): the point a mover walks toward, not the anchor. It is
 * the tile range is measured to, so every step that brings a mover into range ranks as a step closer — aimed at
 * the anchor, a mover beside a large target's near face would rank a step along it, toward the target's other
 * rows, as a step away, and never take it.
 */
export function nearestFootprintTile(from: Coord, anchor: Coord, footprint: Footprint): Coord {
  return nearestTile(from, tilesOf(anchor, footprint)) ?? anchor
}

/**
 * Every tile at exactly `outset` tiles from a `width` x `height` box anchored at `(0,0)` — a
 * rectangle's perimeter, generalised the way a point's ring generalises to a footprint's. At
 * `outset = 1` and a 1x1 box this is the eight tiles immediately around one tile.
 *
 * A square ring on purpose, not a distance: the tiles round a box, corners included, in a fixed order — where a
 * spawner or a building sets its units down (`src/pulse/spawn.ts`, a wave standing together round the building),
 * and the cells a death's shockwave is drawn from (`view/effects/recipes.ts`). Two real uses, either side of the
 * state/Pulse boundary, of the same geometry.
 */
export function footprintRing(width: number, height: number, outset: number): Coord[] {
  const tiles: Coord[] = []
  for (let y = -outset; y <= height - 1 + outset; y += 1) {
    for (let x = -outset; x <= width - 1 + outset; x += 1) {
      const dx = x < 0 ? -x : x >= width ? x - width + 1 : 0
      const dy = y < 0 ? -y : y >= height ? y - height + 1 : 0
      if (Math.max(dx, dy) === outset) tiles.push({ x, y })
    }
  }
  return tiles
}

export function inBounds(grid: GridTerrain, tile: Coord): boolean {
  return tile.x >= 0 && tile.y >= 0 && tile.x < grid.width && tile.y < grid.height
}

export function tileIndex(grid: GridTerrain, tile: Coord): number {
  return tile.y * grid.width + tile.x
}
