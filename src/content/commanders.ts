// The one named Commander: Edda Vasse, the Citizen Nexus's Symbol (commander-armies.md), built at the
// size PERIMETER needs — a persistent `@` on the units layer — and nothing of the Commander Army she will
// one day lead. Building one Commander's mechanic is not choosing the Citizens' roster (the Commander
// milestone draws that line, `docs/history/milestones/milestone-08-commander.md`), so she sits beside the bench
// rosters rather than in one, and her numbers are a first fixture measured against PERIMETER's raid
// (docs/history/reports/2026-10-01-commander-vasse.md), not balance.
//
// What makes her a Commander is the `commander` flag, and only the rules between rounds read it
// (`src/match/commander.ts`): when she falls she is absent for the rest of that round's Pulse, and the
// Nexus restores her beside it as the next round opens — she sits no round out (`roundsOut`). The kernel
// sees a unit like any other, so her death is never the victory condition (pulse.md).

import type { ContentDef } from "./types.ts"
import { rectFootprint } from "./types.ts"

/** The Commander the Experiment "Vasse's health" tunes: her. Another Commander keeps his own health. */
export const HEALTH_TUNED_COMMANDER = "unit.citizen.vasse"

export const COMMANDER_CONTENT: readonly ContentDef[] = [
  {
    id: "unit.citizen.vasse",
    short: "vasse",
    commander: true,
    // Not bought, so she takes no place of the army's supply (`src/content/supply.ts`).
    supplyCost: 0,
    // Back as soon as the next round opens: the base Commander pays nothing more for falling than the rest of the
    // round she fell in (the owner, 2026-10-13: "Base will just come back immediately after"). Sitting rounds out is
    // a disadvantage some other Commander may carry.
    roundsOut: 0,
    layer: "units",
    footprint: rectFootprint(1, 1),
    // Twice a trooper: she came out of PERIMETER's first two rounds in every plan measured, and a plan
    // that builds nothing still loses the mission (at 150 she holds the last round off long enough to win
    // it on time). She falls in the last round in every plan at every health up to 150: advancing like
    // every unit, no health keeps her alive there and still lets that plan lose. While it is tuned, the
    // Pulse reads the Experiment "Vasse's health" instead (`commanderRegistry`, `src/match/commander.ts`).
    maxHp: 80,
    // The squads' own pace (a trooper's 10/3), so she walks with the line she leads rather than ahead of
    // it or behind; and an off-beat cadence is the Ravels' rule, not hers.
    movementRate: { numerator: 10, denominator: 3 },
    // She acts before the troopers beside her, as the marksman does.
    speedTier: 1,
    // "Fortify, verify, then advance": she fires from just behind the melee, closer than a marksman and a
    // little harder, so she stays in the fight without standing in the front rank. Gentle on purpose: at
    // eight a shot she ended PERIMETER's first round before the Barracks's first trooper (ten seconds in).
    attack: { kind: "ranged", range: 4, damage: 5, cooldownTicks: 18, projectileTilesPerTick: 3 },
    collidesWith: ["obstacles", "units"],
    behavior: "advance",
    // By the Book, her protector's aura: the units near her, within a reach of 4, take three quarters of the
    // damage, and so does she. A first fixture, like everything else about her; while it is tuned, the Pulse reads
    // the Experiment "By the Book" instead (`auraRegistry`, `src/match/commander.ts`), whose default is this.
    aura: { radius: 4, damageTakenPercent: 75, name: "By the Book" },
    // The Nexus takes its Symbol back: nothing of her is left on the ground to salvage.
    salvage: 0,
  },
  {
    // Marshal Averno, the second Commander (commander-armies.md, the mirror; Commander Armies' third step): the same
    // Citizen army, pressed forward. Where Vasse guards, he pushes — a melee Commander in the front rank whose aura
    // makes his units hit harder — and he pays for it: lighter than her, and when he falls the Nexus files him a
    // round late. First fixtures, measured on the curve level beside her, no balance claim.
    id: "unit.citizen.averno",
    short: "averno",
    commander: true,
    supplyCost: 0,
    // Out for the round after the one he falls in: the forward Commander's cost (the owner, 2026-10-14: "Maybe some
    // commander will have this disadvantage that they stay out for a full round").
    roundsOut: 1,
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 70,
    movementRate: { numerator: 10, denominator: 3 },
    speedTier: 1,
    // In the front rank: hand to hand, a little harder than a trooper.
    attack: { kind: "melee", range: 1, damage: 9, cooldownTicks: 12 },
    collidesWith: ["obstacles", "units"],
    behavior: "advance",
    // He charges: he turns from his post to fight what comes within 12 columns or 6 rows of him, where every other
    // unit waits for 6 and 3 — so he leaves the line for the front, and takes his aura there.
    engageRange: 12,
    // Forward Order, his pressing aura: he and his units within a reach of 4 deal a quarter more with every hit.
    aura: { radius: 4, damageDealtPercent: 125, name: "Forward Order" },
    salvage: 0,
  },
]
