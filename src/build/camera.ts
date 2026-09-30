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
/**
 * The side panel's share of the terminal floor: engine.md 3.1's own 80-column arithmetic
 * (1 + 30 + 48 + 1), which the resize gate and the choice of tile width still measure against — so
 * 80 × 24 stays the floor and 128 columns stays where tiles go two columns wide.
 */
export const FLOOR_PANEL_COLUMNS = 30
/**
 * The columns the side panel actually takes: the panel and its divider, which **is** the Grid's west
 * side (the owner's choice of 2026-09-29, feedback F25, replacing a column of its own beside the
 * divider, F17). The column that sharing saves goes to the Grid: 49 tiles at 80 × 24, not 48.
 */
export const PANEL_COLUMNS = FLOOR_PANEL_COLUMNS - 1
/** The top bar's one line, and the rule directly above the Grid that closes its rectangle. */
export const HEADER_ROWS = 2
/**
 * The rule directly below the Grid, then the bottom bar's **one** line: the contextual line — what the
 * last key did when it said something, and otherwise what can be done where the keyboard is
 * (`src/build/help.ts`). The owner's call (2026-09-30, feedback F59: "The bottom of the UI currently
 * uses 3 rows. We have to reduce that to 1 row"): the position readout and the key help went, and the
 * two rows they took went to the Grid. It was four rows from canon 2.19, which moved one here from the
 * header, whose two blank rows had left the Grid's own top edge three rows short of any line.
 */
export const FOOTER_ROWS = 2
/** Left border + right border. 1 + 48 + 1 + 30 = exactly 80 (engine.md 3.1): the floor's arithmetic;
 *  since the shared west side the Grid gets one more of those columns (`PANEL_COLUMNS`). */
export const BORDER_COLUMNS = 2
/** Top border + header + footer + bottom border: 6 rows since the bottom bar became one line (feedback
 *  F59) — 18 rows of Grid at 80 × 24, where the 8-row budget of engine.md 3.1 (Q12) left 16. */
export const CHROME_ROWS = BORDER_COLUMNS + HEADER_ROWS + FOOTER_ROWS
/**
 * The vertical chrome the terminal floor is measured against: engine.md 3.1's 8-row budget, which the
 * resize gate still uses, so 80 × 24 stays the floor and the acceptance target — the same move
 * `FLOOR_PANEL_COLUMNS` makes for the column the shared west side saved. The two rows the one-line
 * bottom bar saves go to the Grid, never to a smaller floor.
 */
export const FLOOR_CHROME_ROWS = 8

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
export function availableTiles(
  terminal: TerminalSize,
  tileWidth: TileWidth,
  panelColumns: number = PANEL_COLUMNS,
  chromeRows: number = CHROME_ROWS,
): Viewport {
  return {
    width: Math.max(0, Math.floor((terminal.columns - BORDER_COLUMNS - panelColumns) / tileWidth)),
    height: Math.max(0, terminal.rows - chromeRows),
  }
}

/**
 * Step 2: two columns per tile if the terminal can show the viewport that way, otherwise one. This
 * and engine.md 9.3's "one column at 80, two at 128 or wider" agree by construction — 128 is exactly
 * the width at which two columns per tile still leaves room for the 48-tile minimum viewport.
 */
export function tileWidthFor(terminal: TerminalSize, grid: GridTerrain): TileWidth {
  const wanted = Math.min(MIN_VIEWPORT.width, grid.width)
  return availableTiles(terminal, 2, FLOOR_PANEL_COLUMNS).width >= wanted ? 2 : 1
}

/**
 * Step 4, asked as a question rather than acted on: is this terminal below the floor? A Grid smaller
 * than the minimum viewport needs only its own size, so a small tutorial Grid is never gated on a
 * terminal that could show all of it. Always asked at one column per tile — the narrow composition
 * is the acceptance target, and a terminal too small for the wide one simply uses the narrow one —
 * and against the floor's own chrome (`FLOOR_PANEL_COLUMNS`, `FLOOR_CHROME_ROWS`), so the gate stays
 * at 80 × 24 while the columns and rows the frame has since saved go to the Grid.
 */
export function isGated(terminal: TerminalSize, grid: GridTerrain): boolean {
  const available = availableTiles(terminal, 1, FLOOR_PANEL_COLUMNS, FLOOR_CHROME_ROWS)
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

/** The scroll margin in tiles along each axis — a share of the view's width and height since gate 5H
 *  (`marginForView`). RULE that a margin exists; GUIDANCE on its size, which `--scroll-margin` can
 *  override. */
export type Margin = Readonly<{ x: number; y: number }>

/**
 * **The whole scrolling interaction** — engine.md 3.3: "The cursor drives it. Move the cursor within
 * a scroll margin ... of a viewport edge and the camera follows. That is the whole interaction — no
 * separate pan mode, no modifier keys, no second cursor." (The margin was 3 tiles when that was
 * written; it is a share of the view now.)
 */
export function followCursor(camera: Camera, cursor: Coord, viewport: Viewport, grid: GridTerrain, margin: Margin): Camera {
  // The clamp is where the margin stops being honoured, and is right to: at the Grid's own edge the
  // camera has nowhere left to go, so the cursor reaches the edge of the screen because there is no
  // more Grid to reveal.
  return clampCamera(
    {
      x: followAxis(camera.x, cursor.x, viewport.width, margin.x),
      y: followAxis(camera.y, cursor.y, viewport.height, margin.y),
    },
    viewport,
    grid,
  )
}

/**
 * A share of a view's span as a whole number of tiles — the scroll margin since gate 5H ("it needs to
 * be dependent on the screen size, I feel like about 20% of the height or width", owner, 2026-09-26).
 * Rounded to the nearest tile, and never so large that the two margins of one axis meet: a margin
 * past the middle would leave the cursor nowhere to be without the camera moving, and the camera
 * would twitch on every step.
 */
export function shareOfSpan(percent: number, span: number): number {
  const tiles = Math.round((span * Math.max(0, percent)) / 100)
  return Math.max(0, Math.min(tiles, Math.floor((span - 1) / 2)))
}

/** The scroll margin in tiles along each axis for a margin given as a percentage of the view: 20% of a
 *  48 x 16 view, say, is 10 tiles to either side and 3 above and below. */
export function marginForView(percent: number, viewport: Viewport): Margin {
  return { x: shareOfSpan(percent, viewport.width), y: shareOfSpan(percent, viewport.height) }
}

/** The camera position along one axis that puts `tile` in the middle of a view `span` wide. */
function centredAxis(tile: number, span: number): number {
  return tile - Math.floor((span - 1) / 2)
}

/**
 * **Recentring** (engine.md 3.3, gate 5H): the camera moved so `tile` sits in the middle of the view,
 * clamped to the Grid like every other camera — how a Nexus Pulse looks at the player's Nexus. (The
 * fast move re-centred along the axis it moved, and an exploring click could re-centre too, until the
 * owner settled both Experiments the other way, 2026-09-30.)
 */
export function centreOn(tile: Coord, viewport: Viewport, grid: GridTerrain): Camera {
  return clampCamera({ x: centredAxis(tile.x, viewport.width), y: centredAxis(tile.y, viewport.height) }, viewport, grid)
}

/**
 * One axis of an edge-zone click. `position` is the clicked tile's place in the view (0 is the first
 * column or row). Inside a zone `zone` tiles deep at either end, the tile is carried toward the
 * middle by the share of the zone the click was into: at the very edge all the way to the middle, at
 * the zone's inner boundary not at all, and in proportion between — so a click two rows from the
 * edge scrolls much further than a click five rows in (owner, feedback F6).
 */
function edgeAxis(camera: number, tile: number, span: number, zone: number): number {
  if (zone <= 0) return camera
  const position = tile - camera
  const middle = Math.floor((span - 1) / 2)
  const fromNear = position
  const fromFar = span - 1 - position
  if (fromNear < zone && position < middle) {
    const depth = (zone - fromNear) / zone
    const target = position + depth * (middle - position)
    return tile - Math.round(target)
  }
  if (fromFar < zone && position > middle) {
    const depth = (zone - fromFar) / zone
    const target = position - depth * (position - middle)
    return tile - Math.round(target)
  }
  return camera
}

/** Where an exploring click inside an edge zone moves the camera (feedback F6): see `edgeAxis`. The
 *  zone is a percentage of the view along each axis. Clamped to the Grid. */
export function edgeClickCamera(
  camera: Camera,
  tile: Coord,
  viewport: Viewport,
  grid: GridTerrain,
  zonePercent: number,
): Camera {
  const zone = marginForView(zonePercent, viewport)
  return clampCamera(
    {
      x: edgeAxis(camera.x, tile.x, viewport.width, zone.x),
      y: edgeAxis(camera.y, tile.y, viewport.height, zone.y),
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

/** The inclusive tile range on screen: what the Grid pane draws, and — with the Grid's own size — which
 *  of its sides have more Grid beyond them (`edgeMarkers`). A position readout in the footer named it
 *  until the owner took the readout out (2026-09-30, feedback F59); the sides' weight is the signal. */
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
 * Which sides have more Grid beyond them — engine.md 3.3's required "there is more Grid" signal, drawn
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
