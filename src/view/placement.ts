// Placement juice (gate 5I, feedback F9): what a building looks like in the moments after the player
// places it — a short run of frames as it goes up, a light on its characters as it finishes, and a
// burst of sparks around it.
//
// **Every answer here is a pure function of the plan and the time since the placement.** The reducer
// never learns a placement is animating: the live loop (`src/view/build-live.ts`) notes when it first
// saw each planned ordinal and hands the Build Phase view "ordinal N, placed this many ms ago". So a
// still frame, a test, or a scripted playtest draws any instant of the animation by naming it, and the
// plan is identical with every effect on or off (the three worlds: presentation never touches state).
//
// Timeline of one placement, all of it Debug Mode flags:
//
//   0 ............ framesMs ................ framesMs + glowMs
//   | placement frames: foundation -> ... |  finished, lit, sparks  |  settled (state alone)
//   |  (ANTICIPATION and ACTION)          |  (IMPACT and DECAY)     |  (SETTLE)
//
// Reduced motion drops the frames and the light — the finished building is there at once — and the
// sparks become a still mark at the footprint's four corners for the glow (`fx.structure.place`'s
// own reduced form).

import type { UnitArt } from "../content/art.ts"
import { placementFramesFor } from "../content/art.ts"
import type { DebugFlags } from "../build/debug.ts"
import type { Coord, Footprint } from "../grid/types.ts"
import { footprintExtent } from "../grid/coords.ts"
import type { EffectInstance } from "./effects/types.ts"
import { PLACE_PARTICLE_COUNTS } from "./effects/recipes.ts"
import type { RoleTint } from "./roles.ts"
import { RAINBOW_ROLES } from "./roles.ts"
import { entityGlyph } from "./theme.ts"

/** One planned placement still animating: which one, and how long ago it was placed. */
export type PlacementClock = Readonly<{ ordinal: number; elapsedMs: number }>

export type PlacementTiming = Readonly<{
  /** How long the placement frames run; 0 when there are none to show. */
  framesMs: number
  /** How long the light and the sparks take to settle after the last frame; 0 when neither shows. */
  glowMs: number
  /** When the whole thing is over — the live loop stops its frame timer after this. */
  totalMs: number
}>

export function placementTiming(flags: DebugFlags, reducedMotion: boolean): PlacementTiming {
  const framesMs = reducedMotion ? 0 : Math.max(0, flags.placeFramesMs)
  const lit = !reducedMotion && flags.placeLight !== "off"
  const sparks = flags.placeParticles !== "off"
  const glowMs = (lit || sparks) && flags.placeGlowMs > 0 ? flags.placeGlowMs : 0
  return { framesMs, glowMs, totalMs: framesMs + glowMs }
}

/**
 * The frames a structure plays before it stands finished: its own, authored beside its art
 * (`PLACEMENT_ART`), or — so no content ever waits on an artist — a generic run derived from its
 * finished glyphs: footings along the bottom row, then the finished rows revealed from the ground up
 * with footings under whatever has not gone up yet.
 */
export function placementRun(contentId: string, footprint: Footprint): readonly UnitArt[] {
  const authored = placementFramesFor(contentId)
  if (authored !== undefined && authored.length > 0) return authored
  const { width, height } = footprintExtent(footprint)
  const finishedRow = (y: number): string =>
    Array.from({ length: width }, (_unused, x) => entityGlyph(contentId, "A", { x, y })).join("")
  const run: UnitArt[] = []
  for (let risen = 0; risen < height; risen += 1) {
    // `risen` rows are finished at the bottom, the row above them is footings, the rest is empty.
    const rows: string[] = []
    for (let y = 0; y < height; y += 1) {
      const fromBottom = height - 1 - y
      rows.push(fromBottom < risen ? finishedRow(y) : fromBottom === risen ? ".".repeat(width) : " ".repeat(width))
    }
    run.push(rows)
  }
  return run
}

/** How one tile of an animating building is drawn right now. `glyph: null` is nothing standing
 *  there yet — the ground shows. */
export type PlacementCell = Readonly<{ glyph: string | null; bold: boolean; tint?: RoleTint }>

/** How long each hue of the rainbow holds on one tile before the next — above the ~60 ms under which
 *  a beat did not happen (ascii-effects.md Section 2). */
export const RAINBOW_STEP_MS = 60

/**
 * One tile of a building placed `elapsedMs` ago. During the frames it is the frame's glyph, drawn
 * plain — a scaffold, lighter than the building it becomes; after them it is the finished glyph,
 * drawn bold as every building is, carrying the light while the glow lasts. In monochrome, where a
 * tint shows nothing, that plain-to-bold step is what is left of the light.
 */
export function placementCell(
  contentId: string,
  footprint: Footprint,
  offset: Coord,
  elapsedMs: number,
  flags: DebugFlags,
  reducedMotion: boolean,
): PlacementCell {
  const timing = placementTiming(flags, reducedMotion)
  const finished = entityGlyph(contentId, "A", offset)
  if (elapsedMs < timing.framesMs) {
    const run = placementRun(contentId, footprint)
    const index = Math.min(run.length - 1, Math.floor((elapsedMs / timing.framesMs) * run.length))
    const drawn = run[index]?.[offset.y]?.[offset.x] ?? " "
    return { glyph: drawn === " " ? null : drawn, bold: false }
  }
  const sinceFinished = elapsedMs - timing.framesMs
  if (reducedMotion || flags.placeLight === "off" || timing.glowMs <= 0 || sinceFinished >= timing.glowMs) {
    return { glyph: finished, bold: true }
  }
  const progress = sinceFinished / timing.glowMs
  if (flags.placeLight === "rainbow") {
    // A diagonal wave of hue sweeping across the building, fading back to its own colour.
    const step = Math.floor(sinceFinished / RAINBOW_STEP_MS) + offset.x + offset.y
    const role = RAINBOW_ROLES[step % RAINBOW_ROLES.length] ?? "fx.hue.red"
    return { glyph: finished, bold: true, tint: { role, amount: roundAmount(1 - progress) } }
  }
  // A flash toward the theme's strongest ink, falling off fast and settling slowly.
  return { glyph: finished, bold: true, tint: { role: "fx.flash", amount: roundAmount((1 - progress) ** 2) } }
}

/** Blends to a hundredth: finer than any tier can show, and it keeps a frame's cells comparable. */
function roundAmount(amount: number): number {
  return Math.round(Math.max(0, Math.min(1, amount)) * 100) / 100
}

/**
 * The spark burst for one placement, as an ordinary effect instance of `fx.structure.place` on the
 * placement's own clock (time 0 is the moment it was placed), or `null` when there are none. Its
 * identity — ordinal, structure, anchor — is what its randomness hashes.
 */
export function placementSparks(
  placement: Readonly<{ ordinal: number; contentId: string; anchor: Coord }>,
  footprint: Footprint,
  flags: DebugFlags,
  reducedMotion: boolean,
): EffectInstance | null {
  if (flags.placeParticles === "off") return null
  const timing = placementTiming(flags, reducedMotion)
  if (timing.glowMs <= 0) return null
  const { width, height } = footprintExtent(footprint)
  return {
    recipe: "fx.structure.place",
    band: "effects",
    startMs: timing.framesMs,
    durationMs: timing.glowMs,
    origin: placement.anchor,
    family: "neutral",
    params: {
      width,
      height,
      count: PLACE_PARTICLE_COUNTS[flags.placeParticles],
      ordinal: placement.ordinal,
      content: placement.contentId,
      rainbow: flags.placeLight === "rainbow" ? 1 : 0,
    },
  }
}
