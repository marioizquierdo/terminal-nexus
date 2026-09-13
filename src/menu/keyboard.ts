// The keyboard adapter — engine.md 9.7: one displayed keymap, the primary way to play. Converts one
// raw key (as `keysFromChunk`, src/view/playback.ts, splits a stdin chunk) into a `MenuCommand`,
// against the same vocabulary the mouse adapter and the driver also produce.

import type { MenuListState } from "./list.ts"
import { moveHighlight } from "./list.ts"
import type { MenuCommand } from "./types.ts"

/** `q` and Ctrl+C — the same quit keys `controlForKey` binds during a Pulse (engine.md 9.7's own
 *  "one keymap across `grid` and `terminal-nexus`" for the controls they share). */
const QUIT_KEYS = new Set(["q", String.fromCharCode(3)])
/** Raw mode delivers Enter as CR; LF is accepted too so a driver script (or a pasted line) using
 *  "\n" for readability needs no translation layer of its own. */
const ACTIVATE_KEYS = new Set(["\r", "\n"])
const ESC = String.fromCharCode(27)
const ARROW_UP = `${ESC}[A`
const ARROW_DOWN = `${ESC}[B`

/**
 * One raw key to one command, or `null` when this key means nothing on a menu screen. `state` is
 * needed for two things only: resolving where "up"/"down" land, and which item Enter activates —
 * mouse geometry never enters here (engine.md 9.7: "mouse geometry lives only in the mouse adapter").
 */
export function keyboardCommand(key: string, state: MenuListState): MenuCommand | null {
  if (QUIT_KEYS.has(key)) return { kind: "quit" }
  if (key === ARROW_UP) return { kind: "highlight", index: moveHighlight(state, -1) }
  if (key === ARROW_DOWN) return { kind: "highlight", index: moveHighlight(state, 1) }
  if (ACTIVATE_KEYS.has(key)) return { kind: "activate", index: state.highlighted }
  const index = state.items.findIndex((item) => item.hotkey === key)
  return index === -1 ? null : { kind: "activate", index }
}
