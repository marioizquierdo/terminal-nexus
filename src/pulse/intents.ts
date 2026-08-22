// 4. Intents — engine.md 4.3. What each actor wants to do this tick, before arbitration decides who
// actually gets it.

import { directionOf, footprintDistance, nearestFootprintTile, step } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import type { StepChoice } from "./movement.ts"
import { accrueCredit, canStep, rankedSteps, stepCost } from "./movement.ts"
import { fleeTrigger } from "./perception.ts"
import type { Actor, TickContext } from "./shared.ts"
import { blockReasonFor, maskForActor } from "./shared.ts"

export type Intent = {
  actor: Actor
  choices: StepChoice[]
  chosen: number
}

export function intents(context: TickContext): Intent[] {
  const declared: Intent[] = []
  for (const actor of context.actors) {
    const rate = actor.definition.movementRate
    if (rate === undefined || actor.definition.behavior === "static" || actor.pendingDead) continue

    actor.moveCredit = accrueCredit(actor.moveCredit, rate)

    const target = actor.targetOrdinal === null ? null : context.byOrdinal.get(actor.targetOrdinal)
    if (target === undefined || target === null) continue

    const distance = footprintDistance(
      actor.anchor,
      actor.definition.footprint,
      target.anchor,
      target.definition.footprint,
    )

    let intent: "toward" | "away"
    if (actor.definition.behavior === "flee") {
      if (distance > fleeTrigger(target)) continue
      intent = "away"
      context.events.push({
        kind: "behavior.flee",
        tick: context.tick,
        entity: actor.id,
        ordinal: actor.ordinal,
        threat: target.id,
        threatOrdinal: target.ordinal,
        distance,
      })
    } else {
      const attack = actor.definition.attack
      // An actor already in range holds and shoots or swings; melee is the special case of that,
      // where the step it wanted is the tile the enemy is standing in.
      if (attack !== undefined && distance <= attack.range) continue
      intent = "toward"
    }

    if (!canStep(actor.moveCredit, rate)) continue

    const mask = maskForActor(context, actor)
    const goal = movementGoal(actor.anchor, target)
    const choices = rankedSteps(actor.anchor, actor.definition, mask, { goal, intent })
    if (choices.length === 0) {
      const desired = desiredTile(actor, target, intent)
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
        cost: stepCost(rate),
      })
      continue
    }
    const first = choices[0]
    if (first === undefined) continue
    context.events.push({
      kind: "move.intended",
      tick: context.tick,
      entity: actor.id,
      ordinal: actor.ordinal,
      from: actor.anchor,
      to: first.to,
      direction: first.direction,
      credit: actor.moveCredit,
      cost: stepCost(rate),
    })
    declared.push({ actor, choices, chosen: 0 })
  }
  return declared
}

/**
 * The tile a mover is actually walking toward: the nearest tile of the target's footprint, not its
 * anchor. Routing and range-checking must agree on this point, or a mover can rank every step that
 * would put it in range as "further from the goal" and never take it (see `nearestFootprintTile`).
 */
export function movementGoal(from: Coord, target: Actor): Coord {
  return nearestFootprintTile(from, target.anchor, target.definition.footprint)
}

/** The tile the actor wanted, for the report: one step along the direction it was heading. */
export function desiredTile(actor: Actor, target: Actor, intent: "toward" | "away"): Coord {
  const goal = movementGoal(actor.anchor, target)
  const direction =
    intent === "toward" ? directionOf(actor.anchor, goal, actor.facing) : directionOf(goal, actor.anchor, actor.facing)
  return step(actor.anchor, direction)
}
