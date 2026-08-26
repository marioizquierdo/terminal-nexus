// 7. Attacks — engine.md 4.3. Damage is computed per speed tier and applied simultaneously within
// it, so no entity survives merely by being iterated first.
//
// Four additions from the unit-design-architecture spike, all resolved inside this same phase and
// bucketed by the same speed tiers as everything else here, because each is still "this actor acts,
// this tier, in initiative order" even though none of the four is a plain single-target hit: `windup`
// (a one-time hold before a first shot), `splash`/`heal` (what a landed hit does besides single-target
// damage), `focusRamp` (how much a landed hit does), and contact detonation (`detonation.
// triggerRange`) — the one of the four with no `attack` at all, bucketed by tier alongside the rest
// rather than swept into an end-of-function pass that would let it act after every tier already had.

import { actorsWithin, applyDamage, applyHeal, distanceBetween, resolveTarget, speedTier } from "./shared.ts"
import type { Actor, TickContext } from "./shared.ts"

type Tally = { total: number; source: Actor }
type SplashImpact = {
  anchor: Actor["anchor"]
  footprint: Actor["definition"]["footprint"]
  radius: number
  damage: number
  source: Actor
}

export function attacks(context: TickContext): void {
  for (const actor of context.actors) {
    if (actor.cooldown > 0) actor.cooldown -= 1
  }

  // Bucketed once, in `context.actors` order, so each tier below iterates only its own attackers
  // instead of re-scanning every actor — the same actors in the same relative order either way, so
  // this changes nothing about which attack is computed first within a tier. Contact-detonators get
  // their own bucketing the same way, and the two tier sets are merged below: a contact-detonator
  // carries no `attack`, so a tier that holds only detonators would otherwise never be visited at all.
  const byTier = new Map<number, Actor[]>()
  const detonatorsByTier = new Map<number, Actor[]>()
  for (const actor of context.actors) {
    if (actor.definition.attack !== undefined) {
      const tier = speedTier(actor)
      const bucket = byTier.get(tier)
      if (bucket === undefined) byTier.set(tier, [actor])
      else bucket.push(actor)
    }
    if (actor.definition.detonation?.triggerRange !== undefined) {
      const tier = speedTier(actor)
      const bucket = detonatorsByTier.get(tier)
      if (bucket === undefined) detonatorsByTier.set(tier, [actor])
      else bucket.push(actor)
    }
  }
  const tiers = [...new Set([...byTier.keys(), ...detonatorsByTier.keys()])].sort((a, b) => a - b)

  for (const tier of tiers) {
    // Every attack in a tier is computed against the state at tier start and applied
    // simultaneously, so no entity survives merely by being iterated first: this loop only ever
    // reads hp (via `damage`, below) and never writes it — every write happens together, in the
    // loops after every attacker in the tier has already been considered. `heals` and `splashes`
    // get the identical treatment for the identical reason, each in its own accumulator so a heal
    // and a splash landing on the same tile in the same tier never have to fight over one shape.
    const damage = new Map<number, Tally>()
    const heals = new Map<number, Tally>()
    const splashes: SplashImpact[] = []

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

      // Windup: a one-time hold before this actor's *first* shot at whatever it is currently
      // holding a lock on, spent only on a tick it would otherwise fire (never while marching, and
      // never more than once — see content/types.ts's `AttackDef.windupTicks` and
      // `freshEntityFields`). Everything below this point is "the shot actually fires."
      if (actor.windup > 0) {
        actor.windup -= 1
        continue
      }

      actor.cooldown = attack.cooldownTicks
      const baseAmount = attack.splash === undefined ? attack.damage : attack.splash.damage
      const ramp = attack.focusRamp
      const percent = ramp === undefined ? 100 : Math.min(ramp.maxPercent, 100 + actor.focusStreak * ramp.perHitPercent)
      const amount = ramp === undefined ? baseAmount : Math.round((baseAmount * percent) / 100)
      if (ramp !== undefined) actor.focusStreak += 1

      context.events.push({
        kind: "attack.launched",
        tick: context.tick,
        attacker: actor.id,
        attackerOrdinal: actor.ordinal,
        target: target.id,
        targetOrdinal: target.ordinal,
        attackKind: attack.kind,
        damage: amount,
        distance,
        flightWindowTicks:
          attack.kind === "ranged"
            ? flightWindowTicks(distance, attack.projectileTilesPerTick)
            : 0,
      })

      if (attack.kind === "heal") {
        const existing = heals.get(target.ordinal)
        if (existing === undefined) heals.set(target.ordinal, { total: amount, source: actor })
        else existing.total += amount
        continue
      }
      if (attack.splash !== undefined) {
        splashes.push({
          anchor: target.anchor,
          footprint: target.definition.footprint,
          radius: attack.splash.radius,
          damage: amount,
          source: actor,
        })
        continue
      }
      const existing = damage.get(target.ordinal)
      if (existing === undefined) {
        damage.set(target.ordinal, { total: amount, source: actor })
      } else {
        existing.total += amount
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

    // Splash: every impact this tier's own tally, summed the same way overlapping single-target fire
    // already is, so two shells landing on the same square apply as one combined hit rather than two
    // that could straddle a death differently depending on which is applied first. Each impact
    // excludes its own source, the same self-exclusion `detonate()` (death.ts) already applies to a
    // dying entity's own blast - found by actually running `bench-siegecrawler-windup.map.json`: a
    // target that closed inside the attacker's own splash radius before the shot landed (the whole
    // point of a target still approaching during windup) caught the shooter in its own blast, which
    // no earlier reasoning about "splash is smaller than range" had ruled out.
    const splashTally = new Map<number, Tally>()
    for (const impact of splashes) {
      for (const victim of actorsWithin(context, impact.anchor, impact.footprint, impact.radius, impact.source)) {
        const existing = splashTally.get(victim.ordinal)
        if (existing === undefined) splashTally.set(victim.ordinal, { total: impact.damage, source: impact.source })
        else existing.total += impact.damage
      }
    }
    const splashTargets = [...splashTally.keys()].sort((a, b) => a - b)
    for (const ordinal of splashTargets) {
      const entry = splashTally.get(ordinal)
      const target = context.byOrdinal.get(ordinal)
      if (entry === undefined || target === undefined) continue
      const killed = applyDamage(context, target, entry.source, entry.total)
      if (killed) entry.source.moveCredit = 0
    }

    // Heals last: applied after this tier's damage settles, so a target that is both hit and healed
    // in the same tier reflects "took the hit, then got mended" rather than the other order - a
    // documented choice (unit-design-architecture spike), not a free simplification, since the two
    // orders can disagree once either clamp (0 floor, maxHp ceiling) is actually reached.
    const healTargets = [...heals.keys()].sort((a, b) => a - b)
    for (const ordinal of healTargets) {
      const entry = heals.get(ordinal)
      const target = context.byOrdinal.get(ordinal)
      if (entry === undefined || target === undefined || target.pendingDead) continue
      applyHeal(context, target, entry.source, entry.total)
    }

    // Contact detonation, this tier's own detonators: the same initiative reasoning as everything
    // above, not a pass bolted on after every tier has already acted. `ContentDef.detonation.
    // triggerRange` is the baneling/suicide-bomber rule shape — these actors carry no `attack` at
    // all (they are not attacking, they are choosing to die), so they cannot live in the loop above.
    // Setting `pendingDead` is the whole effect: `resolution()` (death.ts, phase 8) picks it up
    // exactly like any other death and runs the entity's own `detonation` from there, so the blast
    // itself is not duplicated here.
    for (const actor of detonatorsByTier.get(tier) ?? []) {
      if (actor.pendingDead) continue
      const triggerRange = actor.definition.detonation?.triggerRange
      if (triggerRange === undefined) continue
      // Stop, then detonate: consistent with every other attack-phase action this tick.
      if (context.movedThisTick.has(actor.ordinal)) continue
      const target = resolveTarget(context, actor)
      if (target === null || target.pendingDead) continue
      if (distanceBetween(actor, target) > triggerRange) continue
      actor.pendingDead = true
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
