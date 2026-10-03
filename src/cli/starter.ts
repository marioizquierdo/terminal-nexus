// The Build Phase's starter round: the mission the screen plays (PERIMETER) laid on the starter map, with
// the deck it plays.
//
// The starter map's pieces (the grid, what stands on it, its edge) are constants in `src/build/catalog.ts`;
// what the player can build and draft is the mission's deck (`src/content/armies.ts`, with the mission's
// override applied). Assembling them into round 1 needs the mission (`./pulse-run.ts`), which reaches the
// kernel, and `src/build` may never do that (`tests/architecture.test.ts`) — so the assembly lives here, in
// the application shell, beside the other half of the mission's connection.

import { constructMenu, nexusDraftOf, STARTER_EDGE_STYLE, STARTER_STANDING, starterGrid } from "../build/catalog.ts"
import type { BuildContext } from "../build/state.ts"
import { VASSE_ARMY } from "../content/armies.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { missionDeck } from "../mission/index.ts"
import type { MissionPlay } from "./pulse-run.ts"
import { STARTER_MISSION } from "./pulse-run.ts"

/** Round 1 of the mission the screen plays (PERIMETER), on the starter map, with the deck it plays. */
export function starterContext(scrollMargin?: number, extra: Partial<BuildContext> = {}): BuildContext {
  return missionContext(STARTER_MISSION, scrollMargin, extra)
}

/** Round 1 of any mission on the starter map, with the deck it plays: what it builds and drafts is its deck,
 *  its override applied; a mission that names no deck plays Vasse's whole one. */
export function missionContext(play: MissionPlay, scrollMargin?: number, extra: Partial<BuildContext> = {}): BuildContext {
  const deck = missionDeck(play.mission) ?? VASSE_ARMY
  return play.firstRound({
    grid: starterGrid(),
    registry: FIXTURE_REGISTRY,
    catalog: constructMenu(deck),
    standing: STARTER_STANDING,
    allotment: deck.allotment,
    nexusDraft: nexusDraftOf(deck),
    edgeStyle: STARTER_EDGE_STYLE,
    ...(scrollMargin === undefined ? {} : { scrollMargin }),
    ...extra,
  })
}
