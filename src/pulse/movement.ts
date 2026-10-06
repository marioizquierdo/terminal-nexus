// Movement credit and step choice (pulse.md).
//
// How far a step goes is the battle's measure (`GridMeasure`, the Ground Experiment): one content tile of movement
// costs `denominator x 12` credit, a step across a column is `1 / measure.tile` of a tile, and a step up or down a
// row is `measure.row` times a step across. Under `SQUARE` every step is one tile, as it always was, and every
// number and every order here is what it was before the measure existed.

import type { ContentDef, MovementRate } from "../content/types.ts"
import { DIRECTIONS, SQUARE, directionOf, gridDistance, step } from "../grid/coords.ts"
import type { CollisionMask } from "../grid/occupancy.ts"
import type { Coord, Direction, GridMeasure } from "../grid/types.ts"

/** Whether a step goes up or down a row (north or south) rather than across a column. */
function isRowStep(direction: Direction): boolean {
  return direction === "n" || direction === "s"
}

/**
 * What a step costs in movement credit; each tick adds `numerator`. Integers only, no float anywhere.
 *
 * A content tile of movement costs `denominator x 12`. A step across costs that over `measure.tile`, and a step
 * up or down `measure.row` times a step across — whole numbers, since `denominator x 12` is even. Under
 * `SQUARE` every step costs `denominator x 12`, as it always has; when a row counts two columns, a step up or
 * down takes twice as long as one across, so a walk down the screen and one across it cover the same ground in
 * the same time. With no direction, the dearest step's cost, a row's: what credit is capped at
 * (`accrueCredit`).
 */
export function stepCost(rate: MovementRate, measure: GridMeasure = SQUARE, direction?: Direction): number {
  const across = (rate.denominator * 12) / measure.tile
  return direction === undefined || isRowStep(direction) ? across * measure.row : across
}

/**
 * Credit is capped at one step's cost: an actor that could not move cannot bank a sprint
 * (pulse.md). A blocked step keeps its credit, which is simply what *not* subtracting means.
 *
 * The cap is the dearest step's: an actor waiting for a step up or down saves up for it. Once it can pay for the
 * step it wants, its credit is capped again at that step's own cost (`intents.ts`), so waiting never banks a
 * sprint of cheaper steps across. Under `SQUARE` every step costs the cap.
 */
export function accrueCredit(credit: number, rate: MovementRate, measure: GridMeasure = SQUARE): number {
  return Math.min(credit + rate.numerator, stepCost(rate, measure))
}

/** Whether an actor has the credit for a step at all: the cheapest, a step across. */
export function canStep(credit: number, rate: MovementRate, measure: GridMeasure = SQUARE): boolean {
  return credit >= stepCost(rate, measure, "e")
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
  /** How the battle measures the Grid: the distance a step gains, which way is straight at the goal, and how
   *  long each step takes (`context.measure` in the kernel; the opening state's in a forecast). */
  measure: GridMeasure
}>

/**
 * Greedy step with a deterministic sidestep, over the mover's own collision mask
 * (the first routing). Candidates are ranked by the distance they gain for the time they take, then by
 * how far they turn from the direction the actor wanted, then by a fixed compass order — so two
 * equally good steps always resolve the same way on every machine.
 *
 * Gain for time, not gain alone: a step up or down gains a row, which the measure may count as two columns,
 * and takes as much longer. Ranked by gain alone every unit would walk down first and across after; ranked by
 * gain for its time every improving step is as good as another, and the turn decides, so a unit follows the
 * screen's diagonal (`directionOf`) — the staircase it has always walked. Compared by cross-multiplying, whole
 * numbers only. Under `SQUARE` every step takes the same time and this is the ranking by distance it always was.
 *
 * Under Manhattan distance and four-way movement, every legal step changes distance by exactly ±1 —
 * there is no step that merely holds distance level, the way a diagonal sidestep once could. That
 * means an actor whose approach is off-axis (both a row and a column separate it from the goal) has
 * two improving directions to fall back on, and can slide along an obstacle's face one of them at a
 * time until it clears. An actor whose approach is exactly on-axis (same row or column as the goal)
 * has exactly one improving direction, and if that is blocked there is no fallback at all: it holds
 * and the tick reports it blocked, for as long as the obstacle stands. This is a known, accepted gap
 * in the first routing, and real pathfinding, not this greedy stepping, is what would close it. What a
 * mover with no route should do (circle or stop) is still an open question (Q15).
 */
export function rankedSteps(
  anchor: Coord,
  definition: ContentDef,
  mask: CollisionMask,
  options: StepOptions,
): StepChoice[] {
  const { goal, intent, measure } = options
  const current = gridDistance(anchor, goal, measure)
  const desired = intent === "toward" ? directionOf(anchor, goal, "s", measure) : directionOf(goal, anchor, "s", measure)

  const candidates: Array<StepChoice & { turn: number; index: number }> = []
  DIRECTIONS.forEach((direction, index) => {
    const to = step(anchor, direction)
    if (!mask.footprintFits(to, definition.footprint)) return
    const distanceAfter = gridDistance(to, goal, measure)
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

  // What a step gains, and how long it takes against a step across: a row's step `measure.row` times as long.
  const gainOf = (choice: StepChoice): number => (intent === "toward" ? current - choice.distanceAfter : choice.distanceAfter - current)
  const timeOf = (choice: StepChoice): number => (isRowStep(choice.direction) ? measure.row : 1)
  candidates.sort((a, b) => {
    // gain(a) / time(a) against gain(b) / time(b), the better first.
    const forA = gainOf(a) * timeOf(b)
    const forB = gainOf(b) * timeOf(a)
    if (forA !== forB) return forB - forA
    if (a.turn !== b.turn) return a.turn - b.turn
    return a.index - b.index
  })

  return candidates.map(({ direction, to, distanceAfter }) => ({ direction, to, distanceAfter }))
}
