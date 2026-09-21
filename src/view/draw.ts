// Putting a glyph, or a string of them, into a band. Three screens now want the identical pair of
// helpers — the Pulse composition (`compose.ts`), the menu (`menu.ts`) and the Build Phase spike
// (`build.ts`) — which is the point at which `AGENTS.md` Section 4's "extract a framework only after
// two real uses reveal the boundary" stops being a reason to keep copying it and starts being a
// reason to stop.
//
// The boundary the three uses revealed is small and exactly this: a band write, an optional style
// role, four attribute flags, a column limit, and the guarantee that authored text is transliterated
// to ASCII before it can put a two-column glyph in a one-column cell.

import type { BandCell } from "./frame.ts"
import type { StyleRole } from "./roles.ts"

export type DrawExtra = Readonly<{
  dim?: boolean
  bold?: boolean
  inverse?: boolean
  underline?: boolean
  /** Maximum glyphs written, so a long authored string cannot run into the pane beside it. */
  limit?: number
}>

/** Glyphs the optional Unicode pack may put on screen; everything else outside printable ASCII
 *  becomes a question mark rather than a cell of unknown width. */
const PACK_SAFE = new Set([
  "·",
  "▓",
  "◆",
  "▪",
  "─",
  "│",
  "┌",
  "┐",
  "└",
  "┘",
  "┄",
  "┆",
])

const TRANSLITERATE: Readonly<Record<string, string>> = {
  "—": "-",
  "–": "-",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "…": "...",
}

/**
 * ASCII-safe is the baseline (engine.md 9.6): every cell is one column wide and printable. Authored
 * text — a scenario name, a structure's label — may hold typographic characters, so it is
 * transliterated here rather than trusted, and anything left over becomes a question mark. The
 * alternative is a frame that fails its own width-one invariant because someone typed an em dash.
 */
export function toAscii(value: string): string {
  let out = ""
  for (const character of value) {
    const replacement = TRANSLITERATE[character]
    if (replacement !== undefined) {
      out += replacement
      continue
    }
    const code = character.codePointAt(0) ?? 0
    out += (code >= 0x20 && code <= 0x7e) || PACK_SAFE.has(character) ? character : "?"
  }
  return out
}

export function put(
  cells: BandCell[],
  band: number,
  x: number,
  y: number,
  glyph: string,
  role?: StyleRole,
  extra: DrawExtra = {},
): void {
  const style = {
    ...(role === undefined ? {} : { fgRole: role }),
    ...(extra.dim === true ? { dim: true } : {}),
    ...(extra.bold === true ? { bold: true } : {}),
    ...(extra.inverse === true ? { inverse: true } : {}),
    ...(extra.underline === true ? { underline: true } : {}),
  }
  cells.push({ band, x, y, cell: { glyph, style } })
}

export function text(
  cells: BandCell[],
  band: number,
  x: number,
  y: number,
  value: string,
  role?: StyleRole,
  extra: DrawExtra = {},
): void {
  const limit = extra.limit ?? Number.POSITIVE_INFINITY
  const glyphs = [...toAscii(value)].slice(0, Math.max(0, limit))
  glyphs.forEach((glyph, index) => put(cells, band, x + index, y, glyph, role, extra))
}
