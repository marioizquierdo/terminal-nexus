// Every setting in one list, each on a tier — player (shown and saved), experiment (shown for the
// owner's playtests, never saved, exported) or tuned (a constant in code) — and Settings in titled
// sections with a blank line between them (owner, 2026-09-30, feedback F85: "make more groups, and leave
// an extra space between sections ... Refactor the code to account for the hierarchy of settings").
// The Experiments' own behaviour is `tests/build-experiments.test.ts`; the player's half, the game menu
// and the export are `tests/build-settings.test.ts`.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  ALL_SETTINGS,
  SECTIONS,
  SETTING_NAMES,
  SHOWN_SETTINGS,
  defaultValue,
  formatValue,
  namesOn,
  setting,
} from "../src/build/all-settings.ts"
import { DEFAULT_EXPERIMENTS, EXPERIMENT_FIELDS, defaultExperiments } from "../src/build/experiments.ts"
import { sectionHeading } from "../src/build/popup.ts"
import { FIRST_EXPERIMENT_ROW, FIRST_PULSE_EXPERIMENT_ROW, PLAYER_FIELDS, SETTINGS_ROWS, sectionOfRow, settingRow } from "../src/build/settings.ts"
import { formatSettingsExport } from "../src/build/settings-export.ts"
import { RENAMED_SETTINGS, SETTLED_EXPERIMENTS, TUNING } from "../src/build/tuning.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import { DOWN, END, ESC, MAXIMUM, MINIMUM, UP, buildSide, keys, placed, screenText } from "./build-helpers.ts"

// --- The list -------------------------------------------------------------------------------------------

test("every setting stands on one tier, and each tier's view of the list is derived from it", () => {
  const tiers = ["player", "experiment", "tuned"] as const
  assert.deepEqual(
    [...SETTING_NAMES].sort(),
    tiers.flatMap((tier) => namesOn(tier)).sort(),
    "a setting on no tier, or on two",
  )
  // The tuned table is exactly the tuned tier, at its defaults; the Experiments' defaults exactly theirs.
  assert.deepEqual(Object.keys(TUNING).sort(), [...namesOn("tuned")].sort())
  for (const name of namesOn("tuned")) assert.equal(TUNING[name], defaultValue(name), name)
  assert.deepEqual(Object.keys(DEFAULT_EXPERIMENTS).sort(), [...namesOn("experiment")].sort())
  // The player tier is the saved settings, name for name, default for default.
  assert.deepEqual([...namesOn("player")].sort(), Object.keys(DEFAULT_SETTINGS).sort())
  for (const name of namesOn("player")) assert.equal(defaultValue(name), DEFAULT_SETTINGS[name], name)
  // An old export's tuned names are skipped quietly; a shown setting's never are.
  for (const name of namesOn("tuned")) assert.ok(SETTLED_EXPERIMENTS.has(name), `${name} would be reported as unknown`)
  for (const spec of SHOWN_SETTINGS) assert.ok(!SETTLED_EXPERIMENTS.has(spec.field), `${spec.field} would be skipped`)
  // A renamed setting's old name points at a setting this build has.
  for (const [old, now] of Object.entries(RENAMED_SETTINGS)) assert.ok(SETTING_NAMES.includes(now), `${old} points at ${now}`)
})

test("every shown setting is described: a section, a label, a plain question, and values that hold its default", () => {
  assert.equal(SHOWN_SETTINGS.length, namesOn("player").length + namesOn("experiment").length)
  for (const spec of SHOWN_SETTINGS) {
    assert.ok(SECTIONS.some((entry) => entry.section === spec.section), `${spec.field} is in no section`)
    assert.ok(spec.label.length > 0 && spec.question.length > 0, spec.field)
    assert.doesNotMatch(spec.question, /\((F|Q)\d+\)/, `${spec.field}'s question points at a document`)
    assert.ok(spec.values.includes(defaultValue(spec.field)), `${spec.field}'s default is not one of its values`)
    // A number stops at its ends; a choice comes round.
    assert.equal(spec.cycles, typeof spec.values[0] !== "number", spec.field)
  }
  // A tuned setting needs none of that, but may keep it for the day it is shown again.
  assert.ok(namesOn("tuned").some((name) => !("label" in ALL_SETTINGS[name])))
})

test("a value reads the same wherever it is: the live Experiment, the saved setting, or the constant", () => {
  const from = { experiments: { ...defaultExperiments(), jumpStep: 15 }, settings: { ...DEFAULT_SETTINGS, theme: "light" as const } }
  assert.equal(setting(from, "jumpStep"), 15, "not the live Experiment")
  assert.equal(setting(from, "theme"), "light", "not the saved player setting")
  assert.equal(setting(from, "easeMs"), TUNING.easeMs, "not the tuned constant")
  // A number reads with its unit, a yes/no as on/off, a choice by the name its row gives it.
  assert.equal(formatValue("popupPulseMs", 0), "off")
  assert.equal(formatValue("popupPulseMs", 2000), "2000 ms")
  assert.equal(formatValue("jumpStep", 1), "1 tile")
  assert.equal(formatValue("jumpStep", 10), "10 tiles")
  assert.equal(formatValue("tapsToSpeedUp", 3), "3 taps")
  assert.equal(formatValue("reducedMotion", true), "on")
  assert.equal(formatValue("capability", "color16"), "16")
  assert.equal(formatValue("incoming", "hidden"), "hidden")
})

// --- Sections in Settings ------------------------------------------------------------------------------

test("Settings lists its rows section by section: Display, Keyboard navigation, Effects, the mission, then Export", () => {
  assert.deepEqual(
    SECTIONS.map((entry) => entry.section),
    ["display", "keyboard", "effects", "mission"],
  )
  // Rows run section by section, never back to an earlier one, and Export is last, in no section.
  const order = SETTINGS_ROWS.map((_, row) => sectionOfRow(row))
  assert.equal(order.at(-1), null)
  const seen = order.slice(0, -1).filter((section, index, all) => section !== all[index - 1])
  assert.deepEqual(seen, ["display", "keyboard", "effects", "mission"])
  // Display is the player's own four; the rest are Experiments today.
  assert.deepEqual(
    SHOWN_SETTINGS.filter((spec) => spec.section === "display").map((spec) => spec.field),
    PLAYER_FIELDS.map((spec) => spec.field),
  )
  assert.deepEqual(PLAYER_FIELDS.map((spec) => spec.field), ["theme", "capability", "glyphPack", "reducedMotion"])
  // Each heading says what its rows are.
  assert.equal(sectionHeading("display"), "DISPLAY - saved")
  assert.equal(sectionHeading("keyboard"), "KEYBOARD NAVIGATION - experiments")
  assert.equal(sectionHeading("effects"), "EFFECTS - experiments")
  assert.equal(sectionHeading("mission"), "THE MISSION - experiments")
  // `d` opens at Keyboard navigation's first row; during a Pulse, at the mission's first.
  assert.equal(sectionOfRow(FIRST_EXPERIMENT_ROW), "keyboard")
  assert.equal(FIRST_EXPERIMENT_ROW, settingRow((EXPERIMENT_FIELDS[0] as (typeof EXPERIMENT_FIELDS)[number]).field))
  assert.equal(sectionOfRow(FIRST_PULSE_EXPERIMENT_ROW), "mission")
  assert.equal(FIRST_PULSE_EXPERIMENT_ROW, settingRow("nextRound"))
})

test("on screen: each section under its heading, a blank line before each, and Up/Down never land on either", () => {
  for (const size of [MINIMUM, MAXIMUM]) {
    const side = buildSide({ terminal: size })
    keys(side, ESC, "s")
    // Walk the whole list: every step is one row, every highlighted row is a setting or Export, and each
    // heading is drawn once, in order, with a blank line above all but the first.
    const headings: string[] = []
    const count = SETTINGS_ROWS.length
    for (let row = 0; row < count; row += 1) {
      assert.equal(side.build.state.popupHighlight, row)
      assert.match(screenText(side), new RegExp(`SETTINGS \\(${row + 1}/${count}\\)`), "the count counts only rows the keyboard can be on")
      const popup = placed(side)
      const on = popup.rows.find((entry) => (entry.spec.kind === "setting" || entry.spec.kind === "option") && entry.spec.highlighted === true)
      assert.ok(on !== undefined, `nothing highlighted on row ${row} at ${size.columns}x${size.rows}`)
      popup.rows.forEach((entry, index) => {
        if (entry.spec.kind !== "heading") return
        if (!headings.includes(entry.spec.text)) headings.push(entry.spec.text)
        const above = popup.rows[index - 1]
        if (above !== undefined && entry.spec.text !== sectionHeading("display")) assert.equal(above.spec.kind, "blank", `no blank line above ${entry.spec.text}`)
      })
      keys(side, DOWN)
    }
    assert.deepEqual(headings, SECTIONS.map((entry) => sectionHeading(entry.section)), `at ${size.columns}x${size.rows}`)
    // The list stops at its end, and walks back the same way.
    assert.equal(side.build.state.popupHighlight, count - 1)
    keys(side, UP)
    assert.equal(side.build.state.popupHighlight, count - 2)
    // It scrolls with a scroll bar at the floor size, where it does not all fit.
    if (size === MINIMUM) assert.notEqual(placed(side).scrollBar, null)
  }
  // Export stands apart: a blank line above it and no heading.
  const side = buildSide()
  keys(side, ESC, "s", END)
  const rows = placed(side).rows
  const exportAt = rows.findIndex((entry) => entry.spec.kind === "option" && entry.spec.hotkey === "e")
  assert.equal(rows[exportAt - 1]?.spec.kind, "blank")
})

test("the export lists every new Experiment, at its default, and reads back to the same", () => {
  const text = formatSettingsExport({ settings: DEFAULT_SETTINGS, experiments: defaultExperiments() })
  const atDefaults = text.slice(text.indexOf("# Experiments at their defaults"))
  for (const spec of EXPERIMENT_FIELDS) {
    assert.ok(atDefaults.includes(`\n${spec.field} = ${String(defaultValue(spec.field))}  # ${spec.label}\n`), `${spec.field} is not listed at its default`)
  }
  assert.ok(!text.includes("battleRoundPulseMs"), "the old name is written")
  assert.ok(text.includes("popupPulseMs = 2000  # Popup pulse"))
  assert.ok(!namesOn("tuned").some((name) => text.includes(`\n${name} =`)), "a constant is exported")
})
