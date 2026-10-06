// How the rules measure the Grid — `GridMeasure` (src/grid/types.ts), the Ground Experiment's rules half. Under
// `SQUARE` every helper is the Manhattan it always was; with a row counting two, distance, "within" and "which
// way" follow the screen, and touching stays touching.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  SQUARE,
  directionOf,
  footprintDistance,
  footprintSteps,
  footprintWithin,
  gridDistance,
  gridSteps,
  nearestFootprintTile,
  reachOf,
} from "../src/grid/index.ts"
import type { Coord, Footprint, GridMeasure } from "../src/grid/index.ts"
import { GROUNDS, measureOf, tileWidthOf } from "../src/build/ground.ts"

const ONE: Footprint = [{ x: 0, y: 0 }]
const ROWS_DOUBLE: GridMeasure = { row: 2, tile: 1 }
const SIDEWAYS_DOUBLE: GridMeasure = { row: 2, tile: 2 }
const ORIGIN: Coord = { x: 10, y: 10 }

/** Every offset within `span` of the origin, in reading order. */
function around(span: number): Coord[] {
  const tiles: Coord[] = []
  for (let y = ORIGIN.y - span; y <= ORIGIN.y + span; y += 1) for (let x = ORIGIN.x - span; x <= ORIGIN.x + span; x += 1) tiles.push({ x, y })
  return tiles
}

test("under the square measure every helper is the Manhattan it always was", () => {
  for (const tile of around(5)) {
    const manhattan = Math.abs(tile.x - ORIGIN.x) + Math.abs(tile.y - ORIGIN.y)
    assert.equal(gridDistance(ORIGIN, tile), manhattan)
    assert.equal(gridDistance(ORIGIN, tile, SQUARE), manhattan)
    assert.equal(gridSteps(ORIGIN, tile), manhattan)
    for (const radius of [0, 1, 2, 3]) assert.equal(footprintWithin(ORIGIN, ONE, tile, ONE, radius), manhattan <= radius)
  }
  assert.equal(reachOf(6), 6)
  // A multi-tile footprint measures to its nearest tile, as range always has.
  const barracks: Footprint = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ]
  assert.equal(footprintDistance({ x: 0, y: 0 }, barracks, { x: 4, y: 3 }, ONE), 2 + 2)
  assert.equal(footprintSteps({ x: 0, y: 0 }, barracks, { x: 4, y: 3 }, ONE), 4)
})

test("rows counting double: a row counts two columns, and touching is still within a radius of one", () => {
  assert.equal(gridDistance(ORIGIN, { x: 14, y: 10 }, ROWS_DOUBLE), 4)
  assert.equal(gridDistance(ORIGIN, { x: 10, y: 12 }, ROWS_DOUBLE), 4)
  assert.equal(gridDistance(ORIGIN, { x: 13, y: 11 }, ROWS_DOUBLE), 5)
  // A range of 4 reaches four columns across and two rows up: nine wide, five tall.
  const inside = around(5).filter((tile) => footprintWithin(ORIGIN, ONE, tile, ONE, 4, ROWS_DOUBLE))
  const xs = inside.map((tile) => tile.x)
  const ys = inside.map((tile) => tile.y)
  assert.equal(Math.max(...xs) - Math.min(...xs) + 1, 9)
  assert.equal(Math.max(...ys) - Math.min(...ys) + 1, 5)
  // The tile above is two away, and still within a radius of one: it touches.
  assert.equal(gridDistance(ORIGIN, { x: 10, y: 9 }, ROWS_DOUBLE), 2)
  assert.ok(footprintWithin(ORIGIN, ONE, { x: 10, y: 9 }, ONE, 1, ROWS_DOUBLE))
  assert.ok(!footprintWithin(ORIGIN, ONE, { x: 11, y: 9 }, ONE, 1, ROWS_DOUBLE), "a diagonal neighbour does not touch")
  assert.ok(!footprintWithin(ORIGIN, ONE, { x: 10, y: 9 }, ONE, 0, ROWS_DOUBLE), "nothing is within a radius of none")
  // Steps never weigh a row: touching is one step either way.
  assert.equal(gridSteps(ORIGIN, { x: 10, y: 9 }), 1)
})

test("sideways doubled: every content number doubles in the same count, so up and down keep their reach", () => {
  assert.equal(reachOf(3, SIDEWAYS_DOUBLE), 6)
  const inside = around(8).filter((tile) => footprintWithin(ORIGIN, ONE, tile, ONE, 3, SIDEWAYS_DOUBLE))
  const xs = inside.map((tile) => tile.x)
  const ys = inside.map((tile) => tile.y)
  // A range of 3 reaches three rows up and six columns across: thirteen wide, seven tall.
  assert.equal(Math.max(...xs) - Math.min(...xs) + 1, 13)
  assert.equal(Math.max(...ys) - Math.min(...ys) + 1, 7)
})

test("which way a mover heads follows the measure: with a row counting two, along the screen's diagonal", () => {
  // Four across and two down: Manhattan says across (4 > 2); counted as the screen does it is a tie, and a tie
  // prefers across.
  assert.equal(directionOf(ORIGIN, { x: 14, y: 12 }), "e")
  assert.equal(directionOf(ORIGIN, { x: 14, y: 12 }, "s", ROWS_DOUBLE), "e")
  // Three across and two down: Manhattan says across; with rows counting double the rows are further.
  assert.equal(directionOf(ORIGIN, { x: 13, y: 12 }), "e")
  assert.equal(directionOf(ORIGIN, { x: 13, y: 12 }, "s", ROWS_DOUBLE), "s")
  // The nearest tile of a footprint is nearest as the measure counts it.
  const wall: Footprint = [
    { x: 0, y: 0 },
    { x: 4, y: 3 },
  ]
  // From four across: the far corner is three rows down (3) against four columns back (4), but six as the
  // screen counts it.
  assert.deepEqual(nearestFootprintTile({ x: 4, y: 0 }, { x: 0, y: 0 }, wall), { x: 4, y: 3 })
  assert.deepEqual(nearestFootprintTile({ x: 4, y: 0 }, { x: 0, y: 0 }, wall, ROWS_DOUBLE), { x: 0, y: 0 })
})

test("the Ground Experiment's choices: what each measures by, and how wide each draws a tile", () => {
  assert.deepEqual([...GROUNDS], ["as-now", "rows-x2", "sideways-x2", "square-tiles"])
  assert.deepEqual(measureOf("as-now"), SQUARE)
  assert.deepEqual(measureOf("square-tiles"), SQUARE)
  assert.deepEqual(measureOf("rows-x2"), ROWS_DOUBLE)
  assert.deepEqual(measureOf("sideways-x2"), SIDEWAYS_DOUBLE)
  assert.equal(tileWidthOf("as-now"), null)
  assert.equal(tileWidthOf("square-tiles"), 2)
  assert.equal(tileWidthOf("rows-x2"), 1)
  assert.equal(tileWidthOf("sideways-x2"), 1)
})
