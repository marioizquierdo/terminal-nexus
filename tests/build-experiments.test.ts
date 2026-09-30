// The Experiments: live-editable flags for the owner's playtests (gate 5G), the section at the bottom
// of Settings (`tests/build-settings.test.ts` has the player's half, the game menu and the export). Driven through raw bytes into
// the real adapters where an adapter is what is being claimed, and through commands where the reducer
// is; and one flow three ways (keys, clicks, a driver script) to hold "the same plan is the same
// state and the same frame" for the Experiments too.

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_CATALOG } from "../src/build/catalog.ts"
import { EXPERIMENT_FIELDS, stepExperiment, defaultExperiments, experimentRow } from "../src/build/experiments.ts"
import type { ExperimentField } from "../src/build/experiments.ts"
import { SETTLED_EXPERIMENTS } from "../src/build/tuning.ts"
import { buildLayout, cellForTile, escLabelSpan, escLabel, menuEntryRow } from "../src/build/layout.ts"
import { MOUSE_LEFT, MOUSE_RIGHT, MOUSE_WHEEL_DOWN, MOUSE_WHEEL_UP, formatMouseEvent } from "../src/build/mouse.ts"
import {
  SETTINGS_NOTE_LINES,
  EXPORT_QUESTION,
  popupSpec,
  placePopup,
  settingColumns,
  wrapWords,
} from "../src/build/popup.ts"
import { GAME_MENU_ROWS, PLAYER_FIELDS, SETTINGS_ORDER } from "../src/build/settings.ts"
import type { PlacedPopup } from "../src/build/popup.ts"
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

function placed(side: Side): PlacedPopup {
  const spec = popupSpec(side.context, side.build.state)
  assert.ok(spec !== null, "no popup is open")
  return placePopup(side.layout, spec)
}

/** The frame row the popup draws flag `field` on. */
function settingRow(side: Side, field: ExperimentField): number {
  const label = EXPERIMENT_FIELDS[experimentRow(field)]?.label
  const hit = placed(side).rows.find((row) => row.spec.kind === "setting" && row.spec.label === label)
  assert.ok(hit !== undefined, `no row for ${field}`)
  return hit.row
}

/** Whether flag `field`'s row is on screen — the popup scrolls since gate 5H. */
function onScreen(side: Side, field: ExperimentField): boolean {
  const label = EXPERIMENT_FIELDS[experimentRow(field)]?.label
  return placed(side).rows.some((row) => row.spec.kind === "setting" && row.spec.label === label)
}

/** The mouse's way to a flag that is scrolled out of view: the wheel, over the popup, until it shows. */
function wheelTo(side: Side, field: ExperimentField): void {
  const box = placed(side).box
  const down = SETTINGS_ORDER.indexOf(experimentRow(field)) > SETTINGS_ORDER.indexOf(side.build.state.popupHighlight)
  for (let turns = 0; turns < SETTINGS_ORDER.length && !onScreen(side, field); turns += 1) {
    click(side, box.left + 2, box.top + 2, down ? MOUSE_WHEEL_DOWN : MOUSE_WHEEL_UP)
  }
}

function clickValue(side: Side, field: ExperimentField, half: "left" | "right"): void {
  wheelTo(side, field)
  const columns = settingColumns(placed(side))
  click(side, half === "left" ? columns.valueFrom : columns.valueTo, settingRow(side, field))
}

/** The keyboard's way to a flag: Up or Down from wherever the highlight is, never by a count that
 *  breaks when a flag is added. */
function goTo(side: Side, field: ExperimentField): void {
  const target = experimentRow(field)
  const from = side.build.state.popupHighlight
  keys(side, ...Array.from({ length: Math.abs(target - from) }, () => (target > from ? DOWN : UP)))
}

// --- Opening and closing ---------------------------------------------------------------------------

test("d opens Settings at its Experiments: every flag and its value", () => {
  const side = session()
  keys(side, "d")
  assert.equal(side.build.state.popup, "settings")
  assert.equal(side.build.state.popupHighlight, experimentRow(EXPERIMENT_FIELDS[0]?.field as ExperimentField))
  const text = screen(side)
  assert.match(text, /SETTINGS/)
  assert.match(text, /EXPERIMENTS - for playtests, not saved/)
  // The five left after the owner settled the rest (2026-09-30), in order: the two still being felt, the
  // hold window, and the placeholder Pulse's raid and crew. No "now" or "restart" beside a value any
  // more (feedback F34).
  assert.deepEqual(
    EXPERIMENT_FIELDS.map((spec) => spec.field),
    ["focusArrowMs", "cardRevealMs", "holdWindowMs", "raid", "crew"],
  )
  assert.match(text, /Focus arrow\s+<\s+180 ms\s+>/)
  assert.match(text, /Card reveal\s+<\s+150 ms\s+>/)
  assert.match(text, /Hold window\s+<\s+350 ms\s+>/)
  assert.doesNotMatch(text, /> +(now|restart)\b/)
  // The bottom line says what the keys do there (feedback F59), and the highlighted row's question is
  // shown. Opened by `d` from the game, Esc closes it.
  assert.match(text, /Left\/right change a value, \[e\] exports them all\. \[esc\] closes\./)
  assert.ok(text.includes("(F54)"), "the focus arrow's question is not shown")
  const hold = session()
  keys(hold, "d")
  goTo(hold, "holdWindowMs")
  assert.match(screen(hold), /repeat delay/, "the hold window's question does not say why it stays")
  // Every flag is listed — scrolled into view by walking down the list.
  const seen = new Set<string>()
  for (let row = 0; row < EXPERIMENT_FIELDS.length; row += 1) {
    const now = screen(side)
    for (const spec of EXPERIMENT_FIELDS) if (now.includes(spec.label)) seen.add(spec.label)
    keys(side, DOWN)
  }
  for (const spec of EXPERIMENT_FIELDS) assert.ok(seen.has(spec.label), `${spec.label} is never listed`)
  assert.match(screen(side), /Raid\s+<\s+heavy\s+>/)
  assert.match(screen(side), /Your units\s+<\s+none\s+>/)
  // Settled by the owner on 2026-09-29 (feedback F30, F31) and 2026-09-30 (F76), and deleted.
  for (const gone of ["Smart cursor", "Opens on", "Cursor blink", "Build animation", "Scroll margin", "Shift jump"]) {
    assert.ok(!EXPERIMENT_FIELDS.some((spec) => spec.label === gone), `${gone} is still an Experiment`)
  }
  for (const gone of SETTLED_EXPERIMENTS) {
    assert.ok(!EXPERIMENT_FIELDS.some((spec) => spec.field === gone), `${gone} is still an Experiment`)
  }
})

test("Esc, x, d, a right click and a click outside all close it, and it holds the keyboard until then", () => {
  for (const close of [[ESC], ["x"], ["d"]]) {
    const side = session()
    keys(side, "d", ...close)
    assert.equal(side.build.state.popup, null, `${JSON.stringify(close)} did not close it`)
  }
  const right = session()
  keys(right, "d")
  click(right, 0, 0, MOUSE_RIGHT)
  assert.equal(right.build.state.popup, null)

  // Keys the popup has no use for do nothing underneath it: no arm, no undo, no Nexus popup.
  const held = session()
  keys(held, "d", "1", "u", "n", "p", TAB)
  assert.equal(held.build.state.popup, "settings")
  assert.equal(held.build.state.armed, null)
  assert.equal(held.build.state.focus, "menu")
})

test("while Settings is open its highlight is the only one on screen", () => {
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
    for (const spec of [...EXPERIMENT_FIELDS, ...PLAYER_FIELDS]) assert.ok(spec.label.length <= columns.labelLimit, `${spec.label} is cut`)
    const questions = [...EXPERIMENT_FIELDS, ...PLAYER_FIELDS].map((spec) => spec.question)
    for (const question of [...questions, EXPORT_QUESTION]) {
      const lines = wrapWords(question, popup.textLimit)
      assert.ok(lines.length <= SETTINGS_NOTE_LINES, `"${question}" needs ${lines.length} lines at ${size.columns}x${size.rows}`)
    }
  }
})

// --- What each flag changes ------------------------------------------------------------------------

test("a number stops at its ends and says so; a choice comes round", () => {
  const flags = defaultExperiments()
  const smallest = stepExperiment({ ...flags, holdWindowMs: 150 }, "holdWindowMs", -1)
  assert.equal(smallest.changed, false)
  assert.equal(stepExperiment({ ...flags, holdWindowMs: 900 }, "holdWindowMs", 1).changed, false)
  // A number the list does not hold (from a settings text) steps to its nearest neighbour.
  assert.equal(stepExperiment({ ...flags, holdWindowMs: 300 }, "holdWindowMs", -1).flags.holdWindowMs, 250)
  assert.equal(stepExperiment({ ...flags, holdWindowMs: 300 }, "holdWindowMs", 1).flags.holdWindowMs, 350)
  assert.equal(stepExperiment(flags, "crew", 1).flags.crew, "some")
  assert.equal(stepExperiment(stepExperiment(flags, "crew", 1).flags, "crew", 1).flags.crew, "none")
  assert.equal(stepExperiment(flags, "raid", 1).flags.raid, "probe")
  assert.equal(stepExperiment(flags, "raid", -1).flags.raid, "none")

  const side = session()
  keys(side, "d")
  goTo(side, "holdWindowMs")
  keys(side, ...Array.from({ length: 8 }, () => LEFT))
  assert.equal(side.build.state.experiments.holdWindowMs, 150)
  assert.equal(side.build.state.status.tone, "warning")
  assert.match(side.build.state.status.text, /already 150 ms, the smallest/)
})

test("the restart keeps every flag and starts the plan over, on the menu at Explore Map", () => {
  const side = session()
  keys(side, "n", "1", "1", RIGHT, ENTER) // pick a power, plan a Barracks
  assert.equal(side.build.state.planned.length, 1)
  keys(side, "d")
  goTo(side, "crew")
  keys(side, RIGHT)
  assert.equal(side.build.state.experiments.crew, "some")
  // A flag that applies at once needs no restart message; the game menu's [r] is the restart.
  keys(side, "q")
  assert.equal(side.build.state.popup, "game-menu")
  keys(side, "r")
  const state = side.build.state
  assert.equal(state.popup, null)
  assert.equal(state.focus, "menu")
  assert.equal(state.menuHighlight, 0)
  assert.equal(state.planned.length, 0)
  assert.equal(state.nexusPick, null)
  assert.deepEqual(state.cursor, { x: 18, y: 13 })
  assert.equal(state.experiments.crew, "some")
  // The restart answers on the bottom line; the next key that says nothing brings back the hint for the
  // highlighted row (feedback F59).
  assert.match(screen(side), /Build Phase restarted with these settings\./)
  keys(side, DOWN, UP)
  assert.match(screen(side), /Explore Map: look around and read what is on each tile\./)

  // The game menu's Restart row does the same by Enter — past Settings and Controls.
  const byEnter = session()
  keys(byEnter, ESC, DOWN, DOWN)
  assert.equal(GAME_MENU_ROWS[byEnter.build.state.popupHighlight], "restart")
  keys(byEnter, ENTER)
  assert.equal(byEnter.build.state.status.text, "Build Phase restarted with these settings.")
})

test("Settings open on a committed Build Phase too, so a playtest can start over from there", () => {
  const side = session()
  keys(side, "n", "1", "p", "y")
  assert.equal(side.build.state.committed, true)
  keys(side, "d")
  assert.equal(side.build.state.popup, "settings")
  keys(side, "q", "r")
  assert.equal(side.build.state.committed, false)
})

test("the browser playtest page's Build Phase key bar has d", () => {
  assert.ok(KEY_BAR.build.some((key) => key.name === "d"))
})

// --- Same flow, every adapter ----------------------------------------------------------------------

test("setting an Experiment by keys, by clicks, and from a driver script is the same state and the same frame", () => {
  // The hold window up two, a shorter focus arrow; restart; then arm the Barracks from the menu and place
  // it where the cursor is, since it fits there.
  const byKeyboard = session()
  keys(byKeyboard, "d")
  goTo(byKeyboard, "holdWindowMs")
  keys(byKeyboard, RIGHT, RIGHT)
  goTo(byKeyboard, "focusArrowMs")
  // `q` leaves Settings for the game menu (nothing here waits for a restart, so no message); its [r]
  // restarts. The keyboard is then on the menu.
  keys(byKeyboard, LEFT, "q", "r")
  keys(byKeyboard, DOWN, DOWN, SPACE, ENTER)

  // By mouse there is no `d`: the top bar's "menu [esc]", then the game menu's [s] Settings.
  const byMouse = session()
  const menuHint = escLabelSpan(byMouse.layout, escLabel(byMouse.build.state))
  click(byMouse, menuHint.from, menuHint.row)
  const settingsOption = placed(byMouse).rows.find((row) => row.spec.kind === "option" && row.spec.hotkey === "s" && !row.secondLine)
  assert.ok(settingsOption !== undefined)
  assert.equal(GAME_MENU_ROWS[0], "settings")
  click(byMouse, placed(byMouse).textColumn + 2, settingsOption.row)
  clickValue(byMouse, "holdWindowMs", "right")
  clickValue(byMouse, "holdWindowMs", "right")
  clickValue(byMouse, "focusArrowMs", "left")
  // "close [esc]" in the top bar is Esc: back to the game menu (no message — nothing changed waits for
  // a restart); then the game menu's Restart.
  const closeHint = escLabelSpan(byMouse.layout, escLabel(byMouse.build.state))
  click(byMouse, closeHint.from, closeHint.row)
  assert.equal(byMouse.build.state.popup, "game-menu")
  const restart = placed(byMouse).rows.find((row) => row.spec.kind === "option" && row.spec.hotkey === "r")
  assert.ok(restart !== undefined)
  click(byMouse, placed(byMouse).textColumn + 4, restart.row)
  // The keyboard is on the menu after the restart: a click on the row arms it at once (feedback
  // F22); a click on the tile the cursor already sits on places (Q52), back on the menu. The first key
  // after the mouse only shows the menu's highlight again, which the keyboard's own placement left
  // showing.
  const row = menuEntryRow(byMouse.layout, SPIKE_CATALOG, { kind: "construct", index: 0 }) as number
  click(byMouse, byMouse.layout.panelColumn + 3, row)
  const cell = cellForTile(byMouse.layout, byMouse.build.state.camera, byMouse.build.state.cursor)
  click(byMouse, cell.x, cell.y)
  assert.equal(byMouse.build.state.highlightHidden, true)
  // The placement's answer is the same by either door...
  assert.deepEqual(byMouse.build.state.status, byKeyboard.build.state.status)
  // ...and lapses at the next key that says nothing (feedback F59) — the key that only shows the
  // highlight again here, so the keyboard and the driver below each walk Up and back Down to match.
  keys(byMouse, DOWN, UP, DOWN)
  keys(byKeyboard, UP, DOWN)

  const script: readonly BuildCommand[] = [
    { kind: "open-settings", section: "experiments" },
    { kind: "experiment-adjust", field: "holdWindowMs", step: 1 },
    { kind: "experiment-adjust", field: "holdWindowMs", step: 1 },
    { kind: "experiment-adjust", field: "focusArrowMs", step: -1 },
    { kind: "restart" },
    { kind: "highlight", delta: 1 },
    { kind: "highlight", delta: 1 },
    { kind: "activate" },
    { kind: "place" },
    { kind: "highlight", delta: -1 },
    { kind: "highlight", delta: 1 },
  ]
  const byDriver = session()
  byDriver.build.run(script)

  const expected = byKeyboard.build.state
  assert.deepEqual(expected.experiments, { ...defaultExperiments(), holdWindowMs: 700, focusArrowMs: 120 })
  assert.equal(expected.planned.length, 1)
  assert.equal(expected.menuHighlight, entryOfConstruct(0))
  assert.deepEqual(byMouse.build.state, expected)
  assert.deepEqual(byDriver.build.state, expected)
  assert.equal(screen(byMouse), screen(byKeyboard))
  assert.equal(screen(byDriver), screen(byKeyboard))
})
