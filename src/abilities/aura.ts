// An aura (the owner, 2026-10-04: Commanders "should be like heroes on warcraft3 ... Vasse should provide boost to
// nearby units"): while its bearer stands, the units of its side within its radius — the bearer too, as a Warcraft
// III aura covers its hero — take a share of every hit (`damageTakenPercent`: Vasse's By the Book guards), or deal a
// share more (`damageDealtPercent`: Averno's Forward Order presses). Structures are not covered: it is the units.
//
// Decided once a tick, as the attacks begin, from where everyone stands once the moves have settled, and held for the
// whole of that tick's damage, a blast's included, even if the bearer falls in it (pulse.md). Auras never stack: a
// unit keeps the strongest of each kind (`DamageOffer`). A guarded hit deals its share rounded down and never less
// than 1; a boosted hit its share rounded down and never less than the hit (`guardedAmount`, `boostedAmount`).

import type { Say, Shape } from "../content/shape.ts"
import { literal, positiveWholeNumber, record, text } from "../content/shape.ts"
import type { AbilityKind } from "./types.ts"

/** An aura's numbers: its name on a card, how far it reaches, and one of the two shares. */
export type Aura = Readonly<{ kind: "aura"; name: string; radius: number; damageTakenPercent?: number; damageDealtPercent?: number }>

const fields: Shape<Aura> = record<Aura>(
  { kind: literal("aura"), name: text, radius: positiveWholeNumber },
  { damageTakenPercent: positiveWholeNumber, damageDealtPercent: positiveWholeNumber },
)

/** An aura is a guard or a boost: one share, the guard's below 100 and the boost's above it. */
const params: Shape<Aura> = {
  check(value: unknown, at: string, say: Say): value is Aura {
    if (!fields.check(value, at, say)) return false
    const { damageTakenPercent: taken, damageDealtPercent: dealt } = value
    if ((taken === undefined) === (dealt === undefined)) {
      say(`${at} should give one of "damageTakenPercent" (a guard) and "damageDealtPercent" (a boost)`)
      return false
    }
    if (taken !== undefined && taken >= 100) say(`${at}.damageTakenPercent is ${taken}: a guard lets through less than all of a hit`)
    if (dealt !== undefined && dealt <= 100) say(`${at}.damageDealtPercent is ${dealt}: a boost deals more than the hit`)
    return (taken === undefined || taken < 100) && (dealt === undefined || dealt > 100)
  },
}

export const AURA: AbilityKind<Aura> = {
  kind: "aura",
  params,
  describe: (aura, { subject, possessive }) => {
    const who = `${subject} and ${possessive} units within range ${aura.radius}`
    return aura.damageTakenPercent !== undefined
      ? `${aura.name}: ${who} take ${100 - aura.damageTakenPercent}% less damage.`
      : `${aura.name}: ${who} deal ${(aura.damageDealtPercent ?? 100) - 100}% more damage.`
  },
  reach: (aura) => aura.radius,
  damageModifiers: (bearer, aura, world, offer) => {
    for (const unit of world.bodies()) {
      if (unit.player !== bearer.player || unit.layer === "obstacles" || !world.within(bearer, unit, aura.radius)) continue
      if (aura.damageTakenPercent !== undefined) offer(unit, "taken", aura.damageTakenPercent)
      if (aura.damageDealtPercent !== undefined) offer(unit, "dealt", aura.damageDealtPercent)
    }
  },
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
