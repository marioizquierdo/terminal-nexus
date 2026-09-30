// The Build Phase frame — engine.md 9.2's composition, on the same band compositor, style roles and
// glyph packs as the Pulse view and the menu, so monochrome and the colour tiers come free.
//
// The Grid pane is a **window onto a Grid larger than itself**: every tile is drawn at
// `tile - camera` and clipped to the viewport, and the signal engine.md 3.3 requires in place of a
// minimap — the weight of the lines around the Grid pane — comes from the same camera the cursor moved.
// (A position readout naming the visible range was the second signal until the owner took it out,
// 2026-09-30, feedback F59.)

import { footprintExtent, tilesOf } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import type { Camera } from "../build/camera.ts"
import { edgeMarkers, visibleRange } from "../build/camera.ts"
import { CONTROLS_KEYS_WIDTH, bottomLine } from "../build/help.ts"
import type { BuildLayout } from "../build/layout.ts"
import {
  CARD_FIRST_ROW,
  CARD_HEADER_ROW,
  CARD_SEPARATOR_ROW,
  ESC_KEY,
  RESOURCE_ROW,
  START_KEY,
  START_LABEL,
  cellForTile,
  escHintSpan,
  escLabel,
  menuEntryRow,
  menuFloor,
  tileAtCell,
} from "../build/layout.ts"
import { overlaySpec, placeOverlay, settingColumns, wrapWords } from "../build/overlay.ts"
import type { ArmedPreview, BuildContext, BuildState } from "../build/state.ts"
import {
  EXPLORE_ENTRY,
  NEXUS_ENTRY,
  armedPreview,
  cardShowing,
  entryOfConstruct,
  exploring,
  menuEntries,
  nexusPowers,
  pendingPicks,
  remaining,
  startEntry,
  structureAtTile,
} from "../build/state.ts"
import type { PlannedPlacement } from "../build/types.ts"
import { CONTENT_ART } from "../content/art.ts"
import type { BandCell, ReadonlyCellFrame } from "./frame.ts"
import { BANDS, composeBands } from "./frame.ts"
import { put, text } from "./draw.ts"
import { drawTerrain } from "./grid-layer.ts"
import type { PulseFrame } from "./pulse-scene.ts"
import { drawFrameLight, drawPulseEffects, drawPulseEntities, drawPulsePanel, pulseStatus, pulseSubtitle } from "./pulse-scene.ts"
import type { CapabilityMode, StyleRole } from "./roles.ts"
import { chromeGlyph, entityGlyph, playerRole, terrainGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import { statusStyle } from "./status.ts"
import type { ArmWeight, Arms, EdgePlace } from "./edge.ts"
import { edgeCell } from "./edge.ts"
import { EFFECT_RECIPES } from "./effects/recipes.ts"
import type { EffectCellSource } from "./effects/composite.ts"
import { paintEffectCells } from "./effects/composite.ts"
import type { TrackSchedule } from "./animation.ts"
import { trackEffectsAt } from "./animation.ts"
import type { PlacementClock, RemovalClock } from "./placement.ts"
import { placementEffectContext, placementLook, placementSchedule, removalSchedule } from "./placement.ts"

/** A structure the player is about to place, and whether they may. Drawn in the highlights band, so
 *  it is presentation and can never change occupancy (engine.md 9.4). */
const ILLEGAL_PREVIEW_GLYPH = "x"

export type BuildCompositionInput = Readonly<{
  context: BuildContext
  state: BuildState
  layout: BuildLayout
  glyphPack?: GlyphPack
  /** A menu row's brief acknowledgement, while the live loop is showing one — a "pressed" flash or a
   *  "refused" flicker. Presentation only; absent in every still frame. */
  flash?: BuildFlash
  /**
   * The camera the Grid is drawn through, while the live loop is sliding the view toward the state's
   * own camera (gate 5H). Presentation only: absent, the state's camera is drawn — every still frame,
   * every test, every scripted playtest.
   */
  camera?: Camera
  /**
   * The tile the cursor is drawn on, while the live loop glides it toward the state's own cursor
   * (after the owner's 2026-09-28 playtest). Presentation only: the armed preview and the refused
   * flash are drawn shifted along with it, but what they say — legal or not, and why — is about the
   * state's cursor, where Enter would act. Absent, the state's cursor is drawn.
   */
  cursor?: Coord
  /** The cursor flashes where a placement was just tried and refused, while the live loop shows it
   *  (gate 5H; the "Refused cursor" Experiment). Presentation only. */
  refusedFlash?: boolean
  /**
   * The **focus arrow** in flight (owner, 2026-09-30, feedback F54): a menu row has just handed the
   * keyboard to the map, and an arrow flies from the row's `>>` to the cursor. `progress` runs 0 to 1,
   * linear in time; the view eases it. The live loop supplies it (the "Focus arrow" Experiment);
   * absent — every still frame — no arrow.
   */
  focusArrow?: Readonly<{ progress: number }>
  /** The cursor is in the "on" half of its blink, after the focus arrow lands (F54; the "Cursor blink"
   *  Experiment): drawn in a menu row's pressed look. Absent — every still frame — the plain cursor. */
  cursorBlink?: boolean
  /**
   * Planned placements still animating, by ordinal, with how long ago each was placed (gate 5I). The
   * live loop supplies it; a still frame names whatever instant it wants to draw. Absent — every
   * test, every scripted playtest — each building is drawn finished. A clock whose ordinal is no
   * longer planned (undone, removed) draws nothing: the plan decides what stands, the clock only how.
   */
  placing?: readonly PlacementClock[]
  /** Buildings that just left the plan, with how long ago each went (feedback F33): their sparks. The
   *  live loop supplies it; absent — every still frame — nothing is drawn for a removal. */
  removing?: readonly RemovalClock[]
  /** The player's reduced-motion setting: a placement then shows its finished building at once. */
  reducedMotion?: boolean
  /**
   * A Nexus Pulse is on screen (gate 6A): what it is showing at this instant, worked out by the presenter
   * (`pulse-live.ts`). Present, the Grid shows the fight and the panel the forces and the ending, in this
   * same frame and under the same popups; absent — every Build Phase frame, and every test that never
   * starts a Pulse — the frame is the Build Phase's, exactly as it always was.
   */
  pulse?: PulseFrame
}>

export type BuildFlash = Readonly<{ kind: "pressed" | "refused"; entry: number }>

/** Which of a frame cell's four neighbours a line continues into. */
type Joins = { n: boolean; s: boolean; e: boolean; w: boolean }

/** The glyph for a frame cell, from which way its lines run — a straight run, a corner, a tee, or a
 *  crossing. Every junction is derived rather than placed by hand, so moving a line (the side panel
 *  moving to the left is the next one, canon 2.19) moves its junctions with it. */
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
 * dim, and a side that has actually reached the Grid's own edge is a **solid bar** — an inverse-video
 * cell, a wall rather than merely a border, the same weight in every glyph pack and in monochrome
 * (canon 2.21, replacing 2.19's `=` and bold `|`, which ASCII could not make equal; Q56).
 * Since the owner's playtest of 2026-09-29 (feedback F25) that edge is drawn in **the map's own
 * style** — the solid bar only when the map names none — in the quieter edge colour, each style the
 * same weight on all four sides (`src/view/edge.ts` draws them); and the menu's divider **is** the
 * Grid's west side, one shared column, plain beside the menu's rules and a light or map-edge side
 * beside the Grid's rows.
 * Everything else — the outer border, the rules where they cross the side panel — never scrolls and
 * is drawn plain.
 */
function drawChrome(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
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
  // `layout.dividerColumn`): the owner's choice of 2026-09-29 (F25), replacing a column of its own.
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

/** A planned placement still animating: its track on its own clock, and how far along it is. */
type Animating = Readonly<{ placement: PlannedPlacement; schedule: TrackSchedule; elapsedMs: number }>

/** Every clock the live loop handed in whose ordinal is still planned, scheduled once per frame and
 *  read by both the structures and the effects. A clock for an ordinal no longer planned (undone,
 *  removed) draws nothing: the plan decides what stands, the clock only how. */
function animatingPlacements(input: BuildCompositionInput): Map<number, Animating> {
  const { context, state } = input
  const reducedMotion = input.reducedMotion === true
  const animating = new Map<number, Animating>()
  for (const clock of input.placing ?? []) {
    const placement = state.planned.find((planned) => planned.ordinal === clock.ordinal)
    if (placement === undefined) continue
    const footprint = context.registry.get(placement.contentId).footprint
    const schedule = placementSchedule(placement, footprint, state.debug, reducedMotion)
    animating.set(clock.ordinal, { placement, schedule, elapsedMs: clock.elapsedMs })
  }
  return animating
}

/** Everything that is actually on the Grid, drawn through the camera and clipped to the viewport. */
function drawGrid(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack, animating: ReadonlyMap<number, Animating>): void {
  const { context, state, layout } = input
  const range = visibleRange(state.camera, state.viewport)

  drawTerrain(cells, { grid: context.grid, camera: state.camera, viewport: state.viewport, layout }, pack)

  const drawStructure = (contentId: string, anchor: Coord, animation: Animating | undefined): void => {
    const definition = context.registry.get(contentId)
    for (const offset of definition.footprint) {
      const tile = { x: anchor.x + offset.x, y: anchor.y + offset.y }
      if (tile.x < range.firstX || tile.x > range.lastX) continue
      if (tile.y < range.firstY || tile.y > range.lastY) continue
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
function drawEffects(
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
    tracks.push({ schedule: removalSchedule(removal, footprint, state.debug, reducedMotion), elapsedMs: removal.elapsedMs })
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
        if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) continue
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
 * The armed structure's footprint under the cursor, and whether it would be refused there. Shape
 * carries the answer, not colour: a legal preview is the structure's own glyphs, an illegal one is a
 * block of `x`. Both read identically in monochrome, which is the point.
 *
 * The illegal block is grey, not red (owner, 2026-09-26: "the red color seems a bit too intense, we
 * should try grey instead"). Red is kept for the moment a placement is actually *attempted* and
 * refused — the status line's job, not the ghost's — so looking and trying read differently.
 *
 * One exception (feedback F30): when arming found no spot within reach (`BuildState.armGhost`), the
 * building is drawn as itself — in the same grey, since it would still be refused — rather than as a
 * block of `x`, until the player moves or tries to place.
 */
function drawPreview(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null): void {
  const { state, layout } = input
  if (preview === null) return
  const legal = preview.refusal === null
  const shape = legal || state.armGhost
  const range = visibleRange(state.camera, state.viewport)
  const shift = glideShift(input)

  for (const offset of preview.footprint) {
    const tile = { x: preview.anchor.x + offset.x + shift.x, y: preview.anchor.y + offset.y + shift.y }
    if (tile.x < range.firstX || tile.x > range.lastX) continue
    if (tile.y < range.firstY || tile.y > range.lastY) continue
    const cell = cellForTile(layout, state.camera, tile)
    const glyph = shape
      ? entityGlyph(preview.item.contentId, "A", { x: offset.x, y: offset.y })
      : ILLEGAL_PREVIEW_GLYPH
    put(cells, BANDS.highlights, cell.x, cell.y, glyph, legal ? "chrome.hotkey" : "chrome.muted")
  }
}

/** How far the drawn cursor still is from the state's own, mid-glide: what the preview and the
 *  refused flash are shifted by so they travel with it. */
function glideShift(input: BuildCompositionInput): Coord {
  const drawn = input.cursor
  if (drawn === undefined) return { x: 0, y: 0 }
  return { x: drawn.x - input.state.cursor.x, y: drawn.y - input.state.cursor.y }
}

/** Whether a structure — standing or still only planned — covers this tile. */
function structureAt(context: BuildContext, planned: readonly PlannedPlacement[], tile: Coord): boolean {
  const covers = (contentId: string, anchor: Coord): boolean =>
    tilesOf(anchor, context.registry.get(contentId).footprint).some((t) => t.x === tile.x && t.y === tile.y)
  return (
    context.standing.some((s) => covers(s.contentId, s.anchor)) ||
    planned.some((p) => covers(p.contentId, p.anchor))
  )
}

/** One cursor, drawn as a style-only write so it keeps whatever glyph is beneath it — the mechanism
 *  `src/view/frame.ts` already provides, and the only honest way to mark a tile without deleting
 *  what is standing on it. Inverse video carries "here" at every capability tier.
 *
 * Bare ground gets a contrast boost on top of that: it is drawn dim, and inverting a dim cell is
 * still a dim one, so `bold` and an explicit `dim: false` are added — `composeBands` merges a
 * style-only write onto whatever is beneath rather than replacing it, so without clearing it the
 * ground's own `dim: true` would survive underneath and fight the cursor's `bold` for intensity. A
 * structure does not get this: its own dim means something else — "this one is still only planned"
 * — and the cursor must not blur that distinction away.
 *
 * When the focus arrow lands the cursor **blinks** (feedback F54: "the same exact effect as the one we
 * use when selecting menu items"): in its "on" phases it is drawn in a menu row's pressed look — the
 * hotkey's colour, inverse, bold, underlined — and between them as usual. The live loop times it
 * (`cursorBlink`); every still frame draws the plain cursor.
 */
function drawCursor(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  // The cursor is the Grid's own focus mark: drawn only while the Grid has the keyboard, so the
  // screen never shows two "you are here"s at once (owner, 2026-09-27).
  // A committed plan hides the cursor, except while a Pulse is on screen: there it is how the player looks
  // around the map, the arrows moving it and the view following (gate 6A).
  if (state.focus !== "grid" || state.overlay !== null || (state.committed && input.pulse === undefined)) return
  const range = visibleRange(state.camera, state.viewport)
  // Where the cursor is drawn: mid-glide, a tile on its way (and what stands there decides its style).
  const cursor = input.cursor ?? state.cursor
  if (cursor.x < range.firstX || cursor.x > range.lastX) return
  if (cursor.y < range.firstY || cursor.y > range.lastY) return
  const cell = cellForTile(layout, state.camera, cursor)
  const onStructure = structureAt(context, state.planned, cursor)
  // `chrome.title` rather than the ground's own role: bold survives monochrome but changes nothing
  // about which colour a terminal picks for it, so a coloured screen still needs an explicit,
  // reliably bright role to get the same lift monochrome gets from the attribute alone. The same
  // role and weight the armed construct row already uses, so "here" and "active" read as one idea.
  const style =
    input.cursorBlink === true
      ? { inverse: true, bold: true, underline: true, dim: false, fgRole: "chrome.hotkey" as const }
      : onStructure
        ? { inverse: true }
        : { inverse: true, bold: true, dim: false, fgRole: "chrome.title" as const }
  for (let extra = 0; extra < layout.tileWidth; extra += 1) {
    cells.push({ band: BANDS.highlights, x: cell.x + extra, y: cell.y, style })
  }
}

/**
 * A placement was just tried and refused: the whole footprint under the cursor flashes solid in the
 * status line's own "danger" colour for a moment (gate 5H), so the eye that was on the map learns it
 * did not build without reading the bottom bar. A style-only write, like the cursor, so the `x` block
 * and whatever it covers keep their glyphs; inverse video carries it in monochrome.
 */
function drawRefusedFlash(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null): void {
  const { state, layout } = input
  if (input.refusedFlash !== true || state.focus !== "grid" || state.overlay !== null) return
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
    if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) continue
    const cell = cellForTile(layout, state.camera, tile)
    for (let extra = 0; extra < layout.tileWidth; extra += 1) {
      cells.push({ band: BANDS.highlights, x: cell.x + extra, y: cell.y, style })
    }
  }
}

/**
 * The top bar — the game's title, where the player is, and what Esc does — and the bottom bar's one
 * line (feedback F59): **the contextual line**, the last command's answer while it has one and
 * otherwise a hint for where the keyboard is (`bottomLine`, `src/build/help.ts`), or, while a Nexus
 * Pulse plays with no popup over it, what the Pulse is doing. It replaced a position readout, the key
 * help and the status line — three lines — and every key is on the Controls and hotkeys page instead.
 */
function drawHeaderAndFooter(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const left = layout.offset.column + 2
  const headerRow = layout.offset.row + 1

  // The top bar: the game's title and where the player is (engine.md 9.2), across the whole width.
  const limit = layout.headerLimit
  text(cells, band, left, headerRow, "TERMINAL NEXUS", "chrome.title", { bold: true, limit })
  const subtitle = input.pulse === undefined ? "build phase" : pulseSubtitle(input.pulse)
  text(cells, band, left + 15, headerRow, subtitle, "chrome.muted", { limit: limit - 15 })
  // What Esc does right now, right-aligned (feedback F37): "menu [esc]", "back [esc]", "close [esc]" —
  // the name quiet, the key in the hotkey colour after it, findable without competing with the game's
  // own title. The same text is the click target that sends Esc.
  const escText = escLabel(state)
  const hint = escHintSpan(layout, escText)
  const name = escText.slice(0, escText.length - ESC_KEY.length)
  text(cells, band, hint.from, hint.row, name, "chrome.muted")
  text(cells, band, hint.from + name.length, hint.row, ESC_KEY, "chrome.hotkey", { bold: true })

  // The contextual line. A popup over a Pulse holds the keyboard, so its answer or hint is what the
  // line says; otherwise the Pulse says what it is doing.
  const pulse = state.overlay !== null ? undefined : input.pulse
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

/** Right-aligned against the panel's own right edge — a column of costs reads as a column only if
 *  the numbers line up. */
function rightAlign(
  cells: BandCell[],
  layout: BuildLayout,
  row: number,
  value: string,
  role: StyleRole,
  extra: Readonly<{ dim?: boolean; bold?: boolean; inverse?: boolean; underline?: boolean }> = {},
): void {
  const column = layout.panelColumn + layout.panelLimit - value.length
  text(cells, BANDS.chrome, column, row, value, role, extra)
}

/** How a menu row's bar is drawn: `plain`; `selected` — the inverse bar, where the keyboard is;
 *  `pressed` — a brief, stronger bar the moment a row is activated; `refused` — a brief flicker when a
 *  key reached the row but had nothing to do. A row that costs more than is left is `disabled` (dim)
 *  in any of them, and a row whose action is under way is drawn *active* (`menuRowActive`). */
type RowState = "plain" | "selected" | "pressed" | "refused"

/** One menu row, as it is drawn: what `drawMenuRow` needs, and all it needs. */
type MenuRowSpec = Readonly<{
  hotkey: string
  label: string
  /** Drawn straight after the label in the hotkey's colour — the pending count on "Nexus". */
  badge?: string
  /** Right-aligned against the divider: a cost, or how many powers are active. */
  value?: string
  active: boolean
  state: RowState
  disabled?: boolean
}>

/** What an active row shows in place of its own hotkey: the key that ends what it started — `x`,
 *  Esc's other key (owner, 2026-09-30, feedback F53: "the hotkey updated to 'x' (which is the
 *  alternative to esc)"). */
export const ACTIVE_HOTKEY = "x"

/** What an active row shows at its right end in place of its value: an arrow pointing at the map,
 *  where the row's action is under way (F53) — and where the focus arrow leaves from (F54). */
export const ACTIVE_VALUE = ">>"

/**
 * Whether menu entry `entry`'s action is under way right now — **the one test for the "active" style**
 * every menu row shares (owner, 2026-09-29, feedback F32): a building while it is armed, `[e] Explore
 * Map` while Explore Map is open, `[n] Nexus` while its popup is, `[s] Start Pulse` while its
 * confirmation is. A menu row has two states and no more: *highlighted* by the keyboard (the bar, only
 * while the menu has the keyboard) and *active*.
 */
export function menuRowActive(context: BuildContext, state: BuildState, entry: number): boolean {
  if (state.committed) return false
  if (entry === NEXUS_ENTRY) return state.overlay === "nexus-powers"
  if (entry === EXPLORE_ENTRY) return exploring(state)
  if (entry === startEntry(context.catalog.length)) return state.overlay === "confirm-commit"
  return state.armed !== null && entryOfConstruct(state.armed) === entry
}

/**
 * One entry of the side panel's menu. `[x] Barracks  >>` says *active* — its action under way — and
 * the bar says *where the keyboard is, not yet chosen* (owner, 2026-09-27, 2026-09-28, 2026-09-29 and
 * 2026-09-30). Every row is drawn here, the menu's and a card's header alike, so a change to either
 * style reaches every row that has it.
 */
function drawMenuRow(cells: BandCell[], layout: BuildLayout, row: number, entry: MenuRowSpec): void {
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const bar = entry.state !== "plain"
  const inverse = entry.state === "selected" || entry.state === "pressed"
  // Pressed: the bar in the hotkey's colour, bold and underlined — stronger than "selected" at every
  // tier, monochrome included. Refused: the bar dimmed for a moment, a flicker against the bar the
  // row goes back to.
  const barRole: StyleRole = entry.state === "pressed" ? "chrome.hotkey" : "chrome.title"
  const extra = {
    inverse,
    bold: entry.state === "pressed" || entry.active,
    underline: entry.state === "pressed",
    dim: entry.state === "refused" || (entry.disabled === true && !inverse),
  }
  if (bar) text(cells, band, column, row, " ".repeat(limit), barRole, { ...extra, limit })
  // Active is not the keyboard's bar (feedback F22, F32): the bar says "the keyboard is here, not
  // chosen yet", and an active row is chosen. It reads `[x] Barracks  >>` (feedback F53): its hotkey
  // is the key that ends it, `>>` at its right end points at the map where it is under way, and the
  // whole row is in the hotkey's colour, bold, its name underlined — legible in monochrome by the
  // `[x]`, the `>>` and the underline alone. A flash on it still wins, drawn as the bar.
  const activeRole: StyleRole = "chrome.hotkey"
  let at = column
  const hotkey = `[${entry.active ? ACTIVE_HOTKEY : entry.hotkey}]`
  // Inside the bar every part takes the bar's own role, so it reads as one bar rather than a teal
  // block, a white block and a grey one side by side.
  text(cells, band, at, row, hotkey, bar ? barRole : "chrome.hotkey", { ...extra, bold: true, limit: column + limit - at })
  at += hotkey.length + 1
  text(cells, band, at, row, entry.label, bar ? barRole : entry.active ? activeRole : "chrome.value", {
    ...extra,
    ...(entry.active ? { underline: true } : {}),
    limit: column + limit - at,
  })
  at += entry.label.length
  if (entry.badge !== undefined) {
    text(cells, band, at, row, entry.badge, bar ? barRole : "chrome.hotkey", { ...extra, bold: true, limit: column + limit - at })
  }
  const value = entry.active ? ACTIVE_VALUE : entry.value
  if (value !== undefined) {
    // In the bar the cost keeps only its dimness, the one fact it adds there: this row no longer fits.
    rightAlign(cells, layout, row, value, bar ? barRole : entry.active ? activeRole : "chrome.value", {
      ...extra,
      ...(entry.active ? { bold: true } : {}),
      dim: entry.state === "refused" || (!entry.active && entry.disabled === true),
    })
  }
}

/**
 * How the bar on the row for menu entry `entry` is drawn right now. **The bar means one thing: the
 * keyboard is on this row and has not chosen it yet** (feedback F22). So it is drawn only while the
 * menu has focus, and not after the mouse worked the menu (`highlightHidden` — a click chooses, it
 * does not highlight); an active row is drawn as active (`menuRowActive`), never with the bar — the
 * Nexus row behind its own popup included (F32).
 */
function rowState(input: BuildCompositionInput, entry: number): RowState {
  const { state, flash } = input
  if (flash !== undefined && flash.entry === entry) return flash.kind
  if (menuRowActive(input.context, state, entry)) return "plain"
  // The Battle Round confirmation belongs to the menu, which stays lit behind it; the game menu,
  // Settings, the export, the Controls page and a message belong to none, so while one has the
  // keyboard its own highlight (or none) is the only one on screen.
  if (
    state.overlay === "menu" ||
    state.overlay === "settings" ||
    state.overlay === "export" ||
    state.overlay === "controls" ||
    state.overlay === "message"
  ) {
    return "plain"
  }
  if (state.focus !== "menu" || state.highlightHidden) return "plain"
  return state.menuHighlight === entry ? "selected" : "plain"
}

/**
 * Menu entry `entry` as a row: its hotkey, its label, what it shows at its right end, and how it is
 * drawn right now — the one description of every row, read by the menu and by a card's header alike,
 * so a row is the same wherever it shows. `null` for an entry the menu does not have.
 */
function menuRowSpec(input: BuildCompositionInput, entry: number): MenuRowSpec | null {
  const { context, state } = input
  const target = menuEntries(context)[entry]
  if (target === undefined) return null
  const look = { active: menuRowActive(context, state, entry), state: rowState(input, entry) }
  switch (target.kind) {
    case "explore":
      return { hotkey: "e", label: "Explore Map", ...look }
    case "nexus": {
      // Its "(1)" is the number of picks waiting — the one thing that will stop the commit — drawn in
      // the hotkey's colour so it catches the eye without a popup forcing it.
      const pending = pendingPicks(context, state)
      const active = nexusPowers(context, state).active.length
      return {
        hotkey: "n",
        label: "Nexus",
        ...(pending > 0 ? { badge: ` (${pending})` } : {}),
        ...(active > 0 ? { value: `${active} active` } : {}),
        ...look,
      }
    }
    case "start":
      // Dim while a Nexus power still waits to be picked, because pressing it would only be refused —
      // it still answers, with the reason.
      return { hotkey: START_KEY, label: START_LABEL, ...look, disabled: pendingPicks(context, state) > 0 }
    case "construct": {
      const item = context.catalog[target.index]
      if (item === undefined) return null
      return {
        hotkey: item.hotkey,
        label: item.label,
        value: String(item.cost),
        ...look,
        disabled: item.cost > remaining(context, state),
      }
    }
  }
}

/**
 * What there is to spend, `$ 100`, on the panel's top line against its right edge — the column the
 * costs are in (owner, 2026-09-30, feedback F57: "Having the credits aligned on the right looks good,
 * because that is the cost of buildings"). No label and no maximum ("we can show that on demand when
 * the player tries to add more resources but there's a limit"), and on every Build Phase panel — the
 * menu and both cards — so it is always in view.
 */
function drawResources(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  rightAlign(cells, layout, layout.panelRow + RESOURCE_ROW, `$ ${remaining(context, state)}`, "chrome.title", { bold: true })
}

/**
 * The side panel as the menu (owner, 2026-09-30, feedback F56-F58): what is left to spend on its top
 * line, `[e] Explore Map`, a blank line, `[n] Nexus`, a blank line, the buildings one to a row in
 * catalog order, and `[s] Start Pulse` on its last line. No headings, no help text: what a row does
 * is the bottom line's to say, why a placement is refused the status line's, and there is no radius
 * preview, because nothing placed here has a radius. A row the panel is too short for is not drawn
 * (`menuEntryRow` says so, and the mouse reads the same answer).
 */
function drawPanel(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, layout } = input
  drawResources(cells, input)
  menuEntries(context).forEach((target, entry) => {
    const row = menuEntryRow(layout, context.catalog, target)
    const spec = menuRowSpec(input, entry)
    if (row === null || spec === null) return
    drawMenuRow(cells, layout, row, spec)
  })
}

/** A plain name for what is under the cursor — the catalog's own label where there is one. */
function displayName(context: BuildContext, contentId: string): string {
  const item = context.catalog.find((row) => row.contentId === contentId)
  if (item !== undefined) return item.label
  const definition = context.registry.get(contentId)
  if (definition.nexus === true) {
    // Each Nexus is named for its faction (AGENTS.md): "structure.citizen.nexus" is the Citizen Nexus.
    const faction = contentId.split(".")[1] ?? ""
    return `${faction.charAt(0).toUpperCase()}${faction.slice(1)} Nexus`
  }
  return definition.short.charAt(0).toUpperCase() + definition.short.slice(1)
}

/**
 * A **card** in place of the menu (owner, 2026-09-27 to 2026-09-30, feedback F23, F32, F58): what there
 * is to spend on the top line; the row that opened it as its header, drawn active where Explore Map's
 * row is — `[x] Explore Map  >>`, or `[x] Barracks  >>` while a building is being placed, its pressed
 * flash playing there; a separator across the panel (`-` in ASCII, `─` in Unicode); and under it the
 * card itself — in Explore Map whatever is under the cursor, following it as it moves; while placing,
 * the building about to be placed ("This will create visual consistency for anything that gains focus
 * on the map"). Start Pulse belongs to the menu and is hidden with it. A click anywhere on the panel
 * goes back, as Esc does.
 */
function drawCardPanel(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const { context, state, layout } = input
  const column = layout.panelColumn
  const limit = layout.panelLimit
  drawResources(cells, input)
  const header = menuRowSpec(input, state.armed === null ? EXPLORE_ENTRY : entryOfConstruct(state.armed))
  if (header !== null) drawMenuRow(cells, layout, layout.panelRow + CARD_HEADER_ROW, header)
  text(cells, BANDS.chrome, column, layout.panelRow + CARD_SEPARATOR_ROW, chromeGlyph(pack, "horizontal").repeat(limit), "chrome.frame", { limit })
  const top = layout.panelRow + CARD_FIRST_ROW

  if (state.armed !== null) {
    const item = context.catalog[state.armed]
    if (item !== undefined) drawBuildingCard(cells, input, top, item.contentId, "to build")
    return
  }
  const structure = structureAtTile(context, state.planned, state.cursor)
  if (structure === null) drawGroundCard(cells, input, pack, top)
  else drawBuildingCard(cells, input, top, structure.contentId, structure.planned ? "planned" : "standing")
}

/** A bare tile's card: its own glyph, what it is, what it means, and where it is. */
function drawGroundCard(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack, top: number): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const terrainId = context.grid.tiles[state.cursor.y * context.grid.width + state.cursor.x] ?? "terrain.plain"
  const { glyph, role } = terrainGlyph(terrainId, pack)
  put(cells, band, column, top, glyph === " " ? "." : glyph, role, {})
  const terrain = TERRAIN_INFO[terrainId] ?? { name: "Ground", line: "" }
  text(cells, band, column + 3, top, terrain.name, "chrome.title", { bold: true, limit: limit - 3 })
  text(cells, band, column, top + 2, terrain.line, "chrome.value", { limit })
  text(cells, band, column, top + 4, "TILE", "chrome.label", { limit })
  rightAlign(cells, layout, top + 4, `${state.cursor.x},${state.cursor.y}`, "chrome.value")
}

/**
 * One building's card — the same for the building under the cursor in Explore Map and for the one being
 * placed (feedback F58): its own glyphs as its icon, its name with a word under it on where it stands
 * ("planned", "standing", "to build"), what it does, wrapped at words and never cut, then its numbers
 * as label/value rows — cost, health, size, attack — as many as the panel has room for. A first version
 * of the presentation card the owner described; the larger art and live stats during a Pulse come later.
 */
function drawBuildingCard(cells: BandCell[], input: BuildCompositionInput, top: number, contentId: string, subtitle: string): void {
  const { context, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  let row = top

  const definition = context.registry.get(contentId)
  const art = CONTENT_ART[contentId] ?? [definition.short.charAt(0)]
  const artWidth = Math.max(...art.map((line) => line.length))
  art.forEach((line, index) => {
    ;[...line].forEach((character, offset) => {
      const glyph = entityGlyph(contentId, "A", { x: offset, y: index })
      put(cells, band, column + offset, row + index, glyph === "?" ? character : glyph, playerRole("A"), { bold: true })
    })
  })
  const nameColumn = column + artWidth + 2
  text(cells, band, nameColumn, row, displayName(context, contentId), "chrome.title", {
    bold: true,
    limit: column + limit - nameColumn,
  })
  text(cells, band, nameColumn, row + 1, subtitle, "chrome.muted", { limit: column + limit - nameColumn })
  row += Math.max(art.length, 2) + 1

  const item = context.catalog.find((candidate) => candidate.contentId === contentId)
  const line = item?.effect ?? (definition.nexus === true ? "Your base. Lose it, lose the Pulse." : "")
  // Wrapped at word boundaries: the panel is 28 glyphs wide at the floor, and a description cut
  // mid-sentence was the first thing the screenshots of this panel showed (2026-09-27).
  for (const wrapped of wrapWords(line, limit)) {
    if (row > menuFloor(layout)) return
    text(cells, band, column, row, wrapped, "chrome.value", { limit })
    row += 1
  }
  if (line !== "") row += 1
  const size = footprintExtent(definition.footprint)
  const stats: [string, string][] = []
  if (item !== undefined) stats.push(["COST", String(item.cost)])
  stats.push(["HEALTH", String(definition.maxHp)], ["SIZE", `${size.width}x${size.height}`])
  if (definition.attack !== undefined) {
    stats.push(["ATTACK", `${definition.attack.damage} at range ${definition.attack.range}`])
  }
  for (const [label, value] of stats) {
    if (row > menuFloor(layout)) break
    text(cells, band, column, row, label, "chrome.label", { limit })
    rightAlign(cells, layout, row, value, "chrome.value")
    row += 1
  }
}

/** What a bare tile is, for the information panel. */
const TERRAIN_INFO: Readonly<Record<string, Readonly<{ name: string; line: string }>>> = {
  "terrain.plain": { name: "Open ground", line: "You can build here." },
  "terrain.rock": { name: "Rock", line: "Blocks building and movement." },
  "terrain.deposit": { name: "Deposit", line: "Resources lie here." },
}

/** How many cells of trail follow the focus arrow's head, and how many of them, nearest the head, are
 *  drawn at full strength; the older ones are dim. */
const ARROW_TRAIL = 4
const ARROW_TRAIL_BRIGHT = 2

/** tan(22.5 degrees): within this slope of an axis, a line reads as running along it. */
const AXIS_SLOPE = 0.4142

/** Fast at first, settling on the cursor: the focus arrow's own easing. */
function easeOutCubic(t: number): number {
  const rest = 1 - Math.min(1, Math.max(0, t))
  return 1 - rest * rest * rest
}

/**
 * The focus arrow's head and trail glyphs for a line running `dx` columns and `dy` rows. A terminal
 * cell is about twice as tall as it is wide, so a row counts as two columns when the slope is read:
 * within 22.5 degrees of level the head points left or right and the trail is level; within 22.5
 * degrees of upright it points up or down and the trail is upright; between them the trail is a
 * diagonal and the head points along whichever way the line runs further on screen.
 */
function arrowGlyphs(pack: GlyphPack, dx: number, dy: number): Readonly<{ head: string; trail: string }> {
  const across = dx
  const down = 2 * dy
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
 * The **focus arrow** (owner, 2026-09-30, feedback F54: "an animation that sends an arrow from the menu
 * item to the cursor ... fast and use interpolation"): a tween, drawn while the live loop says one is in
 * flight. It leaves from the cell just right of the card header's `>>` — the divider's cell on that row
 * — and flies in a straight line toward the cursor as it is drawn this frame (so it homes on a cursor
 * that moves meanwhile), eased to arrive fast and settle; its head points the way it flies and a short
 * trail follows it, the older cells dim. It stops one cell short of the cursor's tile, which stays whole
 * for the blink that follows.
 *
 * Drawn over the chrome, so it crosses the divider, and under every popup. On the map it keeps the
 * corruption law as every effect does: on a building's tile — standing, planned, or the ghost of the one
 * being placed — only the style changes, never the glyph. Never during a Pulse, and only while the map
 * has the keyboard and no popup is open.
 */
function drawFocusArrow(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack, preview: ArmedPreview | null): void {
  const { context, state, layout } = input
  const flight = input.focusArrow
  if (flight === undefined || input.pulse !== undefined || state.committed) return
  if (state.focus !== "grid" || state.overlay !== null) return
  const range = visibleRange(state.camera, state.viewport)
  const cursor = input.cursor ?? state.cursor
  if (cursor.x < range.firstX || cursor.x > range.lastX || cursor.y < range.firstY || cursor.y > range.lastY) return
  const target = cellForTile(layout, state.camera, cursor)
  const from = { x: layout.dividerColumn, y: layout.panelRow + CARD_HEADER_ROW }
  // Aimed at the middle of the cursor's tile: its one cell, or between its two when tiles are two wide.
  const dx = target.x + (layout.tileWidth - 1) / 2 - from.x
  const dy = target.y - from.y
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))))
  const path: Coord[] = []
  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(from.x + (dx * step) / steps)
    const y = Math.round(from.y + (dy * step) / steps)
    if (y === target.y && x >= target.x && x < target.x + layout.tileWidth) break
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

  const head = Math.min(path.length - 1, Math.floor(easeOutCubic(flight.progress) * path.length))
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
 * A popup — the Nexus powers, the start-the-Pulse question, the game menu, Settings, the export, a
 * message — drawn from its spec (`src/build/overlay.ts`), over everything on the Grid. A solid border
 * with the title in it, and a one-cell shadow that blanks what is behind it, so it cannot be missed
 * (owner, 2026-09-27: he clicked Nexus, did not notice the popup, and thought the mouse had stopped
 * working). No `[esc]` in the border since feedback F37: the top bar's "close [esc]" says it. Beside a
 * list that overflows, the right border is its scroll bar (F36).
 *
 * Drawn last in the chrome band: bands are fixed (engine.md 9.4, RULE), and within one band a later
 * write replaces an earlier one, so a popup needs no band of its own to sit on top.
 */
function drawOverlay(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const spec = overlaySpec(input.context, input.state)
  if (spec === null) return
  const placed = placeOverlay(input.layout, spec)
  const band = BANDS.chrome
  const { box, textColumn, textLimit } = placed

  // The shadow: one cell right and one below, a dim shade over whatever was there.
  const shade = chromeGlyph(pack, "shadow")
  for (let y = box.top + 1; y <= box.bottom + 1; y += 1) put(cells, band, box.right + 1, y, shade, "chrome.frame", { dim: true })
  for (let x = box.left + 1; x <= box.right + 1; x += 1) put(cells, band, x, box.bottom + 1, shade, "chrome.frame", { dim: true })

  for (let y = box.top; y <= box.bottom; y += 1) {
    for (let x = box.left; x <= box.right; x += 1) {
      const edge = y === box.top || y === box.bottom || x === box.left || x === box.right
      put(cells, band, x, y, " ", "chrome.frame", edge ? { inverse: true } : {})
    }
  }
  // The title sits in the top border, drawn in reverse so it reads as part of it.
  text(cells, band, box.left + 2, box.top, ` ${spec.title} `, "chrome.title", {
    bold: true,
    inverse: true,
    limit: box.right - box.left - 3,
  })
  // The scroll bar, in the right border beside the list: an up symbol, a textured track with a solid
  // thumb where the part in view sits, a down symbol — all inverse, so they read as the border itself.
  const bar = placed.scrollBar
  if (bar !== null) {
    for (let y = bar.top; y <= bar.bottom; y += 1) {
      const glyph =
        y === bar.top
          ? chromeGlyph(pack, "scrollUp")
          : y === bar.bottom
            ? chromeGlyph(pack, "scrollDown")
            : y >= bar.thumbTop && y <= bar.thumbBottom
              ? " "
              : chromeGlyph(pack, "scrollTrack")
      put(cells, band, bar.column, y, glyph, "chrome.frame", { inverse: true, bold: y === bar.top || y === bar.bottom })
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
        const on = entry.highlighted === true
        if (on) text(cells, band, textColumn, row, " ".repeat(textLimit), "chrome.title", { inverse: true, limit: textLimit })
        const role: StyleRole = on ? "chrome.title" : entry.muted === true || (entry.code === true && shown.startsWith("#")) ? "chrome.muted" : "chrome.value"
        text(cells, band, textColumn, row, shown, role, { bold: entry.strong === true, inverse: on, limit: textLimit })
        break
      }
      case "option": {
        if (secondLine) {
          // The line a player actually chooses by — quieter than the name, never dimmed out of reach.
          text(cells, band, textColumn + 4, row, entry.description ?? "", "chrome.muted", { limit: textLimit - 4 })
          break
        }
        const on = entry.highlighted === true
        if (on) text(cells, band, textColumn, row, " ".repeat(textLimit), "chrome.title", { inverse: true, limit: textLimit })
        const hotkey = `[${entry.hotkey}]`
        text(cells, band, textColumn, row, hotkey, on ? "chrome.title" : "chrome.hotkey", { bold: true, inverse: on, limit: textLimit })
        text(cells, band, textColumn + hotkey.length + 1, row, entry.label, on ? "chrome.title" : "chrome.value", {
          inverse: on,
          limit: textLimit - hotkey.length - 1,
        })
        break
      }
      case "setting": {
        // One line: the name, the value between `<` and `>` (the arrows say Left and Right change it,
        // and each half of the box is the click that does), against the row's right end.
        const on = entry.highlighted
        const columns = settingColumns(placed)
        const role: StyleRole = on ? "chrome.title" : "chrome.value"
        if (on) text(cells, band, textColumn, row, " ".repeat(textLimit), "chrome.title", { inverse: true, limit: textLimit })
        text(cells, band, textColumn, row, entry.label, role, { inverse: on, limit: columns.labelLimit })
        const inner = columns.valueTo - columns.valueFrom - 3
        const padding = Math.max(0, inner - entry.value.length)
        const value = `${" ".repeat(Math.ceil(padding / 2))}${entry.value}${" ".repeat(Math.floor(padding / 2))}`
        text(cells, band, columns.valueFrom, row, "<", on ? "chrome.title" : "chrome.hotkey", { bold: true, inverse: on })
        text(cells, band, columns.valueFrom + 2, row, value, role, { bold: true, inverse: on, limit: inner })
        text(cells, band, columns.valueTo, row, ">", on ? "chrome.title" : "chrome.hotkey", { bold: true, inverse: on })
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
        const on = entry.highlighted === true
        if (on) text(cells, band, textColumn, row, " ".repeat(textLimit), "chrome.title", { inverse: true, limit: textLimit })
        text(cells, band, textColumn, row, entry.keys, on ? "chrome.title" : "chrome.hotkey", {
          bold: true,
          inverse: on,
          limit: Math.min(textLimit, CONTROLS_KEYS_WIDTH - 1),
        })
        text(cells, band, textColumn + CONTROLS_KEYS_WIDTH, row, entry.text, on ? "chrome.title" : "chrome.value", {
          inverse: on,
          limit: textLimit - CONTROLS_KEYS_WIDTH,
        })
        break
      }
    }
  }
}

/** The Build Phase is done. Nothing here reaches a Nexus Pulse — Milestone 6 builds that. */
function drawCommittedPanel(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const picked = state.nexusPick === null ? null : context.nexusDraft[state.nexusPick]
  text(cells, band, column, layout.panelRow, "BUILD COMMITTED", "chrome.label", { limit })
  if (picked !== undefined && picked !== null) {
    text(cells, band, column, layout.panelRow + 2, `Nexus: ${picked.name}`, "chrome.value", { limit })
  }
  const count = state.planned.length
  text(cells, band, column, layout.panelRow + 3, `${count} structure${count === 1 ? "" : "s"} planned`, "chrome.value", {
    limit,
  })
  text(cells, band, column, layout.panelRow + 5, "[esc] menu", "chrome.muted", { limit })
}

export function composeBuildFrame(
  given: BuildCompositionInput,
  capability: CapabilityMode,
): ReadonlyCellFrame {
  // A sliding view is drawn through the camera it has reached, not the one it is heading for: the
  // Grid, the preview, the cursor and the edge weights all move together.
  const input: BuildCompositionInput =
    given.camera === undefined ? given : { ...given, state: { ...given.state, camera: given.camera } }
  const pack: GlyphPack = input.glyphPack ?? "ascii"
  const cells: BandCell[] = []

  // A Nexus Pulse on screen replaces what the Build Phase drew on the Grid and in the panel with the fight
  // and its forces; the frame, the top and bottom bars, the cursor and every popup are the same code.
  if (input.pulse !== undefined) {
    const view = { camera: input.state.camera, viewport: input.state.viewport, layout: input.layout, grid: input.context.grid }
    drawTerrain(cells, view, pack)
    drawPulseEffects(cells, view, input.pulse, drawPulseEntities(cells, view, input.pulse))
    drawCursor(cells, input)
    drawChrome(cells, input, pack)
    drawFrameLight(cells, input.layout, input.pulse)
    drawHeaderAndFooter(cells, input, null)
    const panel: BandCell[] = []
    drawPulsePanel(panel, input.layout, input.pulse, input.state.pulseNumber)
    for (const cell of panel) if (cell.y <= input.layout.panelBindingsRow) cells.push(cell)
    drawOverlay(cells, input, pack)
    return composeBands(input.layout.frame.width, input.layout.frame.height, cells)
  }

  // What Enter would do at the cursor, derived once and read by the ghost, the status line and the
  // panel alike — the reducer's `place()` acts on the very same derivation.
  const preview = armedPreview(input.context, input.state)
  const animating = animatingPlacements(input)
  drawGrid(cells, input, pack, animating)
  drawEffects(cells, input, animating, capability)
  drawPreview(cells, input, preview)
  drawCursor(cells, input)
  drawRefusedFlash(cells, input, preview)
  drawChrome(cells, input, pack)
  drawHeaderAndFooter(cells, input, preview)

  // The panel shows the menu, or a card — Explore Map's, or the armed building's — or the committed
  // summary. Clipped to the panel's own rows: on a terminal too short for the whole menu, a row that
  // does not fit is left off rather than drawn over the rule and the bottom bar.
  const panel: BandCell[] = []
  if (input.state.committed) drawCommittedPanel(panel, input)
  else if (cardShowing(input.state)) drawCardPanel(panel, input, pack)
  else drawPanel(panel, input)
  for (const cell of panel) if (cell.y <= input.layout.panelBindingsRow) cells.push(cell)
  // The focus arrow crosses from the panel into the map, so it is drawn over both — and under any popup.
  drawFocusArrow(cells, input, pack, preview)
  drawOverlay(cells, input, pack)

  return composeBands(input.layout.frame.width, input.layout.frame.height, cells)
}
