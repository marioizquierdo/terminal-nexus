import type { Coord, Direction, Footprint, GridTerrain } from "./types.ts"

/**
 * The four directions a mover may step in, in a fixed order — engine.md 3.6, revised after
 * Milestone 1 playtesting. Diagonal movement was the single biggest legibility problem the owner's
 * first watch found: a unit that can cut corners is a unit whose next tile a viewer cannot predict.
 * Restricting movement to the compass points makes every step readable as "up", "down", "left", or
 * "right" — nothing else changes about the kernel's shape.
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
 * The compass direction from `from` toward `to`, collapsed to the four points movement actually
 * uses. A target that sits on a true diagonal has no single cardinal answer, so the axis with the
 * larger delta wins; an exact tie prefers east/west, which is an arbitrary but deterministic and
 * documented choice. Falls back to `s` for a zero-length vector.
 */
export function directionOf(from: Coord, to: Coord, fallback: Direction = "s"): Direction {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return fallback
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "e" : "w"
  return dy > 0 ? "s" : "n"
}

/**
 * The grid distance movement and targeting both use — engine.md 3.6, revised after Milestone 1
 * playtesting. Manhattan distance (`|dx| + |dy|`) is the natural partner of four-way movement: it
 * is exactly the number of cardinal steps between two tiles, so "in range" and "reachable in that
 * many steps" mean the same thing again. Presentation is exempt — a tracer or a trail may still draw
 * a diagonal line, because that is a cosmetic choice about a path, not a claim about one.
 */
export function gridDistance(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
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
 * Range measures to the **nearest occupied tile** of the target's footprint,
 * from the nearest occupied tile of the source's — engine.md 3.5.
 */
export function footprintDistance(
  anchorA: Coord,
  footprintA: Footprint,
  anchorB: Coord,
  footprintB: Footprint,
): number {
  let best = Number.POSITIVE_INFINITY
  for (const offsetA of footprintA) {
    const a = { x: anchorA.x + offsetA.x, y: anchorA.y + offsetA.y }
    for (const offsetB of footprintB) {
      const b = { x: anchorB.x + offsetB.x, y: anchorB.y + offsetB.y }
      const distance = gridDistance(a, b)
      if (distance < best) best = distance
    }
  }
  return best
}

/**
 * The tile of a footprint nearest `from` — the point a mover should actually walk toward, not the
 * anchor. A pre-existing gap between "how range is measured" (nearest tile, engine.md 3.5) and "how
 * a step is ranked" (the raw anchor) surfaced once movement stopped having diagonals to paper over
 * it: a mover parked beside a multi-tile target's near face could rank every sidestep toward the
 * target's *other* rows as "further from the anchor" and refuse to take it, even though that
 * sidestep is a tile closer to the target by the very metric that decides whether it is in range.
 * Routing now aims at the same tile targeting already measures to.
 */
export function nearestFootprintTile(from: Coord, anchor: Coord, footprint: Footprint): Coord {
  let best: Coord = anchor
  let bestDistance = Number.POSITIVE_INFINITY
  for (const offset of footprint) {
    const tile = { x: anchor.x + offset.x, y: anchor.y + offset.y }
    const distance = gridDistance(from, tile)
    if (distance < bestDistance) {
      bestDistance = distance
      best = tile
    }
  }
  return best
}

/**
 * Every tile at exactly `outset` tiles from a `width` x `height` box anchored at `(0,0)` — a
 * rectangle's perimeter, generalised the way a point's ring generalises to a footprint's. At
 * `outset = 1` and a 1x1 box this is the eight tiles immediately around one tile.
 *
 * Shared rather than re-derived: `view/effects/recipes.ts`'s death choreography needs a body's own
 * perimeter to draw a shockwave from, and `pulse/spawn.ts` needs the same shape to search for a free
 * tile next to a spawner — two real uses, in two different worlds either side of the state/Pulse
 * boundary, of the same geometry (unit-design-architecture spike; engine.md 0's own rule: extract a
 * shared contract once a second real use reveals the seam, not before).
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
