// A row counts two columns: the one rule of distance on the Grid (grid.md). A terminal cell is about twice as tall
// as it is wide, so the rules count the ground the way the screen shows it: every distance, range and radius counts
// a row up or down as two columns (`ROW_DISTANCE`), a step up or down takes twice as long as a step across, and
// touching is a side shared. First the few functions every distance is worked out with (`src/grid/coords.ts`,
// `src/grid/reach.ts`), then what a battle and the rules round it do with them. What the screen draws by the same
// rule is tests/rows-view.test.ts's.

import { test } from "node:test"
import assert from "node:assert/strict"
import { ALL_SETTINGS } from "../src/build/all-settings.ts"
import { FIXTURE_REGISTRY, createRegistry } from "../src/content/index.ts"
import type { ContentDef, ContentRegistry } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import {
  DIRECTIONS,
  ROW_DISTANCE,
  columnsWithin,
  directionOf,
  footprintCentre,
  footprintDistance,
  footprintExtent,
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
  wholeRows,
} from "../src/grid/index.ts"
import type { Coord, Direction, Footprint, GridTerrain } from "../src/grid/index.ts"
import { foreseeIntents, recall, resolveMissionPulse } from "../src/match/index.ts"
import type { MissionPulseInput } from "../src/match/index.ts"
import type { MissionDefinition } from "../src/mission/index.ts"
import { validateMission } from "../src/mission/index.ts"
import { contextFor, resolvePulse, stepCost, stepTick } from "../src/pulse/index.ts"
import { fleeTrigger } from "../src/pulse/perception.ts"
import { engageRange, followsTarget } from "../src/pulse/target.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../src/scenario/index.ts"
import { hashState, parseState, serializeState } from "../src/state/serialize.ts"
import type { MatchState, PlayerId, TargetArea } from "../src/state/types.ts"
import { loadScenarioFile, scenarioFiles } from "./helpers.ts"

const ONE: Footprint = [{ x: 0, y: 0 }]
const ORIGIN: Coord = { x: 10, y: 10 }
const BARRACKS = "structure.citizen.barracks"
const TROOPER = "unit.citizen.trooper"
const RAIDER = "unit.ravel.raider"
const FLAK = "unit.bench.flaktrooper"
const HOG = "unit.bench.hogrider"
const RUNNER = "unit.ravel.runner"
const SPITTER = "unit.bench.spitter"
const NEXUS = "structure.citizen.nexus"

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
  // Worked out from the way the step goes, for every direction there is: a diagonal, which no mover takes, is a
  // column and a row, three.
  const everyWay: readonly Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"]
  for (const direction of everyWay) assert.equal(stepLength(direction), gridDistance(ORIGIN, step(ORIGIN, direction)), direction)
  assert.deepEqual(["ne", "se", "sw", "nw"].map((direction) => stepLength(direction as Direction)), [3, 3, 3, 3])
})

test("a reach the rules work out from content numbers is rounded up to whole rows: the least even reach at or above it", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map(wholeRows), [0, 2, 2, 4, 4, 6, 6, 8, 8])
  // A reach of 3 stops at one row up and down, a column short of a whole second row at each end; rounded to 4, it
  // covers both rows whole.
  assert.deepEqual([rowsWithin(3), rowsWithin(wholeRows(3))], [1, 2])
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

/** An open Grid, 50 by 30, with each side placed as given, each side's target where `targets` says, and rock on
 *  every tile `rocks` names; the content is `registry`'s. */
function field(
  sides: Readonly<Partial<Record<PlayerId, readonly Placed[]>>>,
  targets: Readonly<Partial<Record<PlayerId, TargetArea>>> = {},
  { rocks = [], registry = FIXTURE_REGISTRY }: Readonly<{ rocks?: readonly Coord[]; registry?: ContentRegistry }> = {},
): MatchState {
  const placements: Partial<Record<PlayerId, PlacementBlock>> = {}
  for (const side of ["A", "B"] as const) {
    const placed = sides[side]
    if (placed !== undefined) placements[side] = block(placed)
  }
  const rock = (x: number, y: number): boolean => rocks.some((tile) => tile.x === x && tile.y === y)
  const scenario: ScenarioDefinition = {
    id: "rows-field",
    name: "rows field",
    grid: { width: 50, height: 30 },
    seed: 1,
    pulseTicks: 400,
    terrain: Array.from({ length: 30 }, (_, y) => Array.from({ length: 50 }, (_, x) => (rock(x, y) ? "#" : ".")).join("")),
    terrainLegend: { ".": "terrain.plain", "#": "terrain.rock" },
    placements,
    ...(Object.keys(targets).length === 0 ? {} : { targets }),
  }
  return loadScenario(scenario, { registry }).state
}

/** A state resolved tick by tick for at most `ticks`, on `registry`'s content: every state after the first, and every
 *  event, in order. */
function play(state: MatchState, ticks: number, registry: ContentRegistry = FIXTURE_REGISTRY): Readonly<{ states: MatchState[]; events: DomainEvent[] }> {
  const context = contextFor(state, registry, ticks)
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
  // Each step says what it cost: a row twice a column, and the dearest step, a row's, is what credit is capped at. A
  // trooper's 10/3 earns ten a tick, and its beat is four ticks: forty for a step across, eighty for one down.
  const rate = FIXTURE_REGISTRY.get(TROOPER).movementRate
  assert.ok(rate !== undefined)
  const costs = (to: Coord): Set<number> =>
    new Set(play(field({ A: [[5, 2, TROOPER]] }, { A: targetAt(to) }), 120).events.flatMap((event) => (event.kind === "move.intended" ? [event.cost] : [])))
  assert.deepEqual([...costs({ x: 5, y: 13 })], [stepCost(rate, "s")])
  assert.deepEqual([...costs({ x: 27, y: 2 })], [stepCost(rate, "e")])
  assert.deepEqual([stepCost(rate, "s"), stepCost(rate, "e"), stepCost(rate)], [80, 40, 80])
})

/** Every content that walks, as a unit that heads for its side's target: a worker that flees and a healer follow
 *  none, so here they are told to advance, with their own rate, footprint and layer. */
const WALKERS: ContentRegistry = createRegistry(
  FIXTURE_REGISTRY.ids().map((id) => {
    const definition = FIXTURE_REGISTRY.get(id)
    return definition.movementRate === undefined || followsTarget(definition) ? definition : { ...definition, behavior: "advance" as const }
  }),
)

test("every unit that walks crosses twenty-four columns in exactly the time it walks twelve rows down: a step across takes its beat, a step down two", () => {
  // Alone on open ground, each walks to its side's target, once twenty-four columns straight across and once twelve
  // rows straight down: as far by the rule, and as far on screen. A placement block sets a unit down by its centre
  // tile; each target lies straight along the way from the footprint's edge.
  const beats = new Map<string, number>()
  for (const id of WALKERS.ids()) {
    const definition = WALKERS.get(id)
    const rate = definition.movementRate
    if (rate === undefined) continue
    const { width, height } = footprintExtent(definition.footprint)
    const centre = footprintCentre(definition.footprint)
    const anchor = { x: 5 - centre.x, y: 2 - centre.y }
    const steps = (to: Coord): number[] =>
      play(field({ A: [[5, 2, id]] }, { A: targetAt(to) }, { registry: WALKERS }), 400, WALKERS)
        .events.filter((event) => event.kind === "entity.moved")
        .map((event) => event.tick)
    const across = steps({ x: anchor.x + width - 1 + 24, y: anchor.y })
    const down = steps({ x: anchor.x, y: anchor.y + height - 1 + 12 })
    assert.deepEqual([across.length, down.length], [24, 12], `${id} did not walk straight there`)
    assert.equal(down.at(-1), across.at(-1), `${id}: twelve rows down in ${down.at(-1)} ticks, twenty-four columns across in ${across.at(-1)}`)
    // Its beat, the ticks a step across takes: a whole number, the credit for a step coming in whole ticks.
    const beat = across[0] as number
    assert.equal(beat, Math.ceil((12 * rate.denominator) / rate.numerator), `${id}'s beat`)
    assert.ok(gaps(across).every((gap) => gap === beat), `${id} across, every ${beat} ticks: ${across.join(",")}`)
    assert.ok([down[0], ...gaps(down)].every((gap) => gap === 2 * beat), `${id} down, every ${2 * beat} ticks: ${down.join(",")}`)
    beats.set(id, beat)
  }
  // A trooper steps across every four ticks, a raider every five, a colossus every fifteen.
  assert.deepEqual([TROOPER, RAIDER, "unit.citizen.colossus"].map((id) => beats.get(id)), [4, 5, 15])
})

test("two raiders, one nine rows above their target and one eighteen columns beside it, come a third of the way in on the same tick", () => {
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
  // The same tick: a raider's step down takes exactly two of the five-tick beats a step across takes, so three rows
  // down take as long as six columns across. Were a row one column, the one above would come in twice as fast.
  assert.equal(fromAbove, fromBeside, `a third of the way in on ticks ${fromAbove} and ${fromBeside}`)
  assert.equal(fromAbove, 30)
})

test("a worker runs from a trooper two rows straight above it as from one two columns across: its nerve is whole rows, 4 against melee", () => {
  const WORKER = "unit.citizen.worker"
  /** Whether a worker, alone with an enemy trooper `dx` columns across and `dy` rows down from it, runs on the first
   *  tick. */
  const flees = (dx: number, dy: number): boolean =>
    play(field({ A: [[20, 10, WORKER]], B: [[20 + dx, 10 + dy, TROOPER]] }), 1).events.some((event) => event.kind === "behavior.flee")
  assert.equal(fleeTrigger(FIXTURE_REGISTRY.get(TROOPER)), 4)
  // Two rows straight up or down is four away and one step from touching: it runs, as from two columns across.
  assert.deepEqual([flees(0, -2), flees(0, 2), flees(2, 0), flees(-2, 0)], [true, true, true, true])
  // Four columns across is as far on screen as two rows up; three rows up and five columns across are beyond it.
  assert.deepEqual([flees(4, 0), flees(0, -3), flees(5, 0)], [true, false, false])
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

test("a shot two rows up flies as long as one four columns across: its flight is the distance over its speed, rounded up", () => {
  /** The flight window of the shot `shooter` fires on the first tick at an enemy trooper `dx` across and `dy` down. */
  const flight = (shooter: string, dx: number, dy: number): number | undefined => {
    const shot = play(field({ A: [[10, 10, shooter]], B: [[10 + dx, 10 + dy, TROOPER]] }), 1).events.find(
      (event) => event.kind === "attack.launched" && event.attacker.startsWith("A:"),
    )
    return shot?.kind === "attack.launched" ? shot.flightWindowTicks : undefined
  }
  // A flak trooper's shell flies three columns a tick: four away, two rows up or four columns across, is two ticks.
  assert.equal(FIXTURE_REGISTRY.get(FLAK).attack?.projectileTilesPerTick, 3)
  assert.deepEqual([flight(FLAK, 0, -2), flight(FLAK, 0, 2), flight(FLAK, 4, 0), flight(FLAK, -4, 0)], [2, 2, 2, 2])
  // And one row up is as far as two columns across: one tick.
  assert.deepEqual([flight(FLAK, 0, -1), flight(FLAK, 2, 0)], [1, 1])
})

test("a contact trigger of 1 is touching: a spitter straight below or above a trooper goes off on the first tick, as beside it", () => {
  assert.equal(FIXTURE_REGISTRY.get(SPITTER).detonation?.triggerRange, 1)
  /** The tick a spitter goes off, alone with an enemy trooper `dx` columns across and `dy` rows down from it. */
  const goesOff = (dx: number, dy: number): number | undefined =>
    play(field({ A: [[10, 10, SPITTER]], B: [[10 + dx, 10 + dy, TROOPER]] }), 12).events.find((event) => event.kind === "entity.detonated")?.tick
  // The trooper straight above it is two away and touches it, as the one beside it does: it never needs to move.
  assert.deepEqual([goesOff(0, -1), goesOff(0, 1), goesOff(1, 0), goesOff(-1, 0)], [1, 1, 1, 1])
})

test("a blast of 1 catches what touches it, straight above as beside, and nothing two columns off", () => {
  // A raid runner, its munitions volatile, down to its last point of health between three troopers: one beside it,
  // who kills it on the first tick, one straight above it, and one two columns off on its other side.
  assert.equal(FIXTURE_REGISTRY.get(RUNNER).detonation?.radius, 1)
  const start = field({ A: [[9, 10, TROOPER], [10, 9, TROOPER], [12, 10, TROOPER]], B: [[10, 10, RUNNER]] })
  const state: MatchState = { ...start, entities: start.entities.map((entity) => (entity.contentId === RUNNER ? { ...entity, hp: 1 } : entity)) }
  const blast = play(state, 1).events.find((event) => event.kind === "entity.detonated")
  assert.ok(blast?.kind === "entity.detonated" && blast.tick === 1, "the runner did not go off on the first tick")
  const at = (id: string): string => {
    const entity = state.entities.find((each) => each.id === id)
    return entity === undefined ? id : `${entity.anchor.x},${entity.anchor.y}`
  }
  assert.deepEqual(blast.caught.map(at).sort(), ["10,9", "9,10"], "the blast is not exactly what touches the runner")
})

test("waiting never banks a sprint across: credit saved for a step down buys one step across, at a step across's pace", () => {
  // A trooper that stood long enough to save up for a step down, a row's worth of credit, then walks across.
  const rate = FIXTURE_REGISTRY.get(TROOPER).movementRate
  assert.ok(rate !== undefined)
  const saved = field({ A: [[5, 2, TROOPER]] }, { A: targetAt({ x: 27, y: 2 }) })
  const rich: MatchState = { ...saved, entities: saved.entities.map((entity) => ({ ...entity, moveCredit: stepCost(rate, "s") })) }
  const moved = play(rich, 40)
    .events.filter((event) => event.kind === "entity.moved")
    .map((event) => event.tick)
  assert.equal(moved[0], 1, "it did not step at once")
  assert.ok(gaps(moved).every((gap) => gap === 4), `it sprinted: steps on ticks ${moved.join(",")}`)
})

test("losing a claim on a step down banks no sprint: the step across taken instead spends the credit saved, and the next waits a whole beat", () => {
  // A trooper wants the step down to 20,11, toward the raid's Nexus; a hogrider, quicker to claim, takes that tile on
  // the same tick, and the trooper steps aside to 19,10. Rock at 19,11 leaves it only steps across from there. (A
  // placement block puts a building by its centre tile, so the Nexus covers columns 15 to 17 of rows 12 and 13.)
  const rate = FIXTURE_REGISTRY.get(TROOPER).movementRate
  const hogRate = FIXTURE_REGISTRY.get(HOG).movementRate
  assert.ok(rate !== undefined && hogRate !== undefined)
  const beat = stepCost(rate, "e") / rate.numerator
  const rocks = [{ x: 19, y: 11 }]
  // Saved by standing: the trooper holds a step down's credit, and the hogrider stands one step from the tile.
  const near = field({ A: [[20, 10, TROOPER], [21, 11, HOG]], B: [[16, 12, NEXUS]] }, {}, { rocks })
  const credit = (contentId: string): number => (contentId === TROOPER ? stepCost(rate, "s") : contentId === HOG ? stepCost(hogRate, "e") : 0)
  const saved: MatchState = { ...near, entities: near.entities.map((entity) => ({ ...entity, moveCredit: credit(entity.contentId) })) }
  // Saved on its own: the trooper waits two beats for its step down, and the hogrider walks in along the row and
  // takes the tile on that very tick.
  const waited = field({ A: [[20, 10, TROOPER], [24, 11, HOG]], B: [[16, 12, NEXUS]] }, {}, { rocks })
  for (const [how, state, lostOn] of [["saved by standing", saved, 1], ["saved on its own", waited, 2 * beat]] as const) {
    const { events } = play(state, 24)
    const trooper = state.entities.find((entity) => entity.contentId === TROOPER)?.id
    const lost = events.flatMap((event) => (event.kind === "move.contested" && event.losers.includes(trooper ?? "") ? [event.tick] : []))
    assert.deepEqual(lost, [lostOn], `${how}: the trooper did not lose its step down once`)
    const steps = events.flatMap((event) => (event.kind === "entity.moved" && event.entity === trooper ? [[event.tick, event.facing]] : []))
    assert.deepEqual(steps.slice(0, 2), [[lostOn, "w"], [lostOn + beat, "w"]], `${how}: it sprinted, ${JSON.stringify(steps)}`)
  }
})

test("a state measures the Grid by the one rule and carries no measure: one that does is refused, not carried along", () => {
  const state = field({ A: [[5, 5, TROOPER]], B: [[30, 20, TROOPER]] })
  const text = serializeState(state)
  assert.equal(hashState(parseState(text)), hashState(state))
  const measured = JSON.stringify({ ...(JSON.parse(text) as Record<string, unknown>), measure: { row: 2, tile: 1 } })
  assert.throws(() => parseState(measured), /^Error: state carries a measure, but every state measures the Grid by the one rule/)
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

test("the forecast's way ends touching what it goes for, straight above or below it, never on it", () => {
  // An open field, the player's Grid Nexus far to the south-west, a trooper of the player's out on it, and one trooper
  // of the raid's straight above or below it: the raid's goes for the nearer, the player's trooper. Units never block
  // a forecast's way, so a way that ran on to the target's own tile would stand on it.
  const grid: GridTerrain = { width: 40, height: 24, tiles: Array.from({ length: 40 * 24 }, () => "terrain.plain" as const) }
  const endOfWay = (raidAt: Coord, postAt: Coord): Coord | undefined => {
    const mission: MissionDefinition = {
      id: "rows-touch",
      name: "rows touch",
      pulses: 1,
      pulseTicks: 360,
      seed: 7,
      regions: [
        { id: "raid", x: raidAt.x, y: raidAt.y, width: 1, height: 1 },
        { id: "post", x: postAt.x, y: postAt.y, width: 1, height: 1 },
      ],
      triggers: [
        { id: "squad", when: { pulse: 1, tick: 0 }, do: [{ spawn: { side: "A", units: [{ unit: TROOPER, count: 1 }], at: "post" } }] },
        { id: "raid", when: { pulse: 1, tick: 0 }, do: [{ spawn: { side: "B", units: [{ unit: TROOPER, count: 1 }], at: "raid", group: "walker" } }] },
        { id: "end", when: { event: "pulse.end", pulse: 1 }, do: [{ win: true }] },
      ],
    }
    validateMission(mission, grid, FIXTURE_REGISTRY)
    const input: MissionPulseInput = { mission, grid, registry: FIXTURE_REGISTRY, pulse: 1, carried: null, structures: [{ contentId: NEXUS, anchor: { x: 5, y: 17 } }] }
    const [group] = foreseeIntents(input)
    assert.equal(group?.target?.contentId, TROOPER, "the raid's trooper does not go for the player's")
    assert.deepEqual(group?.target?.anchor, postAt)
    return group?.path.at(-1)
  }
  // From the north, the way ends on the tile straight above the player's trooper; from the south, straight below.
  assert.deepEqual(endOfWay({ x: 20, y: 2 }, { x: 20, y: 12 }), { x: 20, y: 11 })
  assert.deepEqual(endOfWay({ x: 20, y: 22 }, { x: 20, y: 12 }), { x: 20, y: 13 })
})

test("Recall sends a survivor to the home nearest by the rule: a Nexus four columns beside it, not one three rows above", () => {
  // Two Grid Nexuses of the player's: one whose nearest tile is three rows above the trooper (six away), one whose
  // nearest is four columns beside it (four away). A placement block puts a building by its centre tile.
  const home = recall(field({ A: [[20, 6, NEXUS], [25, 10, NEXUS], [20, 10, TROOPER]] }), FIXTURE_REGISTRY).moves[0]?.to
  assert.deepEqual(home, { x: 23, y: 10 }, "beside the Nexus four columns across")
})

test("Recall sets a survivor down on the side of its home it came from: below the Nexus when it stood below it", () => {
  // A placement block puts a building by its centre tile, so the Nexus covers columns 19 to 21 of rows 10 and 11. Its
  // tile nearest a trooper below it is 20,11, and the free tiles nearest that, two away, are 18,11 and 22,11 beside
  // the Nexus and 20,12 below it: the one on the trooper's own side. From above, it is 20,9.
  const homeFrom = (at: Coord): Coord | undefined => recall(field({ A: [[20, 10, NEXUS], [at.x, at.y, TROOPER]] }), FIXTURE_REGISTRY).moves[0]?.to
  assert.deepEqual(homeFrom({ x: 20, y: 16 }), { x: 20, y: 12 }, "it came home beside the Nexus, not below it")
  assert.deepEqual(homeFrom({ x: 20, y: 4 }), { x: 20, y: 9 })
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
const PINNED_BATTLE = ["030e40b3ca69c383c53e3f4455db901360e0bbbaa39cc09c0a2bfb829d863181", "9349bec06ff8fcbdec9cca65d68ccf434259599c47730a44b28bf4477dba6cfe"] as const

test("every reach the content and the Experiments offer is a whole number of rows, 1, which is touching, or even, and so is every reach the rules work out from them", () => {
  // A reach of R covers R / 2 rows up and down, rounded down, so an odd reach above 1 buys a column at each end of
  // its rows and no row: the grid design's "whole rows". Content keeps to even reaches; 1 means touching.
  const whole = (reach: number): boolean => reach === 1 || reach % 2 === 0
  const odd: string[] = []
  for (const id of FIXTURE_REGISTRY.ids()) {
    const definition = FIXTURE_REGISTRY.get(id)
    const reaches: Record<string, number | undefined> = {
      "attack range": definition.attack?.range,
      "splash radius": definition.attack?.splash?.radius,
      "detonation radius": definition.detonation?.radius,
      "detonation trigger": definition.detonation?.triggerRange,
      "aura radius": definition.aura?.radius,
      "construction radius": definition.constructionRadius,
      clearance: definition.clearance,
      // Worked out from those: the reach a unit heading for its side's target turns to fight within, and how near
      // an attacker may come before a worker runs from it.
      "engage reach": followsTarget(definition) ? engageRange(definition) : undefined,
      "flight trigger": definition.attack === undefined ? undefined : fleeTrigger(definition),
    }
    for (const [what, reach] of Object.entries(reaches)) if (reach !== undefined && !whole(reach)) odd.push(`${id} ${what} ${reach}`)
    // Melee is touching, counted in steps, not in the Grid's distance: a melee range is 1, or it would reach a row
    // and a corner its card's words do not say.
    if (definition.attack?.kind === "melee" && definition.attack.range !== 1) odd.push(`${id} melee range ${definition.attack.range}`)
  }
  for (const name of ["buildRange", "spawnClearance"] as const) {
    for (const value of ALL_SETTINGS[name].values) if (!whole(value)) odd.push(`the ${name} Experiment offers ${value}`)
  }
  assert.deepEqual(odd, [])
  // Whatever the content says: an attack that reached 7 would turn its unit at 8, and send a worker running at 10.
  const seven: ContentDef = { ...FIXTURE_REGISTRY.get(TROOPER), attack: { kind: "ranged", range: 7, damage: 1, cooldownTicks: 12 } }
  assert.deepEqual([engageRange(seven), fleeTrigger(seven)], [8, 10])
})
