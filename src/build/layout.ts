// Where everything is on screen — the one geometry the composer (drawing) and the mouse adapter
// (hit-testing) both read, so a click can never target a tile or a row the frame did not draw there.
// `src/menu/layout.ts` is the same idea for the menu.

import { menuItemLabel } from "../menu/layout.ts"
import type { MenuLayout } from "../menu/layout.ts"
import type { MenuItem } from "../menu/types.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import type { ConstructGroup, ConstructItem, NexusPowerOption } from "./types.ts"
import type { Camera, TerminalSize, TileWidth, Viewport } from "./camera.ts"
import {
  BORDER_COLUMNS,
  FOOTER_ROWS,
  HEADER_ROWS,
  PANEL_COLUMNS,
  fitViewport,
  tileWidthFor,
} from "./camera.ts"

export type BuildLayout = Readonly<{
  /** The whole frame, which is the whole terminal: a frame the size of the screen overwrites
   *  everything on it, so growing the window never leaves a stale strip behind. */
  frame: Readonly<{ width: number; height: number }>
  /** Border, Grid pane and panel together — the 1 + 48 + 1 + 30 arithmetic of engine.md 3.1. */
  composition: Readonly<{ width: number; height: number }>
  /** Where that composition sits inside the frame. Terminal space beyond the maximum viewport is
   *  spent on centring — engine.md 3.3, "never on more Grid". */
  offset: Readonly<{ column: number; row: number }>
  viewport: Viewport
  tileWidth: TileWidth
  /** Frame cell of the viewport's own north-west tile. */
  origin: Readonly<{ column: number; row: number }>
  /** Frame column of the vertical rule between the Grid pane and the side panel. */
  dividerColumn: number
  /** Frame column the side panel's own text starts at, and how many glyphs fit on one of its rows —
   *  the same `right + 2` / `width - 1 - panelX` arithmetic `compose.ts` already uses, so the two
   *  screens' panels line up rather than each inventing their own inset. */
  panelColumn: number
  panelLimit: number
  /** How many glyphs fit on one row of the Grid pane's header. */
  paneLimit: number
  /** How many glyphs fit on one footer row, which runs the full width beneath both panes. */
  footerLimit: number
  /** Frame row the three footer rows start at. */
  footerRow: number
  /** Frame row the panel's first line is drawn on. */
  panelRow: number
  /** Frame row the panel's last binding sits on — its last usable line, so the bindings do not move
   *  as the rest of the panel grows and shrinks with what the player is doing. */
  panelBindingsRow: number
}>

/** The panel's own rows, counted from its first. Row 0 is what the player has to spend, because it
 *  is the number every other choice on this panel is measured against; row 1 is deliberately blank. */
export const RESOURCE_ROW = 0
const CONSTRUCT_FIRST_ROW = 2

/** The order the construct groups are drawn in — `commander-armies.md` Section 2.1's own order: the
 *  faction's common structures first, then what makes one Commander's package its own. */
export const CONSTRUCT_GROUPS: readonly ConstructGroup[] = ["common", "army"]

/**
 * One line of the construct block, computed once and read by both the composer and the mouse
 * adapter. A list split into labelled groups has no uniform row step, so the rows are enumerated
 * rather than multiplied out.
 */
export type ConstructLine =
  | Readonly<{ kind: "group"; row: number; group: ConstructGroup }>
  | Readonly<{ kind: "item"; row: number; index: number }>
  | Readonly<{ kind: "empty"; row: number; group: ConstructGroup }>

export function constructLines(
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
): readonly ConstructLine[] {
  const lines: ConstructLine[] = []
  let row = layout.panelRow + CONSTRUCT_FIRST_ROW
  for (const group of CONSTRUCT_GROUPS) {
    lines.push({ kind: "group", row, group })
    row += 1
    const members = catalog
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.group === group)
    if (members.length === 0) {
      // An empty group is drawn, not skipped (commander-armies.md 2.1): one that vanishes reflows
      // the panel and moves every hotkey below it the first time it fills.
      lines.push({ kind: "empty", row, group })
      row += 1
    } else {
      for (const { index } of members) {
        lines.push({ kind: "item", row, index })
        row += 1
      }
    }
    row += 1
  }
  return lines
}

/** The construct row at a frame cell, or `null` when the cell hits none — including a cell past the
 *  end of the row's own drawn text, so blank space beside a short label is not a click target. */
export function constructIndexAt(
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
  column: number,
  row: number,
): number | null {
  for (const line of constructLines(layout, catalog)) {
    if (line.kind !== "item" || line.row !== row) continue
    const item = catalog[line.index]
    if (item === undefined) return null
    // The row's clickable width is its hotkey and label — the cost is right-aligned across the
    // panel and clicking the gap between them would be clicking nothing in particular.
    const width = menuItemLabel({ id: item.contentId, hotkey: item.hotkey, label: item.label }).length
    if (column < layout.panelColumn || column >= layout.panelColumn + width) return null
    return line.index
  }
  return null
}

/**
 * The Nexus draft's own two-row-per-option list — a hotkey/name line the player can click, and a
 * plain description line beneath it. Reuses `src/menu/layout.ts`'s flat-list geometry rather than
 * inventing one: the draft is exactly the uniform-row-step case that shape already fits, once the
 * construct menu's own groups made `constructLines` necessary for *that* screen.
 */
export function nexusDraftLayout(layout: BuildLayout): MenuLayout {
  return { column: layout.panelColumn, row: layout.panelRow + 1, rowStep: 3 }
}

export function nexusDraftItems(draft: readonly NexusPowerOption[]): readonly MenuItem[] {
  return draft.map((option) => ({ id: option.hotkey, hotkey: option.hotkey, label: option.name }))
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
  const composition = {
    width: BORDER_COLUMNS + viewport.width * tileWidth + PANEL_COLUMNS,
    height: BORDER_COLUMNS + HEADER_ROWS + viewport.height + FOOTER_ROWS,
  }
  const frame = { width: Math.max(terminal.columns, composition.width), height: Math.max(terminal.rows, composition.height) }
  const offset = {
    column: Math.floor((frame.width - composition.width) / 2),
    row: Math.floor((frame.height - composition.height) / 2),
  }
  const origin = { column: offset.column + 1, row: offset.row + 1 + HEADER_ROWS }
  const dividerColumn = offset.column + 1 + viewport.width * tileWidth
  const panelColumn = dividerColumn + 2
  const right = offset.column + composition.width - 1
  return {
    frame,
    composition,
    offset,
    viewport,
    tileWidth,
    origin,
    dividerColumn,
    panelColumn,
    panelLimit: right - panelColumn,
    paneLimit: dividerColumn - offset.column - 3,
    footerLimit: composition.width - 4,
    footerRow: offset.row + composition.height - 1 - FOOTER_ROWS,
    panelRow: offset.row + 1,
    panelBindingsRow: offset.row + composition.height - 1 - FOOTER_ROWS - 1,
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
