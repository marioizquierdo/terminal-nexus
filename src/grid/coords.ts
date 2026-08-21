import type { Coord, Direction, Footprint, GridTerrain } from "./types.ts"

/** The eight directions in a fixed order. Used for deterministic step ranking. */
export const DIRECTIONS: readonly Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"]

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

/** The direction a step from `from` to `to` faces. Falls back to `s` for a zero-length step. */
export function directionOf(from: Coord, to: Coord, fallback: Direction = "s"): Direction {
  const dx = Math.sign(to.x - from.x)
  const dy = Math.sign(to.y - from.y)
  if (dx === 0 && dy === 0) return fallback
  for (const direction of DIRECTIONS) {
    const vector = DIRECTION_VECTORS[direction]
    if (vector.x === dx && vector.y === dy) return direction
  }
  return fallback
}

/** Chebyshev distance — engine.md 3.6. Eight-way movement, uniform cost per step. */
export function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
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
      const distance = chebyshev(a, b)
      if (distance < best) best = distance
    }
  }
  return best
}

export function inBounds(grid: GridTerrain, tile: Coord): boolean {
  return tile.x >= 0 && tile.y >= 0 && tile.x < grid.width && tile.y < grid.height
}

export function tileIndex(grid: GridTerrain, tile: Coord): number {
  return tile.y * grid.width + tile.x
}
