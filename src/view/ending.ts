// How a Nexus Pulse ends on screen — Mario's sketch (`docs/history/milestones/milestone-06-pulse-phase.md`), built
// to be watched and retuned, and every moment of it a pure function of presentation time:
//
//   the fight is shown as it happened ............................ "fighting"
//   the last seconds: the timer flashes, a light sweeps the border  "final"       (`endWarnMs`)
//   the last tick is shown and nothing shoots any more ........... "halted"      (effects in flight land)
//   the survivors walk home ...................................... "walking"     (`endWalkPauseMs`, `endWalkMs`)
//   everyone is home; the result stands .......................... "home"
//
// The three timings are the owner's tuned values (`src/build/tuning.ts`); `endingTimes` takes them as a
// parameter so a test can try any.
//
// **The kernel decided the ending long before any of this plays**: the timeline is resolved whole before
// the first frame, so presentation knows when the last tick is and can count down to it. That is what
// makes it pacing — "just an idea for UX, to create anticipation and not just stop the pulse right
// away" (Mario) — and why it means the same for a Nexus that fell, a force wiped out, and the
// clock running out: it is a flourish on an ending that already happened.
//
// **What is loud, and what is not** (Mario's direction): the only thing that flashes is the timer in the
// Pulse's title, in its last seconds, like a racing game's clock; the light that sweeps the map's border is
// a lighthouse calling, not an alarm; and **red is kept for the player's Nexus being hurt** — its first
// hit, its health very low, a lost Pulse — brief and faint.
//
// **Recall's state change is instant** (`docs/system-design/pulse.md`), and belongs to `src/match/recall.ts`. What
// is drawn here is the walk home on top of it: presentation only, from where the fight left each survivor
// to the tile Recall gave it. Nothing in this file can change a state, an event or a hash.

import type { Tuning } from "../build/tuning.ts"
import { TUNING } from "../build/tuning.ts"
import type { Coord } from "../grid/types.ts"
import type { RecallMove } from "../match/types.ts"
import type { Outcome, PlayerId } from "../state/types.ts"
import type { StatusTone } from "../build/status.ts"
import { buildFlightHoldTicks, flightHoldTicks } from "./effects/derive.ts"
import type { PulseTimeline } from "./snapshot.ts"
import { tileAt } from "./tween.ts"

/** The moments of one Pulse's ending, in presentation milliseconds from the Pulse's start. */
export type EndingTimes = Readonly<{
  /** The last tick is shown: the fight has stopped, and nothing shoots after it. */
  stopMs: number
  /** When the last seconds begin — the timer starts to flash and the light to sweep — or `null` for
   *  none (a warning of 0). Never before the Pulse starts. */
  warnMs: number | null
  /** When the survivors start walking home: the pause after the stop, or later, once every effect in
   *  flight has landed ("then Recall plays"). */
  walkMs: number
  /** When the walk ends and the result is shown — `walkMs` itself for a walk-back of no time. */
  homeMs: number
}>

/** The ending's three timings, in milliseconds: how long the warning lasts before the stop, the pause
 *  before the walk home, and the walk. The game plays the owner's (`TUNING`); a test may hand in others. */
export type EndingTuning = Pick<Tuning, "endWarnMs" | "endWalkPauseMs" | "endWalkMs">

export function endingTimes(lastTickMs: number, effectsEndMs: number, tuning: EndingTuning = TUNING): EndingTimes {
  const stopMs = lastTickMs
  const walkMs = Math.max(stopMs + tuning.endWalkPauseMs, effectsEndMs)
  return {
    stopMs,
    warnMs: tuning.endWarnMs > 0 ? Math.max(0, stopMs - tuning.endWarnMs) : null,
    walkMs,
    homeMs: walkMs + tuning.endWalkMs,
  }
}

export type EndingPhase = "fighting" | "final" | "halted" | "walking" | "home"

export function phaseAt(times: EndingTimes, timeMs: number): EndingPhase {
  if (timeMs >= times.homeMs) return "home"
  if (timeMs >= times.walkMs) return "walking"
  if (timeMs >= times.stopMs) return "halted"
  if (times.warnMs !== null && timeMs >= times.warnMs) return "final"
  return "fighting"
}

// ---------------------------------------------------------------------------------------------
// The timer — the one thing that flashes
// ---------------------------------------------------------------------------------------------

/** Half a period of the timer's flash: lit for this long, plain for the next. */
export const TIMER_HALF_PERIOD_MS = 300

/** How long is left until the shooting stops, in whole seconds, counting a part of a second as the
 *  second it is in: 3 until it is 2, and 0 only once it has stopped. */
export function timerSeconds(times: EndingTimes, timeMs: number): number {
  return Math.max(0, Math.ceil((times.stopMs - timeMs) / 1000))
}

/** `0:12` — minutes, then seconds to two places. */
export function formatTimer(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/**
 * Whether the timer is lit at this instant: in the last seconds, on and off from the moment they
 * begin. Reduced motion holds it lit rather than flashing — a steady cue, never an absent one.
 */
export function timerLit(times: EndingTimes, timeMs: number, reducedMotion: boolean): boolean {
  if (times.warnMs === null || timeMs < times.warnMs || timeMs >= times.stopMs) return false
  return reducedMotion || Math.floor((timeMs - times.warnMs) / TIMER_HALF_PERIOD_MS) % 2 === 0
}

// ---------------------------------------------------------------------------------------------
// The light — the Nexus calling, like a lighthouse
// ---------------------------------------------------------------------------------------------

/** How long one turn of the light round the map's border takes, and how many border cells its tail
 *  trails behind its head. */
export const BEAM_PERIOD_MS = 2000
export const BEAM_TAIL_CELLS = 18
/** How brightly the head shines (how far its cell is pulled toward the light: 1 is all the way), the
 *  faint glow the whole border has while the light is on, and how long the light takes to come up
 *  and to go out. Reduced motion is one steady glow instead of a turning beam. */
export const BEAM_PEAK = 0.7
export const BEAM_GLOW = 0.12
export const BEAM_STEADY = 0.3
export const BEAM_FADE_MS = 400

/** How lit a border cell must be before monochrome shows it, by going bold. */
export const BEAM_BOLD = 0.4

/** What is the same for every border cell at one instant — worked out once a frame, not once a cell. */
export type BeamFrame = Readonly<{ steady: boolean; envelope: number; head: number; length: number }>

/**
 * The light at this instant, for a border of `length` cells, or `null` when it is off: it is on from the
 * start of the last seconds until a moment after the shooting stops. Reduced motion is one steady glow
 * rather than a turning beam.
 */
export function beamFrame(times: EndingTimes, timeMs: number, length: number, reducedMotion: boolean): BeamFrame | null {
  if (times.warnMs === null) return null
  const end = times.stopMs + BEAM_FADE_MS
  if (timeMs < times.warnMs || timeMs >= end) return null
  return {
    steady: reducedMotion,
    envelope: Math.min(1, (timeMs - times.warnMs) / BEAM_FADE_MS, (end - timeMs) / BEAM_FADE_MS),
    head: (((timeMs - times.warnMs) % BEAM_PERIOD_MS) / BEAM_PERIOD_MS) * length,
    length,
  }
}

/**
 * How much light the border cell at `index` — numbered clockwise from the top left corner — has in `beam`,
 * from 0 (its own colour) to 1. A colour pulled toward the light, never a glyph, so it hides nothing.
 */
export function beamLight(beam: BeamFrame, index: number): number {
  if (beam.steady) return BEAM_STEADY
  const behind = (((beam.head - index) % beam.length) + beam.length) % beam.length
  const tail = behind < BEAM_TAIL_CELLS ? (1 - behind / BEAM_TAIL_CELLS) * (BEAM_PEAK - BEAM_GLOW) : 0
  return beam.envelope * (BEAM_GLOW + tail)
}

/** One cell's light at one instant: `beamFrame` and `beamLight` together. */
export function beamAt(times: EndingTimes, timeMs: number, index: number, length: number, reducedMotion: boolean): number {
  const beam = beamFrame(times, timeMs, length, reducedMotion)
  return beam === null ? 0 : beamLight(beam, index)
}

// ---------------------------------------------------------------------------------------------
// Red — only for the player's Nexus being hurt
// ---------------------------------------------------------------------------------------------

/** The share of its health at which the player's Nexus counts as "very low". */
export const NEXUS_LOW_FRACTION = 0.25
/** How long each red flash lasts, in milliseconds: the first hit, one blip of the low-health warning
 *  (repeated every `RED_LOW_EVERY_MS` while it stays low), and a lost Pulse's result. */
export const RED_FIRST_HIT_MS = 200
export const RED_LOW_BLIP_MS = 150
export const RED_LOW_EVERY_MS = 1500
export const RED_DEFEAT_MS = 250
/** How red the border gets at the start of a flash, fading to nothing. Gentle on purpose: at most a
 *  little over half of the way to the danger colour. */
export const RED_PEAK = 0.6

/**
 * What happened to the player's Nexus in a resolved Pulse, in presentation milliseconds — when it was
 * first hit, when its health first fell below `NEXUS_LOW_FRACTION`, and when it fell — `null` for what
 * never happened. Read once from the timeline; each moment is when its blow *lands* on screen, after a
 * ranged shot's flight, as the impact effects are.
 */
export type NexusStrain = Readonly<{ hitMs: number | null; lowMs: number | null; fallMs: number | null }>

export function nexusStrain(
  timeline: Pick<PulseTimeline, "states" | "events" | "registry" | "ticksPerSecond">,
  player: PlayerId = "A",
): NexusStrain {
  const maxHp = new Map<number, number>()
  for (const entity of timeline.states[0]?.entities ?? []) {
    const definition = timeline.registry.get(entity.contentId)
    if (entity.player === player && definition.nexus === true) maxHp.set(entity.ordinal, definition.maxHp)
  }
  const holds = buildFlightHoldTicks(timeline.events)
  const tickMs = 1000 / timeline.ticksPerSecond
  const earliest = (now: number | null, at: number): number => (now === null ? at : Math.min(now, at))
  let hitMs: number | null = null
  let lowMs: number | null = null
  let fallMs: number | null = null
  for (const event of timeline.events) {
    if (event.kind !== "damage.applied" && event.kind !== "structure.destroyed" && event.kind !== "entity.died") continue
    const full = maxHp.get(event.ordinal)
    if (full === undefined) continue
    const at = (event.tick + flightHoldTicks(holds, event.tick, event.ordinal)) * tickMs
    if (event.kind !== "damage.applied") {
      fallMs = earliest(fallMs, at)
      continue
    }
    hitMs = earliest(hitMs, at)
    if (event.hpAfter / full < NEXUS_LOW_FRACTION) lowMs = earliest(lowMs, at)
  }
  return { hitMs, lowMs, fallMs }
}

/** A flash that starts at full strength and is gone `duration` milliseconds later. */
const fade = (elapsed: number, duration: number): number => (elapsed >= 0 && elapsed < duration ? 1 - elapsed / duration : 0)

/**
 * How red the border is at this instant, 0 to `RED_PEAK`: a short flash the moment the Nexus is first
 * hit, a shorter blip every second and a half while its health is very low (until it falls), and one
 * more when the result of a lost Pulse appears. Nothing under reduced motion — every one of these is
 * said again on the panel, the Nexus's own marks and the result's words, so none is a lone cue.
 */
export function redAlert(strain: NexusStrain, times: EndingTimes, defeated: boolean, timeMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0
  let level = strain.hitMs === null ? 0 : fade(timeMs - strain.hitMs, RED_FIRST_HIT_MS)
  if (strain.lowMs !== null && timeMs >= strain.lowMs && (strain.fallMs === null || timeMs < strain.fallMs)) {
    level = Math.max(level, fade((timeMs - strain.lowMs) % RED_LOW_EVERY_MS, RED_LOW_BLIP_MS))
  }
  if (defeated) level = Math.max(level, fade(timeMs - times.homeMs, RED_DEFEAT_MS))
  return level * RED_PEAK
}

/**
 * Where each survivor is drawn while it walks home, by ordinal — and empty before the walk begins, when
 * the fight's own positions stand. Whole tiles along a straight line, easing out of and into the
 * walk; there is no routing to follow (a straight glide may cross rock, which a 2-second flourish can
 * afford). Reduced motion shows everyone home the moment the walk would begin.
 */
export function walkPositions(
  moves: readonly RecallMove[],
  times: EndingTimes,
  timeMs: number,
  reducedMotion: boolean,
): ReadonlyMap<number, Coord> {
  const positions = new Map<number, Coord>()
  if (timeMs < times.walkMs) return positions
  const duration = reducedMotion ? 0 : times.homeMs - times.walkMs
  for (const move of moves) {
    positions.set(
      move.ordinal,
      tileAt({ from: move.from, to: move.to, startMs: times.walkMs, durationMs: duration, easing: "easeInOut" }, timeMs),
    )
  }
  return positions
}

/** How a Pulse ended, in words a viewer can read without being told: the headline, why, and how it reads —
 *  and, in a mission, where the mission stands and what the result's row goes on to. */
export type PulseResult = Readonly<{
  headline: string
  reason: string
  tone: StatusTone
  /** The mission's line under the reason: which round this was and that the Nexus stands, or, once the
   *  mission is over, what the last round was. */
  mission?: string
  /** What the row at the foot of the result does: "Next round", or "Play again" once the mission is
   *  over. Absent for a Pulse with no mission, which goes nowhere. */
  goOn?: string
  /** The one line under the map once the result stands. */
  line?: string
}>

/** A mission's round, as the result reads it — `pulse-live.ts`'s `MissionRound`, restated here so this
 *  file stays below the presenter. */
type Round = Readonly<{
  verdict: Readonly<{ kind: "continue" | "won" | "lost" }>
  round: number
  of: number
  endText?: Readonly<{ won: string; lost: string }>
}>

/**
 * The result in a mission. A round the mission goes on from keeps the kernel's own headline —
 * the fight was won, lost or ran out of time, and that is true — and says under it which round this was
 * and that the Nexus stands. A mission a trigger ended says so instead, in the mission's own words: the
 * hold's "The perimeter held." is not a draw, whatever the kernel's tick limit calls the last Pulse
 * (the mission's goal is read one level above the victory check, which never changes).
 */
export function missionResultOf(fight: PulseResult, round: Round | undefined): PulseResult {
  if (round === undefined) return fight
  // What the fight itself was, kept under a mission's verdict: the verdict says the mission, this says why.
  const last = `Round ${round.round} of ${round.of}: ${fight.headline.toLowerCase()}. ${fight.reason}`
  switch (round.verdict.kind) {
    case "won": {
      const reason = round.endText?.won ?? "The mission's goal is met."
      return { headline: "MISSION COMPLETE", reason, tone: "success", mission: last, goOn: "Play again", line: `MISSION COMPLETE - ${reason}` }
    }
    case "lost": {
      const reason = round.endText?.lost ?? "The mission is lost."
      return { headline: "MISSION FAILED", reason, tone: "danger", mission: last, goOn: "Play again", line: `MISSION FAILED - ${reason}` }
    }
    default:
      return {
        ...fight,
        mission: `Round ${round.round} of ${round.of} is over. The Nexus stands.`,
        goOn: "Next round",
        line: `Round ${round.round} of ${round.of} over - ${fight.headline.toLowerCase()}. Enter: Build Phase ${round.round + 1}.`,
      }
  }
}

/**
 * The result for the player, side A. The kernel's own three endings (`pulse.md`) — a Nexus destroyed,
 * a force wiped out, the tick limit — and both sides' luck at once. A time-out is a draw here, as the
 * kernel has it: whether "still standing when the raid's schedule ends" should read as a win is a
 * mission's question, not this view's.
 */
export function resultOf(outcome: Outcome, player: PlayerId = "A"): PulseResult {
  if (outcome.winner === null) {
    if (outcome.reason === "tick-limit") {
      return { headline: "TIME'S UP", reason: "The time ran out before either side won.", tone: "neutral" }
    }
    return {
      headline: "DRAW",
      reason: outcome.reason === "nexus-destroyed" ? "Both Nexuses were destroyed." : "Both sides were wiped out.",
      tone: "neutral",
    }
  }
  const won = outcome.winner === player
  if (outcome.reason === "nexus-destroyed") {
    return won
      ? { headline: "VICTORY", reason: "The raid's Nexus was destroyed.", tone: "success" }
      : { headline: "DEFEAT", reason: "Your Nexus was destroyed.", tone: "danger" }
  }
  return won
    ? { headline: "VICTORY", reason: "The raid was wiped out.", tone: "success" }
    : { headline: "DEFEAT", reason: "Your force was wiped out.", tone: "danger" }
}
