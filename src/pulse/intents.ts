// 4. Intents (phase order in pulse.md). What each actor wants to do this tick, before arbitration decides who
// actually gets it.

import { directionOf, nearestFootprintTile, step } from "../grid/coords.ts"
import type { Coord, Direction } from "../grid/types.ts"
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

    actor.moveCredit = accrueCredit(actor.moveCredit, rate)

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
      goal = areaGoal(actor.anchor, area, maskForActor(context, actor))
    } else {
      if (actor.definition.behavior === "flee") {
        // Measured as range is, so the threat's reach and the worker's nerve are counted alike.
        if (!within(actor, target, fleeTrigger(target.definition))) continue
        intent = "away"
        context.events.push({
          kind: "behavior.flee",
          tick: context.tick,
          entity: actor.id,
          ordinal: actor.ordinal,
          threat: target.id,
          threatOrdinal: target.ordinal,
          distance: distanceBetween(actor, target),
        })
      } else {
        const attack = actor.definition.attack
        // An actor already in range holds and shoots or swings; melee is the special case of that,
        // where the step it wanted is the tile the enemy is standing in. The attacks step's own test, so
        // the two can never disagree (`inAttackRange`).
        if (attack !== undefined && inAttackRange(actor, target, attack)) continue
        intent = "toward"
      }
      goal = movementGoal(actor.anchor, target)
    }

    if (!canStep(actor.moveCredit, rate)) continue

    const mask = maskForActor(context, actor)
    const choices = rankedSteps(actor.anchor, actor.definition, mask, { goal, intent })
    if (choices.length === 0) {
      // Nothing brings it closer to its side's target, and it is gathered there beside its own: it stands,
      // rather than pressing on them.
      if (area !== null && gatheredOf(actor.player, area).has(actor.ordinal)) continue
      const direction = desiredDirection(actor, goal, intent)
      const cost = stepCost(rate, direction)
      // Blocked is a step it could pay for and could not take; short of that step's credit — a step up or down
      // costs more than one across — it is still waiting for it, as it would be with the way clear.
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
    // A step up or down costs more than one across (`stepCost`). The actor waits for the step it wants rather than
    // taking a cheaper one it likes less — which would bend every walk across first — and once it can pay, its
    // credit is capped at that step's cost, so waiting never banks a sprint across.
    const cost = stepCost(rate, first.direction)
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
 * anchor. Routing and range-checking must agree on this point, or a mover can rank every step that would
 * put it in range as "further from the goal" and never take it (see `nearestFootprintTile`).
 */
export function movementGoal(from: Coord, target: Actor): Coord {
  return nearestFootprintTile(from, target.anchor, target.definition.footprint)
}

/** The tile the actor wanted, for the report: one step along the direction it was heading. */
export function desiredTile(actor: Actor, target: Actor, intent: "toward" | "away"): Coord {
  return step(actor.anchor, desiredDirection(actor, movementGoal(actor.anchor, target), intent))
}

/** Which way the actor heads along the way to — or, fleeing, away from — `goal`: straight at it, along the
 *  screen's own diagonal (`directionOf`). */
function desiredDirection(actor: Actor, goal: Coord, intent: "toward" | "away"): Direction {
  return intent === "toward" ? directionOf(actor.anchor, goal, actor.facing) : directionOf(goal, actor.anchor, actor.facing)
}
