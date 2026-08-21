// Movement credit and step choice — engine.md 4.2 and 4.3.

import type { ContentDef, MovementRate } from "../content/types.ts"
import { DIRECTIONS, directionOf, gridDistance, step } from "../grid/coords.ts"
import type { CollisionMask } from "../grid/occupancy.ts"
import type { Coord, Direction } from "../grid/types.ts"

/** A step costs `denominator x 12`; each tick adds `numerator`. Integers only, no float anywhere. */
export function stepCost(rate: MovementRate): number {
  return rate.denominator * 12
}

/**
 * Credit is capped at one step's cost: an actor that could not move cannot bank a sprint
 * (engine.md 4.2). A blocked step keeps its credit, which is simply what *not* subtracting means.
 */
export function accrueCredit(credit: number, rate: MovementRate): number {
  return Math.min(credit + rate.numerator, stepCost(rate))
}

export function canStep(credit: number, rate: MovementRate): boolean {
  return credit >= stepCost(rate)
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
 * (milestone-1-spike-battle.md 3.7). Candidates are ranked by the distance they achieve, then by
 * how far they turn from the direction the actor wanted, then by a fixed compass order — so two
 * equally good steps always resolve the same way on every machine.
 *
 * Under Manhattan distance and four-way movement, every legal step changes distance by exactly ±1 —
 * there is no step that merely holds distance level, the way a diagonal sidestep once could. That
 * means an actor whose approach is off-axis (both a row and a column separate it from the goal) has
 * two improving directions to fall back on, and can slide along an obstacle's face one of them at a
 * time until it clears. An actor whose approach is exactly on-axis (same row or column as the goal)
 * has exactly one improving direction, and if that is blocked there is no fallback at all: it holds
 * and the tick reports it blocked, for as long as the obstacle stands. This is a known, accepted gap
 * in the Gate 1A routing floor — specs/open-questions.md Q15 — and real pathfinding is Milestone 2's
 * job to close, not this greedy step's.
 */
export function rankedSteps(
  anchor: Coord,
  definition: ContentDef,
  mask: CollisionMask,
  options: StepOptions,
): StepChoice[] {
  const current = gridDistance(anchor, options.goal)
  const desired =
    options.intent === "toward"
      ? directionOf(anchor, options.goal)
      : directionOf(options.goal, anchor)

  const candidates: Array<StepChoice & { turn: number; index: number }> = []
  DIRECTIONS.forEach((direction, index) => {
    const to = step(anchor, direction)
    if (!mask.footprintFits(to, definition.footprint)) return
    const distanceAfter = gridDistance(to, options.goal)
    const improves =
      options.intent === "toward" ? distanceAfter <= current : distanceAfter >= current
    if (!improves) return
    candidates.push({
      direction,
      to,
      distanceAfter,
      turn: turnCost(desired, direction),
      index,
    })
  })

  candidates.sort((a, b) => {
    if (a.distanceAfter !== b.distanceAfter) {
      return options.intent === "toward"
        ? a.distanceAfter - b.distanceAfter
        : b.distanceAfter - a.distanceAfter
    }
    if (a.turn !== b.turn) return a.turn - b.turn
    return a.index - b.index
  })

  return candidates.map(({ direction, to, distanceAfter }) => ({ direction, to, distanceAfter }))
}
