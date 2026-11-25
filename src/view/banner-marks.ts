// **The rally point on the map** (the Battle banner Experiment): the banner — the flag — where it stands, the march
// line to it while the player moves it, the words beside it, and the call that brings the eye to it.
//
// - **The banner** is a mark on the ground — `!`, or `⚑` in the Unicode pack — in the player's colour, on the ground
//   band, so a unit or a building standing on its tile keeps its own glyph (the corruption law). While the cursor *is*
//   the rally point (Start Battle Round has made it so), it pulses: inverse and bold on the beat, plain bold off it —
//   a pure function of the time since it became the cursor (`BannerClock`); still frames draw it on the beat.
// - **On a building** the flag is under the building's glyphs, so the building itself is lit: every tile of its
//   footprint takes the banner's pulse (a restyle, its glyphs kept), and the words beside it name it ("Place rally
//   point on your Barracks"). Placed and left, its footprint stays underlined, as the flag on open ground stays dim.
// - **The march line** runs from the player's Nexus to it (`bannerLines`, `src/build/banner.ts`) — one line, none
//   from the Commander — and, only with the Rally point Experiment at push on, a fainter one on from it to the enemy:
//   the raid trail's arrows (`trailMarks`), in the player's colour, moving toward it on the same clock. Only on open
//   plain ground, never over a glyph, like the raid's trail.
// - **The words beside it**, while it is moved: `[enter] Place rally point`, or — where troops could not get — why
//   not, in the bottom line's danger look. Chrome, like a popup's words: to the right of the flag (of the building it
//   is on) with a blank between, or to the left where the right would run out of the view, or on a row under it or
//   over it, kept whole inside the view; of those, the first that covers nothing standing, else the one that covers
//   least. Never on the flag's own tile.
// - **The call**: as it becomes the cursor, rings close in on it over `CALL_MS` — a style-only write, inverse in the
//   player's colour, so it reads in monochrome too — the building placement's light, turned to bring the eye there.
//   Reduced motion skips it (`BannerClock` gives no time), and the still frame is the settled one.

import { tileDistance, inBounds } from "../engine/geometry/coords.ts"
import type { Coord } from "../engine/geometry/types.ts"
import { visibleRange } from "../build/camera.ts"
import type { VisibleRange } from "../build/camera.ts"
import { cellForTile } from "../build/layout.ts"
import { setting } from "../build/all-settings.ts"
import { bannerLines, bannerSpot, structureTilesAt } from "../build/banner.ts"
import type { BandCell, CellStyle } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { chromeGlyph, playerRole } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import type { BuildCompositionInput } from "./build.ts"
import { inView, takenTiles, trailGlyph, trailMarks } from "./build-map.ts"
import { statusStyle } from "./status.ts"
import type { StyleRole } from "./roles.ts"

/** How long the call plays as the rally point becomes the cursor, and how many rings close in over it. */
export const CALL_MS = 560
const CALL_RINGS = 7

/** How long one beat of the banner's pulse lasts while it is the cursor: on for a beat, off for a beat. */
export const BANNER_BEAT_MS = 500

/** How far toward the background the march line is drawn where colour allows, and the onward line further. */
const LINE_FADE = 0.15
const ONWARD_FADE = 0.45

/** What the words beside the rally point say after `[enter]` (the owner: "that text next to the banner will say place
 *  rally point"). */
const PLACE_WORDS = "Place rally point"

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

/** The words beside the rally point while it is moved, in runs of one look each. */
export type RallyLabel = readonly Readonly<{ text: string; role: StyleRole; bold: boolean }>[]

/** What the words beside the rally point on `tile` say: `[enter] Place rally point`, naming the building it is on, or
 *  why troops could not get there. */
export function rallyLabel(input: Pick<BuildCompositionInput, "context" | "state">, tile: Coord): RallyLabel {
  const spot = bannerSpot(input.context, input.state, tile)
  if (spot.refusal !== null) {
    const danger = statusStyle("danger")
    return [{ text: spot.refusal, role: danger.role, bold: danger.bold === true }]
  }
  const onBuilding = structureTilesAt(input.context, input.state, tile) !== null
  return [
    { text: "[enter]", role: "chrome.hotkey", bold: true },
    { text: ` ${PLACE_WORDS}${onBuilding ? ` on ${spot.name}` : ""}`, role: "chrome.title", bold: true },
  ]
}

/** What the rally point stands on, as a box: its own tile on open ground, a building's whole footprint. */
export type LabelBox = Readonly<{ left: number; right: number; top: number; bottom: number }>

/** The tile the words start on: right of what the rally point stands on (the flag, or the building it is on), left of
 *  it, or a row under (or over) it, kept inside the view; the first that covers nothing standing, else the one that
 *  covers least. `width` counts the blank either side. */
export function labelStart(tile: Coord, box: LabelBox, width: number, range: VisibleRange, taken: ReadonlySet<string>): Coord {
  const clampX = (x: number): number => Math.max(range.firstX, Math.min(x, range.lastX - width + 1))
  const candidates: Coord[] = []
  if (box.right + 1 + width - 1 <= range.lastX) candidates.push({ x: box.right + 1, y: tile.y })
  if (box.left - width >= range.firstX) candidates.push({ x: box.left - width, y: tile.y })
  for (const y of [box.bottom + 1, box.top - 1, box.bottom + 2, box.top - 2]) {
    if (y >= range.firstY && y <= range.lastY) candidates.push({ x: clampX(tile.x - Math.floor(width / 2)), y })
  }
  if (candidates.length === 0) return { x: clampX(box.right + 1), y: tile.y }
  const covered = (start: Coord): number => {
    let count = 0
    for (let x = start.x; x < start.x + width; x += 1) if (taken.has(`${x},${start.y}`)) count += 1
    return count
  }
  let best = candidates[0] as Coord
  for (const candidate of candidates) {
    if (covered(best) === 0) break
    if (covered(candidate) < covered(best)) best = candidate
  }
  return best
}

/** The rally point, its line, its words and its call, for this frame. */
export function drawBanner(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const shown = bannerShown(input)
  if (shown === null) return
  const { context, state, layout } = input
  const range = visibleRange(state.camera, state.viewport)
  const player = playerRole("A")
  const taken = takenTiles(context, state.planned)
  if (shown.moving) {
    const lines = bannerLines(context, state, shown.tile, setting(state, "rallyPoint") === "push-on" ? "aggressive" : "defensive")
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
    draw(lines.onward, ONWARD_FADE)
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

  if (!shown.moving) return
  // The words beside it, a blank either side.
  const label = rallyLabel(input, shown.tile)
  const words = label.map((run) => run.text).join("")
  const width = words.length + 2
  const box: LabelBox =
    building === null
      ? { left: shown.tile.x, right: shown.tile.x, top: shown.tile.y, bottom: shown.tile.y }
      : {
          left: Math.min(...building.map((tile) => tile.x)),
          right: Math.max(...building.map((tile) => tile.x)),
          top: Math.min(...building.map((tile) => tile.y)),
          bottom: Math.max(...building.map((tile) => tile.y)),
        }
  const start = labelStart(shown.tile, box, width, range, taken)
  const glyphs: Array<Readonly<{ glyph: string; role: StyleRole; bold: boolean }>> = [{ glyph: " ", role: "chrome.title", bold: false }]
  for (const run of label) for (const glyph of run.text) glyphs.push({ glyph, role: run.role, bold: run.bold })
  glyphs.push({ glyph: " ", role: "chrome.title", bold: false })
  glyphs.forEach((each, index) => {
    const tile = { x: start.x + index, y: start.y }
    if (!inView(range, tile) || (tile.x === shown.tile.x && tile.y === shown.tile.y)) return
    const cell = cellForTile(layout, state.camera, tile)
    cells.push({ band: BANDS.chrome, x: cell.x, y: cell.y, cell: { glyph: each.glyph, style: { fgRole: each.role, ...(each.bold ? { bold: true } : {}) } } })
  })
}
