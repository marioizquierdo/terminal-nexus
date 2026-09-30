// Back and cancel (docs/ui-patterns.md, "Back, cancel and close"): Esc and `x` go back one level at a
// time — a popup to the one it was opened from, placing or Explore Map to where it began, the map to the
// menu — and there `x` and a right click stop, while Esc opens the game menu. Two commands carry it:
// `cancel` (Esc, the top bar's label) and `back` (`x`, a right click). Driven through raw bytes into the
// real adapters.

import { test } from "node:test"
import assert from "node:assert/strict"
import { escLabel, menuEntryRow } from "../src/build/layout.ts"
import { popupSpec } from "../src/build/popup.ts"
import { GAME_MENU_ROWS } from "../src/build/settings.ts"
import type { BuildState } from "../src/build/state.ts"
import { hint } from "../src/build/help.ts"
import {
  DOWN,
  ENTER,
  ESC,
  LEFT,
  TAB,
  bottomLineText,
  buildSide,
  clickEscLabel,
  clickPanelRow,
  clickTile,
  keys,
  rightClickMap,
  screenText,
} from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"

/** On the menu with nothing open — the "regular state" `x x x` must always reach (feedback F62). */
function onMenu(state: BuildState): boolean {
  return state.focus === "menu" && state.popup === null && state.armed === null && !state.exploreMap
}

/** Presses `x` until the screen is on the menu, at most `limit` times, then twice more, and says how
 *  many it took: once there, `x` must change nothing at all. */
function xToMenu(side: BuildSide, limit = 6): number {
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

test("x on the menu does nothing at all — the same screen, the same hint, no flicker — while Esc, the top bar's label and q open the game menu", () => {
  const side = buildSide()
  const before = screenText(side)
  keys(side, "x")
  assert.equal(screenText(side), before, "x on the menu changed the screen")
  assert.equal(bottomLineText(side), hint(side.context, side.build.state).text, "x on the menu said something")
  // With a row just flickered, x flickers nothing of its own.
  keys(side, LEFT)
  const flickered = side.build.state.ack
  keys(side, "x")
  assert.equal(side.build.state.ack, flickered)
  // Esc, the top bar's label and q are the ways in; the label says so on the menu.
  assert.equal(escLabel(side.build.state), "menu [esc]")
  keys(side, ESC)
  assert.equal(side.build.state.popup, "game-menu")
  const byLabel = buildSide()
  clickEscLabel(byLabel)
  assert.equal(byLabel.build.state.popup, "game-menu")
  const byQ = buildSide()
  keys(byQ, "q")
  assert.equal(byQ.build.state.popup, "game-menu")
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
    const side = buildSide()
    keys(side, ...begin)
    assert.ok(!onMenu(side.build.state), `${name}: began on the menu`)
    assert.equal(xToMenu(side), levels, `${name}: x walked back more than one level at a time`)
  }
  // The driver's `back` is the same walk.
  const driver = buildSide()
  driver.build.run([{ kind: "focus", target: "grid" }, { kind: "arm", index: 0 }, { kind: "back" }, { kind: "back" }, { kind: "back" }])
  assert.ok(onMenu(driver.build.state))
})

test("Esc walks back one level at a time: a popup, then Explore Map to the menu, then the game menu", () => {
  const side = buildSide()
  keys(side, "e") // Explore Map, from the menu
  assert.equal(side.build.state.exploreMap, true)
  keys(side, "n") // a popup on top of it
  assert.equal(side.build.state.popup, "nexus-powers")
  keys(side, ESC)
  assert.equal(side.build.state.popup, null)
  assert.equal(side.build.state.exploreMap, true, "closing the popup also left Explore Map")
  // x walks back as Esc does until the menu: Explore Map goes back to the menu it was opened from.
  keys(side, "x")
  assert.equal(side.build.state.exploreMap, false)
  assert.equal(side.build.state.focus, "menu")
  keys(side, ESC)
  assert.equal(side.build.state.popup, "game-menu")
  const text = screenText(side)
  assert.match(text, /MENU/)
  assert.match(text, /\[s\] Settings/)
  assert.match(text, /\[q\] Quit/)
  keys(side, ESC)
  assert.equal(side.build.state.popup, null, "Esc on the game menu goes back to the game")
  assert.equal(side.quits(), 0)
})

test("Esc while placing disarms and goes back one level, to where the placing began", () => {
  const onMap = buildSide()
  keys(onMap, TAB, "1", ESC)
  assert.equal(onMap.build.state.armed, null)
  assert.equal(onMap.build.state.focus, "grid", "Esc from a map arming left the map")
  assert.equal(onMap.build.state.status.text, "Cancelled.")
  keys(onMap, ESC)
  assert.equal(onMap.build.state.focus, "menu")
  keys(onMap, ESC)
  assert.equal(onMap.build.state.popup, "game-menu")

  for (const arm of [[DOWN, DOWN, ENTER], ["1"]]) {
    const fromMenu = buildSide()
    keys(fromMenu, ...arm, ESC)
    assert.equal(fromMenu.build.state.armed, null)
    assert.equal(fromMenu.build.state.focus, "menu", `${JSON.stringify(arm)} then Esc did not go back to the menu`)
  }
  // A click on a building's row is the menu's, whatever had focus: Esc goes back to the menu.
  const byClick = buildSide()
  clickTile(byClick, { x: 30, y: 14 }) // the map, in plain navigation
  clickPanelRow(byClick, menuEntryRow(byClick.layout, byClick.context.catalog, { kind: "construct", index: 0 }) as number)
  assert.equal(byClick.build.state.armed, 0)
  keys(byClick, ESC)
  assert.equal(byClick.build.state.focus, "menu", "a click on a row is the menu's")
})

test("a right click walks back as x does, and never opens a menu", () => {
  const side = buildSide()
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
  assert.equal(side.build.state.popup, "game-menu", "a right click in Settings did not go back one popup")
  rightClickMap(side)
  assert.equal(side.build.state.popup, null)
  rightClickMap(side)
  assert.equal(side.build.state.popup, null)
})

test("on a committed plan x and a right click do nothing; Esc, q and the top bar's label open the game menu", () => {
  const side = buildSide()
  keys(side, "n", "1", "s", "s")
  assert.equal(side.build.state.committed, true)
  assert.equal(escLabel(side.build.state), "menu [esc]")
  // Nothing changes on screen but the bottom line: the commit's own answer lapses, as it does at any
  // command that says nothing, and the committed plan's hint takes its place.
  const before = screenText(side).split("\n")
  keys(side, "x")
  rightClickMap(side)
  const after = screenText(side).split("\n")
  const footer = side.layout.footerRow
  assert.deepEqual(after.filter((_, row) => row !== footer), before.filter((_, row) => row !== footer))
  assert.equal(bottomLineText(side), hint(side.context, side.build.state).text)
  assert.match(bottomLineText(side), /^The plan is locked in\./)
  keys(side, ESC)
  assert.equal(side.build.state.popup, "game-menu")
  keys(side, "x")
  assert.equal(side.build.state.popup, null, "x did not close the game menu over a committed plan")
  keys(side, "q")
  assert.equal(side.build.state.popup, "game-menu")
  keys(side, ESC)
  clickEscLabel(side)
  assert.equal(side.build.state.popup, "game-menu")
})

test("x closes every popup as Esc does, back to the one it was opened from", () => {
  // The message popup, which no key opens today, is `tests/build-popups.test.ts`'s.
  for (const [begin, after] of [
    [["n"], null],
    [[ESC], null],
    [[ESC, "s"], "game-menu"],
    [[ESC, "c"], "game-menu"],
    [["d", "e"], "settings"],
    [["?"], null],
  ] as const) {
    const byX = buildSide()
    keys(byX, ...begin, "x")
    const byEsc = buildSide()
    keys(byEsc, ...begin, ESC)
    assert.equal(byX.build.state.popup, after, JSON.stringify(begin))
    assert.deepEqual(byX.build.state, byEsc.build.state, `${JSON.stringify(begin)}: x and Esc differ inside a popup`)
  }
})

test("no popup has a row that only goes back: the game menu's rows are its four actions, and the export and Controls have nothing to press", () => {
  const optionsOf = (begin: readonly string[]) => {
    const side = buildSide()
    keys(side, ...begin)
    const spec = popupSpec(side.context, side.build.state)
    assert.ok(spec !== null, `${JSON.stringify(begin)} opened nothing`)
    return spec.rows.flatMap((row) => (row.kind === "option" ? [row] : []))
  }
  assert.deepEqual(GAME_MENU_ROWS, ["settings", "controls", "restart", "quit"])
  assert.deepEqual(optionsOf([ESC]).map((option) => option.hotkey), ["s", "c", "r", "q"])
  for (const begin of [["d", "e"], ["?"]]) assert.deepEqual(optionsOf(begin), [], JSON.stringify(begin))
  // The export is its text, to its last row.
  const exported = buildSide()
  keys(exported, "d", "e")
  const spec = popupSpec(exported.context, exported.build.state)
  assert.equal(spec?.scroll?.to, spec?.rows.length, "the text is not the export's last rows")
  // Every option of every popup does something; going back is Esc's, x's and the top bar's.
  for (const begin of [["n"], [ESC], [ESC, "s"], ["n", "1", "s"]]) {
    for (const option of optionsOf(begin)) {
      assert.ok(!["cancel", "back"].includes(option.command.kind), `${JSON.stringify(begin)}: [${option.hotkey}] only goes back`)
    }
  }
})
