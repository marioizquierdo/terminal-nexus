// A level's first round, ready for the Build Phase: its mission laid on its map, offering what its campaign has
// unlocked by then, with its credits — and the starter round, PERIMETER's, which the screen opens on.
//
// The level is its campaign's army's (`src/armies`); its map is the map table's (`src/build/maps.ts`); what it
// offers becomes the construct menu and the Nexus draft in `src/build/catalog.ts`. Assembling them into round 1
// needs the mission (`./pulse-run.ts`), which reaches the kernel, and `src/build` may never do that
// (`tests/architecture.test.ts`) — so the assembly lives here, in the application shell, beside the other half of
// the mission's connection.

import { constructMenu, nexusDraftOf } from "../build/catalog.ts"
import { MAPS } from "../build/maps.ts"
import type { BuildContext } from "../build/state.ts"
import type { Level } from "../armies/index.ts"
import { PERIMETER_LEVEL } from "../armies/index.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import type { MissionPlay } from "./pulse-run.ts"
import { missionPlay, STARTER_MISSION } from "./pulse-run.ts"

/** Round 1 of the mission the screen plays (PERIMETER, Vasse's first level), on the starter map, with what it offers. */
export function starterContext(scrollMargin?: number, extra: Partial<BuildContext> = {}): BuildContext {
  return levelContext(PERIMETER_LEVEL, STARTER_MISSION, scrollMargin, extra)
}

/**
 * Round 1 of a level: its mission on its map, its construct menu and Nexus draft what its campaign has unlocked by
 * then, and its credits. `play` is the level's mission's connection, made from it unless one is given.
 */
export function levelContext(level: Level, play: MissionPlay = missionPlay(level.mission), scrollMargin?: number, extra: Partial<BuildContext> = {}): BuildContext {
  const map = MAPS[level.map]
  // The loader refused any level whose map the table does not have, so this is a level from elsewhere.
  if (map === undefined) throw new Error(`level "${level.id}" is played on the map "${level.map}", which the game does not have`)
  return play.firstRound({
    grid: map.grid(),
    registry: FIXTURE_REGISTRY,
    catalog: constructMenu(level.offer),
    standing: map.standing,
    allotment: level.offer.credits,
    nexusDraft: nexusDraftOf(level.offer),
    edgeStyle: map.edgeStyle,
    ...(scrollMargin === undefined ? {} : { scrollMargin }),
    ...extra,
  })
}
