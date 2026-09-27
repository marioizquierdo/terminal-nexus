// The Build Phase's mouse adapter. Per engine.md 9.7, mouse geometry lives only here: a click
// arrives as a terminal cell, is converted to a tile through the layout, and leaves as a command
// naming a tile or a menu row. Nothing downstream learns a cell coordinate.
//
// SGR parsing is `src/menu/mouse.ts`'s, reused rather than rewritten. What this adds is the two
// gestures a flat menu has no use for: the wheel, and the right button.

import type { BuildLayout } from "./layout.ts"
import { menuEntryAt, tileAtCell } from "./layout.ts"
import type { PlacedOverlay } from "./overlay.ts"
import { overlayHitAt } from "./overlay.ts"
import type { Camera } from "./camera.ts"
import { JUMP_TILES } from "./state.ts"
import type { BuildCommand, ConstructItem } from "./types.ts"

/** What is on screen beyond the layout: the open popup, placed, since it holds the mouse. */
export type MouseUiState = Readonly<{
  overlay?: PlacedOverlay
}>

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
  ui: MouseUiState = {},
): BuildCommand | null {
  if (!event.press) return null
  // "Mouse: right click — Esc. The RTS convention for cancel." One cancel, whatever is open.
  if (event.button === MOUSE_RIGHT) return { kind: "cancel" }

  // What the click lands on underneath any popup — a menu row or a tile — named as the reducer's own
  // click commands, which decide what a click means from what is on screen.
  const underneath = (): BuildCommand | null => {
    const entry = menuEntryAt(layout, catalog, event.column, event.row)
    if (entry !== null) return { kind: "click-menu", entry }
    const tile = tileAtCell(layout, camera, event.column, event.row)
    if (tile !== null) return { kind: "click-tile", x: tile.x, y: tile.y }
    return null
  }

  // An open popup holds the mouse. Inside it, a click is one of its options or its `[esc]`; outside
  // it, the click closes it and brings focus to wherever it landed, and does nothing more (owner,
  // 2026-09-27 — he clicked Nexus, missed the popup in the middle, and thought the mouse was broken).
  if (ui.overlay !== undefined) {
    if (event.button !== MOUSE_LEFT) return null
    const hit = overlayHitAt(ui.overlay, event.column, event.row)
    if (hit.kind === "command") return hit.command
    if (hit.kind === "outside") return underneath() ?? { kind: "cancel" }
    return null
  }

  if (event.button === MOUSE_WHEEL_UP) return { kind: "move-cursor", dx: 0, dy: -JUMP_TILES }
  if (event.button === MOUSE_WHEEL_DOWN) return { kind: "move-cursor", dx: 0, dy: JUMP_TILES }
  if (event.button !== MOUSE_LEFT) return null
  return underneath()
}
