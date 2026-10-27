// New entities, created mid-Pulse rather than only at scenario load — the spawner and golem rule
// shapes (from the unit-architecture spike). It is not one of the Pulse's nine phases, which are
// unchanged (pulse.md); it runs as an explicit "1.5" ahead of them, in tick.ts, so anything
// created this tick is a full participant in every phase after it — perceived, able to move or fire,
// and counted for victory — exactly as if it had stood since tick 0).
//
// Two triggers, one construction primitive: `spawning()` below (periodic, `ContentDef.spawn`) and
// `spawnOnDeath()` (`death.ts` calls it for `ContentDef.splitOnDeath`) both create entities the same
// way, through `spawnOneNear`. A second real use is exactly what pulled that primitive out on its own
// rather than writing "find a free adjacent tile and build an Actor" twice. Where it sets a unit down, and the
// order spawners act in, go by what they face, never by reading order (pulse.md, "No side wins by where it stands").
//
// This is a **combat ability**, not production: a building's recipe is `production.ts`, which runs in
// the production phase and borrows `spawnOneNear` to set its units down. Whether a unit that spawns
// units counts as a combat ability or as production is still an open question for Mario (Q26 in
// docs/milestones/open-questions.md), to be answered before a real roster relies on it.

import type { ContentDef } from "../content/types.ts"
import { rectFootprint } from "../content/types.ts"
import { footprintBox, footprintDistance, footprintExtent, footprintRing, tilesOf } from "../grid/coords.ts"
import { maskFrom } from "../grid/occupancy.ts"
import type { Coord } from "../grid/types.ts"
import { freshEntityFields } from "../content/index.ts"
import { contentOf } from "./context.ts"
import type { Actor, TickContext } from "./shared.ts"
import { distanceBetween, drawAmong, ownSideLayers } from "./shared.ts"
import { followsTarget } from "./target.ts"

/**
 * Sets one new entity of `contentId` down for `origin`'s player: a building's on its own roof (`onItsRoof`), a unit's
 * on a free tile touching it (`roundIt`), either fitting its body under its own collision rule; of those, **the one
 * nearest where it is headed** —
 * its side's target when it follows one, else the enemy's Nexus, else the nearest enemy — so a building's units come out
 * on the side facing the fight, east or west alike, and a tie between equally near tiles is a draw (`drawAmong`). With nowhere to head,
 * the first free tile of the ring. The new entity is wired
 * into `context.actors`/`byOrdinal`/`index` and given an `entity.spawned` event exactly as if the scenario loader had
 * placed it. A unit a building trains (`trainedBy`, `production.ts`) remembers that building and the anchor it was set
 * down on (`EntityState.home`, `homeAt`), which the rounds after remember (the walk home that read it is gone). Returns it, or `null` if nothing adjacent fits this attempt — a boxed-in spawner simply tries again next
 * interval (`spawning()`), a building owes the rest of its wave until the first tick there is room
 * (`production()`), and a dying unit does not split further (`spawnOnDeath()`), rather than searching further
 * afield or erroring.
 */
export function spawnOneNear(
  context: TickContext,
  origin: Actor,
  contentId: string,
  trainedBy?: string,
): Actor | null {
  // The child is its side's: a side whose content a Nexus power changed spawns the changed unit.
  const registry = contentOf(context.pulse, origin.player)
  if (!registry.has(contentId)) return null
  const childDef = registry.get(contentId)
  const free = origin.definition.layer === "obstacles" && childDef.layer !== "air" ? onItsRoof(context, origin, childDef) : roundIt(context, origin, childDef)
  const toward = nearestHeading(context, origin, childDef, free)
  // With nowhere to head there is no side to favour: the ring's own order, so a wave still stands together.
  const anchor = toward === null ? free[0] : drawAmong(context, toward)
  if (anchor !== undefined) {
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
      // A unit a building trained remembers it, and the tile it came out on.
      ...(trainedBy === undefined ? {} : { home: origin.ordinal, homeAt: anchor }),
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
      ...(trainedBy === undefined ? {} : { trainedBy }),
    })
    return actor
  }
  return null
}

/**
 * Where a building may set a new `child` down: **on its own roof** (pulse.md, units walk out over the roofs) — every
 * anchor from which the child's body covers some of the building, on its side's roofs or open ground, never on a unit,
 * an enemy's building or rock; those that put all of it on the building first, so a wave stands on its roof while it
 * has room, and one wider than the building still comes out over it. Never two on one tile: a wave with no room left
 * waits for the ones before it to walk off.
 */
function onItsRoof(context: TickContext, building: Actor, child: ContentDef): Coord[] {
  const mask = maskFrom(context.index, {
    terrain: "impassable",
    vacated: context.vacated,
    ...ownSideLayers(context, child, building.player, true),
  })
  const roof = new Set(tilesOf(building.anchor, building.definition.footprint).map((tile) => `${tile.x},${tile.y}`))
  const own = footprintBox(building.anchor, building.definition.footprint)
  const body = footprintBox({ x: 0, y: 0 }, child.footprint)
  const whole: Coord[] = []
  const part: Coord[] = []
  for (let y = own.top - body.bottom; y <= own.bottom - body.top; y += 1) {
    for (let x = own.left - body.right; x <= own.right - body.left; x += 1) {
      const anchor = { x, y }
      const on = tilesOf(anchor, child.footprint).filter((tile) => roof.has(`${tile.x},${tile.y}`)).length
      if (on === 0 || !mask.footprintFits(anchor, child.footprint)) continue
      ;(on === child.footprint.length ? whole : part).push(anchor)
    }
  }
  return whole.length > 0 ? whole : part
}

/** Where a unit that makes units, or one that splits as it dies, sets a new `child` down: a free tile touching it
 *  (`footprintRing`) that fits the child's body under its own collision rule. */
function roundIt(context: TickContext, origin: Actor, child: ContentDef): Coord[] {
  const { width, height } = footprintExtent(origin.definition.footprint)
  const mask = maskFrom(context.index, {
    // Air ignores terrain entirely, same rule `maskForActor` already applies to a mover's own mask.
    terrain: child.layer === "air" ? "ignore" : "impassable",
    vacated: context.vacated,
    // Never on an enemy's worker or trooper, though on its own side's (`ownSideLayers`).
    ...ownSideLayers(context, child, origin.player, false),
  })
  return footprintRing(width, height, 1)
    .map((offset) => ({ x: origin.anchor.x + offset.x, y: origin.anchor.y + offset.y }))
    .filter((anchor) => mask.footprintFits(anchor, child.footprint))
}

/**
 * `actors` front first: nearest the enemy as the tick began, and among equally near ones in an order drawn from the
 * seeded stream. The order buildings set their units down in, so of two neighbours sharing free ground the one further
 * forward claims first, on either side of the map — and of two as far forward, neither by its id, which the opening
 * hands out west first.
 */
export function frontFirst(context: TickContext, actors: readonly Actor[]): Actor[] {
  const front = new Map<number, number>()
  for (const actor of actors) {
    let nearest = Number.POSITIVE_INFINITY
    for (const other of context.actors) {
      if (other.player === actor.player || other.pendingDead || other.ordinal >= context.bornFrom) continue
      nearest = Math.min(nearest, distanceBetween(actor, other))
    }
    front.set(actor.ordinal, nearest)
  }
  const sorted = [...actors].sort((a, b) => (front.get(a.ordinal) as number) - (front.get(b.ordinal) as number) || a.ordinal - b.ordinal)
  const ordered: Actor[] = []
  for (let start = 0; start < sorted.length; ) {
    let end = start + 1
    while (end < sorted.length && front.get((sorted[end] as Actor).ordinal) === front.get((sorted[start] as Actor).ordinal)) end += 1
    const tied = sorted.slice(start, end)
    while (tied.length > 0) {
      const next = drawAmong(context, tied) as Actor
      ordered.push(next)
      tied.splice(tied.indexOf(next), 1)
    }
    start = end
  }
  return ordered
}

/**
 * The tiles of `free` nearest where a new `child` of `origin`'s side is headed: its side's target when it follows one
 * (`followsTarget`), else the enemy's Grid Nexus when it would head there, else the nearest enemy as the tick began, measured footprint to footprint (`footprintDistance`).
 * `null` when there is nowhere to head: no target and no enemy.
 */
function nearestHeading(context: TickContext, origin: Actor, child: ContentDef, free: readonly Coord[]): Coord[] | null {
  const area = followsTarget(child) ? context.targets[origin.player] : undefined
  const all = area !== undefined ? [] : context.actors.filter((other) => other.player !== origin.player && !other.pendingDead && other.ordinal < context.bornFrom)
  // A fighting unit with no target heads for the enemy's Grid Nexus (`headsForNexus`, perception.ts).
  const nexus = followsTarget(child) ? all.filter((other) => other.definition.nexus === true) : []
  const enemies = nexus.length > 0 ? nexus : all
  if (area === undefined && enemies.length === 0) return null
  const away = (anchor: Coord): number =>
    area !== undefined
      ? footprintDistance(anchor, child.footprint, { x: area.x, y: area.y }, rectFootprint(area.width, area.height))
      : Math.min(...enemies.map((other) => footprintDistance(anchor, child.footprint, other.anchor, other.definition.footprint)))
  const scored = free.map((anchor) => ({ anchor, distance: away(anchor) }))
  const best = Math.min(...scored.map((entry) => entry.distance))
  return scored.filter((entry) => entry.distance === best).map((entry) => entry.anchor)
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
  const spawners = frontFirst(
    context,
    context.actors.filter((actor) => actor.definition.spawn !== undefined && !actor.pendingDead),
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
