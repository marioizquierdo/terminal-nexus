// Where a menu item lives on screen — the one function the composer (drawing) and the mouse adapter
// (hit-testing) both call, so a click can never target a row the frame did not actually draw there.
// engine.md 9.7: "mouse geometry lives only in the mouse adapter" — this is the shared geometry that
// adapter owns; the composer calls it to know what to draw, never the other way around.

import type { MenuItem } from "./types.ts"

export type MenuLayout = Readonly<{
  /** 0-based frame column where every row's `[hotkey] label` text starts. */
  column: number
  /** 0-based frame row of item 0. */
  row: number
  /** Frame rows between one item and the next. */
  rowStep: number
}>

/** `[1] Campaign` — the one format a hotkey is ever shown in (engine.md 9.7). */
export function menuItemLabel(item: MenuItem): string {
  return `[${item.hotkey}] ${item.label}`
}

export function menuItemRow(layout: MenuLayout, index: number): number {
  return layout.row + index * layout.rowStep
}

/**
 * The item index at a 0-based frame cell, or `null` when the cell hits no row — including a cell
 * past the end of that row's own label text, so clicking blank space to the right of a short label
 * does not activate it.
 */
export function menuIndexAt(
  items: readonly MenuItem[],
  layout: MenuLayout,
  column: number,
  row: number,
): number | null {
  const relative = row - layout.row
  if (relative < 0 || relative % layout.rowStep !== 0) return null
  const index = relative / layout.rowStep
  const item = items[index]
  if (item === undefined) return null
  const width = menuItemLabel(item).length
  if (column < layout.column || column >= layout.column + width) return null
  return index
}
