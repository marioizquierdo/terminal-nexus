// **The rally point on the map** (the Battle banner Experiment): the banner — the flag — where it stands, the march
// line to it while the player moves it, and the call that brings the eye to it. Nothing else: no words are drawn beside
// it (the owner, 2026-11-25: "basically nothing in the middle that is covering the line"); where it stands, what
// Enter does and why a spot is refused are the bottom line's (`rallyPointLine`, `src/build/help.ts`), after the flag.
//
// - **The banner** is a mark on the ground — `!`, or `⚑` in the Unicode pack — in the player's colour, on the ground
//   band, so a unit or a building standing on its tile keeps its own glyph (the corruption law). While the cursor *is*
//   the rally point (Start Battle Round has made it so), it pulses: inverse and bold on the beat, plain bold off it —
//   a pure function of the time since it became the cursor (`BannerClock`); still frames draw it on the beat.
// - **On a building** the flag is under the building's glyphs, so the building itself is lit: every tile of its
//   footprint takes the banner's pulse (a restyle, its glyphs kept), and the bottom line names it ("Rally point on
//   your Barracks"). Placed and left, its footprint stays underlined, as the flag on open ground stays dim.
// - **The march line** runs from the player's Nexus to it (`bannerLines`, `src/build/banner.ts`) — one line, none
//   from the Commander — and, only with the Rally point Experiment at push on, a fainter one on from it to the enemy:
//   the raid trail's arrows (`trailMarks`), in the player's colour, moving toward it on the same clock. Only on open
//   plain ground, never over a glyph, like the raid's trail. It walks round rock only, straight through the buildings
//   (`bannerLines`), but is drawn only between them.
// - **The call**: as it becomes the cursor, rings close in on it over `CALL_MS` — a style-only write, inverse in the
//   player's colour, so it reads in monochrome too — the building placement's light, turned to bring the eye there.
//   Reduced motion skips it (`BannerClock` gives no time), and the still frame is the settled one.

import { tileDistance, inBounds } from "../engine/geometry/coords.ts"
import type { Coord } from "../engine/geometry/types.ts"
import { visibleRange } from "../build/camera.ts"
import { cellForTile } from "../build/layout.ts"
import { setting } from "../build/all-settings.ts"
import { bannerLines, structureTilesAt } from "../build/banner.ts"
import type { BandCell, CellStyle } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { chromeGlyph, playerRole } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import type { BuildCompositionInput } from "./build.ts"
import { inView, takenTiles, trailGlyph, trailMarks } from "./build-map.ts"

/** How long the call plays as the rally point becomes the cursor, and how many rings close in over it. */
export const CALL_MS = 560
const CALL_RINGS = 7

/** How long one beat of the banner's pulse lasts while it is the cursor: on for a beat, off for a beat. */
export const BANNER_BEAT_MS = 500

/** How far toward the background the march line is drawn where colour allows, and the onward line further. */
const LINE_FADE = 0.15
const ONWARD_FADE = 0.45

/** The rally point's place for the state on screen — or `null` with nothing to draw. */
function bannerShown(input: BuildCompositionInput): Readonly<{ tile: Coord; moving: boolean }> | null {
  const { state } = input
  if (setting(state, "battleBanner") !== "on" || state.committed || input.pulse !== undefined) return null
  // The cursor is the rally point: where it is drawn mid-glide.
  if (state.popup === "banner-place") return { tile: input.cursor ?? state.cursor, moving: true }
  // Elsewhere the rally point the player placed stands quietly on the map; the default is the level's own and is
  // marked by the level's own marks.
  if (state.banner === null) return null
  return { tile: state.banner.tile, moving: false }
}

/** The rally point, its line and its call, for this frame. */
export function drawBanner(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const shown = bannerShown(input)
  if (shown === null) return
  const { context, state, layout } = input
  const range = visibleRange(state.camera, state.viewport)
  const player = playerRole("A")
  const taken = takenTiles(context, state.planned)
  if (shown.moving) {
    const lines = bannerLines(context, state, shown.tile)
    const elapsedMs = input.banner?.pulseMs ?? null
    const draw = (path: readonly Coord[], fade: number): void => {
      if (path.length < 2) return
      const end = path[path.length - 1] as Coord
      for (const mark of trailMarks(path, [end], elapsedMs, { spacing: 3, stepMs: 120 })) {
        const { tile } = mark
        if (mark.ghost !== undefined) continue
        if (!inBounds(context.terrain, tile) || !inView(range, tile) || taken.has(`${tile.x},${tile.y}`)) continue
        if (tile.x === shown.tile.x && tile.y === shown.tile.y) continue
        if (context.terrain.tiles[tile.y * context.terrain.width + tile.x] !== "terrain.plain") continue
        const cell = cellForTile(layout, state.camera, tile)
        const style: CellStyle = { fgRole: player, fade }
        cells.push({ band: BANDS.territory, x: cell.x, y: cell.y, cell: { glyph: trailGlyph(pack, mark.dx, mark.dy), style } })
      }
    }
    draw(lines.fromNexus, LINE_FADE)
  }

  // The call: rings closing in on it from the moment it became the cursor.
  const pulseMs = input.banner?.pulseMs
  if (shown.moving && pulseMs !== undefined && pulseMs < CALL_MS) {
    const ring = CALL_RINGS - Math.floor((pulseMs / CALL_MS) * CALL_RINGS)
    for (let y = range.firstY; y <= range.lastY; y += 1) {
      for (let x = range.firstX; x <= range.lastX; x += 1) {
        const distance = tileDistance({ x, y }, shown.tile)
        if (distance < ring * 2 - 1 || distance > ring * 2) continue
        const cell = cellForTile(layout, state.camera, { x, y })
        cells.push({ band: BANDS.highlights, x: cell.x, y: cell.y, style: { inverse: true, bold: true, fgRole: player } })
      }
    }
  }

  // Moving it, it pulses as the cursor does — inverse on the beat; still frames draw the beat. Placed and left, it is
  // a quiet mark.
  const on = !shown.moving || pulseMs === undefined || Math.floor(pulseMs / BANNER_BEAT_MS) % 2 === 0
  const lit: CellStyle = shown.moving && on ? { inverse: true, bold: true, dim: false, fgRole: player } : shown.moving ? { bold: true, underline: true, fgRole: player } : { underline: true }
  const building = structureTilesAt(context, state, shown.tile)
  if (building !== null) {
    // On a building its glyphs hide the flag: the whole building takes the banner's look instead, glyphs kept.
    for (const tile of building) {
      if (!inView(range, tile)) continue
      const cell = cellForTile(layout, state.camera, tile)
      cells.push({ band: BANDS.highlights, x: cell.x, y: cell.y, style: lit })
    }
  }
  if (inView(range, shown.tile)) {
    const cell = cellForTile(layout, state.camera, shown.tile)
    cells.push({ band: BANDS.groundItems, x: cell.x, y: cell.y, cell: { glyph: chromeGlyph(pack, "banner"), style: { fgRole: player, bold: true, dim: !shown.moving } } })
    if (shown.moving && building === null) cells.push({ band: BANDS.highlights, x: cell.x, y: cell.y, style: lit })
  }
}
