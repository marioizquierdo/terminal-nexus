// Automatic production: a building with a recipe spawns its unit in waves during a Pulse (pulse.md,
// "Automatic production") — every unit of a wave on the same tick, side by side round the building, the first
// wave a fixed delay into the Pulse and the rest a fixed gap apart. The kernel's half — the schedule, the cap,
// where a wave stands, that a crowded building never spawns fewer, and that nothing without a recipe changes by
// a byte — and the match's half: a Barracks the player placed spawns, its survivors come home to it, and the
// counters start each Pulse afresh. PERIMETER's Barracks, round by round, on the screen, is
// tests/mission-loop.test.ts.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_STANDING, starterGrid } from "../src/build/catalog.ts"
import { FIXTURE_REGISTRY, withProduction } from "../src/content/index.ts"
import type { ProductionRecipe } from "../src/content/index.ts"
import { footprintRing } from "../src/grid/coords.ts"
import { openingState, recall, resolveMissionPulse, trainingRegistry } from "../src/match/index.ts"
import type { Force, MissionPulse } from "../src/match/index.ts"
import { PERIMETER } from "../src/armies/index.ts"
import { MissionError, validateMission } from "../src/mission/index.ts"
import { resolvePulse } from "../src/pulse/index.ts"
import { hashState, serializeState } from "../src/state/serialize.ts"
import type { MatchState } from "../src/state/types.ts"

const BARRACKS = "structure.citizen.barracks"
const HATCHERY = "structure.bench.hatchery"
const TROOPER = "unit.citizen.trooper"
const grid = starterGrid()
const recipe = (overrides: Partial<ProductionRecipe> = {}): ProductionRecipe => ({
  output: TROOPER,
  perWave: 4,
  waves: 1,
  firstTicks: 60,
  intervalTicks: 120,
  ...overrides,
})

/** A Barracks alone at `anchor` on the starter map (where the map's own stands, unless told), spawning by
 *  `given`, for `ticks` ticks — with `forces` on the map besides it, when given. */
function lone(given: ProductionRecipe, ticks = 90, anchor = { x: 25, y: 10 }, forces: readonly Force[] = []) {
  const registry = withProduction(FIXTURE_REGISTRY, { [BARRACKS]: given })
  const initialState = openingState({
    grid,
    registry,
    structures: [{ contentId: BARRACKS, anchor }],
    setup: { seed: 1, pulseTicks: ticks, forces },
  })
  return { registry, run: resolvePulse({ initialState, registry, pulseTicks: ticks, seed: 1 }) }
}

const trainedEvents = (events: MissionPulse["events"]) =>
  events.filter((event) => event.kind === "entity.spawned" && event.trainedBy !== undefined)

const ticksOf = (events: MissionPulse["events"]): number[] => trainedEvents(events).map((event) => event.tick)

// --- The recipe on content ------------------------------------------------------------------------

test("no content trains by default: a recipe is given to a building by name, and refused when it makes no sense", () => {
  for (const id of FIXTURE_REGISTRY.ids()) assert.equal(FIXTURE_REGISTRY.get(id).production, undefined, id)
  const trained = withProduction(FIXTURE_REGISTRY, { [BARRACKS]: recipe() })
  assert.deepEqual(trained.get(BARRACKS).production, recipe())
  assert.equal(FIXTURE_REGISTRY.get(BARRACKS).production, undefined, "the shared content was changed")
  assert.deepEqual(trained.ids(), FIXTURE_REGISTRY.ids())
  assert.throws(() => withProduction(FIXTURE_REGISTRY, { "structure.nope": recipe() }), /unknown building/)
  assert.throws(() => withProduction(FIXTURE_REGISTRY, { [TROOPER]: recipe() }), /not a building/)
  assert.throws(() => withProduction(FIXTURE_REGISTRY, { [BARRACKS]: recipe({ output: "unit.nope" }) }), /unknown "unit\.nope"/)
  assert.throws(() => withProduction(FIXTURE_REGISTRY, { [BARRACKS]: recipe({ output: BARRACKS }) }), /a building/)
  // Every number by its name: a wave of nothing, a wave and a half, a first wave before the Pulse, no gap.
  assert.throws(() => withProduction(FIXTURE_REGISTRY, { [BARRACKS]: recipe({ perWave: 0 }) }), /perWave must be a positive integer, received 0/)
  assert.throws(() => withProduction(FIXTURE_REGISTRY, { [BARRACKS]: recipe({ waves: 1.5 }) }), /waves must be a positive integer, received 1\.5/)
  assert.throws(() => withProduction(FIXTURE_REGISTRY, { [BARRACKS]: recipe({ firstTicks: 0 }) }), /firstTicks must be a positive integer/)
  assert.throws(() => withProduction(FIXTURE_REGISTRY, { [BARRACKS]: recipe({ intervalTicks: -12 }) }), /intervalTicks must be a positive integer/)
})

test("a building makes its units one way in a battle: given a recipe, the Hatchery breeds by it alone, and keeps its own spawner everywhere else", () => {
  const ownSpawner = FIXTURE_REGISTRY.get(HATCHERY).spawn
  assert.ok(ownSpawner !== undefined, "the bench Hatchery no longer has a spawner of its own")
  const brood = recipe({ output: ownSpawner.contentId, perWave: 3 })
  const opted = withProduction(FIXTURE_REGISTRY, { [HATCHERY]: brood })
  assert.equal(opted.get(HATCHERY).spawn, undefined, "an opted-in Hatchery still breeds by its own timer too")
  assert.deepEqual(opted.get(HATCHERY).production, brood)
  // The shared content keeps it, so a grid scenario with a Hatchery (hatchery-spawn) breeds as it always did.
  assert.deepEqual(FIXTURE_REGISTRY.get(HATCHERY).spawn, ownSpawner)

  // On the Grid: its whole brood on the wave's tick, and nothing from the old timer before or after it.
  const initialState = openingState({
    grid,
    registry: opted,
    structures: [{ contentId: HATCHERY, anchor: { x: 21, y: 13 } }],
    setup: { seed: 1, pulseTicks: 180, forces: [] },
  })
  const run = resolvePulse({ initialState, registry: opted, pulseTicks: 180, seed: 1 })
  const born = run.events.filter((event) => event.kind === "entity.spawned" && event.tick > 0)
  assert.deepEqual(born.map((event) => event.tick), [60, 60, 60])
  assert.ok(born.every((event) => event.kind === "entity.spawned" && event.trainedBy !== undefined), "a swarmer was bred by the old timer")
})

// --- The kernel's production phase -----------------------------------------------------------------

test("a wave comes whole on its tick: every unit of it at once, side by side in the ring round the building", () => {
  const { run } = lone(recipe())
  const trained = trainedEvents(run.events)
  assert.deepEqual(trained.map((event) => event.tick), [60, 60, 60, 60], "the wave came at the wrong tick, or not all at once")
  const barracks = run.finalState.entities.find((entity) => entity.contentId === BARRACKS)
  assert.ok(barracks !== undefined)
  for (const event of trained) {
    assert.ok(event.kind === "entity.spawned")
    assert.equal(event.trainedBy, barracks.id)
    assert.equal(event.player, "A")
    assert.equal(event.contentId, TROOPER)
  }
  // The first four tiles of the ring, in its fixed order: a row of four along the Barracks's north side.
  const ring = footprintRing(3, 2, 1).map((offset) => ({ x: barracks.anchor.x + offset.x, y: barracks.anchor.y + offset.y }))
  assert.deepEqual(trained.map((event) => (event.kind === "entity.spawned" ? event.at : null)), ring.slice(0, 4))
  assert.ok(ring.slice(0, 4).every((tile) => tile.y === barracks.anchor.y - 1))
  assert.deepEqual([barracks.produced, barracks.owed], [1, 0])
  assert.equal(run.finalState.entities.filter((entity) => entity.contentId === TROOPER).length, 4)
})

test("waves after the first follow at the building's own gap, up to its waves a Pulse", () => {
  const { run } = lone(recipe({ perWave: 2, waves: 3, firstTicks: 12, intervalTicks: 24 }), 120)
  assert.deepEqual(ticksOf(run.events), [12, 12, 36, 36, 60, 60], "the waves came at the wrong ticks, or past their number")
  const barracks = run.finalState.entities.find((entity) => entity.contentId === BARRACKS)
  assert.deepEqual([barracks?.produced, barracks?.owed], [3, 0])
})

test("a crowded building never spawns fewer: what fits comes out on the wave's tick, the rest on the first tick there is room", () => {
  // In the corner of the north-west wall, where rock takes most of the ring: six tiles touch the Barracks.
  const corner = { x: 9, y: 6 }
  const raider: Force = { player: "B", muster: { x: 30, y: 9 }, units: ["unit.ravel.raider"] }
  const { run } = lone(recipe({ perWave: 8 }), 90, corner, [raider])
  const ticks = ticksOf(run.events)
  assert.equal(ticks.filter((tick) => tick === 60).length, 6, `the wave did not fill the room it had: ${JSON.stringify(ticks)}`)
  // The two it still owed come out once the first have stepped toward the raider — never dropped.
  const late = ticks.filter((tick) => tick > 60)
  assert.equal(late.length, 2, `the wave lost units it owed: ${JSON.stringify(ticks)}`)
  assert.ok(late.every((tick) => tick <= 72), `the owed units waited too long: ${JSON.stringify(late)}`)
  const barracks = run.finalState.entities.find((entity) => entity.contentId === BARRACKS)
  assert.deepEqual([barracks?.produced, barracks?.owed], [1, 0])

  // Walled in by its own side, a trooper on each of those six tiles, it owes every wave and spawns nothing; the
  // schedule does not wait for it, so both waves have come and both are owed.
  const free = footprintRing(3, 2, 1)
    .map((offset) => ({ x: corner.x + offset.x, y: corner.y + offset.y }))
    .filter((tile) => grid.tiles[tile.y * grid.width + tile.x] !== "terrain.rock")
  assert.equal(free.length, 6)
  const crowd: Force[] = free.map((tile) => ({ player: "A", muster: tile, units: [TROOPER] }))
  const boxed = lone(recipe({ perWave: 2, waves: 2, firstTicks: 12, intervalTicks: 24 }), 60, corner, crowd)
  const walledIn = boxed.run.finalState.entities.find((entity) => entity.contentId === BARRACKS)
  assert.equal(ticksOf(boxed.run.events).length, 0)
  assert.deepEqual([walledIn?.produced, walledIn?.owed], [2, 4])
})

test("a building without a recipe carries no production fields, so a state without a producer is byte for byte what it was", () => {
  const registry = FIXTURE_REGISTRY
  const initialState = openingState({
    grid,
    registry,
    structures: [{ contentId: BARRACKS, anchor: { x: 25, y: 10 } }],
    setup: { seed: 1, pulseTicks: 30, forces: [] },
  })
  const run = resolvePulse({ initialState, registry, pulseTicks: 30, seed: 1 })
  assert.doesNotMatch(serializeState(run.finalState), /productionCooldown|produced|owed/)
  assert.equal(trainedEvents(run.events).length, 0)
})

test("the same Barracks, the same seed, the same ticks: the same hash, every run", () => {
  const hashes = new Set<string>()
  for (let run = 0; run < 5; run += 1) hashes.add(lone(recipe({ waves: 2 }), 200).run.stateHash)
  assert.equal(hashes.size, 1)
})

// --- In a mission ----------------------------------------------------------------------------------

const PACE = { intervalTicks: 120, perPulse: 3 }
const trainedRegistry = trainingRegistry(PERIMETER, FIXTURE_REGISTRY, PACE)

function round(pulse: number, carried: MatchState | null, plan: readonly { contentId: string; anchor: { x: number; y: number } }[] = []): MissionPulse {
  const structures = [...(pulse === 1 ? STARTER_STANDING : []), ...plan]
  return resolveMissionPulse({ mission: PERIMETER, grid, registry: trainedRegistry, pulse, carried, structures })
}

test("PERIMETER says its Barracks trains troopers, and the mission refuses a list that makes no sense", () => {
  assert.deepEqual(PERIMETER.trains, [{ structure: BARRACKS, unit: TROOPER }])
  assert.equal(trainedRegistry.get(BARRACKS).production?.output, TROOPER)
  assert.equal(trainingRegistry({ ...PERIMETER, trains: [] }, FIXTURE_REGISTRY, PACE), FIXTURE_REGISTRY)
  const problems = (trains: NonNullable<typeof PERIMETER.trains>): readonly string[] => {
    try {
      validateMission({ ...PERIMETER, trains }, grid, FIXTURE_REGISTRY)
      return []
    } catch (error) {
      assert.ok(error instanceof MissionError)
      return error.problems
    }
  }
  assert.deepEqual(problems([{ structure: BARRACKS, unit: TROOPER }]), [])
  assert.ok(problems([{ structure: "structure.nope", unit: TROOPER }]).some((p) => /unknown building "structure\.nope"/.test(p)))
  assert.ok(problems([{ structure: TROOPER, unit: TROOPER }]).some((p) => /which is not a building/.test(p)))
  assert.ok(problems([{ structure: BARRACKS, unit: "unit.nope" }]).some((p) => /unknown unit "unit\.nope"/.test(p)))
  assert.ok(problems([{ structure: BARRACKS, unit: BARRACKS }]).some((p) => /which is a building/.test(p)))
  assert.ok(problems([{ structure: BARRACKS, unit: TROOPER }, { structure: BARRACKS, unit: TROOPER }]).some((p) => /listed to train twice/.test(p)))
})

test("a Barracks the player placed trains too, from its own first interval — not only the map's", () => {
  const placed = { contentId: BARRACKS, anchor: { x: 21, y: 13 } }
  const run = round(1, null, [placed])
  const barracks = run.states[0]?.entities.filter((entity) => entity.contentId === BARRACKS) ?? []
  assert.equal(barracks.length, 2)
  for (const entity of barracks) assert.deepEqual([entity.productionCooldown, entity.produced], [PACE.intervalTicks, 0], entity.id)
  const planned = barracks.find((entity) => entity.anchor.x === placed.anchor.x && entity.anchor.y === placed.anchor.y)
  assert.ok(planned !== undefined)
  const trainers = new Set(trainedEvents(run.events).map((event) => (event.kind === "entity.spawned" ? event.trainedBy : "")))
  assert.ok(trainers.has(planned.id), "the planned Barracks trained nothing")
})

test("trained survivors come home to the Barracks; Recall and the next opening start its timers at a full interval", () => {
  const first = round(1, null)
  const trained = trainedEvents(first.events)
  assert.ok(trained.length > 0, "round 1 trained nothing")
  const back = recall(first.final, trainedRegistry)
  const barracks = back.state.entities.find((entity) => entity.contentId === BARRACKS)
  assert.ok(barracks !== undefined)
  assert.deepEqual([barracks.productionCooldown, barracks.produced], [PACE.intervalTicks, 0])
  const ordinals = new Set(trained.map((event) => (event.kind === "entity.spawned" ? event.ordinal : -1)))
  const home = back.moves.filter((move) => ordinals.has(move.ordinal))
  assert.ok(home.length > 0, "no trained trooper survived round 1 to come home")
  for (const move of home) assert.equal(move.home, "producer", `trooper #${move.ordinal + 1} did not go home to a Barracks`)

  // The pace changed between rounds (an Experiment did): the carried Barracks starts on the new one.
  const faster = trainingRegistry(PERIMETER, FIXTURE_REGISTRY, { intervalTicks: 48, perPulse: 1 })
  const second = resolveMissionPulse({ mission: PERIMETER, grid, registry: faster, pulse: 2, carried: back.state, structures: [] })
  const opened = second.states[0]?.entities.find((entity) => entity.contentId === BARRACKS)
  assert.deepEqual([opened?.productionCooldown, opened?.produced], [48, 0])
  assert.deepEqual(trainedEvents(second.events).map((event) => event.tick), [48])
})

test("PERIMETER's first round with the Barracks training hashes the same on every run and on both runtimes", () => {
  const run = round(1, null)
  // Pinned: Node and Bun run this same line, so a runtime that resolves the round differently fails here.
  assert.equal(hashState(run.final), PINNED_ROUND_1)
  assert.equal(hashState(round(1, null).final), PINNED_ROUND_1)
})

// Moved on purpose with the Commander step: Vasse arrives with the squads, so round 1 has one more unit in it; and
// again when the squads came to hold the line ahead of the base and By the Book to guard those beside her; and when
// a producer came to count the units of its wave it still owes (`owed`), which is the only thing that moved then.
const PINNED_ROUND_1 = "9970e7748d37ca1566eb3acd6108416ffe1a1369b3ee371616d9aed01d2c73d3"
