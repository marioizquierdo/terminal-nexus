// The mouse adapter for the Build Phase spike. Engine.md 9.7 again: "mouse geometry lives only in
// the mouse adapter. A click arrives as a terminal cell; the adapter converts it to a tile using the
// tile width and the composition's layout, and emits a command that names a tile or a menu item.
// Nothing downstream ever learns a cell coordinate."
//
// The SGR parsing itself is `src/menu/mouse.ts`'s, reused rather than rewritten — one place knows
// what `ESC [ < 0 ; 12 ; 7 M` means, and this file only knows what a *tile* click means. What it
// adds is the two gestures a flat menu had no use for: the wheel, and the right button.

import { menuIndexAt } from "../menu/layout.ts"
import { menuItemsFor } from "./catalog.ts"
import type { BuildLayout } from "./layout.ts"
import { tileAtCell } from "./layout.ts"
import type { Camera } from "./camera.ts"
import { JUMP_TILES } from "./state.ts"
import type { BuildCommand, ConstructItem } from "./types.ts"

const SGR_MOUSE = /^\u001b\[<(\d+);(\d+);(\d+)([Mm])$/

export type MouseEvent = Readonly<{
  /** SGR button code: 0 left, 2 right, 64 wheel up, 65 wheel down. */
  button: number
  /** 0-based frame cell — converted from the terminal's own 1-based coordinates exactly once, here. */
  column: number
  row: number
  press: boolean
}>

export function parseMouseEvent(key: string): MouseEvent | null {
  const match = SGR_MOUSE.exec(key)
  if (match === null) return null
  return {
    button: Number(match[1]),
    column: Number(match[2]) - 1,
    row: Number(match[3]) - 1,
    press: match[4] === "M",
  }
}

/** The raw bytes a real terminal sends for one of these, so a driver script or a screenshot can say
 *  "click here" once and get exactly what `parseMouseEvent` accepts — rather than a hand-written
 *  escape sequence that could quietly drift from it. 1-based, like the terminal's own coordinates. */
export function formatMouseEvent(button: number, column: number, row: number): string {
  return `${String.fromCharCode(27)}[<${button};${column};${row}M`
}

export const MOUSE_LEFT = 0
export const MOUSE_RIGHT = 2
export const MOUSE_WHEEL_UP = 64
export const MOUSE_WHEEL_DOWN = 65

/**
 * **The wheel moves the cursor, not a second camera.** Engine.md 9.7's table says "Mouse: wheel —
 * scroll the camera; the mouse's Shift+Arrow", while 3.3 says the camera is driven by the cursor and
 * there is "no separate pan mode, no modifier keys, no second cursor". Taken literally together, the
 * only reading that keeps both true is the one the table's own gloss already points at: the wheel is
 * the mouse's Shift+Arrow, so it jumps the *cursor* five tiles and the camera follows it, exactly as
 * the keyboard's fast pan does. A wheel that moved the camera on its own would be the separate pan
 * mode 3.3 forbids, and would leave the cursor stranded off screen.
 */
export function buildMouseCommand(
  event: MouseEvent,
  camera: Camera,
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
): BuildCommand | null {
  if (!event.press) return null

  if (event.button === MOUSE_WHEEL_UP) return { kind: "move-cursor", dx: 0, dy: -JUMP_TILES }
  if (event.button === MOUSE_WHEEL_DOWN) return { kind: "move-cursor", dx: 0, dy: JUMP_TILES }
  // "Mouse: right click — Esc. The RTS convention for cancel."
  if (event.button === MOUSE_RIGHT) return { kind: "disarm" }
  if (event.button !== MOUSE_LEFT) return null

  // A click on a construct row is that row's hotkey, by construction: both this and the composer ask
  // `layout.construct` where the row is, so they cannot disagree.
  const rowIndex = menuIndexAt(menuItemsFor(catalog), layout.construct, event.column, event.row)
  if (rowIndex !== null) return { kind: "arm", index: rowIndex }

  const tile = tileAtCell(layout, camera, event.column, event.row)
  if (tile === null) return null
  return { kind: "click-tile", x: tile.x, y: tile.y }
}
