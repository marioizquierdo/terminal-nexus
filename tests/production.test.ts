// Automatic production, at step 6C's size: a building with a recipe trains its unit on an interval
// during a Pulse (pulse.md, "Automatic production"). The kernel's half — the timer, the cap, where a
// trained unit stands, and that nothing without a recipe changes by a byte — and the match's half: a
// Barracks the player placed trains, trained survivors come home to it, and the timers start each
// Pulse at a full interval. PERIMETER's Barracks, round by round, on the screen, is
// tests/mission-loop.test.ts.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_STANDING, starterGrid } from "../src/build/catalog.ts"
import { FIXTURE_REGISTRY, withProduction } from "../src/content/index.ts"
import type { ProductionRecipe } from "../src/content/index.ts"
import { footprintDistance } from "../src/grid/coords.ts"
import { openingState, recall, resolveMissionPulse, trainingRegistry } from "../src/match/index.ts"
import type { MissionPulse } from "../src/match/index.ts"
import { PERIMETER } from "../src/armies/index.ts"
import { MissionError, validateMission } from "../src/mission/index.ts"
import { resolvePulse } from "../src/pulse/index.ts"
import { hashState, serializeState } from "../src/state/serialize.ts"
import type { MatchState } from "../src/state/types.ts"

const BARRACKS = "structure.citizen.barracks"
const TROOPER = "unit.citizen.trooper"
const grid = starterGrid()
const recipe = (overrides: Partial<ProductionRecipe> = {}): ProductionRecipe => ({
  output: TROOPER,
  quantity: 1,
  intervalTicks: 12,
  perPulse: 3,
  ...overrides,
})

/** A Barracks alone on the starter map, trained at `given`'s pace, for `ticks` ticks. */
function lone(given: ProductionRecipe, ticks = 60) {
  const registry = withProduction(FIXTURE_REGISTRY, { [BARRACKS]: given })
  const initialState = openingState({
    grid,
    registry,
    structures: [{ contentId: BARRACKS, anchor: { x: 25, y: 10 } }],
    setup: { seed: 1, pulseTicks: ticks, forces: [] },
  })
  return { registry, run: resolvePulse({ initialState, registry, pulseTicks: ticks, seed: 1 }) }
}

const trainedEvents = (events: MissionPulse["events"]) =>
  events.filter((event) => event.kind === "entity.spawned" && event.trainedBy !== undefined)

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
  assert.throws(() => withProduction(FIXTURE_REGISTRY, { [BARRACKS]: recipe({ intervalTicks: 0 }) }), /intervalTicks must be a positive integer/)
  assert.throws(() => withProduction(FIXTURE_REGISTRY, { [BARRACKS]: recipe({ perPulse: 1.5 }) }), /perPulse must be a positive integer/)
})

// --- The kernel's production phase -----------------------------------------------------------------

test("a Barracks trains one trooper every interval, the first one interval in, until its cap for the Pulse", () => {
  const { run, registry } = lone(recipe())
  const trained = trainedEvents(run.events)
  assert.deepEqual(trained.map((event) => event.tick), [12, 24, 36], "trained at the wrong ticks, or past its cap")
  const barracks = run.finalState.entities.find((entity) => entity.contentId === BARRACKS)
  assert.ok(barracks !== undefined)
  for (const event of trained) {
    assert.ok(event.kind === "entity.spawned")
    assert.equal(event.trainedBy, barracks.id)
    assert.equal(event.player, "A")
    assert.equal(event.contentId, TROOPER)
  }
  assert.equal(barracks.produced, 3)
  // Set down in the ring of tiles touching it (a corner of that ring is two steps away, not one).
  const first = trained[0]
  assert.ok(first?.kind === "entity.spawned")
  const definition = registry.get(BARRACKS)
  assert.ok(footprintDistance(first.at, registry.get(TROOPER).footprint, barracks.anchor, definition.footprint) <= 2)
  assert.equal(run.finalState.entities.filter((entity) => entity.contentId === TROOPER).length, 3)
})

test("quantity is how many each time; the cap counts trainings, not troopers", () => {
  const { run } = lone(recipe({ quantity: 2, perPulse: 2 }))
  assert.deepEqual(trainedEvents(run.events).map((event) => event.tick), [12, 12, 24, 24])
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
  assert.doesNotMatch(serializeState(run.finalState), /productionCooldown|produced/)
  assert.equal(trainedEvents(run.events).length, 0)
})

test("the same Barracks, the same seed, the same ticks: the same hash, every run", () => {
  const hashes = new Set<string>()
  for (let run = 0; run < 5; run += 1) hashes.add(lone(recipe()).run.stateHash)
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

// Moved on purpose with the Commander step: Vasse arrives with the squads, so round 1 has one more unit in it.
const PINNED_ROUND_1 = "1e8083058cc036d0a98b3fa52c2d5d9a0b28493786d001fc6cf302fd4a2f8ebd"
