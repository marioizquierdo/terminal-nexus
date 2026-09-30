// The key-script language a scripted playtest is written in: readable key names in, the exact bytes a
// real terminal sends out. Kept apart from any one screen, so the same script grammar can later drive
// the main menu or a `grid` battle as well as the Build Phase.
//
// The bytes matter more than the names. A playtest is only worth anything if it goes through the
// real keyboard and mouse adapters the way a terminal would reach them (engine.md 9.7's driver rule),
// so every name below maps to the sequence a real terminal emits, and a mouse click becomes the same
// SGR report `parseMouseEvent` reads from a live terminal.
//
//   Up Down Left Right          plain arrows                    ESC [ A ...
//   S-Up S-Left ...             Shift+Arrow, xterm form         ESC [ 1 ; 2 A ...
//   M-Up M-Left ...             Option+Arrow with Option as Esc+ ESC ESC [ A ...
//   Tab S-Tab Esc Enter Space   the obvious ones                \t, ESC [ Z, ESC, \r, " "
//   Bksp Del                    backspace and forward delete    DEL (0x7f), ESC [ 3 ~
//   PgUp PgDn Home End          the modifier-free fast moves    ESC [ 5 ~, ESC [ 6 ~, ESC [ H, ESC [ F
//   C-c                         Ctrl+C                          0x03
//   a  1  ?                     any single printable character, sent as itself
//   Space*4                     any step repeated N times
//   Right~30*12                 a step arriving 30 ms after the one before (a held key's auto-repeat,
//                               or quick taps, for the motion rules); untimed steps are a second apart
//   Right/repeat Right/release  the key as a terminal that reports key events sends it (the kitty
//   Right/press                 keyboard protocol): ESC [ 1 ; 1 : 2 C, ESC [ 1 ; 1 : 3 C. Any key name
//                               takes one; a script with one plays such a terminal, so its plain
//                               presses are known presses too. `Right/repeat~30*10` times them
//   wait  wait~4000             nothing is pressed and time passes: a second by default, or the given
//                               milliseconds — how a scripted playtest of a Nexus Pulse lets it play on
//   click:20,13                 left click on Grid tile x=20, y=13, wherever it is drawn right now
//   click@40,7                  left click on frame cell column 40, row 7 (0-based)
//   rclick:… rclick@…           the same, with the right button
//   wheelup@… wheeldown@…       the mouse wheel over a frame cell
//   # comment                   to the end of the line, in a script file
//
// Names are case-insensitive. Each step is delivered on its own, never glued to the next: an Esc
// followed by another key in one read is one Option+key sequence to `keysFromChunk`, which is a real
// terminal's behaviour and exactly the trap a script must not fall into by accident.

import type { Coord } from "../grid/types.ts"
import { encodeKeyEvent } from "../view/key-events.ts"
import type { KeyPhase } from "../view/key-events.ts"
import { keysFromChunk } from "../view/playback.ts"

const ESC = String.fromCharCode(27)

const NAMED_KEYS: Readonly<Record<string, string>> = {
  up: `${ESC}[A`,
  down: `${ESC}[B`,
  right: `${ESC}[C`,
  left: `${ESC}[D`,
  "s-up": `${ESC}[1;2A`,
  "s-down": `${ESC}[1;2B`,
  "s-right": `${ESC}[1;2C`,
  "s-left": `${ESC}[1;2D`,
  "m-up": `${ESC}${ESC}[A`,
  "m-down": `${ESC}${ESC}[B`,
  "m-right": `${ESC}${ESC}[C`,
  "m-left": `${ESC}${ESC}[D`,
  tab: "\t",
  "s-tab": `${ESC}[Z`,
  esc: ESC,
  escape: ESC,
  enter: "\r",
  return: "\r",
  space: " ",
  bksp: String.fromCharCode(127),
  backspace: String.fromCharCode(127),
  del: `${ESC}[3~`,
  delete: `${ESC}[3~`,
  pgup: `${ESC}[5~`,
  pgdn: `${ESC}[6~`,
  home: `${ESC}[H`,
  end: `${ESC}[F`,
  "c-c": String.fromCharCode(3),
}

/** SGR mouse button codes, the same numbers `src/build/mouse.ts` reads. */
const MOUSE_BUTTONS: Readonly<Record<string, number>> = {
  click: 0,
  rclick: 2,
  wheelup: 64,
  wheeldown: 65,
}

/** One thing the player does. A key is its bytes; a mouse action keeps its target unresolved,
 *  because a tile's position on screen depends on where the camera is at the moment of the click.
 *  `afterMs`, when a script gives one (`Right~30`), is how long after the previous step it arrives —
 *  what the motion rules read (taps counted, holds on a cadence); without it, steps are a second
 *  apart, so every key is a tap that starts over. `phase`, when a script gives one (`Right/repeat`), is
 *  what a terminal reporting key events would mark the key as; `bytes` already say it. */
export type PlaytestStep =
  | Readonly<{ kind: "key"; label: string; bytes: string; afterMs?: number; phase?: KeyPhase }>
  /** Nothing is pressed: the script's clock moves on, and with it a Nexus Pulse playing on screen. */
  | Readonly<{ kind: "wait"; label: string; afterMs?: number }>
  | Readonly<{ kind: "mouse"; label: string; button: number; target: MouseTarget; afterMs?: number }>

export type MouseTarget =
  | Readonly<{ kind: "tile"; tile: Coord }>
  | Readonly<{ kind: "cell"; column: number; row: number }>

/** The whole script as steps, in order. Throws on the first name it does not know, naming it, so a
 *  typo fails loudly instead of silently becoming a different key. */
export function parseKeyScript(script: string): PlaytestStep[] {
  const steps: PlaytestStep[] = []
  const withoutComments = script
    .split("\n")
    .map((line) => line.replace(/#.*$/u, ""))
    .join(" ")
  for (const token of withoutComments.split(/\s+/u).filter((part) => part !== "")) {
    const repeat = /^(.+)\*(\d+)$/u.exec(token)
    const name = repeat === null ? token : (repeat[1] as string)
    const times = repeat === null ? 1 : Number(repeat[2])
    const step = parseStep(name)
    for (let index = 0; index < times; index += 1) steps.push(step)
  }
  return steps
}

function parseStep(token: string): PlaytestStep {
  const timed = /^(.+)~(\d+)$/u.exec(token)
  if (timed !== null) return { ...parseStep(timed[1] as string), label: token, afterMs: Number(timed[2]) }
  if (token.toLowerCase() === "wait") return { kind: "wait", label: token }
  const mouse = /^([a-z]+)([:@])(\d+),(\d+)$/iu.exec(token)
  if (mouse !== null) {
    const button = MOUSE_BUTTONS[(mouse[1] as string).toLowerCase()]
    if (button === undefined) throw new Error(`unknown mouse action "${token}"`)
    const first = Number(mouse[3])
    const second = Number(mouse[4])
    const target: MouseTarget =
      mouse[2] === ":" ? { kind: "tile", tile: { x: first, y: second } } : { kind: "cell", column: first, row: second }
    return { kind: "mouse", label: token, button, target }
  }
  // `Right/repeat`: the key as a terminal reporting key events marks it.
  const phased = /^(.+)\/(press|repeat|release)$/iu.exec(token)
  if (phased !== null) {
    const phase = (phased[2] as string).toLowerCase() as KeyPhase
    return { kind: "key", label: token, bytes: encodeKeyEvent(keyBytes(phased[1] as string), phase), phase }
  }

  return { kind: "key", label: token, bytes: keyBytes(token) }
}

/**
 * The bytes a terminal sends for one key name — the same table a script and the browser playtest
 * page's keys both go through (`src/web/keys.ts`), so the page's Esc is a script's `Esc`, byte for
 * byte. Throws on a name it does not know.
 */
export function keyBytes(name: string): string {
  const named = NAMED_KEYS[name.toLowerCase()]
  const bytes = named ?? ([...name].length === 1 ? name : null)
  if (bytes === null) {
    throw new Error(`unknown key "${name}" — see src/playtest/keys.ts for the names a script can use`)
  }
  // Every step must reach the adapters as exactly one key, or the script is not saying what it
  // appears to say.
  const split = keysFromChunk(bytes)
  if (split.length !== 1) throw new Error(`"${name}" would arrive as ${split.length} keys, not one`)
  return bytes
}
