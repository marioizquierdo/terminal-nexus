// The Build Phase frame — engine.md 9.2's composition, on the same band compositor, style roles and
// glyph packs as the Pulse view and the menu, so monochrome and the colour tiers come free.
//
// The Grid pane is a **window onto a Grid larger than itself**: every tile is drawn at
// `tile - camera` and clipped to the viewport, and the two signals engine.md 3.3 requires in place
// of a minimap — the weight of the lines around the Grid pane, a position readout naming the visible
// range — come from the same camera the cursor moved.

import { footprintExtent, tilesOf } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import type { Camera } from "../build/camera.ts"
import { edgeMarkers, visibleRange } from "../build/camera.ts"
import { DEFAULT_SCROLL_MARGIN_PERCENT } from "../build/debug.ts"
import type { BuildLayout } from "../build/layout.ts"
import {
  ESC_KEY,
  EXPLORE_ROW,
  NEXUS_ROW,
  RESOURCE_ROW,
  cellForTile,
  START_KEY,
  START_LABEL,
  constructLines,
  escHintSpan,
  escLabel,
  menuFloor,
  startButton,
  summaryRows,
} from "../build/layout.ts"
import { overlaySpec, placeOverlay, settingColumns, wrapWords } from "../build/overlay.ts"
import type { ArmedPreview, BuildContext, BuildState } from "../build/state.ts"
import {
  EXPLORE_ENTRY,
  NEXUS_ENTRY,
  armedPreview,
  entryOfConstruct,
  exploring,
  menuEntries,
  nexusPowers,
  pendingPicks,
  refusalText,
  remaining,
  structureAtTile,
} from "../build/state.ts"
import type { ConstructGroup, ConstructItem, PlannedPlacement } from "../build/types.ts"
import { CONTENT_ART } from "../content/art.ts"
import type { BandCell, ReadonlyCellFrame } from "./frame.ts"
import { BANDS, composeBands } from "./frame.ts"
import type { DrawExtra } from "./draw.ts"
import { put, text } from "./draw.ts"
import { drawTerrain } from "./grid-layer.ts"
import type { PulseFrame } from "./pulse-scene.ts"
import { drawFrameLight, drawPulseEffects, drawPulseEntities, drawPulsePanel, pulseKeyHelp, pulseStatus, pulseSubtitle } from "./pulse-scene.ts"
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
import type { StatusMessage } from "../status.ts"
import { status } from "../status.ts"

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
  // whole width: at 80 columns the Grid pane is 48 columns, and the key help, the position readout
  // and the status line are all longer than that.
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
  const style = onStructure
    ? { inverse: true }
    : { inverse: true, bold: true, dim: false, fgRole: "chrome.title" as const }
  for (let extra = 0; extra < layout.tileWidth; extra += 1) {
    cells.push({ band: BANDS.highlights, x: cell.x + extra, y: cell.y, style })
  }
}

/**
 * The key help: where the keyboard is, and the keys that work there, most important first — one list
 * per mode, because focus makes arrows and Enter/Space mean different things and engine.md 9.7's
 * first convention asks the footer to say which. The label is drawn ahead of the list in the title's
 * weight, so it is the first thing read on the line.
 *
 * Trimmed to what a player would not otherwise guess: PageUp/PageDown, Home/End and Option+Arrow are
 * still bound, only unlisted (owner, 2026-09-26). `q` is not listed at all (owner, 2026-09-27): Esc on
 * the menu opens the game menu, which shows `[q] Quit` itself, and the top bar says `menu [esc]`.
 */
export type KeyHelp = Readonly<{ label: string; bindings: readonly string[] }>

export const MENU_KEY_HELP: KeyHelp = {
  label: "MENU",
  bindings: ["up/down choose", "enter/space select", "tab grid", "u undo", `${START_KEY} start`],
}

/** The Grid, with a building armed. */
export const PLACE_KEY_HELP: KeyHelp = {
  label: "PLACE",
  bindings: ["arrows move", "enter/space place", "esc cancel", "shift+arrow fast move", "bksp remove", "u undo"],
}

/** Explore Map: the Grid with nothing armed, the panel following the cursor (feedback F23). `e` and
 *  Esc go back to where it was opened from (F32). Tab still gives the keyboard to the menu, unlisted:
 *  its panel draws no overflow lines, and at 80 columns the footer holds these four and no more. */
export const EXPLORE_KEY_HELP: KeyHelp = {
  label: "EXPLORE MAP",
  bindings: ["arrows move", "e/esc back", "shift+arrow fast move", "bksp remove"],
}

/** Plain navigation: the map with nothing armed and the menu still drawn beside it — where Tab, a
 *  click on the map, and a placement begun on the map arrive (feedback F30). */
export const MAP_KEY_HELP: KeyHelp = {
  label: "MAP",
  bindings: ["arrows move", "enter/space explore", "tab/esc menu", "shift+arrow fast move", "bksp remove"],
}

const NEXUS_KEY_HELP: KeyHelp = { label: "NEXUS", bindings: ["up/down choose", "enter/space pick", "esc close"] }
const CONFIRM_KEY_HELP: KeyHelp = { label: "START PULSE?", bindings: ["enter/s/space start", "n/esc keep building"] }
const GAME_MENU_KEY_HELP: KeyHelp = { label: "MENU", bindings: ["s settings", "r restart", "q quit", "esc back to the game"] }
const COMMITTED_KEY_HELP: KeyHelp = { label: "COMMITTED", bindings: ["esc menu"] }
const SETTINGS_KEY_HELP: KeyHelp = {
  label: "SETTINGS",
  bindings: ["up/down choose", "left/right change", "e export", "esc close"],
}
const EXPORT_KEY_HELP: KeyHelp = { label: "EXPORT", bindings: ["up/down scroll", "esc back"] }

/** Which key help is live: whatever holds the keyboard right now. */
export function keyHelp(state: BuildState): KeyHelp {
  if (state.overlay === "menu") return GAME_MENU_KEY_HELP
  if (state.overlay === "settings") return SETTINGS_KEY_HELP
  if (state.overlay === "export") return EXPORT_KEY_HELP
  // A message is named by its own title: the one thing the keyboard can do there is close it.
  if (state.overlay === "message") return { label: state.message?.title ?? "MESSAGE", bindings: ["esc close"] }
  if (state.committed) return COMMITTED_KEY_HELP
  if (state.overlay === "confirm-commit") return CONFIRM_KEY_HELP
  if (state.overlay === "nexus-powers") return NEXUS_KEY_HELP
  if (state.focus === "menu") return MENU_KEY_HELP
  if (state.armed !== null) return PLACE_KEY_HELP
  return state.exploreMap ? EXPLORE_KEY_HELP : MAP_KEY_HELP
}

/** Two glyphs between bindings, so a pair of them cannot read as one. */
const BINDING_GAP = "  "

function packed(bindings: readonly string[], limit: number): { line: string; rest: string[] } {
  let line = ""
  for (let index = 0; index < bindings.length; index += 1) {
    const binding = bindings[index] as string
    const grown = line === "" ? binding : line + BINDING_GAP + binding
    if (grown.length > limit) return { line, rest: [...bindings.slice(index)] }
    line = grown
  }
  return { line, rest: [] }
}

/**
 * How the bindings divide between the footer's one row and the side panel's last few — the screen's
 * adaptation to its own width. The footer takes them in order while they fit; whatever is left over
 * packs into panel-width rows. **Only whole bindings, anywhere**: a key cut in half is a key nobody
 * can press.
 */
export function bindingLines(
  footerLimit: number,
  panelLimit: number,
  help: KeyHelp = PLACE_KEY_HELP,
): Readonly<{ footer: string; panel: readonly string[] }> {
  // The focus label takes the front of the footer's line, and a gap after it.
  const { line: footer, rest } = packed(help.bindings, footerLimit - help.label.length - BINDING_GAP.length)
  const panel: string[] = []
  let remainingBindings = rest
  while (remainingBindings.length > 0) {
    const { line, rest: next } = packed(remainingBindings, panelLimit)
    // A binding longer than the panel is wide would otherwise loop forever producing empty rows.
    if (line === "") break
    panel.push(line)
    remainingBindings = next
  }
  return { footer, panel }
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

function drawHeaderAndFooter(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const left = layout.offset.column + 2
  const headerRow = layout.offset.row + 1
  const range = visibleRange(state.camera, state.viewport)

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

  const footerLimit = layout.footerLimit
  // engine.md 3.3's second required signal: "a position readout in the footer naming the visible
  // tile range and the Grid size." The margin is named whenever it is not the owner's 25% — set by
  // `--scroll-margin` or by an Experiment.
  const margin = state.debug.scrollMargin
  text(
    cells,
    band,
    left,
    layout.footerRow,
    `view x ${range.firstX}-${range.lastX} y ${range.firstY}-${range.lastY} ` +
      `of ${context.grid.width}x${context.grid.height}   cursor ${state.cursor.x},${state.cursor.y}` +
      (margin === DEFAULT_SCROLL_MARGIN_PERCENT ? "" : `   margin ${margin}%`),
    "chrome.label",
    { limit: footerLimit },
  )
  // The screen documents itself (engine.md 9.7), starting with where the keyboard is. A popup over a
  // Pulse is what holds the keyboard, and says so; otherwise the Pulse does.
  const pulse = state.overlay !== null ? undefined : input.pulse
  const help = pulse === undefined ? keyHelp(state) : pulseKeyHelp(pulse)
  text(cells, band, left, layout.footerRow + 1, help.label, "chrome.title", { bold: true, limit: footerLimit })
  const helpColumn = left + help.label.length + BINDING_GAP.length
  text(
    cells,
    band,
    helpColumn,
    layout.footerRow + 1,
    bindingLines(footerLimit, layout.panelLimit, help).footer,
    "chrome.muted",
    { limit: footerLimit - (helpColumn - left) },
  )
  const shown = pulse === undefined ? statusLine(state, preview) : pulseStatus(pulse)
  const style = statusStyle(shown.tone)
  text(cells, band, left, layout.footerRow + 2, shown.text, style.role, {
    ...(style.bold === undefined ? {} : { bold: style.bold }),
    limit: footerLimit,
  })
}

/**
 * The status line — the footer's last row, and the one place the Build Phase answers "what just
 * happened, or why not". It shows the reducer's own `state.status`, with one exception: while the
 * armed ghost sits on a tile Enter would refuse, the refusal is what it says, naming the tile —
 * quietly while the player is only looking, and in the reducer's own red once they actually try.
 */
function statusLine(state: BuildState, preview: ArmedPreview | null): StatusMessage {
  // While arming's ghost shows, the status line says why the cursor moved, not why Enter would fail.
  if (preview === null || preview.refusal === null || state.armGhost) return state.status
  const tile = state.status.tile
  const attempted = tile !== undefined && tile.x === state.cursor.x && tile.y === state.cursor.y
  return attempted ? state.status : status(refusalText(preview.refusal))
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

const GROUP_LABELS: Readonly<Record<ConstructGroup, string>> = {
  common: "COMMON",
  army: "ARMY",
}

/**
 * The bindings the footer had no room for, pinned to the bottom of the panel and growing upward.
 * **Beside the Start button** — in the room left of it, on its own three rows — when every one of them
 * fits there whole, which is how the floor's two or three short ones (`bksp remove`, `u undo`) share
 * the panel's bottom with a button three rows tall; otherwise stacked above the button at the panel's
 * width. Bounded by the menu, which wins: a hidden menu row is still a live click target, so the
 * lowest-priority lines are dropped instead.
 */
type PanelBindings = Readonly<{ lines: readonly string[]; beside: boolean; limit: number }>

function panelBindings(layout: BuildLayout, catalog: readonly ConstructItem[], help: KeyHelp): PanelBindings {
  const floor = summaryRows(layout, catalog).special + 2
  const wide = bindingLines(layout.footerLimit, layout.panelLimit, help).panel
  const room = startButton(layout).left - layout.panelColumn - 1
  const narrow = bindingLines(layout.footerLimit, room, help).panel
  const count = (lines: readonly string[]): number => lines.flatMap((line) => line.split(BINDING_GAP)).length
  const fitsBeside =
    narrow.length > 0 &&
    count(narrow) === count(wide) &&
    layout.panelBindingsRow - narrow.length + 1 >= floor
  if (fitsBeside) return { lines: narrow, beside: true, limit: room }
  const lines = wide.slice(0, Math.max(0, Math.min(wide.length, menuFloor(layout) - floor + 1)))
  return { lines, beside: false, limit: layout.panelLimit }
}

function drawPanelBindings(cells: BandCell[], input: BuildCompositionInput): void {
  const { layout } = input
  const { lines, beside, limit } = panelBindings(layout, input.context.catalog, keyHelp(input.state))
  const last = beside ? layout.panelBindingsRow : menuFloor(layout)
  lines.forEach((line, index) => {
    text(cells, BANDS.chrome, layout.panelColumn, last - (lines.length - 1 - index), line, "chrome.muted", { limit })
  })
}

/** How a menu row's bar is drawn: `plain`; `selected` — the inverse bar, where the keyboard is;
 *  `pressed` — a brief, stronger bar the moment a row is activated; `refused` — a brief flicker when a
 *  key reached the row but had nothing to do. A row that costs more than is left is `disabled` (dim)
 *  in any of them, and a row whose action is under way is drawn *active* (`menuRowActive`). */
type RowState = "plain" | "selected" | "pressed" | "refused"

/**
 * Whether menu entry `entry`'s action is under way right now — **the one test for the "active" style**
 * every menu row shares (owner, 2026-09-29, feedback F32): a building while it is armed, `[e] Explore
 * Map` while Explore Map is open, `[n] Nexus` while its popup is. A menu row has two states and no
 * more: *highlighted* by the keyboard (the bar, only while the menu has the keyboard) and *active*.
 */
export function menuRowActive(state: BuildState, entry: number): boolean {
  if (state.committed) return false
  if (entry === NEXUS_ENTRY) return state.overlay === "nexus-powers"
  if (entry === EXPLORE_ENTRY) return exploring(state)
  return state.armed !== null && entryOfConstruct(state.armed) === entry
}

/**
 * One entry of the side panel's menu. `>` before the row says *active* — its action under way — and
 * the bar says *where the keyboard is, not yet chosen* (owner, 2026-09-27, 2026-09-28 and 2026-09-29).
 * Every row is drawn here, so a change to either style reaches every row that has it.
 */
function drawMenuRow(
  cells: BandCell[],
  layout: BuildLayout,
  row: number,
  entry: Readonly<{
    hotkey: string
    label: string
    /** Drawn straight after the label in the hotkey's colour — the pending count on "Nexus". */
    badge?: string
    /** Right-aligned against the divider: a cost, or how many powers are active. */
    value?: string
    active: boolean
    state: RowState
    disabled?: boolean
  }>,
): void {
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
  // chosen yet", and an active row is chosen. It is `>`, and the whole row in the hotkey's colour,
  // bold, its name underlined — legible in monochrome by the marker and the underline alone.
  const activeRole: StyleRole = "chrome.hotkey"
  let at = column
  if (entry.active) {
    text(cells, band, at, row, ">", bar ? barRole : activeRole, { ...extra, bold: true, limit })
    at += 2
  }
  const hotkey = `[${entry.hotkey}]`
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
  if (entry.value !== undefined) {
    // In the bar the cost keeps only its dimness, the one fact it adds there: this row no longer fits.
    rightAlign(cells, layout, row, entry.value, bar ? barRole : entry.active ? activeRole : "chrome.value", {
      ...extra,
      dim: entry.disabled === true || entry.state === "refused",
    })
  }
}

/**
 * The one line under the menu that says what a row is for — the highlighted row's while the menu has
 * focus (so a player reads what they are choosing before they choose it), the armed structure's while
 * placing. `null` when there is nothing to say.
 */
function effectLine(context: BuildContext, state: BuildState, preview: ArmedPreview | null): string | null {
  if (state.focus === "menu") {
    // No bar, no line: it describes the row the keyboard is on, and after a click nothing is.
    if (state.highlightHidden) return null
    const entry = menuEntries(context)[state.menuHighlight]
    if (entry === undefined) return null
    if (entry.kind === "nexus") {
      return pendingPicks(context, state) > 0 ? "Pick one before the Pulse" : "Read the active powers"
    }
    if (entry.kind === "explore") return "See what is on every tile"
    return context.catalog[entry.index]?.effect ?? null
  }
  return preview?.item.effect ?? null
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
  if (menuRowActive(state, entry)) return "plain"
  // The start-the-Pulse question belongs to the menu, which stays lit behind it; the game menu,
  // Settings, the export and a message belong to none, so while one has the keyboard its own
  // highlight (or none) is the only one on screen.
  if (state.overlay === "menu" || state.overlay === "settings" || state.overlay === "export" || state.overlay === "message") {
    return "plain"
  }
  if (state.focus !== "menu" || state.highlightHidden) return "plain"
  return state.menuHighlight === entry ? "selected" : "plain"
}

/** The Explore Map row — the menu's first — as it is drawn on the menu and at the top of Explore Map
 *  alike, so the one row is the same wherever it shows. */
function drawExploreRow(cells: BandCell[], input: BuildCompositionInput): void {
  drawMenuRow(cells, input.layout, input.layout.panelRow + EXPLORE_ROW, {
    hotkey: "e",
    label: "Explore Map",
    active: menuRowActive(input.state, EXPLORE_ENTRY),
    state: rowState(input, EXPLORE_ENTRY),
  })
}

/**
 * The side panel — engine.md 9.2's Build Phase list: the Nexus and Explore entries at the top, what
 * is left to spend, the construct menu, the Special slot, and one line saying what the row in
 * question does. Why a placement is refused is the status line's to say, and there is no radius
 * preview, because nothing placed here has a radius.
 */
function drawPanel(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const left = remaining(context, state)

  // Explore Map, first (owner, 2026-09-28, feedback F23).
  drawExploreRow(cells, input)
  // Nexus. Its "(1)" is the number of picks waiting — the one thing that will stop the commit —
  // drawn in the hotkey's colour so it catches the eye without a popup forcing it.
  const pending = pendingPicks(context, state)
  const active = nexusPowers(context, state).active.length
  drawMenuRow(cells, layout, layout.panelRow + NEXUS_ROW, {
    hotkey: "n",
    label: "Nexus",
    ...(pending > 0 ? { badge: ` (${pending})` } : {}),
    ...(active > 0 ? { value: `${active} active` } : {}),
    active: menuRowActive(state, NEXUS_ENTRY),
    state: rowState(input, NEXUS_ENTRY),
  })

  // What there is to spend, directly above the costs it is measured against.
  text(cells, band, column, layout.panelRow + RESOURCE_ROW, "RESOURCE", "chrome.label", { limit })
  rightAlign(
    cells,
    layout,
    layout.panelRow + RESOURCE_ROW,
    `${left} of ${context.allotment + state.bonusAllotment}`,
    "chrome.title",
    { bold: true },
  )

  for (const line of constructLines(layout, context.catalog)) {
    if (line.kind === "group") {
      text(cells, band, column, line.row, GROUP_LABELS[line.group], "chrome.label", { limit })
      continue
    }
    if (line.kind === "empty") {
      text(cells, band, column, line.row, GROUP_LABELS[line.group], "chrome.label", { limit })
      rightAlign(cells, layout, line.row, "none available", "chrome.muted", { dim: true })
      continue
    }
    const item = context.catalog[line.index]
    if (item === undefined) continue
    const entry = entryOfConstruct(line.index)
    drawMenuRow(cells, layout, line.row, {
      hotkey: item.hotkey,
      label: item.label,
      value: String(item.cost),
      active: menuRowActive(state, entry),
      state: rowState(input, entry),
      disabled: item.cost > left,
    })
  }

  // The Special slot: PERIMETER has none to arm — honest about the empty slot rather than hiding it.
  const { special: specialRow } = summaryRows(layout, context.catalog)
  text(cells, band, column, specialRow, "SPECIAL", "chrome.label", { limit })
  rightAlign(cells, layout, specialRow, "none available", "chrome.muted", { dim: true })

  const effect = effectLine(context, state, preview)
  if (effect === null) return
  const row = specialRow + 2
  // One row of clearance above the bindings block, so the two never touch (the Start button's own
  // border is clearance enough when there are none); dropped rather than drawn over the bindings when a
  // short panel has no room.
  const bindings = panelBindings(layout, context.catalog, keyHelp(state))
  const bindingRows = bindings.beside ? 0 : bindings.lines.length
  if (row > menuFloor(layout) - (bindingRows === 0 ? 0 : bindingRows + 1)) return
  text(cells, band, column, row, effect, "chrome.value", { limit })
}

/**
 * The `[s] Start` button (owner, 2026-09-29, feedback F41) — the strategy game's "end turn": a box at
 * the bottom right of the panel with the hotkey in its own colour. Drawn on the menu and on Explore
 * Map's panel alike, and dim while a Nexus power still waits to be picked, because pressing it would
 * only be refused (a click on it still answers, with the reason).
 */
function drawStartButton(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const { context, state, layout } = input
  const { top, bottom, left, width } = startButton(layout)
  const band = BANDS.chrome
  const ready = pendingPicks(context, state) === 0
  const role: StyleRole = ready ? "chrome.hotkey" : "chrome.muted"
  const extra: DrawExtra = ready ? { bold: true } : { dim: true }
  const glyph = (key: Parameters<typeof chromeGlyph>[1]): string => chromeGlyph(pack, key)
  const rule = glyph("horizontal").repeat(width - 2)
  text(cells, band, left, top, glyph("topLeft") + rule + glyph("topRight"), role, extra)
  text(cells, band, left, bottom, glyph("bottomLeft") + rule + glyph("bottomRight"), role, extra)
  text(cells, band, left, top + 1, glyph("vertical"), role, extra)
  text(cells, band, left + width - 1, top + 1, glyph("vertical"), role, extra)
  text(cells, band, left + 2, top + 1, START_LABEL, role, extra)
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

/** How far below the Explore Map row the card starts: the row itself, then the separator. */
const EXPLORE_CARD_ROW = EXPLORE_ROW + 2

/**
 * Explore Map (owner, 2026-09-27, 2026-09-28 and 2026-09-29): while it is open, the menu's first row
 * stays where it is, drawn active — `> [e] Explore Map`, its own header (feedback F32) — and under a
 * separator across the panel the rest of the menu gives way to what is under the cursor, following it
 * as it moves: its own glyphs as its icon, its name and one line of what it is for, and its numbers. A
 * click anywhere on the panel closes it, as Esc does. A first version of the
 * presentation card he described; the larger art and live stats during a Pulse come later.
 */
function drawInfoPanel(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  drawExploreRow(cells, input)
  text(cells, band, column, layout.panelRow + EXPLORE_ROW + 1, chromeGlyph(pack, "horizontal").repeat(limit), "chrome.frame", { limit })
  let row = layout.panelRow + EXPLORE_CARD_ROW

  const structure = structureAtTile(context, state.planned, state.cursor)
  if (structure === null) {
    const terrainId = context.grid.tiles[state.cursor.y * context.grid.width + state.cursor.x] ?? "terrain.plain"
    const { glyph, role } = terrainGlyph(terrainId, pack)
    put(cells, band, column, row, glyph === " " ? "." : glyph, role, {})
    const terrain = TERRAIN_INFO[terrainId] ?? { name: "Ground", line: "" }
    text(cells, band, column + 3, row, terrain.name, "chrome.title", { bold: true, limit: limit - 3 })
    text(cells, band, column, row + 2, terrain.line, "chrome.value", { limit })
    text(cells, band, column, row + 4, "TILE", "chrome.label", { limit })
    rightAlign(cells, layout, row + 4, `${state.cursor.x},${state.cursor.y}`, "chrome.value")
    return
  }

  const definition = context.registry.get(structure.contentId)
  const art = CONTENT_ART[structure.contentId] ?? [definition.short.charAt(0)]
  const artWidth = Math.max(...art.map((line) => line.length))
  art.forEach((line, index) => {
    ;[...line].forEach((character, offset) => {
      const glyph = entityGlyph(structure.contentId, "A", { x: offset, y: index })
      put(cells, band, column + offset, row + index, glyph === "?" ? character : glyph, playerRole("A"), { bold: true })
    })
  })
  const nameColumn = column + artWidth + 2
  text(cells, band, nameColumn, row, displayName(context, structure.contentId), "chrome.title", {
    bold: true,
    limit: column + limit - nameColumn,
  })
  text(cells, band, nameColumn, row + 1, structure.planned ? "planned" : "standing", "chrome.muted", {
    limit: column + limit - nameColumn,
  })
  row += Math.max(art.length, 2) + 1

  const item = context.catalog.find((candidate) => candidate.contentId === structure.contentId)
  const line = item?.effect ?? (definition.nexus === true ? "Your base. Lose it, lose the Pulse." : "")
  // Wrapped at word boundaries: the panel is 28 glyphs wide at the floor, and a description cut
  // mid-sentence was the first thing the screenshots of this panel showed (2026-09-27).
  for (const wrapped of wrapWords(line, limit)) {
    text(cells, band, column, row, wrapped, "chrome.value", { limit })
    row += 1
  }
  if (line !== "") row += 1
  const size = footprintExtent(definition.footprint)
  const stats: [string, string][] = [
    ["HEALTH", String(definition.maxHp)],
    ["SIZE", `${size.width}x${size.height}`],
  ]
  if (item !== undefined) stats.push(["COST", String(item.cost)])
  if (definition.attack !== undefined) {
    stats.push(["ATTACK", `${definition.attack.damage} at range ${definition.attack.range}`])
  }
  for (const [label, value] of stats) {
    if (row > menuFloor(layout)) break
    text(cells, band, column, row, label, "chrome.label", { limit })
    rightAlign(cells, layout, row, value, "chrome.value")
    row += 1
  }
  if (structure.planned && row + 1 <= menuFloor(layout)) {
    text(cells, band, column, row + 1, "[bksp] remove  [u] undo", "chrome.muted", { limit })
  }
}

/** What a bare tile is, for the information panel. */
const TERRAIN_INFO: Readonly<Record<string, Readonly<{ name: string; line: string }>>> = {
  "terrain.plain": { name: "Open ground", line: "You can build here." },
  "terrain.rock": { name: "Rock", line: "Blocks building and movement." },
  "terrain.deposit": { name: "Deposit", line: "Resources lie here." },
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
  // Grid, the preview, the cursor, the edge weights and the position readout all move together.
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

  // The panel shows the menu, or — exploring — what is under the cursor, or the committed summary.
  // Clipped to the panel's own rows: on a terminal too short for the whole menu, a row that does not
  // fit is left off rather than drawn over the rule and the bottom bar.
  const panel: BandCell[] = []
  if (input.state.committed) drawCommittedPanel(panel, input)
  else if (exploring(input.state)) drawInfoPanel(panel, input, pack)
  else {
    drawPanel(panel, input, preview)
    drawPanelBindings(panel, input)
  }
  if (!input.state.committed) drawStartButton(panel, input, pack)
  for (const cell of panel) if (cell.y <= input.layout.panelBindingsRow) cells.push(cell)
  drawOverlay(cells, input, pack)

  return composeBands(input.layout.frame.width, input.layout.frame.height, cells)
}
