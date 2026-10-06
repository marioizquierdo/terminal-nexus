// The Build Phase's Grid pane: what stands on the map and what is going up or coming down (placements
// and their effects), the ghost of the building being placed, the cursor, and a refused try's flash —
// all drawn through the camera and clipped to the view.

import { ROW_DISTANCE, inBounds, inColumns, nearestTile, tilesOf } from "../grid/coords.ts"
import type { PlayerId } from "../state/types.ts"
import type { Coord } from "../grid/types.ts"
import type { VisibleRange } from "../build/camera.ts"
import { visibleRange } from "../build/camera.ts"
import { cellForTile } from "../build/layout.ts"
import type { ArmedPreview, BuildContext } from "../build/state.ts"
import { TUNING } from "../build/tuning.ts"
import type { PlannedPlacement, RaidForecast } from "../build/types.ts"
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
import { drawBuildRange, drawReach, drawRoom } from "./build-areas.ts"
import { drawTroopsPost } from "./troops-post.ts"

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
  // While a building is armed, where it may go: drawn before the raid's trail, which wins on its tiles.
  drawBuildRange(cells, input, pack, takenTiles(context, state.planned))
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
 *   rule): an arrow every few tiles (`trailSpacing`, the owner's "1 arrow every 3 tiles"), each pointing a whole
 *   stair on along the way (`LOOK_AHEAD`) — the glyph pack's own arrowheads where the way runs straight, its
 *   diagonal strokes where it runs along the screen's diagonal (`trailGlyph`). **It moves** (the owner: "a slow-moving line of arrows ... leaving a transparent
 *   arrow behind then moving that fades"): every `trailStepMs` each arrow steps a tile on toward the target —
 *   the one beside it going in as a new one comes out of the group — and leaves a copy of itself on the tile it
 *   left, which fades out within half a step (`trailMarks`). A pure function of the clock the live loop hands in
 *   (`raidTrail`); without one — every still frame, a popup open, reduced motion — the trail is still, its
 *   arrows where the moving ones stand every few steps, the one beside the target drawn.
 * - On open ground only: never over anything standing, planned or arriving (the corruption law), nor over
 *   rock or a deposit, which are information too. In the raid's colour and quieter than the raid itself: dim,
 *   and faded where colours blend. The copy left behind is the same glyph, further faded where colours blend —
 *   at 16 colours and in monochrome, which have no blend, it is dim, then gone — so every depth draws the same
 *   glyphs at every instant.
 * - The target is a glyphless write over its tiles, so its own glyphs stay: a wash of the raid's colour
 *   where colours blend, and underlined at every depth — the form that carries it at 16 colours and in
 *   monochrome. Never red, which is kept for the player's own Nexus being hurt.
 */
export function drawRaidIntent(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  drawTroopsPost(cells, input, pack)
  const { context, state, layout, raid } = input
  if (raid === undefined || raid.length === 0 || state.committed || input.pulse !== undefined) return
  const range = visibleRange(state.camera, state.viewport)
  const taken = takenTiles(context, state.planned)
  const elapsedMs = input.raidTrail?.elapsedMs ?? null
  // Every trail's copies first, then its arrows: where two trails cross, an arrow is never covered by a copy.
  const marks = raid.flatMap((group) =>
    group.target === null ? [] : trailMarks(group.path, group.target.tiles, elapsedMs).map((mark) => ({ mark, player: group.player })),
  )
  const ordered = [...marks.filter(({ mark }) => mark.ghost !== undefined), ...marks.filter(({ mark }) => mark.ghost === undefined)]
  for (const { mark, player } of ordered) {
    const { tile } = mark
    if (!inBounds(context.grid, tile) || !inView(range, tile) || taken.has(`${tile.x},${tile.y}`)) continue
    if (context.grid.tiles[tile.y * context.grid.width + tile.x] !== "terrain.plain") continue
    const style: CellStyle = { fgRole: playerRole(player), dim: true, fade: mark.ghost === undefined ? TRAIL_FADE : (GHOST_FADES[mark.ghost] ?? 1) }
    const cell = cellForTile(layout, state.camera, tile)
    cells.push({ band: BANDS.territory, x: cell.x, y: cell.y, cell: { glyph: trailGlyph(pack, mark.dx, mark.dy), style } })
    for (let extra = 1; extra < layout.tileWidth; extra += 1) cells.push({ band: BANDS.territory, x: cell.x + extra, y: cell.y, cell: { glyph: " ", style } })
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

/** How far toward the background a trail's arrows are drawn, where colour allows: quieter than the raid. */
const TRAIL_FADE = 0.3

/**
 * How far toward the background the copy an arrow leaves behind is drawn, where colours blend — fainter than
 * the arrow from the start, a "transparent arrow" — one look a quarter of a step each, from the moment the arrow
 * moves on; then it is gone, half a step after. `fade` resolves only at 256 colours and millions, so at 16
 * colours and in monochrome the copy is the arrow's own dim look for those two quarters, then gone.
 */
export const GHOST_FADES: readonly number[] = [0.6, 0.8]

/** How strongly the raid's colour washes the tiles of what it goes for first, where colours blend. */
const TARGET_WASH = 0.25

/** How the raid's trail moves: how many tiles apart its arrows are, and how long each takes to step a tile on. */
export type TrailMotion = Readonly<{ spacing: number; stepMs: number }>

/** The owner's tuned motion (`trailSpacing`, `trailStepMs`). */
export const TRAIL_MOTION: TrailMotion = { spacing: TUNING.trailSpacing, stepMs: TUNING.trailStepMs }

/** A step of the trail is counted in quarters: the copy an arrow leaves takes a new look on each of the first
 *  two, and is gone from the third. */
const QUARTERS = 4

/** Which step of its motion the trail is on `elapsedMs` into it, and which quarter of that step. Whole quarters,
 *  counted from the start, so the trail looks the same for a whole quarter and the live loop knows when it next
 *  changes (`nextTrailChange`). */
function trailBeat(elapsedMs: number, motion: TrailMotion): Readonly<{ step: number; quarter: number }> {
  const quarters = Math.floor((Math.max(0, elapsedMs) * QUARTERS) / motion.stepMs)
  const step = Math.floor(quarters / QUARTERS)
  return { step, quarter: quarters - step * QUARTERS }
}

/**
 * When the trail next looks different, on the clock `elapsedMs` is read on: the next quarter whose start changes
 * what is drawn. An arrow steps on at a step's start, its copy takes its second look a quarter in and is gone at
 * the half — so three changes a step where colours blend, and where they do not (16 colours, monochrome) two: the
 * step, and the copy going, its two looks being one there. Before the first step nothing has been left behind, so
 * the first step is the first change.
 */
export function nextTrailChange(elapsedMs: number, blends: boolean, motion: TrailMotion = TRAIL_MOTION): number {
  const { step, quarter } = trailBeat(elapsedMs, motion)
  const changes = step === 0 ? [] : blends ? [1, GHOST_FADES.length] : [GHOST_FADES.length]
  const next = changes.find((at) => at > quarter)
  const quarters = step * QUARTERS + (next ?? QUARTERS)
  return Math.ceil((quarters * motion.stepMs) / QUARTERS)
}

/**
 * How many steps on along the way a trail's arrow points: a whole stair of the screen's diagonal, `ROW_DISTANCE`
 * steps across and one up or down — the way a unit walks it (`rankedSteps`). Looking less far, an arrow on a
 * diagonal way would read a step across one moment and a step down the next, and turn from `<` to `/` and back as
 * it moves.
 */
export const LOOK_AHEAD = ROW_DISTANCE + 1

/** One mark of a trail: its tile, and the way it points — `LOOK_AHEAD` steps on along the way, or at the target.
 *  `ghost` is set on the copy an arrow leaves on the tile it just left: which of its looks it is in
 *  (`GHOST_FADES`). */
export type TrailMark = Readonly<{ tile: Coord; dx: number; dy: number; ghost?: number }>

/**
 * Where a trail's marks are along `path`. **Still** (no `elapsedMs`): an arrow every `motion.spacing` tiles,
 * counted back from the last so the arrow beside the target is always drawn, each pointing a whole stair on along
 * the way (`LOOK_AHEAD`) — or, near its end, at the target's nearest tile. **Moving**, `elapsedMs` into its motion: every arrow is a
 * tile further on each `motion.stepMs`, so the still trail comes round every `spacing` steps — the arrow beside
 * the target goes into it as a new one comes out of the group, one tile from it — and for the first half of
 * each step every arrow's copy stands on the tile it just left, the one that went into the target included.
 * Copies come first in the list, then the arrows, each in the order of the way, so the last mark is the arrow
 * nearest the target. Tiles only: what stands on them, and whether they are in view, is the drawing's to judge.
 */
export function trailMarks(path: readonly Coord[], target: readonly Coord[], elapsedMs: number | null = null, motion: TrailMotion = TRAIL_MOTION): TrailMark[] {
  const last = path.length - 1
  if (last < 0) return []
  const spacing = Math.max(1, Math.round(motion.spacing))
  const beat = elapsedMs === null ? null : trailBeat(elapsedMs, motion)
  const shift = beat === null ? 0 : beat.step % spacing
  const ghost = beat !== null && beat.step > 0 && beat.quarter < GHOST_FADES.length ? beat.quarter : null
  // The places every `spacing` tiles along the way that are `by` tiles on from the still trail's, in the way's
  // order: where the arrows stand `by` steps into the motion.
  const placesAt = (by: number, look: number | null): TrailMark[] => {
    const places: TrailMark[] = []
    for (let index = last - ((spacing - by) % spacing); index >= 0; index -= spacing) {
      const tile = path[index] as Coord
      const toward = path[index + LOOK_AHEAD] ?? nearestTile(tile, target) ?? tile
      places.push({ tile, dx: toward.x - tile.x, dy: toward.y - tile.y, ...(look === null ? {} : { ghost: look }) })
    }
    return places.reverse()
  }
  return [...(ghost === null ? [] : placesAt((shift + spacing - 1) % spacing, ghost)), ...placesAt(shift, null)]
}

/**
 * A trail mark pointing `dx` columns across and `dy` rows down, in the glyph pack's own characters — the focus
 * arrow's: whichever of an arrowhead along a row, an arrowhead along a column and a diagonal stroke runs nearest
 * the way **on screen**. A row is `ROW_DISTANCE` columns tall (`inColumns`), and a diagonal stroke runs corner to
 * corner of a cell, one column across and one row down: so two across and one down, the screen's diagonal, is a
 * stroke, as is one across and one down, and four across and one down an arrowhead. Whole numbers only: the way
 * is nearer the stroke than the arrowhead when its angle to the stroke is the smaller, compared through the cosines
 * squared.
 */
export function trailGlyph(pack: GlyphPack, dx: number, dy: number): string {
  const way = inColumns(Math.abs(dx), Math.abs(dy))
  const stroke = inColumns(1, 1)
  // The way against the stroke and against each axis, as the cosines of the angles between them, squared and
  // brought to one denominator: `along` for the stroke, `level` for a row, `upright` for a column.
  const along = (way.across * stroke.across + way.down * stroke.down) ** 2
  const strokeLength = stroke.across ** 2 + stroke.down ** 2
  const level = way.across ** 2 * strokeLength
  const upright = way.down ** 2 * strokeLength
  if (way.down === 0 || level > along) return chromeGlyph(pack, dx < 0 ? "arrowLeft" : "arrowRight")
  if (way.across === 0 || upright > along) return chromeGlyph(pack, dy < 0 ? "arrowUp" : "arrowDown")
  // Down and to the left, or up and to the right, runs along `/`; the other two along `\`.
  return chromeGlyph(pack, (dx < 0) === (dy > 0) ? "trailRise" : "trailFall")
}

/**
 * Every tile of the raid's trails, while the trails are drawn — what a building's reach yields to, as
 * `x,y` keys. The whole way each trail runs along, not only the tiles its arrows stand on this instant: the
 * arrows move, and a reach that gave way only where they stood would flicker as they passed. The same set at
 * every instant, moving or still; empty on a committed plan and while a Pulse plays.
 */
export function trailTiles(input: BuildCompositionInput): Set<string> {
  const tiles = new Set<string>()
  const { raid, state } = input
  if (raid === undefined || state.committed || input.pulse !== undefined) return tiles
  for (const group of raid) {
    if (group.target === null) continue
    for (const tile of group.path) tiles.add(`${tile.x},${tile.y}`)
  }
  return tiles
}

/** Whether a forecast draws a trail at all — a group with something to go for and a way to it — and, given the
 *  part of the map in view, whether any of that way is in it. What the live loop asks before it times the trail's
 *  motion: a trail scrolled out of view changes nothing on screen, so it asks for no frames. */
export function hasTrail(raid: RaidForecast | undefined, range?: VisibleRange): boolean {
  if (raid === undefined) return false
  return raid.some((group) => group.target !== null && group.path.some((tile) => range === undefined || inView(range, tile)))
}

/** Every tile something stands on, is planned on or arrives on — what a trail mark, the build range's dots
 *  and a building's reach never cover. */
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
  // The room a Barracks keeps, round it and round the ghost; and where something will reach — round the ghost,
  // or round a building or a unit the cursor rests on. Both yield to the raid's trail.
  const avoid = takenTiles(input.context, state.planned)
  for (const tile of trailTiles(input)) avoid.add(tile)
  const shift = glideShift(input)
  drawRoom(cells, input, preview, shift, avoid)
  drawReach(cells, input, input.glyphPack ?? "ascii", preview, shift, avoid)
  if (preview === null) return
  const legal = preview.refusal === null
  const shape = legal || state.noSpotFound
  const range = visibleRange(state.camera, state.viewport)

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
