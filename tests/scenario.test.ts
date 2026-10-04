// The scenario format and its loader, and one assertion per named rule fixture.
//
// "Every rule is a scenario file — checked in, named, runnable. That is the regression suite and
// the documentation at the same time" (docs/system-design/testing.md).

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { tilesOf } from "../src/grid/index.ts"
import { DEFAULT_PRESET, ScenarioError, TICKS_PER_SECOND, loadScenario, presetDimensions } from "../src/scenario/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../src/scenario/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { resolvePulse } from "../src/pulse/index.ts"
import { ENGAGE_RANGE } from "../src/pulse/target.ts"
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
    placements: {
      A: { rows: ["t"], legend: { t: { content: "unit.citizen.trooper" } } },
      B: { at: { x: 3, y: 2 }, rows: ["t"], legend: { t: { content: "unit.citizen.trooper" } } },
    },
  }
}

/** One player's block, spelled out, for a case that only varies one side. */
function block(
  at: { x: number; y: number },
  rows: readonly string[],
  legend: Record<string, { content: string; hp?: number }>,
): PlacementBlock {
  return { at, rows, legend }
}

test("the default preset is 48 x 16, which the 80-column composition is derived from", () => {
  // RULE: change this and the 80- and 128-column layouts stop falling out of one number.
  assert.equal(DEFAULT_PRESET, "medium-extra-wide")
  assert.deepEqual(presetDimensions(DEFAULT_PRESET), { width: 48, height: 16 })
})

test("the preset matrix matches the Grid page's table", () => {
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
    placements: {
      A: block({ x: 1, y: 0 }, ["t"], { t: { content: "unit.citizen.trooper" } }),
      B: block({ x: 3, y: 2 }, ["t"], { t: { content: "unit.citizen.trooper" } }),
    },
  }
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY })
  assert.equal(loaded.state.grid.tiles[0], "terrain.rock", "the first row is not the north row")
  const [first, second] = loaded.state.entities
  assert.ok(first !== undefined && second !== undefined)
  assert.deepEqual(first.anchor, { x: 1, y: 0 })
  assert.deepEqual(second.anchor, { x: 3, y: 2 })
})

test("a placement symbol marks the centre tile, whatever size the unit is", () => {
  // The whole point of centring: a placement grid stays one character per unit even when units stop
  // being one tile. A 3x1 hauler written at (2,1) covers (1,1)..(3,1) and is *stored* at (1,1).
  const loaded = loadScenario(
    {
      ...baseScenario(),
      grid: { width: 6, height: 3 },
      terrain: ["......", "......", "......"],
      placements: {
        A: block({ x: 2, y: 1 }, ["h"], { h: { content: "unit.citizen.hauler" } }),
      },
    },
    { registry: FIXTURE_REGISTRY },
  )
  const hauler = loaded.state.entities[0]
  assert.ok(hauler !== undefined)
  assert.deepEqual(hauler.anchor, { x: 1, y: 1 }, "the symbol should be the middle tile, not the anchor")
  assert.deepEqual(
    tilesOf(hauler.anchor, FIXTURE_REGISTRY.get(hauler.contentId).footprint),
    [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ],
  )
})

test("a block's `at` origin offsets its rows, so the grid need not cover the Grid", () => {
  const loaded = loadScenario(
    {
      ...baseScenario(),
      placements: {
        A: block({ x: 2, y: 1 }, ["t"], { t: { content: "unit.citizen.trooper" } }),
      },
    },
    { registry: FIXTURE_REGISTRY },
  )
  assert.deepEqual(loaded.state.entities[0]?.anchor, { x: 2, y: 1 })
})

test("ordinals follow Grid reading order, not the order the blocks are written in", () => {
  // Ordinal is identity and the kernel's one iteration order, so it must not depend on which player
  // block the author happened to type first. Same two entities, blocks in both orders, same result.
  const north = block({ x: 0, y: 0 }, ["t"], { t: { content: "unit.citizen.trooper" } })
  const south = block({ x: 3, y: 2 }, ["t"], { t: { content: "unit.citizen.trooper" } })

  const idsFor = (placements: ScenarioDefinition["placements"]): string[] =>
    loadScenario({ ...baseScenario(), placements }, { registry: FIXTURE_REGISTRY }).state.entities.map(
      (entity) => entity.id,
    )

  assert.deepEqual(idsFor({ A: north, B: south }), ["A:trooper#1", "B:trooper#2"])
  // B's block listed first, but B is still the southern one, so it is still second.
  assert.deepEqual(idsFor({ B: south, A: north }), ["A:trooper#1", "B:trooper#2"])
})

test("a placement may start damaged, and defaults to the definition's full health", () => {
  // The reason the legend is an object rather than a bare content id: a scenario that opens
  // mid-match needs some units already hurt, without spending ticks damaging them first.
  const loaded = loadScenario(
    {
      ...baseScenario(),
      placements: {
        A: block({ x: 0, y: 0 }, ["ht"], {
          h: { content: "unit.citizen.trooper", hp: 11 },
          t: { content: "unit.citizen.trooper" },
        }),
      },
    },
    { registry: FIXTURE_REGISTRY },
  )
  const [hurt, whole] = loaded.state.entities
  assert.ok(hurt !== undefined && whole !== undefined)
  assert.equal(hurt.hp, 11, "the damaged symbol did not carry its health")
  assert.equal(whole.hp, FIXTURE_REGISTRY.get(whole.contentId).maxHp)
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
      {
        placements: {
          A: block({ x: 0, y: 0 }, ["z"], { t: { content: "unit.citizen.trooper" } }),
        },
      },
      /placements for player A, row 1, column 1 \(x=0,y=0\).*legend does not define/s,
    ],
    [
      "unknown content id",
      {
        placements: {
          A: block({ x: 0, y: 0 }, ["t"], { t: { content: "unit.citizen.nonesuch" } }),
        },
      },
      /unknown content id "unit.citizen.nonesuch"/,
    ],
    [
      "footprint off the Grid, east edge",
      {
        placements: {
          // A 3x1 hauler centred on the last column reaches one tile past the east edge.
          A: block({ x: 3, y: 0 }, ["h"], { h: { content: "unit.citizen.hauler" } }),
        },
      },
      /reaches \(4,0\), which is outside the 4x3 Grid/,
    ],
    [
      "footprint off the Grid, west edge via a negative anchor",
      {
        placements: {
          // Centre-anchoring (footprintCentre, grid/coords.ts) is what can push an anchor negative
          // in the first place - a symbol written right at a block's own (0,0) is exactly where a
          // multi-tile unit's *anchor* lands one or more tiles west of it. A 3x1 hauler's centre
          // offset is (1,0), so a symbol at x=0 anchors at x=-1: untested before, since the only
          // covering case exercised the east edge, and the two branches of the same `||` check are
          // otherwise easy to leave one of them silently unreachable.
          A: block({ x: 0, y: 0 }, ["h"], { h: { content: "unit.citizen.hauler" } }),
        },
      },
      /reaches \(-1,0\), which is outside the 4x3 Grid/,
    ],
    [
      "overlapping footprint",
      {
        placements: {
          // The hauler is 3x1 centred on (1,0), so it covers (0,0)..(2,0) — and the trooper's own
          // tile is the last of them.
          A: block({ x: 1, y: 0 }, ["ht"], {
            h: { content: "unit.citizen.hauler" },
            t: { content: "unit.citizen.trooper" },
          }),
        },
      },
      /overlaps A:hauler#1 at \(2,0\) on the units layer/,
    ],
    [
      "two players on one tile",
      {
        placements: {
          // Legal on its own terms — different layers — but never across players.
          A: block({ x: 1, y: 1 }, ["t"], { t: { content: "unit.citizen.trooper" } }),
          B: block({ x: 1, y: 1 }, ["w"], { w: { content: "unit.citizen.worker" } }),
        },
      },
      /player A's A:trooper#1 already holds.*may not start on the same tile/s,
    ],
    [
      "starting health outside the definition's range",
      {
        placements: {
          A: block({ x: 0, y: 0 }, ["t"], { t: { content: "unit.citizen.trooper", hp: 99 } }),
        },
      },
      /starts "unit\.citizen\.trooper" at 99 health, outside 1\.\.40/,
    ],
    ["a Grid with nobody on it", { placements: {} }, /places no entities/],
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
    `only ${files.length} scenarios exist; the first milestone asks for ten plus the mirror`,
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
  // exactly the kind of retune the first milestone says fixture content is for.
  const resolved = await resolveScenario("ranged-kill.map.json")
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
  // The first milestone predicted the trooper "eats three shots, arriving at 22 of 40 health, then kills
  // the marksman" - still exact after the 2026-08-22 speed pass (owner playtest: "units still move
  // too slow"), because the faster trooper closes the marksman's cooldown-24 firing window in fewer
  // ticks: the marksman gets zero more shots in after the trooper arrives, not one, so the trooper
  // finishes the fight at its arrival health, 22 of 40, rather than 16.
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
  assert.equal(hits.length, 3, "the marksman should get no shots in after the trooper arrives")
  assert.equal(trooper.hp, 22, "the measured finishing health changed")
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

test("nexus-stands: a side whose Grid Nexus stands is never wiped out; its Pulse goes on until the Nexus falls", async () => {
  // Mario, 2026-10-01: "the player should only lose when the nexus is destroyed".
  const resolved = await resolveScenario("nexus-stands.map.json")
  const fell = resolved.run.events.find((event) => event.kind === "entity.died" && event.player === "A")
  assert.ok(fell !== undefined, "the trooper never fell")
  const outcome = resolved.run.finalState.outcome
  assert.equal(outcome?.reason, "nexus-destroyed")
  assert.equal(outcome?.winner, "B")
  assert.ok(fell.tick < (outcome?.tick ?? 0), "the Pulse ended when the trooper fell, with the Nexus standing")
})

test("annihilation-victory: the Pulse ends only once every mobile entity is dead", async () => {
  const resolved = await resolveScenario("annihilation-victory.map.json")
  assert.equal(resolved.run.finalState.outcome?.reason, "annihilation")
  const dead = resolved.run.events.filter((event) => event.kind === "entity.died")
  assert.equal(dead.filter((event) => event.player === "B").length, 2)
  // The worker was one of the two: workers count.
  assert.ok(dead.some((event) => event.contentId === "unit.citizen.worker"))
})

test("tick-limit-draw: neither side can reach the other, and the Pulse ends on its count", async () => {
  const resolved = await resolveScenario("tick-limit-draw.map.json")
  assert.equal(resolved.run.finalState.outcome?.reason, "tick-limit")
  assert.equal(resolved.run.finalState.outcome?.winner, null)
  assert.equal(resolved.run.finalState.tick, resolved.run.pulseTicks)
  assert.equal(resolved.run.events.filter((event) => event.kind === "attack.launched").length, 0)
})

test("target-head-engage-stand: a side with a target heads for it, fights what comes within reach on the way, and stands there", async () => {
  const resolved = await resolveScenario("target-head-engage-stand.map.json")
  const { run } = resolved
  const area = run.initialState.targets?.A
  assert.deepEqual(area, { x: 15, y: 2, width: 3, height: 3 })
  assert.equal(run.initialState.targets?.B, undefined)
  // On the way: the runner comes within reach and the squad turns on it — never from further than that.
  const turned = run.events.filter((event) => event.kind === "target.selected" && event.entity.startsWith("A:"))
  assert.ok(turned.length >= 3, "the squad never turned on the runner")
  for (const event of turned) {
    if (event.kind !== "target.selected") continue
    assert.equal(event.target, "B:runner#1", `${event.entity} went for ${event.target}`)
    assert.ok(event.distance <= ENGAGE_RANGE, `${event.entity} turned on it from ${event.distance} tiles`)
  }
  const runnerDied = run.events.find((event) => event.kind === "entity.died" && event.entity === "B:runner#1")
  assert.ok(runnerDied !== undefined, "the runner lived")
  // The Nexus in the far corner is never within reach of the target or the way there: nobody goes for it.
  assert.ok(!run.events.some((event) => event.kind === "attack.launched" && event.target === "B:nexus#6"), "the squad went for the raid's Nexus")
  // And there: every one of them inside the target or beside one who is, none of them moving for the last two
  // seconds, none of them pressing on another.
  const squad = run.finalState.entities.filter((entity) => entity.player === "A")
  assert.equal(squad.length, 4)
  const inside = (entity: (typeof squad)[number]): boolean =>
    entity.anchor.x >= 15 && entity.anchor.x <= 17 && entity.anchor.y >= 2 && entity.anchor.y <= 4
  const gathered = new Set(squad.filter(inside).map((entity) => entity.ordinal))
  assert.ok(gathered.size >= 3, `only ${gathered.size} of the squad stand inside the target`)
  for (let grew = true; grew; ) {
    grew = false
    for (const entity of squad) {
      if (gathered.has(entity.ordinal)) continue
      if (squad.some((other) => gathered.has(other.ordinal) && Math.abs(other.anchor.x - entity.anchor.x) + Math.abs(other.anchor.y - entity.anchor.y) === 1)) {
        gathered.add(entity.ordinal)
        grew = true
      }
    }
  }
  assert.equal(gathered.size, squad.length, "some of the squad stand away from the target")
  const late = run.pulseTicks - 2 * TICKS_PER_SECOND
  assert.ok(!run.events.some((event) => (event.kind === "entity.moved" || event.kind === "move.blocked") && event.tick > late && event.entity.startsWith("A:")), "the squad was still moving at the end")
  assert.deepEqual([run.finalState.outcome?.winner, run.finalState.outcome?.reason], [null, "tick-limit"])

  // A side with no target keeps the one rule every unit had: the same squad, the runner dead, marches on the Nexus.
  const scenario = await loadScenarioFile("target-head-engage-stand.map.json")
  const { targets: _targets, ...untargeted } = scenario
  const loaded = loadScenario(untargeted, { registry: FIXTURE_REGISTRY })
  assert.equal(loaded.state.targets, undefined)
  const old = resolvePulse({ initialState: loaded.state, registry: loaded.registry, pulseTicks: scenario.pulseTicks, seed: scenario.seed })
  assert.ok(old.events.some((event) => event.kind === "attack.launched" && event.target === "B:nexus#6"), "with no target, nobody went for the Nexus")
})

test("aura-by-the-book: the units near Vasse take three quarters of every hit, she does too, and the one beyond her reach takes it all", async () => {
  const resolved = await resolveScenario("aura-by-the-book.map.json")
  const { run } = resolved
  const vasse = run.initialState.entities.find((entity) => entity.contentId === "unit.citizen.vasse")
  assert.ok(vasse !== undefined)
  const hits = (entity: string) =>
    run.events.filter((event): event is Extract<DomainEvent, { kind: "damage.applied" }> => event.kind === "damage.applied" && event.entity === entity)
  // Beside her: every hit guarded, by her, a raider's eleven down to eight and its blast's ten to seven.
  const near = hits("A:trooper#2")
  assert.ok(near.length > 0)
  for (const hit of near) assert.equal(hit.guardedBy, vasse.id, `a hit on the trooper beside her at tick ${hit.tick} was not guarded`)
  assert.ok(near.some((hit) => hit.amount === 8 && hit.hpBefore >= 8), "no raider's hit came to eight")
  assert.ok(near.some((hit) => hit.amount === 7 && hit.source === "B:raider#3" && hit.tick === run.events.find((event) => event.kind === "entity.detonated" && event.entity === "B:raider#3")?.tick), "the blast was not guarded")
  // Five tiles from her: never guarded, the whole eleven.
  const far = hits("A:trooper#4")
  assert.ok(far.length > 0)
  for (const hit of far) assert.equal(hit.guardedBy, undefined, `the trooper beyond her reach was guarded at tick ${hit.tick}`)
  assert.ok(far.some((hit) => hit.amount === 11))
  // Her own: guarded by her too.
  const own = hits(vasse.id)
  assert.ok(own.length > 0 && own.every((hit) => hit.guardedBy === vasse.id), "she was not guarded herself")
  // The raid's are never guarded: an aura guards its own side.
  assert.ok(run.events.every((event) => event.kind !== "damage.applied" || !event.entity.startsWith("B:") || event.guardedBy === undefined))
  // The one beyond her reach falls first.
  const fell = (entity: string): number => run.events.find((event) => event.kind === "entity.died" && event.entity === entity)?.tick ?? Number.POSITIVE_INFINITY
  assert.ok(fell("A:trooper#4") < fell("A:trooper#2"), "the guarded trooper fell first")
})
