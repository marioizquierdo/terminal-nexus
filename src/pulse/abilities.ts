// The kernel's half of abilities (`src/abilities/`): where in a tick each hook runs, and the world it is handed.
//
// - **`decideDamageModifiers`**, as the attacks begin (`attacks.ts`), once the moves have settled: every bearer's
//   `damageModifiers` offers units a share of their damage, and each unit keeps the strongest of each channel — the
//   largest share dealt, the smallest taken, the first bearer in ordinal order on a tie. Held for the whole tick's
//   damage, a blast's included (`TickContext.guards`, `boosts`).
// - **`hitDealtBy`**, as each attack is made (`attacks.ts`): the attacker's own `hitDealt` hooks, before the tier's
//   hits are added up and before any aura — never on a blast or a splash's spread.
// - **`abilityTicks`**, once a tick after the attacks and before the deaths settle (`tick.ts`): every standing bearer's
//   `tick` hook — a healing pulse, a slow burn — whose hits join the tick's deaths like any other.
// - **`afterDeaths`**, once a tick's deaths are settled (`death.ts`): every standing bearer's `death` hook, once for
//   each unit that died, in ordinal order of the bearers and then of the dead.
//
// Bearers are visited in ordinal order and each one's abilities in the order its content lists them, so nothing an
// ability does depends on iteration order the kernel does not already fix. A unit's abilities are looked up in the
// battle's table (`PulseContext.abilities`, the game's own when it gives none).

import type { AbilityKind, AbilityTable, AbilityWorld, Body } from "../abilities/index.ts"
import { ABILITIES } from "../abilities/index.ts"
import type { AbilityUse } from "../content/types.ts"
import { footprintWithin } from "../grid/coords.ts"
import type { Actor, TickContext } from "./shared.ts"
import { applyDamage, applyHeal } from "./shared.ts"

/** A unit's abilities, each with its kind from the battle's table. A kind the table lacks was refused when the content
 *  loaded, so it is skipped here rather than thrown on mid-battle. */
function abilitiesOf(context: TickContext, actor: Actor): readonly Readonly<{ use: AbilityUse; kind: AbilityKind }>[] {
  const uses = actor.definition.abilities
  if (uses === undefined || uses.length === 0) return []
  const table: AbilityTable = context.pulse.abilities ?? ABILITIES
  return uses.flatMap((use) => {
    const kind = table[use.kind]
    return kind === undefined ? [] : [{ use, kind }]
  })
}

/** An actor as an ability sees it. */
function bodyOf(actor: Actor): Body {
  return {
    ordinal: actor.ordinal,
    id: actor.id,
    player: actor.player,
    contentId: actor.contentId,
    hp: actor.hp,
    maxHp: actor.definition.maxHp,
    anchor: actor.anchor,
    footprint: actor.definition.footprint,
    layer: actor.definition.layer,
    commander: actor.definition.commander === true,
  }
}

/** The world an ability acts in this tick: every act through the kernel's own rules, every act an event. */
function worldOf(context: TickContext): AbilityWorld {
  const actorOf = (body: Body): Actor | undefined => context.byOrdinal.get(body.ordinal)
  return {
    tick: context.tick,
    bodies: () => context.actors.filter((actor) => !actor.pendingDead).map(bodyOf),
    within: (a, b, radius) => footprintWithin(a.anchor, a.footprint, b.anchor, b.footprint, radius),
    random: (bound) => context.rng.nextBelow(bound),
    heal: (target, source, amount) => {
      const into = actorOf(target)
      const from = actorOf(source)
      if (into !== undefined && from !== undefined && !into.pendingDead && amount > 0) applyHeal(context, into, from, amount)
    },
    damage: (target, source, amount) => {
      const into = actorOf(target)
      const from = actorOf(source)
      if (into !== undefined && from !== undefined && !into.pendingDead && amount > 0) applyDamage(context, into, from, amount)
    },
    note: (bearer, ability, detail = {}) => {
      context.events.push({
        kind: "ability.triggered",
        tick: context.tick,
        entity: bearer.id,
        ordinal: bearer.ordinal,
        player: bearer.player,
        ability: ability.kind,
        ...(typeof ability["name"] === "string" ? { name: ability["name"] } : {}),
        ...(detail.target === undefined ? {} : { target: detail.target.id, targetOrdinal: detail.target.ordinal }),
        ...(detail.amount === undefined ? {} : { amount: detail.amount }),
        ...(detail.credits === undefined ? {} : { credits: detail.credits }),
      })
    },
  }
}

/** Who an aura guards and boosts this tick: every bearer's `damageModifiers`, the strongest offer of each channel kept. */
export function decideDamageModifiers(context: TickContext): void {
  const bearers = context.actors.filter((actor) => !actor.pendingDead && abilitiesOf(context, actor).some(({ kind }) => kind.damageModifiers !== undefined))
  if (bearers.length === 0) return
  // Deciding only: the hook is handed what it can see, never what acts.
  const { tick, bodies, within } = worldOf(context)
  const view = { tick, bodies, within }
  for (const bearer of bearers) {
    const body = bodyOf(bearer)
    for (const { use, kind } of abilitiesOf(context, bearer)) {
      kind.damageModifiers?.(body, use, view, (unit, channel, percent) => {
        if (channel === "taken") {
          const best = context.guards.get(unit.ordinal)
          if (best === undefined || percent < best.damageTakenPercent) context.guards.set(unit.ordinal, { bearer, damageTakenPercent: percent })
        } else {
          const best = context.boosts.get(unit.ordinal)
          if (best === undefined || percent > best.damageDealtPercent) context.boosts.set(unit.ordinal, { bearer, damageDealtPercent: percent })
        }
      })
    }
  }
}

/** What a hit of `amount` from `source` on `target` deals once the source's own abilities have had their say. */
export function hitDealtBy(context: TickContext, source: Actor, target: Actor, amount: number): number {
  const abilities = abilitiesOf(context, source)
  if (abilities.length === 0 || amount <= 0) return amount
  const world = worldOf(context)
  let dealt = amount
  for (const { use, kind } of abilities) if (kind.hitDealt !== undefined) dealt = kind.hitDealt(bodyOf(source), bodyOf(target), dealt, use, world)
  return dealt
}

/** Every standing bearer's `tick` hook, in ordinal order. */
export function abilityTicks(context: TickContext): void {
  const bearers = context.actors.filter((actor) => !actor.pendingDead && abilitiesOf(context, actor).some(({ kind }) => kind.tick !== undefined))
  if (bearers.length === 0) return
  const world = worldOf(context)
  for (const bearer of bearers) {
    if (bearer.pendingDead) continue
    for (const { use, kind } of abilitiesOf(context, bearer)) kind.tick?.(bodyOf(bearer), use, world)
  }
}

/** Every standing bearer's `death` hook, once for each of `dead` (the tick's deaths, in ordinal order). */
export function afterDeaths(context: TickContext, dead: readonly Readonly<{ body: Body; killer: Actor | null }>[]): void {
  if (dead.length === 0) return
  const bearers = context.actors.filter((actor) => !actor.pendingDead && abilitiesOf(context, actor).some(({ kind }) => kind.death !== undefined))
  if (bearers.length === 0) return
  const world = worldOf(context)
  for (const bearer of bearers) {
    for (const { use, kind } of abilitiesOf(context, bearer)) {
      if (kind.death === undefined) continue
      for (const { body, killer } of dead) kind.death(bodyOf(bearer), body, killer === null ? null : bodyOf(killer), use, world)
    }
  }
}

export { bodyOf }
