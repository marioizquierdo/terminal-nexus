// Automatic production: a building with a recipe spawns its unit in waves during a Pulse (pulse.md,
// "Automatic production") — every unit of a wave on the same tick, side by side round the building, the first
// wave a fixed delay into the Pulse and the rest a fixed gap apart. The battle engine's half — the schedule, the cap,
// where a wave stands, that a crowded building never spawns fewer, and that nothing without a recipe changes by
// a byte — and the match's half: a Barracks the player placed spawns, its survivors come home to it, and the
// counters start each Pulse afresh. Played on the starter map (`saves/starter.save.json`), against a raid of runners.

import { test } from "node:test"
import assert from "node:assert/strict"
import { defaultValue } from "../src/build/all-settings.ts"
import { starterTerrain } from "./starter-fixture.ts"
import { FIXTURE_REGISTRY, withProduction } from "../src/content/index.ts"
import { hasRoom, supplyCostOf, supplyOf } from "../src/content/supply.ts"
import type { ProductionRecipe } from "../src/content/index.ts"
import { footprintRing, tilesOf } from "../src/engine/geometry/coords.ts"
import { openingState, regroup, spawnRecipe, spawningRegistry } from "../src/match/index.ts"
import type { Force, StructurePlacement } from "../src/match/index.ts"
import { ARMIES } from "../src/armies/index.ts"
import type { BuildingSpawns } from "../src/armies/index.ts"
import { resolvePulse } from "../src/engine/pulse/index.ts"
import type { PulseRun } from "../src/engine/pulse/index.ts"
import { TICKS_PER_SECOND } from "../src/engine/state/types.ts"
import { hashState, serializeState } from "../src/engine/state/serialize.ts"
import type { MatchState } from "../src/engine/state/types.ts"

const BARRACKS = "structure.citizen.barracks"
const HATCHERY = "structure.bench.hatchery"
const TROOPER = "unit.citizen.trooper"
const SWARMER = "unit.bench.spawnling"
const terrain = starterTerrain()
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
    terrain,
    registry,
    structures: [{ contentId: BARRACKS, anchor }],
    setup: { seed: 1, pulseTicks: ticks, forces },
  })
  return { registry, run: resolvePulse({ initialState, registry, pulseTicks: ticks, seed: 1 }) }
}

const trainedEvents = (events: PulseRun["events"]) =>
  events.filter((event) => event.kind === "entity.spawned" && event.trainedBy !== undefined)

const ticksOf = (events: PulseRun["events"]): number[] => trainedEvents(events).map((event) => event.tick)

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
  // The shared content keeps it, so a sandbox with a Hatchery (hatchery-spawn) breeds as it always did.
  assert.deepEqual(FIXTURE_REGISTRY.get(HATCHERY).spawn, ownSpawner)

  // On the battlefield: its whole brood on the wave's tick, and nothing from the old timer before or after it.
  const initialState = openingState({
    terrain,
    registry: opted,
    structures: [{ contentId: HATCHERY, anchor: { x: 21, y: 13 } }],
    setup: { seed: 1, pulseTicks: 180, forces: [] },
  })
  const run = resolvePulse({ initialState, registry: opted, pulseTicks: 180, seed: 1 })
  const born = run.events.filter((event) => event.kind === "entity.spawned" && event.tick > 0)
  assert.deepEqual(born.map((event) => event.tick), [60, 60, 60])
  assert.ok(born.every((event) => event.kind === "entity.spawned" && event.trainedBy !== undefined), "a swarmer was bred by the old timer")
})

// --- The battle engine's production phase -----------------------------------------------------------------

test("a wave comes whole on its tick: every unit of it at once, side by side on the building's roof", () => {
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
  // On top of it (pulse.md, units walk out over the roofs): four of its six tiles, never two on one.
  const roof = new Set(tilesOf(barracks.anchor, FIXTURE_REGISTRY.get(BARRACKS).footprint).map((tile) => `${tile.x},${tile.y}`))
  const at = trained.map((event) => (event.kind === "entity.spawned" ? `${event.at.x},${event.at.y}` : ""))
  assert.ok(at.every((tile) => roof.has(tile)), `a trooper came down off the roof: ${at.join(" ")}`)
  assert.equal(new Set(at).size, 4, "two troopers on one tile")
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

  // Walled in by its own side, a trooper on each of those six tiles, nothing it sets on its roof can walk off: its roof
  // fills, the rest of what it owes stays owed, and the schedule does not wait for it, so both waves have come.
  const free = footprintRing(3, 2, 1)
    .map((offset) => ({ x: corner.x + offset.x, y: corner.y + offset.y }))
    .filter((tile) => terrain.tiles[tile.y * terrain.width + tile.x] !== "terrain.rock")
  assert.equal(free.length, 6)
  const crowd: Force[] = free.map((tile) => ({ player: "A", muster: tile, units: [TROOPER] }))
  const boxed = lone(recipe({ perWave: 4, waves: 2, firstTicks: 12, intervalTicks: 24 }), 60, corner, crowd)
  const walledIn = boxed.run.finalState.entities.find((entity) => entity.contentId === BARRACKS)
  assert.deepEqual(ticksOf(boxed.run.events), [12, 12, 12, 12, 36, 36], "the roof did not fill, or filled past its six tiles")
  assert.deepEqual([walledIn?.produced, walledIn?.owed], [2, 2])
})

test("a building without a recipe carries no production fields, so a state without a producer is byte for byte what it was", () => {
  const registry = FIXTURE_REGISTRY
  const initialState = openingState({
    terrain,
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

// --- In a battle --------------------------------------------------------------------------------

/** What each building Vasse's army offers spawns, by its structure: its army's own words for it. */
const SPAWNS: Readonly<Record<string, BuildingSpawns>> = Object.fromEntries(
  (ARMIES.arsenals["vasse"]?.buildings ?? []).flatMap((card) => (card.spawns === undefined ? [] : [[card.structure, card.spawns] as const])),
)
/** Every building's first wave, in ticks: the owner's five seconds, as the tuned setting has it. */
const FIRST_WAVE = defaultValue("firstWave") * TICKS_PER_SECOND
const battleRegistry = spawningRegistry(FIXTURE_REGISTRY, SPAWNS, FIRST_WAVE)

/** The starter map's base as round 1 opens: its Nexus, and a Barracks beside it. */
const BASE: readonly StructurePlacement[] = [
  { contentId: "structure.citizen.nexus", player: "A", anchor: { x: 17, y: 10 } },
  { contentId: BARRACKS, player: "A", anchor: { x: 25, y: 10 } },
]
/** Round 1's armies: Vasse's starting package ahead of the base, and a raid of eight runners coming from the east. */
const FORCES: readonly Force[] = [
  { player: "A", muster: { x: 32, y: 12 }, units: ["unit.citizen.vasse", TROOPER, TROOPER, TROOPER, "unit.citizen.marksman", "unit.citizen.marksman"] },
  { player: "B", muster: { x: 62, y: 12 }, units: Array.from({ length: 8 }, () => "unit.ravel.runner") },
]
const ROUND_TICKS = 360

/** Round `pulse` on the starter map: the base and the armies in round 1, what the last round left after that, and
 *  `plan`'s buildings newly placed. */
function round(pulse: number, carried: MatchState | null, plan: readonly StructurePlacement[] = [], registry = battleRegistry) {
  const initialState = openingState({
    terrain,
    registry,
    structures: [...(pulse === 1 ? BASE : []), ...plan.map((placed) => ({ player: "A" as const, ...placed }))],
    setup: { seed: 7, pulseTicks: ROUND_TICKS, forces: pulse === 1 ? FORCES : [] },
    ...(carried === null ? {} : { carried }),
  })
  const states: MatchState[] = []
  const run = resolvePulse({ initialState, registry, pulseTicks: ROUND_TICKS, seed: 7, watch: (state) => states.push(state) })
  return { events: run.events, states, final: run.finalState }
}

test("the Barracks and the Hatchery say what they spawn on their own cards, and the battle runs on it", () => {
  // The owner's numbers: four troopers in one wave a round; the Hatchery's brood, three, by the same rule.
  assert.deepEqual(SPAWNS[BARRACKS], { unit: TROOPER, perWave: 4, waves: 1, secondsBetween: 10 })
  assert.deepEqual(SPAWNS[HATCHERY], { unit: SWARMER, perWave: 3, waves: 1, secondsBetween: 10 })
  assert.equal(FIRST_WAVE, 60)
  assert.deepEqual(battleRegistry.get(BARRACKS).production, { output: TROOPER, perWave: 4, waves: 1, firstTicks: 60, intervalTicks: 120 })
  assert.deepEqual(battleRegistry.get(HATCHERY).production, spawnRecipe({ unit: SWARMER, perWave: 3, waves: 1, secondsBetween: 10 }, 60))
  assert.equal(battleRegistry.get(HATCHERY).spawn, undefined, "the battle's Hatchery still breeds by its own timer")
  assert.equal(battleRegistry.get("structure.bench.beamturret").production, undefined)
  // Nothing spawns, nothing changes.
  assert.equal(spawningRegistry(FIXTURE_REGISTRY, {}, FIRST_WAVE), FIXTURE_REGISTRY)
})

test("round 1: the Barracks beside the Nexus sends its four troopers together, five seconds in, on its roof", () => {
  const run = round(1, null)
  const opening = run.states[0]?.entities.find((entity) => entity.contentId === BARRACKS)
  assert.ok(opening !== undefined)
  assert.deepEqual([opening.productionCooldown, opening.produced, opening.owed], [FIRST_WAVE, 0, 0])
  const trained = trainedEvents(run.events)
  assert.deepEqual(trained.map((event) => event.tick), [60, 60, 60, 60])
  // On its roof, on the tiles nearest where they head (east, toward the raid): its east column whole, and the ties for
  // the rest drawn.
  const roof = tilesOf(opening.anchor, battleRegistry.get(BARRACKS).footprint)
  const at = trained.map((event) => (event.kind === "entity.spawned" ? `${event.at.x},${event.at.y}` : ""))
  assert.ok(at.every((tile) => roof.some((own) => `${own.x},${own.y}` === tile)), `a trooper came down off the roof: ${at.join(" ")}`)
  const eastmost = Math.max(...roof.map((tile) => tile.x))
  const east = roof.filter((tile) => tile.x === eastmost).map((tile) => `${tile.x},${tile.y}`)
  assert.ok(east.every((tile) => at.includes(tile)), `the east column is not all taken: ${at.join(" ")}`)
})

test("a building the player placed spawns too, its wave on the same tick as the base's; a Hatchery's brood the same way", () => {
  // A Supply Depot beside them, so the army has room for both waves (the Nexus alone gives twelve: the starting package
  // and the base's Barracks's wave fill ten of them).
  const placed = [
    { contentId: BARRACKS, anchor: { x: 17, y: 13 } },
    { contentId: HATCHERY, anchor: { x: 24, y: 13 } },
    { contentId: "structure.citizen.depot", anchor: { x: 30, y: 16 } },
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

test("supply: an army fields no more than its buildings give, and a wave past it waits for a place, coming as one falls", () => {
  // No Supply Depot: the Nexus gives twelve. The starting package takes five and the base's Barracks's wave four; a planned
  // Barracks's four and a Hatchery's three would take the army to sixteen.
  const placed = [
    { contentId: BARRACKS, anchor: { x: 17, y: 13 } },
    { contentId: HATCHERY, anchor: { x: 24, y: 13 } },
  ]
  const run = round(1, null, placed)
  const unitsAt = (state: MatchState): number =>
    supplyOf(state.entities.filter((entity) => entity.player === "A").map((entity) => battleRegistry.get(entity.contentId))).used
  for (const state of run.states) assert.ok(unitsAt(state) <= 12, `the army took ${unitsAt(state)} places at tick ${state.tick}`)
  const trained = trainedEvents(run.events).map((event) => event.tick)
  // Seven fit as the first waves come; the rest wait for a place.
  assert.equal(trained.filter((tick) => tick === 60).length, 7)

  // And a wave that waits comes as places open: twelve troopers fill what the Nexus gives and meet eight raiders;
  // the Barracks's wave of four comes as they fall, each the tick after a place opens, never past twelve.
  const full = withProduction(FIXTURE_REGISTRY, { [BARRACKS]: recipe() })
  const initialState = openingState({
    terrain,
    registry: full,
    structures: [{ contentId: "structure.citizen.nexus", anchor: { x: 17, y: 10 } }, { contentId: BARRACKS, anchor: { x: 25, y: 10 } }],
    setup: {
      seed: 1,
      pulseTicks: 400,
      forces: [
        { player: "A", muster: { x: 40, y: 12 }, units: Array.from({ length: 12 }, () => TROOPER) },
        { player: "B", muster: { x: 50, y: 12 }, units: Array.from({ length: 8 }, () => "unit.ravel.raider") },
      ],
    },
  })
  const battle = resolvePulse({ initialState, registry: full, pulseTicks: 400, seed: 1 })
  const fell = battle.events.filter((event) => event.kind === "entity.died" && event.entity.startsWith("A:")).map((event) => event.tick)
  const came = ticksOf(battle.events)
  assert.equal(came.length, 4, `the wave did not all come: ${JSON.stringify(came)}`)
  assert.ok(came.some((tick) => tick > 60), "no unit waiting for a place ever came")
  // Each comes no earlier than enough places have opened for it.
  came.forEach((tick, index) => assert.ok(fell.filter((death) => death < tick).length >= index + 1, `the ${index + 1}th came at ${tick} with no place for it`))
})

test("supply's arithmetic: a unit takes 1 unless it says, a Commander none, a structure none; no building giving any is no cap", () => {
  const trooper = battleRegistry.get("unit.citizen.trooper")
  const nexus = battleRegistry.get("structure.citizen.nexus")
  const vasse = battleRegistry.get("unit.citizen.vasse")
  const pikeman = battleRegistry.get("unit.citizen.pikeman")
  assert.deepEqual([supplyCostOf(trooper), supplyCostOf(vasse), supplyCostOf(pikeman), supplyCostOf(nexus)], [1, 0, 2, 0])
  assert.deepEqual(supplyOf([nexus, trooper, pikeman, vasse]), { used: 3, cap: 12 })
  assert.deepEqual(supplyOf([trooper, trooper]), { used: 2, cap: null })
  assert.equal(hasRoom({ used: 11, cap: 12 }, trooper), true)
  assert.equal(hasRoom({ used: 11, cap: 12 }, pikeman), false)
  assert.equal(hasRoom({ used: 99, cap: null }, pikeman), true)
})

test("a wave's survivors stay on the battlefield; the regroup and the next opening start its counters afresh, on the recipe that round runs", () => {
  // A Turret north of the Barracks, facing the raid's way in, so some of the wave live to come home: with nothing
  // built, the raid's raiders outlast all four.
  const first = round(1, null, [{ contentId: "structure.bench.beamturret", anchor: { x: 25, y: 7 } }])
  const trained = trainedEvents(first.events)
  assert.equal(trained.length, 4, "round 1 did not train its wave")
  const back = regroup(first.final, battleRegistry)
  const barracks = back.state.entities.find((entity) => entity.contentId === BARRACKS)
  assert.ok(barracks !== undefined)
  assert.deepEqual([barracks.productionCooldown, barracks.produced, barracks.owed], [FIRST_WAVE, 0, 0])
  const ordinals = new Set(trained.map((event) => (event.kind === "entity.spawned" ? event.ordinal : -1)))
  const kept = back.paths.filter((path) => ordinals.has(path.ordinal))
  assert.ok(kept.length > 0, "no trooper of the wave survived round 1 to stay on the battlefield")

  // A building given a second wave between rounds (what a Nexus power may one day do) raises `waves` and
  // nothing else: the carried Barracks sends both from the next round, ten seconds apart.
  const twice = spawningRegistry(FIXTURE_REGISTRY, { ...SPAWNS, [BARRACKS]: { ...(SPAWNS[BARRACKS] as BuildingSpawns), waves: 2 } }, FIRST_WAVE)
  const second = round(2, back.state, [], twice)
  const opened = second.states[0]?.entities.find((entity) => entity.contentId === BARRACKS)
  assert.deepEqual([opened?.productionCooldown, opened?.produced, opened?.owed], [FIRST_WAVE, 0, 0])
  assert.ok(second.final.tick >= 180, `round 2 ended at tick ${second.final.tick}, before a second wave could come`)
  // The second wave comes ten seconds after the first, as far as the army has room: the Nexus's 12 places, filled by
  // round 1's survivors and the first wave, hold its last two back (a wave the army's supply holds back, above).
  // Pinned when the round moved onto the starter map's Skirmish base (Story stopped, 2026-11-26).
  assert.deepEqual(ticksOf(second.events), [60, 60, 60, 60, 180, 180])
})

test("round 1 with the Barracks's wave hashes the same on every run and on both runtimes", () => {
  const run = round(1, null)
  // Pinned: Node and Bun run this same line, so a runtime that resolves the round differently fails here.
  assert.equal(hashState(run.final), PINNED_ROUND_1)
  assert.equal(hashState(round(1, null).final), PINNED_ROUND_1)
})

// Round 1 as the rules play it on the starter map: Vasse's starting package ahead of the base, the Barracks's four
// troopers together five seconds in, a raid of eight runners from the east, and every rule a Battle Round walks by.
// It was PERIMETER's round 1, a story mission's, until Story stopped (the owner, 2026-11-26), and was pinned again
// then, on its own opening: what a change to any rule of the battle moves is seen here.
const PINNED_ROUND_1 = "c65ee5ae524d75b28e72aba3db7105ea2d2df43d408734a4ade6750ad182b390"
