// The ground measure as a rule of the Battle Round — the Ground Experiment's rules half (`GridMeasure`,
// src/grid/types.ts). A battle carries its measure in its state, and every distance the Pulse measures, every step
// it takes and the rules layer round it read it from there. Under "as now" nothing changes: the rest of the suite
// and every pinned hash in it say so, and the first tests here hold the bytes. The rest is what the other measures
// do — a walk down the screen as long as one across the same ground, melee as touching, a reach as wide as it
// is tall on screen — and that the measure travels with the round, into its forecast, its Recall and the next.

import { test } from "node:test"
import assert from "node:assert/strict"
import { PERIMETER } from "../src/armies/index.ts"
import { STARTER_STANDING, starterGrid } from "../src/build/catalog.ts"
import { measureOf } from "../src/build/ground.ts"
import { foresee, nextRound, startPulse } from "../src/cli/pulse-run.ts"
import { starterContext } from "../src/cli/starter.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { SQUARE, isSquare } from "../src/grid/coords.ts"
import type { Coord, GridMeasure, GridTerrain } from "../src/grid/types.ts"
import { foreseeIntents, missionOpening, recall, resolveMissionPulse, restoreCommanders } from "../src/match/index.ts"
import type { MissionPulseInput } from "../src/match/index.ts"
import type { MissionDefinition } from "../src/mission/index.ts"
import { validateMission } from "../src/mission/index.ts"
import { contextFor, resolvePulse, stepCost, stepTick } from "../src/pulse/index.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../src/scenario/index.ts"
import { hashState, parseState, serializeState } from "../src/state/serialize.ts"
import type { MatchState, PlayerId, TargetArea } from "../src/state/types.ts"
import { buildSide } from "./build-helpers.ts"
import { loadScenarioFile, scenarioFiles } from "./helpers.ts"

const ROWS_DOUBLE = measureOf("rows-x2")
const SIDEWAYS_DOUBLE = measureOf("sideways-x2")
const TROOPER = "unit.citizen.trooper"
const FLAK = "unit.bench.flaktrooper"
const VASSE = "unit.citizen.vasse"

// --- An open field, placed by hand and resolved tick by tick -------------------------------------------

type Placed = readonly [x: number, y: number, content: string]

/** One side's placement block: each content at its tile. */
function block(placed: readonly Placed[]): PlacementBlock {
  const symbols = "abcdefghijklmnopqrstuvwxyz"
  const rows: string[][] = []
  const legend: Record<string, { content: string }> = {}
  placed.forEach(([x, y, content], index) => {
    const symbol = symbols[index] as string
    while (rows.length <= y) rows.push([])
    const row = rows[y] as string[]
    while (row.length <= x) row.push(" ")
    row[x] = symbol
    legend[symbol] = { content }
  })
  return { rows: rows.map((row) => row.join("")), legend }
}

/** An open Grid with each side placed as given — and side A's target, when given one — measured by `measure`. */
function field(
  sides: Readonly<Partial<Record<PlayerId, readonly Placed[]>>>,
  options: Readonly<{ measure?: GridMeasure; target?: TargetArea }> = {},
): MatchState {
  const placements: Partial<Record<PlayerId, PlacementBlock>> = {}
  for (const side of ["A", "B"] as const) {
    const placed = sides[side]
    if (placed !== undefined) placements[side] = block(placed)
  }
  const scenario: ScenarioDefinition = {
    id: "ground-field",
    name: "ground field",
    grid: { width: 40, height: 30 },
    seed: 1,
    pulseTicks: 400,
    terrain: Array.from({ length: 30 }, () => ".".repeat(40)),
    terrainLegend: { ".": "terrain.plain" },
    placements,
    ...(options.target === undefined ? {} : { targets: { A: options.target } }),
  }
  const state = loadScenario(scenario, { registry: FIXTURE_REGISTRY }).state
  return options.measure === undefined || isSquare(options.measure) ? state : { ...state, measure: options.measure }
}

/** A state resolved tick by tick, for at most `ticks`: every event, in order. */
function play(state: MatchState, ticks: number): DomainEvent[] {
  const context = contextFor(state, FIXTURE_REGISTRY, ticks)
  const events: DomainEvent[] = []
  let at = state
  while (at.outcome === null && at.tick < ticks) {
    const result = stepTick(at, context)
    at = result.state
    events.push(...result.events)
  }
  return events
}

/** The ticks a lone unit stepped on, walking from (5, 2) to its side's target. */
function walk(unit: string, to: Coord, measure: GridMeasure): number[] {
  const events = play(field({ A: [[5, 2, unit]] }, { measure, target: { x: to.x, y: to.y, width: 1, height: 1 } }), 400)
  return events.filter((event) => event.kind === "entity.moved").map((event) => event.tick)
}

/** Eleven rows down, and twenty-two columns across: the same distance on the screen, a cell being about twice
 *  as tall as it is wide. */
const DOWN: Coord = { x: 5, y: 13 }
const ACROSS: Coord = { x: 27, y: 2 }

/** The gaps between one step and the next. */
const gaps = (ticks: readonly number[]): number[] => ticks.slice(1).map((tick, index) => tick - (ticks[index] as number))

/** Whether `shooter`, alone with an enemy trooper `dx` columns across and `dy` rows down from it, fires on the
 *  battle's first tick — before anyone has the credit to step. */
function firesAt(shooter: string, dx: number, dy: number, measure: GridMeasure): boolean {
  const events = play(field({ A: [[10, 10, shooter]], B: [[10 + dx, 10 + dy, TROOPER]] }, { measure }), 1)
  return events.some((event) => event.kind === "attack.launched" && event.attacker.startsWith("A:"))
}

// --- As now: nothing changes ----------------------------------------------------------------------------

test("a battle measured as now carries no measure: its opening is byte for byte a battle's before the measure", () => {
  const input: MissionPulseInput = { mission: PERIMETER, grid: starterGrid(), registry: FIXTURE_REGISTRY, pulse: 1, carried: null, structures: STARTER_STANDING }
  const before = missionOpening(input).state
  const square = missionOpening({ ...input, measure: SQUARE }).state
  assert.ok(!("measure" in before) && !("measure" in square), "a square battle wrote a measure into its state")
  assert.equal(serializeState(square), serializeState(before))
  assert.doesNotMatch(serializeState(square), /measure/)
  // Measured another way, the opening says so, and nothing else about it differs.
  const rows = missionOpening({ ...input, measure: ROWS_DOUBLE }).state
  assert.deepEqual(rows.measure, { row: 2, tile: 1 })
  const { measure: _measure, ...rest } = rows
  assert.equal(serializeState(rest), serializeState(before))
  // "As now" and "square tiles" measure square; the other two do not.
  assert.deepEqual([measureOf("as-now"), measureOf("square-tiles")], [SQUARE, SQUARE])
})

test("a state's measure survives a round trip, and a broken one is refused by name", () => {
  const state = field({ A: [[5, 5, TROOPER]] }, { measure: SIDEWAYS_DOUBLE })
  const text = serializeState(state)
  assert.equal(hashState(parseState(text)), hashState(state))
  assert.equal(serializeState(parseState(text)), text)
  const broken = (measure: unknown): string => JSON.stringify({ ...JSON.parse(text), measure })
  assert.throws(() => parseState(broken({ row: 1, tile: 1 })), /state measure is square/)
  assert.throws(() => parseState(broken({ row: 3, tile: 1 })), /state measure counts a row and a tile as 1 or 2/)
  assert.throws(() => parseState(broken({ row: 2 })), /state measure counts a row and a tile as 1 or 2/)
  assert.throws(() => parseState(broken({ row: 2, tile: 1, depth: 1 })), /unknown field depth/)
  assert.throws(() => parseState(broken([2, 1])), /state measure is not an object/)
})

// --- Rows count double -----------------------------------------------------------------------------------

test("rows x2: the same unit walks eleven rows down in the time it walks twenty-two columns across, a step down taking twice a step across", () => {
  // As now, down the screen is twice as fast as across it: the problem.
  assert.deepEqual([walk(TROOPER, DOWN, SQUARE).at(-1), walk(TROOPER, ACROSS, SQUARE).at(-1)], [44, 88])
  const down = walk(TROOPER, DOWN, ROWS_DOUBLE)
  const across = walk(TROOPER, ACROSS, ROWS_DOUBLE)
  assert.deepEqual([down.length, across.length], [11, 22])
  assert.deepEqual([down.at(-1), across.at(-1)], [88, 88], "the same ground on screen, not the same time")
  // A trooper steps every four ticks across, as now, and every eight down.
  assert.ok(gaps(across).every((gap) => gap === 4), `across: ${gaps(across).join(",")}`)
  assert.ok(gaps(down).every((gap) => gap === 8), `down: ${gaps(down).join(",")}`)
  // Each step says what it cost: a row twice a column.
  const rate = FIXTURE_REGISTRY.get(TROOPER).movementRate
  assert.ok(rate !== undefined)
  const costs = (to: Coord): Set<number> =>
    new Set(play(field({ A: [[5, 2, TROOPER]] }, { measure: ROWS_DOUBLE, target: { ...to, width: 1, height: 1 } }), 120).flatMap((event) => (event.kind === "move.intended" ? [event.cost] : [])))
  assert.deepEqual([...costs(DOWN)], [stepCost(rate, ROWS_DOUBLE, "s")])
  assert.deepEqual([...costs(ACROSS)], [stepCost(rate, ROWS_DOUBLE, "e")])
  assert.deepEqual([stepCost(rate, ROWS_DOUBLE, "s"), stepCost(rate, ROWS_DOUBLE, "e"), stepCost(rate)], [72, 36, 36])
})

test("rows x2: melee is touching — a trooper swings at the enemy directly above it, and steps beside a building a row and a column away first", () => {
  const above = play(field({ A: [[10, 10, TROOPER]], B: [[10, 9, TROOPER]] }, { measure: ROWS_DOUBLE }), 24)
  const swings = above.filter((event) => event.kind === "attack.launched" && event.tick === 1)
  assert.deepEqual(
    swings.map((event) => (event.kind === "attack.launched" ? [event.attacker, event.attackKind] : [])),
    [
      ["B:trooper#1", "melee"],
      ["A:trooper#2", "melee"],
    ],
    "two troopers one above the other did not fight at once",
  )
  assert.ok(!above.some((event) => event.kind === "entity.moved"), "a trooper touching its enemy walked")
  // A row and a column from a Barracks's corner it does not touch it: it steps beside it — up, the way the
  // screen's diagonal goes — and only then swings. (A placement block puts a building by its centre tile, so the
  // Barracks covers columns 11 to 13 of rows 7 and 8.)
  const corner = play(field({ A: [[10, 9, TROOPER]], B: [[12, 7, "structure.citizen.barracks"]] }, { measure: ROWS_DOUBLE }), 24)
  const moves = corner.filter((event) => event.kind === "entity.moved")
  const firstSwing = corner.find((event) => event.kind === "attack.launched")
  assert.deepEqual(
    moves.map((event) => (event.kind === "entity.moved" ? event.to : null)),
    [{ x: 10, y: 8 }],
  )
  assert.ok(firstSwing !== undefined && (moves[0]?.tick ?? Infinity) < firstSwing.tick, "it swung at a building it did not touch")
})

test("rows x2: a range of 4 reaches four columns across and two rows up, never three", () => {
  assert.equal(FIXTURE_REGISTRY.get(FLAK).attack?.range, 4)
  assert.deepEqual(
    [firesAt(FLAK, 4, 0, ROWS_DOUBLE), firesAt(FLAK, 5, 0, ROWS_DOUBLE), firesAt(FLAK, 0, -2, ROWS_DOUBLE), firesAt(FLAK, 0, -3, ROWS_DOUBLE)],
    [true, false, true, false],
  )
  // Two across and one up is four, as the screen counts it; three across and one up is five.
  assert.deepEqual([firesAt(FLAK, 2, -1, ROWS_DOUBLE), firesAt(FLAK, 3, -1, ROWS_DOUBLE)], [true, false])
  // As now the same shooter reaches four rows up, twice as far up the screen as across it.
  assert.deepEqual([firesAt(FLAK, 0, -4, SQUARE), firesAt(FLAK, 4, 0, SQUARE)], [true, true])
})

// --- Sideways doubled ------------------------------------------------------------------------------------

test("sideways x2: across twice as fast as now, up and down as fast as now; a range of 3 reaches six columns and three rows", () => {
  assert.deepEqual([walk(TROOPER, ACROSS, SIDEWAYS_DOUBLE).at(-1), walk(TROOPER, ACROSS, SQUARE).at(-1)], [44, 88])
  assert.deepEqual([walk(TROOPER, DOWN, SIDEWAYS_DOUBLE).at(-1), walk(TROOPER, DOWN, SQUARE).at(-1)], [44, 44])
  assert.equal(FIXTURE_REGISTRY.get(VASSE).attack?.range, 3)
  assert.deepEqual(
    [firesAt(VASSE, 6, 0, SIDEWAYS_DOUBLE), firesAt(VASSE, 7, 0, SIDEWAYS_DOUBLE), firesAt(VASSE, 0, -3, SIDEWAYS_DOUBLE), firesAt(VASSE, 0, -4, SIDEWAYS_DOUBLE)],
    [true, false, true, false],
  )
  // Melee stays touching: a doubled reach of 1 would swing two columns across, and a trooper does not.
  assert.deepEqual([firesAt(TROOPER, 1, 0, SIDEWAYS_DOUBLE), firesAt(TROOPER, 0, -1, SIDEWAYS_DOUBLE), firesAt(TROOPER, 2, 0, SIDEWAYS_DOUBLE)], [true, true, false])
})

// --- Movement credit -------------------------------------------------------------------------------------

test("waiting never banks a sprint across: credit saved for a step down buys one step across, at a step across's pace", () => {
  // A trooper that stood long enough to save up for a step down, a row's worth of credit, then walks across.
  const saved = field({ A: [[5, 2, TROOPER]] }, { measure: ROWS_DOUBLE, target: { x: 27, y: 2, width: 1, height: 1 } })
  const rich: MatchState = { ...saved, entities: saved.entities.map((entity) => ({ ...entity, moveCredit: 72 })) }
  const moved = play(rich, 40)
    .filter((event) => event.kind === "entity.moved")
    .map((event) => event.tick)
  assert.equal(moved[0], 1, "it did not step at once")
  assert.ok(gaps(moved).every((gap) => gap === 4), `it sprinted: steps on ticks ${moved.join(",")}`)
})

test("under every measure, every battle on file keeps every unit's credit between none and its dearest step: no step is taken on credit it did not have", async () => {
  for (const name of scenarioFiles()) {
    const scenario = await loadScenarioFile(name)
    for (const measure of [ROWS_DOUBLE, SIDEWAYS_DOUBLE]) {
      const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
      let state: MatchState = { ...loaded.state, measure }
      const context = contextFor(state, loaded.registry, scenario.pulseTicks)
      while (state.outcome === null && state.tick < scenario.pulseTicks) {
        state = stepTick(state, context).state
        for (const entity of state.entities) {
          const rate = loaded.registry.get(entity.contentId).movementRate
          if (rate === undefined) continue
          const cap = stepCost(rate, measure)
          assert.ok(entity.moveCredit >= 0 && entity.moveCredit <= cap, `${name}, ${JSON.stringify(measure)}: ${entity.id} holds ${entity.moveCredit} of ${cap} at tick ${state.tick}`)
        }
      }
    }
  }
})

// --- The forecast, and the round ------------------------------------------------------------------------

/** A ridge of rock across an open field, a Grid Nexus of the player's south-west of it, and one raider coming
 *  from the north-east to it. */
function ridgeWalk(): Readonly<{ mission: MissionDefinition; grid: GridTerrain }> {
  const width = 40
  const height = 24
  const tiles = Array.from({ length: width * height }, (_, index) => {
    const x = index % width
    const y = Math.floor(index / width)
    return y === 9 && x >= 14 && x <= 24 ? ("terrain.rock" as const) : ("terrain.plain" as const)
  })
  const grid: GridTerrain = { width, height, tiles }
  const mission: MissionDefinition = {
    id: "ground-walk",
    name: "ground walk",
    pulses: 1,
    pulseTicks: 600,
    seed: 7,
    regions: [{ id: "north-east", x: 30, y: 1, width: 1, height: 1 }],
    triggers: [
      { id: "raid", when: { pulse: 1, tick: 0 }, do: [{ spawn: { side: "B", units: [{ unit: TROOPER, count: 1 }], at: "north-east", group: "walker" } }] },
      { id: "end", when: { event: "pulse.end", pulse: 1 }, do: [{ win: true }] },
    ],
  }
  validateMission(mission, grid, FIXTURE_REGISTRY)
  return { mission, grid }
}

test("rows x2: the forecast's way is the Pulse's own walk, along the screen's diagonal and round the ridge", () => {
  const { mission, grid } = ridgeWalk()
  const input = (measure: GridMeasure): MissionPulseInput => ({
    mission,
    grid,
    registry: FIXTURE_REGISTRY,
    pulse: 1,
    carried: null,
    structures: [{ contentId: "structure.citizen.nexus", anchor: { x: 5, y: 17 } }],
    measure,
  })
  const [group] = foreseeIntents(input(ROWS_DOUBLE))
  assert.ok(group !== undefined && group.path.length > 0)
  // Where the raider actually stood, tick by tick, each new tile once.
  const run = resolveMissionPulse(input(ROWS_DOUBLE))
  const raider = run.arrivals[0]
  assert.ok(raider !== undefined)
  const walked: Coord[] = []
  let at = raider.anchor
  for (const state of run.states) {
    const anchor = state.entities.find((entity) => entity.ordinal === raider.ordinal)?.anchor
    if (anchor === undefined) break
    if (anchor.x !== at.x || anchor.y !== at.y) walked.push(anchor)
    at = anchor
  }
  assert.deepEqual(group.path, walked, "the trail drawn is not the way the raider walks")
  assert.ok(run.states.every((state) => state.measure?.row === 2), "a tick of the round was measured another way")
  // It heads down the screen first, as far as the screen's diagonal, where as now it heads across first.
  assert.deepEqual(group.path.slice(0, 2), [
    { x: 30, y: 2 },
    { x: 30, y: 3 },
  ])
  const [square] = foreseeIntents(input(SQUARE))
  assert.deepEqual(square?.path.slice(0, 2), [
    { x: 29, y: 1 },
    { x: 28, y: 1 },
  ])
})

test("every measure resolves the same battle the same way on every run, and on Node and Bun alike", async () => {
  const scenario = await loadScenarioFile("citizens-versus-ravels.map.json")
  const resolve = (measure: GridMeasure): readonly [string, string] => {
    const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
    const initialState: MatchState = isSquare(measure) ? loaded.state : { ...loaded.state, measure }
    const run = resolvePulse({ initialState, registry: loaded.registry, pulseTicks: scenario.pulseTicks, seed: scenario.seed })
    return [run.stateHash, run.eventsHash]
  }
  for (const [measure, pinned] of PINNED_BATTLES) {
    const first = resolve(measure)
    assert.deepEqual(resolve(measure), first, `${JSON.stringify(measure)} resolved differently the second time`)
    // Pinned: Node and Bun run this same line, so a runtime that resolves the battle differently fails here.
    assert.deepEqual(first, pinned, JSON.stringify(measure))
  }
})

// The Citizens against the Ravels, the battle with the most rules in it (blasts among them), under each measure. As
// now it is the hash it has always had.
const PINNED_BATTLES: readonly (readonly [GridMeasure, readonly [string, string]])[] = [
  [SQUARE, ["a130252c5a88642d67298ce021d13c28bb25ddf468165ed1614b7671729bd361", "5a590ad472f90a1bc6623b79e4f9d4e8164edaa3f74d786affe053eb32cbfae2"]],
  [ROWS_DOUBLE, ["9ca10d9fc857797bd95c679fe05384f9a6c93b029ac9793ba599142738b66743", "c8a3a4dc58cd579a4c9c71ad8f9a1b79643117e0ff211d8192848dfb167c4ba2"]],
  [SIDEWAYS_DOUBLE, ["51f6ad24c959a7e7a2289ed2f74883be11e7b88272a2f122a943c3de37932cb1", "83f3a7fffba5167aaac7c0bb3c0a5d971d60e2d3d9e92628539ed30743eb97e0"]],
]

test("a carried state keeps its measure into the next round, and a round given another measure takes it", () => {
  const input: MissionPulseInput = { mission: PERIMETER, grid: starterGrid(), registry: FIXTURE_REGISTRY, pulse: 1, carried: null, structures: STARTER_STANDING, measure: ROWS_DOUBLE }
  const round1 = resolveMissionPulse(input)
  assert.ok(round1.states.every((state) => state.measure?.row === 2 && state.measure.tile === 1), "a tick of round 1 lost its measure")
  // Recall, and a Commander set down again, keep the state's measure: what the next round is carried from.
  const back = recall(round1.final, FIXTURE_REGISTRY)
  assert.deepEqual(back.state.measure, ROWS_DOUBLE)
  const carried = restoreCommanders(back.state, [], 2, FIXTURE_REGISTRY).state
  assert.deepEqual(carried.measure, ROWS_DOUBLE)
  const next = { ...input, pulse: 2, carried, structures: [] }
  const { measure: _measure, ...unnamed } = next
  // Named nothing, the next round measures as the last did; named a measure, it takes that one, at once.
  assert.deepEqual(missionOpening(unnamed).state.measure, ROWS_DOUBLE)
  assert.deepEqual(resolveMissionPulse(unnamed).final.measure, ROWS_DOUBLE)
  assert.deepEqual(missionOpening({ ...next, measure: SIDEWAYS_DOUBLE }).state.measure, SIDEWAYS_DOUBLE)
  assert.ok(!("measure" in missionOpening({ ...next, measure: SQUARE }).state), "a round measured as now kept the last round's measure")
})

test("Recall sends a survivor to the home nearest as its battle measured: three rows up as now, four columns across when a row counts two", () => {
  // Two Grid Nexuses of the player's: one whose nearest tile is three rows above the trooper, one whose nearest
  // is four columns beside it. (A placement block puts a building by its centre tile.)
  const NEXUS = "structure.citizen.nexus"
  const homeOf = (measure: GridMeasure): Coord | undefined =>
    recall(field({ A: [[20, 6, NEXUS], [25, 10, NEXUS], [20, 10, TROOPER]] }, { measure }), FIXTURE_REGISTRY).moves[0]?.to
  assert.deepEqual(homeOf(SQUARE), { x: 20, y: 8 }, "as now: below the Nexus three rows up")
  assert.deepEqual(homeOf(ROWS_DOUBLE), { x: 23, y: 10 }, "rows x2: beside the Nexus four columns across")
})

test("the shell measures a round's battle, and its forecast, as the Ground Experiment says", () => {
  const sideOn = (ground: "as-now" | "rows-x2") => buildSide({ context: { ...starterContext(), experiments: { ground } }, startPulse, nextRound, foresee })
  const rows = sideOn("rows-x2")
  const resolved = startPulse(rows.build.round, rows.build.state)
  assert.ok(resolved !== null)
  assert.ok(resolved.timeline.states.every((state) => state.measure?.row === 2 && state.measure.tile === 1), "the battle was not measured as the Experiment says")
  assert.deepEqual(resolved.recall.state.measure, ROWS_DOUBLE)
  // The raid's ways are the match layer's own forecast under the same measure.
  const ways = foresee(rows.build.round, rows.build.state)
    .filter((group) => group.player === "B")
    .map((group) => group.path)
  const input: MissionPulseInput = { mission: PERIMETER, grid: starterGrid(), registry: FIXTURE_REGISTRY, pulse: 1, carried: null, structures: STARTER_STANDING }
  assert.deepEqual(ways, foreseeIntents({ ...input, measure: ROWS_DOUBLE }).map((group) => group.path))
  assert.notDeepEqual(ways, foreseeIntents(input).map((group) => group.path), "the raid's ways did not change with the measure")
  // As now, the battle carries no measure at all.
  const now = sideOn("as-now")
  const plain = startPulse(now.build.round, now.build.state)
  assert.ok(plain !== null)
  assert.ok(plain.timeline.states.every((state) => !("measure" in state)))
})
