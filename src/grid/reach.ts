// The shape of a distance on the Grid (grid.md): which tiles it covers, row by row. A row counts `ROW_DISTANCE`
// columns (`coords.ts`), so a reach covers its whole length in columns on its own row, two columns less on each row
// further up or down, and as many rows as it pays for whole: a diamond twice as wide as it is tall in tiles, as wide
// as it is tall on screen. A reach of 6 from one tile (`@`):
//
//         .              3 rows up:   0 columns either side
//       .....            2 rows up:   2
//     .........          1 row up:    4
//   ......@......        its own row: 6
//     .........
//       .....
//         .
//
// Every set of tiles a distance picks out is worked out here, from `rowsWithin` and `columnsWithin`: the rings a
// group is set down on, nearest first (`ringOffsets`), and the ground within a reach of a footprint
// (`tilesWithin`) — the build range, the room a building keeps, a reach drawn round a building or a unit, an aura.

import type { Coord, Footprint } from "./types.ts"
import { ROW_DISTANCE, footprintBox, footprintWithin } from "./coords.ts"

/** How many rows up or down lie within `distance` of a tile: the whole rows it pays for, `ROW_DISTANCE` each. A
 *  reach of 6 covers 3 rows up and 3 down; a reach of 1 none, though it touches the tile straight above. */
export function rowsWithin(distance: number): number {
  return Math.floor(distance / ROW_DISTANCE)
}

/** How many columns either side lie within `distance` of a tile on the row `rows` up or down from it: what is left
 *  of the distance once those rows are paid for. Negative where the row is beyond it. */
export function columnsWithin(distance: number, rows: number): number {
  return distance - ROW_DISTANCE * Math.abs(rows)
}

/**
 * The offsets exactly `distance` from a tile (`gridDistance`), in reading order, north to south and west to east: a
 * ring of the Grid's own distance, wider than tall in tiles and round on screen. Distance 0 is the tile itself, 1
 * the tiles either side, 2 the tiles two columns either side and the ones straight above and below. Searched
 * outward ring by ring, so whatever is set down round a point comes out round on screen (`nearestFit`,
 * `src/match/placement.ts`).
 */
export function ringOffsets(distance: number): Coord[] {
  const rows = rowsWithin(distance)
  const offsets: Coord[] = []
  // Counted up from the top row, so no offset is a negative zero (a `-0` in a coordinate slows every frame that
  // reads it: docs/history/lessons-learned.md, "A negative zero in a coordinate").
  for (let row = 0; row <= 2 * rows; row += 1) {
    const dy = row - rows
    const across = columnsWithin(distance, dy)
    if (across === 0) offsets.push({ x: 0, y: dy })
    else offsets.push({ x: -across, y: dy }, { x: across, y: dy })
  }
  return offsets
}

/** The footprint of a single tile, for asking how far a tile is from a footprint. */
const ONE_TILE: Footprint = [{ x: 0, y: 0 }]

/**
 * Every tile within a reach of `radius` of a footprint anchored at `anchor` (`footprintWithin`), the footprint's own
 * tiles included, in reading order and in the map's own coordinates. It looks over the footprint's box widened by
 * `radius` columns either side and by the rows the reach covers, and one more: a reach of 1 also covers the tiles
 * touching above and below.
 */
export function tilesWithin(anchor: Coord, footprint: Footprint, radius: number): Coord[] {
  const box = footprintBox(anchor, footprint)
  const rows = rowsWithin(radius) + 1
  const tiles: Coord[] = []
  for (let y = box.top - rows; y <= box.bottom + rows; y += 1) {
    for (let x = box.left - radius; x <= box.right + radius; x += 1) {
      const tile = { x, y }
      if (footprintWithin(anchor, footprint, tile, ONE_TILE, radius)) tiles.push(tile)
    }
  }
  return tiles
}
