// The Build Phase's starter round: the mission the screen plays (PERIMETER) laid on the starter map.
//
// The starter map's pieces (the grid, what stands on it, the catalog, the allotment) are constants in
// `src/build/catalog.ts`. Assembling them into round 1 needs the mission (`./pulse-run.ts`), which
// reaches the kernel, and `src/build` may never do that (`tests/architecture.test.ts`) — so the
// assembly lives here, in the application shell, beside the other half of the mission's connection.

import {
  STARTER_ALLOTMENT,
  STARTER_CATALOG,
  STARTER_EDGE_STYLE,
  STARTER_NEXUS_DRAFT,
  STARTER_STANDING,
  starterGrid,
} from "../build/catalog.ts"
import type { BuildContext } from "../build/state.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { STARTER_MISSION } from "./pulse-run.ts"

/** Round 1 of the mission the screen plays (PERIMETER), on the starter map. */
export function starterContext(scrollMargin?: number, extra: Partial<BuildContext> = {}): BuildContext {
  return STARTER_MISSION.firstRound({
    grid: starterGrid(),
    registry: FIXTURE_REGISTRY,
    catalog: STARTER_CATALOG,
    standing: STARTER_STANDING,
    allotment: STARTER_ALLOTMENT,
    nexusDraft: STARTER_NEXUS_DRAFT,
    edgeStyle: STARTER_EDGE_STYLE,
    ...(scrollMargin === undefined ? {} : { scrollMargin }),
    ...extra,
  })
}
