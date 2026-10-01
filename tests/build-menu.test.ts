// The Build Phase menu (docs/system-design/ui-patterns.md, "Menu rows" and "The Build Phase menu"): one list —
// Explore Map, Nexus, the credits line with the map's resource symbol, every building with its cost,
// Start Pulse on the last line — drawn where the mouse finds it; a row's two states, highlighted and
// active, and its two brief acknowledgements, pressed and refused; Left and Right that only flicker; and
// the one flash on the way back to the menu. No row or height is hardcoded: every place is read from
// the layout.

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_CATALOG } from "../src/build/catalog.ts"
import {
  CARD_HEADER_ROW,
  CREDITS_ROW,
  EXPLORE_ROW,
  NEXUS_ROW,
  buildLayout,
  constructLines,
  menuEntryAt,
  menuEntryRow,
  menuFloor,
  startRow,
} from "../src/build/layout.ts"
import { EXPLORE_ENTRY, NEXUS_ENTRY, entryOfConstruct, menuEntries, remaining, startEntry } from "../src/build/state.ts"
import type { ConstructItem } from "../src/build/types.ts"
import { spikeContext } from "../src/cli/spike.ts"
import type { RowAck } from "../src/view/build.ts"
import type { Cell } from "../src/view/frame.ts"
import { cellAt } from "../src/view/frame.ts"
import type { CapabilityMode } from "../src/view/roles.ts"
import { CAPABILITY_MODES } from "../src/view/roles.ts"
import { terrainGlyph } from "../src/view/theme.ts"
import {
  DOWN,
  ENTER,
  ESC,
  LEFT,
  MINIMUM,
  RIGHT,
  ROOMY,
  TAB,
  buildSide,
  clickPanelRow,
  compose,
  keys,
  panelCells,
  panelLine,
  panelLines,
  panelRow,
} from "./build-helpers.ts"
import type { Side } from "./build-helpers.ts"

const barracksRow = (side: Side): number => menuEntryRow(side.layout, SPIKE_CATALOG, { kind: "construct", index: 0 }) as number

// --- The list and the credits line ---------------------------------------------------------------------

test("the menu reads Explore Map, Nexus, the credits line, every building with its cost, and Start Pulse on the last line", () => {
  for (const terminal of [MINIMUM, ROOMY]) {
    for (const pack of ["ascii", "unicode"] as const) {
      const side = buildSide({ terminal })
      const { layout } = side
      const frame = compose(side, { glyphPack: pack }, "truecolor")
      const line = (row: number): string => panelLine(side, frame, row)
      // Explore Map and Nexus on the first two lines, with no blank line between them (feedback F72).
      assert.deepEqual([EXPLORE_ROW, NEXUS_ROW, CREDITS_ROW], [0, 1, 2])
      assert.match(line(panelRow(side, EXPLORE_ROW)), /^\[e\] Explore Map +$/)
      assert.match(line(panelRow(side, NEXUS_ROW)), /^\[n\] Nexus \(1\) +$/)
      // The credits: the map's own deposit glyph and what is left to spend, right-aligned where the costs
      // end, the symbol in the deposit's colour and the amount in the title's (F71).
      const deposit = terrainGlyph("terrain.deposit", pack)
      assert.equal(deposit.glyph, pack === "ascii" ? "*" : "◆")
      assert.equal(line(panelRow(side, CREDITS_ROW)), `${deposit.glyph} ${remaining(side.context, side.build.state)}`.padStart(layout.panelLimit))
      const symbol = cellAt(frame, layout.dividerColumn - 5, panelRow(side, CREDITS_ROW))
      assert.equal(symbol.glyph, deposit.glyph)
      assert.equal(symbol.style.fgRole, deposit.role, "the symbol is not in the deposit's colour")
      const amount = cellAt(frame, layout.dividerColumn - 1, panelRow(side, CREDITS_ROW))
      assert.equal(amount.style.fgRole, "chrome.title")
      assert.equal(amount.style.bold, true)
      // The buildings from the line after the credits, one row apart, each cost ending where the credits do.
      const lines = constructLines(layout, SPIKE_CATALOG)
      SPIKE_CATALOG.forEach((item, index) => {
        assert.equal(lines[index]?.row, panelRow(side, CREDITS_ROW) + 1 + index, "the buildings are not one row apart under the credits")
        assert.equal(line(lines[index]?.row as number), `[${item.hotkey}] ${item.label}`.padEnd(layout.panelLimit - String(item.cost).length) + String(item.cost))
      })
      // Nothing between the last building and Start Pulse: no headings, no help text.
      for (let row = (lines.at(-1)?.row as number) + 1; row < startRow(layout); row += 1) {
        assert.equal(line(row).trim(), "", `row ${row} is not empty: "${line(row)}"`)
      }
      assert.equal(startRow(layout), layout.panelLastRow)
      assert.match(line(startRow(layout)), /^\[s\] Start Pulse +$/)
    }
  }
})

test("the credits line counts down as the plan grows, and leaves with the menu once the plan is committed", () => {
  const side = buildSide()
  const credits = (): string => panelLine(side, compose(side), panelRow(side, CREDITS_ROW)).trim()
  assert.equal(credits(), `* ${side.context.allotment}`)
  keys(side, "1", ENTER) // a Barracks, back on the menu
  assert.equal(remaining(side.context, side.build.state), side.context.allotment - (SPIKE_CATALOG[0] as ConstructItem).cost)
  assert.equal(credits(), `* ${remaining(side.context, side.build.state)}`)
  keys(side, "n", "1", "s", "s")
  assert.equal(side.build.state.committed, true)
  assert.doesNotMatch(panelLines(side, compose(side)).join("\n"), /\* \d/)
})

test("the map draws its deposits with the very glyph the credits line uses", () => {
  for (const pack of ["ascii", "unicode"] as const) {
    const side = buildSide()
    const frame = compose(side, { glyphPack: pack }, "truecolor")
    const deposit = terrainGlyph("terrain.deposit", pack)
    let onMap = 0
    for (let y = side.layout.origin.row; y < side.layout.origin.row + side.layout.viewport.height; y += 1) {
      for (let x = side.layout.origin.column; x < side.layout.gridBox.right; x += 1) {
        const cell = cellAt(frame, x, y)
        if (cell.glyph === deposit.glyph && cell.style.fgRole === deposit.role) onMap += 1
      }
    }
    assert.ok(onMap > 0, `${pack}: no deposit on the map drawn as ${deposit.glyph}`)
  }
})

test("a building row the panel is too short for is neither drawn nor a click target", () => {
  // Three more buildings than the floor's panel holds between Nexus and Start Pulse.
  const floor = buildLayout(MINIMUM, spikeContext().grid)
  const room = menuFloor(floor) - (floor.panelRow + CREDITS_ROW + 1) + 1
  const long: ConstructItem[] = Array.from({ length: room + 3 }, (_, index) => ({
    ...(SPIKE_CATALOG[index % SPIKE_CATALOG.length] as ConstructItem),
    label: `Row ${index + 1}`,
    hotkey: String((index + 1) % 10),
  }))
  const side = buildSide({ context: { ...spikeContext(), catalog: long } })
  const { layout } = side
  const lines = constructLines(layout, long)
  assert.ok(lines.length < long.length, "the floor's panel holds every row: the test needs a longer list")
  assert.equal(lines.at(-1)?.row, menuFloor(layout), "the list stops on the row above Start Pulse")
  const hidden = lines.length
  assert.equal(menuEntryRow(layout, long, { kind: "construct", index: hidden }), null)
  assert.doesNotMatch(panelLines(side, compose(side)).join("\n"), new RegExp(`Row ${hidden + 1}\\b`))
  // No row of the panel answers a click with a building nobody drew.
  for (let row = layout.panelRow; row <= layout.panelLastRow; row += 1) {
    const entry = menuEntryAt(layout, long, layout.panelColumn + 2, row)
    if (entry === null || entry < entryOfConstruct(0) || entry >= startEntry(long.length)) continue
    assert.ok(entry - entryOfConstruct(0) < hidden, `row ${row} is a click target for a hidden building`)
  }
  assert.equal(menuEntryAt(layout, long, layout.panelColumn + 2, startRow(layout)), startEntry(long.length))
})

test("every menu row is drawn where the mouse finds it and where the keyboard's bar lands; the credits line is no target", () => {
  const base = buildSide()
  const { layout } = base
  menuEntries(base.context).forEach((target, entry) => {
    const row = menuEntryRow(layout, SPIKE_CATALOG, target) as number
    assert.equal(menuEntryAt(layout, SPIKE_CATALOG, layout.panelColumn + 2, row), entry, `the mouse does not find entry ${entry} on its row`)
    const side = buildSide()
    for (let step = 0; step < entry; step += 1) keys(side, DOWN)
    assert.equal(cellAt(compose(side), layout.panelColumn + layout.panelLimit - 1, row).style.inverse, true, `the bar for entry ${entry} is not on its row`)
  })
  assert.equal(menuEntryAt(layout, SPIKE_CATALOG, layout.panelColumn + 2, panelRow(base, CREDITS_ROW)), null)
})

// --- Highlighted and active ------------------------------------------------------------------------------

test("an active row keeps its own hotkey and ends in one >, all in the hotkey colour and bold, never underlined or barred — one look for every row, at every colour depth", () => {
  // `[1] Barracks  >` (owner, 2026-09-30, feedback F67, F70). A building and Explore Map head their
  // card; Nexus and Start Pulse stay on the menu behind their popup.
  const cases: readonly [string, readonly string[], (side: Side) => number, RegExp][] = [
    ["a building by its digit", ["1"], (side) => panelRow(side, CARD_HEADER_ROW), /^\[1\] Barracks +>$/],
    ["a building from its row", [DOWN, DOWN, DOWN, ENTER], (side) => panelRow(side, CARD_HEADER_ROW), /^\[2\] Hatchery +>$/],
    ["Explore Map", ["e"], (side) => panelRow(side, CARD_HEADER_ROW), /^\[e\] Explore Map +>$/],
    ["Nexus", ["n"], (side) => panelRow(side, NEXUS_ROW), /^\[n\] Nexus \(1\) +>$/],
    ["Start Pulse", ["n", "1", "s"], (side) => startRow(side.layout), /^\[s\] Start Pulse +>$/],
  ]
  for (const [name, open, rowOf, reads] of cases) {
    for (const capability of CAPABILITY_MODES) {
      const side = buildSide()
      keys(side, ...open)
      const frame = compose(side, {}, capability)
      const row = rowOf(side)
      assert.match(panelLine(side, frame, row), reads, `${name} at ${capability}`)
      for (const cell of panelCells(side, frame, row)) {
        if (cell.glyph === " ") continue
        assert.notEqual(cell.style.underline, true, `${name}: "${cell.glyph}" is underlined at ${capability}`)
        assert.notEqual(cell.style.inverse, true, `${name}: drawn with the keyboard's bar at ${capability}`)
        assert.equal(cell.style.fgRole, "chrome.hotkey", `${name}: "${cell.glyph}" is not in the hotkey's colour at ${capability}`)
        assert.equal(cell.style.bold, true, `${name}: "${cell.glyph}" is not bold at ${capability}`)
      }
    }
  }
  // With nothing under way no row is active; once its popup closes, Nexus is a plain row again.
  const side = buildSide()
  assert.ok(!panelLines(side, compose(side)).some((line) => />$/.test(line)), "a row with nothing under way is drawn active")
  keys(side, "n", "x")
  assert.match(panelLine(side, compose(side), panelRow(side, NEXUS_ROW)), /^\[n\] Nexus \(1\) +$/)
})

test("a popup that belongs to no row — the game menu, Settings, the Controls page — leaves the menu unlit", () => {
  for (const open of [[ESC], [ESC, "s"], [ESC, "c"]]) {
    const side = buildSide()
    keys(side, ...open)
    assert.notEqual(side.build.state.popup, null, `${JSON.stringify(open)} opened nothing`)
    for (const target of menuEntries(side.context)) {
      const row = menuEntryRow(side.layout, SPIKE_CATALOG, target) as number
      const style = cellAt(compose(side), side.layout.dividerColumn - 2, row).style
      assert.notEqual(style.inverse, true, `${side.build.state.popup}: the menu's bar is lit on row ${row}`)
    }
  }
})

// --- Pressed and refused -------------------------------------------------------------------------------

test("a menu row's looks: highlighted is the bar; pressed, a stronger bar in the hotkey colour; refused keeps the bar and greys only the words — at every colour depth", () => {
  const side = buildSide() // the highlight on Explore Map
  const row = panelRow(side, EXPLORE_ROW)
  const grey: Readonly<Record<CapabilityMode, Readonly<{ bgRole?: string; dim?: boolean }>>> = {
    monochrome: { dim: true },
    color16: { bgRole: "chrome.edge" },
    color256: { bgRole: "chrome.muted" },
    truecolor: { bgRole: "chrome.muted" },
  }
  for (const capability of CAPABILITY_MODES) {
    const cellsOf = (ack?: RowAck): Cell[] => panelCells(side, compose(side, ack === undefined ? {} : { ack }, capability), row)
    const highlighted = cellsOf()
    assert.ok(highlighted.every((cell) => cell.style.inverse === true), `${capability}: the highlighted row is not the bar`)
    // Pressed: the whole bar in the hotkey's colour, bold and underlined.
    const pressed = cellsOf({ kind: "pressed", entry: EXPLORE_ENTRY })
    assert.ok(
      pressed.every((cell) => cell.style.inverse === true && cell.style.fgRole === "chrome.hotkey" && cell.style.bold === true && cell.style.underline === true),
      `${capability}: the pressed bar is not the stronger one`,
    )
    // Refused (feedback F61): the same words, the bar exactly the bar on every cell, nothing loud added.
    const refused = cellsOf({ kind: "refused", entry: EXPLORE_ENTRY })
    assert.deepEqual(refused.map((cell) => cell.glyph), highlighted.map((cell) => cell.glyph), "the flicker changed the row's words")
    refused.forEach((cell, index) => {
      assert.equal(cell.style.inverse, true, `${capability}: cell ${index} left the bar`)
      assert.equal(cell.style.fgRole, "chrome.title", `${capability}: cell ${index} changed the bar's colour`)
      assert.notEqual(cell.style.bold, true)
      assert.notEqual(cell.style.underline, true)
      if (index >= "[e] Explore Map".length) assert.deepEqual(cell.style, (highlighted[index] as Cell).style, `${capability}: the bar beyond the words changed`)
    })
    // The words: grey, the way this tier can show grey.
    const word = refused[1] as Cell // the "e" of "[e]"
    const want = grey[capability]
    if (want.bgRole !== undefined) assert.equal(word.style.bgRole, want.bgRole, `${capability}: the words are not grey`)
    if (want.dim === true) assert.equal(word.style.dim, true, `${capability}: the words are not dim`)
  }
  // A plain row: no bar.
  assert.ok(panelCells(side, compose(side), panelRow(side, NEXUS_ROW)).every((cell) => cell.style.inverse !== true))
})

test("a refused flicker on a plain row leaves it plain and greys its words; on an active header too", () => {
  for (const capability of CAPABILITY_MODES) {
    const side = buildSide() // the highlight on Explore Map; Nexus is plain
    const flicker = panelCells(side, compose(side, { ack: { kind: "refused", entry: NEXUS_ENTRY } }, capability), panelRow(side, NEXUS_ROW))
    for (const cell of flicker) {
      assert.notEqual(cell.style.inverse, true, `${capability}: a bar appeared`)
      if (cell.glyph === " ") continue
      assert.equal(cell.style.fgRole, "chrome.muted")
      assert.equal(cell.style.dim, true)
      assert.notEqual(cell.style.bold, true)
    }
    // The header of a building's card, flickering — another building's key while one is being placed is
    // refused on the armed row: still no bar, the words grey.
    const armed = buildSide()
    keys(armed, "1", "2")
    assert.equal(armed.build.state.armed, 0)
    const ack = armed.build.state.ack
    assert.deepEqual(ack === null ? null : { kind: ack.kind, entry: ack.entry }, { kind: "refused", entry: entryOfConstruct(0) })
    const header = panelCells(armed, compose(armed, { ack: { kind: "refused", entry: entryOfConstruct(0) } }, capability), panelRow(armed, CARD_HEADER_ROW))
    assert.match(header.map((cell) => cell.glyph).join(""), /^\[1\] Barracks +>$/)
    for (const cell of header) {
      assert.notEqual(cell.style.inverse, true)
      if (cell.glyph !== " ") assert.equal(cell.style.fgRole, "chrome.muted")
    }
  }
})

test("a pressed flash on an active row is the bar, over the same words", () => {
  const side = buildSide()
  keys(side, "n") // the Nexus popup: its row active behind it
  const row = panelRow(side, NEXUS_ROW)
  const flash: RowAck = { kind: "pressed", entry: NEXUS_ENTRY }
  assert.equal(panelLine(side, compose(side, { ack: flash }), row), panelLine(side, compose(side), row))
  const pressed = cellAt(compose(side, { ack: flash }), side.layout.dividerColumn - 1, row).style
  assert.equal(pressed.inverse, true)
  assert.equal(pressed.underline, true)
})

test("every activation asks for a pressed flash, however it arrived: Enter, a hotkey, or a click", () => {
  for (const [drive, entry] of [
    [(side: Side) => keys(side, ENTER), EXPLORE_ENTRY],
    [(side: Side) => keys(side, "e"), EXPLORE_ENTRY],
    [(side: Side) => clickPanelRow(side, panelRow(side, EXPLORE_ROW)), EXPLORE_ENTRY],
    [(side: Side) => keys(side, "n"), NEXUS_ENTRY],
    [(side: Side) => clickPanelRow(side, panelRow(side, NEXUS_ROW)), NEXUS_ENTRY],
    [(side: Side) => clickPanelRow(side, barracksRow(side)), entryOfConstruct(0)],
  ] as const) {
    const side = buildSide()
    drive(side)
    assert.deepEqual(side.build.state.ack, { seq: 1, kind: "pressed", entry })
  }
})

test("Left and Right on any menu row only flicker it, however many come: the keyboard, the highlight and the map stay as they were", () => {
  for (const [name, begin] of [["Explore Map", []], ["the Hatchery", [DOWN, DOWN, DOWN]]] as const) {
    const side = buildSide()
    keys(side, ...begin)
    const highlight = side.build.state.menuHighlight
    for (const [index, key] of [RIGHT, RIGHT, LEFT, LEFT, RIGHT].entries()) {
      keys(side, key)
      assert.equal(side.build.state.focus, "menu", `${name}: key ${index + 1} moved the keyboard off the menu`)
      assert.deepEqual(side.build.state.ack, { seq: index + 1, kind: "refused", entry: highlight }, `${name}: key ${index + 1}`)
    }
    assert.equal(side.build.state.menuHighlight, highlight)
    assert.equal(side.build.state.armed, null)
    assert.equal(side.build.state.handoff, null, `${name}: Left or Right handed the keyboard to the map`)
  }
})

test("a placement begun on the menu comes back with the building's row flashing once, by key or by click", () => {
  const byKey = buildSide()
  keys(byKey, DOWN, DOWN, DOWN, ENTER) // the Hatchery, armed from the menu
  const armedSeq = byKey.build.state.ack?.seq as number
  keys(byKey, ENTER)
  assert.equal(byKey.build.state.focus, "menu")
  assert.deepEqual(byKey.build.state.ack, { seq: armedSeq + 1, kind: "pressed", entry: entryOfConstruct(1) })
  // The flash plays on the row the player comes back to.
  const row = menuEntryRow(byKey.layout, SPIKE_CATALOG, { kind: "construct", index: 1 }) as number
  const flash = { kind: "pressed", entry: entryOfConstruct(1) } as const
  assert.equal(cellAt(compose(byKey, { ack: flash }), byKey.layout.dividerColumn - 1, row).style.underline, true)

  const byClick = buildSide()
  clickPanelRow(byClick, row)
  const clickSeq = byClick.build.state.ack?.seq as number
  const cursor = byClick.build.state.cursor
  byClick.build.dispatch({ kind: "click-tile", x: cursor.x, y: cursor.y }) // the confirming click
  assert.equal(byClick.build.state.planned.length, 1)
  assert.equal(byClick.build.state.focus, "menu")
  assert.deepEqual(byClick.build.state.ack, { seq: clickSeq + 1, kind: "pressed", entry: entryOfConstruct(1) })

  // Begun on the map, the keyboard stays there: no flash on the menu.
  const fromMap = buildSide()
  keys(fromMap, TAB, "2")
  const mapSeq = fromMap.build.state.ack?.seq
  keys(fromMap, ENTER)
  assert.equal(fromMap.build.state.focus, "grid")
  assert.equal(fromMap.build.state.ack?.seq, mapSeq, "a placement on the map flashed a menu row")
})
