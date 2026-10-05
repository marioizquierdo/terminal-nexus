// Settings, the game menu and the export (owner, 2026-09-28): "When pressing [esc] or explicitly
// opening the main menu, there should be an option for '[s] Settings' along with '[q] Quit' ... At the
// bottom of those settings, we can include 'Experiments' ... Then, we need a way to export the
// settings." The Experiments' own tests are `tests/build-experiments.test.ts`; this file is everything around
// them — the menu that leads to Settings, the player's half, the export and its way back in.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { EXPERIMENT_FIELDS, defaultExperiments, experimentSpec, formatExperimentValue, stepExperiment } from "../src/build/experiments.ts"
import { MOUSE_WHEEL_DOWN } from "../src/build/mouse.ts"
import { settingColumns } from "../src/build/popup.ts"
import { FIRST_EXPERIMENT_ROW, GAME_MENU_ROWS, PLAYER_FIELDS, SETTINGS_EXPORT_ROW, settingRow } from "../src/build/settings.ts"
import { formatSettingsExport, importSettings, parseSettingsExport } from "../src/build/settings-export.ts"
import type { SettingsSnapshot } from "../src/build/settings-export.ts"
import type { BuildContext } from "../src/build/state.ts"
import { exportText } from "../src/build/state.ts"
import { SETTLED_EXPERIMENTS, TUNING } from "../src/build/tuning.ts"
import { defaultValue, isSettingName } from "../src/build/all-settings.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { runBuildPhase } from "../src/cli/build-phase.ts"
import { starterContext } from "../src/cli/starter.ts"
import { osc52, terminalExporter } from "../src/cli/terminal-nexus.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import type { Settings } from "../src/settings/types.ts"
import { frameToText } from "../src/view/frame.ts"
import {
  CTRL_C,
  DOWN,
  END,
  ENTER,
  ESC,
  LEFT,
  RIGHT,
  buildSide,
  clickCell,
  clickEscLabel,
  clickPopupOption,
  goToExperiment,
  goToGameMenuRow,
  goToPopupRow,
  keys,
  placed,
  screenText,
} from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"

type SettingsSide = BuildSide & Readonly<{ exports: string[]; saved: Settings[] }>

/** A Build Phase that keeps what it hands the live loop: every export and every setting to save. */
function session(context: BuildContext = starterContext()): SettingsSide {
  const exports: string[] = []
  const saved: Settings[] = []
  const side = buildSide({ context, onExport: (text) => exports.push(text), onSettingsChange: (settings) => saved.push(settings) })
  return { ...side, exports, saved }
}

/** The screen as the player's own settings draw it: their glyph pack, at their colour depth. */
function screen(side: SettingsSide): string {
  return screenText(side, side.build.state.settings.capability)
}

// --- The game menu -----------------------------------------------------------------------------------

test("Esc on the menu, q anywhere, and the top bar's menu [esc] all open the game menu: Settings, Controls, Activity logs, Restart, Quit", () => {
  for (const open of [[ESC], ["q"]]) {
    const side = session()
    keys(side, ...open)
    assert.equal(side.build.state.popup, "game-menu")
    const text = screen(side)
    assert.match(text, /MENU/)
    assert.match(text, /\[s\] Settings/)
    assert.match(text, /\[c\] Controls and hotkeys/)
    assert.match(text, /\[r\] Restart/)
    assert.match(text, /\[q\] Quit/)
    // The bottom line says how to work it, where the key help listed its keys.
    assert.match(text, /Up\/down and \[enter\] choose, or press a row's key\. \[esc\] back to the game\./)
  }
  const clicked = session()
  clickEscLabel(clicked)
  assert.equal(clicked.build.state.popup, "game-menu")
  // From the map, Esc walks back to the menu first; a committed Build Phase opens the game menu too.
  const grid = session()
  keys(grid, "e", ESC)
  assert.equal(grid.build.state.popup, null)
  keys(grid, ESC)
  assert.equal(grid.build.state.popup, "game-menu")
  const committed = session()
  keys(committed, "n", "1", "p", "y", ESC)
  assert.equal(committed.build.state.popup, "game-menu")
})

test("leaving always goes through the game menu: its q, Enter on Quit, or a click on Quit; only Ctrl+C quits at once", () => {
  const byKey = session()
  keys(byKey, "q")
  assert.equal(byKey.quits(), 0, "a bare q quit")
  keys(byKey, "q")
  assert.equal(byKey.quits(), 1)

  const byEnter = session()
  keys(byEnter, ESC)
  goToGameMenuRow(byEnter, "quit")
  keys(byEnter, ENTER)
  assert.equal(byEnter.quits(), 1)

  const byClick = session()
  keys(byClick, ESC)
  clickPopupOption(byClick, "q")
  assert.equal(byClick.quits(), 1)

  const interrupt = session()
  keys(interrupt, CTRL_C)
  assert.equal(interrupt.quits(), 1)
})

test("[s] opens Settings at the player's settings; Esc goes back to the game menu, then to the game", () => {
  const side = session()
  keys(side, ESC, "s")
  assert.equal(side.build.state.popup, "settings")
  assert.equal(side.build.state.popupHighlight, settingRow("theme"))
  assert.deepEqual(side.build.state.popupUnder.map((level) => level.popup), ["game-menu"])
  const text = screen(side)
  assert.match(text, /DISPLAY - saved/)
  assert.match(text, /Background\s+<\s+dark\s+>/)
  assert.match(text, /match your terminal's own/, "the highlighted setting does not say what it is for")
  keys(side, ESC)
  assert.equal(side.build.state.popup, "game-menu")
  assert.equal(GAME_MENU_ROWS[side.build.state.popupHighlight], "settings", "back on the row that opened Settings")
  keys(side, ESC)
  assert.equal(side.build.state.popup, null)
  // `d` still opens Settings straight at the experiments, and Esc then goes back to the game.
  keys(side, "d")
  assert.equal(side.build.state.popupHighlight, FIRST_EXPERIMENT_ROW)
  keys(side, ESC)
  assert.equal(side.build.state.popup, null)
  // q inside Settings is the way out: the game menu, not a quit.
  keys(side, "d", "q")
  assert.equal(side.build.state.popup, "game-menu")
  assert.equal(side.quits(), 0)
})

// --- The player's settings ---------------------------------------------------------------------------

test("a player setting changes at once, is handed to the live loop to save, and survives a restart", () => {
  const side = session()
  keys(side, ESC, "s", RIGHT)
  assert.equal(side.build.state.settings.theme, "light")
  assert.deepEqual(side.saved, [{ ...DEFAULT_SETTINGS, theme: "light" }])
  assert.equal(side.build.state.status.text, "Background: light.")
  // Symbols to unicode: the very next frame draws with them.
  goToPopupRow(side, settingRow("glyphPack"))
  keys(side, RIGHT)
  assert.equal(side.build.state.settings.glyphPack, "unicode")
  assert.match(screen(side), /[─│┌]/u, "the frame did not switch to Unicode lines")
  // Colour depth walks all four and comes round; Left goes the other way.
  goToPopupRow(side, settingRow("capability"))
  for (let step = 0; step < 4; step += 1) keys(side, RIGHT)
  assert.equal(side.build.state.settings.capability, DEFAULT_SETTINGS.capability)
  keys(side, LEFT)
  assert.equal(side.build.state.settings.capability, "monochrome")
  assert.match(screen(side), /Colour depth\s+<\s+none\s+>/)
  // Reduced motion flips on Enter.
  goToPopupRow(side, settingRow("reducedMotion"))
  keys(side, ENTER)
  assert.equal(side.build.state.settings.reducedMotion, true)
  const before = side.build.state.settings
  keys(side, "q", "r") // the game menu's Restart
  assert.equal(side.build.state.status.text, "Build Phase restarted with these settings.")
  assert.equal(side.build.state.settings, before, "a restart forgot the player's settings")
  assert.equal(side.saved.length, 8, "every change, and only a change, is handed on to be saved")
})

test("every player setting's value box is a click target, the same as Left and Right", () => {
  for (const spec of PLAYER_FIELDS) {
    const byKey = session()
    keys(byKey, ESC, "s")
    goToPopupRow(byKey, settingRow(spec.field))
    keys(byKey, RIGHT)
    const byClick = session()
    keys(byClick, ESC, "s")
    const row = placed(byClick).rows.find((entry) => entry.spec.kind === "setting" && entry.spec.label === spec.label)
    assert.ok(row !== undefined, `${spec.label} is not on screen`)
    clickCell(byClick, settingColumns(placed(byClick)).valueTo, row.row)
    assert.deepEqual(byClick.build.state.settings, byKey.build.state.settings, spec.label)
  }
})

// --- The export -------------------------------------------------------------------------------------

test("[e] shows the export in a popup, hands the same text to the adapter, and Esc goes back one popup at a time", () => {
  const context: BuildContext = { ...starterContext(), buildId: "abc1234", exportDestination: "Copied to the clipboard." }
  const side = session(context)
  keys(side, "d")
  goToExperiment(side, "holdWindowMs")
  keys(side, RIGHT) // a longer hold window
  const hold = stepExperiment(defaultExperiments(), "holdWindowMs", 1).flags.holdWindowMs
  keys(side, "q", "s", "e")
  assert.equal(side.build.state.popup, "export")
  assert.equal(side.exports.length, 1)
  assert.equal(side.exports[0], exportText(side.context, side.build.state))
  const text = screen(side)
  assert.match(text, /EXPORT SETTINGS/)
  assert.match(text, /Copied to the clipboard\./)
  assert.match(text, /Terminal Nexus settings/)
  assert.match(text, /# build abc1234/)
  assert.match(text, /# Changed experiments/)
  assert.match(text, new RegExp(`holdWindowMs = ${hold} `))
  // Up/Down walk the text; the window follows it to the last line.
  for (let line = 0; line < 40; line += 1) keys(side, DOWN)
  const last = EXPERIMENT_FIELDS[EXPERIMENT_FIELDS.length - 1]?.field
  assert.ok(last !== undefined && last !== "holdWindowMs")
  assert.match(screen(side), new RegExp(`${last} = ${String(defaultExperiments()[last])} `))
  keys(side, ESC)
  assert.equal(side.build.state.popup, "settings")
  assert.equal(side.build.state.popupHighlight, SETTINGS_EXPORT_ROW)
  keys(side, ESC)
  assert.equal(side.build.state.popup, "game-menu")
  keys(side, ESC)
  assert.equal(side.build.state.popup, null)
  // The Export row by Enter, and by a click, does the same.
  const byEnter = session()
  keys(byEnter, ESC, "s", END, ENTER) // End goes to the last row: Export
  assert.equal(byEnter.build.state.popup, "export")
  const byClick = session()
  keys(byClick, ESC, "s", END) // the list's last row, in view
  clickPopupOption(byClick, "e")
  assert.equal(byClick.build.state.popup, "export")
  assert.equal(byClick.exports.length, 1)
})

test("the export lists changed experiments first with their defaults, then the settings, then the rest", () => {
  // Three Experiments a step from this build's defaults, each written as `keyReleases = off  # Key
  // releases, default auto`: the value as the code reads it, the default as the popup shows it.
  const defaults = defaultExperiments()
  const moved = ["nextRound", "keyReleases", "holdWindowMs"] as const
  const experiments = moved.reduce((flags, field) => stepExperiment(flags, field, 1).flags, defaults)
  const snapshot: SettingsSnapshot = { settings: { ...DEFAULT_SETTINGS, theme: "light" }, experiments }
  const text = formatSettingsExport(snapshot, "592f3cb")
  const lines = text.trimEnd().split("\n")
  assert.equal(lines[0], "Terminal Nexus settings")
  assert.equal(lines[1], "# build 592f3cb")
  assert.equal(lines[2], "# Changed experiments")
  const changedEnd = lines.indexOf("# Settings")
  const changed = lines.slice(3, changedEnd)
  assert.deepEqual(
    changed.map((line) => line.split(" ")[0]),
    EXPERIMENT_FIELDS.map((spec) => spec.field).filter((field) => (moved as readonly string[]).includes(field)),
  )
  for (const field of moved) {
    const wrote = `${field} = ${String(experiments[field])}  # ${experimentSpec(field).label}, default ${formatExperimentValue(defaults, field)}`
    assert.ok(changed.includes(wrote), `no line "${wrote}"`)
  }
  assert.ok(lines.includes("theme = light  # Background"))
  assert.ok(lines.includes("# Experiments at their defaults"))
  assert.equal(lines.length, 2 + 1 + moved.length + 1 + PLAYER_FIELDS.length + 1 + (EXPERIMENT_FIELDS.length - moved.length))
  // With nothing changed it says so, and a build without a commit id says nothing about one.
  const plain = formatSettingsExport({ settings: DEFAULT_SETTINGS, experiments: defaults })
  assert.match(plain, /^Terminal Nexus settings\n# Changed experiments: none\n/)
})

// --- Importing it back -------------------------------------------------------------------------------

test("an export read back gives exactly the settings and experiments it was made from", () => {
  const base: SettingsSnapshot = { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() }
  // Every Experiment a step from its default: up, or down where up is its end.
  const moved = EXPERIMENT_FIELDS.reduce((flags, spec) => {
    const up = stepExperiment(flags, spec.field, 1)
    return up.changed ? up.flags : stepExperiment(flags, spec.field, -1).flags
  }, base.experiments)
  for (const spec of EXPERIMENT_FIELDS) assert.notEqual(moved[spec.field], base.experiments[spec.field], `${spec.field} did not move`)
  const changed: SettingsSnapshot = {
    settings: { capability: "color256", theme: "light", glyphPack: "unicode", reducedMotion: true },
    experiments: moved,
  }
  for (const snapshot of [base, changed]) {
    const result = parseSettingsExport(formatSettingsExport(snapshot, "x"), base)
    assert.deepEqual(result.snapshot, snapshot)
    assert.deepEqual(result.ignored, [])
    assert.equal(result.applied.length, EXPERIMENT_FIELDS.length + PLAYER_FIELDS.length)
  }
})

test("reading is forgiving: unknown names and bad values are skipped, one at a time, and short forms work", () => {
  const base: SettingsSnapshot = { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() }
  const result = parseSettingsExport(
    [
      "some chatter from a pull request comment",
      "keyReleases=off, holdWindowMs=500ms; battleRoundPulseMs=1200ms",
      "retiredFlag = 3  # a flag an older build had",
      "battleRoundPulseMs = 99999  # out of range: keeps what it had",
      "focusArrowMs=250 cardRevealMs=400  # settled in the third round: skipped without a word",
      "nextRound = sideways",
      "startFocus = map  # as the popup shows it",
      "colours=256 background=light glyphs=unicode reducedMotion=yes",
      "smartCursor = off",
      "placeLight=rainbow scrollMargin=30%  # settled since: skipped without a word",
    ].join("\n"),
    base,
  )
  const { experiments, settings } = result.snapshot
  assert.equal(experiments.keyReleases, "off")
  assert.equal(experiments.holdWindowMs, 500)
  assert.equal(experiments.popupPulseMs, 1200)
  assert.equal(experiments.nextRound, defaultExperiments().nextRound)
  assert.deepEqual(settings, { capability: "color256", theme: "light", glyphPack: "unicode", reducedMotion: true })
  // "Opens on" and "Smart cursor" were settled and deleted before the list of
  // settled names existed: an older export's lines for them are reported like any retired name.
  assert.deepEqual(result.ignored, ["retiredFlag=3", "battleRoundPulseMs=99999", "nextRound=sideways", "startFocus=map", "smartCursor=off"])
  // The names the owner has settled are known: skipped quietly, never reported.
  assert.deepEqual(result.settled, ["focusArrowMs", "cardRevealMs", "placeLight", "scrollMargin"])
  // The popup's own words read back too, and a settled name from an older export is skipped without a word.
  const shown = parseSettingsExport("battleRoundPulseMs=off cursorBlinks=3", base)
  assert.equal(shown.snapshot.experiments.popupPulseMs, 0)
  assert.deepEqual(shown.ignored, [])
  assert.deepEqual(shown.settled, ["cursorBlinks"])
  // `battleRoundPulseMs` above is the old name of the popup pulse: it reads as the new
  // one, which reads too, and is reported by its name now.
  const renamed = parseSettingsExport("battleRoundPulseMs=3000", base)
  assert.deepEqual(renamed.applied, ["popupPulseMs"])
  assert.equal(parseSettingsExport("popupPulseMs=3000", base).snapshot.experiments.popupPulseMs, renamed.snapshot.experiments.popupPulseMs)
  // Nothing readable at all is the base, unchanged.
  assert.deepEqual(parseSettingsExport("", base).snapshot, base)
  assert.deepEqual(parseSettingsExport("= = # nothing", base).snapshot, base)
})

test("a number is digits first: a bare unit is a bad value, skipped and reported, never zero", () => {
  const base: SettingsSnapshot = { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() }
  // `Number("")` is 0, which once turned the focus arrow and the card reveal off.
  const result = parseSettingsExport("battleRoundPulseMs=ms holdWindowMs=% holdWindowMs=-350 keyReleases=off", base)
  assert.deepEqual(result.snapshot.experiments, { ...defaultExperiments(), keyReleases: "off" })
  assert.deepEqual(result.ignored, ["battleRoundPulseMs=ms", "holdWindowMs=%", "holdWindowMs=-350"])
  // With digits in front, a unit still reads.
  assert.equal(parseSettingsExport("battleRoundPulseMs=1200ms", base).snapshot.experiments.popupPulseMs, 1200)
})

/** The owner's settings export of 2026-09-30, word for word: "Many of those settings can
 *  be cleaned now, I feel good about them." */
const OWNER_EXPORT_2026_09_30 = [
  "Terminal Nexus settings",
  "# build 02fd8ee",
  "# Changed experiments",
  "placeGlowMs = 400  # Glow time, default 250 ms",
  "scrollMargin = 30  # Scroll margin, default 25%",
  "clickZone = 25  # Click edge zone, default 33%",
  "easeMs = 100  # View slide, default 150 ms",
  "cursorGlideMs = 100  # Cursor glide, default 80 ms",
  "fastRecentres = off  # Shift centres, default on",
  "rampMs = 200  # Held to go fast, default 300 ms",
  "holdWindowMs = 350  # Hold window, default 150 ms",
  "jumpStep = 10  # Shift jump, default 12 tiles",
  "jumpRepeatMs = 100  # Jump repeat, default 150 ms",
  "escTimeoutMs = 50  # Esc timeout, default 100 ms",
  "refusedFlashMs = 90  # Refused flicker, default 140 ms",
  "endWalkPauseMs = 500  # Walk-back delay, default 1000 ms",
  "endWalkMs = 1000  # Walk-back time, default 2000 ms",
  "raid = heavy  # Raid, default probe",
  "crew = none  # Your units, default some",
  "# Settings",
  "theme = dark  # Background",
  "capability = truecolor  # Colour depth",
  "glyphPack = unicode  # Symbols",
  "reducedMotion = off  # Reduced motion",
  "# Experiments at their defaults",
  "focusArrowMs = 180  # Focus arrow",
  "cursorBlinks = 2  # Cursor blink",
  "placeFramesMs = 300  # Build animation",
  "placeLight = light  # Lighting",
  "placeParticles = few  # Particles",
  "clickScroll = edges  # Explore click",
  "armedClickScrolls = on  # Armed click scrolls",
  "doubleClickMs = 400  # Double click",
  "tapStep = 1  # Tap step",
  "holdStep = 2  # Hold step",
  "fastStep = 4  # Fast step",
  "refusedCursorMs = 150  # Refused cursor",
  "pressedFlashMs = 90  # Pressed flash",
  "endWarnMs = 3000  # Final warning",
  "endCentre = on  # Centre on Nexus",
  "redAlerts = on  # Red alerts",
].join("\n")

/** His third-round export, the same day, word for word: "Preferred settings". */
const OWNER_EXPORT_2026_09_30_THIRD = [
  "Terminal Nexus settings",
  "# build 546de47",
  "# Changed experiments",
  "focusArrowMs = 250  # Focus arrow, default 180 ms",
  "cardRevealMs = 400  # Card reveal, default 150 ms",
  "holdWindowMs = 250  # Hold window, default 350 ms",
  "crew = some  # Your units, default none",
  "# Settings",
  "theme = dark  # Background",
  "capability = truecolor  # Colour depth",
  "glyphPack = unicode  # Symbols",
  "reducedMotion = off  # Reduced motion",
  "# Experiments at their defaults",
  "raid = heavy  # Raid",
].join("\n")

test("the owner's third export is this build: the focus arrow and card reveal are tuned values, the placeholder Pulse retired", () => {
  const base: SettingsSnapshot = { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() }
  const result = parseSettingsExport(OWNER_EXPORT_2026_09_30_THIRD, base)
  assert.deepEqual(result.ignored, [])
  // The raid and the crew were his placeholder Pulse's; PERIMETER's raid is the mission's data now,
  // so an export that names them reads without a complaint, and they change nothing.
  assert.deepEqual(result.settled, ["focusArrowMs", "cardRevealMs", "crew", "raid"])
  assert.equal(TUNING.focusArrowMs, 250)
  assert.equal(TUNING.cardRevealMs, 400)
  // The hold window is the one value that differs on purpose: his words that day asked to try 200 with
  // the tap-counting ramp ("I would try holdWindowMs = 200ms"); his export still had 250 from the old one.
  assert.equal(result.snapshot.experiments.holdWindowMs, 250)
  assert.equal(defaultExperiments().holdWindowMs, 200)
})

test("the owner's export of 2026-09-30 is this build: its settled numbers are the tuned values", () => {
  const base: SettingsSnapshot = { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() }
  const result = parseSettingsExport(OWNER_EXPORT_2026_09_30, base)
  // Every line is known: nothing is reported as a name the game does not know.
  assert.deepEqual(result.ignored, [])
  // His jump distance reads as an Experiment again: it came back for the navigation polish round,
  // at his value.
  assert.deepEqual(result.applied, ["holdWindowMs", "jumpStep", "theme", "capability", "glyphPack", "reducedMotion"])
  // The rest were settled: the twenty-eight of that export — less the jump distance, above — and the
  // focus arrow he settled again later that day, each skipped quietly; each number of the twenty-eight is
  // this build's value, read not copied, whichever tier it stands on now — except the held-key ramp's
  // three (`holdStep`, `fastStep`, `rampMs`), which his third round the same day retired along with the
  // rule they tuned (taps counted, a hold on a cadence), still skipped quietly. (The settled names
  // are derived from the list, so they also hold tuned numbers his export never named.)
  // (Plus the placeholder Pulse's raid and crew, retired when missions arrived.)
  assert.equal(result.settled.length, 30)
  assert.ok(result.settled.every((name) => SETTLED_EXPERIMENTS.has(name)))
  // Not settled by that export: the hold window, an Experiment then and now (his third round retuned it),
  // and the two he settled again later that day.
  const notSettledThere = new Set(["holdWindowMs", "focusArrowMs", "cardRevealMs"])
  const numbers = [...OWNER_EXPORT_2026_09_30.matchAll(/^(\w+) = (\d+) /gmu)]
  let checked = 0
  for (const [, name, value] of numbers) {
    if (name === undefined || !isSettingName(name) || notSettledThere.has(name)) continue
    assert.equal(defaultValue(name), Number(value), `${name} is not his ${value}`)
    checked += 1
  }
  assert.equal(checked, 18, "every number of his that is still a setting was compared")
  for (const retired of ["holdStep", "fastStep", "rampMs"]) assert.ok(!(retired in TUNING) && SETTLED_EXPERIMENTS.has(retired), retired)
  // And each default is a value its Experiment's list holds, so Left/Right step from it exactly.
  for (const spec of EXPERIMENT_FIELDS) {
    const value = defaultExperiments()[spec.field]
    assert.ok((spec.values as readonly unknown[]).includes(value), `${spec.field}'s default ${String(value)} is in its list`)
  }
})

test("a route's query form reads too: pairs joined by &, and true or false on every on/off setting", () => {
  const base: SettingsSnapshot = { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() }
  // The owner's "foo=6&var=true", with names the game has.
  const query = parseSettingsExport("holdWindowMs=250&reducedMotion=true&keyReleases=false&popupPulseMs=false", base)
  assert.equal(query.snapshot.experiments.holdWindowMs, 250)
  assert.equal(query.snapshot.settings.reducedMotion, true)
  assert.equal(query.snapshot.experiments.keyReleases, "off")
  assert.equal(query.snapshot.experiments.popupPulseMs, 0)
  assert.deepEqual(query.applied, ["holdWindowMs", "reducedMotion", "keyReleases", "popupPulseMs"])
  assert.deepEqual(query.ignored, [])
  // The Barracks's pace, from an export made before its own numbers answered it, reads quietly as settled.
  const old = parseSettingsExport("trainEvery=6&trainPerRound=4", base)
  assert.deepEqual([old.applied, old.ignored], [[], []])
  assert.deepEqual(old.snapshot, base)
  // Yes words too, where a setting has one "on" value besides "off": Key releases is auto or off.
  const on = parseSettingsExport("keyReleases=off&keyReleases=true", base)
  assert.equal(on.snapshot.experiments.keyReleases, "auto")
  for (const word of ["no", "0", "OFF", "False"]) {
    assert.equal(parseSettingsExport(`keyReleases=${word}`, base).snapshot.experiments.keyReleases, "off", word)
  }
  for (const word of ["yes", "1", "on", "TRUE"]) {
    const read = parseSettingsExport(`keyReleases=off&keyReleases=${word}&reducedMotion=${word}`, base).snapshot
    assert.equal(read.experiments.keyReleases, "auto", word)
    assert.equal(read.settings.reducedMotion, true, word)
  }
  // But not a guess: the popup pulse has four lengths besides off, and a setting with no "off" takes no no-word.
  const guessed = parseSettingsExport("popupPulseMs=true&holdWindowMs=false&nextRound=true", base)
  assert.deepEqual(guessed.ignored, ["popupPulseMs=true", "holdWindowMs=false", "nextRound=true"])
  assert.deepEqual(guessed.snapshot, base)
  // A number is still a number first: 0 is off, and a number between the listed ones is that number.
  assert.equal(parseSettingsExport("popupPulseMs=0", base).snapshot.experiments.popupPulseMs, 0)
  // The same text through `--settings`, the browser page's `#settings=` and the playtest: one reader.
  const imported = importSettings("theme=light&keyReleases=false", DEFAULT_SETTINGS)
  assert.equal(imported.settings.theme, "light")
  assert.equal(imported.experiments.keyReleases, "off")
})

test("--settings on the command line: settings over what is saved, and every experiment from the text", () => {
  const saved: Settings = { ...DEFAULT_SETTINGS, capability: "truecolor" }
  assert.deepEqual(importSettings(undefined, saved), { settings: saved, experiments: defaultExperiments(), ignored: [] })
  const imported = importSettings("theme=light keyReleases=off", saved)
  assert.deepEqual(imported.settings, { ...saved, theme: "light" })
  assert.deepEqual(imported.experiments, { ...defaultExperiments(), keyReleases: "off" })
})

test("a Build Phase opened with imported experiments has them, and the playtest script's runner takes both halves", () => {
  const side = session({ ...starterContext(), experiments: { keyReleases: "off", holdWindowMs: 500 } })
  assert.equal(side.build.state.experiments.keyReleases, "off")
  assert.equal(side.build.state.experiments.holdWindowMs, 500)
  const run = runBuildPlaytest({
    steps: parseKeyScript("d"),
    settings: { ...DEFAULT_SETTINGS, glyphPack: "unicode" },
    experiments: { nextRound: "auto" },
  })
  const last = run.frames[run.frames.length - 1]
  assert.ok(last !== undefined)
  assert.equal(last.state.experiments.nextRound, "auto")
  assert.equal(last.state.settings.glyphPack, "unicode")
  assert.match(frameToText(last.frame), /│/u)
})

// --- Same flow, every adapter -----------------------------------------------------------------------

test("the settings flow by keys, by clicks, and from a driver script is the same state, frame and export", () => {
  // Open the game menu, open Settings, set the background to light, go to the experiments and turn the
  // next round to begin on its own, then export.
  const byKeyboard = session()
  keys(byKeyboard, ESC, "s", RIGHT, ESC, ESC, "d")
  goToExperiment(byKeyboard, "nextRound")
  keys(byKeyboard, RIGHT, "e")

  const byMouse = session()
  clickEscLabel(byMouse)
  clickPopupOption(byMouse, "s")
  const background = placed(byMouse).rows.find((entry) => entry.spec.kind === "setting" && entry.spec.label === "Background")
  assert.ok(background !== undefined)
  clickCell(byMouse, settingColumns(placed(byMouse)).valueTo, background.row)
  // By mouse, the next round's row is reached with the wheel; its value box is the click.
  const roundLabel = experimentSpec("nextRound").label
  while (!placed(byMouse).rows.some((entry) => entry.spec.kind === "setting" && entry.spec.label === roundLabel)) {
    clickCell(byMouse, placed(byMouse).box.left + 2, placed(byMouse).box.top + 2, MOUSE_WHEEL_DOWN)
  }
  const round = placed(byMouse).rows.find((entry) => entry.spec.kind === "setting" && entry.spec.label === roundLabel)
  assert.ok(round !== undefined)
  clickCell(byMouse, settingColumns(placed(byMouse)).valueTo, round.row)
  // Export settings is the list's last row: the scroll bar's lower half brings it into view.
  while (!placed(byMouse).rows.some((entry) => entry.spec.kind === "option" && entry.spec.hotkey === "e")) {
    const bar = placed(byMouse).scrollBar
    assert.ok(bar !== null, "the list overflows, so it has a scroll bar")
    clickCell(byMouse, bar.column, bar.bottom)
  }
  clickPopupOption(byMouse, "e")

  const script: readonly BuildCommand[] = [
    { kind: "open-game-menu" },
    { kind: "open-settings", section: "settings" },
    { kind: "setting-adjust", field: "theme", step: 1 },
    { kind: "experiment-adjust", field: "nextRound", step: 1 },
    { kind: "export-settings" },
  ]
  const byDriver = session()
  byDriver.build.run(script)

  const roundNow = stepExperiment(defaultExperiments(), "nextRound", 1).flags.nextRound
  for (const side of [byKeyboard, byMouse, byDriver]) {
    assert.equal(side.build.state.popup, "export")
    assert.equal(side.build.state.settings.theme, "light")
    assert.equal(side.build.state.experiments.nextRound, roundNow)
    assert.equal(side.exports.length, 1)
    assert.match(side.exports[0] as string, new RegExp(`nextRound = ${roundNow} `))
  }
  assert.equal(byMouse.exports[0], byKeyboard.exports[0])
  assert.equal(byDriver.exports[0], byKeyboard.exports[0])
  // The way back differs by how Settings was reached — so compare what the player has, not the stack.
  const comparable = (side: SettingsSide) => ({ ...side.build.state, popupUnder: [], popupHighlight: 0, status: null, ack: null })
  assert.deepEqual(comparable(byMouse), comparable(byKeyboard))
  assert.deepEqual(comparable(byDriver), comparable(byKeyboard))
})

// --- The live loop and the terminal ------------------------------------------------------------------

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = 80
  rows = 24
  written = ""
  write(text: string): boolean {
    this.written += text
    return true
  }
}

class FakeStdin extends EventEmitter {
  isTTY = true
  setRawMode(): this {
    return this
  }
  resume(): this {
    return this
  }
  pause(): this {
    return this
  }
}

test("the live screen saves a changed setting through the store and hands an export to its exporter", async () => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const saves: Settings[] = []
  const exported: string[] = []
  const running = runBuildPhase({
    settings: { ...DEFAULT_SETTINGS, capability: "monochrome" },
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: () => {},
    buildId: "abc1234",
    settingsStore: {
      load: async () => null,
      save: async (settings) => {
        saves.push(settings)
      },
    },
    exporter: { destination: { settings: "Sent to the test.", activity: "Logs sent to the test." }, export: (text) => void exported.push(text) },
  })
  await new Promise((resolve) => setTimeout(resolve, 30))
  for (const key of ["q", "s", RIGHT, "e"]) stdin.emit("data", Buffer.from(key))
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.deepEqual(saves, [{ ...DEFAULT_SETTINGS, capability: "monochrome", theme: "light" }])
  assert.equal(exported.length, 1)
  assert.match(exported[0] as string, /^Terminal Nexus settings\n# build abc1234\n/)
  assert.match(exported[0] as string, /theme = light/)
  assert.ok(stdout.written.includes("Sent to the test."), "the export popup does not say where the text went")
  stdin.emit("data", Buffer.from([3]))
  assert.equal(await running, 0)
})

test("the terminal's export: OSC 52 to the clipboard and a file beside the settings", async () => {
  assert.equal(osc52("hi"), `${ESC}]52;c;aGk=\u0007`)
  const folder = mkdtempSync(join(tmpdir(), "tn-export-"))
  const path = join(folder, "nested", "settings-export.txt")
  const stdout = new FakeStdout()
  const exporter = terminalExporter(stdout as unknown as NodeJS.WriteStream, path)
  assert.match(exporter.destination.settings, /clipboard if your terminal allows it, and saved to .*settings-export\.txt\./)
  await exporter.export("theme = light\n", "settings")
  assert.equal(readFileSync(path, "utf8"), "theme = light\n")
  assert.ok(stdout.written.includes(osc52("theme = light\n")))
  // The Activity Logs' export goes to the clipboard too, and to a file of its own beside
  // the settings', which it never overwrites.
  assert.match(exporter.destination.activity, /clipboard if your terminal allows it, and saved to .*activity-export\.txt\./)
  await exporter.export("Terminal Nexus activity logs\n", "activity")
  assert.equal(readFileSync(join(folder, "nested", "activity-export.txt"), "utf8"), "Terminal Nexus activity logs\n")
  assert.equal(readFileSync(path, "utf8"), "theme = light\n")
  assert.ok(stdout.written.includes(osc52("Terminal Nexus activity logs\n")))
})

test("a fresh Build Phase exports no changed experiment", () => {
  const side = session()
  keys(side, "d", "e")
  assert.match(side.exports[0] as string, /# Changed experiments: none/)
})
