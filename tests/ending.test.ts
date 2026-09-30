// The Nexus Pulse's ending — gate 6A, the owner's sketch (milestone 6, Section 2.2) and his answer to its
// first build (feedback F43-F45). Every moment of it is a pure function of presentation time, so the tests
// are arithmetic: the moments, their order at every timing they could be given, the timer and its flash,
// the light that sweeps the border, the red that means the Nexus is hurt, the walk home, and the words of
// the result.

import { test } from "node:test"
import assert from "node:assert/strict"
import { DEBUG_FIELDS } from "../src/build/debug.ts"
import type { DebugFlags } from "../src/build/debug.ts"
import type { RecallMove } from "../src/match/index.ts"
import type { Outcome } from "../src/state/types.ts"
import {
  BEAM_FADE_MS,
  BEAM_GLOW,
  ENDING_TUNING,
  BEAM_PEAK,
  BEAM_PERIOD_MS,
  BEAM_STEADY,
  BEAM_TAIL_CELLS,
  RED_DEFEAT_MS,
  RED_FIRST_HIT_MS,
  RED_LOW_BLIP_MS,
  RED_LOW_EVERY_MS,
  RED_PEAK,
  TIMER_HALF_PERIOD_MS,
  beamAt,
  endingTimes,
  formatTimer,
  nexusStrain,
  phaseAt,
  redAlert,
  resultOf,
  timerLit,
  timerSeconds,
  walkPositions,
} from "../src/view/ending.ts"
import type { EndingPhase, EndingTimings, NexusStrain } from "../src/view/ending.ts"
import { DEFENCE, play } from "./pulse-helpers.ts"

/** The owner's first sketch of the ending (2026-09-17): a fixture for the arithmetic below, with round
 *  numbers. The game plays his tuned timings (`ENDING_TUNING`), the next test's. */
const SKETCH: EndingTimings = { endWarnMs: 3000, endWalkPauseMs: 1000, endWalkMs: 2000 }

test("the ending is the owner's: a warning in the last 3 s, half a second to the walk, one second of walking", () => {
  // "some visual warning ... then after 3-5 seconds, the units stop shooting, 1 second later they start
  // walking back, 2 seconds later the build phase begins" (owner, 2026-09-17), "the last 3 seconds"
  // (2026-09-29), and the pause and the walk halved in his settings export (2026-09-30).
  assert.deepEqual(ENDING_TUNING, { endWarnMs: 3000, endWalkPauseMs: 500, endWalkMs: 1000 })
  const times = endingTimes(20_000, 20_400, ENDING_TUNING)
  assert.equal(times.stopMs, 20_000)
  assert.equal(times.warnMs, 17_000, "the warning starts three seconds before the shooting stops")
  assert.equal(times.walkMs, 20_500, "the walk starts half a second after it stops")
  assert.equal(times.homeMs, 21_500, "and takes one second")
})

test("the walk waits for every effect in flight to land, and never starts before the pause is up", () => {
  // "effects already in flight finish their own authored windows... then Recall plays".
  assert.equal(endingTimes(20_000, 22_500, SKETCH).walkMs, 22_500)
  assert.equal(endingTimes(20_000, 20_300, SKETCH).walkMs, 21_000)
  assert.equal(endingTimes(20_000, 20_300, { ...SKETCH, endWalkPauseMs: 0 }).walkMs, 20_300)
})

test("no warning means none, and a short Pulse's warning cannot start before the Pulse does", () => {
  assert.equal(endingTimes(20_000, 20_000, { ...SKETCH, endWarnMs: 0 }).warnMs, null)
  assert.equal(endingTimes(2_500, 2_500, SKETCH).warnMs, 0, "the warning was scheduled before time zero")
  assert.equal(endingTimes(20_000, 20_000, { ...SKETCH, endWalkMs: 0 }).homeMs, 21_000, "no walk: home the moment it starts")
})

test("the phases come in order and never go backwards, at every value the ending's timings were tried at", () => {
  // The values each timing's Experiment offered until the owner settled them (2026-09-30).
  const tried: Readonly<Record<keyof EndingTimings, readonly number[]>> = {
    endWarnMs: [0, 1000, 2000, 3000, 4000, 5000, 6000, 8000],
    endWalkPauseMs: [0, 500, 1000, 1500, 2000, 3000],
    endWalkMs: [0, 1000, 2000, 3000, 4000, 6000],
  }
  const values = (field: keyof EndingTimings): readonly number[] => tried[field]
  const order: readonly EndingPhase[] = ["fighting", "final", "halted", "walking", "home"]
  let combinations = 0
  for (const endWarnMs of values("endWarnMs")) {
    for (const endWalkPauseMs of values("endWalkPauseMs")) {
      for (const endWalkMs of values("endWalkMs")) {
        for (const [stop, effectsEnd] of [[600, 600], [9_000, 9_500], [20_000, 23_000], [30_000, 30_100]] as const) {
          const flags = { endWarnMs, endWalkPauseMs, endWalkMs }
          const times = endingTimes(stop, effectsEnd, flags)
          assert.ok((times.warnMs ?? 0) <= times.stopMs, "the warning starts after the fight stops")
          assert.ok(times.stopMs <= times.walkMs && times.walkMs <= times.homeMs, "the moments are out of order")
          let last = -1
          for (let t = 0; t <= times.homeMs + 500; t += 50) {
            const index = order.indexOf(phaseAt(times, t))
            assert.ok(index >= last, `${JSON.stringify(flags)} at ${t} ms went back from ${order[last]} to ${order[index]}`)
            last = index
          }
          assert.equal(phaseAt(times, 0), times.warnMs === 0 ? "final" : "fighting")
          assert.equal(phaseAt(times, times.homeMs + 1), "home")
          assert.equal(phaseAt(times, times.stopMs), times.walkMs === times.stopMs ? (times.homeMs === times.walkMs ? "home" : "walking") : "halted")
          combinations += 1
        }
      }
    }
  }
  assert.ok(combinations > 500, "the sweep did not cover the timings")
})

test("the timer counts down to the stop in whole seconds, and reads 0:00 once it has", () => {
  const times = endingTimes(14_580, 14_900, SKETCH)
  assert.equal(timerSeconds(times, 0), 15, "14.58 s left is 15 on the clock: a part of a second is the second it is in")
  assert.equal(timerSeconds(times, 11_579), 4)
  assert.equal(timerSeconds(times, 11_580), 3)
  assert.equal(timerSeconds(times, 14_579), 1)
  assert.equal(timerSeconds(times, 14_580), 0)
  assert.equal(timerSeconds(times, 30_000), 0, "it went negative after the stop")
  assert.deepEqual([0, 7, 12, 59, 60, 61, 600].map(formatTimer), ["0:00", "0:07", "0:12", "0:59", "1:00", "1:01", "10:00"])
})

test("only the timer flashes, and only in the last seconds: on and off from the moment they begin", () => {
  const times = endingTimes(20_000, 20_000, SKETCH) // the last seconds: 17 000 -> 20 000
  assert.equal(timerLit(times, 16_999, false), false, "it flashed before the last seconds")
  assert.equal(timerLit(times, 17_000, false), true)
  assert.equal(timerLit(times, 17_000 + TIMER_HALF_PERIOD_MS - 1, false), true)
  assert.equal(timerLit(times, 17_000 + TIMER_HALF_PERIOD_MS, false), false)
  assert.equal(timerLit(times, 17_000 + 2 * TIMER_HALF_PERIOD_MS, false), true)
  assert.equal(timerLit(times, 19_999, false) || !timerLit(times, 19_999, false), true)
  assert.equal(timerLit(times, 20_000, false), false, "it kept flashing after the shooting stopped")
  // Reduced motion holds it lit — a steady cue, not an absent one — and no warning lights nothing.
  for (let t = 17_000; t < 20_000; t += 130) assert.equal(timerLit(times, t, true), true)
  assert.equal(timerLit(times, 16_000, true), false)
  assert.equal(timerLit(endingTimes(20_000, 20_000, { ...SKETCH, endWarnMs: 0 }), 19_000, false), false)
})

test("the light sweeps round the border in the last seconds, clockwise, with a tail behind its head", () => {
  const times = endingTimes(20_000, 20_000, SKETCH)
  const length = 134
  const at = (timeMs: number): number[] => Array.from({ length }, (_, index) => beamAt(times, timeMs, index, length, false))
  const peakIndex = (levels: readonly number[]): number => levels.indexOf(Math.max(...levels))
  // Nothing before it begins, and nothing a moment after the shooting has stopped.
  assert.ok(at(16_999).every((level) => level === 0))
  assert.ok(at(20_000 + BEAM_FADE_MS).every((level) => level === 0))
  // Halfway round after half a period: the head has moved on, clockwise (a higher index), by about half.
  const settled = 17_000 + BEAM_FADE_MS
  const first = peakIndex(at(settled))
  const later = peakIndex(at(settled + BEAM_PERIOD_MS / 4))
  assert.ok(later > first && later - first < length / 2, `the head went from ${first} to ${later}, not a quarter turn clockwise`)
  // The head is the brightest cell, the tail fades to the glow behind it, and nothing is ever brighter than the peak.
  const levels = at(settled + 250)
  const head = peakIndex(levels)
  assert.ok(levels[head]! <= BEAM_PEAK + 1e-9)
  for (let step = 1; step < BEAM_TAIL_CELLS; step += 1) {
    const behind = levels[(head - step + length) % length]!
    const before = levels[(head - step + 1 + length) % length]!
    assert.ok(behind <= before + 1e-9, "the tail brightens away from the head")
  }
  assert.ok(Math.abs(levels[(head + 5) % length]! - BEAM_GLOW) < 1e-9, "ahead of the head the border has only the glow")
  // It comes up and goes out gently.
  assert.ok(Math.max(...at(17_000 + BEAM_FADE_MS / 2)) < Math.max(...at(settled)), "it did not fade in")
  assert.ok(Math.max(...at(20_000 + BEAM_FADE_MS / 2)) < Math.max(...at(20_000 - 1)), "it did not fade out")
  // No warning, no light.
  const none = endingTimes(20_000, 20_000, { ...SKETCH, endWarnMs: 0 })
  assert.ok(Array.from({ length }, (_, index) => beamAt(none, 19_000, index, length, false)).every((level) => level === 0))
})

test("under reduced motion the light is one steady glow, the same on every cell, for as long as the warning lasts", () => {
  const times = endingTimes(20_000, 20_000, SKETCH)
  for (const t of [17_000, 18_333, 19_999]) {
    const levels = Array.from({ length: 40 }, (_, index) => beamAt(times, t, index, 40, true))
    assert.ok(levels.every((level) => level === BEAM_STEADY), `not steady at ${t} ms`)
  }
  assert.equal(beamAt(times, 16_999, 3, 40, true), 0)
})

test("red means one thing: the player's Nexus is hurt — its first hit, very low health, a lost Pulse", () => {
  const times = endingTimes(20_000, 20_000, SKETCH) // home at 23 000
  const hurt: NexusStrain = { hitMs: 5_000, lowMs: 12_000, fallMs: 18_000 }
  const red = (strain: NexusStrain, t: number, defeated = false, reduced = false): number => redAlert(strain, times, defeated, t, reduced)
  // Nothing before the first hit, and nothing for a Nexus that was never hurt.
  assert.equal(red(hurt, 4_999), 0)
  assert.equal(red({ hitMs: null, lowMs: null, fallMs: null }, 10_000, false), 0)
  // The first hit: a short flash that fades to nothing.
  assert.ok(Math.abs(red(hurt, 5_000) - RED_PEAK) < 1e-9)
  assert.ok(red(hurt, 5_000 + RED_FIRST_HIT_MS / 2) < red(hurt, 5_000))
  assert.equal(red(hurt, 5_000 + RED_FIRST_HIT_MS), 0)
  // Very low health: a shorter blip every second and a half while it lasts, until the Nexus falls.
  for (const start of [12_000, 12_000 + RED_LOW_EVERY_MS, 12_000 + 2 * RED_LOW_EVERY_MS]) {
    assert.ok(red(hurt, start) > 0, `no blip at ${start}`)
    assert.equal(red(hurt, start + RED_LOW_BLIP_MS), 0, `the blip at ${start} was too long`)
  }
  assert.equal(red(hurt, 12_000 + 3 * RED_LOW_EVERY_MS - 1), 0, "it flashed between blips")
  assert.equal(red(hurt, 18_000 + 200), 0, "it kept blipping after the Nexus fell")
  // A lost Pulse: one more, when the result appears, and only for a loss.
  assert.ok(red(hurt, times.homeMs, true) > 0)
  assert.equal(red(hurt, times.homeMs + RED_DEFEAT_MS, true), 0)
  assert.equal(red(hurt, times.homeMs, false), 0, "a won or drawn Pulse flashed red")
  // Never more than the faint ceiling, and none at all under reduced motion.
  for (let t = 0; t < 25_000; t += 25) assert.ok(red(hurt, t, true) <= RED_PEAK + 1e-9)
  for (let t = 0; t < 25_000; t += 250) assert.equal(red(hurt, t, true, true), 0)
})

test("the strain on a Nexus is read from the Pulse: its first hit, when it was nearly gone, when it fell", () => {
  // No units of your own: the raid goes for the Nexus, and it falls (a kernel ending) — so all three happen.
  const lost = play({ crew: 1 }).pulse.timeline
  const strain = nexusStrain(lost)
  assert.ok(strain.hitMs !== null && strain.lowMs !== null && strain.fallMs !== null, JSON.stringify(strain))
  assert.ok(strain.hitMs <= strain.lowMs && strain.lowMs <= strain.fallMs, "a Nexus fell before it was hurt")
  const lastTick = lost.states[lost.states.length - 1]!.tick
  const stopMs = (lastTick * 1000) / lost.ticksPerSecond
  assert.ok(strain.fallMs <= stopMs + 1000, "it fell after the Pulse ended")
  // A defence that holds may never let the raid touch the Nexus at all; whatever happened, the order holds.
  const held = nexusStrain(play({ plan: DEFENCE }).pulse.timeline)
  if (held.lowMs !== null) assert.ok(held.hitMs !== null && held.hitMs <= held.lowMs)
  // The other side's Nexus is not the player's: side B has none in the spike.
  assert.deepEqual(nexusStrain(lost, "B"), { hitMs: null, lowMs: null, fallMs: null })
})

const MOVES: readonly RecallMove[] = [
  { ordinal: 3, player: "A", contentId: "unit.citizen.trooper", from: { x: 40, y: 10 }, to: { x: 20, y: 12 }, home: "nexus" },
  { ordinal: 5, player: "A", contentId: "unit.citizen.marksman", from: { x: 30, y: 4 }, to: { x: 30, y: 4 }, home: "none" },
]

test("the walk home runs from where the fight left each survivor to the tile Recall gave it", () => {
  const times = endingTimes(10_000, 10_000, SKETCH) // walks 11 000 -> 13 000
  assert.equal(walkPositions(MOVES, times, 10_999, false).size, 0, "a survivor moved before the walk began")
  const start = walkPositions(MOVES, times, 11_000, false)
  assert.deepEqual(start.get(3), { x: 40, y: 10 })
  const end = walkPositions(MOVES, times, 13_000, false)
  assert.deepEqual(end.get(3), { x: 20, y: 12 }, "the survivor is not home when the walk ends")
  assert.deepEqual(end.get(5), { x: 30, y: 4 })
  assert.deepEqual(walkPositions(MOVES, times, 99_000, false).get(3), { x: 20, y: 12 }, "and it stays there")
  // On the way, never further from home than it was, and always on a whole tile.
  let previous = Number.POSITIVE_INFINITY
  for (let t = 11_000; t <= 13_000; t += 100) {
    const at = walkPositions(MOVES, times, t, false).get(3) as { x: number; y: number }
    assert.ok(Number.isInteger(at.x) && Number.isInteger(at.y), "a half tile")
    const left = Math.abs(at.x - 20) + Math.abs(at.y - 12)
    assert.ok(left <= previous, `the survivor went backwards at ${t} ms`)
    previous = left
  }
  const halfway = walkPositions(MOVES, times, 12_000, false).get(3) as { x: number; y: number }
  assert.ok(halfway.x < 40 && halfway.x > 20, "halfway through the walk it is neither at the start nor home")
})

test("a walk of no time, and reduced motion, put everyone home the moment the walk would begin", () => {
  const instant = endingTimes(10_000, 10_000, { ...SKETCH, endWalkMs: 0 })
  assert.deepEqual(walkPositions(MOVES, instant, instant.walkMs, false).get(3), { x: 20, y: 12 })
  const times = endingTimes(10_000, 10_000, SKETCH)
  assert.deepEqual(walkPositions(MOVES, times, times.walkMs, true).get(3), { x: 20, y: 12 }, "reduced motion walked")
})

function outcome(winner: Outcome["winner"], reason: Outcome["reason"]): Outcome {
  return { winner, reason, tick: 100 }
}

test("the result says what happened in words: won, lost, drawn or timed out — and why", () => {
  assert.deepEqual(resultOf(outcome("A", "annihilation")), {
    headline: "VICTORY",
    reason: "The raid was wiped out.",
    tone: "success",
  })
  assert.deepEqual(resultOf(outcome("A", "nexus-destroyed")), {
    headline: "VICTORY",
    reason: "The raid's Nexus was destroyed.",
    tone: "success",
  })
  assert.deepEqual(resultOf(outcome("B", "annihilation")), {
    headline: "DEFEAT",
    reason: "Your force was wiped out.",
    tone: "danger",
  })
  assert.deepEqual(resultOf(outcome("B", "nexus-destroyed")), {
    headline: "DEFEAT",
    reason: "Your Nexus was destroyed.",
    tone: "danger",
  })
  assert.deepEqual(resultOf(outcome(null, "tick-limit")), {
    headline: "TIME'S UP",
    reason: "The time ran out before either side won.",
    tone: "neutral",
  })
  assert.equal(resultOf(outcome(null, "annihilation")).headline, "DRAW")
  assert.equal(resultOf(outcome(null, "nexus-destroyed")).headline, "DRAW")
  // Side B's point of view is the mirror image.
  assert.equal(resultOf(outcome("B", "annihilation"), "B").headline, "VICTORY")
})

test("the placeholder Pulse's Experiments need no restart, and each names the question it serves", () => {
  for (const field of ["raid", "crew"] as const satisfies readonly (keyof DebugFlags)[]) {
    const spec = DEBUG_FIELDS.find((candidate) => candidate.field === field)
    assert.ok(spec !== undefined, `${field} is not an Experiment`)
    assert.equal(spec.applies, "now")
    assert.ok(spec.question.length > 30, `${field} does not say what it is for`)
  }
})
