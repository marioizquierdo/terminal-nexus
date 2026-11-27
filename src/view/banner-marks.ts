// **The rally point on the map**: the banner — the flag — where it stands, the march line to it while the player moves
// it, and the call that brings the eye to it. Nothing else: no words are drawn beside it (the owner, 2026-11-25:
// "basically nothing in the middle that is covering the line"); what the keys do and why a spot is refused are the
// bottom line's (`rallyPointLine`, `src/build/help.ts`).
//
// - **The banner** is a mark on the ground — `!`, or `⚑` in the Unicode pack — in the player's colour, on the ground
//   band, so a unit or a building standing on its tile keeps its own glyph (the corruption law). While the cursor *is*
//   the rally point (Start Battle Round has made it so), it pulses: inverse and bold on the beat, plain bold off it —
//   a pure function of the time since it became the cursor (`BannerClock`); still frames draw it on the beat.
// - **On a building** the flag is under the building's glyphs, so the building itself is lit: every tile of its
//   footprint takes the banner's pulse (a restyle, its glyphs kept). Placed and left, its footprint stays underlined, as
//   the flag on open ground stays dim.
// - **The march line** runs from the player's Nexus to it (`bannerLines`, `src/build/banner.ts`) — one line, none
//   from the Commander: the raid trail's arrows (`trailMarks`), in the player's colour, moving toward it on the same
//   clock. Only on open plain ground, never over a glyph, like the raid's trail.
// - **The call** (the owner, 2026-11-26: "send the cursor as usual (same effect as when starting a building) and when it
//   arrives, show four directional arrows around the banner, and flash the banner and the arrows together (3 quick
//   flashes should be enough)"; once played, F336: "arrows that represent the moevement keys, pointing outwards so it
//   seems that is asking for pressing the keys. The could flash with a delay fromt the banner so they visually create
//   movement"): Start's row sends the focus arrow to it, as a building's row does (the hand-off, `build-handoff.ts`);
//   as it lands, **the movement keys' four arrows** stand round the banner, each pointing away from it the way its key
//   moves it — `^` above, `v` below, `<` left, `>` right (`▲ ▼ ◀ ▶` in the Unicode pack, the arrow keys' own look) —
//   bold, in the player's colour. Three times: the banner lights, the arrows light a beat behind it (`CALL_ARROW_LAG`),
//   so the light seems to run outward, then both go dark. On the ground-items band, under anything standing there.
// - **The reminder** (F330: "If the user doesn't move the arrow for a second, display and flash the directional arrows
//   again, and right after flash the keys part of the text on the status bottom menu ... Do this every 5 seconds"): a
//   second after the call, or after the last move, the same three flashes, banner then arrows; then the bottom line's `[arrows]` flashes
//   three times, blank on the off beats (`src/view/build-frame.ts`); again every five seconds.
//
// Every look is a pure function of two times — since it became the cursor and since it last moved (`rallyCallAt`).
// Reduced motion: no flight, the four arrows stand still the whole time, the banner held lit, nothing flashes.

import { inBounds } from "../engine/geometry/coords.ts"
import type { Coord } from "../engine/geometry/types.ts"
import { visibleRange } from "../build/camera.ts"
import { cellForTile } from "../build/layout.ts"
import { bannerLines, structureTilesAt } from "../build/banner.ts"
import type { BandCell, CellStyle } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { chromeGlyph, playerRole } from "./theme.ts"
import type { ChromePart, GlyphPack } from "./theme.ts"
import type { BuildCompositionInput } from "./build.ts"
import { inView, takenTiles, trailGlyph, trailMarks } from "./build-map.ts"
import { POPUP_FLASH } from "./build-popup.ts"

/** How long one beat of the banner's pulse lasts while it is the cursor: on for a beat, off for a beat. */
export const BANNER_BEAT_MS = 500

/** How far toward the background the march line is drawn where colour allows. */
const LINE_FADE = 0.15

/** How far behind the banner the call's four arrows light, as a share of one flash's length: half a flash, so the
 *  banner is lit alone a moment, then the arrows round it — the light moving outward (F336). */
export const CALL_ARROW_LAG = 0.5

/** How many flashes a call plays: the owner's "3 quick flashes". */
export const CALL_FLASHES = 3

/** How long the rally point must stand unmoved before the reminder plays, and how often it plays again while it does. */
export const REMIND_AFTER_MS = 1000
export const REMIND_EVERY_MS = 5000

/** The call's timings: the flight before it (the hand-off's, the "Focus arrow" milliseconds; 0 under reduced motion),
 *  each flash's on and off beats (the "Rally point flash" Experiment's length, the popup flash's gap), how long the
 *  arrows light after the banner (`lagMs`), and whether motion is reduced. */
export type RallyCallTiming = Readonly<{ flightMs: number; flashMs: number; lagMs: number; gapMs: number; reducedMotion: boolean }>

export function rallyCallTiming(focusArrowMs: number, flashMs: number, reducedMotion: boolean): RallyCallTiming {
  return {
    flightMs: reducedMotion ? 0 : Math.max(0, focusArrowMs),
    // The flash off (0) keeps the arrows still for the length the default flash would take: shown, never flashing.
    flashMs: flashMs > 0 ? flashMs : POPUP_FLASH.flashMs,
    lagMs: flashMs > 0 ? Math.round(flashMs * CALL_ARROW_LAG) : 0,
    gapMs: flashMs > 0 ? POPUP_FLASH.gapMs : 0,
    reducedMotion,
  }
}

/** One flash, from the banner lighting to the next flash: the banner's beat, the arrows' lag behind it, the gap. */
export function flashPeriodMs(timing: RallyCallTiming): number {
  return timing.lagMs + timing.flashMs + timing.gapMs
}

/** How long three flashes take: three periods, less the last gap. */
export function flashGroupMs(timing: RallyCallTiming): number {
  return CALL_FLASHES * flashPeriodMs(timing) - timing.gapMs
}

/** How long the bottom line's keys take to flash three times: three beats on, two off between them. */
export function keysGroupMs(timing: RallyCallTiming): number {
  return CALL_FLASHES * timing.flashMs + (CALL_FLASHES - 1) * timing.gapMs
}

/** When the first call ends, from the moment the rally point became the cursor: the flight, then three flashes. */
export function callEndMs(timing: RallyCallTiming): number {
  return timing.flightMs + flashGroupMs(timing)
}

/**
 * What the call shows at one instant: the flight's progress (0 to 1) while the focus arrow flies, whether the four
 * arrows show, whether the banner is lit by a flash (`null`: no flash — its ordinary pulse), whether the bottom line's
 * keys are blanked, and when the next flash group ends on the same clock (`null` outside one): the live loop draws
 * every frame until then.
 */
export type RallyCall = Readonly<{ flight: number | null; arrows: boolean; lit: boolean | null; keysBlank: boolean; keysLit: boolean; groupEndsMs: number | null }>

const QUIET: RallyCall = { flight: null, arrows: false, lit: null, keysBlank: false, keysLit: false, groupEndsMs: null }

/** What `localMs` into a flash group lights: the banner on its beat, the arrows on the same beat `lagMs` later. */
function flashAt(timing: RallyCallTiming, localMs: number): Readonly<{ lit: boolean; arrows: boolean }> {
  const into = localMs % flashPeriodMs(timing)
  return { lit: into < timing.flashMs, arrows: into >= timing.lagMs && into < timing.lagMs + timing.flashMs }
}

/**
 * **The call and the reminder at one instant**, `shownMs` after the rally point became the cursor and `movedMs` after it
 * last moved (`movedMs >= shownMs`: never moved). A pure function of the two times:
 *
 *   0 ... flightMs ............ callEnd ...... quiet + 1 s ......... + group ......... + group ...... + 5 s ...
 *   | the focus arrow flies | 3 flashes |   still   | 3 flashes again   | keys: 3 flashes |  still   | again ...
 *
 * where each flash lights the banner, then the arrows `lagMs` behind it, then neither; and `quiet` is the later of the call's end and the last move. Reduced motion: the arrows always, nothing else.
 */
export function rallyCallAt(timing: RallyCallTiming, shownMs: number, movedMs: number): RallyCall {
  if (timing.reducedMotion) return { ...QUIET, arrows: true }
  if (shownMs < 0) return QUIET
  if (shownMs < timing.flightMs) return { ...QUIET, flight: shownMs / timing.flightMs }
  const group = flashGroupMs(timing)
  const callEnd = callEndMs(timing)
  if (shownMs < callEnd) {
    return { ...QUIET, ...flashAt(timing, shownMs - timing.flightMs), groupEndsMs: callEnd }
  }
  const quiet = Math.max(callEnd, shownMs - Math.max(0, movedMs))
  const idle = shownMs - quiet
  if (idle < REMIND_AFTER_MS) return QUIET
  const into = (idle - REMIND_AFTER_MS) % REMIND_EVERY_MS
  const groupStart = shownMs - into
  if (into < group) return { ...QUIET, ...flashAt(timing, into), groupEndsMs: groupStart + group }
  // The keys flash at the plain beat: on for a flash, off for the gap, three times.
  const keys = keysGroupMs(timing)
  if (into < group + keys) {
    const on = (into - group) % (timing.flashMs + timing.gapMs) < timing.flashMs
    return { ...QUIET, keysBlank: !on, keysLit: on, groupEndsMs: groupStart + group + keys }
  }
  return QUIET
}

/** The rally point's place for the state on screen — or `null` with nothing to draw. */
function bannerShown(input: BuildCompositionInput): Readonly<{ tile: Coord; moving: boolean }> | null {
  const { state } = input
  if (state.committed || input.pulse !== undefined) return null
  // The cursor is the rally point: where it is drawn mid-glide.
  if (state.popup === "banner-place") return { tile: input.cursor ?? state.cursor, moving: true }
  // Elsewhere the rally point the player placed stands quietly on the map; the default is the level's own and is
  // marked by the level's own marks.
  if (state.banner === null) return null
  return { tile: state.banner.tile, moving: false }
}

/** The four arrows round what the rally point stands on — a building's whole footprint, or its one tile — one each
 *  side, at its middle, pointing away from it: the movement key that moves it that way. */
export function callArrows(around: readonly Coord[]): readonly Readonly<{ tile: Coord; part: ChromePart }>[] {
  const xs = around.map((tile) => tile.x)
  const ys = around.map((tile) => tile.y)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  const midX = Math.floor((left + right) / 2)
  const midY = Math.floor((top + bottom) / 2)
  return [
    { tile: { x: left - 1, y: midY }, part: "pointLeft" },
    { tile: { x: right + 1, y: midY }, part: "pointRight" },
    { tile: { x: midX, y: top - 1 }, part: "pointUp" },
    { tile: { x: midX, y: bottom + 1 }, part: "pointDown" },
  ]
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
    // The troops hold the rally point: one line, from the Nexus to it.
    const lines = bannerLines(context, state, shown.tile)
    const elapsedMs = input.banner?.pulseMs ?? null
    const path = lines.fromNexus
    if (path.length >= 2) {
      const end = path[path.length - 1] as Coord
      for (const mark of trailMarks(path, [end], elapsedMs, { spacing: 3, stepMs: 120 })) {
        const { tile } = mark
        if (mark.ghost !== undefined) continue
        if (!inBounds(context.terrain, tile) || !inView(range, tile) || taken.has(`${tile.x},${tile.y}`)) continue
        if (tile.x === shown.tile.x && tile.y === shown.tile.y) continue
        if (context.terrain.tiles[tile.y * context.terrain.width + tile.x] !== "terrain.plain") continue
        const cell = cellForTile(layout, state.camera, tile)
        const style: CellStyle = { fgRole: player, fade: LINE_FADE }
        cells.push({ band: BANDS.territory, x: cell.x, y: cell.y, cell: { glyph: trailGlyph(pack, mark.dx, mark.dy), style } })
      }
    }
  }

  const building = structureTilesAt(context, state, shown.tile)
  // The call: four arrows round it, flashing with it; under reduced motion, standing still. A still frame (no clock)
  // shows them, as reduced motion does, so a picture says where the rally point is.
  const call = shown.moving ? (input.banner?.call ?? { ...QUIET, arrows: true }) : null
  if (call !== null && call.arrows) {
    for (const arrow of callArrows(building ?? [shown.tile])) {
      if (!inBounds(context.terrain, arrow.tile) || !inView(range, arrow.tile)) continue
      const cell = cellForTile(layout, state.camera, arrow.tile)
      cells.push({ band: BANDS.groundItems, x: cell.x, y: cell.y, cell: { glyph: chromeGlyph(pack, arrow.part), style: { fgRole: player, bold: true } } })
    }
  }

  // Moving it, it pulses as the cursor does — inverse on the beat; still frames draw the beat — unless a flash holds
  // it. Placed and left, it is a quiet mark.
  const pulseMs = input.banner?.pulseMs
  const beat = pulseMs === undefined || Math.floor(pulseMs / BANNER_BEAT_MS) % 2 === 0
  const on = !shown.moving || (call?.lit ?? beat)
  const lit: CellStyle = shown.moving && on ? { inverse: true, bold: true, dim: false, fgRole: player } : shown.moving ? { bold: true, underline: true, fgRole: player } : { underline: true }
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
