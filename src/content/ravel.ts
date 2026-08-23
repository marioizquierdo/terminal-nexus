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
//   Off the beat        every rate is deliberately off the Citizen cadence — 12/5, 8/5, 8/3, 4/3,
//                       3/1 against 2/1 and 1/1, so nothing in the two armies steps together. Both
//                       rosters got a 2x-the-original speed pass on 2026-08-22 (a second owner
//                       playtest that day: "still too slow... 2 or 2.5 times faster"), so the
//                       offsets are exactly what they always were;
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
// An air unit collides only with other air - never obstacles, workers, or units - and its mask
// ignores terrain entirely (src/pulse/shared.ts, maskForActor). "Arrives from a direction nobody
// planned for" is the runner's doctrine already; the buzzard below is that doctrine taken literally.
const AIR_UNIT_COLLISIONS = ["air"] as const

export const RAVEL_CONTENT: readonly ContentDef[] = [
  {
    // Fast, fragile, first. It dies to anything that connects and it usually connects first.
    id: "unit.ravel.runner",
    short: "runner",
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 16,
    // 12/5 rather than 6/5 - the same speed pass as the Citizen roster, second round (2026-08-22
    // owner playtest: "still too slow... 2 or 2.5 times faster"), 2x the ORIGINAL rate rather than
    // another factor on top of the branch's own unseen 1.5x pass - see citizen.ts's worker entry for
    // the full reasoning. The runner stays exactly as far off the Citizen cadence, proportionally,
    // as it always was.
    movementRate: { numerator: 12, denominator: 5 },
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
    // 8/5 rather than 4/5 - 2x the original rate, same speed pass as the rest of the roster; still
    // slower than the runner, and still on nobody else's beat (a step every eight ticks now, not
    // fifteen).
    movementRate: { numerator: 8, denominator: 5 },
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
    // 8/3 rather than 4/3 - 2x the original rate, same speed pass as the rest of the roster.
    movementRate: { numerator: 8, denominator: 3 },
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
    // 4/3 rather than 2/3 - 2x the original rate, same speed pass as the rest of the roster.
    movementRate: { numerator: 4, denominator: 3 },
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
    // 3/1 rather than 3/2 - 2x the original rate, same speed pass as the rest of the roster.
    movementRate: { numerator: 3, denominator: 1 },
    speedTier: 2,
    collidesWith: SCAVENGER_COLLISIONS,
    behavior: "flee",
    salvage: 9,
  },
  {
    // Ten tiles of welded scrap — five by two, the widest thing on the bench, and the Ravel answer
    // to the Citizen colossus: not tougher, just bigger, louder, and carrying enough munitions to
    // take the block with it. Losing every fair fight is still the doctrine; this one just makes
    // the unfair one much more expensive.
    id: "unit.ravel.leviathan",
    short: "leviathan",
    layer: "units",
    footprint: rectFootprint(5, 2),
    maxHp: 130,
    // Cadence 18 ticks, off both Citizen cadences (6 and 12, plus the colossus's 24) as the whole
    // roster is by design.
    movementRate: { numerator: 2, denominator: 3 },
    speedTier: 4,
    attack: { kind: "melee", range: 1, damage: 14, cooldownTicks: 16 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 60,
    // The largest detonation in the game, and the point of the unit: a radius-2 blast from a
    // five-tile body reaches most of a formation, friendly or not.
    detonation: { radius: 2, damage: 24 },
  },
  {
    // The `air` layer's first real content, not just its test fixture: `layer: "air"` and
    // `collidesWith: ["air"]` are the whole difference from a one-tile ground unit - the kernel
    // already ignores terrain for anything on this layer (maskForActor, shared.ts) and the loader
    // already exempts it from the on-rock-at-spawn check (scenario/load.ts), so a walled rock room
    // no ground unit could ever leave is just a tile to this thing - see
    // `scenarios/air-crossing.map.json`. Small, fragile, and it still detonates on death: the
    // doctrine does not change because the wreckage falls from higher up.
    id: "unit.ravel.buzzard",
    short: "buzzard",
    layer: "air",
    footprint: rectFootprint(1, 1),
    maxHp: 14,
    // 4/1 - cadence 3 ticks/step, off every cadence already on the bench (citizen: 6, 6, 6, 12, 24;
    // the rest of this roster: 5, 7.5, 4.5, 9, 4, 18). The fastest thing either side fields.
    movementRate: { numerator: 4, denominator: 1 },
    speedTier: 1,
    attack: { kind: "melee", range: 1, damage: 6, cooldownTicks: 10 },
    collidesWith: AIR_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 7,
    detonation: { radius: 1, damage: 6 },
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
