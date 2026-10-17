// A Commander's aura in the damage step (pulse.md): a skill that works on its own, the owner's "heroes on
// warcraft3 ... Vasse should provide boost to nearby units". An aura is a guard or a boost (`ContentDef.aura`).
// Vasse's By the Book guards: while she is on the Grid, the units of her side within its radius of her take a
// share of the damage a hit would deal them. Averno's Forward Order boosts: the units of his side within its
// radius deal more damage with every hit. Both are decided the same way, once a tick, below; a unit may be guarded
// by one aura and boosted by another.
//
// - **Who is guarded is decided once a tick, as the attacks begin** (`guardsOf`), from where everyone stands
//   once the tick's moves have settled: a mobile entity of the bearer's side whose footprint is within the
//   radius of the bearer's, measured as range is (`footprintWithin`: to the nearest tile of each footprint, a row
//   counting two columns, so a radius of 4 covers 4 columns either side of her and 2 rows up and down). The
//   bearer is within it of herself, so she is guarded too, as a Warcraft III aura covers its hero.
//   Structures are not: it is the units near her.
// - **It holds for the whole of that tick's damage** — every speed tier's attacks and every blast in the
//   resolution after them — even if the bearer falls in it. A bearer who falls is gone from the next tick on,
//   and so is her aura. Deciding it once is what keeps a hit from being guarded or not by which of two hits
//   in one tier happened to be applied first: the same reason a tier's damage is applied simultaneously.
// - **Auras never stack**: a unit within reach of several takes the strongest (the smallest share), and on a
//   tie the first bearer in ordinal order guards it.
// - **A guarded hit deals its share rounded down, and never less than 1** (`guardedAmount`): an aura softens
//   a hit, it never makes a unit immune. Blasts are hits like any other.
//
// Deterministic like every phase: integers only, ordinal order throughout, nothing but the tick's actors read.

import { footprintWithin } from "../grid/coords.ts"
// Types only: `shared.ts` reads `guardedAmount` from here, so nothing here reads a value from there.
import type { Actor, TickContext } from "./shared.ts"

/** What guards a unit this tick: the bearer whose aura reaches it, and the share of a hit it lets through. */
export type Guard = Readonly<{ bearer: Actor; damageTakenPercent: number }>

/** Every unit an aura guards this tick, by ordinal, with the aura that guards it. Empty — and nothing
 *  else read — when nobody on the Grid has an aura. */
export function guardsOf(context: TickContext): Map<number, Guard> {
  const guards = new Map<number, Guard>()
  // In ordinal order (`context.actors` is), so the first bearer keeps a tie.
  const bearers = context.actors.filter((actor) => actor.definition.aura?.damageTakenPercent !== undefined && !actor.pendingDead)
  if (bearers.length === 0) return guards
  for (const unit of context.actors) {
    // A unit on the move or in the air is guarded; a structure is not.
    if (unit.pendingDead || unit.definition.layer === "obstacles") continue
    for (const bearer of bearers) {
      const aura = bearer.definition.aura
      const taken = aura?.damageTakenPercent
      if (aura === undefined || taken === undefined || bearer.player !== unit.player) continue
      // Measured as range is, to the nearest tile of each footprint (`within`, `shared.ts`, which this file cannot
      // import: `shared.ts` reads from here).
      if (!footprintWithin(bearer.anchor, bearer.definition.footprint, unit.anchor, unit.definition.footprint, aura.radius)) continue
      const best = guards.get(unit.ordinal)
      if (best === undefined || taken < best.damageTakenPercent) {
        guards.set(unit.ordinal, { bearer, damageTakenPercent: taken })
      }
    }
  }
  return guards
}

/** What boosts a unit this tick: the bearer whose aura reaches it, and how much of its hit it deals. */
export type Boost = Readonly<{ bearer: Actor; damageDealtPercent: number }>

/** Every unit an aura boosts this tick, by ordinal: a mobile entity of a boosting bearer's side within its radius,
 *  the bearer included, the strongest boost when several reach it (the first bearer in ordinal order on a tie).
 *  Decided with the guards, once, as the attacks begin. Empty when nobody on the Grid boosts. */
export function boostsOf(context: TickContext): Map<number, Boost> {
  const boosts = new Map<number, Boost>()
  const bearers = context.actors.filter((actor) => actor.definition.aura?.damageDealtPercent !== undefined && !actor.pendingDead)
  if (bearers.length === 0) return boosts
  for (const unit of context.actors) {
    if (unit.pendingDead || unit.definition.layer === "obstacles") continue
    for (const bearer of bearers) {
      const aura = bearer.definition.aura
      const dealt = aura?.damageDealtPercent
      if (aura === undefined || dealt === undefined || bearer.player !== unit.player) continue
      if (!footprintWithin(bearer.anchor, bearer.definition.footprint, unit.anchor, unit.definition.footprint, aura.radius)) continue
      const best = boosts.get(unit.ordinal)
      if (best === undefined || dealt > best.damageDealtPercent) boosts.set(unit.ordinal, { bearer, damageDealtPercent: dealt })
    }
  }
  return boosts
}

/** What a hit of `amount` deals from a unit an aura boosts by `damageDealtPercent`: rounded down, never less than
 *  the hit itself. */
export function boostedAmount(amount: number, damageDealtPercent: number): number {
  if (amount <= 0) return amount
  return Math.max(amount, Math.floor((amount * damageDealtPercent) / 100))
}

/** What a hit of `amount` deals through an aura that lets `damageTakenPercent` of it through: rounded down,
 *  and never less than 1 for a hit that dealt any. */
export function guardedAmount(amount: number, damageTakenPercent: number): number {
  if (amount <= 0) return amount
  return Math.max(1, Math.floor((amount * damageTakenPercent) / 100))
}
