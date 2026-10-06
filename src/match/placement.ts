// Finding a free place for a unit — shared by the opening (units mustered around a point), a mission's arrivals,
// Recall (units regrouped around a home building) and a Commander's return, which are the same question asked at
// different moments of a round: where is the nearest room for this footprint?
//
// Nearest by the Grid's own distance (`gridDistance`: a row counts two columns), searched outward one ring of it at
// a time (`ringOffsets`, src/grid/reach.ts). A group set down round a point fills a diamond twice as wide as it is
// tall in tiles, so it comes out round on screen, as every reach does.
//
// Deterministic by construction: a fixed search order, no randomness, no clock. Nothing here decides an
// outcome — it decides *where* something that has already been decided goes. The opening, the forecast of it and
// Recall all search these same rings, so they agree.

import { footprintCentre, gridDistance } from "../grid/coords.ts"
import { ringOffsets } from "../grid/reach.ts"
import type { CollisionMask } from "../grid/occupancy.ts"
import type { Coord, Footprint } from "../grid/types.ts"

/** The tile at the centre of a footprint whose anchor is `anchor` — where a thing is, for "nearest". */
export function centreTile(anchor: Coord, footprint: Footprint): Coord {
  const centre = footprintCentre(footprint)
  return { x: anchor.x + centre.x, y: anchor.y + centre.y }
}

/**
 * The anchor for `footprint` whose **centre tile** is nearest `around` and whose whole footprint fits
 * the mask — `null` when nothing within `maxDistance` of it does.
 *
 * Candidates are tried one ring of the Grid's own distance at a time, outward from `around` (`ringOffsets`).
 * Within one ring they are tried nearest to `prefer` first (a unit coming home takes the side of the building it
 * came from), then in reading order, so the answer never depends on anything but the mask, the footprint and the
 * two points.
 */
export function nearestFit(
  mask: CollisionMask,
  footprint: Footprint,
  around: Coord,
  maxDistance: number,
  prefer: Coord = around,
): Coord | null {
  const centre = footprintCentre(footprint)
  for (let distance = 0; distance <= maxDistance; distance += 1) {
    const candidates = ringOffsets(distance)
      .map((offset) => ({ x: around.x + offset.x, y: around.y + offset.y }))
      .map((tile) => ({ tile, anchor: { x: tile.x - centre.x, y: tile.y - centre.y } }))
    // Stable sort: equal distances keep the ring's own reading order.
    candidates.sort((a, b) => gridDistance(a.tile, prefer) - gridDistance(b.tile, prefer))
    for (const { anchor } of candidates) {
      if (mask.footprintFits(anchor, footprint)) return anchor
    }
  }
  return null
}
