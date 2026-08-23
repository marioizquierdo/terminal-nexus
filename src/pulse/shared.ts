// Per-tick types and small helpers shared by more than one phase of the Pulse. Phase-specific types
// (Intent, Grant) live next to the phase that creates them; only what more than one file needs is
// here — engine.md 4.3 is the phase order these types and helpers serve.

import type { ContentDef } from "../content/types.ts"
import type { CollisionMask } from "../grid/occupancy.ts"
import { ClaimOverlay, OccupancyIndex, VacatedOverlay, maskFrom } from "../grid/occupancy.ts"
import type { BlockReason } from "../events/types.ts"
import type { Coord, Direction } from "../grid/types.ts"
import type { DomainEvent } from "../events/types.ts"
import { Pcg32 } from "../rng/pcg32.ts"
import type { GroundItem, PlayerId } from "../state/types.ts"
import type { PulseContext } from "./context.ts"

export type Actor = {
  ordinal: number
  id: string
  player: PlayerId
  contentId: string
  definition: ContentDef
  hp: number
  anchor: Coord
  facing: Direction
  moveCredit: number
  cooldown: number
  targetOrdinal: number | null
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
