// Movement credit and step choice (pulse.md).
//
// A unit walks to a **beat**: the whole number of ticks a step across a column takes, `ceil(12 x denominator /
// numerator)` at 12 ticks a second. A step costs a beat's worth of credit for each column of distance it covers
// (`stepLength`, src/grid/coords.ts), one across and `ROW_DISTANCE` up or down, and each tick adds `numerator`, so a
// step across takes exactly one beat and a step up or down exactly two, whatever the rate. So a unit walks every
// distance at one pace — a walk down the screen and one across it cover the same ground in the same time, and a
// unit that can reach a tile within a range by walking reaches it in the time the range says.

import type { ContentDef, MovementRate } from "../content/types.ts"
import { DIRECTIONS, directionOf, gridDistance, step, stepLength } from "../grid/coords.ts"
import type { CollisionMask } from "../grid/occupancy.ts"
import type { Coord, Direction } from "../grid/types.ts"

/** The longest step there is, up or down a row: what credit is capped at. */
const LONGEST_STEP = Math.max(...DIRECTIONS.map(stepLength))

/** The shortest step there is, across a column: what an actor needs credit for before it steps at all. */
const SHORTEST_STEP = Math.min(...DIRECTIONS.map(stepLength))

/**
 * What walking `length` columns of distance costs in movement credit: a beat's worth of credit a column, `numerator
 * x beat`. The beat is the whole number of ticks a step across takes at 12 ticks a second, `ceil(12 x denominator /
 * numerator)`: 4 for a trooper's 10/3, 5 for a raider's 8/3, 3 for a runner's 4/1. Each tick adds `numerator`, so a
 * step takes exactly as many beats as the columns it covers. Whole numbers only: the beat is a whole number of ticks,
 * so every cost is a whole number of credit.
 */
function creditFor(rate: MovementRate, length: number): number {
  const beat = Math.ceil((12 * rate.denominator) / rate.numerator)
  return rate.numerator * beat * length
}

/**
 * What a step costs in movement credit, in proportion to how far it goes (`stepLength`): a step across costs a beat's
 * worth of credit, and a step up or down `ROW_DISTANCE` times that, so it takes exactly two beats. With no direction,
 * the dearest step's cost: what credit is capped at (`accrueCredit`).
 */
export function stepCost(rate: MovementRate, direction?: Direction): number {
  return creditFor(rate, direction === undefined ? LONGEST_STEP : stepLength(direction))
}

/**
 * Credit is capped at one step's cost, the dearest step's: an actor that could not move cannot bank a sprint
 * (pulse.md), and an actor waiting for a step up or down saves up for it. Once it can pay for the step it wants,
 * its credit is capped again at that step's own cost (`intents.ts`), so waiting never buys two quick steps across. A
 * blocked step keeps its credit, which is simply what *not* subtracting means.
 */
export function accrueCredit(credit: number, rate: MovementRate): number {
  return Math.min(credit + rate.numerator, stepCost(rate))
}

/** Whether an actor has the credit for a step at all: the cheapest, a step across. */
export function canStep(credit: number, rate: MovementRate): boolean {
  return credit >= creditFor(rate, SHORTEST_STEP)
}

/** Turn cost in 90-degree increments, 0..2. Used only to rank equally good steps. */
function turnCost(from: Direction, to: Direction): number {
  if (from === to) return 0
  const reversed = (from === "n" && to === "s") || (from === "s" && to === "n")
  const flipped = (from === "e" && to === "w") || (from === "w" && to === "e")
  return reversed || flipped ? 2 : 1
}

export type StepChoice = Readonly<{
  direction: Direction
  to: Coord
  distanceAfter: number
}>

export type StepOptions = Readonly<{
  /** Ranked best-first once, so a caller can walk the list when arbitration rejects a claim. */
  goal: Coord
  /** `toward` closes with the goal; `away` opens distance from it — worker flight. */
  intent: "toward" | "away"
}>

/**
 * Greedy step with a deterministic sidestep, over the mover's own collision mask
 * (the first routing). Candidates are ranked by the distance they gain for the time they take, then by
 * how far they turn from the direction the actor wanted, then by a fixed compass order — so two
 * equally good steps always resolve the same way on every machine.
 *
 * Gain for time, not gain alone: a step up or down gains `ROW_DISTANCE` and takes as much longer (`stepLength`).
 * Ranked by gain alone every unit would walk down first and across after; ranked by gain for its time every
 * improving step is as good as another, and the turn from the way straight at the goal decides (`directionOf`), so
 * a unit walks the screen's own diagonal, a staircase of two steps across for each step down. Compared by
 * cross-multiplying, whole numbers only.
 *
 * Every four-way step changes the distance to the goal: never a step that merely holds it level. That means an
 * actor whose approach is off-axis (both a row and a column separate it from the goal) has two improving
 * directions to fall back on, and can slide along an obstacle's face one of them at a time until it clears. An
 * actor whose approach is exactly on-axis (same row or column as the goal) has exactly one improving direction, and
 * if that is blocked there is no fallback at all: it holds and the tick reports it blocked, for as long as the
 * obstacle stands. This is a known, accepted gap in the first routing, and real pathfinding, not this greedy
 * stepping, is what would close it. What a mover with no route should do (circle or stop) is still an open
 * question (Q15).
 */
export function rankedSteps(
  anchor: Coord,
  definition: ContentDef,
  mask: CollisionMask,
  options: StepOptions,
): StepChoice[] {
  const { goal, intent } = options
  const current = gridDistance(anchor, goal)
  const desired = intent === "toward" ? directionOf(anchor, goal) : directionOf(goal, anchor)

  const candidates: Array<StepChoice & { turn: number; index: number }> = []
  DIRECTIONS.forEach((direction, index) => {
    const to = step(anchor, direction)
    if (!mask.footprintFits(to, definition.footprint)) return
    const distanceAfter = gridDistance(to, goal)
    const improves = intent === "toward" ? distanceAfter <= current : distanceAfter >= current
    if (!improves) return
    candidates.push({
      direction,
      to,
      distanceAfter,
      turn: turnCost(desired, direction),
      index,
    })
  })

  // What a step gains, and how long it takes: in proportion to how far it goes (`stepLength`).
  const gainOf = (choice: StepChoice): number => (intent === "toward" ? current - choice.distanceAfter : choice.distanceAfter - current)
  candidates.sort((a, b) => {
    // gain(a) / time(a) against gain(b) / time(b), the better first.
    const forA = gainOf(a) * stepLength(b.direction)
    const forB = gainOf(b) * stepLength(a.direction)
    if (forA !== forB) return forB - forA
    if (a.turn !== b.turn) return a.turn - b.turn
    return a.index - b.index
  })

  return candidates.map(({ direction, to, distanceAfter }) => ({ direction, to, distanceAfter }))
}
