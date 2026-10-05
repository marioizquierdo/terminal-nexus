// ***Your troops' target***: where the player's troops head when the battle starts — the region the level names
// for them (a mission's `target`, kept by the kernel: `src/pulse/target.ts`) — said in the side panel under the
// coming raid ("YOUR TROOPS / 6 head for the line", `raid-panel.ts`), and marked quietly on the map: its four
// corners, in the player's colour, dim, on open ground only. The corners say "this ground" without a line
// across the map that could be read as a route; how the troops get there, and what they meet, is the
// battle's to show (the owner: "don't over-promise").
//
// It travels with the raid's forecast (`RaidForecast`, `BuildSession.raid`): one more group, the player's own,
// carrying the target it heads for (`post`) — so the panel and the map read one forecast, worked out once per
// plan, as the raid's own lines and trail are. Drawn in the Build Phase only, never during a battle, like the
// raid's trail; never over a glyph (the corruption law), like every mark on the map.

import { visibleRange } from "../build/camera.ts"
import { cellForTile } from "../build/layout.ts"
import type { BuildContext } from "../build/state.ts"
import type { PlannedPlacement, RaidForecast, RaidGroup } from "../build/types.ts"
import { inBounds, tilesOf } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import type { BandCell, CellStyle } from "./frame.ts"
import { BANDS } from "./frame.ts"
import type { BuildCompositionInput } from "./build.ts"
import { chromeGlyph, playerRole } from "./theme.ts"
import type { ChromePart, GlyphPack } from "./theme.ts"

/** The player's troops in the forecast: a group of their side, and the target they head for — the name the
 *  player reads and every tile of it. */
export type TroopsGroup = RaidGroup & Readonly<{ post: Readonly<{ name: string; tiles: readonly Coord[] }> }>

/** Whether a group of the forecast is the player's troops rather than one of the raid's. */
export function isTroops(group: RaidGroup): group is TroopsGroup {
  return "post" in group
}

/** The player's troops in a forecast, or `null` when their level names no target for them. */
export function troopsIn(raid: RaidForecast | undefined): TroopsGroup | null {
  return raid?.find(isTroops) ?? null
}

/** How far toward the background the corners are drawn, where colour allows: as quiet as the raid's trail. */
const CORNER_FADE = 0.3

/** The corners of a rectangle of tiles, each with the frame part that draws it: one mark for a single tile. */
function cornersOf(tiles: readonly Coord[]): Readonly<{ tile: Coord; part: ChromePart }>[] {
  const xs = tiles.map((tile) => tile.x)
  const ys = tiles.map((tile) => tile.y)
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const corners: Readonly<{ tile: Coord; part: ChromePart }>[] = [
    { tile: { x: left, y: top }, part: "topLeft" },
    { tile: { x: right, y: top }, part: "topRight" },
    { tile: { x: left, y: bottom }, part: "bottomLeft" },
    { tile: { x: right, y: bottom }, part: "bottomRight" },
  ]
  const seen = new Set<string>()
  return corners.filter(({ tile }) => {
    const key = `${tile.x},${tile.y}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Every tile something stands on, is planned on or arrives on: where a corner is never drawn. */
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
 * The target's corners on the map, in the Build Phase: the frame's own corner glyphs (`+` in ASCII), in the
 * player's colour, dim and faded where colour allows — a mark that reads in monochrome too. Only on open
 * ground nothing stands on, is planned on or arrives on, so no glyph is ever replaced.
 */
export function drawTroopsPost(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const { context, state, layout } = input
  const troops = troopsIn(input.raid)
  if (troops === null || state.committed || input.pulse !== undefined) return
  const range = visibleRange(state.camera, state.viewport)
  const taken = takenTiles(context, state.planned)
  const style: CellStyle = { fgRole: playerRole(troops.player), dim: true, fade: CORNER_FADE }
  for (const { tile, part } of cornersOf(troops.post.tiles)) {
    if (!inBounds(context.grid, tile) || taken.has(`${tile.x},${tile.y}`)) continue
    if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) continue
    if (context.grid.tiles[tile.y * context.grid.width + tile.x] !== "terrain.plain") continue
    const cell = cellForTile(layout, state.camera, tile)
    cells.push({ band: BANDS.territory, x: cell.x, y: cell.y, cell: { glyph: chromeGlyph(pack, part), style } })
    for (let extra = 1; extra < layout.tileWidth; extra += 1) cells.push({ band: BANDS.territory, x: cell.x + extra, y: cell.y, cell: { glyph: " ", style } })
  }
}
