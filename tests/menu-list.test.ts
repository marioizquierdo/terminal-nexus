// The pure menu-list reducer, and the one table of keys every list and the map cursor read — no stdin,
// no ANSI, no backend involved at all.

import { test } from "node:test"
import assert from "node:assert/strict"
import { applyMenuCommand, createMenuList, moveHighlight } from "../src/menu/list.ts"
import { cursorKeyOf, listKeyOf, stepListIndex } from "../src/menu/list-keys.ts"
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

test("moveHighlight stops at both ends of the list, and a jump goes all the way to one", () => {
  // It wrapped until the owner's 2026-09-30 feedback F75: "should not rotate ... if I keep down pressed,
  // it should quickly move to the bottom and stay there".
  const state = createMenuList(ITEMS)
  assert.equal(moveHighlight(state, 1), 1)
  assert.equal(moveHighlight({ ...state, highlighted: 2 }, 1), 2, "came round forward past the end")
  assert.equal(moveHighlight(state, -1), 0, "came round backward past the start")
  assert.equal(moveHighlight(state, 5), 2, "a long move is clamped at the end")
  assert.equal(moveHighlight(state, 1, true), 2, "a jump down is the last row")
  assert.equal(moveHighlight({ ...state, highlighted: 2 }, -1, true), 0, "a jump up is the first row")
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

const ESC = String.fromCharCode(27)

test("list keys: plain arrows step, every fast form the map knows jumps the same way, left and right are not list keys", () => {
  assert.deepEqual(listKeyOf(`${ESC}[A`), { direction: -1, jump: false })
  assert.deepEqual(listKeyOf(`${ESC}OB`), { direction: 1, jump: false })
  const fastUpDown = [
    ...[2, 3, 4, 5, 6, 7, 8].flatMap((modifier) => [`${ESC}[1;${modifier}A`, `${ESC}[1;${modifier}B`]),
    `${ESC}[a`,
    `${ESC}[b`,
    `${ESC}${ESC}[A`,
    `${ESC}${ESC}[B`,
    `${ESC}[5~`,
    `${ESC}[6~`,
  ]
  for (const key of fastUpDown) {
    const map = cursorKeyOf(key)
    assert.ok(map !== null && map.jump && map.dy !== 0, JSON.stringify(key))
    assert.deepEqual(listKeyOf(key), { direction: map.dy, jump: true }, JSON.stringify(key))
  }
  // Home and End, left and right on the map, are a list's first and last row, in every spelling.
  for (const key of [`${ESC}[H`, `${ESC}OH`, `${ESC}[1~`, `${ESC}[7~`]) {
    assert.equal(cursorKeyOf(key)?.dx, -1)
    assert.deepEqual(listKeyOf(key), { direction: -1, jump: true }, JSON.stringify(key))
  }
  for (const key of [`${ESC}[F`, `${ESC}OF`, `${ESC}[4~`, `${ESC}[8~`]) {
    assert.equal(cursorKeyOf(key)?.dx, 1)
    assert.deepEqual(listKeyOf(key), { direction: 1, jump: true }, JSON.stringify(key))
  }
  for (const key of [`${ESC}[D`, `${ESC}[1;2C`, `${ESC}b`, `${ESC}f`, `${ESC}${ESC}[D`, `${ESC}[c`, "x", ESC]) {
    assert.equal(listKeyOf(key), null, JSON.stringify(key))
  }
})

test("a step in a list is clamped to its rows: it stops at either end", () => {
  assert.equal(stepListIndex(3, 5, 10), 4)
  assert.equal(stepListIndex(3, 5, -10), 0)
  assert.equal(stepListIndex(0, 0, 1), 0)
})
