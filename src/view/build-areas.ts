// The areas the Build Phase draws on the map while a building is being placed (the owner, round 4: "we should
// have a cool and unobstrussive way to show where the turrets will reach ... They also can only be built within
// the build-range of the other buildings, so we should also reflect that. Hopefully there's a way to represent
// that in ascii without too much noise"). Different things, so different kinds of mark:
//
// - ***The build range*** is an **area**: where a new building may stand, any tile of it. While one is armed,
//   every open tile inside it shows the ground's own dot, so the ground the player may build on is the densely
//   dotted ground (outside it the map keeps its sparse lattice), and where colours blend it is lit by a faint
//   grey wash. The dots carry it at every depth, monochrome included; the wash is fidelity. It is the reducer's
//   own answer (`buildRange`): where a row counts two columns, counted in rows, so it keeps its height.
// - ***A Barracks's room*** is an **apron**: the ground a building that makes units keeps free round it (the
//   owner, round 5: "so they leave space for units spawning"), where nothing may stand — unlike the build
//   range's edge, which a building may hang over. While a building is armed, every open tile of it shows a mark
//   of its own, a dim tick (`'`) where the ground would show a dot, round every standing or planned building
//   that keeps room and round the armed one's ghost, moving with it. A tick, not a gap: an apron with no dots
//   would read as ground outside the range, where a building may still hang. Inside the range it keeps the
//   range's light, so it reads as drawn on that floor.
// - ***A building's reach*** is an **outline**: the last tiles a building with a range reaches, as the kernel
//   measures range (Manhattan, to the nearest tile of its footprint, under the battle's measure — the Ground
//   Experiment, so where a row counts two columns a reach is drawn twice as wide as it is tall, as it plays),
//   drawn as a ring of strokes round it — `-`
//   and `|` where the ring runs straight along the footprint, `/` and `\` where it runs diagonally. It follows
//   the ghost while the building is armed, in the ghost's own look (its colour when Enter would place it, grey
//   when not), and is drawn for a building already placed while the cursor rests on it — and, in Explore Map
//   and plain navigation, for a unit of either side that shoots past the tiles touching it (the owner, round 5:
//   "exploring a unit should also show thier range"), in the same hotkey colour; a unit that fights hand to hand
//   shows none, which is what makes a ranged one read as ranged.
//   Only open ground takes a stroke: a ring yields to everything drawn on the map, the raid's trail included,
//   so it never claims what it would catch on the raid's way (the owner: "don't over-promise on the enemy
//   route").
//
// All are presentation alone: nothing here decides a placement (`src/build/territory.ts` does), and none is
// drawn while a popup holds the keyboard, once the plan is committed, or while a Pulse plays.

import { SQUARE, footprintDistance, footprintWithin, reachOf as measuredReach, tilesOf } from "../grid/coords.ts"
import type { Coord, Footprint, GridMeasure } from "../grid/types.ts"
import { setting } from "../build/all-settings.ts"
import { visibleRange } from "../build/camera.ts"
import { cellForTile } from "../build/layout.ts"
import type { ArmedPreview, BuildContext } from "../build/state.ts"
import { buildRange, buildingsOn, groundMeasure, mapMode, structureAtTile } from "../build/state.ts"
import type { Territory } from "../build/territory.ts"
import { clearanceOf } from "../build/territory.ts"
import type { ContentDef } from "../content/types.ts"
import type { BandCell, CellStyle } from "./frame.ts"
import { BANDS } from "./frame.ts"
import type { StyleRole } from "./roles.ts"
import { terrainGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import type { BuildCompositionInput } from "./build.ts"

/** How strongly the build range's grey lights its ground, where colours blend: a floor, not a highlight. */
const BUILD_RANGE_WASH = 0.12

/** The role that lights the build range: the map edge's own quiet grey, so the floor reads as ground, not as
 *  a side's colour or the hotkey's. */
const BUILD_RANGE_ROLE: StyleRole = "chrome.edge"

/** The light on the build range's ground, where colours blend. */
const BUILD_RANGE_LIGHT: CellStyle = { seeThrough: { role: BUILD_RANGE_ROLE, alpha: BUILD_RANGE_WASH } }

/** The build range when the map shows it — while a building is armed, the keyboard on the map and no popup over
 *  it — and `null` otherwise. */
export function shownBuildRange(input: BuildCompositionInput): Territory | null {
  const { context, state } = input
  if (mapMode(state) !== "placing" || state.popup !== null || input.pulse !== undefined) return null
  return buildRange(context, state)
}

/**
 * ***The build range***, while a building is armed: every open tile inside it — plain ground, nothing standing,
 * planned or arriving on it — shows the ground's dot, dim in the ground's own role, so the range is the densely
 * dotted ground; and where colours blend, every tile inside it is lit by a faint grey wash, glyphless, so
 * whatever stands there keeps its look. Drawn in the `territory` band before the raid's trail, whose marks win
 * on their tiles.
 */
export function drawBuildRange(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack, taken: ReadonlySet<string>): void {
  const { context, state, layout } = input
  const territory = shownBuildRange(input)
  if (territory === null) return
  const range = visibleRange(state.camera, state.viewport)
  const dot = terrainGlyph("terrain.plain", pack)
  const wash = BUILD_RANGE_LIGHT
  for (let y = range.firstY; y <= range.lastY; y += 1) {
    for (let x = range.firstX; x <= range.lastX; x += 1) {
      if (!territory.has({ x, y })) continue
      const cell = cellForTile(layout, state.camera, { x, y })
      const open = context.grid.tiles[y * context.grid.width + x] === "terrain.plain" && !taken.has(`${x},${y}`)
      if (open) cells.push({ band: BANDS.territory, x: cell.x, y: cell.y, cell: { glyph: dot.glyph, style: { fgRole: dot.role, dim: true } } })
      for (let extra = 0; extra < layout.tileWidth; extra += 1) cells.push({ band: BANDS.territory, x: cell.x + extra, y: cell.y, style: wash })
    }
  }
}

/**
 * How far a building reaches, for the outline drawn round it: its attack's range today — the one range a
 * building has. The one place a later range (a heal, an aura, what a building projects) joins it.
 */
export function reachOf(definition: ContentDef): number | null {
  return definition.attack?.range ?? null
}

/**
 * How far a unit reaches, for the outline drawn round it while it is explored — or anything else on the map that
 * is not the player's building: its attack's range when it reaches past the tiles touching it, and none for one
 * that fights hand to hand, so the outline itself says "ranged".
 */
export function unitReachOf(definition: ContentDef): number | null {
  const range = reachOf(definition)
  return range !== null && range >= 2 ? range : null
}

// --- A Barracks's room ----------------------------------------------------------------------------------------

/** The mark on a tile of a Barracks's room, in both glyph packs: a tick, where open ground would show a dot. */
export const ROOM_GLYPH = "'"

/** The room's look: the ground's own role, dim, the lightest there is — the tick says the rest. */
const ROOM_STYLE: CellStyle = { fgRole: "terrain.plain", dim: true }

/** The room's look on the build range's ground: the range's light kept, so it reads as drawn on that floor. */
const ROOM_ON_FLOOR: CellStyle = { ...ROOM_STYLE, ...BUILD_RANGE_LIGHT }

/**
 * The room a building that makes units keeps: every tile within `clearance` of the footprint anchored at
 * `anchor`, measured as range is (Manhattan, to its nearest tile, under the battle's `measure`: the room rule's
 * own test, `footprintWithin`), and not on it — in reading order. Counted in the tiles' own coordinates, never as
 * offsets that could be `-0`. Pure, and in tiles: the view lays it on cells.
 */
export function roomApron(anchor: Coord, footprint: Footprint, clearance: number, measure: GridMeasure = SQUARE): Coord[] {
  const box = boxOf(anchor, footprint)
  // Never more rows than the room, and across as far as its reach in the measure's count.
  const span = Math.max(clearance, measuredReach(clearance, measure))
  const apron: Coord[] = []
  for (let y = box.top - clearance; y <= box.bottom + clearance; y += 1) {
    for (let x = box.left - span; x <= box.right + span; x += 1) {
      const tile = { x, y }
      if (footprintDistance(anchor, footprint, tile, ONE_TILE) === 0) continue
      if (footprintWithin(anchor, footprint, tile, ONE_TILE, clearance, measure)) apron.push(tile)
    }
  }
  return apron
}

/** A footprint's bounding box on the map, anchored at `anchor`. */
function boxOf(anchor: Coord, footprint: Footprint): Readonly<{ left: number; right: number; top: number; bottom: number }> {
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const offset of footprint) {
    left = Math.min(left, anchor.x + offset.x)
    right = Math.max(right, anchor.x + offset.x)
    top = Math.min(top, anchor.y + offset.y)
    bottom = Math.max(bottom, anchor.y + offset.y)
  }
  return { left, right, top, bottom }
}

/**
 * ***A Barracks's room***, while a building is armed: round every building on the map that keeps room —
 * standing, planned or the raid's — and round the armed one's ghost, moving with it (`shift`), every open tile of
 * the room shows a dim tick, at the "Barracks room" Experiment's size, measured as the room rule measures it (the
 * Ground Experiment's measure). In the `territory` band, over the build range's dot and under everything that
 * stands; never on a tile in `avoid` (anything standing, planned or arriving, and the raid's trail), under the
 * ghost, on rock or on a deposit. A building's reach, drawn above it, keeps its strokes where the two cross.
 */
export function drawRoom(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null, shift: Coord, avoid: ReadonlySet<string>): void {
  const { context, state, layout } = input
  const floor = shownBuildRange(input)
  if (floor === null) return
  const override = setting(state, "spawnClearance")
  const measure = groundMeasure(state)
  const keepers: Readonly<{ anchor: Coord; footprint: Footprint; room: number }>[] = []
  for (const building of buildingsOn(context, state.planned)) {
    const definition = context.registry.get(building.contentId)
    const room = clearanceOf(definition, override)
    if (room !== null) keepers.push({ anchor: building.anchor, footprint: definition.footprint, room })
  }
  const ghost = preview === null ? null : { x: preview.anchor.x + shift.x, y: preview.anchor.y + shift.y }
  const armed = preview === null ? null : clearanceOf(context.registry.get(preview.item.contentId), override)
  if (preview !== null && ghost !== null && armed !== null) keepers.push({ anchor: ghost, footprint: preview.footprint, room: armed })
  if (keepers.length === 0) return
  const under = new Set<string>()
  if (preview !== null && ghost !== null) for (const tile of tilesOf(ghost, preview.footprint)) under.add(`${tile.x},${tile.y}`)
  const range = visibleRange(state.camera, state.viewport)
  const marked = new Set<string>()
  for (const keeper of keepers) {
    for (const tile of roomApron(keeper.anchor, keeper.footprint, keeper.room, measure)) {
      if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) continue
      const key = `${tile.x},${tile.y}`
      if (marked.has(key) || avoid.has(key) || under.has(key)) continue
      if (context.grid.tiles[tile.y * context.grid.width + tile.x] !== "terrain.plain") continue
      marked.add(key)
      const cell = cellForTile(layout, state.camera, tile)
      cells.push({ band: BANDS.territory, x: cell.x, y: cell.y, cell: { glyph: ROOM_GLYPH, style: floor.has(tile) ? ROOM_ON_FLOOR : ROOM_STYLE } })
    }
  }
}

// --- A building's reach, and a unit's -------------------------------------------------------------------------

/** Which stroke a tile of a reach's outline is drawn with: along the footprint's side, or across a corner. */
export type RingStroke = "level" | "upright" | "rise" | "fall"

export type RingTile = Readonly<{ tile: Coord; stroke: RingStroke }>

/**
 * The outline of a reach: the last tiles it reaches — every tile the kernel's own test puts within `radius` of the
 * footprint anchored at `anchor` (`footprintWithin`: Manhattan, to its nearest tile, under the battle's
 * `measure`) with a four-way neighbour it does not, never a tile of the footprint itself — each with its stroke:
 * `level` straight above or below the footprint, `upright` straight beside it, and across the corners `rise`
 * (`/`, north-west and south-east) or `fall` (`\`, north-east and south-west). In reading order. Under `SQUARE`
 * these are exactly the tiles `radius` away, the diamond's own ring; where a row counts two columns the ring is
 * twice as wide as it is tall, and two tiles thick where it runs at a shallow slant, so it has no gaps. Pure, and
 * in tiles: the view lays it on cells.
 */
export function reachOutline(anchor: Coord, footprint: Footprint, radius: number, measure: GridMeasure = SQUARE): RingTile[] {
  const { left, right, top, bottom } = boxOf(anchor, footprint)
  // Never more rows than the radius, and across as far as its reach in the measure's count.
  const span = Math.max(radius, measuredReach(radius, measure))
  // Whether each tile of the box, and the ring of tiles just outside it, is in reach: asked once a tile.
  const firstX = left - span - 1
  const firstY = top - radius - 1
  const width = right + span + 2 - firstX
  const height = bottom + radius + 2 - firstY
  const reached = new Uint8Array(width * height)
  for (let y = firstY; y < firstY + height; y += 1) {
    for (let x = firstX; x < firstX + width; x += 1) {
      if (footprintWithin(anchor, footprint, { x, y }, ONE_TILE, radius, measure)) reached[(y - firstY) * width + (x - firstX)] = 1
    }
  }
  const inside = (x: number, y: number): boolean => reached[(y - firstY) * width + (x - firstX)] === 1
  const ring: RingTile[] = []
  for (let y = top - radius; y <= bottom + radius; y += 1) {
    for (let x = left - span; x <= right + span; x += 1) {
      if (!inside(x, y) || (inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1))) continue
      const tile = { x, y }
      if (footprintDistance(anchor, footprint, tile, ONE_TILE) === 0) continue
      const across = x >= left && x <= right
      const along = y >= top && y <= bottom
      const stroke: RingStroke = across ? "level" : along ? "upright" : (x < left) === (y < top) ? "rise" : "fall"
      ring.push({ tile, stroke })
    }
  }
  return ring
}

const ONE_TILE: Footprint = [{ x: 0, y: 0 }]

/** A reach's strokes in each glyph pack. */
const RING_GLYPHS: Readonly<Record<GlyphPack, Readonly<Record<RingStroke, string>>>> = {
  ascii: { level: "-", upright: "|", rise: "/", fall: "\\" },
  unicode: { level: "─", upright: "│", rise: "╱", fall: "╲" },
}

/** What the outline is drawn round, how far, and in which look: the ghost, or a building or a unit under the
 *  cursor. */
type Reaching = Readonly<{ anchor: Coord; footprint: Footprint; radius: number; role: StyleRole }>

/**
 * ***A building's reach***: the outline round the armed building's ghost — moving with it, glide included
 * (`shift`), in the ghost's look: the hotkey's colour when Enter would place it, grey when not — or, with nothing
 * armed and the map looked at (Explore Map, plain navigation), round what is under the cursor, in the hotkey's
 * colour (`EXPLORED_REACH`): a building, standing or planned, or a unit of either side that shoots past the
 * tiles touching it (`unitReachOf`). Measured as the battle will be (the Ground Experiment's measure,
 * `reachOutline`). Dim, in the `highlights` band, on open ground only: a tile with anything on it, rock and
 * deposits included, or one of the raid's trail marks (`avoid`), keeps its own look. A stroke on the build
 * range's ground keeps its light, so the outline reads as drawn on that floor.
 */
export function drawReach(
  cells: BandCell[],
  input: BuildCompositionInput,
  pack: GlyphPack,
  preview: ArmedPreview | null,
  shift: Coord,
  avoid: ReadonlySet<string>,
): void {
  const { context, state, layout } = input
  // The cursor's own conditions: a committed plan's map shows no cursor, so nothing rests on a building there.
  if (state.focus !== "grid" || state.popup !== null || state.committed || input.pulse !== undefined) return
  const reaching = reachingNow(context, input, preview, shift)
  if (reaching === null) return
  const range = visibleRange(state.camera, state.viewport)
  const floor = shownBuildRange(input)
  const style: CellStyle = { fgRole: reaching.role, dim: true }
  const lit: CellStyle = { ...style, ...BUILD_RANGE_LIGHT }
  for (const { tile, stroke } of reachOutline(reaching.anchor, reaching.footprint, reaching.radius, groundMeasure(state))) {
    if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) continue
    if (context.grid.tiles[tile.y * context.grid.width + tile.x] !== "terrain.plain" || avoid.has(`${tile.x},${tile.y}`)) continue
    const cell = cellForTile(layout, state.camera, tile)
    cells.push({ band: BANDS.highlights, x: cell.x, y: cell.y, cell: { glyph: RING_GLYPHS[pack][stroke], style: floor?.has(tile) === true ? lit : style } })
  }
}

/**
 * The look of what the cursor rests on's reach, a building's or a unit's, either side's: the hotkey's colour, the
 * colour of what the player is pointing at. Never the raid's own colour for the raid's units: the raid's trail
 * draws its diagonal steps with the same strokes, dim in that colour, so a slinger's outline beside the trail
 * would read as more trail. The unit itself, and its card, say whose it is.
 */
const EXPLORED_REACH: StyleRole = "chrome.hotkey"

/** Whatever's reach is drawn now, if any: the armed building's ghost; else a building under the cursor; else a
 *  unit under it — one that came through the last round, or one arriving — that shoots past the tiles touching
 *  it. A unit is never drawn over a building, so a building under the cursor is what the cursor is on. */
function reachingNow(context: BuildContext, input: BuildCompositionInput, preview: ArmedPreview | null, shift: Coord): Reaching | null {
  const { state } = input
  if (preview !== null) {
    const radius = reachOf(context.registry.get(preview.item.contentId))
    if (radius === null) return null
    return {
      anchor: { x: preview.anchor.x + shift.x, y: preview.anchor.y + shift.y },
      footprint: preview.footprint,
      radius,
      role: preview.refusal === null ? "chrome.hotkey" : "chrome.muted",
    }
  }
  const mode = mapMode(state)
  if (mode !== "explore" && mode !== "plain") return null
  const cursor = input.cursor ?? state.cursor
  const under = structureAtTile(context, state.planned, cursor)
  if (under !== null) {
    const definition = context.registry.get(under.contentId)
    const radius = reachOf(definition)
    return radius === null ? null : { anchor: under.anchor, footprint: definition.footprint, radius, role: EXPLORED_REACH }
  }
  const covers = (entity: Readonly<{ contentId: string; anchor: Coord }>): boolean =>
    tilesOf(entity.anchor, context.registry.get(entity.contentId).footprint).some((tile) => tile.x === cursor.x && tile.y === cursor.y)
  const unit = (context.field ?? []).find(covers) ?? (context.incoming ?? []).find(covers)
  if (unit === undefined) return null
  const definition = context.registry.get(unit.contentId)
  const radius = unitReachOf(definition)
  return radius === null ? null : { anchor: unit.anchor, footprint: definition.footprint, radius, role: EXPLORED_REACH }
}
