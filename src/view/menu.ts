// The top-level menu screen — milestone-03-game-menu.md: "a menu is a frame like any other." Reuses
// the same band compositor, style roles, and glyph packs `compose.ts` draws a Pulse with, so
// capability tiers, themes, and monochrome come free rather than needing a second accessibility pass.
//
// Unlike a Pulse, a menu has no ticks and nothing animates, so there is no `Playback` clock here —
// the resize-gate RULE (engine.md 9.6) still applies, but "resumes from the same presentation time"
// is trivially true of a screen with no presentation time to lose: showing `gateFrame` below the
// minimum size and the menu frame otherwise is the whole of it.

import type { MenuLayout } from "../menu/layout.ts"
import { menuItemRow } from "../menu/layout.ts"
import type { MenuListState } from "../menu/list.ts"
import type { BandCell, ReadonlyCellFrame } from "./frame.ts"
import { BANDS, composeBands } from "./frame.ts"
import type { CapabilityMode, StyleRole } from "./roles.ts"
import { chromeGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"

/** The 80x24 RULE floor (engine.md 3.3, Q12) — the same footprint `compose.ts`'s Grid screen uses
 *  at `tileWidth` 1, so the terminal never resizes when the game moves from the menu into a match. */
export const MENU_SIZE = { width: 80, height: 24 } as const

/** Where the four top-level items are drawn — the one layout the composer and the mouse adapter both
 *  read, so a click can never target a row this screen did not actually draw there. */
export const MENU_LAYOUT: MenuLayout = { column: 4, row: 6, rowStep: 2 }

export type MenuCompositionInput = Readonly<{
  state: MenuListState
  /** A plain, honest placeholder for an option this gate stubs rather than builds — `null` shows
   *  nothing, per milestone-03-game-menu.md's "stub honestly rather than half-build." */
  notice: string | null
  glyphPack?: GlyphPack
  /** Printed after "TERMINAL NEXUS" in the header — which screen this is. Defaults to the top-level
   *  menu's own subtitle so every existing caller keeps today's frame unchanged. */
  subtitle?: string
  /** Whether this screen has somewhere to go back to — adds "esc back" to the footer's controls
   *  line. Advertising a control that does nothing would be the opposite of honest. */
  showBack?: boolean
}>

function put(
  cells: BandCell[],
  band: number,
  x: number,
  y: number,
  glyph: string,
  role?: StyleRole,
  extra: Readonly<{ dim?: boolean; bold?: boolean; inverse?: boolean }> = {},
): void {
  const style = {
    ...(role === undefined ? {} : { fgRole: role }),
    ...(extra.dim === true ? { dim: true } : {}),
    ...(extra.bold === true ? { bold: true } : {}),
    ...(extra.inverse === true ? { inverse: true } : {}),
  }
  cells.push({ band, x, y, cell: { glyph, style } })
}

function text(
  cells: BandCell[],
  band: number,
  x: number,
  y: number,
  value: string,
  role?: StyleRole,
  extra: Readonly<{ dim?: boolean; bold?: boolean; inverse?: boolean }> = {},
): void {
  ;[...value].forEach((glyph, index) => put(cells, band, x + index, y, glyph, role, extra))
}

/** The border only — no inner divider, unlike the Grid screen's Grid/panel split, because a menu has
 *  one pane, not two. */
function drawBorder(cells: BandCell[], size: { width: number; height: number }, pack: GlyphPack): void {
  const band = BANDS.chrome
  const horizontal = chromeGlyph(pack, "horizontal")
  const vertical = chromeGlyph(pack, "vertical")
  for (let x = 0; x < size.width; x += 1) {
    put(cells, band, x, 0, horizontal, "chrome.frame")
    put(cells, band, x, size.height - 1, horizontal, "chrome.frame")
  }
  for (let y = 1; y < size.height - 1; y += 1) {
    put(cells, band, 0, y, vertical, "chrome.frame")
    put(cells, band, size.width - 1, y, vertical, "chrome.frame")
  }
  put(cells, band, 0, 0, chromeGlyph(pack, "topLeft"), "chrome.frame")
  put(cells, band, size.width - 1, 0, chromeGlyph(pack, "topRight"), "chrome.frame")
  put(cells, band, 0, size.height - 1, chromeGlyph(pack, "bottomLeft"), "chrome.frame")
  put(cells, band, size.width - 1, size.height - 1, chromeGlyph(pack, "bottomRight"), "chrome.frame")
}

/** Row engine.md 3.3's tagline lives on — the concept doc's own emotional loop, quoted rather than
 *  invented, since a stub screen still owes the player something true about the game. */
const TAGLINE = "Build. Commit. Pulse. Understand. Adapt."

const BASE_CONTROLS = "arrows + enter, or a digit, or click a row"

export function composeMenuFrame(
  input: MenuCompositionInput,
  capability: CapabilityMode,
): ReadonlyCellFrame {
  void capability
  const size = MENU_SIZE
  const pack: GlyphPack = input.glyphPack ?? "ascii"
  const cells: BandCell[] = []
  const band = BANDS.chrome
  const controls = `${BASE_CONTROLS}${input.showBack === true ? "  -  esc back" : ""}  -  q quit`

  drawBorder(cells, size, pack)

  text(cells, band, 2, 1, "TERMINAL NEXUS", "chrome.title", { bold: true })
  text(cells, band, 18, 1, input.subtitle ?? "top-level menu", "chrome.muted", { dim: true })
  text(cells, band, 2, 2, TAGLINE, "chrome.muted", { dim: true })

  input.state.items.forEach((item, index) => {
    const row = menuItemRow(MENU_LAYOUT, index)
    const highlighted = index === input.state.highlighted
    const hotkeyPart = `[${item.hotkey}]`
    const labelPart = ` ${item.label}`
    if (highlighted) {
      // Inverse video carries "selected" at every capability tier, including monochrome — engine.md
      // 9.6: colour never carries meaning alone. The hotkey/label split stops mattering once the
      // whole row is one inverted block.
      text(cells, band, MENU_LAYOUT.column, row, hotkeyPart + labelPart, "chrome.title", {
        bold: true,
        inverse: true,
      })
      return
    }
    text(cells, band, MENU_LAYOUT.column, row, hotkeyPart, "chrome.hotkey", { bold: true })
    text(cells, band, MENU_LAYOUT.column + hotkeyPart.length, row, labelPart, "chrome.value")
  })

  if (input.notice !== null) {
    text(cells, band, 2, size.height - 6, input.notice, "chrome.value")
  }

  text(cells, band, 2, size.height - 3, controls, "chrome.muted", { dim: true })

  return composeBands(size.width, size.height, cells)
}
