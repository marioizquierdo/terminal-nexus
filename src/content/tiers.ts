// The tech tree's tiers above the first (Commander Armies, the curve on the Grid): the Garrison, which a Barracks
// standing unlocks, and the pikemen it sends. Building the tree is not choosing the Citizens' roster (the content
// iteration milestone does that), so, like the Commander, they sit beside the bench rosters rather than in one, and
// their numbers are built to the power curve's guidance (docs/game-design/commander-armies.md), not balance.

import type { ContentDef } from "./types.ts"
import { rectFootprint } from "./types.ts"

const GROUND_UNIT_COLLISIONS = ["obstacles", "units"] as const

const STRUCTURE_COLLISIONS = ["obstacles", "workers", "units"] as const

export const TIER_CONTENT: readonly ContentDef[] = [
  {
    // The tech tree's first second tier (Commander Armies, the curve on the Grid): a heavier Barracks, unlocked once
    // a Barracks stands, sending pikemen, about three troopers each. Sturdier than a Barracks because it costs more.
    // First guesses, no balance claim.
    id: "structure.citizen.garrison",
    short: "garrison",
    layer: "obstacles",
    footprint: rectFootprint(3, 2),
    maxHp: 160,
    speedTier: 9,
    collidesWith: STRUCTURE_COLLISIONS,
    behavior: "static",
    salvage: 40,
    constructionRadius: 6,
    // The ring its pikemen appear on, kept free like the Barracks's.
    clearance: 1,
  },
  {
    // The Garrison's unit, the tech tree's first second tier (Commander Armies, the curve on the Grid): heavy
    // infantry, one tile so a wave comes out whole beside its building, built to the power curve's guidance — about
    // three troopers in health times damage a tick (70 x 12 / 12 = 70, a trooper's 40 x 7 / 12 is about 23). As quick
    // as a trooper and as plainly melee, so what changes is weight, not role. First guesses, no balance claim.
    id: "unit.citizen.pikeman",
    short: "pikeman",
    layer: "units",
    footprint: rectFootprint(1, 1),
    maxHp: 70,
    movementRate: { numerator: 10, denominator: 3 },
    speedTier: 2,
    attack: { kind: "melee", range: 1, damage: 12, cooldownTicks: 12 },
    collidesWith: GROUND_UNIT_COLLISIONS,
    behavior: "advance",
    salvage: 25,
  },
]
