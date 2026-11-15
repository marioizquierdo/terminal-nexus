// The resize gate: what a screen shows on a terminal smaller than it needs.

import type { BandCell, ReadonlyCellFrame } from "./frame.ts"
import { BANDS, composeBands } from "./frame.ts"
import { text } from "./draw.ts"

/**
 * The resize gate — `presentation.md` makes it a RULE, and a terminal is a thing people drag. Below the
 * floor a screen shows this and freezes presentation time; resizing back resumes from
 * the same presentation time.
 */
export function gateFrame(
  width: number,
  height: number,
  required: { width: number; height: number },
): ReadonlyCellFrame {
  const cells: BandCell[] = []
  const lines = [
    "TERMINAL TOO SMALL",
    `need ${required.width} x ${required.height}`,
    `have ${Math.max(width, 0)} x ${Math.max(height, 0)}`,
    "resize to continue",
  ]
  lines.forEach((line, index) => {
    const x = Math.max(0, Math.floor((width - line.length) / 2))
    const y = Math.max(0, Math.floor(height / 2) - 2 + index)
    text(cells, BANDS.chrome, x, y, line, index === 0 ? "notice.gate" : "chrome.value", {
      bold: index === 0,
    })
  })
  return composeBands(Math.max(width, 1), Math.max(height, 1), cells)
}
