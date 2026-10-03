// The loop: after a round's result, the next round's Build Phase — on what Recall left, with the
// credits not spent and the next wave shown as incoming — until the mission's triggers end it. Played on
// the game's own mission, PERIMETER, through the real session and the shell's `startPulse` and
// `nextRound`, by keyboard, mouse and driver alike.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_START_CURSOR, STARTER_STANDING } from "../src/build/catalog.ts"
import { nextRoundRow } from "../src/build/layout.ts"
import { remaining } from "../src/build/state.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { nextRound, startPulse } from "../src/cli/pulse-run.ts"
import { TUNING } from "../src/build/tuning.ts"
import { isSettingName } from "../src/build/all-settings.ts"
import { defaultExperiments } from "../src/build/experiments.ts"
import { parseSettingsExport } from "../src/build/settings-export.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import { buildSide, clickCell, keys, screenText } from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"

const ENTER = "\r"

/** PERIMETER's first Build Phase, as the game opens it. */
function perimeter(): BuildSide {
  return buildSide({ cursor: STARTER_START_CURSOR, startPulse, nextRound })
}

/** A round planned and started: the Reserve Fund picked, the buildings placed, the Battle Round started. */
function startRound(side: BuildSide, plan: readonly (readonly [index: number, x: number, y: number])[] = []): void {
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  for (const [index, x, y] of plan) side.build.run([{ kind: "arm", index }, { kind: "click-tile", x, y }, { kind: "click-tile", x, y }])
  side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  assert.ok(side.build.pulse !== null, "the round's Pulse did not start")
}

/** The Pulse on screen played from its start until just after its result stands. */
function toResult(side: BuildSide): void {
  const pulse = side.build.pulse
  assert.ok(pulse !== null)
  side.build.advance(0)
  side.build.advance(pulse.times.homeMs + 100)
  assert.equal(pulse.phase(), "home")
}

const TURRET = 2
const DEFENCE = [
  [TURRET, 24, 8],
  [TURRET, 22, 7],
] as const

test("after a round's result, Enter opens the next round's Build Phase on what the last one left", () => {
  const side = perimeter()
  startRound(side, DEFENCE)
  const before = side.build.state
  const credits = remaining(side.build.round, before)
  toResult(side)
  assert.match(screenText(side), /\[enter\] Next round/)
  keys(side, ENTER)

  const round = side.build.round
  const state = side.build.state
  assert.equal(side.build.pulse, null, "the Pulse outlived its round")
  assert.deepEqual(round.round, { number: 2, of: 3 })
  assert.equal(state.pulseNumber, 2)
  assert.equal(state.committed, false)
  assert.deepEqual(state.planned, [], "the new Build Phase starts with nothing planned")
  // What was built stands now; the credits not spent carry over, and a new Nexus power is dealt.
  for (const [, x, y] of DEFENCE) {
    assert.ok(round.standing.some((structure) => structure.anchor.x === x && structure.anchor.y === y), `the Turret at ${x},${y} is not standing`)
  }
  assert.equal(round.allotment, credits)
  assert.equal(state.nexusPick, null)
  // The survivors are on the map; the next wave is shown as incoming, with what it means to do.
  assert.ok((round.field ?? []).some((entity) => entity.player === "A"), "no survivor of yours on the map")
  assert.ok((round.incoming ?? []).length > 0 && (round.incoming ?? []).every((entity) => entity.player === "B"))
  assert.ok((round.incoming ?? []).some((entity) => entity.intent === "Break through at the ridge."))
  // It says where it is and how the last round went.
  const text = screenText(side)
  assert.match(text, /build phase - round 2 of 3/)
  assert.match(text, /Round 1: victory\. Build Phase 2 - the Nexus stands\./)
  assert.deepEqual(state.cursor, { x: 18, y: 10 }, "the next round does not open on the Nexus")
})

test("Enter, Space, n, a click on the row and the driver's command all open the same next round", () => {
  const ways: Readonly<Record<string, (side: BuildSide) => void>> = {
    enter: (side) => keys(side, ENTER),
    space: (side) => keys(side, " "),
    n: (side) => keys(side, "n"),
    click: (side) => clickCell(side, side.layout.panelColumn + 3, nextRoundRow(side.layout)),
    driver: (side) => side.build.dispatch({ kind: "next-round" } satisfies BuildCommand),
  }
  const reached = Object.entries(ways).map(([name, go]) => {
    const side = perimeter()
    startRound(side, DEFENCE)
    toResult(side)
    go(side)
    assert.equal(side.build.state.pulseNumber, 2, `${name} did not open round 2`)
    // The Activity Logs ride along in the context and rightly differ by which key was pressed; the round
    // itself must not.
    const { activity: _log, ...round } = side.build.round
    return { name, round, state: { ...side.build.state, ack: null, highlightHidden: false } }
  })
  const [first] = reached
  for (const other of reached.slice(1)) {
    assert.deepEqual(other.round, first?.round, `${other.name} opened a different round`)
    assert.deepEqual(other.state, first?.state, `${other.name} left a different state`)
  }
})

test("the Barracks trains during the round: round 2 opens with its troopers at home beside it, and the log says so", () => {
  // Nothing built, so the probe lasts past the first trooper (ten seconds in): two Turrets and Vasse end
  // round 1 before it.
  const side = perimeter()
  startRound(side)
  const trained = side.build.pulse!.resolved.timeline.events.filter((event) => event.kind === "entity.spawned" && event.trainedBy !== undefined)
  assert.ok(trained.length > 0, "the Barracks trained nothing in round 1")
  toResult(side)
  const entry = side.activity.entries().find((logged) => logged.event === "pulse.trained")
  assert.ok(entry !== undefined, "the round's training was not logged")
  assert.equal(entry.props["round"], 1)
  assert.equal(entry.props["trained"], trained.length)
  keys(side, ENTER)
  // The trained troopers that lived are on round 2's map, home at the Barracks the map stands.
  const barracks = STARTER_STANDING.find((structure) => structure.contentId === "structure.citizen.barracks")
  assert.ok(barracks !== undefined)
  const troopers = (side.build.round.field ?? []).filter((entity) => entity.player === "A" && entity.contentId === "unit.citizen.trooper")
  const nearBarracks = troopers.filter((entity) => Math.abs(entity.anchor.x - (barracks.anchor.x + 1)) <= 4 && Math.abs(entity.anchor.y - barracks.anchor.y) <= 4)
  assert.ok(nearBarracks.length > 0, `no trooper came home to the Barracks: ${JSON.stringify(troopers)}`)
})

test("nothing moves on before the result stands: a key must never skip the ending", () => {
  const side = perimeter()
  startRound(side)
  side.build.advance(0)
  side.build.advance(2000)
  side.build.dispatch({ kind: "next-round" })
  keys(side, ENTER, "n")
  assert.ok(side.build.pulse !== null)
  assert.equal(side.build.state.pulseNumber, 1)
})

test("the whole mission, round by round, to its end; Play again and Restart both go back to round 1", () => {
  const side = perimeter()
  for (let round = 1; round <= 3; round += 1) {
    assert.equal(side.build.state.pulseNumber, round)
    startRound(side)
    toResult(side)
    if (round < 3 && /Next round/.test(screenText(side))) keys(side, ENTER)
  }
  // Nothing built: the Nexus falls in the last round.
  const end = screenText(side)
  assert.match(end, /MISSION FAILED/)
  assert.match(end, /The Nexus fell\./)
  assert.match(end, /\[enter\] Play again/)
  keys(side, ENTER)
  assert.equal(side.build.state.pulseNumber, 1)
  assert.deepEqual(side.build.round.standing, STARTER_STANDING)
  assert.equal(side.build.round.carried, null)

  // Restart from the game menu in round 2 goes back to round 1 too.
  const again = perimeter()
  startRound(again)
  toResult(again)
  keys(again, ENTER)
  assert.equal(again.build.state.pulseNumber, 2)
  again.build.run([{ kind: "open-game-menu" }, { kind: "restart" }])
  assert.equal(again.build.state.pulseNumber, 1)
  assert.deepEqual(again.build.round.round, { number: 1, of: 3 })
  assert.match(screenText(again), /round 1 of 3/)
})

test("round 2's Battle Round screen is Battle Round 2, in the mission's own words", () => {
  const side = perimeter()
  startRound(side, DEFENCE)
  toResult(side)
  keys(side, ENTER)
  side.build.run([{ kind: "pick-nexus", index: 0 }, { kind: "open-battle-round" }])
  const text = screenText(side)
  assert.match(text, /Battle Round 2/)
  assert.match(text, /They are back, and there are more\./)
  side.build.dispatch({ kind: "start-pulse" })
  assert.match(screenText(side), /NEXUS PULSE 2/)
})

test("Next round on auto: the next Build Phase begins on its own a moment after the result, and waits for no key", () => {
  const side = perimeter()
  side.build.dispatch({ kind: "experiment-adjust", field: "nextRound", step: 1 })
  assert.equal(side.build.state.experiments.nextRound, "auto")
  startRound(side, DEFENCE)
  const pulse = side.build.pulse!
  side.build.advance(0)
  side.build.advance(pulse.times.homeMs + 100)
  assert.equal(side.build.state.pulseNumber, 1, "it moved on before the result had been shown")
  assert.ok(pulse.busyUntil(pulse.times.homeMs + 100) !== null, "nothing keeps the clock running to move on")
  side.build.advance(pulse.times.homeMs + TUNING.autoNextRoundMs + 10)
  assert.equal(side.build.state.pulseNumber, 2, "it did not move on by itself")
  assert.equal(side.build.state.experiments.nextRound, "auto", "the Experiment did not carry into the next round")

  // On the key (the default), the result simply stands.
  const waits = perimeter()
  startRound(waits, DEFENCE)
  const standing = waits.build.pulse!
  waits.build.advance(0)
  waits.build.advance(standing.times.homeMs + TUNING.autoNextRoundMs + 5000)
  assert.equal(waits.build.state.pulseNumber, 1)
  assert.equal(standing.busyUntil(standing.times.homeMs + 10_000), null)
})

test("the incoming wave: drawn where it will arrive, its intention on the card, and always shown", () => {
  const side = perimeter()
  const raider = (side.build.round.incoming ?? []).find((entity) => entity.player === "B")
  assert.ok(raider !== undefined, "PERIMETER's first round shows nothing incoming")
  side.build.dispatch({ kind: "look-at", x: raider.anchor.x, y: raider.anchor.y })
  side.build.dispatch({ kind: "explore" })
  const shown = screenText(side)
  assert.match(shown, /Incoming/)
  assert.match(shown, /Probe the line at the/)
  assert.match(shown, /as the round starts/)

  // The owner settled the Experiment that could hide it ("the enemy units should be visible"): nothing in
  // Settings hides the raid now, and an older export that hid it is read without a word.
  assert.equal(isSettingName("incoming"), false)
  const old = parseSettingsExport("incoming = hidden", { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() })
  assert.deepEqual(old.settled, ["incoming"])
  assert.deepEqual(old.ignored, [])
})
