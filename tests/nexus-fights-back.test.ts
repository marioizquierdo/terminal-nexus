// The Grid Nexus fights back (the owner, 2026-10-21: "the Nexus have a single attack that deals enough damage to kill a
// trooper"): one shot every three seconds at a unit within a marksman's reach, never at a building, and a trooper or a
// runner falls to it where it stands. Its mending between rounds is the regroup's, tested in tests/match.test.ts.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { resolveScenario } from "./helpers.ts"

test("the Citizen and the Ravel Nexus each shoot alike: enough to drop a trooper or a runner in one hit, at units only", () => {
  const citizen = FIXTURE_REGISTRY.get("structure.citizen.nexus")
  const ravel = FIXTURE_REGISTRY.get("structure.ravel.nexus")
  assert.deepEqual(ravel.attack, citizen.attack)
  assert.deepEqual(ravel.targetLayers, citizen.targetLayers)
  assert.ok(citizen.attack !== undefined)
  assert.ok(citizen.attack.damage >= FIXTURE_REGISTRY.get("unit.citizen.trooper").maxHp, "a trooper outlives a shot")
  assert.ok(citizen.attack.damage >= FIXTURE_REGISTRY.get("unit.ravel.runner").maxHp, "a runner outlives a shot")
  assert.ok(citizen.attack.damage < FIXTURE_REGISTRY.get("unit.ravel.raider").maxHp, "a raider falls to one shot: the Nexus is a stop, not a wall")
  assert.equal(citizen.attack.range, FIXTURE_REGISTRY.get("unit.citizen.marksman").attack?.range)
  assert.ok(!(citizen.targetLayers ?? []).includes("obstacles"), "it may shoot a building")
  // The bench's own Grid Nexus, the kernel scenarios' target, stays as the Nexus was: it never shoots and never mends.
  const bench = FIXTURE_REGISTRY.get("structure.bench.nexus")
  assert.equal(bench.nexus, true)
  assert.equal(bench.attack, undefined)
  assert.equal(bench.mends, undefined)
})

test("nexus-fights-back: a trooper walking at the Nexus falls to its one shot, and the Den in its reach is never shot", async () => {
  const { run: battle } = await resolveScenario("nexus-fights-back.map.json")
  const shots = battle.events.filter((event) => event.kind === "damage.applied" && event.source === "A:nexus#1")
  assert.equal(shots.length, 1, "it took more than one shot")
  assert.equal(shots[0]?.kind === "damage.applied" ? shots[0].entity : undefined, "B:trooper#2")
  assert.ok(battle.events.some((event) => event.kind === "entity.died" && event.entity === "B:trooper#2"))
  assert.ok(!battle.events.some((event) => event.kind === "damage.applied" && event.entity === "B:den#3"), "it shot a building")
  assert.deepEqual([battle.finalState.outcome?.winner, battle.finalState.outcome?.reason], ["A", "annihilation"])
})
