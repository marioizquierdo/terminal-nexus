// The viewport and the camera — the scrolling rule in docs/system-design/battlefield.md.
//
// Pure arithmetic over tiles: a camera is a position in tiles, a viewport is a size in tiles, and
// what either looks like is `src/view`'s problem. That split is what lets the whole scrolling rule
// be tested without a TTY.
//
// **A tile is one terminal column, at every terminal size.** A cell is about twice as tall as it is wide, and a row
// counts two columns in every distance (`ROW_DISTANCE`, src/engine/geometry/coords.ts), so a tile one column wide draws every
// reach as wide as it is tall on screen. A viewport's width in tiles is its width in columns, and a terminal wider
// than the largest viewport buys centring, never a wider tile.

import type { Coord, MapTerrain } from "../engine/geometry/types.ts"

/** RULE (docs/system-design/battlefield.md): below this the game is not playable and the renderer shows a resize gate. */
export const MIN_VIEWPORT = { width: 48, height: 16 } as const
/** RULE: nobody sees more map than this, however large their monitor. Fairness, and bounded
 *  arithmetic for every layout, cursor and scroll calculation downstream. */
export const MAX_VIEWPORT = { width: 72, height: 24 } as const
/**
 * The side panel's share of the terminal floor: the 80-column arithmetic in docs/system-design/battlefield.md
 * (1 + 30 + 48 + 1), which the resize gate measures against, so 80 × 24 is the floor.
 */
export const FLOOR_PANEL_COLUMNS = 30
/**
 * The columns the side panel actually takes: the panel and its divider, which **is** the battlefield's west
 * side, rather than a column of its own beside the divider (the owner's choice). The column that sharing saves goes to the battlefield: 49 tiles at 80 × 24, not 48.
 */
export const PANEL_COLUMNS = FLOOR_PANEL_COLUMNS - 1
/** The top bar's one line, and the rule directly above the battlefield that closes its rectangle. */
export const HEADER_ROWS = 2
/**
 * The rule directly below the battlefield, then the bottom bar's **one** line: the contextual line — what the
 * last key did when it said something, and otherwise what can be done where the keyboard is
 * (`src/build/help.ts`). The owner's call: "The bottom of the UI currently uses 3 rows. We have to
 * reduce that to 1 row". The position readout and the key help went, and the two rows they took went
 * to the battlefield. (The bottom bar was once four rows, after a row moved here from the header, whose two
 * blank rows had left the battlefield's own top edge three rows short of any line.)
 */
export const FOOTER_ROWS = 2
/** Left border + right border. 1 + 48 + 1 + 30 = exactly 80: the floor's arithmetic;
 *  since the shared west side the battlefield gets one more of those columns (`PANEL_COLUMNS`). */
export const BORDER_COLUMNS = 2
/** Top border + header + footer + bottom border: 6 rows now that the bottom bar is one line — 18 rows
 *  of battlefield at 80 × 24, where the 8-row budget of the floor (`FLOOR_CHROME_ROWS`) would leave 16. */
export const CHROME_ROWS = BORDER_COLUMNS + HEADER_ROWS + FOOTER_ROWS
/**
 * The vertical chrome the terminal floor is measured against: the 8-row budget in
 * docs/system-design/battlefield.md, which the
 * resize gate still uses, so 80 × 24 stays the floor and the acceptance target — the same move
 * `FLOOR_PANEL_COLUMNS` makes for the column the shared west side saved. The two rows the one-line
 * bottom bar saves go to the battlefield, never to a smaller floor.
 */
export const FLOOR_CHROME_ROWS = 8

export type Viewport = Readonly<{ width: number; height: number }>
/** The north-west tile of the viewport, in tiles. */
export type Camera = Readonly<{ x: number; y: number }>
export type TerminalSize = Readonly<{ columns: number; rows: number }>

/**
 * How many tiles a terminal of this size has room for once chrome is taken out, a tile to a column: the first
 * step of the fitting order in docs/system-design/battlefield.md. It may come back smaller than any viewport, zero at
 * the least: the caller decides whether that means "gate" (below the minimum) or "centre the leftover" (above
 * the maximum).
 */
export function availableTiles(
  terminal: TerminalSize,
  panelColumns: number = PANEL_COLUMNS,
  chromeRows: number = CHROME_ROWS,
): Viewport {
  return {
    width: Math.max(0, terminal.columns - BORDER_COLUMNS - panelColumns),
    height: Math.max(0, terminal.rows - chromeRows),
  }
}

/** Step 2: `viewport = min(availableTiles, maximumViewport, mapSize)`, verbatim. */
export function fitViewport(terminal: TerminalSize, terrain: MapTerrain): Viewport {
  const available = availableTiles(terminal)
  return {
    width: Math.min(available.width, MAX_VIEWPORT.width, terrain.width),
    height: Math.min(available.height, MAX_VIEWPORT.height, terrain.height),
  }
}

/**
 * Step 3, asked as a question rather than acted on: is this terminal below the floor? Measured against the
 * floor's own chrome (`FLOOR_PANEL_COLUMNS`, `FLOOR_CHROME_ROWS`), so the gate stays at 80 × 24 while the column
 * and the rows the frame saves go to the battlefield. A battlefield smaller than the minimum viewport needs only its own size,
 * so a small tutorial battlefield is never gated on a terminal that could show all of it.
 */
export function isGated(terminal: TerminalSize, terrain: MapTerrain): boolean {
  const available = availableTiles(terminal, FLOOR_PANEL_COLUMNS, FLOOR_CHROME_ROWS)
  return (
    available.width < Math.min(MIN_VIEWPORT.width, terrain.width) ||
    available.height < Math.min(MIN_VIEWPORT.height, terrain.height)
  )
}

/** The camera is clamped so the viewport never leaves the battlefield — the first bullet of the scrolling rule in docs/system-design/battlefield.md. */
export function clampCamera(camera: Camera, viewport: Viewport, terrain: MapTerrain): Camera {
  return {
    x: Math.min(Math.max(0, camera.x), Math.max(0, terrain.width - viewport.width)),
    y: Math.min(Math.max(0, camera.y), Math.max(0, terrain.height - viewport.height)),
  }
}

/**
 * Where one axis of the camera wants to be, before the battlefield's own edges get a say. The margin is a
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

/** The scroll margin in tiles along each axis — a share of the view's width and height
 *  (`marginForView`). RULE that a margin exists; GUIDANCE on its size, which `--scroll-margin` can
 *  override. */
export type Margin = Readonly<{ x: number; y: number }>

/**
 * **The whole scrolling interaction** (docs/system-design/battlefield.md): "The cursor drives it. Move the cursor within
 * a scroll margin ... of a viewport edge and the camera follows. That is the whole interaction — no
 * separate pan mode, no modifier keys, no second cursor." (The margin was 3 tiles when that was
 * written; it is a share of the view now.)
 */
export function followCursor(camera: Camera, cursor: Coord, viewport: Viewport, terrain: MapTerrain, margin: Margin): Camera {
  // The clamp is where the margin stops being honoured, and is right to: at the battlefield's own edge the
  // camera has nowhere left to go, so the cursor reaches the edge of the screen because there is no
  // more map to reveal.
  return clampCamera(
    {
      x: followAxis(camera.x, cursor.x, viewport.width, margin.x),
      y: followAxis(camera.y, cursor.y, viewport.height, margin.y),
    },
    viewport,
    terrain,
  )
}

/**
 * A share of a view's span as a whole number of tiles — the scroll margin ("it needs to be dependent
 * on the screen size, I feel like about 20% of the height or width", the owner).
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
 * **Recentring**: the camera moved so `tile` sits in the middle of the view,
 * clamped to the battlefield like every other camera — how a Battle Round looks at the player's Nexus. (The
 * fast move re-centred along the axis it moved, and an exploring click could re-centre too, until the
 * owner settled both Experiments the other way.)
 */
export function centreOn(tile: Coord, viewport: Viewport, terrain: MapTerrain): Camera {
  return clampCamera({ x: centredAxis(tile.x, viewport.width), y: centredAxis(tile.y, viewport.height) }, viewport, terrain)
}

/**
 * **Looking at several tiles at once**: the tile to look at (`centreOn` it) so the view shows as many of `tiles` as it
 * can — all of them when they fit. The candidates are the middle of the box that holds them all, then each tile in turn
 * (the order given); the one whose view holds the most wins, the first on a tie. `null` for no tiles. How the prelude
 * takes the view to the enemy's new buildings (`PulsePresenter.due`).
 */
export function lookAtMost(tiles: readonly Coord[], viewport: Viewport, terrain: MapTerrain): Coord | null {
  const first = tiles[0]
  if (first === undefined) return null
  const xs = tiles.map((tile) => tile.x)
  const ys = tiles.map((tile) => tile.y)
  const middle: Coord = { x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2), y: Math.round((Math.min(...ys) + Math.max(...ys)) / 2) }
  let best = middle
  let bestCount = -1
  for (const candidate of [middle, ...tiles]) {
    const range = visibleRange(centreOn(candidate, viewport, terrain), viewport)
    const count = tiles.filter((tile) => tile.x >= range.firstX && tile.x <= range.lastX && tile.y >= range.firstY && tile.y <= range.lastY).length
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

/**
 * One axis of an edge-zone click. `position` is the clicked tile's place in the view (0 is the first
 * column or row). Inside a zone `zone` tiles deep at either end, the tile is carried toward the
 * middle by the share of the zone the click was into: at the very edge all the way to the middle, at
 * the zone's inner boundary not at all, and in proportion between — so a click two rows from the
 * edge scrolls much further than a click five rows in (the owner's request).
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

/** Where a click on the map inside an edge zone moves the camera, a building armed or
 *  not: see `edgeAxis`. The zone is a percentage of the view along each axis. Clamped to the battlefield. */
export function edgeClickCamera(
  camera: Camera,
  tile: Coord,
  viewport: Viewport,
  terrain: MapTerrain,
  zonePercent: number,
): Camera {
  const zone = marginForView(zonePercent, viewport)
  return clampCamera(
    {
      x: edgeAxis(camera.x, tile.x, viewport.width, zone.x),
      y: edgeAxis(camera.y, tile.y, viewport.height, zone.y),
    },
    viewport,
    terrain,
  )
}

export type VisibleRange = Readonly<{
  firstX: number
  lastX: number
  firstY: number
  lastY: number
}>

/** The inclusive tile range on screen: what the map draws, and — with the battlefield's own size — which
 *  of its sides have more map beyond them (`edgeMarkers`). A position readout in the footer named it
 *  until the owner took the readout out; the sides' weight is the signal. */
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
 * Which sides have more map beyond them — the required "there is more map" signal of docs/system-design/battlefield.md, drawn
 * on the frame border. A battlefield that fits entirely inside the viewport gets none of them, which is
 * exactly what that rule asks for: "Small battlefields that fit entirely inside the viewport never scroll
 * and show no edge markers."
 */
export function edgeMarkers(camera: Camera, viewport: Viewport, terrain: MapTerrain): EdgeMarkers {
  const range = visibleRange(camera, viewport)
  return {
    north: range.firstY > 0,
    south: range.lastY < terrain.height - 1,
    west: range.firstX > 0,
    east: range.lastX < terrain.width - 1,
  }
}

/** Keeps a tile inside the battlefield — every cursor move goes through this, so the cursor can never be
 *  somewhere the battlefield is not. */
export function clampToMap(tile: Coord, terrain: MapTerrain): Coord {
  return {
    x: Math.min(Math.max(0, tile.x), terrain.width - 1),
    y: Math.min(Math.max(0, tile.y), terrain.height - 1),
  }
}
