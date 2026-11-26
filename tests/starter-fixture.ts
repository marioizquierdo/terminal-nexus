// The Build Phase tests' base — not a test file itself: the runners only pick up `*.test.ts`. The starter map's
// Skirmish round 1 (`starterContext`, `saves/starter.save.json`), with two things the placement tests are written
// against: a Barracks standing beside the Nexus (something to build next to, whose build range a plan reaches into,
// and something a careless placement overlaps) and a build menu of four, Barracks, Hatchery, Turret and Supply Depot,
// under digits 1 to 4. It is the base PERIMETER, a Story mission, gave the screen until Story stopped (the owner,
// 2026-11-26), laid on a Skirmish's round so its geometry did not move.
//
// A test that plays the round's battle uses `starterContext` itself: the battle knows nothing of what is laid here.

import type { MapTerrain } from "../src/engine/geometry/types.ts"
import type { BuildContext } from "../src/build/state.ts"
import { constructItem } from "../src/build/catalog.ts"
import { ARMIES } from "../src/armies/index.ts"
import { starterContext } from "../src/cli/starter.ts"

/** The four buildings of the test base's menu, by card, in their digits' order. */
const MENU = ["barracks", "hatchery", "turret", "depot"] as const

/** The Barracks standing beside the starter map's Nexus in the test base. */
export const TEST_BARRACKS = { contentId: "structure.citizen.barracks", anchor: { x: 25, y: 10 } } as const

/** **The test base**: the starter map's round 1 with a Barracks standing beside the Nexus and the menu of four. */
export function testBase(scrollMargin?: number, extra: Partial<BuildContext> = {}): BuildContext {
  const round = starterContext(scrollMargin, extra)
  const cards = ARMIES.arsenals["vasse"]?.buildings ?? []
  const menu = MENU.map((id) => {
    const card = cards.find((each) => each.id === id)
    if (card === undefined) throw new Error(`Vasse's army has no building "${id}"`)
    return card
  })
  return {
    ...round,
    catalog: menu.map((card, index) => constructItem(card, index, round.buildingCards ?? cards)),
    standing: [...round.standing, TEST_BARRACKS],
    ...("catalog" in extra && extra.catalog !== undefined ? { catalog: extra.catalog } : {}),
    ...("standing" in extra && extra.standing !== undefined ? { standing: extra.standing } : {}),
  }
}

const BASE = testBase()

/** The test base's build menu: Barracks, Hatchery, Turret, Supply Depot. */
export const STARTER_CATALOG = BASE.catalog
/** The credits the starter round opens with. */
export const STARTER_ALLOTMENT = BASE.allotment
/** The hand the starter round's Nexus Pulse deals. */
export const STARTER_NEXUS_DRAFT = BASE.nexusDraft
/** What stands for the player in the test base as round 1 opens: the Nexus, and the Barracks beside it. */
export const STARTER_STANDING = BASE.standing
/** The starter map's battlefield, a fresh copy each time. */
export const starterTerrain = (): MapTerrain => ({ ...BASE.terrain, tiles: [...BASE.terrain.tiles] })
