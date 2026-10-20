// Goals: the anchors a body must reach to do what it came for (milestone 16, "the parts"). One idea for every unit —
// "a place I can act from" — so walking and attacking agree by construction: a melee unit's goal is every anchor from
// which it touches its target, a shot's every anchor from which its target is within range, measured as range is, and
// a side's target every anchor from which some tile of the body stands inside it. The same tests the kernel attacks
// and stands by (`footprintSteps`, `footprintWithin`, `src/grid/coords.ts`), so a route ends exactly where an attack
// begins.
//
// A goal is a list of anchors in reading order, north to south, west to east: only those the body may stand on
// (`canStand`), so a goal under a wall is no goal. An empty list is a goal that cannot be reached from anywhere.

import { footprintBox, footprintSteps, footprintWithin } from "../grid/coords.ts"
import type { Coord, Footprint } from "../grid/types.ts"
import type { Ground } from "./ground.ts"
import { canStand } from "./ground.ts"

/** What a body must do to its goal: touch it within `steps` steps along the Grid's sides (melee), or stand within a
 *  reach of `radius` of it, measured as range is (a shot, a heal). */
export type Reach = Readonly<{ kind: "touch"; steps: number }> | Readonly<{ kind: "within"; radius: number }>

/** The anchors to search round a target for a body: the target's box, widened by the reach and the body's own size. */
function searchBox(target: Coord, targetBody: Footprint, body: Footprint, margin: number): Readonly<{ left: number; right: number; top: number; bottom: number }> {
  const box = footprintBox(target, targetBody)
  const own = footprintBox({ x: 0, y: 0 }, body)
  return {
    left: box.left - margin - own.right,
    right: box.right + margin - own.left,
    top: box.top - margin - own.bottom,
    bottom: box.bottom + margin - own.top,
  }
}

/**
 * Every anchor from which `body` reaches a target standing at `target` with `targetBody`, by `reach`, that the body
 * may stand on. The body never overlaps the target: a tile it shares with it is not a place to stand.
 */
export function goalsNear(ground: Ground, body: Footprint, target: Coord, targetBody: Footprint, reach: Reach): Coord[] {
  const margin = reach.kind === "touch" ? reach.steps : reach.radius
  const box = searchBox(target, targetBody, body, margin + 1)
  const goals: Coord[] = []
  for (let y = box.top; y <= box.bottom; y += 1) {
    for (let x = box.left; x <= box.right; x += 1) {
      const anchor = { x, y }
      if (!canStand(ground, anchor)) continue
      const steps = footprintSteps(anchor, body, target, targetBody)
      if (steps === 0) continue
      const reaches = reach.kind === "touch" ? steps <= reach.steps : footprintWithin(anchor, body, target, targetBody, reach.radius)
      if (reaches) goals.push(anchor)
    }
  }
  return goals
}

/** An area of the Grid: its north-west tile, and how wide and tall it is. */
export type Area = Readonly<{ x: number; y: number; width: number; height: number }>

/** Every anchor from which some tile of `body` stands inside `area`, that the body may stand on. */
export function goalsInside(ground: Ground, body: Footprint, area: Area): Coord[] {
  const own = footprintBox({ x: 0, y: 0 }, body)
  const goals: Coord[] = []
  for (let y = area.y - own.bottom; y <= area.y + area.height - 1 - own.top; y += 1) {
    for (let x = area.x - own.right; x <= area.x + area.width - 1 - own.left; x += 1) {
      const anchor = { x, y }
      if (!canStand(ground, anchor)) continue
      const inside = body.some((offset) => {
        const tx = x + offset.x
        const ty = y + offset.y
        return tx >= area.x && tx < area.x + area.width && ty >= area.y && ty < area.y + area.height
      })
      if (inside) goals.push(anchor)
    }
  }
  return goals
}
