// The menu frame itself — engine.md 9.6/9.7: every hotkey is displayed, every glyph is one column,
// monochrome emits no colour code, and the same information survives every capability tier.

import { test } from "node:test"
import assert from "node:assert/strict"
import { CAPABILITY_MODES, cellAt, frameToAnsi, frameToText, offendingGlyph } from "../src/view/index.ts"
import { MENU_LAYOUT, MENU_SIZE, composeMenuFrame } from "../src/view/menu.ts"
import { menuItemLabel, menuItemRow } from "../src/menu/layout.ts"
import { createMenuList } from "../src/menu/list.ts"
import type { MenuItem } from "../src/menu/types.ts"

const ITEMS: readonly MenuItem[] = [
  { id: "campaign", hotkey: "1", label: "Campaign" },
  { id: "challenge", hotkey: "2", label: "Challenge" },
  { id: "settings", hotkey: "3", label: "Settings" },
  { id: "exit", hotkey: "4", label: "Exit" },
]

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
  const codes = (ansi: string): number[] =>
    [...ansi.matchAll(/\u001b\[([0-9;]*)m/g)].flatMap((match) => (match[1] ?? "").split(";").filter(Boolean).map(Number))
  const isColourCode = (code: number): boolean => (code >= 30 && code <= 49) || (code >= 90 && code <= 107)

  assert.ok(!codes(frameToAnsi(frame, "monochrome")).some(isColourCode), "monochrome emitted a colour code")

  const colourFrame = composeMenuFrame({ state: createMenuList(ITEMS), notice: null }, "color16")
  assert.ok(codes(frameToAnsi(colourFrame, "color16")).some(isColourCode), "color16 emitted no colour at all")
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
    { id: "b", hotkey: "2", label: "Bravo (Milestone 11)", disabled: true },
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
