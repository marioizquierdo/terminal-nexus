// 7. Attacks — engine.md 4.3. Damage is computed per speed tier and applied simultaneously within
// it, so no entity survives merely by being iterated first.

import { footprintDistance } from "../grid/coords.ts"
import { flightWindowTicks } from "./arbitration.ts"
import type { Actor, TickContext } from "./shared.ts"
import { speedTier } from "./shared.ts"

export function attacks(context: TickContext): void {
  for (const actor of context.actors) {
    if (actor.cooldown > 0) actor.cooldown -= 1
  }

  // Bucketed once, in `context.actors` order, so each tier below iterates only its own attackers
  // instead of re-scanning every actor — the same actors in the same relative order either way, so
  // this changes nothing about which attack is computed first within a tier.
  const byTier = new Map<number, Actor[]>()
  for (const actor of context.actors) {
    if (actor.definition.attack === undefined) continue
    const tier = speedTier(actor)
    const bucket = byTier.get(tier)
    if (bucket === undefined) byTier.set(tier, [actor])
    else bucket.push(actor)
  }
  const tiers = [...byTier.keys()].sort((a, b) => a - b)

  for (const tier of tiers) {
    // Every attack in a tier is computed against the state at tier start and applied
    // simultaneously, so no entity survives merely by being iterated first.
    const hpAtTierStart = new Map<number, number>()
    for (const actor of context.actors) hpAtTierStart.set(actor.ordinal, actor.hp)

    const damage = new Map<number, { total: number; source: Actor }>()
    for (const actor of byTier.get(tier) ?? []) {
      const attack = actor.definition.attack
      if (attack === undefined) continue
      if (actor.pendingDead || actor.cooldown > 0) continue
      // Stop, then attack: an actor that settled a move this tick waits for the next one.
      if (context.movedThisTick.has(actor.ordinal)) continue
      const target = actor.targetOrdinal === null ? null : context.byOrdinal.get(actor.targetOrdinal)
      if (target === undefined || target === null || target.pendingDead) continue
      const distance = footprintDistance(
        actor.anchor,
        actor.definition.footprint,
        target.anchor,
        target.definition.footprint,
      )
      if (distance > attack.range) continue

      actor.cooldown = attack.cooldownTicks
      context.events.push({
        kind: "attack.launched",
        tick: context.tick,
        attacker: actor.id,
        attackerOrdinal: actor.ordinal,
        target: target.id,
        targetOrdinal: target.ordinal,
        attackKind: attack.kind,
        damage: attack.damage,
        distance,
        flightWindowTicks:
          attack.kind === "ranged"
            ? flightWindowTicks(distance, attack.projectileTilesPerTick)
            : 0,
      })
      const existing = damage.get(target.ordinal)
      if (existing === undefined) {
        damage.set(target.ordinal, { total: attack.damage, source: actor })
      } else {
        existing.total += attack.damage
      }
    }

    const targets = [...damage.keys()].sort((a, b) => a - b)
    for (const ordinal of targets) {
      const entry = damage.get(ordinal)
      const target = context.byOrdinal.get(ordinal)
      if (entry === undefined || target === undefined) continue
      const hpBefore = hpAtTierStart.get(ordinal) ?? target.hp
      const hpAfter = Math.max(0, hpBefore - entry.total)
      target.hp = hpAfter
      context.events.push({
        kind: "damage.applied",
        tick: context.tick,
        entity: target.id,
        ordinal: target.ordinal,
        source: entry.source.id,
        sourceOrdinal: entry.source.ordinal,
        amount: hpBefore - hpAfter,
        hpBefore,
        hpAfter,
      })
      if (hpAfter <= 0 && !target.pendingDead) {
        target.pendingDead = true
        target.killer = entry.source.id
      }
    }
  }
}
