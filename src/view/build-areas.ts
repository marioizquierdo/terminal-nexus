// Two areas the Build Phase draws on the map while a building is being placed (the owner, round 4: "we should
// have a cool and unobstrussive way to show where the turrets will reach ... They also can only be built within
// the build-range of the other buildings, so we should also reflect that. Hopefully there's a way to represent
// that in ascii without too much noise"). Two different things, so two different kinds of mark:
//
// - ***The build range*** is an **area**: where a new building may stand. While one is armed, every open tile
//   inside it shows the ground's own dot, so the ground the player may build on is the densely dotted ground
//   (outside it the map keeps its sparse lattice), and where colours blend it is lit by a faint grey wash. The
//   dots carry it at every depth, monochrome included; the wash is fidelity.
// - ***A building's reach*** is an **outline**: the last tiles a building with a range reaches, as the kernel
//   measures range (Manhattan, to the nearest tile of its footprint), drawn as a ring of strokes round it — `-`
//   and `|` where the ring runs straight along the footprint, `/` and `\` where it runs diagonally. It follows
//   the ghost while the building is armed, in the ghost's own look (its colour when Enter would place it, grey
//   when not), and is drawn for a building already placed while the cursor rests on it. Only open ground takes
//   a stroke: a ring yields to everything drawn on the map, the raid's trail included, so it never claims what
//   it would catch on the raid's way (the owner: "don't over-promise on the enemy route").
//
// Both are presentation alone: nothing here decides a placement (`src/build/territory.ts` does), and neither is
// drawn while a popup holds the keyboard, once the plan is committed, or while a Pulse plays.

import { footprintDistance } from "../grid/coords.ts"
import type { Coord, Footprint } from "../grid/types.ts"
import { visibleRange } from "../build/camera.ts"
import { cellForTile } from "../build/layout.ts"
import type { ArmedPreview, BuildContext } from "../build/state.ts"
import { buildRange, mapMode, structureAtTile } from "../build/state.ts"
import type { Territory } from "../build/territory.ts"
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

/** Which stroke a tile of a reach's outline is drawn with: along the footprint's side, or across a corner. */
export type RingStroke = "level" | "upright" | "rise" | "fall"

export type RingTile = Readonly<{ tile: Coord; stroke: RingStroke }>

/**
 * The outline of a reach: every tile exactly `radius` from the footprint anchored at `anchor` (Manhattan, to its
 * nearest tile — the last tiles it reaches), each with its stroke: `level` straight above or below the
 * footprint, `upright` straight beside it, and across the corners `rise` (`/`, north-west and south-east) or
 * `fall` (`\`, north-east and south-west). In reading order. Pure, and in tiles: the view lays it on cells.
 */
export function reachOutline(anchor: Coord, footprint: Footprint, radius: number): RingTile[] {
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
  const ring: RingTile[] = []
  for (let y = top - radius; y <= bottom + radius; y += 1) {
    for (let x = left - radius; x <= right + radius; x += 1) {
      const tile = { x, y }
      if (footprintDistance(anchor, footprint, tile, ONE_TILE) !== radius) continue
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

/** What the outline is drawn round, and in which look: the ghost, or a building under the cursor. */
type Reaching = Readonly<{ contentId: string; anchor: Coord; footprint: Footprint; role: StyleRole }>

/**
 * ***A building's reach***: the outline round the armed building's ghost — moving with it, glide included
 * (`shift`), in the ghost's look: the hotkey's colour when Enter would place it, grey when not — or, with nothing
 * armed and the map looked at (Explore Map, plain navigation), round the building under the cursor, standing or
 * planned. Dim, in the `highlights` band, on open ground only: a tile with anything on it, rock and deposits
 * included, or one of the raid's trail marks (`avoid`), keeps its own look. A stroke on the build range's
 * ground keeps its light, so the outline reads as drawn on that floor.
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
  const radius = reachOf(context.registry.get(reaching.contentId))
  if (radius === null) return
  const range = visibleRange(state.camera, state.viewport)
  const floor = shownBuildRange(input)
  const style: CellStyle = { fgRole: reaching.role, dim: true }
  const lit: CellStyle = { ...style, ...BUILD_RANGE_LIGHT }
  for (const { tile, stroke } of reachOutline(reaching.anchor, reaching.footprint, radius)) {
    if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) continue
    if (context.grid.tiles[tile.y * context.grid.width + tile.x] !== "terrain.plain" || avoid.has(`${tile.x},${tile.y}`)) continue
    const cell = cellForTile(layout, state.camera, tile)
    cells.push({ band: BANDS.highlights, x: cell.x, y: cell.y, cell: { glyph: RING_GLYPHS[pack][stroke], style: floor?.has(tile) === true ? lit : style } })
  }
}

/** The building whose reach is drawn now, if any: the armed one's ghost, else one under the cursor. */
function reachingNow(context: BuildContext, input: BuildCompositionInput, preview: ArmedPreview | null, shift: Coord): Reaching | null {
  const { state } = input
  if (preview !== null) {
    return {
      contentId: preview.item.contentId,
      anchor: { x: preview.anchor.x + shift.x, y: preview.anchor.y + shift.y },
      footprint: preview.footprint,
      role: preview.refusal === null ? "chrome.hotkey" : "chrome.muted",
    }
  }
  const mode = mapMode(state)
  if (mode !== "explore" && mode !== "plain") return null
  const under = structureAtTile(context, state.planned, input.cursor ?? state.cursor)
  if (under === null) return null
  return { contentId: under.contentId, anchor: under.anchor, footprint: context.registry.get(under.contentId).footprint, role: "chrome.hotkey" }
}
