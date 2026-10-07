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
import type { MissionDefinition } from "../src/mission/index.ts"
import { buildSide, keys, screenText } from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"
import { COMMANDER_FALLS, VASSE } from "./commander-fixture.ts"

const ENTER = "\r"

/** PERIMETER's first Build Phase, with the Experiments given. */
function perimeter(experiments: BuildContext["experiments"] = {}): BuildSide {
  return buildSide({ context: starterContext(undefined, { experiments }), cursor: STARTER_START_CURSOR, startPulse, nextRound })
}

/** The named scenario's first Build Phase, on the starter map — or another mission's, on the same. */
function fixture(mission: MissionDefinition = COMMANDER_FALLS): BuildSide {
  const play = missionPlay(mission)
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

test("her card says what By the Book does in one plain sentence with its range, at the strength the battle will run on, and nothing while it is off", () => {
  const side = perimeter()
  const vasse = (side.build.round.incoming ?? []).find((entity) => entity.contentId === VASSE)
  assert.ok(vasse !== undefined, "she is not with the squads")
  side.build.dispatch({ kind: "look-at", x: vasse.anchor.x, y: vasse.anchor.y })
  side.build.dispatch({ kind: "explore" })
  const { aura, attack } = side.build.round.registry.get(VASSE)
  assert.ok(aura !== undefined && attack !== undefined)
  // Its name opening one sentence, under the description, saying how far it reaches as every range is said, one
  // number; and at 80 x 24 every number still shows beneath it, down to her own range under her attack.
  assert.match(panelText(side), new RegExp(`Nexus restores her\\. By the Book: she and her units within range ${aura.radius} take 25% less damage\\.`))
  assert.match(panelText(side), new RegExp(`HEALTH +80 ATTACK +5 RANGE +${attack.range} `))
  // The Experiment is what the battle will run on, so it is what the card says.
  side.build.dispatch({ kind: "experiment-adjust", field: "commanderAura", step: 1 })
  assert.equal(side.build.state.experiments.commanderAura, 40)
  assert.match(panelText(side), /within range \d+ take 40% less damage/)
  for (let step = 0; step < 3; step += 1) side.build.dispatch({ kind: "experiment-adjust", field: "commanderAura", step: -1 })
  assert.equal(side.build.state.experiments.commanderAura, 0)
  // (The bottom line names the Experiment just changed; the card says nothing of the aura.)
  assert.doesNotMatch(panelText(side), /By the Book: she|less damage/)
  assert.match(panelText(side), /Nexus restores her\. ARRIVES as the round starts/)
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
  // Her name everywhere in the feed, never the id's lower-case one.
  assert.doesNotMatch(panelText(side), /\bvasse\b/)

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

test("she falls with one round to go: the result says she is out for the last, and the last round opens without her", () => {
  // The named scenario cut to two rounds, so the round she is out for is its last. (PERIMETER showed this once, at
  // 20 health in its second round; since the Barracks's troopers came to arrive in a wave five seconds in, she
  // comes through PERIMETER's first two rounds at any health, so it no longer can.)
  const twoRounds: MissionDefinition = {
    ...COMMANDER_FALLS,
    pulses: 2,
    triggers: COMMANDER_FALLS.triggers
      .filter((trigger) => trigger.id !== "probe-3")
      .map((trigger) => (trigger.id === "hold" ? { ...trigger, when: { event: "pulse.end", pulse: 2 } } : trigger)),
  }
  const side = fixture(twoRounds)
  startRound(side)
  toResult(side)
  assert.match(panelText(side), /Vasse fell: out for round 2, the last\./)
  keys(side, ENTER)
  assert.equal(side.build.state.pulseNumber, 2)
  assert.match(statusLine(side), /^Round 1: \w[\w' ]*\. Vasse is out this round\.$/)
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.dispatch({ kind: "open-battle-round" })
  assert.match(screenText(side), /Vasse is out this round\./)
})
