// The mouse adapter — engine.md 9.7: "a terminal reports the mouse only after the program asks (SGR
// extended mode, 1006, over 1000/1002)," and "mouse geometry lives only in the mouse adapter." This
// is the one place a terminal cell becomes a menu item; nothing downstream ever learns a coordinate.

import { menuIndexAt } from "./layout.ts"
import type { MenuLayout } from "./layout.ts"
import type { MenuItem } from "./types.ts"
import type { MenuCommand } from "./types.ts"

const ESC = String.fromCharCode(27)

/** Enables click reporting (1000) with SGR extended coordinates (1006) — the combination engine.md
 *  9.7 requires over the byte-limited legacy modes. Written once, at session start. */
export const MOUSE_REPORTING_ON = `${ESC}[?1000h${ESC}[?1006h`
/** The exact reverse, in the opposite order — the disposer's own job (engine.md 10.1: "once the
 *  mouse adapter exists, it switches terminal mouse reporting off on the same paths" as raw mode). */
export const MOUSE_REPORTING_OFF = `${ESC}[?1006l${ESC}[?1000l`

/**
 * SGR mouse report: `ESC [ < Cb ; Cx ; Cy (M|m)`, 1-based terminal coordinates. `M` is a button
 * press, `m` a release. Matched against a whole "key" the way `keysFromChunk` already hands one to
 * us — an escape-prefixed chunk arrives as one string, never split mid-sequence.
 */
const SGR_MOUSE = /^\[<(\d+);(\d+);(\d+)([Mm])$/

export type MouseClick = Readonly<{ column: number; row: number }>

/**
 * Recognises a plain left-button press and nothing else: start simple, with the minimum this gate
 * asks for. A release, a modifier, a drag, or the scroll wheel (buttons 64/65) all return `null` —
 * none of them are menu gestures, and a flat top-level menu has no camera to scroll or place to
 * right-click "back" out of.
 */
export function parseMouseClick(key: string): MouseClick | null {
  const match = SGR_MOUSE.exec(key)
  if (match === null) return null
  const [, buttonText, columnText, rowText, action] = match
  if (action !== "M" || buttonText !== "0") return null
  // Terminal coordinates are 1-based; every frame coordinate in this codebase (Cell, BandCell) is
  // 0-based, so the conversion happens exactly once, here, rather than leaking a "-1" into layout.ts
  // or the composer.
  return { column: Number(columnText) - 1, row: Number(rowText) - 1 }
}

/**
 * The exact inverse of `parseMouseClick`: the raw SGR bytes a real left click at this 1-based
 * terminal cell would send. Lets a driver script, or a test proving keyboard/mouse/driver
 * equivalence, describe "click column 5, row 10" once and get the identical bytes a terminal
 * actually produces — rather than hand-writing escape codes that could quietly drift from what
 * `parseMouseClick` accepts.
 */
export function formatMouseClick(column: number, row: number): string {
  return `${ESC}[<0;${column};${row}M`
}

/** A click at a menu row activates it — "identical effect" to that row's hotkey, per engine.md 9.7. */
export function mouseCommand(
  click: MouseClick,
  items: readonly MenuItem[],
  layout: MenuLayout,
): MenuCommand | null {
  const index = menuIndexAt(items, layout, click.column, click.row)
  return index === null ? null : { kind: "activate", index }
}
