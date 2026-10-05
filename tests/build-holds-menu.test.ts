// A building being placed holds the menu (docs/system-design/ui-patterns.md, "A selection holds the menu"): it stays
// the selection until it is placed or cancelled — another building's key, Explore Map and Start Battle Round
// are refused, with the header flickering and the bottom line naming the ways out; its own key cancels it
// as Esc does; and popups still open over it and hand it back, still armed. Explore Map holds nothing.
// Driven through raw bytes into the real adapters, and through the driver where the lock is the
// reducer's.

import { test } from "node:test"
import assert from "node:assert/strict"
import { bottomLine } from "../src/build/help.ts"
import { menuEntryRow } from "../src/build/layout.ts"
import { EXPLORE_ENTRY, armedPreview, entryOfConstruct } from "../src/build/state.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { DOWN, ENTER, ESC, TAB, buildSide, clickPanelRow, keys } from "./build-helpers.ts"

const barracksEntry = entryOfConstruct(0)

test("while a building is being placed, another building's key, e, s and p are refused: nothing changes, its header flickers, the bottom line says to place it or cancel it", () => {
  for (const key of ["2", "3", "e", "s", "p"]) {
    for (const picked of [false, true]) {
      const side = buildSide()
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
      // The menu never lost track of what is armed: going back lands on the Barracks row.
      keys(side, "x")
      assert.equal(side.build.state.focus, "menu")
      assert.equal(side.build.state.armed, null)
      assert.equal(side.build.state.menuHighlight, barracksEntry, `${key}: back on the wrong row`)
    }
  }
  // The driver's commands are refused the same way: the lock is the reducer's, not the keyboard's.
  for (const command of [{ kind: "arm", index: 1 }, { kind: "explore" }, { kind: "open-battle-round" }] as const satisfies readonly BuildCommand[]) {
    const byKey = buildSide()
    keys(byKey, "1")
    byKey.build.dispatch(command)
    assert.equal(byKey.build.state.armed, 0)
    assert.match(byKey.build.state.status.text, /^Place the Barracks or cancel it first/)
  }
  // The Hatchery names its own key.
  const hatchery = buildSide()
  keys(hatchery, "2", "1")
  assert.equal(hatchery.build.state.status.text, "Place the Hatchery or cancel it first: [2] or [esc].")
})

test("a building's own key cancels it, exactly as Esc does, back to where the placing began", () => {
  for (const begin of [["1"], [DOWN, DOWN, ENTER], [TAB, "1"]]) {
    const byKey = buildSide()
    keys(byKey, ...begin, "1")
    const byEsc = buildSide()
    keys(byEsc, ...begin, ESC)
    assert.equal(byKey.build.state.armed, null, `${JSON.stringify(begin)}: its own key did not cancel it`)
    assert.deepEqual(byKey.build.state, byEsc.build.state, `${JSON.stringify(begin)}: its own key is not Esc's twin`)
  }
  const fromMenu = buildSide()
  keys(fromMenu, "1", "1")
  assert.equal(fromMenu.build.state.focus, "menu")
  assert.equal(fromMenu.build.state.menuHighlight, barracksEntry)
  const fromMap = buildSide()
  keys(fromMap, TAB, "1", "1")
  assert.equal(fromMap.build.state.focus, "grid")
  assert.equal(fromMap.build.state.exploreMap, false)
})

test("the Nexus powers, the game menu, Controls and Settings open over a building being placed and give it back, still armed", () => {
  for (const [name, open, close] of [
    ["the Nexus powers, closed by Esc", ["n"], [ESC]],
    ["the Nexus powers, closed by n", ["n"], ["n"]],
    ["the Nexus powers, closed by a pick", ["n"], ["1"]],
    ["the game menu", ["q"], [ESC]],
    ["the Controls page", ["?"], ["x"]],
    ["Settings", ["d"], [ESC]],
  ] as const) {
    const side = buildSide()
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
    assert.equal(side.build.state.focus, "menu")
    assert.equal(side.build.state.menuHighlight, barracksEntry, `${name}: back on the wrong row`)
  }
})

test("a click outside a popup over a building's card closes it and chooses nothing: the building stays armed, the highlight stays", () => {
  for (const open of ["n", "q", "?"]) {
    const side = buildSide()
    keys(side, "1")
    const armed = side.build.state
    keys(side, open)
    assert.notEqual(side.build.state.popup, null)
    // Where the Turret's row would be on the menu, which the card covers: nobody could see it.
    clickPanelRow(side, menuEntryRow(side.layout, side.context.catalog, { kind: "construct", index: 2 }) as number)
    const after = side.build.state
    assert.equal(after.popup, null, `${open}: the popup did not close`)
    assert.equal(after.armed, 0, `${open}: the click dropped the Barracks`)
    assert.equal(after.focus, "grid")
    assert.equal(after.menuHighlight, barracksEntry, `${open}: the click moved the highlight to a row nobody could see`)
    assert.deepEqual(after.cursor, armed.cursor)
  }
})

test("Explore Map holds nothing: a digit arms from the map, and n opens the Nexus powers and gives Explore Map back", () => {
  const arms = buildSide()
  keys(arms, "e", "2")
  assert.equal(arms.build.state.armed, 1)
  assert.equal(arms.build.state.returnTo, "grid")
  const nexus = buildSide()
  keys(nexus, "e", "n")
  assert.equal(nexus.build.state.popup, "nexus-powers")
  keys(nexus, ESC)
  assert.equal(nexus.build.state.exploreMap, true)
  assert.equal(nexus.build.state.focus, "grid")
  keys(nexus, "x")
  assert.equal(nexus.build.state.focus, "menu")
  assert.equal(nexus.build.state.menuHighlight, EXPLORE_ENTRY, "back from Explore Map on the Nexus row")
})

test("the lock's refusal is what the bottom line says, even with the ghost on rock; the ghost's reason comes back at the next move", () => {
  const side = buildSide()
  // A Turret north of the Nexus first, so the build range reaches the north-west wall.
  keys(side, "3")
  side.build.run([{ kind: "move-cursor", dx: 19 - side.build.state.cursor.x, dy: 7 - side.build.state.cursor.y }, { kind: "place" }])
  keys(side, "1")
  const cursor = side.build.state.cursor
  // Onto the north-west wall, where the Barracks cannot go.
  side.build.run([{ kind: "move-cursor", dx: 19 - cursor.x, dy: 5 - cursor.y }])
  const line = (): string => bottomLine(side.context, side.build.state, armedPreview(side.context, side.build.state)).text
  assert.match(line(), /^Cannot build here: rock in the way/)
  keys(side, "3")
  assert.equal(line(), "Place the Barracks or cancel it first: [1] or [esc].")
  side.build.run([{ kind: "move-cursor", dx: 0, dy: 0 }])
  assert.match(line(), /^Cannot build here: rock in the way/)
})
