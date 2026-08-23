// Per-tick types and small helpers shared by more than one phase of the Pulse. Phase-specific types
// (Intent, Grant) live next to the phase that creates them; only what more than one file needs is
// here — engine.md 4.3 is the phase order these types and helpers serve.

import type { ContentDef } from "../content/types.ts"
import type { CollisionMask } from "../grid/occupancy.ts"
import { ClaimOverlay, OccupancyIndex, VacatedOverlay, maskFrom } from "../grid/occupancy.ts"
import { footprintDistance } from "../grid/coords.ts"
import type { BlockReason } from "../events/types.ts"
import type { Coord, Direction } from "../grid/types.ts"
import type { DomainEvent } from "../events/types.ts"
import { Pcg32 } from "../rng/pcg32.ts"
import type { EntityState, GroundItem, PlayerId } from "../state/types.ts"
import type { PulseContext } from "./context.ts"

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

/**
 * An entity, mid-tick. Every field `EntityState` carries, writable, plus the resolved content
 * definition and the two pieces of bookkeeping that only make sense while a tick is in flight
 * (`pendingDead`, `killer` — settled back out of state by `resolution()`, `death.ts`, once a Pulse
 * decides who actually died).
 *
 * Deriving this from `EntityState` rather than re-listing its ten fields is deliberate: a stat a
 * future unit type needs (a shield pool, cargo, anything else `state/types.ts` gains) becomes
 * visible here — and everywhere `Actor` is used — the moment it lands there, with no second list to
 * remember to update. `tick.ts`'s entity-to-actor conversion leans on that (`{ ...entity, ... }`);
 * its actor-to-entity conversion, the boundary back into hashed, serialized, replayed state, is kept
 * fully explicit on purpose — see the comment there.
 */
export type Actor = Mutable<EntityState> & {
  definition: ContentDef
  pendingDead: boolean
  killer: string | null
}

export type TickContext = {
  tick: number
  pulse: PulseContext
  actors: Actor[]
  byOrdinal: Map<number, Actor>
  index: OccupancyIndex
  vacated: VacatedOverlay
  /** Ordinals that settled a move this tick — checked by attacks(). See the note there. */
  movedThisTick: Set<number>
  rng: Pcg32
  events: DomainEvent[]
  groundItems: GroundItem[]
  /**
   * Reverse index from a target's ordinal to the actors currently aiming at it — engine.md 11.1.
   * Maintained by `setTarget` at every targetOrdinal write site (all in perception.ts) so death
   * resolution can find who was watching a dying entity without scanning every actor. Values are
   * Actor references rather than ordinals: an actor that already died earlier in the same
   * multi-round detonation chain is gone from `byOrdinal` but can still be a legitimate observer
   * here (its own targetOrdinal is never cleared by its own death), and this index has to keep
   * finding it exactly the way the old full scan of `context.actors` did.
   */
  targetObservers: Map<number, Set<Actor>>
}

/**
 * Sets an actor's target and keeps `targetObservers` in sync — the one place perception's five
 * `targetOrdinal = ...` writes and death resolution's reverse-index read have to agree. Reassigning
 * the same value is a harmless no-op remove-then-add, not a special case: correctness never depends
 * on insertion order, because a target's observer set is sorted by ordinal wherever it is read
 * (engine.md 11.1) — the same order the old scan of `context.actors` always produced.
 */
export function setTarget(context: TickContext, actor: Actor, targetOrdinal: number | null): void {
  if (actor.targetOrdinal !== null) {
    context.targetObservers.get(actor.targetOrdinal)?.delete(actor)
  }
  actor.targetOrdinal = targetOrdinal
  if (targetOrdinal !== null) {
    let observers = context.targetObservers.get(targetOrdinal)
    if (observers === undefined) {
      observers = new Set()
      context.targetObservers.set(targetOrdinal, observers)
    }
    observers.add(actor)
  }
}

/** Maps a mask's blocker to the reason a `move.blocked` event reports. */
export function blockReasonFor(blocker: "edge" | "terrain" | "settling" | number | null): BlockReason {
  if (typeof blocker === "number") return "entity"
  if (blocker === "terrain" || blocker === "settling") return blocker
  return "edge"
}

/** Attacks and movement claims both read this. Lower acts first — engine.md 4.3. */
export function speedTier(actor: Actor): number {
  return actor.definition.speedTier
}

/**
 * The `Actor` an actor is currently targeting, or `null` if it has none — or if the ordinal it last
 * targeted is no longer live (already resolved out of `byOrdinal` this tick; every phase that reads
 * a target has to treat "gone" the same as "never had one"). Intents, arbitration's `rerank`, and
 * attacks all resolved this the same way independently before this was one function; wrapping it here
 * is the same reasoning as `distanceBetween` and `applyDamage` — a healer resolving an ally, or
 * anything else that reads `targetOrdinal`, gets the one answer this already agrees on rather than a
 * fourth copy that could quietly drift from the other three.
 */
export function resolveTarget(context: TickContext, actor: Actor): Actor | null {
  return actor.targetOrdinal === null ? null : (context.byOrdinal.get(actor.targetOrdinal) ?? null)
}

/**
 * The distance between two actors, to the nearest occupied tile of each footprint — engine.md 3.5.
 * Perception, intents, attacks, and detonation all measure this same way; wrapping the two anchors
 * and two footprints here (rather than every call site reaching into both actors' `definition`
 * itself) is what keeps a future actor-to-actor measurement — a healer's range to an ally, a splash
 * radius from an impact point — from having a second, slightly different way to ask the same
 * question.
 */
export function distanceBetween(a: Actor, b: Actor): number {
  return footprintDistance(a.anchor, a.definition.footprint, b.anchor, b.definition.footprint)
}

/**
 * Applies damage to a target, clamped at zero, and marks it `pendingDead` the first time it reaches
 * zero — the one place `attacks()` (a tier's accumulated damage) and `detonate()` (blast damage,
 * `death.ts`) both turn "this much damage, from this source" into a `damage.applied` event and,
 * maybe, a death. Reads `target.hp` rather than a caller-supplied "before" value: nothing in either
 * caller mutates a target's hp between deciding how much damage it takes and calling this, so the
 * two are always the same value — attacks() used to snapshot hp at tier start for exactly this
 * reason before this was one function both callers shared.
 *
 * Returns whether *this* call is what killed the target, so a caller that reacts to its own kill —
 * attacks()'s post-kill movement hold — does not have to re-derive it from hp afterward.
 */
export function applyDamage(
  context: TickContext,
  target: Actor,
  source: Actor,
  amount: number,
): boolean {
  const hpBefore = target.hp
  const hpAfter = Math.max(0, hpBefore - amount)
  target.hp = hpAfter
  context.events.push({
    kind: "damage.applied",
    tick: context.tick,
    entity: target.id,
    ordinal: target.ordinal,
    source: source.id,
    sourceOrdinal: source.ordinal,
    amount: hpBefore - hpAfter,
    hpBefore,
    hpAfter,
  })
  if (hpAfter > 0 || target.pendingDead) return false
  target.pendingDead = true
  target.killer = source.id
  return true
}

export function isMobile(actor: Actor): boolean {
  return actor.definition.layer !== "obstacles"
}

export function maskForActor(
  context: TickContext,
  actor: Actor,
  overlay?: ClaimOverlay,
): CollisionMask {
  return maskFrom(context.index, {
    layers: actor.definition.collidesWith,
    // Air ignores what is on the ground, including impassable terrain: the mask is composed from
    // chosen layers, never inferred from a layer's position in the render order.
    terrain: actor.definition.layer === "air" ? "ignore" : "impassable",
    ignore: [actor.ordinal],
    vacated: context.vacated,
    ...(overlay === undefined ? {} : { overlay }),
  })
}
