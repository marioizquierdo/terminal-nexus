// Moving in lists (docs/ui-patterns.md, "Moving in lists"): every list in the Build Phase — its menu, the
// Nexus powers, the game menu, Settings, the export, the Controls page — stops at its first and last
// row without a flicker; Shift+Up/Down, PageUp/PageDown and Home/End go to either end; a tap is one row,
// and a held arrow ramps with the map cursor's own steps and timings. Driven through raw bytes into the
// real adapters, with the key times handed in as numbers. The keys' own table is
// `tests/menu-list.test.ts`'s.

import { test } from "node:test"
import assert from "node:assert/strict"
import { controlsLineCount } from "../src/build/help.ts"
import { buildKeyboardCommand } from "../src/build/keyboard.ts"
import { GAME_MENU_ROWS, SETTINGS_EXPORT_ROW } from "../src/build/settings.ts"
import { NEXUS_ENTRY, menuEntries, startEntry } from "../src/build/state.ts"
import {
  DOWN,
  END,
  ESC,
  HOME,
  PAGE_DOWN,
  PAGE_UP,
  SHIFT_DOWN,
  SHIFT_UP,
  TAB,
  UP,
  buildSide,
  keys,
  placed,
  timed,
} from "./build-helpers.ts"

test("the Build Phase menu stops at both ends, with no flicker, and the fast move jumps to either end", () => {
  const side = buildSide()
  const last = menuEntries(side.context).length - 1
  assert.equal(last, startEntry(side.context.catalog.length))
  const before = side.build.state.ack
  keys(side, UP)
  assert.equal(side.build.state.menuHighlight, 0)
  assert.equal(side.build.state.ack, before, "Up on the first row flickered")
  for (const [key, to] of [
    [SHIFT_DOWN, last],
    [SHIFT_UP, 0],
    [PAGE_DOWN, last],
    [PAGE_UP, 0],
    [`${ESC}[b`, last], // rxvt's Shift+Down
    [`${ESC}[7~`, 0], // rxvt's Home
    [`${ESC}${ESC}[B`, last], // Option+Down
    [HOME, 0],
    [END, last],
    [`${ESC}[1~`, 0], // screen's Home
    [`${ESC}[4~`, last], // screen's End
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
  const mouse = buildSide()
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
    const side = buildSide()
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
  const settings = buildSide()
  keys(settings, ESC, "s")
  assert.equal(settings.build.state.popupHighlight, 0)
  keys(settings, UP)
  assert.equal(settings.build.state.popupHighlight, 0, "Up on the first setting came round to Export")
  keys(settings, END)
  assert.equal(settings.build.state.popupHighlight, SETTINGS_EXPORT_ROW)
  keys(settings, DOWN)
  assert.equal(settings.build.state.popupHighlight, SETTINGS_EXPORT_ROW)
  keys(settings, PAGE_UP)
  assert.equal(settings.build.state.popupHighlight, 0)
  // The export's lines, too.
  const exported = buildSide()
  keys(exported, "d", "e", UP)
  assert.equal(exported.build.state.popupHighlight, 0)
  keys(exported, END)
  const lines = placed(exported).spec.scroll
  assert.ok(lines !== undefined)
  assert.equal(exported.build.state.popupHighlight, lines.to - lines.from - 1)
})

/** A held arrow as a terminal repeats it: four presses 30 ms apart — enough to speed up, and fewer than
 *  any list here has rows to spare. */
const held = (key: string): (readonly [string, number])[] => Array.from({ length: 4 }, (_, index) => [key, 10_000 + index * 30] as const)

test("a held Up or Down in a list ramps exactly as the map cursor does, with the same numbers, and a tap is one row", () => {
  // The owner (feedback F75): "Use the same timings." The same presses at the same times move a list as
  // many rows as they move the map cursor tiles, as long as neither reaches an end.
  const tiles = (key: string): number => {
    const map = buildSide({ cursor: { x: 30, y: 15 } })
    keys(map, TAB)
    timed(map, held(key))
    return Math.abs(map.build.state.cursor.y - 15)
  }
  assert.ok(tiles(DOWN) > held(DOWN).length, "the held key did not speed up at all")
  assert.equal(tiles(UP), tiles(DOWN))
  for (const [name, open] of [["Settings", [ESC, "s"]], ["the Controls page", ["?"]]] as const) {
    for (const [key, from, word] of [[DOWN, HOME, "Down"], [UP, END, "Up"]] as const) {
      const list = buildSide()
      keys(list, ...open, from)
      const start = list.build.state.popupHighlight
      timed(list, held(key))
      const rows = Math.abs(list.build.state.popupHighlight - start)
      assert.equal(rows, tiles(key), `${name}: a held ${word} moves by other numbers than the map cursor`)
    }
  }
  // A tap is one row, so Up and Down reach every row.
  const tap = buildSide()
  keys(tap, ESC, "s")
  const start = tap.build.state.popupHighlight
  timed(tap, [[DOWN, 5_000]])
  assert.equal(tap.build.state.popupHighlight, start + 1, "a timed tap moved more than one row")
  keys(tap, DOWN)
  assert.equal(tap.build.state.popupHighlight, start + 2, "an untimed tap moved more than one row")
})

test("holding Down on the Build Phase menu reaches its last row quickly and stays there", () => {
  // `Down Down~150 Down~30*6`, the playtest's held key: a tap, the terminal's repeat delay, repeats.
  const side = buildSide()
  const last = menuEntries(side.context).length - 1
  const sequence: [string, number][] = [[DOWN, 1_000], [DOWN, 1_150]]
  for (let index = 1; index <= 6; index += 1) sequence.push([DOWN, 1_150 + index * 30])
  timed(side, sequence)
  assert.equal(side.build.state.menuHighlight, last)
  timed(side, Array.from({ length: 10 }, (_, index) => [DOWN, 1_400 + index * 30] as const))
  assert.equal(side.build.state.menuHighlight, last)
  assert.equal(side.build.state.focus, "menu")
  // A jump, or any other key, starts the ramp over: the next Down is a tap again.
  const reset = buildSide()
  timed(reset, [[DOWN, 1_000], [DOWN, 1_030], [DOWN, 1_060], [PAGE_UP, 1_090], [DOWN, 1_120]])
  assert.equal(reset.build.state.menuHighlight, 1)
})

test("the keyboard adapter sends a list key as a highlight on the menu, and as a cursor move on the map", () => {
  assert.deepEqual(buildKeyboardCommand(SHIFT_DOWN, { itemCount: 3, armed: false, focus: "menu" }), { kind: "highlight", delta: 1, jump: true })
  assert.deepEqual(buildKeyboardCommand(HOME, { itemCount: 3, armed: false, focus: "menu" }), { kind: "highlight", delta: -1, jump: true })
  assert.equal(buildKeyboardCommand(HOME, { itemCount: 3, armed: false, focus: "grid" })?.kind, "move-cursor")
})
