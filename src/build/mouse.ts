// The Build Phase's mouse adapter. Per docs/system-design/input.md, mouse geometry lives only here: a click
// arrives as a terminal cell, is converted to a tile through the layout, and leaves as a command
// naming a tile or a menu row. Nothing downstream learns a cell coordinate.
//
// SGR parsing is `src/menu/mouse.ts`'s, reused rather than rewritten. What this adds is the two
// gestures a flat menu has no use for: the wheel, and the right button.

import type { BuildLayout } from "./layout.ts"
import { ESC_KEY, escLabelAt, inPanelColumns, menuEntryAt, nextRoundRow, pulseControlAt, tileAtCell } from "./layout.ts"
import type { PlacedPopup } from "./popup.ts"
import { popupHitAt } from "./popup.ts"
import type { Camera } from "./camera.ts"
import type { BuildCommand, ConstructItem } from "./types.ts"

/** What is on screen beyond the layout: the open popup, placed, since it holds the mouse; the menu
 *  entry whose card — Explore Map's, or the building being placed (`cardEntry`) — is drawn where the
 *  menu usually is, if one is; and the top bar's Esc label as drawn (`escLabel`), whose width is its
 *  click target — "close [esc]" with a popup open, "menu [esc]" otherwise, when not given. */
export type MouseUiState = Readonly<{
  popup?: PlacedPopup
  card?: number | null
  escLabel?: string
  /** A Nexus Pulse is on screen: its panel's control rows are click targets, and nothing else
   *  on the panel is. */
  pulse?: boolean
  /** The Pulse on screen has ended and its result stands: its "go on" row answers a click. */
  pulseOver?: boolean
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

/** How far one notch of the wheel moves the map cursor, in tiles. GUIDANCE (the bindings table in
 *  docs/system-design/input.md), not RULE. The keyboard's fast move used to jump this far too; it jumps
 *  the tuned `TUNING.jumpStep` now, and the wheel alone keeps five. */
export const WHEEL_TILES = 5

/**
 * **The wheel moves the cursor, not a second camera.** The bindings table in
 * docs/system-design/input.md says "Mouse: wheel — scroll the camera; the mouse's Shift+Arrow", while
 * the scrolling rule in docs/system-design/grid.md says the camera is driven by the cursor and
 * there is "no separate pan mode, no modifier keys, no second cursor". Taken literally together, the
 * only reading that keeps both true is the one the table's own gloss already points at: the wheel is
 * the mouse's fast move, so it moves the *cursor* `WHEEL_TILES` and the camera follows it, as it
 * follows every cursor move. A wheel that moved the camera on its own would be the separate pan mode
 * the scrolling rule forbids, and would leave the cursor stranded off screen. Inside a popup it walks
 * the list.
 */
export function buildMouseCommand(
  event: MouseEvent,
  camera: Camera,
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
  ui: MouseUiState = {},
): BuildCommand | null {
  if (!event.press) return null
  // "Mouse: right click — Esc. The RTS convention for cancel." It walks back as `x` does: one level,
  // whatever is open — and on the menu it does nothing, since a stray right click should never open a
  // menu (as `x` no longer opens the game menu). The top bar's
  // `menu [esc]` is Esc itself, and opens it.
  if (event.button === MOUSE_RIGHT) return { kind: "back" }

  // What the click lands on underneath any popup — a menu row or a tile — named as the reducer's own
  // click commands, which decide what a click means from what is on screen.
  const underneath = (): BuildCommand | null => {
    // A card — Explore Map's, or the building being placed — covers the menu below its
    // header row, so the whole panel is one target: a click on the card's own row, its header. Sent as
    // the menu click it is, so a driver's `click-menu` while a card shows means exactly the same.
    if (ui.card !== undefined && ui.card !== null && inPanel(layout, event.column, event.row)) {
      return { kind: "click-menu", entry: ui.card }
    }
    // The Pulse's panel has no menu: a click there is not a menu row.
    const entry = ui.pulse === true ? null : menuEntryAt(layout, catalog, event.column, event.row)
    if (entry !== null) return { kind: "click-menu", entry }
    const tile = tileAtCell(layout, camera, event.column, event.row)
    if (tile !== null) return { kind: "click-tile", x: tile.x, y: tile.y }
    return null
  }

  // The top bar's Esc label — "menu [esc]", "back [esc]", "close [esc]" — is Esc itself, whatever is
  // open: one level back, exactly as the key goes, never the click-outside that closes
  // every popup at once.
  const escText = ui.escLabel ?? `${ui.popup === undefined ? "menu" : "close"} ${ESC_KEY}`
  if (event.button === MOUSE_LEFT && escLabelAt(layout, escText, event.column, event.row)) return { kind: "cancel" }

  // An open popup holds the mouse. Inside it, a click is one of its options or its scroll bar; outside
  // it, the click closes it and brings focus to wherever it landed, and does nothing more (a click that missed the popup
  // once looked like a broken mouse).
  if (ui.popup !== undefined) {
    // The wheel walks a popup's list, which scrolls Settings' and the export's — Up and
    // Down's own job.
    if (event.button === MOUSE_WHEEL_UP) return { kind: "highlight", delta: -1 }
    if (event.button === MOUSE_WHEEL_DOWN) return { kind: "highlight", delta: 1 }
    if (event.button !== MOUSE_LEFT) return null
    const hit = popupHitAt(ui.popup, event.column, event.row)
    if (hit.kind === "command") return hit.command
    if (hit.kind === "outside") return underneath() ?? { kind: "cancel" }
    return null
  }

  if (event.button === MOUSE_WHEEL_UP) return { kind: "move-cursor", dx: 0, dy: -WHEEL_TILES }
  if (event.button === MOUSE_WHEEL_DOWN) return { kind: "move-cursor", dx: 0, dy: WHEEL_TILES }
  if (event.button !== MOUSE_LEFT) return null
  // The Pulse's panel has control rows where the menu was; a click on one is that control, exactly as
  // its hotkey is, and any other click on the panel does nothing (there is no menu underneath it).
  if (ui.pulse === true) {
    if (ui.pulseOver === true && inPanelColumns(layout, event.column) && event.row === nextRoundRow(layout)) {
      return { kind: "next-round" }
    }
    const control = pulseControlAt(layout, event.column, event.row)
    if (control !== null) return { kind: "pulse", control }
    if (inPanel(layout, event.column, event.row)) return null
  }
  // A click on a card goes back, as Esc does (`underneath`).
  return underneath()
}

/** Whether a frame cell is on the side panel — its full width, from its first row to its last. */
function inPanel(layout: BuildLayout, column: number, row: number): boolean {
  return inPanelColumns(layout, column) && row >= layout.panelRow && row <= layout.panelLastRow
}
