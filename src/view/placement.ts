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
// Timeline of one placement, its two lengths the owner's tuned values (`src/build/tuning.ts`: they were
// the "Build animation" and "Glow time" Experiments, with "Lighting" and "Particles" beside them, until he
// settled them — a flash that settles and a few sparks — on 2026-09-30):
//
//   0 ............ framesMs ................ framesMs + glowMs
//   | placement frames: foundation -> ... |  finished, lit, sparks  |  settled (state alone)
//   |  (ANTICIPATION and ACTION)          |  (IMPACT and DECAY)     |  (SETTLE)
//   |  the Animation                      |  its two follow-ups     |
//
// Reduced motion drops the frames and the light — the finished building is there at once — and the
// sparks become a still mark at the footprint's four corners for the glow (`fx.sparks.burst`'s own
// reduced form). The recipes' other palettes — the rainbow among them — are theirs to keep; a
// placement uses the plain flash and sparks.

import type { UnitArt } from "../content/art.ts"
import { placementFramesFor } from "../content/art.ts"
import type { Tuning } from "../build/tuning.ts"
import { TUNING } from "../build/tuning.ts"
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

/** A placement's numbers: how long its frames run, how long its light and sparks take to settle, and how
 *  many sparks it throws. The game hands in the owner's tuned ones (the default); a test, or the card's
 *  rising icon, may hand in others. */
export type PlacementTuning = Pick<Tuning, "placeFramesMs" | "placeGlowMs" | "placeSparks">

/** How far the sparks fly from the footprint, in tiles — the reach the "few" sparks were drawn with. */
const SPARK_REACH = 2

export function placementTiming(reducedMotion: boolean, tuning: PlacementTuning = TUNING): PlacementTiming {
  const framesMs = reducedMotion ? 0 : Math.max(0, tuning.placeFramesMs)
  const lit = !reducedMotion
  const sparks = tuning.placeSparks > 0
  const glowMs = (lit || sparks) && tuning.placeGlowMs > 0 ? tuning.placeGlowMs : 0
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
 * The structure's placement frames as an Animation: played once over `placeFramesMs`, then cleared, so
 * the structure's own finished art shows. Frames are drawn plain — a scaffold, lighter than the bold
 * building it becomes, which is all of the light that survives monochrome.
 */
export function placementAnimation(contentId: string, footprint: Footprint, reducedMotion: boolean, tuning: PlacementTuning = TUNING): Animation {
  return animationOf(`place:${contentId}`, placementRun(contentId, footprint), placementTiming(reducedMotion, tuning).framesMs)
}

/**
 * What happens the moment the frames end: a light over the footprint and a burst of sparks around it,
 * each lasting the glow. The sparks' randomness hashes the placement's identity — ordinal, structure,
 * anchor — never the moment it happened.
 */
export function placementFollowUps(placement: PlacedStructure, footprint: Footprint, reducedMotion: boolean, tuning: PlacementTuning = TUNING): FollowUp[] {
  const { glowMs } = placementTiming(reducedMotion, tuning)
  if (glowMs <= 0) return []
  const { width, height } = footprintExtent(footprint)
  const followUps: FollowUp[] = []
  if (!reducedMotion) {
    followUps.push({
      kind: "effect",
      effect: {
        recipe: "fx.light.flash",
        band: "highlights",
        durationMs: glowMs,
        origin: placement.anchor,
        family: "neutral",
        params: { width, height, palette: "flash" },
      },
    })
  }
  const sparks = sparksFollowUp(placement, footprint, glowMs, placement.contentId, tuning)
  if (sparks !== null) followUps.push(sparks)
  return followUps
}

/**
 * The burst of sparks around a footprint, `glowMs` long — a placement's, and a removal's (feedback
 * F33) — or `null` when there are none to throw. `key` is the identity its scatter hashes, with the
 * placement's ordinal: a placement and the removal of the same building throw different sparks.
 */
function sparksFollowUp(placement: PlacedStructure, footprint: Footprint, glowMs: number, key: string, tuning: PlacementTuning): FollowUp | null {
  if (tuning.placeSparks <= 0 || glowMs <= 0) return null
  const { width, height } = footprintExtent(footprint)
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
        count: tuning.placeSparks,
        reach: SPARK_REACH,
        palette: "sparks",
        key,
        id: placement.ordinal,
      },
    },
  }
}

/**
 * **A planned building removed** — by undo, or Backspace/Delete (owner, 2026-09-29, feedback F33:
 * "Canceling a placed building should also have spark effect"): no frames, the building is gone at
 * once, and the same burst of sparks a placement throws flies off where it stood, for the same glow and
 * as many sparks. Reduced motion keeps the burst's own still form, as a placement's does. Like a
 * placement, it is presentation alone: the live loop notes when an ordinal left the plan and hands the
 * view "this one, removed this long ago"; the plan never learns it.
 */
export function removalSchedule(placement: PlacedStructure, footprint: Footprint, reducedMotion: boolean, tuning: PlacementTuning = TUNING): TrackSchedule {
  const glowMs = placementTiming(reducedMotion, tuning).glowMs
  const sparks = sparksFollowUp(placement, footprint, glowMs, `remove:${placement.contentId}`, tuning)
  // An animation with no frames completes the moment it plays, so its follow-up starts at once.
  return scheduleTrack([
    play(animationOf(`remove:${placement.contentId}`, [], 0), 0, { then: sparks === null ? [] : [sparks] }),
  ])
}

/** The one request a placement makes of its track: play its frames at `atMs`, then light and sparks. */
export function placementRequest(
  placement: PlacedStructure,
  footprint: Footprint,
  reducedMotion: boolean,
  atMs = 0,
  tuning: PlacementTuning = TUNING,
): PlayRequest {
  return play(placementAnimation(placement.contentId, footprint, reducedMotion, tuning), atMs, {
    policy: "replace",
    then: placementFollowUps(placement, footprint, reducedMotion, tuning),
  })
}

/** A placement's track on its own clock — time 0 is the moment it was placed. */
export function placementSchedule(placement: PlacedStructure, footprint: Footprint, reducedMotion: boolean, tuning: PlacementTuning = TUNING): TrackSchedule {
  return scheduleTrack([placementRequest(placement, footprint, reducedMotion, 0, tuning)])
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
  reducedMotion: boolean,
  tuning: PlacementTuning = TUNING,
): PlacementCell {
  const schedule = placementSchedule({ ordinal: 0, contentId, anchor: { x: 0, y: 0 } }, footprint, reducedMotion, tuning)
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
