// Gate 5F: layout and keyboard focus. The side panel moves to the left of the Grid, Tab moves
// keyboard focus between the menu and the Grid, arming from the menu lands the cursor on a tile the
// structure can go (Q55's smart cursor), focus after a placement goes back to wherever the arming
// came from (Q57's recommendation), and the Nexus power pick is a popup the player opens. Everything
// here is driven through raw bytes into the real adapters where an adapter is what is being claimed,
// and through commands where the reducer is.

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_CATALOG } from "../src/build/catalog.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { GridTerrain, TerrainId } from "../src/grid/types.ts"
import { NEXUS_ROW, buildLayout, cellForTile, constructLines, menuEntryRow } from "../src/build/layout.ts"
import { buildKeyboardCommand } from "../src/build/keyboard.ts"
import { MOUSE_LEFT, formatMouseEvent } from "../src/build/mouse.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildContext } from "../src/build/state.ts"
import { anchorForCursor, legalityAt, smartCursorTile } from "../src/build/state.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import { tilesOf } from "../src/grid/coords.ts"

const ESC = String.fromCharCode(27)
const UP = `${ESC}[A`
const DOWN = `${ESC}[B`
const RIGHT = `${ESC}[C`
const TAB = "\t"
const SPACE = " "
const ENTER = "\r"
const MINIMUM = { columns: 80, rows: 24 }
const MAXIMUM = { columns: 104, rows: 32 }
const WIDE = { columns: 128, rows: 24 }

function session(
  context: BuildContext = spikeContext(),
  terminal = MINIMUM,
): { build: BuildSession; layout: ReturnType<typeof buildLayout>; context: BuildContext } {
  const layout = buildLayout(terminal, context.grid)
  const build = new BuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
  return { build, layout, context }
}

function keys(side: ReturnType<typeof session>, ...sequence: string[]): void {
  for (const key of sequence) side.build.handleData(key, side.layout)
}

function screen(side: ReturnType<typeof session>) {
  const frame = composeBuildFrame({ context: side.context, state: side.build.state, layout: side.layout }, "monochrome")
  return { frame, text: frameToText(frame), lines: frameToText(frame).split("\n") }
}

/** Whether the panel row is drawn as the inverse bar — "the keyboard is here". */
function barOn(side: ReturnType<typeof session>, row: number): boolean {
  const { frame } = screen(side)
  return cellAt(frame, side.layout.panelColumn + side.layout.panelLimit - 1, row).style.inverse === true
}

// --- Layout ---------------------------------------------------------------------------------------

test("the side panel is on the left of the Grid at every size in the supported range", () => {
  for (const terminal of [MINIMUM, MAXIMUM, WIDE, { columns: 92, rows: 28 }]) {
    const side = session(spikeContext(), terminal)
    const { layout } = side
    const { lines } = screen(side)
    assert.ok(layout.panelColumn < layout.dividerColumn, `panel left of the divider at ${terminal.columns}`)
    assert.equal(layout.gridBox.left, layout.dividerColumn, "the divider is the Grid rectangle's west side")
    assert.equal(layout.origin.column, layout.dividerColumn + 1)
    assert.equal(layout.gridBox.right, layout.offset.column + layout.composition.width - 1)
    // The panel's first row is the Nexus Powers entry, beside the Grid's own first row.
    assert.equal(layout.panelRow, layout.origin.row)
    assert.match(lines[layout.panelRow + NEXUS_ROW] as string, /^\s*\| \[n\] Nexus Powers \(1\)/)
    // Still the arithmetic engine.md 3.1 derives the floor from: 1 + 30 + 48 + 1 = 80.
    assert.equal(layout.composition.width, 32 + layout.viewport.width * layout.tileWidth)
  }
})

test("the top bar and the bottom bar run the whole width — the divider stops at both rules", () => {
  for (const terminal of [MINIMUM, MAXIMUM, WIDE]) {
    const side = session(spikeContext(), terminal)
    const { layout } = side
    const { frame } = screen(side)
    const headerRow = layout.offset.row + 1
    // The bars' own text may pass through the divider's column — that is the point — but no line may.
    const line = new Set(["|", "+", "│", "┼", "├", "┤"])
    assert.ok(!line.has(cellAt(frame, layout.dividerColumn, headerRow).glyph), "the divider crosses the top bar")
    for (let row = layout.footerRow; row < layout.footerRow + 3; row += 1) {
      assert.ok(!line.has(cellAt(frame, layout.dividerColumn, row).glyph), `the divider crosses the bottom bar at ${row}`)
    }
    assert.equal(cellAt(frame, layout.dividerColumn, layout.gridBox.top).glyph, "+", "the divider does not start at the top rule")
    assert.equal(layout.headerLimit, layout.composition.width - 4)
  }
})

test("a Grid shorter than the panel still closes directly under its last row", () => {
  // The panel lost the two rows it used to share with the top bar, so a pane only as tall as a short
  // Grid could not hold the menu. The pane keeps the minimum viewport's height instead, and the Grid
  // closes on its own edge inside it.
  const small: GridTerrain = { width: 20, height: 10, tiles: new Array<TerrainId>(200).fill("terrain.plain") }
  const side = session({ ...spikeContext(), grid: small, standing: [] })
  const { layout } = side
  const { frame, lines } = screen(side)
  assert.equal(layout.gridBox.bottom, layout.origin.row + 10)
  assert.ok(layout.paneBottom > layout.gridBox.bottom)
  for (let x = layout.gridBox.left + 1; x < layout.gridBox.right; x += 1) {
    assert.equal(cellAt(frame, x, layout.gridBox.bottom).glyph, "=", "the whole Grid is visible, so its edge is heavy")
  }
  // The menu is whole, and nothing is drawn over the bottom bar.
  assert.match(lines[menuEntryRow(layout, SPIKE_CATALOG, { kind: "construct", index: 2 })!] as string, /\[3\] Turret/)
  assert.match(lines[layout.footerRow] as string, /view x 0-19 y 0-9 of 20x10/)
})

// --- Focus ----------------------------------------------------------------------------------------

test("the Build Phase opens with the menu focused on its first entry, the Nexus Powers", () => {
  const side = session()
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.menuHighlight, 0)
  assert.ok(barOn(side, side.layout.panelRow + NEXUS_ROW), "the highlight bar is not on the Nexus Powers entry")
  const { lines } = screen(side)
  assert.match(lines[side.layout.footerRow + 1] as string, /\| MENU {2}up\/down choose {2}enter\/space select {2}tab grid/)
})

test("Tab moves focus between the menu and the Grid, and the key help says which", () => {
  const side = session()
  keys(side, TAB)
  assert.equal(side.build.state.focus, "grid")
  assert.match(screen(side).lines[side.layout.footerRow + 1] as string, /\| GRID {2}arrows move/)
  assert.ok(!barOn(side, side.layout.panelRow + NEXUS_ROW), "the menu highlight is drawn while the Grid has focus")
  keys(side, RIGHT)
  assert.equal(side.build.state.cursor.x, 19, "an arrow on the Grid moves the cursor")
  keys(side, TAB)
  assert.equal(side.build.state.focus, "menu")
  keys(side, DOWN)
  assert.equal(side.build.state.menuHighlight, 1, "an arrow on the menu moves the highlight")
  assert.equal(side.build.state.cursor.x, 19, "an arrow on the menu moved the cursor too")
})

test("Up/Down walk the whole menu and wrap at both ends", () => {
  const side = session()
  const entries = 1 + SPIKE_CATALOG.length
  keys(side, UP)
  assert.equal(side.build.state.menuHighlight, entries - 1)
  keys(side, DOWN)
  assert.equal(side.build.state.menuHighlight, 0)
  keys(side, DOWN, DOWN)
  const turret = constructLines(side.layout, SPIKE_CATALOG).find((l) => l.kind === "item" && l.index === 1)!
  assert.ok(barOn(side, turret.row), "the bar did not follow the highlight onto the second construct row")
})

test("Enter or Space on the Nexus Powers entry opens the popup; on a construct row it arms and moves focus to the Grid", () => {
  const side = session()
  keys(side, SPACE)
  assert.equal(side.build.state.overlay, "nexus-powers")
  keys(side, ESC, DOWN, ENTER)
  assert.equal(side.build.state.overlay, null)
  assert.equal(side.build.state.armed, 0)
  assert.equal(side.build.state.armedFrom, "menu")
  assert.equal(side.build.state.focus, "grid")
})

test("a digit arms its row from either focus, moves focus to the Grid, and leaves the cursor alone", () => {
  for (const start of ["menu", "grid"] as const) {
    const side = session()
    side.build.dispatch({ kind: "focus", target: start })
    const cursor = side.build.state.cursor
    keys(side, "3")
    assert.equal(side.build.state.armed, 2)
    assert.equal(side.build.state.armedFrom, "hotkey")
    assert.equal(side.build.state.focus, "grid")
    assert.deepEqual(side.build.state.cursor, cursor, "a digit moved the cursor — only a menu arm may")
    // The highlight follows the armed row, so Tab back to the menu lands on it.
    assert.equal(side.build.state.menuHighlight, 3)
  }
})

test("Esc on the Grid hands focus back to the menu, disarming on the way; on the menu with nothing armed it leaves", () => {
  let backs = 0
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = new BuildSession({
    context,
    cursor: { x: 18, y: 13 },
    viewport: layout.viewport,
    onBack: () => {
      backs += 1
    },
  })
  build.handleData("1", layout)
  build.handleData(ESC, layout)
  assert.equal(build.state.armed, null)
  assert.equal(build.state.focus, "menu")
  assert.equal(backs, 0)
  build.handleData(TAB, layout)
  build.handleData(ESC, layout)
  assert.equal(build.state.focus, "menu", "Esc on the Grid with nothing armed did not return focus")
  assert.equal(backs, 0)
  build.handleData(ESC, layout)
  assert.equal(backs, 1, "Esc on the menu with nothing armed did not leave")
})

test("a click on the Grid takes focus there, and Backspace, u and p work from either focus", () => {
  const side = session()
  const cell = cellForTile(side.layout, side.build.state.camera, { x: 30, y: 14 })
  keys(side, formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1))
  assert.equal(side.build.state.focus, "grid")
  assert.deepEqual(side.build.state.cursor, { x: 30, y: 14 })
  for (const focus of ["menu", "grid"] as const) {
    const context = { itemCount: 3, armed: true, focus }
    assert.deepEqual(buildKeyboardCommand("\u007f", context), { kind: "remove" })
    assert.deepEqual(buildKeyboardCommand("u", context), { kind: "undo" })
    assert.deepEqual(buildKeyboardCommand("p", context), { kind: "commit" })
    assert.deepEqual(buildKeyboardCommand("n", context), { kind: "open-nexus-powers" })
  }
})

test("the effect line reads the highlighted row on the menu, and the armed one on the Grid", () => {
  const side = session()
  assert.match(screen(side).text, /Pick one before the Pulse/)
  keys(side, DOWN, DOWN)
  assert.match(screen(side).text, /Spawns swarmers, slowly/)
  keys(side, "1")
  assert.match(screen(side).text, /Trains troopers each Pulse/)
})

// --- Where focus goes after a placement (Q57) -----------------------------------------------------

test("Q57: after a placement focus goes back to wherever the arming came from", () => {
  const byMenu = session()
  keys(byMenu, DOWN, SPACE, SPACE)
  assert.equal(byMenu.build.state.planned.length, 1)
  assert.equal(byMenu.build.state.focus, "menu", "a menu-driven placement did not return focus to the menu")
  assert.equal(byMenu.build.state.armed, 0, "the item did not stay armed")

  const byDigit = session()
  keys(byDigit, "1")
  for (let step = 0; step < 12; step += 1) keys(byDigit, RIGHT)
  keys(byDigit, DOWN, ENTER)
  assert.equal(byDigit.build.state.planned.length, 1)
  assert.equal(byDigit.build.state.focus, "grid", "the digit fast path lost the Grid after one placement")
  // …so its second placement is arrows and Enter, exactly as engine.md 9.7 promises.
  for (let step = 0; step < 4; step += 1) keys(byDigit, RIGHT)
  keys(byDigit, ENTER)
  assert.equal(byDigit.build.state.planned.length, 2)
})

test("Q57: its other two answers are one context field away, for Debug Mode to offer", () => {
  for (const [rule, expected] of [
    ["menu", "menu"],
    ["grid", "grid"],
  ] as const) {
    const viaMenu = session({ ...spikeContext(), focusAfterPlace: rule })
    keys(viaMenu, DOWN, SPACE, SPACE)
    assert.equal(viaMenu.build.state.focus, expected)
    const viaDigit = session({ ...spikeContext(), focusAfterPlace: rule })
    keys(viaDigit, "1")
    viaDigit.build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
    assert.equal(viaDigit.build.state.focus, expected)
  }
})

// --- The smart cursor (Q55) -----------------------------------------------------------------------

test("the owner's own flow — down, down, space, place, space, place — needs no arrow key", () => {
  const side = session()
  keys(side, DOWN, DOWN, SPACE) // highlight the Hatchery, arm it: the cursor lands where it can go
  assert.equal(side.build.state.focus, "grid")
  keys(side, SPACE) // place; focus back to the menu, still on the Hatchery
  assert.equal(side.build.state.focus, "menu")
  keys(side, SPACE, SPACE) // arm again, the cursor moves on; place again
  const anchors = side.build.state.planned.map((placement) => placement.anchor)
  // One tile east of the Grid Nexus (17..19, 10..11) sharing its top row, then — east of that
  // would crowd the standing barracks — one tile south of the first, sharing its left column.
  assert.deepEqual(anchors, [
    { x: 21, y: 10 },
    { x: 21, y: 13 },
  ])
  assert.equal(side.build.state.focus, "menu")
})

test("a run from the menu lays out a tidy row: aligned, one free tile between, never touching", () => {
  const context: BuildContext = { ...spikeContext(), allotment: 1000 }
  const side = session(context)
  keys(side, DOWN)
  for (let run = 0; run < 6; run += 1) keys(side, SPACE, SPACE)
  const anchors = side.build.state.planned.map((placement) => placement.anchor)
  assert.deepEqual(anchors, [
    { x: 21, y: 10 },
    { x: 21, y: 13 },
    { x: 25, y: 13 },
    { x: 29, y: 13 },
    { x: 33, y: 13 },
    { x: 37, y: 13 },
  ])
  // Every structure keeps a free ring: no claimed tile, standing or planned, touches another's.
  const footprint = (contentId: string) => FIXTURE_REGISTRY.get(contentId).footprint
  const all = [
    ...context.standing.map((s) => tilesOf(s.anchor, footprint(s.contentId))),
    ...side.build.state.planned.map((p) => tilesOf(p.anchor, footprint(p.contentId))),
  ]
  for (let a = 0; a < all.length; a += 1) {
    for (let b = a + 1; b < all.length; b += 1) {
      for (const t of all[a]!) {
        for (const u of all[b]!) {
          assert.ok(Math.max(Math.abs(t.x - u.x), Math.abs(t.y - u.y)) >= 2, `structures ${a} and ${b} touch`)
        }
      }
    }
  }
})

test("the smart cursor always lands on a legal tile, and the same plan always gets the same answer", () => {
  const context = spikeContext()
  for (const [index, item] of SPIKE_CATALOG.entries()) {
    const footprint = FIXTURE_REGISTRY.get(item.contentId).footprint
    const tile = smartCursorTile(context, [], item.contentId, { x: 0, y: 0 })
    assert.ok(tile !== null, `${item.label}: no tile`)
    const legality = legalityAt(context, [], item.contentId, anchorForCursor(tile, footprint))
    assert.ok(legality.ok, `${item.label} landed on an illegal tile`)
    assert.deepEqual(smartCursorTile(context, [], item.contentId, { x: 50, y: 30 }), tile, "the answer depended on the cursor")
    void index
  }
})

test("the smart cursor falls back to the nearest free spot, and to none at all without moving", () => {
  // A 12x6 Grid of rock but for one 3x3 pocket, and no Nexus: the search starts from the cursor,
  // finds no aligned side, and takes the pocket's nearest tile to it.
  const width = 12
  const height = 6
  const tiles: TerrainId[] = new Array<TerrainId>(width * height).fill("terrain.rock")
  for (let y = 2; y <= 4; y += 1) for (let x = 8; x <= 10; x += 1) tiles[y * width + x] = "terrain.plain"
  const pocket: BuildContext = { ...spikeContext(), grid: { width, height, tiles }, standing: [] }
  assert.deepEqual(smartCursorTile(pocket, [], "structure.bench.beamturret", { x: 1, y: 1 }), { x: 8, y: 2 })

  const solid: BuildContext = { ...pocket, grid: { width, height, tiles: new Array<TerrainId>(72).fill("terrain.rock") } }
  assert.equal(smartCursorTile(solid, [], "structure.bench.beamturret", { x: 1, y: 1 }), null)
  const side = session(solid)
  const cursor = side.build.state.cursor
  side.build.run([{ kind: "highlight", delta: 1 }, { kind: "activate" }])
  assert.equal(side.build.state.armed, 0)
  assert.deepEqual(side.build.state.cursor, cursor, "with nowhere to go the cursor should stay put")
})

test("with the smart cursor off, a menu arm leaves the cursor where it is", () => {
  const side = session({ ...spikeContext(), smartCursor: false })
  const cursor = side.build.state.cursor
  keys(side, DOWN, SPACE)
  assert.equal(side.build.state.armed, 0)
  assert.deepEqual(side.build.state.cursor, cursor)
})

// --- Same plan, every adapter ---------------------------------------------------------------------

test("the focus flow by keyboard bytes and the same commands from a driver are the same state and frame", () => {
  const byKeyboard = session()
  keys(byKeyboard, SPACE, DOWN, SPACE, ESC) // open the Nexus Powers, pick the second, close
  keys(byKeyboard, DOWN, SPACE, SPACE) // highlight Barracks, arm, place
  keys(byKeyboard, DOWN, DOWN, SPACE, SPACE) // highlight Turret, arm, place
  keys(byKeyboard, "p", "y")

  const script: readonly BuildCommand[] = [
    { kind: "activate" },
    { kind: "highlight", delta: 1 },
    { kind: "activate" },
    { kind: "close-overlay" },
    { kind: "highlight", delta: 1 },
    { kind: "activate" },
    { kind: "place" },
    { kind: "highlight", delta: 1 },
    { kind: "highlight", delta: 1 },
    { kind: "activate" },
    { kind: "place" },
    { kind: "commit" },
    { kind: "confirm-commit", accept: true },
  ]
  const byDriver = session()
  byDriver.build.run(script)

  assert.equal(byKeyboard.build.state.committed, true, "the flow did not reach committed")
  assert.equal(byKeyboard.build.state.planned.length, 2)
  assert.deepEqual(byDriver.build.state, byKeyboard.build.state)
  assert.equal(screen(byDriver).text, screen(byKeyboard).text)

  // And a mouse player clicking the same rows and the same tiles plans the same thing.
  const byMouse = session()
  const click = (column: number, row: number): void => keys(byMouse, formatMouseEvent(MOUSE_LEFT, column + 1, row + 1))
  const clickTile = (tile: { x: number; y: number }): void => {
    const cell = cellForTile(byMouse.layout, byMouse.build.state.camera, tile)
    click(cell.x, cell.y)
  }
  keys(byMouse, "n", "2", ESC)
  const rowOf = (index: number): number => menuEntryRow(byMouse.layout, SPIKE_CATALOG, { kind: "construct", index })!
  for (const placement of byKeyboard.build.state.planned) {
    const index = SPIKE_CATALOG.findIndex((item) => item.contentId === placement.contentId)
    click(byMouse.layout.panelColumn + 4, rowOf(index))
    const footprint = FIXTURE_REGISTRY.get(placement.contentId).footprint
    const centre = { x: placement.anchor.x - anchorForCursor({ x: 0, y: 0 }, footprint).x, y: placement.anchor.y - anchorForCursor({ x: 0, y: 0 }, footprint).y }
    clickTile(centre)
    clickTile(centre)
  }
  keys(byMouse, "p", "y")
  assert.deepEqual(byMouse.build.state.planned, byKeyboard.build.state.planned)
  assert.equal(byMouse.build.state.nexusPick, byKeyboard.build.state.nexusPick)
  assert.equal(byMouse.build.state.committed, true)
})
