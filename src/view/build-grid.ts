// The Build Phase's Grid pane: what stands on the map and what is going up or coming down (placements
// and their effects), the ghost of the building being placed, the cursor, and a refused try's flash —
// all drawn through the camera and clipped to the view.

import { tilesOf } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import type { VisibleRange } from "../build/camera.ts"
import { visibleRange } from "../build/camera.ts"
import { cellForTile } from "../build/layout.ts"
import type { ArmedPreview, BuildContext } from "../build/state.ts"
import type { PlannedPlacement } from "../build/types.ts"
import type { BandCell, CellStyle } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { put } from "./draw.ts"
import { drawTerrain } from "./grid-layer.ts"
import type { CapabilityMode, StyleRole } from "./roles.ts"
import { entityGlyph, playerRole } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import { statusStyle } from "./status.ts"
import { EFFECT_RECIPES } from "./effects/recipes.ts"
import type { EffectCellSource } from "./effects/composite.ts"
import { paintEffectCells } from "./effects/composite.ts"
import type { TrackSchedule } from "./animation.ts"
import { trackEffectsAt } from "./animation.ts"
import { placementEffectContext, placementLook, placementSchedule, removalSchedule } from "./placement.ts"
import type { BuildCompositionInput } from "./build.ts"
import { HIGHLIGHT_BAR, PRESSED_LOOK } from "./build-menu.ts"

/** Every tile of a preview that would be refused: a block of `x`, so shape carries the refusal. */
const ILLEGAL_PREVIEW_GLYPH = "x"

/** Whether `tile` is in the view's range of tiles — what the Grid pane draws, and all it draws. */
export function inView(range: VisibleRange, tile: Coord): boolean {
  return tile.x >= range.firstX && tile.x <= range.lastX && tile.y >= range.firstY && tile.y <= range.lastY
}

/** A planned placement still animating: its track on its own clock, and how far along it is. */
type Animating = Readonly<{ placement: PlannedPlacement; schedule: TrackSchedule; elapsedMs: number }>

/** Every clock the live loop handed in whose ordinal is still planned, scheduled once per frame and
 *  read by both the structures and the effects. A clock for an ordinal no longer planned (undone,
 *  removed) draws nothing: the plan decides what stands, the clock only how. */
export function animatingPlacements(input: BuildCompositionInput): Map<number, Animating> {
  const { context, state } = input
  const reducedMotion = input.reducedMotion === true
  const animating = new Map<number, Animating>()
  for (const clock of input.placing ?? []) {
    const placement = state.planned.find((planned) => planned.ordinal === clock.ordinal)
    if (placement === undefined) continue
    const footprint = context.registry.get(placement.contentId).footprint
    const schedule = placementSchedule(placement, footprint, reducedMotion, input.placementTuning)
    animating.set(clock.ordinal, { placement, schedule, elapsedMs: clock.elapsedMs })
  }
  return animating
}

/** Everything that is actually on the Grid, drawn through the camera and clipped to the viewport. */
export function drawGrid(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack, animating: ReadonlyMap<number, Animating>): void {
  const { context, state, layout } = input
  const range = visibleRange(state.camera, state.viewport)

  drawTerrain(cells, { grid: context.grid, camera: state.camera, viewport: state.viewport, layout }, pack)

  const drawStructure = (contentId: string, anchor: Coord, animation: Animating | undefined): void => {
    const definition = context.registry.get(contentId)
    for (const offset of definition.footprint) {
      const tile = { x: anchor.x + offset.x, y: anchor.y + offset.y }
      if (!inView(range, tile)) continue
      const cell = cellForTile(layout, state.camera, tile)
      // Drawn at full strength, planned or standing (owner, 2026-09-27: "it will look better if
      // they are fully built"). A plan stays revisable — undo, remove — until the Pulse starts. While
      // a placement is still going up (gate 5I) it is drawn as its track's frame at that instant; the
      // light on it is shading, drawn with the other effects (`drawEffects`).
      const look =
        animation === undefined
          ? { glyph: entityGlyph(contentId, "A", { x: offset.x, y: offset.y }), bold: true }
          : placementLook(animation.schedule, contentId, offset, animation.elapsedMs)
      if (look.glyph !== null) {
        cells.push({
          band: BANDS.structures,
          x: cell.x,
          y: cell.y,
          cell: {
            glyph: look.glyph,
            style: {
              fgRole: playerRole("A"),
              ...(look.bold ? { bold: true } : {}),
            },
          },
        })
      }
      for (let extra = 1; extra < layout.tileWidth; extra += 1) {
        put(cells, BANDS.structures, cell.x + extra, cell.y, " ", playerRole("A"))
      }
    }
  }

  for (const structure of context.standing) drawStructure(structure.contentId, structure.anchor, undefined)
  for (const placement of state.planned) drawStructure(placement.contentId, placement.anchor, animating.get(placement.ordinal))
}

/**
 * The effects of every placement still animating (gate 5I) — its track's follow-ups: the light
 * (shading, `highlights`) and the sparks (particles, `effects`) — and of every building just removed
 * (feedback F33), whose track is its sparks alone. The corruption law is enforced here as
 * the Pulse compositor enforces it, through the same helper (`paintEffectCells`): a glyphless cell
 * only restyles whatever is beneath it, and a particle that would land on any building's tile —
 * standing, planned, or still going up — is dropped, so an effect never replaces the glyph that says a
 * building is there. Two effects on one tile merge the way the Pulse's do. Clipped to the view like
 * everything else on the Grid.
 */
export function drawEffects(
  cells: BandCell[],
  input: BuildCompositionInput,
  animating: ReadonlyMap<number, Animating>,
  capability: CapabilityMode,
): void {
  const { context, state, layout } = input
  const reducedMotion = input.reducedMotion === true
  const tracks: Readonly<{ schedule: TrackSchedule; elapsedMs: number }>[] = [...animating.values()]
  for (const removal of input.removing ?? []) {
    const footprint = context.registry.get(removal.contentId).footprint
    tracks.push({ schedule: removalSchedule(removal, footprint, reducedMotion, input.placementTuning), elapsedMs: removal.elapsedMs })
  }
  if (tracks.length === 0) return
  const range = visibleRange(state.camera, state.viewport)
  const sources: EffectCellSource[] = []
  for (const { schedule, elapsedMs } of tracks) {
    const effectContext = placementEffectContext(elapsedMs, reducedMotion, capability, layout.tileWidth)
    for (const instance of trackEffectsAt(schedule, elapsedMs)) {
      const recipe = EFFECT_RECIPES[instance.recipe]
      if (recipe === undefined) continue
      for (const cell of recipe(instance, effectContext)) {
        const { tile } = cell
        if (!inView(range, tile)) continue
        if (tile.x >= context.grid.width || tile.y >= context.grid.height) continue
        sources.push({ band: instance.band, cell })
      }
    }
  }
  paintEffectCells(
    cells,
    sources,
    (tile) => cellForTile(layout, state.camera, tile),
    (tile) => structureAt(context, state.planned, tile),
  )
}

/**
 * The armed structure's footprint under the cursor — its ghost — and whether it would be refused there.
 * Drawn in the highlights band, so it is presentation and can never change occupancy (engine.md 9.4).
 * Shape carries the answer, not colour: a legal preview is the structure's own glyphs, an illegal one
 * is a block of `x`. Both read identically in monochrome, which is the point.
 *
 * The illegal block is grey, not red (owner, 2026-09-26: "the red color seems a bit too intense, we
 * should try grey instead"). Red is kept for the moment a placement is actually *attempted* and
 * refused — the bottom line's job, not the ghost's — so looking and trying read differently.
 *
 * One exception (feedback F30): when arming found no spot within reach (`BuildState.noSpotFound`), the
 * building is drawn as itself — in the same grey, since it would still be refused — rather than as a
 * block of `x`, until the player moves or tries to place.
 */
export function drawPreview(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null): void {
  const { state, layout } = input
  if (preview === null) return
  const legal = preview.refusal === null
  const shape = legal || state.noSpotFound
  const range = visibleRange(state.camera, state.viewport)
  const shift = glideShift(input)

  for (const offset of preview.footprint) {
    const tile = { x: preview.anchor.x + offset.x + shift.x, y: preview.anchor.y + offset.y + shift.y }
    if (!inView(range, tile)) continue
    const cell = cellForTile(layout, state.camera, tile)
    const glyph = shape
      ? entityGlyph(preview.item.contentId, "A", { x: offset.x, y: offset.y })
      : ILLEGAL_PREVIEW_GLYPH
    put(cells, BANDS.highlights, cell.x, cell.y, glyph, legal ? "chrome.hotkey" : "chrome.muted")
  }
}

/** How far the drawn cursor still is from the state's own, mid-glide: what the preview and a refused
 *  try's flash are shifted by so they travel with it. */
export function glideShift(input: BuildCompositionInput): Coord {
  const drawn = input.cursor
  if (drawn === undefined) return { x: 0, y: 0 }
  return { x: drawn.x - input.state.cursor.x, y: drawn.y - input.state.cursor.y }
}

/** Whether a structure — standing or still only planned — covers this tile. */
export function structureAt(context: BuildContext, planned: readonly PlannedPlacement[], tile: Coord): boolean {
  const covers = (contentId: string, anchor: Coord): boolean =>
    tilesOf(anchor, context.registry.get(contentId).footprint).some((t) => t.x === tile.x && t.y === tile.y)
  return (
    context.standing.some((s) => covers(s.contentId, s.anchor)) ||
    planned.some((p) => covers(p.contentId, p.anchor))
  )
}

/** The map cursor's role: the highlight bar's, since both say "you are here". */
export const CURSOR_ROLE: StyleRole = HIGHLIGHT_BAR.role

/** One cursor, drawn as a style-only write so it keeps whatever glyph is beneath it — the mechanism
 *  `src/view/frame.ts` already provides, and the only honest way to mark a tile without deleting
 *  what is standing on it. Inverse video carries "here" at every capability tier.
 *
 * Bare ground gets a contrast boost on top of that: it is drawn dim, and inverting a dim cell is
 * still a dim one, so `bold` and an explicit `dim: false` are added — `composeBands` merges a
 * style-only write onto whatever is beneath rather than replacing it, so without clearing it the
 * ground's own `dim: true` would survive underneath and fight the cursor's `bold` for intensity. A
 * structure does not need it: planned or standing, it is drawn bold at full strength, so inverse video
 * alone marks it, in the building's own colour.
 *
 * When a hand-off's flight lands the cursor **blinks** (feedback F54: "the same exact effect as the one we
 * use when selecting menu items"): in its "on" phases it is drawn in a menu row's pressed look — the
 * hotkey's colour, inverse, bold, underlined — and between them as usual. The live loop times it
 * (`cursorBlink`); every still frame draws the plain cursor.
 */
export function drawCursor(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  // The cursor is the Grid's own focus mark: drawn only while the Grid has the keyboard, so the
  // screen never shows two "you are here"s at once (owner, 2026-09-27).
  // A committed plan hides the cursor, except while a Pulse is on screen: there it is how the player looks
  // around the map, the arrows moving it and the view following (gate 6A).
  if (state.focus !== "grid" || state.popup !== null || (state.committed && input.pulse === undefined)) return
  const range = visibleRange(state.camera, state.viewport)
  // Where the cursor is drawn: mid-glide, a tile on its way (and what stands there decides its style).
  const cursor = input.cursor ?? state.cursor
  if (!inView(range, cursor)) return
  const cell = cellForTile(layout, state.camera, cursor)
  const onStructure = structureAt(context, state.planned, cursor)
  // Its own role rather than the ground's: bold survives monochrome but changes nothing about which
  // colour a terminal picks for it, so a coloured screen still needs an explicit, reliably bright role
  // to get the same lift monochrome gets from the attribute alone. The highlight bar's role, so the
  // menu's and the map's "you are here" read as one.
  const style: CellStyle =
    input.cursorBlink === true
      ? { inverse: true, bold: PRESSED_LOOK.bold, underline: PRESSED_LOOK.underline, dim: false, fgRole: PRESSED_LOOK.role }
      : onStructure
        ? { inverse: true }
        : { inverse: true, bold: true, dim: false, fgRole: CURSOR_ROLE }
  for (let extra = 0; extra < layout.tileWidth; extra += 1) {
    cells.push({ band: BANDS.highlights, x: cell.x + extra, y: cell.y, style })
  }
}

/**
 * A **refused try**: a placement was just tried and refused, and the whole footprint under the cursor
 * flashes solid in the bottom line's own "danger" colour for a moment (gate 5H), so the eye that was on
 * the map learns it did not build without reading the bottom line. A style-only write, like the cursor,
 * so the `x` block and whatever it covers keep their glyphs; inverse video carries it in monochrome.
 */
export function drawRefusedTry(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null): void {
  const { state, layout } = input
  if (input.refusedTry !== true || state.focus !== "grid" || state.popup !== null) return
  const range = visibleRange(state.camera, state.viewport)
  const shift = glideShift(input)
  const tiles =
    preview === null
      ? [input.cursor ?? state.cursor]
      : preview.footprint.map((offset) => ({
          x: preview.anchor.x + offset.x + shift.x,
          y: preview.anchor.y + offset.y + shift.y,
        }))
  const danger = statusStyle("danger")
  const style = { inverse: true, bold: true, dim: false, fgRole: danger.role }
  for (const tile of tiles) {
    if (!inView(range, tile)) continue
    const cell = cellForTile(layout, state.camera, tile)
    for (let extra = 0; extra < layout.tileWidth; extra += 1) {
      cells.push({ band: BANDS.highlights, x: cell.x + extra, y: cell.y, style })
    }
  }
}
