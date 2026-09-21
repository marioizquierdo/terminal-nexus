// The keyboard adapter for the Build Phase spike — engine.md 9.7's keymap, and the one part of it
// a terminal can silently break.
//
// **What the survey found** (`node scripts/probe-modified-keys.mjs`, 2026-09-21, full table in
// `evidence/gate-5a-report.md`): Shift+Arrow is neither universal nor single-valued.
//
//   - xterm, xterm-256color, tmux and tmux-256color send `ESC [ 1 ; 2 A` and its siblings;
//   - rxvt and rxvt-unicode send a completely different, shorter form: `ESC [ a b c d`;
//   - screen, screen-256color, the Linux virtual console, vt100, vt220 and ansi define no shifted
//     arrow at all. On those terminals Shift+Up is simply Up, and the five-tile jump would not
//     exist if Shift+Arrow were its only binding.
//
// So this adapter accepts both sequence families, and the fast pan also has a modifier-free
// fallback — PageUp/PageDown and Home/End — which the survey found on every terminal description
// tested except vt100 and ansi. Both are displayed in the footer, because a hotkey that is not
// displayed does not exist.

import type { BuildCommand } from "./types.ts"
import { JUMP_TILES } from "./state.ts"

const ESC = String.fromCharCode(27)
const QUIT_KEYS = new Set(["q", String.fromCharCode(3)])
const PLACE_KEYS = new Set(["\r", "\n"])
const REMOVE_KEYS = new Set([String.fromCharCode(127), String.fromCharCode(8), `${ESC}[3~`])

/** `ESC [ A` and the application-cursor-mode `ESC O A` a terminal may switch to at any moment. */
const PLAIN_ARROWS: Readonly<Record<string, Readonly<{ dx: number; dy: number }>>> = {
  [`${ESC}[A`]: { dx: 0, dy: -1 },
  [`${ESC}[B`]: { dx: 0, dy: 1 },
  [`${ESC}[C`]: { dx: 1, dy: 0 },
  [`${ESC}[D`]: { dx: -1, dy: 0 },
  [`${ESC}OA`]: { dx: 0, dy: -1 },
  [`${ESC}OB`]: { dx: 0, dy: 1 },
  [`${ESC}OC`]: { dx: 1, dy: 0 },
  [`${ESC}OD`]: { dx: -1, dy: 0 },
}

/** rxvt's own shifted arrows, which share nothing with xterm's but the leading `ESC [`. */
const RXVT_SHIFTED_ARROWS: Readonly<Record<string, Readonly<{ dx: number; dy: number }>>> = {
  [`${ESC}[a`]: { dx: 0, dy: -1 },
  [`${ESC}[b`]: { dx: 0, dy: 1 },
  [`${ESC}[c`]: { dx: 1, dy: 0 },
  [`${ESC}[d`]: { dx: -1, dy: 0 },
}

/**
 * xterm's modified arrows: `ESC [ 1 ; <modifier> <letter>`. Any modifier ≥ 2 counts, not Shift
 * alone — nothing else on this screen binds a modified arrow, so a terminal that eats Shift but
 * passes Alt or Ctrl still gives its player the fast pan instead of nothing. Deliberately liberal,
 * and a departure from the bindings table's Shift-only line, recorded in the gate report.
 */
const XTERM_MODIFIED_ARROW = /^\u001b\[1;(\d+)([ABCD])$/
const ARROW_LETTERS: Readonly<Record<string, Readonly<{ dx: number; dy: number }>>> = {
  A: { dx: 0, dy: -1 },
  B: { dx: 0, dy: 1 },
  C: { dx: 1, dy: 0 },
  D: { dx: -1, dy: 0 },
}

/**
 * The modifier-free fallback, in every encoding the survey turned up: PageUp/PageDown are
 * `ESC [ 5 ~` and `ESC [ 6 ~` everywhere they exist at all, but Home and End have three live
 * spellings between xterm (`ESC O H`), screen/tmux/linux (`ESC [ 1 ~`) and rxvt (`ESC [ 7 ~`) —
 * which is exactly why they are decoded from a table rather than from one remembered sequence.
 */
const FALLBACK_JUMPS: Readonly<Record<string, Readonly<{ dx: number; dy: number }>>> = {
  [`${ESC}[5~`]: { dx: 0, dy: -JUMP_TILES },
  [`${ESC}[6~`]: { dx: 0, dy: JUMP_TILES },
  [`${ESC}[H`]: { dx: -JUMP_TILES, dy: 0 },
  [`${ESC}OH`]: { dx: -JUMP_TILES, dy: 0 },
  [`${ESC}[1~`]: { dx: -JUMP_TILES, dy: 0 },
  [`${ESC}[7~`]: { dx: -JUMP_TILES, dy: 0 },
  [`${ESC}[F`]: { dx: JUMP_TILES, dy: 0 },
  [`${ESC}OF`]: { dx: JUMP_TILES, dy: 0 },
  [`${ESC}[4~`]: { dx: JUMP_TILES, dy: 0 },
  [`${ESC}[8~`]: { dx: JUMP_TILES, dy: 0 },
}

export type KeyboardContext = Readonly<{
  /** How many construct-menu rows there are, so a digit past the end of the list means nothing
   *  rather than arming something that is not on screen. */
  itemCount: number
  /** Esc disarms when something is armed, and otherwise leaves the screen — engine.md 9.7: "disarm
   *  the current selection, close an overlay, back out of a menu", and "never quits the game by
   *  itself." */
  armed: boolean
}>

/** One already-split raw key to one command, or `null` when the key means nothing here. */
export function buildKeyboardCommand(key: string, context: KeyboardContext): BuildCommand | null {
  if (QUIT_KEYS.has(key)) return { kind: "quit" }
  if (key === ESC) return context.armed ? { kind: "disarm" } : { kind: "back" }
  if (PLACE_KEYS.has(key)) return { kind: "place" }
  if (REMOVE_KEYS.has(key)) return { kind: "remove" }
  if (key === "u") return { kind: "undo" }

  const plain = PLAIN_ARROWS[key]
  if (plain !== undefined) return { kind: "move-cursor", ...plain }

  const rxvt = RXVT_SHIFTED_ARROWS[key]
  if (rxvt !== undefined) {
    return { kind: "move-cursor", dx: rxvt.dx * JUMP_TILES, dy: rxvt.dy * JUMP_TILES }
  }

  const modified = XTERM_MODIFIED_ARROW.exec(key)
  if (modified !== null) {
    const direction = ARROW_LETTERS[modified[2] as string]
    if (direction !== undefined && Number(modified[1]) >= 2) {
      return { kind: "move-cursor", dx: direction.dx * JUMP_TILES, dy: direction.dy * JUMP_TILES }
    }
  }

  const fallback = FALLBACK_JUMPS[key]
  if (fallback !== undefined) return { kind: "move-cursor", ...fallback }

  // Digits always address the list, and never mean anything else on this screen — engine.md 9.7's
  // first convention, "no modes". `0` is the tenth row, not the zeroth.
  if (key.length === 1 && key >= "0" && key <= "9") {
    const index = key === "0" ? 9 : Number(key) - 1
    return index < context.itemCount ? { kind: "arm", index } : null
  }

  return null
}
