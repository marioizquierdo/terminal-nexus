// Popups (docs/ui-patterns.md, "Popups"): one shape with a shadow; Settings' rows, its position beside
// the title, Export as the list's last row and what the highlighted row is for under a line; a message
// popup for "a restart is needed" and the game menu's Restart; a scroll bar in a popup's right border;
// and the top bar's right end saying what Esc does, in place of every popup's own `[esc]`. Driven through raw bytes into the
// real adapters where an adapter is what is claimed, and through the reducer where the reducer is.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EXPERIMENT_FIELDS, defaultExperiments, stepExperiment } from "../src/build/experiments.ts"
import { buildKeyboardCommand } from "../src/build/keyboard.ts"
import { buildLayout, cellForTile, escLabelSpan, escLabel } from "../src/build/layout.ts"
import { MOUSE_LEFT, MOUSE_WHEEL_DOWN, buildMouseCommand, formatMouseEvent, parseMouseEvent } from "../src/build/mouse.ts"
import { SETTINGS_NOTE_LINES, EXPORT_QUESTION, messageSpec, popupSpec, placePopup } from "../src/build/popup.ts"
import type { PopupSpec } from "../src/build/popup.ts"
import { controlsLineCount } from "../src/build/help.ts"
import {
  GAME_MENU_ROWS,
  PLAYER_FIELDS,
  SETTINGS_EXPORT_ROW,
  SETTINGS_ROWS,
  pendingRestart,
  playerRow,
  restartMessage,
} from "../src/build/settings.ts"
import type { RestartFieldSpec } from "../src/build/settings.ts"
import type { BuildContext, BuildState } from "../src/build/state.ts"
import { applyBuildCommand, createBuildState } from "../src/build/state.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import {
  DOWN,
  END,
  ENTER,
  ESC,
  MAXIMUM,
  MINIMUM,
  OPEN_GROUND,
  UP,
  WIDE,
  buildSide,
  clickCell,
  clickPopupOption,
  compose,
  goToGameMenuRow,
  keys,
  placed,
  screenText,
} from "./build-helpers.ts"
import type { Side } from "./build-helpers.ts"

const SIZES = [MINIMUM, MAXIMUM, WIDE]

/** The top bar's Esc label as drawn now, and where. */
function escLabelEnd(side: Side): Readonly<{ label: string; row: number; from: number; to: number }> {
  const label = escLabel(side.build.state)
  return { label, ...escLabelSpan(side.layout, label) }
}

// --- One shape ----------------------------------------------------------------------------------------

test("a popup's shadow is a dim shade, visible on the dark theme's near-black ground", () => {
  const side = buildSide()
  keys(side, "n")
  const frame = compose(side)
  const text = frameToText(frame).split("\n")
  // The shade runs along the popup's bottom edge, one row below it.
  const shadowRow = text.findIndex((line) => line.includes("::::::::::"))
  assert.ok(shadowRow > 0, "no shadow row under the popup")
  const column = (text[shadowRow] as string).indexOf("::::::::::")
  assert.equal(cellAt(frame, column, shadowRow).style.dim, true)
})

// --- Settings: no column, a position, Export in the list, the description under a line ------------

test("a setting row is its name, and its value between < and > at the right — nothing else", () => {
  const side = buildSide()
  keys(side, ESC, "s")
  const popup = placed(side)
  const lines = screenText(side).split("\n")
  const settingRows = popup.rows.flatMap((row) => (row.spec.kind === "setting" ? [{ row: row.row, label: row.spec.label }] : []))
  assert.ok(settingRows.length > 0)
  for (const { row, label } of settingRows) {
    const inside = (lines[row] ?? "").slice(popup.box.left + 1, popup.box.right)
    assert.match(inside, new RegExp(`^ +${label} +< +[^<>]+ +> *$`), label)
  }
  assert.match(lines.join("\n"), /Background\s+<\s+dark\s+> /)
})

test("the title says where the highlight is in the list, (k/N), and follows it", () => {
  const side = buildSide()
  keys(side, ESC, "s")
  const count = SETTINGS_ROWS.length
  assert.equal(count, PLAYER_FIELDS.length + EXPERIMENT_FIELDS.length + 1, "every setting, every experiment, and Export")
  assert.match(screenText(side), new RegExp(`SETTINGS \\(1/${count}\\)`))
  keys(side, DOWN, DOWN)
  assert.match(screenText(side), new RegExp(`SETTINGS \\(3/${count}\\)`))
  keys(side, UP, UP)
  assert.match(screenText(side), new RegExp(`SETTINGS \\(1/${count}\\)`))
  keys(side, END) // the fast move goes to the last row: Export
  assert.equal(side.build.state.popupHighlight, SETTINGS_EXPORT_ROW)
  assert.match(screenText(side), new RegExp(`SETTINGS \\(${count}/${count}\\)`))
  // `d` opens at the experiments, which the count says too.
  const experiments = buildSide()
  keys(experiments, "d")
  assert.match(screenText(experiments), new RegExp(`SETTINGS \\(${PLAYER_FIELDS.length + 1}/${count}\\)`))
})

test("Export settings is the scrolling list's last row: no fixed rows, no 'more' lines, and e still exports", () => {
  const side = buildSide()
  keys(side, ESC, "s")
  const spec = popupSpec(side.context, side.build.state)
  assert.ok(spec !== null && spec.scroll !== undefined)
  const last = spec.rows[spec.scroll.to - 1]
  assert.ok(last !== undefined && last.kind === "option" && last.hotkey === "e" && last.label === "Export settings")
  assert.equal(spec.rows.filter((row) => row.kind === "option").length, 1, "no fixed [r] or [e] rows")
  assert.doesNotMatch(screenText(side), /more/)
  // Its hotkey works from anywhere in the list, and Enter on the row does the same.
  keys(side, "e")
  assert.equal(side.build.state.popup, "export")
  const byEnter = buildSide()
  keys(byEnter, ESC, "s", END, ENTER)
  assert.equal(byEnter.build.state.popup, "export")
  // Highlighted, it is drawn as the keyboard's bar and what it is for is written underneath.
  const shown = buildSide()
  keys(shown, ESC, "s", END)
  const row = placed(shown).rows.find((entry) => entry.spec.kind === "option")
  assert.ok(row !== undefined && row.spec.kind === "option" && row.spec.highlighted === true)
  assert.ok(screenText(shown).includes("Shows every setting and experiment as"))
  assert.ok(EXPORT_QUESTION.startsWith("Shows every setting"))
})

test("under the list, a line across the popup, then what the highlighted row is for", () => {
  for (const pack of ["ascii", "unicode"] as const) {
    const side = buildSide()
    keys(side, ESC, "s")
    const popup = placed(side)
    const ruleAt = popup.rows.findIndex((row) => row.spec.kind === "rule")
    assert.ok(ruleAt > 0, "no line under the list")
    // Directly under the list's last shown row, and directly over the description's lines.
    assert.equal(popup.rows[ruleAt - 1]?.spec.kind, "setting")
    const notes = popup.rows.slice(ruleAt + 1)
    assert.equal(notes.length, SETTINGS_NOTE_LINES)
    assert.ok(notes.every((row) => row.spec.kind === "note"))
    assert.match(notes[0]?.text ?? "", /^Dark or light/)
    // Drawn border to border inside the frame.
    const frame = compose(side, { glyphPack: pack })
    const line = pack === "ascii" ? "-" : "─"
    const rule = popup.rows[ruleAt] as (typeof popup.rows)[number]
    for (let x = popup.box.left + 1; x < popup.box.right; x += 1) assert.equal(cellAt(frame, x, rule.row).glyph, line, `${pack} at ${x}`)
    // The description follows the highlight.
    keys(side, DOWN)
    assert.match(placed(side).rows.find((row) => row.spec.kind === "note")?.text ?? "", /^How many colours/)
  }
})

// --- A restart that is needed, and the game menu's Restart ----------------------------------------

test("pendingRestart names the changed settings marked restart, and nothing else", () => {
  const started = defaultExperiments()
  const fields: readonly RestartFieldSpec[] = [
    { field: "focusArrowMs", label: "Focus arrow", applies: "restart" },
    { field: "cardRevealMs", label: "Card reveal", applies: "restart" },
    { field: "raid", label: "Raid", applies: "now" },
  ]
  assert.deepEqual(pendingRestart(started, started, fields), [])
  assert.deepEqual(pendingRestart(started, { ...started, raid: "probe" }, fields), [], "a setting that applies now")
  assert.deepEqual(pendingRestart(started, { ...started, focusArrowMs: 0 }, fields), ["Focus arrow"])
  assert.deepEqual(pendingRestart(started, { ...started, focusArrowMs: 0, cardRevealMs: 0 }, fields), ["Focus arrow", "Card reveal"])
  // Put back, it is not pending any more.
  assert.deepEqual(pendingRestart(started, { ...started }, fields), [])
  // The build's own list: exactly its restart fields, whichever they are today.
  const restartFields = EXPERIMENT_FIELDS.filter((spec) => spec.applies === "restart")
  assert.deepEqual(pendingRestart(started, started), [])
  for (const spec of restartFields) {
    const other = (spec.values as readonly unknown[]).find((value) => value !== started[spec.field])
    assert.deepEqual(pendingRestart(started, { ...started, [spec.field]: other }), [spec.label])
  }
  const message = restartMessage(["Focus arrow", "Card reveal"])
  assert.equal(message.title, "RESTART NEEDED")
  assert.match(message.text, /apply only after a restart: Focus arrow, Card reveal\. Choose \[r\] Restart in the menu/)
})

test("closing Settings with a restart setting changed raises the message once; Esc gives the game menu back on Restart", (t) => {
  const field = EXPERIMENT_FIELDS.find((spec) => spec.applies === "restart")
  if (field === undefined) {
    // No experiment needs a restart in this build: the pure function above holds the mechanism.
    t.diagnostic("no restart experiment in this build")
    return
  }
  const side = buildSide()
  keys(side, ESC, "s")
  side.build.dispatch({ kind: "experiment-adjust", field: field.field, step: 1 })
  assert.match(side.build.state.status.text, /applies after a restart/)
  assert.equal(side.build.state.popup, "settings", "no message while Settings is open")
  keys(side, ESC)
  assert.equal(side.build.state.popup, "message")
  assert.deepEqual(side.build.state.popupUnder.map((level) => level.popup), ["game-menu"])
  assert.ok(screenText(side).includes("RESTART NEEDED"))
  keys(side, ESC)
  assert.equal(side.build.state.popup, "game-menu")
  assert.equal(GAME_MENU_ROWS[side.build.state.popupHighlight], "restart")
  // Once: Settings opened and closed again says nothing more.
  keys(side, "s", ESC)
  assert.equal(side.build.state.popup, "game-menu")
  // A change put back says nothing at all.
  const back = buildSide()
  keys(back, "d")
  back.build.dispatch({ kind: "experiment-adjust", field: field.field, step: 1 })
  back.build.dispatch({ kind: "experiment-adjust", field: field.field, step: -1 })
  keys(back, ESC)
  assert.equal(back.build.state.popup, null)
  // The restart itself leaves nothing pending.
  keys(side, "r")
  assert.equal(side.build.state.popup, null)
  assert.deepEqual(pendingRestart(side.build.state.startExperiments, side.build.state.experiments), [])
})

/** A state with a message popup open over `under`, as the reducer raises one. */
function withMessage(context: BuildContext, under: "game-menu" | null): BuildState {
  const base = createBuildState(context, OPEN_GROUND, buildLayout(MINIMUM, context.grid).viewport)
  return {
    ...base,
    popup: "message",
    message: restartMessage(["Opens on"]),
    popupUnder: under === null ? [] : [{ popup: under, highlight: GAME_MENU_ROWS.indexOf("restart") }],
  }
}

test("a message popup: a title and its text, nothing to choose, closed by Esc or a click outside and nothing else", () => {
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const state = withMessage(context, null)
  // Its shape: a title, and text wrapped in as many lines as it needs — no option anywhere.
  const spec = popupSpec(context, state) as PopupSpec
  assert.deepEqual(spec, messageSpec(restartMessage(["Opens on"])))
  assert.equal(spec.rows.some((row) => row.kind === "option"), false)
  const popup = placePopup(layout, spec)
  const text = popup.rows.filter((row) => row.spec.kind === "note").map((row) => row.text).join(" ")
  assert.equal(text, restartMessage(["Opens on"]).text, "the whole text, wrapped at words, nothing dropped")
  const drawn = frameToText(composeBuildFrame({ context, state, layout }, "monochrome"))
  assert.match(drawn, /Read it, then \[esc\] or a click outside closes it\./, "the bottom line names the ways to close it")

  // The keyboard: Esc and x close it (x as `back`, which is Esc's walk back in a popup — feedback
  // F62); nothing else reaches it or anything under it.
  const keyboard = { itemCount: 3, armed: false, focus: "menu" as const, popup: "message" as const }
  assert.deepEqual(buildKeyboardCommand(ESC, keyboard), { kind: "cancel" })
  assert.deepEqual(buildKeyboardCommand("x", keyboard), { kind: "back" })
  assert.equal(applyBuildCommand(context, state, { kind: "back" }).popup, null)
  for (const key of [ENTER, " ", "q", "r", "s", "e", "1", "n", "p", UP, DOWN]) {
    assert.equal(buildKeyboardCommand(key, keyboard), null, JSON.stringify(key))
  }
  const closed = applyBuildCommand(context, state, { kind: "cancel" })
  assert.equal(closed.popup, null)
  assert.equal(closed.message, null)
  // Over the game menu, Esc goes back to it, on its Restart row.
  const overMenu = applyBuildCommand(context, withMessage(context, "game-menu"), { kind: "cancel" })
  assert.equal(overMenu.popup, "game-menu")
  assert.equal(GAME_MENU_ROWS[overMenu.popupHighlight], "restart")

  // The mouse: a click inside does nothing; the wheel does nothing; a click outside closes it and moves
  // focus where it landed, and nothing more.
  const ui = { popup: popup, escLabel: escLabel(state) }
  const inside = parseMouseEvent(formatMouseEvent(MOUSE_LEFT, popup.textColumn + 3, (popup.rows[1]?.row ?? 0) + 1))
  assert.ok(inside !== null)
  assert.equal(buildMouseCommand(inside, state.camera, layout, context.catalog, ui), null)
  const wheel = parseMouseEvent(formatMouseEvent(MOUSE_WHEEL_DOWN, popup.textColumn + 3, popup.box.top + 3))
  assert.ok(wheel !== null)
  const wheeled = buildMouseCommand(wheel, state.camera, layout, context.catalog, ui)
  assert.ok(wheeled !== null)
  assert.deepEqual(applyBuildCommand(context, state, wheeled), state, "the wheel changed something")
  const cell = cellForTile(layout, state.camera, { x: 20, y: 17 })
  const outside = parseMouseEvent(formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1))
  assert.ok(outside !== null)
  const command = buildMouseCommand(outside, state.camera, layout, context.catalog, ui)
  assert.deepEqual(command, { kind: "click-tile", x: 20, y: 17 })
  const dismissed = applyBuildCommand(context, state, command as BuildCommand)
  assert.equal(dismissed.popup, null)
  assert.equal(dismissed.message, null)
  assert.equal(dismissed.focus, "grid")
  assert.equal(dismissed.planned.length, 0)
})

test("the game menu's Restart: r, Enter on its row, and a click on it start the Build Phase over, keeping every setting", () => {
  const plan = (side: Side): void => {
    keys(side, "n", "1", "1", ENTER) // pick a power, plan a Barracks
    side.build.dispatch({ kind: "experiment-adjust", field: "raid", step: 1 })
    side.build.dispatch({ kind: "setting-adjust", field: "theme", step: 1 })
    assert.equal(side.build.state.planned.length, 1)
  }
  const byKey = buildSide()
  plan(byKey)
  keys(byKey, ESC)
  assert.equal(byKey.build.state.popup, "game-menu")
  keys(byKey, "r")
  const byEnter = buildSide()
  plan(byEnter)
  keys(byEnter, "q")
  goToGameMenuRow(byEnter, "restart")
  keys(byEnter, ENTER)
  const byClick = buildSide()
  plan(byClick)
  const hint = escLabelEnd(byClick)
  clickCell(byClick, hint.from, hint.row)
  clickPopupOption(byClick, "r")
  const byDriver = buildSide()
  plan(byDriver)
  byDriver.build.run([{ kind: "open-game-menu" }, { kind: "restart" }])

  const expected = byKey.build.state
  assert.equal(expected.popup, null)
  assert.equal(expected.planned.length, 0)
  assert.equal(expected.nexusPick, null)
  assert.equal(expected.experiments.raid, stepExperiment(defaultExperiments(), "raid", 1).flags.raid)
  assert.equal(expected.settings.theme, "light")
  assert.equal(expected.status.text, "Build Phase restarted with these settings.")
  const comparable = (side: Side) => ({ ...side.build.state, ack: null, highlightHidden: false })
  for (const side of [byEnter, byClick, byDriver]) assert.deepEqual(comparable(side), comparable(byKey))
  assert.equal(byKey.quits() + byEnter.quits() + byClick.quits() + byDriver.quits(), 0)
  // Settings has no restart of its own any more.
  const settings = buildSide()
  keys(settings, "d", "r")
  assert.equal(settings.build.state.popup, "settings")
})

// --- The scroll bar ---------------------------------------------------------------------------------

test("a list that overflows has a scroll bar in the popup's right border, drawn from the placed shape, in every glyph pack", () => {
  // Settings and the Controls page at every size: each overflows or fits whole, and only one that
  // overflows has a bar. The Controls page always overflows, so there is always a bar to check.
  let bars = 0
  for (const open of [[ESC, "s"], ["?"]]) {
    for (const size of SIZES) {
      for (const pack of ["ascii", "unicode"] as const) {
        const side = buildSide({ terminal: size })
        keys(side, ...open)
        const popup = placed(side)
        const bar = popup.scrollBar
        const where = `${JSON.stringify(open)} at ${size.columns}x${size.rows}`
        assert.ok(popup.window !== null)
        if (popup.window.visible === popup.window.count) {
          assert.equal(bar, null, `a scroll bar over a list that fits, ${where}`)
          continue
        }
        assert.ok(bar !== null, `no scroll bar, ${where}`)
        bars += 1
        assert.equal(bar.column, popup.box.right, "the bar is the right border")
        const listed = popup.rows.filter((row) => row.spec.kind !== "rule" && row.spec.kind !== "note")
        assert.equal(bar.top, listed[0]?.row, "the bar starts beside the list's first shown row")
        assert.equal(bar.bottom, listed[listed.length - 1]?.row, "and ends beside its last")
        const frame = compose(side, { glyphPack: pack })
        const [up, down, track] = pack === "ascii" ? ["^", "v", ":"] : ["▲", "▼", "░"]
        assert.equal(cellAt(frame, bar.column, bar.top).glyph, up)
        assert.equal(cellAt(frame, bar.column, bar.bottom).glyph, down)
        assert.equal(cellAt(frame, bar.column, bar.top).style.inverse, true, "drawn as part of the border")
        for (let y = bar.top + 1; y < bar.bottom; y += 1) {
          const thumb: boolean = y >= bar.thumbTop && y <= bar.thumbBottom
          assert.equal(cellAt(frame, bar.column, y).glyph, thumb ? " " : track, `row ${y}`)
        }
        // Outside the list, the border is the plain border.
        assert.equal(cellAt(frame, bar.column, bar.bottom + 1).glyph, " ")
        assert.equal(cellAt(frame, bar.column, bar.top - 1).glyph, " ")
      }
    }
  }
  assert.ok(bars > 0, "no list overflowed: the test proves nothing")
})

test("no scroll bar where nothing is hidden: a short list, and a popup without one", () => {
  const side = buildSide()
  const shortList: PopupSpec = {
    title: "SHORT",
    rows: [
      { kind: "text", text: "one" },
      { kind: "text", text: "two" },
      { kind: "text", text: "three" },
    ],
    scroll: { from: 0, to: 3, highlight: 0, select: () => ({ kind: "cancel" }) },
  }
  assert.equal(placePopup(side.layout, shortList).scrollBar, null)
  keys(side, "n")
  assert.equal(placed(side).scrollBar, null)
  const frame = compose(side)
  const popup = placed(side)
  for (let y = popup.box.top + 1; y < popup.box.bottom; y += 1) assert.equal(cellAt(frame, popup.box.right, y).glyph, " ")
})

test("a click on the scroll bar's upper half scrolls up, on its lower half down; its ends do nothing past the list's ends", () => {
  // On the Controls page, the longest list.
  const side = buildSide()
  keys(side, "?")
  const start = placed(side)
  assert.ok(start.scrollBar !== null && start.window !== null)
  assert.equal(start.window.offset, 0)
  // At the top, the upper half has nowhere to go.
  clickCell(side, start.scrollBar.column, start.scrollBar.top)
  assert.equal(placed(side).window?.offset, 0)
  assert.equal(side.build.state.popupHighlight, 0)
  // The lower half — its down symbol, or any cell below the middle — brings the next hidden rows in.
  clickCell(side, start.scrollBar.column, start.scrollBar.bottom)
  const down = placed(side)
  assert.ok(down.window !== null && down.window.offset > 0, "a click on the down symbol did not scroll")
  assert.ok(down.scrollBar !== null && down.scrollBar.thumbTop > (start.scrollBar.thumbTop ?? 0), "the thumb did not move down")
  const middle = Math.floor((down.scrollBar.top + down.scrollBar.bottom + 1) / 2)
  clickCell(side, down.scrollBar.column, middle + 1)
  const further = placed(side)
  assert.ok(further.window !== null && further.window.offset > down.window.offset, "a click low on the track did not scroll")
  // The upper half scrolls back.
  clickCell(side, further.scrollBar?.column ?? 0, (further.scrollBar?.top ?? 0) + 1)
  assert.ok((placed(side).window?.offset ?? 0) < further.window.offset, "a click high on the track did not scroll up")
  // All the way down: the lower half then does nothing more.
  for (let turn = 0; turn < controlsLineCount(); turn += 1) {
    const bar = placed(side).scrollBar
    if (bar === null) break
    clickCell(side, bar.column, bar.bottom)
  }
  const end = placed(side)
  assert.ok(end.window !== null && end.window.offset + end.window.visible === end.window.count, "never reached the end")
  const before = side.build.state
  clickCell(side, end.scrollBar?.column ?? 0, end.scrollBar?.bottom ?? 0)
  assert.deepEqual(side.build.state, before)
  // The wheel still walks the highlight one row at a time.
  const wheel = buildSide()
  keys(wheel, ESC, "s")
  clickCell(wheel, placed(wheel).box.left + 3, placed(wheel).box.top + 3, MOUSE_WHEEL_DOWN)
  assert.equal(wheel.build.state.popupHighlight, playerRow("capability"))
})

test("hit-testing the scroll bar reads the same placement the frame draws: every bar cell answers, the cell beside it does not", () => {
  // On the Controls page, long enough to scroll at every size.
  const middle = ["?", ...Array.from({ length: 20 }, () => DOWN)] // somewhere in the middle
  for (const size of SIZES) {
    const side = buildSide({ terminal: size })
    keys(side, ...middle)
    const popup = placed(side)
    const bar = popup.scrollBar
    assert.ok(bar !== null && popup.window !== null)
    const frame = compose(side)
    for (let y = bar.top; y <= bar.bottom; y += 1) {
      assert.equal(cellAt(frame, bar.column, y).style.inverse, true)
      const probe = buildSide({ terminal: size })
      keys(probe, ...middle)
      const before = placed(probe).window?.offset ?? 0
      clickCell(probe, bar.column, y)
      const after = placed(probe).window?.offset ?? 0
      const upper = (y - bar.top) * 2 < bar.bottom - bar.top + 1
      if (upper) assert.ok(after < before || before === 0, `row ${y} is the upper half`)
      else assert.ok(after > before, `row ${y} is the lower half`)
    }
  }
})

// --- The top bar's Esc label -------------------------------------------------------------------------

test("the top bar's right end says what Esc does: menu, back, close", () => {
  const cases: ReadonlyArray<readonly [string, readonly string[], string]> = [
    ["the menu", [], "menu [esc]"],
    ["Explore Map", ["e"], "back [esc]"],
    ["placing", ["1"], "back [esc]"],
    ["the map a click opened", ["click-map"], "back [esc]"],
    ["the Nexus popup", ["n"], "close [esc]"],
    ["the game menu", [ESC], "close [esc]"],
    ["Settings", ["d"], "close [esc]"],
    ["the start-the-Pulse question", ["n", "1", "p"], "close [esc]"],
    ["a committed Build Phase", ["n", "1", "p", "y"], "menu [esc]"],
  ]
  for (const size of SIZES) {
    for (const [name, steps, label] of cases) {
      const side = buildSide({ terminal: size })
      for (const step of steps) {
        if (step === "click-map") {
          const cell = cellForTile(side.layout, side.build.state.camera, { x: 20, y: 15 })
          clickCell(side, cell.x, cell.y)
        } else keys(side, step)
      }
      const hint = escLabelEnd(side)
      assert.equal(hint.label, label, name)
      const line = screenText(side).split("\n")[hint.row] ?? ""
      assert.equal(line.slice(hint.from, hint.to + 1), label, `${name} at ${size.columns}x${size.rows}`)
      assert.equal(hint.to, side.layout.escLabelEnd.to, "right-aligned")
      // The key is in the hotkey colour; the name is quiet.
      const frame = composeBuildFrame({ context: side.context, state: side.build.state, layout: side.layout }, "truecolor")
      assert.equal(cellAt(frame, hint.to - 1, hint.row).style.fgRole, "chrome.hotkey")
      assert.equal(cellAt(frame, hint.from, hint.row).style.fgRole, "chrome.muted")
    }
  }
})

test("a click on the top bar's Esc label is Esc: the same state, whatever is open", () => {
  const openings: readonly (readonly string[])[] = [
    [],
    ["e"],
    ["1"],
    ["n"],
    [ESC],
    [ESC, "s"], // Settings over the game menu: back one level, not everything closed
    ["d", "e"], // the export over Settings
    ["n", "1", "p"],
    ["n", "1", "p", "y"],
  ]
  for (const steps of openings) {
    const byKey = buildSide()
    keys(byKey, ...steps, ESC)
    const byClick = buildSide()
    keys(byClick, ...steps)
    const hint = escLabelEnd(byClick)
    for (const column of [hint.from, hint.to]) {
      const again = buildSide()
      keys(again, ...steps)
      clickCell(again, column, hint.row)
      assert.deepEqual(again.build.state, byKey.build.state, `${JSON.stringify(steps)}, column ${column}`)
    }
    // With no popup open, just left of the label is the plain top bar: nothing happens. (With one
    // open, it is a click outside the popup, which closes it like any other.)
    if (byClick.build.state.popup !== null) continue
    const beside = buildSide()
    keys(beside, ...steps)
    const before = beside.build.state
    clickCell(beside, hint.from - 2, hint.row)
    assert.deepEqual(beside.build.state, before, `${JSON.stringify(steps)}: a click beside the label did something`)
  }
})

test("no popup carries [esc] in its border, and its corner is no click target", () => {
  const openings: readonly (readonly string[])[] = [["n"], [ESC], ["d"], ["d", "e"], ["n", "1", "p"]]
  for (const steps of openings) {
    const side = buildSide()
    keys(side, ...steps)
    const popup = placed(side)
    const top = (screenText(side).split("\n")[popup.box.top] ?? "").slice(popup.box.left, popup.box.right + 1)
    assert.doesNotMatch(top, /\[esc\]/, JSON.stringify(steps))
    // And its corner is not a click target: a click there is inside the popup and does nothing.
    const before = side.build.state
    clickCell(side, popup.box.right - 3, popup.box.top)
    assert.deepEqual(side.build.state, before, `${JSON.stringify(steps)}: a click on the popup's corner did something`)
  }
  // The message popup too.
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const state = withMessage(context, null)
  const popup = placePopup(layout, popupSpec(context, state) as PopupSpec)
  const drawn = frameToText(composeBuildFrame({ context, state, layout }, "monochrome")).split("\n")
  assert.doesNotMatch((drawn[popup.box.top] ?? "").slice(popup.box.left, popup.box.right + 1), /\[esc\]/)
  assert.match(drawn[layout.escLabelEnd.row] ?? "", /close \[esc\] /)
})
