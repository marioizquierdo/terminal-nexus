// The keyboard adapter — engine.md 9.7's keymap, and the one part of it a terminal can silently
// break. Shift+Arrow is neither universal nor single-valued (measured by
// `scripts/probe-modified-keys.mjs`; the table is in `evidence/gate-5a-report.md`):
//
//   - xterm and tmux send `ESC [ 1 ; 2 A` and its siblings;
//   - rxvt sends a shorter, unrelated form: `ESC [ a b c d`;
//   - screen, the Linux console, vt100, vt220 and ansi define no shifted arrow at all.
//
// So both families are accepted, and the five-tile jump also has a modifier-free fallback —
// PageUp/PageDown and Home/End — plus the Option/Meta forms a Mac sends. The screen names the fast
// move once, as "shift+arrow fast move"; the others are the same move under other keys, left off the
// key help on the owner's own call (2026-09-26: "leave pgup/home keys out, people will figure that
// out just fine").

import type { BuildCommand } from "./types.ts"
import { JUMP_TILES } from "./state.ts"

const ESC = String.fromCharCode(27)
const QUIT_KEYS = new Set(["q", String.fromCharCode(3)])
const PLACE_KEYS = new Set(["\r", "\n", " "])
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
 * xterm's modified arrows: `ESC [ 1 ; <modifier> <letter>`. Any modifier >= 2 counts, not Shift
 * alone — nothing else here binds a modified arrow, so a terminal that eats Shift but passes Alt or
 * Ctrl still gives its player the fast pan.
 */
const XTERM_MODIFIED_ARROW = /^\u001b\[1;(\d+)([ABCD])$/
const ARROW_LETTERS: Readonly<Record<string, Readonly<{ dx: number; dy: number }>>> = {
  A: { dx: 0, dy: -1 },
  B: { dx: 0, dy: 1 },
  C: { dx: 1, dy: 0 },
  D: { dx: -1, dy: 0 },
}

/**
 * Option+Arrow the way macOS terminals send it by default, which is not xterm's `CSI 1;3` form (that
 * one is already covered above, since any modifier counts): Option+Left/Right arrive as the readline
 * word-movement keys `ESC b`/`ESC f`, and a terminal set to treat Option as Meta prefixes the ordinary
 * arrow with a second ESC. Both mean the fast move — "move word by word" is what Option means on a
 * Mac (owner, 2026-09-26: "we should also allow option"). Bound from the terminals' documented
 * defaults, not yet measured on the owner's own iTerm2 profile: `node scripts/lib/key-echo.mjs` in
 * that terminal is how to check. `keysFromChunk` keeps each of these whole; before it did, Option+Left
 * split into a bare Escape and left the screen.
 */
const META_JUMPS: Readonly<Record<string, Readonly<{ dx: number; dy: number }>>> = {
  [`${ESC}b`]: { dx: -1, dy: 0 },
  [`${ESC}f`]: { dx: 1, dy: 0 },
  [`${ESC}${ESC}[A`]: { dx: 0, dy: -1 },
  [`${ESC}${ESC}[B`]: { dx: 0, dy: 1 },
  [`${ESC}${ESC}[C`]: { dx: 1, dy: 0 },
  [`${ESC}${ESC}[D`]: { dx: -1, dy: 0 },
}

/**
 * The modifier-free fallback, in every encoding the survey turned up. PageUp/PageDown are `ESC [ 5 ~`
 * and `ESC [ 6 ~` wherever they exist, but Home and End have three live spellings between xterm
 * (`ESC O H`), screen/tmux/linux (`ESC [ 1 ~`) and rxvt (`ESC [ 7 ~`), hence the table.
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
  /** > 0 while the Nexus draft is showing — digits pick from it instead of the construct menu, per
   *  engine.md 9.7's own list of what digits address: "the construct menu, Nexus draft, or a menu
   *  screen's options." Absent or 0 the rest of the time. */
  draftOptionCount?: number
  /** True while the commit confirmation is open, so Esc answers it rather than disarming or
   *  leaving — nothing can be armed while it is open anyway. */
  confirming?: boolean
}>

/** One already-split raw key to one command, or `null` when the key means nothing here. */
export function buildKeyboardCommand(key: string, context: KeyboardContext): BuildCommand | null {
  if (QUIT_KEYS.has(key)) return { kind: "quit" }
  if (key === ESC) {
    if (context.confirming) return { kind: "confirm-commit", accept: false }
    return context.armed ? { kind: "disarm" } : { kind: "back" }
  }
  if (PLACE_KEYS.has(key)) return { kind: "place" }
  if (REMOVE_KEYS.has(key)) return { kind: "remove" }
  if (key === "u") return { kind: "undo" }
  // Otherwise-idle keys: `y`/`n` only ever mean something while the confirmation is open, and the
  // reducer is what decides that — a stray `y` elsewhere is exactly as inert as a stray digit is
  // before anything is armed.
  if (key === "y") return { kind: "confirm-commit", accept: true }
  if (key === "n") return { kind: "confirm-commit", accept: false }
  if (key === "p") return { kind: "commit" }

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

  const meta = META_JUMPS[key]
  if (meta !== undefined) {
    return { kind: "move-cursor", dx: meta.dx * JUMP_TILES, dy: meta.dy * JUMP_TILES }
  }

  const fallback = FALLBACK_JUMPS[key]
  if (fallback !== undefined) return { kind: "move-cursor", ...fallback }

  // Digits always address the list, and never mean anything else on this screen — engine.md 9.7's
  // first convention, "no modes". `0` is the tenth row, not the zeroth. Which list is "the list"
  // changes with the screen, never with the key: the Nexus draft first, the construct menu once it
  // is picked.
  if (key.length === 1 && key >= "0" && key <= "9") {
    const index = key === "0" ? 9 : Number(key) - 1
    if (context.draftOptionCount !== undefined && context.draftOptionCount > 0) {
      return index < context.draftOptionCount ? { kind: "pick-nexus", index } : null
    }
    return index < context.itemCount ? { kind: "arm", index } : null
  }

  return null
}
