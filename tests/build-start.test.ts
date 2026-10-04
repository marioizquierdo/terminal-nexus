// The `[s] Start Battle Round` row and the Battle Round screen it opens (as the owner shaped them over his playtests):
// the menu's last row, reached by Up/Down and pressed by Enter like every other
// row, by `s` and by a click as shortcuts; and a confirmation whose title is "Battle Round 1", whose body
// announces it, and whose one row, `[s] Start`, is what Enter, Space and `s` press. Driven through the
// real session with the shell's `startPulse`, so "starts the Pulse" means a Pulse on screen.

import { test } from "node:test"
import assert from "node:assert/strict"
import { START_LABEL, menuEntryAt, startRow } from "../src/build/layout.ts"
import { DEFAULT_ROUND_TEXT, popupSpec, placePopup } from "../src/build/popup.ts"
import { menuEntries, startEntry } from "../src/build/state.ts"
import { cellAt } from "../src/view/frame.ts"
import { DOWN, ESC } from "./build-helpers.ts"
import { MINIMUM, click, frameOf, newSession, screenText } from "./pulse-helpers.ts"

type Session = ReturnType<typeof newSession>

/** A session with a Nexus power picked (the War Chest), so Start Battle Round is ready. */
function ready(size = MINIMUM): Session {
  const session = newSession(size)
  session.build.dispatch({ kind: "pick-nexus", index: 1 })
  return session
}

/** The row's text on the panel's bottom line. */
function startLine(session: Session): string {
  const { layout } = session
  return screenText(session).split("\n")[startRow(layout)]!.slice(layout.panelColumn, layout.panelColumn + layout.panelLimit)
}

test("Start Battle Round is the menu's last entry, one plain row on the panel's bottom line, with its hotkey", () => {
  const session = ready()
  const entries = menuEntries(session.context)
  assert.equal(entries[entries.length - 1]?.kind, "start")
  assert.equal(entries.length - 1, startEntry(session.context.catalog.length))
  assert.equal(startRow(session.layout), session.layout.panelLastRow)
  assert.equal(startLine(session).trimEnd(), `[s] ${START_LABEL}`)
  assert.equal(START_LABEL, "Start Battle Round")
  // No box: the rows around it in the panel are plain text, not a button's border.
  const rows = screenText(session).split("\n")
  const { layout } = session
  assert.doesNotMatch(rows[startRow(layout) - 1]!.slice(layout.panelColumn, layout.panelColumn + layout.panelLimit), /[+-]{3}/, "a box's top edge")
})

test("Down reaches Start Battle Round, and Enter, Enter starts the Pulse — no hotkey and no mouse needed", () => {
  const session = ready()
  const last = menuEntries(session.context).length - 1
  // Only Down and Enter are pressed: the highlight walks the whole menu and arrives on its last entry.
  let presses = 0
  while (session.build.state.menuHighlight !== last && presses <= last) {
    session.build.handleData(DOWN, session.layout)
    presses += 1
  }
  assert.equal(session.build.state.menuHighlight, last, "Down never reached Start Battle Round")
  session.build.handleData("\r", session.layout)
  assert.equal(session.build.state.popup, "battle-round")
  session.build.handleData("\r", session.layout)
  assert.equal(session.build.state.committed, true, "Enter, Enter did not start the Pulse")
  assert.ok(session.build.pulse !== null)
})

test("the rule: every entry of the menu is reached by Down and done by Enter alone (docs/system-design/ui-patterns.md, Back, cancel and close)", () => {
  const entries = menuEntries(ready().context)
  entries.forEach((entry, index) => {
    const session = ready()
    for (let step = 0; step < index; step += 1) session.build.handleData(DOWN, session.layout)
    session.build.handleData("\r", session.layout)
    const { state } = session.build
    switch (entry.kind) {
      case "explore":
        assert.equal(state.exploreMap, true, "Enter on Explore Map did not open it")
        break
      case "nexus":
        assert.equal(state.popup, "nexus-powers", "Enter on Nexus did not open its popup")
        break
      case "construct":
        assert.equal(state.armed, entry.index, `Enter on construct row ${entry.index} did not arm it`)
        break
      case "start":
        assert.equal(state.popup, "battle-round", "Enter on Start Battle Round did not open its screen")
        break
      default: {
        const unhandled: never = entry
        assert.fail(`a new kind of menu entry needs a case here: ${JSON.stringify(unhandled)}`)
      }
    }
  })
})

test("Start Battle Round is dim while a Nexus power waits to be picked, and bright once it is", () => {
  const waiting = newSession()
  const { layout } = waiting
  const label = (session: Session) => cellAt(frameOf(session), layout.panelColumn + 4, startRow(layout)).style
  assert.equal(label(waiting).dim, true, "the row looks ready with a pick still waiting")
  waiting.build.dispatch({ kind: "pick-nexus", index: 1 })
  assert.notEqual(label(waiting).dim, true)
})

test("s, p, a click and Enter on the highlighted row all ask the same, and refuse the same way while a pick waits", () => {
  const onRow = (session: Session): void => {
    session.build.dispatch({ kind: "highlight", delta: 1, jump: true }) // the last row
    session.build.handleData("\r", session.layout)
  }
  const presses: readonly (readonly [string, (session: Session) => void])[] = [
    ["s", (session) => session.build.handleData("s", session.layout)],
    ["p", (session) => session.build.handleData("p", session.layout)],
    ["a click", (session) => click(session, session.layout.panelColumn + 3, startRow(session.layout))],
    ["a click at the row's far end", (session) => click(session, session.layout.panelColumn + session.layout.panelLimit - 1, startRow(session.layout))],
    ["Enter on the highlighted row", onRow],
  ]
  for (const [name, press] of presses) {
    const session = ready()
    press(session)
    assert.equal(session.build.state.popup, "battle-round", `${name} did not open the Battle Round screen`)
    assert.match(session.build.state.status.text, /^Battle Round 1:/, name)
  }
  // With the pick still waiting, each is refused with its reason and no screen opens.
  for (const [name, press] of presses) {
    const session = newSession()
    press(session)
    assert.equal(session.build.state.popup, null, `${name} opened the screen with a pick waiting`)
    assert.match(session.build.state.status.text, /Pick a Nexus power first/, name)
  }
})

test("a click on the row hits the Start Battle Round entry, and the row above it hits its own", () => {
  const { layout, context } = ready()
  assert.equal(menuEntryAt(layout, context.catalog, layout.panelColumn + 2, startRow(layout)), startEntry(context.catalog.length))
  assert.notEqual(menuEntryAt(layout, context.catalog, layout.panelColumn + 2, startRow(layout) - 1), startEntry(context.catalog.length))
})

test("Esc on the Battle Round screen goes back to the menu, the highlight on Start Battle Round", () => {
  const session = ready()
  session.build.handleData("s", session.layout)
  assert.equal(session.build.state.popup, "battle-round")
  session.build.handleData(ESC, session.layout)
  assert.equal(session.build.state.popup, null)
  assert.equal(session.build.state.focus, "menu")
  const entries = menuEntries(session.context)
  assert.equal(session.build.state.menuHighlight, entries.length - 1, "Esc did not leave the highlight on Start Battle Round")
})

test("the menu gives way to Explore Map, Start Battle Round with the rest of it — and a click there only closes Explore Map", () => {
  const session = ready()
  session.build.dispatch({ kind: "explore" })
  assert.doesNotMatch(startLine(session), /Start Battle Round/)
  click(session, session.layout.panelColumn + 3, startRow(session.layout))
  assert.equal(session.build.state.popup, null, "a click on the hidden row opened the confirmation")
  assert.equal(session.build.state.exploreMap, false)
  assert.match(startLine(session), /Start Battle Round/)
})

test("the Battle Round screen: its title, what it announces, and one highlighted row, [s] Start", () => {
  const session = ready()
  session.build.handleData("s", session.layout)
  const spec = popupSpec(session.context, session.build.state)
  assert.ok(spec !== null)
  assert.equal(spec.title, "Battle Round 1")
  const notes = spec.rows.flatMap((row) => (row.kind === "note" ? [row.text] : []))
  assert.deepEqual(notes, ["Activate Nexus.", "Collect Resources.", "Spawn Units."], "one order to a line")
  assert.equal(DEFAULT_ROUND_TEXT, "Activate Nexus. Collect Resources. Spawn Units.")
  const options = spec.rows.flatMap((row) => (row.kind === "option" ? [row] : []))
  assert.deepEqual(
    options.map((option) => [option.hotkey, option.label, option.highlighted === true]),
    [["s", "Start", true]],
  )
  const shown = screenText(session)
  assert.match(shown, /Battle Round 1/)
  for (const order of ["Activate Nexus.", "Collect Resources.", "Spawn Units."]) assert.match(shown, new RegExp(order.replace(".", "\\.")))
  assert.doesNotMatch(shown, /Keep building|START PULSE/)
})

test("a mission can say its own words for a round, and every other round says the default", () => {
  const session = ready()
  const context = { ...session.context, roundText: { 1: "Hold the line until the Nexus is charged." } }
  session.build.handleData("s", session.layout)
  const own = popupSpec(context, session.build.state)!
  assert.deepEqual(
    own.rows.flatMap((row) => (row.kind === "note" ? [row.text] : [])),
    ["Hold the line until the Nexus is charged."],
  )
  const other = popupSpec({ ...context, roundText: { 2: "A second push." } }, session.build.state)!
  assert.deepEqual(
    other.rows.flatMap((row) => (row.kind === "note" ? [row.text] : [])),
    ["Activate Nexus.", "Collect Resources.", "Spawn Units."],
  )
})

test("Enter, Space, s and y start the Pulse; Esc and x go back; n does nothing there", () => {
  for (const key of ["\r", " ", "s", "y"]) {
    const session = ready()
    session.build.handleData("s", session.layout)
    session.build.handleData(key, session.layout)
    assert.equal(session.build.state.committed, true, `${JSON.stringify(key)} did not start the Pulse`)
    assert.ok(session.build.pulse !== null, `${JSON.stringify(key)} committed but no Pulse is playing`)
  }
  for (const key of [ESC, "x"]) {
    const session = ready()
    session.build.handleData("s", session.layout)
    session.build.handleData(key, session.layout)
    assert.equal(session.build.state.committed, false, `${JSON.stringify(key)} started the Pulse`)
    assert.equal(session.build.state.popup, null, `${JSON.stringify(key)} left the screen open`)
    assert.equal(session.build.pulse, null)
  }
  const stays = ready()
  stays.build.handleData("s", stays.layout)
  stays.build.handleData("n", stays.layout)
  assert.equal(stays.build.state.popup, "battle-round", "n closed the screen, or opened the Nexus popup over it")
  assert.equal(stays.build.state.committed, false)
})

test("a click on [s] Start starts it; a click outside the screen goes back", () => {
  const start = ready()
  start.build.handleData("s", start.layout)
  const placed = placePopup(start.layout, popupSpec(start.context, start.build.state)!)
  const row = placed.rows.find((entry) => entry.spec.kind === "option" && entry.spec.hotkey === "s")
  assert.ok(row !== undefined, "no [s] row on the screen")
  click(start, placed.textColumn + 2, row.row)
  assert.equal(start.build.state.committed, true)
  assert.ok(start.build.pulse !== null)

  const outside = ready()
  outside.build.handleData("s", outside.layout)
  click(outside, outside.layout.gridBox.right - 2, outside.layout.gridBox.bottom - 1)
  assert.equal(outside.build.state.committed, false)
  assert.equal(outside.build.state.popup, null)
})

test("s is still Settings inside the game menu, and pressing Start during a Pulse only says it is committed", () => {
  const menu = ready()
  menu.build.handleData(ESC, menu.layout) // on the menu, Esc opens the game menu
  assert.equal(menu.build.state.popup, "game-menu")
  menu.build.handleData("s", menu.layout)
  assert.equal(menu.build.state.popup, "settings")

  const playing = ready()
  playing.build.handleData("s", playing.layout)
  playing.build.handleData("s", playing.layout)
  assert.ok(playing.build.pulse !== null)
  playing.build.handleData("s", playing.layout)
  assert.equal(playing.build.state.popup, null)
  assert.match(playing.build.state.status.text, /committed/)
})

test("at the floor the menu and Start Battle Round fit with no help text between them, and the armed building's card has room", () => {
  // The key help that overflowed into the panel used to stack directly above Start Battle Round; the panel
  // carries no help text now.
  const session = ready()
  session.build.dispatch({ kind: "focus", target: "menu" })
  const { layout } = session
  const panel = (rows: string[], row: number): string => rows[row]!.slice(layout.panelColumn, layout.panelColumn + layout.panelLimit).trimEnd()
  const menu = screenText(session).split("\n")
  assert.equal(panel(menu, startRow(layout)), "[s] Start Battle Round")
  assert.equal(panel(menu, startRow(layout) - 1), "")
  session.build.handleData("1", session.layout) // arm the Barracks: its card replaces the menu
  const card = screenText(session).split("\n")
  assert.match(card.join("\n"), /home to it after\./, "the card has no room for what the building does")
  assert.equal(panel(card, startRow(layout)), "", "Start Battle Round is the menu's, and hides with it")
})
