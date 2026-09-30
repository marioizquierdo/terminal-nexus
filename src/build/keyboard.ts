// The keyboard adapter — engine.md 9.7's keymap: one already-split raw key to one command. The cursor
// keys' byte spellings — measured, because a terminal can silently break Shift+Arrow — are one table
// shared with every list (`src/menu/list-keys.ts`): the fast move has a modifier-free fallback,
// PageUp/PageDown and Home/End, and the Option/Meta forms a Mac sends. The Controls and hotkeys page
// (`src/build/help.ts`, feedback F60) lists every one of them; the bottom line never did, on the
// owner's own call (2026-09-26: "leave pgup/home keys out, people will figure that out just fine").

import type { CursorKey } from "../menu/list-keys.ts"
import { cursorKeyOf, listKeyOf } from "../menu/list-keys.ts"
import type { PlaybackControl } from "../view/playback.ts"
import { START_KEY } from "./layout.ts"
import { DEFAULT_MOVE_TUNING, pressTiles } from "./motion.ts"
import type { PopupRow, PopupSpec } from "./popup.ts"
import type { BuildCommand, Focus, Popup } from "./types.ts"

export { cursorKeyOf } from "../menu/list-keys.ts"
export type { CursorKey } from "../menu/list-keys.ts"

const ESC = String.fromCharCode(27)
const PLACE_KEYS = new Set(["\r", "\n", " "])
const REMOVE_KEYS = new Set([String.fromCharCode(127), String.fromCharCode(8), `${ESC}[3~`])

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

/** A plain Left (`-1`) or Right (`+1`) — what changes a setting's value, and what the menu refuses — or
 *  `0` for any other key, a modified arrow included. */
function sideways(key: string): -1 | 0 | 1 {
  const cursor = cursorKeyOf(key)
  if (cursor === null || cursor.jump || cursor.dy !== 0) return 0
  return cursor.dx < 0 ? -1 : 1
}

/**
 * Up/Down in a list — the menu, or any popup's — as the command it is, or `null`: a plain arrow's rows
 * (one, or the input path's motion rules — `KeyboardContext.listRows`: taps counted, a hold on the
 * game's cadence), and the fast move — Shift, Option, PageUp/PageDown, Home/End — as a jump to that
 * end. Every list stops at its ends (owner, 2026-09-30, feedback F75); the keys are the title menu's too
 * (`src/menu/list-keys.ts`). A held key's repeat that came before its cadence allows a move is no rows,
 * and no command: Up and Down mean nothing else here, so `null` is exactly "nothing".
 */
function listCommand(key: string, context: KeyboardContext): BuildCommand | null {
  const list = listKeyOf(key)
  if (list === null) return null
  if (list.jump) return { kind: "highlight", delta: list.direction, jump: true }
  const rows = context.listRows?.(list.direction) ?? 1
  return rows === 0 ? null : { kind: "highlight", delta: list.direction * rows }
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
  /** The open popup as data (`popupSpec`) — its rows, each option naming its hotkey and the command a
   *  click on it sends, each setting its `decrease` and `increase`. The keyboard sends those same
   *  commands, so a key and a click on a popup's row cannot disagree. */
  popupSpec?: PopupSpec | null
  /** A Nexus Pulse is on screen (gate 6A): its playback keys are the screen's, ahead of the Grid's. */
  pulse?: boolean
  /**
   * How many tiles a cursor key moves, when the input path knows when keys arrive: its motion rules
   * (`src/build/motion.ts` — taps counted, a hold on the game's own cadence, the fast move's jump), which
   * answer 0 for a held key's repeat that came before the cadence allows a move, or a held jump's that
   * came too soon — nothing is sent for it. Absent — a driver, a test — every key is a press on its own
   * (`pressTiles`).
   */
  moveTiles?: (key: CursorKey) => number
  /** How many rows a plain Up or Down moves a list, the same way: the motion rules when timed (0 sends
   *  nothing), else one. */
  listRows?: (direction: -1 | 1) => number
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

/**
 * A popup's hand-written keys: those that close it besides Esc and `x` (the key that opened it, and
 * Enter where there is nothing to press), and the shortcuts that are no row of its own. Everything a
 * row does, its hotkey and Enter on it send from the popup's own data (`popupCommand`).
 */
function popupOwnKey(key: string, popup: Popup): BuildCommand | null {
  const close: BuildCommand = { kind: "cancel" }
  switch (popup) {
    case "game-menu":
      // `d` and `?` reach the Experiments and the Controls page from here, as they do from the game.
      if (key === "d") return { kind: "open-settings", section: "experiments" }
      return key === HELP_KEY ? { kind: "open-controls" } : null
    case "battle-round":
      // `y` still starts it, unlisted, for older scripts; `s`, Enter and Space are its one row's.
      return key === "y" ? { kind: "start-pulse" } : null
    case "nexus-powers":
      return key === "n" ? close : null
    case "settings":
      // `d` closes what `d` opened, the way `n` closes the Nexus popup.
      return key === "d" ? close : null
    case "export":
      // `e` closes what `e` opened, and so do Enter and Space: the text has nothing to press.
      return key === "e" || PLACE_KEYS.has(key) ? close : null
    case "controls":
      // `c` and `?` close what they opened, and so do Enter and Space (feedback F60).
      return key === "c" || key === HELP_KEY || PLACE_KEYS.has(key) ? close : null
    default:
      return null
  }
}

/** The row the keyboard is on in a popup, when it is one that does something: an option or a setting. */
function highlightedChoice(rows: readonly PopupRow[]): PopupRow | undefined {
  return rows.find((row) => (row.kind === "option" || row.kind === "setting") && row.highlighted === true)
}

/**
 * A key in an open popup. Everything else is swallowed: a popup that let `u` reach the plan underneath
 * it would be one the player cannot trust to be modal. Esc and `x` close any popup, back to the one it
 * was opened from (feedback F73: no popup needs an `[esc] Back` row of its own). Then the popup's own
 * keys (`popupOwnKey`), and then **its rows, as the popup's data names them** — "every popup is one
 * shape ... options naming the command a click sends":
 *
 * - an option's hotkey sends its command;
 * - Up/Down walk its list, when it has one to walk;
 * - Enter/Space send the highlighted option's command, or the highlighted setting's `increase`;
 * - Left/Right send the highlighted setting's `decrease` or `increase`.
 */
function popupCommand(key: string, popup: Popup, context: KeyboardContext): BuildCommand | null {
  const back = backCommand(key)
  if (back !== null) return back
  // A message has nothing to choose: only the cancel above closes it (feedback F34, "clicking outside
  // or pressing esc should close it").
  if (popup === "message") return null
  const own = popupOwnKey(key, popup)
  if (own !== null) return own
  const spec = context.popupSpec ?? null
  const rows = spec?.rows ?? []
  const option = rows.find((row) => row.kind === "option" && row.hotkey === key)
  if (option?.kind === "option") return option.command
  // `q` opens the game menu from any popup without a `[q]` row of its own (the game menu's is Quit).
  if (key === "q") return popup === "game-menu" ? null : { kind: "open-game-menu" }
  const choices = rows.filter((row) => row.kind === "option" || row.kind === "setting").length
  if (spec?.scroll !== undefined || choices > 1) {
    const list = listCommand(key, context)
    if (list !== null) return list
  }
  const on = highlightedChoice(rows)
  if (PLACE_KEYS.has(key)) {
    if (on?.kind === "option") return on.command
    // On a setting, Enter/Space is Right: a choice comes round, a number steps up.
    if (on?.kind === "setting") return on.increase
    // Nothing to press — the Nexus powers once the pick is made: the reducer says so.
    return { kind: "activate" }
  }
  const side = sideways(key)
  if (on?.kind !== "setting" || side === 0) return null
  return side < 0 ? on.decrease : on.increase
}

/** Any of the Grid's cursor keys, as the move it is — **the one place a move is sized**: the input
 *  path's motion rules when it times keys (`KeyboardContext.moveTiles`), and otherwise a press on its
 *  own, a tap or the fast move's jump (`pressTiles`) — or `null`, for another key or a move of none. */
function cursorMove(key: string, context: KeyboardContext): BuildCommand | null {
  const move = cursorKeyOf(key)
  if (move === null) return null
  const tiles = context.moveTiles?.(move) ?? pressTiles(move, DEFAULT_MOVE_TUNING)
  return tiles === 0 ? null : { kind: "move-cursor", dx: move.dx * tiles, dy: move.dy * tiles }
}

/**
 * One already-split raw key to one command, or `null` when the key means nothing here.
 *
 * **A key means one thing per screen** (engine.md 9.7's first convention): arrows and Enter/Space
 * follow focus — the menu, or the map in its modes (`mapMode`), where Enter places, or opens Explore
 * Map in plain navigation — while digits always address their row, and letters always name their
 * command, whichever half has focus. Backspace always sends `remove`, which the menu refuses with a
 * flicker, since the map cursor it would remove under is hidden there.
 */
export function buildKeyboardCommand(key: string, context: KeyboardContext): BuildCommand | null {
  // Ctrl+C always quits outright; `q` opens the game menu first, so a stray press cannot lose a plan.
  if (key === String.fromCharCode(3)) return { kind: "quit" }
  const popup = context.popup ?? null
  if (popup !== null) {
    return popupCommand(key, popup, context)
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

  if (focus === "menu") {
    // Up and Down walk the menu and stop at its ends; the fast move jumps to its first or last row.
    const list = listCommand(key, context)
    if (list !== null) return list
    // Left/Right have nothing to do on the menu: the row flickers so the player sees where the keys
    // went, and the keyboard stays on the menu (owner, 2026-09-30, feedback F55).
    if (sideways(key) !== 0) return { kind: "refuse-row" }
    if (PLACE_KEYS.has(key)) return { kind: "activate" }
  } else {
    if (PLACE_KEYS.has(key)) return context.armed ? { kind: "place" } : { kind: "open-explore" }
    const move = cursorMove(key, context)
    if (move !== null) return move
  }
  // Backspace removes what is planned under the map cursor — from the menu too, where the reducer
  // refuses it with the row's flicker, since the cursor is hidden there (feedback F17).
  if (REMOVE_KEYS.has(key)) return { kind: "remove" }

  // Digits always address the list, and never mean anything else on this screen — engine.md 9.7's
  // first convention, "no modes". `0` is the tenth row, not the zeroth. A digit arms its row from
  // either focus.
  const index = digitIndex(key)
  if (index !== null) return index < context.itemCount ? { kind: "arm", index } : null

  return null
}
