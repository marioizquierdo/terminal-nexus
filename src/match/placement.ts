// Finding a free place for a unit — shared by the opening (units mustered around a point) and Recall
// (units regrouped around a home building), which are the same question asked at the two ends of a
// Pulse: where is the nearest room for this footprint?
//
// Deterministic by construction: a fixed search order, no randomness, no clock. Nothing here decides an
// outcome — it decides *where* something that has already been decided goes.

import { footprintCentre, gridDistance } from "../grid/coords.ts"
import type { CollisionMask } from "../grid/occupancy.ts"
import type { Coord, Footprint } from "../grid/types.ts"

/**
 * Offsets at exactly Manhattan distance `radius` from `(0,0)`, in reading order (north to south, west
 * to east). Manhattan because that is the distance the kernel measures everything in (grid.md),
 * so "nearest" here means what it means to a unit walking there.
 */
function diamond(radius: number): Coord[] {
  if (radius === 0) return [{ x: 0, y: 0 }]
  const offsets: Coord[] = []
  for (let dy = -radius; dy <= radius; dy += 1) {
    const across = radius - Math.abs(dy)
    if (across === 0) offsets.push({ x: 0, y: dy })
    else offsets.push({ x: -across, y: dy }, { x: across, y: dy })
  }
  return offsets
}

/** The tile at the centre of a footprint whose anchor is `anchor` — where a thing is, for "nearest". */
export function centreTile(anchor: Coord, footprint: Footprint): Coord {
  const centre = footprintCentre(footprint)
  return { x: anchor.x + centre.x, y: anchor.y + centre.y }
}

/**
 * The anchor for `footprint` whose **centre tile** is nearest `around` and whose whole footprint fits
 * the mask — `null` when nothing within `maxRadius` does.
 *
 * Candidates are tried in expanding diamonds of centre tiles. Within one diamond they are tried nearest
 * to `prefer` first (a unit coming home takes the side of the building it came from), then in reading
 * order, so the answer never depends on anything but the mask, the footprint and the two points.
 */
export function nearestFit(
  mask: CollisionMask,
  footprint: Footprint,
  around: Coord,
  maxRadius: number,
  prefer: Coord = around,
): Coord | null {
  const centre = footprintCentre(footprint)
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    const candidates = diamond(radius)
      .map((offset) => ({ x: around.x + offset.x, y: around.y + offset.y }))
      .map((tile) => ({ tile, anchor: { x: tile.x - centre.x, y: tile.y - centre.y } }))
    // Stable sort: equal distances keep the diamond's own reading order.
    candidates.sort((a, b) => gridDistance(a.tile, prefer) - gridDistance(b.tile, prefer))
    for (const { anchor } of candidates) {
      if (mask.footprintFits(anchor, footprint)) return anchor
    }
  }
  return null
}
