// The sharp edge of the three adapters: the same Build Phase plan, entered by raw keystrokes, by raw mouse bytes,
// and from a command script, must be the same plan and the same screen. docs/system-design/input.md has a RULE
// that "a command's effect never depends on which adapter produced it", and the only way to prove
// that is to start each path from bytes a terminal actually sends — never from a hand-built command,
// which would assert that the thing downstream of the mapping works while leaving the mapping, the
// part most likely to drift, untested.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_ALLOTMENT, STARTER_CATALOG, STARTER_NEXUS_DRAFT, starterGrid } from "../src/build/catalog.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { GridTerrain, TerrainId } from "../src/grid/types.ts"
import { buildLayout, cellForTile, constructLines } from "../src/build/layout.ts"
import { buildKeyboardCommand } from "../src/build/keyboard.ts"
import { TUNING } from "../src/build/tuning.ts"
import { defaultValue } from "../src/build/all-settings.ts"
import {
  MOUSE_LEFT,
  MOUSE_RIGHT,
  MOUSE_WHEEL_DOWN,
  MOUSE_WHEEL_UP,
  WHEEL_TILES,
  formatMouseEvent,
  parseMouseEvent,
} from "../src/build/mouse.ts"
import { BuildSession } from "../src/view/build-session.ts"
import type { BuildSessionOptions } from "../src/view/build-session.ts"
import { anchorForCursor, applyBuildCommand, armedPreview, createBuildState, entryOfConstruct, legalityAt, remaining, spent } from "../src/build/state.ts"
import { popupSpec } from "../src/build/popup.ts"
import { cardText } from "../src/build/card.ts"
import { bottomLine } from "../src/build/help.ts"
import type { BuildCommand, PlannedPlacement } from "../src/build/types.ts"
import { starterContext } from "../src/cli/starter.ts"
import { fitViewport, marginForView } from "../src/build/camera.ts"
import { DOWN, ENTER, ESC, LEFT, MAXIMUM, MINIMUM, PAGE_DOWN, PAGE_UP, RIGHT, SHIFT_LEFT, SHIFT_RIGHT, UP, screenText } from "./build-helpers.ts"

/**
 * Every test here is about placement, scrolling, or the adapters — not about the Nexus draft that
 * stands in front of all of it. Rather than repeat "pick a placeholder power" at every call site,
 * every `BuildSession` in this file starts past that draft already, on the first option, the same
 * way a real player would be past it within one keypress. The handful of tests that check the
 * draft itself construct a session with `new BuildSession` directly instead.
 */
/** A picked power that adds nothing to the budget, so every test that is not about the Nexus
 *  draft itself sees exactly the allotment its own numbers already assume. */
const NEUTRAL_NEXUS_DRAFT = [
  { hotkey: "1", name: "Test Pick", description: "No effect.", bonusAllotment: 0 },
] as const

function readyBuildSession(options: BuildSessionOptions): BuildSession {
  const build = new BuildSession(options)
  build.dispatch({ kind: "pick-nexus", index: 0 })
  // Keyboard focus starts on the menu; every test here that presses an arrow means the
  // Grid's cursor, the way every one of them was written before focus existed. The focus model's own
  // tests are in `tests/build-focus.test.ts`.
  build.dispatch({ kind: "focus", target: "grid" })
  return build
}

const RXVT_SHIFT_RIGHT = `${ESC}[c`

function session(
  terminal = MINIMUM,
): { build: BuildSession; layout: ReturnType<typeof buildLayout>; context: ReturnType<typeof starterContext> } {
  const context = { ...starterContext(), nexusDraft: NEUTRAL_NEXUS_DRAFT }
  const layout = buildLayout(terminal, context.grid)
  const build = readyBuildSession({
    context,
    cursor: { x: 18, y: 13 },
    viewport: layout.viewport,
  })
  return { build, layout, context }
}

/** A cursor move to `tile`, from wherever the cursor is now — arming may have moved it,
 *  so a test that means a tile says the tile rather than a distance from a spot it cannot predict. */
function moveTo(build: BuildSession, tile: { x: number; y: number }): void {
  build.dispatch({ kind: "move-cursor", dx: tile.x - build.state.cursor.x, dy: tile.y - build.state.cursor.y })
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
  const line = constructLines(layout, STARTER_CATALOG).find((candidate) => candidate.index === index)
  assert.ok(line !== undefined, `no construct row is drawn for item ${index}`)
  const item = STARTER_CATALOG[index]!
  // Anywhere inside the row's own drawn text; the middle proves the whole row is live, not just its
  // first cell.
  const column = layout.panelColumn + Math.floor(`[${item.hotkey}] ${item.label}`.length / 2)
  return formatMouseEvent(MOUSE_LEFT, column + 1, line.row + 1)
}

test("the same plan by hotkeys, by clicks, and from a script is the same plan and the same screen", () => {
  // Two barracks, one behind the other, at tiles that are on screen from the start: 1 arms it where the
  // cursor is, the cursor walks to 26,13 (south of the standing Barracks, inside the build range), Enter
  // places (and leaves the keyboard on the map, where the arming began); 1 arms it again, which moves the
  // cursor off the new one to the nearest spot inside the build range with a free tile around it — 30,13,
  // east of it, on ground the standing Barracks's range reaches (the first gives no range until it
  // stands) — and one more Enter places the second there.
  // An armed click scrolls the view inside its edge zones and an arrow scrolls at the margin; the
  // parity asserted here is the whole state, camera included, so the tiles are ones where the two
  // come to the same view.
  const byKeyboard = session()
  byKeyboard.build.handleData("1", byKeyboard.layout)
  for (let step = 0; step < 8; step += 1) byKeyboard.build.handleData(RIGHT, byKeyboard.layout)
  byKeyboard.build.handleData(ENTER, byKeyboard.layout)
  byKeyboard.build.handleData("1", byKeyboard.layout)
  assert.deepEqual(byKeyboard.build.state.cursor, { x: 30, y: 13 })
  byKeyboard.build.handleData(ENTER, byKeyboard.layout)

  const byMouse = session()
  // Digits are the path both players share, so both armings began on the map and both placements
  // leave the keyboard there (a click on a row is the menu's, and goes back to it — the focus tests
  // hold that); the rest is clicks.
  byMouse.build.handleData("1", byMouse.layout)
  // A click only arms the preview at a tile; a second click on that same tile is what places it
  // — so each of the two placements below is two clicks, not one. Recomputed fresh each time
  // (not the same bytes reused) because the camera itself can move between clicks: the second click's
  // bytes must name the same *tile* the first one did, which is what a real second click landing on
  // the same on-screen row would also do once the display has caught up.
  const clickTile = (tile: { x: number; y: number }): void => {
    byMouse.build.handleData(clickTileBytes(byMouse.layout, byMouse.build, tile), byMouse.layout)
  }
  clickTile({ x: 26, y: 13 })
  clickTile({ x: 26, y: 13 })
  byMouse.build.handleData("1", byMouse.layout)
  // Arming already put the cursor on 30,13, so one click there is the confirming second click.
  clickTile({ x: 30, y: 13 })
  assert.equal(byMouse.build.state.focus, "grid", "a placement armed on the map left the map")

  const script: readonly BuildCommand[] = [
    { kind: "arm", index: 0 },
    { kind: "move-cursor", dx: 8, dy: 0 },
    { kind: "place" },
    { kind: "arm", index: 0 },
    { kind: "place" },
  ]
  const byDriver = session()
  byDriver.build.run(script)

  assert.equal(byKeyboard.build.state.planned.length, 2, "two structures were actually planned")
  assert.deepEqual(byMouse.build.state.planned, byKeyboard.build.state.planned)
  assert.deepEqual(byDriver.build.state.planned, byKeyboard.build.state.planned)
  // Not just the plan: the whole state, camera and cursor and message included.
  assert.deepEqual(byMouse.build.state, byKeyboard.build.state)
  assert.deepEqual(byDriver.build.state, byKeyboard.build.state)
  assert.equal(
    screenText(byMouse),
    screenText(byKeyboard),
  )
  assert.equal(
    screenText(byDriver),
    screenText(byKeyboard),
  )
})

test("after a placement the keyboard goes back to where the arming came from, disarmed (owner, 2026-09-29)", () => {
  // The owner answered "always back to the menu" (2026-09-27), replacing the first build's "stays armed after
  // placing", and refined it: armed on the map, the keyboard stays on the map in plain
  // navigation; armed from the menu, it goes back to the menu.
  for (const start of ["grid", "menu"] as const) {
    const { build, layout } = session()
    build.dispatch({ kind: "focus", target: start })
    build.handleData("1", layout)
    assert.equal(build.state.armed, 0)
    build.run([{ kind: "move-cursor", dx: 8, dy: 0 }])
    build.handleData(ENTER, layout)
    assert.equal(build.state.planned.length, 1)
    assert.equal(build.state.armed, null, "a placement disarms")
    assert.equal(build.state.focus, start)
    assert.equal(build.state.exploreMap, false)
    assert.equal(build.state.menuHighlight, entryOfConstruct(0), "the highlight stays on the row just built from")
    assert.match(build.state.status.text, /Barracks placed \(resources: 60\) - \[u\] undo/)
  }
})

test("keyboard: Space places, exactly like Enter", () => {
  const bySpace = session()
  bySpace.build.handleData("1", bySpace.layout)
  bySpace.build.run([{ kind: "move-cursor", dx: 8, dy: 0 }])
  bySpace.build.handleData(" ", bySpace.layout)

  const byEnter = session()
  byEnter.build.handleData("1", byEnter.layout)
  byEnter.build.run([{ kind: "move-cursor", dx: 8, dy: 0 }])
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
  build.run([{ kind: "move-cursor", dx: 8, dy: 0 }])
  build.handleData(ENTER, layout)
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 1)
  assert.equal(build.state.armed, 0)
  assert.equal(build.state.focus, "grid")

  const onMap = session()
  onMap.build.handleData("1", onMap.layout)
  onMap.build.run([{ kind: "move-cursor", dx: 8, dy: 0 }])
  onMap.build.handleData(ENTER, onMap.layout)
  onMap.build.handleData(ENTER, onMap.layout)
  assert.equal(onMap.build.state.planned.length, 1)
  assert.equal(onMap.build.state.armed, null)
  assert.equal(onMap.build.state.exploreMap, true)
})

test("keyboard: Shift+Arrow and its modifier-free fallback are both the fast move, a jump of the Shift jump", () => {
  // Measured, not assumed — scripts/probe-modified-keys.mjs found three live encodings for a
  // shifted arrow and none at all on several terminals, which is why all of these are bound. How far
  // it jumps is the "Jump distance" setting (`jumpStep`), at its default here.
  const context = { itemCount: 3, armed: false }
  const fast = defaultValue("jumpStep")
  assert.deepEqual(buildKeyboardCommand(RIGHT, context), { kind: "move-cursor", dx: 1, dy: 0 })
  assert.deepEqual(buildKeyboardCommand(SHIFT_RIGHT, context), { kind: "move-cursor", dx: fast, dy: 0 })
  assert.deepEqual(buildKeyboardCommand(RXVT_SHIFT_RIGHT, context), { kind: "move-cursor", dx: fast, dy: 0 })
  assert.deepEqual(buildKeyboardCommand(PAGE_DOWN, context), { kind: "move-cursor", dx: 0, dy: fast })
  // Home and End have three live spellings between xterm, screen/tmux/linux and rxvt; all of them
  // mean the same move.
  for (const home of [`${ESC}OH`, `${ESC}[1~`, `${ESC}[7~`, `${ESC}[H`]) {
    assert.deepEqual(buildKeyboardCommand(home, context), { kind: "move-cursor", dx: -fast, dy: 0 })
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
  const fast = defaultValue("jumpStep")
  assert.deepEqual(buildKeyboardCommand(`${ESC}b`, context), { kind: "move-cursor", dx: -fast, dy: 0 })
  assert.deepEqual(buildKeyboardCommand(`${ESC}f`, context), { kind: "move-cursor", dx: fast, dy: 0 })
  assert.deepEqual(buildKeyboardCommand(`${ESC}${ESC}[A`, context), { kind: "move-cursor", dx: 0, dy: -fast })
  // End to end, through the real splitter: nothing is armed, and the screen is not left.
  const context2 = starterContext()
  const layout = buildLayout(MINIMUM, context2.grid)
  const build = readyBuildSession({ context: context2, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
  build.handleData(`${ESC}f`, layout)
  assert.equal(build.state.focus, "grid", "Option+Right was read as an Esc")
  assert.equal(build.state.popup, null, "Option+Right was read as an Esc")
  assert.equal(build.state.cursor.x, 18 + defaultValue("jumpStep"))
})

test("keyboard: digits always address the list, and a digit past its end means nothing", () => {
  const context = { itemCount: 3, armed: false }
  assert.deepEqual(buildKeyboardCommand("2", context), { kind: "arm", index: 1 })
  assert.equal(buildKeyboardCommand("4", context), null)
  assert.equal(buildKeyboardCommand("0", context), null)
})

test("keyboard: Esc is cancel and x is back in every focus, and q opens the game menu rather than quits", () => {
  // `x` walks back like Esc but never opens the game menu (tests/build-cancel.test.ts has what each does).
  for (const focus of ["menu", "grid"] as const) {
    for (const armed of [true, false]) {
      assert.deepEqual(buildKeyboardCommand(ESC, { itemCount: 3, armed, focus }), { kind: "cancel" })
      assert.deepEqual(buildKeyboardCommand("x", { itemCount: 3, armed, focus }), { kind: "back" })
      assert.deepEqual(buildKeyboardCommand("q", { itemCount: 3, armed, focus }), { kind: "open-game-menu" })
    }
  }
  // Inside the game menu, q is its Quit row's key; Ctrl+C always quits outright.
  const context = starterContext()
  const menu = applyBuildCommand(context, createBuildState(context, { x: 18, y: 13 }, { width: 48, height: 16 }), { kind: "open-game-menu" })
  assert.deepEqual(buildKeyboardCommand("q", { itemCount: 3, armed: false, popup: "game-menu", popupSpec: popupSpec(context, menu) }), { kind: "quit" })
  assert.deepEqual(buildKeyboardCommand(String.fromCharCode(3), { itemCount: 3, armed: false }), { kind: "quit" })
})

test("keyboard: a letter this screen does not bind means nothing at all", () => {
  // `t` was the click-mode toggle until it was retired. A retired binding that quietly still does
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
  assert.equal(build.state.cursor.y, startY + WHEEL_TILES)
  assert.ok(build.state.camera.y > before.y, "the camera followed the cursor south")
  build.handleData(formatMouseEvent(MOUSE_WHEEL_UP, 10, 10), layout)
  assert.equal(build.state.cursor.y, startY)
})

test("mouse: a click on a menu row arms it at once, and a right click goes back, disarming", () => {
  const { build, layout } = session()
  // The session starts in plain navigation, with the menu drawn beside the map: one click arms.
  build.handleData(clickRowBytes(layout, 1), layout)
  assert.equal(build.state.armed, 1)
  assert.equal(build.state.menuHighlight, entryOfConstruct(1))
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

test("a click on a tile only arms the preview there - a second click on the same tile places it", () => {
  const byClick = session()
  byClick.build.handleData("1", byClick.layout)
  // Recomputed fresh for each click, not the same bytes reused: the camera itself can move between
  // clicks (it does here, since the opening cursor needs a margin from the bottom the target row
  // does not), and what makes a real second click "the same tile" is landing on the same logical
  // tile as it now sits on screen, not replaying the identical bytes — that case is its own test.
  const clickAt2613 = (): void =>
    byClick.build.handleData(clickTileBytes(byClick.layout, byClick.build, { x: 26, y: 13 }), byClick.layout)
  clickAt2613()
  assert.equal(byClick.build.state.planned.length, 0, "the first click only moves the cursor")
  assert.deepEqual(byClick.build.state.cursor, { x: 26, y: 13 })
  clickAt2613()
  assert.equal(byClick.build.state.planned.length, 1, "the second click, on the same tile, places it")

  const byKeyboard = session()
  byKeyboard.build.handleData("1", byKeyboard.layout)
  byKeyboard.build.run([{ kind: "move-cursor", dx: 8, dy: 0 }])
  byKeyboard.build.handleData(ENTER, byKeyboard.layout)
  // The same plan, cursor and everything else. Only the camera may differ — a click scrolls the view
  // by its edge zones, the keyboard's move by the scroll margin — and a placement by the mouse leaves
  // no highlight bar on the menu.
  assert.deepEqual(
    { ...byClick.build.state, camera: null, highlightHidden: false },
    { ...byKeyboard.build.state, camera: null },
  )
  // Armed by its digit on the map, placed by the mouse: back on the map, where the arming began.
  assert.equal(byClick.build.state.focus, "grid")
})

test("a click that scrolled the camera is a fresh first click, not a mis-place on the wrong tile", () => {
  // A finding deliberately re-tested rather than assumed fixed: a first click within the
  // scroll margin can slide the Grid under the pointer, so replaying the same *screen position*
  // resolves to a different *tile* the second time. Comparing tile identity (what the mouse adapter
  // already resolves screen cells to) rather than screen position is what keeps this safe. An armed
  // click scrolls like any other since the owner asked for it (an Experiment until he kept it, 2026-09-30).
  // Without key timing (a driver script) there is no double click either.
  const { build, layout } = session()
  build.handleData("1", layout)
  // x=46 is near the east edge of the opening view (it shows 0-48), in the click's edge zone, so a click
  // there scrolls the camera east.
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
  const clickAt2613 = (): void =>
    build.handleData(clickTileBytes(layout, build, { x: 26, y: 13 }), layout)
  clickAt2613()
  clickAt2613()
  assert.equal(build.state.planned.length, 1)
  build.handleData("u", layout)
  assert.equal(build.state.planned.length, 0)
})

test("legality: an illegal placement is refused with a reason and nothing is moved to fit", () => {
  const { build, layout } = session()
  const context = starterContext()
  // A build range of 4, so the Nexus's own range reaches the row under the north-west wall: no rock stands
  // inside the range the map opens with at 3, and a building planned now gives none until it stands.
  build.dispatch({ kind: "experiment-adjust", field: "buildRange", step: 1 })
  build.handleData("1", layout)

  // The north-west wall: rock at 8,5 through 21,5.
  moveTo(build, { x: 19, y: 5 })
  const cursorBefore = { ...build.state.cursor }
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 0)
  assert.match(build.state.status.text, /rock in the way at 18,5/)
  assert.deepEqual(build.state.cursor, cursorBefore, "the cursor did not slide somewhere legal")

  // The standing Grid Nexus, at 17,10 through 19,11.
  moveTo(build, { x: 18, y: 10 })
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 0)
  assert.match(build.state.status.text, /the Citizen Nexus is here/)

  // Beyond the build range: the open ground east of the base.
  moveTo(build, { x: 34, y: 14 })
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 0)
  assert.match(build.state.status.text, /outside your build range at 33,14/)
  assert.deepEqual(build.state.cursor, { x: 34, y: 14 }, "the cursor did not slide into the range")

  // Beside the standing Barracks, in the room it keeps for its troops.
  moveTo(build, { x: 29, y: 10 })
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 0)
  assert.match(build.state.status.text, /too close to the Barracks - its troops need room/)

  // The Grid's own edge, where a 3x2 footprint hangs off it: a Nexus standing at the north-west corner, so the
  // range reaches the edge.
  const corner = { ...context, standing: [{ contentId: "structure.citizen.nexus", anchor: { x: 0, y: 3 } }] }
  const hanging = legalityAt(corner, [], "structure.citizen.barracks", anchorForCursor({ x: 0, y: 1 }, context.registry.get("structure.citizen.barracks").footprint))
  assert.match(hanging.ok ? "" : hanging.reason, /off the Grid/)

  // And a legal one, for contrast: the refusals above are about the tile, not about placement.
  moveTo(build, { x: 26, y: 13 })
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
  build.run([{ kind: "move-cursor", dx: 8, dy: 0 }, { kind: "place" }])
  assert.equal(build.state.planned.length, 1)
  build.handleData("1", layout)
  moveTo(build, { x: 27, y: 13 }) // one tile east of the first one's centre
  build.run([{ kind: "place" }])
  assert.equal(build.state.planned.length, 1)
  assert.match(build.state.status.text, /the Barracks is here/)
})

test("a plan is revisable: remove under the cursor, and undo the last one", () => {
  const { build, layout } = session()
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 8, dy: 0 }, { kind: "place" }, { kind: "arm", index: 0 }])
  moveTo(build, { x: 21, y: 13 })
  build.run([{ kind: "place" }])
  assert.equal(build.state.planned.length, 2)
  build.handleData("u", layout)
  assert.equal(build.state.planned.length, 1)
  // Backspace, on the Grid, removes whatever is under the cursor, wherever in the plan it came from.
  build.run([{ kind: "focus", target: "grid" }, { kind: "move-cursor", dx: 5, dy: 0 }])
  build.handleData(String.fromCharCode(127), layout)
  assert.equal(build.state.planned.length, 0)
  build.handleData("u", layout)
  assert.match(build.state.status.text, /Nothing to undo/)
})

test("the cursor points at a structure's centre tile, the way the scenario format already does", () => {
  const context = starterContext()
  const barracks = context.registry.get("structure.citizen.barracks")
  // A 3x2 footprint centres on its second column and its first row.
  assert.deepEqual(anchorForCursor({ x: 30, y: 14 }, barracks.footprint), { x: 29, y: 14 })
  const turret = context.registry.get("structure.bench.beamturret")
  assert.deepEqual(anchorForCursor({ x: 30, y: 14 }, turret.footprint), { x: 30, y: 14 })
})

test("every construct row names content that exists, costs something, and says what it does", () => {
  const context = starterContext()
  for (const item of STARTER_CATALOG) {
    assert.ok(context.registry.has(item.contentId), `${item.contentId} is not real content`)
    assert.ok(item.cost > 0, `${item.label} costs nothing`)
    // What it does is its card's words, written with the content; whether they fit the
    // panel is tests/build-card.test.ts's, which draws every card at 80 x 24.
    const words = cardText(context, item.contentId)
    assert.equal(words.title, item.label, `${item.label}'s card calls it something else`)
    assert.ok(words.subtitle.length > 0, `${item.label} does not say what it does`)
    assert.ok(words.description.length > 0, `${item.label} has no description`)
  }
})

test("the budget actually runs out, which is the only thing that makes the menu a choice", () => {
  // Asserted as behaviour rather than as arithmetic over the constants: what matters is that a
  // player placing things hits the wall, not that three particular numbers sum a particular way.
  const { build, layout } = session()
  build.handleData("1", layout) // the most expensive row
  const context = starterContext()
  assert.equal(remaining(context, build.state), STARTER_ALLOTMENT)

  // Placed wherever arming puts it — the nearest spot in the build range — and armed again, as a player does.
  let placed = 0
  for (let step = 0; step < 20 && !/costs/.test(build.state.status.text); step += 1) {
    build.run([{ kind: "place" }, { kind: "arm", index: 0 }])
    placed = build.state.planned.length
  }
  assert.ok(placed > 0, "nothing could be placed at all")
  assert.match(build.state.status.text, /costs \d+, \d+ left/, "the budget never ran out")
  assert.ok(remaining(context, build.state) >= 0, "spending went past the allotment")
})

test("spending is exactly as revisable as the plan: placing spends, removing and undoing refund", () => {
  const context = starterContext()
  const { build, layout } = session()
  const barracks = STARTER_CATALOG[0]!
  const turret = STARTER_CATALOG[2]!

  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 8, dy: 0 }, { kind: "place" }])
  assert.equal(spent(context, build.state), barracks.cost)

  // A Turret east of it, inside the standing Barracks's range and clear of both Barracks's room.
  build.handleData("3", layout)
  moveTo(build, { x: 29, y: 12 })
  build.run([{ kind: "place" }])
  assert.equal(spent(context, build.state), barracks.cost + turret.cost)
  assert.equal(remaining(context, build.state), STARTER_ALLOTMENT - barracks.cost - turret.cost)

  // Undo refunds the last one exactly, and Backspace refunds whichever is under the cursor.
  build.handleData("u", layout)
  assert.equal(spent(context, build.state), barracks.cost)
  build.run([{ kind: "focus", target: "grid" }, { kind: "move-cursor", dx: -3, dy: 1 }])
  build.handleData(String.fromCharCode(127), layout)
  assert.equal(spent(context, build.state), 0)
  assert.equal(remaining(context, build.state), STARTER_ALLOTMENT, "the allotment came back whole")
})

test("a placement that cannot be afforded is refused, and changes nothing at all", () => {
  const context = starterContext()
  const { build, layout } = session()
  // Spend down to less than the barracks costs, then try a barracks.
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 8, dy: 0 }, { kind: "place" }, { kind: "arm", index: 0 }])
  moveTo(build, { x: 21, y: 13 })
  build.run([{ kind: "place" }])
  const before = build.state
  const left = remaining(context, build.state)
  assert.ok(left < STARTER_CATALOG[0]!.cost, "the test did not actually spend enough to matter")

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
  const context = starterContext()
  // Onto rock, with a budget that cannot pay for it either. Reporting the rock would send the
  // player to move the cursor, which would not help. The rock of the north-west wall, at a build range of 8,
  // which brings the row under it, four rows up, into the Nexus's range.
  const anchor = anchorForCursor({ x: 19, y: 5 }, context.registry.get(STARTER_CATALOG[0]!.contentId).footprint)
  const broke = legalityAt(context, [], STARTER_CATALOG[0]!.contentId, anchor, 5, 8)
  assert.equal(broke.ok, false)
  assert.match(broke.ok === false ? broke.reason : "", /costs 40, 5 left/)
  // With money, the same tile reports the rock, and says which tile it means.
  const rich = legalityAt(context, [], STARTER_CATALOG[0]!.contentId, anchor, 100, 8)
  assert.equal(rich.ok, false)
  assert.match(rich.ok === false ? rich.reason : "", /rock in the way/)
  assert.deepEqual(rich.ok === false ? rich.tile : null, { x: 18, y: 5 })
  // The build range is reported before a tile too, for the same reason: at 6 the same rock is outside the
  // range, and moving off the rock would not help either.
  const beyond = legalityAt(context, [], STARTER_CATALOG[0]!.contentId, anchor, 100)
  assert.match(beyond.ok === false ? beyond.reason : "", /outside your build range/)
  assert.deepEqual(beyond.ok === false ? beyond.tile : null, { x: 18, y: 5 })
})

test("the buildings' digits run straight through the one list, with no mode to tell them apart", () => {
  // The first convention of docs/system-design/input.md: "digits always address the list; they never mean anything
  // else". Groups each counting from 1 would need a focus concept to disambiguate, which is the thing
  // that convention exists to forbid — so a hotkey addresses the whole menu.
  const hotkeys = STARTER_CATALOG.map((item) => item.hotkey)
  assert.deepEqual(hotkeys, [...new Set(hotkeys)], "two rows share a hotkey")
  assert.deepEqual(hotkeys, ["1", "2", "3"], "the digits do not run straight through the menu")
  const { build, layout } = session()
  build.handleData("3", layout)
  assert.equal(build.state.armed, 2, "the third digit armed the third row of the whole menu")
})

test("the buildings are one list in catalog order, one row each, with no group headings", () => {
  const context = starterContext()
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
    // Walk into the far south-east corner with the fast move, the way a player would.
    for (let step = 0; step < 40; step += 1) {
      build.handleData(SHIFT_RIGHT, layout)
      build.handleData(PAGE_DOWN, layout)
    }
    const grid = starterGrid()
    assert.deepEqual(build.state.cursor, { x: grid.width - 1, y: grid.height - 1 })
    assert.deepEqual(build.state.camera, {
      x: grid.width - layout.viewport.width,
      y: grid.height - layout.viewport.height,
    })
    // And back out again, to the opposite corner.
    for (let step = 0; step < 40; step += 1) {
      build.handleData(SHIFT_LEFT, layout)
      build.handleData(PAGE_UP, layout)
    }
    assert.deepEqual(build.state.cursor, { x: 0, y: 0 })
    assert.deepEqual(build.state.camera, { x: 0, y: 0 })
  }
})

test("the scroll margin is a share of the view: the tuned one, or another from --scroll-margin", () => {
  // It is a share of the view's width and height; the owner settled the share (a tuned value),
  // and `--scroll-margin` sets another for one run. 49 tiles wide at 80 columns: 5% is 2 tiles, 10% is 5,
  // 20% is 10, 25% is 12, 30% is 15. No --scroll-margin: the tuned value.
  const tuned = marginForView(TUNING.scrollMargin, buildLayout(MINIMUM, starterContext().grid).viewport).x
  for (const [percent, margin] of [[5, 2], [10, 5], [20, 10], [25, 12], [30, 15], [undefined, tuned]] as const) {
    const context = percent === undefined ? starterContext() : { ...starterContext(), scrollMargin: percent }
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
  const context = starterContext()
  const small = buildLayout(MINIMUM, context.grid)
  const build = readyBuildSession({ context, cursor: { x: 60, y: 30 }, viewport: small.viewport })
  const cursor = { ...build.state.cursor }
  build.resize(fitViewport(MAXIMUM, context.grid))
  assert.deepEqual(build.state.cursor, cursor)
  assert.deepEqual(build.state.viewport, { width: 72, height: 24 })
  assert.ok(build.state.camera.x >= 0 && build.state.camera.x <= context.grid.width - 72)
  assert.ok(build.state.camera.y >= 0 && build.state.camera.y <= context.grid.height - 24)
})

test("Esc walks back to the game menu; only its q quits, and neither touches the plan", () => {
  const context = starterContext()
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
  assert.equal(build.state.popup, "game-menu")
  build.handleData(ESC, layout) // Esc again keeps playing
  assert.equal(build.state.popup, null)
  assert.equal(quits, 0)
  build.handleData("q", layout) // q opens the game menu
  assert.equal(build.state.popup, "game-menu")
  assert.equal(quits, 0, "a bare q quit without asking")
  build.handleData("q", layout) // q in the game menu quits
  assert.equal(quits, 1)
  assert.equal(build.state.planned, planned, "nothing touched the plan")
})

test("two keys arriving in one chunk are two keys, not one", () => {
  // A bug found on a real terminal with the first menu screen, and no fake-stdin test had ever produced: the OS
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
  // than the starter map's own terrain, so the test does not have to reason about which other tiles a
  // move happens to land on.
  const width = 10
  const height = 10
  const tiles: TerrainId[] = new Array<TerrainId>(width * height).fill("terrain.plain")
  tiles[5 * width + 5] = "terrain.rock"
  const grid: GridTerrain = { width, height, tiles }
  const context = {
    grid,
    registry: FIXTURE_REGISTRY,
    catalog: STARTER_CATALOG,
    // A Nexus to build from, two rows below the tiles the test uses, so all of them are in its build range.
    standing: [{ contentId: "structure.citizen.nexus", anchor: { x: 4, y: 7 } }],
    allotment: STARTER_ALLOTMENT,
    nexusDraft: STARTER_NEXUS_DRAFT,
  }
  const build = readyBuildSession({ context, cursor: { x: 4, y: 5 }, viewport: { width: 10, height: 10 } })

  // Turret: a 1x1 footprint, so the cursor's own tile is the whole placement and there is no
  // footprint-centring arithmetic to account for. Armed beside the rock (arming never lands on one),
  // then moved onto it.
  build.dispatch({ kind: "arm", index: 2 })
  build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
  build.dispatch({ kind: "place" })
  assert.match(build.state.status.text, /Cannot build here/, "the test did not actually trigger a refusal")

  build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
  assert.doesNotMatch(build.state.status.text, /Cannot build here/)

  // A message about the last action, rather than about a tile, is the answer of that action: since
  // the bottom bar became one contextual line (owner, 2026-09-30) it lapses at the next
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
  // the attempt's own red answer lapses: the same sentence reads as looking, not trying.
  const width = 10
  const height = 10
  const tiles: TerrainId[] = new Array<TerrainId>(width * height).fill("terrain.plain")
  tiles[9 * width + 9] = "terrain.rock"
  const grid: GridTerrain = { width, height, tiles }
  const context = {
    grid,
    registry: FIXTURE_REGISTRY,
    catalog: STARTER_CATALOG,
    // A Nexus to build from, so the refusal is the rock's and names its tile.
    standing: [{ contentId: "structure.citizen.nexus", anchor: { x: 6, y: 7 } }],
    allotment: STARTER_ALLOTMENT,
    nexusDraft: STARTER_NEXUS_DRAFT,
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
