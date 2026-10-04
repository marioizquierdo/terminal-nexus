// A Commander's aura in the damage step (pulse.md): a skill that works on its own, the owner's "heroes on
// warcraft3 ... Vasse should provide boost to nearby units". Vasse's is By the Book (`ContentDef.aura`):
// while she is on the Grid, the units of her side within its radius of her take a share of the damage a hit
// would deal them.
//
// - **Who is guarded is decided once a tick, as the attacks begin** (`guardsOf`), from where everyone stands
//   once the tick's moves have settled: a mobile entity of the bearer's side whose footprint is within the
//   radius of the bearer's, measured as range is (Manhattan, to the nearest tile of each footprint). The
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

import { footprintDistance } from "../grid/coords.ts"
// Types only: `shared.ts` reads `guardedAmount` from here, so nothing here reads a value from there.
import type { Actor, TickContext } from "./shared.ts"

/** What guards a unit this tick: the bearer whose aura reaches it, and the share of a hit it lets through. */
export type Guard = Readonly<{ bearer: Actor; damageTakenPercent: number }>

/** Every unit an aura guards this tick, by ordinal, with the aura that guards it. Empty — and nothing
 *  else read — when nobody on the Grid has an aura. */
export function guardsOf(context: TickContext): Map<number, Guard> {
  const guards = new Map<number, Guard>()
  // In ordinal order (`context.actors` is), so the first bearer keeps a tie.
  const bearers = context.actors.filter((actor) => actor.definition.aura !== undefined && !actor.pendingDead)
  if (bearers.length === 0) return guards
  for (const unit of context.actors) {
    // A unit on the move or in the air is guarded; a structure is not.
    if (unit.pendingDead || unit.definition.layer === "obstacles") continue
    for (const bearer of bearers) {
      const aura = bearer.definition.aura
      if (aura === undefined || bearer.player !== unit.player) continue
      // Measured as range is: to the nearest tile of each footprint (`distanceBetween`, `shared.ts`).
      if (footprintDistance(bearer.anchor, bearer.definition.footprint, unit.anchor, unit.definition.footprint) > aura.radius) continue
      const best = guards.get(unit.ordinal)
      if (best === undefined || aura.damageTakenPercent < best.damageTakenPercent) {
        guards.set(unit.ordinal, { bearer, damageTakenPercent: aura.damageTakenPercent })
      }
    }
  }
  return guards
}

/** What a hit of `amount` deals through an aura that lets `damageTakenPercent` of it through: rounded down,
 *  and never less than 1 for a hit that dealt any. */
export function guardedAmount(amount: number, damageTakenPercent: number): number {
  if (amount <= 0) return amount
  return Math.max(1, Math.floor((amount * damageTakenPercent) / 100))
}
