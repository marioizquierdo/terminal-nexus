// The route scenarios (scenarios/route-*.map.json; docs/system-design/measurement.md): each shape a route must manage,
// played on several seeds. Every one of them failed or queued on the first routing's greedy step (the baseline in
// docs/history/measurements/); on routes each is walked, and no unit stands still for good where a way exists.

import { test } from "node:test"
import assert from "node:assert/strict"
import { measureScenario } from "../src/measure/index.ts"
import { loadScenarioFile } from "./helpers.ts"

const SEEDS = [1, 2, 3, 4]

for (const [name, what] of [
  ["route-dead-end", "a trooper straight above its goal walks round the wall between"],
  ["route-pocket", "a trooper at the bottom of a cup of rock climbs out and round"],
  ["route-ridge-gap", "a squad files through a ridge's one gap, far off the straight line"],
  ["route-wide-gap", "a raider three wide passes by a gap two wide for one three wide"],
  ["route-crowd", "eight troopers in a file spread round one Nexus"],
] as const) {
  test(`${name}: ${what}, and the Nexus falls`, async () => {
    const scenario = await loadScenarioFile(`${name}.map.json`)
    for (const seed of SEEDS) {
      const { battle } = measureScenario(scenario, seed)
      assert.equal(battle.winner, "A", `seed ${seed}: ${battle.reason} at ${battle.ticks}`)
      assert.equal(battle.reason, "nexus-destroyed")
      assert.equal(battle.sides.A.stalled, 0, `seed ${seed}: a unit stood still for good`)
    }
  })
}

test("route-crowd: the file spreads round its target, and it falls in under a third of the time the greedy queue took", async () => {
  const scenario = await loadScenarioFile("route-crowd.map.json")
  const { battle } = measureScenario(scenario, 1)
  // On the greedy step the file queued and the Nexus stood until tick 785; spread round it, it falls in under a third.
  assert.ok(battle.ticks < 785 / 3, `the Nexus stood until tick ${battle.ticks}`)
})

test("route-corridor: two squads in one corridor never stand still for good, and either end wins about as often", async () => {
  const scenario = await loadScenarioFile("route-corridor.map.json")
  const won = { A: 0, B: 0 }
  for (let seed = 1; seed <= 16; seed += 1) {
    const { battle } = measureScenario(scenario, seed)
    assert.equal(battle.reason, "nexus-destroyed", `seed ${seed}: the corridor ended by ${battle.reason}`)
    assert.equal(battle.sides.A.stalled + battle.sides.B.stalled, 0, `seed ${seed}: a unit stood still for good`)
    if (battle.winner !== null) won[battle.winner] += 1
  }
  // A mirror: even odds give more than 12 of 16 to one end about one time in fifty; the seeds are fixed.
  assert.ok(Math.max(won.A, won.B) <= 12, `west ${won.A}, east ${won.B}`)
})

test("route-falling-building: the troopers break the Barracks closing the gap and go through once it falls", async () => {
  const scenario = await loadScenarioFile("route-falling-building.map.json")
  const { battle } = measureScenario(scenario, 1)
  assert.equal(battle.winner, "A")
  assert.equal(battle.sides.B.structuresLost, 2, "the Barracks and then the Nexus")
})
