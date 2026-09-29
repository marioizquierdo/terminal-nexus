// Starting a Nexus Pulse from a committed Build Phase (gate 6A) — the application shell's part of the
// connection, and the only place the Build Phase, the rules layer, the kernel and the view meet.
//
// `src/build` may never reach the kernel and `src/view` may never reach it either
// (`tests/architecture.test.ts`), so neither can start a Pulse: they are handed this function
// (`BuildSession`'s `startPulse`) and get back a `ResolvedPulse` to play. What it does is short and
// entirely deterministic — the plan becomes the kernel's opening state (`src/match/opening.ts`), the
// kernel resolves the whole Pulse once, and Recall is worked out from the state it ended in
// (`src/match/recall.ts`) — so the same plan, the same Experiments and the same seed give the same Pulse
// on every machine, and nothing about how it is watched can change it.

import type { BuildContext, BuildState } from "../build/state.ts"
import { nexusTile } from "../build/state.ts"
import { openingState, recall } from "../match/index.ts"
import type { ResolvedPulse } from "../view/pulse-live.ts"
import { buildTimeline } from "./timeline.ts"

/** The name the Pulse carries in its timeline: the one Pulse the Build Phase starts, until a mission
 *  (gate 6B's trigger runner) names them. */
const PULSE_ID = "nexus-pulse"

/**
 * Resolves the Pulse the player just committed to, or `null` when the context has none (a hand-built one:
 * committing then only freezes the plan). Throws `PulseSetupError` for a plan the kernel cannot start
 * from — `BuildSession` undoes the commit and says why.
 */
export function startPulse(context: BuildContext, state: BuildState): ResolvedPulse | null {
  if (context.pulse === undefined) return null
  const setup = context.pulse(state.debug)
  // Everything standing when the Pulse starts: what was already there, and what the plan built.
  const structures = [
    ...context.standing.map((structure) => ({ contentId: structure.contentId, anchor: structure.anchor })),
    ...state.planned.map((placement) => ({ contentId: placement.contentId, anchor: placement.anchor })),
  ]
  const initial = openingState({ grid: context.grid, registry: context.registry, structures, setup })
  const timeline = buildTimeline({ id: PULSE_ID, name: "Nexus Pulse" }, initial, context.registry, setup.pulseTicks, setup.seed)
  const last = timeline.states[timeline.states.length - 1]
  if (last === undefined) throw new Error("the Pulse resolved no states")
  return { timeline, recall: recall(last, context.registry), nexus: nexusTile(context) }
}
