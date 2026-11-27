// What a player reads of the Commander (pulse.md; the rule itself is tests/commander.test.ts): an `@`
// beside her troops and her own card, the feed when she falls, the result's line saying she is back next round,
// and the Build Phase after it opening with her back. Played through the real session on the starter map's Skirmish
// and on a Skirmish she falls in (`commanderFallsLevel`, `tests/commander-fixture.ts`); and, for a Commander who sits
// rounds out (a path no Commander takes yet), the words the next Build Phase opens with.

import { test } from "node:test"
import { auraOf } from "../src/engine/abilities/index.ts"
import assert from "node:assert/strict"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import type { BuildContext } from "../src/build/state.ts"
import { nextRound, startPulse, starterContext } from "../src/cli/starter.ts"
import { commanderNews } from "../src/cli/skirmish-play.ts"
import { buildSide, keys, screenText } from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"
import { VASSE, commanderFallsLevel } from "./commander-fixture.ts"

const ENTER = "\r"
const ESC = "\u001b"

/** The starter map's first Build Phase, with the Experiments given. */
function starter(experiments: BuildContext["experiments"] = {}): BuildSide {
  return buildSide({ context: starterContext(undefined, { experiments }), cursor: STARTER_START_CURSOR, startPulse, nextRound })
}

/** The Build Phase of the Skirmish she falls in, `rounds` long: its round 2, its scenes played as the game plays them. */
function fixture(rounds = 8): BuildSide {
  const level = commanderFallsLevel(rounds)
  const side = buildSide({ context: level.firstRound(), cursor: STARTER_START_CURSOR, startPulse: level.play.startPulse, nextRound: level.play.nextRound, scenes: true })
  // The loaded save's line, read past.
  keys(side, ESC)
  return side
}

/** Where she stands on the round's map: among its field, or arriving with her starting package. */
function vasseOn(side: BuildSide): Readonly<{ anchor: { x: number; y: number } }> | undefined {
  return [...(side.build.round.field ?? []), ...(side.build.round.incoming ?? [])].find((entity) => entity.contentId === VASSE)
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
  side.build.advance(pulse.prelude.lengthMs + pulse.times.homeMs + 100)
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

test("the starter map's first round: Vasse is an @ beside her troops, and her card names her and her health", () => {
  const side = starter()
  assert.match(mapText(side), /@/, "no @ on the map")
  const vasse = vasseOn(side)
  assert.ok(vasse !== undefined, "she is not with her troops")
  side.build.dispatch({ kind: "look-at", x: vasse.anchor.x, y: vasse.anchor.y })
  side.build.dispatch({ kind: "explore" })
  const card = panelText(side)
  assert.match(card, /Vasse/)
  assert.match(card, /Commander Edda Vasse leads/)
  assert.match(card, /HEALTH +80/)
})

test("her card says what By the Book does in one plain sentence with its range, at the strength the battle will run on", () => {
  const side = starter()
  const vasse = vasseOn(side)
  assert.ok(vasse !== undefined, "she is not with her troops")
  side.build.dispatch({ kind: "look-at", x: vasse.anchor.x, y: vasse.anchor.y })
  side.build.dispatch({ kind: "explore" })
  const definition = side.build.round.registry.get(VASSE)
  const aura = auraOf(definition)
  const { attack } = definition
  assert.ok(aura !== null && attack !== undefined)
  // Its name opening one sentence, under the description, saying how far it reaches as every range is said, one
  // number; and at 80 x 24 every number still shows beneath it, down to her own range under her attack.
  assert.match(panelText(side), new RegExp(`Nexus restores her as the next round opens\\. By the Book: she and her units within range ${aura.radius} take 25% less damage\\.`))
  assert.match(panelText(side), new RegExp(`HEALTH +80 ATTACK +5 RANGE +${attack.range} `))
})

test("she falls: the feed says so, the result says she is back next round, and the next round opens with her beside the Nexus", () => {
  const side = fixture()
  startRound(side)
  const pulse = side.build.pulse
  assert.ok(pulse !== null)
  const death = pulse.resolved.timeline.events.find((event) => event.kind === "entity.died" && event.contentId === VASSE)
  assert.ok(death !== undefined, "she did not fall")
  // The feed, the moment after she falls: by name, as falling, not as a unit dying.
  side.build.advance(0)
  side.build.advance(pulse.prelude.lengthMs + Math.ceil(((death.tick + 1) * 1000) / 12))
  assert.match(panelText(side), /\d+\.\ds Vasse falls/)
  // Her name everywhere in the feed, never the id's lower-case one.
  assert.doesNotMatch(panelText(side), /\bvasse\b/)

  toResult(side)
  assert.match(panelText(side), /Vasse fell: back next round\./)
  assert.doesNotMatch(panelText(side), /out for round/)

  keys(side, ENTER)
  assert.equal(side.build.round.round?.number, 3)
  // The round opens on the dialog saying she is back, looking at her; then the round's own line.
  assert.deepEqual((side.build.round.scene ?? []).map((line) => line.text), ["The Nexus Pulse restores Vasse beside the Nexus."])
  assert.match(screenText(side), /The Nexus Pulse restores Vasse beside the/)
  keys(side, ESC)
  assert.equal(statusLine(side), "Round 2: time's up. The Nexus Pulse deals a new hand: [n].")
  assert.match(mapText(side), /@/, "she is not on round 3's map")
  const vasse = (side.build.round.field ?? []).find((entity) => entity.contentId === VASSE)
  assert.ok(vasse !== undefined)
  side.build.dispatch({ kind: "look-at", x: vasse.anchor.x, y: vasse.anchor.y })
  side.build.dispatch({ kind: "explore" })
  assert.match(panelText(side), /HEALTH +80\/80/)
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.dispatch({ kind: "open-battle-round" })
  assert.doesNotMatch(screenText(side), /is out this round/)
})

test("she falls with one round to go: the result says she is back next round, and the last round opens with her", () => {
  const side = fixture(3)
  startRound(side)
  toResult(side)
  assert.match(panelText(side), /Vasse fell: back next round\./)
  keys(side, ENTER)
  assert.deepEqual(side.build.round.round, { number: 3, of: 3 })
  assert.match(mapText(side), /@/, "the last round opened without her")
})

test("a Commander who sits rounds out: the next Build Phase says she is out and the round she is back for, then that she is back", () => {
  // A disadvantage no Commander has yet (`roundsOut`, tests/commander.test.ts holds the rule): what the round after her
  // fall opens with, and the round she is back, in the same words a Skirmish says them.
  const out = { player: "A" as const, contentId: VASSE, fellInRound: 1, returnsInRound: 3 }
  assert.equal(commanderNews([], [out], 2, 8), "Vasse is out this round, back for round 3.")
  // Out for the last round: no round to be back for.
  assert.equal(commanderNews([], [out], 2, 2), "Vasse is out this round.")
  assert.equal(commanderNews([{ player: "A", contentId: VASSE, ordinal: 16, anchor: { x: 20, y: 10 } }], [], 3, 8), "The Nexus Pulse restores Vasse beside the Nexus.")
  // The enemy's Commander is not the player's to hear about.
  assert.equal(commanderNews([], [{ ...out, player: "B" }], 2, 8), null)
})
