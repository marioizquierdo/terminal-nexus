// The Nexus Pulse's ending — gate 6A, the owner's sketch (milestone 6, Section 2.2). Every moment of it is a
// pure function of presentation time, so the tests are arithmetic: the moments, their order at every
// Experiment value, the alarm's flash, the walk home, and the words of the result.

import { test } from "node:test"
import assert from "node:assert/strict"
import { DEBUG_FIELDS, DEFAULT_ENDING } from "../src/build/debug.ts"
import type { DebugFlags } from "../src/build/debug.ts"
import type { RecallMove } from "../src/match/index.ts"
import type { Outcome } from "../src/state/types.ts"
import {
  ALARM_HALF_PERIOD_MS,
  alarmLit,
  endingTimes,
  phaseAt,
  resultOf,
  walkPositions,
} from "../src/view/ending.ts"
import type { EndingFlags, EndingPhase } from "../src/view/ending.ts"

const SKETCH: EndingFlags = {
  endAlarmLeadMs: DEFAULT_ENDING.endAlarmLeadMs,
  endWalkPauseMs: DEFAULT_ENDING.endWalkPauseMs,
  endWalkMs: DEFAULT_ENDING.endWalkMs,
}

test("the defaults are the owner's sketch: an alarm ~4 s ahead, one second to the walk, two of walking", () => {
  // "some visual warning, like an alarm, then after 3-5 seconds, the units stop shooting, 1 second later
  // they start walking back, 2 seconds later the build phase begins" (owner, 2026-09-17).
  assert.deepEqual(SKETCH, { endAlarmLeadMs: 4000, endWalkPauseMs: 1000, endWalkMs: 2000 })
  const times = endingTimes(20_000, 20_400, SKETCH)
  assert.equal(times.stopMs, 20_000)
  assert.equal(times.alarmMs, 16_000, "the alarm starts four seconds before the shooting stops")
  assert.equal(times.walkMs, 21_000, "the walk starts one second after it stops")
  assert.equal(times.homeMs, 23_000, "and takes two seconds")
})

test("the walk waits for every effect in flight to land, and never starts before the pause is up", () => {
  // "effects already in flight finish their own authored windows... then Recall plays".
  assert.equal(endingTimes(20_000, 22_500, SKETCH).walkMs, 22_500)
  assert.equal(endingTimes(20_000, 20_300, SKETCH).walkMs, 21_000)
  assert.equal(endingTimes(20_000, 20_300, { ...SKETCH, endWalkPauseMs: 0 }).walkMs, 20_300)
})

test("no alarm lead means no alarm, and a short Pulse's alarm cannot start before the Pulse does", () => {
  assert.equal(endingTimes(20_000, 20_000, { ...SKETCH, endAlarmLeadMs: 0 }).alarmMs, null)
  assert.equal(endingTimes(2_500, 2_500, SKETCH).alarmMs, 0, "the alarm was scheduled before time zero")
  assert.equal(endingTimes(20_000, 20_000, { ...SKETCH, endWalkMs: 0 }).homeMs, 21_000, "no walk: home the moment it starts")
})

test("the phases come in order and never go backwards, at every value of every ending Experiment", () => {
  const values = (field: keyof EndingFlags): readonly number[] => {
    const spec = DEBUG_FIELDS.find((candidate) => candidate.field === field)
    assert.ok(spec !== undefined, `${field} is not an Experiment`)
    return spec.values as readonly number[]
  }
  const order: readonly EndingPhase[] = ["fighting", "alarm", "halted", "walking", "home"]
  let combinations = 0
  for (const endAlarmLeadMs of values("endAlarmLeadMs")) {
    for (const endWalkPauseMs of values("endWalkPauseMs")) {
      for (const endWalkMs of values("endWalkMs")) {
        for (const [stop, effectsEnd] of [[600, 600], [9_000, 9_500], [20_000, 23_000], [30_000, 30_100]] as const) {
          const flags = { endAlarmLeadMs, endWalkPauseMs, endWalkMs }
          const times = endingTimes(stop, effectsEnd, flags)
          assert.ok((times.alarmMs ?? 0) <= times.stopMs, "the alarm starts after the fight stops")
          assert.ok(times.stopMs <= times.walkMs && times.walkMs <= times.homeMs, "the moments are out of order")
          let last = -1
          for (let t = 0; t <= times.homeMs + 500; t += 50) {
            const index = order.indexOf(phaseAt(times, t))
            assert.ok(index >= last, `${JSON.stringify(flags)} at ${t} ms went back from ${order[last]} to ${order[index]}`)
            last = index
          }
          assert.equal(phaseAt(times, 0), times.alarmMs === 0 ? "alarm" : "fighting")
          assert.equal(phaseAt(times, times.homeMs + 1), "home")
          assert.equal(phaseAt(times, times.stopMs), times.walkMs === times.stopMs ? (times.homeMs === times.walkMs ? "home" : "walking") : "halted")
          combinations += 1
        }
      }
    }
  }
  assert.ok(combinations > 500, "the sweep did not cover the Experiments")
})

test("the alarm is only ever in the run-up to the stop, and flashes on and off while it lasts", () => {
  const times = endingTimes(20_000, 20_000, SKETCH)
  assert.equal(phaseAt(times, 15_999), "fighting")
  assert.equal(phaseAt(times, 16_000), "alarm")
  assert.equal(phaseAt(times, 19_999), "alarm")
  assert.equal(phaseAt(times, 20_000), "halted")
  // Lit for a half period, dark for the next, and so on from the moment it starts.
  assert.equal(alarmLit(times, 16_000, false), true)
  assert.equal(alarmLit(times, 16_000 + ALARM_HALF_PERIOD_MS - 1, false), true)
  assert.equal(alarmLit(times, 16_000 + ALARM_HALF_PERIOD_MS, false), false)
  assert.equal(alarmLit(times, 16_000 + 2 * ALARM_HALF_PERIOD_MS, false), true)
  // Reduced motion holds it lit: a steady cue, not an absent one. No alarm, nothing lit.
  for (let t = 16_000; t < 20_000; t += 130) assert.equal(alarmLit(times, t, true), true)
  assert.equal(alarmLit(endingTimes(20_000, 20_000, { ...SKETCH, endAlarmLeadMs: 0 }), 19_000, false), false)
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

test("no ending Experiment needs a restart, and each names the question it serves", () => {
  for (const field of ["endAlarmLeadMs", "endWalkPauseMs", "endWalkMs", "endCentre", "raid", "crew"] as const satisfies readonly (keyof DebugFlags)[]) {
    const spec = DEBUG_FIELDS.find((candidate) => candidate.field === field)
    assert.ok(spec !== undefined, `${field} is not an Experiment`)
    assert.equal(spec.applies, "now")
    assert.ok(spec.question.length > 30, `${field} does not say what it is for`)
  }
})
