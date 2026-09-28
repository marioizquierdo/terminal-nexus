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
import {
  EXPLORE_ENTRY,
  NEXUS_ENTRY,
  anchorForCursor,
  entryOfConstruct,
  legalityAt,
  menuEntries,
  smartCursorTile,
} from "../src/build/state.ts"
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
    // Explore Map first, then the Nexus Powers (owner, 2026-09-28, feedback F23).
    assert.equal(EXPLORE_ROW, 0)
    assert.match(lines[layout.panelRow + EXPLORE_ROW] as string, /^\s*\| \[e\] Explore Map /)
    assert.match(lines[layout.panelRow + NEXUS_ROW] as string, /^\s*\| \[n\] Nexus \(1\)/)
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

test("the Build Phase opens on the menu, on its first entry, Explore Map, with no cursor on the Grid", () => {
  const side = session()
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.menuHighlight, EXPLORE_ENTRY)
  assert.ok(barOn(side, side.layout.panelRow + EXPLORE_ROW))
  const { frame, lines } = screen(side)
  assert.match(lines[side.layout.footerRow + 1] as string, /\| MENU {2}up\/down choose {2}enter\/space select {2}tab grid/)
  const cursor = cellForTile(side.layout, side.build.state.camera, side.build.state.cursor)
  assert.notEqual(cellAt(frame, cursor.x, cursor.y).style.inverse, true, "a cursor is drawn with the menu focused")
})

test("Tab, [e], Enter on the first entry and a second Right all arrive in Explore Map: the panel names it and follows the cursor", () => {
  for (const sequence of [[TAB], ["e"], [ENTER], [RIGHT, RIGHT]]) {
    const side = session()
    keys(side, ...sequence)
    assert.equal(side.build.state.focus, "grid")
    assert.equal(side.build.state.armed, null)
    assert.equal(side.build.state.exploreMap, true, `${JSON.stringify(sequence)} did not open Explore Map`)
    const { frame, lines } = screen(side)
    assert.match(lines[side.layout.footerRow + 1] as string, /\| EXPLORE MAP {2}arrows move {2}tab\/esc menu/)
    // The header replaces the menu: an inverse bar naming the mode, with `[esc]` at its right.
    const header = lines[side.layout.panelRow] as string
    assert.match(header, /\| {2}EXPLORE MAP +\[esc\]\|/)
    assert.equal(cellAt(frame, side.layout.panelColumn + 3, side.layout.panelRow).style.inverse, true)
    assert.doesNotMatch(screen(side).text, /\[1\] Barracks/, "the menu is still drawn beside Explore Map")
    const cursor = cellForTile(side.layout, side.build.state.camera, side.build.state.cursor)
    assert.equal(cellAt(frame, cursor.x, cursor.y).style.inverse, true, "the exploring cursor is not drawn")
  }
  // No Enter needed: the card follows the cursor as it moves.
  const side = session()
  keys(side, "e")
  assert.match(screen(side).text, /Open ground/)
  side.build.run([{ kind: "move-cursor", dx: 0, dy: -2 }]) // onto the Grid Nexus
  assert.match(screen(side).text, /Citizen Nexus/)
  keys(side, ESC)
  assert.equal(side.build.state.focus, "menu", "Esc did not give the menu back")
  assert.equal(side.build.state.exploreMap, false)
  assert.match(screen(side).text, /\[1\] Barracks/)
})

test("placing: the armed row is marked armed, not with the keyboard's bar; leaving the Grid disarms", () => {
  const side = session()
  keys(side, "1")
  assert.equal(side.build.state.focus, "grid")
  // Armed is `>` and the name underlined in the hotkey's colour — never the bar, which means "the
  // keyboard is here, not chosen yet" (feedback F22).
  const { frame, lines } = screen(side)
  assert.match(lines[barracksRow(side)] as string, /^\s*\| > \[1\] Barracks +40\|/)
  assert.ok(!barOn(side, barracksRow(side)), "the armed row is drawn with the keyboard's bar")
  const name = cellAt(frame, side.layout.panelColumn + 6, barracksRow(side)).style
  assert.equal(name.underline, true)
  assert.equal(name.bold, true)
  assert.match(lines[side.layout.footerRow + 1] as string, /\| PLACE {2}arrows move/)
  keys(side, TAB)
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.armed, null, "a structure stayed armed with the keyboard on the menu")
})

test("Up/Down walk the whole menu — Explore Map, Nexus, the construct rows — and wrap", () => {
  const side = session()
  const entries = 2 + SPIKE_CATALOG.length
  keys(side, UP)
  assert.equal(side.build.state.menuHighlight, entries - 1)
  keys(side, DOWN)
  assert.equal(side.build.state.menuHighlight, 0)
  keys(side, DOWN, DOWN)
  assert.ok(barOn(side, barracksRow(side)))
})

test("Enter on Explore Map explores; on Nexus opens its popup; on a construct row arms it", () => {
  const explore = session()
  keys(explore, ENTER)
  assert.equal(explore.build.state.focus, "grid")
  assert.equal(explore.build.state.armed, null)
  assert.equal(explore.build.state.exploreMap, true)

  const nexus = session()
  keys(nexus, DOWN, SPACE)
  assert.equal(nexus.build.state.overlay, "nexus-powers")

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

test("Esc walks back a stack: popup, Explore Map to the menu, then the game menu", () => {
  const side = session()
  keys(side, TAB) // Explore Map
  assert.equal(side.build.state.exploreMap, true)
  keys(side, "n") // a popup on top of it
  assert.equal(side.build.state.overlay, "nexus-powers")
  keys(side, ESC)
  assert.equal(side.build.state.overlay, null)
  assert.equal(side.build.state.exploreMap, true, "closing the popup also left Explore Map")
  keys(side, "x") // x is Esc; Explore Map goes straight back to the menu (feedback F23)
  assert.equal(side.build.state.exploreMap, false)
  assert.equal(side.build.state.focus, "menu")
  keys(side, ESC)
  assert.equal(side.build.state.overlay, "menu")
  assert.match(screen(side).text, /MENU/)
  assert.match(screen(side).text, /\[s\] Settings/)
  assert.match(screen(side).text, /\[q\] Quit/)
  keys(side, ESC)
  assert.equal(side.build.state.overlay, null, "Esc on the game menu goes back to the game")
  assert.equal(side.quits(), 0)
})

test("the game menu: q opens it, its own [q] quits, Ctrl+C always quits outright", () => {
  const side = session()
  keys(side, "q")
  assert.equal(side.build.state.overlay, "menu")
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
  const row = side.layout.panelRow + EXPLORE_ROW
  const last = side.layout.panelColumn + side.layout.panelLimit - 1
  const style = (flash?: BuildFlash) => cellAt(screen(side, flash).frame, last, row).style
  assert.equal(style().inverse, true, "selected")
  // Pressed: stronger than selected — bold and underlined, at every tier including monochrome.
  const pressed = style({ kind: "pressed", entry: EXPLORE_ENTRY })
  assert.equal(pressed.inverse, true)
  assert.equal(pressed.underline, true)
  assert.equal(pressed.bold, true)
  // Refused: the bar dimmed for a moment against the bar it goes back to.
  assert.equal(style({ kind: "refused", entry: EXPLORE_ENTRY }).dim, true)
  // Plain: another row.
  assert.notEqual(cellAt(screen(side).frame, last, side.layout.panelRow + NEXUS_ROW).style.inverse, true)
})

test("every activation asks for a pressed flash, however it arrived: Enter, a hotkey, or a click", () => {
  for (const [drive, entry] of [
    [(side: Side) => keys(side, ENTER), EXPLORE_ENTRY],
    [(side: Side) => keys(side, "e"), EXPLORE_ENTRY],
    [(side: Side) => clickEntry(side, side.layout.panelRow + EXPLORE_ROW), EXPLORE_ENTRY],
    [(side: Side) => keys(side, "n"), NEXUS_ENTRY],
    [(side: Side) => clickEntry(side, side.layout.panelRow + NEXUS_ROW), NEXUS_ENTRY],
    [(side: Side) => clickEntry(side, barracksRow(side)), entryOfConstruct(0)],
  ] as const) {
    const side = session()
    drive(side)
    assert.deepEqual(side.build.state.ack, { seq: 1, kind: "pressed", entry })
  }
})

// --- Clicks (feedback F22: a click activates what it lands on) ------------------------------------

test("a click on a building's row arms it at once, whatever had focus, and its ghost is at the cursor", () => {
  // From the map a click opened: the menu is still drawn, and the ghost goes where the player was
  // looking — the cursor stays put rather than jumping back to the base.
  const side = session()
  clickTile(side, { x: 30, y: 14 })
  assert.equal(side.build.state.focus, "grid")
  assert.equal(side.build.state.exploreMap, false, "a click on the map from the menu hid the menu")
  assert.match(screen(side).text, /\[1\] Barracks/)
  assert.match(screen(side).lines[side.layout.footerRow + 1] as string, /\| MAP {2}arrows move {2}enter\/space explore/)
  clickEntry(side, barracksRow(side))
  assert.equal(side.build.state.armed, 0, "the click only highlighted the row")
  assert.equal(side.build.state.focus, "grid")
  assert.deepEqual(side.build.state.cursor, { x: 30, y: 14 }, "arming by click moved the cursor off the map spot")
  assert.match(screen(side).lines[barracksRow(side)] as string, /> \[1\] Barracks/)
  assert.match(screen(side).lines[side.layout.footerRow + 1] as string, /\| PLACE/)

  // Another row while placing: re-armed at once, still where the player is pointing.
  clickEntry(side, menuEntryRow(side.layout, SPIKE_CATALOG, { kind: "construct", index: 2 }) as number)
  assert.equal(side.build.state.armed, 2)
  assert.deepEqual(side.build.state.cursor, { x: 30, y: 14 })

  // With the menu in hand, a click is Enter's twin: the smart cursor, as Enter uses.
  const fromMenu = session()
  const byEnter = session()
  clickEntry(fromMenu, barracksRow(fromMenu))
  keys(byEnter, DOWN, DOWN, ENTER)
  assert.equal(fromMenu.build.state.armed, 0)
  assert.deepEqual(fromMenu.build.state.cursor, byEnter.build.state.cursor)
})

test("a second click on the same tile places, and the menu comes back with nothing looking chosen", () => {
  const side = session()
  clickTile(side, { x: 30, y: 14 })
  clickEntry(side, barracksRow(side))
  clickTile(side, { x: 30, y: 15 }) // moves the ghost
  assert.equal(side.build.state.planned.length, 0)
  clickTile(side, { x: 30, y: 15 }) // the same tile: places
  assert.equal(side.build.state.planned.length, 1)
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.armed, null)
  assert.equal(side.build.state.highlightHidden, true)
  for (const entry of menuEntries(side.context).keys()) {
    const row = menuEntryRow(side.layout, SPIKE_CATALOG, menuEntries(side.context)[entry]!) as number
    assert.ok(!barOn(side, row), `row ${entry} looks chosen after a mouse placement`)
  }
  assert.doesNotMatch(screen(side).lines[barracksRow(side)] as string, />/)

  // The first menu key only shows where the keyboard is — Down does not move, Enter does not act.
  const highlight = side.build.state.menuHighlight
  keys(side, DOWN)
  assert.equal(side.build.state.highlightHidden, false)
  assert.equal(side.build.state.menuHighlight, highlight)
  assert.ok(barOn(side, barracksRow(side)))
  keys(side, DOWN)
  assert.equal(side.build.state.menuHighlight, highlight + 1, "the second key did nothing")

  const enter = session()
  clickEntry(enter, barracksRow(enter))
  clickTile(enter, enter.build.state.cursor) // the smart cursor's tile: the confirming click
  assert.equal(enter.build.state.planned.length, 1)
  keys(enter, ENTER)
  assert.equal(enter.build.state.armed, null, "Enter acted on a row the player could not see")
  assert.equal(enter.build.state.highlightHidden, false)
  keys(enter, ENTER)
  assert.equal(enter.build.state.armed, 0)
})

test("a click on Nexus opens its popup and a click on Explore Map explores, from any focus", () => {
  const side = session()
  keys(side, "1") // placing
  clickEntry(side, side.layout.panelRow + NEXUS_ROW)
  assert.equal(side.build.state.overlay, "nexus-powers")
  assert.equal(side.build.state.armed, null, "the click on Nexus left a building armed behind the popup")
  assert.equal(side.build.state.focus, "menu")
  assert.ok(barOn(side, side.layout.panelRow + NEXUS_ROW), "the popup's own row is not lit behind it")
  keys(side, "1") // pick: the popup closes, back on the menu with nothing looking chosen
  assert.equal(side.build.state.overlay, null)
  assert.ok(!barOn(side, side.layout.panelRow + NEXUS_ROW))

  keys(side, "2") // placing again
  clickEntry(side, side.layout.panelRow + EXPLORE_ROW)
  assert.equal(side.build.state.exploreMap, true)
  assert.equal(side.build.state.armed, null)
  assert.match(screen(side).text, /EXPLORE MAP/)
})

test("in Explore Map a click on the map moves the card; a click on its panel gives the menu back and chooses nothing", () => {
  const side = session()
  keys(side, "e")
  clickTile(side, { x: 18, y: 11 }) // the Grid Nexus
  assert.equal(side.build.state.exploreMap, true)
  const { text } = screen(side)
  assert.match(text, /Citizen Nexus/)
  assert.match(text, /HEALTH {2,}400/)
  assert.match(text, /SIZE {2,}3x2/)
  // Any click on the panel — here where the Barracks row would be, were the menu drawn.
  clickEntry(side, barracksRow(side))
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.armed, null, "a click on a row nobody could see armed it")
  // Its `[esc]`, and a line of the card with no menu row under it, do the same.
  for (const cell of [
    { column: side.layout.panelColumn + side.layout.panelLimit - 2, row: side.layout.panelRow },
    { column: side.layout.panelColumn + 2, row: side.layout.panelRow + 2 },
  ]) {
    keys(side, "e")
    clickCell(side, cell.column, cell.row)
    assert.equal(side.build.state.focus, "menu", `a click at ${cell.column},${cell.row} did not give the menu back`)
  }
  // Enter on the map a click opened is Explore Map too.
  const map = session()
  clickTile(map, { x: 30, y: 14 })
  keys(map, ENTER)
  assert.equal(map.build.state.exploreMap, true)
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
  keys(byKeyboard, DOWN, SPACE, DOWN, SPACE) // highlight Nexus, open it, pick the second, which closes it
  keys(byKeyboard, DOWN, SPACE, SPACE) // highlight Barracks, arm, place
  keys(byKeyboard, DOWN, DOWN, SPACE, SPACE) // highlight Turret, arm, place
  keys(byKeyboard, "p", "y")

  const script: readonly BuildCommand[] = [
    { kind: "highlight", delta: 1 },
    { kind: "activate" },
    { kind: "highlight", delta: 1 },
    { kind: "activate" },
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

test("clicks as a terminal sends them and the driver's click commands are the same state and frame (feedback F22, F23)", () => {
  const byMouse = session()
  clickTile(byMouse, { x: 30, y: 14 }) // the map, the menu still drawn
  clickEntry(byMouse, barracksRow(byMouse)) // armed at once
  clickTile(byMouse, { x: 30, y: 15 })
  clickTile(byMouse, { x: 30, y: 15 }) // placed; the menu is back
  clickEntry(byMouse, byMouse.layout.panelRow + EXPLORE_ROW) // Explore Map
  clickTile(byMouse, { x: 18, y: 11 }) // the card shows the Grid Nexus
  clickCell(byMouse, byMouse.layout.panelColumn + 2, byMouse.layout.panelRow + 2) // the panel: the menu back
  clickEntry(byMouse, byMouse.layout.panelRow + NEXUS_ROW) // the Nexus popup

  const byDriver = session()
  byDriver.build.run([
    { kind: "click-tile", x: 30, y: 14 },
    { kind: "click-menu", entry: entryOfConstruct(0) },
    { kind: "click-tile", x: 30, y: 15 },
    { kind: "click-tile", x: 30, y: 15 },
    { kind: "click-menu", entry: EXPLORE_ENTRY },
    { kind: "click-tile", x: 18, y: 11 },
    { kind: "click-menu", entry: EXPLORE_ENTRY },
    { kind: "click-menu", entry: NEXUS_ENTRY },
  ])
  assert.equal(byMouse.build.state.planned.length, 1)
  assert.equal(byMouse.build.state.overlay, "nexus-powers")
  assert.deepEqual(byDriver.build.state, byMouse.build.state)
  assert.equal(screen(byDriver).text, screen(byMouse).text)
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
