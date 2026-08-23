// The scenario format and its loader, and one assertion per named rule fixture.
//
// "Every rule is a scenario file — checked in, named, runnable. That is the regression suite and
// the documentation at the same time" (milestone-1-spike-battle.md 3.9).

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { DEFAULT_PRESET, ScenarioError, loadScenario, presetDimensions } from "../src/scenario/index.ts"
import type { ScenarioDefinition } from "../src/scenario/index.ts"
import { loadScenarioFile, resolveScenario, scenarioFiles } from "./helpers.ts"

function baseScenario(): ScenarioDefinition {
  return {
    id: "loader-fixture",
    name: "Loader fixture",
    grid: { width: 4, height: 3 },
    seed: 1,
    pulseTicks: 12,
    terrain: ["....", "....", "...."],
    terrainLegend: { ".": "terrain.plain", "#": "terrain.rock" },
    placements: ["t   ", "    ", "   T"],
    placementLegend: {
      t: { player: "A", content: "unit.citizen.trooper" },
      T: { player: "B", content: "unit.citizen.trooper" },
    },
  }
}

test("the default preset is 48 x 16, which the 80-column composition is derived from", () => {
  // RULE: change this and the 80- and 128-column layouts stop falling out of one number.
  assert.equal(DEFAULT_PRESET, "medium-extra-wide")
  assert.deepEqual(presetDimensions(DEFAULT_PRESET), { width: 48, height: 16 })
})

test("the preset matrix matches engine.md 3.1", () => {
  assert.deepEqual(presetDimensions("small-wide"), { width: 24, height: 12 })
  assert.deepEqual(presetDimensions("medium-extra-wide"), { width: 48, height: 16 })
  assert.deepEqual(presetDimensions("extra-large-extra-wide"), { width: 72, height: 24 })
  assert.deepEqual(presetDimensions("small-squared"), { width: 12, height: 12 })
})

test("scenario rows read north to south and (0,0) is the north-west tile", () => {
  const scenario: ScenarioDefinition = {
    ...baseScenario(),
    terrain: ["#...", "....", "...."],
    placements: ["t   ", "    ", "   T"],
  }
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY })
  assert.equal(loaded.state.grid.tiles[0], "terrain.rock", "the first row is not the north row")
  const [first, second] = loaded.state.entities
  assert.ok(first !== undefined && second !== undefined)
  assert.deepEqual(first.anchor, { x: 0, y: 0 })
  assert.deepEqual(second.anchor, { x: 3, y: 2 })
})

test("the loader fails loudly, naming the offending line and column", () => {
  const cases: ReadonlyArray<readonly [string, Partial<ScenarioDefinition>, RegExp]> = [
    ["terrain row count", { terrain: ["....", "...."] }, /terrain has 2 rows; the grid is 3 tall/],
    ["terrain row width", { terrain: ["...", "....", "...."] }, /terrain row 1 \(y=0\) is 3 characters/],
    [
      "unknown terrain key",
      { terrain: ["..?.", "....", "...."] },
      /terrain row 1, column 3 \(x=2,y=0\).*terrain legend does not define/s,
    ],
    [
      "unknown placement key",
      { placements: ["z   ", "    ", "   T"] },
      /placements row 1, column 1 \(x=0,y=0\).*placement legend does not define/s,
    ],
    [
      "unknown content id",
      {
        placementLegend: {
          t: { player: "A", content: "unit.citizen.nonesuch" },
          T: { player: "B", content: "unit.citizen.trooper" },
        },
      },
      /unknown content id "unit.citizen.nonesuch"/,
    ],
    [
      "footprint off the Grid",
      {
        placementLegend: {
          t: { player: "A", content: "unit.citizen.hauler" },
          T: { player: "B", content: "unit.citizen.trooper" },
        },
        placements: ["  t ", "    ", "   T"],
      },
      /reaches \(4,0\), which is outside the 4x3 Grid/,
    ],
    [
      "overlapping footprint",
      {
        placementLegend: {
          t: { player: "A", content: "unit.citizen.hauler" },
          T: { player: "B", content: "unit.citizen.trooper" },
        },
        placements: ["t T ", "    ", "    "],
      },
      /overlaps A:hauler#1 at \(2,0\) on the units layer/,
    ],
    ["a Grid with nobody on it", { placements: ["    ", "    ", "    "] }, /places no entities/],
    ["a non-positive tick count", { pulseTicks: 0 }, /pulseTicks must be a positive integer/],
    [
      "a custom grid over the declared-mode tile cap",
      { grid: { width: 200, height: 200 } },
      /grid is 200x200 \(40000 tiles\), over the 10000-tile declared-mode cap/,
    ],
  ]

  for (const [label, override, pattern] of cases) {
    assert.throws(
      () => loadScenario({ ...baseScenario(), ...override }, { registry: FIXTURE_REGISTRY }),
      (error: unknown) => {
        assert.ok(error instanceof ScenarioError, `${label}: not a ScenarioError`)
        assert.match(error.message, pattern, label)
        return true
      },
      label,
    )
  }
})

test("a .map.json file loads as plain data, safely, from a test", async () => {
  const scenario = await loadScenarioFile("citizen-mirror-skirmish.map.json")
  assert.equal(scenario.id, "citizen-mirror-skirmish")
  assert.equal(scenario.terrain.length, 12)
  assert.equal(scenario.terrain[0]?.length, 24)
})

test("at least ten named scenario files exist, plus the mirror skirmish", () => {
  const files = scenarioFiles()
  assert.ok(files.includes("citizen-mirror-skirmish.map.json"))
  assert.ok(
    files.length >= 11,
    `only ${files.length} scenarios exist; the gate asks for ten plus the mirror`,
  )
})

test("every scenario file loads, and its id matches its file name", async () => {
  for (const name of scenarioFiles()) {
    const scenario = await loadScenarioFile(name)
    assert.equal(`${scenario.id}.map.json`, name, `${name} declares the id "${scenario.id}"`)
    assert.doesNotThrow(() => loadScenario(scenario, { registry: FIXTURE_REGISTRY }), name)
  }
})

test("melee-kill: a defender dies to melee and the attackers survive", async () => {
  const resolved = await resolveScenario("melee-kill.map.json")
  const deaths = resolved.run.events.filter((event) => event.kind === "entity.died")
  assert.equal(deaths.length, 1)
  assert.equal(deaths[0]?.player, "B")
  const melee = resolved.run.events.filter(
    (event) => event.kind === "attack.launched" && event.attackKind === "melee",
  )
  assert.ok(melee.length > 0)
  assert.equal(resolved.run.finalState.outcome?.winner, "A")
})

test("ranged-kill: the fixture reproduces the arithmetic milestone 3.6 claims for it", async () => {
  // "Two marksmen land six shots during that same approach. The trooper arrives at 4 health and
  // dies." That sentence is the fixture's design, so the fixture is where it gets checked.
  const resolved = await resolveScenario("ranged-kill.map.json")
  const shots = resolved.run.events.filter(
    (event) => event.kind === "attack.launched" && event.attackKind === "ranged",
  )
  const death = resolved.run.events.find((event) => event.kind === "entity.died")
  assert.ok(death !== undefined && death.kind === "entity.died")
  assert.equal(death.player, "B")
  assert.equal(shots.length, 8, "eight shots in total: six during the approach and two that killed")

  const approach = shots.filter((event) => event.tick < death.tick)
  assert.equal(approach.length, 6, "the approach did not cost the trooper six shots")

  const arrived = resolved.run.events.filter(
    (event) => event.kind === "damage.applied" && event.ordinal === death.ordinal,
  )
  const beforeTheLast = arrived[arrived.length - 2]
  assert.ok(beforeTheLast !== undefined && beforeTheLast.kind === "damage.applied")
  assert.equal(beforeTheLast.hpAfter, 4, "the trooper did not arrive at 4 health")

  for (const shot of shots) {
    if (shot.kind !== "attack.launched") continue
    assert.ok(shot.flightWindowTicks >= 1, "a ranged attack carried no flight window")
  }
  assert.equal(resolved.run.finalState.outcome?.winner, "A")
})

test("trooper-versus-marksman: melee wins the charge, at a measured cost", async () => {
  // milestone 3.6 predicts the trooper "eats three shots, arriving at 22 of 40 health", then kills
  // the marksman "while taking two more" and finishes "at a quarter health". The first half is
  // exact. The second is one shot out: the marksman lands one more, not two, so the trooper
  // finishes at 16 of 40 rather than 10. Recorded in evidence/report.md Section 7.
  const resolved = await resolveScenario("trooper-versus-marksman.map.json")
  const trooper = resolved.run.finalState.entities.find((entity) => entity.player === "A")
  assert.ok(trooper !== undefined, "the trooper did not survive, so melee no longer wins the charge")
  assert.equal(resolved.run.finalState.outcome?.winner, "A")

  const hits = resolved.run.events.filter(
    (event) => event.kind === "damage.applied" && event.entity === trooper.id,
  )
  const arrival = hits[2]
  assert.ok(arrival !== undefined && arrival.kind === "damage.applied")
  assert.equal(arrival.hpAfter, 22, "the approach no longer costs exactly three shots")
  assert.equal(trooper.hp, 16, "the measured finishing health changed")
})

test("worker-flight: the worker runs, and workers count for annihilation", async () => {
  const resolved = await resolveScenario("worker-flight.map.json")
  const fleeing = resolved.run.events.filter((event) => event.kind === "behavior.flee")
  assert.ok(fleeing.length > 0, "the worker never fled")

  // It flees away from the threat: the distance it is reported at never drops below the trigger
  // for long, and its first move is eastward, directly away from the marksman.
  const firstMove = resolved.run.events.find(
    (event) => event.kind === "entity.moved" && event.entity.startsWith("B:worker"),
  )
  assert.ok(firstMove !== undefined && firstMove.kind === "entity.moved")
  assert.ok(firstMove.to.x > firstMove.from.x, "the worker did not move away from the threat")

  assert.equal(resolved.run.finalState.outcome?.reason, "annihilation")
  assert.equal(resolved.run.finalState.outcome?.winner, "A")
})

test("obstacle-routing: the trooper rounds the spine instead of stalling", async () => {
  const resolved = await resolveScenario("obstacle-routing.map.json")
  const passed = resolved.run.events.some(
    (event) => event.kind === "entity.moved" && event.to.x > 12,
  )
  assert.ok(passed, "the trooper never got past the rock spine")
})

test("structure-destruction: destroying a Grid Nexus ends the Pulse", async () => {
  const resolved = await resolveScenario("structure-destruction.map.json")
  assert.equal(resolved.run.finalState.outcome?.reason, "nexus-destroyed")
  assert.equal(resolved.run.finalState.outcome?.winner, "A")
})

test("salvage-drop: death leaves a ground item on the tile it died on", async () => {
  const resolved = await resolveScenario("salvage-drop.map.json")
  const death = resolved.run.events.find((event) => event.kind === "entity.died")
  const salvage = resolved.run.events.find((event) => event.kind === "salvage.dropped")
  assert.ok(death !== undefined && death.kind === "entity.died")
  assert.ok(salvage !== undefined && salvage.kind === "salvage.dropped")
  assert.equal(salvage.tick, death.tick)
  assert.deepEqual(salvage.at, death.at)
  const item = resolved.run.finalState.groundItems.find((entry) => entry.sourceId === death.entity)
  assert.ok(item !== undefined, "the salvage event dropped nothing into state")
  assert.equal(item.amount, FIXTURE_REGISTRY.get(death.contentId).salvage)
})

test("annihilation-victory: the Pulse ends only once every mobile entity is dead", async () => {
  const resolved = await resolveScenario("annihilation-victory.map.json")
  assert.equal(resolved.run.finalState.outcome?.reason, "annihilation")
  const dead = resolved.run.events.filter((event) => event.kind === "entity.died")
  assert.equal(dead.filter((event) => event.player === "B").length, 2)
  // The worker was one of the two: workers count (Q13).
  assert.ok(dead.some((event) => event.contentId === "unit.citizen.worker"))
})

test("tick-limit-draw: neither side can reach the other, and the Pulse ends on its count", async () => {
  const resolved = await resolveScenario("tick-limit-draw.map.json")
  assert.equal(resolved.run.finalState.outcome?.reason, "tick-limit")
  assert.equal(resolved.run.finalState.outcome?.winner, null)
  assert.equal(resolved.run.finalState.tick, resolved.run.pulseTicks)
  assert.equal(resolved.run.events.filter((event) => event.kind === "attack.launched").length, 0)
})
