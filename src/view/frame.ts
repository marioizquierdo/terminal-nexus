// The terminal boundary — engine.md 9.1. An engine-owned structured cell frame, and an excellent
// snapshot surface. No backend object ever appears inside a frame.

import type { CapabilityMode, StyleRole } from "./roles.ts"
import { sgrFor } from "./roles.ts"

const ESC = "\u001b"

export type CellStyle = Readonly<{
  fgRole?: StyleRole
  bgRole?: StyleRole
  bold?: boolean
  dim?: boolean
  underline?: boolean
  inverse?: boolean
}>

export type Cell = Readonly<{ glyph: string; style: CellStyle }>

export type ReadonlyCellFrame = Readonly<{
  width: number
  height: number
  cells: readonly Cell[]
}>

export interface TerminalBackend {
  start(): Promise<void>
  present(frame: ReadonlyCellFrame): void | Promise<void>
  stop(): Promise<void>
}

export const BLANK: Cell = { glyph: " ", style: {} }

/** Bands, not free z-indexes — engine.md 9.4. The Grid layers map onto them directly. */
export const BANDS = {
  terrain: 1,
  territory: 2,
  groundItems: 3,
  structures: 4,
  units: 5,
  air: 6,
  projectiles: 7,
  effects: 8,
  highlights: 9,
  chrome: 10,
} as const

export type BandName = keyof typeof BANDS

export type BandCell = Readonly<{ band: number; x: number; y: number; cell: Cell }>

/**
 * Compose sparse band cells into one frame. The topmost defined cell replaces the lower complete
 * cell — style and all — and presentation overlap never changes occupancy.
 */
export function composeBands(
  width: number,
  height: number,
  bandCells: readonly BandCell[],
): ReadonlyCellFrame {
  const cells: Cell[] = new Array<Cell>(width * height).fill(BLANK)
  const ordered = [...bandCells].sort((a, b) => a.band - b.band)
  for (const entry of ordered) {
    if (entry.x < 0 || entry.y < 0 || entry.x >= width || entry.y >= height) continue
    cells[entry.y * width + entry.x] = entry.cell
  }
  return { width, height, cells }
}

export function cellAt(frame: ReadonlyCellFrame, x: number, y: number): Cell {
  return frame.cells[y * frame.width + x] ?? BLANK
}

/** Plain text, one line per row — the form snapshots and non-TTY output use. */
export function frameToText(frame: ReadonlyCellFrame): string {
  const rows: string[] = []
  for (let y = 0; y < frame.height; y += 1) {
    let row = ""
    for (let x = 0; x < frame.width; x += 1) row += cellAt(frame, x, y).glyph
    rows.push(row.replace(/[ ]+$/u, ""))
  }
  return rows.join("\n")
}

function sgrOf(style: CellStyle, capability: CapabilityMode): string {
  const parts: number[] = [...sgrFor(style.fgRole, capability)]
  if (style.bgRole !== undefined && capability !== "monochrome") {
    for (const code of sgrFor(style.bgRole, capability)) parts.push(code + 10)
  }
  if (style.bold === true) parts.push(1)
  if (style.dim === true) parts.push(2)
  if (style.underline === true) parts.push(4)
  if (style.inverse === true) parts.push(7)
  return parts.length === 0 ? "" : `${ESC}[${parts.join(";")}m`
}

/** ANSI text for a whole frame. One reset per styled run, and never a stray escape on a blank. */
export function frameToAnsi(frame: ReadonlyCellFrame, capability: CapabilityMode): string {
  const reset = `${ESC}[0m`
  const rows: string[] = []
  for (let y = 0; y < frame.height; y += 1) {
    let row = ""
    let openStyle = ""
    for (let x = 0; x < frame.width; x += 1) {
      const cell = cellAt(frame, x, y)
      const sgr = sgrOf(cell.style, capability)
      if (sgr !== openStyle) {
        if (openStyle !== "") row += reset
        row += sgr
        openStyle = sgr
      }
      row += cell.glyph
    }
    if (openStyle !== "") row += reset
    rows.push(row)
  }
  return rows.join("\r\n")
}

/** Every gameplay glyph occupies exactly one cell — engine.md 9.6. Asserted, not assumed. */
export function offendingGlyph(frame: ReadonlyCellFrame): string | null {
  for (const cell of frame.cells) {
    if ([...cell.glyph].length !== 1) return cell.glyph
    const code = cell.glyph.codePointAt(0) ?? 0
    // ASCII-safe is the baseline for Gate 1A: printable ASCII plus the space.
    if (code < 0x20 || code > 0x7e) return cell.glyph
  }
  return null
}
