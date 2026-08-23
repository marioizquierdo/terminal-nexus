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
    // 10/3 rather than 2/1 - a third speed pass, owner playtest 2026-08-23: "units still move too
    // slow... it takes a while for the battle to start... raise movement speed by another 50-70%
    // on all units." 5/3x (~1.67x) uniformly across both rosters, not per-unit: the same constant
    // applied to every rate preserves every ratio this content was ever tuned against (2026-08-22's
    // two rounds got the roster here at 2x the original 1/1), and a single shared multiplier is also
    // what keeps `tests/ravel.test.ts`'s "no Ravel moves on a Citizen cadence" true automatically -
    // two cadences that disagreed before disagree by the same factor after. Cadence 4 ticks/step.
    movementRate: { numerator: 10, denominator: 3 },
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
    // 10/3 rather than 2/1 - see unit.citizen.worker above: a third speed pass overall, ~1.67x the
    // rate two prior playtests already doubled. A trooper is the unit most players spend the most
    // time watching. Disposable bench content, tuned freely.
    movementRate: { numerator: 10, denominator: 3 },
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
    // 10/3 rather than 2/1 - same speed pass as the trooper above.
    movementRate: { numerator: 10, denominator: 3 },
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
    // 5/3 rather than 1/1 - the same speed pass as the rest of the roster; the hauler stays exactly
    // half the trooper rate, same relationship it has held through every pass. Cadence 8 ticks/step.
    movementRate: { numerator: 5, denominator: 3 },
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
    // 5/6 rather than 1/2 - the same third speed pass as the rest of the roster. Still exactly half
    // the hauler's rate (5/6 is half of 5/3, same relationship every pass has kept), and still the
    // slowest thing on the bench: cadence 15 ticks/step. tests/ravel.test.ts checks nothing in the
    // Ravel roster shares a cadence with anything here, dynamically - not pinned to a literal number.
    movementRate: { numerator: 5, denominator: 6 },
    // Tier 4: it claims tiles and swings after everything else. A siege engine does not win the
    // initiative roll, it wins by still being there.
    speedTier: 4,
    attack: { kind: "melee", range: 1, damage: 18, cooldownTicks: 20 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 45,
  },
  {
    // Owner playtest, 2026-08-23: "try smaller multi-cell units: 2x1, and 2x2." Between the trooper
    // and the hauler in every stat that matters - not a scaled-down colossus, a distinct weight
    // class of its own: a sealed turret over two struts, small enough to still read as infantry
    // scale rather than a vehicle.
    id: "unit.citizen.sentinel",
    short: "sentinel",
    layer: "units",
    footprint: rectFootprint(2, 2),
    maxHp: 60,
    // 4/3 - cadence 9 ticks/step, its own beat, off every other rate on the bench.
    movementRate: { numerator: 4, denominator: 3 },
    speedTier: 3,
    attack: { kind: "melee", range: 1, damage: 12, cooldownTicks: 16 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 26,
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
