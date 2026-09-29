// Shared scaffolding for the Nexus Pulse tests — not a test file itself: the runners only pick up
// `*.test.ts`. A Build Phase played through the driver's commands, into a Pulse.

import { strict as assert } from "node:assert"
import { SPIKE_START_CURSOR } from "../src/build/catalog.ts"
import type { DebugField } from "../src/build/debug.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import { buildLayout } from "../src/build/layout.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildContext } from "../src/build/state.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { startPulse } from "../src/cli/pulse-run.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { frameToText } from "../src/view/frame.ts"
import type { ReadonlyCellFrame } from "../src/view/frame.ts"
import type { ResolvedPulse } from "../src/view/pulse-live.ts"
import type { CapabilityMode } from "../src/view/roles.ts"

export const MINIMUM = { columns: 80, rows: 24 }

/** The construct menu's rows, by index. */
export const BARRACKS = 0
export const HATCHERY = 1
export const TURRET = 2

export type Spot = readonly [index: number, x: number, y: number]

/** The plan that beat the probe while the placeholder Pulse was being tuned: two Turrets and a Hatchery. */
export const DEFENCE: readonly Spot[] = [
  [TURRET, 22, 9],
  [TURRET, 22, 12],
  [HATCHERY, 20, 14],
]

export type Scenario = Readonly<{
  plan?: readonly Spot[]
  /** Steps to press on the "Raid" Experiment: the probe, none, heavy. */
  raid?: number
  /** Steps to press on the "Your units" Experiment: some, none. */
  crew?: number
}>

export type Played = Readonly<{
  build: BuildSession
  pulse: ResolvedPulse
  context: BuildContext
  layout: BuildLayout
}>

/** A session on the spike map, with the shell's `startPulse` wired in — the game as it is played. */
export function newSession(
  size: Readonly<{ columns: number; rows: number }> = MINIMUM,
  onQuit?: () => void,
): Omit<Played, "pulse"> {
  const context = spikeContext()
  const layout = buildLayout(size, context.grid)
  const build = new BuildSession({
    context,
    cursor: SPIKE_START_CURSOR,
    viewport: layout.viewport,
    startPulse,
    ...(onQuit === undefined ? {} : { onQuit }),
  })
  return { build, context, layout }
}

/** The Build Phase's commands up to (not including) the commit: the Experiments, a Nexus power, and
 *  the plan, each building placed by two clicks on its tile. */
export function prepare(build: BuildSession, scenario: Scenario = {}): void {
  const press = (field: DebugField, times: number): BuildCommand[] =>
    Array.from({ length: times }, () => ({ kind: "debug-adjust", field, step: 1 }))
  build.run([...press("raid", scenario.raid ?? 0), ...press("crew", scenario.crew ?? 0)])
  build.dispatch({ kind: "pick-nexus", index: 1 }) // War Chest: 2000 to spend
  for (const [index, x, y] of scenario.plan ?? []) {
    build.run([{ kind: "arm", index }, { kind: "click-tile", x, y }, { kind: "click-tile", x, y }])
  }
  assert.equal(build.state.planned.length, (scenario.plan ?? []).length, "the plan was not placed as drawn")
}

/**
 * A Build Phase played through the driver's commands — the Experiments, a Nexus power, some buildings,
 * the commit and its yes — and the Pulse the shell resolved for it.
 */
export function play(scenario: Scenario = {}, size: Readonly<{ columns: number; rows: number }> = MINIMUM): Played {
  const session = newSession(size)
  prepare(session.build, scenario)
  session.build.run([{ kind: "commit" }, { kind: "confirm-commit", accept: true }])
  assert.ok(session.build.pulse !== null, "committing did not start a Pulse")
  return { ...session, pulse: session.build.pulse.resolved }
}

/** The screen as text — the frame the live loop would draw at the Pulse's current time. */
export function screenText(played: Pick<Played, "build" | "context" | "layout">, capability: CapabilityMode = "monochrome"): string {
  return frameToText(frameOf(played, capability))
}

export function frameOf(played: Pick<Played, "build" | "context" | "layout">, capability: CapabilityMode = "monochrome"): ReadonlyCellFrame {
  const { build, context, layout } = played
  const pulse = build.pulseFrame(layout)
  return composeBuildFrame(
    {
      context,
      state: build.state,
      layout,
      glyphPack: build.state.settings.glyphPack,
      reducedMotion: build.state.settings.reducedMotion,
      ...(pulse === undefined ? {} : { pulse }),
    },
    capability,
  )
}

/** Time passes for the Pulse on screen: the session's clock starts at zero when this is first called
 *  right after the commit, and `ms` is then milliseconds since. */
export function at(played: Pick<Played, "build">, ms: number): void {
  played.build.advance(ms)
}
