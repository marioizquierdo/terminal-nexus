// The keys that move a cursor — the Build Phase's map cursor, and a list's highlight — in every byte
// spelling a terminal sends, in one table, and the one rule every list follows with them (owner,
// 2026-09-30, feedback F75: "The navigation with up/down arrows in the menus should not rotate ... if I
// keep down pressed, it should quickly move to the bottom and stay there ... Pressing shift + up should
// bring the cursor all the way to the top (or pgup, etc), this is the same convention as moving in the
// map"). Shared by the title screen's menu and every list in the Build Phase — its menu, the Nexus
// powers, the game menu, Settings, the export and the Controls page — and by the map cursor, so they
// cannot drift apart.
//
// **The spellings are measured** (`scripts/probe-modified-keys.mjs`; the table is in
// `evidence/gate-5a-report.md`). Shift+Arrow is neither universal nor single-valued:
//
//   - xterm and tmux send `ESC [ 1 ; 2 A` and its siblings;
//   - rxvt sends a shorter, unrelated form: `ESC [ a b c d`;
//   - screen, the Linux console, vt100, vt220 and ansi define no shifted arrow at all.
//
// So both families are accepted, and the fast move also has a modifier-free fallback — PageUp/PageDown
// and Home/End — plus the Option/Meta forms a Mac sends.
//
// - On the map, an arrow moves the cursor; the **fast move** — a modified arrow, PageUp/PageDown,
//   Home/End — jumps it (`cursorKeyOf`; how far is the input path's, `src/build/motion.ts`).
// - In a list, Up and Down move one row and **stop at either end**: nothing comes round. The fast move
//   goes all the way — a modified Up/Down, and PageUp/PageDown and Home/End (left and right on the map)
//   to the first or the last row (`listKeyOf`). Left and Right move nothing in a list.
// - How far a timed Up or Down goes — taps counted, a hold on the game's own cadence — is the input
//   path's (`src/build/motion.ts`, run by the Build Phase session); what reaches a list is an ordinary
//   number of rows, clamped here.

const ESC = String.fromCharCode(27)

/** A cursor key by what it is, whatever bytes spelled it; `modified` is an arrow sent with Shift,
 *  Option or another modifier. PageUp/PageDown and Home/End are always the fast move. */
type NamedKey = Readonly<{ name: "up" | "down" | "left" | "right" | "page-up" | "page-down" | "home" | "end"; modified: boolean }>

const PLAIN = false
const MODIFIED = true

/** Every fixed spelling of a cursor key. xterm's modified arrows, which carry a number, are parsed
 *  (`XTERM_MODIFIED_ARROW`). */
const CURSOR_KEY_BYTES: Readonly<Record<string, NamedKey>> = {
  // Plain arrows, and the application-cursor-mode forms a terminal may switch to at any moment.
  [`${ESC}[A`]: { name: "up", modified: PLAIN },
  [`${ESC}[B`]: { name: "down", modified: PLAIN },
  [`${ESC}[C`]: { name: "right", modified: PLAIN },
  [`${ESC}[D`]: { name: "left", modified: PLAIN },
  [`${ESC}OA`]: { name: "up", modified: PLAIN },
  [`${ESC}OB`]: { name: "down", modified: PLAIN },
  [`${ESC}OC`]: { name: "right", modified: PLAIN },
  [`${ESC}OD`]: { name: "left", modified: PLAIN },
  // rxvt's own shifted arrows, which share nothing with xterm's but the leading `ESC [`.
  [`${ESC}[a`]: { name: "up", modified: MODIFIED },
  [`${ESC}[b`]: { name: "down", modified: MODIFIED },
  [`${ESC}[c`]: { name: "right", modified: MODIFIED },
  [`${ESC}[d`]: { name: "left", modified: MODIFIED },
  // Option+Arrow the way macOS terminals send it by default, which is not xterm's `CSI 1;3` form (that
  // one is parsed below, since any modifier counts): Option+Left/Right arrive as the readline
  // word-movement keys `ESC b`/`ESC f`, and a terminal set to treat Option as Meta prefixes the ordinary
  // arrow with a second ESC. "Move word by word" is what Option means on a Mac (owner, 2026-09-26: "we
  // should also allow option"). Bound from the terminals' documented defaults, not yet measured on the
  // owner's own iTerm2 profile: `node scripts/lib/key-echo.mjs` in that terminal is how to check.
  // `keysFromChunk` keeps each of these whole; before it did, Option+Left split into a bare Escape.
  [`${ESC}b`]: { name: "left", modified: MODIFIED },
  [`${ESC}f`]: { name: "right", modified: MODIFIED },
  [`${ESC}${ESC}[A`]: { name: "up", modified: MODIFIED },
  [`${ESC}${ESC}[B`]: { name: "down", modified: MODIFIED },
  [`${ESC}${ESC}[C`]: { name: "right", modified: MODIFIED },
  [`${ESC}${ESC}[D`]: { name: "left", modified: MODIFIED },
  // The modifier-free fallback, in every encoding the survey turned up. PageUp/PageDown are `ESC [ 5 ~`
  // and `ESC [ 6 ~` wherever they exist, but Home and End have three live spellings between xterm
  // (`ESC O H`), screen/tmux/linux (`ESC [ 1 ~`) and rxvt (`ESC [ 7 ~`).
  [`${ESC}[5~`]: { name: "page-up", modified: PLAIN },
  [`${ESC}[6~`]: { name: "page-down", modified: PLAIN },
  [`${ESC}[H`]: { name: "home", modified: PLAIN },
  [`${ESC}OH`]: { name: "home", modified: PLAIN },
  [`${ESC}[1~`]: { name: "home", modified: PLAIN },
  [`${ESC}[7~`]: { name: "home", modified: PLAIN },
  [`${ESC}[F`]: { name: "end", modified: PLAIN },
  [`${ESC}OF`]: { name: "end", modified: PLAIN },
  [`${ESC}[4~`]: { name: "end", modified: PLAIN },
  [`${ESC}[8~`]: { name: "end", modified: PLAIN },
}

/**
 * xterm's modified arrows: `ESC [ 1 ; <modifier> <letter>`. Any modifier >= 2 counts, not Shift
 * alone — nothing else binds a modified arrow, so a terminal that eats Shift but passes Alt or Ctrl
 * still gives its player the fast move.
 */
const XTERM_MODIFIED_ARROW = /^\u001b\[1;(\d+)([ABCD])$/
const ARROW_LETTERS: Readonly<Record<string, NamedKey["name"]>> = { A: "up", B: "down", C: "right", D: "left" }

/** A raw key as the cursor key it is, or `null`. */
function namedKeyOf(key: string): NamedKey | null {
  const known = CURSOR_KEY_BYTES[key]
  if (known !== undefined) return known
  const modified = XTERM_MODIFIED_ARROW.exec(key)
  const name = modified === null ? undefined : ARROW_LETTERS[modified[2] as string]
  if (modified !== null && name !== undefined && Number(modified[1]) >= 2) return { name, modified: MODIFIED }
  return null
}

const DIRECTIONS: Readonly<Record<NamedKey["name"], Readonly<{ dx: number; dy: number }>>> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
  "page-up": { dx: 0, dy: -1 },
  "page-down": { dx: 0, dy: 1 },
  home: { dx: -1, dy: 0 },
  end: { dx: 1, dy: 0 },
}

/** A cursor key's direction, one tile long, and whether it is the fast move. */
export type CursorKey = Readonly<{ dx: number; dy: number; jump: boolean }>

/**
 * Any of the map's cursor keys, classified — or `null`. The plain arrows are what the tap-counting and
 * hold rules apply to (`src/build/motion.ts`); every other form is the fast move, a jump whose size is a tuned
 * value (`TUNING.jumpStep`) rather than anything timing decides (timing only decides how often a held
 * one repeats).
 */
export function cursorKeyOf(key: string): CursorKey | null {
  const named = namedKeyOf(key)
  if (named === null) return null
  const isArrow = named.name === "up" || named.name === "down" || named.name === "left" || named.name === "right"
  return { ...DIRECTIONS[named.name], jump: !isArrow || named.modified }
}

/** A list key: which way, and whether it is the fast move — a jump to that end of the list. */
export type ListKey = Readonly<{ direction: -1 | 1; jump: boolean }>

/** A raw key as a list key, or `null` when it does not move a list's highlight: Up and Down as the
 *  map's cursor keys spell them, and Home/End — left and right on the map — to the first or last row. */
export function listKeyOf(key: string): ListKey | null {
  const named = namedKeyOf(key)
  if (named === null) return null
  switch (named.name) {
    case "up":
    case "down":
      return { direction: named.name === "up" ? -1 : 1, jump: named.modified }
    case "page-up":
    case "home":
      return { direction: -1, jump: true }
    case "page-down":
    case "end":
      return { direction: 1, jump: true }
    default:
      return null
  }
}

/**
 * Where a highlight lands in a list of `count` rows after moving `delta` rows from `index` — or, for
 * the fast move (`jump`), at the first row (`delta` negative) or the last. Clamped at both ends: a list
 * never comes round. `0` for an empty list.
 */
export function stepListIndex(index: number, count: number, delta: number, jump = false): number {
  if (count <= 0) return 0
  const last = count - 1
  if (jump) return delta < 0 ? 0 : last
  return Math.max(0, Math.min(last, index + delta))
}
