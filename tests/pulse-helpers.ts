// Shared scaffolding for the Nexus Pulse tests — not a test file itself: the runners only pick up
// `*.test.ts`. A Build Phase played through the driver's commands, into a Pulse — on the Build Phase's own
// scaffolding (`tests/build-helpers.ts`).

import { strict as assert } from "node:assert"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import type { BuildSession } from "../src/build/session.ts"
import type { BuildContext } from "../src/build/state.ts"
import { missionPlay } from "../src/cli/pulse-run.ts"
import type { MissionPlay } from "../src/cli/pulse-run.ts"
import { starterContext } from "../src/cli/build-phase.ts"
import type { MissionDefinition, SimulationAction } from "../src/mission/index.ts"
import type { ReadonlyCellFrame } from "../src/view/frame.ts"
import type { ResolvedPulse } from "../src/view/pulse-live.ts"
import type { CapabilityMode } from "../src/view/roles.ts"
import { MINIMUM, buildSide, clickCell, compose, screenText } from "./build-helpers.ts"

export { MINIMUM }

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

/** The same plan as a key script: the War Chest, then each spot's building armed by its digit and placed by two
 *  clicks on its tile — for the tests, screenshots and playtests that press keys rather than drive commands. */
export const DEFENCE_KEYS = ["n 2", ...DEFENCE.map(([index, x, y]) => `${index + 1} click:${x},${y} click:${x},${y}`)].join(" ")

export type RaidSize = "none" | "probe" | "heavy"
export type CrewSize = "some" | "none"

export type Scenario = Readonly<{
  plan?: readonly Spot[]
  /** Which raid comes: the probe (the default), a heavy one, or none. */
  raid?: RaidSize
  /** Whether the player has units of their own (the default) or none. */
  crew?: CrewSize
  /** How many rounds the test mission has: 2 (the default), so a round's result goes on to a next one. */
  rounds?: number
}>

const many = (unit: string, count: number): Readonly<{ unit: string; count: number }> => ({ unit, count })

/** The raids the first placeholder Pulse offered, which these tests were written against. */
const RAIDS: Readonly<Record<RaidSize, readonly Readonly<{ unit: string; count: number }>[]>> = {
  none: [],
  probe: [many("unit.ravel.runner", 4), many("unit.ravel.raider", 3)],
  heavy: [many("unit.ravel.runner", 6), many("unit.ravel.raider", 4)],
}

/**
 * The first placeholder Pulse as a mission: the player's two squads beside the Nexus, a raid at
 * the far edge of a view opened on the base, the same seed and length — so a first round is the very
 * Pulse it was before missions, forces in the same order, and every ending the tests reach is still reachable. Its
 * rounds after the first bring nothing new; the last one's end wins, unless the Nexus fell.
 */
export function testMission(scenario: Scenario = {}): MissionDefinition {
  const rounds = scenario.rounds ?? 2
  const opening: SimulationAction[] = []
  if ((scenario.crew ?? "some") === "some") {
    opening.push({ spawn: { side: "A", units: [many("unit.citizen.trooper", 3), many("unit.citizen.marksman", 2)], at: "crew" } })
  }
  const raid = RAIDS[scenario.raid ?? "probe"]
  if (raid.length > 0) opening.push({ spawn: { side: "B", units: raid, at: "raid", intent: "Test the line." } })
  return {
    id: "mission.test.placeholder",
    name: "Placeholder",
    pulses: rounds,
    pulseTicks: 360,
    seed: 0x50554c53,
    regions: [
      { id: "crew", x: 22, y: 10, width: 1, height: 1 },
      { id: "raid", x: 46, y: 10, width: 1, height: 1 },
    ],
    triggers: [
      ...(opening.length === 0 ? [] : [{ id: "opening", when: { pulse: 1, tick: 0 }, do: opening }]),
      { id: "fallen", when: { event: "nexus.destroyed", side: "A" }, do: [{ lose: true }] },
      { id: "hold", when: { event: "pulse.end", pulse: rounds }, do: [{ win: true }] },
    ],
    endText: { won: "The test held.", lost: "The Nexus fell." },
  }
}

export type Played = Readonly<{
  build: BuildSession
  pulse: ResolvedPulse
  context: BuildContext
  layout: BuildLayout
  mission: MissionPlay
}>

/** A session on the starter map, opening on the Grid Nexus as the game does, playing the test mission for a
 *  scenario (the probe, by default) with the shell's own `startPulse` and `nextRound`. */
export function newSession(
  size: Readonly<{ columns: number; rows: number }> = MINIMUM,
  onQuit?: () => void,
  scenario: Scenario = {},
): Omit<Played, "pulse"> {
  const mission = missionPlay(testMission(scenario))
  const { build, context, layout } = buildSide({
    context: mission.firstRound(starterContext()),
    cursor: STARTER_START_CURSOR,
    terminal: size,
    startPulse: mission.startPulse,
    nextRound: mission.nextRound,
    ...(onQuit === undefined ? {} : { onQuit }),
  })
  return { build, context, layout, mission }
}

/** The Build Phase's commands up to (not including) the commit: a Nexus power, and the plan, each
 *  building placed by two clicks on its tile. */
export function prepare(build: BuildSession, scenario: Scenario = {}): void {
  build.dispatch({ kind: "pick-nexus", index: 1 }) // War Chest: 2000 to spend
  for (const [index, x, y] of scenario.plan ?? []) {
    build.run([{ kind: "arm", index }, { kind: "click-tile", x, y }, { kind: "click-tile", x, y }])
  }
  assert.equal(build.state.planned.length, (scenario.plan ?? []).length, "the plan was not placed as drawn")
}

/**
 * A Build Phase played through the driver's commands — a Nexus power, some buildings, the commit and its
 * yes — and the Pulse the shell resolved for it.
 */
export function play(scenario: Scenario = {}, size: Readonly<{ columns: number; rows: number }> = MINIMUM): Played {
  const session = newSession(size, undefined, scenario)
  prepare(session.build, scenario)
  session.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  assert.ok(session.build.pulse !== null, "committing did not start a Pulse")
  return { ...session, pulse: session.build.pulse.resolved }
}

/** The screen as text, and as cells — what the live loop would draw at the Pulse's current time. */
export { screenText }

export function frameOf(played: Pick<Played, "build" | "context" | "layout">, capability: CapabilityMode = "monochrome"): ReadonlyCellFrame {
  return compose(played, {}, capability)
}

/** A mouse click at a frame cell (0-based column and row), through the real mouse adapter; `now` is the screen's
 *  clock when the click arrived, for anything that times it. */
export { clickCell as click }

/** Time passes for the Pulse on screen: the session's clock starts at zero when this is first called
 *  right after the commit, and `ms` is then milliseconds since. */
export function at(played: Pick<Played, "build">, ms: number): void {
  played.build.advance(ms)
}

/** The Pulse played from its start until just after its result stands (a hundred milliseconds past the walk
 *  home). A Pulse's time only moves forward, so this is for a Pulse nothing else has been asked of yet. */
export function atHome(played: Pick<Played, "build">): void {
  const pulse = played.build.pulse
  assert.ok(pulse !== null, "there is no Pulse on screen")
  played.build.advance(0)
  played.build.advance(pulse.times.homeMs + 100)
}
