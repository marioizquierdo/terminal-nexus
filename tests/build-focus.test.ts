// Gate 5F and its second round: the menu on the left, keyboard focus, the smart cursor, popups, and
// the interaction patterns of `docs/ui-patterns.md` — driven through raw bytes into the real adapters
// where an adapter is what is being claimed, and through commands where the reducer is.

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_CATALOG } from "../src/build/catalog.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { GridTerrain, TerrainId } from "../src/grid/types.ts"
import { EXPLORE_ROW, NEXUS_ROW, buildLayout, cellForTile, constructLines, menuEntryRow } from "../src/build/layout.ts"
import { MOUSE_LEFT, formatMouseEvent } from "../src/build/mouse.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildContext } from "../src/build/state.ts"
import { anchorForCursor, entryOfConstruct, legalityAt, smartCursorTile } from "../src/build/state.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import type { BuildFlash } from "../src/view/build.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import { tilesOf } from "../src/grid/coords.ts"

const ESC = String.fromCharCode(27)
const UP = `${ESC}[A`
const DOWN = `${ESC}[B`
const RIGHT = `${ESC}[C`
const LEFT = `${ESC}[D`
const TAB = "\t"
const SPACE = " "
const ENTER = "\r"
const MINIMUM = { columns: 80, rows: 24 }
const MAXIMUM = { columns: 104, rows: 32 }
const WIDE = { columns: 128, rows: 24 }

type Side = { build: BuildSession; layout: ReturnType<typeof buildLayout>; context: BuildContext; quits: () => number }

function session(context: BuildContext = spikeContext(), terminal = MINIMUM): Side {
  const layout = buildLayout(terminal, context.grid)
  let quits = 0
  const build = new BuildSession({
    context,
    cursor: { x: 18, y: 13 },
    viewport: layout.viewport,
    onQuit: () => {
      quits += 1
    },
  })
  return { build, layout, context, quits: () => quits }
}

function keys(side: Side, ...sequence: string[]): void {
  for (const key of sequence) side.build.handleData(key, side.layout)
}

function screen(side: Side, flash?: BuildFlash) {
  const frame = composeBuildFrame(
    { context: side.context, state: side.build.state, layout: side.layout, ...(flash === undefined ? {} : { flash }) },
    "monochrome",
  )
  const text = frameToText(frame)
  return { frame, text, lines: text.split("\n") }
}

/** Whether the panel row is drawn as the inverse bar — "the keyboard is here". */
function barOn(side: Side, row: number, flash?: BuildFlash): boolean {
  const { frame } = screen(side, flash)
  return cellAt(frame, side.layout.panelColumn + side.layout.panelLimit - 1, row).style.inverse === true
}

function clickCell(side: Side, column: number, row: number): void {
  keys(side, formatMouseEvent(MOUSE_LEFT, column + 1, row + 1))
}

function clickTile(side: Side, tile: { x: number; y: number }): void {
  const cell = cellForTile(side.layout, side.build.state.camera, tile)
  clickCell(side, cell.x, cell.y)
}

function clickEntry(side: Side, row: number): void {
  clickCell(side, side.layout.panelColumn + 3, row)
}

const barracksRow = (side: Side): number =>
  menuEntryRow(side.layout, SPIKE_CATALOG, { kind: "construct", index: 0 }) as number

// --- Layout ---------------------------------------------------------------------------------------

test("the side panel is on the left of the Grid at every size in the supported range", () => {
  for (const terminal of [MINIMUM, MAXIMUM, WIDE, { columns: 92, rows: 28 }]) {
    const side = session(spikeContext(), terminal)
    const { layout } = side
    const { lines } = screen(side)
    assert.ok(layout.panelColumn < layout.dividerColumn, `panel left of the divider at ${terminal.columns}`)
    // The divider and the Grid's own west side are neighbouring columns (owner, 2026-09-27), so the
    // map's solid "ends here" bar never sits against the menu text.
    assert.equal(layout.gridBox.left, layout.dividerColumn + 1, "the Grid's west side is next to the divider")
    assert.equal(layout.origin.column, layout.gridBox.left + 1)
    assert.equal(layout.gridBox.right, layout.offset.column + layout.composition.width - 1)
    assert.equal(layout.panelRow, layout.origin.row)
    assert.match(lines[layout.panelRow + NEXUS_ROW] as string, /^\s*\| \[n\] Nexus \(1\)/)
    assert.match(lines[layout.panelRow + EXPLORE_ROW] as string, /^\s*\| \[e\] Explore/)
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
    const line = (x: number, y: number): boolean =>
      ["|", "+", "│", "┼", "├", "┤"].includes(cellAt(frame, x, y).glyph) || cellAt(frame, x, y).style.inverse === true
    assert.ok(!line(layout.dividerColumn, headerRow), "the divider crosses the top bar")
    for (let row = layout.footerRow; row < layout.footerRow + 3; row += 1) {
      assert.ok(!line(layout.dividerColumn, row), `the divider crosses the bottom bar at ${row}`)
    }
  }
})

test("a Grid shorter than the panel still closes directly under its last row", () => {
  const small: GridTerrain = { width: 20, height: 10, tiles: new Array<TerrainId>(200).fill("terrain.plain") }
  const side = session({ ...spikeContext(), grid: small, standing: [] })
  const { layout } = side
  const { frame, lines } = screen(side)
  assert.equal(layout.gridBox.bottom, layout.origin.row + 10)
  assert.ok(layout.paneBottom > layout.gridBox.bottom)
  for (let x = layout.gridBox.left + 1; x < layout.gridBox.right; x += 1) {
    assert.equal(cellAt(frame, x, layout.gridBox.bottom).style.inverse, true, "the whole map is visible: a solid edge")
  }
  assert.match(lines[menuEntryRow(layout, SPIKE_CATALOG, { kind: "construct", index: 2 })!] as string, /\[3\] Turret/)
  assert.match(lines[layout.footerRow] as string, /view x 0-19 y 0-9 of 20x10/)
})

// --- Focus: three plain modes ---------------------------------------------------------------------

test("the Build Phase opens on the menu, on the Nexus entry, with no cursor on the Grid", () => {
  const side = session()
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.menuHighlight, 0)
  assert.ok(barOn(side, side.layout.panelRow + NEXUS_ROW))
  const { frame, lines } = screen(side)
  assert.match(lines[side.layout.footerRow + 1] as string, /\| MENU {2}up\/down choose {2}enter\/space select {2}tab grid/)
  const cursor = cellForTile(side.layout, side.build.state.camera, side.build.state.cursor)
  assert.notEqual(cellAt(frame, cursor.x, cursor.y).style.inverse, true, "a cursor is drawn with the menu focused")
})

test("Tab and [e] go to the Grid exploring: no menu row marked, the bare cursor drawn", () => {
  for (const key of [TAB, "e"]) {
    const side = session()
    keys(side, key)
    assert.equal(side.build.state.focus, "grid")
    assert.equal(side.build.state.armed, null)
    const { frame, lines } = screen(side)
    assert.match(lines[side.layout.footerRow + 1] as string, /\| EXPLORE {2}arrows move/)
    for (const row of [NEXUS_ROW, EXPLORE_ROW]) assert.ok(!barOn(side, side.layout.panelRow + row))
    assert.ok(!barOn(side, barracksRow(side)))
    const cursor = cellForTile(side.layout, side.build.state.camera, side.build.state.cursor)
    assert.equal(cellAt(frame, cursor.x, cursor.y).style.inverse, true, "the exploring cursor is not drawn")
  }
})

test("placing: the armed row carries the bar and the cursor carries the ghost; leaving the Grid disarms", () => {
  const side = session()
  keys(side, "1")
  assert.equal(side.build.state.focus, "grid")
  assert.ok(barOn(side, barracksRow(side)), "the armed row is not marked")
  assert.match(screen(side).lines[side.layout.footerRow + 1] as string, /\| PLACE {2}arrows move/)
  keys(side, TAB)
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.armed, null, "a structure stayed armed with the keyboard on the menu")
})

test("Up/Down walk the whole menu — Nexus, Explore, the construct rows — and wrap", () => {
  const side = session()
  const entries = 2 + SPIKE_CATALOG.length
  keys(side, UP)
  assert.equal(side.build.state.menuHighlight, entries - 1)
  keys(side, DOWN)
  assert.equal(side.build.state.menuHighlight, 0)
  keys(side, DOWN, DOWN)
  assert.ok(barOn(side, barracksRow(side)))
})

test("Enter on Nexus opens its popup; on Explore goes exploring; on a construct row arms it", () => {
  const nexus = session()
  keys(nexus, SPACE)
  assert.equal(nexus.build.state.overlay, "nexus-powers")

  const explore = session()
  keys(explore, DOWN, ENTER)
  assert.equal(explore.build.state.focus, "grid")
  assert.equal(explore.build.state.armed, null)

  const arm = session()
  keys(arm, DOWN, DOWN, ENTER)
  assert.equal(arm.build.state.armed, 0)
  assert.equal(arm.build.state.focus, "grid")
})

test("a digit arms its row from either focus and leaves the cursor where it is", () => {
  for (const start of ["menu", "grid"] as const) {
    const side = session()
    side.build.dispatch({ kind: "focus", target: start })
    const cursor = side.build.state.cursor
    keys(side, "3")
    assert.equal(side.build.state.armed, 2)
    assert.equal(side.build.state.focus, "grid")
    assert.deepEqual(side.build.state.cursor, cursor, "a digit moved the cursor — only a menu arm may")
    assert.equal(side.build.state.menuHighlight, entryOfConstruct(2))
  }
})

test("Esc walks back a stack: popup, the information panel, the Grid, then the exit question", () => {
  const side = session()
  keys(side, TAB, ENTER) // exploring, then inspect what is under the cursor
  assert.equal(side.build.state.inspecting, true)
  keys(side, "n") // a popup on top of all of it
  assert.equal(side.build.state.overlay, "nexus-powers")
  keys(side, ESC)
  assert.equal(side.build.state.overlay, null)
  keys(side, "x") // x is Esc
  assert.equal(side.build.state.inspecting, false)
  assert.equal(side.build.state.focus, "grid")
  keys(side, ESC)
  assert.equal(side.build.state.focus, "menu")
  keys(side, ESC)
  assert.equal(side.build.state.overlay, "exit")
  assert.match(screen(side).text, /EXIT THE GAME\?/)
  keys(side, ESC)
  assert.equal(side.build.state.overlay, null, "Esc on the exit question keeps playing")
  assert.equal(side.quits(), 0)
})

test("the exit question: q asks, its own [q] quits, Ctrl+C always quits outright", () => {
  const side = session()
  keys(side, "q")
  assert.equal(side.build.state.overlay, "exit")
  assert.equal(side.quits(), 0)
  keys(side, "q")
  assert.equal(side.quits(), 1)
  const other = session()
  keys(other, String.fromCharCode(3))
  assert.equal(other.quits(), 1)
})

// --- Left/Right on the menu, and the row states -----------------------------------------------------

test("Left/Right on the menu flicker the row; a second Right in a row moves focus to the Grid", () => {
  const side = session()
  keys(side, RIGHT)
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.ack?.kind, "refused")
  keys(side, RIGHT)
  assert.equal(side.build.state.focus, "grid", "the second Right did not move focus")
  assert.equal(side.build.state.armed, null)

  // Anything between the two Rights resets it; Left only ever flickers.
  const reset = session()
  keys(reset, RIGHT, DOWN, RIGHT)
  assert.equal(reset.build.state.focus, "menu")
  keys(reset, LEFT, LEFT)
  assert.equal(reset.build.state.focus, "menu")
})

test("Backspace on the menu flickers the row and removes nothing under the hidden map cursor", () => {
  // It removes what is under the map cursor, which the menu hides (feedback F17): a flicker says the
  // key arrived, like Left does.
  const side = session()
  keys(side, "1", ENTER) // a Barracks, placed where the smart cursor put it; the keyboard is back on the menu
  assert.equal(side.build.state.planned.length, 1)
  assert.equal(side.build.state.focus, "menu")
  keys(side, "\u007f")
  assert.equal(side.build.state.planned.length, 1, "Backspace on the menu removed a building")
  assert.equal(side.build.state.ack?.kind, "refused")
  assert.equal(side.build.state.focus, "menu")
})

test("a popup's shadow is a dim shade, visible on the dark theme's near-black ground", () => {
  const side = session()
  keys(side, "n")
  const frame = screen(side).frame
  const text = frameToText(frame).split("\n")
  // The shade runs along the popup's bottom edge, one row below it.
  const shadowRow = text.findIndex((line) => line.includes("::::::::::"))
  assert.ok(shadowRow > 0, "no shadow row under the popup")
  const column = (text[shadowRow] as string).indexOf("::::::::::")
  assert.equal(cellAt(frame, column, shadowRow).style.dim, true)
})

test("a menu row is drawn in four states: plain, selected, pressed and refused", () => {
  const side = session()
  const row = side.layout.panelRow + NEXUS_ROW
  const last = side.layout.panelColumn + side.layout.panelLimit - 1
  const style = (flash?: BuildFlash) => cellAt(screen(side, flash).frame, last, row).style
  assert.equal(style().inverse, true, "selected")
  // Pressed: stronger than selected — bold and underlined, at every tier including monochrome.
  const pressed = style({ kind: "pressed", entry: 0 })
  assert.equal(pressed.inverse, true)
  assert.equal(pressed.underline, true)
  assert.equal(pressed.bold, true)
  // Refused: the bar dimmed for a moment against the bar it goes back to.
  assert.equal(style({ kind: "refused", entry: 0 }).dim, true)
  // Plain: another row.
  assert.notEqual(cellAt(screen(side).frame, last, side.layout.panelRow + EXPLORE_ROW).style.inverse, true)
})

test("every activation asks for a pressed flash, however it arrived: Enter, a hotkey, or a click", () => {
  for (const drive of [
    (side: Side) => keys(side, ENTER),
    (side: Side) => keys(side, "n"),
    (side: Side) => clickEntry(side, side.layout.panelRow + NEXUS_ROW),
  ]) {
    const side = session()
    drive(side)
    assert.deepEqual(side.build.state.ack, { seq: 1, kind: "pressed", entry: 0 })
  }
})

// --- Clicks ---------------------------------------------------------------------------------------

test("a first click on the menu from elsewhere only highlights; a click with the menu focused activates", () => {
  const side = session()
  keys(side, TAB)
  clickEntry(side, barracksRow(side))
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.armed, null, "the first click activated the row")
  assert.equal(side.build.state.menuHighlight, entryOfConstruct(0))
  clickEntry(side, barracksRow(side))
  assert.equal(side.build.state.armed, 0)
  // The Nexus entry highlights like every other row (owner, 2026-09-27).
  keys(side, TAB)
  clickEntry(side, side.layout.panelRow + NEXUS_ROW)
  assert.ok(barOn(side, side.layout.panelRow + NEXUS_ROW))
})

test("a click on the Grid takes focus there; exploring, a click on a building opens its information", () => {
  const side = session()
  clickTile(side, { x: 30, y: 14 })
  assert.equal(side.build.state.focus, "grid")
  assert.equal(side.build.state.inspecting, false)
  clickTile(side, { x: 18, y: 11 }) // the Grid Nexus
  assert.equal(side.build.state.inspecting, true)
  const { text } = screen(side)
  assert.match(text, /Citizen Nexus/)
  assert.match(text, /HEALTH {2,}400/)
  assert.match(text, /SIZE {2,}3x2/)
  assert.match(text, /\| INFO {2}arrows move {2}esc close/)
  assert.match(text, /\[esc\]/)
})

test("the information panel names what a planned building costs, and bare ground says what it is", () => {
  const side = session()
  keys(side, "1")
  side.build.run([
    { kind: "move-cursor", dx: 12, dy: 1 },
    { kind: "place" },
    { kind: "focus", target: "grid" },
    { kind: "inspect" },
  ])
  const planned = screen(side).text
  assert.match(planned, /Barracks/)
  assert.match(planned, /planned/)
  assert.match(planned, /COST {2,}40/)
  assert.match(planned, /Trains troopers each Pulse/)
  side.build.run([{ kind: "move-cursor", dx: 0, dy: 4 }])
  assert.match(screen(side).text, /Open ground/)
})

// --- Placing --------------------------------------------------------------------------------------

test("after a placement the keyboard is back on the menu, disarmed, and the status line says what is left", () => {
  const side = session()
  keys(side, DOWN, DOWN, DOWN, SPACE, SPACE) // highlight the Hatchery, arm, place
  assert.equal(side.build.state.planned.length, 1)
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.armed, null)
  assert.equal(side.build.state.menuHighlight, entryOfConstruct(1))
  assert.equal(side.build.state.status.text, "Hatchery placed (resources: 70) - [u] undo")
})

test("the owner's flow — highlight, then space, space, space, space — lays two buildings with no arrow key", () => {
  const side = session()
  keys(side, DOWN, DOWN, DOWN) // Nexus -> Explore -> Barracks -> Hatchery
  keys(side, SPACE, SPACE, SPACE, SPACE) // arm, place, arm again, place
  assert.deepEqual(
    side.build.state.planned.map((placement) => placement.anchor),
    [
      { x: 21, y: 10 },
      { x: 21, y: 13 },
    ],
  )
  assert.equal(side.build.state.focus, "menu")
})

test("a run from the menu lays out a tidy row: aligned, one free tile between, never touching", () => {
  const context: BuildContext = { ...spikeContext(), allotment: 1000 }
  const side = session(context)
  keys(side, DOWN, DOWN)
  for (let run = 0; run < 6; run += 1) keys(side, SPACE, SPACE)
  assert.deepEqual(
    side.build.state.planned.map((placement) => placement.anchor),
    [
      { x: 21, y: 10 },
      { x: 21, y: 13 },
      { x: 25, y: 13 },
      { x: 29, y: 13 },
      { x: 33, y: 13 },
      { x: 37, y: 13 },
    ],
  )
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

// --- The smart cursor (Q55) -----------------------------------------------------------------------

test("the smart cursor always lands on a legal tile, and the same plan always gets the same answer", () => {
  const context = spikeContext()
  for (const item of SPIKE_CATALOG) {
    const footprint = FIXTURE_REGISTRY.get(item.contentId).footprint
    const tile = smartCursorTile(context, [], item.contentId, { x: 0, y: 0 })
    assert.ok(tile !== null, `${item.label}: no tile`)
    assert.ok(legalityAt(context, [], item.contentId, anchorForCursor(tile, footprint)).ok, `${item.label}: illegal`)
    assert.deepEqual(smartCursorTile(context, [], item.contentId, { x: 50, y: 30 }), tile, "the answer depended on the cursor")
  }
})

test("the smart cursor falls back to the nearest free spot, and to none at all without moving", () => {
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
  side.build.run([{ kind: "highlight", delta: 1 }, { kind: "highlight", delta: 1 }, { kind: "activate" }])
  assert.equal(side.build.state.armed, 0)
  assert.deepEqual(side.build.state.cursor, cursor, "with nowhere to go the cursor should stay put")
})

test("with the smart cursor off, a menu arm leaves the cursor where it is", () => {
  const side = session({ ...spikeContext(), smartCursor: false })
  const cursor = side.build.state.cursor
  keys(side, DOWN, DOWN, SPACE)
  assert.equal(side.build.state.armed, 0)
  assert.deepEqual(side.build.state.cursor, cursor)
})

// --- Same plan, every adapter ---------------------------------------------------------------------

test("the focus flow by keyboard bytes and the same commands from a driver are the same state and frame", () => {
  const byKeyboard = session()
  keys(byKeyboard, SPACE, DOWN, SPACE) // open Nexus, pick the second, which closes it
  keys(byKeyboard, DOWN, DOWN, SPACE, SPACE) // highlight Barracks, arm, place
  keys(byKeyboard, DOWN, DOWN, SPACE, SPACE) // highlight Turret, arm, place
  keys(byKeyboard, "p", "y")

  const script: readonly BuildCommand[] = [
    { kind: "activate" },
    { kind: "highlight", delta: 1 },
    { kind: "activate" },
    { kind: "highlight", delta: 1 },
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
  keys(byMouse, "n", "2")
  for (const placement of byKeyboard.build.state.planned) {
    const index = SPIKE_CATALOG.findIndex((item) => item.contentId === placement.contentId)
    const row = menuEntryRow(byMouse.layout, SPIKE_CATALOG, { kind: "construct", index }) as number
    clickEntry(byMouse, row)
    if (byMouse.build.state.armed === null) clickEntry(byMouse, row)
    const offset = anchorForCursor({ x: 0, y: 0 }, FIXTURE_REGISTRY.get(placement.contentId).footprint)
    const centre = { x: placement.anchor.x - offset.x, y: placement.anchor.y - offset.y }
    // A click on the tile the cursor already sits on is the confirming click (Q52).
    if (byMouse.build.state.cursor.x !== centre.x || byMouse.build.state.cursor.y !== centre.y) clickTile(byMouse, centre)
    clickTile(byMouse, centre)
  }
  keys(byMouse, "p", "y")
  assert.deepEqual(byMouse.build.state.planned, byKeyboard.build.state.planned)
  assert.equal(byMouse.build.state.nexusPick, byKeyboard.build.state.nexusPick)
  assert.equal(byMouse.build.state.committed, true)
})

test("every construct row the menu draws is reachable by Up/Down", () => {
  const base = session()
  for (const line of constructLines(base.layout, SPIKE_CATALOG)) {
    if (line.kind !== "item") continue
    const side = session()
    for (let step = 0; step < entryOfConstruct(line.index); step += 1) keys(side, DOWN)
    assert.ok(barOn(side, line.row), `row ${line.index} is never highlighted`)
  }
})
