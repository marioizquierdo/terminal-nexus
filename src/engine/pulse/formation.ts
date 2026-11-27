// The army group formation's ranks (movement.md, troop formation; the glossary's "army group formation"): an army
// group's members in ranks across a line to the enemy it faces, the priority list front to back. One layout, two
// readers: an army group that has arrived at its rally point in a Battle Round forms up on it (`army-groups.ts`), and the
// regroup between rounds forms each side's main army group the same way (`src/match/regroup.ts`).
//
// A line runs along the axis it covers more ground on, a row counting two columns, and faces one way along it: its
// ranks stand across it, the front rank furthest forward, each rank behind the last by `RANK_STEP`. Whole numbers, no
// draw: the same members, line and front give the same tiles on every machine, and a mirrored battlefield gives the
// mirrored tiles.

import { formationRank } from "../../content/types.ts"
import type { ContentDef } from "../../content/types.ts"
import { footprintBox } from "../geometry/coords.ts"
import type { Coord, Footprint } from "../geometry/types.ts"

/** The widest a rank is, in units. */
export const RANK_WIDTH = 9
/** How far apart two ranks stand along the line: one clear column (or row) between them. */
export const RANK_STEP = 2

/** A formation's line: its main axis, which way along it the ranks face, and the line's two ends in half tiles (a
 *  tile's middle is twice its coordinates). */
export type Line = Readonly<{ axis: "x" | "y"; way: 1 | -1; from: Coord; to: Coord }>

/** The middle of a body, in half tiles: twice its coordinates for a tile, between two tiles for an even width. */
export function middleOf(anchor: Coord, footprint: Footprint): Coord {
  const box = footprintBox(anchor, footprint)
  return { x: box.left + box.right, y: box.top + box.bottom }
}

/** How far forward along `line` a tile stands: larger is nearer the enemy. */
export const forwardOf = (line: Line, tile: Coord): number => (line.axis === "x" ? tile.x : tile.y) * line.way
/** Where across `line` a tile stands. */
export const acrossOf = (line: Line, tile: Coord): number => (line.axis === "x" ? tile.y : tile.x)
/** The tile `forward` along and `across` the line. */
export const tileOn = (line: Line, forward: number, across: number): Coord =>
  line.axis === "x" ? { x: forward * line.way, y: across } : { x: across, y: forward * line.way }

/** Where the line itself crosses the rank `forward` along it, across it, to the nearest tile. Read alike from either
 *  end of a mirrored map: the same fraction of the same rise. */
export function lineAcross(line: Line, forward: number): number {
  const along = line.axis === "x" ? { from: line.from.x, to: line.to.x, at: 2 * forward * line.way } : { from: line.from.y, to: line.to.y, at: 2 * forward * line.way }
  const rise = line.axis === "x" ? { from: line.from.y, to: line.to.y } : { from: line.from.x, to: line.to.x }
  const span = along.to - along.from
  const half = span === 0 ? rise.from : rise.from + ((along.at - along.from) * (rise.to - rise.from)) / span
  return Math.floor(half / 2 + 0.5)
}

/** The line from `from` to `to` (half tiles), along the axis it runs further on, a row counting two columns; `null`
 *  when the two are one point. */
export function lineBetween(from: Coord, to: Coord): Line | null {
  if (to.x === from.x && to.y === from.y) return null
  const dx = to.x - from.x
  const dy = to.y - from.y
  // A row is two columns: the line runs along x while it covers as much ground across as down.
  if (Math.abs(dx) >= 2 * Math.abs(dy)) return { axis: "x", way: dx >= 0 ? 1 : -1, from, to }
  return { axis: "y", way: dy >= 0 ? 1 : -1, from, to }
}

/** The line from `from` (half tiles) facing a quarter: `lineBetween`'s axis and way toward `to`, straight along that
 *  axis, so its ranks are centred on `from` whatever the slope. `null` when the two are one point. What an army group
 *  forms up on mid-round: its ranks hold still while the enemy it faces moves, until that enemy is in another quarter. */
export function quarterLine(from: Coord, to: Coord): Line | null {
  const line = lineBetween(from, to)
  if (line === null) return null
  return { ...line, to: line.axis === "x" ? { x: from.x + 2 * line.way, y: from.y } : { x: from.x, y: from.y + 2 * line.way } }
}

/** The rank `forward` a point given in half tiles stands at, of two middle tiles the one further back. */
export function forwardOfHalf(line: Line, half: Coord): number {
  return Math.floor(((line.axis === "x" ? half.x : half.y) * line.way) / 2)
}

/** A unit's place in the formation's order, front first: the priority list (`formationRank`, movement.md, troop
 *  formation) — flankers, melee, ranged; shorter range first; tank, fighter, support, siege — and units with no place
 *  (no attack, a flyer) behind. The Commander has no rank of her own: she stands where her attack puts her. */
export function rankOrder(definition: ContentDef): number {
  return formationRank(definition) ?? Number.MAX_SAFE_INTEGER
}

/** How many units a rank of a group of `count` holds: about twice as many ranks across as deep, at most `RANK_WIDTH`. */
export const rankWidth = (count: number): number => Math.max(1, Math.min(RANK_WIDTH, Math.ceil(Math.sqrt(2 * count))))

/** A member as the layout reads it: its ordinal, its content and the tile it stands on now. */
export type Ranked<T> = Readonly<{ member: T; ordinal: number; definition: ContentDef; here: Coord }>

/** A member's place: the tile it should stand on, and the order places are claimed in — rank by rank, the middle of
 *  each rank first. */
export type Place<T> = Readonly<{ member: T; tile: Coord; order: number }>

/**
 * **The ranks**: each member's tile, front rank at `front` along `line`, centred across on `across`. Members go by the
 * priority list (`rankOrder`), then those further forward first, then across; a rank holds `rankWidth` of them; the
 * Commander takes the middle of her rank, the rest their places across in the order they stand across, so the ranks form
 * without crossing. Returned in the order they are claimed.
 */
export function formationPlaces<T>(members: readonly Ranked<T>[], line: Line, front: number, across: number): Place<T>[] {
  const sorted = [...members].sort(
    (a, b) =>
      rankOrder(a.definition) - rankOrder(b.definition) ||
      forwardOf(line, b.here) - forwardOf(line, a.here) ||
      acrossOf(line, a.here) - acrossOf(line, b.here) ||
      a.ordinal - b.ordinal,
  )
  const width = rankWidth(sorted.length)
  const spacing = line.axis === "x" ? 1 : 2
  const places: Place<T>[] = []
  for (let rank = 0; rank * width < sorted.length; rank += 1) {
    const inRank = sorted.slice(rank * width, (rank + 1) * width)
    const offsets = inRank.map((_, index) => index - Math.floor(inRank.length / 2))
    const commander = inRank.find((each) => each.definition.commander === true)
    const rest = inRank.filter((each) => each !== commander).sort((a, b) => acrossOf(line, a.here) - acrossOf(line, b.here) || a.ordinal - b.ordinal)
    const open = commander === undefined ? offsets : offsets.filter((offset) => offset !== 0)
    const forward = front - rank * RANK_STEP
    const assigned = [...(commander === undefined ? [] : [{ each: commander, offset: 0 }]), ...rest.map((each, index) => ({ each, offset: open[index] as number }))]
    for (const { each, offset } of assigned) {
      places.push({ member: each.member, tile: tileOn(line, forward, across + offset * spacing), order: rank * 1000 + Math.abs(offset) * 2 + (offset < 0 ? 0 : 1) })
    }
  }
  return places.sort((a, b) => a.order - b.order)
}
