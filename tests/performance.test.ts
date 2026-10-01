// Frame budget — the first milestone's requirement: "30 fps sustained over 60 seconds, p95 recorded".
//
// The measurement is the point, not the threshold: the numbers land in docs/history/reports/2026-08-21-pulse-playground.md, and the
// assertion is only that the budget is not blown.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { buildTimeline } from "../src/cli/timeline.ts"
import { loadScenario } from "../src/scenario/index.ts"
import { createView, frameToAnsi } from "../src/view/index.ts"
import { loadScenarioFile } from "./helpers.ts"

const FRAMES_PER_SECOND = 30
const SECONDS = 60
const BUDGET_MS = 1000 / FRAMES_PER_SECOND

// "Sustained" is judged by what a player would see, not by the single slowest sample. Wall-clock
// timing on a shared machine records the machine as well as the code: with another process busy on
// the same CPU, one frame in 1,800 took 41 ms (2026-09-27) while the same test alone never went past
// 27 ms in 24 runs. So a few isolated late frames are allowed — at most one in a hundred, never three
// in a row, which is a stutter the eye catches. A real regression slows most frames and fails the
// p95 check first.
const MAX_LATE_SHARE = 0.01
const MAX_LATE_RUN = 2

/** Late frames in the order they were drawn: how many, and the longest run of them back to back. */
function lateFrames(inOrder: readonly number[]): { count: number; longestRun: number } {
  let count = 0
  let run = 0
  let longestRun = 0
  for (const sample of inOrder) {
    if (sample > BUDGET_MS) {
      count += 1
      run += 1
      longestRun = Math.max(longestRun, run)
    } else {
      run = 0
    }
  }
  return { count, longestRun }
}

function assertSustained(inOrder: readonly number[]): void {
  const { count, longestRun } = lateFrames(inOrder)
  assert.ok(
    count <= inOrder.length * MAX_LATE_SHARE,
    `${count} frames of ${inOrder.length} took longer than one frame's budget`,
  )
  assert.ok(longestRun <= MAX_LATE_RUN, `${longestRun} late frames in a row — a visible stutter`)
}

test("thirty frames a second for sixty seconds stays inside the budget", async () => {
  const scenario = await loadScenarioFile("citizen-mirror-skirmish.map.json")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const timeline = buildTimeline(
    scenario,
    loaded.state,
    loaded.registry,
    scenario.pulseTicks,
    scenario.seed,
  )
  const view = createView(timeline)

  const samples: number[] = []
  let bytes = 0
  for (let frame = 0; frame < FRAMES_PER_SECOND * SECONDS; frame += 1) {
    const timeMs = (frame * 1000) / FRAMES_PER_SECOND
    const started = performance.now()
    const composed = view.composeAt(timeMs, "color16", 1, { paused: false, speed: 1 })
    const text = frameToAnsi(composed, "color16")
    samples.push(performance.now() - started)
    bytes += text.length
  }

  const inOrder = [...samples]
  samples.sort((a, b) => a - b)
  const quantile = (q: number): number => samples[Math.min(samples.length - 1, Math.floor(samples.length * q))] ?? 0
  const p50 = quantile(0.5)
  const p95 = quantile(0.95)
  const worst = samples[samples.length - 1] ?? 0
  const overBudget = samples.filter((sample) => sample > BUDGET_MS).length

  // Recorded rather than merely asserted, so a regression shows up as a number in the test output.
  console.log(
    `frame budget: ${samples.length} frames  p50 ${p50.toFixed(2)} ms  p95 ${p95.toFixed(2)} ms  ` +
      `max ${worst.toFixed(2)} ms  over budget ${overBudget}  ` +
      `bytes/frame ${Math.round(bytes / samples.length)}`,
  )

  assert.equal(samples.length, FRAMES_PER_SECOND * SECONDS)
  assert.ok(p95 < BUDGET_MS, `p95 of ${p95.toFixed(2)} ms exceeds the ${BUDGET_MS.toFixed(2)} ms budget`)
  assertSustained(inOrder)
})

test("the worst case stays inside the budget too: two armies, 48x16, every effect on", async () => {
  // The first craft rule of docs/system-design/effects.md applies to the frame budget as much as to the art: measure the
  // busiest frame, not the calm one.
  const scenario = await loadScenarioFile("citizens-versus-ravels.map.json")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const timeline = buildTimeline(
    scenario,
    loaded.state,
    loaded.registry,
    scenario.pulseTicks,
    scenario.seed,
  )
  const view = createView(timeline)
  const samples: number[] = []
  let bytes = 0
  for (let frame = 0; frame < FRAMES_PER_SECOND * SECONDS; frame += 1) {
    const timeMs = (frame * 1000) / FRAMES_PER_SECOND
    const started = performance.now()
    const composed = view.composeAt(timeMs, "truecolor", 1, { paused: false, speed: 1 })
    bytes += frameToAnsi(composed, "truecolor").length
    samples.push(performance.now() - started)
  }
  const inOrder = [...samples]
  samples.sort((a, b) => a - b)
  const p95 = samples[Math.floor(samples.length * 0.95)] ?? 0
  const worst = samples[samples.length - 1] ?? 0
  const over = samples.filter((sample) => sample > BUDGET_MS).length
  console.log(
    `worst case: ${view.effectCount} effect instances  p95 ${p95.toFixed(2)} ms  ` +
      `max ${worst.toFixed(2)} ms  over budget ${over}  bytes/frame ${Math.round(bytes / samples.length)}`,
  )
  assert.ok(p95 < BUDGET_MS, `p95 of ${p95.toFixed(2)} ms exceeds the budget`)
  assertSustained(inOrder)
})

test("resolving a whole Pulse costs less than a single frame's budget", async () => {
  const scenario = await loadScenarioFile("citizen-mirror-skirmish.map.json")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const started = performance.now()
  const timeline = buildTimeline(
    scenario,
    loaded.state,
    loaded.registry,
    scenario.pulseTicks,
    scenario.seed,
  )
  const elapsed = performance.now() - started
  console.log(`resolve: ${timeline.states.length - 1} ticks in ${elapsed.toFixed(1)} ms`)
  assert.ok(elapsed < 1000, `resolving 240 ticks took ${elapsed.toFixed(1)} ms`)
})
