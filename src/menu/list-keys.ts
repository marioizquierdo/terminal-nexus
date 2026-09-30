// The keys that move a list's highlight, and the one rule every list follows with them (owner,
// 2026-09-30, feedback F75: "The navigation with up/down arrows in the menus should not rotate ... if I
// keep down pressed, it should quickly move to the bottom and stay there ... Pressing shift + up should
// bring the cursor all the way to the top (or pgup, etc), this is the same convention as moving in the
// map"). Shared by the title screen's menu and every list in the Build Phase — its menu, the Nexus
// powers, the game menu, Settings, the export and the Controls page — so they cannot drift apart.
//
// - Up and Down move one row, and **stop at either end**: nothing comes round.
// - The **fast move** goes all the way: Shift+Up/Down (both sequence families a terminal may send),
//   Option+Up/Down, PageUp/PageDown to the first or last row, and Home/End — left and right on the
//   map — to the first and the last.
// - A held arrow's ramp is the input path's (`src/build/motion.ts`, run by the Build Phase session);
//   what reaches a list is an ordinary number of rows, clamped here.
//
// The byte spellings are the ones `src/build/keyboard.ts` accepts for the map's fast move, measured
// there (`evidence/gate-5a-report.md`); a test holds the two tables to the same keys.

const ESC = String.fromCharCode(27)

/** A list key: which way, and whether it is the fast move — a jump to that end of the list. */
export type ListKey = Readonly<{ direction: -1 | 1; jump: boolean }>

const LIST_KEYS: Readonly<Record<string, ListKey>> = {
  // Plain arrows, and the application-cursor-mode forms a terminal may switch to at any moment.
  [`${ESC}[A`]: { direction: -1, jump: false },
  [`${ESC}[B`]: { direction: 1, jump: false },
  [`${ESC}OA`]: { direction: -1, jump: false },
  [`${ESC}OB`]: { direction: 1, jump: false },
  // rxvt's own shifted arrows.
  [`${ESC}[a`]: { direction: -1, jump: true },
  [`${ESC}[b`]: { direction: 1, jump: true },
  // Option as Meta: a second Esc before the plain arrow.
  [`${ESC}${ESC}[A`]: { direction: -1, jump: true },
  [`${ESC}${ESC}[B`]: { direction: 1, jump: true },
  // The modifier-free fallbacks: PageUp/PageDown, and Home/End in the three spellings terminals use.
  [`${ESC}[5~`]: { direction: -1, jump: true },
  [`${ESC}[6~`]: { direction: 1, jump: true },
  [`${ESC}[H`]: { direction: -1, jump: true },
  [`${ESC}OH`]: { direction: -1, jump: true },
  [`${ESC}[1~`]: { direction: -1, jump: true },
  [`${ESC}[7~`]: { direction: -1, jump: true },
  [`${ESC}[F`]: { direction: 1, jump: true },
  [`${ESC}OF`]: { direction: 1, jump: true },
  [`${ESC}[4~`]: { direction: 1, jump: true },
  [`${ESC}[8~`]: { direction: 1, jump: true },
}

/** xterm's modified arrows, `ESC [ 1 ; <modifier> A|B`: any modifier counts, as it does on the map. */
const XTERM_MODIFIED_UP_DOWN = /^\u001b\[1;(\d+)([AB])$/

/** A raw key as a list key, or `null` when it does not move a list's highlight. */
export function listKeyOf(key: string): ListKey | null {
  const known = LIST_KEYS[key]
  if (known !== undefined) return known
  const modified = XTERM_MODIFIED_UP_DOWN.exec(key)
  if (modified !== null && Number(modified[1]) >= 2) return { direction: modified[2] === "A" ? -1 : 1, jump: true }
  return null
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
