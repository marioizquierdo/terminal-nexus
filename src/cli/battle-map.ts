// The Grid as a round opens, as an ASCII screenshot (`asciiScreenshot`, `src/view/ascii-screenshot.ts`): what the
// game's screen draws, cell for cell, with its ruler, legend and overlaps beside it. The brief's map for whoever prints
// it (the `skirmish` command); the battle itself never reaches the view (`DrawMap`, `src/battle/brief.ts`).

import type { BattleState, DrawMap, Side } from "../battle/index.ts"
import { battleGrid, mapOf, standingOf, titleOf } from "../battle/index.ts"
import type { ContentRegistry } from "../content/index.ts"
import { asciiScreenshot, asciiScreenshotLines } from "../view/ascii-screenshot.ts"

export const drawBattleMap: DrawMap = (state: BattleState, registry: (side: Side) => ContentRegistry) => {
  const entities = state.carried === null
    ? (["A", "B"] as const).flatMap((side) => standingOf(state, side).map((structure) => ({ contentId: structure.contentId, player: side, anchor: structure.anchor })))
    : state.carried.entities.map((entity) => ({ contentId: entity.contentId, player: entity.player as Side, anchor: entity.anchor }))
  // Each thing is drawn from its own side's content: the two armies are two registries.
  const both: ContentRegistry = {
    get: (id) => (registry("A").has(id) ? registry("A") : registry("B")).get(id),
    has: (id) => registry("A").has(id) || registry("B").has(id),
    ids: () => [...new Set([...registry("A").ids(), ...registry("B").ids()])],
  }
  return asciiScreenshotLines(
    asciiScreenshot(
      {
        grid: battleGrid(mapOf(state)),
        registry: both,
        state: { entities: entities.map((entity, ordinal) => ({ ...entity, ordinal })), groundItems: state.carried?.groundItems ?? [] },
        positions: new Map(),
      },
      { side: (player) => (player === "A" ? "p1" : "p2"), content: titleOf },
    ),
  )
}
