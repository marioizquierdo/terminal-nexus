// The one named Commander: Edda Vasse, the Citizen Nexus's Symbol (commander-armies.md), built at the
// size PERIMETER needs — a persistent `@` on the units layer — and nothing of the Commander Army she will
// one day lead. Building one Commander's mechanic is not choosing the Citizens' roster (the Commander
// milestone draws that line, `docs/milestones/milestone-08-commander.md`), so she sits beside the bench
// rosters rather than in one, and her numbers are a first fixture measured against PERIMETER's raid
// (docs/history/reports/2026-10-01-commander-vasse.md), not balance.
//
// What makes her a Commander is the `commander` flag, and only the rules between rounds read it
// (`src/match/commander.ts`): when she falls she is absent for the rest of that round's Pulse and the
// whole of the next round, and then the Nexus restores her beside it. The kernel sees a unit like any
// other, so her death is never the victory condition (pulse.md).

import type { ContentDef } from "./types.ts"
import { rectFootprint } from "./types.ts"

export const COMMANDER_CONTENT: readonly ContentDef[] = [
  {
    id: "unit.citizen.vasse",
    short: "vasse",
    commander: true,
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
    attack: { kind: "ranged", range: 3, damage: 5, cooldownTicks: 18, projectileTilesPerTick: 3 },
    collidesWith: ["obstacles", "units"],
    behavior: "advance",
    // The Nexus takes its Symbol back: nothing of her is left on the ground to salvage.
    salvage: 0,
  },
]
