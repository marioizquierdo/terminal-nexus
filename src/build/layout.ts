// Where everything is on screen — the one geometry the composer (drawing) and the mouse adapter
// (hit-testing) both read, so a click can never target a tile or a row the frame did not draw there.
// `src/menu/layout.ts` is the same idea for the menu.

import type { MenuLayout } from "../menu/layout.ts"
import type { MenuItem } from "../menu/types.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import type { ConstructGroup, ConstructItem, MenuEntry } from "./types.ts"
import type { Camera, TerminalSize, TileWidth, Viewport } from "./camera.ts"
import {
  BORDER_COLUMNS,
  FOOTER_ROWS,
  HEADER_ROWS,
  MIN_VIEWPORT,
  PANEL_COLUMNS,
  availableTiles,
  fitViewport,
  tileWidthFor,
} from "./camera.ts"

export type BuildLayout = Readonly<{
  /** The whole frame, which is the whole terminal: a frame the size of the screen overwrites
   *  everything on it, so growing the window never leaves a stale strip behind. */
  frame: Readonly<{ width: number; height: number }>
  /** Border, panel and Grid pane together — the 1 + 30 + 48 + 1 arithmetic of engine.md 3.1, the
   *  panel on the left since gate 5F. */
  composition: Readonly<{ width: number; height: number }>
  /** Where that composition sits inside the frame. Terminal space beyond the maximum viewport is
   *  spent on centring — engine.md 3.3, "never on more Grid". */
  offset: Readonly<{ column: number; row: number }>
  viewport: Viewport
  tileWidth: TileWidth
  /** Frame cell of the viewport's own north-west tile. */
  origin: Readonly<{ column: number; row: number }>
  /**
   * The four lines that close the Grid pane into a rectangle of its own, as frame rows and columns:
   * a rule directly above the Grid and one directly below it (each running the whole width, so the
   * top bar and the bottom bar read as bars), the divider on its left and the frame's own border on
   * its right. These are the sides that carry engine.md 3.3's "there is more Grid this way" signal,
   * because they are where the Grid actually stops.
   */
  gridBox: Readonly<{ top: number; bottom: number; left: number; right: number }>
  /**
   * Frame row of the full-width rule over the bottom bar. The same row as `gridBox.bottom` whenever
   * the Grid fills the pane; below it when the Grid is shorter than the panel needs (gate 5F), and
   * then the Grid's own bottom edge is a line across the Grid pane alone, so its rectangle is still
   * closed directly under its last row.
   */
  paneBottom: number
  /** Frame column of the vertical rule between the side panel and the Grid pane. It runs only between
   *  the two rules, so the top bar and the bottom bar each run the whole width (engine.md 9.2). */
  dividerColumn: number
  /** Frame column the side panel's own text starts at — one blank column in from the frame's left
   *  border — and how many glyphs fit on one of its rows, which end against the divider. */
  panelColumn: number
  panelLimit: number
  /** How many glyphs fit on the top bar's one line, which runs the whole width. */
  headerLimit: number
  /** How many glyphs fit on one footer row, which runs the full width beneath both panes. */
  footerLimit: number
  /** Frame row the bottom bar's three lines start at — the first row below the Grid's own bottom
   *  rule: the position readout, then the key help, then the status line. */
  footerRow: number
  /** Frame row the panel's first line is drawn on — the first row under the rule that closes the
   *  Grid's top, so the panel and the Grid start together. */
  panelRow: number
  /** Frame row the panel's last binding sits on — its last usable line, so the bindings do not move
   *  as the rest of the panel grows and shrinks with what the player is doing. */
  panelBindingsRow: number
}>

/** The panel's own rows, counted from its first (gate 5F). Row 0 is the "Nexus Powers" entry — the
 *  owner asked for it at the top of the menu; row 2 is what the player has to spend, directly above
 *  the costs it is measured against; the construct groups start on row 4. */
export const NEXUS_ROW = 0
export const RESOURCE_ROW = 2
const CONSTRUCT_FIRST_ROW = 4

/** The order the construct groups are drawn in — `commander-armies.md` Section 2.1's own order: the
 *  faction's common structures first, then what makes one Commander's package its own. */
export const CONSTRUCT_GROUPS: readonly ConstructGroup[] = ["common", "army"]

/**
 * One line of the construct block, computed once and read by both the composer and the mouse
 * adapter. A list split into labelled groups has no uniform row step, so the rows are enumerated
 * rather than multiplied out.
 *
 * An empty group is **drawn, not skipped** (engine.md 9.2's RULE: a group that vanishes reflows the
 * panel and moves every row below it the first time it fills) — as one line, its label with "none
 * available" beside it, the same one-line form the SPECIAL row already has. The panel lost two rows
 * when the top bar became the whole width (gate 5F), and a one-line fact needs no line of its own for
 * a heading.
 */
export type ConstructLine =
  | Readonly<{ kind: "group"; row: number; group: ConstructGroup }>
  | Readonly<{ kind: "item"; row: number; index: number }>
  | Readonly<{ kind: "empty"; row: number; group: ConstructGroup }>

/** The construct lines, and the row just past them — where the SPECIAL row goes. A group with rows
 *  is a list, and gets a blank line after it; an empty group is a one-line fact, and stacks directly
 *  on whatever follows, the way SPECIAL stacks under it. */
function constructBlock(
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
): Readonly<{ lines: readonly ConstructLine[]; next: number }> {
  const lines: ConstructLine[] = []
  let row = layout.panelRow + CONSTRUCT_FIRST_ROW
  for (const group of CONSTRUCT_GROUPS) {
    const members = catalog
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.group === group)
    if (members.length === 0) {
      lines.push({ kind: "empty", row, group })
      row += 1
      continue
    }
    lines.push({ kind: "group", row, group })
    row += 1
    for (const { index } of members) {
      lines.push({ kind: "item", row, index })
      row += 1
    }
    row += 1
  }
  return { lines, next: row }
}

export function constructLines(
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
): readonly ConstructLine[] {
  return constructBlock(layout, catalog).lines
}

/**
 * The panel's SPECIAL row, directly under the construct block — the last of `commander-armies.md`
 * Section 2.1's four Build Phase places to be drawn (the Nexus powers have the menu's top entry since
 * gate 5F, so the NEXUS summary row gate 5D drew here is gone). Read by the composer, and by the
 * bindings block that grows up from the panel's bottom, which must stop short of it.
 */
export function summaryRows(
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
): Readonly<{ special: number }> {
  return { special: constructBlock(layout, catalog).next }
}

/** The frame row a menu entry is drawn on. */
export function menuEntryRow(
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
  entry: MenuEntry,
): number | null {
  if (entry.kind === "nexus") return layout.panelRow + NEXUS_ROW
  for (const line of constructLines(layout, catalog)) {
    if (line.kind === "item" && line.index === entry.index) return line.row
  }
  return null
}

/**
 * The menu entry at a frame cell, or `null` when the cell hits none. **The whole panel row is the
 * target**, not only its label: since gate 5F a highlighted row is drawn as a bar across the panel's
 * full width, and a row that looks like one bar but only answers on half of it is a row that
 * sometimes ignores a click.
 */
export function menuEntryAt(
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
  column: number,
  row: number,
): MenuEntry | null {
  if (column < layout.panelColumn || column >= layout.panelColumn + layout.panelLimit) return null
  if (row === layout.panelRow + NEXUS_ROW) return { kind: "nexus" }
  for (const line of constructLines(layout, catalog)) {
    if (line.kind === "item" && line.row === row) return { kind: "construct", index: line.index }
  }
  return null
}

/**
 * The Nexus Powers popup — the game's first overlay (gate 5F), centred over the Grid pane and drawn
 * above everything on it. Its geometry lives here, beside the panel's, because the mouse adapter
 * hit-tests it exactly as it hit-tests a construct row: one function, read by both the composer and
 * the adapter, so a click can never land on an option the frame did not draw there.
 *
 * Deliberately not a general overlay: gate 5G's Debug Mode is the second overlay, and the shape the
 * two share is extracted then, from two real uses rather than one guess.
 */
export type NexusPopupLayout = Readonly<{
  box: Readonly<{ left: number; top: number; right: number; bottom: number }>
  /** Where the popup's own text starts, and how much of it fits on a row. */
  textColumn: number
  textLimit: number
  /** "PICK ONE", or "nothing waiting" under it when the pick is made. */
  pendingHeadingRow: number
  /** One per pending power: its hotkey-and-name row. Its description is the row below. */
  pendingRows: readonly number[]
  activeHeadingRow: number
  /** One per active power: its name row. Its description is the row below. */
  activeRows: readonly number[]
  /** `[esc] Close`, clickable — the one way out a mouse-only player can see. */
  closeRow: number
}>

/** The popup's width: wide enough for a power's name and its one line of description with room to
 *  spare, and never wider than the Grid pane it sits over. */
const POPUP_WIDTH = 44

export function nexusPopupLayout(
  layout: BuildLayout,
  pendingCount: number,
  activeCount: number,
): NexusPopupLayout {
  const paneWidth = layout.gridBox.right - layout.gridBox.left - 1
  const width = Math.min(POPUP_WIDTH, Math.max(20, paneWidth - 4))
  // Border, blank, heading, the pending block, blank, heading, the active block, blank, close,
  // border. An empty block is one row: its "nothing waiting" / "none yet" line.
  const pendingBlock = Math.max(1, pendingCount * 2)
  const activeBlock = Math.max(1, activeCount * 2)
  const height = 1 + 1 + 1 + pendingBlock + 1 + 1 + activeBlock + 1 + 1 + 1
  // Centred in the pane between the two full-width rules, which is the Grid's own height except on a
  // Grid shorter than the panel.
  const paneHeight = layout.paneBottom - layout.gridBox.top - 1
  const left = layout.gridBox.left + 1 + Math.floor((paneWidth - width) / 2)
  const top = Math.max(layout.offset.row + 1, layout.gridBox.top + 1 + Math.floor((paneHeight - height) / 2))
  const textColumn = left + 2
  const pendingHeadingRow = top + 2
  const pendingRows = Array.from({ length: pendingCount }, (_, index) => pendingHeadingRow + 1 + index * 2)
  const activeHeadingRow = pendingHeadingRow + 1 + pendingBlock + 1
  const activeRows = Array.from({ length: activeCount }, (_, index) => activeHeadingRow + 1 + index * 2)
  const closeRow = activeHeadingRow + 1 + activeBlock + 1
  return {
    box: { left, top, right: left + width - 1, bottom: closeRow + 1 },
    textColumn,
    textLimit: width - 4,
    pendingHeadingRow,
    pendingRows,
    activeHeadingRow,
    activeRows,
    closeRow,
  }
}

/** What a click inside the popup means: a pending power (either of its two rows), the close row, or
 *  nothing. A click outside the popup is `"outside"` — the popup holds the mouse as well as the
 *  keyboard, so the caller ignores it rather than letting it reach the Grid underneath. */
export type PopupHit =
  | Readonly<{ kind: "pending"; index: number }>
  | Readonly<{ kind: "close" }>
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "outside" }>

export function popupHitAt(popup: NexusPopupLayout, column: number, row: number): PopupHit {
  const { box } = popup
  if (column < box.left || column > box.right || row < box.top || row > box.bottom) return { kind: "outside" }
  if (column < popup.textColumn || column >= popup.textColumn + popup.textLimit) return { kind: "none" }
  const index = popup.pendingRows.findIndex((first) => row === first || row === first + 1)
  if (index >= 0) return { kind: "pending", index }
  if (row === popup.closeRow) return { kind: "close" }
  return { kind: "none" }
}

/** The commit confirmation's own two rows — `y`/`n`, never digits, per engine.md 9.7's own line for
 *  `p`: "asks once, [y]es/[n]o." */
export function confirmLayout(layout: BuildLayout): MenuLayout {
  return { column: layout.panelColumn, row: layout.panelRow + 2, rowStep: 1 }
}

export const CONFIRM_ITEMS: readonly MenuItem[] = [
  { id: "yes", hotkey: "y", label: "Yes, start the Pulse" },
  { id: "no", hotkey: "n", label: "No, keep building" },
]

export function buildLayout(terminal: TerminalSize, grid: GridTerrain): BuildLayout {
  const tileWidth = tileWidthFor(terminal, grid)
  const viewport = fitViewport(terminal, grid, tileWidth)
  // The pane between the two full-width rules is as tall as the viewport — but never shorter than
  // the minimum viewport's 16 rows while the terminal has them, because the side panel is designed at
  // that height and, since the top bar runs the whole width (gate 5F), has no rows beside it to
  // borrow. A Grid smaller than the minimum viewport is still never gated (engine.md 3.3); it just
  // sits in the top of a pane taller than itself, closed by its own bottom edge.
  const paneHeight = Math.max(viewport.height, Math.min(MIN_VIEWPORT.height, availableTiles(terminal, 1).height))
  const composition = {
    width: BORDER_COLUMNS + PANEL_COLUMNS + viewport.width * tileWidth,
    height: BORDER_COLUMNS + HEADER_ROWS + paneHeight + FOOTER_ROWS,
  }
  const frame = { width: Math.max(terminal.columns, composition.width), height: Math.max(terminal.rows, composition.height) }
  const offset = {
    column: Math.floor((frame.width - composition.width) / 2),
    row: Math.floor((frame.height - composition.height) / 2),
  }
  // The side panel on the left (gate 5F; engine.md 9.2): the frame's left border, the panel's 29
  // columns, the divider, then the Grid pane and the frame's right border — the same 30 columns of
  // panel-and-divider gate 5A-5E drew on the right, mirrored.
  const dividerColumn = offset.column + PANEL_COLUMNS
  const origin = { column: dividerColumn + 1, row: offset.row + 1 + HEADER_ROWS }
  const right = offset.column + composition.width - 1
  const gridBox = {
    top: origin.row - 1,
    bottom: origin.row + viewport.height,
    left: dividerColumn,
    right,
  }
  const paneBottom = origin.row + paneHeight
  const panelColumn = offset.column + 2
  return {
    frame,
    composition,
    offset,
    viewport,
    tileWidth,
    origin,
    gridBox,
    paneBottom,
    dividerColumn,
    panelColumn,
    panelLimit: dividerColumn - panelColumn,
    headerLimit: composition.width - 4,
    footerLimit: composition.width - 4,
    footerRow: paneBottom + 1,
    panelRow: gridBox.top + 1,
    panelBindingsRow: paneBottom - 1,
  }
}

/** The frame cell a Grid tile is drawn at — the composer's direction of travel. */
export function cellForTile(layout: BuildLayout, camera: Camera, tile: Coord): Coord {
  return {
    x: layout.origin.column + (tile.x - camera.x) * layout.tileWidth,
    y: layout.origin.row + (tile.y - camera.y),
  }
}

/**
 * The Grid tile at a frame cell, or `null` when the cell is not on the Grid pane at all — the mouse
 * adapter's direction of travel, and the only place a terminal coordinate ever becomes a tile.
 */
export function tileAtCell(
  layout: BuildLayout,
  camera: Camera,
  column: number,
  row: number,
): Coord | null {
  const relativeColumn = column - layout.origin.column
  const relativeRow = row - layout.origin.row
  if (relativeColumn < 0 || relativeRow < 0) return null
  if (relativeRow >= layout.viewport.height) return null
  const tileX = Math.floor(relativeColumn / layout.tileWidth)
  if (tileX >= layout.viewport.width) return null
  return { x: camera.x + tileX, y: camera.y + relativeRow }
}
