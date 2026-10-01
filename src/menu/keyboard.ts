// The keyboard adapter (`input.md`): one displayed keymap, the primary way to play. Converts one
// raw key (as `keysFromChunk`, src/view/playback.ts, splits a stdin chunk) into a `MenuCommand`,
// against the same vocabulary the mouse adapter and the driver also produce.

import type { MenuListState } from "./list.ts"
import { moveHighlight } from "./list.ts"
import { listKeyOf } from "./list-keys.ts"
import type { MenuCommand } from "./types.ts"

/** `q` and Ctrl+C — the same quit keys `controlForKey` binds during a Pulse (one keymap across
 *  `grid` and `terminal-nexus` for the controls they share). */
const QUIT_KEYS = new Set(["q", String.fromCharCode(3)])
/** Raw mode delivers Enter as CR; LF is accepted too so a driver script (or a pasted line) using
 *  "\n" for readability needs no translation layer of its own. */
const ACTIVATE_KEYS = new Set(["\r", "\n"])
const ESC = String.fromCharCode(27)
/** Esc alone, as one whole "key" from `keysFromChunk` — not a CSI/SS3 sequence, so it never collides
 *  with an arrow key or a mouse report despite starting with the same byte. */
const BACK_KEY = ESC

/**
 * One raw key to one command, or `null` when this key means nothing on a menu screen. `state` is
 * needed for two things only: resolving where "up"/"down" land, and which item Enter activates —
 * mouse geometry never enters here (mouse geometry lives only in the mouse adapter).
 */
export function keyboardCommand(key: string, state: MenuListState): MenuCommand | null {
  if (QUIT_KEYS.has(key)) return { kind: "quit" }
  if (key === BACK_KEY) return { kind: "back" }
  // Up and Down stop at the list's ends; Shift, Option, PageUp/PageDown and Home/End go all the way
  // (`list-keys.ts`). No tap counting or hold cadence here: the title
  // screen's loop reads no clock, and its lists are a handful of rows — one row a press.
  const list = listKeyOf(key)
  if (list !== null) return { kind: "highlight", index: moveHighlight(state, list.direction, list.jump) }
  if (ACTIVATE_KEYS.has(key)) return { kind: "activate", index: state.highlighted }
  const index = state.items.findIndex((item) => item.hotkey === key)
  return index === -1 ? null : { kind: "activate", index }
}
