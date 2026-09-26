// The viewport and the camera — engine.md 3.3's scrolling rule.
//
// Pure arithmetic over tiles: a camera is a position in tiles, a viewport is a size in tiles, and
// what either looks like is `src/view`'s problem. That split is what lets the whole scrolling rule
// be tested without a TTY.

import type { Coord, GridTerrain } from "../grid/types.ts"

/** RULE (engine.md 3.3): below this the game is not playable and the renderer shows a resize gate. */
export const MIN_VIEWPORT = { width: 48, height: 16 } as const
/** RULE: nobody sees more Grid than this, however large their monitor. Fairness, and bounded
 *  arithmetic for every layout, cursor and scroll calculation downstream. */
export const MAX_VIEWPORT = { width: 72, height: 24 } as const
/** RULE that a margin exists; GUIDANCE on the number, which `--scroll-margin` can override. */
export const SCROLL_MARGIN = 3

/** The chrome the Grid pane does not get: engine.md 3.1's own 80-column arithmetic. */
export const PANEL_COLUMNS = 30
/** The top bar's one line, and the rule directly above the Grid that closes its rectangle. */
export const HEADER_ROWS = 2
/** The rule directly below the Grid, then the bottom bar's three lines: the position readout, the key
 *  help, and the status line. Canon 2.19 moved one row here from the header, whose two blank rows had
 *  left the Grid's own top edge three rows short of any line — why the cursor seemed to stop at "an
 *  arbitrary place" in the owner's playtest. */
export const FOOTER_ROWS = 4
/** Left border + right border. 1 + 48 + 1 + 30 = exactly 80 (engine.md 3.1). */
export const BORDER_COLUMNS = 2
/** Top border + header + footer + bottom border = engine.md 3.1's 8-row vertical chrome budget (Q12). */
export const CHROME_ROWS = BORDER_COLUMNS + HEADER_ROWS + FOOTER_ROWS

export type TileWidth = 1 | 2
export type Viewport = Readonly<{ width: number; height: number }>
/** The north-west tile of the viewport, in Grid tiles. */
export type Camera = Readonly<{ x: number; y: number }>
export type TerminalSize = Readonly<{ columns: number; rows: number }>

/**
 * How many tiles a terminal of this size has room for, once chrome is taken out. Step 1 of engine.md
 * 3.3's own fitting order, and deliberately allowed to come back negative-ish small: the caller
 * decides whether that means "gate" (below the minimum) or "centre the leftover" (above the maximum).
 */
export function availableTiles(terminal: TerminalSize, tileWidth: TileWidth): Viewport {
  return {
    width: Math.max(0, Math.floor((terminal.columns - BORDER_COLUMNS - PANEL_COLUMNS) / tileWidth)),
    height: Math.max(0, terminal.rows - CHROME_ROWS),
  }
}

/**
 * Step 2: two columns per tile if the terminal can show the viewport that way, otherwise one. This
 * and engine.md 9.3's "one column at 80, two at 128 or wider" agree by construction — 128 is exactly
 * the width at which two columns per tile still leaves room for the 48-tile minimum viewport.
 */
export function tileWidthFor(terminal: TerminalSize, grid: GridTerrain): TileWidth {
  const wanted = Math.min(MIN_VIEWPORT.width, grid.width)
  return availableTiles(terminal, 2).width >= wanted ? 2 : 1
}

/**
 * Step 4, asked as a question rather than acted on: is this terminal below the floor? A Grid smaller
 * than the minimum viewport needs only its own size, so a small tutorial Grid is never gated on a
 * terminal that could show all of it. Always asked at one column per tile — the narrow composition
 * is the acceptance target, and a terminal too small for the wide one simply uses the narrow one.
 */
export function isGated(terminal: TerminalSize, grid: GridTerrain): boolean {
  const available = availableTiles(terminal, 1)
  return (
    available.width < Math.min(MIN_VIEWPORT.width, grid.width) ||
    available.height < Math.min(MIN_VIEWPORT.height, grid.height)
  )
}

/** Step 3: `viewport = min(availableTiles, maximumViewport, gridSize)`, verbatim. */
export function fitViewport(
  terminal: TerminalSize,
  grid: GridTerrain,
  tileWidth: TileWidth,
): Viewport {
  const available = availableTiles(terminal, tileWidth)
  return {
    width: Math.min(available.width, MAX_VIEWPORT.width, grid.width),
    height: Math.min(available.height, MAX_VIEWPORT.height, grid.height),
  }
}

/** The camera is clamped so the viewport never leaves the Grid — engine.md 3.3's first bullet. */
export function clampCamera(camera: Camera, viewport: Viewport, grid: GridTerrain): Camera {
  return {
    x: Math.min(Math.max(0, camera.x), Math.max(0, grid.width - viewport.width)),
    y: Math.min(Math.max(0, camera.y), Math.max(0, grid.height - viewport.height)),
  }
}

/**
 * Where one axis of the camera wants to be, before the Grid's own edges get a say. The margin is a
 * *follow* rule, not an invariant: it says where the camera must be relative to the cursor when it
 * can be — no closer than `margin` tiles to either edge. Written as a range the camera is nudged
 * into rather than a position it is moved to, so a camera already inside the range does not twitch
 * every time the cursor moves one tile.
 */
function followAxis(camera: number, cursor: number, span: number, margin: number): number {
  const latest = cursor - margin
  const earliest = cursor - (span - 1 - margin)
  return Math.min(Math.max(camera, earliest), latest)
}

/**
 * **The whole scrolling interaction** — engine.md 3.3: "The cursor drives it. Move the cursor within
 * a scroll margin of 3 tiles of a viewport edge and the camera follows. That is the whole
 * interaction — no separate pan mode, no modifier keys, no second cursor."
 */
export function followCursor(
  camera: Camera,
  cursor: Coord,
  viewport: Viewport,
  grid: GridTerrain,
  margin: number = SCROLL_MARGIN,
): Camera {
  // The clamp is where the margin stops being honoured, and is right to: at the Grid's own edge the
  // camera has nowhere left to go, so the cursor reaches the edge of the screen because there is no
  // more Grid to reveal.
  return clampCamera(
    {
      x: followAxis(camera.x, cursor.x, viewport.width, margin),
      y: followAxis(camera.y, cursor.y, viewport.height, margin),
    },
    viewport,
    grid,
  )
}

export type VisibleRange = Readonly<{
  firstX: number
  lastX: number
  firstY: number
  lastY: number
}>

/** The inclusive tile range on screen, which the footer's position readout names — engine.md 3.3
 *  requires it, because there is no minimap and the player has to be told there is more Grid. */
export function visibleRange(camera: Camera, viewport: Viewport): VisibleRange {
  return {
    firstX: camera.x,
    lastX: camera.x + viewport.width - 1,
    firstY: camera.y,
    lastY: camera.y + viewport.height - 1,
  }
}

export type EdgeMarkers = Readonly<{
  north: boolean
  south: boolean
  west: boolean
  east: boolean
}>

/**
 * Which sides have more Grid beyond them — the other half of engine.md 3.3's required signal, drawn
 * on the frame border. A Grid that fits entirely inside the viewport gets none of them, which is
 * exactly what that rule asks for: "Small Grids that fit entirely inside the viewport never scroll
 * and show no edge markers."
 */
export function edgeMarkers(camera: Camera, viewport: Viewport, grid: GridTerrain): EdgeMarkers {
  const range = visibleRange(camera, viewport)
  return {
    north: range.firstY > 0,
    south: range.lastY < grid.height - 1,
    west: range.firstX > 0,
    east: range.lastX < grid.width - 1,
  }
}

/** Keeps a tile inside the Grid — every cursor move goes through this, so the cursor can never be
 *  somewhere the Grid is not. */
export function clampToGrid(tile: Coord, grid: GridTerrain): Coord {
  return {
    x: Math.min(Math.max(0, tile.x), grid.width - 1),
    y: Math.min(Math.max(0, tile.y), grid.height - 1),
  }
}
