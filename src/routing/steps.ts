// The choice of a step (milestone 16, "the parts"): from where a unit stands, its four steps ranked by a field, best
// first. The kernel decides which of them a unit may take this tick (who is in the way, what it can pay for); this only
// says how good each is.
//
// A step is as good as the walk it leaves: its own cost plus the field's distance from where it lands, so a step along
// a shortest route ranks first, wherever the route bends. Steps that leave as long a walk are equally good, and go by
// how far each turns from the way the unit faces its goal, so a unit walks the way a viewer expects; what is still tied
// after that is a tie the caller breaks with a seeded draw (no side wins by where it stands, `pulse.md`) — never by a
// compass order. Mirrored Grids rank mirrored steps alike.

import { DIRECTIONS, step, stepLength } from "../grid/coords.ts"
import type { Coord, Direction } from "../grid/types.ts"
import type { DistanceField } from "./field.ts"
import { UNREACHABLE } from "./field.ts"

export type RankedStep = Readonly<{
  direction: Direction
  to: Coord
  /** What the step itself costs: its length times the weight of the ground it lands on. */
  cost: number
  /** The field's distance from where it lands. */
  after: number
  /** Whether it brings the unit closer: the field's distance where it lands is less than where it stands. */
  downhill: boolean
  /** How far it turns from the way the unit faces its goal, in quarter turns: 0, 1 or 2. */
  turn: number
}>

/** Quarter turns from one of the four directions to another: 0 the same way, 2 straight back. */
export function quarterTurns(from: Direction, to: Direction): number {
  if (from === to) return 0
  const opposite = (from === "n" && to === "s") || (from === "s" && to === "n") || (from === "e" && to === "w") || (from === "w" && to === "e")
  return opposite ? 2 : 1
}

/**
 * The steps from `anchor` that land where the field reaches, ranked best first and grouped: each group is steps
 * exactly as good as each other (as long a walk left, as small a turn from `facing`), for the caller to draw among.
 * A step the field cannot reach from is left out; one onto ground the body may not stand on is unreachable by the
 * field's own rule.
 */
export function rankSteps(field: DistanceField, anchor: Coord, facing: Direction): RankedStep[][] {
  const here = field.distanceAt(anchor)
  const steps: RankedStep[] = []
  for (const direction of DIRECTIONS) {
    const to = step(anchor, direction)
    const after = field.distanceAt(to)
    if (after === UNREACHABLE) continue
    const cost = stepLength(direction) * field.weightAt(to)
    steps.push({ direction, to, cost, after, downhill: after < here, turn: quarterTurns(facing, direction) })
  }
  steps.sort((a, b) => a.cost + a.after - (b.cost + b.after) || a.turn - b.turn)
  const groups: RankedStep[][] = []
  for (const candidate of steps) {
    const last = groups[groups.length - 1]
    const head = last?.[0]
    if (last !== undefined && head !== undefined && head.cost + head.after === candidate.cost + candidate.after && head.turn === candidate.turn) last.push(candidate)
    else groups.push([candidate])
  }
  return groups
}
