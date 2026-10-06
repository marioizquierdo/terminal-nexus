// Automatic production: a building with a recipe spawns its unit in waves during a Pulse (pulse.md,
// "Automatic production") — every unit of a wave on the same tick, side by side round the building, the first
// wave a fixed delay into the Pulse and the rest a fixed gap apart. The kernel's half — the schedule, the cap,
// where a wave stands, that a crowded building never spawns fewer, and that nothing without a recipe changes by
// a byte — and the match's half: a Barracks the player placed spawns, its survivors come home to it, and the
// counters start each Pulse afresh. PERIMETER's Barracks, round by round, on the screen, is
// tests/mission-loop.test.ts.

import { test } from "node:test"
import assert from "node:assert/strict"
import { defaultValue } from "../src/build/all-settings.ts"
import { STARTER_STANDING, starterGrid } from "../src/build/catalog.ts"
import { FIXTURE_REGISTRY, withProduction } from "../src/content/index.ts"
import type { ProductionRecipe } from "../src/content/index.ts"
import { footprintRing } from "../src/grid/coords.ts"
import { openingState, recall, resolveMissionPulse, spawnRecipe, spawningRegistry } from "../src/match/index.ts"
import type { Force, MissionPulse } from "../src/match/index.ts"
import { PERIMETER, PERIMETER_LEVEL } from "../src/armies/index.ts"
import type { BuildingSpawns } from "../src/armies/index.ts"
import { resolvePulse } from "../src/pulse/index.ts"
import { TICKS_PER_SECOND } from "../src/scenario/load.ts"
import { hashState, serializeState } from "../src/state/serialize.ts"
import type { MatchState } from "../src/state/types.ts"

const BARRACKS = "structure.citizen.barracks"
const HATCHERY = "structure.bench.hatchery"
const TROOPER = "unit.citizen.trooper"
const SWARMER = "unit.bench.spawnling"
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

// --- In a campaign ---------------------------------------------------------------------------------

/** What each building PERIMETER offers spawns, by its structure: its army's own words for it. */
const SPAWNS: Readonly<Record<string, BuildingSpawns>> = Object.fromEntries(
  PERIMETER_LEVEL.offer.buildings.flatMap((card) => (card.spawns === undefined ? [] : [[card.structure, card.spawns] as const])),
)
/** Every building's first wave, in ticks: the owner's five seconds, as the tuned setting has it. */
const FIRST_WAVE = defaultValue("firstWave") * TICKS_PER_SECOND
const campaignRegistry = spawningRegistry(FIXTURE_REGISTRY, SPAWNS, FIRST_WAVE)

function round(
  pulse: number,
  carried: MatchState | null,
  plan: readonly { contentId: string; anchor: { x: number; y: number } }[] = [],
  registry = campaignRegistry,
): MissionPulse {
  const structures = [...(pulse === 1 ? STARTER_STANDING : []), ...plan]
  return resolveMissionPulse({ mission: PERIMETER, grid, registry, pulse, carried, structures })
}

test("the Barracks and the Hatchery say what they spawn on their own cards, and the campaign's battles run on it", () => {
  // The owner's numbers: four troopers in one wave a round; the Hatchery's brood, three, by the same rule.
  assert.deepEqual(SPAWNS, {
    [BARRACKS]: { unit: TROOPER, perWave: 4, waves: 1, secondsBetween: 10 },
    [HATCHERY]: { unit: SWARMER, perWave: 3, waves: 1, secondsBetween: 10 },
  })
  assert.equal(FIRST_WAVE, 60)
  // The mission names nothing that spawns: that is the buildings' own.
  assert.ok(!("trains" in PERIMETER), "PERIMETER still lists what trains")
  assert.deepEqual(campaignRegistry.get(BARRACKS).production, { output: TROOPER, perWave: 4, waves: 1, firstTicks: 60, intervalTicks: 120 })
  assert.deepEqual(campaignRegistry.get(HATCHERY).production, spawnRecipe({ unit: SWARMER, perWave: 3, waves: 1, secondsBetween: 10 }, 60))
  assert.equal(campaignRegistry.get(HATCHERY).spawn, undefined, "the campaign's Hatchery still breeds by its own timer")
  assert.equal(campaignRegistry.get("structure.bench.beamturret").production, undefined)
  // Nothing spawns, nothing changes.
  assert.equal(spawningRegistry(FIXTURE_REGISTRY, {}, FIRST_WAVE), FIXTURE_REGISTRY)
})

test("PERIMETER's round 1: the Barracks on the map sends its four troopers together, five seconds in, beside it", () => {
  const run = round(1, null)
  const opening = run.states[0]?.entities.find((entity) => entity.contentId === BARRACKS)
  assert.ok(opening !== undefined)
  assert.deepEqual([opening.productionCooldown, opening.produced, opening.owed], [FIRST_WAVE, 0, 0])
  const trained = trainedEvents(run.events)
  assert.deepEqual(trained.map((event) => event.tick), [60, 60, 60, 60])
  // In the ring's own order, a row of four along its north side, facing the raid's way in.
  const ring = footprintRing(3, 2, 1).map((offset) => ({ x: opening.anchor.x + offset.x, y: opening.anchor.y + offset.y }))
  assert.deepEqual(trained.map((event) => (event.kind === "entity.spawned" ? event.at : null)), ring.slice(0, 4))
})

test("a building the player placed spawns too, its wave on the same tick as the map's; a Hatchery's brood the same way", () => {
  const placed = [
    { contentId: BARRACKS, anchor: { x: 17, y: 13 } },
    { contentId: HATCHERY, anchor: { x: 24, y: 13 } },
  ]
  const run = round(1, null, placed)
  const opening = run.states[0]?.entities ?? []
  const own = (contentId: string, anchor: { x: number; y: number }) =>
    opening.find((entity) => entity.contentId === contentId && entity.anchor.x === anchor.x && entity.anchor.y === anchor.y)
  const barracks = own(BARRACKS, { x: 17, y: 13 })
  const hatchery = own(HATCHERY, { x: 24, y: 13 })
  assert.ok(barracks !== undefined && hatchery !== undefined)
  const from = (id: string) => trainedEvents(run.events).filter((event) => event.kind === "entity.spawned" && event.trainedBy === id)
  assert.deepEqual(from(barracks.id).map((event) => event.tick), [60, 60, 60, 60], "the planned Barracks did not send its wave")
  assert.deepEqual(from(hatchery.id).map((event) => (event.kind === "entity.spawned" ? [event.tick, event.contentId] : [])), [
    [60, SWARMER],
    [60, SWARMER],
    [60, SWARMER],
  ])
  // Its brood is all it makes: no swarmer is bred any other way.
  const swarmers = run.events.filter((event) => event.kind === "entity.spawned" && event.contentId === SWARMER)
  assert.equal(swarmers.length, 3)
})

test("a wave's survivors come home to their building; Recall and the next opening start its counters afresh, on the recipe that round runs", () => {
  const first = round(1, null)
  const trained = trainedEvents(first.events)
  assert.equal(trained.length, 4, "round 1 did not train its wave")
  const back = recall(first.final, campaignRegistry)
  const barracks = back.state.entities.find((entity) => entity.contentId === BARRACKS)
  assert.ok(barracks !== undefined)
  assert.deepEqual([barracks.productionCooldown, barracks.produced, barracks.owed], [FIRST_WAVE, 0, 0])
  const ordinals = new Set(trained.map((event) => (event.kind === "entity.spawned" ? event.ordinal : -1)))
  const home = back.moves.filter((move) => ordinals.has(move.ordinal))
  assert.ok(home.length > 0, "no trooper of the wave survived round 1 to come home")
  for (const move of home) assert.equal(move.home, "producer", `trooper #${move.ordinal + 1} did not go home to a Barracks`)

  // A building given a second wave between rounds (what a Nexus power may one day do) raises `waves` and
  // nothing else: the carried Barracks sends both from the next round, ten seconds apart.
  const twice = spawningRegistry(FIXTURE_REGISTRY, { ...SPAWNS, [BARRACKS]: { ...(SPAWNS[BARRACKS] as BuildingSpawns), waves: 2 } }, FIRST_WAVE)
  const second = round(2, back.state, [], twice)
  const opened = second.states[0]?.entities.find((entity) => entity.contentId === BARRACKS)
  assert.deepEqual([opened?.productionCooldown, opened?.produced, opened?.owed], [FIRST_WAVE, 0, 0])
  assert.ok(second.final.tick >= 180, `round 2 ended at tick ${second.final.tick}, before a second wave could come`)
  assert.deepEqual(ticksOf(second.events), [60, 60, 60, 60, 180, 180, 180, 180])
})

test("PERIMETER's first round with the Barracks's wave hashes the same on every run and on both runtimes", () => {
  const run = round(1, null)
  // Pinned: Node and Bun run this same line, so a runtime that resolves the round differently fails here.
  assert.equal(hashState(run.final), PINNED_ROUND_1)
  assert.equal(hashState(round(1, null).final), PINNED_ROUND_1)
})

// PERIMETER's round 1 as the rules play it: Vasse arriving with the squads, who hold the line ahead of the base, By
// the Book guarding those beside her, the Barracks's four troopers together five seconds in, and a row counting
// two columns in every distance and step.
const PINNED_ROUND_1 = "52fe1365f4e047e51e989357fbda44dd5b404bde7089b5e0a8376bdf79775ab0"
