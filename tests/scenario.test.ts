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
  // The rock sits at (0,0) purely to pin down which corner "index 0" is; the trooper that used to
  // share that tile moved one column over so the two checks stop colliding now that the loader
  // refuses a ground entity placed on impassable terrain.
  const scenario: ScenarioDefinition = {
    ...baseScenario(),
    terrain: ["#...", "....", "...."],
    placements: [" t  ", "    ", "   T"],
  }
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY })
  assert.equal(loaded.state.grid.tiles[0], "terrain.rock", "the first row is not the north row")
  const [first, second] = loaded.state.entities
  assert.ok(first !== undefined && second !== undefined)
  assert.deepEqual(first.anchor, { x: 1, y: 0 })
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

test("defineScenario does no work, so a scenario file is safe to import from a test", async () => {
  const scenario = await loadScenarioFile("citizen-mirror-skirmish.ts")
  assert.equal(scenario.id, "citizen-mirror-skirmish")
  assert.equal(scenario.terrain.length, 12)
  assert.equal(scenario.terrain[0]?.length, 24)
})

test("at least ten named scenario files exist, plus the mirror skirmish", () => {
  const files = scenarioFiles()
  assert.ok(files.includes("citizen-mirror-skirmish.ts"))
  assert.ok(
    files.length >= 11,
    `only ${files.length} scenarios exist; the gate asks for ten plus the mirror`,
  )
})

test("every scenario file loads, and its id matches its file name", async () => {
  for (const name of scenarioFiles()) {
    const scenario = await loadScenarioFile(name)
    assert.equal(`${scenario.id}.ts`, name, `${name} declares the id "${scenario.id}"`)
    assert.doesNotThrow(() => loadScenario(scenario, { registry: FIXTURE_REGISTRY }), name)
  }
})

test("melee-kill: a defender dies to melee and the attackers survive", async () => {
  const resolved = await resolveScenario("melee-kill.ts")
  const deaths = resolved.run.events.filter((event) => event.kind === "entity.died")
  assert.equal(deaths.length, 1)
  assert.equal(deaths[0]?.player, "B")
  const melee = resolved.run.events.filter(
    (event) => event.kind === "attack.launched" && event.attackKind === "melee",
  )
  assert.ok(melee.length > 0)
  assert.equal(resolved.run.finalState.outcome?.winner, "A")
})

test("ranged-kill: the fixture's own arithmetic, after two 2026-08-22 speed passes", async () => {
  // Before any speed pass this fixture was a clean demonstration: two marksmen land six shots
  // during the trooper's approach and it dies at range, never landing a hit. The first speed pass
  // (1.5x, "units still move too slow... it takes a while to reach initial engagement") already
  // broke that cleanly - the trooper started reaching marksman#1 and killing it in melee. This is
  // the second pass (2x the ORIGINAL rate, not another factor on the first - "still too slow... 2
  // or 2.5 times faster"), and it goes further still: the trooper now also reaches marksman#3 after
  // killing marksman#1, wounding it in melee before finally dying to its ranged fire. A still wins,
  // now having lost one marksman and wounded the other, rather than losing nobody. Left as a
  // disclosed side effect of the speed changes rather than re-tuned back, same reasoning as the
  // first pass: fixing it would mean touching combat numbers nobody asked to change, and this is
  // exactly the kind of retune milestone 3.6 says fixture content is for.
  const resolved = await resolveScenario("ranged-kill.ts")
  const shots = resolved.run.events.filter(
    (event) => event.kind === "attack.launched" && event.attackKind === "ranged",
  )
  const melee = resolved.run.events.filter(
    (event) => event.kind === "attack.launched" && event.attackKind === "melee",
  )
  const deaths = resolved.run.events.filter((event) => event.kind === "entity.died")
  assert.equal(shots.length, 7, "seven ranged shots in total")
  assert.equal(melee.length, 5, "five melee swings from the trooper before it dies")
  assert.equal(deaths.length, 2, "one marksman and the trooper both die now, not the trooper alone")
  assert.equal(deaths[0]?.entity, "A:marksman#1", "the trooper no longer dies before landing a hit")
  assert.equal(deaths[0]?.player, "A")
  assert.equal(deaths[1]?.entity, "B:trooper#2")
  assert.equal(deaths[1]?.player, "B")

  for (const shot of shots) {
    if (shot.kind !== "attack.launched") continue
    assert.ok(shot.flightWindowTicks >= 1, "a ranged attack carried no flight window")
  }

  const survivor = resolved.run.finalState.entities.find((entity) => entity.id === "A:marksman#3")
  assert.ok(survivor !== undefined, "the second marksman should still be standing")
  assert.equal(survivor.hp, 17, "the trooper should reach and wound the second marksman before dying")
  assert.equal(resolved.run.finalState.outcome?.winner, "A")
})

test("trooper-versus-marksman: melee wins the charge, at a measured cost", async () => {
  // milestone 3.6 predicts the trooper "eats three shots, arriving at 22 of 40 health, then kills
  // the marksman" - still exact after the 2026-08-22 speed pass (owner playtest: "units still move
  // too slow"), because the faster trooper closes the marksman's cooldown-24 firing window in fewer
  // ticks: the marksman gets zero more shots in after the trooper arrives, not one, so the trooper
  // finishes the fight at its arrival health, 22 of 40, rather than 16.
  const resolved = await resolveScenario("trooper-versus-marksman.ts")
  const trooper = resolved.run.finalState.entities.find((entity) => entity.player === "A")
  assert.ok(trooper !== undefined, "the trooper did not survive, so melee no longer wins the charge")
  assert.equal(resolved.run.finalState.outcome?.winner, "A")

  const hits = resolved.run.events.filter(
    (event) => event.kind === "damage.applied" && event.entity === trooper.id,
  )
  const arrival = hits[2]
  assert.ok(arrival !== undefined && arrival.kind === "damage.applied")
  assert.equal(arrival.hpAfter, 22, "the approach no longer costs exactly three shots")
  assert.equal(hits.length, 3, "the marksman should get no shots in after the trooper arrives")
  assert.equal(trooper.hp, 22, "the measured finishing health changed")
})

test("worker-flight: the worker runs, and workers count for annihilation", async () => {
  const resolved = await resolveScenario("worker-flight.ts")
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
  const resolved = await resolveScenario("obstacle-routing.ts")
  const passed = resolved.run.events.some(
    (event) => event.kind === "entity.moved" && event.to.x > 12,
  )
  assert.ok(passed, "the trooper never got past the rock spine")
})

test("structure-destruction: destroying a Grid Nexus ends the Pulse", async () => {
  const resolved = await resolveScenario("structure-destruction.ts")
  assert.equal(resolved.run.finalState.outcome?.reason, "nexus-destroyed")
  assert.equal(resolved.run.finalState.outcome?.winner, "A")
})

test("salvage-drop: death leaves a ground item on the tile it died on", async () => {
  const resolved = await resolveScenario("salvage-drop.ts")
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
  const resolved = await resolveScenario("annihilation-victory.ts")
  assert.equal(resolved.run.finalState.outcome?.reason, "annihilation")
  const dead = resolved.run.events.filter((event) => event.kind === "entity.died")
  assert.equal(dead.filter((event) => event.player === "B").length, 2)
  // The worker was one of the two: workers count (Q13).
  assert.ok(dead.some((event) => event.contentId === "unit.citizen.worker"))
})

test("tick-limit-draw: neither side can reach the other, and the Pulse ends on its count", async () => {
  const resolved = await resolveScenario("tick-limit-draw.ts")
  assert.equal(resolved.run.finalState.outcome?.reason, "tick-limit")
  assert.equal(resolved.run.finalState.outcome?.winner, null)
  assert.equal(resolved.run.finalState.tick, resolved.run.pulseTicks)
  assert.equal(resolved.run.events.filter((event) => event.kind === "attack.launched").length, 0)
})
