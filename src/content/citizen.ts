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
    // 2/1 rather than 1/1 - a second owner playtest, 2026-08-22, on top of a first that already
    // asked for this and got a 1.5x pass on this same branch (3/2) the owner had not yet seen when
    // this note landed: "The movement speed is still too slow, they should move 2 or 2.5 times
    // faster." Read against the baseline both playtests actually watched (1/1, since neither had
    // this branch's intermediate value on screen), so every fixture rate below is the ORIGINAL rate
    // x2, not the 1.5x pass x another factor - every ratio this content was tuned against still
    // holds exactly. Cadence 6 ticks/step (engine.md 4.1's own table), a tile every half second.
    movementRate: { numerator: 2, denominator: 1 },
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
    // 2/1 rather than 1/1 - see unit.citizen.worker above: a third speed pass overall, 2x the
    // original rate. A trooper is the unit most players spend the most time watching. Disposable
    // bench content, tuned freely.
    movementRate: { numerator: 2, denominator: 1 },
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
    // 2/1 rather than 1/1 - same speed pass as the trooper above.
    movementRate: { numerator: 2, denominator: 1 },
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
    // 1/1 rather than 1/2 - the same speed pass as the rest of the roster (2026-08-22 owner
    // playtest, second round); the hauler stays the slowest thing on either side, exactly half the
    // new trooper rate, same as it was half the original. Cadence 12 ticks/step (engine.md 4.1's
    // table), one tile a second.
    movementRate: { numerator: 1, denominator: 1 },
    speedTier: 3,
    attack: { kind: "melee", range: 1, damage: 10, cooldownTicks: 18 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 22,
  },
  {
    // The first piece of bench content big enough that its **silhouette** is the identity, not its
    // letter — three by three, drawn as a sealed head over a braced body over legs
    // (`src/content/art.ts`). Slow enough that you watch it arrive, and tough enough that arriving
    // is the whole event.
    //
    // It exists to put weight on the parts of the kernel a one-tile actor never touches: a nine-tile
    // mask against terrain and neighbours, a centre-tile placement two tiles from its own anchor,
    // and a death collapse that has an area to fill.
    id: "unit.citizen.colossus",
    short: "colossus",
    layer: "units",
    footprint: rectFootprint(3, 3),
    maxHp: 160,
    // Cadence 24 ticks — two seconds a tile, half the hauler's pace and the slowest thing on the
    // bench. Nothing in the Ravel roster steps on 24 (tests/ravel.test.ts keeps it that way).
    movementRate: { numerator: 1, denominator: 2 },
    // Tier 4: it claims tiles and swings after everything else. A siege engine does not win the
    // initiative roll, it wins by still being there.
    speedTier: 4,
    attack: { kind: "melee", range: 1, damage: 18, cooldownTicks: 20 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 45,
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
