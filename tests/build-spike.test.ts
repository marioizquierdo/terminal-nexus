// Gate 5A's sharp edge: the same Build Phase plan, entered by raw keystrokes, by raw mouse bytes,
// and from a command script, must be the same plan and the same screen. engine.md 9.7 is a RULE
// that "a command's effect never depends on which adapter produced it", and the only way to prove
// that is to start each path from bytes a terminal actually sends — never from a hand-built command,
// which would assert that the thing downstream of the mapping works while leaving the mapping, the
// part most likely to drift, untested.

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_ALLOTMENT, SPIKE_CATALOG, SPIKE_NEXUS_DRAFT, spikeGrid } from "../src/build/catalog.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { GridTerrain, TerrainId } from "../src/grid/types.ts"
import { buildLayout, cellForTile, constructLines } from "../src/build/layout.ts"
import { DEFAULT_JUMP_STEP, buildKeyboardCommand } from "../src/build/keyboard.ts"
import {
  MOUSE_LEFT,
  MOUSE_RIGHT,
  MOUSE_WHEEL_DOWN,
  MOUSE_WHEEL_UP,
  formatMouseEvent,
  parseMouseEvent,
} from "../src/build/mouse.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildSessionOptions } from "../src/build/session.ts"
import { JUMP_TILES, anchorForCursor, armedPreview, legalityAt, remaining, spent } from "../src/build/state.ts"
import { bottomLine } from "../src/build/help.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { frameToText } from "../src/view/frame.ts"
import { fitViewport } from "../src/build/camera.ts"

/**
 * Every test here is about placement, scrolling, or the adapters — not about the Nexus draft gate
 * 5D adds in front of all of it. Rather than repeat "pick a placeholder power" at every call site,
 * every `BuildSession` in this file starts past that gate already, on the first option, the same
 * way a real player would be past it within one keypress. The handful of tests that check the
 * drafting gate itself construct a session with `new BuildSession` directly instead.
 */
/** A picked power that adds nothing to the budget, so every test that is not about the Nexus
 *  draft itself sees exactly the allotment its own numbers already assume. */
const NEUTRAL_NEXUS_DRAFT = [
  { hotkey: "1", name: "Test Pick", description: "No effect.", bonusAllotment: 0 },
] as const

function readyBuildSession(options: BuildSessionOptions): BuildSession {
  const build = new BuildSession(options)
  build.dispatch({ kind: "pick-nexus", index: 0 })
  // Keyboard focus starts on the menu since gate 5F; every test here that presses an arrow means the
  // Grid's cursor, the way every one of them was written before focus existed. The focus model's own
  // tests are in `tests/build-focus.test.ts`.
  build.dispatch({ kind: "focus", target: "grid" })
  return build
}

const ESC = String.fromCharCode(27)
const UP = `${ESC}[A`
const DOWN = `${ESC}[B`
const RIGHT = `${ESC}[C`
const LEFT = `${ESC}[D`
const SHIFT_RIGHT = `${ESC}[1;2C`
const RXVT_SHIFT_RIGHT = `${ESC}[c`
const PAGE_DOWN = `${ESC}[6~`
const ENTER = "\r"

const MINIMUM = { columns: 80, rows: 24 }
const MAXIMUM = { columns: 104, rows: 32 }

function session(
  terminal = MINIMUM,
): { build: BuildSession; layout: ReturnType<typeof buildLayout>; context: ReturnType<typeof spikeContext> } {
  const context = { ...spikeContext(), nexusDraft: NEUTRAL_NEXUS_DRAFT }
  const layout = buildLayout(terminal, context.grid)
  const build = readyBuildSession({
    context,
    cursor: { x: 18, y: 13 },
    viewport: layout.viewport,
  })
  return { build, layout, context }
}

/** A cursor move to `tile`, from wherever the cursor is now — arming may have moved it (feedback F30),
 *  so a test that means a tile says the tile rather than a distance from a spot it cannot predict. */
function moveTo(build: BuildSession, tile: { x: number; y: number }): void {
  build.dispatch({ kind: "move-cursor", dx: tile.x - build.state.cursor.x, dy: tile.y - build.state.cursor.y })
}

/** The frame as text, which is what "the same screen" means for an assertion. */
function screen(
  build: BuildSession,
  layout: ReturnType<typeof buildLayout>,
  context: ReturnType<typeof spikeContext>,
): string {
  return frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))
}

/** The raw bytes a left click on this Grid tile sends, derived from the composer's own geometry —
 *  1-based, like a terminal's own coordinates. A hand-picked number here could quietly stop matching
 *  the screen; this cannot. */
function clickTileBytes(
  layout: ReturnType<typeof buildLayout>,
  build: BuildSession,
  tile: { x: number; y: number },
): string {
  const cell = cellForTile(layout, build.state.camera, tile)
  return formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1)
}

/** Likewise for a construct row, from `constructLines` — the same function the panel draws with,
 *  which is what makes a click that lands on a row nobody drew impossible to mistake for a click on
 *  an item. */
function clickRowBytes(layout: ReturnType<typeof buildLayout>, index: number): string {
  const line = constructLines(layout, SPIKE_CATALOG).find((candidate) => candidate.index === index)
  assert.ok(line !== undefined, `no construct row is drawn for item ${index}`)
  const item = SPIKE_CATALOG[index]!
  // Anywhere inside the row's own drawn text; the middle proves the whole row is live, not just its
  // first cell.
  const column = layout.panelColumn + Math.floor(`[${item.hotkey}] ${item.label}`.length / 2)
  return formatMouseEvent(MOUSE_LEFT, column + 1, line.row + 1)
}

test("the same plan by hotkeys, by clicks, and from a script is the same plan and the same screen", () => {
  // Two barracks, side by side, at tiles that are on screen from the start: 1 arms it where the cursor
  // is, the cursor walks to 30,14, Enter places (and leaves the keyboard on the map, where the arming
  // began); 1 arms it again, which moves the cursor off the new one to the nearest spot with a free
  // tile around it — a free column to its right, 34,14 (feedback F30) — and one more Enter places the
  // second there.
  // An armed click scrolls the view near its edges (F22) and an arrow does not, so with that on the
  // same plan has a different camera by mouse; the parity asserted here is the plan and the screen,
  // so the Experiment is switched to a still view for all three players alike.
  const stillClicks: BuildCommand = { kind: "debug-adjust", field: "armedClickScrolls", step: 1 }
  const byKeyboard = session()
  byKeyboard.build.dispatch(stillClicks)
  byKeyboard.build.handleData("1", byKeyboard.layout)
  for (let step = 0; step < 12; step += 1) byKeyboard.build.handleData(RIGHT, byKeyboard.layout)
  byKeyboard.build.handleData(DOWN, byKeyboard.layout)
  byKeyboard.build.handleData(ENTER, byKeyboard.layout)
  byKeyboard.build.handleData("1", byKeyboard.layout)
  assert.deepEqual(byKeyboard.build.state.cursor, { x: 34, y: 14 })
  byKeyboard.build.handleData(ENTER, byKeyboard.layout)

  const byMouse = session()
  byMouse.build.dispatch(stillClicks)
  // Digits are the path both players share, so both armings began on the map and both placements
  // leave the keyboard there (a click on a row is the menu's, and goes back to it — the focus tests
  // hold that); the rest is clicks.
  byMouse.build.handleData("1", byMouse.layout)
  // A click only arms the preview at a tile; a second click on that same tile is what places it
  // (Q52) — so each of the two placements below is two clicks, not one. Recomputed fresh each time
  // (not the same bytes reused) because the camera itself can move between clicks: the second click's
  // bytes must name the same *tile* the first one did, which is what a real second click landing on
  // the same on-screen row would also do once the display has caught up.
  const clickTile = (tile: { x: number; y: number }): void => {
    byMouse.build.handleData(clickTileBytes(byMouse.layout, byMouse.build, tile), byMouse.layout)
  }
  clickTile({ x: 30, y: 14 })
  clickTile({ x: 30, y: 14 })
  byMouse.build.handleData("1", byMouse.layout)
  // Arming already put the cursor on 34,14, so one click there is the confirming second click.
  clickTile({ x: 34, y: 14 })
  assert.equal(byMouse.build.state.focus, "grid", "a placement armed on the map left the map")

  const script: readonly BuildCommand[] = [
    { kind: "arm", index: 0 },
    { kind: "move-cursor", dx: 12, dy: 1 },
    { kind: "place" },
    { kind: "arm", index: 0 },
    { kind: "place" },
  ]
  const byDriver = session()
  byDriver.build.run([stillClicks, ...script])

  assert.equal(byKeyboard.build.state.planned.length, 2, "two structures were actually planned")
  assert.deepEqual(byMouse.build.state.planned, byKeyboard.build.state.planned)
  assert.deepEqual(byDriver.build.state.planned, byKeyboard.build.state.planned)
  // Not just the plan: the whole state, camera and cursor and message included.
  assert.deepEqual(byMouse.build.state, byKeyboard.build.state)
  assert.deepEqual(byDriver.build.state, byKeyboard.build.state)
  assert.equal(
    screen(byMouse.build, byMouse.layout, byMouse.context),
    screen(byKeyboard.build, byKeyboard.layout, byKeyboard.context),
  )
  assert.equal(
    screen(byDriver.build, byDriver.layout, byDriver.context),
    screen(byKeyboard.build, byKeyboard.layout, byKeyboard.context),
  )
})

test("after a placement the keyboard goes back to where the arming came from, disarmed (owner, 2026-09-29)", () => {
  // Q57 answered "always back to the menu" (2026-09-27), replacing gate 5A's "stays armed after
  // placing"; feedback F30 refined it: armed on the map, the keyboard stays on the map in plain
  // navigation; armed from the menu, it goes back to the menu.
  for (const start of ["grid", "menu"] as const) {
    const { build, layout } = session()
    build.dispatch({ kind: "focus", target: start })
    build.handleData("1", layout)
    assert.equal(build.state.armed, 0)
    build.run([{ kind: "move-cursor", dx: 12, dy: 1 }])
    build.handleData(ENTER, layout)
    assert.equal(build.state.planned.length, 1)
    assert.equal(build.state.armed, null, "a placement disarms")
    assert.equal(build.state.focus, start)
    assert.equal(build.state.exploreMap, false)
    assert.equal(build.state.menuHighlight, 2, "the highlight stays on the row just built from")
    assert.match(build.state.status.text, /Barracks placed \(resources: 60\) - \[u\] undo/)
  }
})

test("keyboard: Space places, exactly like Enter", () => {
  const bySpace = session()
  bySpace.build.handleData("1", bySpace.layout)
  bySpace.build.run([{ kind: "move-cursor", dx: 12, dy: 1 }])
  bySpace.build.handleData(" ", bySpace.layout)

  const byEnter = session()
  byEnter.build.handleData("1", byEnter.layout)
  byEnter.build.run([{ kind: "move-cursor", dx: 12, dy: 1 }])
  byEnter.build.handleData(ENTER, byEnter.layout)

  assert.equal(bySpace.build.state.planned.length, 1)
  assert.deepEqual(bySpace.build.state, byEnter.build.state)
})

test("a second Enter after a placement never places a second building", () => {
  // Armed from the menu, Enter places and returns the keyboard to the menu, on the same row; a second
  // Enter there arms that row again (moving the cursor to the next free spot), and only a third
  // places. Armed on the map, a second Enter in plain navigation opens Explore Map. A double press can
  // never build twice.
  const { build, layout } = session()
  build.dispatch({ kind: "focus", target: "menu" })
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }])
  build.handleData(ENTER, layout)
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 1)
  assert.equal(build.state.armed, 0)
  assert.equal(build.state.focus, "grid")

  const onMap = session()
  onMap.build.handleData("1", onMap.layout)
  onMap.build.run([{ kind: "move-cursor", dx: 12, dy: 1 }])
  onMap.build.handleData(ENTER, onMap.layout)
  onMap.build.handleData(ENTER, onMap.layout)
  assert.equal(onMap.build.state.planned.length, 1)
  assert.equal(onMap.build.state.armed, null)
  assert.equal(onMap.build.state.exploreMap, true)
})

test("keyboard: Shift+Arrow and its modifier-free fallback are both the fast move, a jump of the Shift jump", () => {
  // Measured, not assumed — scripts/probe-modified-keys.mjs found three live encodings for a
  // shifted arrow and none at all on several terminals, which is why all of these are bound. Five
  // tiles until gate 5H, then 8; a jump of 12 since the owner's 2026-09-28 playtest — an Experiment
  // flag (`jumpStep` here).
  const context = { itemCount: 3, armed: false }
  const fast = DEFAULT_JUMP_STEP
  assert.deepEqual(buildKeyboardCommand(RIGHT, context), { kind: "move-cursor", dx: 1, dy: 0 })
  assert.deepEqual(buildKeyboardCommand(SHIFT_RIGHT, context), { kind: "move-cursor", dx: fast, dy: 0, fast: true })
  assert.deepEqual(buildKeyboardCommand(RXVT_SHIFT_RIGHT, context), { kind: "move-cursor", dx: fast, dy: 0, fast: true })
  assert.deepEqual(buildKeyboardCommand(PAGE_DOWN, context), { kind: "move-cursor", dx: 0, dy: fast, fast: true })
  assert.deepEqual(buildKeyboardCommand(SHIFT_RIGHT, { ...context, jumpStep: 6 }), {
    kind: "move-cursor",
    dx: 6,
    dy: 0,
    fast: true,
  })
  // Home and End have three live spellings between xterm, screen/tmux/linux and rxvt; all of them
  // mean the same move.
  for (const home of [`${ESC}OH`, `${ESC}[1~`, `${ESC}[7~`, `${ESC}[H`]) {
    assert.deepEqual(buildKeyboardCommand(home, context), { kind: "move-cursor", dx: -fast, dy: 0, fast: true })
  }
  // A terminal that switched to application cursor mode sends `ESC O A`, not `ESC [ A`. Both are
  // plain arrows, and both move one tile.
  assert.deepEqual(buildKeyboardCommand(`${ESC}OB`, context), { kind: "move-cursor", dx: 0, dy: 1 })
})

test("keyboard: Option+Arrow as macOS terminals send it is the fast move, never Escape", () => {
  // ESC b / ESC f are Option+Left/Right's default word-movement keys; a terminal set to treat Option
  // as Meta prefixes the arrow with ESC instead. Before `keysFromChunk` kept these whole, Option+Left
  // arrived as a bare Escape plus a stray "b" - which, with nothing armed, left the screen.
  const context = { itemCount: 3, armed: false }
  const fast = DEFAULT_JUMP_STEP
  assert.deepEqual(buildKeyboardCommand(`${ESC}b`, context), { kind: "move-cursor", dx: -fast, dy: 0, fast: true })
  assert.deepEqual(buildKeyboardCommand(`${ESC}f`, context), { kind: "move-cursor", dx: fast, dy: 0, fast: true })
  assert.deepEqual(buildKeyboardCommand(`${ESC}${ESC}[A`, context), { kind: "move-cursor", dx: 0, dy: -fast, fast: true })
  // End to end, through the real splitter: nothing is armed, and the screen is not left.
  const context2 = spikeContext()
  const layout = buildLayout(MINIMUM, context2.grid)
  const build = readyBuildSession({ context: context2, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
  build.handleData(`${ESC}f`, layout)
  assert.equal(build.state.focus, "grid", "Option+Right was read as an Esc")
  assert.equal(build.state.overlay, null, "Option+Right was read as an Esc")
  assert.equal(build.state.cursor.x, 18 + DEFAULT_JUMP_STEP)
})

test("keyboard: digits always address the list, and a digit past its end means nothing", () => {
  const context = { itemCount: 3, armed: false }
  assert.deepEqual(buildKeyboardCommand("2", context), { kind: "arm", index: 1 })
  assert.equal(buildKeyboardCommand("4", context), null)
  assert.equal(buildKeyboardCommand("0", context), null)
})

test("keyboard: Esc is cancel and x is back in every focus, and q opens the game menu rather than quits", () => {
  // x was the same command as Esc until the owner's 2026-09-30 feedback F62: it walks back like Esc but
  // never opens the game menu (tests/build-behaviour-round-2.test.ts has what each does).
  for (const focus of ["menu", "grid"] as const) {
    for (const armed of [true, false]) {
      assert.deepEqual(buildKeyboardCommand(ESC, { itemCount: 3, armed, focus }), { kind: "cancel" })
      assert.deepEqual(buildKeyboardCommand("x", { itemCount: 3, armed, focus }), { kind: "back" })
      assert.deepEqual(buildKeyboardCommand("q", { itemCount: 3, armed, focus }), { kind: "open-menu" })
    }
  }
  // Inside the game menu, q is Quit; Ctrl+C always quits outright.
  assert.deepEqual(buildKeyboardCommand("q", { itemCount: 3, armed: false, overlay: "menu" }), { kind: "quit" })
  assert.deepEqual(buildKeyboardCommand(String.fromCharCode(3), { itemCount: 3, armed: false }), { kind: "quit" })
})

test("keyboard: a letter this screen does not bind means nothing at all", () => {
  // `t` was the click-mode toggle until Q50 was answered. A retired binding that quietly still does
  // something is worse than one that never existed, so it is asserted dead rather than forgotten.
  const context = { itemCount: 3, armed: true }
  for (const key of ["t", "h", "j", "k", "l"]) {
    assert.equal(buildKeyboardCommand(key, context), null, `"${key}" should mean nothing here`)
  }
})

test("mouse: the wheel moves the cursor five tiles and drags the camera with it", () => {
  const { build, layout } = session()
  const before = { ...build.state.camera }
  const startY = build.state.cursor.y
  build.handleData(formatMouseEvent(MOUSE_WHEEL_DOWN, 10, 10), layout)
  assert.equal(build.state.cursor.y, startY + JUMP_TILES)
  assert.ok(build.state.camera.y > before.y, "the camera followed the cursor south")
  build.handleData(formatMouseEvent(MOUSE_WHEEL_UP, 10, 10), layout)
  assert.equal(build.state.cursor.y, startY)
})

test("mouse: right click is Esc; a click on a menu row arms it at once (feedback F22)", () => {
  const { build, layout } = session()
  // The session starts in plain navigation, with the menu drawn beside the map: one click arms.
  build.handleData(clickRowBytes(layout, 1), layout)
  assert.equal(build.state.armed, 1)
  assert.equal(build.state.menuHighlight, 3)
  build.handleData(formatMouseEvent(MOUSE_RIGHT, 10, 10), layout)
  assert.equal(build.state.armed, null)
})

test("mouse: a click on the side panel is not a click on the Grid", () => {
  const { build, layout } = session()
  const cursorBefore = { ...build.state.cursor }
  // Well below the construct rows, inside the panel: neither a row nor a tile.
  build.handleData(
    formatMouseEvent(MOUSE_LEFT, layout.panelColumn + 3, layout.footerRow - 1),
    layout,
  )
  assert.deepEqual(build.state.cursor, cursorBefore)
})

test("parseMouseEvent: a release is not a press, and the bytes round-trip", () => {
  assert.deepEqual(parseMouseEvent(formatMouseEvent(MOUSE_LEFT, 12, 7)), {
    button: MOUSE_LEFT,
    column: 11,
    row: 6,
    press: true,
  })
  assert.equal(parseMouseEvent(`${ESC}[<0;12;7m`)?.press, false)
  assert.equal(parseMouseEvent("not a mouse report"), null)
})

test("a click on a tile only arms the preview there - a second click on the same tile places it (Q52)", () => {
  const byClick = session()
  byClick.build.handleData("1", byClick.layout)
  // Recomputed fresh for each click, not the same bytes reused: the camera itself can move between
  // clicks (it does here, since the opening cursor needs a margin from the bottom the target row
  // does not), and what makes a real second click "the same tile" is landing on the same logical
  // tile as it now sits on screen, not replaying the identical bytes — that case is its own test.
  const clickAt3014 = (): void =>
    byClick.build.handleData(clickTileBytes(byClick.layout, byClick.build, { x: 30, y: 14 }), byClick.layout)
  clickAt3014()
  assert.equal(byClick.build.state.planned.length, 0, "the first click only moves the cursor")
  assert.deepEqual(byClick.build.state.cursor, { x: 30, y: 14 })
  clickAt3014()
  assert.equal(byClick.build.state.planned.length, 1, "the second click, on the same tile, places it")

  const byKeyboard = session()
  byKeyboard.build.handleData("1", byKeyboard.layout)
  byKeyboard.build.run([{ kind: "move-cursor", dx: 12, dy: 1 }])
  byKeyboard.build.handleData(ENTER, byKeyboard.layout)
  // The same plan, cursor and everything else. Only the camera may differ: an armed click never
  // scrolls the view (Q58, gate 5H), where the keyboard's move lets the camera follow its margin; and
  // a placement by the mouse leaves no highlight bar on the menu (feedback F22).
  assert.deepEqual(
    { ...byClick.build.state, camera: null, highlightHidden: false },
    { ...byKeyboard.build.state, camera: null },
  )
  // Armed by its digit on the map, placed by the mouse: back on the map, where the arming began.
  assert.equal(byClick.build.state.focus, "grid")
})

test("with Armed click scrolls off, an armed click never scrolls the view, so the same screen spot clicked twice places there (Q58)", () => {
  // x=46 is inside the scroll margin of the opening view's right edge (0-47). Before gate 5H the
  // first click scrolled the Grid under the pointer and the second landed on another tile.
  const { build, layout } = session()
  build.dispatch({ kind: "debug-adjust", field: "armedClickScrolls", step: 1 })
  assert.equal(build.state.debug.armedClickScrolls, false)
  build.handleData("1", layout)
  const cameraBefore = { ...build.state.camera }
  const bytes = clickTileBytes(layout, build, { x: 46, y: 13 })
  build.handleData(bytes, layout)
  assert.deepEqual(build.state.cursor, { x: 46, y: 13 })
  assert.deepEqual(build.state.camera, cameraBefore, "an armed click scrolled the view")
  build.handleData(bytes, layout)
  assert.equal(build.state.planned.length, 1, "the second click on the same spot did not place")
  // The next keyboard move lets the margin follow again: the rule bends for the click alone.
  build.handleData("1", layout)
  build.handleData(RIGHT, layout)
  assert.notDeepEqual(build.state.camera, cameraBefore, "the margin did not follow the next arrow")
})

test("a click that scrolled the camera is a fresh first click, not a mis-place on the wrong tile", () => {
  // Q50's own finding, deliberately re-tested rather than assumed fixed: a first click within the
  // scroll margin can slide the Grid under the pointer, so replaying the same *screen position*
  // resolves to a different *tile* the second time. Comparing tile identity (what the mouse adapter
  // already resolves screen cells to) rather than screen position is what keeps this safe. Since
  // gate 5H an armed click scrolls only with the Experiment "Armed click scrolls" on — the default
  // since the owner's F22. Without key timing (a driver script) there is no double click either.
  const { build, layout } = session()
  assert.equal(build.state.debug.armedClickScrolls, true)
  build.handleData("1", layout)
  // x=46 is within the 3-tile margin of the opening viewport's own right edge (0-47), so landing the
  // cursor here forces the camera to scroll east to keep the margin.
  const cameraBefore = { ...build.state.camera }
  const bytes = clickTileBytes(layout, build, { x: 46, y: 13 })
  build.handleData(bytes, layout)
  assert.deepEqual(build.state.cursor, { x: 46, y: 13 }, "the first click only moved the cursor")
  assert.equal(build.state.planned.length, 0)
  assert.notEqual(build.state.camera.x, cameraBefore.x, "the test did not actually scroll the camera")

  // The exact same bytes again - the same screen cell, not the same tile, now that the camera moved.
  build.handleData(bytes, layout)
  assert.notEqual(build.state.cursor.x, 46, "the same screen cell now names a different tile")
  assert.equal(build.state.planned.length, 0, "a camera-shifted click must not place on the wrong tile")
})

test("a misclick costs one undo, which is what makes a two-click placement revisable", () => {
  const { build, layout } = session()
  build.handleData("1", layout)
  const clickAt3014 = (): void =>
    build.handleData(clickTileBytes(layout, build, { x: 30, y: 14 }), layout)
  clickAt3014()
  clickAt3014()
  assert.equal(build.state.planned.length, 1)
  build.handleData("u", layout)
  assert.equal(build.state.planned.length, 0)
})

test("legality: an illegal placement is refused with a reason and nothing is moved to fit", () => {
  const { build, layout } = session()
  const context = spikeContext()
  build.handleData("1", layout)

  // The north-west wall: rock at 8,5 through 21,5.
  build.run([{ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }])
  const cursorBefore = { ...build.state.cursor }
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 0)
  assert.match(build.state.status.text, /rock in the way/)
  assert.deepEqual(build.state.cursor, cursorBefore, "the cursor did not slide somewhere legal")

  // The standing Grid Nexus, at 17,10 through 19,11.
  build.run([{ kind: "move-cursor", dx: 18 - 8, dy: 10 - 5 }])
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 0)
  assert.match(build.state.status.text, /the nexus is here/)

  // The Grid's own north-west corner, where a 3x2 footprint hangs off the edge.
  build.run([{ kind: "move-cursor", dx: -999, dy: -999 }])
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 0)
  assert.match(build.state.status.text, /off the Grid/)

  // And a legal one, for contrast: the refusals above are about the tile, not about placement.
  build.run([{ kind: "move-cursor", dx: 30, dy: 14 }])
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 1)
  const placed = build.state.planned[0]!
  assert.ok(
    legalityAt(context, [], placed.contentId, placed.anchor).ok,
    "what was planned is legal on its own terms",
  )
})

test("legality: a second structure may not overlap the first one planned", () => {
  const { build, layout } = session()
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  assert.equal(build.state.planned.length, 1)
  build.handleData("1", layout)
  moveTo(build, { x: 31, y: 14 }) // one tile east of the first one's centre
  build.run([{ kind: "place" }])
  assert.equal(build.state.planned.length, 1)
  assert.match(build.state.status.text, /the barracks is here/)
})

test("a plan is revisable: remove under the cursor, and undo the last one", () => {
  const { build, layout } = session()
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }, { kind: "arm", index: 0 }])
  moveTo(build, { x: 34, y: 14 })
  build.run([{ kind: "place" }])
  assert.equal(build.state.planned.length, 2)
  build.handleData("u", layout)
  assert.equal(build.state.planned.length, 1)
  // Backspace, on the Grid, removes whatever is under the cursor, wherever in the plan it came from.
  build.run([{ kind: "focus", target: "grid" }, { kind: "move-cursor", dx: -4, dy: 0 }])
  build.handleData(String.fromCharCode(127), layout)
  assert.equal(build.state.planned.length, 0)
  build.handleData("u", layout)
  assert.match(build.state.status.text, /Nothing to undo/)
})

test("the cursor points at a structure's centre tile, the way the scenario format already does", () => {
  const context = spikeContext()
  const barracks = context.registry.get("structure.citizen.barracks")
  // A 3x2 footprint centres on its second column and its first row.
  assert.deepEqual(anchorForCursor({ x: 30, y: 14 }, barracks.footprint), { x: 29, y: 14 })
  const turret = context.registry.get("structure.bench.beamturret")
  assert.deepEqual(anchorForCursor({ x: 30, y: 14 }, turret.footprint), { x: 30, y: 14 })
})

test("every construct row names content that exists, costs something, and says what it does", () => {
  const context = spikeContext()
  for (const item of SPIKE_CATALOG) {
    assert.ok(context.registry.has(item.contentId), `${item.contentId} is not real content`)
    assert.ok(item.cost > 0, `${item.label} costs nothing`)
    assert.ok(item.effect.length > 0, `${item.label} does not say what it does`)
    // The effect line has to fit the panel it is drawn in, or it says what it does only halfway.
    assert.ok(item.effect.length <= 28, `"${item.effect}" is wider than the panel`)
  }
})

test("the budget actually runs out, which is the only thing that makes the menu a choice", () => {
  // Asserted as behaviour rather than as arithmetic over the constants: what matters is that a
  // player placing things hits the wall, not that three particular numbers sum a particular way.
  const { build, layout } = session()
  build.handleData("1", layout) // the most expensive row
  const context = spikeContext()
  assert.equal(remaining(context, build.state), SPIKE_ALLOTMENT)

  let placed = 0
  for (let step = 0; step < 20 && !/costs/.test(build.state.status.text); step += 1) {
    build.run([{ kind: "move-cursor", dx: 4, dy: 0 }, { kind: "place" }, { kind: "arm", index: 0 }])
    placed = build.state.planned.length
  }
  assert.ok(placed > 0, "nothing could be placed at all")
  assert.match(build.state.status.text, /costs \d+, \d+ left/, "the budget never ran out")
  assert.ok(remaining(context, build.state) >= 0, "spending went past the allotment")
})

test("spending is exactly as revisable as the plan: placing spends, removing and undoing refund", () => {
  const context = spikeContext()
  const { build, layout } = session()
  const barracks = SPIKE_CATALOG[0]!
  const turret = SPIKE_CATALOG[2]!

  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  assert.equal(spent(context, build.state), barracks.cost)

  build.handleData("3", layout)
  moveTo(build, { x: 36, y: 14 })
  build.run([{ kind: "place" }])
  assert.equal(spent(context, build.state), barracks.cost + turret.cost)
  assert.equal(remaining(context, build.state), SPIKE_ALLOTMENT - barracks.cost - turret.cost)

  // Undo refunds the last one exactly, and Backspace refunds whichever is under the cursor.
  build.handleData("u", layout)
  assert.equal(spent(context, build.state), barracks.cost)
  build.run([{ kind: "focus", target: "grid" }, { kind: "move-cursor", dx: -6, dy: 0 }])
  build.handleData(String.fromCharCode(127), layout)
  assert.equal(spent(context, build.state), 0)
  assert.equal(remaining(context, build.state), SPIKE_ALLOTMENT, "the allotment came back whole")
})

test("a placement that cannot be afforded is refused, and changes nothing at all", () => {
  const context = spikeContext()
  const { build, layout } = session()
  // Spend down to less than the barracks costs, then try a barracks.
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }, { kind: "arm", index: 0 }])
  moveTo(build, { x: 34, y: 14 })
  build.run([{ kind: "place" }])
  const before = build.state
  const left = remaining(context, build.state)
  assert.ok(left < SPIKE_CATALOG[0]!.cost, "the test did not actually spend enough to matter")

  // Refused at the menu, before any tile: an unaffordable row cannot be armed.
  build.handleData("1", layout)
  assert.match(build.state.status.text, /costs 40, \d+ left/)
  assert.equal(build.state.armed, null)
  // Enter after it has nothing armed to place (on the map it opens Explore Map instead).
  build.handleData("\r", layout)
  assert.equal(build.state.planned.length, before.planned.length, "it was planned anyway")
  assert.equal(remaining(context, build.state), left, "the budget moved on a refused placement")
  assert.equal(build.state.armed, null)
})

test("affordability is reported before a tile problem, because it is true wherever the cursor is", () => {
  const context = spikeContext()
  const { build } = session()
  // Onto rock, with a budget that cannot pay for it either. Reporting the rock would send the
  // player to move the cursor, which would not help.
  const anchor = anchorForCursor({ x: 8, y: 5 }, context.registry.get(SPIKE_CATALOG[0]!.contentId).footprint)
  const broke = legalityAt(context, [], SPIKE_CATALOG[0]!.contentId, anchor, 5)
  assert.equal(broke.ok, false)
  assert.match(broke.ok === false ? broke.reason : "", /costs 40, 5 left/)
  // With money, the same tile reports the rock, and says which tile it means.
  const rich = legalityAt(context, [], SPIKE_CATALOG[0]!.contentId, anchor, 100)
  assert.equal(rich.ok, false)
  assert.match(rich.ok === false ? rich.reason : "", /rock in the way/)
  assert.deepEqual(rich.ok === false ? rich.tile : null, { x: 8, y: 5 })
  void build
})

test("the two groups share one digit sequence, with no mode to tell them apart", () => {
  // engine.md 9.7's first convention: "digits always address the list; they never mean anything
  // else". Two groups each counting from 1 would need a focus concept to disambiguate, which is the
  // thing that convention exists to forbid — so a hotkey addresses the whole menu.
  const hotkeys = SPIKE_CATALOG.map((item) => item.hotkey)
  assert.deepEqual(hotkeys, [...new Set(hotkeys)], "two rows share a hotkey")
  assert.deepEqual(hotkeys, ["1", "2", "3"], "the digits do not run straight through the menu")
  const { build, layout } = session()
  build.handleData("3", layout)
  assert.equal(build.state.armed, 2, "the third digit armed the third row of the whole menu")
})

test("the buildings are one list in catalog order, one row each, with no group headings (feedback F56)", () => {
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const lines = constructLines(layout, context.catalog)
  // Every building has its row, in catalog order, on consecutive rows — which is what a click relies on.
  assert.deepEqual(
    lines.map((line) => line.index),
    context.catalog.map((_, index) => index),
  )
  const itemRows = lines.map((line) => line.row)
  assert.deepEqual(itemRows, itemRows.map((_, index) => (itemRows[0] as number) + index))
})

test("scrolling: the whole Grid is reachable, at the smallest terminal and the largest", () => {
  for (const terminal of [MINIMUM, MAXIMUM]) {
    const { build, layout } = session(terminal)
    // Walk into the far south-east corner with the five-tile jump, the way a player would.
    for (let step = 0; step < 40; step += 1) {
      build.handleData(SHIFT_RIGHT, layout)
      build.handleData(PAGE_DOWN, layout)
    }
    const grid = spikeGrid()
    assert.deepEqual(build.state.cursor, { x: grid.width - 1, y: grid.height - 1 })
    assert.deepEqual(build.state.camera, {
      x: grid.width - layout.viewport.width,
      y: grid.height - layout.viewport.height,
    })
    // And back out again, to the opposite corner.
    for (let step = 0; step < 40; step += 1) {
      build.handleData(`${ESC}[1;2D`, layout)
      build.handleData(`${ESC}[5~`, layout)
    }
    assert.deepEqual(build.state.cursor, { x: 0, y: 0 })
    assert.deepEqual(build.state.camera, { x: 0, y: 0 })
  }
})

test("the scroll margin is a share of the view, so the owner's 25% can be felt against another number", () => {
  // project-governance.md Section 7: the 3-tile margin is "locked direction, and Milestone 5 may
  // retune [it] on evidence from the first person who actually scrolls a Grid". Gate 5H made it a
  // share of the view's width and height (the owner: "about 20% of the height or width", then 25%
  // after playing it). 49 tiles wide at 80 columns: 10% is 5 tiles, 20% is 10, 25% is 12, 30% is 15.
  for (const [percent, margin] of [[10, 5], [20, 10], [25, 12], [30, 15]] as const) {
    const context = { ...spikeContext(), scrollMargin: percent }
    const layout = buildLayout(MINIMUM, context.grid)
    const build = readyBuildSession({ context, cursor: { x: 0, y: 0 }, viewport: layout.viewport })
    // Walk east until the camera first moves: it should be exactly at the margin from the east edge.
    let steps = 0
    while (build.state.camera.x === 0 && steps < context.grid.width) {
      build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
      steps += 1
    }
    assert.equal(
      layout.viewport.width - 1 - (build.state.cursor.x - build.state.camera.x),
      margin,
      `margin ${margin}`,
    )
  }
})

test("a resize keeps the cursor where it was and re-fits the camera around it", () => {
  const context = spikeContext()
  const small = buildLayout(MINIMUM, context.grid)
  const build = readyBuildSession({ context, cursor: { x: 60, y: 30 }, viewport: small.viewport })
  const cursor = { ...build.state.cursor }
  build.resize(fitViewport(MAXIMUM, context.grid, 1))
  assert.deepEqual(build.state.cursor, cursor)
  assert.deepEqual(build.state.viewport, { width: 72, height: 24 })
  assert.ok(build.state.camera.x >= 0 && build.state.camera.x <= context.grid.width - 72)
  assert.ok(build.state.camera.y >= 0 && build.state.camera.y <= context.grid.height - 24)
})

test("Esc walks back to the game menu; only its q quits, and neither touches the plan", () => {
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  let quits = 0
  const build = readyBuildSession({
    context,
    cursor: { x: 18, y: 13 },
    viewport: layout.viewport,
    onQuit: () => {
      quits += 1
    },
  })
  const planned = build.state.planned
  build.handleData(ESC, layout) // Grid -> menu
  assert.equal(build.state.focus, "menu")
  build.handleData(ESC, layout) // menu -> the game menu
  assert.equal(build.state.overlay, "menu")
  build.handleData(ESC, layout) // Esc again keeps playing
  assert.equal(build.state.overlay, null)
  assert.equal(quits, 0)
  build.handleData("q", layout) // q opens the game menu
  assert.equal(build.state.overlay, "menu")
  assert.equal(quits, 0, "a bare q quit without asking")
  build.handleData("q", layout) // q in the game menu quits
  assert.equal(quits, 1)
  assert.equal(build.state.planned, planned, "nothing touched the plan")
})

test("two keys arriving in one chunk are two keys, not one", () => {
  // The bug Gate 3A found on a real terminal and no fake-stdin test had ever produced: the OS
  // delivers two quick presses in a single read. Both arrows must move the cursor.
  const { build, layout } = session()
  const start = { ...build.state.cursor }
  build.handleData(RIGHT + RIGHT, layout)
  assert.deepEqual(build.state.cursor, { x: start.x + 2, y: start.y })
  build.handleData(UP + LEFT, layout)
  assert.deepEqual(build.state.cursor, { x: start.x + 1, y: start.y - 1 })
})

test("a refusal's message clears once the cursor leaves the tile it was about", () => {
  // The panel already recomputes its own "why" live from the current cursor position; the footer's
  // one-line echo of the same refusal must not go on saying so once that stops being true, or the
  // two disagree with each other on screen. A tiny hand-built grid with a single rock tile, rather
  // than the spike's own terrain, so the test does not have to reason about which other tiles a
  // move happens to land on.
  const width = 10
  const height = 10
  const tiles: TerrainId[] = new Array<TerrainId>(width * height).fill("terrain.plain")
  tiles[5 * width + 5] = "terrain.rock"
  const grid: GridTerrain = { width, height, tiles }
  const context = {
    grid,
    registry: FIXTURE_REGISTRY,
    catalog: SPIKE_CATALOG,
    standing: [],
    allotment: SPIKE_ALLOTMENT,
    nexusDraft: SPIKE_NEXUS_DRAFT,
  }
  const build = readyBuildSession({ context, cursor: { x: 4, y: 5 }, viewport: { width: 10, height: 10 } })

  // Turret: a 1x1 footprint, so the cursor's own tile is the whole placement and there is no
  // footprint-centring arithmetic to account for. Armed beside the rock (arming never lands on one,
  // feedback F30), then moved onto it.
  build.dispatch({ kind: "arm", index: 2 })
  build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
  build.dispatch({ kind: "place" })
  assert.match(build.state.status.text, /Cannot build here/, "the test did not actually trigger a refusal")

  build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
  assert.doesNotMatch(build.state.status.text, /Cannot build here/)

  // A message about the last action, rather than about a tile, is the answer of that action: since
  // the bottom bar became one contextual line (owner, 2026-09-30, feedback F59) it lapses at the next
  // command that says nothing — a cursor move included — and the hint takes its place.
  build.dispatch({ kind: "place" })
  assert.match(build.state.status.text, /Turret placed/)
  build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
  assert.equal(build.state.status.text, "", "an answer outlived the next command, which said nothing")
})

test("a move clamped back to the same tile keeps the refusal on screen, read quietly once the attempt has lapsed", () => {
  // Pressing further into the Grid's own edge does not move the cursor at all — clampToGrid leaves
  // it exactly where it was. That is not "the cursor left the tile the refusal was about", so the
  // bottom line still says why Enter is refused there. But the move is a command that said nothing, so
  // the attempt's own red answer lapses (feedback F59): the same sentence reads as looking, not trying.
  const width = 10
  const height = 10
  const tiles: TerrainId[] = new Array<TerrainId>(width * height).fill("terrain.plain")
  tiles[9 * width + 9] = "terrain.rock"
  const grid: GridTerrain = { width, height, tiles }
  const context = {
    grid,
    registry: FIXTURE_REGISTRY,
    catalog: SPIKE_CATALOG,
    standing: [],
    allotment: SPIKE_ALLOTMENT,
    nexusDraft: SPIKE_NEXUS_DRAFT,
  }
  const build = readyBuildSession({ context, cursor: { x: 8, y: 9 }, viewport: { width: 10, height: 10 } })
  build.dispatch({ kind: "arm", index: 2 })
  build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
  build.dispatch({ kind: "place" })
  assert.match(build.state.status.text, /Cannot build here/)

  assert.equal(bottomLine(context, build.state, armedPreview(context, build.state)).tone, "danger")

  build.dispatch({ kind: "move-cursor", dx: 1, dy: 1 })
  assert.deepEqual(build.state.cursor, { x: 9, y: 9 }, "the move should have been clamped to a no-op")
  const line = bottomLine(context, build.state, armedPreview(context, build.state))
  assert.match(line.text, /Cannot build here/, "the cursor never left the tile the refusal named")
  assert.equal(line.tone, undefined, "the lapsed attempt still reads as an attempt")
})
