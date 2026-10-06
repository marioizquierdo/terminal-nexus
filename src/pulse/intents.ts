// 4. Intents (phase order in pulse.md). What each actor wants to do this tick, before arbitration decides who
// actually gets it.

import { SQUARE, directionOf, nearestFootprintTile, step } from "../grid/coords.ts"
import type { Coord, Direction, GridMeasure } from "../grid/types.ts"
import type { PlayerId, TargetArea } from "../state/types.ts"
import type { StepChoice } from "./movement.ts"
import { accrueCredit, canStep, rankedSteps, stepCost } from "./movement.ts"
import { fleeTrigger } from "./perception.ts"
import type { Actor, TickContext } from "./shared.ts"
import { blockReasonFor, distanceBetween, inAttackRange, maskForActor, resolveTarget, within } from "./shared.ts"
import { areaGoal, gatheredAt, insideArea, targetFor } from "./target.ts"

export type Intent = {
  actor: Actor
  choices: StepChoice[]
  chosen: number
  /** The tile it walks toward and which way: what arbitration ranks its steps against again when a claim
   *  is lost. Fixed for the tick — nothing it was worked out from moves before the moves settle. */
  goal: Coord
  heading: "toward" | "away"
}

export function intents(context: TickContext): Intent[] {
  const declared: Intent[] = []
  const measure = context.measure
  /** Who is gathered at each side's target this tick, worked out once a side first needs it (`gatheredAt`). */
  const gathered = new Map<PlayerId, ReadonlySet<number>>()
  const gatheredOf = (player: PlayerId, area: TargetArea): ReadonlySet<number> => {
    let found = gathered.get(player)
    if (found === undefined) {
      found = gatheredAt(context, player, area)
      gathered.set(player, found)
    }
    return found
  }
  for (const actor of context.actors) {
    const rate = actor.definition.movementRate
    if (rate === undefined || actor.definition.behavior === "static" || actor.pendingDead) continue

    actor.moveCredit = accrueCredit(actor.moveCredit, rate, measure)

    const target = resolveTarget(context, actor)
    let goal: Coord
    let intent: "toward" | "away"
    /** The target it heads for, when it is heading for its side's target rather than an enemy. */
    let area: TargetArea | null = null
    if (target === null) {
      // No enemy within reach: a fighting unit of a side with a target heads for it, and stands once it is
      // inside (`target.ts`). Anything else with nothing to go for holds, as it always has.
      area = targetFor(context, actor)
      if (area === null || insideArea(actor, area)) continue
      intent = "toward"
      goal = areaGoal(actor.anchor, area, maskForActor(context, actor), measure)
    } else {
      if (actor.definition.behavior === "flee") {
        // Measured as range is, so the threat's reach and the worker's nerve are counted alike.
        if (!within(context, actor, target, fleeTrigger(target))) continue
        intent = "away"
        context.events.push({
          kind: "behavior.flee",
          tick: context.tick,
          entity: actor.id,
          ordinal: actor.ordinal,
          threat: target.id,
          threatOrdinal: target.ordinal,
          distance: distanceBetween(context, actor, target),
        })
      } else {
        const attack = actor.definition.attack
        // An actor already in range holds and shoots or swings; melee is the special case of that,
        // where the step it wanted is the tile the enemy is standing in. The attacks step's own test, so
        // the two can never disagree (`inAttackRange`).
        if (attack !== undefined && inAttackRange(context, actor, target, attack)) continue
        intent = "toward"
      }
      goal = movementGoal(actor.anchor, target, measure)
    }

    if (!canStep(actor.moveCredit, rate, measure)) continue

    const mask = maskForActor(context, actor)
    const choices = rankedSteps(actor.anchor, actor.definition, mask, { goal, intent, measure })
    if (choices.length === 0) {
      // Nothing brings it closer to its side's target, and it is gathered there beside its own: it stands,
      // rather than pressing on them.
      if (area !== null && gatheredOf(actor.player, area).has(actor.ordinal)) continue
      const direction = desiredDirection(actor, goal, intent, measure)
      const cost = stepCost(rate, measure, direction)
      // Blocked is a step it could pay for and could not take; short of that step's credit it is still
      // waiting for it, as it would be with the way clear. Under `SQUARE` every step costs what `canStep` asked.
      if (actor.moveCredit < cost) continue
      const desired = step(actor.anchor, direction)
      // The full footprint, not just the anchor tile: a multi-tile mover's naive "straight at the
      // goal" tile can itself be perfectly clear while a *different* tile in its footprint is what's
      // actually occupied - checking only the anchor then reports "edge" (blockReasonFor's fallback
      // for "nothing was wrong with the one tile I looked at"), which is simply false. A three-tile
      // raider crowded by an ally's tail in a populous scenario is what surfaced this.
      const blocker = mask.footprintBlockerAt(desired, actor.definition.footprint)
      context.events.push({
        kind: "move.blocked",
        tick: context.tick,
        entity: actor.id,
        ordinal: actor.ordinal,
        desired,
        reason: blockReasonFor(blocker),
        blocker: typeof blocker === "number" ? (context.byOrdinal.get(blocker)?.id ?? null) : null,
        credit: actor.moveCredit,
        cost,
      })
      continue
    }
    const first = choices[0]
    if (first === undefined) continue
    // A step up or down may cost more than one across (`stepCost`). The actor waits for the step it wants
    // rather than taking a cheaper one it likes less — which would bend every walk across first — and once it
    // can pay, its credit is capped at that step's cost, so waiting never banks a sprint across. Under
    // `SQUARE` every step costs the cap `canStep` already met, so neither line changes anything.
    const cost = stepCost(rate, measure, first.direction)
    if (actor.moveCredit < cost) continue
    actor.moveCredit = Math.min(actor.moveCredit, cost)
    context.events.push({
      kind: "move.intended",
      tick: context.tick,
      entity: actor.id,
      ordinal: actor.ordinal,
      from: actor.anchor,
      to: first.to,
      direction: first.direction,
      credit: actor.moveCredit,
      cost,
    })
    declared.push({ actor, choices, chosen: 0, goal, heading: intent })
  }
  return declared
}

/**
 * The tile a mover is actually walking toward: the nearest tile of the target's footprint, not its
 * anchor, nearest as the battle's measure counts it. Routing and range-checking must agree on this point,
 * or a mover can rank every step that would put it in range as "further from the goal" and never take it
 * (see `nearestFootprintTile`).
 */
export function movementGoal(from: Coord, target: Actor, measure: GridMeasure = SQUARE): Coord {
  return nearestFootprintTile(from, target.anchor, target.definition.footprint, measure)
}

/** The tile the actor wanted, for the report: one step along the direction it was heading. */
export function desiredTile(actor: Actor, target: Actor, intent: "toward" | "away", measure: GridMeasure = SQUARE): Coord {
  return step(actor.anchor, desiredDirection(actor, movementGoal(actor.anchor, target, measure), intent, measure))
}

/** Which way the actor heads along the way to — or, fleeing, away from — `goal`: straight at it, as the
 *  measure counts straight (`directionOf`). */
function desiredDirection(actor: Actor, goal: Coord, intent: "toward" | "away", measure: GridMeasure): Direction {
  return intent === "toward" ? directionOf(actor.anchor, goal, actor.facing, measure) : directionOf(goal, actor.anchor, actor.facing, measure)
}
