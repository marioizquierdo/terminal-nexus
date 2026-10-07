// The outline of a reach: the last tiles it covers, as the rules count them (`tilesWithin`, src/grid/reach.ts).
// Every outline of a reach draws this one shape — a building's or a unit's reach in the Build
// Phase (`build-areas.ts`), a blast as it spreads (`effects/recipes.ts`) — so what the screen shows is the rule's
// own area, never a square of tiles or a shape of the picture's own.
//
// A reach of 6 from one tile (`@`). A row counts two columns, so each row out is two columns shorter, and the
// outline runs two tiles thick along its slants, with no gap between one row and the next:
//
//         .
//       .. ..
//     ..     ..
//   ..    @    ..
//     ..     ..
//       .. ..
//         .
//
// Pure, and in tiles: a picture lays it on cells.

import { tilesOf } from "../grid/coords.ts"
import { tilesWithin } from "../grid/reach.ts"
import type { Coord, Footprint } from "../grid/types.ts"

/** A tile as a key for a set of tiles. */
const keyOf = (tile: Coord): string => `${tile.x},${tile.y}`

/**
 * The outline of a reach of `radius` round the footprint anchored at `anchor`: every tile within it, by the rules'
 * own test (`tilesWithin`, `footprintWithin`), that has a four-way neighbour outside it — never a tile of the
 * footprint itself. In reading order, in the map's own coordinates. The outline of a reach of 1 is every tile
 * touching the footprint along a side; a reach of 0 has none.
 */
export function outlineWithin(anchor: Coord, footprint: Footprint, radius: number): Coord[] {
  const own = new Set(tilesOf(anchor, footprint).map(keyOf))
  const reached = tilesWithin(anchor, footprint, radius)
  const inside = new Set(reached.map(keyOf))
  const isInside = (x: number, y: number): boolean => inside.has(`${x},${y}`)
  return reached.filter((tile) => {
    if (own.has(keyOf(tile))) return false
    const { x, y } = tile
    return !(isInside(x - 1, y) && isInside(x + 1, y) && isInside(x, y - 1) && isInside(x, y + 1))
  })
}
