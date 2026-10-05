// The Ground Experiment's choices, as the rules and the screen read them (the Commander round 6). A terminal cell
// is about twice as tall as it is wide; each choice is one way to make a reach and a walk look as they play:
//
//   as now        the rules as they always were, and a tile one column wide (two at 128 columns or wider)
//   rows x2       a row counts two columns in every distance, and a step up or down takes twice as long
//   sideways x2   the same count with every content number doubled in it: up and down as now, across doubled
//   square tiles  the rules as now, every tile drawn two columns wide
//
// What a choice means for the rules is its `GridMeasure` (`src/grid/types.ts`), which a battle carries in its
// state; what it means for the screen is how many columns a tile is drawn. The two never mix: with a row
// counting two, a tile two columns wide would draw every reach twice as wide as it is tall.
//
// Pure data, read by the Build Phase, the view and the application shell alike.

import { SQUARE } from "../grid/coords.ts"
import type { GridMeasure } from "../grid/types.ts"
import type { TileWidth } from "./camera.ts"

/** The choices, in the order Settings walks them. */
export const GROUNDS = ["as-now", "rows-x2", "sideways-x2", "square-tiles"] as const

export type Ground = (typeof GROUNDS)[number]

const ROWS_DOUBLE: GridMeasure = { row: 2, tile: 1 }
const SIDEWAYS_DOUBLE: GridMeasure = { row: 2, tile: 2 }

/** How the rules measure the Grid under a choice: `SQUARE` as now and with square tiles. */
export function measureOf(ground: Ground): GridMeasure {
  switch (ground) {
    case "rows-x2":
      return ROWS_DOUBLE
    case "sideways-x2":
      return SIDEWAYS_DOUBLE
    case "as-now":
    case "square-tiles":
      return SQUARE
  }
}

/** How many columns a tile is drawn under a choice, or `null` where the terminal's width decides, as it always
 *  has (`tileWidthFor`, `src/build/camera.ts`). */
export function tileWidthOf(ground: Ground): TileWidth | null {
  switch (ground) {
    case "square-tiles":
      return 2
    case "rows-x2":
    case "sideways-x2":
      return 1
    case "as-now":
      return null
  }
}
