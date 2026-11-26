// The Build Phase tests' base — not a test file itself: the runners only pick up `*.test.ts`. The starter map's
// Skirmish round 1 (`starterContext`, `saves/starter.save.json`), with what the placement tests are written against: a
// Barracks standing beside the Nexus (something to build next to, whose build range a plan reaches into, and something
// a careless placement overlaps), a build menu of four, Barracks, Hatchery, Turret and Supply Depot, under digits 1 to
// 4, War Chest beside the hand the Nexus Pulse deals, the plain hint on the bottom line as the round opens, and a fence
// for the map's own edge (a map may name its edge; no Skirmish map does yet). It is the base PERIMETER, a Story mission, gave the screen until Story stopped (the owner,
// 2026-11-26), laid on a Skirmish's round so its geometry did not move.
//
// A test that plays the round's battle uses `starterContext` itself: the battle knows nothing of what is laid here.

import type { MapTerrain } from "../src/engine/geometry/types.ts"
import type { BuildContext } from "../src/build/state.ts"
import { constructItem, nexusDraftOf } from "../src/build/catalog.ts"
import { ARMIES } from "../src/armies/index.ts"
import { starterContext } from "../src/cli/starter.ts"

/** The four buildings of the test base's menu, by card, in their digits' order. */
const MENU = ["barracks", "hatchery", "turret", "depot"] as const

/** The Barracks standing beside the starter map's Nexus in the test base. */
export const TEST_BARRACKS = { contentId: "structure.citizen.barracks", anchor: { x: 25, y: 10 } } as const

/** **The test base**: the starter map's round 1 with a Barracks standing beside the Nexus, the menu of four and War
 *  Chest beside the hand. */
export function testBase(scrollMargin?: number, extra: Partial<BuildContext> = {}): BuildContext {
  const { openingStatus: _said, ...round } = starterContext(scrollMargin, extra)
  const chest = ARMIES.arsenals["vasse"]?.powers.find((card) => card.id === "war-chest")
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
    edgeStyle: "fence",
    nexusDraft: nexusDraftOf({ powers: [...round.nexusDraft.map((option) => option.card), ...(chest === undefined ? [] : [chest])] }),
    ...(extra.openingStatus === undefined ? {} : { openingStatus: extra.openingStatus }),
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

// --- A battle with that Barracks standing ---------------------------------------------------------------------------

import { readFileSync } from "node:fs"
import { playRound } from "../src/battle/index.ts"
import { battleOf, readSave, saveOf } from "../src/skirmish/save.ts"
import type { PlayableLevel } from "../src/cli/levels.ts"
import { skirmishLevel } from "../src/cli/skirmish-play.ts"

/**
 * **The starter map's battle with the test base's Barracks standing**, for a test that plays a round with it: round 1
 * built it beside the Nexus, and a Supply Depot so the army has room for its waves, and kept nothing, so the Build
 * Phase this opens on is round 2, the Barracks standing at 25,10 in the battle as on the screen.
 */
export function barracksLevel(): PlayableLevel {
  const read = readSave(readFileSync(new URL("../saves/starter.save.json", import.meta.url), "utf8"))
  if (read.save === null) throw new Error(read.problems.join("; "))
  const { setup } = read.save
  const built = playRound(battleOf(read.save), { A: { build: [{ building: "barracks", x: TEST_BARRACKS.anchor.x, y: TEST_BARRACKS.anchor.y }, { building: "depot", x: 13, y: 13 }] }, B: { build: [] } }).state
  const standing = built.carried?.entities.some((entity) => entity.contentId === TEST_BARRACKS.contentId && entity.anchor.x === TEST_BARRACKS.anchor.x && entity.anchor.y === TEST_BARRACKS.anchor.y)
  if (standing !== true) throw new Error("round 1 did not build the Barracks at 25,10")
  return skirmishLevel(saveOf(setup, built, { name: "The starter map, a Barracks built" }), { route: "skirmish?load=starter-barracks.save.json" })
}
