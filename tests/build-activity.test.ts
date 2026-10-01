// The Activity logs window and the game logging into it (owner, 2026-10-01, feedback F90-F91): "a new
// option for 'activity logs' that opens a scrolling window with logs in reverse chronological order ...
// simple filtering mechanism and an export button." The window is a popup in the one shape, reached from
// the game menu; the list is frozen when it opens; the export goes through the session to the shell; and
// the session records what happens, schema-valid, without ever changing what the reducer does. Driven
// through raw bytes into the real adapters where an adapter is what is claimed.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import {
  ACTIVITY_EMPTY,
  ACTIVITY_EXPORT_ROW,
  ACTIVITY_FILTER_ROW,
  ACTIVITY_FIRST_ENTRY_ROW,
  ACTIVITY_NOTE_LINES,
  activityExportText,
  shownEntries,
} from "../src/build/activity.ts"
import { SPIKE_START_CURSOR } from "../src/build/catalog.ts"
import { settingColumns, wrapWords } from "../src/build/popup.ts"
import { ACTIVITY_DESCRIPTION, GAME_MENU_ROWS } from "../src/build/settings.ts"
import type { BuildState } from "../src/build/state.ts"
import type { BuildCommand, ExportKind } from "../src/build/types.ts"
import { startPulse } from "../src/cli/pulse-run.ts"
import { runSpike, spikeContext } from "../src/cli/spike.ts"
import { ACTIVITY_EVENTS, ACTIVITY_FILTERS, entryProblems, formatActivityExport, parseLogLine } from "../src/log/index.ts"
import type { LogEntry } from "../src/log/index.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import { frameToText } from "../src/view/frame.ts"
import {
  DOWN,
  END,
  ENTER,
  ESC,
  HOME,
  LEFT,
  MAXIMUM,
  MINIMUM,
  RIGHT,
  TAB,
  UP,
  activityLog,
  buildSide,
  clickCell,
  clickPopupOption,
  compose,
  goToGameMenuRow,
  keys,
  placed,
  screenText,
  timed,
} from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"

type Exported = Readonly<{ text: string; kind: ExportKind }>
type ActivitySide = BuildSide & Readonly<{ exports: Exported[] }>

/** A Build Phase that keeps every export it hands the shell, with its kind, on a log whose clock moves
 *  100 ms each time it is read — so each entry's time is its own. */
function session(terminal = MINIMUM): ActivitySide {
  const exports: Exported[] = []
  let now = 0
  const side = buildSide({
    terminal,
    activity: activityLog(() => (now += 100)),
    onExport: (text, kind) => exports.push({ text, kind }),
  })
  return { ...side, exports }
}

/** A Nexus power picked, a Barracks and a Turret placed from the menu, and the game menu open. */
const BUILT = ["n", "1", "1", ENTER, "3", ENTER, ESC] as const

/** The window, open on a Build Phase that did `BUILT` first. */
function opened(terminal = MINIMUM): ActivitySide {
  const side = session(terminal)
  keys(side, ...BUILT, "a")
  assert.equal(side.build.state.popup, "activity-logs")
  return side
}

/** What an entry is about, in a word: the building, the popup, the setting — or its command. */
const about = (entry: LogEntry): unknown => entry.props["building"] ?? entry.props["popup"] ?? entry.props["setting"] ?? entry.props["command"]

/** The rows of the window's list, as drawn text, in order. */
function listTexts(side: BuildSide): string[] {
  const popup = placed(side)
  const scroll = popup.spec.scroll
  assert.ok(scroll !== undefined)
  return popup.spec.rows.slice(scroll.from, scroll.to).flatMap((row) => (row.kind === "text" ? [row.text] : []))
}

/** The note under the list: what the highlighted row is for. */
function noteText(side: BuildSide): string {
  const note = placed(side).spec.rows.find((row) => row.kind === "note")
  assert.ok(note !== undefined && note.kind === "note")
  return note.text
}

// --- The game menu's row ----------------------------------------------------------------------------

test("the game menu has [a] Activity logs between Controls and Restart, saying what it is for", () => {
  assert.deepEqual(GAME_MENU_ROWS, ["settings", "controls", "activity", "restart", "quit"])
  const side = session()
  keys(side, ESC)
  const text = screenText(side)
  assert.match(text, /\[c\] Controls and hotkeys[\s\S]*\[a\] Activity logs[\s\S]*\[r\] Restart/)
  assert.ok(text.includes(ACTIVITY_DESCRIPTION), "the row does not say what it is for")
})

test("the window opens from the game menu by a, by Enter on its row and by a click — and Esc, x or a goes back to that row", () => {
  const byKey = session()
  keys(byKey, ESC, "a")
  const byEnter = session()
  keys(byEnter, ESC)
  goToGameMenuRow(byEnter, "activity")
  keys(byEnter, ENTER)
  const byClick = session()
  keys(byClick, ESC)
  clickPopupOption(byClick, "a")
  const byDriver = session()
  byDriver.build.run([{ kind: "open-game-menu" }, { kind: "open-activity-logs" }])
  for (const [name, side] of [["a", byKey], ["Enter", byEnter], ["a click", byClick], ["the driver", byDriver]] as const) {
    assert.equal(side.build.state.popup, "activity-logs", `${name} did not open it`)
    assert.equal(side.build.state.popupHighlight, ACTIVITY_FILTER_ROW, `${name}: it opens on the filter`)
    assert.deepEqual(side.build.state.popupUnder.map((level) => level.popup), ["game-menu"], `${name}: not over the game menu`)
  }
  for (const back of [ESC, "x", "a"]) {
    const side = session()
    keys(side, ESC, "a", back)
    assert.equal(side.build.state.popup, "game-menu", `${JSON.stringify(back)} did not go back`)
    assert.equal(GAME_MENU_ROWS[side.build.state.popupHighlight], "activity", `${JSON.stringify(back)}: not back on its row`)
  }
  assert.match(screenText(byKey), /ACTIVITY LOGS \(1\/\d+\)/)
  assert.match(screenText(byKey).split("\n")[1] ?? "", /close \[esc\]/)
})

test("it opens over a committed plan too, so what a Pulse logged can be exported", () => {
  const side = session()
  keys(side, "n", "1", "s", "s", ESC, "a")
  assert.ok(side.build.state.committed)
  assert.equal(side.build.state.popup, "activity-logs")
})

// --- The list -----------------------------------------------------------------------------------------

test("the list is what the filter shows, newest first, one line each as an export writes it", () => {
  const side = opened()
  const shown = shownEntries(side.context, side.build.state)
  // The first filter, Interactions: info and above.
  assert.equal(side.build.state.activityFilter, 0)
  assert.deepEqual(
    shown.map((entry) => [entry.event, about(entry)]),
    [
      ["popup.open", "game-menu"],
      ["build.placed", "Turret"],
      ["build.placed", "Barracks"],
      ["popup.open", "nexus-powers"],
    ],
  )
  for (let index = 1; index < shown.length; index += 1) {
    assert.ok((shown[index - 1] as LogEntry).seq > (shown[index] as LogEntry).seq, "not newest first")
  }
  const lines = listTexts(side)
  assert.equal(lines.length, shown.length)
  lines.forEach((line, index) => assert.deepEqual(parseLogLine(line)?.event, shown[index]?.event))
  assert.match(lines[1] as string, /^\d\d:\d\d\.\d{3} info {2}build\.placed building=Turret x=\d+ y=\d+ credits=\d+$/)
})

test("the list holds still while it is read: what is logged after the window opened waits for the next opening", () => {
  const side = opened()
  const before = listTexts(side)
  const upTo = side.build.state.activityUpTo
  assert.equal(upTo, (side.context.activity?.lastSeq ?? 0) - 2, "opening logged its command and its popup after the cut-off")
  keys(side, DOWN, DOWN, UP, RIGHT, LEFT)
  assert.ok((side.context.activity?.lastSeq ?? 0) > upTo + 2, "the keys pressed in the window were logged")
  assert.deepEqual(listTexts(side), before, "the rows moved while the list was read")
  assert.equal(side.build.state.activityUpTo, upTo)
  // Opened again, it shows what came since — newest, the window's own first opening (going back to the
  // game menu is not an opening).
  keys(side, ESC, "a")
  const again = shownEntries(side.context, side.build.state)
  assert.deepEqual([again[0]?.event, about(again[0] as LogEntry)], ["popup.open", "activity-logs"])
  assert.equal(again.length, before.length + 1)
})

test("Up and Down walk the filter, the export and the entries, stopping at the ends; the title counts every row", () => {
  const side = opened()
  const count = ACTIVITY_FIRST_ENTRY_ROW + shownEntries(side.context, side.build.state).length
  assert.match(screenText(side), new RegExp(`ACTIVITY LOGS \\(1/${count}\\)`))
  keys(side, UP)
  assert.equal(side.build.state.popupHighlight, ACTIVITY_FILTER_ROW, "Up on the first row moved")
  keys(side, DOWN)
  assert.equal(side.build.state.popupHighlight, ACTIVITY_EXPORT_ROW)
  keys(side, DOWN)
  assert.equal(side.build.state.popupHighlight, ACTIVITY_FIRST_ENTRY_ROW)
  assert.match(screenText(side), new RegExp(`ACTIVITY LOGS \\(3/${count}\\)`))
  keys(side, END, DOWN)
  assert.equal(side.build.state.popupHighlight, count - 1, "Down on the last row moved")
  assert.match(screenText(side), new RegExp(`ACTIVITY LOGS \\(${count}/${count}\\)`))
  keys(side, HOME)
  assert.equal(side.build.state.popupHighlight, ACTIVITY_FILTER_ROW)
})

test("a long list scrolls with the highlight, its scroll bar in the right border", () => {
  const side = session()
  keys(side, ...BUILT, "a", RIGHT, RIGHT) // Everything: every command too
  assert.equal(ACTIVITY_FILTERS[side.build.state.activityFilter]?.name, "Everything")
  const total = shownEntries(side.context, side.build.state).length
  assert.ok(placed(side).scrollBar !== null, "the list does not overflow at 80x24")
  keys(side, END)
  const shown = placed(side).rows.filter((row) => row.spec.kind === "text" && row.spec.highlighted === true)
  assert.equal(shown.length, 1, "the highlighted entry is not in view")
  assert.equal(side.build.state.popupHighlight, ACTIVITY_FIRST_ENTRY_ROW + total - 1)
})

// --- The filter -------------------------------------------------------------------------------------

test("Left and Right step the filter through the list, coming round at both ends, and say how many it shows", () => {
  const side = opened()
  const names = ACTIVITY_FILTERS.map((filter) => filter.name)
  keys(side, DOWN, DOWN, RIGHT)
  assert.equal(side.build.state.popupHighlight, ACTIVITY_FIRST_ENTRY_ROW, "Right on an entry is nothing")
  keys(side, HOME)
  for (let step = 1; step <= names.length; step += 1) {
    keys(side, RIGHT)
    assert.equal(side.build.state.activityFilter, step % names.length)
  }
  keys(side, LEFT)
  assert.equal(side.build.state.activityFilter, names.length - 1, "Left on the first filter did not come round")
  const filter = ACTIVITY_FILTERS[names.length - 1]
  assert.ok(filter !== undefined)
  assert.match(screenText(side), new RegExp(`<\\s+${filter.name}\\s+>`))
  const count = shownEntries(side.context, side.build.state).length
  assert.equal(side.build.state.status.text, `Filter: ${filter.name} - ${count} events.`)
  // Enter on the Filter row steps it as Right does, as on every setting row.
  keys(side, ENTER)
  assert.equal(side.build.state.activityFilter, 0)
})

test("a filter that shows nothing says so, and the window keeps its height whatever the filter shows", () => {
  const side = opened()
  const heights = new Set<number>()
  const tops = new Set<number>()
  for (let filter = 0; filter < ACTIVITY_FILTERS.length; filter += 1) {
    const { box } = placed(side)
    heights.add(box.bottom - box.top)
    tops.add(placed(side).rows.find((row) => row.spec.kind === "setting")?.row ?? -1)
    if (ACTIVITY_FILTERS[side.build.state.activityFilter]?.name === "Problems") {
      assert.deepEqual(listTexts(side), [ACTIVITY_EMPTY])
      const empty = placed(side).spec.rows.find((row) => row.kind === "text")
      assert.ok(empty?.kind === "text" && empty.muted === true, "the empty line is not muted")
      assert.ok(screenText(side).includes(ACTIVITY_EMPTY))
    }
    keys(side, RIGHT)
  }
  assert.equal(heights.size, 1, "the popup changed height with the filter")
  assert.equal(tops.size, 1, "the Filter row moved")
})

test("the filter is kept when the window closes and across a restart", () => {
  const side = opened()
  keys(side, RIGHT, ESC, ESC, ESC, "a")
  assert.equal(side.build.state.activityFilter, 1)
  keys(side, ESC, "r")
  assert.equal(side.build.state.activityFilter, 1)
})

// --- What the highlighted row is for --------------------------------------------------------------

test("under the list: the filter's question, what the export holds, or an entry's whole line and what its event means", () => {
  const side = opened()
  assert.equal(noteText(side), ACTIVITY_FILTERS[0]?.question)
  keys(side, DOWN)
  const count = shownEntries(side.context, side.build.state).length
  assert.match(noteText(side), new RegExp(`^Copies the ${count} events this filter shows`))
  keys(side, DOWN, DOWN) // the second entry: the Turret placed
  const entry = shownEntries(side.context, side.build.state)[1] as LogEntry
  const [line, description] = noteText(side).split("\n")
  assert.equal(parseLogLine(line as string)?.event, "build.placed")
  assert.deepEqual(parseLogLine(line as string)?.props, entry.props, "the note's line is not the entry's whole line")
  assert.equal(description, ACTIVITY_EVENTS["build.placed"].description)
  // The whole line is there even where the list cut it short, and the event's meaning on lines of its own.
  const text = screenText(side)
  assert.ok(text.includes(`credits=${String(entry.props["credits"])}`), "the note does not show the line's end")
  assert.ok(text.includes("A building was placed on the plan."))
})

test("every filter's question fits the note at the narrowest popup", () => {
  const side = opened()
  for (const filter of ACTIVITY_FILTERS) {
    const lines = wrapWords(filter.question, placed(side).textLimit)
    assert.ok(lines.length <= ACTIVITY_NOTE_LINES, `${filter.name}'s question takes ${lines.length} lines`)
  }
})

test("long lines are cut at the popup's edge at 80x24 and at the largest view, never past its border", () => {
  for (const terminal of [MINIMUM, MAXIMUM]) {
    const side = opened(terminal)
    keys(side, RIGHT, RIGHT, DOWN, DOWN)
    const popup = placed(side)
    const frame = frameToText(compose(side)).split("\n")
    let cut = 0
    for (const row of popup.rows) {
      if (row.spec.kind !== "text") continue
      const line = frame[row.row] ?? ""
      const drawn = line.slice(popup.textColumn, popup.textColumn + popup.textLimit)
      assert.ok(row.spec.text.startsWith(drawn.trimEnd()), `row ${row.row} is not the start of its line: ${drawn}`)
      // The column before the border — or the scroll bar in it — stays the popup's padding.
      assert.equal(line[popup.textColumn + popup.textLimit], " ", "the line ran into the border")
      if (row.spec.text.length > popup.textLimit) cut += 1
    }
    assert.ok(cut > 0, `nothing was long enough to cut at ${terminal.columns}x${terminal.rows}`)
  }
})

// --- Export -----------------------------------------------------------------------------------------

test("export hands the shell the filter's frozen entries, oldest first, and says so in a message that goes back to the window", () => {
  const side = opened()
  const state = side.build.state
  const shown = shownEntries(side.context, state)
  keys(side, "e")
  assert.equal(side.exports.length, 1)
  const [exported] = side.exports
  assert.equal(exported?.kind, "activity")
  assert.equal(exported?.text, activityExportText(side.context, state))
  assert.equal(
    exported?.text,
    formatActivityExport({
      entries: (side.context.activity?.entries() ?? []).filter((entry) => entry.seq <= state.activityUpTo),
      filter: ACTIVITY_FILTERS[0] as (typeof ACTIVITY_FILTERS)[number],
      startedAt: side.activity.startedAt,
      dropped: side.activity.dropped,
    }),
  )
  const events = (exported?.text ?? "").split("\n").flatMap((line) => {
    const parsed = parseLogLine(line)
    return parsed === null ? [] : [parsed.event]
  })
  assert.deepEqual(events, [...shown].reverse().map((entry) => entry.event), "not the shown entries, oldest first")
  // The message: how many, from which filter.
  assert.equal(side.build.state.popup, "message")
  assert.equal(side.build.state.message?.title, "LOGS EXPORTED")
  assert.match(side.build.state.message?.text ?? "", new RegExp(`^${shown.length} events from the Interactions filter\\.`))
  assert.match(screenText(side), /LOGS EXPORTED/)
  assert.match(side.build.state.status.text, /^Activity logs exported: \d+ events/)
  // The export is recorded too, after the cut-off.
  const last = side.activity.entries().filter((entry) => entry.event === "export")
  assert.deepEqual(last.map((entry) => entry.props), [{ kind: "activity", events: shown.length }])
  keys(side, ESC)
  assert.equal(side.build.state.popup, "activity-logs")
  assert.equal(side.build.state.popupHighlight, ACTIVITY_EXPORT_ROW)
  // Enter on the export row is the same export.
  keys(side, ENTER)
  assert.equal(side.exports.length, 2)
  assert.equal(side.exports[1]?.text, exported?.text, "the frozen list changed between two exports")
})

test("the export's message names where the text went, when the shell says", () => {
  const side = buildSide({ context: { ...spikeContext(), activityExportDestination: "Copied to the clipboard." } })
  keys(side, ESC, "a", "e")
  assert.match(side.build.state.message?.text ?? "", /Copied to the clipboard\.$/)
  // Outside the window, the command does nothing: a driver cannot export what nobody saw.
  const driver = session()
  driver.build.run([{ kind: "export-activity" }])
  assert.equal(driver.exports.length, 0)
  assert.equal(driver.build.state.popup, null)
})

// --- The mouse ---------------------------------------------------------------------------------------

test("a click does what a key does: the export row exports, the filter's value halves step it, an entry is highlighted", () => {
  const byKeys = opened()
  keys(byKeys, RIGHT, RIGHT, LEFT)
  const byMouse = opened()
  const filterRow = (side: BuildSide) => {
    const row = placed(side).rows.find((entry) => entry.spec.kind === "setting")
    assert.ok(row !== undefined)
    return row.row
  }
  const columns = settingColumns(placed(byMouse))
  clickCell(byMouse, columns.valueTo, filterRow(byMouse))
  clickCell(byMouse, columns.valueTo - 1, filterRow(byMouse))
  clickCell(byMouse, columns.valueFrom, filterRow(byMouse))
  assert.equal(byMouse.build.state.activityFilter, byKeys.build.state.activityFilter)
  assert.equal(byMouse.build.state.activityFilter, 1)
  // Back to Interactions, which has entries to click.
  clickCell(byMouse, columns.valueFrom + 1, filterRow(byMouse))
  assert.equal(byMouse.build.state.activityFilter, 0)
  // A click on the row's name highlights it.
  keys(byMouse, DOWN, DOWN)
  clickCell(byMouse, placed(byMouse).textColumn + 1, filterRow(byMouse))
  assert.equal(byMouse.build.state.popupHighlight, ACTIVITY_FILTER_ROW)
  // A click on an entry highlights it, so its whole line shows under the list.
  const entries = placed(byMouse).rows.filter((row) => row.spec.kind === "text" && row.spec.select !== undefined)
  const second = entries[1]
  assert.ok(second !== undefined)
  clickCell(byMouse, placed(byMouse).textColumn + 2, second.row)
  assert.equal(byMouse.build.state.popupHighlight, ACTIVITY_FIRST_ENTRY_ROW + 1)
  // The export row, clicked, exports exactly what `e` does.
  const byKey = opened()
  keys(byKey, "e")
  const byClick = opened()
  clickPopupOption(byClick, "e")
  assert.equal(byClick.exports.length, 1)
  assert.equal(byClick.exports[0]?.text, byKey.exports[0]?.text)
  assert.equal(byClick.build.state.popup, "message")
})

// --- The session's records --------------------------------------------------------------------------

test("placing a building records a schema-valid build.placed with its building, its tile and what is left", () => {
  const side = session()
  keys(side, "1", ENTER)
  const placedEntries = side.activity.entries().filter((entry) => entry.event === "build.placed")
  assert.equal(placedEntries.length, 1)
  const entry = placedEntries[0] as LogEntry
  assert.deepEqual(entryProblems(ACTIVITY_EVENTS, entry), [])
  assert.equal(entry.level, "info")
  assert.equal(entry.props["building"], "Barracks")
  // Its tile is the one the cursor pointed at: where the player put it.
  assert.deepEqual({ x: entry.props["x"], y: entry.props["y"] }, side.build.state.cursor)
  assert.equal(entry.props["credits"], 60)
  // Undone, it is taken off the plan, with the credits back.
  keys(side, "u")
  const removed = side.activity.entries().filter((candidate) => candidate.event === "build.removed")
  assert.deepEqual(removed.map((candidate) => [candidate.props["building"], candidate.props["credits"]]), [["Barracks", 100]])
})

test("a refusal records why, and its tile; every command records the bottom line's answer when it gave one", () => {
  const side = session()
  keys(side, TAB, "1")
  side.build.dispatch({ kind: "look-at", x: SPIKE_START_CURSOR.x, y: SPIKE_START_CURSOR.y }) // onto the Grid Nexus
  keys(side, ENTER)
  const refused = side.activity.entries().filter((entry) => entry.event === "build.refused")
  assert.equal(refused.length, 1)
  assert.equal(refused[0]?.props["command"], "place")
  assert.match(String(refused[0]?.props["reason"]), /^Cannot build here: the nexus is here at \d+,\d+\.$/)
  assert.deepEqual({ x: refused[0]?.props["x"], y: refused[0]?.props["y"] }, side.build.state.cursor)
  const command = side.activity.entries().filter((entry) => entry.event === "build.command").at(-1)
  assert.equal(command?.props["command"], "place")
  assert.equal(command?.props["answer"], refused[0]?.props["reason"])
  assert.equal(command?.level, "debug")
  // A row it cannot afford, refused before it is armed: said, without a tile.
  const poor = session()
  keys(poor, "1", ENTER, "1", ENTER, "1")
  const unaffordable = poor.activity.entries().filter((entry) => entry.event === "build.refused")
  assert.deepEqual(unaffordable.map((entry) => entry.props), [{ command: "arm", reason: "Cannot build here: costs 40, 20 left." }])
})

test("popups opening and settings changing are recorded — not a popup coming back into view", () => {
  const side = session()
  keys(side, ESC, "s", RIGHT, ESC, ESC, "d", LEFT)
  const opens = side.activity.entries().filter((entry) => entry.event === "popup.open").map((entry) => entry.props["popup"])
  assert.deepEqual(opens, ["game-menu", "settings", "settings"])
  const changes = side.activity.entries().filter((entry) => entry.event === "setting.change").map((entry) => entry.props)
  assert.equal(changes.length, 2)
  assert.deepEqual(changes[0], { setting: "theme", value: "light", tier: "player" })
  assert.equal(changes[1]?.["tier"], "experiment")
})

test("a timed cursor key records how far it moved and why", () => {
  const side = session()
  timed(side, [
    [TAB, 1000],
    [RIGHT, 2000],
    [RIGHT, 3000],
  ])
  const moves = side.activity.entries().filter((entry) => entry.event === "move.step")
  assert.deepEqual(
    moves.map((entry) => entry.props),
    [
      { key: "right", move: "tap", tiles: 1 },
      { key: "right", move: "tap", tiles: 1 },
    ],
  )
  // A driver's untimed keys go through no motion rules, so they record none.
  const untimed = session()
  keys(untimed, TAB, RIGHT)
  assert.equal(untimed.activity.entries().filter((entry) => entry.event === "move.step").length, 0)
})

test("the Pulse records its start and, once, its result", () => {
  const side = buildSide({ activity: activityLog(), startPulse })
  keys(side, "n", "2", "s", "s")
  const home = (side.build.pulse?.times.homeMs ?? 0) + 100
  side.build.advance(0)
  side.build.advance(home)
  side.build.dispatch({ kind: "pulse", control: "restart" })
  side.build.advance(2 * home)
  assert.equal(side.build.pulse?.phase(), "home", "the Pulse was not watched to its end again")
  const entries = side.activity.entries()
  const start = entries.filter((entry) => entry.event === "pulse.start")
  assert.deepEqual(start.map((entry) => entry.props), [{ round: 1, buildings: 0 }])
  const end = entries.filter((entry) => entry.event === "pulse.end")
  assert.equal(end.length, 1, "watching it again recorded the result twice")
  assert.ok(["won", "lost", "drawn", "timed out"].includes(String(end[0]?.props["result"])))
  assert.ok(String(end[0]?.props["reason"]).length > 0)
})

test("a Pulse that cannot start records the error", () => {
  const side = buildSide({
    activity: activityLog(),
    startPulse: () => {
      throw new Error("no room for the units")
    },
  })
  keys(side, "n", "1", "s", "s")
  const errors = side.activity.entries().filter((entry) => entry.event === "session.error")
  assert.deepEqual(errors.map((entry) => entry.props), [{ where: "pulse", message: "no room for the units" }])
  assert.equal(errors[0]?.level, "error")
})

test("every entry a scripted run records passes the schema", () => {
  const side = buildSide({ activity: activityLog(), startPulse })
  keys(side, "n", "2", "1", ENTER, "3", ENTER, "u", "e", ESC, TAB)
  timed(side, [
    [RIGHT, 1000],
    [RIGHT, 1100],
    [`${ESC}[1;2C`, 1500],
    [DOWN, 3000],
  ])
  keys(side, ESC, ESC, "s", RIGHT, ESC, "c", ESC, "a", RIGHT, "e", ESC, ESC, ESC, "d", LEFT, "e", ESC, ESC, "s", "s")
  const home = (side.build.pulse?.times.homeMs ?? 0) + 100
  side.build.advance(0)
  side.build.advance(home)
  keys(side, ESC, "a", "e")
  const entries = side.activity.entries()
  const events = new Set(entries.map((entry) => entry.event))
  for (const event of ["build.command", "build.placed", "build.removed", "popup.open", "setting.change", "pulse.start", "pulse.end", "export", "move.step"]) {
    assert.ok(events.has(event), `the run recorded no ${event}`)
  }
  for (const entry of entries) assert.deepEqual(entryProblems(ACTIVITY_EVENTS, entry), [], `${entry.event} #${entry.seq}`)
})

test("what the reducer does never depends on what was logged", () => {
  // The same keys into a session that records and one whose log records nothing: every state the same.
  // (Opening the Activity logs window is the one place the reducer reads the log, by design — it is left
  // out here, and its own tests above say what it reads.)
  const recording = buildSide({ activity: activityLog(), startPulse })
  const silentLog = activityLog()
  silentLog.log = (() => {}) as typeof silentLog.log
  const silent = buildSide({ activity: silentLog, startPulse })
  const script = ["n", "1", "1", ENTER, "3", RIGHT, ENTER, "u", "e", ESC, TAB, RIGHT, "2", ENTER, ESC, "s", RIGHT, ESC, ESC, "d", LEFT, ESC, "s", "s"]
  const comparable = (state: BuildState) => ({ ...state })
  for (const key of script) {
    keys(recording, key)
    keys(silent, key)
    assert.deepEqual(comparable(recording.build.state), comparable(silent.build.state), `after ${JSON.stringify(key)}`)
  }
  assert.ok(recording.activity.entries().length > script.length)
  assert.equal(silentLog.entries().length, 0)
})

test("a session given no log of its own records into the game's global one", async () => {
  const { activity } = await import("../src/log/activity.ts")
  const side = buildSide({ context: spikeContext() })
  // buildSide gives every test session a log of its own; a bare session uses the global.
  const { BuildSession } = await import("../src/build/session.ts")
  const bare = new BuildSession({ context: spikeContext(), cursor: SPIKE_START_CURSOR, viewport: side.layout.viewport })
  const before = activity.lastSeq
  bare.dispatch({ kind: "focus", target: "grid" } satisfies BuildCommand)
  assert.equal(activity.lastSeq, before + 1)
  assert.equal(activity.entries().at(-1)?.event, "build.command")
})

// --- A scripted playtest ----------------------------------------------------------------------------

test("a scripted playtest records on the script's own clock, and its window shows that log", () => {
  const run = runBuildPlaytest({ steps: parseKeyScript("1 Enter Esc a") })
  const placedEntry = run.activity.entries().find((entry) => entry.event === "build.placed")
  // The second step, a second after the first: the time is the step's, the same on every run.
  assert.equal(placedEntry?.time, 2000)
  assert.equal(run.activity.startedAt, 0)
  const last = run.frames[run.frames.length - 1]
  assert.equal(last?.state.popup, "activity-logs")
  assert.ok(frameToText(last?.frame ?? compose(buildSide())).includes("00:02.000 info  build.placed building=Ba"))
  assert.deepEqual(runBuildPlaytest({ steps: parseKeyScript("1 Enter Esc a") }).activity.entries(), run.activity.entries())
})

// --- The live screen --------------------------------------------------------------------------------

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

test("the live screen records where it started, and hands an Activity Logs export to its exporter by kind", async () => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const log = activityLog()
  const exported: Exported[] = []
  const running = runSpike({
    settings: { ...DEFAULT_SETTINGS, capability: "monochrome" },
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: () => {},
    buildId: "abc1234",
    activity: log,
    exporter: {
      destination: { settings: "Settings to the test.", activity: "Sent." },
      export: (text, kind) => void exported.push({ text, kind }),
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 30))
  stdout.columns = 104
  stdout.rows = 32
  stdout.emit("resize")
  for (const key of ["q", "a", "e"]) stdin.emit("data", Buffer.from(key))
  await new Promise((resolve) => setTimeout(resolve, 30))
  const [start] = log.entries()
  assert.equal(start?.event, "session.start")
  assert.deepEqual(start?.props, { screen: "build", build: "abc1234", host: "terminal", columns: 80, rows: 24, colours: "monochrome" })
  const resized = log.entries().filter((entry) => entry.event === "session.resize")
  assert.deepEqual(resized.map((entry) => entry.props), [{ columns: 104, rows: 32 }])
  assert.deepEqual(exported.map((entry) => entry.kind), ["activity"])
  assert.match(exported[0]?.text ?? "", /^Terminal Nexus activity logs\nbuild: abc1234 · /)
  assert.match(exported[0]?.text ?? "", /session\.start screen=build build=abc1234 host=terminal/)
  assert.ok(stdout.written.includes("LOGS EXPORTED"), "the message was not drawn")
  for (const entry of log.entries()) assert.deepEqual(entryProblems(ACTIVITY_EVENTS, entry), [], `${entry.event} #${entry.seq}`)
  stdin.emit("data", Buffer.from([3]))
  assert.equal(await running, 0)
})
