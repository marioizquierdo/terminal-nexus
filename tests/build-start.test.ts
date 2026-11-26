// The `[s] Start Battle Round` row and the rally point it hands the keyboard to (as the owner shaped them over his
// playtests): the menu's last row, reached by Up/Down and pressed by Enter like every other row, by `s` and by a click
// as shortcuts; it makes the cursor the rally point, and Enter, Space, `s`, the Start row or a second click on its tile
// place it and start the round, while Esc, `x` and Backspace go back. Driven through the real session with the
// shell's `startPulse`, so "starts the Pulse" means a Pulse on screen.

import { test } from "node:test"
import assert from "node:assert/strict"
import { START_LABEL, menuEntryAt, startRow } from "../src/build/layout.ts"
import { RALLY_POINT_LINE } from "../src/build/help.ts"
import { menuEntries, startEntry } from "../src/build/state.ts"
import { cellAt } from "../src/view/frame.ts"
import { BACKSPACE, DOWN, ESC } from "./build-helpers.ts"
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
  assert.equal(session.build.state.popup, "banner-place")
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
        assert.equal(state.armed, entry.index, `Enter on building row ${entry.index} did not arm it`)
        break
      case "start":
        assert.equal(state.popup, "banner-place", "Enter on Start Battle Round did not make the cursor the rally point")
        break
      default: {
        const unhandled: never = entry
        assert.fail(`a new kind of menu entry needs a case here: ${JSON.stringify(unhandled)}`)
      }
    }
  })
})

test("Start Battle Round is ready whether or not a Nexus power waits to be picked: never dim", () => {
  // The owner, round 5: "Nexus Powers should be optional for now, it's easier for testing if I can just start
  // a round." The menu's "(1)" still says a power is waiting.
  const waiting = newSession()
  const { layout } = waiting
  const label = (session: Session) => cellAt(frameOf(session), layout.panelColumn + 4, startRow(layout)).style
  assert.notEqual(label(waiting).dim, true, "the row looks refused with a pick waiting")
  assert.match(screenText(waiting), /\[n\] Nexus Pulse \(1\)/)
  waiting.build.dispatch({ kind: "pick-nexus", index: 1 })
  assert.notEqual(label(waiting).dim, true)
})

test("s, p, a click and Enter on the highlighted row all ask the same, with a pick waiting or made", () => {
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
    assert.equal(session.build.state.popup, "banner-place", `${name} did not make the cursor the rally point`)
    assert.equal(session.build.state.handoff?.entry, startEntry(session.context.catalog.length), `${name}: no hand-off from the Start row`)
  }
  // With the pick still waiting, each does the same.
  for (const [name, press] of presses) {
    const session = newSession()
    press(session)
    assert.equal(session.build.state.popup, "banner-place", `${name} did not make the cursor the rally point with a pick waiting`)
  }
})

test("a click on the row hits the Start Battle Round entry, and the row above it hits its own", () => {
  const { layout, context } = ready()
  assert.equal(menuEntryAt(layout, context.catalog, layout.panelColumn + 2, startRow(layout)), startEntry(context.catalog.length))
  assert.notEqual(menuEntryAt(layout, context.catalog, layout.panelColumn + 2, startRow(layout) - 1), startEntry(context.catalog.length))
})

test("Esc while the rally point is placed goes back to the menu, the highlight on Start Battle Round", () => {
  const session = ready()
  session.build.handleData("s", session.layout)
  assert.equal(session.build.state.popup, "banner-place")
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

test("the bottom line while the rally point is placed says its two actions, and no place", () => {
  const session = ready()
  session.build.handleData("s", session.layout)
  const rows = screenText(session).split("\n")
  assert.equal(rows[session.layout.footerRow]!.slice(session.layout.offset.column + 2).trimEnd().replace(/\|$/u, "").trimEnd(), RALLY_POINT_LINE)
  assert.equal(RALLY_POINT_LINE, "[arrows] Set Rally Point. [enter] Start battle.")
})

test("Enter, Space and s place the rally point and start the Pulse; Esc, x and Backspace go back with nothing changed; y and n do nothing", () => {
  for (const key of ["\r", " ", "s"]) {
    const session = ready()
    session.build.handleData("s", session.layout)
    session.build.handleData(key, session.layout)
    assert.equal(session.build.state.committed, true, `${JSON.stringify(key)} did not start the Pulse`)
    assert.ok(session.build.pulse !== null, `${JSON.stringify(key)} committed but no Pulse is playing`)
  }
  for (const key of [ESC, "x", BACKSPACE]) {
    const session = ready()
    const before = session.build.state
    session.build.handleData("s", session.layout)
    session.build.handleData("\u001b[C", session.layout) // moved, then given up
    session.build.handleData(key, session.layout)
    assert.equal(session.build.state.committed, false, `${JSON.stringify(key)} started the Pulse`)
    assert.equal(session.build.state.popup, null, `${JSON.stringify(key)} left the rally point being placed`)
    assert.equal(session.build.pulse, null)
    const { cursor, camera, focus, planned, banner } = session.build.state
    assert.deepEqual({ cursor, camera, focus, planned, banner }, { cursor: before.cursor, camera: before.camera, focus: before.focus, planned: before.planned, banner: before.banner }, `${JSON.stringify(key)} changed the Build Phase`)
  }
  for (const key of ["y", "n"]) {
    const stays = ready()
    stays.build.handleData("s", stays.layout)
    stays.build.handleData(key, stays.layout)
    assert.equal(stays.build.state.popup, "banner-place", `${key} stopped placing the rally point, or opened a popup over it`)
    assert.equal(stays.build.state.committed, false)
  }
})

test("a click on the Start row starts it; a click on the map moves the rally point there", () => {
  const start = ready()
  start.build.handleData("s", start.layout)
  click(start, start.layout.panelColumn + 3, startRow(start.layout))
  assert.equal(start.build.state.committed, true)
  assert.ok(start.build.pulse !== null)

  const moved = ready()
  moved.build.handleData("s", moved.layout)
  const was = moved.build.state.cursor
  click(moved, moved.layout.mapBox.right - 2, moved.layout.mapBox.bottom - 1)
  assert.equal(moved.build.state.committed, false)
  assert.equal(moved.build.state.popup, "banner-place")
  assert.notDeepEqual(moved.build.state.cursor, was)
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
  assert.match(playing.build.state.status.text, /locked in/)
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
