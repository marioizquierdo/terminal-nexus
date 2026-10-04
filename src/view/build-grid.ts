// The Build Phase's Grid pane: what stands on the map and what is going up or coming down (placements
// and their effects), the ghost of the building being placed, the cursor, and a refused try's flash —
// all drawn through the camera and clipped to the view.

import { inBounds, tilesOf } from "../grid/coords.ts"
import type { PlayerId } from "../state/types.ts"
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
import { chromeGlyph, entityGlyph, playerRole } from "./theme.ts"
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
      // Drawn at full strength, planned or standing (Mario: "it will look better if
      // they are fully built"). A plan stays revisable — undo, remove — until the Pulse starts. While
      // a placement is still going up it is drawn as its track's frame at that instant; the
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

  // What else is on the map after a round: survivors of both sides where Recall left them, and a
  // scripted side's structures, each in its side's colour. Then what the next round brings, always (the
  // owner: "the enemy units should be visible"), in the incoming look — see-through, "not here yet".
  // A unit steps aside for a building when the Pulse starts — a survivor or an arrival alike — so neither
  // is drawn over one: a tile a building holds, standing, planned or the raid's, shows the building.
  const built = new Set<string>()
  const hold = (contentId: string, anchor: Coord): void => {
    for (const tile of tilesOf(anchor, context.registry.get(contentId).footprint)) built.add(`${tile.x},${tile.y}`)
  }
  for (const structure of context.standing) hold(structure.contentId, structure.anchor)
  for (const placement of state.planned) hold(placement.contentId, placement.anchor)
  for (const entity of context.field ?? []) {
    if (context.registry.get(entity.contentId).layer === "obstacles") hold(entity.contentId, entity.anchor)
  }
  const drawEntity = (entity: Readonly<{ contentId: string; anchor: Coord; player: PlayerId }>, incoming: boolean): void => {
    const definition = context.registry.get(entity.contentId)
    const band = definition.layer === "obstacles" ? BANDS.structures : definition.layer === "air" ? BANDS.air : BANDS.units
    for (const offset of definition.footprint) {
      const tile = { x: entity.anchor.x + offset.x, y: entity.anchor.y + offset.y }
      if (!inBounds(context.grid, tile) || !inView(range, tile)) continue
      if (definition.layer !== "obstacles" && built.has(`${tile.x},${tile.y}`)) continue
      const cell = cellForTile(layout, state.camera, tile)
      // A Commander is never faint: bold at full strength in her side's colour, arriving or standing (the
      // owner: "make sure vasse is visible, prominent").
      const commander = definition.commander === true
      const style: CellStyle = commander
        ? { fgRole: playerRole(entity.player), bold: true }
        : incoming
          ? incomingLook(entity.player)
          : { fgRole: playerRole(entity.player), ...(definition.layer === "obstacles" ? { bold: true } : {}) }
      cells.push({ band, x: cell.x, y: cell.y, cell: { glyph: entityGlyph(entity.contentId, entity.player, offset), style } })
      const blank: CellStyle = incoming && !commander ? incomingLook(entity.player) : { fgRole: playerRole(entity.player) }
      for (let extra = 1; extra < layout.tileWidth; extra += 1) cells.push({ band, x: cell.x + extra, y: cell.y, cell: { glyph: " ", style: blank } })
    }
  }
  for (const entity of context.field ?? []) drawEntity(entity, false)
  for (const entity of context.incoming ?? []) drawEntity(entity, true)
}

/**
 * ***The incoming raid***: what the next round brings, drawn where it will arrive in its side's colour and
 * see-through — "not here yet", yet read at a glance (the owner: "the enemy units should be visible").
 * It is the see-through style at a low alpha in its own colour: where colours blend (256 and up) a wash
 * lies under its glyphs, which stay near full strength; at 16 colours and in monochrome, where a wash
 * that light shows nothing, it is the style's plain look — the glyphs at full strength. It once was dim
 * and faded, and played as a player it was easy to miss; "not here yet" is said in words where colour
 * cannot: the panel's heading for when it comes, and Explore Map's card ("Incoming").
 */
function incomingLook(player: PlayerId): CellStyle {
  return { fgRole: playerRole(player), seeThrough: { role: playerRole(player), alpha: INCOMING_WASH } }
}

/** How strongly the incoming raid's own colour washes its cells, where colours blend. */
const INCOMING_WASH = 0.2

/**
 * ***The raid's intent***: for every group the round brings, a **trail** from the group toward what it
 * goes for first, and that **target** marked — so the player sees, without looking for it, which way each
 * group comes and what it will hit, and sees both move when a building changes the answer. In the Build
 * Phase only: a Pulse shows what happens, not what was foreseen.
 *
 * - The trail follows the way the group's front unit would walk (`RaidGroup.path`, the kernel's own step
 *   rule), a direction mark every other tile counted back from the last, each pointing at the next — the
 *   glyph pack's own arrowheads where the way runs straight, its diagonal strokes where it steps both ways.
 *   On open ground only: never over anything standing, planned or arriving (the corruption law), nor over
 *   rock or a deposit, which are information too. In the raid's colour and see-through: dim, and faded
 *   where colour allows, quieter than the raid itself.
 * - The target is a glyphless write over its tiles, so its own glyphs stay: a wash of the raid's colour
 *   where colours blend, and underlined at every depth — the form that carries it at 16 colours and in
 *   monochrome. Never red, which is kept for the player's own Nexus being hurt.
 */
export function drawRaidIntent(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const { context, state, layout, raid } = input
  if (raid === undefined || raid.length === 0 || state.committed || input.pulse !== undefined) return
  const range = visibleRange(state.camera, state.viewport)
  const taken = takenTiles(context, state.planned)
  for (const group of raid) {
    if (group.target === null) continue
    const style: CellStyle = { fgRole: playerRole(group.player), dim: true, fade: TRAIL_FADE }
    for (const mark of trailMarks(group.path, group.target.tiles)) {
      const { tile } = mark
      if (!inBounds(context.grid, tile) || !inView(range, tile) || taken.has(`${tile.x},${tile.y}`)) continue
      if (context.grid.tiles[tile.y * context.grid.width + tile.x] !== "terrain.plain") continue
      const cell = cellForTile(layout, state.camera, tile)
      cells.push({ band: BANDS.territory, x: cell.x, y: cell.y, cell: { glyph: trailGlyph(pack, mark.dx, mark.dy), style } })
      for (let extra = 1; extra < layout.tileWidth; extra += 1) cells.push({ band: BANDS.territory, x: cell.x + extra, y: cell.y, cell: { glyph: " ", style } })
    }
  }
  const marked = new Set<string>()
  for (const group of raid) {
    if (group.target === null) continue
    for (const tile of group.target.tiles) {
      const key = `${tile.x},${tile.y}`
      if (marked.has(key) || !inBounds(context.grid, tile) || !inView(range, tile)) continue
      marked.add(key)
      const cell = cellForTile(layout, state.camera, tile)
      const style: CellStyle = { underline: true, seeThrough: { role: playerRole(group.player), alpha: TARGET_WASH } }
      for (let extra = 0; extra < layout.tileWidth; extra += 1) cells.push({ band: BANDS.effects, x: cell.x + extra, y: cell.y, style })
    }
  }
}

/** How far toward the background a trail's marks are drawn, where colour allows: quieter than the raid. */
const TRAIL_FADE = 0.3

/** How strongly the raid's colour washes the tiles of what it goes for first, where colours blend. */
const TARGET_WASH = 0.25

/** One mark of a trail: its tile, and the way it points — toward the next mark, the last toward the target. */
type TrailMark = Readonly<{ tile: Coord; dx: number; dy: number }>

/**
 * Where a trail's marks go along `path`: every other tile, counted back from the last so the mark beside
 * the target is always drawn, each pointing at the mark after it — or, for the last, at the target's
 * nearest tile.
 */
export function trailMarks(path: readonly Coord[], target: readonly Coord[]): TrailMark[] {
  const marks: TrailMark[] = []
  for (let index = path.length - 1; index >= 0; index -= 2) {
    const tile = path[index] as Coord
    const toward = path[index + 2] ?? nearestOf(tile, target)
    marks.push({ tile, dx: toward.x - tile.x, dy: toward.y - tile.y })
  }
  return marks.reverse()
}

/** The tile of `tiles` nearest `from`, the first of them on a tie; `from` itself when there are none. */
function nearestOf(from: Coord, tiles: readonly Coord[]): Coord {
  let best = from
  let bestDistance = Number.POSITIVE_INFINITY
  for (const tile of tiles) {
    const distance = Math.abs(tile.x - from.x) + Math.abs(tile.y - from.y)
    if (distance < bestDistance) {
      best = tile
      bestDistance = distance
    }
  }
  return best
}

/** A trail mark pointing `dx`, `dy`, in the glyph pack's own characters — the focus arrow's: an arrowhead
 *  where the way runs mostly along one axis, a diagonal stroke where it runs along both. */
export function trailGlyph(pack: GlyphPack, dx: number, dy: number): string {
  const across = Math.abs(dx)
  const down = Math.abs(dy)
  if (down === 0 || across >= 2 * down) return chromeGlyph(pack, dx < 0 ? "arrowLeft" : "arrowRight")
  if (across === 0 || down >= 2 * across) return chromeGlyph(pack, dy < 0 ? "arrowUp" : "arrowDown")
  // Down and to the left, or up and to the right, runs along `/`; the other two along `\`.
  return chromeGlyph(pack, (dx < 0) === (dy > 0) ? "trailRise" : "trailFall")
}

/** Every tile something stands on, is planned on or arrives on — what a trail mark never covers. */
function takenTiles(context: BuildContext, planned: readonly PlannedPlacement[]): Set<string> {
  const taken = new Set<string>()
  const take = (contentId: string, anchor: Coord): void => {
    for (const tile of tilesOf(anchor, context.registry.get(contentId).footprint)) taken.add(`${tile.x},${tile.y}`)
  }
  for (const structure of context.standing) take(structure.contentId, structure.anchor)
  for (const placement of planned) take(placement.contentId, placement.anchor)
  for (const entity of context.field ?? []) take(entity.contentId, entity.anchor)
  for (const entity of context.incoming ?? []) take(entity.contentId, entity.anchor)
  return taken
}

/**
 * The effects of every placement still animating — its track's follow-ups: the light
 * (shading, `highlights`) and the sparks (particles, `effects`) — and of every building just removed,
 * whose track is its sparks alone. The corruption law is enforced here as
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
 * Drawn in the highlights band, so it is presentation and can never change occupancy (`docs/system-design/presentation.md`).
 * Shape carries the answer, not colour: a legal preview is the structure's own glyphs, an illegal one
 * is a block of `x`. Both read identically in monochrome, which is the point.
 *
 * The illegal block is grey, not red (Mario: "the red color seems a bit too intense, we
 * should try grey instead"). Red is kept for the moment a placement is actually *attempted* and
 * refused — the bottom line's job, not the ghost's — so looking and trying read differently.
 *
 * One exception: when arming found no spot within reach (`BuildState.noSpotFound`), the
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
 * When a hand-off's flight lands the cursor **blinks** (Mario: "the same exact effect as the one we
 * use when selecting menu items"): in its "on" phases it is drawn in a menu row's pressed look — the
 * hotkey's colour, inverse, bold, underlined — and between them as usual. The live loop times it
 * (`cursorBlink`); every still frame draws the plain cursor.
 */
export function drawCursor(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  // The cursor is the Grid's own focus mark: drawn only while the Grid has the keyboard, so the
  // screen never shows two "you are here"s at once.
  // A committed plan hides the cursor, except while a Pulse is on screen: there it is how the player looks
  // around the map, the arrows moving it and the view following.
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
  // A see-through wash beneath it — the incoming raid's, a raid target's — is set aside (an alpha of 0
  // shows nothing), so the one "you are here" looks the same on every tile.
  const look: CellStyle =
    input.cursorBlink === true
      ? { inverse: true, bold: PRESSED_LOOK.bold, underline: PRESSED_LOOK.underline, dim: false, fgRole: PRESSED_LOOK.role }
      : onStructure
        ? { inverse: true }
        : { inverse: true, bold: true, dim: false, fgRole: CURSOR_ROLE }
  const style: CellStyle = { ...look, seeThrough: { role: CURSOR_ROLE, alpha: 0 } }
  for (let extra = 0; extra < layout.tileWidth; extra += 1) {
    cells.push({ band: BANDS.highlights, x: cell.x + extra, y: cell.y, style })
  }
}

/**
 * A **refused try**: a placement was just tried and refused, and the whole footprint under the cursor
 * flashes solid in the bottom line's own "danger" colour for a moment, so the eye that was on
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
