// The pure menu-list reducer — no stdin, no ANSI, no backend involved at all.

import { test } from "node:test"
import assert from "node:assert/strict"
import { applyMenuCommand, createMenuList, moveHighlight } from "../src/menu/list.ts"
import type { MenuItem } from "../src/menu/types.ts"

const ITEMS: readonly MenuItem[] = [
  { id: "a", hotkey: "1", label: "Alpha" },
  { id: "b", hotkey: "2", label: "Bravo" },
  { id: "c", hotkey: "3", label: "Charlie" },
]

test("createMenuList starts highlighted on the first item", () => {
  const state = createMenuList(ITEMS)
  assert.equal(state.highlighted, 0)
  assert.deepEqual(state.items, ITEMS)
})

test("moveHighlight wraps at both ends of the list", () => {
  const state = createMenuList(ITEMS)
  assert.equal(moveHighlight(state, 1), 1)
  assert.equal(moveHighlight({ ...state, highlighted: 2 }, 1), 0, "did not wrap forward past the end")
  assert.equal(moveHighlight(state, -1), 2, "did not wrap backward past the start")
})

test("moveHighlight on a one-item list always stays put — the acceptance criterion's own edge case", () => {
  const state = createMenuList([{ id: "only", hotkey: "1", label: "Only" }])
  assert.equal(moveHighlight(state, 1), 0)
  assert.equal(moveHighlight(state, -1), 0)
})

test("moveHighlight on an empty list never throws", () => {
  const state = createMenuList([])
  assert.equal(moveHighlight(state, 1), 0)
  assert.equal(moveHighlight(state, -1), 0)
})

test("a highlight command moves the highlight and activates nothing", () => {
  const state = createMenuList(ITEMS)
  const outcome = applyMenuCommand(state, { kind: "highlight", index: 2 })
  assert.equal(outcome.state.highlighted, 2)
  assert.equal(outcome.activated, null)
})

test("an out-of-range highlight command is ignored rather than corrupting the state", () => {
  const state = createMenuList(ITEMS)
  const outcome = applyMenuCommand(state, { kind: "highlight", index: 99 })
  assert.deepEqual(outcome, { state, activated: null })
})

test("an activate command both moves the highlight there and reports what activated", () => {
  const state = createMenuList(ITEMS)
  const outcome = applyMenuCommand(state, { kind: "activate", index: 1 })
  assert.equal(outcome.state.highlighted, 1)
  assert.deepEqual(outcome.activated, ITEMS[1])
})

test("an out-of-range activate command activates nothing", () => {
  const state = createMenuList(ITEMS)
  const outcome = applyMenuCommand(state, { kind: "activate", index: -1 })
  assert.deepEqual(outcome, { state, activated: null })
})

test("quit passes through the reducer untouched — leaving is not a list concern", () => {
  const state = createMenuList(ITEMS)
  const outcome = applyMenuCommand(state, { kind: "quit" })
  assert.deepEqual(outcome, { state, activated: null })
})
