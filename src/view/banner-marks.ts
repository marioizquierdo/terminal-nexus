// **The battle banner on the map** (the Battle banner Experiment): the banner where it stands, the march lines to it
// while the player is choosing, and its planting.
//
// - **The banner** is a mark on the ground — `!`, or `⚑` in the Unicode pack — in the player's colour, on the ground
//   band, so a unit or a building standing on its tile keeps its own glyph (the corruption law): there the banner is
//   only a restyle of that tile. While the cursor *is* the banner (moving it), it pulses: inverse and bold on the
//   beat, plain bold off it — a pure function of the time since the panel opened (`BannerClock`); still frames draw
//   it on the beat.
// - **The march lines** run from the player's Nexus and from the Commander to it (`bannerLines`, `src/build/banner.ts`),
//   and, aggressive, on from it to the enemy: the raid trail's arrows (`trailMarks`), in the player's colour, moving
//   toward the banner on the same clock. Only on open plain ground, never over a glyph, like the raid's trail.
// - **Planting** it plays a ring that opens out from the banner over the first `DROP_MS`: a style-only write, inverse
//   in the player's colour, so it reads in monochrome too — the building placement's light, for a banner.

import { gridDistance, inBounds } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import { visibleRange } from "../build/camera.ts"
import { cellForTile } from "../build/layout.ts"
import { setting } from "../build/all-settings.ts"
import type { BannerStance } from "../build/types.ts"
import { BANNER_STANCES } from "../build/state.ts"
import { bannerLines, currentBanner } from "../build/banner.ts"
import type { BandCell, CellStyle } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { chromeGlyph, playerRole } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import type { BuildCompositionInput } from "./build.ts"
import { inView, takenTiles, trailGlyph, trailMarks } from "./build-grid.ts"

/** How long the banner's planting plays, and how long a ring step lasts. */
export const DROP_MS = 640
const DROP_STEP_MS = 160

/** How long one beat of the banner's pulse lasts while it is the cursor: on for a beat, off for a beat. */
export const BANNER_BEAT_MS = 500

/** How far toward the background the march lines are drawn where colour allows, and the onward line further. */
const LINE_FADE = 0.15
const ONWARD_FADE = 0.45

/** The banner's place and the stance its lines show, for the state on screen — or `null` with nothing to draw. */
function bannerShown(input: BuildCompositionInput): Readonly<{ tile: Coord; stance: BannerStance | null; moving: boolean; lines: boolean }> | null {
  const { context, state } = input
  if (setting(state, "battleBanner") !== "on" || state.committed || input.pulse !== undefined) return null
  switch (state.popup) {
    case "banner-place":
      // The cursor is the banner: where it is drawn mid-glide, and no onward line until a stance is chosen.
      return { tile: input.cursor ?? state.cursor, stance: null, moving: true, lines: true }
    case "banner-stance":
      return { tile: state.bannerDraft ?? state.cursor, stance: BANNER_STANCES[state.popupHighlight] ?? null, moving: false, lines: true }
    case "battle-round": {
      const banner = currentBanner(context, state)
      return { tile: banner.tile, stance: banner.stance, moving: false, lines: true }
    }
    default: {
      // Elsewhere the banner the player planted stands quietly on the map; the default is the level's own and is
      // marked by the level's own marks.
      if (state.banner === null) return null
      return { tile: state.banner.tile, stance: state.banner.stance, moving: false, lines: false }
    }
  }
}

/** The banner, its lines and its planting, for this frame. */
export function drawBanner(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const shown = bannerShown(input)
  if (shown === null) return
  const { context, state, layout } = input
  const range = visibleRange(state.camera, state.viewport)
  const player = playerRole("A")
  if (shown.lines) {
    const lines = bannerLines(context, state, shown.tile, shown.stance ?? "defensive")
    const taken = takenTiles(context, state.planned)
    const elapsedMs = input.banner?.pulseMs ?? null
    const draw = (path: readonly Coord[], fade: number): void => {
      if (path.length < 2) return
      const end = path[path.length - 1] as Coord
      for (const mark of trailMarks(path, [end], elapsedMs, { spacing: 3, stepMs: 120 })) {
        const { tile } = mark
        if (mark.ghost !== undefined) continue
        if (!inBounds(context.grid, tile) || !inView(range, tile) || taken.has(`${tile.x},${tile.y}`)) continue
        if (tile.x === shown.tile.x && tile.y === shown.tile.y) continue
        if (context.grid.tiles[tile.y * context.grid.width + tile.x] !== "terrain.plain") continue
        const cell = cellForTile(layout, state.camera, tile)
        const style: CellStyle = { fgRole: player, fade }
        cells.push({ band: BANDS.territory, x: cell.x, y: cell.y, cell: { glyph: trailGlyph(pack, mark.dx, mark.dy), style } })
      }
    }
    draw(lines.onward, ONWARD_FADE)
    draw(lines.fromCommander, LINE_FADE)
    draw(lines.fromNexus, LINE_FADE)
  }

  // The planting's ring, opening out from where it was planted.
  const drop = input.banner?.dropMs
  const dropTile = state.bannerDrop?.tile
  if (drop !== undefined && dropTile !== undefined && drop < DROP_MS) {
    const ring = 1 + Math.floor(drop / DROP_STEP_MS)
    for (let y = range.firstY; y <= range.lastY; y += 1) {
      for (let x = range.firstX; x <= range.lastX; x += 1) {
        const distance = gridDistance({ x, y }, dropTile)
        if (distance < ring * 2 - 1 || distance > ring * 2) continue
        const cell = cellForTile(layout, state.camera, { x, y })
        cells.push({ band: BANDS.highlights, x: cell.x, y: cell.y, style: { inverse: true, bold: true, fgRole: player } })
      }
    }
  }

  if (!inView(range, shown.tile)) return
  const cell = cellForTile(layout, state.camera, shown.tile)
  cells.push({ band: BANDS.groundItems, x: cell.x, y: cell.y, cell: { glyph: chromeGlyph(pack, "banner"), style: { fgRole: player, bold: true, dim: !shown.lines } } })
  // Moving it, it pulses as the cursor does — inverse on the beat; still frames draw the beat. Elsewhere it is lit,
  // and a unit or a building on its tile keeps its glyph under the restyle.
  const pulseMs = input.banner?.pulseMs
  const on = !shown.moving || pulseMs === undefined || Math.floor(pulseMs / BANNER_BEAT_MS) % 2 === 0
  if (shown.moving && on) cells.push({ band: BANDS.highlights, x: cell.x, y: cell.y, style: { inverse: true, bold: true, dim: false, fgRole: player } })
  else if (shown.lines) cells.push({ band: BANDS.highlights, x: cell.x, y: cell.y, style: { bold: true, underline: true, fgRole: player } })
}
