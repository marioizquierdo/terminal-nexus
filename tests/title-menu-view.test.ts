// The menu frame itself — docs/system-design/presentation.md and input.md: every hotkey is displayed, every glyph is one column,
// monochrome emits no colour code, and the same information survives every capability tier.

import { test } from "node:test"
import assert from "node:assert/strict"
import { CAPABILITY_MODES, cellAt, frameToAnsi, frameToText, offendingGlyph } from "../src/view/index.ts"
import { MENU_LAYOUT, MENU_SIZE, composeMenuFrame } from "../src/view/menu.ts"
import { menuItemLabel, menuItemRow } from "../src/title-menu/layout.ts"
import { createMenuList } from "../src/title-menu/list.ts"
import type { MenuItem } from "../src/title-menu/types.ts"
import { TOP_LEVEL_ITEMS } from "../src/cli/menu.ts"
import { isColourCode, sgrCodes } from "./helpers.ts"

/** The real top-level menu — five rows since About — so these checks cover what a
 *  player sees rather than a copy of it that can fall behind. */
const ITEMS: readonly MenuItem[] = TOP_LEVEL_ITEMS

test("the frame is the RULE floor, 80x24, at every capability tier", () => {
  for (const capability of CAPABILITY_MODES) {
    const frame = composeMenuFrame({ state: createMenuList(ITEMS), notice: null }, capability)
    assert.equal(frame.width, MENU_SIZE.width)
    assert.equal(frame.height, MENU_SIZE.height)
  }
})

test("every cell is exactly one printable column, at every capability tier and in monochrome", () => {
  for (const capability of CAPABILITY_MODES) {
    const frame = composeMenuFrame({ state: createMenuList(ITEMS), notice: "a stub notice" }, capability)
    assert.equal(offendingGlyph(frame), null, `${capability}: a cell was not one ASCII character`)
  }
})

test("monochrome emits no colour code at all; a colour tier emits at least one", () => {
  const frame = composeMenuFrame({ state: createMenuList(ITEMS), notice: null }, "monochrome")
  assert.ok(!sgrCodes(frameToAnsi(frame, "monochrome")).some(isColourCode), "monochrome emitted a colour code")

  const colourFrame = composeMenuFrame({ state: createMenuList(ITEMS), notice: null }, "color16")
  assert.ok(sgrCodes(frameToAnsi(colourFrame, "color16")).some(isColourCode), "color16 emitted no colour at all")
})

test("every item's hotkey and label are literally on screen — a hotkey that is not displayed does not exist", () => {
  const text = frameToText(composeMenuFrame({ state: createMenuList(ITEMS), notice: null }, "color16"))
  for (const item of ITEMS) {
    assert.ok(text.includes(menuItemLabel(item)), `"${menuItemLabel(item)}" is not on screen`)
  }
})

test("the highlighted row, and only it, renders inverse — the carrier monochrome keeps", () => {
  for (let highlighted = 0; highlighted < ITEMS.length; highlighted += 1) {
    const state = { items: ITEMS, highlighted }
    const frame = composeMenuFrame({ state, notice: null }, "monochrome")
    ITEMS.forEach((_item, index) => {
      const row = menuItemRow(MENU_LAYOUT, index)
      const cell = cellAt(frame, MENU_LAYOUT.column, row)
      assert.equal(
        cell.style.inverse === true,
        index === highlighted,
        `row ${index} inverse=${String(cell.style.inverse)}, expected ${index === highlighted}`,
      )
    })
  }
})

test("a notice, when set, is on screen; when null, nothing is printed in its place", () => {
  const withNotice = frameToText(
    composeMenuFrame({ state: createMenuList(ITEMS), notice: "Campaign is not built yet." }, "color16"),
  )
  assert.ok(withNotice.includes("Campaign is not built yet."))

  const withoutNotice = frameToText(
    composeMenuFrame({ state: createMenuList(ITEMS), notice: null }, "color16"),
  )
  assert.ok(!withoutNotice.includes("Campaign is not built yet."))
})

test("a disabled item renders dimmed when not highlighted, and exactly like any other when it is", () => {
  const items: readonly MenuItem[] = [
    { id: "a", hotkey: "1", label: "Alpha" },
    { id: "b", hotkey: "2", label: "Bravo (not built yet)", disabled: true },
  ]

  // Neither item highlighted at once, so highlight `1` (the disabled one) here to see item 0 - the
  // live one - in its own normal, unhighlighted state.
  const withDisabledHighlighted = composeMenuFrame(
    { state: { items, highlighted: 1 }, notice: null },
    "color16",
  )
  const liveCell = cellAt(withDisabledHighlighted, MENU_LAYOUT.column, menuItemRow(MENU_LAYOUT, 0))
  assert.equal(liveCell.style.fgRole, "chrome.hotkey", "a live row's own hotkey lost its usual role")
  const highlightedDisabledCell = cellAt(withDisabledHighlighted, MENU_LAYOUT.column, menuItemRow(MENU_LAYOUT, 1))
  assert.equal(highlightedDisabledCell.style.inverse, true, "a highlighted disabled row was not inverse")

  // And the reverse: highlight `0` (the default) to see the disabled item, index 1, at rest.
  const atRest = composeMenuFrame({ state: createMenuList(items), notice: null }, "color16")
  const disabledCell = cellAt(atRest, MENU_LAYOUT.column, menuItemRow(MENU_LAYOUT, 1))
  assert.equal(disabledCell.style.fgRole, "chrome.muted", "a disabled row did not use the muted role")
  assert.equal(disabledCell.style.dim, true, "a disabled row was not dimmed")
  assert.notEqual(disabledCell.style.fgRole, "chrome.hotkey", "a disabled row's hotkey read like a live one")

  const text = frameToText(atRest)
  assert.ok(text.includes(menuItemLabel(items[1] as MenuItem)), "a disabled item's hotkey is not displayed at all")
})

test("an empty item list renders a legal, complete frame rather than throwing", () => {
  const frame = composeMenuFrame({ state: createMenuList([]), notice: null }, "truecolor")
  assert.equal(offendingGlyph(frame), null)
})

test("a body starts a row below the last row, wraps at words, and stops before the controls line however long it is", () => {
  const items: readonly MenuItem[] = [{ id: "back", hotkey: "1", label: "Back" }]
  const long = Array.from({ length: 60 }, (_unused, index) => `word${index}`).join(" ")
  const frame = composeMenuFrame(
    { state: createMenuList(items), notice: null, showBack: true, body: [{ heading: "Heading", text: [long, long] }] },
    "color16",
  )
  const lines = frameToText(frame).split("\n")
  const headingRow = menuItemRow(MENU_LAYOUT, items.length)
  assert.equal((lines[headingRow] ?? "").slice(1, -1).trim(), "Heading")
  assert.equal((lines[headingRow] ?? "").indexOf("Heading"), MENU_LAYOUT.column, "the body is not at the rows' own column")
  assert.equal(cellAt(frame, MENU_LAYOUT.column, headingRow).style.bold, true, "the heading is not drawn as one")
  // Wrapped between words: no line of the body ends inside a word.
  for (let row = headingRow + 1; row < MENU_SIZE.height - 4; row += 1) {
    const words = (lines[row] ?? "").slice(1, -1).trim()
    assert.match(words, /^(word\d+ ?)+$/u, `row ${row} is not whole words: "${words}"`)
  }
  // Too long to fit: cut off a blank row above the controls line, which still reads whole.
  assert.equal((lines[MENU_SIZE.height - 4] ?? "").slice(1, -1).trim(), "", "the body ran up against the controls line")
  assert.match(lines[MENU_SIZE.height - 3] ?? "", /esc back {2}- {2}q quit/u)
})
