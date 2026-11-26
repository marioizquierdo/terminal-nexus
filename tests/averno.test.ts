// Marshal Averno, the second Commander (docs/game-design/commander-armies.md, the mirror): the same Citizen army as
// Vasse's, pressed forward. He charges and his aura makes his units hit harder; his powers act on the enemy; some
// rounds one card of his hand comes from the Ravel Nexus; and he is filed a round late when he falls. Played on the
// starter map's Skirmish with him in her place (`saves/starter.save.json`).

import { test } from "node:test"
import assert from "node:assert/strict"
import { ARMIES, dealHand } from "../src/armies/index.ts"
import { currentCard } from "../src/build/card.ts"
import { popupSpec } from "../src/build/popup.ts"
import { withoutScene } from "../src/build/state.ts"
import { openRound } from "../src/cli/levels.ts"
import { keepPower, skirmishLevel } from "../src/cli/skirmish-play.ts"
import type { SaveFile } from "../src/skirmish/save.ts"
import starterSave from "../saves/starter.save.json" with { type: "json" }
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { VISION, visionOf } from "../src/engine/pulse/target.ts"
import { buildSide, compose, keys, panelLines } from "./build-helpers.ts"

const AVERNO = "unit.citizen.averno"
const starter = starterSave as unknown as SaveFile
/** The starter map's Skirmish with Averno leading side A in her place. */
const LEVEL = skirmishLevel({ ...starter, setup: { ...starter.setup, slots: { ...starter.setup.slots, p1: { ...starter.setup.slots.p1, commander: "averno" } } } })

test("leading a Skirmish, he walks out with the starting package in her place", () => {
  const first = LEVEL.firstRound()
  assert.ok((first.incoming ?? []).some((entity) => entity.contentId === AVERNO), "he does not walk out with his troops")
  assert.equal((first.incoming ?? []).some((entity) => entity.contentId === "unit.citizen.vasse"), false)
  assert.equal(first.commander?.contentId, AVERNO)
})

test("he charges: he turns to fight from twice as far as every other unit, and his Forward Order makes hits harder", () => {
  const averno = FIXTURE_REGISTRY.get(AVERNO)
  assert.equal(averno.commander, true)
  assert.equal(visionOf(averno), 12, "Averno's army names its vision")
  assert.equal(visionOf(averno), 2 * VISION)
  assert.equal(visionOf(FIXTURE_REGISTRY.get("unit.citizen.vasse")), VISION)
  assert.deepEqual(averno.abilities, [{ kind: "aura", name: "Forward Order", radius: 4, damageDealtPercent: 125 }])
  // A round late: out for the round after the one he falls in, where she is back the next.
  assert.equal(averno.roundsOut, 1)
})

test("in rounds 2 and 4 one card of his hand is the Ravel Nexus's, tagged Ravel; in the others none is", () => {
  // His army's pool and schedule: what every battle he leads deals from.
  const pool = ARMIES.arsenals["averno"]?.powers ?? []
  const schedule = ARMIES.commanders.find((commander) => commander.id === "averno")?.schedule
  assert.ok(schedule !== undefined)
  assert.ok(pool.some((card) => card.from === "ravel"))
  for (let round = 1; round <= 5; round += 1) {
    for (const seed of [1, 7, 1129666118]) {
      const hand = dealHand({ pool, kept: [], seed, round, schedule, standing: new Set() })
      const ravel = hand.filter((card) => card.from === "ravel")
      assert.equal(ravel.length, round === 2 || round === 4 ? 1 : 0, `round ${round}, seed ${seed}: ${hand.map((card) => card.id).join(", ")}`)
    }
  }
  // On the Nexus Pulse popup, the Ravel card says whose it is where the others say how rare they are.
  const second = withoutScene(openRound(LEVEL, 2))
  const side = buildSide({ context: second })
  keys(side, "n")
  const spec = popupSpec(side.context, side.build.state)
  const tags = (spec?.rows ?? []).map((row) => ("tag" in row ? row.tag : undefined))
  assert.ok(tags.includes("Ravel"), `the hand's tags are ${tags.join(", ")}`)
})

test("Unfiled Ordnance makes his troopers burst when they die, for the rest of the battle", () => {
  const context = LEVEL.firstRound()
  const card = ARMIES.armies.flatMap((army) => army.powers ?? []).find((power) => power.id === "unfiled-ordnance")
  assert.ok(card !== undefined)
  assert.equal(context.registry.get("unit.citizen.trooper").detonation, undefined)
  const kept = keepPower(context, card)
  assert.deepEqual(kept.registry.get("unit.citizen.trooper").detonation, { radius: 2, damage: 8 })
  assert.equal(kept.registry.get("unit.citizen.marksman").detonation, context.registry.get("unit.citizen.marksman").detonation)
})

test("his card names him, says he is restored a round late, and gives his aura as what his units deal", () => {
  const side = buildSide({ context: withoutScene(LEVEL.firstRound()) })
  const unit = (side.context.incoming ?? []).find((entity) => entity.contentId === AVERNO)
  assert.ok(unit !== undefined)
  keys(side, "e")
  const { cursor } = side.build.state
  side.build.run([{ kind: "move-cursor", dx: unit.anchor.x - cursor.x, dy: unit.anchor.y - cursor.y }])
  const card = currentCard(side.context, side.build.state)
  assert.equal(card?.title, "Averno")
  // His own health: the Experiment "Vasse's health" is hers.
  assert.equal(card?.stats.find((stat) => stat.label === "HEALTH")?.value, "70")
  const text = panelLines(side, compose(side)).join(" ").replace(/\s+/gu, " ")
  assert.match(text, /Forward Order: he and his units within range 4 deal 25% more damage\./u)
  assert.match(text, /a round late/u)
})
