// The Build Phase menu after the owner's menu spike (2026-09-30, feedback F53-F58, and its second round,
// F67 and F70-F72): Explore Map and Nexus, the credits line and one list of buildings, the active style
// (the row's own hotkey and one `>`), the building's card while it is being
// placed, Left and Right that only flicker, the one flash on the way back to the menu, and the
// reducer's record of a menu row handing the keyboard to the map. No row or height is hardcoded: every
// place is read from the layout, because the bottom bar's height is not this file's to fix.

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_CATALOG } from "../src/build/catalog.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import {
  CARD_FIRST_ROW,
  CARD_HEADER_ROW,
  CARD_SEPARATOR_ROW,
  EXPLORE_ROW,
  NEXUS_ROW,
  RESOURCE_ROW,
  buildLayout,
  constructLines,
  menuEntryAt,
  menuEntryRow,
  menuFloor,
  startRow,
} from "../src/build/layout.ts"
import { MOUSE_LEFT, buildMouseCommand, formatMouseEvent, parseMouseEvent } from "../src/build/mouse.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildContext } from "../src/build/state.ts"
import { EXPLORE_ENTRY, NEXUS_ENTRY, cardShowing, entryOfConstruct, menuEntries, remaining, startEntry } from "../src/build/state.ts"
import type { ConstructItem } from "../src/build/types.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { ACTIVE_VALUE, composeBuildFrame } from "../src/view/build.ts"
import type { BuildFlash } from "../src/view/build.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"

const ESC = String.fromCharCode(27)
const UP = `${ESC}[A`
const DOWN = `${ESC}[B`
const RIGHT = `${ESC}[C`
const LEFT = `${ESC}[D`
const TAB = "\t"
const ENTER = "\r"
const MINIMUM = { columns: 80, rows: 24 }
const ROOMY = { columns: 120, rows: 40 }

type Side = { build: BuildSession; layout: BuildLayout; context: BuildContext }

function session(context: BuildContext = spikeContext(), terminal = MINIMUM): Side {
  const layout = buildLayout(terminal, context.grid)
  const build = new BuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
  return { build, layout, context }
}

function keys(side: Side, ...sequence: string[]): void {
  for (const key of sequence) side.build.handleData(key, side.layout)
}

function clickCell(side: Side, column: number, row: number): void {
  keys(side, formatMouseEvent(MOUSE_LEFT, column + 1, row + 1))
}

function frameOf(side: Side, flash?: BuildFlash) {
  return composeBuildFrame(
    { context: side.context, state: side.build.state, layout: side.layout, ...(flash === undefined ? {} : { flash }) },
    "monochrome",
  )
}

/** One panel row's text, from the panel's first column to the divider. */
function panelLine(side: Side, row: number, flash?: BuildFlash): string {
  const line = frameToText(frameOf(side, flash)).split("\n")[row] ?? ""
  return line.padEnd(side.layout.frame.width).slice(side.layout.panelColumn, side.layout.dividerColumn)
}

/** The whole panel, row by row. */
function panelLines(side: Side): string[] {
  const rows: string[] = []
  for (let row = side.layout.panelRow; row <= side.layout.panelBindingsRow; row += 1) rows.push(panelLine(side, row))
  return rows
}

const at = (side: Side, row: number): number => side.layout.panelRow + row

// --- The menu: resources, then one list (F56, F57) --------------------------------------------------

test("the menu reads: Explore Map, Nexus, the credits line, the buildings, and Start Pulse last", () => {
  for (const terminal of [MINIMUM, ROOMY]) {
    const side = session(spikeContext(), terminal)
    const { layout } = side
    const limit = layout.panelLimit
    // Explore Map and Nexus with no blank line between them (feedback F72); then the credits,
    // right-aligned against the divider where the costs are, with the map's resource symbol (F71).
    assert.match(panelLine(side, at(side, EXPLORE_ROW)), /^\[e\] Explore Map +$/)
    assert.equal(at(side, NEXUS_ROW), at(side, EXPLORE_ROW) + 1)
    assert.match(panelLine(side, at(side, NEXUS_ROW)), /^\[n\] Nexus \(1\) +$/)
    assert.equal(at(side, RESOURCE_ROW), at(side, NEXUS_ROW) + 1)
    assert.equal(panelLine(side, at(side, RESOURCE_ROW)), "* 100".padStart(limit))
    const lines = constructLines(layout, SPIKE_CATALOG)
    assert.equal(lines[0]?.row, at(side, RESOURCE_ROW) + 1, "the buildings start on the line after the credits")
    SPIKE_CATALOG.forEach((item, index) => {
      assert.equal(lines[index]?.row, (lines[0]?.row as number) + index, "the buildings are one row apart")
      const line = panelLine(side, lines[index]?.row as number)
      assert.equal(line, `[${item.hotkey}] ${item.label}`.padEnd(limit - String(item.cost).length) + String(item.cost))
    })
    // Nothing between the last building and Start Pulse: no headings, no SPECIAL, no help text.
    for (let row = (lines.at(-1)?.row as number) + 1; row < startRow(layout); row += 1) {
      assert.equal(panelLine(side, row).trim(), "", `row ${row} is not empty: "${panelLine(side, row)}"`)
    }
    assert.match(panelLine(side, startRow(layout)), /^\[s\] Start Pulse +$/)
    // The cost column and the resources line end on the same column.
    const costEnd = panelLine(side, lines[0]?.row as number).trimEnd().length
    assert.equal(panelLine(side, at(side, RESOURCE_ROW)).trimEnd().length, costEnd)
  }
})

test("the credits line counts down as the plan grows, and is on the menu alone — never on a card", () => {
  const side = session()
  keys(side, "1", ENTER) // a Barracks, back on the menu
  assert.equal(panelLine(side, at(side, RESOURCE_ROW)).trim(), `* ${remaining(side.context, side.build.state)}`)
  assert.equal(remaining(side.context, side.build.state), 60)
  keys(side, "e") // Explore Map's card (feedback F71: "specially when showing the details of a selection")
  assert.doesNotMatch(panelLines(side).join("\n"), /\* 60/)
  keys(side, "e", "2") // the Hatchery's card
  assert.doesNotMatch(panelLines(side).join("\n"), /\* 60/)
  // Committed: the summary, and no budget line.
  keys(side, ESC, "n", "1", "s", "s")
  assert.equal(side.build.state.committed, true)
  assert.doesNotMatch(panelLines(side).join("\n"), /[*$] \d/)
})

test("a building row the panel is too short for is neither drawn nor a click target", () => {
  // Three more buildings than the floor's panel holds between Nexus and Start Pulse.
  const floor = buildLayout(MINIMUM, spikeContext().grid)
  const room = menuFloor(floor) - (floor.panelRow + RESOURCE_ROW + 1) + 1
  const long: ConstructItem[] = Array.from({ length: room + 3 }, (_, index) => ({
    ...(SPIKE_CATALOG[index % SPIKE_CATALOG.length] as ConstructItem),
    label: `Row ${index + 1}`,
    hotkey: String((index + 1) % 10),
  }))
  const side = session({ ...spikeContext(), catalog: long })
  const { layout } = side
  const lines = constructLines(layout, long)
  assert.ok(lines.length < long.length, "the floor's panel holds every row: the test needs a longer list")
  assert.equal(lines.at(-1)?.row, menuFloor(layout), "the list stops on the row above Start Pulse")
  const hidden = lines.length
  assert.equal(menuEntryRow(layout, long, { kind: "construct", index: hidden }), null)
  assert.doesNotMatch(panelLines(side).join("\n"), new RegExp(`Row ${hidden + 1}\\b`))
  // No row of the panel answers a click with a building nobody drew.
  for (let row = layout.panelRow; row <= layout.panelBindingsRow; row += 1) {
    const entry = menuEntryAt(layout, long, layout.panelColumn + 2, row)
    if (entry === null || entry < entryOfConstruct(0) || entry >= startEntry(long.length)) continue
    assert.ok(entry - entryOfConstruct(0) < hidden, `row ${row} is a click target for a hidden building`)
  }
  assert.equal(menuEntryAt(layout, long, layout.panelColumn + 2, startRow(layout)), startEntry(long.length))
})

// --- The active style (F53) -------------------------------------------------------------------------

test("an active row keeps its own hotkey and ends in one >, and a flash on it still wins, drawn as the bar", () => {
  const side = session()
  keys(side, "n") // the Nexus popup: its row active behind it
  const row = at(side, NEXUS_ROW)
  assert.equal(ACTIVE_VALUE, ">")
  assert.equal(panelLine(side, row), `[n] Nexus (1)`.padEnd(side.layout.panelLimit - 1) + ACTIVE_VALUE)
  const plain = cellAt(frameOf(side), side.layout.dividerColumn - 1, row).style
  assert.notEqual(plain.inverse, true, "an active row is drawn with the bar")
  assert.equal(plain.bold, true)
  // The pressed flash plays on it: the bar, over the same words.
  const flash: BuildFlash = { kind: "pressed", entry: NEXUS_ENTRY }
  assert.equal(panelLine(side, row, flash), panelLine(side, row))
  const pressed = cellAt(frameOf(side, flash), side.layout.dividerColumn - 1, row).style
  assert.equal(pressed.inverse, true)
  assert.equal(pressed.underline, true)
  // `n` (the key that opened it) and `x` both close it; the row is back to `[n]` with its own value.
  keys(side, "x")
  assert.equal(side.build.state.overlay, null)
  assert.match(panelLine(side, row), /^\[n\] Nexus \(1\) +$/)
})

test("a popup that belongs to no row — the game menu, Settings, the Controls page — leaves the menu unlit", () => {
  for (const open of [[ESC], [ESC, "s"], [ESC, "c"]]) {
    const side = session()
    keys(side, ...open)
    assert.notEqual(side.build.state.overlay, null, `${JSON.stringify(open)} opened nothing`)
    for (const target of menuEntries(side.context)) {
      const row = menuEntryRow(side.layout, SPIKE_CATALOG, target) as number
      const style = cellAt(frameOf(side), side.layout.dividerColumn - 2, row).style
      assert.notEqual(style.inverse, true, `${side.build.state.overlay}: the menu's bar is lit on row ${row}`)
    }
  }
})

// --- The building's card (F58) ----------------------------------------------------------------------

test("armed, the panel is the building's card: its row active, a separator, glyphs, name, what it does, its numbers", () => {
  for (const terminal of [MINIMUM, ROOMY]) {
    const side = session(spikeContext(), terminal)
    keys(side, DOWN, DOWN, ENTER) // the Barracks, from the menu
    assert.equal(cardShowing(side.build.state), true)
    const { layout } = side
    const lines = panelLines(side)
    // No credits on a card (feedback F71): the row that opened it is the panel's first line.
    assert.equal(CARD_HEADER_ROW, 0)
    assert.equal(lines[CARD_HEADER_ROW], `[1] Barracks`.padEnd(layout.panelLimit - 1) + ">")
    assert.equal(lines[CARD_SEPARATOR_ROW], "-".repeat(layout.panelLimit))
    const card = lines.slice(CARD_FIRST_ROW).join("\n")
    assert.match(lines[CARD_FIRST_ROW] as string, /^\[b\] +Barracks/)
    assert.match(lines[CARD_FIRST_ROW + 1] as string, /^\|_\| +to build/)
    assert.match(card, /Trains troopers each Pulse/)
    assert.match(card, /^COST +40$/m)
    assert.match(card, /^HEALTH +120$/m)
    assert.match(card, /^SIZE +3x2$/m)
    // Cost first, as the owner listed them (feedback F58: "cost, health, size, attack").
    assert.ok(card.indexOf("COST") < card.indexOf("HEALTH"))
    // No menu and no Start Pulse: the card is the whole panel.
    assert.doesNotMatch(card, /\[\d\]|\[n\]|Start Pulse|\[e\]/)
    assert.equal(panelLine(side, startRow(layout)).trim(), "")
    // No help text either, and the status line does not repeat what the card says.
    assert.doesNotMatch(card, /undo|remove|bksp/)
    assert.equal(side.build.state.status.text, "")
  }
})

test("a turret's card shows its attack", () => {
  // It was reached by a digit while placing a Barracks, which armed the Turret and changed the card,
  // until the owner's 2026-09-30 feedback F69 kept the menu on the armed building: another building's
  // digit is refused now (tests/build-behaviour-round-2.test.ts).
  const side = session()
  keys(side, "3")
  assert.equal(side.build.state.armed, 2)
  const card = panelLines(side).join("\n")
  assert.match(card, /\[3\] Turret +>/)
  assert.match(card, /^ATTACK +\d+ at range \d+$/m)
  assert.doesNotMatch(card, /Barracks/)
})

test("the card's header plays the building's own pressed flash", () => {
  const side = session()
  keys(side, "2")
  const flash: BuildFlash = { kind: "pressed", entry: entryOfConstruct(1) }
  const header = at(side, CARD_HEADER_ROW)
  assert.deepEqual(side.build.state.ack, { seq: 1, kind: "pressed", entry: entryOfConstruct(1) })
  const style = cellAt(frameOf(side, flash), side.layout.dividerColumn - 1, header).style
  assert.equal(style.inverse, true, "the flash did not play on the card's header")
  assert.equal(panelLine(side, header, flash), panelLine(side, header))
})

test("a click anywhere on the panel while a card shows goes back to where it began, and chooses nothing", () => {
  for (const [name, begin, back] of [
    ["armed from the menu", [DOWN, DOWN, ENTER], "menu"],
    ["armed on the map", [TAB, "1"], "grid"],
    ["Explore Map from the menu", ["e"], "menu"],
  ] as const) {
    const { layout } = session()
    for (const row of [at(session(), CARD_HEADER_ROW), at(session(), CARD_FIRST_ROW), startRow(layout), at(session(), NEXUS_ROW)]) {
      const side = session()
      keys(side, ...begin)
      assert.equal(cardShowing(side.build.state), true, `${name}: no card`)
      clickCell(side, layout.panelColumn + 4, row)
      assert.equal(cardShowing(side.build.state), false, `${name}: a click on row ${row} did not close the card`)
      assert.equal(side.build.state.focus, back, `${name}: went back to the wrong place`)
      assert.equal(side.build.state.armed, null, `${name}: a click on row ${row} armed something`)
      assert.equal(side.build.state.overlay, null, `${name}: a click on row ${row} opened a popup`)
      assert.equal(side.build.state.planned.length, 0)
    }
  }
  // The mouse adapter sends it as a menu click whatever row it lands on, as for Explore Map.
  const side = session()
  keys(side, "1")
  const click = parseMouseEvent(formatMouseEvent(MOUSE_LEFT, side.layout.panelColumn + 3, at(side, CARD_FIRST_ROW) + 3))
  assert.ok(click !== null)
  const command = buildMouseCommand(click, side.build.state.camera, side.layout, SPIKE_CATALOG, { cardPanel: true })
  assert.equal(command?.kind, "click-menu")
})

// --- The status line says less (F58) ----------------------------------------------------------------

test("arming and opening Explore Map say nothing on the status line; going back leaves nothing behind", () => {
  const side = session()
  keys(side, "1")
  assert.equal(side.build.state.status.text, "")
  keys(side, ESC)
  assert.equal(side.build.state.status.text, "Cancelled.")
  keys(side, "e")
  assert.equal(side.build.state.status.text, "", "Explore Map still says something")
  keys(side, "e")
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.status.text, "")
})

// --- Left and Right (F55) ---------------------------------------------------------------------------

test("Left and Right on any menu row only flicker it; the keyboard and the highlight stay", () => {
  const side = session()
  keys(side, DOWN, DOWN, DOWN) // the Hatchery
  const highlight = side.build.state.menuHighlight
  for (let press = 0; press < 5; press += 1) keys(side, press % 2 === 0 ? RIGHT : LEFT)
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.menuHighlight, highlight)
  assert.equal(side.build.state.armed, null)
  assert.deepEqual(side.build.state.ack, { seq: 5, kind: "refused", entry: highlight })
  assert.equal(side.build.state.handoff, null, "Left or Right handed the keyboard to the map")
})

test("the menu is still walked with Up, Down and Enter alone: every row, and each does what its key does", () => {
  const side = session()
  const count = menuEntries(side.context).length
  // Down stops on the last row and Up on the first: no list comes round (feedback F75).
  for (let step = 0; step < count; step += 1) keys(side, DOWN)
  assert.equal(side.build.state.menuHighlight, startEntry(SPIKE_CATALOG.length), "Down did not stop on the last row")
  for (let step = 0; step < count; step += 1) keys(side, UP)
  assert.equal(side.build.state.menuHighlight, EXPLORE_ENTRY, "Up did not stop on the first row")
})

// --- Back on the menu: one flash (F55) --------------------------------------------------------------

test("a placement begun on the menu comes back with the building's row flashing once, by key or by click", () => {
  const byKey = session()
  keys(byKey, DOWN, DOWN, DOWN, ENTER) // the Hatchery, armed from the menu
  const armedSeq = byKey.build.state.ack?.seq as number
  keys(byKey, ENTER)
  assert.equal(byKey.build.state.focus, "menu")
  assert.deepEqual(byKey.build.state.ack, { seq: armedSeq + 1, kind: "pressed", entry: entryOfConstruct(1) })
  // The flash plays on the row the player comes back to.
  const row = menuEntryRow(byKey.layout, SPIKE_CATALOG, { kind: "construct", index: 1 }) as number
  const flash = { kind: "pressed", entry: entryOfConstruct(1) } as const
  assert.equal(cellAt(frameOf(byKey, flash), byKey.layout.dividerColumn - 1, row).style.underline, true)

  const byClick = session()
  clickCell(byClick, byClick.layout.panelColumn + 3, menuEntryRow(byClick.layout, SPIKE_CATALOG, { kind: "construct", index: 1 }) as number)
  const clickSeq = byClick.build.state.ack?.seq as number
  const cursor = byClick.build.state.cursor
  byClick.build.dispatch({ kind: "click-tile", x: cursor.x, y: cursor.y }) // the confirming click
  assert.equal(byClick.build.state.planned.length, 1)
  assert.equal(byClick.build.state.focus, "menu")
  assert.deepEqual(byClick.build.state.ack, { seq: clickSeq + 1, kind: "pressed", entry: entryOfConstruct(1) })

  // Begun on the map, the keyboard stays there: no flash on the menu.
  const fromMap = session()
  keys(fromMap, TAB, "2")
  const mapSeq = fromMap.build.state.ack?.seq
  keys(fromMap, ENTER)
  assert.equal(fromMap.build.state.focus, "grid")
  assert.equal(fromMap.build.state.ack?.seq, mapSeq, "a placement on the map flashed a menu row")
})

// --- A menu row hands the keyboard to the map (F54) -------------------------------------------------

test("the hand-off is recorded when a menu row gives the keyboard to the map, and only then", () => {
  const handedOff: readonly [string, (side: Side) => void, number][] = [
    ["Enter on a building", (side) => keys(side, DOWN, DOWN, ENTER), entryOfConstruct(0)],
    ["a digit on the menu", (side) => keys(side, "2"), entryOfConstruct(1)],
    ["a click on a building from the menu", (side) => clickCell(side, side.layout.panelColumn + 3, menuEntryRow(side.layout, SPIKE_CATALOG, { kind: "construct", index: 2 }) as number), entryOfConstruct(2)],
    ["e on the menu", (side) => keys(side, "e"), EXPLORE_ENTRY],
    ["Enter on Explore Map", (side) => keys(side, ENTER), EXPLORE_ENTRY],
    ["a click on Explore Map", (side) => clickCell(side, side.layout.panelColumn + 3, at(side, EXPLORE_ROW)), EXPLORE_ENTRY],
    // Plain navigation keeps the menu beside the map, and a click on a building there is the menu's.
    ["a click on a building from the map", (side) => { keys(side, TAB); clickCell(side, side.layout.panelColumn + 3, menuEntryRow(side.layout, SPIKE_CATALOG, { kind: "construct", index: 0 }) as number) }, entryOfConstruct(0)],
  ]
  for (const [name, drive, entry] of handedOff) {
    const side = session()
    drive(side)
    assert.equal(side.build.state.focus, "grid", `${name}: the map does not have the keyboard`)
    assert.deepEqual(side.build.state.handoff, { seq: 1, entry }, `${name}: no hand-off`)
  }
  const notHandedOff: readonly [string, (side: Side) => void][] = [
    ["Tab", (side) => keys(side, TAB)],
    ["a click on the map", (side) => clickCell(side, side.layout.origin.column + 4, side.layout.origin.row + 4)],
    ["a digit on the map", (side) => keys(side, TAB, "1")],
    ["e on the map", (side) => keys(side, TAB, "e")],
    ["Enter on the map", (side) => keys(side, TAB, ENTER)],
    ["Nexus", (side) => keys(side, "n")],
  ]
  for (const [name, drive] of notHandedOff) {
    const side = session()
    const before = side.build.state.handoff
    drive(side)
    assert.deepEqual(side.build.state.handoff, before, `${name}: recorded a hand-off`)
  }
  // A building the player cannot afford is refused on the menu: nothing is handed to the map.
  const broke = session()
  keys(broke, "1", ENTER, "1", ENTER) // two Barracks: 20 left
  const seq = broke.build.state.handoff?.seq
  keys(broke, "1")
  assert.equal(broke.build.state.armed, null)
  assert.equal(broke.build.state.focus, "menu")
  assert.equal(broke.build.state.handoff?.seq, seq, "a refused arm handed off")
})

test("the way back records no hand-off, a second one counts on, and a restart keeps the count", () => {
  const side = session()
  keys(side, "1")
  assert.equal(side.build.state.handoff?.seq, 1)
  keys(side, ENTER) // placed: back on the menu
  keys(side, "e", ESC) // Explore Map from the menu, and back
  assert.deepEqual(side.build.state.handoff, { seq: 2, entry: EXPLORE_ENTRY }, "the way back was recorded")
  side.build.dispatch({ kind: "debug-restart" })
  assert.deepEqual(side.build.state.handoff, { seq: 2, entry: EXPLORE_ENTRY }, "a restart lost the count")
  assert.equal(side.build.state.planned.length, 0)
  keys(side, "2")
  assert.equal(side.build.state.handoff?.seq, 3)
})
