// Fixture content for Gate 1A — disposable, tuned for legibility, not balance.
//
// milestone-1-spike-battle.md 3.6 is the authority for every number here. These are explicitly
// **not** a Commander Army and not canon: commander-armies.md forbids production rosters before
// Milestone 4, and saying they are throwaway is what keeps them throwaway.
//
// The relationship the numbers are meant to make visible without a spreadsheet:
// one trooper beats one marksman and finishes at about a quarter health; two marksmen kill the
// trooper during the same approach. Melee wins the charge, ranged wins when massed.

import type { ContentDef } from "./types.ts"
import { rectFootprint } from "./types.ts"

const GROUND_UNIT_COLLISIONS = ["obstacles", "units"] as const
const WORKER_COLLISIONS = ["obstacles", "workers"] as const
const STRUCTURE_COLLISIONS = ["obstacles", "workers", "units"] as const

export const CITIZEN_CONTENT: readonly ContentDef[] = [
  {
    id: "unit.citizen.worker",
    short: "worker",
    layer: "workers",
    footprint: rectFootprint(1, 1),
    maxHp: 20,
    movementRate: { numerator: 1, denominator: 1 },
    speedTier: 2,
    collidesWith: WORKER_COLLISIONS,
    behavior: "flee",
    salvage: 5,
  },
  {
    id: "unit.citizen.trooper",
    short: "trooper",
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 40,
    // 1/1 rather than 3/4 - owner playtest: the opening approach read as sluggish, and a trooper is
    // the unit most players spend the most time watching. Disposable bench content, tuned freely.
    movementRate: { numerator: 1, denominator: 1 },
    speedTier: 2,
    attack: { kind: "melee", range: 1, damage: 7, cooldownTicks: 12 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 10,
  },
  {
    id: "unit.citizen.marksman",
    short: "marksman",
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 24,
    // 1/1 rather than 3/4 - same owner finding as the trooper above.
    movementRate: { numerator: 1, denominator: 1 },
    speedTier: 1,
    attack: { kind: "ranged", range: 5, damage: 6, cooldownTicks: 24, projectileTilesPerTick: 3 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 6,
  },
  {
    // The multi-tile mover, in the fixture on purpose: a three-tile unit squeezing between rock
    // formations is the case that breaks a collision system written for one-tile actors.
    id: "unit.citizen.hauler",
    short: "hauler",
    layer: "units",
    footprint: rectFootprint(3, 1),
    maxHp: 90,
    movementRate: { numerator: 1, denominator: 2 },
    speedTier: 3,
    attack: { kind: "melee", range: 1, damage: 10, cooldownTicks: 18 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 22,
  },
  {
    id: "structure.citizen.nexus",
    short: "nexus",
    nexus: true,
    layer: "obstacles",
    footprint: rectFootprint(3, 2),
    maxHp: 400,
    speedTier: 9,
    collidesWith: STRUCTURE_COLLISIONS,
    behavior: "static",
    salvage: 100,
  },
  {
    id: "structure.citizen.barracks",
    short: "barracks",
    layer: "obstacles",
    footprint: rectFootprint(3, 2),
    maxHp: 120,
    speedTier: 9,
    collidesWith: STRUCTURE_COLLISIONS,
    behavior: "static",
    salvage: 30,
  },
]
