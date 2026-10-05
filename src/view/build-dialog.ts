// **The dialog** on screen: what the popup shape does not already draw of it. The box itself — docked at
// the bottom of the map, its border breathing like every popup's, the line wrapped inside — is the one popup
// shape's (`src/build/popup.ts`, `build-popup.ts`). Two things are the dialog's own:
//
//   - **the speaker**, in the border's title: their name in their side's colour, with their glyph before it
//     when they stand on this round's map (`@ VASSE`), so the box and the map name the same `@`; the game's
//     own voice has no name, and the border runs unbroken;
//   - **the intro highlight**, on the map: a ring of light around what the line looks at, breathing for as
//     long as the line is shown (`fx.focus.light`, shading — glyphless, so what stands there keeps its
//     glyph). Its clock is the live loop's, from the frame the line first appeared (`dialogLight`); a still
//     frame draws it as the line appears, lit.

import { visibleRange } from "../build/camera.ts"
import { inBounds } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import { cellForTile } from "../build/layout.ts"
import { placePopup, popupSpec, speakerTitle } from "../build/popup.ts"
import type { DialogLine } from "../build/types.ts"
import type { BandCell } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { text } from "./draw.ts"
import type { CapabilityMode } from "./roles.ts"
import { entityGlyph, playerRole } from "./theme.ts"
import type { BuildCompositionInput } from "./build.ts"
import { inView } from "./build-grid.ts"
import { popupBorderStyle } from "./build-popup.ts"
import { EFFECT_RECIPES } from "./effects/recipes.ts"
import type { EffectContext, EffectInstance } from "./effects/types.ts"
import { effectCellStyle } from "./effects/composite.ts"

/** The line the dialog shows, or `null` with no dialog on screen. */
export function lineOnScreen(input: Pick<BuildCompositionInput, "context" | "state">): DialogLine | null {
  const { context, state } = input
  if (state.popup !== "dialog" || state.dialog === null) return null
  return context.scene?.[state.dialog.line] ?? null
}

/** The dialog's own parts, over the popup shape: the highlight on the map, and the speaker in the border.
 *  Drawn after the popups, so the speaker's title is the last word on the border. */
export function drawDialog(cells: BandCell[], input: BuildCompositionInput, capability: CapabilityMode): void {
  const line = lineOnScreen(input)
  if (line === null) return
  drawFocusLight(cells, input, line, capability)
  drawSpeaker(cells, input, line)
}

/** The speaker's name in the border's title, inverse like every popup's title but in their side's colour,
 *  their glyph before it when they stand on the map; for the game's own voice, the border unbroken. */
function drawSpeaker(cells: BandCell[], input: BuildCompositionInput, line: DialogLine): void {
  const spec = popupSpec(input.context, input.state)
  if (spec === null) return
  const { box } = placePopup(input.layout, spec)
  const column = box.left + 2
  if (line.speaker === null) {
    // The popup drew an empty title, two cells in the title's colour: the border's own again.
    const border = { fgRole: "chrome.frame" as const, inverse: true, ...popupBorderStyle(input.popupBorder) }
    for (let x = column; x < column + 2; x += 1) cells.push({ band: BANDS.chrome, x, y: box.top, cell: { glyph: " ", style: border } })
    return
  }
  const role = line.side === null ? "chrome.title" : playerRole(line.side)
  const glyph = line.unit === null ? null : entityGlyph(line.unit, line.side ?? "A", { x: 0, y: 0 })
  const title = glyph === null ? speakerTitle(line) : `${glyph} ${speakerTitle(line)}`
  text(cells, BANDS.chrome, column, box.top, ` ${title} `, role, { bold: true, inverse: true, limit: box.right - box.left - 3 })
}

/** One instance of the intro highlight on a tile of the focus, timed from the line's appearance. */
const lightOn = (tile: Coord, periodMs: number): EffectInstance => ({
  recipe: "fx.focus.light",
  band: "highlights",
  startMs: 0,
  durationMs: Number.MAX_SAFE_INTEGER,
  origin: tile,
  family: "neutral",
  params: { periodMs },
})

/**
 * The intro highlight around the line's focus: the recipe around each of the focus's own tiles — a unit's
 * one, each of a group's units', every tile of a region — so the ring outlines the whole focus and never
 * lights a tile of the focus itself; each tile lit once, on the map and in the view, across the tile's
 * whole width. One breath is the "Popup pulse" Experiment's, the dialog's border's own (0 holds it steady).
 */
function drawFocusLight(cells: BandCell[], input: BuildCompositionInput, line: DialogLine, capability: CapabilityMode): void {
  const focus = line.focus
  if (focus === null) return
  const { context, state, layout } = input
  const range = visibleRange(state.camera, state.viewport)
  const recipe = EFFECT_RECIPES["fx.focus.light"]
  if (recipe === undefined) return
  const effect: EffectContext = {
    timeMs: input.dialogLight?.elapsedMs ?? 0,
    cosmeticSeed: 0,
    tileWidth: layout.tileWidth,
    reducedMotion: input.reducedMotion === true,
    capability,
  }
  const periodMs = state.experiments.popupPulseMs
  const key = (tile: Coord): string => `${tile.x},${tile.y}`
  const own = new Set(focus.own.map(key))
  const lit = new Set<string>()
  for (const tile of focus.own) {
    for (const cell of recipe(lightOn(tile, periodMs), effect)) {
      const at = key(cell.tile)
      // The ring of one of a group's units falls on another of them: the focus is never lit, only its ground.
      if (lit.has(at) || (cell.seeThrough !== undefined && own.has(at))) continue
      if (!inBounds(context.grid, cell.tile) || !inView(range, cell.tile)) continue
      lit.add(at)
      const place = cellForTile(layout, state.camera, cell.tile)
      const style = effectCellStyle(cell)
      for (let extra = 0; extra < layout.tileWidth; extra += 1) cells.push({ band: BANDS.highlights, x: place.x + extra, y: place.y, style })
    }
  }
}
