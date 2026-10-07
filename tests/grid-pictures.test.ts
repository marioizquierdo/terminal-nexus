// The grid design's pictures and arithmetic are the game's own (docs/system-design/grid.md, "Distance, reach and
// movement"). Every picture there sits under a `<!-- grid-picture: name -->` marker and must be exactly what
// scripts/grid-pictures.ts draws from the rules' code; the counts the text states are checked here directly.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { GRID_DESIGN, gridPictures, redraw } from "../scripts/grid-pictures.ts"
import { gridDistance, ringOffsets, rowsWithin, tilesWithin } from "../src/grid/index.ts"
import type { Footprint } from "../src/grid/index.ts"

const ONE: Footprint = [{ x: 0, y: 0 }]
const ORIGIN = { x: 0, y: 0 }

test("every picture in the grid design is the one the rules' own code draws, and every one is shown", () => {
  const { drifted, missing, unknown } = redraw(readFileSync(GRID_DESIGN, "utf8"), gridPictures())
  assert.deepEqual(unknown, [], "a marker names no picture")
  assert.deepEqual(missing, [], "a picture the document does not show")
  assert.deepEqual(drifted, [], "the document's picture is not what the code draws: node scripts/grid-pictures.ts --write")
})

test("the ring at distance r holds exactly 2r tiles, so a reach of R holds R² + R + 1, and a reach of 1 the five touching", () => {
  for (let r = 1; r <= 24; r += 1) {
    const ring = ringOffsets(r)
    assert.equal(ring.length, 2 * r, `the ring at ${r}`)
    assert.ok(ring.every((tile) => gridDistance(ORIGIN, tile) === r), `a tile of the ring at ${r} is not ${r} away`)
  }
  assert.equal(tilesWithin(ORIGIN, ONE, 1).length, 5)
  for (let reach = 2; reach <= 24; reach += 1) {
    assert.equal(tilesWithin(ORIGIN, ONE, reach).length, reach * reach + reach + 1, `a reach of ${reach}`)
  }
})

test("a reach of R covers R columns either side and R / 2 rows up and down, rounded down: as tall on screen as it is wide", () => {
  for (let reach = 1; reach <= 24; reach += 1) {
    const tiles = tilesWithin(ORIGIN, ONE, reach)
    const across = Math.max(...tiles.map((tile) => Math.abs(tile.x)))
    const up = Math.max(...tiles.filter((tile) => tile.x === 0).map((tile) => Math.abs(tile.y)))
    assert.equal(across, reach, `a reach of ${reach} across`)
    // A reach of 1 is touching: it covers the tile straight above, which no other row of a reach of 1 does.
    assert.equal(up, reach === 1 ? 1 : rowsWithin(reach), `a reach of ${reach} up and down`)
    assert.equal(rowsWithin(reach), Math.floor(reach / 2))
  }
})
