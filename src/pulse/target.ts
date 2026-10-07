// A side's target (pulse.md, perception and intents): the region a campaign level names for a side's troops,
// so where they move can be read before the battle (the owner: "the campaign levels should have a target well
// defined"). Before targets every unit did one thing — engage the nearest enemy, wherever it was — and a side
// with no target still does.
//
// A side's **fighting units** (on the move, `advance` behaviour: not a worker that flees, not a healer, not
// a structure) follow its target:
//
// - **they engage what comes within reach on the way**: the nearest enemy within `engageRange` of them, by
//   the ordinary scoring (`perception.ts`);
// - **with nothing within reach they head for the target**: for its nearest tile they could stand on, by the
//   ordinary step rule, so the ones who come later fill it rather than queue at its edge (`intents.ts`);
// - **and they stand there**: inside it — or, once nothing brings them closer, beside the ones already
//   standing there (`gatheredAt`), so a target with no room left gathers its troops round it rather than
//   leaving them pressing on each other.
//
// Read from the state the tick began with, like every phase before the moves settle; the kernel never
// changes a target (`MatchState.targets`). The nearest tile is nearest by the Grid's own distance (`gridDistance`:
// a row counts two columns), and "beside" is touching along a side (`stepsBetween`); integers, reading and
// ordinal order: nothing here can make two runs differ.

import type { ContentDef } from "../content/types.ts"
import { footprintSteps, gridDistance, tilesOf } from "../grid/coords.ts"
import { wholeRows } from "../grid/reach.ts"
import type { CollisionMask } from "../grid/occupancy.ts"
import type { Coord } from "../grid/types.ts"
import type { PlayerId, TargetArea } from "../state/types.ts"
import type { Actor, TickContext } from "./shared.ts"
import { stepsBetween } from "./shared.ts"

/**
 * How near an enemy must come before a unit heading for its side's target turns to fight it,
 * measured as range is (`within`): 6 columns either side, 3 rows up and down. One value for every unit, and never
 * less than a unit's own attack range, so nothing walks past an enemy it could have shot. Six, a marksman's range:
 * a squad turns on what comes at it from the next few tiles, not on what stands half the map away.
 */
export const ENGAGE_RANGE = 6

/** How near an enemy must come before `definition` turns from its side's target to fight it: `ENGAGE_RANGE`, or its
 *  own attack's range when that is longer, in whole rows (`wholeRows`) whatever the content says. */
export function engageRange(definition: ContentDef): number {
  return wholeRows(Math.max(ENGAGE_RANGE, definition.attack?.range ?? 0))
}

/** Whether a unit of this content follows its side's target: one that moves and fights (`advance`), not a
 *  worker that flees, a healer or a building. */
export function followsTarget(definition: ContentDef): boolean {
  return definition.behavior === "advance" && definition.layer !== "obstacles"
}

/** The target `actor` heads for, or `null` when its side has none or it is not a unit that follows one. */
export function targetFor(context: TickContext, actor: Actor): TargetArea | null {
  if (!followsTarget(actor.definition)) return null
  return context.targets[actor.player] ?? null
}

/** Whether an actor stands inside an area: any tile of its footprint on it. */
export function insideArea(actor: Actor, area: TargetArea): boolean {
  return tilesOf(actor.anchor, actor.definition.footprint).some(
    (tile) => tile.x >= area.x && tile.x < area.x + area.width && tile.y >= area.y && tile.y < area.y + area.height,
  )
}

/** Every tile of an area, in reading order. */
export function areaTiles(area: TargetArea): Coord[] {
  const tiles: Coord[] = []
  for (let y = area.y; y < area.y + area.height; y += 1) {
    for (let x = area.x; x < area.x + area.width; x += 1) tiles.push({ x, y })
  }
  return tiles
}

/**
 * The tile of the area a mover walks toward: the nearest one its own mask leaves clear — no building, no
 * unit it would bump, no rock — the first in reading order on a tie; and when none is clear, the nearest of
 * all, nearest by the Grid's own distance (`gridDistance`). A mover aims at it as it aims at the nearest tile of
 * an enemy's footprint (`movementGoal`).
 */
export function areaGoal(from: Coord, area: TargetArea, mask: CollisionMask): Coord {
  let clear: Coord | null = null
  let clearDistance = Number.POSITIVE_INFINITY
  let nearest: Coord = { x: area.x, y: area.y }
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const tile of areaTiles(area)) {
    const distance = gridDistance(from, tile)
    if (distance < nearestDistance) {
      nearest = tile
      nearestDistance = distance
    }
    if (distance < clearDistance && mask.blockerAt(tile) === null) {
      clear = tile
      clearDistance = distance
    }
  }
  return clear ?? nearest
}

/**
 * The fighting units of `player` gathered at its target this tick, by ordinal: every one inside it or beside
 * a building of its own side that stands in it, and — outward from them — every one beside one already
 * gathered. Beside is touching along a side, footprint to footprint (`stepsBetween`), a row above as much as a
 * column across. Worked out as a whole from where everyone stood as the tick began, so the answer is the
 * same whichever unit asks first. A unit in it that nothing brings closer stands, rather than pressing on its
 * own.
 */
export function gatheredAt(context: TickContext, player: PlayerId, area: TargetArea): ReadonlySet<number> {
  const followers = context.actors.filter((actor) => actor.player === player && !actor.pendingDead && targetFor(context, actor) !== null)
  const buildings = context.actors.filter((actor) => actor.player === player && !actor.pendingDead && actor.definition.layer === "obstacles" && insideArea(actor, area))
  const gathered = new Set<number>()
  const queue: Actor[] = []
  for (const follower of followers) {
    const beside = (building: Actor): boolean =>
      footprintSteps(building.anchor, building.definition.footprint, follower.anchor, follower.definition.footprint) === 1
    if (insideArea(follower, area) || buildings.some(beside)) {
      gathered.add(follower.ordinal)
      queue.push(follower)
    }
  }
  for (let next = 0; next < queue.length; next += 1) {
    const standing = queue[next] as Actor
    for (const follower of followers) {
      if (gathered.has(follower.ordinal) || stepsBetween(standing, follower) !== 1) continue
      gathered.add(follower.ordinal)
      queue.push(follower)
    }
  }
  return gathered
}
