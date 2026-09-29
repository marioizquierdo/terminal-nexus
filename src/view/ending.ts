// How a Nexus Pulse ends on screen — the owner's sketch (milestone-06-pulse-phase.md Section 2.2), built
// to be watched and retuned, and every moment of it a pure function of presentation time:
//
//   the fight is shown as it happened ............................ "fighting"
//   an alarm sounds a few seconds before the shooting stops ...... "alarm"       (Experiment: Alarm lead)
//   the last tick is shown and nothing shoots any more ........... "halted"      (effects in flight land)
//   the survivors walk home ...................................... "walking"     (Walk-back delay, time)
//   everyone is home; the result stands .......................... "home"
//
// **The kernel decided the ending long before any of this plays**: the timeline is resolved whole before
// the first frame, so presentation knows when the last tick is and can put the alarm ahead of it. That is
// what makes it pacing — "just an idea for UX, to create anticipation and not just stop the pulse right
// away" (owner, 2026-09-17) — and why it means the same for a Nexus that fell, a force wiped out, and
// the clock running out: it is a flourish on an ending that already happened.
//
// **Recall's state change is instant** (engine.md Section 5), and belongs to `src/match/recall.ts`. What
// is drawn here is the walk home on top of it: presentation only, from where the fight left each survivor
// to the tile Recall gave it. Nothing in this file can change a state, an event or a hash.

import type { DebugFlags } from "../build/debug.ts"
import type { Coord } from "../grid/types.ts"
import type { RecallMove } from "../match/types.ts"
import type { Outcome, PlayerId } from "../state/types.ts"
import type { StatusTone } from "../status.ts"
import { tileAt } from "./tween.ts"

/** The moments of one Pulse's ending, in presentation milliseconds from the Pulse's start. */
export type EndingTimes = Readonly<{
  /** The last tick is shown: the fight has stopped, and nothing shoots after it. */
  stopMs: number
  /** When the alarm begins, or `null` for no alarm — "Alarm lead" at off. Never before the Pulse starts. */
  alarmMs: number | null
  /** When the survivors start walking home: the pause after the stop, or later, once every effect in
   *  flight has landed ("then Recall plays"). */
  walkMs: number
  /** When the walk ends and the result is shown — `walkMs` itself for a walk-back of no time. */
  homeMs: number
}>

export type EndingFlags = Pick<DebugFlags, "endAlarmLeadMs" | "endWalkPauseMs" | "endWalkMs">

export function endingTimes(
  lastTickMs: number,
  effectsEndMs: number,
  flags: EndingFlags,
): EndingTimes {
  const stopMs = lastTickMs
  const walkMs = Math.max(stopMs + flags.endWalkPauseMs, effectsEndMs)
  return {
    stopMs,
    alarmMs: flags.endAlarmLeadMs > 0 ? Math.max(0, stopMs - flags.endAlarmLeadMs) : null,
    walkMs,
    homeMs: walkMs + flags.endWalkMs,
  }
}

export type EndingPhase = "fighting" | "alarm" | "halted" | "walking" | "home"

export function phaseAt(times: EndingTimes, timeMs: number): EndingPhase {
  if (timeMs >= times.homeMs) return "home"
  if (timeMs >= times.walkMs) return "walking"
  if (timeMs >= times.stopMs) return "halted"
  if (times.alarmMs !== null && timeMs >= times.alarmMs) return "alarm"
  return "fighting"
}

/** Half a period of the alarm's flash: on for this long, off for this long. */
export const ALARM_HALF_PERIOD_MS = 350

/**
 * Whether the alarm's flash is lit at this instant. Reduced motion holds it lit rather than flashing —
 * the cue is a steady one instead of a blink, never an absent one.
 */
export function alarmLit(times: EndingTimes, timeMs: number, reducedMotion: boolean): boolean {
  if (times.alarmMs === null) return false
  if (reducedMotion) return true
  return Math.floor(Math.max(0, timeMs - times.alarmMs) / ALARM_HALF_PERIOD_MS) % 2 === 0
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

/** How a Pulse ended, in words a viewer can read without being told: the headline, why, and how it reads. */
export type PulseResult = Readonly<{
  headline: string
  reason: string
  tone: StatusTone
}>

/**
 * The result for the player, side A. The kernel's own three endings (engine.md 4.3) — a Nexus destroyed,
 * a force wiped out, the tick limit — and both sides' luck at once. A time-out is a draw here, as the
 * kernel has it: whether "still standing when the raid's schedule ends" should read as a win is a
 * mission's question (Q36), not this view's.
 */
export function resultOf(outcome: Outcome, player: PlayerId = "A"): PulseResult {
  if (outcome.winner === null) {
    if (outcome.reason === "tick-limit") {
      return { headline: "TIME'S UP", reason: "The time ran out with both sides still standing.", tone: "neutral" }
    }
    return {
      headline: "DRAW",
      reason: outcome.reason === "nexus-destroyed" ? "Both Nexuses were destroyed." : "Both forces were wiped out.",
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
    : { headline: "DEFEAT", reason: "Your forces were wiped out.", tone: "danger" }
}
