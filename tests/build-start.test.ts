// The `[s] Start` button and the question it asks (gate 6A round 2, owner feedback F41-F42): the
// strategy game's "end turn" — a box at the bottom right of the menu, `s` (and, unlisted, `p`) to press
// it, and a question whose Enter, Space and `s` start "Pulse 1". Driven through the real session with
// the shell's `startPulse`, so "starts the Pulse" means a Pulse on screen.

import { test } from "node:test"
import assert from "node:assert/strict"
import { START_BUTTON_ROWS, START_LABEL, menuFloor, startButton } from "../src/build/layout.ts"
import { MOUSE_LEFT, formatMouseEvent } from "../src/build/mouse.ts"
import { overlaySpec, placeOverlay } from "../src/build/overlay.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import { MINIMUM, frameOf, newSession, screenText } from "./pulse-helpers.ts"

const ESC = String.fromCharCode(27)

/** A session with a Nexus power picked (the War Chest), so the Start button is ready. */
function ready(size = MINIMUM) {
  const session = newSession(size)
  session.build.dispatch({ kind: "pick-nexus", index: 1 })
  return session
}

const click = (session: ReturnType<typeof newSession>, column: number, row: number): void => {
  session.build.handleData(formatMouseEvent(MOUSE_LEFT, column + 1, row + 1), session.layout)
}

test("the Start button is a box at the bottom right of the menu panel, three rows tall, with its hotkey", () => {
  const session = ready()
  const { layout } = session
  const { top, left, width } = startButton(layout)
  assert.equal(top + START_BUTTON_ROWS - 1, layout.panelBindingsRow, "the box is not on the panel's last rows")
  assert.equal(left + width, layout.panelColumn + layout.panelLimit - 1, "the box is not against the panel's right side, with a column of air")
  const rows = screenText(session).split("\n")
  const slice = (row: number): string => rows[row]!.slice(left, left + width)
  assert.equal(slice(top), `+${"-".repeat(width - 2)}+`)
  assert.equal(slice(top + 1), `| ${START_LABEL} |`)
  assert.equal(slice(top + 2), `+${"-".repeat(width - 2)}+`)
  assert.equal(START_LABEL, "[s] Start")
})

test("the button is drawn on Explore Map's panel too, and in Unicode as a box of the frame's own lines", () => {
  const session = ready()
  session.build.dispatch({ kind: "explore" })
  const { top, left } = startButton(session.layout)
  assert.match(screenText(session).split("\n")[top + 1]!, /\[s\] Start/)
  const unicode = frameToText(
    composeBuildFrame({ context: session.context, state: session.build.state, layout: session.layout, glyphPack: "unicode" }, "monochrome"),
  ).split("\n")
  assert.equal(unicode[top]!.slice(left, left + 1), "┌")
  assert.equal(unicode[top + 2]!.slice(left, left + 1), "└")
  assert.equal(unicode[top + 1]!.slice(left, left + 1), "│")
})

test("the button is dim while a Nexus power waits to be picked, and bright once it is", () => {
  const waiting = newSession()
  const { top, left } = startButton(waiting.layout)
  const labelAt = (session: ReturnType<typeof newSession>) => cellAt(frameOf(session), left + 2, top + 1).style
  assert.equal(labelAt(waiting).dim, true, "the button looks ready with a pick still waiting")
  waiting.build.dispatch({ kind: "pick-nexus", index: 1 })
  const picked = labelAt(waiting)
  assert.notEqual(picked.dim, true)
  assert.equal(picked.bold, true)
})

test("s, p and a click on the button all ask the same question, and refuse the same way while a pick waits", () => {
  const asks = (press: (session: ReturnType<typeof newSession>) => void) => {
    const session = ready()
    press(session)
    return { overlay: session.build.state.overlay, status: session.build.state.status.text }
  }
  const presses: readonly (readonly [string, (session: ReturnType<typeof newSession>) => void])[] = [
    ["s", (session) => session.build.handleData("s", session.layout)],
    ["p", (session) => session.build.handleData("p", session.layout)],
    [
      "a click",
      (session) => {
        const { top, left } = startButton(session.layout)
        click(session, left + 3, top + 1)
      },
    ],
    [
      "the box's border",
      (session) => {
        const { top, left } = startButton(session.layout)
        click(session, left, top)
      },
    ],
  ]
  for (const [name, press] of presses) {
    const asked = asks(press)
    assert.equal(asked.overlay, "confirm-commit", `${name} did not ask the question`)
    assert.match(asked.status, /^Start Pulse 1\?/, name)
  }
  // With the pick still waiting, each is refused with its reason, and no question opens.
  for (const [name, press] of presses) {
    const session = newSession()
    press(session)
    assert.equal(session.build.state.overlay, null, `${name} opened the question with a pick waiting`)
    assert.match(session.build.state.status.text, /Pick a Nexus power first/, name)
  }
})

test("the question is START PULSE 1? with Start Pulse 1 highlighted, because that is what Enter does", () => {
  const session = ready()
  session.build.handleData("s", session.layout)
  const spec = overlaySpec(session.context, session.build.state)
  assert.ok(spec !== null)
  assert.equal(spec.title, "START PULSE 1?")
  const options = spec.rows.flatMap((row) => (row.kind === "option" ? [row] : []))
  assert.deepEqual(
    options.map((option) => [option.hotkey, option.label, option.highlighted === true]),
    [
      ["s", "Start Pulse 1", true],
      ["n", "Keep building", false],
    ],
  )
})

test("Enter, Space, s and y start the Pulse; n, Esc and x keep building", () => {
  for (const key of ["\r", " ", "s", "y"]) {
    const session = ready()
    session.build.handleData("s", session.layout)
    session.build.handleData(key, session.layout)
    assert.equal(session.build.state.committed, true, `${JSON.stringify(key)} did not start the Pulse`)
    assert.ok(session.build.pulse !== null, `${JSON.stringify(key)} committed but no Pulse is playing`)
  }
  for (const key of ["n", ESC, "x"]) {
    const session = ready()
    session.build.handleData("s", session.layout)
    session.build.handleData(key, session.layout)
    assert.equal(session.build.state.committed, false, `${JSON.stringify(key)} started the Pulse`)
    assert.equal(session.build.state.overlay, null, `${JSON.stringify(key)} left the question open`)
    assert.equal(session.build.pulse, null)
  }
})

test("a click on Start Pulse 1 starts it and a click on Keep building goes back", () => {
  const clickOption = (hotkey: string) => {
    const session = ready()
    session.build.handleData("s", session.layout)
    const spec = overlaySpec(session.context, session.build.state)!
    const placed = placeOverlay(session.layout, spec)
    const row = placed.rows.find((entry) => entry.spec.kind === "option" && entry.spec.hotkey === hotkey)
    assert.ok(row !== undefined, `no ${hotkey} row on the popup`)
    click(session, placed.textColumn + 2, row.row)
    return session
  }
  const start = clickOption("s")
  assert.equal(start.build.state.committed, true)
  assert.ok(start.build.pulse !== null)
  const back = clickOption("n")
  assert.equal(back.build.state.committed, false)
  assert.equal(back.build.state.overlay, null)
})

test("s is still Settings inside the game menu, and pressing Start during a Pulse only says it is committed", () => {
  const menu = ready()
  menu.build.handleData(ESC, menu.layout) // on the menu, Esc opens the game menu
  assert.equal(menu.build.state.overlay, "menu")
  menu.build.handleData("s", menu.layout)
  assert.equal(menu.build.state.overlay, "settings")

  const playing = ready()
  playing.build.handleData("s", playing.layout)
  playing.build.handleData("s", playing.layout)
  assert.ok(playing.build.pulse !== null)
  playing.build.handleData("s", playing.layout)
  assert.equal(playing.build.state.overlay, null)
  assert.match(playing.build.state.status.text, /committed/)
})

test("at the floor the button, the effect line and the overflow key help all fit: the help sits beside the box", () => {
  const session = ready()
  session.build.handleData("1", session.layout) // arm the Barracks, on the map
  const rows = screenText(session).split("\n")
  const { top, left } = startButton(session.layout)
  const text = rows.join("\n")
  assert.match(text, /Trains troopers each Pulse/, "the armed row's line was pushed out by the button")
  const beside = rows.slice(top, top + START_BUTTON_ROWS).map((row) => row.slice(session.layout.panelColumn, left - 1).trimEnd())
  assert.deepEqual(beside.filter((line) => line !== ""), ["bksp remove", "u undo"])
  assert.equal(menuFloor(session.layout), top - 1)
  // Nothing of the help is cut: each whole binding is still there, in the room left of the box.
  for (const line of beside) assert.ok(line.length <= left - 1 - session.layout.panelColumn)
})
