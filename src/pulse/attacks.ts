// 7. Attacks — engine.md 4.3. Damage is computed per speed tier and applied simultaneously within
// it, so no entity survives merely by being iterated first.

import type { Actor, TickContext } from "./shared.ts"
import { applyDamage, distanceBetween, resolveTarget, speedTier } from "./shared.ts"

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
    // simultaneously, so no entity survives merely by being iterated first: this loop only ever
    // reads hp (via `damage`, below) and never writes it — every write happens together, in the
    // second loop, after every attacker in the tier has already been considered.
    const damage = new Map<number, { total: number; source: Actor }>()
    for (const actor of byTier.get(tier) ?? []) {
      const attack = actor.definition.attack
      if (attack === undefined) continue
      if (actor.pendingDead || actor.cooldown > 0) continue
      // Stop, then attack: an actor that settled a move this tick waits for the next one.
      if (context.movedThisTick.has(actor.ordinal)) continue
      const target = resolveTarget(context, actor)
      if (target === null || target.pendingDead) continue
      const distance = distanceBetween(actor, target)
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
      const killed = applyDamage(context, target, entry.source, entry.total)
      if (killed) {
        // A killer holds for one full movement cadence before it may step again - owner playtest,
        // 2026-08-22: "when a unit kills an enemy, it should wait a full movement cooldown before
        // starting to move again. Otherwise... it is hard to see who won that fight." Zeroing credit
        // is the same mechanism `accrueCredit` already uses for a step actually taken (movement.ts):
        // the killer needs `stepCost` ticks worth of credit again before its next move, exactly as
        // if it had spent this tick moving rather than attacking. `intents()` (phase 4) has already
        // run for this tick by the time `attacks()` (phase 7) gets here, so the earliest this can
        // affect is next tick's movement - this tick's own step, if the killer took one, is untouched.
        entry.source.moveCredit = 0
      }
    }
  }
}

/**
 * `ceil(distance / tilesPerTick)`, minimum 1 for any real speed, 0 for an attack with no travel
 * speed at all (melee, or a ranged attack that never declared one). Presentation metadata on the
 * `attack.launched` event — engine.md 4.3 — read by no rule; `tests/rules.test.ts` proves changing
 * it moves no state.
 */
export function flightWindowTicks(distance: number, tilesPerTick: number | undefined): number {
  if (tilesPerTick === undefined || tilesPerTick <= 0) return 0
  return Math.max(1, Math.ceil(distance / tilesPerTick))
}
