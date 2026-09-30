// The browser playtest page's input, without the browser: a key press or a tap becomes the exact
// bytes a terminal would send, and the game's own keyboard and mouse adapters decide what they mean.
//
// Keys go through names — the same names a scripted playtest is written in (`src/playtest/keys.ts`)
// — so the page's Esc, Shift+Left or Option+Up is a script's `Esc`, `S-Left` or `M-Up`, byte for
// byte, and there is one table of what a terminal sends, not two. No DOM types: this file is plain
// data and functions, tested under Node like the rest.

import { formatMouseEvent } from "../build/mouse.ts"
import { cursorKeyOf } from "../menu/list-keys.ts"
import { keyBytes } from "../playtest/keys.ts"
import { encodeKeyEvent } from "../view/key-events.ts"
import type { KeyPhase } from "../view/key-events.ts"

/** The parts of a browser `KeyboardEvent` this page reads. */
export type KeyPress = Readonly<{
  key: string
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}>

const ARROWS: Readonly<Record<string, string>> = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
}

const PLAIN: Readonly<Record<string, string>> = {
  Enter: "Enter",
  Escape: "Esc",
  Backspace: "Bksp",
  Delete: "Del",
  PageUp: "PgUp",
  PageDown: "PgDn",
  Home: "Home",
  End: "End",
  " ": "Space",
}

/**
 * The key name for a hardware key press (an iPad's keyboard, a laptop's), or `null` for one the game
 * has no use for — a Cmd shortcut stays the browser's. Shift+Arrow is the fast move and Option+Arrow
 * the terminal's Esc-prefixed form of it, exactly as a terminal would report them.
 */
export function keyNameFor(press: KeyPress): string | null {
  const arrow = ARROWS[press.key]
  if (arrow !== undefined) {
    if (press.altKey) return `M-${arrow}`
    if (press.shiftKey) return `S-${arrow}`
    return arrow
  }
  if (press.metaKey) return null
  if (press.ctrlKey) return press.key.toLowerCase() === "c" ? "C-c" : null
  if (press.key === "Tab") return press.shiftKey ? "S-Tab" : "Tab"
  const plain = PLAIN[press.key]
  if (plain !== undefined) return plain
  return [...press.key].length === 1 ? press.key : null
}

/** The bytes for a hardware key press, or `null` when the page should leave the key to the browser. */
export function bytesForKeyPress(press: KeyPress): string | null {
  const name = keyNameFor(press)
  return name === null ? null : keyBytes(name)
}

const ESC = String.fromCharCode(27)
/** What a screen loop writes to ask about, switch on and switch off the kitty keyboard protocol
 *  (`src/view/key-events.ts`), and Device Attributes — as a terminal reads them. */
const PROTOCOL_WRITES = /\u001b\[(?:>(\d*)u|<(\d*)u|(\?)u|(c))/gu
/** Flag 1: Esc, Ctrl and Alt keys as their own sequences. Flag 2: presses, repeats and releases marked. */
const DISAMBIGUATE = 1
const EVENT_TYPES = 2

/**
 * **The page plays a terminal that speaks the kitty keyboard protocol** — the browser has real
 * `keydown`, `keyup` and `repeat`, so it can say what a classic terminal cannot. The Build Phase's
 * loop asks and pushes exactly as it does in a terminal (the Key releases Experiment, `auto` by
 * default); this answers, keeps the stack of modes, and turns each key event into the bytes such a
 * terminal sends: a press as ever, a repeat or a release of a cursor key marked (`ESC [ 1 ; 1 : 2 C`),
 * Esc as `ESC [ 27 u`. With the Experiment `off` nothing is pushed, and the page sends a classic
 * terminal's bytes and no releases. No DOM here: the host hands in what the loop wrote and each key
 * event, and delivers what comes back as input.
 */
export class StandInKeyboard {
  private readonly stack: number[] = []

  /** The protocol's flags in force: the top of the stack, or none. */
  get flags(): number {
    return this.stack.at(-1) ?? 0
  }

  /** What a loop wrote, read as a terminal reads it: a push or a pop changes the flags, and the
   *  question and Device Attributes are answered — returned, for the host to deliver as input. */
  written(text: string): string {
    let replies = ""
    for (const match of text.matchAll(PROTOCOL_WRITES)) {
      const [, push, pop, query, attributes] = match
      if (push !== undefined) this.stack.push(Number(push || "0"))
      else if (pop !== undefined) this.stack.splice(Math.max(0, this.stack.length - Number(pop || "1")))
      else if (query !== undefined) replies += `${ESC}[?${this.flags}u`
      else if (attributes !== undefined) replies += `${ESC}[?62;22c`
    }
    return replies
  }

  /** The bytes for one key event, or `null` when there are none to send: a key the page leaves to the
   *  browser, or a release no terminal would report (every release, with the protocol off). */
  bytesFor(press: KeyPress, phase: KeyPhase): string | null {
    const name = keyNameFor(press)
    if (name === null) return null
    const legacy = keyBytes(name)
    const flags = this.flags
    if ((flags & EVENT_TYPES) === 0) return phase === "release" ? null : legacy
    if (legacy === ESC && (flags & DISAMBIGUATE) !== 0) return phase === "release" ? null : encodeKeyEvent(ESC, phase)
    // A cursor key says which of the three it is; any other key repeats as itself and its release, which
    // the game has no use for, is not sent.
    if (cursorKeyOf(legacy) !== null) return phase === "press" ? legacy : encodeKeyEvent(legacy, phase)
    return phase === "release" ? null : legacy
  }
}

/** One on-screen key: the key name it sends, and what it is labelled. */
export type KeyBarKey = Readonly<{ name: string; label: string }>

/** The keys an iPhone's own keyboard lacks, plus the letters each screen's rows and hints name, so a
 *  whole Build Phase plays from the bar alone. Shift is the bar's one toggle: it turns the next arrow
 *  into Shift+Arrow, the fast move. */
export const KEY_BAR: Readonly<Record<"common" | "menu" | "build" | "pulse", readonly KeyBarKey[]>> = {
  common: [
    { name: "Left", label: "←" },
    { name: "Up", label: "↑" },
    { name: "Down", label: "↓" },
    { name: "Right", label: "→" },
    { name: "Tab", label: "Tab" },
    { name: "Esc", label: "Esc" },
    { name: "Enter", label: "Enter" },
    { name: "Space", label: "Space" },
  ],
  menu: [
    { name: "1", label: "1" },
    { name: "2", label: "2" },
    { name: "3", label: "3" },
    { name: "4", label: "4" },
    { name: "5", label: "5" },
    { name: "q", label: "q" },
  ],
  build: [
    { name: "n", label: "n" },
    { name: "e", label: "e" },
    { name: "1", label: "1" },
    { name: "2", label: "2" },
    { name: "3", label: "3" },
    { name: "u", label: "u" },
    { name: "Bksp", label: "Bksp" },
    // `s` starts the Nexus Pulse (and, in the game menu that Esc opens, is Settings); Enter or Space
    // in the popup that asks confirms it.
    { name: "s", label: "s start" },
    // A Nexus Pulse plays on this screen once it is started: Space pauses it, these two set its
    // speed, and `r` (below) watches it again.
    { name: "[", label: "[ slower" },
    { name: "]", label: "] faster" },
    // Settings is Esc then s; its Experiments are d; e exports inside it; r restarts from the game menu.
    { name: "d", label: "d experiments" },
    // Every key and click, by situation (the game menu's Controls and hotkeys page).
    { name: "?", label: "? controls" },
    { name: "r", label: "r" },
    { name: "q", label: "q" },
  ],
  pulse: [
    { name: ".", label: ". frame" },
    { name: ",", label: ", tick" },
    { name: "[", label: "[ slower" },
    { name: "]", label: "] faster" },
    { name: "r", label: "r restart" },
    { name: "q", label: "q" },
  ],
}

/** An arrow's name with the bar's Shift toggle applied. */
export function withShift(name: string, shift: boolean): string {
  return shift && ARROWS[`Arrow${name}`] !== undefined ? `S-${name}` : name
}

/** A tap or a click on a cell, as the press and release a terminal reports (0-based in, the
 *  terminal's 1-based SGR out). The wheel reports a press only, like a terminal. */
export function mouseBytes(button: number, column: number, row: number, press: boolean): string {
  const bytes = formatMouseEvent(button, column + 1, row + 1)
  return press ? bytes : `${bytes.slice(0, -1)}m`
}
