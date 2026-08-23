// Ravel fixture content — disposable, tuned for contrast, not for balance.
//
// The same status as the Citizen fixture in milestone-1-spike-battle.md 3.6: **not a Commander
// Army, not canon**. `commander-armies.md` Section 1 forbids production stats before Milestone 4
// selects the Citizens-versus-Ravels microgame, and saying these are throwaway is what keeps them
// throwaway.
//
// What they are for is contrast. `terminal-nexus-lore.md` Section 8.6 sets the test: a player who
// has never read a word of lore should be able to state the faction's philosophy from play alone.
// Three of the four Ravel rule shapes in `commander-armies.md` 4.1 are expressible with what the
// kernel already has, and the fourth is one new rule:
//
//   Off the beat        every rate is deliberately off the Citizen cadence — 9/5, 6/5, 2/1, 1/1, 9/4
//                       against 3/2 and 3/4, so nothing in the two armies steps together. Both
//                       rosters got the same 1.5x speed pass on 2026-08-22 (owner playtest: "units
//                       still move too slow"), so the offsets are exactly what they always were;
//   Break free          lower speed tiers: Ravels claim tiles and swing before Citizens do;
//   Everything is fuel  volatile munitions, below — the rule that makes them Ravel;
//   Scrap doctrine      higher salvage, since even their losses pay forward.
//
// Jackpot drafts are the fourth shape and are **not** here: they need a Nexus draft and an economy,
// neither of which exists yet.
//
// The feel this is aiming at: Ravels lose every fair fight and win every unfair one. A runner cannot
// trade with a trooper and is not supposed to; it is supposed to arrive first, in numbers, from a
// direction nobody planned for, next to something that explodes.

import type { ContentDef } from "./types.ts"
import { rectFootprint } from "./types.ts"

const GROUND_UNIT_COLLISIONS = ["obstacles", "units"] as const
const SCAVENGER_COLLISIONS = ["obstacles", "workers"] as const
const STRUCTURE_COLLISIONS = ["obstacles", "workers", "units"] as const

export const RAVEL_CONTENT: readonly ContentDef[] = [
  {
    // Fast, fragile, first. It dies to anything that connects and it usually connects first.
    id: "unit.ravel.runner",
    short: "runner",
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 16,
    // 9/5 rather than 6/5 - the same 1.5x speed pass as the Citizen roster (2026-08-22 owner
    // playtest: "units still move too slow"), so the runner stays exactly as far off the Citizen
    // cadence, proportionally, as it always was.
    movementRate: { numerator: 9, denominator: 5 },
    speedTier: 1,
    attack: { kind: "melee", range: 1, damage: 5, cooldownTicks: 8 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 8,
    detonation: { radius: 1, damage: 4 },
  },
  {
    // The three-tile raider the canon draws as `>x<`. It beats a trooper one to one, cannot turn a
    // corner to save its life, and takes its killer's neighbours with it.
    id: "unit.ravel.raider",
    short: "raider",
    layer: "units",
    footprint: rectFootprint(3, 1),
    maxHp: 44,
    // 6/5 rather than 4/5 - same 1.5x speed pass as the rest of the roster; still slower than the
    // runner, and still on nobody else's beat (a step every ten ticks now, not fifteen).
    movementRate: { numerator: 6, denominator: 5 },
    speedTier: 2,
    attack: { kind: "melee", range: 1, damage: 11, cooldownTicks: 14 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 18,
    detonation: { radius: 1, damage: 10 },
  },
  {
    // Shorter ranged than a marksman, faster to reposition, and it fires off the Citizen beat.
    id: "unit.ravel.slinger",
    short: "slinger",
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 18,
    // 2/1 rather than 4/3 - same 1.5x speed pass as the rest of the roster.
    movementRate: { numerator: 2, denominator: 1 },
    speedTier: 1,
    attack: { kind: "ranged", range: 4, damage: 5, cooldownTicks: 20, projectileTilesPerTick: 2 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 10,
    detonation: { radius: 1, damage: 4 },
  },
  {
    // The cascade piece, and the reason the rule exists. It carries no weapon: it is the weapon,
    // and it is just as happy to delete a Ravel line as an enemy one.
    id: "unit.ravel.fuelwagon",
    short: "wagon",
    layer: "units",
    footprint: rectFootprint(1, 1),
    // Twenty health against a twenty-damage blast, on purpose: one wagon's detonation is exactly
    // enough to set off the next one, which is what makes a chain a chain rather than a bang.
    maxHp: 20,
    // 1/1 rather than 2/3 - same 1.5x speed pass as the rest of the roster.
    movementRate: { numerator: 1, denominator: 1 },
    speedTier: 3,
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 26,
    detonation: { radius: 2, damage: 20 },
  },
  {
    // Faster than a Citizen worker, and worth more dead. It flees like one.
    id: "unit.ravel.scav",
    short: "scav",
    layer: "workers",
    footprint: rectFootprint(1, 1),
    maxHp: 16,
    // 9/4 rather than 3/2 - same 1.5x speed pass as the rest of the roster.
    movementRate: { numerator: 9, denominator: 4 },
    speedTier: 2,
    collidesWith: SCAVENGER_COLLISIONS,
    behavior: "flee",
    salvage: 9,
  },
  {
    // A Grid Nexus welded out of the same scrap as everything else, and true to the doctrine: when
    // it goes, it goes loudly, and it takes the block with it.
    id: "structure.ravel.nexus",
    short: "nexus",
    nexus: true,
    layer: "obstacles",
    footprint: rectFootprint(3, 2),
    maxHp: 400,
    speedTier: 9,
    collidesWith: STRUCTURE_COLLISIONS,
    behavior: "static",
    salvage: 120,
    detonation: { radius: 2, damage: 15 },
  },
  {
    // Scrap welded into a shape. Cheaper to kill than a barracks, and it takes the block with it.
    id: "structure.ravel.den",
    short: "den",
    layer: "obstacles",
    footprint: rectFootprint(3, 2),
    maxHp: 90,
    speedTier: 9,
    collidesWith: STRUCTURE_COLLISIONS,
    behavior: "static",
    salvage: 40,
    detonation: { radius: 1, damage: 12 },
  },
]
