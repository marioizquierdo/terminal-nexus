// The owner's second round on the menu spike (2026-09-30, docs/feedback/2026-09-30-menu-spike-round-2.md),
// the behaviour half: `x` walks back but never opens the game menu (F62); while a building is armed the
// menu stays on it (F69, F70); Explore Map opened from the menu puts the cursor on clear ground (F66);
// no popup has an "[esc] Back" row (F73); and every list stops at its ends, ramps when held and jumps
// with the fast move (F75). Driven through raw bytes into the real adapters where an adapter is what is
// claimed, and through commands where the reducer is.

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_CATALOG } from "../src/build/catalog.ts"
import { bottomLine, controlsLineCount, controlsPage, hint } from "../src/build/help.ts"
import { buildKeyboardCommand, cursorKeyOf } from "../src/build/keyboard.ts"
import { buildLayout, cellForTile, escHintSpan, escLabel, menuEntryRow } from "../src/build/layout.ts"
import { MOUSE_LEFT, MOUSE_RIGHT, formatMouseEvent } from "../src/build/mouse.ts"
import { popupSpec } from "../src/build/popup.ts"
import { BuildSession } from "../src/build/session.ts"
import { GAME_MENU_ROWS, SETTINGS_EXPORT_ROW, SETTINGS_ORDER, restartMessage } from "../src/build/settings.ts"
import type { BuildContext, BuildState } from "../src/build/state.ts"
import {
  EXPLORE_ENTRY,
  NEXUS_ENTRY,
  ONE_TILE,
  applyBuildCommand,
  armedPreview,
  armingSpot,
  entryOfConstruct,
  menuEntries,
  nexusTile,
  startEntry,
  structureAtTile,
} from "../src/build/state.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { spikeContext } from "../src/cli/spike.ts"
import type { TerrainId } from "../src/grid/types.ts"
import { keyboardCommand } from "../src/menu/keyboard.ts"
import { createMenuList } from "../src/menu/list.ts"
import { listKeyOf, stepListIndex } from "../src/menu/list-keys.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { frameToText } from "../src/view/frame.ts"

const ESC = String.fromCharCode(27)
const UP = `${ESC}[A`
const DOWN = `${ESC}[B`
const LEFT = `${ESC}[D`
const TAB = "\t"
const ENTER = "\r"
const SHIFT_UP = `${ESC}[1;2A`
const SHIFT_DOWN = `${ESC}[1;2B`
const RXVT_SHIFT_DOWN = `${ESC}[b`
const OPTION_DOWN = `${ESC}${ESC}[B`
const PAGE_UP = `${ESC}[5~`
const PAGE_DOWN = `${ESC}[6~`
const HOME = `${ESC}[H`
const END = `${ESC}[F`
const MINIMUM = { columns: 80, rows: 24 }

type Side = { build: BuildSession; layout: ReturnType<typeof buildLayout>; context: BuildContext; quits: () => number }

/** A Build Phase session at 80 x 24. The cursor opens on the Grid Nexus, as the real screen's does,
 *  unless told otherwise. */
function session(context: BuildContext = spikeContext(), cursor = nexusTile(context) ?? { x: 18, y: 10 }): Side {
  const layout = buildLayout(MINIMUM, context.grid)
  let quits = 0
  const build = new BuildSession({
    context,
    cursor,
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

/** Keys arriving at given times, as a live terminal delivers a held one: `[key, ms]` pairs. */
function timed(side: Side, sequence: readonly (readonly [string, number])[]): void {
  for (const [key, now] of sequence) side.build.handleData(key, side.layout, { now })
}

function clickCell(side: Side, column: number, row: number, button = MOUSE_LEFT): void {
  keys(side, formatMouseEvent(button, column + 1, row + 1))
}

function rightClickMap(side: Side): void {
  const cell = cellForTile(side.layout, side.build.state.camera, { x: side.build.state.camera.x + 20, y: side.build.state.camera.y + 8 })
  clickCell(side, cell.x, cell.y, MOUSE_RIGHT)
}

const barracksEntry = entryOfConstruct(0)

/** On the menu with nothing open — the "regular state" `x x x` must always reach (F62). */
function onMenu(state: BuildState): boolean {
  return state.focus === "menu" && state.popup === null && state.armed === null && !state.exploreMap
}

/** Presses `x` until the screen is on the menu, at most `limit` times, then twice more, and says how
 *  many it took: once there, `x` must change nothing at all. */
function xToMenu(side: Side, limit = 6): number {
  let presses = 0
  while (!onMenu(side.build.state) && presses < limit) {
    keys(side, "x")
    presses += 1
  }
  assert.ok(onMenu(side.build.state), `x x x did not reach the menu: ${JSON.stringify({ focus: side.build.state.focus, popup: side.build.state.popup })}`)
  const settled = side.build.state
  keys(side, "x", "x")
  assert.equal(side.build.state.popup, null, "x on the menu opened something")
  assert.equal(side.build.state.focus, "menu")
  assert.deepEqual(side.build.state.ack, settled.ack, "x on the menu flickered a row")
  assert.equal(side.build.state.menuHighlight, settled.menuHighlight)
  return presses
}

// --- F62: x walks back, and never opens the game menu -----------------------------------------------

test("x on the menu does nothing at all — no popup, no status, no flicker — while Esc opens the game menu", () => {
  const side = session()
  const before = side.build.state
  // The reducer returns the very same state: nothing happened.
  assert.equal(applyBuildCommand(side.context, before, { kind: "back" }), before)
  keys(side, "x")
  assert.equal(side.build.state.popup, null)
  assert.equal(side.build.state.status.text, "")
  assert.equal(side.build.state.ack, before.ack)
  // With a row just flickered and a status showing, x says nothing and flickers nothing of its own.
  keys(side, LEFT)
  const flickered = side.build.state.ack
  keys(side, "x")
  assert.equal(side.build.state.ack, flickered)
  // Esc, the top bar's label and q are the ways in; the label says so on the menu.
  assert.equal(escLabel(side.build.state), "menu [esc]")
  keys(side, ESC)
  assert.equal(side.build.state.popup, "menu")
  const byLabel = session()
  const label = escHintSpan(byLabel.layout, escLabel(byLabel.build.state))
  clickCell(byLabel, label.from + 1, label.row)
  assert.equal(byLabel.build.state.popup, "menu")
  const byQ = session()
  keys(byQ, "q")
  assert.equal(byQ.build.state.popup, "menu")
})

test("x x x from anywhere lands on the menu with the keyboard there, and stays", () => {
  const starts: readonly (readonly [string, readonly string[], number])[] = [
    // What is under way, and how many x it takes to walk back from it.
    ["placing, armed from the menu", [DOWN, DOWN, ENTER], 1],
    ["placing, armed by a digit on the menu", ["2"], 1],
    ["placing, armed on the map", [TAB, "1"], 2],
    ["Explore Map from the menu", ["e"], 1],
    ["Explore Map from the map", [TAB, "e"], 2],
    ["plain navigation", [TAB], 1],
    ["the game menu", [ESC], 1],
    ["Settings over the game menu", [ESC, "s"], 2],
    ["the export over Settings", ["d", "e"], 2],
    ["the Controls page", ["?"], 1],
    ["the Nexus powers over the map", [TAB, "n"], 2],
    ["Settings over a building placed on the map", [TAB, "1", "d"], 3],
  ]
  for (const [name, begin, levels] of starts) {
    const side = session()
    keys(side, ...begin)
    assert.ok(!onMenu(side.build.state), `${name}: began on the menu`)
    assert.equal(xToMenu(side), levels, `${name}: x walked back more than one level at a time`)
  }
  // The driver's `back` is the same walk.
  const driver = session()
  driver.build.run([{ kind: "focus", target: "grid" }, { kind: "arm", index: 0 }, { kind: "back" }, { kind: "back" }, { kind: "back" }])
  assert.ok(onMenu(driver.build.state))
})

test("Esc walks back the same levels, and on the menu opens the game menu", () => {
  const side = session()
  keys(side, TAB, "1", ESC)
  assert.equal(side.build.state.focus, "grid", "Esc from placing on the map left the map")
  keys(side, ESC)
  assert.ok(onMenu(side.build.state))
  keys(side, ESC)
  assert.equal(side.build.state.popup, "menu")
})

test("a right click walks back as x does, and never opens a menu", () => {
  const side = session()
  rightClickMap(side)
  assert.equal(side.build.state.popup, null, "a right click on the menu opened the game menu")
  // Placing: back to where it began; a popup: closed.
  keys(side, TAB, "1")
  rightClickMap(side)
  assert.equal(side.build.state.armed, null)
  assert.equal(side.build.state.focus, "grid")
  rightClickMap(side)
  assert.ok(onMenu(side.build.state))
  rightClickMap(side)
  assert.equal(side.build.state.popup, null)
  keys(side, ESC, "s")
  rightClickMap(side)
  assert.equal(side.build.state.popup, "menu", "a right click in Settings did not go back one popup")
  rightClickMap(side)
  assert.equal(side.build.state.popup, null)
  rightClickMap(side)
  assert.equal(side.build.state.popup, null)
})

test("on a committed plan x and a right click do nothing; Esc, q and the top bar's label open the game menu", () => {
  const side = session()
  keys(side, "n", "1", "s", "s")
  assert.equal(side.build.state.committed, true)
  assert.equal(escLabel(side.build.state), "menu [esc]")
  const committed = side.build.state
  // Nothing changes but the commit's own answer lapsing, as it does at any command that says nothing.
  const after = applyBuildCommand(side.context, committed, { kind: "back" })
  assert.deepEqual({ ...after, status: committed.status }, committed)
  assert.equal(after.status.text, "")
  keys(side, "x")
  rightClickMap(side)
  assert.equal(side.build.state.popup, null)
  keys(side, ESC)
  assert.equal(side.build.state.popup, "menu")
  keys(side, "x")
  assert.equal(side.build.state.popup, null, "x did not close the game menu over a committed plan")
  keys(side, "q")
  assert.equal(side.build.state.popup, "menu")
  keys(side, ESC)
  const label = escHintSpan(side.layout, escLabel(side.build.state))
  clickCell(side, label.from + 1, label.row)
  assert.equal(side.build.state.popup, "menu")
})

test("x closes every popup as Esc does, back to the one it was opened from", () => {
  for (const [begin, after] of [
    [["n"], null],
    [[ESC], null],
    [[ESC, "s"], "menu"],
    [[ESC, "c"], "menu"],
    [["d", "e"], "settings"],
    [["?"], null],
  ] as const) {
    const byX = session()
    keys(byX, ...begin, "x")
    const byEsc = session()
    keys(byEsc, ...begin, ESC)
    assert.equal(byX.build.state.popup, after, JSON.stringify(begin))
    assert.deepEqual(byX.build.state, byEsc.build.state, `${JSON.stringify(begin)}: x and Esc differ inside a popup`)
  }
  // A message popup too.
  const side = session()
  const state: BuildState = { ...side.build.state, popup: "message", message: restartMessage(["Opens on"]) }
  assert.equal(applyBuildCommand(side.context, state, { kind: "back" }).popup, null)
})

// --- F69, F70: while a building is armed, the menu stays on it ---------------------------------------

test("while a building is armed, another building's key, e and s are refused: nothing changes, the row flickers, the line says why", () => {
  for (const key of ["2", "3", "e", "s", "p"]) {
    for (const picked of [false, true]) {
      const side = session()
      if (picked) keys(side, "n", "1")
      keys(side, "1")
      const armed = side.build.state
      keys(side, key)
      const after = side.build.state
      assert.equal(after.armed, 0, `${key}: the Barracks was dropped`)
      assert.equal(after.popup, null, `${key}: something opened`)
      assert.equal(after.exploreMap, false)
      assert.equal(after.focus, "grid")
      assert.deepEqual(after.cursor, armed.cursor, `${key}: the cursor moved`)
      assert.equal(after.menuHighlight, barracksEntry)
      assert.deepEqual(after.planned, armed.planned)
      assert.deepEqual(after.ack, { seq: (armed.ack?.seq ?? 0) + 1, kind: "refused", entry: barracksEntry }, `${key}: no flicker on the armed row`)
      assert.equal(after.status.text, "Place the Barracks or cancel it first: [1] or [esc].")
      assert.equal(after.status.tone, "warning")
    }
  }
  // The driver's commands are refused the same way: the lock is the reducer's, not the keyboard's.
  for (const command of [{ kind: "arm", index: 1 }, { kind: "explore" }, { kind: "commit" }] as const satisfies readonly BuildCommand[]) {
    const byKey = session()
    keys(byKey, "1")
    byKey.build.dispatch(command)
    assert.equal(byKey.build.state.armed, 0)
    assert.match(byKey.build.state.status.text, /^Place the Barracks or cancel it first/)
  }
  // The Hatchery names its own key.
  const hatchery = session()
  keys(hatchery, "2", "1")
  assert.equal(hatchery.build.state.status.text, "Place the Hatchery or cancel it first: [2] or [esc].")
})

test("a building's own key cancels it, exactly as Esc does, back to where the placing began", () => {
  for (const begin of [["1"], [DOWN, DOWN, ENTER], [TAB, "1"]]) {
    const byKey = session()
    keys(byKey, ...begin, "1")
    const byEsc = session()
    keys(byEsc, ...begin, ESC)
    assert.equal(byKey.build.state.armed, null, `${JSON.stringify(begin)}: its own key did not cancel it`)
    assert.deepEqual(byKey.build.state, byEsc.build.state, `${JSON.stringify(begin)}: its own key is not Esc's twin`)
  }
  const fromMenu = session()
  keys(fromMenu, "1", "1")
  assert.equal(fromMenu.build.state.focus, "menu")
  assert.equal(fromMenu.build.state.menuHighlight, barracksEntry)
  const fromMap = session()
  keys(fromMap, TAB, "1", "1")
  assert.equal(fromMap.build.state.focus, "grid")
  assert.equal(fromMap.build.state.exploreMap, false)
})

test("1 2 x goes back to the menu on the Barracks row — the old bug is gone", () => {
  const side = session()
  keys(side, "1", "2", "x")
  assert.ok(onMenu(side.build.state))
  assert.equal(side.build.state.menuHighlight, barracksEntry)
})

test("the Nexus powers, the game menu, Controls and Settings open over an armed building and give it back", () => {
  for (const [name, open, close] of [
    ["the Nexus powers, closed by Esc", ["n"], [ESC]],
    ["the Nexus powers, closed by n", ["n"], ["n"]],
    ["the Nexus powers, closed by a pick", ["n"], ["1"]],
    ["the game menu", ["q"], [ESC]],
    ["the Controls page", ["?"], ["x"]],
    ["Settings", ["d"], [ESC]],
  ] as const) {
    const side = session()
    keys(side, "1")
    const cursor = side.build.state.cursor
    keys(side, ...open)
    assert.notEqual(side.build.state.popup, null, `${name} did not open over the building`)
    assert.equal(side.build.state.menuHighlight, barracksEntry, `${name} moved the menu's highlight off the Barracks`)
    keys(side, ...close)
    assert.equal(side.build.state.popup, null, `${name} did not close`)
    assert.equal(side.build.state.armed, 0, `${name} did not give the Barracks back`)
    assert.equal(side.build.state.focus, "grid")
    assert.deepEqual(side.build.state.cursor, cursor)
    // And going back from the building lands on its row, not the Nexus's.
    keys(side, "x")
    assert.ok(onMenu(side.build.state))
    assert.equal(side.build.state.menuHighlight, barracksEntry, `${name}: back on the wrong row`)
  }
})

test("Explore Map is not locked: a digit arms from the map, n opens the Nexus powers and gives Explore Map back", () => {
  const arms = session()
  keys(arms, "e", "2")
  assert.equal(arms.build.state.armed, 1)
  assert.equal(arms.build.state.origin, "grid")
  const nexus = session()
  keys(nexus, "e", "n")
  assert.equal(nexus.build.state.popup, "nexus-powers")
  keys(nexus, ESC)
  assert.equal(nexus.build.state.exploreMap, true)
  assert.equal(nexus.build.state.focus, "grid")
  keys(nexus, "x")
  assert.ok(onMenu(nexus.build.state))
  assert.equal(nexus.build.state.menuHighlight, EXPLORE_ENTRY, "back from Explore Map on the Nexus row")
})

test("the refusal is what the bottom line says, even with the ghost on rock; the ghost's reason comes back at the next move", () => {
  const side = session()
  keys(side, "1")
  const cursor = side.build.state.cursor
  // Onto the north-west wall, where the Barracks cannot go.
  side.build.run([{ kind: "move-cursor", dx: 10 - cursor.x, dy: 5 - cursor.y }])
  const line = (): string => bottomLine(side.context, side.build.state, armedPreview(side.context, side.build.state)).text
  assert.match(line(), /^Cannot build here: rock in the way/)
  keys(side, "3")
  assert.equal(line(), "Place the Barracks or cancel it first: [1] or [esc].")
  side.build.run([{ kind: "move-cursor", dx: 0, dy: 0 }])
  assert.match(line(), /^Cannot build here: rock in the way/)
  // The placing hint names the building's own key as a way to cancel it.
  const hinted = session()
  keys(hinted, TAB, "2")
  assert.equal(hint(hinted.context, hinted.build.state).text, "Place the Hatchery: arrows move, [enter] places, [2] or [esc] cancels.")
})

// --- F66: Explore Map from the menu puts the cursor on clear ground ----------------------------------

test("Explore Map opened from the menu moves the cursor off the Grid Nexus onto clear ground, by the arming rule for one tile", () => {
  const context = spikeContext()
  const nexus = nexusTile(context)
  assert.ok(nexus !== null)
  const expected = armingSpot(context, [], ONE_TILE, nexus)
  assert.equal(expected.found, true)
  assert.notDeepEqual(expected.tile, nexus)
  // Clear ground: nothing on the tile, and nothing on the ring around it.
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      assert.equal(structureAtTile(context, [], { x: expected.tile.x + dx, y: expected.tile.y + dy }), null)
    }
  }
  // Nearest by the arming rule's own ranking: a free column to the right of the Nexus.
  assert.deepEqual(expected.tile, { x: 21, y: 10 })
  const layoutOf = session()
  const exploreRow = menuEntryRow(layoutOf.layout, SPIKE_CATALOG, { kind: "explore" }) as number
  for (const [name, open] of [
    ["e", (side: Side) => keys(side, "e")],
    ["Enter on its row", (side: Side) => keys(side, ENTER)],
    ["a click on its row", (side: Side) => clickCell(side, side.layout.panelColumn + 3, exploreRow)],
    ["the driver", (side: Side) => side.build.dispatch({ kind: "explore" })],
  ] as const) {
    const side = session(context)
    open(side)
    assert.equal(side.build.state.exploreMap, true, name)
    assert.deepEqual(side.build.state.cursor, expected.tile, `${name} left the cursor on the Nexus`)
    assert.equal(side.build.state.handoff?.entry, EXPLORE_ENTRY, `${name}: no hand-off to fly the arrow`)
    // The camera follows as it does for arming: the cursor is in view.
    const { camera, viewport } = side.build.state
    assert.ok(side.build.state.cursor.x >= camera.x && side.build.state.cursor.x < camera.x + viewport.width)
  }
})

test("Explore Map from the menu leaves a cursor that is already on clear ground where it is", () => {
  const side = session(spikeContext(), { x: 30, y: 14 })
  keys(side, "e")
  assert.deepEqual(side.build.state.cursor, { x: 30, y: 14 })
})

test("Explore Map opened from the map leaves the cursor where it is — Enter reads what is under it", () => {
  const context = spikeContext()
  const nexus = nexusTile(context) as { x: number; y: number }
  for (const open of [[TAB, ENTER], [TAB, " "], [TAB, "e"]]) {
    const side = session(context)
    keys(side, ...open)
    assert.equal(side.build.state.exploreMap, true)
    assert.equal(side.build.state.origin, "grid")
    assert.deepEqual(side.build.state.cursor, nexus, `${JSON.stringify(open)} moved the cursor off the Nexus`)
    const text = frameToText(composeBuildFrame({ context, state: side.build.state, layout: side.layout }, "monochrome"))
    assert.match(text, /Nexus/)
  }
})

test("with no clear tile in reach, Explore Map leaves the cursor where it is", () => {
  const width = 40
  const height = 30
  const rock: BuildContext = {
    ...spikeContext(),
    grid: { width, height, tiles: new Array<TerrainId>(width * height).fill("terrain.rock") },
    standing: [],
  }
  const side = session(rock, { x: 10, y: 10 })
  keys(side, "e")
  assert.equal(side.build.state.exploreMap, true)
  assert.deepEqual(side.build.state.cursor, { x: 10, y: 10 })
})

// --- F73: no "[esc] Back" rows ------------------------------------------------------------------------

test("the game menu and the export have no Back row; Esc, x and the top bar still close them", () => {
  assert.deepEqual(GAME_MENU_ROWS, ["settings", "controls", "restart", "quit"])
  const menu = session()
  keys(menu, ESC)
  const spec = popupSpec(menu.context, menu.build.state)
  assert.ok(spec !== null)
  assert.deepEqual(
    spec.rows.flatMap((row) => (row.kind === "option" ? [row.hotkey] : [])),
    ["s", "c", "r", "q"],
  )
  const text = frameToText(composeBuildFrame({ context: menu.context, state: menu.build.state, layout: menu.layout }, "monochrome"))
  assert.doesNotMatch(text, /Back to/)
  assert.match(text, /close \[esc\]/)
  // Enter on each row does that row's thing; the last row is Quit, and Down stops there.
  const walked = session()
  keys(walked, ESC, DOWN, DOWN, DOWN, DOWN, DOWN, DOWN)
  assert.equal(GAME_MENU_ROWS[walked.build.state.popupHighlight], "quit")
  keys(walked, ENTER)
  assert.equal(walked.quits(), 1)
  const restart = session()
  keys(restart, "1", ENTER, ESC, DOWN, DOWN, ENTER)
  assert.equal(restart.build.state.planned.length, 0, "Enter on Restart did not start over")
  // The export: its text and nothing to press; Esc goes back to Settings on its Export row.
  const exported = session()
  keys(exported, "d", "e")
  const exportSpec = popupSpec(exported.context, exported.build.state)
  assert.ok(exportSpec !== null)
  assert.equal(exportSpec.rows.some((row) => row.kind === "option"), false)
  assert.equal(exportSpec.scroll?.to, exportSpec.rows.length, "the text is the popup's last rows")
  keys(exported, "x")
  assert.equal(exported.build.state.popup, "settings")
  assert.equal(exported.build.state.popupHighlight, SETTINGS_EXPORT_ROW)
  // The message over the game menu still goes back to its Restart row.
  const message = session()
  keys(message, ESC)
  const over: BuildState = { ...message.build.state, popup: "message", message: restartMessage(["x"]), popupUnder: ["menu"] }
  assert.equal(GAME_MENU_ROWS[applyBuildCommand(message.context, over, { kind: "cancel" }).popupHighlight], "restart")
})

// --- F75: lists stop at their ends, ramp when held, and jump -----------------------------------------

test("the Build Phase menu stops at both ends, with no flicker, and the fast move jumps to either end", () => {
  const side = session()
  const last = menuEntries(side.context).length - 1
  assert.equal(last, startEntry(SPIKE_CATALOG.length))
  const before = side.build.state.ack
  keys(side, UP)
  assert.equal(side.build.state.menuHighlight, 0)
  assert.equal(side.build.state.ack, before, "Up on the first row flickered")
  for (const [key, to] of [
    [SHIFT_DOWN, last],
    [SHIFT_UP, 0],
    [RXVT_SHIFT_DOWN, last],
    [PAGE_UP, 0],
    [OPTION_DOWN, last],
    [HOME, 0],
    [END, last],
    [`${ESC}[7~`, 0],
    [`${ESC}[4~`, last],
  ] as const) {
    keys(side, key)
    assert.equal(side.build.state.menuHighlight, to, JSON.stringify(key))
  }
  const atEnd = side.build.state.ack
  keys(side, DOWN, DOWN, END)
  assert.equal(side.build.state.menuHighlight, last)
  assert.equal(side.build.state.ack, atEnd, "Down on the last row flickered")
  assert.equal(side.build.state.focus, "menu", "a jump left the menu")
  // After the mouse worked the menu, the first key only shows the highlight — a jump too.
  const mouse = session()
  mouse.build.run([{ kind: "click-menu", entry: NEXUS_ENTRY }, { kind: "cancel" }])
  assert.equal(mouse.build.state.highlightHidden, true)
  const hidden = mouse.build.state.menuHighlight
  keys(mouse, END)
  assert.equal(mouse.build.state.highlightHidden, false)
  assert.equal(mouse.build.state.menuHighlight, hidden)
})

test("every popup's list stops at both ends and jumps with the fast move", () => {
  const cases: readonly (readonly [string, readonly string[], number, number])[] = [
    // name, how to open it, its first highlight, its last
    ["the Nexus powers", ["n"], 0, 1],
    ["the game menu", [ESC], 0, GAME_MENU_ROWS.length - 1],
    ["the Controls page", ["?"], 0, controlsLineCount() - 1],
  ]
  for (const [name, open, first, last] of cases) {
    const side = session()
    keys(side, ...open, UP)
    assert.equal(side.build.state.popupHighlight, first, `${name}: Up on the first row came round`)
    keys(side, PAGE_DOWN)
    assert.equal(side.build.state.popupHighlight, last, `${name}: PageDown`)
    keys(side, DOWN)
    assert.equal(side.build.state.popupHighlight, last, `${name}: Down on the last row came round`)
    keys(side, SHIFT_UP)
    assert.equal(side.build.state.popupHighlight, first, `${name}: Shift+Up`)
    keys(side, END)
    assert.equal(side.build.state.popupHighlight, last, `${name}: End`)
    keys(side, HOME)
    assert.equal(side.build.state.popupHighlight, first, `${name}: Home`)
  }
  // Settings walks its rows in their drawn order: from the first setting, Up stays; End is Export.
  const settings = session()
  keys(settings, ESC, "s")
  const firstSetting = settings.build.state.popupHighlight
  assert.equal(firstSetting, SETTINGS_ORDER[0])
  keys(settings, UP)
  assert.equal(settings.build.state.popupHighlight, firstSetting, "Up on the first setting came round to Export")
  keys(settings, END)
  assert.equal(settings.build.state.popupHighlight, SETTINGS_EXPORT_ROW)
  keys(settings, DOWN)
  assert.equal(settings.build.state.popupHighlight, SETTINGS_EXPORT_ROW)
  keys(settings, PAGE_UP)
  assert.equal(settings.build.state.popupHighlight, firstSetting)
  // The export's lines, too.
  const exported = session()
  keys(exported, "d", "e", UP)
  assert.equal(exported.build.state.popupHighlight, 0)
  keys(exported, END)
  const lines = popupSpec(exported.context, exported.build.state)?.scroll
  assert.ok(lines !== undefined)
  assert.equal(exported.build.state.popupHighlight, lines.to - lines.from - 1)
})

test("a held Up or Down in a list ramps exactly as the map cursor does, with the same numbers, and a tap is one row", () => {
  // The same keys at the same times: the Settings list moves as many rows as the map cursor moves
  // tiles, as long as neither reaches an end (feedback F75: "Use the same timings"). Four presses: the
  // list is ten rows long since most Experiments were settled (2026-09-30).
  const presses = Array.from({ length: 4 }, (_, index) => [DOWN, 10_000 + index * 30] as const)
  const list = session()
  keys(list, ESC, "s")
  const top = SETTINGS_ORDER.indexOf(list.build.state.popupHighlight)
  timed(list, presses)
  const rows = SETTINGS_ORDER.indexOf(list.build.state.popupHighlight) - top
  const map = session(spikeContext(), { x: 30, y: 2 })
  keys(map, TAB)
  timed(map, presses)
  const tiles = map.build.state.cursor.y - 2
  assert.ok(rows < SETTINGS_ORDER.length - 1 - top, "the list reached its end; the comparison needs room")
  assert.ok(tiles > presses.length, "the held key did not speed up at all")
  assert.equal(rows, tiles, "a held key moves a list by other numbers than the map cursor")
  // A tap is one row, so Up and Down reach every row.
  const tap = session()
  keys(tap, ESC, "s")
  const start = SETTINGS_ORDER.indexOf(tap.build.state.popupHighlight)
  timed(tap, [[DOWN, 5_000]])
  assert.equal(SETTINGS_ORDER.indexOf(tap.build.state.popupHighlight), start + 1, "a timed tap moved more than one row")
  keys(tap, DOWN)
  assert.equal(SETTINGS_ORDER.indexOf(tap.build.state.popupHighlight), start + 2, "an untimed tap moved more than one row")
})

test("holding Down on the Build Phase menu reaches its last row quickly and stays there", () => {
  // `Down Down~150 Down~30*6`, the playtest's held key: a tap, the terminal's repeat delay, repeats.
  const side = session()
  const last = menuEntries(side.context).length - 1
  const sequence: [string, number][] = [[DOWN, 1_000], [DOWN, 1_150]]
  for (let index = 1; index <= 6; index += 1) sequence.push([DOWN, 1_150 + index * 30])
  timed(side, sequence)
  assert.equal(side.build.state.menuHighlight, last)
  timed(side, Array.from({ length: 10 }, (_, index) => [DOWN, 1_400 + index * 30] as const))
  assert.equal(side.build.state.menuHighlight, last)
  assert.equal(side.build.state.focus, "menu")
  // A jump, or any other key, starts the ramp over: the next Down is a tap again.
  const reset = session()
  timed(reset, [[DOWN, 1_000], [DOWN, 1_030], [DOWN, 1_060], [PAGE_UP, 1_090], [DOWN, 1_120]])
  assert.equal(reset.build.state.menuHighlight, 1)
})

test("list keys: plain arrows step, every fast form the map knows jumps the same way, left and right are not list keys", () => {
  assert.deepEqual(listKeyOf(UP), { direction: -1, jump: false })
  assert.deepEqual(listKeyOf(`${ESC}OB`), { direction: 1, jump: false })
  const fastUpDown = [
    ...[2, 3, 4, 5, 6, 7, 8].flatMap((modifier) => [`${ESC}[1;${modifier}A`, `${ESC}[1;${modifier}B`]),
    `${ESC}[a`,
    `${ESC}[b`,
    `${ESC}${ESC}[A`,
    `${ESC}${ESC}[B`,
    PAGE_UP,
    PAGE_DOWN,
  ]
  for (const key of fastUpDown) {
    const map = cursorKeyOf(key)
    assert.ok(map !== null && map.fast && map.dy !== 0, JSON.stringify(key))
    assert.deepEqual(listKeyOf(key), { direction: map.dy, jump: true }, JSON.stringify(key))
  }
  // Home and End, left and right on the map, are a list's first and last row, in every spelling.
  for (const key of [HOME, `${ESC}OH`, `${ESC}[1~`, `${ESC}[7~`]) {
    assert.equal(cursorKeyOf(key)?.dx, -1)
    assert.deepEqual(listKeyOf(key), { direction: -1, jump: true }, JSON.stringify(key))
  }
  for (const key of [END, `${ESC}OF`, `${ESC}[4~`, `${ESC}[8~`]) {
    assert.equal(cursorKeyOf(key)?.dx, 1)
    assert.deepEqual(listKeyOf(key), { direction: 1, jump: true }, JSON.stringify(key))
  }
  for (const key of [LEFT, `${ESC}[1;2C`, `${ESC}b`, `${ESC}f`, `${ESC}${ESC}[D`, `${ESC}[c`, "x", ESC]) {
    assert.equal(listKeyOf(key), null, JSON.stringify(key))
  }
  assert.equal(stepListIndex(3, 5, 10), 4)
  assert.equal(stepListIndex(3, 5, -10), 0)
  assert.equal(stepListIndex(0, 0, 1), 0)
  // The keyboard adapter sends them as highlight commands in a list, and as cursor moves on the map.
  assert.deepEqual(buildKeyboardCommand(SHIFT_DOWN, { itemCount: 3, armed: false, focus: "menu" }), { kind: "highlight", delta: 1, jump: true })
  assert.deepEqual(buildKeyboardCommand(HOME, { itemCount: 3, armed: false, focus: "menu" }), { kind: "highlight", delta: -1, jump: true })
  assert.equal(buildKeyboardCommand(HOME, { itemCount: 3, armed: false, focus: "grid" })?.kind, "move-cursor")
})

test("the title screen's menu stops at both ends and jumps with the fast move", () => {
  const items = [
    { id: "a", hotkey: "1", label: "A" },
    { id: "b", hotkey: "2", label: "B" },
    { id: "c", hotkey: "3", label: "C" },
  ]
  const state = createMenuList(items)
  assert.deepEqual(keyboardCommand(UP, state), { kind: "highlight", index: 0 })
  assert.deepEqual(keyboardCommand(DOWN, { ...state, highlighted: 2 }), { kind: "highlight", index: 2 })
  for (const key of [PAGE_DOWN, END, SHIFT_DOWN, OPTION_DOWN]) {
    assert.deepEqual(keyboardCommand(key, state), { kind: "highlight", index: 2 }, JSON.stringify(key))
  }
  for (const key of [PAGE_UP, HOME, SHIFT_UP]) {
    assert.deepEqual(keyboardCommand(key, { ...state, highlighted: 2 }), { kind: "highlight", index: 0 }, JSON.stringify(key))
  }
  // Esc is still its own key, not an arrow's start.
  assert.deepEqual(keyboardCommand(ESC, state), { kind: "back" })
})

// --- The words -----------------------------------------------------------------------------------------

test("the Controls page says what Esc and x do on the menu, how placing is cancelled, and how lists move", () => {
  const page = controlsPage()
  const section = (heading: string) => page.find((entry) => entry.heading === heading)?.lines ?? []
  assert.deepEqual(section("THE MENU").find((line) => line.keys === "esc"), { keys: "esc", text: "the game menu" })
  assert.match(section("THE MENU").find((line) => line.keys === "x")?.text ?? "", /^nothing/)
  assert.ok(section("PLACING A BUILDING").some((line) => line.keys === "its own key"))
  assert.ok(section("PLACING A BUILDING").some((line) => /place it or stop first/.test(line.text)))
  assert.deepEqual(
    section("ANY LIST").map((line) => line.keys),
    ["up/down", "hold up/down", "shift+up/down", "pgup/home", "pgdn/end"],
  )
  assert.match(section("ANYWHERE").find((line) => line.keys === "x")?.text ?? "", /stops at the menu/)
  assert.match(section("THE MOUSE").find((line) => line.keys === "right click")?.text ?? "", /like x/)
})
