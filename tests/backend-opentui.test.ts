// Cross-backend snapshot identity — engine.md 9.1, milestone-1-spike-battle.md 3.8.
//
// The frame is engine-owned, so two backends drawing the same frame must produce the same
// characters. Which of the two assertions below runs depends on the runtime, and both are real:
// as of @opentui/core 0.5.6 the native core loads under Bun and refuses under Node.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { buildTimeline } from "../src/cli/timeline.ts"
import { loadScenario } from "../src/scenario/index.ts"
import { createView, frameToText } from "../src/view/index.ts"
import { RUNTIME_IS_BUN, loadScenarioFile } from "./helpers.ts"

async function mirrorFrame() {
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
  return view.snapshotAt(view.durationMs * 0.66, "monochrome", 1)
}

if (RUNTIME_IS_BUN) {
  test("OpenTUI draws the engine's frame character for character", async () => {
    const core = await import("@opentui/core")
    const harness = await import("@opentui/core/testing")
    const { drawFrameInto } = await import("../src/view/backends/opentui.ts")
    const frame = await mirrorFrame()

    const rendered = await harness.createTestRenderer({ width: frame.width, height: frame.height })
    try {
      drawFrameInto(core, rendered.renderer.nextRenderBuffer, frame, "monochrome")
      await rendered.renderOnce()
      const captured = (await rendered.captureCharFrame())
        .split("\n")
        .map((line) => line.replace(/[ ]+$/u, ""))
        .join("\n")
        .replace(/\n+$/u, "")
      assert.equal(captured, frameToText(frame))
    } finally {
      await rendered.renderer.destroy()
    }
  })
} else {
  test("OpenTUI's native core does not load here, and the ANSI backend covers this runtime", async () => {
    // Measured 2026-08-21 with @opentui/core 0.5.6 on Node 22.22.2. The package imports cleanly —
    // which is what the milestone's standing evidence measured — but building a renderer throws.
    // This assertion is here so that the day it starts working, the gate report stops being true
    // and a test says so.
    const harness = await import("@opentui/core/testing")
    await assert.rejects(
      async () => harness.createTestRenderer({ width: 80, height: 24 }),
      /native FFI is not available|not available for this runtime/i,
      "OpenTUI now builds a renderer on Node; evidence/report.md Section 4 needs re-measuring",
    )
  })
}
