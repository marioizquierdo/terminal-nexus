// Per-tick types and small helpers shared by more than one phase of the Pulse. Phase-specific types
// (Intent, Grant) live next to the phase that creates them; only what more than one file needs is
// here. pulse.md has the phase order these types and helpers serve.

import type { AttackDef, ContentDef } from "../content/types.ts"
import type { CollisionMask } from "../grid/occupancy.ts"
import { ClaimOverlay, OccupancyIndex, VacatedOverlay, maskFrom } from "../grid/occupancy.ts"
import { footprintDistance, footprintSteps, footprintWithin } from "../grid/coords.ts"
import type { BlockReason } from "../events/types.ts"
import type { Coord, Direction, GridMeasure } from "../grid/types.ts"
import type { DomainEvent } from "../events/types.ts"
import { Pcg32 } from "../rng/pcg32.ts"
import type { EntityState, GroundItem, PlayerId, TargetArea } from "../state/types.ts"
import type { Guard } from "./aura.ts"
import { guardedAmount } from "./aura.ts"
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
   * The next ordinal `spawn.ts` will hand to a newly-created entity — seeded from `state.nextOrdinal`
   * at tick start, incremented on every spawn, written back at tick end. Ordinals are never reused
   * (state/types.ts), so a counter rather than `context.actors.length` is what keeps that true once
   * entities can be created and destroyed inside the same Pulse.
   */
  nextOrdinal: number
  /**
   * Reverse index from a target's ordinal to the actors currently aiming at it (grid-engine.md, on scaling).
   * Maintained by `setTarget` at every targetOrdinal write site (all in perception.ts) so death
   * resolution can find who was watching a dying entity without scanning every actor. Values are
   * Actor references rather than ordinals: an actor that already died earlier in the same
   * multi-round detonation chain is gone from `byOrdinal` but can still be a legitimate observer
   * here (its own targetOrdinal is never cleared by its own death), and this index has to keep
   * finding it exactly the way the old full scan of `context.actors` did.
   */
  targetObservers: Map<number, Set<Actor>>
  /**
   * Where each side's fighting units head when no enemy is within reach — the state's own `targets`, read
   * and never changed by the kernel (`intents.ts`, `perception.ts`). Empty for a battle with no target.
   */
  targets: Readonly<Partial<Record<PlayerId, TargetArea>>>
  /**
   * How this battle measures the Grid — the state's own `measure`, `SQUARE` when it has none — read and never
   * changed by the kernel. Every distance a phase measures counts a row as `measure.row` columns and a content
   * range, radius or speed as `measure.tile` of them (`distanceBetween`, `within`, `stepCost`); touching and
   * "beside" count steps, whatever the measure (`stepsBetween`).
   */
  measure: GridMeasure
  /**
   * Who an aura guards this tick, by ordinal (`aura.ts`): decided as the attacks begin and read by every hit
   * after it in the tick, a blast's included. Empty until then, and for a battle with no aura in it.
   */
  guards: Map<number, Guard>
}

/**
 * Sets an actor's target and keeps `targetObservers` in sync — the one place perception's five
 * `targetOrdinal = ...` writes and death resolution's reverse-index read have to agree. Reassigning
 * the same value is a harmless no-op remove-then-add, not a special case: correctness never depends
 * on insertion order, because a target's observer set is sorted by ordinal wherever it is read
 * (grid-engine.md, on scaling) — the same order the old scan of `context.actors` always produced.
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

/** Attacks and movement claims both read this. Lower acts first (pulse.md). */
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
 * The distance between two actors, to the nearest occupied tile of each footprint (grid.md), as this
 * battle's measure counts it (`context.measure`: under `SQUARE`, Manhattan).
 * Perception, intents, attacks, and detonation all measure this same way; wrapping the two anchors
 * and two footprints here (rather than every call site reaching into both actors' `definition`
 * itself) is what keeps a future actor-to-actor measurement — a healer's range to an ally, a splash
 * radius from an impact point — from having a second, slightly different way to ask the same
 * question.
 */
export function distanceBetween(context: TickContext, a: Actor, b: Actor): number {
  return footprintDistance(a.anchor, a.definition.footprint, b.anchor, b.definition.footprint, context.measure)
}

/**
 * Four-way steps between two actors' nearest tiles, a row counting as a column whatever the measure: 1 when
 * they touch along a side. What "touching" and "beside" mean — melee's reach, a follower gathered beside
 * another — so they never change with how rows are counted (`gridSteps`). Under `SQUARE` it is
 * `distanceBetween` exactly.
 */
export function stepsBetween(a: Actor, b: Actor): number {
  return footprintSteps(a.anchor, a.definition.footprint, b.anchor, b.definition.footprint)
}

/**
 * Whether `b` is within content radius `radius` of `a`, measured as range is (`footprintWithin`): the nearest
 * tiles within the radius as this battle's measure counts it, or — for a radius of at least 1 — touching along
 * a side. Exactly `distanceBetween(context, a, b) <= radius` under `SQUARE`. A unit's engage reach, a worker's
 * flight trigger and a contact detonator's trigger are all asked this way.
 */
export function within(context: TickContext, a: Actor, b: Actor, radius: number): boolean {
  return footprintWithin(a.anchor, a.definition.footprint, b.anchor, b.definition.footprint, radius, context.measure)
}

/**
 * Whether `actor` can land `attack` on `target` from where it stands — the one test intents (hold, it is in
 * range) and attacks (fire) both ask, so the two can never disagree. **Melee is touching**: a melee attack
 * reaches what is within `range` steps along the Grid's sides, however rows are counted, so a swing at an
 * enemy directly above lands whatever the measure. A ranged shot or a heal reaches as far as its range does,
 * measured as range is (`within`). Under `SQUARE` both are exactly `distanceBetween(context, actor, target)
 * <= attack.range`.
 */
export function inAttackRange(context: TickContext, actor: Actor, target: Actor, attack: AttackDef): boolean {
  if (attack.kind === "melee") return stepsBetween(actor, target) <= attack.range
  return within(context, actor, target, attack.range)
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
 *
 * A target an aura guards this tick (`context.guards`, `aura.ts`) takes the aura's share of `amount`, and
 * the event names the aura's bearer. Here, the one place damage becomes a hit, so a tier's tally, a splash
 * and a blast are all guarded the same way.
 */
export function applyDamage(
  context: TickContext,
  target: Actor,
  source: Actor,
  amount: number,
): boolean {
  const guard = amount > 0 ? context.guards.get(target.ordinal) : undefined
  const dealt = guard === undefined ? amount : guardedAmount(amount, guard.damageTakenPercent)
  const hpBefore = target.hp
  const hpAfter = Math.max(0, hpBefore - dealt)
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
    ...(guard === undefined ? {} : { guardedBy: guard.bearer.id, guardedByOrdinal: guard.bearer.ordinal }),
  })
  if (hpAfter > 0 || target.pendingDead) return false
  target.pendingDead = true
  target.killer = source.id
  return true
}

/**
 * Whether `b` is within `radius` of an *area* — an anchor plus a footprint, which is exactly what `within`
 * already measures one side of — measured as range is, to the nearest occupied tile of `b`'s footprint, by
 * this battle's measure. Generalises `within` rather than sitting beside it: passing `a.anchor` and
 * `a.definition.footprint` as the origin reproduces `within` exactly, and a bare impact point is just a
 * one-tile footprint, `[{x:0,y:0}]`, at the point in question. One primitive under both call shapes, not two.
 *
 * Caught by actually running a scenario, not by inspection: the first cut of this measured every
 * blast from a bare point at the dying entity's *anchor*, which is correct for a 1x1 body and silently
 * shrinks the effective radius for anything bigger — a multi-tile detonator (`unit.ravel.leviathan`,
 * 5x2) caught fewer neighbours than `detonate()`'s original, footprint-aware `distanceBetween` call
 * did, changing existing fixtures' event counts and death tolls with no content change behind it.
 * `citizens-versus-ravels.map.json` and `grand-battle.map.json` are what caught it, hash-compared
 * against `main` before this fix landed.
 */
export function withinArea(
  context: TickContext,
  originAnchor: Coord,
  originFootprint: readonly Coord[],
  b: Actor,
  radius: number,
): boolean {
  return footprintWithin(originAnchor, originFootprint, b.anchor, b.definition.footprint, radius, context.measure)
}

/**
 * Everyone within `radius` of an area, friend and foe alike, in ordinal order — the read-only half of
 * an area effect. Split from `areaDamage` (below) so a caller that has to announce *what* it caught
 * before applying damage to it — `death.ts`'s `detonate()`, whose `entity.detonated` event has always
 * carried the caught list ahead of the `damage.applied` events it causes — can keep that order exactly
 * while still sharing the one geometry query with a caller that does not care about ordering.
 */
export function actorsWithin(
  context: TickContext,
  anchor: Coord,
  footprint: readonly Coord[],
  radius: number,
  exclude?: Actor,
): readonly Actor[] {
  return context.actors
    .filter((other) => other !== exclude && !other.pendingDead)
    .filter((other) => withinArea(context, anchor, footprint, other, radius))
    .sort((a, b) => a.ordinal - b.ordinal)
}

/**
 * Damage everyone within `radius` of an area, friend and foe alike — the one mechanism behind both
 * `detonation` (death.ts, centred on the dying entity's own anchor and footprint) and `attack.splash`
 * (attacks.ts, centred on the resolved target's anchor and footprint, the same "nearest occupied tile"
 * courtesy grid.md already extends to range checks): an area-damage rule shape triggered at two
 * different moments is still one rule shape, not two (a lesson of the unit-architecture spike). Returns who was
 * caught. `attack.splash` has no pre-existing event order to preserve, so it can use this all-in-one
 * form; `detonate()` cannot, and uses `actorsWithin` directly instead — see the comment there.
 */
export function areaDamage(
  context: TickContext,
  anchor: Coord,
  footprint: readonly Coord[],
  radius: number,
  damage: number,
  source: Actor,
  exclude?: Actor,
): readonly Actor[] {
  const caught = actorsWithin(context, anchor, footprint, radius, exclude)
  for (const other of caught) applyDamage(context, other, source, damage)
  return caught
}

/**
 * The heal-side mirror of `applyDamage`: clamped at `maxHp` rather than zero, and a heal never kills,
 * so there is no "pendingDead" branch to mirror. A separate event kind (`heal.applied`, not a negative
 * `damage.applied`) because events carry meaning, not just a number's sign (pulse.md) - a healer's
 * pulse and an incoming hit are not the same fact just because both move `hp`.
 */
export function applyHeal(context: TickContext, target: Actor, source: Actor, amount: number): void {
  const hpBefore = target.hp
  const hpAfter = Math.min(target.definition.maxHp, hpBefore + amount)
  target.hp = hpAfter
  context.events.push({
    kind: "heal.applied",
    tick: context.tick,
    entity: target.id,
    ordinal: target.ordinal,
    source: source.id,
    sourceOrdinal: source.ordinal,
    amount: hpAfter - hpBefore,
    hpBefore,
    hpAfter,
  })
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
