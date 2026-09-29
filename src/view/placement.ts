// Placement juice (gate 5I, feedback F9): what a building looks like in the moments after the player
// places it — a short run of frames as it goes up, a light on its characters as it finishes, and a
// burst of sparks around it.
//
// Since the presentation toolkit was formalised (owner, 2026-09-28) this file only *says what a
// placement is* in the toolkit's terms; the toolkit draws it:
//
//   - an **Animation** (`animation.ts`): the structure's placement frames, played once on the
//     placement's own track — `placementRequest`, a `play` with the default `replace` policy;
//   - two **follow-ups** of that play, scheduled at the moment its last frame ends: a **Shading**
//     light over the footprint (`fx.light.flash`, `effects/shading.ts`) and a **Particles** burst
//     around it (`fx.sparks.burst`, `effects/particles.ts`) — both generic recipes, usable by anything.
//
// **Every answer here is a pure function of the plan and the time since the placement.** The reducer
// never learns a placement is animating: the live loop (`src/view/build-live.ts`) notes when it first
// saw each planned ordinal and hands the Build Phase view "ordinal N, placed this many ms ago". So a
// still frame, a test, or a scripted playtest draws any instant of the animation by naming it, and the
// plan is identical with every effect on or off (the three worlds: presentation never touches state).
//
// Timeline of one placement, all of it Experiments:
//
//   0 ............ framesMs ................ framesMs + glowMs
//   | placement frames: foundation -> ... |  finished, lit, sparks  |  settled (state alone)
//   |  (ANTICIPATION and ACTION)          |  (IMPACT and DECAY)     |  (SETTLE)
//   |  the Animation                      |  its two follow-ups     |
//
// Reduced motion drops the frames and the light — the finished building is there at once — and the
// sparks become a still mark at the footprint's four corners for the glow (`fx.sparks.burst`'s own
// reduced form).

import type { UnitArt } from "../content/art.ts"
import { placementFramesFor } from "../content/art.ts"
import type { DebugFlags } from "../build/debug.ts"
import type { Coord, Footprint } from "../grid/types.ts"
import { footprintExtent } from "../grid/coords.ts"
import type { Animation, FollowUp, PlayRequest, TrackSchedule } from "./animation.ts"
import { animationOf, frameGlyph, play, scheduleTrack, trackEffectsAt, trackFrameAt } from "./animation.ts"
import type { EffectContext } from "./effects/types.ts"
import { EFFECT_RECIPES } from "./effects/recipes.ts"
import type { CapabilityMode, RoleTint } from "./roles.ts"
import { entityGlyph } from "./theme.ts"

/** One planned placement still animating: which one, and how long ago it was placed. */
export type PlacementClock = Readonly<{ ordinal: number; elapsedMs: number }>

/** A building that just left the plan (undone or removed), still throwing its sparks: which one, where
 *  it stood, and how long ago it went (feedback F33). */
export type RemovalClock = PlacedStructure & Readonly<{ elapsedMs: number }>

export type PlacementTiming = Readonly<{
  /** How long the placement frames run; 0 when there are none to show. */
  framesMs: number
  /** How long the light and the sparks take to settle after the last frame; 0 when neither shows. */
  glowMs: number
  /** When the whole thing is over — the live loop stops its frame timer after this. */
  totalMs: number
}>

/** Sparks for `few` and `many` — the two non-zero values of the "Particles" Experiment. */
export const PLACE_PARTICLE_COUNTS = { few: 6, many: 14 } as const

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

/** A planned placement — which one, what, where: everything its animation and its effects hash. */
export type PlacedStructure = Readonly<{ ordinal: number; contentId: string; anchor: Coord }>

/**
 * The structure's placement frames as an Animation: played once over the "Build animation" Experiment
 * time, then cleared, so the structure's own finished art shows. Frames are drawn plain — a scaffold,
 * lighter than the bold building it becomes, which is all of the light that survives monochrome.
 */
export function placementAnimation(contentId: string, footprint: Footprint, flags: DebugFlags, reducedMotion: boolean): Animation {
  return animationOf(`place:${contentId}`, placementRun(contentId, footprint), placementTiming(flags, reducedMotion).framesMs)
}

/**
 * What happens the moment the frames end: a light over the footprint and a burst of sparks around it,
 * each lasting the glow. The sparks' randomness hashes the placement's identity — ordinal, structure,
 * anchor — never the moment it happened.
 */
export function placementFollowUps(placement: PlacedStructure, footprint: Footprint, flags: DebugFlags, reducedMotion: boolean): FollowUp[] {
  const { glowMs } = placementTiming(flags, reducedMotion)
  if (glowMs <= 0) return []
  const { width, height } = footprintExtent(footprint)
  const rainbow = flags.placeLight === "rainbow"
  const followUps: FollowUp[] = []
  if (!reducedMotion && flags.placeLight !== "off") {
    followUps.push({
      kind: "effect",
      effect: {
        recipe: "fx.light.flash",
        band: "highlights",
        durationMs: glowMs,
        origin: placement.anchor,
        family: "neutral",
        params: { width, height, palette: rainbow ? "rainbow" : "flash" },
      },
    })
  }
  const sparks = sparksFollowUp(placement, footprint, flags, glowMs, placement.contentId)
  if (sparks !== null) followUps.push(sparks)
  return followUps
}

/**
 * The burst of sparks around a footprint, `glowMs` long — a placement's, and a removal's (feedback
 * F33) — or `null` when the "Particles" Experiment is off. `key` is the identity its scatter hashes, with
 * the placement's ordinal: a placement and the removal of the same building throw different sparks.
 */
function sparksFollowUp(placement: PlacedStructure, footprint: Footprint, flags: DebugFlags, glowMs: number, key: string): FollowUp | null {
  if (flags.placeParticles === "off" || glowMs <= 0) return null
  const { width, height } = footprintExtent(footprint)
  const count = PLACE_PARTICLE_COUNTS[flags.placeParticles]
  return {
    kind: "effect",
    effect: {
      recipe: "fx.sparks.burst",
      band: "effects",
      durationMs: glowMs,
      origin: placement.anchor,
      family: "neutral",
      params: {
        width,
        height,
        count,
        reach: count > PLACE_PARTICLE_COUNTS.few ? 3 : 2,
        palette: flags.placeLight === "rainbow" ? "rainbow" : "sparks",
        key,
        id: placement.ordinal,
      },
    },
  }
}

/**
 * **A planned building removed** — by undo, or Backspace/Delete (owner, 2026-09-29, feedback F33:
 * "Canceling a placed building should also have spark effect"): no frames, the building is gone at
 * once, and the same burst of sparks a placement throws flies off where it stood, for the same "Glow
 * time" and "Particles". Reduced motion keeps the burst's own still form, as a placement's does. Like
 * a placement, it is presentation alone: the live loop notes when an ordinal left the plan and hands
 * the view "this one, removed this long ago"; the plan never learns it.
 */
export function removalSchedule(placement: PlacedStructure, footprint: Footprint, flags: DebugFlags, reducedMotion: boolean): TrackSchedule {
  const glowMs = placementTiming(flags, reducedMotion).glowMs
  const sparks = sparksFollowUp(placement, footprint, flags, glowMs, `remove:${placement.contentId}`)
  // An animation with no frames completes the moment it plays, so its follow-up starts at once.
  return scheduleTrack([
    play(animationOf(`remove:${placement.contentId}`, [], 0), 0, { then: sparks === null ? [] : [sparks] }),
  ])
}

/** The one request a placement makes of its track: play its frames at `atMs`, then light and sparks. */
export function placementRequest(
  placement: PlacedStructure,
  footprint: Footprint,
  flags: DebugFlags,
  reducedMotion: boolean,
  atMs = 0,
): PlayRequest {
  return play(placementAnimation(placement.contentId, footprint, flags, reducedMotion), atMs, {
    policy: "replace",
    then: placementFollowUps(placement, footprint, flags, reducedMotion),
  })
}

/** A placement's track on its own clock — time 0 is the moment it was placed. */
export function placementSchedule(placement: PlacedStructure, footprint: Footprint, flags: DebugFlags, reducedMotion: boolean): TrackSchedule {
  return scheduleTrack([placementRequest(placement, footprint, flags, reducedMotion)])
}

/** How one tile of an animating building is drawn right now. `glyph: null` is nothing standing
 *  there yet — the ground shows. */
export type PlacementLook = Readonly<{ glyph: string | null; bold: boolean }>

/** A building's own characters at one offset, `elapsedMs` into its track: the frame playing, or — once
 *  the frames are over — its finished art, drawn bold as every building is. */
export function placementLook(schedule: TrackSchedule, contentId: string, offset: Coord, elapsedMs: number): PlacementLook {
  const drawn = trackFrameAt(schedule, elapsedMs)
  if (drawn === null) return { glyph: entityGlyph(contentId, "A", offset), bold: true }
  return { glyph: frameGlyph(drawn.frame, offset), bold: drawn.frame.bold === true }
}

/** The context a placement's effects are drawn in: its own clock, and no cosmetic seed — a
 *  placement's scatter hashes which placement it is, and nothing else. */
export function placementEffectContext(
  elapsedMs: number,
  reducedMotion: boolean,
  capability: CapabilityMode = "truecolor",
  tileWidth: 1 | 2 = 1,
): EffectContext {
  return { timeMs: elapsedMs, cosmeticSeed: 0, tileWidth, reducedMotion, capability }
}

/** One tile, with the light it carries. */
export type PlacementCell = PlacementLook & Readonly<{ tint?: RoleTint }>

/**
 * One tile of a building placed `elapsedMs` ago, as the Build Phase view composes it: its look from
 * the track, and the tint the light paints on it. The view draws the same two things through its
 * compositor; this is the single-tile answer tests and capture scripts ask for.
 */
export function placementCell(
  contentId: string,
  footprint: Footprint,
  offset: Coord,
  elapsedMs: number,
  flags: DebugFlags,
  reducedMotion: boolean,
): PlacementCell {
  const schedule = placementSchedule({ ordinal: 0, contentId, anchor: { x: 0, y: 0 } }, footprint, flags, reducedMotion)
  const look = placementLook(schedule, contentId, offset, elapsedMs)
  const context = placementEffectContext(elapsedMs, reducedMotion)
  let tint: RoleTint | undefined
  for (const effect of trackEffectsAt(schedule, elapsedMs)) {
    for (const cell of EFFECT_RECIPES[effect.recipe]?.(effect, context) ?? []) {
      if (cell.glyph === "" && cell.tint !== undefined && cell.tile.x === offset.x && cell.tile.y === offset.y) tint = cell.tint
    }
  }
  return tint === undefined ? look : { ...look, tint }
}
