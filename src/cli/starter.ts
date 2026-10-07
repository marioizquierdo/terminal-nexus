// A level's first round, ready for the Build Phase: its mission laid on its map, offering what its campaign has
// unlocked by then, with its credits — and the default level's, PERIMETER's, which most tests start from.
//
// The level is its campaign's army's (`src/armies`); its map is the map table's (`src/build/maps.ts`); what it
// offers becomes the construct menu and the Nexus draft in `src/build/catalog.ts`. Assembling them into round 1
// needs the mission (`./pulse-run.ts`), which reaches the kernel, and `src/build` may never do that
// (`tests/architecture.test.ts`) — so the assembly lives here, in the application shell, beside the other half of
// the mission's connection. The levels the game opens by id are `./levels.ts`.

import { constructMenu, nexusDraftOf } from "../build/catalog.ts"
import { MAPS } from "../build/maps.ts"
import type { BuildContext } from "../build/state.ts"
import type { Level } from "../armies/index.ts"
import { PERIMETER_LEVEL } from "../armies/index.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { missionPlay } from "./pulse-run.ts"

/** Round 1 of the default level (PERIMETER, Vasse's first), on the starter map, with what it offers. */
export function starterContext(scrollMargin?: number, extra: Partial<BuildContext> = {}): BuildContext {
  return levelContext(PERIMETER_LEVEL, scrollMargin, extra)
}

/** Round 1 of a level: its mission on its map, its construct menu and Nexus power pool what its campaign has
 *  unlocked by then (the mission deals round 1's hand from the pool), and its credits. */
export function levelContext(level: Level, scrollMargin?: number, extra: Partial<BuildContext> = {}): BuildContext {
  const map = MAPS[level.map]
  // The loader refused any level whose map the table does not have, so this is a level from elsewhere.
  if (map === undefined) throw new Error(`level "${level.id}" is played on the map "${level.map}", which the game does not have`)
  return missionPlay(level.mission).firstRound({
    grid: map.grid(),
    registry: FIXTURE_REGISTRY,
    catalog: constructMenu(level.offer),
    standing: map.standing,
    allotment: level.offer.credits,
    nexusDraft: nexusDraftOf(level.offer),
    powerPool: level.offer.powers,
    buildingCards: [...level.offer.buildings, ...level.offer.unlockable],
    edgeStyle: map.edgeStyle,
    ...(scrollMargin === undefined ? {} : { scrollMargin }),
    ...extra,
  })
}
