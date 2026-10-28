// Movement credit (pulse.md): what a step costs and when a unit can pay for it. Which step it wants is its route's
// (`routes.ts`, `src/routing/`).
//
// A unit walks to a **beat**: the whole number of ticks a step across a column takes, `ceil(12 x denominator /
// numerator)` at 12 ticks a second. A step costs a beat's worth of credit for each column of distance it covers
// (`stepLength`, src/grid/coords.ts), one across and `ROW_DISTANCE` up or down, and each tick adds `numerator`, so a
// step across takes exactly one beat and a step up or down exactly two, whatever the rate. So a unit walks every
// distance at one pace — a walk down the screen and one across it cover the same ground in the same time, and a
// unit that can reach a tile within a range by walking reaches it in the time the range says.

import type { MovementRate } from "../content/types.ts"
import { DIRECTIONS, stepLength } from "../grid/coords.ts"
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
 * worth of credit, and a step up or down `ROW_DISTANCE` times that, so it takes exactly two beats — times `weight`,
 * what the ground it steps onto weighs (slow ground, `TerrainKind.stepWeight`). With no direction, the dearest step's
 * cost on open ground: what credit is capped at (`accrueCredit`).
 */
export function stepCost(rate: MovementRate, direction?: Direction, weight = 1): number {
  return creditFor(rate, (direction === undefined ? LONGEST_STEP : stepLength(direction)) * weight)
}

/**
 * Credit is capped at one step's cost, the dearest step's: an actor that could not move cannot bank a sprint
 * (pulse.md), and an actor waiting for a step up or down saves up for it. Once it can pay for the step it wants,
 * its credit is capped again at that step's own cost (`intents.ts`), and at the cost of the step it is granted
 * (`settle`, `arbitration.ts`), so waiting never buys two quick steps across, not even for a mover that lost its
 * claim on a step down and took a step across instead. A blocked step keeps its credit, which is simply what *not*
 * subtracting means. Beside slow ground the cap is the dearest step from where the unit stands (`cap`), so it can save
 * up for a step onto it.
 */
export function accrueCredit(credit: number, rate: MovementRate, cap: number = stepCost(rate)): number {
  return Math.min(credit + rate.numerator, cap)
}

/**
 * **Half speed** (movement.md, troop formation): a unit that walks slowly this tick accrues its credit on every second
 * tick only, so it takes exactly twice as long for a step, whatever its rate and the ground, and never stops. Whole
 * numbers: the same two ticks on either side of the map and in either runtime.
 */
export function accrueSlowedCredit(credit: number, rate: MovementRate, tick: number, cap: number = stepCost(rate)): number {
  return tick % 2 === 0 ? accrueCredit(credit, rate, cap) : Math.min(credit, cap)
}

/** Whether an actor has the credit for a step at all: the cheapest, a step across. */
export function canStep(credit: number, rate: MovementRate): boolean {
  return credit >= creditFor(rate, SHORTEST_STEP)
}

export type StepChoice = Readonly<{
  direction: Direction
  to: Coord
  distanceAfter: number
  /** What the ground it steps onto weighs (`TerrainKind.stepWeight`): the step costs that many times its length.
   *  Absent: open ground, 1. */
  weight?: number
}>

/** What `choice` costs a unit walking at `rate`, the ground it steps onto weighed in. */
export function choiceCost(rate: MovementRate, choice: StepChoice): number {
  return stepCost(rate, choice.direction, choice.weight ?? 1)
}
