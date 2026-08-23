// Turning a resolved Pulse into effect instances.
//
// Effects subscribe to **semantic cues** — the ordered event stream — and take their coordinates
// from the state the kernel settled. That split is deliberate: an event says *what happened and to
// whom*, and presentation is entitled to know where everything stood, but a recipe must never have
// to reverse-engineer a mechanic out of a cell (engine.md Section 7).
//
// Nothing here can change an outcome. It runs after the Pulse is resolved, it reads, and it emits
// instances; deleting this file would leave the fight identical and the screen bare.

import type { ContentRegistry } from "../../content/index.ts"
import type { DomainEvent } from "../../events/types.ts"
import { footprintExtent } from "../../grid/coords.ts"
import type { Coord } from "../../grid/types.ts"
import type { MatchState } from "../../state/types.ts"
import type { EffectFamily, EffectInstance } from "./types.ts"

/** Beat timings from ascii-effects.md Section 2. Anything under about 60 ms did not happen. */
const TRAIL_MS = 120
const MELEE_WIND_MS = 100
const MELEE_CLASH_MS = 140
const TELEGRAPH_MS = 80
const BURST_MS = 180
const FLASH_MS = 66
const DEATH_MS = 320
const STRUCTURE_MS = 600
const BLAST_MS = 380
/**
 * A cascade resolves in one tick, and drawn that way it is one frame of noise. Each detonation in
 * the same tick is held back a little longer than the last, so the chain *ripples* — which is the
 * story the rule is telling, and the reason a Ravel player tells it afterwards. Presentation may
 * lie about timing; it may not lie about what happened.
 */
const CASCADE_STAGGER_MS = 55
const CASCADE_STAGGER_CAP = 6
const NEXUS_PERIOD_MS = 1200

/** Below this fraction of its health a Grid Nexus is critical, and says so until it stops. */
const NEXUS_CRITICAL = 0.35

export type EffectSource = Readonly<{
  states: readonly MatchState[]
  events: readonly DomainEvent[]
  registry: ContentRegistry
  ticksPerSecond: number
}>

function familyFor(contentId: string): EffectFamily {
  if (contentId.includes(".citizen.")) return "citizen"
  if (contentId.includes(".ravel.")) return "ravel"
  return "neutral"
}

/**
 * Which tick's shots are still "in flight" toward a given target, and for how many more ticks -
 * shared by every consumer that has to hold something until a ranged hit visibly lands, not just
 * the effect system. The kernel resolves a ranged kill in the same tick it launches the shot -
 * `attack.launched`, `damage.applied`, `entity.died` and any `entity.detonated` it triggers all
 * carry the identical `tick` (engine.md 4.3's flight window is presentation metadata; no rule reads
 * it) - so without this, a unit's death collapse (and the unit's own glyph disappearing) fired the
 * instant the shot left the barrel, ticks before its own tracer visibly arrived. The owner
 * playtest's own words for the fix that already exists on `damage.applied` apply everywhere else
 * the same gap can hide: "look for more opportunities to do that, specially when the effect is
 * resolved within the same turn so it doesn't really affect the gameplay." Nothing about outcome
 * moves; only when an ending is allowed to play catches up to when the blow that caused it lands.
 */
export function buildFlightHoldTicks(events: readonly DomainEvent[]): ReadonlyMap<string, number> {
  const holds = new Map<string, number>()
  for (const event of events) {
    if (event.kind !== "attack.launched" || event.attackKind !== "ranged") continue
    const key = `${event.tick}:${event.targetOrdinal}`
    holds.set(key, Math.max(holds.get(key) ?? 0, event.flightWindowTicks))
  }
  return holds
}

export function flightHoldTicks(
  holds: ReadonlyMap<string, number>,
  tick: number,
  ordinal: number,
): number {
  return holds.get(`${tick}:${ordinal}`) ?? 0
}

export function deriveEffects(source: EffectSource): EffectInstance[] {
  const tickMs = 1000 / source.ticksPerSecond
  const at = (tick: number): number => tick * tickMs
  const instances: EffectInstance[] = []

  // Where everything stood, per tick, so a cue can be given coordinates.
  const anchors = new Map<number, Map<number, Coord>>()
  const contentOf = new Map<number, string>()
  source.states.forEach((state) => {
    const byOrdinal = new Map<number, Coord>()
    for (const entity of state.entities) {
      byOrdinal.set(entity.ordinal, entity.anchor)
      contentOf.set(entity.ordinal, entity.contentId)
    }
    anchors.set(state.tick, byOrdinal)
  })
  const anchorAt = (tick: number, ordinal: number): Coord | undefined => {
    for (let look = tick; look >= 0 && look >= tick - 2; look -= 1) {
      const found = anchors.get(look)?.get(ordinal)
      if (found !== undefined) return found
    }
    return undefined
  }

  // A ranged hit lands when its tracer does: the renderer holds the impact, the flash and the
  // visible health change until the end of the flight window (engine.md 4.3).
  const flightByTarget = buildFlightHoldTicks(source.events)
  const heldMsFor = (tick: number, ordinal: number): number =>
    flightHoldTicks(flightByTarget, tick, ordinal) * tickMs

  const criticalSince = new Map<number, number>()
  const blastsThisTick = new Map<number, number>()

  for (const event of source.events) {
    switch (event.kind) {
      case "entity.moved": {
        // The trail starts when the glyph starts moving, which is half a tick before it lands.
        instances.push({
          recipe: "fx.move.trail",
          band: "effects",
          startMs: at(event.tick - 0.5),
          durationMs: TRAIL_MS,
          origin: event.from,
          target: event.to,
          family: familyFor(contentOf.get(event.ordinal) ?? ""),
          params: {},
        })
        break
      }

      case "attack.launched": {
        const attacker = anchorAt(event.tick, event.attackerOrdinal)
        const target = anchorAt(event.tick, event.targetOrdinal)
        if (attacker === undefined || target === undefined) break
        const family = familyFor(contentOf.get(event.attackerOrdinal) ?? "")
        if (event.attackKind === "melee") {
          instances.push({
            recipe: "fx.melee.wind",
            band: "effects",
            startMs: at(event.tick) - MELEE_WIND_MS,
            durationMs: MELEE_WIND_MS,
            origin: attacker,
            target,
            family,
            params: {},
          })
          instances.push({
            recipe: "fx.melee.clash",
            band: "effects",
            startMs: at(event.tick),
            durationMs: MELEE_CLASH_MS,
            origin: attacker,
            target,
            family,
            params: {},
          })
          break
        }
        instances.push({
          recipe: "fx.ranged.telegraph",
          band: "effects",
          startMs: at(event.tick) - TELEGRAPH_MS,
          durationMs: TELEGRAPH_MS,
          origin: attacker,
          target,
          family,
          params: {},
        })
        instances.push({
          recipe: "fx.ranged.tracer",
          band: "projectiles",
          startMs: at(event.tick),
          durationMs: Math.max(1, event.flightWindowTicks) * tickMs,
          origin: attacker,
          target,
          family,
          params: { distance: event.distance },
        })
        break
      }

      case "damage.applied": {
        const hit = anchorAt(event.tick, event.ordinal)
        const from = anchorAt(event.tick, event.sourceOrdinal)
        if (hit === undefined) break
        const held = (flightByTarget.get(`${event.tick}:${event.ordinal}`) ?? 0) * tickMs
        const impactMs = at(event.tick) + held
        const family = familyFor(contentOf.get(event.sourceOrdinal) ?? "")
        instances.push({
          recipe: "fx.impact.burst",
          band: "effects",
          startMs: impactMs,
          durationMs: BURST_MS,
          origin: hit,
          ...(from === undefined ? {} : { target: from }),
          family,
          params: { amount: event.amount },
        })
        instances.push({
          recipe: "fx.damage.flash",
          band: "highlights",
          startMs: impactMs,
          durationMs: FLASH_MS,
          origin: hit,
          family,
          params: {},
        })

        // A Grid Nexus that drops below the threshold starts saying so, and keeps saying it.
        const contentId = contentOf.get(event.ordinal)
        if (contentId !== undefined && source.registry.get(contentId).nexus === true) {
          const definition = source.registry.get(contentId)
          const critical = event.hpAfter / definition.maxHp < NEXUS_CRITICAL
          if (critical && !criticalSince.has(event.ordinal)) {
            criticalSince.set(event.ordinal, event.tick)
          }
        }
        break
      }

      case "entity.died": {
        const definition = source.registry.get(event.contentId)
        instances.push({
          recipe: "fx.death.collapse",
          band: "effects",
          startMs: at(event.tick) + heldMsFor(event.tick, event.ordinal),
          durationMs: DEATH_MS,
          origin: event.at,
          family: familyFor(event.contentId),
          params: {
            ...footprintExtent(definition.footprint),
          },
        })
        break
      }

      case "structure.destroyed": {
        const definition = source.registry.get(event.contentId)
        instances.push({
          recipe: "fx.structure.collapse",
          band: "effects",
          startMs: at(event.tick) + heldMsFor(event.tick, event.ordinal),
          durationMs: STRUCTURE_MS,
          origin: event.at,
          family: familyFor(event.contentId),
          params: {
            ...footprintExtent(definition.footprint),
          },
        })
        break
      }

      case "entity.detonated": {
        const order = Math.min(CASCADE_STAGGER_CAP, blastsThisTick.get(event.tick) ?? 0)
        blastsThisTick.set(event.tick, (blastsThisTick.get(event.tick) ?? 0) + 1)
        instances.push({
          recipe: "fx.blast.detonation",
          band: "effects",
          startMs: at(event.tick) + heldMsFor(event.tick, event.ordinal) + order * CASCADE_STAGGER_MS,
          durationMs: BLAST_MS,
          origin: event.at,
          family: familyFor(event.contentId),
          params: { radius: event.radius, damage: event.damage },
        })
        break
      }

      default:
        break
    }
  }

  // Sustained Nexus warnings, from the tick they crossed the threshold until they stopped existing.
  const lastTick = source.states[source.states.length - 1]?.tick ?? 0
  for (const [ordinal, since] of criticalSince) {
    const contentId = contentOf.get(ordinal)
    if (contentId === undefined) continue
    const definition = source.registry.get(contentId)
    const endTick =
      source.events.find(
        (event) =>
          (event.kind === "structure.destroyed" || event.kind === "entity.died") &&
          event.ordinal === ordinal,
      )?.tick ?? lastTick
    const anchor = anchorAt(since, ordinal)
    if (anchor === undefined || endTick <= since) continue
    instances.push({
      recipe: "fx.nexus.critical",
      band: "effects",
      startMs: at(since),
      durationMs: at(endTick) - at(since),
      origin: anchor,
      family: familyFor(contentId),
      params: {
        ...footprintExtent(definition.footprint),
        periodMs: NEXUS_PERIOD_MS,
      },
    })
  }

  return instances.sort((a, b) => a.startMs - b.startMs || a.recipe.localeCompare(b.recipe))
}

