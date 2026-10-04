// A Commander's barks: the short lines she says during a Battle Round, written as data in her army (the owner,
// 2026-10-04, on her voice in battle: "yes that is fantastic! let's experiment with this to see if it gets into
// the battle or enhances the experience even more").
//
// What lives here is the vocabulary an army writes them in, shared by the loader that checks them
// (`load.ts`) and the view that shows them (`src/view/pulse-voice.ts`), so the two cannot disagree:
//
// - **the moments** a Commander can speak at, each with what it means — an army writes a few lines for each
//   moment it wants her to answer, and leaves the others out for her to stay quiet there;
// - **the room a line has** where it is shown at the 80 × 24 floor: two rows under the side panel's feed, or one
//   row beside her on the map. A line that does not fit is refused when the army loads, by name, rather than
//   cut on screen; a test holds the room to the screen's own layout.
//
// When she speaks, and which of a moment's lines she picks, is the view's (a hash of the moment's identity,
// never a stream): an army only writes what she can say. Pure: no clock, no randomness.

import { wrapWords } from "../terminal/wrap-words.ts"

/**
 * The moments a Commander speaks at, in the order a Battle Round tends to meet them. Each is worked out by the
 * view from what the round's events say happened (`src/view/pulse-voice.ts`); nothing in the rules reads them.
 */
export const BARK_MOMENTS = [
  "round-start",
  "first-contact",
  "raid-arrives",
  "unit-lost",
  "building-lost",
  "badly-hurt",
  "nexus-hit",
  "falls",
  "round-won",
] as const

export type BarkMoment = (typeof BARK_MOMENTS)[number]

/** What each moment is, in plain words: for whoever writes an army, and for a refusal that names one. */
export const BARK_MOMENT_MEANING: Readonly<Record<BarkMoment, string>> = {
  "round-start": "the Battle Round starts",
  "first-contact": "the first shot of the round, either side's",
  "raid-arrives": "a group of the raid arrives while the round is on",
  "unit-lost": "one of her side's units falls near her",
  "building-lost": "one of her side's buildings falls (not the Grid Nexus)",
  "badly-hurt": "she is badly hurt",
  "nexus-hit": "her side's Grid Nexus is hit for the first time",
  "falls": "she falls: her last words before the Nexus restores her a round later",
  "round-won": "the raid breaks, or the Battle Round is won",
}

/**
 * A Commander's lines, by moment: a few for each, one picked when the moment comes. A moment left out is one
 * she stays quiet at.
 */
export type Barks = Readonly<Partial<Record<BarkMoment, readonly string[]>>>

/**
 * The room a line has where it is shown, at the 80 × 24 floor:
 *
 * - **in the panel**, under the feed: between double quotes, wrapped between words, at most `panelRows` rows of
 *   `panelColumns` — the panel's prose width, one column in from the divider;
 * - **beside her** on the map: between double quotes on one row, a blank cell either side, across a map
 *   `mapColumns` wide (49 tiles of one column).
 *
 * `tests/voice.test.ts` holds these to the layout at 80 × 24, so a change to the screen is a change here.
 */
export const BARK_ROOM = { panelColumns: 26, panelRows: 2, mapColumns: 49 } as const

/** A line as the screen shows it: between double quotes, so it reads as said rather than as news. */
export function quoted(line: string): string {
  return `"${line}"`
}

/** A line as the panel shows it: quoted, and wrapped between words into rows of `columns`. */
export function barkPanelRows(line: string, columns: number = BARK_ROOM.panelColumns): readonly string[] {
  return wrapWords(quoted(line), columns)
}

/** How wide a line is beside her on the map: quoted, with a blank cell either side. */
export function barkMapWidth(line: string): number {
  return quoted(line).length + 2
}

/**
 * Why a line cannot be shown, as the end of a sentence about it ("is empty"), or `null` when it can: it must
 * say something, in plain keyboard characters (a terminal cell holds one, and a typographic quote or dash
 * would not survive the ASCII floor), and fit both places it may be shown at the 80 × 24 floor.
 */
export function barkProblem(line: string): string | null {
  if (line.trim() === "") return "is empty"
  if (line !== line.trim()) return "starts or ends with a space"
  const odd = [...line].find((character) => {
    const code = character.codePointAt(0) ?? 0
    return code < 0x20 || code > 0x7e
  })
  if (odd !== undefined) return `has "${odd}", which is not a plain keyboard character`
  const { panelColumns, panelRows, mapColumns } = BARK_ROOM
  const rows = barkPanelRows(line)
  if (rows.length > panelRows || rows.some((row) => row.length > panelColumns)) {
    return `is too long for the panel: quoted, it takes ${rows.length} rows of ${panelColumns} columns at 80 x 24, and a line has ${panelRows}`
  }
  if (barkMapWidth(line) > mapColumns) {
    return `is too long to show beside her: quoted, it is ${barkMapWidth(line)} columns with a blank either side, and the map is ${mapColumns} wide at 80 x 24`
  }
  return null
}
