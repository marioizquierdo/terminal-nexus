// 3. Perception — engine.md 4.3. Who each actor sees, and who it decides to fight or flee.

import { directionOf } from "../grid/coords.ts"
import type { Actor, TickContext } from "./shared.ts"
import { distanceBetween, isMobile, setTarget } from "./shared.ts"

export function hostilesOf(context: TickContext, actor: Actor): Actor[] {
  return context.actors.filter((other) => other.player !== actor.player && !other.pendingDead)
}

/**
 * The whole scoring function is "nearest enemy by Manhattan distance across every hostile layer,
 * ties broken by entity id" (milestone-1-spike-battle.md 3.7; the metric was Chebyshev/eight-way at
 * gate authoring time and moved to Manhattan/four-way after Milestone 1 playtesting — grid/coords.ts,
 * `gridDistance`). Resisting the urge to improve the scoring function itself is part of the gate.
 */
export function selectTarget(
  context: TickContext,
  actor: Actor,
  candidates: readonly Actor[],
): { target: Actor; distance: number } | null {
  let best: { target: Actor; distance: number } | null = null
  for (const candidate of candidates) {
    const distance = distanceBetween(actor, candidate)
    if (best === null || distance < best.distance) {
      best = { target: candidate, distance }
    }
    // Ties break on the entity id, and ordinals are assigned in scenario order, so the earlier
    // entity wins. `<` above already keeps the first-seen candidate, and `context.actors` is
    // ordered by ordinal.
  }
  return best
}

export function perception(context: TickContext): void {
  for (const actor of context.actors) {
    if (!isMobile(actor) && actor.definition.attack === undefined) {
      setTarget(context, actor, null)
      continue
    }
    const previous = actor.targetOrdinal
    if (previous !== null && context.byOrdinal.get(previous) === undefined) {
      // Resolution clears the target of everything aiming at an entity as it dies, so reaching
      // here means a target left the Grid without a death event. That is suspicious rather than
      // normal, and the report says so at WARN.
      context.events.push({
        kind: "target.lost",
        tick: context.tick,
        entity: actor.id,
        ordinal: actor.ordinal,
        target: `#${previous}`,
        targetOrdinal: previous,
      })
      setTarget(context, actor, null)
    }

    const hostiles = hostilesOf(context, actor)
    const candidates =
      actor.definition.behavior === "flee"
        ? hostiles.filter((other) => other.definition.attack !== undefined)
        : hostiles
    const selection = selectTarget(context, actor, candidates)
    if (selection === null) {
      setTarget(context, actor, null)
      continue
    }

    const changed = actor.targetOrdinal !== selection.target.ordinal
    setTarget(context, actor, selection.target.ordinal)
    // Facing is derived from the current target when stationary, and from the last step when
    // moving. Nothing in the rules reads it (Q9).
    actor.facing = directionOf(actor.anchor, selection.target.anchor, actor.facing)
    if (changed) {
      context.events.push({
        kind: "target.selected",
        tick: context.tick,
        entity: actor.id,
        ordinal: actor.ordinal,
        target: selection.target.id,
        targetOrdinal: selection.target.ordinal,
        distance: selection.distance,
        score: selection.distance,
      })
    }
  }
}

/** "when a hostile attacker is within range + 2" — milestone-1-spike-battle.md 3.7. */
export function fleeTrigger(threat: Actor): number {
  return (threat.definition.attack?.range ?? 0) + 2
}
