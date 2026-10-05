// The Experiments (docs/system-design/ui-patterns.md, "Experiments and tuned values"): live-editable flags for the
// owner's playtests, the section at the bottom of Settings (`tests/build-settings.test.ts` has the
// player's half, the game menu and the export). Driven through raw bytes into the real adapters where an
// adapter is what is being claimed, and through commands where the reducer is; and one flow three ways
// (keys, clicks, a driver script) to hold "the same plan is the same state and the same frame" for the
// Experiments too. Only the first test pins which Experiments there are; every value is read from them.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_CATALOG } from "../src/build/catalog.ts"
import { EXPERIMENT_FIELDS, defaultExperiments, experimentSpec, formatExperimentValue, stepExperiment } from "../src/build/experiments.ts"
import type { ExperimentField } from "../src/build/experiments.ts"
import { menuEntryRow } from "../src/build/layout.ts"
import { MOUSE_RIGHT, MOUSE_WHEEL_DOWN, MOUSE_WHEEL_UP } from "../src/build/mouse.ts"
import { EXPORT_QUESTION, SETTINGS_NOTE_LINES, settingColumns, wrapWords } from "../src/build/popup.ts"
import { PLAYER_FIELDS, SETTINGS_ROWS, settingRow } from "../src/build/settings.ts"
import { entryOfConstruct } from "../src/build/state.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { SETTLED_EXPERIMENTS } from "../src/build/tuning.ts"
import { KEY_BAR } from "../src/web/keys.ts"
import { cellAt } from "../src/view/frame.ts"
import {
  DOWN,
  ENTER,
  ESC,
  LEFT,
  MAXIMUM,
  MINIMUM,
  OPEN_GROUND,
  RIGHT,
  SPACE,
  TAB,
  UP,
  WIDE,
  buildSide,
  clickCell,
  clickEscLabel,
  clickPanelRow,
  clickPopupOption,
  clickTile,
  compose,
  goToExperiment,
  goToGameMenuRow,
  keys,
  placed,
  screenText,
} from "./build-helpers.ts"
import type { Side } from "./build-helpers.ts"

/** The frame row the popup draws Experiment `field` on. */
function frameRowOf(side: Side, field: ExperimentField): number {
  const label = experimentSpec(field).label
  const hit = placed(side).rows.find((row) => row.spec.kind === "setting" && row.spec.label === label)
  assert.ok(hit !== undefined, `no row for ${field}`)
  return hit.row
}

/** Whether Experiment `field`'s row is on screen — the popup scrolls. */
function onScreen(side: Side, field: ExperimentField): boolean {
  const label = experimentSpec(field).label
  return placed(side).rows.some((row) => row.spec.kind === "setting" && row.spec.label === label)
}

/** The mouse's way to an Experiment scrolled out of view: the wheel, over the popup, until it shows. */
function wheelTo(side: Side, field: ExperimentField): void {
  const box = placed(side).box
  const down = settingRow(field) > side.build.state.popupHighlight
  for (let turns = 0; turns < SETTINGS_ROWS.length && !onScreen(side, field); turns += 1) {
    clickCell(side, box.left + 2, box.top + 2, down ? MOUSE_WHEEL_DOWN : MOUSE_WHEEL_UP)
  }
}

function clickValue(side: Side, field: ExperimentField, half: "left" | "right"): void {
  wheelTo(side, field)
  const columns = settingColumns(placed(side))
  clickCell(side, half === "left" ? columns.valueFrom : columns.valueTo, frameRowOf(side, field))
}

// --- Opening and closing ---------------------------------------------------------------------------

test("d opens Settings at its Experiments: every flag and its value", () => {
  const side = buildSide()
  keys(side, "d")
  assert.equal(side.build.state.popup, "settings")
  assert.equal(side.build.state.popupHighlight, settingRow(EXPERIMENT_FIELDS[0]?.field as ExperimentField))
  const text = screenText(side)
  assert.match(text, /SETTINGS/)
  assert.match(text, /KEYBOARD NAVIGATION - experiments/)
  // In order, group by group: keyboard navigation — the hold window and key releases
  // from the third round, and the tap, hold and jump numbers back for the navigation polish round — the
  // popup pulse (every popup's) and the Battle Round flash, and the mission's next round, Vasse's health,
  // the build range, her aura and the room a Barracks keeps. (Her voice in battle was settled beside her.)
  assert.deepEqual(
    EXPERIMENT_FIELDS.map((spec) => spec.field),
    [
      "holdWindowMs",
      "keyReleases",
      "doubleTapMs",
      "fastTapMs",
      "tapsToSpeedUp",
      "tapTopStep",
      "holdMoveMs",
      "holdLongMs",
      "holdLongStep",
      "jumpStep",
      "popupPulseMs",
      "popupFlashMs",
      "popupFlashPeak",
      "nextRound",
      "commanderHealth",
      "buildRange",
      "commanderAura",
      "spawnClearance",
    ],
  )
  assert.deepEqual(
    EXPERIMENT_FIELDS.map((spec) => spec.section),
    [...Array.from({ length: 10 }, () => "keyboard"), "effects", "effects", "effects", ...Array.from({ length: 5 }, () => "mission")],
  )
  // The bottom line says what the keys do there, and the highlighted row's question is
  // shown. Opened by `d` from the game, Esc closes it.
  assert.match(text, /Left\/right change a value, \[e\] exports them all\. \[esc\] closes\./)
  assert.ok(text.includes("Arrow presses closer than this"), "the hold window's question is not shown")
  // The owner reads the questions on screen: no feedback or question numbers to look up.
  for (const spec of EXPERIMENT_FIELDS) assert.doesNotMatch(spec.question, /\((F|Q)\d+\)/, spec.field)
  const hold = buildSide()
  keys(hold, "d")
  goToExperiment(hold, "holdWindowMs")
  assert.match(screenText(hold), /repeat delay/, "the hold window's question does not say why it stays")
  // Every flag is listed with its value — scrolled into view by walking down the list.
  const defaults = defaultExperiments()
  const seen = new Set<string>()
  for (let row = 0; row < EXPERIMENT_FIELDS.length; row += 1) {
    const now = screenText(side)
    for (const spec of EXPERIMENT_FIELDS) {
      if (new RegExp(`${spec.label}\\s+<\\s+${formatExperimentValue(defaults, spec.field)}\\s+>`).test(now)) seen.add(spec.label)
    }
    keys(side, DOWN)
  }
  for (const spec of EXPERIMENT_FIELDS) assert.ok(seen.has(spec.label), `${spec.label} is never listed with its value`)
  // Settled by the owner on 2026-09-29 and 2026-09-30, and deleted.
  for (const gone of ["Smart cursor", "Opens on", "Cursor blink", "Build animation", "Scroll margin", "Shift jump"]) {
    assert.ok(!EXPERIMENT_FIELDS.some((spec) => spec.label === gone), `${gone} is still an Experiment`)
  }
  for (const gone of SETTLED_EXPERIMENTS) {
    assert.ok(!EXPERIMENT_FIELDS.some((spec) => spec.field === gone), `${gone} is still an Experiment`)
  }
})

test("Esc, x, d, a right click and a click outside all close it, and it holds the keyboard until then", () => {
  for (const close of [[ESC], ["x"], ["d"]]) {
    const side = buildSide()
    keys(side, "d", ...close)
    assert.equal(side.build.state.popup, null, `${JSON.stringify(close)} did not close it`)
  }
  const right = buildSide()
  keys(right, "d")
  clickCell(right, 0, 0, MOUSE_RIGHT)
  assert.equal(right.build.state.popup, null)
  const outside = buildSide()
  keys(outside, "d")
  clickPanelRow(outside, outside.layout.panelRow + 5) // on the menu, beside the popup
  assert.equal(outside.build.state.popup, null)
  assert.equal(outside.build.state.armed, null, "the click outside chose something as well")

  // Keys the popup has no use for do nothing underneath it: no arm, no undo, no Nexus popup.
  const held = buildSide()
  keys(held, "d", "1", "u", "n", "p", TAB)
  assert.equal(held.build.state.popup, "settings")
  assert.equal(held.build.state.armed, null)
  assert.equal(held.build.state.focus, "menu")
})

test("while Settings is open its highlight is the only one on screen", () => {
  const side = buildSide()
  keys(side, "d")
  const nexusRow = side.layout.panelRow
  assert.notEqual(cellAt(compose(side), side.layout.panelColumn + side.layout.panelLimit - 1, nexusRow).style.inverse, true)
})

test("the popup fits inside the Grid pane at every size, and every question fits its lines without a cut word", () => {
  for (const size of [MINIMUM, MAXIMUM, WIDE]) {
    const side = buildSide({ terminal: size })
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
  const hold = experimentSpec("holdWindowMs").values as readonly number[]
  const smallest = hold[0] as number
  const largest = hold.at(-1) as number
  assert.equal(stepExperiment({ ...flags, holdWindowMs: smallest }, "holdWindowMs", -1).changed, false)
  assert.equal(stepExperiment({ ...flags, holdWindowMs: largest }, "holdWindowMs", 1).changed, false)
  // A number the list does not hold (from a settings text) steps to its nearest neighbour.
  const [second, third] = [hold[1] as number, hold[2] as number]
  const between = { ...flags, holdWindowMs: (second + third) / 2 }
  assert.equal(stepExperiment(between, "holdWindowMs", -1).flags.holdWindowMs, second)
  assert.equal(stepExperiment(between, "holdWindowMs", 1).flags.holdWindowMs, third)
  // A choice comes round, forward and back.
  for (const field of ["nextRound", "keyReleases"] as const) {
    const values = experimentSpec(field).values
    let around = flags
    for (let step = 0; step < values.length; step += 1) around = stepExperiment(around, field, 1).flags
    assert.equal(around[field], flags[field], `${field} did not come round`)
    const index = values.indexOf(flags[field])
    assert.equal(stepExperiment(flags, field, -1).flags[field], values[(index - 1 + values.length) % values.length])
  }

  const side = buildSide()
  keys(side, "d")
  goToExperiment(side, "holdWindowMs")
  keys(side, ...Array.from({ length: hold.length + 2 }, () => LEFT))
  assert.equal(side.build.state.experiments.holdWindowMs, smallest)
  assert.equal(side.build.state.status.tone, "warning")
  assert.match(side.build.state.status.text, new RegExp(`already ${formatExperimentValue(side.build.state.experiments, "holdWindowMs")}, the smallest`))
})

test("the restart keeps every flag and starts the plan over, on the menu at Explore Map", () => {
  const side = buildSide()
  keys(side, "n", "1", "1", ENTER) // pick a power, plan a Barracks where it is armed, two rows below the Nexus
  assert.equal(side.build.state.planned.length, 1)
  keys(side, "d")
  goToExperiment(side, "nextRound")
  keys(side, RIGHT)
  const crew = stepExperiment(defaultExperiments(), "nextRound", 1).flags.nextRound
  assert.equal(side.build.state.experiments.nextRound, crew)
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
  assert.deepEqual(state.cursor, OPEN_GROUND)
  assert.equal(state.experiments.nextRound, crew)
  // The restart answers on the bottom line; the next key that says nothing brings back the hint for the
  // highlighted row.
  assert.match(screenText(side), /Build Phase restarted with these settings\./)
  keys(side, DOWN, UP)
  assert.match(screenText(side), /Explore Map: look around and read what is on each tile\./)

  // The game menu's Restart row does the same by Enter.
  const byEnter = buildSide()
  keys(byEnter, ESC)
  goToGameMenuRow(byEnter, "restart")
  keys(byEnter, ENTER)
  assert.equal(byEnter.build.state.status.text, "Build Phase restarted with these settings.")
})

test("Settings open on a committed Build Phase too, so a playtest can start over from there", () => {
  const side = buildSide()
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
  // The hold window up two, the popup pulse down one; restart; then arm the Barracks from the menu and
  // place it where the cursor is, since it fits there.
  const byKeyboard = buildSide()
  keys(byKeyboard, "d")
  goToExperiment(byKeyboard, "holdWindowMs")
  keys(byKeyboard, RIGHT, RIGHT)
  goToExperiment(byKeyboard, "popupPulseMs")
  // `q` leaves Settings for the game menu (nothing here waits for a restart, so no message); its [r]
  // restarts. The keyboard is then on the menu.
  keys(byKeyboard, LEFT, "q", "r")
  keys(byKeyboard, DOWN, DOWN, SPACE, ENTER)

  // By mouse there is no `d`: the top bar's "menu [esc]", then the game menu's [s] Settings.
  const byMouse = buildSide()
  clickEscLabel(byMouse)
  clickPopupOption(byMouse, "s")
  clickValue(byMouse, "holdWindowMs", "right")
  clickValue(byMouse, "holdWindowMs", "right")
  clickValue(byMouse, "popupPulseMs", "left")
  // "close [esc]" in the top bar is Esc: back to the game menu (no message — nothing changed waits for
  // a restart); then the game menu's Restart.
  clickEscLabel(byMouse)
  assert.equal(byMouse.build.state.popup, "game-menu")
  clickPopupOption(byMouse, "r")
  // The keyboard is on the menu after the restart: a click on the row arms it at once;
  // a click on the tile the cursor already sits on places, back on the menu. The first key
  // after the mouse only shows the menu's highlight again, which the keyboard's own placement left
  // showing.
  clickPanelRow(byMouse, menuEntryRow(byMouse.layout, STARTER_CATALOG, { kind: "construct", index: 0 }) as number)
  clickTile(byMouse, byMouse.build.state.cursor)
  assert.equal(byMouse.build.state.highlightHidden, true)
  // The placement's answer is the same by either door...
  assert.deepEqual(byMouse.build.state.status, byKeyboard.build.state.status)
  // ...and lapses at the next key that says nothing — the key that only shows the
  // highlight again here, so the keyboard and the driver below each walk Up and back Down to match.
  keys(byMouse, DOWN, UP, DOWN)
  keys(byKeyboard, UP, DOWN)

  const script: readonly BuildCommand[] = [
    { kind: "open-settings", section: "experiments" },
    { kind: "experiment-adjust", field: "holdWindowMs", step: 1 },
    { kind: "experiment-adjust", field: "holdWindowMs", step: 1 },
    { kind: "experiment-adjust", field: "popupPulseMs", step: -1 },
    { kind: "restart" },
    { kind: "highlight", delta: 1 },
    { kind: "highlight", delta: 1 },
    { kind: "activate" },
    { kind: "place" },
    { kind: "highlight", delta: -1 },
    { kind: "highlight", delta: 1 },
  ]
  const byDriver = buildSide()
  byDriver.build.run(script)

  const expected = byKeyboard.build.state
  let experiments = defaultExperiments()
  for (const [field, step] of [["holdWindowMs", 1], ["holdWindowMs", 1], ["popupPulseMs", -1]] as const) {
    experiments = stepExperiment(experiments, field, step).flags
  }
  assert.notDeepEqual(experiments, defaultExperiments(), "no step changed anything: the test proves nothing")
  assert.deepEqual(expected.experiments, experiments)
  assert.equal(expected.planned.length, 1)
  assert.equal(expected.menuHighlight, entryOfConstruct(0))
  assert.deepEqual(byMouse.build.state, expected)
  assert.deepEqual(byDriver.build.state, expected)
  assert.equal(screenText(byMouse), screenText(byKeyboard))
  assert.equal(screenText(byDriver), screenText(byKeyboard))
})
