// 8. Death resolution — engine.md 4.3. Deaths, destruction, salvage — and detonations, which can
// cause more of all three.

import type { Actor, TickContext } from "./shared.ts"
import { actorsWithin, applyDamage } from "./shared.ts"
import { spawnOnDeath } from "./spawn.ts"

/**
 * Ticks a vacated tile stays blocked after a death — the owner's playtest finding that another
 * unit stepping into a corpse's tile the instant it opens reads as a glitch. Two ticks is about
 * 160ms at 12Hz: long enough to register as a pause, short enough that it never reads as a second
 * rule players have to learn.
 */
export const DEATH_SETTLE_TICKS = 2

/**
 * Deaths, destruction, salvage — and detonations, which can cause more of all three.
 *
 * Volatile munitions make death contagious, so resolution is a queue rather than a pass: an entity
 * that dies detonates, the blast damages everything inside its radius including its own side, and
 * anything that reaches zero joins the queue. **The chain is bounded because an entity can only die
 * once**, so the queue drains after at most one round per entity, and the order is ordinal order
 * throughout — the same fight resolves the same way whichever entity happens to be checked first.
 */
export function resolution(context: TickContext): void {
  const settled = new Set<number>()
  for (;;) {
    const dying = context.actors
      .filter((actor) => actor.pendingDead && !settled.has(actor.ordinal))
      .sort((a, b) => a.ordinal - b.ordinal)
    if (dying.length === 0) break
    for (const actor of dying) settled.add(actor.ordinal)
    resolveDeaths(context, dying)
  }
  const dead = context.actors.filter((actor) => actor.pendingDead)
  if (dead.length > 0) {
    context.actors = context.actors.filter((actor) => !actor.pendingDead)
  }
}

function detonate(context: TickContext, actor: Actor): void {
  const blast = actor.definition.detonation
  if (blast === undefined) return

  // `actorsWithin`, not the all-in-one `areaDamage`: this event has always announced the caught list
  // *before* the `damage.applied` events it causes, and reusing the geometry query without reusing
  // the apply-then-report order it comes bundled with is what keeps every existing detonation fixture's
  // event stream byte-identical to before this helper existed (shared.ts's own comment explains why).
  // `actor.definition.footprint`, not a bare point: a multi-tile detonator's blast reaches from its
  // nearest occupied tile, exactly as `distanceBetween` always measured it (shared.ts's own comment
  // has the regression this caught).
  const caught = actorsWithin(context, actor.anchor, actor.definition.footprint, blast.radius, actor)

  context.events.push({
    kind: "entity.detonated",
    tick: context.tick,
    entity: actor.id,
    ordinal: actor.ordinal,
    player: actor.player,
    contentId: actor.contentId,
    at: actor.anchor,
    radius: blast.radius,
    damage: blast.damage,
    caught: caught.map((other) => other.id),
  })

  for (const other of caught) {
    applyDamage(context, other, actor, blast.damage)
  }
}

function resolveDeaths(context: TickContext, dying: readonly Actor[]): void {
  for (const actor of dying) {
    const structure = actor.definition.layer === "obstacles"
    context.events.push(
      structure
        ? {
            kind: "structure.destroyed",
            tick: context.tick,
            entity: actor.id,
            ordinal: actor.ordinal,
            player: actor.player,
            contentId: actor.contentId,
            at: actor.anchor,
            killer: actor.killer,
          }
        : {
            kind: "entity.died",
            tick: context.tick,
            entity: actor.id,
            ordinal: actor.ordinal,
            player: actor.player,
            contentId: actor.contentId,
            at: actor.anchor,
            killer: actor.killer,
          },
    )
    if (actor.definition.salvage > 0) {
      context.groundItems.push({
        at: actor.anchor,
        amount: actor.definition.salvage,
        sourceId: actor.id,
        sourceContentId: actor.contentId,
      })
      context.events.push({
        kind: "salvage.dropped",
        tick: context.tick,
        at: actor.anchor,
        amount: actor.definition.salvage,
        source: actor.id,
        sourceContentId: actor.contentId,
      })
    }
    // Everything that was aiming at this entity loses its target now, while the dying actor's id
    // is still in hand — so the event names the entity rather than a bare ordinal, and the loss is
    // reported on the tick it actually happened.
    //
    // Observers come from the reverse index (engine.md 11.1) rather than a scan of every actor:
    // perception maintains `targetObservers` at every targetOrdinal write, so this is O(observers
    // of this one entity) instead of O(N) — the saving a chain detonation with several simultaneous
    // deaths actually collects. Sorted by ordinal because that is the order the old scan of
    // `context.actors` always produced, and the index's insertion order can drift from it as
    // targets change hands over a match; the sort is what keeps this loop's order — and so its
    // events — identical to before regardless of that history.
    const observers = [...(context.targetObservers.get(actor.ordinal) ?? [])].sort(
      (a, b) => a.ordinal - b.ordinal,
    )
    for (const observer of observers) {
      if (observer.targetOrdinal !== actor.ordinal) continue
      observer.targetOrdinal = null
      context.events.push({
        kind: "target.lost",
        tick: context.tick,
        entity: observer.id,
        ordinal: observer.ordinal,
        target: actor.id,
        targetOrdinal: actor.ordinal,
      })
    }
    context.targetObservers.delete(actor.ordinal)
    context.index.remove(
      actor.definition.layer,
      actor.ordinal,
      actor.anchor,
      actor.definition.footprint,
    )
    context.byOrdinal.delete(actor.ordinal)
    // The tile stays blocked for a couple of ticks — the settle rule the owner's playtest asked
    // for. Another unit stepping into a corpse's footprint the instant it clears reads as a glitch.
    context.vacated.add(
      actor.definition.layer,
      actor.anchor,
      actor.definition.footprint,
      context.tick + DEATH_SETTLE_TICKS,
    )
    // The golem rule shape: dying can multiply instead of only damaging. Before the blast, so a
    // reader of the event stream sees the entity die, then split, then (if it also detonates) take
    // its neighbours with it — birth before blast, the gentler of the two orders when both apply to
    // the same death.
    spawnOnDeath(context, actor)
    // The blast comes after the death is announced, so a reader of the event stream sees the entity
    // die and then take its neighbours with it, in that order.
    detonate(context, actor)
  }
}
