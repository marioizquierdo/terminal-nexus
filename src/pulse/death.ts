// 8. Death resolution — engine.md 4.3. Deaths, destruction, salvage — and detonations, which can
// cause more of all three.

import { footprintDistance } from "../grid/coords.ts"
import type { Actor, TickContext } from "./shared.ts"

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

  const caught = context.actors
    .filter((other) => other.ordinal !== actor.ordinal && !other.pendingDead)
    .filter(
      (other) =>
        footprintDistance(
          actor.anchor,
          actor.definition.footprint,
          other.anchor,
          other.definition.footprint,
        ) <= blast.radius,
    )
    .sort((a, b) => a.ordinal - b.ordinal)

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
    const hpBefore = other.hp
    const hpAfter = Math.max(0, hpBefore - blast.damage)
    other.hp = hpAfter
    context.events.push({
      kind: "damage.applied",
      tick: context.tick,
      entity: other.id,
      ordinal: other.ordinal,
      source: actor.id,
      sourceOrdinal: actor.ordinal,
      amount: hpBefore - hpAfter,
      hpBefore,
      hpAfter,
    })
    if (hpAfter <= 0 && !other.pendingDead) {
      other.pendingDead = true
      other.killer = actor.id
    }
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
    for (const observer of context.actors) {
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
    // The blast comes after the death is announced, so a reader of the event stream sees the entity
    // die and then take its neighbours with it, in that order.
    detonate(context, actor)
  }
}
