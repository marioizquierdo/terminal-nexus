// A building's actions (the owner, 2026-10-16: "When a building is selected during build-phase map exploration, it
// should show the available actions, with hotkeys as usual. One of those actions for the barracks is 'Pause
// production'"): Explore Map on a building of the player's that makes units lists Hold production under `z` on its
// card; `z` holds its wave this round and again trains it; and a held building sends no wave in that round's Battle
// Round, while it trains again the round after.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { currentCard } from "../src/build/card.ts"
import { buildLayout } from "../src/build/layout.ts"
import { createBuildState, withoutScene } from "../src/build/state.ts"
import { DEFAULT_LEVEL } from "../src/cli/levels.ts"
import { frameToText } from "../src/view/frame.ts"
import { buildSide, clickCell, compose, keys } from "./build-helpers.ts"

const BARRACKS = "structure.citizen.barracks"

/** PERIMETER's round 1 with Explore Map on the Barracks standing on the starter map. */
function onBarracks() {
  const side = buildSide({ cursor: STARTER_START_CURSOR, context: withoutScene(DEFAULT_LEVEL.firstRound()) })
  keys(side, "e", "\x1b[C", "\x1b[C", "\x1b[C", "\x1b[C")
  return side
}

test("Explore Map on a Barracks lists Hold production under z; z holds its wave, and z again trains it", () => {
  const side = onBarracks()
  const card = currentCard(side.build.round, side.build.state)
  assert.equal(card?.title, "Barracks")
  assert.deepEqual(card?.actions, [{ hotkey: "z", label: "Hold production" }])
  keys(side, "z")
  assert.deepEqual(side.build.state.held, ["25,10"])
  assert.equal(side.build.state.status.text, "Barracks holds its wave this round: it trains again the round after.")
  const held = currentCard(side.build.round, side.build.state)
  assert.deepEqual(held?.actions, [{ hotkey: "z", label: "Resume production" }])
  assert.equal(held?.stats.find((stat) => stat.label === "WAVE")?.value, "held this round")
  keys(side, "z")
  assert.deepEqual(side.build.state.held, [])
})

test("z away from a building of the player's that makes units does nothing but say how", () => {
  const side = buildSide({ cursor: STARTER_START_CURSOR, context: withoutScene(DEFAULT_LEVEL.firstRound()) })
  keys(side, "z")
  assert.deepEqual(side.build.state.held, [])
  assert.match(side.build.state.status.text, /onto a building of yours/u)
  // The Nexus makes no units: nothing to hold.
  keys(side, "e", "z")
  assert.deepEqual(side.build.state.held, [])
})

test("a held Barracks sends no wave in this round's Battle Round, and trains again the round after", { timeout: 120_000 }, () => {
  const context = withoutScene(DEFAULT_LEVEL.firstRound())
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
  const opened = createBuildState(context, STARTER_START_CURSOR, viewport)
  const trainedBy = (resolved: NonNullable<ReturnType<typeof DEFAULT_LEVEL.play.startPulse>>): number =>
    resolved.timeline.events.filter((event) => event.kind === "entity.spawned" && event.trainedBy !== undefined).length
  const free = DEFAULT_LEVEL.play.startPulse(context, opened)
  const held = DEFAULT_LEVEL.play.startPulse(context, { ...opened, held: ["25,10"] })
  assert.ok(free !== null && held !== null)
  assert.equal(trainedBy(free), 4, "the Barracks did not send its wave")
  assert.equal(trainedBy(held), 0, "a held Barracks sent its wave")
  const barracks = held.timeline.states[0]?.entities.find((entity) => entity.contentId === BARRACKS)
  assert.ok(barracks !== undefined)
  // The round after starts with nothing held, and the Barracks trains again.
  const next = DEFAULT_LEVEL.play.nextRound(context, { ...opened, held: ["25,10"] }, held)
  assert.ok(next !== null)
  const again = DEFAULT_LEVEL.play.startPulse(next, createBuildState(withoutScene(next), STARTER_START_CURSOR, viewport))
  assert.ok(again !== null)
  assert.equal(trainedBy(again), 4)
})

test("a click on the card's action row is its key: it holds the building, and a click again trains it", () => {
  const side = onBarracks()
  const rowOf = (label: string): number => {
    const lines = frameToText(compose(side)).split("\n")
    const row = lines.findIndex((line) => line.includes(`[z] ${label}`))
    assert.ok(row >= 0, `no "[z] ${label}" on screen`)
    return row
  }
  clickCell(side, side.layout.panelColumn + 1, rowOf("Hold production"))
  assert.deepEqual(side.build.state.held, ["25,10"])
  clickCell(side, side.layout.panelColumn + 1, rowOf("Resume production"))
  assert.deepEqual(side.build.state.held, [])
})
