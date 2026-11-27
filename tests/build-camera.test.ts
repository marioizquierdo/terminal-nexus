// The viewport and camera arithmetic of docs/system-design/battlefield.md, "Viewport, screen size and
// scrolling" — a RULE there, and for a long while never executed by anything, because the first
// fixtures deliberately used a battlefield that fit the screen whole.
//
// Each test is named for the rule it holds, in words (docs/system-design/testing.md, "How a test is
// named").

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  MAX_VIEWPORT,
  MIN_VIEWPORT,
  availableTiles,
  clampCamera,
  clampToMap,
  edgeMarkers,
  fitViewport,
  followCursor,
  isGated,
  lookAtMost,
  centreOn,
  visibleRange,
} from "../src/build/camera.ts"
import type { Camera, Viewport } from "../src/build/camera.ts"
import { starterTerrain } from "./starter-fixture.ts"
import type { MapTerrain, TerrainId } from "../src/engine/geometry/types.ts"

const STARTER_TERRAIN = starterTerrain()
/** The first margin, three tiles each way: a fixture for the follow rule, which the game now
 *  feeds a share of the view (`marginForView`). */
const SCROLL_MARGIN = 3
const MARGIN = { x: SCROLL_MARGIN, y: SCROLL_MARGIN }

function plainTerrain(width: number, height: number): MapTerrain {
  return { width, height, tiles: new Array<TerrainId>(width * height).fill("terrain.plain") }
}

test("the viewport's size: the minimum viewport fits 80x24 and the maximum is reached at 104x30", () => {
  // The two rows of the battlefield page's own terminal-size table. The panel's divider is the battlefield's west side,
  // so the column it shares is the battlefield's: 80 columns show one tile more than the minimum; and the bottom
  // bar is one line, so the two rows that saves are the battlefield's too: 18 rows at 24, and the maximum's 24
  // rows at 30. 80 x 24 is the floor (the gate test below).
  assert.deepEqual(fitViewport({ columns: 80, rows: 24 }, STARTER_TERRAIN), {
    width: MIN_VIEWPORT.width + 1,
    height: MIN_VIEWPORT.height + 2,
  })
  assert.deepEqual(fitViewport({ columns: 104, rows: 30 }, STARTER_TERRAIN), {
    width: MAX_VIEWPORT.width,
    height: MAX_VIEWPORT.height,
  })
  assert.equal(fitViewport({ columns: 104, rows: 29 }, STARTER_TERRAIN).height, MAX_VIEWPORT.height - 1)
})

test("the viewport's size: a huge terminal is spent on centring, never on more map", () => {
  const huge = fitViewport({ columns: 400, rows: 120 }, STARTER_TERRAIN)
  assert.deepEqual(huge, { width: MAX_VIEWPORT.width, height: MAX_VIEWPORT.height })
  // And the battlefield really is bigger than that ceiling, or the claim would be vacuous.
  assert.ok(STARTER_TERRAIN.width > MAX_VIEWPORT.width && STARTER_TERRAIN.height > MAX_VIEWPORT.height)
})

test("the viewport's size: a battlefield smaller than the viewport is never padded out to it", () => {
  const small = plainTerrain(24, 12)
  assert.deepEqual(fitViewport({ columns: 200, rows: 60 }, small), { width: 24, height: 12 })
})

test("a tile is one column at every terminal size: a column more is a tile more, up to the maximum viewport", () => {
  for (let columns = 80; columns <= 200; columns += 1) {
    // The border, the panel and its divider take 31 columns; every other column is a tile of the viewport.
    assert.equal(availableTiles({ columns, rows: 24 }).width, columns - 31, `${columns} columns`)
    assert.equal(fitViewport({ columns, rows: 24 }, STARTER_TERRAIN).width, Math.min(columns - 31, MAX_VIEWPORT.width), `${columns} columns`)
  }
  // 128 columns is no size of its own: 72 tiles, the widest view, as at 104.
  assert.deepEqual(fitViewport({ columns: 128, rows: 24 }, STARTER_TERRAIN), { width: MAX_VIEWPORT.width, height: 18 })
})

test("the resize gate: below 80x24 the screen gates; a small battlefield is never gated on a terminal that fits it", () => {
  assert.equal(isGated({ columns: 80, rows: 24 }, STARTER_TERRAIN), false)
  assert.equal(isGated({ columns: 79, rows: 24 }, STARTER_TERRAIN), true)
  assert.equal(isGated({ columns: 80, rows: 23 }, STARTER_TERRAIN), true)
  // Measured against the floor's own 8 rows of chrome, not the 6 the frame takes since the bottom bar
  // became one line: 80 x 22 would lay out 16 rows of battlefield, and is still below the floor.
  assert.equal(availableTiles({ columns: 80, rows: 22 }).height, MIN_VIEWPORT.height)
  assert.equal(isGated({ columns: 80, rows: 22 }, STARTER_TERRAIN), true)
  // "A battlefield smaller than the minimum viewport needs only its own size" — fitting step 4.
  const tutorial = plainTerrain(24, 12)
  assert.equal(isGated({ columns: 60, rows: 22 }, tutorial), false)
})

test("camera scrolling: the cursor drives the camera, and only within the margin", () => {
  const viewport: Viewport = { width: 48, height: 16 }
  const still: Camera = { x: 10, y: 10 }
  // Comfortably inside the viewport: nothing moves. A camera that twitched on every cursor step
  // would be the "fighting the cursor" failure the owner's playtests are meant to catch.
  assert.deepEqual(followCursor(still, { x: 30, y: 18 }, viewport, STARTER_TERRAIN, MARGIN), still)

  // Exactly `SCROLL_MARGIN` from the east edge: still inside, still nothing.
  const atMargin = { x: still.x + viewport.width - 1 - SCROLL_MARGIN, y: 18 }
  assert.deepEqual(followCursor(still, atMargin, viewport, STARTER_TERRAIN, MARGIN), still)

  // One tile further and the camera follows by exactly one tile — not by a jump, not by centring.
  const past = { x: atMargin.x + 1, y: 18 }
  assert.deepEqual(followCursor(still, past, viewport, STARTER_TERRAIN, MARGIN), { x: still.x + 1, y: still.y })
})

test("camera scrolling: the margin holds at every cursor position the battlefield can produce", () => {
  const viewport: Viewport = { width: 48, height: 16 }
  let camera: Camera = { x: 0, y: 0 }
  // Walk the cursor across the whole battlefield one tile at a time, the way a player actually moves it,
  // and check the invariant after every single step rather than at a few hand-picked places.
  for (let y = 0; y < STARTER_TERRAIN.height; y += 1) {
    for (let x = 0; x < STARTER_TERRAIN.width; x += 1) {
      camera = followCursor(camera, { x, y }, viewport, STARTER_TERRAIN, MARGIN)
      // The viewport never leaves the battlefield.
      assert.ok(camera.x >= 0 && camera.x <= STARTER_TERRAIN.width - viewport.width, `camera x at ${x},${y}`)
      assert.ok(camera.y >= 0 && camera.y <= STARTER_TERRAIN.height - viewport.height, `camera y at ${x},${y}`)
      // The cursor is always on screen.
      const range = visibleRange(camera, viewport)
      assert.ok(x >= range.firstX && x <= range.lastX, `cursor x visible at ${x},${y}`)
      assert.ok(y >= range.firstY && y <= range.lastY, `cursor y visible at ${x},${y}`)
      // And it keeps its 3-tile margin wherever the battlefield has room for one. At the battlefield's own edge
      // the camera has nowhere left to go, so the margin is a follow rule, not an invariant — the
      // exception is stated as "the camera is already as far as it can scroll", not as "sometimes".
      const westRoom = camera.x > 0
      const eastRoom = camera.x < STARTER_TERRAIN.width - viewport.width
      if (westRoom) assert.ok(x - range.firstX >= SCROLL_MARGIN, `west margin at ${x},${y}`)
      if (eastRoom) assert.ok(range.lastX - x >= SCROLL_MARGIN, `east margin at ${x},${y}`)
      const northRoom = camera.y > 0
      const southRoom = camera.y < STARTER_TERRAIN.height - viewport.height
      if (northRoom) assert.ok(y - range.firstY >= SCROLL_MARGIN, `north margin at ${x},${y}`)
      if (southRoom) assert.ok(range.lastY - y >= SCROLL_MARGIN, `south margin at ${x},${y}`)
    }
  }
})

test("camera scrolling: the margin holds at every viewport size in the clamped range", () => {
  // Every size in the range, not the three somebody picked: 25 widths by 9 heights, walked on both
  // axes and in both directions. The camera has to keep the cursor visible and hold its margin
  // wherever the battlefield still has room to scroll, whatever shape the window is.
  const walk = (viewport: Viewport, axis: "x" | "y", fixed: number): void => {
    const span = axis === "x" ? viewport.width : viewport.height
    const length = axis === "x" ? STARTER_TERRAIN.width : STARTER_TERRAIN.height
    const room = length - span
    let camera: Camera = { x: 0, y: 0 }
    const step = (position: number): void => {
      const cursor = axis === "x" ? { x: position, y: fixed } : { x: fixed, y: position }
      camera = followCursor(camera, cursor, viewport, STARTER_TERRAIN, MARGIN)
      const range = visibleRange(camera, viewport)
      const [first, last, at] =
        axis === "x"
          ? ([range.firstX, range.lastX, camera.x] as const)
          : ([range.firstY, range.lastY, camera.y] as const)
      const where = `${viewport.width}x${viewport.height} ${axis}=${position}`
      assert.ok(position >= first && position <= last, `cursor off screen at ${where}`)
      if (at > 0) assert.ok(position - first >= SCROLL_MARGIN, `leading margin at ${where}`)
      if (at < room) assert.ok(last - position >= SCROLL_MARGIN, `trailing margin at ${where}`)
    }
    for (let position = 0; position < length; position += 1) step(position)
    for (let position = length - 1; position >= 0; position -= 1) step(position)
  }

  for (let width = MIN_VIEWPORT.width; width <= MAX_VIEWPORT.width; width += 1) {
    for (let height = MIN_VIEWPORT.height; height <= MAX_VIEWPORT.height; height += 1) {
      const viewport: Viewport = { width, height }
      walk(viewport, "x", 5)
      walk(viewport, "y", 5)
    }
  }
})

test("the battlefield's sides: edge markers name exactly the sides with more map beyond them", () => {
  const viewport: Viewport = { width: 48, height: 16 }
  assert.deepEqual(edgeMarkers({ x: 0, y: 0 }, viewport, STARTER_TERRAIN), {
    north: false,
    south: true,
    west: false,
    east: true,
  })
  const bottomRight = clampCamera({ x: 999, y: 999 }, viewport, STARTER_TERRAIN)
  assert.deepEqual(edgeMarkers(bottomRight, viewport, STARTER_TERRAIN), {
    north: true,
    south: false,
    west: true,
    east: false,
  })
  assert.deepEqual(edgeMarkers({ x: 10, y: 10 }, viewport, STARTER_TERRAIN), {
    north: true,
    south: true,
    west: true,
    east: true,
  })
})

test("the battlefield's sides: a battlefield that fits entirely inside the viewport shows none", () => {
  const small = plainTerrain(24, 12)
  const viewport = fitViewport({ columns: 80, rows: 24 }, small)
  assert.deepEqual(edgeMarkers({ x: 0, y: 0 }, viewport, small), {
    north: false,
    south: false,
    west: false,
    east: false,
  })
})

test("clampToMap: the cursor can never leave the battlefield, however far a jump overshoots", () => {
  assert.deepEqual(clampToMap({ x: -5, y: -5 }, STARTER_TERRAIN), { x: 0, y: 0 })
  assert.deepEqual(clampToMap({ x: 9999, y: 9999 }, STARTER_TERRAIN), {
    x: STARTER_TERRAIN.width - 1,
    y: STARTER_TERRAIN.height - 1,
  })
})

test("lookAtMost: the view that shows the most of some tiles: all of them when they fit, else the most, the first on a tie", () => {
  const terrain = plainTerrain(72, 40)
  const view: Viewport = { width: 49, height: 18 }
  // How many of the tiles a look shows, counted two ways: by the visible range, and by each tile's place in the view.
  const shown = (tiles: readonly { x: number; y: number }[], look: { x: number; y: number }): number => {
    const range = visibleRange(centreOn(look, view, terrain), view)
    const byRange = tiles.filter((tile) => tile.x >= range.firstX && tile.x <= range.lastX && tile.y >= range.firstY && tile.y <= range.lastY).length
    const camera = centreOn(look, view, terrain)
    const byOffset = tiles.filter((tile) => tile.x - camera.x >= 0 && tile.x - camera.x < view.width && tile.y - camera.y >= 0 && tile.y - camera.y < view.height).length
    assert.equal(byRange, byOffset, "the two counts differ")
    return byRange
  }
  assert.equal(lookAtMost([], view, terrain), null, "a look at nothing")
  // A group that fits is all in view, however it sits: the middle of its box, a corner of the map included.
  const fits = [{ x: 57, y: 12 }, { x: 62, y: 17 }, { x: 61, y: 9 }]
  assert.equal(shown(fits, lookAtMost(fits, view, terrain)!), 3)
  const corner = [{ x: 71, y: 39 }, { x: 66, y: 35 }]
  assert.equal(shown(corner, lookAtMost(corner, view, terrain)!), 2)
  // A group wider than the view: the view with the most, never fewer than any single tile's view would show.
  const wide = [{ x: 3, y: 10 }, { x: 10, y: 10 }, { x: 14, y: 12 }, { x: 68, y: 10 }]
  const best = Math.max(...wide.map((tile) => shown(wide, tile)))
  assert.equal(shown(wide, lookAtMost(wide, view, terrain)!), best)
  assert.equal(best, 3)
  // A tie goes to the earlier tile: two lone tiles too far apart to share a view.
  const apart = [{ x: 60, y: 10 }, { x: 5, y: 10 }]
  assert.deepEqual(lookAtMost(apart, view, terrain), apart[0])
})
