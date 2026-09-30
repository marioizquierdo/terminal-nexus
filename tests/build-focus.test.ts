// Gate 5F and its second round, and gate 5K: the menu on the left, keyboard focus and where it returns
// to, where arming puts the cursor, popups, and the interaction patterns of `docs/ui-patterns.md` — driven through raw bytes into the real adapters
// where an adapter is what is being claimed, and through commands where the reducer is.

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_CATALOG } from "../src/build/catalog.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { GridTerrain, TerrainId } from "../src/grid/types.ts"
import {
  CARD_HEADER_ROW,
  CARD_SEPARATOR_ROW,
  EXPLORE_ROW,
  NEXUS_ROW,
  CREDITS_ROW,
  buildLayout,
  cellForTile,
  constructLines,
  menuEntryRow,
  startRow,
} from "../src/build/layout.ts"
import { MOUSE_LEFT, formatMouseEvent } from "../src/build/mouse.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildContext } from "../src/build/state.ts"
import {
  ARM_SEARCH_TILES,
  EXPLORE_ENTRY,
  NEXUS_ENTRY,
  anchorForCursor,
  armingSpot,
  entryOfConstruct,
  legalityAt,
  menuEntries,
  nexusTile,
} from "../src/build/state.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { SPIKE_START_CURSOR } from "../src/build/catalog.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import type { BuildFlash } from "../src/view/build.ts"
import { hint } from "../src/build/help.ts"
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

/** A building's footprint: what arming asks `armingSpot` about (it takes a footprint since feedback
 *  F66, so Explore Map can ask it about one tile). */
const footprintOf = (contentId: string) => FIXTURE_REGISTRY.get(contentId).footprint

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
    // The divider is the Grid's own west side (owner, 2026-09-29, replacing a column of its own
    // beside it): the map's edge, drawn quietly in the map's own style, is the line beside the menu.
    assert.equal(layout.gridBox.left, layout.dividerColumn, "the Grid's west side is the divider")
    assert.equal(layout.origin.column, layout.gridBox.left + 1)
    assert.equal(layout.gridBox.right, layout.offset.column + layout.composition.width - 1)
    assert.equal(layout.panelRow, layout.origin.row)
    // Explore Map on the top line and the Nexus Powers straight under it (owner, 2026-09-28 and
    // 2026-09-30, feedback F23, F72); then the credits line, against the divider where the costs are,
    // with the map's resource symbol (F71).
    assert.deepEqual([EXPLORE_ROW, NEXUS_ROW, CREDITS_ROW], [0, 1, 2])
    assert.match(lines[layout.panelRow + EXPLORE_ROW] as string, /^\s*\| \[e\] Explore Map /)
    assert.match(lines[layout.panelRow + NEXUS_ROW] as string, /^\s*\| \[n\] Nexus \(1\)/)
    assert.match(lines[layout.panelRow + CREDITS_ROW] as string, /^\s*\| +\* 100[|+]/)
    // engine.md 3.1's floor arithmetic, 1 + 30 + 48 + 1 = 80, with the shared west side's column
    // given to the Grid: 1 + 29 + 49 + 1 at 80 columns.
    assert.equal(layout.composition.width, 31 + layout.viewport.width * layout.tileWidth)
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
    // The bottom bar is one row since feedback F59, directly above the frame's bottom border.
    assert.ok(!line(layout.dividerColumn, layout.footerRow), "the divider crosses the bottom bar")
    assert.equal(layout.footerRow, layout.offset.row + layout.composition.height - 2)
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
    assert.equal(cellAt(frame, x, layout.gridBox.bottom).style.fgRole, "chrome.edge", "the whole map is visible: the map's edge")
  }
  assert.match(lines[menuEntryRow(layout, SPIKE_CATALOG, { kind: "construct", index: 2 })!] as string, /\[3\] Turret/)
  // The bottom bar is as narrow as this small Grid's composition: its line keeps whole words and
  // leaves off the ones that do not fit (feedback F59 took the position readout that stood here).
  assert.ok(layout.footerLimit < hint(side.context, side.build.state).text.length, "the bar is not narrower than the hint here")
  assert.match(lines[layout.footerRow] as string, /\| Explore Map: look around and read what is on each tile\. \[enter\] +\|/)
})

// --- Focus: three plain modes ---------------------------------------------------------------------

test("the Build Phase opens on the menu, on its first entry, Explore Map, with no cursor on the Grid", () => {
  const side = session()
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.menuHighlight, EXPLORE_ENTRY)
  assert.ok(barOn(side, side.layout.panelRow + EXPLORE_ROW))
  const { frame, lines } = screen(side)
  // The bottom line opens on what the highlighted row is for (feedback F59).
  assert.match(lines[side.layout.footerRow] as string, /\| Explore Map: look around and read what is on each tile\. \[enter\] opens it\./)
  const cursor = cellForTile(side.layout, side.build.state.camera, side.build.state.cursor)
  assert.notEqual(cellAt(frame, cursor.x, cursor.y).style.inverse, true, "a cursor is drawn with the menu focused")
})

test("[e] and Enter on the first entry arrive in Explore Map: its row turns active, a separator, then the card", () => {
  for (const sequence of [["e"], [ENTER]]) {
    const side = session()
    keys(side, ...sequence)
    assert.equal(side.build.state.focus, "grid")
    assert.equal(side.build.state.armed, null)
    assert.equal(side.build.state.exploreMap, true, `${JSON.stringify(sequence)} did not open Explore Map`)
    assert.equal(side.build.state.returnTo, "menu")
    const { frame, lines } = screen(side)
    assert.match(lines[side.layout.footerRow] as string, /\| Explore Map\b/)
    assert.equal(hint(side.context, side.build.state).text, "Explore Map: arrows move, the panel shows what is here. [esc] goes back.")
    // Its own row is its header, in the active style every row shares (feedback F32, F67, F70): its own
    // hotkey, one `>` at its right end, the hotkey's colour and bold, no underline, no bar — and no
    // "[esc]" of its own.
    const headerRow = side.layout.panelRow + CARD_HEADER_ROW
    const header = lines[headerRow] as string
    assert.match(header, /^\s*\| \[e\] Explore Map +>[|+]/)
    assert.doesNotMatch(header, /\[esc\]/)
    assert.notEqual(cellAt(frame, side.layout.panelColumn + 6, headerRow).style.underline, true)
    assert.equal(cellAt(frame, side.layout.panelColumn + 6, headerRow).style.fgRole, "chrome.hotkey")
    assert.notEqual(cellAt(frame, side.layout.panelColumn + side.layout.panelLimit - 1, headerRow).style.inverse, true)
    // A separator across the panel, then the card.
    assert.equal((lines[side.layout.panelRow + CARD_SEPARATOR_ROW] as string).slice(side.layout.panelColumn, side.layout.dividerColumn), "-".repeat(side.layout.panelLimit))
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
  assert.equal(side.build.state.status.text, "", "Explore Map's own status outlived it")
  assert.match(screen(side).text, /\[1\] Barracks/)
})

test("the separator under Explore Map's row is the glyph pack's own line", () => {
  const side = session()
  keys(side, "e")
  const frame = composeBuildFrame({ context: side.context, state: side.build.state, layout: side.layout, glyphPack: "unicode" }, "monochrome")
  const line = frameToText(frame).split("\n")[side.layout.panelRow + CARD_SEPARATOR_ROW] as string
  assert.equal(line.slice(side.layout.panelColumn, side.layout.dividerColumn), "─".repeat(side.layout.panelLimit))
})

test("[e] is a toggle, and Esc and a click on its row are the same 'back': to where Explore Map was opened from", () => {
  for (const close of [["e"], [ESC], ["x"], ["click"]]) {
    // Opened from the menu: back to the menu.
    const fromMenu = session()
    keys(fromMenu, "e")
    if (close[0] === "click") clickEntry(fromMenu, fromMenu.layout.panelRow + EXPLORE_ROW)
    else keys(fromMenu, ...close)
    assert.equal(fromMenu.build.state.exploreMap, false, `${close[0]} did not close Explore Map`)
    assert.equal(fromMenu.build.state.focus, "menu")
    // Opened on the map, in plain navigation: back to plain navigation.
    const fromMap = session()
    keys(fromMap, TAB, "e")
    assert.equal(fromMap.build.state.returnTo, "grid")
    if (close[0] === "click") clickEntry(fromMap, fromMap.layout.panelRow + EXPLORE_ROW)
    else keys(fromMap, ...close)
    assert.equal(fromMap.build.state.exploreMap, false)
    assert.equal(fromMap.build.state.focus, "grid", `${close[0]} from the map left the map`)
    assert.match(screen(fromMap).lines[fromMap.layout.footerRow] as string, /\| Arrows move the cursor, \[enter\] explores here/)
  }
  // Enter or Space with Explore Map already open does nothing more.
  const side = session()
  keys(side, TAB, ENTER)
  assert.equal(side.build.state.exploreMap, true)
  keys(side, SPACE)
  assert.equal(side.build.state.exploreMap, true)
})

test("Tab arrives in plain navigation: the bare cursor, the menu still drawn beside it", () => {
  // A second Right did too, until the owner took it back (2026-09-30, feedback F55): Left and Right on
  // the menu only flicker the row now.
  for (const sequence of [[TAB]]) {
    const side = session()
    keys(side, ...sequence)
    assert.equal(side.build.state.focus, "grid")
    assert.equal(side.build.state.armed, null)
    assert.equal(side.build.state.exploreMap, false, `${JSON.stringify(sequence)} opened Explore Map`)
    const { frame, lines, text } = screen(side)
    assert.match(lines[side.layout.footerRow] as string, /\| Arrows move the cursor, \[enter\] explores here, a number arms a building\./)
    assert.match(text, /\[1\] Barracks/)
    const cursor = cellForTile(side.layout, side.build.state.camera, side.build.state.cursor)
    assert.equal(cellAt(frame, cursor.x, cursor.y).style.inverse, true, "the cursor is not drawn")
    // Enter there opens Explore Map, begun on the map; Esc from plain navigation is the menu.
    keys(side, ENTER)
    assert.equal(side.build.state.exploreMap, true)
    assert.equal(side.build.state.returnTo, "grid")
    keys(side, ESC, ESC)
    assert.equal(side.build.state.focus, "menu")
  }
})

test("placing: the armed row is marked armed, not with the keyboard's bar; leaving the Grid disarms", () => {
  const side = session()
  keys(side, "1")
  assert.equal(side.build.state.focus, "grid")
  // Armed, the panel is the building's card under its own row, drawn active: its own hotkey, one `>`,
  // the name bold in the hotkey's colour and not underlined — never the bar, which means "the keyboard
  // is here, not chosen yet" (feedback F22, F58, F67, F70).
  const { frame, lines } = screen(side)
  const headerRow = side.layout.panelRow + CARD_HEADER_ROW
  assert.match(lines[headerRow] as string, /^\s*\| \[1\] Barracks +>[|+]/)
  assert.ok(!barOn(side, headerRow), "the armed row is drawn with the keyboard's bar")
  const name = cellAt(frame, side.layout.panelColumn + 6, headerRow).style
  assert.notEqual(name.underline, true)
  assert.equal(name.bold, true)
  // A command that says nothing lets whatever arming said lapse; the bottom line then says how to place.
  side.build.run([{ kind: "focus", target: "grid" }])
  assert.match(screen(side).lines[side.layout.footerRow] as string, /\| Place the Barracks: arrows move, \[enter\] places, \[1\] or \[esc\] cancels\./)
  keys(side, TAB)
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.armed, null, "a structure stayed armed with the keyboard on the menu")
})

test("Up/Down walk the whole menu — Explore Map, Nexus, the construct rows, Start Pulse — and stop at both ends", () => {
  // They wrapped until the owner's 2026-09-30 feedback F75 ("should not rotate").
  const side = session()
  const entries = 3 + SPIKE_CATALOG.length
  keys(side, UP)
  assert.equal(side.build.state.menuHighlight, 0, "Up on the first row came round")
  keys(side, ...Array.from({ length: entries + 2 }, () => DOWN))
  assert.equal(side.build.state.menuHighlight, entries - 1, "Down did not stop on the last row")
  keys(side, UP, UP, UP, UP, UP, UP, UP, UP)
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
  assert.equal(nexus.build.state.popup, "nexus-powers")

  const arm = session()
  keys(arm, DOWN, DOWN, ENTER)
  assert.equal(arm.build.state.armed, 0)
  assert.equal(arm.build.state.focus, "grid")
})

test("a digit arms its row from either focus, where the cursor is when it fits there, and remembers which focus", () => {
  for (const start of ["menu", "grid"] as const) {
    const side = session()
    side.build.dispatch({ kind: "focus", target: start })
    const cursor = side.build.state.cursor
    keys(side, "3")
    assert.equal(side.build.state.armed, 2)
    assert.equal(side.build.state.focus, "grid")
    assert.equal(side.build.state.returnTo, start)
    assert.deepEqual(side.build.state.cursor, cursor, "the Turret fits where the cursor is, and the cursor moved")
    assert.equal(side.build.state.menuHighlight, entryOfConstruct(2))
  }
})

test("Esc walks back a stack: popup, Explore Map to the menu, then the game menu", () => {
  const side = session()
  keys(side, "e") // Explore Map, from the menu
  assert.equal(side.build.state.exploreMap, true)
  keys(side, "n") // a popup on top of it
  assert.equal(side.build.state.popup, "nexus-powers")
  keys(side, ESC)
  assert.equal(side.build.state.popup, null)
  assert.equal(side.build.state.exploreMap, true, "closing the popup also left Explore Map")
  keys(side, "x") // x is Esc; Explore Map goes back to the menu it was opened from (feedback F23, F32)
  assert.equal(side.build.state.exploreMap, false)
  assert.equal(side.build.state.focus, "menu")
  keys(side, ESC)
  assert.equal(side.build.state.popup, "game-menu")
  assert.match(screen(side).text, /MENU/)
  assert.match(screen(side).text, /\[s\] Settings/)
  assert.match(screen(side).text, /\[q\] Quit/)
  keys(side, ESC)
  assert.equal(side.build.state.popup, null, "Esc on the game menu goes back to the game")
  assert.equal(side.quits(), 0)
})

test("the game menu: q opens it, its own [q] quits, Ctrl+C always quits outright", () => {
  const side = session()
  keys(side, "q")
  assert.equal(side.build.state.popup, "game-menu")
  assert.equal(side.quits(), 0)
  keys(side, "q")
  assert.equal(side.quits(), 1)
  const other = session()
  keys(other, String.fromCharCode(3))
  assert.equal(other.quits(), 1)
})

// --- Left/Right on the menu, and the row states -----------------------------------------------------

test("Left/Right on the menu only flicker the row, however many come: the keyboard stays on the menu", () => {
  // Until 2026-09-30 a second Right moved focus to the Grid; the owner took it back (feedback F55).
  const side = session()
  for (const [index, key] of [RIGHT, RIGHT, LEFT, LEFT, RIGHT].entries()) {
    keys(side, key)
    assert.equal(side.build.state.focus, "menu", `key ${index + 1} moved the keyboard off the menu`)
    assert.deepEqual(side.build.state.ack, { seq: index + 1, kind: "refused", entry: EXPLORE_ENTRY })
  }
  assert.equal(side.build.state.armed, null)
})

test("Backspace on the menu flickers the row and removes nothing under the hidden map cursor", () => {
  // It removes what is under the map cursor, which the menu hides (feedback F17): a flicker says the
  // key arrived, like Left does.
  const side = session()
  keys(side, "1", ENTER) // a Barracks, armed from the menu and placed at the cursor; back on the menu
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
  // Refused (feedback F61): the bar stays exactly the bar — only the row's words grey for a moment
  // (dim, in monochrome, which has no grey).
  assert.deepEqual(style({ kind: "refused", entry: EXPLORE_ENTRY }), style())
  const word = cellAt(screen(side, { kind: "refused", entry: EXPLORE_ENTRY }).frame, side.layout.panelColumn + 1, row).style
  assert.equal(word.inverse, true)
  assert.equal(word.dim, true)
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
  // looking — the cursor stays put, since the building fits there.
  const side = session()
  clickTile(side, { x: 30, y: 14 })
  assert.equal(side.build.state.focus, "grid")
  assert.equal(side.build.state.exploreMap, false, "a click on the map from the menu hid the menu")
  assert.match(screen(side).text, /\[1\] Barracks/)
  assert.match(screen(side).lines[side.layout.footerRow] as string, /\| Arrows move the cursor, \[enter\] explores here/)
  clickEntry(side, barracksRow(side))
  assert.equal(side.build.state.armed, 0, "the click only highlighted the row")
  assert.equal(side.build.state.focus, "grid")
  assert.deepEqual(side.build.state.cursor, { x: 30, y: 14 }, "arming by click moved the cursor off the map spot")
  assert.match(screen(side).lines[side.layout.panelRow + CARD_HEADER_ROW] as string, /\[1\] Barracks +>/)
  assert.match(hint(side.context, side.build.state).text, /^Place the Barracks:/)
  assert.equal(side.build.state.returnTo, "menu", "a click on a row is the menu's, whatever had focus")

  // Another building while placing — by its digit, since the panel is the Barracks' card now and a
  // click on it goes back (feedback F58): refused, the Barracks still armed where the player is
  // pointing, until it is placed or cancelled (owner, 2026-09-30, feedback F69 — it re-armed at once
  // until then).
  keys(side, "3")
  assert.equal(side.build.state.armed, 0)
  assert.deepEqual(side.build.state.cursor, { x: 30, y: 14 })

  // With the menu in hand, a click is Enter's twin: the same spot, the same way back.
  const fromMenu = session()
  const byEnter = session()
  clickEntry(fromMenu, barracksRow(fromMenu))
  keys(byEnter, DOWN, DOWN, ENTER)
  assert.equal(fromMenu.build.state.armed, 0)
  assert.deepEqual(fromMenu.build.state.cursor, byEnter.build.state.cursor)
  assert.equal(fromMenu.build.state.returnTo, "menu")
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
  clickTile(enter, enter.build.state.cursor) // the arming spot's tile: the confirming click
  assert.equal(enter.build.state.planned.length, 1)
  keys(enter, ENTER)
  assert.equal(enter.build.state.armed, null, "Enter acted on a row the player could not see")
  assert.equal(enter.build.state.highlightHidden, false)
  keys(enter, ENTER)
  assert.equal(enter.build.state.armed, 0)
})

test("a click on Nexus opens its popup and a click on Explore Map explores, from either focus", () => {
  // From the map in plain navigation, where the menu is still drawn beside it. (While a building is
  // being placed the panel is its card, and a click on it goes back — feedback F58.)
  const side = session()
  keys(side, TAB)
  clickEntry(side, side.layout.panelRow + NEXUS_ROW)
  assert.equal(side.build.state.popup, "nexus-powers")
  assert.equal(side.build.state.armed, null)
  assert.equal(side.build.state.focus, "menu")
  // The popup's own row is drawn active behind it — its own hotkey and one `>`, not the keyboard's bar
  // (F32, F67, F70).
  assert.match(screen(side).lines[side.layout.panelRow + NEXUS_ROW] as string, /^\s*\| \[n\] Nexus \(1\) +>[|+]/)
  assert.ok(!barOn(side, side.layout.panelRow + NEXUS_ROW), "the popup's row is drawn with the keyboard's bar")
  keys(side, "1") // pick: the popup closes, back on the menu with nothing looking chosen
  assert.equal(side.build.state.popup, null)
  assert.ok(!barOn(side, side.layout.panelRow + NEXUS_ROW))
  assert.doesNotMatch(screen(side).lines[side.layout.panelRow + NEXUS_ROW] as string, />[|+]/)

  // From the menu.
  clickEntry(side, side.layout.panelRow + EXPLORE_ROW)
  assert.equal(side.build.state.exploreMap, true)
  assert.equal(side.build.state.armed, null)
  assert.match(screen(side).lines[side.layout.panelRow + CARD_HEADER_ROW] as string, /\[e\] Explore Map +>/)
})

test("in Explore Map a click on the map moves the card; a click on its panel closes it and chooses nothing", () => {
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
  // Its own row, and a line of the card with no menu row under it, do the same.
  for (const cell of [
    { column: side.layout.panelColumn + side.layout.panelLimit - 2, row: side.layout.panelRow + CARD_HEADER_ROW },
    { column: side.layout.panelColumn + 2, row: side.layout.panelRow + CARD_SEPARATOR_ROW + 1 },
  ]) {
    keys(side, "e")
    clickCell(side, cell.column, cell.row)
    assert.equal(side.build.state.focus, "menu", `a click at ${cell.column},${cell.row} did not give the menu back`)
  }
  // Enter in the plain navigation a click opened is Explore Map too.
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
    { kind: "open-explore" },
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

test("after a placement armed from the menu the keyboard is back on the menu, disarmed, and the status line says what is left", () => {
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
  // The first where the cursor is; the second, with the cursor on the first, one free tile east of it.
  assert.deepEqual(
    side.build.state.planned.map((placement) => placement.anchor),
    [
      { x: 18, y: 13 },
      { x: 21, y: 13 },
    ],
  )
  assert.equal(side.build.state.focus, "menu")
})

test("a run of the same building lays each one a free tile from the last, never touching", () => {
  const context: BuildContext = { ...spikeContext(), allotment: 1000 }
  const side = session(context)
  keys(side, DOWN, DOWN)
  for (let run = 0; run < 6; run += 1) keys(side, SPACE, SPACE)
  assert.deepEqual(
    side.build.state.planned.map((placement) => placement.anchor),
    // A row to the right (owner, 2026-09-29: "in most cases this should move the cursor only a few
    // tiles to the right"): a tile down costs twice a tile across.
    [
      { x: 17, y: 13 },
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

// --- Where arming puts the cursor (feedback F30) ------------------------------------------------------

test("arming puts the preview where the cursor is whenever the building fits there", () => {
  const context = spikeContext()
  for (const item of SPIKE_CATALOG) {
    assert.deepEqual(armingSpot(context, [], footprintOf(item.contentId), { x: 40, y: 20 }), { tile: { x: 40, y: 20 }, found: true })
  }
  // By every way of arming: a digit, Enter on the row, a click on it.
  for (const arm of [
    (side: Side) => keys(side, "1"),
    (side: Side) => keys(side, DOWN, DOWN, ENTER),
    (side: Side) => clickEntry(side, barracksRow(side)),
  ]) {
    const side = session()
    arm(side)
    assert.equal(side.build.state.armed, 0)
    assert.deepEqual(side.build.state.cursor, { x: 18, y: 13 })
  }
})

test("where it does not fit, the nearest spot within reach that leaves a free tile, then one that touches", () => {
  const context = spikeContext()
  const side = session()
  // The owner's flow: place a Barracks, press its key again — the cursor is on the new one.
  keys(side, TAB, "1", ENTER, "1")
  assert.deepEqual(side.build.state.planned[0]?.anchor, { x: 17, y: 13 })
  const spot = side.build.state.cursor
  assert.notDeepEqual(spot, { x: 18, y: 13 })
  const footprint = FIXTURE_REGISTRY.get("structure.citizen.barracks").footprint
  const anchor = anchorForCursor(spot, footprint)
  assert.ok(legalityAt(context, side.build.state.planned, "structure.citizen.barracks", anchor).ok)
  // A free tile between it and every other structure.
  const others = [...context.standing, ...side.build.state.planned].flatMap((s) => tilesOf(s.anchor, FIXTURE_REGISTRY.get(s.contentId).footprint))
  for (const t of tilesOf(anchor, footprint)) {
    for (const u of others) assert.ok(Math.max(Math.abs(t.x - u.x), Math.abs(t.y - u.y)) >= 2, "it touches a structure")
  }
  // Nearest: a free column to the right of the first — sideways is cheaper than down.
  assert.deepEqual(spot, { x: 22, y: 13 })

  // Touching is the fallback when nothing gapped is in reach: a corridor one Turret wide.
  const width = 8
  const height = 3
  const tiles: TerrainId[] = new Array<TerrainId>(width * height).fill("terrain.rock")
  for (let x = 0; x < width; x += 1) tiles[1 * width + x] = "terrain.plain"
  const corridor: BuildContext = { ...spikeContext(), grid: { width, height, tiles }, standing: [] }
  const planned = [{ ordinal: 1, contentId: "structure.bench.beamturret", anchor: { x: 3, y: 1 } }]
  assert.deepEqual(armingSpot(corridor, planned, footprintOf("structure.bench.beamturret"), { x: 3, y: 1 }), { tile: { x: 5, y: 1 }, found: true })
  const full = [0, 1, 2, 4, 5, 6, 7].map((x, index) => ({ ordinal: index + 2, contentId: "structure.bench.beamturret", anchor: { x, y: 1 } }))
  const crowded = [...planned, ...full.filter((p) => p.anchor.x !== 4)]
  assert.deepEqual(armingSpot(corridor, crowded, footprintOf("structure.bench.beamturret"), { x: 3, y: 1 }), { tile: { x: 4, y: 1 }, found: true })
})

test("sideways is cheaper than up or down, and ties go the same way every time: more horizontal, then east, then south", () => {
  // An open field with one Turret planned where the cursor is: four spots two tiles away tie on
  // distance; east wins.
  const width = 11
  const height = 11
  const open: BuildContext = {
    ...spikeContext(),
    grid: { width, height, tiles: new Array<TerrainId>(width * height).fill("terrain.plain") },
    standing: [],
  }
  const planned = [{ ordinal: 1, contentId: "structure.bench.beamturret", anchor: { x: 5, y: 5 } }]
  assert.deepEqual(armingSpot(open, planned, footprintOf("structure.bench.beamturret"), { x: 5, y: 5 }).tile, { x: 7, y: 5 })
  // With east blocked by rock, west; with both blocked, south before north.
  const rocky = (blocked: readonly { x: number; y: number }[]): BuildContext => {
    const tiles = new Array<TerrainId>(width * height).fill("terrain.plain")
    for (const tile of blocked) tiles[tile.y * width + tile.x] = "terrain.rock"
    return { ...open, grid: { width, height, tiles } }
  }
  const eastRock = rocky([{ x: 7, y: 5 }, { x: 7, y: 4 }, { x: 7, y: 6 }, { x: 8, y: 5 }, { x: 8, y: 4 }, { x: 8, y: 6 }])
  assert.deepEqual(armingSpot(eastRock, planned, footprintOf("structure.bench.beamturret"), { x: 5, y: 5 }).tile, { x: 3, y: 5 })
  // Rock two and three tiles east and west: four tiles east and two tiles south both cost 4 (a tile
  // down costs two across), and the tie goes to the more horizontal move. In the open field two east
  // (cost 2) always beats two south (cost 4).
  const walls = rocky([
    ...[4, 5, 6].flatMap((y) => [{ x: 7, y }, { x: 3, y }]),
    { x: 8, y: 5 },
    { x: 2, y: 5 },
  ])
  assert.deepEqual(armingSpot(walls, planned, footprintOf("structure.bench.beamturret"), { x: 5, y: 5 }).tile, { x: 9, y: 5 })
  assert.deepEqual(armingSpot(open, planned, footprintOf("structure.bench.beamturret"), { x: 5, y: 5 }).tile, { x: 7, y: 5 })
  // The answer is a function of the plan and the cursor alone: the same call, the same answer.
  assert.deepEqual(
    armingSpot(open, planned, footprintOf("structure.bench.beamturret"), { x: 5, y: 5 }),
    armingSpot(open, planned, footprintOf("structure.bench.beamturret"), { x: 5, y: 5 }),
  )
})

test("never chosen from the last building placed: the spot is nearest the cursor, wherever the last one went", () => {
  const side = session({ ...spikeContext(), allotment: 1000 })
  keys(side, TAB, "3", ENTER) // a Turret at 18,13, the cursor stays on it
  side.build.run([{ kind: "move-cursor", dx: 30, dy: 12 }]) // far away, on open ground
  keys(side, "3")
  assert.deepEqual(side.build.state.cursor, { x: 48, y: 25 }, "arming went back to the last building placed")
})

test(`nothing within ${ARM_SEARCH_TILES} tiles: one tile right and down, drawn as the building, not x, until moved or tried`, () => {
  // Solid rock with the cursor in a one-tile hole: nothing but a Turret fits anywhere, and a Barracks
  // fits nowhere.
  const width = 40
  const height = 30
  const tiles: TerrainId[] = new Array<TerrainId>(width * height).fill("terrain.rock")
  tiles[10 * width + 10] = "terrain.plain"
  const solid: BuildContext = { ...spikeContext(), grid: { width, height, tiles }, standing: [] }
  assert.deepEqual(armingSpot(solid, [], footprintOf("structure.citizen.barracks"), { x: 10, y: 10 }), { tile: { x: 11, y: 11 }, found: false })
  // Room further than twelve tiles away does not count.
  const far = [...tiles]
  for (let y = 0; y < 3; y += 1) for (let x = 25; x < 30; x += 1) far[y * width + x] = "terrain.plain"
  const beyond: BuildContext = { ...solid, grid: { width, height, tiles: far } }
  assert.equal(armingSpot(beyond, [], footprintOf("structure.citizen.barracks"), { x: 10, y: 10 }).found, false)
  assert.equal(armingSpot(beyond, [], footprintOf("structure.citizen.barracks"), { x: 14, y: 10 }).found, true, "13-ish tiles is within reach from here")

  const layout = buildLayout(MINIMUM, solid.grid)
  const build = new BuildSession({ context: solid, cursor: { x: 10, y: 10 }, viewport: layout.viewport })
  const side: Side = { build, layout, context: solid, quits: () => 0 }
  keys(side, TAB, "1")
  assert.equal(build.state.armed, 0)
  assert.deepEqual(build.state.cursor, { x: 11, y: 11 })
  assert.equal(build.state.noSpotFound, true)
  assert.match(build.state.status.text, /no room within 12 tiles/)
  const ghostTile = cellForTile(layout, build.state.camera, build.state.cursor)
  const drawn = () => cellAt(screen(side).frame, ghostTile.x, ghostTile.y).glyph
  assert.notEqual(drawn(), "x", "the ghost was drawn as the refusal's x")
  assert.match(screen(side).lines[layout.footerRow] as string, /no room within 12 tiles/)
  // Moving: the normal refusal drawing.
  keys(side, RIGHT, LEFT)
  assert.equal(build.state.noSpotFound, false)
  assert.equal(drawn(), "x")
  // Trying to place clears it too, with the refusal said loudly.
  const tried: Side = { ...side, build: new BuildSession({ context: solid, cursor: { x: 10, y: 10 }, viewport: layout.viewport }) }
  keys(tried, TAB, "1")
  assert.equal(tried.build.state.noSpotFound, true)
  keys(tried, ENTER)
  assert.equal(tried.build.state.noSpotFound, false)
  assert.equal(tried.build.state.planned.length, 0)
  assert.equal(tried.build.state.status.tone, "danger")
  // And Esc disarms: nothing left to draw as a ghost.
  keys(tried, ESC)
  assert.equal(tried.build.state.noSpotFound, false)
})

test("the cursor opens on the Grid Nexus, and the first building armed finds the nearest good spot around it", () => {
  const context = spikeContext()
  assert.deepEqual(nexusTile(context), SPIKE_START_CURSOR)
  const run = runBuildPlaytest({ steps: parseKeyScript("1") })
  assert.deepEqual(run.frames[0]?.state.cursor, SPIKE_START_CURSOR)
  const armed = run.frames[1]?.state
  assert.ok(armed !== undefined)
  assert.equal(armed.armed, 0)
  assert.notDeepEqual(armed.cursor, SPIKE_START_CURSOR, "the Barracks was left on top of the Nexus")
  const footprint = FIXTURE_REGISTRY.get("structure.citizen.barracks").footprint
  assert.ok(legalityAt(context, [], "structure.citizen.barracks", anchorForCursor(armed.cursor, footprint)).ok)
  assert.deepEqual(armed.cursor, { x: 22, y: 10 }, "one free column east of the Nexus")
  // A map with no Nexus has no default of its own.
  assert.equal(nexusTile({ ...context, standing: [] }), null)
})

// --- Where the keyboard goes back to (feedback F30) ------------------------------------------------------

test("a building armed on the map goes back to the map after a placement: plain navigation, the menu beside it", () => {
  const side = session()
  keys(side, TAB, "1", ENTER)
  assert.equal(side.build.state.planned.length, 1)
  assert.equal(side.build.state.focus, "grid")
  assert.equal(side.build.state.armed, null)
  assert.equal(side.build.state.exploreMap, false)
  assert.deepEqual(side.build.state.cursor, { x: 18, y: 13 }, "the cursor left the building just placed")
  // The placement's answer, then — at the next key that says nothing — the map's hint (feedback F59).
  assert.match(screen(side).lines[side.layout.footerRow] as string, /\| Barracks placed \(resources: 60\) - \[u\] undo/)
  assert.match(screen(side).text, /\[1\] Barracks/)
  keys(side, RIGHT)
  assert.match(screen(side).lines[side.layout.footerRow] as string, /\| Arrows move the cursor, \[enter\] explores here/)
  // From Explore Map too: a digit there is the map's.
  const exploring = session()
  keys(exploring, TAB, "e", "3", ENTER)
  assert.equal(exploring.build.state.focus, "grid")
  assert.equal(exploring.build.state.exploreMap, false)
})

test("Esc while placing disarms and goes back one level, to where the arming came from", () => {
  const onMap = session()
  keys(onMap, TAB, "1", ESC)
  assert.equal(onMap.build.state.armed, null)
  assert.equal(onMap.build.state.focus, "grid", "Esc from a map arming left the map")
  assert.equal(onMap.build.state.status.text, "Cancelled.")
  keys(onMap, ESC)
  assert.equal(onMap.build.state.focus, "menu")
  keys(onMap, ESC)
  assert.equal(onMap.build.state.popup, "game-menu")

  for (const arm of [[DOWN, DOWN, ENTER], ["1"]]) {
    const fromMenu = session()
    keys(fromMenu, ...arm, ESC)
    assert.equal(fromMenu.build.state.armed, null)
    assert.equal(fromMenu.build.state.focus, "menu", `${JSON.stringify(arm)} then Esc did not go back to the menu`)
  }
  const byClick = session()
  clickTile(byClick, { x: 30, y: 14 })
  clickEntry(byClick, barracksRow(byClick))
  keys(byClick, ESC)
  assert.equal(byClick.build.state.focus, "menu", "a click on a row is the menu's")
})

test("a mouse placement goes back to the menu, focused but unselected", () => {
  const side = session()
  clickTile(side, { x: 30, y: 14 }) // plain navigation, by the mouse
  clickEntry(side, barracksRow(side))
  const cell = cellForTile(side.layout, side.build.state.camera, side.build.state.cursor)
  clickCell(side, cell.x, cell.y)
  assert.equal(side.build.state.planned.length, 1)
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.highlightHidden, true)
  // A building armed on the map and placed by a click goes back to the map.
  const map = session()
  keys(map, TAB, "1")
  const at = cellForTile(map.layout, map.build.state.camera, map.build.state.cursor)
  clickCell(map, at.x, at.y)
  assert.equal(map.build.state.planned.length, 1)
  assert.equal(map.build.state.focus, "grid")
})

// --- One active style (feedback F32) ---------------------------------------------------------------

test("one active style for every row: a building armed, Explore Map open, the Nexus popup open, the Battle Round screen open", () => {
  // `[1] Barracks  >` (owner, 2026-09-30, feedback F67, F70): the row keeps its own hotkey, which ends
  // it, and one `>` at its right end points at the map. A building and Explore Map head their card;
  // Nexus and Start Pulse stay on the menu behind their popup.
  const cases: readonly [string, (side: Side) => void, (side: Side) => number][] = [
    ["building", (side) => keys(side, "1"), (side) => side.layout.panelRow + CARD_HEADER_ROW],
    ["explore", (side) => keys(side, "e"), (side) => side.layout.panelRow + CARD_HEADER_ROW],
    ["nexus", (side) => keys(side, "n"), (side) => side.layout.panelRow + NEXUS_ROW],
    ["start", (side) => keys(side, "n", "1", "s"), (side) => startRow(side.layout)],
  ]
  const looks: string[] = []
  for (const [name, drive, rowOf] of cases) {
    const side = session()
    drive(side)
    const row = rowOf(side)
    const { frame, lines } = screen(side)
    const drawn = (lines[row] as string).slice(side.layout.panelColumn, side.layout.dividerColumn)
    assert.match(drawn, /^\[[^\]x]\] \S.* >$/, `${name}: not drawn [key] ... >`)
    assert.doesNotMatch(drawn, />>$/, `${name}: still the old >>`)
    assert.doesNotMatch(drawn, /^>/, `${name}: still has the old leading marker`)
    assert.ok(!barOn(side, row), `${name}: drawn with the keyboard's bar`)
    const hotkey = cellAt(frame, side.layout.panelColumn + 1, row).style
    const label = cellAt(frame, side.layout.panelColumn + 6, row).style
    const arrow = cellAt(frame, side.layout.dividerColumn - 1, row).style
    looks.push(JSON.stringify([hotkey, label, arrow]))
    assert.notEqual(label.underline, true, `${name}: the name is underlined`)
    assert.equal(label.bold, true, `${name}: the name is not bold`)
    assert.equal(label.fgRole, "chrome.hotkey", `${name}: not in the hotkey's colour`)
    assert.equal(arrow.fgRole, "chrome.hotkey", `${name}: the > is not in the hotkey's colour`)
  }
  assert.equal(new Set(looks).size, 1, "the active rows are drawn differently")
})// --- Same plan, every adapter ---------------------------------------------------------------------

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
    { kind: "open-battle-round" },
    { kind: "start-pulse" },
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
  clickCell(byMouse, byMouse.layout.panelColumn + 2, byMouse.layout.panelRow + 2) // the panel: closes it
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
  assert.equal(byMouse.build.state.popup, "nexus-powers")
  assert.deepEqual(byDriver.build.state, byMouse.build.state)
  assert.equal(screen(byDriver).text, screen(byMouse).text)
})

test("every construct row the menu draws is reachable by Up/Down", () => {
  const base = session()
  for (const line of constructLines(base.layout, SPIKE_CATALOG)) {
    const side = session()
    for (let step = 0; step < entryOfConstruct(line.index); step += 1) keys(side, DOWN)
    assert.ok(barOn(side, line.row), `row ${line.index} is never highlighted`)
  }
})

test("undo and remove name the building the way the menu does", () => {
  const run = runBuildPlaytest({ steps: parseKeyScript("Tab 1 Enter u") })
  const last = run.frames.at(-1)
  assert.ok(last !== undefined)
  assert.match(last.state.status.text, /^Barracks undone, 40 back\.$/)
  const removed = runBuildPlaytest({ steps: parseKeyScript("Tab 1 Enter Bksp") }).frames.at(-1)
  assert.ok(removed !== undefined)
  assert.match(removed.state.status.text, /^Barracks removed, 40 back\.$/)
})
