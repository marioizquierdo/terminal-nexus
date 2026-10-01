// The viewport and camera arithmetic of docs/system-design/grid.md, "Viewport, screen size and
// scrolling" — a RULE there, and for a long while never executed by anything, because the first
// fixtures deliberately used a Grid that fit the screen whole.
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
  clampToGrid,
  edgeMarkers,
  fitViewport,
  followCursor,
  isGated,
  tileWidthFor,
  visibleRange,
} from "../src/build/camera.ts"
import type { Camera, Viewport } from "../src/build/camera.ts"
import { starterGrid } from "../src/build/catalog.ts"
import type { GridTerrain, TerrainId } from "../src/grid/types.ts"

const GRID = starterGrid()
/** The first margin, three tiles each way: a fixture for the follow rule, which the game now
 *  feeds a share of the view (`marginForView`). */
const SCROLL_MARGIN = 3
const MARGIN = { x: SCROLL_MARGIN, y: SCROLL_MARGIN }

function plainGrid(width: number, height: number): GridTerrain {
  return { width, height, tiles: new Array<TerrainId>(width * height).fill("terrain.plain") }
}

test("the viewport's size: the minimum viewport fits 80x24 and the maximum is reached at 104x30", () => {
  // The two rows of the Grid page's own terminal-size table, at one column per tile. Since the menu's
  // divider became the Grid's west side (owner, 2026-09-29), the column that saves is the Grid's: 80
  // columns show one tile more than the minimum; and since the bottom bar became one line (owner,
  // 2026-09-30) the two rows that saves are the Grid's too: 18 rows at 24, and the
  // maximum's 24 rows two terminal rows sooner. 80 x 24 is still the floor (the gate test below).
  assert.deepEqual(fitViewport({ columns: 80, rows: 24 }, GRID, 1), {
    width: MIN_VIEWPORT.width + 1,
    height: MIN_VIEWPORT.height + 2,
  })
  assert.deepEqual(fitViewport({ columns: 104, rows: 30 }, GRID, 1), {
    width: MAX_VIEWPORT.width,
    height: MAX_VIEWPORT.height,
  })
  assert.equal(fitViewport({ columns: 104, rows: 29 }, GRID, 1).height, MAX_VIEWPORT.height - 1)
})

test("the viewport's size: a huge terminal is spent on centring, never on more Grid", () => {
  const huge = fitViewport({ columns: 400, rows: 120 }, GRID, 1)
  assert.deepEqual(huge, { width: MAX_VIEWPORT.width, height: MAX_VIEWPORT.height })
  // And the Grid really is bigger than that ceiling, or the claim would be vacuous.
  assert.ok(GRID.width > MAX_VIEWPORT.width && GRID.height > MAX_VIEWPORT.height)
})

test("the viewport's size: a Grid smaller than the viewport is never padded out to it", () => {
  const small = plainGrid(24, 12)
  assert.deepEqual(fitViewport({ columns: 200, rows: 60 }, small, 1), { width: 24, height: 12 })
})

test("tile width: one column per tile at 80, two at 128", () => {
  assert.equal(tileWidthFor({ columns: 80, rows: 24 }, GRID), 1)
  assert.equal(tileWidthFor({ columns: 127, rows: 24 }, GRID), 1)
  assert.equal(tileWidthFor({ columns: 128, rows: 24 }, GRID), 2)
  // 128 columns at two per tile is exactly the 48-tile minimum viewport — the arithmetic the Grid page
  // says is "not a coincidence".
  assert.deepEqual(fitViewport({ columns: 128, rows: 24 }, GRID, 2), { width: 48, height: 18 })
  assert.equal(availableTiles({ columns: 128, rows: 24 }, 2).width, MIN_VIEWPORT.width)
})

test("the resize gate: below 80x24 the screen gates; a small Grid is never gated on a terminal that fits it", () => {
  assert.equal(isGated({ columns: 80, rows: 24 }, GRID), false)
  assert.equal(isGated({ columns: 79, rows: 24 }, GRID), true)
  assert.equal(isGated({ columns: 80, rows: 23 }, GRID), true)
  // Measured against the floor's own 8 rows of chrome, not the 6 the frame takes since the bottom bar
  // became one line: 80 x 22 would lay out 16 rows of Grid, and is still below the floor.
  assert.equal(availableTiles({ columns: 80, rows: 22 }, 1).height, MIN_VIEWPORT.height)
  assert.equal(isGated({ columns: 80, rows: 22 }, GRID), true)
  // "A Grid smaller than the minimum viewport needs only its own size" — fitting step 4.
  const tutorial = plainGrid(24, 12)
  assert.equal(isGated({ columns: 60, rows: 22 }, tutorial), false)
})

test("camera scrolling: the cursor drives the camera, and only within the margin", () => {
  const viewport: Viewport = { width: 48, height: 16 }
  const still: Camera = { x: 10, y: 10 }
  // Comfortably inside the viewport: nothing moves. A camera that twitched on every cursor step
  // would be the "fighting the cursor" failure the owner's playtests are meant to catch.
  assert.deepEqual(followCursor(still, { x: 30, y: 18 }, viewport, GRID, MARGIN), still)

  // Exactly `SCROLL_MARGIN` from the east edge: still inside, still nothing.
  const atMargin = { x: still.x + viewport.width - 1 - SCROLL_MARGIN, y: 18 }
  assert.deepEqual(followCursor(still, atMargin, viewport, GRID, MARGIN), still)

  // One tile further and the camera follows by exactly one tile — not by a jump, not by centring.
  const past = { x: atMargin.x + 1, y: 18 }
  assert.deepEqual(followCursor(still, past, viewport, GRID, MARGIN), { x: still.x + 1, y: still.y })
})

test("camera scrolling: the margin holds at every cursor position the Grid can produce", () => {
  const viewport: Viewport = { width: 48, height: 16 }
  let camera: Camera = { x: 0, y: 0 }
  // Walk the cursor across the whole Grid one tile at a time, the way a player actually moves it,
  // and check the invariant after every single step rather than at a few hand-picked places.
  for (let y = 0; y < GRID.height; y += 1) {
    for (let x = 0; x < GRID.width; x += 1) {
      camera = followCursor(camera, { x, y }, viewport, GRID, MARGIN)
      // The viewport never leaves the Grid.
      assert.ok(camera.x >= 0 && camera.x <= GRID.width - viewport.width, `camera x at ${x},${y}`)
      assert.ok(camera.y >= 0 && camera.y <= GRID.height - viewport.height, `camera y at ${x},${y}`)
      // The cursor is always on screen.
      const range = visibleRange(camera, viewport)
      assert.ok(x >= range.firstX && x <= range.lastX, `cursor x visible at ${x},${y}`)
      assert.ok(y >= range.firstY && y <= range.lastY, `cursor y visible at ${x},${y}`)
      // And it keeps its 3-tile margin wherever the Grid has room for one. At the Grid's own edge
      // the camera has nowhere left to go, so the margin is a follow rule, not an invariant — the
      // exception is stated as "the camera is already as far as it can scroll", not as "sometimes".
      const westRoom = camera.x > 0
      const eastRoom = camera.x < GRID.width - viewport.width
      if (westRoom) assert.ok(x - range.firstX >= SCROLL_MARGIN, `west margin at ${x},${y}`)
      if (eastRoom) assert.ok(range.lastX - x >= SCROLL_MARGIN, `east margin at ${x},${y}`)
      const northRoom = camera.y > 0
      const southRoom = camera.y < GRID.height - viewport.height
      if (northRoom) assert.ok(y - range.firstY >= SCROLL_MARGIN, `north margin at ${x},${y}`)
      if (southRoom) assert.ok(range.lastY - y >= SCROLL_MARGIN, `south margin at ${x},${y}`)
    }
  }
})

test("camera scrolling: the margin holds at every viewport size in the clamped range", () => {
  // Every size in the range, not the three somebody picked: 25 widths by 9 heights, walked on both
  // axes and in both directions. The camera has to keep the cursor visible and hold its margin
  // wherever the Grid still has room to scroll, whatever shape the window is.
  const walk = (viewport: Viewport, axis: "x" | "y", fixed: number): void => {
    const span = axis === "x" ? viewport.width : viewport.height
    const length = axis === "x" ? GRID.width : GRID.height
    const room = length - span
    let camera: Camera = { x: 0, y: 0 }
    const step = (position: number): void => {
      const cursor = axis === "x" ? { x: position, y: fixed } : { x: fixed, y: position }
      camera = followCursor(camera, cursor, viewport, GRID, MARGIN)
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

test("the Grid's sides: edge markers name exactly the sides with more Grid beyond them", () => {
  const viewport: Viewport = { width: 48, height: 16 }
  assert.deepEqual(edgeMarkers({ x: 0, y: 0 }, viewport, GRID), {
    north: false,
    south: true,
    west: false,
    east: true,
  })
  const bottomRight = clampCamera({ x: 999, y: 999 }, viewport, GRID)
  assert.deepEqual(edgeMarkers(bottomRight, viewport, GRID), {
    north: true,
    south: false,
    west: true,
    east: false,
  })
  assert.deepEqual(edgeMarkers({ x: 10, y: 10 }, viewport, GRID), {
    north: true,
    south: true,
    west: true,
    east: true,
  })
})

test("the Grid's sides: a Grid that fits entirely inside the viewport shows none", () => {
  const small = plainGrid(24, 12)
  const viewport = fitViewport({ columns: 80, rows: 24 }, small, 1)
  assert.deepEqual(edgeMarkers({ x: 0, y: 0 }, viewport, small), {
    north: false,
    south: false,
    west: false,
    east: false,
  })
})

test("clampToGrid: the cursor can never leave the Grid, however far a jump overshoots", () => {
  assert.deepEqual(clampToGrid({ x: -5, y: -5 }, GRID), { x: 0, y: 0 })
  assert.deepEqual(clampToGrid({ x: 9999, y: 9999 }, GRID), {
    x: GRID.width - 1,
    y: GRID.height - 1,
  })
})
