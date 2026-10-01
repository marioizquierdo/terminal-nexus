// What a player reads of the Commander (pulse.md; the rule itself is tests/commander.test.ts): an `@`
// among the squads and her own card, the feed when she falls, the result's line on the round she is out
// for, and the Build Phases after it saying she is out and then that she is back. Played through the real
// session on PERIMETER and on the Commander's named scenario (`tests/commander-fixture.ts`).

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  STARTER_ALLOTMENT,
  STARTER_CATALOG,
  STARTER_NEXUS_DRAFT,
  STARTER_STANDING,
  STARTER_START_CURSOR,
  starterGrid,
} from "../src/build/catalog.ts"
import type { BuildContext } from "../src/build/state.ts"
import { missionPlay, nextRound, startPulse } from "../src/cli/pulse-run.ts"
import { starterContext } from "../src/cli/starter.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { buildSide, keys, screenText } from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"
import { COMMANDER_FALLS, VASSE } from "./commander-fixture.ts"

const ENTER = "\r"

/** PERIMETER's first Build Phase, with the Experiments given. */
function perimeter(experiments: BuildContext["experiments"] = {}): BuildSide {
  return buildSide({ context: starterContext(undefined, { experiments }), cursor: STARTER_START_CURSOR, startPulse, nextRound })
}

/** The named scenario's first Build Phase, on the starter map. */
function fixture(): BuildSide {
  const play = missionPlay(COMMANDER_FALLS)
  const context = play.firstRound({
    grid: starterGrid(),
    registry: FIXTURE_REGISTRY,
    catalog: STARTER_CATALOG,
    standing: STARTER_STANDING,
    allotment: STARTER_ALLOTMENT,
    nexusDraft: STARTER_NEXUS_DRAFT,
  })
  return buildSide({ context, cursor: STARTER_START_CURSOR, startPulse: play.startPulse, nextRound: play.nextRound })
}

/** A Nexus power picked and the round's Pulse started, nothing built. */
function startRound(side: BuildSide): void {
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  assert.ok(side.build.pulse !== null, "the round's Pulse did not start")
}

/** The Pulse on screen played to just after its result stands. */
function toResult(side: BuildSide): void {
  const pulse = side.build.pulse
  assert.ok(pulse !== null)
  side.build.advance(0)
  side.build.advance(pulse.times.homeMs + 100)
  assert.equal(pulse.phase(), "home")
}

/** The side panel's words, its lines joined, so a sentence the panel wrapped reads as one. */
function panelText(side: BuildSide): string {
  return screenText(side)
    .split("\n")
    .map((line) => line.slice(2, 29).trim())
    .filter((line) => line !== "")
    .join(" ")
}

/** The status line: the screen's second-to-last row, inside its border. */
function statusLine(side: BuildSide): string {
  const lines = screenText(side).split("\n")
  return (lines[lines.length - 2] ?? "").slice(2, -1).trim()
}

/** The map's rows, the panel cut away. */
const mapText = (side: BuildSide): string =>
  screenText(side)
    .split("\n")
    .map((line) => line.slice(30))
    .join("\n")

test("PERIMETER's first round: Vasse is an @ among the squads, and her card names her and her health", () => {
  const side = perimeter()
  assert.match(mapText(side), /@/, "no @ on the map")
  const vasse = (side.build.round.incoming ?? []).find((entity) => entity.contentId === VASSE)
  assert.ok(vasse !== undefined, "she is not with the squads")
  side.build.dispatch({ kind: "look-at", x: vasse.anchor.x, y: vasse.anchor.y })
  side.build.dispatch({ kind: "explore" })
  const card = panelText(side)
  assert.match(card, /Vasse/)
  assert.match(card, /Commander Edda Vasse leads/)
  assert.match(card, /HEALTH +80/)

  // The Experiment is what the Pulse will run on, so it is what the card says.
  for (let step = 0; step < 3; step += 1) side.build.dispatch({ kind: "experiment-adjust", field: "commanderHealth", step: -1 })
  assert.equal(side.build.state.experiments.commanderHealth, 20)
  assert.match(panelText(side), /HEALTH +20/)
})

test("she falls: the feed says so, the result says the round she is out for, and round 2 is played without her", () => {
  const side = fixture()
  startRound(side)
  const pulse = side.build.pulse
  assert.ok(pulse !== null)
  const death = pulse.resolved.timeline.events.find((event) => event.kind === "entity.died" && event.contentId === VASSE)
  assert.ok(death !== undefined, "she did not fall")
  // The feed, the moment after she falls: by name, as falling, not as a unit dying.
  side.build.advance(0)
  side.build.advance(Math.ceil(((death.tick + 1) * 1000) / 12))
  assert.match(panelText(side), /\d+\.\ds Vasse falls/)
  assert.doesNotMatch(panelText(side), /vasse dies/)

  toResult(side)
  assert.match(panelText(side), /Vasse fell: out for round 2, back for round 3\./)

  keys(side, ENTER)
  assert.equal(side.build.state.pulseNumber, 2)
  assert.equal(statusLine(side), "Round 1: victory. Vasse is out this round, back for round 3.")
  assert.doesNotMatch(mapText(side), /@/, "she is on round 2's map")
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.dispatch({ kind: "open-battle-round" })
  assert.match(screenText(side), /Vasse is out this round\./)
})

test("round 3 opens with her back beside the Nexus, at full health, and her card says so", () => {
  const side = fixture()
  startRound(side)
  toResult(side)
  keys(side, ENTER)
  startRound(side)
  toResult(side)
  // Her absence is over: nothing about her in round 2's result.
  assert.doesNotMatch(panelText(side), /Vasse/)
  keys(side, ENTER)
  assert.equal(side.build.state.pulseNumber, 3)
  assert.equal(statusLine(side), "Round 2: victory. Vasse is back beside the Nexus.")
  assert.match(mapText(side), /@/, "she is not on round 3's map")
  const vasse = (side.build.round.field ?? []).find((entity) => entity.contentId === VASSE)
  assert.ok(vasse !== undefined)
  side.build.dispatch({ kind: "look-at", x: vasse.anchor.x, y: vasse.anchor.y })
  side.build.dispatch({ kind: "explore" })
  const card = panelText(side)
  assert.match(card, /Vasse/)
  assert.match(card, /Your Commander/)
  assert.match(card, /HEALTH +80\/80/)
  side.build.dispatch({ kind: "open-battle-round" })
  assert.doesNotMatch(screenText(side), /is out this round/)
})

test("PERIMETER at 20 health: she falls in round 2, and the last round opens without her", () => {
  const side = perimeter({ commanderHealth: 20 })
  startRound(side)
  toResult(side)
  assert.doesNotMatch(panelText(side), /Vasse fell/)
  keys(side, ENTER)
  startRound(side)
  toResult(side)
  assert.match(panelText(side), /Vasse fell: out for round 3, the last\./)
  keys(side, ENTER)
  assert.equal(side.build.state.pulseNumber, 3)
  assert.match(statusLine(side), /^Round 2: \w[\w' ]*\. Vasse is out this round\.$/)
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.dispatch({ kind: "open-battle-round" })
  assert.match(screenText(side), /Vasse is out this round\./)
})
