// Gate 5G: Debug Mode — a popup of live-editable development flags. Driven through raw bytes into
// the real adapters where an adapter is what is being claimed, and through commands where the reducer
// is; and one flow three ways (keys, clicks, a driver script) to hold "the same plan is the same
// state and the same frame" for the debug flow too.

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_CATALOG } from "../src/build/catalog.ts"
import {
  DEBUG_FIELDS,
  DEBUG_RESTART_QUESTION,
  DEBUG_RESTART_ROW,
  adjustDebug,
  flashDuration,
  initialDebugFlags,
  rowOfField,
} from "../src/build/debug.ts"
import type { DebugField } from "../src/build/debug.ts"
import { buildLayout, cellForTile, menuEntryRow } from "../src/build/layout.ts"
import { MOUSE_LEFT, MOUSE_RIGHT, formatMouseEvent } from "../src/build/mouse.ts"
import { DEBUG_NOTE_LINES, overlaySpec, placeOverlay, settingColumns, wrapWords } from "../src/build/overlay.ts"
import type { PlacedOverlay } from "../src/build/overlay.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildContext } from "../src/build/state.ts"
import { entryOfConstruct } from "../src/build/state.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import { KEY_BAR } from "../src/web/keys.ts"

const ESC = String.fromCharCode(27)
const UP = `${ESC}[A`
const DOWN = `${ESC}[B`
const RIGHT = `${ESC}[C`
const LEFT = `${ESC}[D`
const TAB = "\t"
const SPACE = " "
const ENTER = "\r"
const SIZES = [
  { columns: 80, rows: 24 },
  { columns: 104, rows: 32 },
  { columns: 128, rows: 24 },
]

type Side = { build: BuildSession; layout: ReturnType<typeof buildLayout>; context: BuildContext }

function session(context: BuildContext = spikeContext(), terminal = { columns: 80, rows: 24 }): Side {
  const layout = buildLayout(terminal, context.grid)
  const build = new BuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
  return { build, layout, context }
}

function keys(side: Side, ...sequence: string[]): void {
  for (const key of sequence) side.build.handleData(key, side.layout)
}

function screen(side: Side): string {
  return frameToText(composeBuildFrame({ context: side.context, state: side.build.state, layout: side.layout }, "monochrome"))
}

function click(side: Side, column: number, row: number, button = MOUSE_LEFT): void {
  keys(side, formatMouseEvent(button, column + 1, row + 1))
}

function placed(side: Side): PlacedOverlay {
  const spec = overlaySpec(side.context, side.build.state)
  assert.ok(spec !== null, "no popup is open")
  return placeOverlay(side.layout, spec)
}

/** The frame row the popup draws flag `field` on. */
function settingRow(side: Side, field: DebugField): number {
  const label = DEBUG_FIELDS[rowOfField(field)]?.label
  const hit = placed(side).rows.find((row) => row.spec.kind === "setting" && row.spec.label === label)
  assert.ok(hit !== undefined, `no row for ${field}`)
  return hit.row
}

function clickValue(side: Side, field: DebugField, half: "left" | "right"): void {
  const columns = settingColumns(placed(side))
  click(side, half === "left" ? columns.valueFrom : columns.valueTo, settingRow(side, field))
}

// --- Opening and closing ---------------------------------------------------------------------------

test("d opens Debug Mode over the Grid: every flag, its value, and when a change is seen", () => {
  const side = session()
  keys(side, "d")
  assert.equal(side.build.state.overlay, "debug")
  const text = screen(side)
  assert.match(text, /DEBUG MODE - not saved/)
  for (const spec of DEBUG_FIELDS) assert.ok(text.includes(spec.label), `${spec.label} is not listed`)
  assert.match(text, /Smart cursor\s+<\s+on\s+>\s+now/)
  assert.match(text, /Opens on\s+<\s+menu\s+>\s+restart/)
  assert.match(text, /\[r\] Restart with these settings/)
  // The key help says where the keyboard is, and the highlighted row's question is shown.
  assert.match(text, /DEBUG {2}up\/down choose {2}left\/right change/)
  assert.ok(text.includes("(Q55)"), "the smart cursor's question is not shown")
})

test("Esc, x, d, a right click and a click outside all close it, and it holds the keyboard until then", () => {
  for (const close of [[ESC], ["x"], ["d"]]) {
    const side = session()
    keys(side, "d", ...close)
    assert.equal(side.build.state.overlay, null, `${JSON.stringify(close)} did not close it`)
  }
  const right = session()
  keys(right, "d")
  click(right, 0, 0, MOUSE_RIGHT)
  assert.equal(right.build.state.overlay, null)

  // Keys the popup has no use for do nothing underneath it: no arm, no undo, no Nexus popup.
  const held = session()
  keys(held, "d", "1", "u", "n", "e", "p", TAB)
  assert.equal(held.build.state.overlay, "debug")
  assert.equal(held.build.state.armed, null)
  assert.equal(held.build.state.focus, "menu")
})

test("the top bar's [d] debug is drawn at every size and a click on it opens Debug Mode, and a second closes it", () => {
  for (const size of SIZES) {
    const side = session(spikeContext(), size)
    const hint = side.layout.debugHint
    const line = screen(side).split("\n")[hint.row] ?? ""
    assert.equal(line.slice(hint.from, hint.to + 1), "[d] debug", `not drawn at ${size.columns}x${size.rows}`)
    click(side, hint.from + 1, hint.row)
    assert.equal(side.build.state.overlay, "debug", `a click did not open it at ${size.columns}x${size.rows}`)
    click(side, hint.to, hint.row)
    assert.equal(side.build.state.overlay, null, "a click on the hint over the open popup did not close it")
  }
})

test("while Debug Mode is open its highlight is the only one on screen", () => {
  const side = session()
  keys(side, "d")
  const frame = composeBuildFrame({ context: side.context, state: side.build.state, layout: side.layout }, "monochrome")
  const nexusRow = side.layout.panelRow
  assert.notEqual(cellAt(frame, side.layout.panelColumn + side.layout.panelLimit - 1, nexusRow).style.inverse, true)
})

test("the popup fits inside the Grid pane at every size, and every question fits its lines without a cut word", () => {
  for (const size of SIZES) {
    const side = session(spikeContext(), size)
    keys(side, "d")
    const popup = placed(side)
    assert.ok(popup.box.top > side.layout.gridBox.top, `the popup covers the top rule at ${size.columns}x${size.rows}`)
    assert.ok(popup.box.bottom + 1 < side.layout.paneBottom, `the popup covers the bottom rule at ${size.columns}x${size.rows}`)
    const columns = settingColumns(popup)
    for (const spec of DEBUG_FIELDS) assert.ok(spec.label.length <= columns.labelLimit, `${spec.label} is cut`)
    for (const question of [...DEBUG_FIELDS.map((spec) => spec.question), DEBUG_RESTART_QUESTION]) {
      const lines = wrapWords(question, popup.textLimit)
      assert.ok(lines.length <= DEBUG_NOTE_LINES, `"${question}" needs ${lines.length} lines at ${size.columns}x${size.rows}`)
    }
  }
})

// --- What each flag changes ------------------------------------------------------------------------

test("smart cursor off: arming from the menu leaves the cursor where it is", () => {
  const on = session()
  keys(on, DOWN, DOWN, SPACE) // highlight Barracks, arm it from the menu
  const off = session()
  keys(off, "d", RIGHT, ESC, DOWN, DOWN, SPACE)
  assert.equal(off.build.state.debug.smartCursor, false)
  assert.equal(off.build.state.armed, 0)
  assert.deepEqual(off.build.state.cursor, { x: 18, y: 13 }, "the cursor moved with the smart cursor off")
  assert.notDeepEqual(on.build.state.cursor, { x: 18, y: 13 }, "the smart cursor did not move the cursor when on")
})

test("scroll margin: the camera follows exactly as a screen opened with that margin does, from the moment it changes", () => {
  const moves = [RIGHT, RIGHT, DOWN, ...Array.from({ length: 30 }, () => RIGHT), ...Array.from({ length: 6 }, () => DOWN)]
  for (const target of [0, 1, 5, 8]) {
    const reference = session({ ...spikeContext(), scrollMargin: target })
    keys(reference, TAB, ...moves)
    const tuned = session()
    const step = target > 3 ? RIGHT : LEFT
    keys(tuned, "d", DOWN, ...Array.from({ length: Math.abs(target - 3) }, () => step), ESC, TAB, ...moves)
    assert.equal(tuned.build.state.debug.scrollMargin, target)
    assert.deepEqual(tuned.build.state.camera, reference.build.state.camera, `margin ${target}`)
    assert.match(screen(tuned), target === 3 ? /cursor \d+,\d+\s*\n/ : new RegExp(`margin ${target}`))
  }
  // Widening the margin is felt at once: the camera settles under the new rule before any key moves.
  const side = session()
  keys(side, TAB, ...Array.from({ length: 28 }, () => RIGHT))
  const before = side.build.state.camera
  keys(side, "d", DOWN, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT)
  assert.notDeepEqual(side.build.state.camera, before, "a wider margin did not move the camera")
})

test("a number stops at its ends and says so; a choice of two comes round", () => {
  const flags = initialDebugFlags({})
  const smallest = adjustDebug({ ...flags, scrollMargin: 0 }, "scrollMargin", -1)
  assert.equal(smallest.changed, false)
  assert.equal(adjustDebug({ ...flags, scrollMargin: 8 }, "scrollMargin", 1).changed, false)
  // A `--scroll-margin` the list does not hold steps to its nearest neighbour.
  assert.equal(adjustDebug({ ...flags, scrollMargin: 12 }, "scrollMargin", -1).flags.scrollMargin, 8)
  assert.equal(adjustDebug({ ...flags, scrollMargin: 7 }, "scrollMargin", 1).flags.scrollMargin, 8)
  assert.equal(adjustDebug(flags, "smartCursor", 1).flags.smartCursor, false)
  assert.equal(adjustDebug(adjustDebug(flags, "smartCursor", 1).flags, "smartCursor", 1).flags.smartCursor, true)
  assert.equal(adjustDebug(flags, "startFocus", -1).flags.startFocus, "grid")

  const side = session()
  keys(side, "d", DOWN, ...Array.from({ length: 12 }, () => LEFT))
  assert.equal(side.build.state.debug.scrollMargin, 0)
  assert.equal(side.build.state.status.tone, "warning")
  assert.match(side.build.state.status.text, /already 0 tiles, the smallest/)
})

test("opens on the map: nothing changes until the restart, which keeps every flag and starts the plan over", () => {
  const side = session()
  keys(side, "n", "1", "1", RIGHT, ENTER) // pick a power, plan a Barracks
  assert.equal(side.build.state.planned.length, 1)
  keys(side, "d", DOWN, DOWN, RIGHT)
  assert.equal(side.build.state.debug.startFocus, "grid")
  assert.equal(side.build.state.focus, "menu", "a restart flag changed the running screen")
  assert.match(side.build.state.status.text, /applies on restart/)
  keys(side, UP, UP, LEFT) // and the smart cursor off
  keys(side, "r")
  const state = side.build.state
  assert.equal(state.overlay, null)
  assert.equal(state.focus, "grid")
  assert.equal(state.planned.length, 0)
  assert.equal(state.nexusPick, null)
  assert.deepEqual(state.cursor, { x: 18, y: 13 })
  assert.equal(state.debug.startFocus, "grid")
  assert.equal(state.debug.smartCursor, false)
  assert.match(screen(side), /EXPLORE {2}arrows move/)

  // The restart row does the same by Enter.
  const byEnter = session()
  keys(byEnter, "d", ...Array.from({ length: DEBUG_RESTART_ROW }, () => DOWN), ENTER)
  assert.equal(byEnter.build.state.status.text, "Build Phase restarted with the debug settings.")
})

test("the flash timings are what the live loop reads, and zero means no flash at all", () => {
  const side = session()
  keys(side, "d", DOWN, DOWN, DOWN, LEFT, LEFT, DOWN, RIGHT)
  assert.equal(flashDuration(side.build.state.debug, "pressed"), 0)
  assert.equal(flashDuration(side.build.state.debug, "refused"), 250)
  assert.match(screen(side), /Pressed flash\s+<\s+off\s+>/)
})

test("Debug Mode opens on a committed Build Phase too, so a playtest can start over from there", () => {
  const side = session()
  keys(side, "n", "1", "p", "y")
  assert.equal(side.build.state.committed, true)
  keys(side, "d")
  assert.equal(side.build.state.overlay, "debug")
  keys(side, "r")
  assert.equal(side.build.state.committed, false)
})

test("the browser playtest page's Build Phase key bar has d", () => {
  assert.ok(KEY_BAR.build.some((key) => key.name === "d"))
})

// --- Same flow, every adapter ----------------------------------------------------------------------

test("the debug flow by keys, by clicks, and from a driver script is the same state and the same frame", () => {
  // Smart cursor off, margin up two, open on the map, a shorter pressed flash; restart; then arm the
  // Barracks from the menu and place it where the cursor stayed.
  const byKeyboard = session()
  keys(byKeyboard, "d", RIGHT, DOWN, RIGHT, RIGHT, DOWN, RIGHT, DOWN, LEFT, "r")
  keys(byKeyboard, TAB, DOWN, DOWN, SPACE, ENTER)

  const byMouse = session()
  const hint = byMouse.layout.debugHint
  click(byMouse, hint.from, hint.row)
  clickValue(byMouse, "smartCursor", "right")
  clickValue(byMouse, "scrollMargin", "right")
  clickValue(byMouse, "scrollMargin", "right")
  clickValue(byMouse, "startFocus", "right")
  clickValue(byMouse, "pressedFlashMs", "left")
  const restart = placed(byMouse).rows.find((row) => row.spec.kind === "option")
  assert.ok(restart !== undefined)
  click(byMouse, placed(byMouse).textColumn + 4, restart.row)
  // The keyboard is on the map after the restart: the first click on a menu row brings it back and
  // highlights; the second arms; a click on the tile the cursor already sits on places (Q52).
  const row = menuEntryRow(byMouse.layout, SPIKE_CATALOG, { kind: "construct", index: 0 }) as number
  click(byMouse, byMouse.layout.panelColumn + 3, row)
  click(byMouse, byMouse.layout.panelColumn + 3, row)
  const cell = cellForTile(byMouse.layout, byMouse.build.state.camera, byMouse.build.state.cursor)
  click(byMouse, cell.x, cell.y)

  const script: readonly BuildCommand[] = [
    { kind: "open-debug" },
    { kind: "debug-adjust", field: "smartCursor", step: 1 },
    { kind: "debug-adjust", field: "scrollMargin", step: 1 },
    { kind: "debug-adjust", field: "scrollMargin", step: 1 },
    { kind: "debug-adjust", field: "startFocus", step: 1 },
    { kind: "debug-adjust", field: "pressedFlashMs", step: -1 },
    { kind: "debug-restart" },
    { kind: "focus", target: "menu" },
    { kind: "highlight", delta: 1 },
    { kind: "highlight", delta: 1 },
    { kind: "activate" },
    { kind: "place" },
  ]
  const byDriver = session()
  byDriver.build.run(script)

  const expected = byKeyboard.build.state
  assert.deepEqual(expected.debug, { smartCursor: false, scrollMargin: 5, startFocus: "grid", pressedFlashMs: 50, refusedFlashMs: 140 })
  assert.equal(expected.planned.length, 1)
  assert.equal(expected.menuHighlight, entryOfConstruct(0))
  assert.deepEqual(byMouse.build.state, expected)
  assert.deepEqual(byDriver.build.state, expected)
  assert.equal(screen(byMouse), screen(byKeyboard))
  assert.equal(screen(byDriver), screen(byKeyboard))
})
