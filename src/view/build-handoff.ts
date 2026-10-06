// Hand-offs to the map: a menu row giving the keyboard to the map sends something from the row's own
// place to the cursor — the focus arrow from a building's row, the see-through cursor from Explore
// Map's. One flight, two travellers.

import { inColumns } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import { visibleRange } from "../build/camera.ts"
import { cellForTile, menuEntryRow, tileAtCell } from "../build/layout.ts"
import type { ArmedPreview } from "../build/state.ts"
import { EXPLORE_ENTRY, menuEntries } from "../build/state.ts"
import type { BandCell } from "./frame.ts"
import { BANDS } from "./frame.ts"
import type { StyleRole } from "./roles.ts"
import { chromeGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import { EASINGS } from "./tween.ts"
import type { BuildCompositionInput } from "./build.ts"
import { CURSOR_ROLE, glideShift, inView, structureAt } from "./build-grid.ts"
import { cardHeaderRow } from "./build-card.ts"

/** How many cells of trail follow the focus arrow's head, and how many of them, nearest the head, are
 *  drawn at full strength; the older ones are dim. */
const ARROW_TRAIL = 4
const ARROW_TRAIL_BRIGHT = 2

/** tan(22.5 degrees): within this slope of an axis, a line reads as running along it. */
const AXIS_SLOPE = 0.4142

/**
 * The focus arrow's head and trail glyphs for a line running `dx` columns and `dy` rows. A terminal
 * cell is about twice as tall as it is wide, so a row counts as two columns when the slope is read
 * (`inColumns`): within 22.5 degrees of level the head points left or right and the trail is level; within 22.5
 * degrees of upright it points up or down and the trail is upright; between them the trail is a
 * diagonal and the head points along whichever way the line runs further on screen.
 */
function arrowGlyphs(pack: GlyphPack, dx: number, dy: number): Readonly<{ head: string; trail: string }> {
  const { across, down } = inColumns(dx, dy)
  const horizontal = chromeGlyph(pack, across >= 0 ? "arrowRight" : "arrowLeft")
  const vertical = chromeGlyph(pack, down >= 0 ? "arrowDown" : "arrowUp")
  if (Math.abs(down) <= Math.abs(across) * AXIS_SLOPE) return { head: horizontal, trail: chromeGlyph(pack, "trailLevel") }
  if (Math.abs(across) <= Math.abs(down) * AXIS_SLOPE) return { head: vertical, trail: chromeGlyph(pack, "trailUpright") }
  const falling = across >= 0 === down >= 0
  return {
    head: Math.abs(across) >= Math.abs(down) ? horizontal : vertical,
    trail: chromeGlyph(pack, falling ? "trailFall" : "trailRise"),
  }
}

/**
 * Where a hand-off's flight leaves from (Mario: "start from the actual
 * location of the menu item, not from the top. The item moves to the top because that works as a
 * title"): the cell just right of the right end of the row the handed-off entry has **on the menu** —
 * the divider's cell on that row — whatever the panel shows now. A row the menu has no room for (a
 * catalog longer than the panel) leaves from the card's header line.
 */
function flightStart(input: BuildCompositionInput): Coord {
  const { context, state, layout } = input
  const entry = state.handoff === null ? undefined : menuEntries(context)[state.handoff.entry]
  const row = entry === undefined ? null : menuEntryRow(layout, context.catalog, entry)
  return { x: layout.dividerColumn, y: row ?? cardHeaderRow(layout) }
}

/** A hand-off's flight at this frame: the cell it leaves from, the cursor's cell it flies to, and how
 *  far along it is, eased. */
type Flight = Readonly<{ from: Coord; to: Coord; along: number }>

/**
 * The hand-off's flight this frame, or `null` when nothing flies: only while the live loop says one is
 * in flight, the map has the keyboard, no popup is open and the plan is not committed, and only toward a
 * cursor in view. It flies toward the cursor **as it is drawn this frame**, so it homes on a cursor that
 * moves meanwhile, eased to arrive fast and settle.
 */
function handoffFlight(input: BuildCompositionInput): Flight | null {
  const { state, layout } = input
  const flight = input.handoffFlight
  if (flight === undefined || state.committed) return null
  if (state.focus !== "grid" || state.popup !== null) return null
  const range = visibleRange(state.camera, state.viewport)
  const cursor = input.cursor ?? state.cursor
  if (!inView(range, cursor)) return null
  // Fast at first, settling on the cursor.
  return { from: flightStart(input), to: cellForTile(layout, state.camera, cursor), along: EASINGS.easeOut(flight.progress) }
}

/**
 * The hand-off crossing from the menu to the map: the focus arrow from a building's row, the see-through
 * cursor from Explore Map's — one flight, two travellers.
 */
export function drawHandoff(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack, preview: ArmedPreview | null): void {
  const flight = handoffFlight(input)
  if (flight === null) return
  if (input.state.handoff?.entry === EXPLORE_ENTRY) drawSeeThroughCursor(cells, input, flight)
  else drawFocusArrow(cells, input, pack, preview, flight)
}

/**
 * The **focus arrow** (Mario: "an animation that sends an arrow from the menu
 * item to the cursor ... fast and use interpolation"): a building's row's hand-off. It leaves from the
 * cell just right of the building's row on the menu (`flightStart`) and flies in a straight line
 * toward the cursor; its head points the way it flies and a short trail follows it, the older cells dim.
 * It stops one cell short of the cursor's tile, which stays whole for the blink that follows.
 *
 * Drawn over the chrome, so it crosses the divider, and under every popup. On the map it keeps the
 * corruption law as every effect does: on a building's tile — standing, planned, or the ghost of the one
 * being placed — only the style changes, never the glyph.
 */
function drawFocusArrow(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack, preview: ArmedPreview | null, flight: Flight): void {
  const { context, state, layout } = input
  const { from, to: target } = flight
  // Aimed at the cursor's cell, one cell at a time along the longer of the two runs: the cells a straight line
  // crosses on screen. A path, not a distance.
  const dx = target.x - from.x
  const dy = target.y - from.y
  const steps = Math.max(1, Math.abs(dx), Math.abs(dy))
  const path: Coord[] = []
  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(from.x + (dx * step) / steps)
    const y = Math.round(from.y + (dy * step) / steps)
    if (x === target.x && y === target.y) break
    const last = path[path.length - 1]
    if (last === undefined || last.x !== x || last.y !== y) path.push({ x, y })
  }
  if (path.length === 0) return

  // What a glyph may not replace: a building's tile, and the ghost of the one being placed.
  const shift = glideShift(input)
  const ghost = new Set<string>(
    preview === null
      ? []
      : preview.footprint.map((offset) => `${preview.anchor.x + offset.x + shift.x},${preview.anchor.y + offset.y + shift.y}`),
  )
  const covered = (x: number, y: number): boolean => {
    const tile = tileAtCell(layout, state.camera, x, y)
    return tile !== null && (ghost.has(`${tile.x},${tile.y}`) || structureAt(context, state.planned, tile))
  }

  const head = Math.min(path.length - 1, Math.floor(flight.along * path.length))
  const glyphs = arrowGlyphs(pack, dx, dy)
  for (let back = Math.min(ARROW_TRAIL, head); back >= 0; back -= 1) {
    const index = head - back
    const at = path[index] as Coord
    const dim = back > ARROW_TRAIL_BRIGHT
    const style = { fgRole: "chrome.hotkey" as const, bold: !dim, dim }
    // Each trail cell is drawn as the step that reached it — level, upright or diagonal — so a shallow
    // line reads as a line (`\--\--`) rather than a staircase of one slanted glyph.
    const previous = path[index - 1]
    const trail = previous === undefined ? glyphs.trail : stepGlyph(pack, at.x - previous.x, at.y - previous.y)
    if (covered(at.x, at.y)) cells.push({ band: BANDS.chrome, x: at.x, y: at.y, style })
    else cells.push({ band: BANDS.chrome, x: at.x, y: at.y, cell: { glyph: back === 0 ? glyphs.head : trail, style } })
  }
}

/** The trail glyph for one step of the path, from the cell before to this one. */
function stepGlyph(pack: GlyphPack, dx: number, dy: number): string {
  if (dy === 0) return chromeGlyph(pack, "trailLevel")
  if (dx === 0) return chromeGlyph(pack, "trailUpright")
  return chromeGlyph(pack, dx > 0 === dy > 0 ? "trailFall" : "trailRise")
}

/**
 * The see-through cursor's copies, head first: how far behind the head each is, in tile steps along the
 * flight, and how opaque (Mario: "a cursor that is the same as the blank cursor, with about 80%
 * 'transparency'"). The head is at 0.8; two fainter copies trail it one and two steps behind, so a fast
 * flight reads as a short smear that settles into the cursor.
 */
export const SEE_THROUGH_TRAIL: readonly Readonly<{ back: number; alpha: number }>[] = [
  { back: 0, alpha: 0.8 },
  { back: 1, alpha: 0.45 },
  { back: 2, alpha: 0.2 },
]

/** The role the see-through cursor is mixed from: the map cursor's own (`drawCursor`). */
const SEE_THROUGH_ROLE: StyleRole = CURSOR_ROLE

/**
 * **Explore Map's hand-off** (Mario: "exploring is just moving the focus to
 * the map. Use a cursor that is the same as the blank cursor, with about 80% 'transparency'"): instead of
 * the focus arrow, a copy of the map cursor — one tile wide — travels from Explore Map's row on the menu
 * to the cursor, on the arrow's own flight, with a short, fainter trail (`SEE_THROUGH_TRAIL`). Every cell
 * it covers is a **glyphless** write carrying `CellStyle.seeThrough` — the cursor's role at an opacity —
 * so whatever is beneath, the menu's words, the divider, the ground, a building, keeps its glyph (the
 * corruption law) and the renderer mixes the colour (`SeeThrough`, `src/view/roles.ts`). Drawn over the
 * panel, the divider and the map, under every popup, and never on the real cursor's own cell, into
 * which it settles.
 */
function drawSeeThroughCursor(cells: BandCell[], input: BuildCompositionInput, flight: Flight): void {
  const { layout } = input
  const { from, to: target } = flight
  const dx = target.x - from.x
  const dy = target.y - from.y
  // One step of the flight is a cell across or a row down, whichever the flight has more of.
  const steps = Math.max(1, Math.abs(dx), Math.abs(dy))
  const alphas = new Map<number, Readonly<{ x: number; y: number; alpha: number }>>()
  for (const copy of SEE_THROUGH_TRAIL) {
    const along = flight.along - copy.back / steps
    if (along < 0) continue
    const x = Math.round(from.x + dx * along)
    const y = Math.round(from.y + dy * along)
    if (x === target.x && y === target.y) continue
    const key = y * layout.frame.width + x
    const seen = alphas.get(key)
    if (seen === undefined || seen.alpha < copy.alpha) alphas.set(key, { x, y, alpha: copy.alpha })
  }
  for (const { x, y, alpha } of alphas.values()) {
    cells.push({ band: BANDS.chrome, x, y, style: { seeThrough: { role: SEE_THROUGH_ROLE, alpha } } })
  }
}
