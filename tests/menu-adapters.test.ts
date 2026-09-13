// The keyboard adapter, the mouse adapter, and the sharp edge of Gate 3A's acceptance: keyboard,
// mouse, and the driver must all reach the identical named command from raw input, not merely agree
// once something has already decoded it. engine.md 9.7: "asserting at the command layer proves
// nothing" — every path below starts from a raw byte or a raw SGR sequence, never a hand-built
// `MenuCommand`, and the mouse coordinates are derived from the same `menuItemRow`/`menuItemLabel`
// functions the real composer draws with, not hand-picked numbers that could quietly stop matching
// the screen.

import { test } from "node:test"
import assert from "node:assert/strict"
import { keyboardCommand } from "../src/menu/keyboard.ts"
import { createMenuList } from "../src/menu/list.ts"
import { menuIndexAt, menuItemLabel, menuItemRow } from "../src/menu/layout.ts"
import type { MenuLayout } from "../src/menu/layout.ts"
import { formatMouseClick, mouseCommand, parseMouseClick } from "../src/menu/mouse.ts"
import { MenuSession } from "../src/menu/session.ts"
import type { MenuItem } from "../src/menu/types.ts"
import { TOP_LEVEL_ITEMS } from "../src/cli/menu.ts"
import { MENU_LAYOUT } from "../src/view/menu.ts"

const ESC = String.fromCharCode(27)
const ARROW_DOWN = `${ESC}[B`
const ARROW_UP = `${ESC}[A`

const ITEMS: readonly MenuItem[] = [
  { id: "a", hotkey: "1", label: "Alpha" },
  { id: "b", hotkey: "2", label: "Bravo" },
  { id: "c", hotkey: "3", label: "Charlie" },
]
const LAYOUT: MenuLayout = { column: 4, row: 6, rowStep: 2 }

test("keyboardCommand: digits activate by hotkey, regardless of current highlight", () => {
  const state = createMenuList(ITEMS)
  assert.deepEqual(keyboardCommand("2", state), { kind: "activate", index: 1 })
  assert.deepEqual(keyboardCommand("3", { ...state, highlighted: 1 }), { kind: "activate", index: 2 })
})

test("keyboardCommand: arrows move the highlight and wrap; Enter activates the highlighted item", () => {
  const state = createMenuList(ITEMS)
  assert.deepEqual(keyboardCommand(ARROW_DOWN, state), { kind: "highlight", index: 1 })
  assert.deepEqual(keyboardCommand(ARROW_UP, state), { kind: "highlight", index: 2 }, "did not wrap")
  assert.deepEqual(keyboardCommand("\r", { ...state, highlighted: 2 }), { kind: "activate", index: 2 })
  assert.deepEqual(keyboardCommand("\n", { ...state, highlighted: 0 }), { kind: "activate", index: 0 })
})

test("keyboardCommand: q and Ctrl+C both quit; an unbound key means nothing", () => {
  const state = createMenuList(ITEMS)
  assert.deepEqual(keyboardCommand("q", state), { kind: "quit" })
  assert.deepEqual(keyboardCommand(String.fromCharCode(3), state), { kind: "quit" })
  assert.equal(keyboardCommand("z", state), null)
  assert.equal(keyboardCommand("9", state), null, "a digit with no matching hotkey is not a command")
})

test("parseMouseClick: recognises a plain left-button press, in real 1-based terminal coordinates", () => {
  assert.deepEqual(parseMouseClick(`${ESC}[<0;5;10M`), { column: 4, row: 9 })
})

test("parseMouseClick: ignores a release, a non-left button, and anything else", () => {
  assert.equal(parseMouseClick(`${ESC}[<0;5;10m`), null, "a release should not click")
  assert.equal(parseMouseClick(`${ESC}[<2;5;10M`), null, "a right click should not click")
  assert.equal(parseMouseClick(`${ESC}[<64;5;10M`), null, "a wheel event should not click")
  assert.equal(parseMouseClick("q"), null, "a plain key is not a mouse report")
  assert.equal(parseMouseClick(`${ESC}[A`), null, "an arrow key is not a mouse report")
})

test("formatMouseClick is the exact inverse of parseMouseClick", () => {
  for (const [column, row] of [
    [1, 1],
    [5, 10],
    [80, 24],
  ] as const) {
    assert.deepEqual(parseMouseClick(formatMouseClick(column, row)), { column: column - 1, row: row - 1 })
  }
})

test("menuIndexAt: a click lands only within the row and the label's own width", () => {
  const label = menuItemLabel(ITEMS[1] as MenuItem) // "[2] Bravo"
  const row = menuItemRow(LAYOUT, 1)
  assert.equal(menuIndexAt(ITEMS, LAYOUT, LAYOUT.column, row), 1, "the label's first column missed")
  assert.equal(
    menuIndexAt(ITEMS, LAYOUT, LAYOUT.column + label.length - 1, row),
    1,
    "the label's last column missed",
  )
  assert.equal(
    menuIndexAt(ITEMS, LAYOUT, LAYOUT.column + label.length, row),
    null,
    "one column past the label activated anyway",
  )
  assert.equal(menuIndexAt(ITEMS, LAYOUT, LAYOUT.column - 1, row), null, "one column before the label activated anyway")
  assert.equal(menuIndexAt(ITEMS, LAYOUT, LAYOUT.column, row + 1), null, "a row between two items activated anyway")
  assert.equal(menuIndexAt(ITEMS, LAYOUT, LAYOUT.column, row - 1), null)
})

test("mouseCommand: a click on a row activates that item; a miss produces no command", () => {
  const row = menuItemRow(LAYOUT, 2)
  assert.deepEqual(mouseCommand({ column: LAYOUT.column, row }, ITEMS, LAYOUT), {
    kind: "activate",
    index: 2,
  })
  assert.equal(mouseCommand({ column: 0, row: 0 }, ITEMS, LAYOUT), null)
})

/** Drives a fresh session with raw bytes only and reports which item (if any) ended up activated —
 *  the externally observable proof an adapter did its job, not an internal command object. */
function activatedBy(drive: (session: MenuSession) => void): MenuItem | null {
  let activated: MenuItem | null = null
  const session = new MenuSession({
    items: TOP_LEVEL_ITEMS,
    onActivate: (item) => {
      activated = item
    },
    onQuit: () => {},
  })
  drive(session)
  return activated
}

test(
  "the sharp edge: a raw hotkey byte, raw arrows-then-Enter, and a raw mouse click at the item's " +
    "own rendered position all activate the identical item — through the real driver, not a " +
    "hand-built command",
  () => {
    for (let index = 0; index < TOP_LEVEL_ITEMS.length; index += 1) {
      const expected = TOP_LEVEL_ITEMS[index] as MenuItem

      // 1. Keyboard: the raw byte is the hotkey the screen actually displays for this row — not a
      // hardcoded digit that could silently drift from what composeMenuFrame draws.
      const viaHotkeyCommand = keyboardCommand(expected.hotkey, createMenuList(TOP_LEVEL_ITEMS))
      assert.deepEqual(viaHotkeyCommand, { kind: "activate", index }, `hotkey adapter, item ${index}`)
      const viaHotkey = activatedBy((session) => session.handleData(expected.hotkey, MENU_LAYOUT))

      // 2. Keyboard: raw arrow-down bytes, `index` times from the top, then a raw Enter byte.
      const viaArrows = activatedBy((session) => {
        for (let step = 0; step < index; step += 1) session.handleData(ARROW_DOWN, MENU_LAYOUT)
        session.handleData("\r", MENU_LAYOUT)
      })

      // 3. Mouse: a raw SGR click sequence at the exact cell `menuItemRow`/`menuItemLabel` say this
      // row occupies — the same two functions the real composer calls to draw it — round-tripped
      // through `formatMouseClick`, the literal bytes a terminal would send.
      const row = menuItemRow(MENU_LAYOUT, index)
      const label = menuItemLabel(expected)
      const column = MENU_LAYOUT.column + Math.floor(label.length / 2)
      const rawClick = formatMouseClick(column + 1, row + 1) // terminal coordinates are 1-based
      const parsedClick = parseMouseClick(rawClick)
      assert.notEqual(parsedClick, null, `item ${index}'s own row did not parse as a click at all`)
      const viaClickCommand = mouseCommand(parsedClick!, TOP_LEVEL_ITEMS, MENU_LAYOUT)
      assert.deepEqual(viaClickCommand, { kind: "activate", index }, `mouse adapter, item ${index}`)
      const viaClick = activatedBy((session) => session.handleData(rawClick, MENU_LAYOUT))

      assert.equal(viaHotkey?.id, expected.id, `raw hotkey byte did not activate ${expected.id}`)
      assert.equal(viaArrows?.id, expected.id, `raw arrows+Enter did not activate ${expected.id}`)
      assert.equal(viaClick?.id, expected.id, `raw mouse click did not activate ${expected.id}`)
    }
  },
)

test("a click that misses every row, injected as raw bytes, activates nothing at all", () => {
  const activated = activatedBy((session) => session.handleData(formatMouseClick(1, 1), MENU_LAYOUT))
  assert.equal(activated, null)
})

test("MenuSession.handleData splits several raw keys in one chunk, exactly like a fast typist or a paste", () => {
  const activatedIds: string[] = []
  const session = new MenuSession({
    items: TOP_LEVEL_ITEMS,
    onActivate: (item) => activatedIds.push(item.id),
    onQuit: () => activatedIds.push("quit"),
  })
  // Three hotkeys arriving in a single stdin "data" event, the way a terminal actually delivers them.
  session.handleData(
    `${TOP_LEVEL_ITEMS[0]?.hotkey}${TOP_LEVEL_ITEMS[1]?.hotkey}${TOP_LEVEL_ITEMS[2]?.hotkey}`,
    MENU_LAYOUT,
  )
  assert.deepEqual(activatedIds, [
    TOP_LEVEL_ITEMS[0]?.id,
    TOP_LEVEL_ITEMS[1]?.id,
    TOP_LEVEL_ITEMS[2]?.id,
  ])
})
