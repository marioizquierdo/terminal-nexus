// A row counts two columns: the one rule of distance on the Grid (grid.md). A terminal cell is about twice as tall
// as it is wide, so the rules count the ground the way the screen shows it: every distance, range and radius counts
// a row up or down as two columns (`ROW_DISTANCE`), a step up or down takes twice as long as a step across, and
// touching is still a side shared. First the few functions every distance is worked out with (`src/grid/coords.ts`,
// `src/grid/reach.ts`), then what a battle and the rules round it do with them. What the screen draws by the same
// rule is tests/rows-view.test.ts's.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import {
  DIRECTIONS,
  ROW_DISTANCE,
  columnsWithin,
  directionOf,
  footprintDistance,
  footprintSteps,
  footprintWithin,
  gridDistance,
  gridSteps,
  inColumns,
  nearestFootprintTile,
  nearestTile,
  ringOffsets,
  rowsWithin,
  step,
  stepLength,
  tilesWithin,
} from "../src/grid/index.ts"
import type { Coord, Footprint, GridTerrain } from "../src/grid/index.ts"
import { foreseeIntents, recall, resolveMissionPulse } from "../src/match/index.ts"
import type { MissionPulseInput } from "../src/match/index.ts"
import type { MissionDefinition } from "../src/mission/index.ts"
import { validateMission } from "../src/mission/index.ts"
import { contextFor, resolvePulse, stepCost, stepTick } from "../src/pulse/index.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../src/scenario/index.ts"
import type { MatchState, PlayerId, TargetArea } from "../src/state/types.ts"
import { loadScenarioFile, scenarioFiles } from "./helpers.ts"

const ONE: Footprint = [{ x: 0, y: 0 }]
const ORIGIN: Coord = { x: 10, y: 10 }
const BARRACKS = "structure.citizen.barracks"
const TROOPER = "unit.citizen.trooper"
const RAIDER = "unit.ravel.raider"
const FLAK = "unit.bench.flaktrooper"

/** Every tile within `span` columns and `span` rows of `centre`, in reading order. */
function around(centre: Coord, span: number): Coord[] {
  const tiles: Coord[] = []
  for (let y = centre.y - span; y <= centre.y + span; y += 1) for (let x = centre.x - span; x <= centre.x + span; x += 1) tiles.push({ x, y })
  return tiles
}

/** The width and height, in tiles, of the box round some tiles. */
function extent(tiles: readonly Coord[]): Readonly<{ width: number; height: number }> {
  const xs = tiles.map((tile) => tile.x)
  const ys = tiles.map((tile) => tile.y)
  return { width: Math.max(...xs) - Math.min(...xs) + 1, height: Math.max(...ys) - Math.min(...ys) + 1 }
}

// --- The primitives ----------------------------------------------------------------------------------------------

test("a row counts two columns in every distance; touching is a side shared, a row up as much as a column across", () => {
  assert.equal(ROW_DISTANCE, 2)
  assert.deepEqual(inColumns(3, -2), { across: 3, down: -4 })
  assert.equal(gridDistance(ORIGIN, { x: 14, y: 10 }), 4)
  assert.equal(gridDistance(ORIGIN, { x: 10, y: 12 }), 4)
  assert.equal(gridDistance(ORIGIN, { x: 13, y: 11 }), 5)
  assert.equal(gridDistance(ORIGIN, { x: 7, y: 7 }), 9)
  // The tile above is two away, and touches it: within a reach of 1, as the tile beside it is.
  assert.equal(gridDistance(ORIGIN, { x: 10, y: 9 }), 2)
  assert.equal(gridSteps(ORIGIN, { x: 10, y: 9 }), 1)
  assert.ok(footprintWithin(ORIGIN, ONE, { x: 10, y: 9 }, ONE, 1))
  assert.ok(footprintWithin(ORIGIN, ONE, { x: 11, y: 10 }, ONE, 1))
  assert.ok(!footprintWithin(ORIGIN, ONE, { x: 11, y: 9 }, ONE, 1), "a diagonal neighbour does not touch")
  assert.ok(!footprintWithin(ORIGIN, ONE, { x: 10, y: 9 }, ONE, 0), "nothing is within a reach of none")
  // From a reach of 2 on, what touches is within it anyway: within is the distance alone.
  for (const tile of around(ORIGIN, 6)) {
    for (const radius of [2, 3, 4, 6, 8]) assert.equal(footprintWithin(ORIGIN, ONE, tile, ONE, radius), gridDistance(ORIGIN, tile) <= radius, `${tile.x},${tile.y} at ${radius}`)
  }
  // A footprint is measured to its nearest tile: a Barracks covers 0,0 to 2,1, so 4,3 is two columns and two rows
  // off its corner — six — and four steps.
  const barracks = FIXTURE_REGISTRY.get(BARRACKS).footprint
  assert.equal(footprintDistance({ x: 0, y: 0 }, barracks, { x: 4, y: 3 }, ONE), 2 + 2 * 2)
  assert.equal(footprintSteps({ x: 0, y: 0 }, barracks, { x: 4, y: 3 }, ONE), 4)
})

test("a step goes as far as it counts: one across a column, two up or down a row, and every step touches where it began", () => {
  assert.deepEqual(
    DIRECTIONS.map((direction) => [direction, stepLength(direction)]),
    [
      ["n", 2],
      ["e", 1],
      ["s", 2],
      ["w", 1],
    ],
  )
  for (const direction of DIRECTIONS) {
    const to = step(ORIGIN, direction)
    assert.equal(stepLength(direction), gridDistance(ORIGIN, to), direction)
    assert.equal(gridSteps(ORIGIN, to), 1, direction)
  }
})

test("a reach covers its length in columns on its own row and two columns less each row out: a diamond twice as wide as it is tall", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map(rowsWithin), [0, 0, 1, 1, 2, 2, 3, 3, 4])
  assert.deepEqual([-3, -2, -1, 0, 1, 2, 3].map((rows) => columnsWithin(4, rows)), [-2, 0, 2, 4, 2, 0, -2])
  // A reach of 4 from one tile: four columns either side, two rows up and down — nine tiles wide, five tall.
  assert.deepEqual(extent(tilesWithin(ORIGIN, ONE, 4)), { width: 9, height: 5 })
  // Row by row, as many columns either side as `columnsWithin` leaves, on as many rows as `rowsWithin` pays for.
  for (const radius of [2, 4, 6, 8]) {
    const reached = tilesWithin(ORIGIN, ONE, radius)
    for (let rows = -rowsWithin(radius); rows <= rowsWithin(radius); rows += 1) {
      const xs = reached.filter((tile) => tile.y === ORIGIN.y + rows).map((tile) => tile.x - ORIGIN.x)
      const columns = columnsWithin(radius, rows)
      assert.deepEqual(xs, Array.from({ length: 2 * columns + 1 }, (_, index) => index - columns), `reach ${radius}, ${rows} rows out`)
    }
  }
  // A reach of 1 covers what touches: the tiles beside, and the tiles above and below, though a row counts two.
  assert.deepEqual(tilesWithin(ORIGIN, ONE, 1), [
    { x: 10, y: 9 },
    { x: 9, y: 10 },
    { x: 10, y: 10 },
    { x: 11, y: 10 },
    { x: 10, y: 11 },
  ])
  // For any footprint and any reach, exactly the tiles the kernel's own test puts within it, in reading order.
  for (const footprint of [ONE, FIXTURE_REGISTRY.get(BARRACKS).footprint]) {
    for (const radius of [0, 1, 2, 3, 4, 6, 8]) {
      const everyTile = around(ORIGIN, radius + 4).filter((tile) => footprintWithin(ORIGIN, footprint, tile, ONE, radius))
      assert.deepEqual(tilesWithin(ORIGIN, footprint, radius), everyTile, `${footprint.length} tiles, reach ${radius}`)
    }
  }
})

test("the rings searched outward from a point: every tile exactly its distance out, each once, in reading order, never a negative zero", () => {
  assert.deepEqual(ringOffsets(0), [{ x: 0, y: 0 }])
  assert.deepEqual(ringOffsets(1), [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ])
  assert.deepEqual(ringOffsets(2), [
    { x: 0, y: -1 },
    { x: -2, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
  ])
  for (let distance = 0; distance <= 12; distance += 1) {
    const ring = ringOffsets(distance)
    const everyOffset = around({ x: 0, y: 0 }, distance).filter((offset) => gridDistance({ x: 0, y: 0 }, offset) === distance)
    assert.deepEqual(ring, everyOffset, `distance ${distance}`)
    for (const offset of ring) assert.ok(!Object.is(offset.x, -0) && !Object.is(offset.y, -0), `${distance}: ${offset.x},${offset.y}`)
  }
})

test("straight at a tile follows the screen's diagonal, two columns across for each row down; the nearest tile is nearest by the rule", () => {
  // Four across and two down is as far either way: a tie prefers across.
  assert.equal(directionOf(ORIGIN, { x: 14, y: 12 }), "e")
  // Three across and two down: the rows are further.
  assert.equal(directionOf(ORIGIN, { x: 13, y: 12 }), "s")
  assert.equal(directionOf(ORIGIN, { x: 5, y: 8 }), "w")
  assert.equal(directionOf(ORIGIN, { x: 11, y: 7 }), "n")
  assert.equal(directionOf(ORIGIN, ORIGIN), "s")
  assert.equal(directionOf(ORIGIN, ORIGIN, "w"), "w")
  // From four across: a footprint's far corner is three rows down — six — and its near one four columns back.
  const wall: Footprint = [
    { x: 0, y: 0 },
    { x: 4, y: 3 },
  ]
  assert.deepEqual(nearestFootprintTile({ x: 4, y: 0 }, { x: 0, y: 0 }, wall), { x: 0, y: 0 })
  // A tie goes to the tile listed first; with none listed there is none.
  assert.deepEqual(nearestTile(ORIGIN, [{ x: 12, y: 10 }, { x: 10, y: 11 }]), { x: 12, y: 10 })
  assert.equal(nearestTile(ORIGIN, []), null)
})

// --- In a battle: an open field, placed by hand and resolved tick by tick -------------------------------------

type Placed = readonly [x: number, y: number, content: string]

/** One side's placement block: each content with its centre on its tile. */
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

/** An open Grid, 50 by 30, with each side placed as given, and each side's target where `targets` says. */
function field(sides: Readonly<Partial<Record<PlayerId, readonly Placed[]>>>, targets: Readonly<Partial<Record<PlayerId, TargetArea>>> = {}): MatchState {
  const placements: Partial<Record<PlayerId, PlacementBlock>> = {}
  for (const side of ["A", "B"] as const) {
    const placed = sides[side]
    if (placed !== undefined) placements[side] = block(placed)
  }
  const scenario: ScenarioDefinition = {
    id: "rows-field",
    name: "rows field",
    grid: { width: 50, height: 30 },
    seed: 1,
    pulseTicks: 400,
    terrain: Array.from({ length: 30 }, () => ".".repeat(50)),
    terrainLegend: { ".": "terrain.plain" },
    placements,
    ...(Object.keys(targets).length === 0 ? {} : { targets }),
  }
  return loadScenario(scenario, { registry: FIXTURE_REGISTRY }).state
}

/** A state resolved tick by tick for at most `ticks`: every state after the first, and every event, in order. */
function play(state: MatchState, ticks: number): Readonly<{ states: MatchState[]; events: DomainEvent[] }> {
  const context = contextFor(state, FIXTURE_REGISTRY, ticks)
  const states: MatchState[] = []
  const events: DomainEvent[] = []
  let at = state
  while (at.outcome === null && at.tick < ticks) {
    const result = stepTick(at, context)
    at = result.state
    states.push(at)
    events.push(...result.events)
  }
  return { states, events }
}

/** A one-tile target at `tile`. */
const targetAt = (tile: Coord): TargetArea => ({ x: tile.x, y: tile.y, width: 1, height: 1 })

/** The ticks a lone unit stepped on, walking from 5,2 to its side's target at `to`. */
function walk(unit: string, to: Coord): number[] {
  const { events } = play(field({ A: [[5, 2, unit]] }, { A: targetAt(to) }), 400)
  return events.filter((event) => event.kind === "entity.moved").map((event) => event.tick)
}

/** The gaps between one step and the next. */
const gaps = (ticks: readonly number[]): number[] => ticks.slice(1).map((tick, index) => tick - (ticks[index] as number))

/** Whether `shooter`, alone with an enemy trooper `dx` columns across and `dy` rows down from it, fires on the
 *  battle's first tick — before anyone has the credit to step. */
function firesAt(shooter: string, dx: number, dy: number): boolean {
  const { events } = play(field({ A: [[10, 10, shooter]], B: [[10 + dx, 10 + dy, TROOPER]] }), 1)
  return events.some((event) => event.kind === "attack.launched" && event.attacker.startsWith("A:"))
}

test("a trooper walks eleven rows down in the time it walks twenty-two columns across: a step down takes twice a step across", () => {
  // Eleven rows down and twenty-two columns across: as far on screen, and as far by the rule.
  const down = walk(TROOPER, { x: 5, y: 13 })
  const across = walk(TROOPER, { x: 27, y: 2 })
  assert.deepEqual([down.length, across.length], [11, 22])
  assert.deepEqual([down.at(-1), across.at(-1)], [88, 88], "the same ground on screen, not the same time")
  // A trooper steps every four ticks across and every eight down.
  assert.ok(gaps(across).every((gap) => gap === 4), `across: ${gaps(across).join(",")}`)
  assert.ok(gaps(down).every((gap) => gap === 8), `down: ${gaps(down).join(",")}`)
  // Each step says what it cost: a row twice a column, and the dearest step, a row's, is what credit is capped at.
  const rate = FIXTURE_REGISTRY.get(TROOPER).movementRate
  assert.ok(rate !== undefined)
  const costs = (to: Coord): Set<number> =>
    new Set(play(field({ A: [[5, 2, TROOPER]] }, { A: targetAt(to) }), 120).events.flatMap((event) => (event.kind === "move.intended" ? [event.cost] : [])))
  assert.deepEqual([...costs({ x: 5, y: 13 })], [stepCost(rate, "s")])
  assert.deepEqual([...costs({ x: 27, y: 2 })], [stepCost(rate, "e")])
  assert.deepEqual([stepCost(rate, "s"), stepCost(rate, "e"), stepCost(rate)], [72, 36, 72])
})

test("two raiders, one nine rows above their target and one eighteen columns beside it, come a third of the way in on about the same tick", () => {
  // Their side's target is one tile on open ground; nothing stands in either's way and nothing shoots. Both start
  // eighteen away by the rule — nine rows of two columns, eighteen columns — and each is timed by where it stands
  // tick by tick, from its footprint's nearest tile to the target.
  const target = { x: 30, y: 20 }
  const start = field({ B: [[30, 11, RAIDER], [11, 20, RAIDER]] }, { B: targetAt(target) })
  const footprint = FIXTURE_REGISTRY.get(RAIDER).footprint
  const [above, beside] = start.entities.map((entity) => entity.ordinal)
  assert.ok(above !== undefined && beside !== undefined)
  const distance = (state: MatchState, ordinal: number): number => {
    const raider = state.entities.find((entity) => entity.ordinal === ordinal)
    assert.ok(raider !== undefined, `raider ${ordinal} is gone`)
    return footprintDistance(raider.anchor, footprint, target, ONE)
  }
  assert.deepEqual([distance(start, above), distance(start, beside)], [18, 18])
  const { states } = play(start, 200)
  /** The first tick it stands a third of the way in: twelve away, or nearer. */
  const thirdIn = (ordinal: number): number => {
    const state = states.find((each) => distance(each, ordinal) <= 12)
    assert.ok(state !== undefined, `raider ${ordinal} never came a third of the way in`)
    return state.tick
  }
  const [fromAbove, fromBeside] = [thirdIn(above), thirdIn(beside)]
  // About the same tick: no further apart than one step across takes, the credit for a step coming in whole ticks.
  // Were a row one column, the one above would come in twice as fast.
  const rate = FIXTURE_REGISTRY.get(RAIDER).movementRate
  assert.ok(rate !== undefined)
  const stepAcrossTicks = Math.ceil(stepCost(rate, "e") / rate.numerator)
  assert.ok(Math.abs(fromAbove - fromBeside) <= stepAcrossTicks, `a third of the way in on ticks ${fromAbove} and ${fromBeside}`)
  assert.deepEqual([fromAbove, fromBeside], [27, 30])
})

test("melee is touching: a trooper swings at the enemy straight above it, and steps beside a building a row and a column off first", () => {
  const above = play(field({ A: [[10, 10, TROOPER]], B: [[10, 9, TROOPER]] }), 24).events
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
  // A row and a column off a Barracks's corner it does not touch it: it steps beside it — up, along the screen's
  // diagonal — and only then swings. (A placement block puts a building by its centre tile, so the Barracks covers
  // columns 11 to 13 of rows 7 and 8.)
  const corner = play(field({ A: [[10, 9, TROOPER]], B: [[12, 7, BARRACKS]] }), 24).events
  const moves = corner.filter((event) => event.kind === "entity.moved")
  const firstSwing = corner.find((event) => event.kind === "attack.launched")
  assert.deepEqual(
    moves.map((event) => (event.kind === "entity.moved" ? event.to : null)),
    [{ x: 10, y: 8 }],
  )
  assert.ok(firstSwing !== undefined && (moves[0]?.tick ?? Infinity) < firstSwing.tick, "it swung at a building it did not touch")
})

test("a range of 4 reaches four columns across and two rows up, never three; two across and one up is four", () => {
  assert.equal(FIXTURE_REGISTRY.get(FLAK).attack?.range, 4)
  assert.deepEqual([firesAt(FLAK, 4, 0), firesAt(FLAK, 5, 0), firesAt(FLAK, 0, -2), firesAt(FLAK, 0, -3)], [true, false, true, false])
  assert.deepEqual([firesAt(FLAK, 2, -1), firesAt(FLAK, 3, -1)], [true, false])
})

test("waiting never banks a sprint across: credit saved for a step down buys one step across, at a step across's pace", () => {
  // A trooper that stood long enough to save up for a step down, a row's worth of credit, then walks across.
  const saved = field({ A: [[5, 2, TROOPER]] }, { A: targetAt({ x: 27, y: 2 }) })
  const rich: MatchState = { ...saved, entities: saved.entities.map((entity) => ({ ...entity, moveCredit: 72 })) }
  const moved = play(rich, 40)
    .events.filter((event) => event.kind === "entity.moved")
    .map((event) => event.tick)
  assert.equal(moved[0], 1, "it did not step at once")
  assert.ok(gaps(moved).every((gap) => gap === 4), `it sprinted: steps on ticks ${moved.join(",")}`)
})

test("every battle on file keeps every unit's credit between none and its dearest step: no step is taken on credit it did not have", async () => {
  for (const name of scenarioFiles()) {
    const scenario = await loadScenarioFile(name)
    const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
    let state: MatchState = loaded.state
    const context = contextFor(state, loaded.registry, scenario.pulseTicks)
    while (state.outcome === null && state.tick < scenario.pulseTicks) {
      state = stepTick(state, context).state
      for (const entity of state.entities) {
        const rate = loaded.registry.get(entity.contentId).movementRate
        if (rate === undefined) continue
        const cap = stepCost(rate)
        assert.ok(entity.moveCredit >= 0 && entity.moveCredit <= cap, `${name}: ${entity.id} holds ${entity.moveCredit} of ${cap} at tick ${state.tick}`)
      }
    }
  }
})

// --- The rules round a battle --------------------------------------------------------------------------------------

/** A ridge of rock across an open field, a Grid Nexus of the player's south-west of it, and one trooper of the
 *  raid's coming from the north-east to it. */
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
    id: "rows-walk",
    name: "rows walk",
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

test("the forecast's way is the Pulse's own walk: down the screen's diagonal from the north-east, and round the ridge", () => {
  const { mission, grid } = ridgeWalk()
  const input: MissionPulseInput = {
    mission,
    grid,
    registry: FIXTURE_REGISTRY,
    pulse: 1,
    carried: null,
    structures: [{ contentId: "structure.citizen.nexus", anchor: { x: 5, y: 17 } }],
  }
  const [group] = foreseeIntents(input)
  assert.ok(group !== undefined && group.path.length > 0)
  // Where the raider actually stood, tick by tick, each new tile once.
  const run = resolveMissionPulse(input)
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
  // The Nexus's nearest tile is twenty-three columns across and sixteen rows down, thirty-two columns' worth: the
  // rows are further, and it heads down first.
  assert.deepEqual(group.path.slice(0, 2), [
    { x: 30, y: 2 },
    { x: 30, y: 3 },
  ])
})

test("Recall sends a survivor to the home nearest by the rule: a Nexus four columns beside it, not one three rows above", () => {
  // Two Grid Nexuses of the player's: one whose nearest tile is three rows above the trooper (six away), one whose
  // nearest is four columns beside it (four away). A placement block puts a building by its centre tile.
  const NEXUS = "structure.citizen.nexus"
  const home = recall(field({ A: [[20, 6, NEXUS], [25, 10, NEXUS], [20, 10, TROOPER]] }), FIXTURE_REGISTRY).moves[0]?.to
  assert.deepEqual(home, { x: 23, y: 10 }, "beside the Nexus four columns across")
})

test("the battle with the most rules in it resolves the same way on every run, and on Node and Bun alike", async () => {
  const scenario = await loadScenarioFile("citizens-versus-ravels.map.json")
  const resolve = (): readonly [string, string] => {
    const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
    const run = resolvePulse({ initialState: loaded.state, registry: loaded.registry, pulseTicks: scenario.pulseTicks, seed: scenario.seed })
    return [run.stateHash, run.eventsHash]
  }
  const first = resolve()
  assert.deepEqual(resolve(), first, "the Citizens against the Ravels resolved differently the second time")
  // Pinned: Node and Bun run this same line, so a runtime that counts a row differently fails here.
  assert.deepEqual(first, PINNED_BATTLE)
})

// The Citizens against the Ravels, blasts among its rules: its state and its events.
const PINNED_BATTLE = ["0b3e85ba31440f7c95a436d857f38d2e9531f6e99d31624d4261eec21a57f0a0", "61140abd763fc9551704973c84537ce9c32f69dc780f7353978d353eb52fe43f"] as const
