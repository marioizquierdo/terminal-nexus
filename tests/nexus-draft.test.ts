// The Nexus draft (commander-armies.md, what a Nexus power does): a small hand dealt from the army's Nexus power
// pool at each Build Phase, War Chest beside it, one kept — and what each of PERIMETER's four powers does once
// kept, from the moment it is picked to the end of the mission. The dealer is seeded and repeatable, and draws
// from a stream of its own, so dealing never moves a battle.

import { test } from "node:test"
import assert from "node:assert/strict"
import type { PowerCard } from "../src/armies/index.ts"
import { dealable, dealHand, HAND_SIZE, PERIMETER, PERIMETER_LEVEL } from "../src/armies/index.ts"
import { nexusDraftOf, STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { wavesStat } from "../src/build/card.ts"
import { buildLayout } from "../src/build/layout.ts"
import { popupSpec } from "../src/build/popup.ts"
import type { BuildContext } from "../src/build/state.ts"
import { createBuildState, nexusPowers, nexusTile } from "../src/build/state.ts"
import { missionPlay } from "../src/cli/pulse-run.ts"
import { starterContext } from "../src/cli/starter.ts"
import { gridDistance } from "../src/grid/coords.ts"
import { buildSide, compose, keys, panelLines, screenText } from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"

const POOL = PERIMETER_LEVEL.offer.powers
const play = missionPlay(PERIMETER)
const VASSE = "unit.citizen.vasse"
const TROOPER = "unit.citizen.trooper"
const BARRACKS = "structure.citizen.barracks"

/** One of PERIMETER's powers, by id. */
function power(id: string): PowerCard {
  const card = POOL.find((candidate) => candidate.id === id)
  assert.ok(card !== undefined, `PERIMETER offers no power "${id}"`)
  return card
}

/** Round 1 of PERIMETER with this hand dealt — the given powers, then War Chest — so a test picks what it means to. */
function dealt(...ids: string[]): BuildContext {
  return { ...starterContext(), nexusDraft: nexusDraftOf({ powers: [...ids.map(power), power("war-chest")] }) }
}

/** A Build Phase on `context` that keeps what it picks and plays PERIMETER's rounds, as the game's does. */
function side(context: BuildContext): BuildSide {
  return buildSide({ context, keep: play.keep, startPulse: play.startPulse, nextRound: play.nextRound })
}

/** A Build Phase state on `context`, as a round opens. */
function opened(context: BuildContext) {
  return createBuildState(context, STARTER_START_CURSOR, buildLayout({ columns: 80, rows: 24 }, context.grid).viewport)
}

// --- The dealer ----------------------------------------------------------------------------------------------

test("a hand deals two of the pool, then War Chest beside them; the same seed and round deal the same hand", () => {
  const hand = dealHand(POOL, [], PERIMETER.seed, 1)
  assert.equal(hand.length, HAND_SIZE + 1)
  assert.equal(hand.at(-1)?.id, "war-chest", "War Chest is not beside the hand")
  assert.ok(hand.slice(0, HAND_SIZE).every((card) => card.always !== true), "War Chest was dealt into the hand")
  assert.deepEqual(dealHand(POOL, [], PERIMETER.seed, 1), hand, "the same deal came out different")
  // Over many seeds and rounds every power the pool deals turns up, and no hand holds a power twice.
  const seen = new Set<string>()
  for (let seed = 0; seed < 200; seed += 1) {
    for (const round of [1, 2, 3]) {
      const each = dealHand(POOL, [], seed, round)
      assert.equal(new Set(each.map((card) => card.id)).size, each.length, `seed ${seed}, round ${round}: a power dealt twice`)
      for (const card of each) seen.add(card.id)
    }
  }
  assert.deepEqual([...seen].sort(), POOL.map((card) => card.id).sort())
  // The round the game opens deals exactly this.
  assert.deepEqual(
    starterContext().nexusDraft.map((option) => [option.hotkey, option.card.id]),
    hand.map((card, index) => [String(index + 1), card.id]),
  )
})

test("a power kept once is never dealt again; one that may be kept again, Reserve Callup, is", () => {
  const once = [power("standing-order"), power("aid-station-permit"), power("drill-schedule")]
  for (let seed = 0; seed < 50; seed += 1) {
    assert.deepEqual(
      dealHand(POOL, once, seed, 2).map((card) => card.id),
      ["reserve-callup", "war-chest"],
      `seed ${seed}: with only Reserve Callup left, the hand holds it and War Chest`,
    )
  }
  assert.deepEqual(
    dealable(POOL, [power("reserve-callup")]).map((card) => card.id),
    ["reserve-callup", "drill-schedule", "standing-order", "aid-station-permit"],
  )
})

test("dealing draws from a stream of its own: whatever the hand, a round with no power kept plays the same battle", () => {
  const context = starterContext()
  const other: BuildContext = { ...context, nexusDraft: nexusDraftOf({ powers: dealHand(POOL, [], PERIMETER.seed + 7, 1) }) }
  assert.notDeepEqual(
    other.nexusDraft.map((option) => option.card.id),
    context.nexusDraft.map((option) => option.card.id),
    "pick a seed that deals another hand",
  )
  const first = play.startPulse(context, opened(context))
  const second = play.startPulse(other, opened(other))
  assert.ok(first !== null && second !== null)
  assert.equal(second.timeline.stateHash, first.timeline.stateHash)
  assert.equal(second.timeline.eventsHash, first.timeline.eventsHash)
})

// --- What each power does once kept ----------------------------------------------------------------------------

test("Aid Station Permit puts the Aid Station on the menu at once, under the next digit, for the rest of the mission", () => {
  const permit = side(dealt("aid-station-permit"))
  keys(permit, "n", "1")
  assert.deepEqual(
    permit.build.round.catalog.map((item) => `${item.hotkey} ${item.label} ${item.cost}`),
    ["1 Barracks 40", "2 Hatchery 30", "3 Turret 15", "4 Aid Station 25"],
  )
  assert.match(panelLines(permit, compose(permit)).join("\n"), /\[4\] Aid Station +25/)
  keys(permit, "4")
  assert.equal(permit.build.state.armed, 3, "the Aid Station cannot be placed in the round it is unlocked")
  // The round after has it still, kept.
  const resolved = play.startPulse(permit.build.round, permit.build.state)
  assert.ok(resolved !== null)
  const next = play.nextRound(permit.build.round, permit.build.state, resolved)
  assert.ok(next !== null)
  assert.equal(next.catalog.at(-1)?.label, "Aid Station")
  assert.deepEqual(next.kept?.map((card) => card.id), ["aid-station-permit"])
  assert.ok(!next.nexusDraft.some((option) => option.card.id === "aid-station-permit"), "a permit kept was dealt again")
})

test("Drill Schedule sends every Barracks a second wave: its card says so, and the battle trains twice as many", () => {
  const trainedIn = (context: BuildContext): number => {
    const resolved = play.startPulse(context, opened(context))
    assert.ok(resolved !== null)
    return resolved.timeline.events.filter((event) => event.kind === "entity.spawned" && event.trainedBy !== undefined).length
  }
  const drill = side(dealt("drill-schedule"))
  const without = trainedIn(drill.build.round)
  keys(drill, "n", "1")
  assert.deepEqual(wavesStat(drill.build.round, BARRACKS, drill.build.state), { label: "WAVES", value: "4 at 5s, 15s" })
  assert.ok(without > 0, "PERIMETER's Barracks trains nothing in round 1")
  assert.equal(trainedIn(drill.build.round), without * 2)
})

test("Standing Order doubles By the Book's reach: her card says range 8, and the battle runs on it", () => {
  const order = side(dealt("standing-order"))
  const reach = order.build.round.registry.get(VASSE).aura?.radius
  keys(order, "n", "1")
  assert.equal(order.build.round.registry.get(VASSE).aura?.radius, (reach ?? 0) * 2)
  assert.equal(reach, 4)
  // Her card, explored where she arrives.
  const vasse = (order.build.round.incoming ?? []).find((entity) => entity.contentId === VASSE)
  assert.ok(vasse !== undefined)
  order.build.run([{ kind: "look-at", x: vasse.anchor.x, y: vasse.anchor.y }, { kind: "explore" }])
  assert.match(screenText(order).replace(/\s+\|?\s*/g, " "), /within range 8/)
  const resolved = play.startPulse(order.build.round, order.build.state)
  assert.ok(resolved !== null)
  assert.equal(resolved.timeline.registry.get(VASSE).aura?.radius, 8)
})

test("Reserve Callup: two troopers join at the Nexus — shown arriving the moment it is picked, set down as the round starts", () => {
  const callup = side(dealt("reserve-callup"))
  const before = callup.build.round
  keys(callup, "n", "1")
  const after = callup.build.round
  const troopers = (context: BuildContext) => (context.incoming ?? []).filter((entity) => entity.player === "A" && entity.contentId === TROOPER)
  assert.equal(troopers(after).length, troopers(before).length + 2, "the two troopers are not shown arriving")
  // Beside the Grid Nexus: the two new ones are its nearest troopers.
  const nexus = nexusTile(after)
  assert.ok(nexus !== null)
  const near = (entity: Readonly<{ anchor: Readonly<{ x: number; y: number }> }>) => gridDistance(entity.anchor, nexus)
  const added = troopers(after).filter((entity) => !troopers(before).some((was) => was.anchor.x === entity.anchor.x && was.anchor.y === entity.anchor.y))
  assert.equal(added.length, 2)
  for (const entity of added) assert.ok(near(entity) <= 8, `a called-up trooper stands ${near(entity)} from the Nexus`)
  // The battle sets them down where they were shown.
  const resolved = play.startPulse(after, callup.build.state)
  assert.ok(resolved !== null)
  const opening = resolved.timeline.states[0]
  assert.ok(opening !== undefined)
  for (const entity of added) {
    assert.ok(
      opening.entities.some((unit) => unit.player === "A" && unit.contentId === TROOPER && unit.anchor.x === entity.anchor.x && unit.anchor.y === entity.anchor.y),
      "a trooper shown arriving is not where the battle sets it down",
    )
  }
  // The round after calls nobody up again by itself, and lists nothing as active: the call-up was spent as the
  // round started, and the troopers it brought are units like any other. The power may be dealt again.
  const next = play.nextRound(after, callup.build.state, resolved)
  assert.ok(next !== null)
  assert.deepEqual(next.callups, [])
  assert.deepEqual(nexusPowers(after, callup.build.state).active.map((power) => power.name), ["Reserve Callup"])
  assert.deepEqual(nexusPowers(next, opened(next)).active, [])
})

test("a power kept lasts: the next round lists it as active, and the round's hand is dealt without it", () => {
  const order = side(dealt("standing-order"))
  keys(order, "n", "1")
  const resolved = play.startPulse(order.build.round, order.build.state)
  assert.ok(resolved !== null)
  const next = play.nextRound(order.build.round, order.build.state, resolved)
  assert.ok(next !== null)
  assert.equal(next.registry.get(VASSE).aura?.radius, 8, "Standing Order did not last into the next round")
  const state = { ...opened(next), popup: "nexus-powers" as const }
  const rows = popupSpec(next, state)?.rows ?? []
  const texts = rows.flatMap((row) => ("text" in row ? [row.text] : "label" in row ? [row.label] : []))
  const active = texts.indexOf("ACTIVE")
  assert.ok(active >= 0 && texts.slice(active).includes("Standing Order"), "the kept power is not listed as active")
  assert.ok(!next.nexusDraft.some((option) => option.card.id === "standing-order"))
  assert.equal(next.nexusDraft.at(-1)?.name, "War Chest")
})

// --- Optional, or required ---------------------------------------------------------------------------------------

test("the Nexus pick Experiment: required refuses Start Battle Round until a power is kept; optional starts without one", () => {
  const optional = buildSide()
  keys(optional, "s")
  assert.equal(optional.build.state.popup, "battle-round", "an optional pick held the round back")

  const required = buildSide()
  required.build.dispatch({ kind: "experiment-adjust", field: "powerPick", step: 1 })
  assert.equal(required.build.state.experiments.powerPick, "required")
  keys(required, "s")
  assert.equal(required.build.state.popup, null, "the round opened with the pick still waiting")
  assert.equal(required.build.state.status.text, "Pick a Nexus power first: [n].")
  keys(required, "n", "1", "s")
  assert.equal(required.build.state.popup, "battle-round")
})
