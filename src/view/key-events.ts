// Key presses, repeats and releases, where the terminal reports them — the kitty keyboard protocol
// (Mario, asking for a setting: "We should enable/disable reading key-press in the settings, so I
// can test how it feels when the system provides it vs when it does not"; the design is
// progressive enhancement, noted in `docs/milestones/next-steps.md`).
//
// A classic terminal sends bytes only when a key goes down, and repeats them while it is held, so a
// hold can only be guessed from the gaps (`src/build/motion.ts`). A terminal that speaks the kitty
// protocol (kitty, WezTerm, Ghostty, foot, Alacritty; recent iTerm2 unmeasured) can be asked to mark
// every key as a press, a repeat or a release. This file is the three things that takes, all pure —
// the caller writes and reads the terminal:
//
//   - **the conversation**: ask whether the protocol is there (`CSI ? u`, then Device Attributes
//     `CSI c`, which every terminal answers — so an answer to the second with none to the first means
//     "no"), push flags 1 + 2 (disambiguate, report event types) when it is, and pop them again on the
//     way out — **on every exit path**, through the one disposer (`src/cli/build-phase.ts`): a terminal left
//     in this mode sends `CSI 99;5u` for Ctrl+C to the shell. `KeyboardProtocol` keeps that state;
//   - **the decoder**: a key in the protocol's forms (`CSI 1;1:2 C` a repeat of Right, `CSI 27 u` Esc,
//     `CSI 99;5 u` Ctrl+C) becomes the bytes the game's adapters already read (`CSI C`, ESC, 0x03) plus
//     the phase it carried. Everything a classic terminal sends comes back byte for byte, with no
//     phase — a plain press looks the same in both worlds, which is why the session also needs to know
//     whether the protocol is on (`BuildSession.setKeyReleases`);
//   - **the encoder**: the other way, for the scripted playtest's `Right/repeat` and the browser page,
//     which plays a terminal that speaks the protocol (`src/web/keys.ts`).

const ESC = "\u001b"
const CSI = `${ESC}[`

/** What a key event says it is. A classic terminal's bytes say none of these. */
export type KeyPhase = "press" | "repeat" | "release"

/** Asks whether the terminal speaks the protocol, then asks for Device Attributes, which every
 *  terminal answers: the second answer arriving without the first means it does not. */
export const KEYBOARD_QUERY = `${CSI}?u${CSI}c`
/** Pushes flags 1 (disambiguate: Esc, Ctrl and Alt keys as their own sequences) + 2 (report event
 *  types: press, repeat, release) onto the terminal's stack of keyboard modes. */
export const KEYBOARD_PUSH = `${CSI}>3u`
/** Pops what `KEYBOARD_PUSH` pushed, leaving the terminal's modes as they were. */
export const KEYBOARD_POP = `${CSI}<u`

/** One key as the game's adapters read it — the bytes a classic terminal sends for it — and the phase
 *  the terminal marked it with, or `null` when the bytes say nothing about one. */
export type KeyEvent = Readonly<{ key: string; phase: KeyPhase | null }>

/** A terminal's answer to `KEYBOARD_QUERY`: the protocol's current flags, or Device Attributes. */
export type TerminalReply = Readonly<{ kind: "keyboard-flags"; flags: number }> | Readonly<{ kind: "device-attributes" }>

const KEYBOARD_FLAGS_REPLY = /^\u001b\[\?(\d+)u$/u
const DEVICE_ATTRIBUTES_REPLY = /^\u001b\[\?[\d;]*c$/u

/** One already-split key as a terminal's answer to the query, or `null` for anything else. */
export function terminalReplyOf(key: string): TerminalReply | null {
  const flags = KEYBOARD_FLAGS_REPLY.exec(key)
  if (flags !== null) return { kind: "keyboard-flags", flags: Number(flags[1]) }
  return DEVICE_ATTRIBUTES_REPLY.test(key) ? { kind: "device-attributes" } : null
}

/** `CSI number[:alternates] ; modifiers[:event] [; text] final` — the protocol's one shape, for its
 *  own `u` keys and for the legacy functional keys it marks (arrows, Home/End, `~` keys). */
const KITTY_KEY = /^\u001b\[([\d:]*)(?:;([\d:]*))?(?:;[\d:]*)?([ABCDEFHPQSu~])$/u

const PHASES: Readonly<Record<string, KeyPhase>> = { "1": "press", "2": "repeat", "3": "release" }

/** The modifier bits that change what a key means: Shift 1, Alt 2, Ctrl 4, Super 8, Hyper 16, Meta
 *  32. Caps Lock (64) and Num Lock (128) are states, not modifiers: a plain arrow with Num Lock on is
 *  still a plain arrow. */
const MEANINGFUL_MODIFIERS = 0b111111
const SHIFT = 1
const ALT = 2
const CTRL = 4
const SUPER_HYPER_META = 8 | 16 | 32

/** The keypad's keys, which the protocol reports under codes of their own once it disambiguates, as
 *  the keys they stand for. */
const KEYPAD: Readonly<Record<number, string>> = {
  57399: "0",
  57400: "1",
  57401: "2",
  57402: "3",
  57403: "4",
  57404: "5",
  57405: "6",
  57406: "7",
  57407: "8",
  57408: "9",
  57409: ".",
  57410: "/",
  57411: "*",
  57412: "-",
  57413: "+",
  57414: "\r",
  57415: "=",
  57417: `${CSI}D`,
  57418: `${CSI}C`,
  57419: `${CSI}A`,
  57420: `${CSI}B`,
  57421: `${CSI}5~`,
  57422: `${CSI}6~`,
  57423: `${CSI}H`,
  57424: `${CSI}F`,
  57426: `${CSI}3~`,
}

/** A `u` key — a Unicode code point, or one of the protocol's own numbers — as a classic terminal's
 *  bytes, or `null` for a key the game has no use for (a Super shortcut, a media key). */
function legacyOfCode(code: number, modifiers: number): string | null {
  if ((modifiers & SUPER_HYPER_META) !== 0) return null
  switch (code) {
    case 27:
      return ESC
    case 13:
      return "\r"
    case 9:
      return (modifiers & SHIFT) !== 0 ? `${CSI}Z` : "\t"
    case 127:
    case 8:
      return String.fromCharCode(127)
    default:
      break
  }
  const keypad = KEYPAD[code]
  if (keypad !== undefined) return keypad
  if (code < 32 || code >= 57344) return null
  const character = String.fromCodePoint(code)
  if ((modifiers & CTRL) !== 0) {
    // Ctrl with a letter is the control character it has always been: Ctrl+C is 0x03, the quit.
    const lower = character.toLowerCase()
    return lower >= "a" && lower <= "z" && lower.length === 1 ? String.fromCharCode(lower.charCodeAt(0) - 96) : null
  }
  const shifted = (modifiers & SHIFT) !== 0 ? character.toUpperCase() : character
  // Alt with a key is ESC and the key — `ESC b` is Option+Left as a Mac sends it (`src/menu/list-keys.ts`).
  return (modifiers & ALT) !== 0 ? `${ESC}${shifted}` : shifted
}

/**
 * One already-split key (`keysFromChunk`) as the key the adapters read and the phase the terminal
 * gave it; `null` for a terminal's answer to a query, or a key the protocol reports that means
 * nothing here. **A classic terminal's bytes come back unchanged, with no phase**: only the protocol's
 * own forms — a `u` key, or an event type after a colon — are rewritten.
 */
export function decodeKeyEvent(key: string): KeyEvent | null {
  if (terminalReplyOf(key) !== null) return null
  const match = KITTY_KEY.exec(key)
  if (match === null) return { key, phase: null }
  const [, numbers = "", modifierField, final = ""] = match
  const [modifierText = "", eventText] = (modifierField ?? "").split(":")
  const explicit = eventText === undefined ? null : (PHASES[eventText] ?? null)
  const bits = (modifierText === "" ? 1 : Number(modifierText)) - 1
  // A classic terminal's own form (`CSI A`, `CSI 1;2 C`, `CSI 5 ~`): nothing to rewrite. (A lock bit
  // is the protocol's alone — xterm's modifiers stop at 16 — so a press with one is rewritten too.)
  if (explicit === null && final !== "u" && (bits & ~MEANINGFUL_MODIFIERS) === 0) return { key, phase: null }
  const modifiers = bits & MEANINGFUL_MODIFIERS
  const number = Number((numbers.split(":")[0] ?? "") || "1")
  let legacy: string | null
  switch (final) {
    case "u":
      legacy = legacyOfCode(number, modifiers)
      break
    case "A":
    case "B":
    case "C":
    case "D":
      // An arrow keeps its modifiers: any of them makes it the fast move.
      legacy = modifiers === 0 ? `${CSI}${final}` : `${CSI}1;${modifiers + 1}${final}`
      break
    case "H":
    case "F":
      legacy = `${CSI}${final}`
      break
    case "~":
      legacy = `${CSI}${number}~`
      break
    default:
      legacy = null
  }
  return legacy === null ? null : { key: legacy, phase: explicit }
}

/** The protocol's arrows and Home/End: a classic `CSI X`, or xterm's modified `CSI 1 ; m X`. */
const LEGACY_LETTER_KEY = /^\u001b\[(?:1;(\d+))?([ABCDHF])$/u
/** Option as ESC before an arrow (`ESC ESC [ A`): the protocol reports it as Alt with the arrow. */
const META_ARROW = /^\u001b\u001b\[([ABCD])$/u
const TILDE_KEY = /^\u001b\[(\d+)~$/u

/**
 * A classic terminal's bytes for one key, as the protocol reports it with an explicit phase:
 * `CSI C` and "repeat" is `CSI 1;1:2 C`, ESC and "release" `CSI 27;1:3 u`. For the scripted
 * playtest's phased steps and the browser page. Throws for bytes it has no form for (a mouse report).
 */
export function encodeKeyEvent(key: string, phase: KeyPhase): string {
  const event = phase === "press" ? 1 : phase === "repeat" ? 2 : 3
  const letter = LEGACY_LETTER_KEY.exec(key)
  if (letter !== null) return `${CSI}1;${letter[1] ?? "1"}:${event}${letter[2]}`
  const meta = META_ARROW.exec(key)
  if (meta !== null) return `${CSI}1;${1 + ALT}:${event}${meta[1]}`
  const tilde = TILDE_KEY.exec(key)
  if (tilde !== null) return `${CSI}${tilde[1]};1:${event}~`
  if (key === `${CSI}Z`) return `${CSI}9;${1 + SHIFT}:${event}u`
  const characters = [...key]
  if (characters.length === 2 && characters[0] === ESC) return `${CSI}${(characters[1] as string).codePointAt(0)};${1 + ALT}:${event}u`
  if (characters.length === 1) {
    const code = (characters[0] as string).codePointAt(0) as number
    if (code === 3) return `${CSI}99;${1 + CTRL}:${event}u`
    return `${CSI}${code};1:${event}u`
  }
  throw new Error(`no key event form for ${JSON.stringify(key)}`)
}

/** Whether the terminal has said it speaks the protocol: not asked yet, asked, yes, or no. */
export type KeyboardSupport = "unknown" | "asking" | "yes" | "no"

/**
 * The game's side of the conversation — what to write, given what is wanted and what the terminal
 * has answered. Pure: each method returns the bytes to write (often none), and the caller writes
 * them. **`release()` is the disposer's step**: it pops the flags if, and only if, they were pushed,
 * so a terminal is always left in the mode it was found in.
 */
export class KeyboardProtocol {
  private support: KeyboardSupport = "unknown"
  private wanted = false
  private pushed = false

  /** Whether the flags are pushed: the terminal is marking presses, repeats and releases now. */
  get active(): boolean {
    return this.pushed
  }

  /** What the terminal has said so far. */
  get answered(): KeyboardSupport {
    return this.support
  }

  /** The player's choice (the Key releases Experiment): ask, push, or pop, as it needs. */
  want(on: boolean): string {
    this.wanted = on
    if (!on) return this.release()
    if (this.support === "unknown") {
      this.support = "asking"
      return KEYBOARD_QUERY
    }
    return this.pushIfReady()
  }

  /** The terminal answered. Its flags mean yes (and the flags are pushed if still wanted); Device
   *  Attributes with no flags before them mean no. */
  hear(reply: TerminalReply): string {
    if (reply.kind === "keyboard-flags") {
      this.support = "yes"
      return this.pushIfReady()
    }
    if (this.support === "asking") this.support = "no"
    return ""
  }

  /** Pops the flags if they are pushed — the way out, on every exit path — or nothing. */
  release(): string {
    if (!this.pushed) return ""
    this.pushed = false
    return KEYBOARD_POP
  }

  private pushIfReady(): string {
    if (!this.wanted || this.pushed || this.support !== "yes") return ""
    this.pushed = true
    return KEYBOARD_PUSH
  }
}
