// Burning ground (pulse.md, the attacks and the tick order): a patch with a place, a size and a lifetime, kept in the
// state (`MatchState.burning`), lit by a landing hit of an attack that `burn`s (`attacks.ts`) and hurting by the
// kernel's own clock, here, after the attacks and the abilities' ticks and before the deaths settle. The owner,
// 2026-10-21, on the Citizen mortar: "set the ground on fire ... when the units walk through it, they all take damage".
//
// Every unit and worker within a patch's radius of its centre, measured as range is, of either side, takes its damage
// on each of its ticks — a whole number of `everyTicks` after it was lit, until `untilTick` — never a flyer, never a
// building. Every patch's victims are added up and the damage applied at once, in ordinal order, as a splash's are, so
// two patches that overlap are one hit and neither is applied first. A kill is the shooter's, named by its id whether
// it still stands or not; a kill by fire is no blow, so it gives no killer's pause. Routes weigh the ground while it
// burns (`TickRoutes.weightsOf`); Recall puts it out (`src/match/recall.ts`).

import type { Coord, EntityLayer } from "../grid/types.ts"
import { footprintWithin } from "../grid/coords.ts"
import type { Burn } from "../content/types.ts"
import type { BurningGround } from "../state/types.ts"
import type { Actor, DamageSource, TickContext } from "./shared.ts"
import { actorsWithin, applyDamage } from "./shared.ts"

/** A single tile, as a footprint: what a patch is measured from. */
const POINT: readonly Coord[] = [{ x: 0, y: 0 }]

/** What burning ground hurts: what stands on the ground and moves. */
const BURNS: readonly EntityLayer[] = ["units", "workers"]

/** Whether burning ground hurts what stands on `layer`. */
export function burnsOn(layer: EntityLayer): boolean {
  return BURNS.includes(layer)
}

/** Lights `burn` round `centre` for `shooter`, which hit `target` this tick, and says so (`ground.lit`). */
export function light(context: TickContext, shooter: Actor, target: Actor, centre: Coord, burn: Burn): void {
  const patch: BurningGround = {
    centre,
    radius: burn.radius,
    damage: burn.damage,
    everyTicks: burn.everyTicks,
    startedTick: context.tick,
    untilTick: context.tick + burn.ticks,
    player: shooter.player,
    source: shooter.id,
    sourceOrdinal: shooter.ordinal,
  }
  context.burning.push(patch)
  context.events.push({
    kind: "ground.lit",
    tick: context.tick,
    centre,
    radius: patch.radius,
    damage: patch.damage,
    everyTicks: patch.everyTicks,
    untilTick: patch.untilTick,
    player: patch.player,
    source: patch.source,
    sourceOrdinal: patch.sourceOrdinal,
    target: target.id,
    targetOrdinal: target.ordinal,
  })
}

/** Whether `patch` burns on `tick`: after the tick it was lit, a whole number of its beats on, until its time is up. */
export function burnsAt(patch: BurningGround, tick: number): boolean {
  return tick > patch.startedTick && tick <= patch.untilTick && (tick - patch.startedTick) % patch.everyTicks === 0
}

/** Whether `tile` is on `patch`, measured as range is from its centre. */
export function onPatch(patch: BurningGround, tile: Coord): boolean {
  return footprintWithin(patch.centre, POINT, tile, POINT, patch.radius)
}

/** The tick's fire: every patch that burns now hurts what stands on it, at once; then the patches whose time is up go
 *  out. Patches are kept in the order they were lit, then by their shooter's ordinal. */
export function burning(context: TickContext): void {
  if (context.burning.length === 0) return
  const tally = new Map<number, { total: number; source: DamageSource }>()
  for (const patch of context.burning) {
    if (!burnsAt(patch, context.tick)) continue
    const caught = actorsWithin(context, patch.centre, POINT, patch.radius).filter((actor) => burnsOn(actor.definition.layer))
    context.events.push({
      kind: "ground.burned",
      tick: context.tick,
      centre: patch.centre,
      radius: patch.radius,
      damage: patch.damage,
      player: patch.player,
      source: patch.source,
      sourceOrdinal: patch.sourceOrdinal,
      caught: caught.map((actor) => actor.id),
    })
    for (const victim of caught) {
      const existing = tally.get(victim.ordinal)
      if (existing === undefined) tally.set(victim.ordinal, { total: patch.damage, source: sourceOf(context, patch) })
      else existing.total += patch.damage
    }
  }
  for (const ordinal of [...tally.keys()].sort((a, b) => a - b)) {
    const entry = tally.get(ordinal)
    const victim = context.byOrdinal.get(ordinal)
    if (entry === undefined || victim === undefined || victim.pendingDead) continue
    applyDamage(context, victim, entry.source, entry.total, { boosted: false })
  }
  const still: BurningGround[] = []
  for (const patch of context.burning) {
    if (patch.untilTick > context.tick) {
      still.push(patch)
      continue
    }
    context.events.push({
      kind: "ground.out",
      tick: context.tick,
      centre: patch.centre,
      radius: patch.radius,
      player: patch.player,
      source: patch.source,
      sourceOrdinal: patch.sourceOrdinal,
      startedTick: patch.startedTick,
    })
  }
  // Stable: patches lit on one tick keep their shooters' order, whatever tier each fired in.
  still.sort((a, b) => a.startedTick - b.startedTick || a.sourceOrdinal - b.sourceOrdinal)
  context.burning = still
}

/** Who a patch's hits are from: its shooter while it stands, else its shooter by id. */
function sourceOf(context: TickContext, patch: BurningGround): DamageSource {
  const shooter = context.byOrdinal.get(patch.sourceOrdinal)
  return shooter !== undefined && shooter.id === patch.source ? shooter : { id: patch.source, ordinal: patch.sourceOrdinal }
}
