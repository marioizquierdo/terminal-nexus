// 3. Perception (phase order in pulse.md). Who each actor sees, and who it decides to fight or flee.

import type { ContentDef } from "../content/types.ts"
import { directionOf } from "../grid/coords.ts"
import { wholeRows } from "../grid/reach.ts"
import type { Actor, TickContext } from "./shared.ts"
import { distanceBetween, drawAmong, isMobile, setTarget, within } from "./shared.ts"
import { engageRange, targetFor } from "./target.ts"

export function hostilesOf(context: TickContext, actor: Actor): Actor[] {
  return context.actors.filter((other) => other.player !== actor.player && !other.pendingDead)
}

/** Wounded allies, self excluded — the `"support"` behavior's candidate pool (the unit-architecture
 * spike): a healer's whole targeting axis is the opposite of every other behavior's, so it bypasses
 * `hostilesOf` entirely rather than filtering it. */
export function woundedAlliesOf(context: TickContext, actor: Actor): Actor[] {
  return context.actors.filter(
    (other) =>
      other.player === actor.player &&
      other !== actor &&
      !other.pendingDead &&
      other.hp < other.definition.maxHp,
  )
}

/**
 * `candidates`, narrowed by `targetLayers` (hard: never a viable target outside it) and then, if
 * nothing in the narrowed set sits on a `targetPreference` layer, left alone — if something does,
 * narrowed further to just those. Shared by every behavior but flee: an attacker's hostiles, so an `attack` and a
 * contact `detonation.triggerRange` alike resolve against whatever this decided (the unit-architecture
 * spike's ground-air asymmetry and siege-giant rule shapes), and a healer's wounded allies, so a healer that
 * names its layers mends only what stands on them — the Aid Station mends units, never a building. A healer that
 * names none, the bench medic, mends every wounded ally as it always did.
 */
function eligibleTargets(actor: Actor, candidates: readonly Actor[]): readonly Actor[] {
  const { targetLayers, targetPreference } = actor.definition
  const eligible =
    targetLayers === undefined ? candidates : candidates.filter((other) => targetLayers.includes(other.definition.layer))
  if (targetPreference === undefined) return eligible
  const preferred = eligible.filter((other) => targetPreference.includes(other.definition.layer))
  return preferred.length > 0 ? preferred : eligible
}

/**
 * The whole scoring function is "nearest enemy across every hostile layer", nearest by the Grid's own distance
 * (`distanceBetween`: a row counts two columns), the shortest walk on screen. Among equally near ones it keeps the
 * one it already holds; otherwise it takes the one closest to falling (least health), so a squad that meets a line
 * fires into the same enemy; and what is still tied is a draw (`drawAmong`). Never the lower ordinal, which the
 * opening hands out in reading order, west first, and so would favour a side by where it stands. It is kept this
 * plain on purpose: a smarter one would be a design change, not a fix.
 */
export function selectTarget(
  context: TickContext,
  actor: Actor,
  candidates: readonly Actor[],
): { target: Actor; distance: number } | null {
  let nearest: Actor[] = []
  let best = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const distance = distanceBetween(actor, candidate)
    if (distance < best) {
      best = distance
      nearest = [candidate]
    } else if (distance === best) nearest.push(candidate)
  }
  const held = nearest.find((candidate) => candidate.ordinal === actor.targetOrdinal)
  if (held !== undefined) return { target: held, distance: best }
  const least = Math.min(...nearest.map((candidate) => candidate.hp))
  const target = drawAmong(context, nearest.filter((candidate) => candidate.hp === least))
  return target === undefined ? null : { target, distance: best }
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

    let candidates: readonly Actor[]
    if (actor.definition.behavior === "support") {
      // A healer's wounded allies, narrowed by its layers as an attacker's hostiles are (`eligibleTargets`). A
      // building that heals never moves (`intents.ts`), so it mends the nearest of them once one is within reach.
      candidates = eligibleTargets(actor, woundedAlliesOf(context, actor))
    } else if (actor.definition.behavior === "flee") {
      candidates = hostilesOf(context, actor).filter((other) => other.definition.attack !== undefined)
    } else if (targetFor(context, actor) !== null) {
      // A unit whose side has a target fights only what has come within its reach, measured as range is;
      // with nothing there it heads for the target instead (`target.ts`, `intents.ts`).
      const reach = engageRange(actor.definition)
      candidates = eligibleTargets(actor, hostilesOf(context, actor).filter((other) => within(actor, other, reach)))
    } else {
      candidates = eligibleTargets(actor, hostilesOf(context, actor))
    }
    const selection = selectTarget(context, actor, candidates)
    if (selection === null) {
      // Losing a target (or never finding one worth locking onto) also spends whatever focus streak
      // was building against the old one - attack.focusRamp's memory is about a *held* lock, not a
      // count that survives losing sight of the thing entirely.
      if (actor.targetOrdinal !== null) actor.focusStreak = 0
      setTarget(context, actor, null)
      continue
    }

    const changed = actor.targetOrdinal !== selection.target.ordinal
    if (changed) actor.focusStreak = 0
    setTarget(context, actor, selection.target.ordinal)
    // Facing is derived from the current target when stationary, and from the last step when
    // moving. Nothing in the rules reads it; facing is presentation-only, a settled decision (Q9, answered).
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

/**
 * How near a threat must come before a unit that flees runs from it, measured as range is: "when a hostile attacker
 * is within range + 2", a threat that can already reach it or nearly can, rounded up to whole rows (`wholeRows`).
 * Against a trooper's melee that is 4: four columns across, or two rows straight up or down, as far on screen.
 */
export function fleeTrigger(threat: ContentDef): number {
  return wholeRows((threat.attack?.range ?? 0) + 2)
}
