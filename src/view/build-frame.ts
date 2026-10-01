// The Build Phase's frame: the lines that close the Grid pane into a rectangle of its own and carry the
// "more Grid this way" signal as their weight, and the two bars — the top bar (the title, where the
// player is, what Esc does) and the bottom line.

import { edgeMarkers } from "../build/camera.ts"
import { bottomLine } from "../build/help.ts"
import { ESC_KEY, escLabelSpan, escLabel } from "../build/layout.ts"
import { wrapWords } from "../build/popup.ts"
import type { ArmedPreview } from "../build/state.ts"
import type { BandCell } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { put, text } from "./draw.ts"
import { pulseStatus, pulseSubtitle } from "./pulse-scene.ts"
import { chromeGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import { statusStyle } from "./status.ts"
import type { ArmWeight, Arms, EdgePlace } from "./edge.ts"
import { edgeCell } from "./edge.ts"
import type { BuildCompositionInput } from "./build.ts"

/** Which of a frame cell's four neighbours a line continues into. */
type Joins = { n: boolean; s: boolean; e: boolean; w: boolean }

/** The glyph for a frame cell, from which way its lines run — a straight run, a corner, a tee, or a
 *  crossing. Every junction is derived rather than placed by hand, so moving a line moves its
 *  junctions with it. */
function lineGlyph(pack: GlyphPack, { n, s, e, w }: Joins): string {
  if (n && s && !e && !w) return chromeGlyph(pack, "vertical")
  if (e && w && !n && !s) return chromeGlyph(pack, "horizontal")
  if (n && s && e && w) return chromeGlyph(pack, "cross")
  if (n && s) return chromeGlyph(pack, e ? "teeRight" : "teeLeft")
  if (e && w) return chromeGlyph(pack, s ? "teeDown" : "teeUp")
  if (s) return chromeGlyph(pack, e ? "topLeft" : "topRight")
  return chromeGlyph(pack, e ? "bottomLeft" : "bottomRight")
}

/**
 * The frame: an outer border, a rule under the top bar and another over the bottom bar (both the
 * whole width), and the divider between the side panel and the Grid pane, which runs only between
 * those two rules so both bars run the whole width (gate 5F; engine.md 9.2). Together they close the
 * Grid pane into **a rectangle of its own** — the owner's 2026-09-26 playtest could not tell where the
 * Grid ended, because two blank header rows sat between its top edge and the nearest line, and the
 * footer sat against its bottom edge with no line at all.
 *
 * engine.md 3.3's required "there is more Grid" signal is drawn as the weight of that rectangle's
 * four sides, not overlaid on them: a side with more Grid to scroll to is the frame's own line drawn
 * dim, and a side that has actually reached the Grid's own edge is drawn in **the map's own style**
 * (feedback F25) — a **solid bar** when the map names none: an inverse-video cell, a wall rather than
 * merely a border, the same weight in every glyph pack and in monochrome (Q56) — in the quieter edge
 * colour, each style the same weight on all four sides (`src/view/edge.ts` draws them). The menu's
 * divider **is** the Grid's west side (F25), one shared column, plain beside the menu's rules and a
 * light or map-edge side beside the Grid's rows.
 * Everything else — the outer border, the rules where they cross the side panel — never scrolls and
 * is drawn plain.
 */
export function drawChrome(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const { layout, state, context } = input
  const box = layout.gridBox
  const left = layout.offset.column
  const right = layout.offset.column + layout.composition.width - 1
  const top = layout.offset.row
  const bottom = layout.offset.row + layout.composition.height - 1

  const lines = new Map<number, Joins & { x: number; y: number }>()
  const join = (x: number, y: number, side: keyof Joins): void => {
    const key = y * layout.frame.width + x
    const cell = lines.get(key) ?? { x, y, n: false, s: false, e: false, w: false }
    lines.set(key, { ...cell, [side]: true })
  }
  const horizontalLine = (y: number, from: number, to: number): void => {
    for (let x = from; x <= to; x += 1) {
      if (x > from) join(x, y, "w")
      if (x < to) join(x, y, "e")
    }
  }
  const verticalLine = (x: number, from: number, to: number): void => {
    for (let y = from; y <= to; y += 1) {
      if (y > from) join(x, y, "n")
      if (y < to) join(x, y, "s")
    }
  }
  horizontalLine(top, left, right)
  horizontalLine(bottom, left, right)
  verticalLine(left, top, bottom)
  verticalLine(right, top, bottom)
  horizontalLine(box.top, left, right)
  horizontalLine(layout.paneBottom, left, right)
  // A Grid shorter than the pane still closes directly under its last row (engine.md 3.3), across
  // the Grid pane alone — the panel beside it runs on down to the bottom bar.
  if (box.bottom < layout.paneBottom) horizontalLine(box.bottom, box.left, box.right)
  // The divider runs only between the two rules, so the top bar and the bottom bar each run the
  // whole width: at 80 columns the Grid pane is 49 columns, and the bottom bar's contextual line is
  // longer than that.
  verticalLine(layout.dividerColumn, box.top, layout.paneBottom)

  const markers = edgeMarkers(state.camera, state.viewport, context.grid)
  const heavy = { north: !markers.north, south: !markers.south, west: !markers.west, east: !markers.east }
  // The rectangle the four sides run along. Its west side is the menu's divider (`box.left` is
  // `layout.dividerColumn`; the owner's choice, F25).
  const rect = { left: box.left, right: box.right, top: box.top, bottom: box.bottom }

  // Whether the line from a cell to its neighbour runs along a side that has reached the map's own
  // edge. Everything is decided per line segment, so a corner, a tee where the divider meets a rule,
  // and a straight run all come out of the same test.
  const heavySegment = (x: number, y: number, dx: number, dy: number): boolean => {
    if (dy === 0) {
      const from = Math.min(x, x + dx)
      const to = Math.max(x, x + dx)
      if (from < rect.left || to > rect.right) return false
      return (y === rect.top && heavy.north) || (y === rect.bottom && heavy.south)
    }
    const from = Math.min(y, y + dy)
    const to = Math.max(y, y + dy)
    if (from < rect.top || to > rect.bottom) return false
    return (x === rect.left && heavy.west) || (x === rect.right && heavy.east)
  }
  const style = context.edgeStyle ?? "solid"
  const soft = { dim: true }

  for (const cell of lines.values()) {
    const { x, y } = cell
    const weight = (joined: boolean, dx: number, dy: number): ArmWeight =>
      !joined ? 0 : heavySegment(x, y, dx, dy) ? 2 : 1
    const arms: Arms = {
      n: weight(cell.n, 0, -1),
      s: weight(cell.s, 0, 1),
      e: weight(cell.e, 1, 0),
      w: weight(cell.w, -1, 0),
    }
    const horizontalEdge = arms.e === 2 || arms.w === 2
    const verticalEdge = arms.n === 2 || arms.s === 2
    // A side that has reached the map's own edge is drawn in the map-edge style, on all four sides
    // alike (owner, 2026-09-27: "the rectangle needs to be a rectangle"); a corner takes it when either
    // side meeting there does, so a heavy side runs unbroken to its end.
    if (horizontalEdge || verticalEdge) {
      // A corner is a corner by where it is, even where only one of its sides is an edge: a half
      // block's quadrant there stops at the frame line it meets instead of running half a cell past it.
      const corner = (x === rect.left || x === rect.right) && (y === rect.top || y === rect.bottom)
      const northSouth = y === rect.top ? "n" : "s"
      const westEast = x === rect.left ? "w" : "e"
      const place: EdgePlace =
        corner
          ? (`${northSouth}${westEast}` as EdgePlace)
          : horizontalEdge
            ? y === rect.top
              ? "north"
              : "south"
            : x === rect.left
              ? "west"
              : "east"
      // Along the map, in map columns or rows from its own corner — the drawn camera's position plus
      // the distance into the view — so a patterned edge scrolls with the map.
      const phase = horizontalEdge
        ? state.camera.x * layout.tileWidth + (x - layout.origin.column)
        : state.camera.y + (y - layout.origin.row)
      const drawn = edgeCell(pack, style, arms, place, phase)
      put(cells, BANDS.chrome, x, y, drawn.glyph, drawn.role, drawn.extra)
      continue
    }
    // A side with more Grid beyond it is the frame's own line drawn dim — beside the Grid only; the
    // corners where it meets the frame, and the rules above and below the panel, stay plain.
    const alongTopOrBottom = (y === rect.top || y === rect.bottom) && x > rect.left && x < rect.right
    const alongLeftOrRight = (x === rect.left || x === rect.right) && y > rect.top && y < rect.bottom
    if (alongTopOrBottom) put(cells, BANDS.chrome, x, y, chromeGlyph(pack, "softHorizontal"), "chrome.frame", soft)
    else if (alongLeftOrRight) put(cells, BANDS.chrome, x, y, chromeGlyph(pack, "softVertical"), "chrome.frame", soft)
    else put(cells, BANDS.chrome, x, y, lineGlyph(pack, cell), "chrome.frame")
  }
}

/**
 * The top bar — the game's title, where the player is, and what Esc does — and the bottom bar's one
 * line (feedback F59): **the contextual line**, the last command's answer while it has one and
 * otherwise a hint for where the keyboard is (`bottomLine`, `src/build/help.ts`), or, while a Nexus
 * Pulse plays with no popup over it, what the Pulse is doing. Every key is on the Controls and hotkeys
 * page, not here.
 */
export function drawTopBarAndBottomLine(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const left = layout.offset.column + 2
  const headerRow = layout.offset.row + 1

  // The top bar: the game's title and where the player is (engine.md 9.2), across the whole width.
  const limit = layout.headerLimit
  text(cells, band, left, headerRow, "TERMINAL NEXUS", "chrome.title", { bold: true, limit })
  // A mission's round, when there is one: its goal is about rounds, so the header counts them
  // (campaigns.md Section 4.3: a Pulse counter "only when the goal is itself about Pulses").
  const round = context.round
  const phase = round === undefined ? "build phase" : `build phase - round ${round.number} of ${round.of}`
  const subtitle = input.pulse === undefined ? phase : pulseSubtitle(input.pulse)
  text(cells, band, left + 15, headerRow, subtitle, "chrome.muted", { limit: limit - 15 })
  // What Esc does right now, right-aligned (feedback F37): "menu [esc]", "back [esc]", "close [esc]" —
  // the name quiet, the key in the hotkey colour after it, findable without competing with the game's
  // own title. The same text is the click target that sends Esc.
  const escText = escLabel(state)
  const hint = escLabelSpan(layout, escText)
  const name = escText.slice(0, escText.length - ESC_KEY.length)
  text(cells, band, hint.from, hint.row, name, "chrome.muted")
  text(cells, band, hint.from + name.length, hint.row, ESC_KEY, "chrome.hotkey", { bold: true })

  // The contextual line. A popup over a Pulse holds the keyboard, so its answer or hint is what the
  // line says; otherwise the Pulse says what it is doing.
  const pulse = state.popup !== null ? undefined : input.pulse
  const shown = pulse === undefined ? bottomLine(context, state, preview) : pulseStatus(pulse)
  const style = statusStyle(shown.tone)
  // Whole words only: on a bar narrower than the line (a Grid smaller than the view) the words that do
  // not fit are left off, never cut in half.
  const line = shown.text.length <= layout.footerLimit ? shown.text : (wrapWords(shown.text, layout.footerLimit)[0] ?? "")
  text(cells, band, left, layout.footerRow, line, style.role, {
    ...(style.bold === undefined ? {} : { bold: style.bold }),
    limit: layout.footerLimit,
  })
}
