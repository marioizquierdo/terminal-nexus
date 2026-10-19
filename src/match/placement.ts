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
import type { ContentDef } from "../content/types.ts"
import type { Coord, Footprint } from "../grid/types.ts"
import type { PlayerId } from "../state/types.ts"

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
 * came from), then nearest to `toward` (where its side faces: `enemyNexusMiddle`), then in reading order. So a tie
 * goes to the tile nearer the enemy whichever side of the map a side stands on, and never to the western one because
 * it is read first; the answer never depends on anything but the mask, the footprint and the points.
 */
export function nearestFit(
  mask: CollisionMask,
  footprint: Footprint,
  around: Coord,
  maxDistance: number,
  prefer: Coord = around,
  toward?: Coord,
): Coord | null {
  const centre = footprintCentre(footprint)
  const facing = (tile: Coord): number => (toward === undefined ? 0 : gridDistance(tile, toward))
  for (let distance = 0; distance <= maxDistance; distance += 1) {
    const candidates = ringOffsets(distance)
      .map((offset) => ({ x: around.x + offset.x, y: around.y + offset.y }))
      .map((tile) => ({ tile, anchor: { x: tile.x - centre.x, y: tile.y - centre.y } }))
    // Stable sort: equal on both keep the ring's own reading order.
    candidates.sort((a, b) => gridDistance(a.tile, prefer) - gridDistance(b.tile, prefer) || facing(a.tile) - facing(b.tile))
    for (const { anchor } of candidates) {
      if (mask.footprintFits(anchor, footprint)) return anchor
    }
  }
  return null
}

/** Something on the Grid, as far as where a side faces needs it: whose, where, and what. */
type Standing = Readonly<{ player: PlayerId; anchor: Coord; definition: ContentDef }>

/**
 * Where `player` faces, for breaking a tie between two equally near tiles (`nearestFit`): the middle of the enemy
 * Grid Nexus nearest `from` — `undefined` when no enemy Nexus stands, and the tie goes by reading order.
 */
export function enemyNexusMiddle(standing: Iterable<Standing>, player: PlayerId, from: Coord): Coord | undefined {
  let best: Coord | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const thing of standing) {
    if (thing.player === player || thing.definition.nexus !== true) continue
    const middle = centreTile(thing.anchor, thing.definition.footprint)
    const distance = gridDistance(from, middle)
    if (distance < bestDistance) {
      best = middle
      bestDistance = distance
    }
  }
  return best
}
