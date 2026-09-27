// The browser playtest page's input, without the browser: a key press or a tap becomes the exact
// bytes a terminal would send, and the game's own keyboard and mouse adapters decide what they mean.
//
// Keys go through names — the same names a scripted playtest is written in (`src/playtest/keys.ts`)
// — so the page's Esc, Shift+Left or Option+Up is a script's `Esc`, `S-Left` or `M-Up`, byte for
// byte, and there is one table of what a terminal sends, not two. No DOM types: this file is plain
// data and functions, tested under Node like the rest.

import { formatMouseEvent } from "../build/mouse.ts"
import { keyBytes } from "../playtest/keys.ts"

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

/** One on-screen key: the key name it sends, and what it is labelled. */
export type KeyBarKey = Readonly<{ name: string; label: string }>

/** The keys an iPhone's own keyboard lacks, plus the letters each screen's key help names, so a
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
    { name: "p", label: "p" },
    { name: "y", label: "y" },
    { name: "d", label: "d debug" },
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
