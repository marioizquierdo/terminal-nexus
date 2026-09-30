// Popups: every one drawn from its spec (`src/build/popup.ts`) in one shape, over everything on the
// Grid.

import { CONTROLS_KEYS_WIDTH } from "../build/help.ts"
import { popupSpec, placePopup, settingColumns } from "../build/popup.ts"
import type { BandCell, CellStyle } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { put, text } from "./draw.ts"
import type { StyleRole } from "./roles.ts"
import { chromeGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import type { BuildCompositionInput } from "./build.ts"
import { HIGHLIGHT_BAR, drawHighlightBar, rowParts } from "./build-menu.ts"

/**
 * A popup's border **breathing** (owner, 2026-09-30, feedback F80, of the Battle Round screen: "a pulse
 * effect on the border, it doesn't need to be intense, just relaxing turning a bit lighter and darker to
 * create dynamism"): the live loop's clock on it, from the frame the popup first showed, and how long one
 * breath lasts (the "Battle Round pulse" Experiment). The live loop supplies it for the Battle Round
 * screen alone; absent — every still frame, every test, every scripted playtest — the border is at rest.
 */
export type PopupBreath = Readonly<{ elapsedMs: number; lengthMs: number }>

/**
 * How far one breath goes each way. The lighter half pulls the border's colour toward the title's
 * (`chrome.title`, the brightest chrome role on a dark background and the darkest on a light one — so
 * "lighter" is "stronger against the ground" on either theme); the darker half fades it toward the
 * background. Both stay under one half on purpose: at 16 colours a tint steps onto the other role only
 * from one half up, and a fade is ignored, so there the border simply stays still rather than blinking
 * once a breath; monochrome has no colour to move at all.
 */
export const BREATH_DEPTH = { lighter: 0.4, darker: 0.25 } as const

/** Where a breath is at: 0 at rest, rising to 1 (lightest) a quarter of the way in, back through 0 at
 *  half way, down to -1 (darkest) at three quarters, and at rest again at the end — a sine, so it never
 *  starts or stops with a jolt. A pure function of the time, like every effect. */
export function breathLevel(breath: PopupBreath): number {
  if (!(breath.lengthMs > 0)) return 0
  const phase = (((breath.elapsedMs % breath.lengthMs) + breath.lengthMs) % breath.lengthMs) / breath.lengthMs
  return Math.sin(2 * Math.PI * phase)
}

/** The style a breathing border adds at this instant: a tint toward the title's colour on the lighter
 *  half, a fade toward the background on the darker, rounded to a thousandth so the very ends of a breath
 *  are exactly at rest. Nothing without a breath. */
export function breathStyle(breath: PopupBreath | undefined): Pick<CellStyle, "tint" | "fade"> {
  if (breath === undefined) return {}
  const level = breathLevel(breath)
  const amount = Math.round(Math.abs(level) * (level > 0 ? BREATH_DEPTH.lighter : BREATH_DEPTH.darker) * 1000) / 1000
  if (amount <= 0) return {}
  return level > 0 ? { tint: { role: "chrome.title", amount } } : { fade: amount }
}

/**
 * A popup — the Nexus powers, the start-the-Pulse question, the game menu, Settings, the export, a
 * message — drawn from its spec (`src/build/popup.ts`), over everything on the Grid. A solid border
 * with the title in it, and a one-cell shadow that blanks what is behind it, so it cannot be missed
 * (owner, 2026-09-27: he clicked Nexus, did not notice the popup, and thought the mouse had stopped
 * working). No `[esc]` in the border since feedback F37: the top bar's "close [esc]" says it. Beside a
 * list that overflows, the right border is its scroll bar (F36). Given a breath (`popupBreath`, the
 * Battle Round screen's, F80), the border turns slowly a little lighter and a little darker.
 *
 * Drawn last in the chrome band: bands are fixed (engine.md 9.4, RULE), and within one band a later
 * write replaces an earlier one, so a popup needs no band of its own to sit on top.
 */
export function drawPopup(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const spec = popupSpec(input.context, input.state)
  if (spec === null) return
  const placed = placePopup(input.layout, spec)
  const band = BANDS.chrome
  const { box, textColumn, textLimit } = placed

  // The shadow: one cell right and one below, a dim shade over whatever was there.
  const shade = chromeGlyph(pack, "shadow")
  for (let y = box.top + 1; y <= box.bottom + 1; y += 1) put(cells, band, box.right + 1, y, shade, "chrome.frame", { dim: true })
  for (let x = box.left + 1; x <= box.right + 1; x += 1) put(cells, band, x, box.bottom + 1, shade, "chrome.frame", { dim: true })

  // The border's own style: inverse, so the frame role is its fill — and, while the popup breathes, that
  // fill a little lighter or darker (F80). The shadow and the title stay as they are.
  const border: CellStyle = { fgRole: "chrome.frame", inverse: true, ...breathStyle(input.popupBreath) }
  const borderCell = (x: number, y: number, glyph: string, extra: Pick<CellStyle, "bold"> = {}): void => {
    cells.push({ band, x, y, cell: { glyph, style: { ...border, ...extra } } })
  }
  for (let y = box.top; y <= box.bottom; y += 1) {
    for (let x = box.left; x <= box.right; x += 1) {
      const edge = y === box.top || y === box.bottom || x === box.left || x === box.right
      if (edge) borderCell(x, y, " ")
      else put(cells, band, x, y, " ", "chrome.frame")
    }
  }
  // The title sits in the top border, drawn in reverse so it reads as part of it.
  text(cells, band, box.left + 2, box.top, ` ${spec.title} `, "chrome.title", {
    bold: true,
    inverse: true,
    limit: box.right - box.left - 3,
  })
  // The scroll bar, in the right border beside the list: an up symbol, then the track — the plain border
  // itself — with a textured thumb where the part in view sits, then a down symbol, all inverse, so they
  // read as the border (feedback F78: "keep the same background as the regular border, but add different
  // texture for the bar"; a track in the shadow's texture read as more shadow). The thumb's texture is
  // its own, never the shadow's.
  const bar = placed.scrollBar
  if (bar !== null) {
    for (let y = bar.top; y <= bar.bottom; y += 1) {
      const glyph =
        y === bar.top
          ? chromeGlyph(pack, "scrollUp")
          : y === bar.bottom
            ? chromeGlyph(pack, "scrollDown")
            : y >= bar.thumbTop && y <= bar.thumbBottom
              ? chromeGlyph(pack, "scrollThumb")
              : " "
      borderCell(bar.column, y, glyph, y === bar.top || y === bar.bottom ? { bold: true } : {})
    }
  }

  for (const { row, spec: entry, secondLine, text: placedText = "" } of placed.rows) {
    switch (entry.kind) {
      case "blank":
        break
      case "heading":
        text(cells, band, textColumn, row, entry.text, "chrome.label", { limit: textLimit })
        break
      case "text": {
        // A line of the export keeps its value when it is too long for the popup: its comment goes.
        const shown = entry.code === true && entry.text.length > textLimit ? entry.text.replace(/\s+#.*$/u, "") : entry.text
        const bar = entry.highlighted === true ? HIGHLIGHT_BAR : null
        if (bar !== null) drawHighlightBar(cells, textColumn, row, textLimit)
        const role: StyleRole = entry.muted === true || (entry.code === true && shown.startsWith("#")) ? "chrome.muted" : "chrome.value"
        rowParts(cells, row, bar)(textColumn, shown, role, { bold: entry.strong === true, limit: textLimit })
        break
      }
      case "option": {
        if (secondLine) {
          // The line a player actually chooses by — quieter than the name, never dimmed out of reach.
          text(cells, band, textColumn + 4, row, entry.description ?? "", "chrome.muted", { limit: textLimit - 4 })
          break
        }
        const bar = entry.highlighted === true ? HIGHLIGHT_BAR : null
        if (bar !== null) drawHighlightBar(cells, textColumn, row, textLimit)
        const part = rowParts(cells, row, bar)
        const hotkey = `[${entry.hotkey}]`
        part(textColumn, hotkey, "chrome.hotkey", { bold: true, limit: textLimit })
        part(textColumn + hotkey.length + 1, entry.label, "chrome.value", { limit: textLimit - hotkey.length - 1 })
        break
      }
      case "setting": {
        // One line: the name, the value between `<` and `>` (the arrows say Left and Right change it,
        // and each half of the box is the click that does), against the row's right end.
        const bar = entry.highlighted ? HIGHLIGHT_BAR : null
        const columns = settingColumns(placed)
        if (bar !== null) drawHighlightBar(cells, textColumn, row, textLimit)
        const part = rowParts(cells, row, bar)
        part(textColumn, entry.label, "chrome.value", { limit: columns.labelLimit })
        const inner = columns.valueTo - columns.valueFrom - 3
        const padding = Math.max(0, inner - entry.value.length)
        const value = `${" ".repeat(Math.ceil(padding / 2))}${entry.value}${" ".repeat(Math.floor(padding / 2))}`
        part(columns.valueFrom, "<", "chrome.hotkey", { bold: true })
        part(columns.valueFrom + 2, value, "chrome.value", { bold: true, limit: inner })
        part(columns.valueTo, ">", "chrome.hotkey", { bold: true })
        break
      }
      case "note":
        text(cells, band, textColumn, row, placedText, "chrome.value", { limit: textLimit })
        break
      case "rule": {
        // Border to border, inside the solid frame: what is above is apart from what is below.
        const line = chromeGlyph(pack, "horizontal")
        for (let x = box.left + 1; x < box.right; x += 1) put(cells, band, x, row, line, "chrome.frame")
        break
      }
      case "keys": {
        // A line of the Controls page: the keys in the hotkey's colour, in their own column, and what
        // they do beside them — under the highlight bar, all in the bar's role, like an option row.
        const bar = entry.highlighted === true ? HIGHLIGHT_BAR : null
        if (bar !== null) drawHighlightBar(cells, textColumn, row, textLimit)
        const part = rowParts(cells, row, bar)
        part(textColumn, entry.keys, "chrome.hotkey", { bold: true, limit: Math.min(textLimit, CONTROLS_KEYS_WIDTH - 1) })
        part(textColumn + CONTROLS_KEYS_WIDTH, entry.text, "chrome.value", { limit: textLimit - CONTROLS_KEYS_WIDTH })
        break
      }
    }
  }
}
