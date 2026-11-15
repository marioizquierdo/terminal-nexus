// Cross-backend snapshot identity (docs/system-design/presentation.md, the cell frame).
//
// The frame is engine-owned, so two backends drawing the same frame must produce the same
// characters. Which of the two assertions below runs depends on the runtime, and both are real:
// as of @opentui/core 0.5.6 the native core loads under Bun and refuses under Node.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { buildTimeline } from "../src/cli/timeline.ts"
import { openBattle } from "../src/skirmish/opening/index.ts"
import { frameToText } from "../src/view/index.ts"
import { battleRoundScreen } from "./battle-round-frame.ts"
import { RUNTIME_IS_BUN, loadSandbox } from "./helpers.ts"

async function mirrorFrame() {
  const opening = await loadSandbox("citizen-mirror-skirmish.save.json")
  const loaded = openBattle(opening, { registry: FIXTURE_REGISTRY, seed: opening.seed })
  const timeline = buildTimeline(
    opening,
    loaded.state,
    loaded.registry,
    opening.pulseTicks,
    opening.seed,
  )
  // The Battle Round as the game draws it, two thirds of the way through the fight.
  return battleRoundScreen(timeline).frameAt(timeline.states.length * (1000 / timeline.ticksPerSecond) * 0.66, "monochrome")
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
      // Both sides read the same way: trailing spaces and the blank rows under the last drawn one dropped (a Battle Round
      // on a small battlefield is centred in the terminal, with a blank row below it).
      const asText = (text: string): string =>
        text
          .split("\n")
          .map((line) => line.replace(/[ ]+$/u, ""))
          .join("\n")
          .replace(/\n+$/u, "")
      const captured = asText(await rendered.captureCharFrame())
      assert.equal(captured, asText(frameToText(frame)))
    } finally {
      await rendered.renderer.destroy()
    }
  })
} else {
  test("OpenTUI's native core does not load here, and the ANSI backend covers this runtime", async () => {
    // Measured 2026-08-21 with @opentui/core 0.5.6 on Node 22.22.2. The package imports cleanly —
    // which is what the first measurement found — but building a renderer throws.
    // This assertion is here so that the day it starts working, the pulse-playground report stops being true
    // and a test says so.
    const harness = await import("@opentui/core/testing")
    await assert.rejects(
      async () => harness.createTestRenderer({ width: 80, height: 24 }),
      /native FFI is not available|not available for this runtime/i,
      "OpenTUI now builds a renderer on Node; docs/history/reports/2026-08-21-pulse-playground.md needs re-measuring",
    )
  })
}
