// New entities, created mid-Pulse rather than only at scenario load — the spawner and golem rule
// shapes (unit-design-architecture spike, not an engine.md phase: the canonical nine phases
// (engine.md 4.3) are unchanged; this runs as an explicit "1.5" ahead of them, in tick.ts, so anything
// created this tick is a full participant in every phase after it — perceived, able to move or fire,
// and counted for victory — exactly as if it had stood since tick 0).
//
// Two triggers, one construction primitive: `spawning()` below (periodic, `ContentDef.spawn`) and
// `spawnOnDeath()` (`death.ts` calls it for `ContentDef.splitOnDeath`) both create entities the same
// way, through `spawnOneNear`. A second real use is exactly what pulled that primitive out on its own
// rather than writing "find a free adjacent tile and build an Actor" twice.
//
// This is a **combat ability**, not production: no cost, no resource, nothing the empty
// `economyAndProduction` phase (tick.ts) would recognise as its own — `specs/open-questions.md` Q26
// registers the scope line this still has to answer before a real roster could rely on it.

import { footprintExtent, footprintRing } from "../grid/coords.ts"
import { maskFrom } from "../grid/occupancy.ts"
import { freshEntityFields } from "../content/index.ts"
import type { Actor, TickContext } from "./shared.ts"

/**
 * Finds the first free tile adjacent to `origin`'s own footprint — a fixed, deterministic search
 * order (`footprintRing`, no RNG, no clock) — that fits `contentId`'s footprint under its own
 * collision rule, and creates one new entity there for `origin`'s player: wired into
 * `context.actors`/`byOrdinal`/`index` and given an `entity.spawned` event exactly as if the scenario
 * loader had placed it. Returns the new actor, or `null` if nothing adjacent fits this attempt — a
 * boxed-in spawner simply tries again next interval (`spawning()`) or does not split further
 * (`spawnOnDeath()`), rather than searching further afield or erroring.
 */
function spawnOneNear(context: TickContext, origin: Actor, contentId: string): Actor | null {
  const registry = context.pulse.registry
  if (!registry.has(contentId)) return null
  const childDef = registry.get(contentId)
  const { width, height } = footprintExtent(origin.definition.footprint)
  const mask = maskFrom(context.index, {
    layers: childDef.collidesWith,
    // Air ignores terrain entirely, same rule `maskForActor` already applies to a mover's own mask.
    terrain: childDef.layer === "air" ? "ignore" : "impassable",
    vacated: context.vacated,
  })

  for (const offset of footprintRing(width, height, 1)) {
    const anchor = { x: origin.anchor.x + offset.x, y: origin.anchor.y + offset.y }
    if (!mask.footprintFits(anchor, childDef.footprint)) continue

    const ordinal = context.nextOrdinal
    context.nextOrdinal += 1
    const id = `${origin.player}:${childDef.short}#${ordinal + 1}`
    const actor: Actor = {
      ordinal,
      id,
      player: origin.player,
      contentId: childDef.id,
      hp: childDef.maxHp,
      anchor,
      // Same convention the loader uses for a fresh entity with no fight yet to derive a facing from.
      facing: origin.player === "A" ? "e" : "w",
      ...freshEntityFields(childDef),
      definition: childDef,
      pendingDead: false,
      killer: null,
    }
    context.actors.push(actor)
    context.byOrdinal.set(ordinal, actor)
    context.index.add(childDef.layer, ordinal, anchor, childDef.footprint)
    context.events.push({
      kind: "entity.spawned",
      tick: context.tick,
      entity: id,
      ordinal,
      player: origin.player,
      contentId: childDef.id,
      at: anchor,
      hp: childDef.maxHp,
    })
    return actor
  }
  return null
}

/**
 * Phase "1.5": every living entity with `ContentDef.spawn` attempts it. The cadence mirrors
 * `attacks()`'s own cooldown pattern exactly (decrement first, then gate on the post-decrement value,
 * then reset to the full interval on a completed attempt) so the two per-actor timers behave
 * identically even though one counts down to a shot and the other to a birth.
 *
 * Snapshotting `context.actors` before the loop, rather than iterating the live array, is what keeps
 * a freshly-spawned entity from being reconsidered as its own spawner in the same pass: this tick's
 * newborns still join every phase after this one, just not a second spawn attempt within it.
 */
export function spawning(context: TickContext): void {
  const spawners = context.actors.filter(
    (actor) => actor.definition.spawn !== undefined && !actor.pendingDead,
  )
  for (const actor of spawners) {
    if (actor.spawnCooldown > 0) actor.spawnCooldown -= 1
  }
  for (const actor of spawners) {
    const spawn = actor.definition.spawn
    if (spawn === undefined || actor.spawnCooldown > 0) continue
    const alive = context.actors.filter(
      (other) => other.player === actor.player && other.contentId === spawn.contentId,
    ).length
    if (alive < spawn.maxAlive) spawnOneNear(context, actor, spawn.contentId)
    actor.spawnCooldown = spawn.intervalTicks
  }
}

/**
 * `ContentDef.splitOnDeath` — called from `death.ts`'s `resolveDeaths`, once per dying actor, before
 * its own `detonation` (if any) goes off. `count` independent searches rather than one search
 * reserving `count` tiles at once: each call sees the previous child already committed to the index,
 * so two children never contest the same tile, deterministically, the same way two spawners acting in
 * the same tick already do not (`spawning()` above).
 */
export function spawnOnDeath(context: TickContext, actor: Actor): void {
  const split = actor.definition.splitOnDeath
  if (split === undefined) return
  for (let index = 0; index < split.count; index += 1) {
    spawnOneNear(context, actor, split.contentId)
  }
}
