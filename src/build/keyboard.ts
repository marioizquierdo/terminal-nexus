// The keyboard adapter — engine.md 9.7's keymap, and the one part of it a terminal can silently
// break. Shift+Arrow is neither universal nor single-valued (measured by
// `scripts/probe-modified-keys.mjs`; the table is in `evidence/gate-5a-report.md`):
//
//   - xterm and tmux send `ESC [ 1 ; 2 A` and its siblings;
//   - rxvt sends a shorter, unrelated form: `ESC [ a b c d`;
//   - screen, the Linux console, vt100, vt220 and ansi define no shifted arrow at all.
//
// So both families are accepted, and the fast move (five tiles until gate 5H; since the owner's
// 2026-09-28 playtest a jump, now of the tuned `TUNING.jumpStep`) also has a modifier-free fallback —
// PageUp/PageDown and Home/End — plus the Option/Meta forms a Mac sends. The Controls and hotkeys page
// (`src/build/help.ts`, feedback F60) lists every one of them; the bottom line never did, on the
// owner's own call (2026-09-26: "leave pgup/home keys out, people will figure that out just fine").

import { listKeyOf } from "../menu/list-keys.ts"
import type { PlaybackControl } from "../view/playback.ts"
import { START_KEY } from "./layout.ts"
import { GAME_MENU_ROWS } from "./settings.ts"
import { TUNING } from "./tuning.ts"
import type { BuildCommand, Focus, Popup } from "./types.ts"

const ESC = String.fromCharCode(27)
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
  [`${ESC}[5~`]: { dx: 0, dy: -1 },
  [`${ESC}[6~`]: { dx: 0, dy: 1 },
  [`${ESC}[H`]: { dx: -1, dy: 0 },
  [`${ESC}OH`]: { dx: -1, dy: 0 },
  [`${ESC}[1~`]: { dx: -1, dy: 0 },
  [`${ESC}[7~`]: { dx: -1, dy: 0 },
  [`${ESC}[F`]: { dx: 1, dy: 0 },
  [`${ESC}OF`]: { dx: 1, dy: 0 },
  [`${ESC}[4~`]: { dx: 1, dy: 0 },
  [`${ESC}[8~`]: { dx: 1, dy: 0 },
}

/** `grid watch`'s keymap, kept for the Nexus Pulse (engine.md 9.7: one keymap across `grid` and
 *  `terminal-nexus`) — Space pauses, `[` and `]` change the speed, `.` and `,` step a frame and a tick,
 *  `r` watches it again. Only while a Pulse is on screen, and never inside a popup. */
const PULSE_KEYS: Readonly<Record<string, PlaybackControl>> = {
  " ": "toggle",
  "[": "slower",
  "]": "faster",
  ".": "step-frame",
  ",": "step-tick",
  r: "restart",
}

const TAB = "\t"
const MENU_LEFT = new Set([`${ESC}[D`, `${ESC}OD`])
const MENU_RIGHT = new Set([`${ESC}[C`, `${ESC}OC`])

/**
 * Up/Down in a list — the menu, or any popup's — as the command it is, or `null`: one row for a plain
 * arrow (the session scales a held one with the map cursor's ramp), and the fast move — Shift, Option,
 * PageUp/PageDown, Home/End — as a jump to that end. Every list stops at its ends (owner, 2026-09-30,
 * feedback F75); the keys are the title menu's too (`src/menu/list-keys.ts`).
 */
function listCommand(key: string): BuildCommand | null {
  const list = listKeyOf(key)
  if (list === null) return null
  return list.jump ? { kind: "highlight", delta: list.direction, jump: true } : { kind: "highlight", delta: list.direction }
}

export type KeyboardContext = Readonly<{
  /** How many construct-menu rows there are, so a digit past the end of the list means nothing
   *  rather than arming something that is not on screen. */
  itemCount: number
  /** Whether a structure is armed: on the Grid, Enter/Space then places rather than opening Explore Map. */
  armed: boolean
  /** Which half of the screen arrows and Enter/Space belong to (gate 5F). Defaults to the Grid, the
   *  meaning every key had before focus existed. */
  focus?: Focus
  /** The popup that is open, if any. A popup holds the keyboard: only its own keys reach it, and
   *  nothing underneath answers a key until it closes. */
  popup?: Popup | null
  /** While the Nexus popup is open: how many powers are waiting to be picked, so a digit past them
   *  means nothing. */
  popupPendingCount?: number
  /** The open popup's highlight — which of the game menu's rows Enter means. */
  popupHighlight?: number
  /** A Nexus Pulse is on screen (gate 6A): its playback keys are the screen's, ahead of the Grid's. */
  pulse?: boolean
}>

function digitIndex(key: string): number | null {
  if (key.length !== 1 || key < "0" || key > "9") return null
  return key === "0" ? 9 : Number(key) - 1
}

/**
 * Esc and `x` walk back the same way, one level at a time — with one difference, on the menu with
 * nothing open: Esc opens the game menu, and `x` does nothing (owner, 2026-09-30, feedback F62: "Menu
 * should only open with 'esc', but not with 'x'. I think this is the only exception to the rule of esc
 * and x are the same"). So `x x x` always lands on the menu and stays there.
 */
function backCommand(key: string): BuildCommand | null {
  if (key === ESC) return { kind: "cancel" }
  if (key === "x") return { kind: "back" }
  return null
}

/** `?` opens the Controls and hotkeys page — from the game, and from the game menu (feedback F60). */
const HELP_KEY = "?"

/** A popup's own keys. Everything else is swallowed: a popup that let `u` reach the plan underneath
 *  it would be one the player cannot trust to be modal. Esc and `x` close any popup, back to the one it
 *  was opened from (feedback F73: no popup needs an `[esc] Back` row of its own). */
function popupCommand(key: string, popup: Popup, pendingCount: number, highlight: number): BuildCommand | null {
  const back = backCommand(key)
  if (back !== null) return back
  switch (popup) {
    case "game-menu": {
      // The game menu (owner, 2026-09-28): its own hotkeys, or Up/Down and Enter on its rows. Enter
      // on `[q] Quit` is the quit itself — the reducer never sees a quit it would have to pass on.
      if (key === "q") return { kind: "quit" }
      if (key === "s") return { kind: "open-settings", section: "settings" }
      // `[c] Controls and hotkeys` (feedback F60); `?` is the page's own shortcut, here as in the game.
      if (key === "c" || key === HELP_KEY) return { kind: "open-controls" }
      if (key === "r") return { kind: "restart" }
      if (key === "d") return { kind: "open-settings", section: "experiments" }
      const list = listCommand(key)
      if (list !== null) return list
      if (PLACE_KEYS.has(key)) return GAME_MENU_ROWS[highlight] === "quit" ? { kind: "quit" } : { kind: "activate" }
      return null
    }
    case "battle-round":
      // Enter, Space and `s` again start the Pulse (owner, 2026-09-29, feedback F42) — `s` is the key
      // that asked, so pressing it twice is "yes"; `y` still works, unlisted, for older scripts. Going
      // back is Esc's, above: there is no second row to press (feedback F50).
      if (key === START_KEY || key === "y" || PLACE_KEYS.has(key)) return { kind: "start-pulse" }
      return key === "q" ? { kind: "open-game-menu" } : null
    case "nexus-powers": {
      if (key === "n") return { kind: "cancel" }
      if (key === "q") return { kind: "open-game-menu" }
      const list = listCommand(key)
      if (list !== null) return list
      if (PLACE_KEYS.has(key)) return { kind: "activate" }
      const index = digitIndex(key)
      if (index !== null && index < pendingCount) return { kind: "pick-nexus", index }
      return null
    }
    case "settings": {
      // `d` closes what `d` opened, the way `n` closes the Nexus popup.
      if (key === "d") return { kind: "cancel" }
      if (key === "q") return { kind: "open-game-menu" }
      // Export settings is the list's last row; `e` still reaches it from anywhere in the list. The
      // restart is the game menu's `[r]` now (feedback F34).
      if (key === "e") return { kind: "export-settings" }
      const list = listCommand(key)
      if (list !== null) return list
      // Left and Right change the highlighted setting's value — the one popup whose rows have one.
      if (MENU_LEFT.has(key)) return { kind: "nudge", direction: "left" }
      if (MENU_RIGHT.has(key)) return { kind: "nudge", direction: "right" }
      if (PLACE_KEYS.has(key)) return { kind: "activate" }
      return null
    }
    case "export": {
      // `e` closes what `e` opened; Up/Down scroll the text.
      if (key === "e" || PLACE_KEYS.has(key)) return { kind: "cancel" }
      if (key === "q") return { kind: "open-game-menu" }
      return listCommand(key)
    }
    case "message":
      // Nothing to choose: only the cancel above closes it (feedback F34, "clicking outside or pressing
      // esc should close it").
      return null
    case "controls": {
      // The Controls page (feedback F60) scrolls like the export: Up/Down walk it; `c` and `?` close
      // what they opened, and so do Enter and Space — there is nothing on it to press.
      if (key === "c" || key === HELP_KEY || PLACE_KEYS.has(key)) return { kind: "cancel" }
      if (key === "q") return { kind: "open-game-menu" }
      return listCommand(key)
    }
    default:
      return null
  }
}

/** A cursor key's direction, one tile long, and whether it is the fast move. */
export type CursorKey = Readonly<{ dx: number; dy: number; jump: boolean }>

/**
 * Any of the Grid's cursor keys, classified — or `null`. The plain arrows are what a held key's ramp
 * applies to (`src/build/motion.ts`); every other form is the fast move, a jump whose size is a tuned value
 * (`TUNING.jumpStep`) rather than anything timing decides (timing only decides how often a held one repeats).
 */
export function cursorKeyOf(key: string): CursorKey | null {
  const plain = PLAIN_ARROWS[key]
  if (plain !== undefined) return { ...plain, jump: false }

  const rxvt = RXVT_SHIFTED_ARROWS[key]
  if (rxvt !== undefined) return { ...rxvt, jump: true }

  const modified = XTERM_MODIFIED_ARROW.exec(key)
  if (modified !== null) {
    const direction = ARROW_LETTERS[modified[2] as string]
    if (direction !== undefined && Number(modified[1]) >= 2) return { ...direction, jump: true }
  }

  const meta = META_JUMPS[key]
  if (meta !== undefined) return { ...meta, jump: true }

  const fallback = FALLBACK_JUMPS[key]
  if (fallback !== undefined) return { ...fallback, jump: true }
  return null
}

/** Any of the Grid's cursor keys, as the move it is — one tile for a plain arrow (the input path may
 *  scale it for a held key), the tuned jump (`TUNING.jumpStep`) for the fast move — or `null`. */
function cursorMove(key: string): BuildCommand | null {
  const move = cursorKeyOf(key)
  if (move === null) return null
  const tiles = move.jump ? TUNING.jumpStep : 1
  return { kind: "move-cursor", dx: move.dx * tiles, dy: move.dy * tiles }
}

/**
 * One already-split raw key to one command, or `null` when the key means nothing here.
 *
 * **Focus is the one mode this screen has, and it is the one engine.md 9.7's first convention
 * allows**: "if a panel genuinely needs arrow keys of its own... Tab moves focus and the footer says
 * where focus is." Arrows and Enter/Space follow focus; nothing else does — a digit arms its row, `n`
 * opens the Nexus Powers, `u`, Backspace and `p` do what they always did, whichever half has focus.
 */
export function buildKeyboardCommand(key: string, context: KeyboardContext): BuildCommand | null {
  // Ctrl+C always quits outright; `q` opens the game menu first, so a stray press cannot lose a plan.
  if (key === String.fromCharCode(3)) return { kind: "quit" }
  const popup = context.popup ?? null
  if (popup !== null) {
    return popupCommand(key, popup, context.popupPendingCount ?? 0, context.popupHighlight ?? 0)
  }
  const focus = context.focus ?? "grid"

  // A Nexus Pulse on screen takes its own playback keys first: Space pauses it rather than opening
  // Explore Map, and `r` watches it again. Everything else — the arrows that look around the map, Esc,
  // `q`, `d` — is still the screen's.
  if (context.pulse === true) {
    const control = PULSE_KEYS[key]
    if (control !== undefined) return { kind: "pulse", control }
  }

  // Esc and `x` walk back a stack the reducer knows: placing or Explore Map to where it began, the map
  // to the menu, disarming — and then, on the menu, Esc opens the game menu while `x` stops (F62).
  const back = backCommand(key)
  if (back !== null) return back
  if (key === "q") return { kind: "open-game-menu" }
  if (key === TAB) return { kind: "focus", target: focus === "grid" ? "menu" : "grid" }
  if (key === "u") return { kind: "undo" }
  if (key === "n") return { kind: "open-nexus-powers" }
  if (key === "e") return { kind: "explore" }
  // `d`: Settings, opened at its Experiments.
  if (key === "d") return { kind: "open-settings", section: "experiments" }
  // `?` opens the Controls and hotkeys page from the game — a shortcut the page itself names.
  if (key === HELP_KEY) return { kind: "open-controls" }
  // `s` is the Start Pulse row's key (feedback F41, F47); `p`, its first key, is kept as another way to press it.
  if (key === START_KEY || key === "p") return { kind: "open-battle-round" }
  // `y` only ever means something while the Battle Round confirmation is open; outside it is inert.
  if (key === "y") return null

  if (focus === "menu") {
    // Up and Down walk the menu and stop at its ends; the fast move jumps to its first or last row.
    const list = listCommand(key)
    if (list !== null) return list
    // Left/Right have nothing to do on the menu: the row flickers so the player sees where the keys
    // went, and the keyboard stays on the menu (owner, 2026-09-30, feedback F55).
    if (MENU_LEFT.has(key)) return { kind: "nudge", direction: "left" }
    if (MENU_RIGHT.has(key)) return { kind: "nudge", direction: "right" }
    if (PLACE_KEYS.has(key)) return { kind: "activate" }
    // Backspace removes what is under the map cursor, which is hidden while the menu has the
    // keyboard: the row flickers, like Left, to say the key arrived and has nothing to do here
    // (feedback F17).
    if (REMOVE_KEYS.has(key)) return { kind: "nudge", direction: "left" }
  } else {
    if (PLACE_KEYS.has(key)) return context.armed ? { kind: "place" } : { kind: "open-explore" }
    if (REMOVE_KEYS.has(key)) return { kind: "remove" }
    const move = cursorMove(key)
    if (move !== null) return move
  }

  // Digits always address the list, and never mean anything else on this screen — engine.md 9.7's
  // first convention, "no modes". `0` is the tenth row, not the zeroth. A digit arms its row from
  // either focus.
  const index = digitIndex(key)
  if (index !== null) return index < context.itemCount ? { kind: "arm", index } : null

  return null
}
