// Settings, the game menu and the export (owner, 2026-09-28): "When pressing [esc] or explicitly
// opening the main menu, there should be an option for '[s] Settings' along with '[q] Quit' ... At the
// bottom of those settings, we can include 'Experiments' ... Then, we need a way to export the
// settings." The Experiments' own tests are `tests/build-debug.test.ts`; this file is everything around
// them — the menu that leads to Settings, the player's half, the export and its way back in.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEBUG_FIELDS, initialDebugFlags } from "../src/build/debug.ts"
import { buildLayout, escHintSpan, escLabel } from "../src/build/layout.ts"
import { MOUSE_LEFT, formatMouseEvent } from "../src/build/mouse.ts"
import { overlaySpec, placeOverlay, settingColumns } from "../src/build/overlay.ts"
import type { PlacedOverlay } from "../src/build/overlay.ts"
import { BuildSession } from "../src/build/session.ts"
import { GAME_MENU_ROWS, PLAYER_FIELDS, SETTINGS_EXPORT_ROW, playerRow } from "../src/build/settings.ts"
import { defaultExperiments, formatSettingsExport, parseSettingsExport } from "../src/build/settings-export.ts"
import type { SettingsSnapshot } from "../src/build/settings-export.ts"
import type { BuildContext } from "../src/build/state.ts"
import { exportText } from "../src/build/state.ts"
import { SETTLED_EXPERIMENTS, TUNING } from "../src/build/tuning.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { runSpike, spikeContext } from "../src/cli/spike.ts"
import { importSettings, osc52, terminalExporter } from "../src/cli/terminalNexus.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import type { Settings } from "../src/settings/types.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { frameToText } from "../src/view/frame.ts"

const ESC = String.fromCharCode(27)
const UP = `${ESC}[A`
const DOWN = `${ESC}[B`
const RIGHT = `${ESC}[C`
const LEFT = `${ESC}[D`
/** End: a list's last row (feedback F75) — Export settings, in Settings. */
const END = `${ESC}[F`
const ENTER = "\r"

type Side = {
  build: BuildSession
  layout: ReturnType<typeof buildLayout>
  context: BuildContext
  quits: number
  exports: string[]
  saved: Settings[]
}

function session(context: BuildContext = spikeContext()): Side {
  const layout = buildLayout({ columns: 80, rows: 24 }, context.grid)
  const side: Side = { build: undefined as unknown as BuildSession, layout, context, quits: 0, exports: [], saved: [] }
  side.build = new BuildSession({
    context,
    cursor: { x: 18, y: 13 },
    viewport: layout.viewport,
    onQuit: () => {
      side.quits += 1
    },
    onExport: (text) => side.exports.push(text),
    onSettingsChange: (settings) => side.saved.push(settings),
  })
  return side
}

function keys(side: Side, ...sequence: string[]): void {
  for (const key of sequence) side.build.handleData(key, side.layout)
}

function screen(side: Side): string {
  const { state } = side.build
  return frameToText(
    composeBuildFrame({ context: side.context, state, layout: side.layout, glyphPack: state.settings.glyphPack }, state.settings.capability),
  )
}

function placed(side: Side): PlacedOverlay {
  const spec = overlaySpec(side.context, side.build.state)
  assert.ok(spec !== null, "no popup is open")
  return placeOverlay(side.layout, spec)
}

function click(side: Side, column: number, row: number): void {
  keys(side, formatMouseEvent(MOUSE_LEFT, column + 1, row + 1))
}

/** Clicks the popup's option with this hotkey. */
function clickOption(side: Side, hotkey: string): void {
  const row = placed(side).rows.find((entry) => entry.spec.kind === "option" && entry.spec.hotkey === hotkey && !entry.secondLine)
  assert.ok(row !== undefined, `no [${hotkey}] option`)
  click(side, placed(side).textColumn + 2, row.row)
}

// --- The game menu -----------------------------------------------------------------------------------

test("Esc on the menu, q anywhere, and the top bar's menu [esc] all open the game menu: Settings, Controls, Restart, Quit", () => {
  for (const open of [[ESC], ["q"]]) {
    const side = session()
    keys(side, ...open)
    assert.equal(side.build.state.overlay, "menu")
    const text = screen(side)
    assert.match(text, /MENU/)
    assert.match(text, /\[s\] Settings/)
    assert.match(text, /\[c\] Controls and hotkeys/)
    assert.match(text, /\[r\] Restart/)
    assert.match(text, /\[q\] Quit/)
    // No row goes back to the game (feedback F73): Esc, x, the top bar and a click outside do.
    assert.doesNotMatch(text, /Back to the game/)
    // The bottom line says how to work it (feedback F59), where the key help listed its keys.
    assert.match(text, /Up\/down and \[enter\] choose, or press a row's key\. \[esc\] back to the game\./)
  }
  const clicked = session()
  const hint = escHintSpan(clicked.layout, "menu [esc]")
  click(clicked, hint.from + 1, hint.row)
  assert.equal(clicked.build.state.overlay, "menu")
  // From the map, Esc walks back to the menu first; a committed Build Phase opens the game menu too.
  const grid = session()
  keys(grid, "e", ESC)
  assert.equal(grid.build.state.overlay, null)
  keys(grid, ESC)
  assert.equal(grid.build.state.overlay, "menu")
  const committed = session()
  keys(committed, "n", "1", "p", "y", ESC)
  assert.equal(committed.build.state.overlay, "menu")
})

test("leaving always goes through the game menu: its q, Enter on Quit, or a click on Quit; only Ctrl+C quits at once", () => {
  const byKey = session()
  keys(byKey, "q")
  assert.equal(byKey.quits, 0, "a bare q quit")
  keys(byKey, "q")
  assert.equal(byKey.quits, 1)

  const byEnter = session()
  keys(byEnter, ESC, DOWN, DOWN, DOWN) // past Settings, Controls and Restart
  assert.equal(GAME_MENU_ROWS[byEnter.build.state.overlayHighlight], "quit")
  keys(byEnter, ENTER)
  assert.equal(byEnter.quits, 1)

  const byClick = session()
  keys(byClick, ESC)
  clickOption(byClick, "q")
  assert.equal(byClick.quits, 1)

  // Up/Down walk the four rows and stop at both ends (they came round until feedback F75); there is no
  // Back row to press (F73) — Esc closes the menu.
  const walk = session()
  keys(walk, ESC, UP)
  assert.equal(GAME_MENU_ROWS[walk.build.state.overlayHighlight], "settings")
  keys(walk, DOWN, DOWN, DOWN, DOWN, DOWN)
  assert.equal(GAME_MENU_ROWS[walk.build.state.overlayHighlight], "quit")
  keys(walk, ESC)
  assert.equal(walk.build.state.overlay, null)
  assert.equal(walk.quits, 0)

  const interrupt = session()
  keys(interrupt, String.fromCharCode(3))
  assert.equal(interrupt.quits, 1)
})

test("[s] opens Settings at the player's settings; Esc goes back to the game menu, then to the game", () => {
  const side = session()
  keys(side, ESC, "s")
  assert.equal(side.build.state.overlay, "settings")
  assert.equal(side.build.state.overlayHighlight, playerRow("theme"))
  assert.deepEqual(side.build.state.overlayUnder, ["menu"])
  const text = screen(side)
  assert.match(text, /YOUR SETTINGS - saved/)
  assert.match(text, /Background\s+<\s+dark\s+>/)
  assert.match(text, /match your terminal's own/, "the highlighted setting does not say what it is for")
  keys(side, ESC)
  assert.equal(side.build.state.overlay, "menu")
  assert.equal(GAME_MENU_ROWS[side.build.state.overlayHighlight], "settings", "back on the row that opened Settings")
  keys(side, ESC)
  assert.equal(side.build.state.overlay, null)
  // `d` still opens Settings straight at the experiments, and Esc then goes back to the game.
  keys(side, "d")
  assert.equal(side.build.state.overlayHighlight, 0)
  keys(side, ESC)
  assert.equal(side.build.state.overlay, null)
  // q inside Settings is the way out: the game menu, not a quit.
  keys(side, "d", "q")
  assert.equal(side.build.state.overlay, "menu")
  assert.equal(side.quits, 0)
})

// --- The player's settings ---------------------------------------------------------------------------

test("a player setting changes at once, is handed to the live loop to save, and survives a restart", () => {
  const side = session()
  keys(side, ESC, "s", RIGHT)
  assert.equal(side.build.state.settings.theme, "light")
  assert.deepEqual(side.saved, [{ ...DEFAULT_SETTINGS, theme: "light" }])
  assert.equal(side.build.state.status.text, "Background: light.")
  // Symbols to unicode: the very next frame draws with them.
  keys(side, DOWN, DOWN, RIGHT)
  assert.equal(side.build.state.settings.glyphPack, "unicode")
  assert.match(screen(side), /[─│┌]/u, "the frame did not switch to Unicode lines")
  // Colour depth walks all four and comes round; Left goes the other way.
  keys(side, UP)
  for (let step = 0; step < 4; step += 1) keys(side, RIGHT)
  assert.equal(side.build.state.settings.capability, DEFAULT_SETTINGS.capability)
  keys(side, LEFT)
  assert.equal(side.build.state.settings.capability, "monochrome")
  assert.match(screen(side), /Colour depth\s+<\s+none\s+>/)
  // Reduced motion flips on Enter.
  keys(side, DOWN, DOWN, ENTER)
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
    while (byKey.build.state.overlayHighlight !== playerRow(spec.field)) keys(byKey, DOWN)
    keys(byKey, RIGHT)
    const byClick = session()
    keys(byClick, ESC, "s")
    const row = placed(byClick).rows.find((entry) => entry.spec.kind === "setting" && entry.spec.label === spec.label)
    assert.ok(row !== undefined, `${spec.label} is not on screen`)
    click(byClick, settingColumns(placed(byClick)).valueTo, row.row)
    assert.deepEqual(byClick.build.state.settings, byKey.build.state.settings, spec.label)
  }
})

// --- The export -------------------------------------------------------------------------------------

test("[e] shows the export in a popup, hands the same text to the adapter, and Esc goes back one popup at a time", () => {
  const context: BuildContext = { ...spikeContext(), buildId: "abc1234", exportDestination: "Copied to the clipboard." }
  const side = session(context)
  keys(side, "d", DOWN, DOWN, RIGHT) // at the experiments, past the focus arrow and the card reveal: a longer hold window
  keys(side, "q", "s", "e")
  assert.equal(side.build.state.overlay, "export")
  assert.equal(side.exports.length, 1)
  assert.equal(side.exports[0], exportText(side.context, side.build.state))
  const text = screen(side)
  assert.match(text, /EXPORT SETTINGS/)
  assert.match(text, /Copied to the clipboard\./)
  assert.match(text, /Terminal Nexus settings/)
  assert.match(text, /# build abc1234/)
  assert.match(text, /# Changed experiments/)
  assert.match(text, /holdWindowMs = 500/)
  // Up/Down walk the text; the window follows.
  for (let line = 0; line < 40; line += 1) keys(side, DOWN)
  assert.match(screen(side), /crew = none/)
  keys(side, ESC)
  assert.equal(side.build.state.overlay, "settings")
  assert.equal(side.build.state.overlayHighlight, SETTINGS_EXPORT_ROW)
  keys(side, ESC)
  assert.equal(side.build.state.overlay, "menu")
  keys(side, ESC)
  assert.equal(side.build.state.overlay, null)
  // The Export row by Enter, and by a click, does the same.
  const byEnter = session()
  keys(byEnter, ESC, "s", END, ENTER) // End goes to the last row: Export (Up came round to it until F75)
  assert.equal(byEnter.build.state.overlay, "export")
  const byClick = session()
  keys(byClick, ESC, "s", END) // the list's last row, in view
  clickOption(byClick, "e")
  assert.equal(byClick.build.state.overlay, "export")
  assert.equal(byClick.exports.length, 1)
})

test("the export lists changed experiments first with their defaults, then the settings, then the rest", () => {
  const snapshot: SettingsSnapshot = {
    settings: { ...DEFAULT_SETTINGS, theme: "light" },
    experiments: { ...defaultExperiments(), crew: "some", raid: "probe", holdWindowMs: 250 },
  }
  const text = formatSettingsExport(snapshot, "592f3cb")
  const lines = text.trimEnd().split("\n")
  assert.equal(lines[0], "Terminal Nexus settings")
  assert.equal(lines[1], "# build 592f3cb")
  assert.equal(lines[2], "# Changed experiments")
  const changedEnd = lines.indexOf("# Settings")
  const changed = lines.slice(3, changedEnd)
  assert.deepEqual(
    changed.map((line) => line.split(" ")[0]),
    DEBUG_FIELDS.map((spec) => spec.field).filter((field) => ["crew", "raid", "holdWindowMs"].includes(field)),
  )
  assert.ok(changed.some((line) => line.startsWith("raid = probe  # Raid, default heavy")))
  assert.ok(changed.some((line) => line.startsWith("crew = some  # Your units, default none")))
  assert.ok(changed.some((line) => line.startsWith("holdWindowMs = 250  # Hold window, default 350 ms")))
  assert.ok(lines.includes("theme = light  # Background"))
  assert.ok(lines.includes("# Experiments at their defaults"))
  assert.equal(lines.length, 2 + 1 + 3 + 1 + PLAYER_FIELDS.length + 1 + (DEBUG_FIELDS.length - 3))
  // With nothing changed it says so, and a build without a commit id says nothing about one.
  const plain = formatSettingsExport({ settings: DEFAULT_SETTINGS, experiments: defaultExperiments() })
  assert.match(plain, /^Terminal Nexus settings\n# Changed experiments: none\n/)
})

// --- Importing it back -------------------------------------------------------------------------------

test("an export read back gives exactly the settings and experiments it was made from", () => {
  const base: SettingsSnapshot = { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() }
  const changed: SettingsSnapshot = {
    settings: { capability: "color256", theme: "light", glyphPack: "unicode", reducedMotion: true },
    experiments: { focusArrowMs: 0, cardRevealMs: 800, holdWindowMs: 250, raid: "none", crew: "some" },
  }
  for (const snapshot of [base, changed]) {
    const result = parseSettingsExport(formatSettingsExport(snapshot, "x"), base)
    assert.deepEqual(result.snapshot, snapshot)
    assert.deepEqual(result.ignored, [])
    assert.equal(result.applied.length, DEBUG_FIELDS.length + PLAYER_FIELDS.length)
  }
})

test("reading is forgiving: unknown names and bad values are skipped, one at a time, and short forms work", () => {
  const base: SettingsSnapshot = { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() }
  const result = parseSettingsExport(
    [
      "some chatter from a pull request comment",
      "raid=probe, holdWindowMs=500ms; cardRevealMs=100ms",
      "retiredFlag = 3  # a flag an older build had",
      "focusArrowMs = 99999  # out of range: keeps its default",
      "crew = sideways",
      "startFocus = map  # as the popup shows it",
      "colours=256 background=light glyphs=unicode reducedMotion=yes",
      "smartCursor = off",
      "placeLight=rainbow scrollMargin=30%  # settled since: skipped without a word",
    ].join("\n"),
    base,
  )
  const { experiments, settings } = result.snapshot
  assert.equal(experiments.raid, "probe")
  assert.equal(experiments.holdWindowMs, 500)
  assert.equal(experiments.cardRevealMs, 100)
  assert.equal(experiments.focusArrowMs, defaultExperiments().focusArrowMs)
  assert.equal(experiments.crew, defaultExperiments().crew)
  assert.deepEqual(settings, { capability: "color256", theme: "light", glyphPack: "unicode", reducedMotion: true })
  // "Opens on" and "Smart cursor" were settled and deleted (feedback F30, F31) before the list of
  // settled names existed: an older export's lines for them are reported like any retired name.
  assert.deepEqual(result.ignored, ["retiredFlag=3", "focusArrowMs=99999", "crew=sideways", "startFocus=map", "smartCursor=off"])
  // The twenty-eight the owner settled on 2026-09-30 are known: skipped quietly, never reported.
  assert.deepEqual(result.settled, ["placeLight", "scrollMargin"])
  // Nothing readable at all is the base, unchanged.
  assert.deepEqual(parseSettingsExport("", base).snapshot, base)
  assert.deepEqual(parseSettingsExport("= = # nothing", base).snapshot, base)
})

/** The owner's settings export of 2026-09-30, word for word (feedback F76): "Many of those settings can
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

test("the owner's export of 2026-09-30 is this build: its Experiments are the defaults, its settled numbers the tuned values", () => {
  const base: SettingsSnapshot = { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() }
  const result = parseSettingsExport(OWNER_EXPORT_2026_09_30, base)
  // Every line is known: nothing is reported as a name the game does not know.
  assert.deepEqual(result.ignored, [])
  assert.deepEqual(result.applied, ["holdWindowMs", "raid", "crew", "theme", "capability", "glyphPack", "reducedMotion", "focusArrowMs"])
  assert.deepEqual(result.snapshot.experiments, defaultExperiments(), "every Experiment he kept is at his value by default")
  // The rest were settled: each skipped quietly, and each number is the tuned value, read not copied.
  assert.deepEqual([...result.settled].sort(), [...SETTLED_EXPERIMENTS].sort())
  const numbers = [...OWNER_EXPORT_2026_09_30.matchAll(/^(\w+) = (\d+) /gmu)]
  let checked = 0
  for (const [, name, value] of numbers) {
    if (name === undefined || !(name in TUNING)) continue
    assert.equal(TUNING[name as keyof typeof TUNING], Number(value), `${name} is not his ${value}`)
    checked += 1
  }
  assert.equal(checked, 21, "every settled number of his was compared")
  // And each default is a value its Experiment's list holds, so Left/Right step from it exactly.
  for (const spec of DEBUG_FIELDS) {
    const value = defaultExperiments()[spec.field]
    assert.ok((spec.values as readonly unknown[]).includes(value), `${spec.field}'s default ${String(value)} is in its list`)
  }
})

test("--settings on the command line: settings over what is saved, and every experiment from the text", () => {
  const saved: Settings = { ...DEFAULT_SETTINGS, capability: "truecolor" }
  assert.deepEqual(importSettings(undefined, saved), { settings: saved })
  const imported = importSettings("theme=light raid=probe", saved)
  assert.deepEqual(imported.settings, { ...saved, theme: "light" })
  assert.deepEqual(imported.experiments, { ...defaultExperiments(), raid: "probe" })
})

test("a Build Phase opened with imported experiments has them, and the playtest script's runner takes both halves", () => {
  const side = session({ ...spikeContext(), experiments: { raid: "probe", holdWindowMs: 500 } })
  assert.equal(side.build.state.debug.raid, "probe")
  assert.equal(side.build.state.debug.holdWindowMs, 500)
  const run = runBuildPlaytest({
    steps: parseKeyScript("d"),
    settings: { ...DEFAULT_SETTINGS, glyphPack: "unicode" },
    experiments: { crew: "some" },
  })
  const last = run.frames[run.frames.length - 1]
  assert.ok(last !== undefined)
  assert.equal(last.state.debug.crew, "some")
  assert.equal(last.state.settings.glyphPack, "unicode")
  assert.match(frameToText(last.frame), /│/u)
})

// --- Same flow, every adapter -----------------------------------------------------------------------

test("the settings flow by keys, by clicks, and from a driver script is the same state, frame and export", () => {
  // Open the game menu, open Settings, set the background to light, go to the experiments and turn the
  // raid to the probe, then export.
  const byKeyboard = session()
  keys(byKeyboard, ESC, "s", RIGHT, ESC, ESC, "d")
  keys(byKeyboard, DOWN, DOWN, DOWN, RIGHT, "e") // past the focus arrow, the card reveal and the hold window

  const byMouse = session()
  const menuHint = escHintSpan(byMouse.layout, escLabel(byMouse.build.state))
  click(byMouse, menuHint.from, menuHint.row)
  clickOption(byMouse, "s")
  const background = placed(byMouse).rows.find((entry) => entry.spec.kind === "setting" && entry.spec.label === "Background")
  assert.ok(background !== undefined)
  click(byMouse, settingColumns(placed(byMouse)).valueTo, background.row)
  // By mouse, the raid's row is reached with the wheel; its value box is the click.
  while (!placed(byMouse).rows.some((entry) => entry.spec.kind === "setting" && entry.spec.label === "Raid")) {
    keys(byMouse, formatMouseEvent(65, placed(byMouse).box.left + 3, placed(byMouse).box.top + 3))
  }
  const raid = placed(byMouse).rows.find((entry) => entry.spec.kind === "setting" && entry.spec.label === "Raid")
  assert.ok(raid !== undefined)
  click(byMouse, settingColumns(placed(byMouse)).valueTo, raid.row)
  // Export settings is the list's last row: the scroll bar's lower half brings it into view.
  while (!placed(byMouse).rows.some((entry) => entry.spec.kind === "option" && entry.spec.hotkey === "e")) {
    const bar = placed(byMouse).scrollBar
    assert.ok(bar !== null, "the list overflows, so it has a scroll bar")
    click(byMouse, bar.column, bar.bottom)
  }
  clickOption(byMouse, "e")

  const script: readonly BuildCommand[] = [
    { kind: "open-menu" },
    { kind: "open-settings", section: "settings" },
    { kind: "setting-adjust", field: "theme", step: 1 },
    { kind: "debug-adjust", field: "raid", step: 1 },
    { kind: "export-settings" },
  ]
  const byDriver = session()
  byDriver.build.run(script)

  for (const side of [byKeyboard, byMouse, byDriver]) {
    assert.equal(side.build.state.overlay, "export")
    assert.equal(side.build.state.settings.theme, "light")
    assert.equal(side.build.state.debug.raid, "probe")
    assert.equal(side.exports.length, 1)
    assert.match(side.exports[0] as string, /raid = probe/)
  }
  assert.equal(byMouse.exports[0], byKeyboard.exports[0])
  assert.equal(byDriver.exports[0], byKeyboard.exports[0])
  // The way back differs by how Settings was reached — so compare what the player has, not the stack.
  const comparable = (side: Side) => ({ ...side.build.state, overlayUnder: [], overlayHighlight: 0, status: null, ack: null })
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
  const running = runSpike({
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
    exporter: { destination: "Sent to the test.", export: (text) => void exported.push(text) },
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
  assert.match(exporter.destination, /clipboard if your terminal allows it, and saved to .*settings-export\.txt\./)
  await exporter.export("theme = light\n")
  assert.equal(readFileSync(path, "utf8"), "theme = light\n")
  assert.ok(stdout.written.includes(osc52("theme = light\n")))
})

test("the experiments' defaults are this build's: a fresh Build Phase exports no changed experiment", () => {
  assert.deepEqual(defaultExperiments(), initialDebugFlags())
  const side = session()
  keys(side, "d", "e")
  assert.match(side.exports[0] as string, /# Changed experiments: none/)
})
