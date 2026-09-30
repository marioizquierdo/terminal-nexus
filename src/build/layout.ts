// Where everything is on screen — the one geometry the composer (drawing) and the mouse adapter
// (hit-testing) both read, so a click can never target a tile or a row the frame did not draw there.
// `src/menu/layout.ts` is the same idea for the menu.

import type { Coord, GridTerrain } from "../grid/types.ts"
import type { PlaybackControl } from "../view/playback.ts"
import type { BuildState } from "./state.ts"
import { EXPLORE_ENTRY, NEXUS_ENTRY, entryOfConstruct, mapMode, startEntry } from "./state.ts"
import type { ConstructItem, MenuEntry } from "./types.ts"
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
  /** Border, panel and Grid pane together — 1 + 29 + 49 + 1 at 80 columns (engine.md 3.1's
   *  1 + 30 + 48 + 1, with the shared west side's column given to the Grid), the panel on the left
   *  since gate 5F. */
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
  /** Where the top bar's Esc label ends, right-aligned — "menu [esc]", "back [esc]" or "close [esc]",
   *  saying what Esc does right now (feedback F37): drawn there, and its click target, which sends
   *  exactly what Esc sends. `escLabelEnd` gives the columns a given label covers. It replaced gate 5G's
   *  `[d] debug`, then 5J's fixed `[esc] menu`. */
  escLabelEnd: Readonly<{ row: number; to: number }>
  /** How many glyphs fit on the bottom bar's line, which runs the full width beneath both panes. */
  footerLimit: number
  /** Frame row of the bottom bar's one line — the first row below the Grid's own bottom rule: the
   *  contextual line, the last command's answer or a hint for where the keyboard is (feedback F59,
   *  `src/build/help.ts`). Three lines until then: a position readout, the key help, the status line. */
  footerRow: number
  /** Frame row the panel's first line is drawn on — the first row under the rule that closes the
   *  Grid's top, so the panel and the Grid start together. */
  panelRow: number
  /** Frame row of the panel's last usable line: the Start Pulse row is pinned there (`startRow`), and
   *  the Nexus Pulse panel's last control row. (Named for the key help that used to overflow into the
   *  panel's bottom lines; the panel carries no help text since feedback F58. Renaming it is a pure
   *  rename for a change of its own.) */
  panelLastRow: number
}>

/**
 * The panel's own rows, counted from its first (owner, 2026-09-30, feedback F71 and F72, after F56 and
 * F57): Explore Map on row 0 and Nexus straight under it on row 1 ("Do not leave a space between
 * Explore and Nexus items"); row 2 is the **credits line** — blank on the left, and on the right, in
 * the column the costs are in, the map's own resource symbol and what there is to spend, `◆ 130` ("they
 * should be on the empty line right before the build/construction list ... the same as the symbol used
 * on the map to represent resources"); and from row 3 the buildings, one list in catalog order with no
 * group headings. The credits are on the menu alone, never on a card.
 */
export const EXPLORE_ROW = 0
export const NEXUS_ROW = 1
export const CREDITS_ROW = 2
const CONSTRUCT_FIRST_ROW = 3

/**
 * A **card** — the panel that replaces the menu while something has the map's attention: Explore Map,
 * or a building being placed (feedback F32, F58). Its header is the row that opened it, drawn active on
 * the panel's first line (row 0, Explore Map's own); a separator runs across the panel on row 1; the
 * card itself starts on row 2. With the credits off the top line (F71) nothing sits above the header.
 * The row moves up to become the header when the card opens (F68, `src/view/build.ts`), and the focus
 * arrow leaves from where the row was on the menu (F63), not from the header.
 */
export const CARD_HEADER_ROW = EXPLORE_ROW
export const CARD_SEPARATOR_ROW = CARD_HEADER_ROW + 1
export const CARD_FIRST_ROW = CARD_HEADER_ROW + 2

/**
 * The Nexus Pulse panel's clickable rows (gate 6A): the playback controls with their hotkeys, pinned to
 * the bottom of the panel, where the Build Phase's Start Pulse row sits. The composer draws them and
 * the mouse adapter hit-tests them from this one place, as it does every other row. `[` and `]` (speed)
 * and `.` and `,` (step) are keys only: the panel has room for two rows and these are the two a player
 * reaches for.
 */
export type PulseControlRow = Readonly<{ row: number; hotkey: string; control: PlaybackControl }>

export function pulseControlRows(layout: BuildLayout): readonly PulseControlRow[] {
  return [
    { row: layout.panelLastRow - 1, hotkey: "space", control: "toggle" },
    { row: layout.panelLastRow, hotkey: "r", control: "restart" },
  ]
}

/** Whether a frame column is one of the side panel's — the width a highlight bar or a click target spans. */
export function inPanelColumns(layout: BuildLayout, column: number): boolean {
  return column >= layout.panelColumn && column < layout.panelColumn + layout.panelLimit
}

/** The playback control on the panel row at a frame cell, or `null` — the whole row is the target, the
 *  width a highlight bar would be drawn. */
export function pulseControlAt(layout: BuildLayout, column: number, row: number): PlaybackControl | null {
  if (!inPanelColumns(layout, column)) return null
  return pulseControlRows(layout).find((control) => control.row === row)?.control ?? null
}

/**
 * The Start Pulse entry (owner, 2026-09-29, feedback F41, then F47: "a regular menu item, at the
 * bottom"): the menu's last row, drawn and hit-tested like every other. It is pinned to the panel's
 * bottom line rather than placed after the last building, so it does not move as the menu above it
 * grows, and the rest of the menu ends on the row above it. `s` is its hotkey.
 */
export const START_KEY = "s"
export const START_LABEL = "Start Pulse"

export function startRow(layout: BuildLayout): number {
  return layout.panelLastRow
}

/** The last panel row the menu's other text may use: the rows above the Start Pulse entry. */
export function menuFloor(layout: BuildLayout): number {
  return startRow(layout) - 1
}

/** The key the top bar's right end names. */
export const ESC_KEY = "[esc]"

/**
 * What Esc does right now, as the top bar's right end says it (owner, 2026-09-29, feedback F37: "The
 * '[esc] menu' at the top right should be dynamic"): **close** while a popup is open, **back** while
 * the map has the keyboard — placing, Explore Map, or plain navigation — and **menu** on the menu (and
 * on a committed Build Phase), where Esc opens the game menu. The label comes first and the key after
 * it — "menu [esc]" — the way a way-back is read, hotkey on the right.
 */
export function escLabel(state: Pick<BuildState, "popup" | "focus" | "committed" | "armed" | "exploreMap">): string {
  const action = state.popup !== null ? "close" : state.committed || mapMode(state) === "menu" ? "menu" : "back"
  return `${action} ${ESC_KEY}`
}

/** The columns the top bar's Esc label covers, right-aligned — where it is drawn and clicked. */
export function escLabelSpan(layout: BuildLayout, label: string): Readonly<{ row: number; from: number; to: number }> {
  return { row: layout.escLabelEnd.row, from: layout.escLabelEnd.to - label.length + 1, to: layout.escLabelEnd.to }
}

/** Whether a frame cell is on the top bar's Esc label. */
export function escLabelAt(layout: BuildLayout, label: string, column: number, row: number): boolean {
  const hint = escLabelSpan(layout, label)
  return row === hint.row && column >= hint.from && column <= hint.to
}

/**
 * One building's row of the menu, computed once and read by both the composer and the mouse adapter:
 * its frame row and its index in the catalog. The buildings are one list, in catalog order, one row
 * each (feedback F56 — the COMMON, ARMY and SPECIAL headings, and the "none available" lines, went with
 * the groups). A row that would fall below `menuFloor` — on a panel too short for the whole list — is
 * left out, so it is neither drawn nor a click target: a click can never land on a row nobody sees.
 */
export type ConstructLine = Readonly<{ row: number; index: number }>

export function constructLines(
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
): readonly ConstructLine[] {
  const lines: ConstructLine[] = []
  const first = layout.panelRow + CONSTRUCT_FIRST_ROW
  for (let index = 0; index < catalog.length; index += 1) {
    const row = first + index
    if (row > menuFloor(layout)) break
    lines.push({ row, index })
  }
  return lines
}

/** The frame row a menu entry is drawn on. */
export function menuEntryRow(
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
  entry: MenuEntry,
): number | null {
  if (entry.kind === "nexus") return layout.panelRow + NEXUS_ROW
  if (entry.kind === "explore") return layout.panelRow + EXPLORE_ROW
  if (entry.kind === "start") return startRow(layout)
  return constructLines(layout, catalog).find((line) => line.index === entry.index)?.row ?? null
}

/**
 * The menu entry at a frame cell, as an index into `menuEntries`, or `null` when the cell hits none.
 * **The whole panel row is the target**, not only its label: a highlighted row is drawn as a bar
 * across the panel's full width, and a row that looks like one bar but only answers on half of it is
 * a row that sometimes ignores a click.
 */
export function menuEntryAt(
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
  column: number,
  row: number,
): number | null {
  if (!inPanelColumns(layout, column)) return null
  // Start Pulse first: it is the one row pinned to the panel's bottom, and wins where a taller menu
  // would reach it.
  if (row === startRow(layout)) return startEntry(catalog.length)
  if (row === layout.panelRow + EXPLORE_ROW) return EXPLORE_ENTRY
  if (row === layout.panelRow + NEXUS_ROW) return NEXUS_ENTRY
  const line = constructLines(layout, catalog).find((candidate) => candidate.row === row)
  return line === undefined ? null : entryOfConstruct(line.index)
}

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
  // The side panel on the left (gate 5F; engine.md 9.2): the frame's left border, the panel's 28
  // columns, then the divider — which is also the Grid rectangle's west side — the Grid, and the
  // frame's right border. From 2026-09-27 (F17) the Grid's west side was a column of its own beside
  // the divider, because the solid "the map ends here" bar sat against the menu text and read as a
  // heavy menu border; the quieter edge colour and the map's own edge styles fixed that, and the
  // owner chose the shared column after trying both (2026-09-29, F25), so the Grid has it back.
  const dividerColumn = offset.column + PANEL_COLUMNS
  const gridLeft = dividerColumn
  const origin = { column: gridLeft + 1, row: offset.row + 1 + HEADER_ROWS }
  const right = offset.column + composition.width - 1
  const gridBox = {
    top: origin.row - 1,
    bottom: origin.row + viewport.height,
    left: gridLeft,
    right,
  }
  const paneBottom = origin.row + paneHeight
  const panelColumn = offset.column + 2
  const headerLimit = composition.width - 4
  const hintTo = offset.column + 2 + headerLimit - 1
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
    headerLimit,
    escLabelEnd: { row: offset.row + 1, to: hintTo },
    footerLimit: composition.width - 4,
    footerRow: paneBottom + 1,
    panelRow: gridBox.top + 1,
    panelLastRow: paneBottom - 1,
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
