// Popups: every one drawn from its spec (`src/build/popup.ts`) in one shape, over everything on the
// Grid.

import { CONTROLS_KEYS_WIDTH } from "../build/help.ts"
import { popupSpec, placePopup, settingColumns } from "../build/popup.ts"
import type { Popup } from "../build/types.ts"
import type { BandCell, CellStyle } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { put, text } from "./draw.ts"
import type { StyleRole } from "./roles.ts"
import { chromeGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import type { BuildCompositionInput } from "./build.ts"
import { HIGHLIGHT_BAR, drawHighlightBar, rowParts } from "./build-menu.ts"

// --- The popup border's effect ------------------------------------------------------------------------
//
// Every popup's border is alive (owner, 2026-09-30, feedback F83: "This subtle version works well for all
// popups because it is very unobtrusive"), in two parts:
//
//   - an optional **opening**, played once from the moment the popup opened, which overrides the rest
//     while it plays — today only the Battle Round screen's **double flash** ("an initial double flash
//     pulse, with more contrast range, that works as a highlight"). Which popup has which is the table
//     `POPUP_OPENINGS`, never a test in the drawing;
//   - the **breath**, the steady part (F80): slowly a little lighter and a little darker for as long as
//     the popup stays open, starting at rest the moment the opening ends — and the flash ends at rest, so
//     the handover has no jump.
//
// Both are shading — a glyphless tint or fade of the border's own role — and both are pure functions of
// the time since the popup opened, which the live loop hands the view (`PopupBorder`). Absent — every
// still frame, every test, every scripted playtest — the border is at rest.

/**
 * One breath's clock: how far into it, and how long one lasts — the breath's part of `PopupBorder`, as
 * its own shape for `breathLevel` and `breathStyle`.
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

/** Tints and fades are rounded to a thousandth, so an effect's very ends are exactly at rest. */
const thousandth = (value: number): number => Math.round(value * 1000) / 1000

/** The style a breathing border adds at this instant: a tint toward the title's colour on the lighter
 *  half, a fade toward the background on the darker. Nothing without a breath. */
export function breathStyle(breath: PopupBreath | undefined): Pick<CellStyle, "tint" | "fade"> {
  if (breath === undefined) return {}
  const level = breathLevel(breath)
  const amount = thousandth(Math.abs(level) * (level > 0 ? BREATH_DEPTH.lighter : BREATH_DEPTH.darker))
  if (amount <= 0) return {}
  return level > 0 ? { tint: { role: "chrome.title", amount } } : { fade: amount }
}

/**
 * The **double flash** a popup can open with (F83): `count` quick pulses of the border toward the title's
 * colour, each `flashMs` long — struck up to `peak` (0 to 1; 1 is the title's colour itself) and fading
 * back to rest — with `gapMs` at rest between two. Far past the breath's depth on purpose, so it reads as
 * a highlight; short and only twice, so it never reads as an alarm. A first guess, meant to become an
 * Experiment: the live loop is handed it with its other timings (`LiveTuning.popupFlash`).
 */
export type PopupFlash = Readonly<{ count: number; flashMs: number; gapMs: number; peak: number }>

export const POPUP_FLASH: PopupFlash = { count: 2, flashMs: 220, gapMs: 90, peak: 0.8 }

/** The openings a popup can have, by name. One today. */
export type PopupOpening = "double-flash"

/**
 * Which popup opens with what (F83) — data, so a new popup or a new opening is a line here. A popup not
 * named opens straight into the breath.
 */
export const POPUP_OPENINGS: Readonly<Partial<Record<Popup, PopupOpening>>> = { "battle-round": "double-flash" }

/** How long a flash opening lasts, from the popup opening to its last pulse back at rest. */
export function flashLengthMs(flash: PopupFlash): number {
  const count = Math.max(0, Math.floor(flash.count))
  const flashMs = Math.max(0, flash.flashMs)
  return count === 0 || flashMs === 0 ? 0 : count * flashMs + (count - 1) * Math.max(0, flash.gapMs)
}

/** How far into a pulse its height comes: struck fast, faded slower. */
const FLASH_RISE = 0.25

/** Where a flash opening is at `elapsedMs` after the popup opened: 0 at rest, 1 at a pulse's height. Each
 *  pulse is struck fast (a quarter sine over its first quarter) and fades slower (a half cosine over the
 *  rest), the way a light is struck and dies away; 0 between pulses, and before and after the whole. */
export function flashLevel(flash: PopupFlash, elapsedMs: number): number {
  const length = flashLengthMs(flash)
  if (!(elapsedMs >= 0 && elapsedMs < length)) return 0
  const into = elapsedMs % (flash.flashMs + Math.max(0, flash.gapMs))
  if (into >= flash.flashMs) return 0
  const u = into / flash.flashMs
  return u < FLASH_RISE
    ? Math.sin((Math.PI / 2) * (u / FLASH_RISE))
    : (1 + Math.cos(Math.PI * ((u - FLASH_RISE) / (1 - FLASH_RISE)))) / 2
}

/**
 * A popup border's clock, handed to the view by the live loop while a popup is open and its border moves:
 * how long ago the popup opened, the opening it plays (`null`: none, or one this frame cannot show), and
 * how long one breath lasts (`null`: still once any opening is over).
 */
export type PopupBorder = Readonly<{ elapsedMs: number; opening: PopupFlash | null; breathMs: number | null }>

/** How long a border's opening lasts: 0 without one. */
export function openingLengthMs(border: Pick<PopupBorder, "opening">): number {
  return border.opening === null ? 0 : flashLengthMs(border.opening)
}

/**
 * The style a popup's border adds at this instant: the opening's while it plays — a tint toward the title's
 * colour, `peak` at a pulse's height — and then the breath, begun at rest the moment the opening ended. A
 * pure function of the border's clock, like every effect.
 */
export function popupBorderStyle(border: PopupBorder | undefined): Pick<CellStyle, "tint" | "fade"> {
  if (border === undefined) return {}
  const openingMs = openingLengthMs(border)
  if (border.opening !== null && border.elapsedMs < openingMs) {
    const amount = thousandth(flashLevel(border.opening, border.elapsedMs) * border.opening.peak)
    return amount <= 0 ? {} : { tint: { role: "chrome.title", amount } }
  }
  if (border.breathMs === null) return {}
  return breathStyle({ elapsedMs: border.elapsedMs - openingMs, lengthMs: border.breathMs })
}

/**
 * A popup — the Nexus powers, the start-the-Pulse question, the game menu, Settings, the export, a
 * message — drawn from its spec (`src/build/popup.ts`), over everything on the Grid. A solid border
 * with the title in it, and a one-cell shadow that blanks what is behind it, so it cannot be missed
 * (owner, 2026-09-27: he clicked Nexus, did not notice the popup, and thought the mouse had stopped
 * working). No `[esc]` in the border since feedback F37: the top bar's "close [esc]" says it. Beside a
 * list that overflows, the right border is its scroll bar (F36). Given the border's clock
 * (`popupBorder`), the border plays its opening, if it has one, then breathes (F80, F83).
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

  // The border's own style: inverse, so the frame role is its fill — and, while the border moves, that
  // fill flashed or breathed lighter or darker (F80, F83). The shadow and the title stay as they are.
  const border: CellStyle = { fgRole: "chrome.frame", inverse: true, ...popupBorderStyle(input.popupBorder) }
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
