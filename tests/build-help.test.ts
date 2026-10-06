// How the Build Phase documents itself since the owner's menu playtest (2026-09-30): one
// row at the bottom of the screen — the last command's answer, and otherwise a hint for where the
// keyboard is — and a Controls and hotkeys page in the game menu. Driven through the real session (raw
// keys and clicks into the adapters) where an adapter is what is being claimed, and through commands
// where the reducer is.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { isGated } from "../src/build/camera.ts"
import { CONTROLS_KEYS_WIDTH, CONTROLS_TITLE, HINTS, bottomLine, controlsLineCount, controlsPage, hint, hintSituation } from "../src/build/help.ts"
import type { HintSituation } from "../src/build/help.ts"
import { buildKeyboardCommand } from "../src/build/keyboard.ts"
import { MOUSE_WHEEL_DOWN } from "../src/build/mouse.ts"
import { CONTROLS_DESCRIPTION, GAME_MENU_ROWS, restartMessage } from "../src/build/settings.ts"
import type { BuildState } from "../src/build/state.ts"
import { NEXUS_ENTRY, armedPreview } from "../src/build/state.ts"
import { defaultValue } from "../src/build/all-settings.ts"
import { cellAt } from "../src/view/frame.ts"
import { statusStyle } from "../src/view/status.ts"
import {
  BACKSPACE,
  DOWN,
  ENTER,
  ESC,
  MAXIMUM,
  MINIMUM,
  PAGE_DOWN,
  ROOMY,
  TAB,
  UP,
  WIDE,
  bottomLineText,
  buildSide,
  clickCell,
  clickEscLabel,
  clickPopupOption,
  compose,
  goToGameMenuRow,
  keys,
  placed,
  screenText,
} from "./build-helpers.ts"
import type { Side } from "./build-helpers.ts"
import { DEFENCE, at, play } from "./pulse-helpers.ts"

const SIZES = [MINIMUM, MAXIMUM, WIDE, ROOMY]

/** What the bottom row says, as a typed message: the answer or the hint. */
function line(side: Side) {
  return bottomLine(side.context, side.build.state, armedPreview(side.context, side.build.state))
}

/** A command that says nothing and changes nothing: whatever the last command answered lapses. */
function silence(side: Side): void {
  side.build.dispatch({ kind: "focus", target: side.build.state.focus })
}

// --- One row ---------------------------------------------------------------------------------------

test("the bottom bar is one row, and 80 x 24 shows 49 x 18 tiles of Grid; the floor stays 80 x 24", () => {
  // The owner (2026-09-30): "The bottom of the UI currently uses 3 rows. We have to reduce
  // that to 1 row." The rule under the Grid and one line; the two rows saved go to the Grid.
  const side = buildSide()
  const { layout } = side
  assert.deepEqual(layout.viewport, { width: 49, height: 18 })
  const lines = screenText(side).split("\n")
  assert.equal(lines.length, 24)
  assert.equal(layout.footerRow, lines.length - 2, "the one line is not directly above the frame's bottom border")
  assert.match(lines[23] as string, /^\+-+\+$/, "the frame's border closes directly under the one line")
  // The floor does not move with it: 80 x 23 is still below it.
  assert.equal(isGated({ columns: 80, rows: 24 }, side.context.grid), false)
  assert.equal(isGated({ columns: 80, rows: 23 }, side.context.grid), true)
})

test("the bottom line shows a command's answer, and after a command that says nothing, the hint", () => {
  const side = buildSide()
  keys(side, "1", ENTER)
  assert.equal(bottomLineText(side), "Barracks placed (resources: 60) - [u] undo")
  assert.equal(line(side).tone, "success")
  keys(side, DOWN) // says nothing: the answer lapses
  assert.equal(side.build.state.status.text, "")
  assert.equal(bottomLineText(side), "Hatchery - Spawns swarmers. Costs 30. [enter] to place one.")
  assert.equal(line(side).tone, "hint")
  // The hint reads quieter than any answer.
  assert.equal(statusStyle("hint").role, "chrome.muted")
  assert.equal(cellAt(compose(side), side.layout.offset.column + 2, side.layout.footerRow).style.fgRole, "chrome.muted")
})

test("the answers players rely on still show right after their command, and lapse at the next silent one", () => {
  const cases: ReadonlyArray<readonly [name: string, drive: (side: Side) => void, text: RegExp, tone?: string]> = [
    ["a placement", (side) => keys(side, "1", ENTER), /^Barracks placed \(resources: 60\) - \[u\] undo$/, "success"],
    ["a pick", (side) => keys(side, "n", "1"), /^Reserve Fund picked\.$/, "success"],
    ["undo", (side) => keys(side, "1", ENTER, "u"), /^Barracks undone, 40 back\.$/],
    ["remove", (side) => keys(side, TAB, "1", ENTER, BACKSPACE), /^Barracks removed, 40 back\.$/],
    ["cancel", (side) => keys(side, "1", ESC), /^Cancelled\.$/],
    ["restart", (side) => keys(side, ESC, "r"), /^Build Phase restarted with these settings\.$/],
    // A Nexus power left unpicked holds nothing back: the Battle Round screen opens.
    ["Start Battle Round with a power waiting", (side) => keys(side, "s"), /^Battle Round 1: Enter starts it, Esc goes back\.$/],
    ["a key refused while a building is armed", (side) => keys(side, "1", "s"), /^Place the Barracks or cancel it first: \[1\] or \[esc\]\.$/, "warning"],
  ]
  for (const [name, drive, text, tone] of cases) {
    const side = buildSide()
    drive(side)
    assert.match(line(side).text, text, name)
    assert.match(bottomLineText(side), text, `${name}: not drawn`)
    assert.equal(line(side).tone, tone, `${name}: its tone`)
    silence(side)
    assert.equal(side.build.state.status.text, "", `${name}: outlived a command that said nothing`)
    assert.equal(line(side).tone, "hint", `${name}: the hint did not come back`)
  }
})

test("a refused placement is said in red with its tile, then — lapsed — quietly, while the ghost still sits there", () => {
  const side = buildSide()
  keys(side, TAB, "1") // on the map: the Barracks armed where the cursor is
  side.build.dispatch({ kind: "look-at", x: STARTER_START_CURSOR.x, y: STARTER_START_CURSOR.y }) // onto the Grid Nexus
  keys(side, ENTER)
  const tried = line(side)
  assert.match(tried.text, /^Cannot build here: the nexus is here at \d+,\d+\.$/)
  assert.equal(tried.tone, "danger")
  assert.deepEqual(side.build.state.status.tile, side.build.state.cursor)
  assert.match(bottomLineText(side), /^Cannot build here: the nexus is here/)
  silence(side)
  const looking = line(side)
  assert.equal(looking.text, tried.text, "the ghost still sits on a refused tile, so the line still says why")
  assert.equal(looking.tone, undefined, "a lapsed attempt reads as looking, not trying")
})

// --- A hint for every situation --------------------------------------------------------------------

/** A state in the situation, and what its hint says. Every situation `hint` lists is here — a
 *  `Record` over the type, so a new situation without a case here does not compile. A drive that
 *  returns a state stands for one no key reaches today. */
type Drive = (side: Side) => BuildState | void
const SITUATIONS: Readonly<Record<HintSituation, readonly (readonly [drive: Drive, says: RegExp])[]>> = {
  "nexus-powers": [
    [(side) => keys(side, "n"), /^Pick one: up\/down and \[enter\], or its number\. \[esc\] closes without a pick\.$/],
    [(side) => keys(side, "n", "1", "n"), /^The Nexus powers you have\. \[esc\] closes\.$/],
  ],
  "battle-round": [[(side) => keys(side, "n", "1", "s"), /^Battle round 1: \[enter\] or \[s\] starts it, \[esc\] goes back to the plan\.$/]],
  "game-menu": [[(side) => keys(side, ESC), /^Up\/down and \[enter\] choose, or press a row's key\. \[esc\] back to the game\.$/]],
  settings: [
    [(side) => keys(side, "d"), /^Left\/right change a value, \[e\] exports them all\. \[esc\] closes\.$/],
    [(side) => keys(side, ESC, "s"), /^Left\/right change a value, \[e\] exports them all\. \[esc\] goes back\.$/],
  ],
  export: [[(side) => keys(side, "d", "e"), /^Paste this into the pull request\. Up\/down scroll\. \[esc\] goes back\.$/]],
  message: [
    [
      // No Experiment needs a restart today, so the message is put up by hand, as the popups tests do.
      (side) => ({ ...side.build.state, popup: "message", message: restartMessage(["Opens on"]) }),
      /^Read it, then \[esc\] or a click outside closes it\.$/,
    ],
  ],
  controls: [
    [(side) => keys(side, "?"), /^Every key and click, by where you are\. Up\/down scroll\. \[esc\] closes\.$/],
    [(side) => keys(side, ESC, "c"), /^Every key and click, by where you are\. Up\/down scroll\. \[esc\] goes back\.$/],
  ],
  "activity-logs": [
    [(side) => keys(side, ESC, "a"), /^Left\/right change the filter, \[e\] exports, up\/down read\. \[esc\] goes back\.$/],
    [(side) => side.build.run([{ kind: "open-activity-logs" }]), /^Left\/right change the filter, \[e\] exports, up\/down read\. \[esc\] closes\.$/],
  ],
  // PERIMETER's intro, its first and last lines: these sessions play no scenes, so the dialog is put up by
  // hand on the round's own scene (tests/dialog.test.ts plays it).
  dialog: [
    [(side) => ({ ...side.build.state, popup: "dialog", dialog: { line: 0, cursor: side.build.state.cursor, camera: side.build.state.camera } }), /^Line 1 of 4\. \[enter\] next line, \[esc\] skips the rest\.$/],
    [(side) => ({ ...side.build.state, popup: "dialog", dialog: { line: 3, cursor: side.build.state.cursor, camera: side.build.state.camera } }), /^Line 4 of 4\. \[enter\] or \[esc\] closes it\.$/],
  ],
  committed: [[(side) => keys(side, "n", "1", "s", "s"), /^The plan is locked in\. \[esc\] opens the menu\.$/]],
  "menu-mouse": [
    [
      (side) => side.build.run([{ kind: "click-menu", entry: NEXUS_ENTRY }, { kind: "cancel" }]),
      /^Click a row or press its key - or use up\/down and \[enter\]\.$/,
    ],
  ],
  "menu-explore": [[() => {}, /^Explore Map: look around and read what is on each tile\. \[enter\] opens it\.$/]],
  "menu-nexus": [
    [(side) => keys(side, DOWN), /^Nexus powers: one is waiting to be picked\. \[enter\] opens them\.$/],
    [(side) => keys(side, "n", "1", DOWN, UP), /^Nexus powers: read the powers you have\. \[enter\] opens them\.$/],
  ],
  "menu-building": [
    [(side) => keys(side, DOWN, DOWN), /^Barracks - Trains troopers\. Costs 40\. \[enter\] to place one\.$/],
    [(side) => keys(side, "1", ENTER, "1", ENTER, UP, DOWN), /^Barracks - Trains troopers\. Costs 40, only 20 left\.$/],
  ],
  "menu-start": [
    [(side) => keys(side, PAGE_DOWN), /^Start Battle Round 1 without a Nexus power\? \[n\] picks one, \[enter\] begins\.$/],
    [(side) => keys(side, "n", "1", PAGE_DOWN), /^Start Battle Round 1: lock in your plan and fight\. \[enter\] to begin\.$/],
  ],
  placing: [[(side) => keys(side, "2"), /^Place the Hatchery: arrows move, \[enter\] places, \[2\] or \[esc\] cancels\.$/]],
  explore: [[(side) => keys(side, "e"), /^Explore Map: arrows move, the panel shows what is here\. \[esc\] goes back\.$/]],
  "explore-planned": [[(side) => keys(side, TAB, "1", ENTER, "e"), /^Planned Barracks: \[bksp\] removes it, \[u\] undoes the last\. \[esc\] goes back\.$/]],
  map: [[(side) => keys(side, TAB), /^Arrows move the cursor, \[enter\] explores here, a number arms a building\.$/]],
}

test("a hint for every situation the hint list names, each one line that fits the 80-column floor", () => {
  assert.equal(buildSide().layout.footerLimit, 76, "the bottom line's room at the 80-column floor")
  const situations = Object.keys(HINTS) as HintSituation[]
  assert.deepEqual([...situations].sort(), (Object.keys(SITUATIONS) as HintSituation[]).sort())
  for (const situation of situations) {
    for (const [drive, says] of SITUATIONS[situation]) {
      const side = buildSide()
      const state = drive(side) ?? side.build.state
      assert.equal(hintSituation(side.context, state), situation)
      const text = hint(side.context, state)
      assert.match(text.text, says, situation)
      assert.equal(text.tone, "hint")
      assert.equal(text.tile, undefined, "a hint is never about a tile")
      assert.ok(text.text.length <= side.layout.footerLimit, `${situation}: "${text.text}" is ${text.text.length} long`)
    }
  }
})

// --- The Controls and hotkeys page -------------------------------------------------------------------

test("the game menu lists [c] Controls and hotkeys right after Settings", () => {
  // Activity logs sits between Controls and Restart.
  assert.deepEqual(GAME_MENU_ROWS, ["settings", "controls", "activity", "restart", "quit"])
  const side = buildSide()
  keys(side, ESC)
  const text = screenText(side)
  assert.match(text, /\[s\] Settings[\s\S]*\[c\] Controls and hotkeys[\s\S]*\[a\] Activity logs[\s\S]*\[r\] Restart/)
  assert.match(text, new RegExp(CONTROLS_DESCRIPTION))
})

test("the Controls page opens from the game menu by c, by Enter on its row and by a click, and from the game by ?", () => {
  const byKey = buildSide()
  keys(byKey, ESC, "c")
  const byEnter = buildSide()
  keys(byEnter, ESC)
  goToGameMenuRow(byEnter, "controls")
  keys(byEnter, ENTER)
  const byClick = buildSide()
  keys(byClick, ESC)
  clickPopupOption(byClick, "c")
  const byDriver = buildSide()
  byDriver.build.run([{ kind: "open-game-menu" }, { kind: "open-controls" }])
  const inMenu = buildSide()
  keys(inMenu, ESC, "?")
  for (const [name, side] of [["c", byKey], ["enter", byEnter], ["a click", byClick], ["a driver", byDriver], ["? in the game menu", inMenu]] as const) {
    assert.equal(side.build.state.popup, "controls", `${name} did not open it`)
    assert.deepEqual(side.build.state.popupUnder.map((level) => level.popup), ["game-menu"], `${name}: not over the game menu`)
    assert.equal(side.build.state.popupHighlight, 0)
  }
  const text = screenText(byKey)
  assert.match(text, new RegExp(CONTROLS_TITLE))
  assert.match(text, /THE MENU/)
  assert.match(text, /close \[esc\]/)

  // `?` from the game, from either focus, and while a plan is committed — never from inside another popup.
  for (const before of [[], [TAB], ["1"], ["n", "1", "s", "s"]]) {
    const side = buildSide()
    keys(side, ...before, "?")
    assert.equal(side.build.state.popup, "controls", `${JSON.stringify(before)} then ? did not open it`)
    assert.deepEqual(side.build.state.popupUnder, [])
  }
  for (const popup of [["n"], ["d"], ["n", "1", "s"], ["d", "e"]]) {
    const side = buildSide()
    keys(side, ...popup)
    const open = side.build.state.popup
    keys(side, "?")
    assert.equal(side.build.state.popup, open, `? reached past the ${open} popup`)
  }
})

test("Esc goes back to the game menu on its Controls row, or to the game after ?; c, ? and Enter close it too", () => {
  const fromMenu = buildSide()
  keys(fromMenu, ESC, "c", DOWN, DOWN, ESC)
  assert.equal(fromMenu.build.state.popup, "game-menu")
  assert.equal(GAME_MENU_ROWS[fromMenu.build.state.popupHighlight], "controls")
  keys(fromMenu, ESC)
  assert.equal(fromMenu.build.state.popup, null)

  const fromGame = buildSide()
  keys(fromGame, "?", ESC)
  assert.equal(fromGame.build.state.popup, null)
  assert.equal(fromGame.build.state.focus, "menu")

  for (const close of ["c", "?", ENTER, " ", "x"]) {
    const side = buildSide()
    keys(side, ESC, "c", close)
    assert.equal(side.build.state.popup, "game-menu", `${JSON.stringify(close)} did not go back`)
  }
  // The top bar's "close [esc]" is Esc: one level back.
  const byLabel = buildSide()
  keys(byLabel, ESC, "c")
  clickEscLabel(byLabel)
  assert.equal(byLabel.build.state.popup, "game-menu")
  // A click outside closes it, as every popup does, and nothing more.
  const outside = buildSide()
  keys(outside, "?")
  clickCell(outside, outside.layout.panelColumn + 3, outside.layout.panelRow + 5)
  assert.equal(outside.build.state.popup, null)
  assert.equal(outside.build.state.armed, null)
  // Keys it has no use for do nothing underneath it.
  const held = buildSide()
  keys(held, "?", "1", "u", "n", "e", TAB)
  assert.equal(held.build.state.popup, "controls")
  assert.equal(held.build.state.armed, null)
  assert.equal(held.quits(), 0)
})

test("it scrolls the export's way: Up/Down, the wheel and the scroll bar, stopping at either end", () => {
  const side = buildSide()
  keys(side, ESC, "c")
  const opening = placed(side)
  assert.ok(opening.window !== null && opening.window.offset === 0)
  assert.ok(opening.scrollBar !== null, "no scroll bar at 80x24, where the page does not fit")
  assert.ok(opening.window.visible < opening.window.count)
  // Up at the top stays at the top.
  keys(side, UP)
  assert.equal(side.build.state.popupHighlight, 0)
  keys(side, ...Array.from({ length: 10 }, () => DOWN))
  assert.equal(side.build.state.popupHighlight, 10)
  assert.ok((placed(side).window?.offset ?? 0) > 0, "ten lines down, the page has not scrolled")
  // Past the end it stops on the last line, which is then in view.
  const last = controlsLineCount() - 1
  keys(side, ...Array.from({ length: last + 5 }, () => DOWN))
  assert.equal(side.build.state.popupHighlight, last)
  const end = placed(side)
  assert.equal((end.window?.offset ?? 0) + (end.window?.visible ?? 0), end.window?.count)
  assert.match(screenText(side), /ctrl\+c +quit at once/)

  // The wheel walks it a line at a time.
  const wheel = buildSide()
  keys(wheel, "?")
  const box = placed(wheel).box
  clickCell(wheel, box.left + 3, box.top + 3, MOUSE_WHEEL_DOWN)
  assert.equal(wheel.build.state.popupHighlight, 1)
  // A click on the scroll bar's lower half brings later lines into view.
  const bar = placed(wheel).scrollBar
  assert.ok(bar !== null)
  clickCell(wheel, bar.column, bar.bottom)
  assert.ok(wheel.build.state.popupHighlight > 1, "the scroll bar's lower half did not scroll down")
  assert.ok((placed(wheel).window?.offset ?? 0) > 0)
  // A driver selects a line directly, clamped to the page.
  wheel.build.dispatch({ kind: "select-row", row: 999 })
  assert.equal(wheel.build.state.popupHighlight, last)
})

test("the page is one table: every situation, every line fits at the floor, and the popup fits the Grid pane at every size", () => {
  const sections = controlsPage()
  assert.deepEqual(
    sections.map((section) => section.heading),
    ["THE MENU", "THE MAP", "THE GROUND", "PLACING A BUILDING", "EXPLORE MAP", "POPUPS", "THE DIALOG", "ANY LIST", "THE MOUSE", "THE BATTLE ROUND", "ANYWHERE"],
  )
  for (const size of SIZES) {
    const side = buildSide({ terminal: size })
    keys(side, "?")
    const popup = placed(side)
    assert.ok(popup.box.top > side.layout.gridBox.top, `the popup covers the top rule at ${size.columns}x${size.rows}`)
    assert.ok(popup.box.bottom + 1 < side.layout.paneBottom, `the popup covers the bottom rule at ${size.columns}x${size.rows}`)
    assert.ok(popup.box.left > side.layout.gridBox.left && popup.box.right + 1 < side.layout.gridBox.right)
    assert.ok((popup.window?.visible ?? 0) >= 12, `only ${popup.window?.visible} lines show at ${size.columns}x${size.rows}`)
    for (const section of sections) {
      for (const entry of section.lines) {
        assert.ok(entry.keys.length < CONTROLS_KEYS_WIDTH, `"${entry.keys}" runs into its text`)
        assert.ok(entry.text.length <= popup.textLimit - CONTROLS_KEYS_WIDTH, `"${entry.text}" is cut at ${size.columns}x${size.rows}`)
      }
    }
  }
  // The Shift jump is the "Jump distance" setting, read rather than copied...
  const jump = `jump ${defaultValue("jumpStep")} tiles`
  assert.ok(sections.some((section) => section.lines.some((entry) => entry.text === jump)))
  const side = buildSide()
  keys(side, "?", ...Array.from({ length: 10 }, () => DOWN))
  assert.ok(screenText(side).includes(jump), `"${jump}" is not on the page`)
  // ...as it is now: changed in Settings, the page says the new distance.
  const moved = buildSide()
  moved.build.dispatch({ kind: "setting-adjust", field: "jumpStep", step: 1 })
  const now = moved.build.state.experiments.jumpStep
  assert.notEqual(now, defaultValue("jumpStep"))
  keys(moved, "?", ...Array.from({ length: 10 }, () => DOWN))
  assert.ok(screenText(moved).includes(`jump ${now} tiles`), "the page still says the default jump")
})

test("the page names only keys the adapters bind, and every command key they bind is on it", () => {
  const page = controlsPage()
  const keysOf = (heading: string): string[] => page.find((section) => section.heading === heading)?.lines.map((entry) => entry.keys) ?? []
  const text = page.flatMap((section) => section.lines.map((entry) => `${entry.keys} ${entry.text}`)).join("\n")
  // The letters the menu and "anywhere" name are commands from the menu, and from the map.
  for (const focus of ["menu", "grid"] as const) {
    for (const key of [...keysOf("THE MENU"), ...keysOf("ANYWHERE")].filter((entry) => entry.length === 1)) {
      assert.notEqual(buildKeyboardCommand(key, { itemCount: 3, armed: false, focus }), null, `${key} is on the page but not bound (${focus})`)
    }
  }
  // The Pulse's keys, while a Pulse is on screen.
  for (const key of [" ", "[", "]", ".", ",", "r"]) {
    assert.equal(buildKeyboardCommand(key, { itemCount: 3, armed: false, focus: "grid", pulse: true })?.kind, "pulse", JSON.stringify(key))
  }
  assert.match(text, /space pause or resume/)
  assert.match(text, /\[ and \] slower, faster/)
  assert.match(text, /\. and , step a frame, a tick/)
  // Every command letter the keyboard adapter answers on the Build Phase screen is named somewhere.
  const bound = ["e", "n", "s", "p", "u", "q", "d", "?", "x"].filter(
    (key) => buildKeyboardCommand(key, { itemCount: 3, armed: false, focus: "menu" }) !== null,
  )
  for (const key of bound) {
    assert.ok(new RegExp(`(^|[\\s/(])${key.replace("?", "\\?")}([\\s/)]|$)`, "m").test(text), `${key} is bound but not on the page`)
  }
  // And the fast move's modifier-free forms, which the bottom line never names.
  for (const name of ["shift+arrow", "option+arrow", "pgup/pgdn", "home/end", "bksp/delete", "tab", "ctrl+c", "wheel", "right click"]) {
    assert.ok(text.includes(name), `${name} is not on the page`)
  }
})

test("one group has no keys: THE GROUND says units stand tall, and how a row counts, in the text's column", () => {
  const page = controlsPage()
  // Every other line is a key and what it does; only THE GROUND's lines have no key.
  for (const section of page) {
    for (const entry of section.lines) {
      assert.equal(entry.keys === "", section.heading === "THE GROUND", `${section.heading}: "${entry.text}"`)
    }
  }
  // Right after the map's keys, its lines read as one passage: units stand tall, so more fit side by side than
  // one behind another, and a row up or down counts two steps across — the rule every reach is drawn by.
  const headings = page.map((section) => section.heading)
  assert.equal(headings.indexOf("THE GROUND"), headings.indexOf("THE MAP") + 1)
  const passage = page.find((section) => section.heading === "THE GROUND")?.lines.map((entry) => entry.text).join(" ") ?? ""
  assert.match(passage, /^units stand tall, so more fit side by side than one behind another; a row up or down counts two steps across$/)
  // On the page at 80 x 24, scrolled to it: each line whole, in the column the keys' words are in.
  const side = buildSide()
  keys(side, "?", ...Array.from({ length: 20 }, () => DOWN))
  const screen = screenText(side)
  for (const entry of page.find((section) => section.heading === "THE GROUND")?.lines ?? []) {
    assert.ok(screen.includes(` ${entry.text} `), `"${entry.text}" is not drawn whole`)
  }
  assert.match(screen, /THE GROUND/)
})

test("the Controls page says what Esc and x do on the menu, how placing is cancelled, and how lists move", () => {
  const page = controlsPage()
  const section = (heading: string) => page.find((entry) => entry.heading === heading)?.lines ?? []
  assert.deepEqual(section("THE MENU").find((line) => line.keys === "esc"), { keys: "esc", text: "the game menu" })
  assert.match(section("THE MENU").find((line) => line.keys === "x")?.text ?? "", /^nothing/)
  assert.ok(section("PLACING A BUILDING").some((line) => line.keys === "its own key"))
  assert.ok(section("PLACING A BUILDING").some((line) => /place it or stop first/.test(line.text)))
  assert.deepEqual(
    section("ANY LIST").map((line) => line.keys),
    ["up/down", "hold up/down", "shift+up/down", "pgup/home", "pgdn/end"],
  )
  assert.match(section("ANYWHERE").find((line) => line.keys === "x")?.text ?? "", /stops at the menu/)
  assert.match(section("THE MOUSE").find((line) => line.keys === "right click")?.text ?? "", /like x/)
})

// --- The Nexus Pulse ----------------------------------------------------------------------------------

test("during a Nexus Pulse the one row is the Pulse's own line, and a popup over it says its own", () => {
  const played = play({ plan: DEFENCE })
  at(played, 0)
  assert.equal(bottomLineText(played), "Battle Round - 5 of yours against 7 of the raid.")
  assert.equal(played.layout.viewport.height, 18)
  played.build.handleData("?", played.layout)
  assert.equal(played.build.state.popup, "controls")
  assert.equal(bottomLineText(played), "Every key and click, by where you are. Up/down scroll. [esc] closes.")
  played.build.handleData(ESC, played.layout, { now: 10 })
  assert.equal(played.build.state.popup, null)
  assert.match(bottomLineText(played), /^Battle Round - /)
})
