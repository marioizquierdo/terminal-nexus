// Frame budget — milestone-1-spike-battle.md 3.9: "30 fps sustained over 60 seconds, p95 recorded".
//
// The measurement is the point, not the threshold: the numbers land in evidence/report.md, and the
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

test("thirty frames a second for sixty seconds stays inside the budget", async () => {
  const scenario = await loadScenarioFile("citizen-mirror-skirmish.ts")
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
  assert.ok(
    overBudget === 0,
    `${overBudget} frames of ${samples.length} took longer than one frame's budget`,
  )
})

test("the worst case stays inside the budget too: two armies, 48x16, every effect on", async () => {
  // ascii-effects.md craft rule 1 applies to the frame budget as much as to the art: measure the
  // busiest frame, not the calm one.
  const scenario = await loadScenarioFile("citizens-versus-ravels.ts")
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
  samples.sort((a, b) => a - b)
  const p95 = samples[Math.floor(samples.length * 0.95)] ?? 0
  const worst = samples[samples.length - 1] ?? 0
  const over = samples.filter((sample) => sample > BUDGET_MS).length
  console.log(
    `worst case: ${view.effectCount} effect instances  p95 ${p95.toFixed(2)} ms  ` +
      `max ${worst.toFixed(2)} ms  over budget ${over}  bytes/frame ${Math.round(bytes / samples.length)}`,
  )
  assert.ok(p95 < BUDGET_MS, `p95 of ${p95.toFixed(2)} ms exceeds the budget`)
  assert.equal(over, 0, `${over} frames blew the budget`)
})

test("resolving a whole Pulse costs less than a single frame's budget", async () => {
  const scenario = await loadScenarioFile("citizen-mirror-skirmish.ts")
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
