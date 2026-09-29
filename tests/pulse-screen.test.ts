// The Nexus Pulse on the Build Phase's screen — gate 6A. What a player sees and can do once the plan is
// committed: the screen it becomes, the ending's words at each moment of it, the playback keys and the
// panel rows a click reaches, where the view looks, and the way back to a fresh Build Phase. Driven through
// the real session (the keyboard and mouse adapters, the reducer and the presenter), with the screen's clock
// handed in as a number, so a whole Pulse plays in a millisecond.

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_START_CURSOR } from "../src/build/catalog.ts"
import { centreOn } from "../src/build/camera.ts"
import { rowOfField } from "../src/build/debug.ts"
import { escHintSpan, escLabel, pulseControlRows } from "../src/build/layout.ts"
import { MOUSE_LEFT, MOUSE_RIGHT, formatMouseEvent } from "../src/build/mouse.ts"
import { BuildSession } from "../src/build/session.ts"
import { nexusTile } from "../src/build/state.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { buildLayout } from "../src/build/layout.ts"
import { frameToAnsi, frameToText } from "../src/view/frame.ts"
import { CAPABILITY_MODES } from "../src/view/index.ts"
import { ALARM_HALF_PERIOD_MS } from "../src/view/ending.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { DEFENCE, MINIMUM, at, frameOf, newSession, play, prepare, screenText } from "./pulse-helpers.ts"
import type { Played } from "./pulse-helpers.ts"

const ESC = String.fromCharCode(27)

/** A Pulse the defence wins, with the screen's clock started at zero. */
function victorious(): Played {
  const played = play({ plan: DEFENCE })
  at(played, 0)
  return played
}

const times = (played: Pick<Played, "build">) => {
  const pulse = played.build.pulse
  assert.ok(pulse !== null, "there is no Pulse on screen")
  return pulse.times(played.build.state.debug)
}

const click = (played: Pick<Played, "build" | "layout">, column: number, row: number, button = MOUSE_LEFT, now?: number): void => {
  played.build.handleData(formatMouseEvent(button, column + 1, row + 1), played.layout, now === undefined ? {} : { now })
}

test("answering yes turns the screen into the Nexus Pulse, with the keyboard on the map", () => {
  const played = victorious()
  const { state } = played.build
  assert.equal(state.committed, true)
  assert.equal(state.focus, "grid", "the keyboard is not on the map, so the arrows would move a menu highlight")
  assert.equal(state.armed, null)
  const text = screenText(played)
  assert.match(text, /TERMINAL NEXUS nexus pulse/)
  assert.match(text, /^\| NEXUS PULSE /m)
  assert.match(text, /0\.0s of 30\.0s {2}1x/)
  assert.match(text, /YOU {3}5 \[#+\]/)
  assert.match(text, /RAID {2}7 \[#+\]/)
  assert.match(text, /\[space\] Pause/)
  assert.match(text, /\[r\] Watch again/)
  assert.match(text, /PULSE {2}space pause {2}\[ \] speed {2}r watch again {2}arrows look around/)
  assert.match(text, /Nexus Pulse - 5 of yours against 7 of the raid\./)
  assert.match(text, /menu \[esc\]/)
  // The Build Phase's menu is gone: nothing left to build, nothing to pick.
  assert.doesNotMatch(text, /\[1\] Barracks|RESOURCE|\[e\] Explore Map/)
})

test("the view is centred on the player's Nexus when the Pulse starts, wherever they had scrolled", () => {
  const session = newSession()
  prepare(session.build)
  session.build.run([
    { kind: "focus", target: "grid" },
    { kind: "move-cursor", dx: 40, dy: 14, fast: true },
    { kind: "move-cursor", dx: 20, dy: 10, fast: true },
  ])
  assert.ok(session.build.state.camera.x > 0, "the player did not scroll away")
  session.build.run([{ kind: "commit" }, { kind: "confirm-commit", accept: true }])
  session.build.advance(0)
  const nexus = nexusTile(session.context)
  assert.ok(nexus !== null)
  assert.deepEqual(session.build.state.cursor, nexus, "the cursor did not come to the Nexus")
  assert.deepEqual(
    session.build.state.camera,
    centreOn({ x: 0, y: 0 }, nexus, session.build.state.viewport, session.context.grid),
    "the view is not centred on the Nexus",
  )
})

test("the ending says what is happening in words at every moment: the alarm, cease fire, recall, the result", () => {
  const played = victorious()
  const moments = times(played)
  assert.ok(moments.alarmMs !== null && moments.alarmMs < moments.stopMs)

  at(played, 500)
  assert.doesNotMatch(screenText(played), /PULSE ENDING|CEASE FIRE|RECALL|VICTORY/)

  // The alarm: named in the top bar, the panel and the status line — three places that do not depend on
  // a flash, a colour or a blink being seen.
  at(played, moments.alarmMs + 40)
  const alarm = screenText(played)
  assert.match(alarm, /TERMINAL NEXUS PULSE ENDING/)
  assert.match(alarm, /^\| PULSE ENDING /m)
  assert.match(alarm, /Pulse ending - hold your fire\./)

  at(played, moments.stopMs + 20)
  const halted = screenText(played)
  assert.match(halted, /TERMINAL NEXUS cease fire/)
  assert.match(halted, /^\| CEASE FIRE /m)
  assert.match(halted, /The shooting has stopped\./)
  assert.match(halted, /Cease fire\. The Pulse is over\./)

  at(played, moments.walkMs + 20)
  const walking = screenText(played)
  assert.match(walking, /TERMINAL NEXUS recall/)
  assert.match(walking, /^\| RECALL /m)
  assert.match(walking, /The survivors walk home\./)
  assert.match(walking, /Recall - the survivors are heading home\./)

  at(played, moments.homeMs + 20)
  const home = screenText(played)
  assert.match(home, /TERMINAL NEXUS nexus pulse - victory/)
  assert.match(home, /^\| VICTORY /m)
  assert.match(home, /The raid was wiped out\./)
  assert.match(home, /\d+ of yours came home\./)
  assert.match(home, /VICTORY - The raid was wiped out\. \d+ of yours came home\./)
  // What comes next is said once, in words, and the pause row is gone: there is nothing left to pause.
  assert.match(home, /For a new Build Phase:/)
  assert.match(home, /Esc, then Restart\./)
  assert.doesNotMatch(home, /\[space\] Pause/)
  assert.match(home, /\[r\] Watch again/)
})

test("a lost Pulse and a timed-out one say so plainly, and a draw is a draw", () => {
  const lost = play()
  at(lost, 0)
  at(lost, times(lost).homeMs + 100)
  assert.match(screenText(lost), /^\| DEFEAT /m)
  assert.match(screenText(lost), /Your force was wiped out\./)
  // Nobody left to walk home is said as that, not as "0 of yours".
  assert.match(screenText(lost), /None of yours came home\./)
  assert.doesNotMatch(screenText(lost), /\b0 of yours came home/)

  const nexusFell = play({ crew: 1 })
  at(nexusFell, 0)
  at(nexusFell, times(nexusFell).homeMs + 100)
  assert.match(screenText(nexusFell), /^\| DEFEAT /m)
  assert.match(screenText(nexusFell), /Your Nexus was destroyed\./)

  const timedOut = play({ raid: 1 })
  at(timedOut, 0)
  // A scheduled ending reads like a sudden one: it too gets its alarm, ahead of the stop.
  at(timedOut, times(timedOut).alarmMs! + 40)
  assert.match(screenText(timedOut), /Pulse ending - hold your fire\./)
  at(timedOut, times(timedOut).homeMs + 100)
  assert.match(screenText(timedOut), /^\| TIME'S UP /m)
  assert.match(screenText(timedOut), /The time ran out before either side won\./)

  const draw = play({ plan: [DEFENCE[0]!] })
  at(draw, 0)
  at(draw, times(draw).homeMs + 100)
  assert.match(screenText(draw), /^\| DRAW /m)
})

test("at 80x24 the result's words are never cut off, whichever way the Pulse ended", () => {
  // The status line is one row, 76 characters wide; the panel's text is 27 columns and its prose keeps the
  // last one clear, so nothing touches the divider. A result that ran off the edge would be one nobody could read.
  const scenarios = [{}, { plan: DEFENCE }, { raid: 1 }, { crew: 1 }, { raid: 2 }, { plan: [DEFENCE[0]!] }] as const
  for (const scenario of scenarios) {
    const played = play(scenario)
    at(played, 0)
    at(played, times(played).homeMs + 100)
    const lines = screenText(played).split("\n")
    const name = JSON.stringify(scenario)
    const statusRows = lines.filter((line) => /^\| (VICTORY|DEFEAT|DRAW|TIME'S UP) - /.test(line))
    assert.equal(statusRows.length, 1, `${name}: the status line is missing`)
    assert.match(statusRows[0]!, /came home\. +\|$/, `${name}: the status line is cut off: ${statusRows[0]}`)
    const first = lines.findIndex((line) => /^\| (VICTORY|DEFEAT|DRAW|TIME'S UP) +[|]/.test(line))
    const last = lines.findIndex((line) => line.includes("[r] Watch again"))
    assert.ok(first >= 0 && last > first, `${name}: the result panel is not on screen`)
    for (const row of lines.slice(first, last + 1)) {
      assert.equal(row[28], " ", `${name}: the panel's text runs into the divider: ${row}`)
    }
  }
})

test("the survivors are drawn walking home, and home when the walk ends", () => {
  const played = victorious()
  const moments = times(played)
  const moves = played.pulse.recall.moves
  assert.ok(moves.length > 0, "nobody survived to walk")
  const drawn = (ms: number) => {
    at(played, ms)
    const frame = played.build.pulseFrame(played.layout)
    assert.ok(frame !== undefined)
    return frame.positions
  }
  const far = moves.find((move) => Math.abs(move.from.x - move.to.x) + Math.abs(move.from.y - move.to.y) > 6)
  assert.ok(far !== undefined, "every survivor was already home; the test proves nothing")
  assert.deepEqual(drawn(moments.walkMs - 50).get(far.ordinal) ?? far.from, far.from, "it walked before the walk began")
  const middle = drawn((moments.walkMs + moments.homeMs) / 2).get(far.ordinal)
  assert.ok(middle !== undefined)
  assert.notDeepEqual(middle, far.from)
  assert.notDeepEqual(middle, far.to, "it was home halfway through the walk")
  for (const move of moves) assert.deepEqual(drawn(moments.homeMs + 10).get(move.ordinal), move.to, `${move.ordinal} did not come home`)
})

test("reduced motion holds the alarm steady and puts the survivors home the moment the walk begins", () => {
  const played = victorious()
  played.build.dispatch({ kind: "setting-adjust", field: "reducedMotion", step: 1 })
  assert.equal(played.build.state.settings.reducedMotion, true)
  const moments = times(played)
  for (let ms = moments.alarmMs! + 10; ms < moments.stopMs; ms += 173) {
    at(played, ms)
    assert.equal(played.build.pulseFrame(played.layout)?.alarmLit, true, `the alarm blinked at ${ms} ms`)
  }
  at(played, moments.walkMs + 5)
  const positions = played.build.pulseFrame(played.layout)!.positions
  for (const move of played.pulse.recall.moves) assert.deepEqual(positions.get(move.ordinal), move.to)
  // With motion, the same instant is mid-walk.
  const moving = victorious()
  at(moving, moments.walkMs + 5)
  assert.ok(moving.pulse.recall.moves.some((move) => {
    const drawnAt = moving.build.pulseFrame(moving.layout)!.positions.get(move.ordinal)
    return drawnAt !== undefined && (drawnAt.x !== move.to.x || drawnAt.y !== move.to.y)
  }), "nothing was still walking with motion on")
})

test("the alarm flashes the Grid's frame and stops flashing when it ends", () => {
  const played = victorious()
  const moments = times(played)
  const styled = (ms: number): number => {
    at(played, ms)
    const frame = frameOf(played, "truecolor")
    return frame.cells.filter((cell) => cell.style.fgRole === "notice.gate" && cell.style.inverse === true).length
  }
  assert.equal(styled(500), 0, "something flashed before the alarm")
  const lit = styled(moments.alarmMs! + 20)
  assert.ok(lit > 80, `only ${lit} cells flashed: the frame did not`)
  const dark = styled(moments.alarmMs! + 20 + 350)
  assert.ok(dark < lit, "the flash never went dark")
  assert.equal(styled(moments.stopMs + 20), 0, "it kept flashing after the fight stopped")
})

test("the ending is plain to see at every colour depth: the alarm is reversed video and, in monochrome, no phase leans on colour", () => {
  const escape = String.fromCharCode(27)
  const codes = (text: string): number[] =>
    [...text.matchAll(new RegExp(`${escape}\\[([0-9;]*)m`, "g"))].flatMap((match) =>
      (match[1] ?? "").split(";").filter((part) => part !== "").map(Number),
    )
  const isColour = (code: number): boolean => (code >= 30 && code <= 49) || (code >= 90 && code <= 107)
  for (const capability of CAPABILITY_MODES) {
    // A Pulse's time only moves forward, so each depth plays its own from the top.
    const played = victorious()
    const moments = times(played)
    const ansiAt = (ms: number): string => {
      at(played, ms)
      return frameToAnsi(frameOf(played, capability), capability)
    }
    const lit = ansiAt(moments.alarmMs! + 20)
    const dark = ansiAt(moments.alarmMs! + 20 + ALARM_HALF_PERIOD_MS)
    const phases = { lit, dark, ceaseFire: ansiAt(moments.stopMs + 20), recall: ansiAt(moments.walkMs + 20), result: ansiAt(moments.homeMs + 20) }
    if (capability === "monochrome") {
      for (const [phase, ansi] of Object.entries(phases)) {
        assert.ok(!codes(ansi).some(isColour), `${phase}: monochrome emitted a colour code`)
      }
    }
    assert.ok(codes(lit).includes(7), `${capability}: the lit alarm is not reversed video`)
    assert.notEqual(lit, dark, `${capability}: the alarm's flash cannot be seen`)
    // The phases are told apart by their words as much as by anything drawn: each screen differs from the last.
    assert.equal(new Set(Object.values(phases)).size, 5, `${capability}: two moments of the ending look the same`)
  }
})

test("the playback keys pause, slow, speed, step and replay the Pulse — and only while no popup is open", () => {
  const played = victorious()
  const pulse = played.build.pulse!
  const key = (bytes: string, now?: number): void => played.build.handleData(bytes, played.layout, now === undefined ? {} : { now })

  at(played, 2000)
  assert.equal(pulse.timeMs, 2000)
  key(" ", 2000)
  assert.equal(pulse.paused, true)
  assert.match(screenText(played), /Paused\. /)
  assert.match(screenText(played), /\[space\] Resume/)
  at(played, 9000)
  assert.equal(pulse.timeMs, 2000, "a paused Pulse moved on")
  key(" ", 9000)
  assert.equal(pulse.paused, false)
  at(played, 10_000)
  assert.equal(pulse.timeMs, 3000)

  key("]", 10_000)
  assert.equal(pulse.speed, 2)
  at(played, 11_000)
  assert.equal(pulse.timeMs, 5000, "twice as fast moved a second of the clock by two")
  assert.match(screenText(played), /2x/)
  key("[", 11_000)
  key("[", 11_000)
  assert.equal(pulse.speed, 0.5)

  key(" ", 11_000)
  const before = pulse.timeMs
  key(",", 11_000)
  assert.equal(pulse.timeMs, before + 1000 / 12, "a tick step is one tick")
  key(".", 11_000)
  assert.equal(pulse.timeMs, before + 1000 / 12 + 1000 / 30, "a frame step is one frame")

  key("r", 11_000)
  assert.equal(pulse.timeMs, 0, "watching again starts from the top")
  assert.equal(pulse.paused, true, "watching again unpaused it")

  // A popup holds the keyboard: the Pulse's keys under it do nothing to the Pulse. (Space inside the game
  // menu is that menu's own Enter, and `r` there is its Restart — so the keys tried here are the ones it
  // has no use for, and Space checks only that it never pauses.)
  key(" ", 11_000) // resume, so a stray Space would now pause
  assert.equal(pulse.paused, false)
  key(ESC, 11_000)
  assert.equal(played.build.state.overlay, "menu")
  for (const bytes of ["]", "[", ",", "."]) key(bytes, 11_000)
  assert.equal(pulse.speed, 0.5, "a speed key reached the Pulse through a popup")
  key(" ", 11_000)
  assert.equal(pulse.paused, false, "Space under a popup paused the Pulse")
  for (let step = 0; step < 3 && played.build.state.overlay !== null; step += 1) key(ESC, 11_000)
  assert.equal(played.build.state.overlay, null)
})

test("nothing that edits the plan works once the Pulse is on screen, and q still asks", () => {
  const played = victorious()
  const planned = played.build.state.planned
  const key = (bytes: string): void => played.build.handleData(bytes, played.layout)
  for (const bytes of ["1", "2", "3", "u", "\u007f", "p", "e", "n", "\t"]) key(bytes)
  assert.deepEqual(played.build.state.planned, planned)
  assert.equal(played.build.state.committed, true)
  assert.equal(played.build.state.overlay, null, "a key opened a popup over the Pulse")
  key("q")
  assert.equal(played.build.state.overlay, "menu", "q did not open the game menu")
})

test("the panel's rows are clickable: Pause and Resume, Watch again — and nothing else on the panel is", () => {
  const played = victorious()
  const pulse = played.build.pulse!
  const [pause, again] = pulseControlRows(played.layout)
  assert.ok(pause !== undefined && again !== undefined)
  const column = played.layout.panelColumn + 3

  at(played, 4000)
  click(played, column, pause.row)
  assert.equal(pulse.paused, true, "a click on the Pause row did not pause")
  click(played, column, pause.row)
  assert.equal(pulse.paused, false, "a second click did not resume")
  click(played, column, again.row)
  assert.equal(pulse.timeMs, 0, "a click on Watch again did not start over")

  // A click on the feed, the forces or the title does nothing at all.
  const state = played.build.state
  for (const row of [played.layout.panelRow, played.layout.panelRow + 3, played.layout.panelRow + 8]) {
    click(played, column, row)
    assert.equal(played.build.state, state, `a click on panel row ${row} did something`)
    assert.equal(pulse.paused, false)
  }
  // A click just past the panel's right edge is the Grid, not a control.
  click(played, played.layout.panelColumn + played.layout.panelLimit + 3, pause.row)
  assert.equal(pulse.paused, false)
})

test("the top bar's Esc label, a right click and Esc are one way to the game menu, over a Pulse too", () => {
  const played = victorious()
  assert.equal(escLabel(played.build.state), "menu [esc]")
  const hint = escHintSpan(played.layout, "menu [esc]")
  click(played, hint.from + 2, hint.row)
  assert.equal(played.build.state.overlay, "menu")
  played.build.handleData(ESC, played.layout)
  assert.equal(played.build.state.overlay, null)
  click(played, 40, 12, MOUSE_RIGHT)
  assert.equal(played.build.state.overlay, "menu")
})

test("a click on the map looks around it — the cursor moves, the view follows, and nothing is placed", () => {
  const played = victorious()
  const planned = played.build.state.planned
  const cursor = played.build.state.cursor
  const cell = { column: played.layout.origin.column + 20, row: played.layout.origin.row + 4 }
  click(played, cell.column, cell.row)
  assert.notDeepEqual(played.build.state.cursor, cursor, "the click did not move the cursor")
  click(played, cell.column, cell.row)
  assert.deepEqual(played.build.state.planned, planned, "a second click placed something after the commit")
  // The arrows look around too.
  const before = played.build.state.cursor
  played.build.handleData(`${ESC}[C`, played.layout)
  assert.equal(played.build.state.cursor.x, before.x + 1)
})

test("the view looks at the Nexus again when the alarm starts — unless Centre on Nexus is off", () => {
  for (const centre of [true, false]) {
    const played = victorious()
    if (!centre) played.build.dispatch({ kind: "debug-adjust", field: "endCentre", step: 1 })
    assert.equal(played.build.state.debug.endCentre, centre)
    const moments = times(played)
    at(played, moments.alarmMs! - 200)
    // The player looks around: far to the east, then south.
    played.build.run([{ kind: "move-cursor", dx: 30, dy: 12, fast: true }])
    const wandered = played.build.state.cursor
    at(played, moments.alarmMs! + 50)
    const nexus = nexusTile(played.context)!
    if (centre) assert.deepEqual(played.build.state.cursor, nexus, "the alarm did not bring the view back to the Nexus")
    else assert.deepEqual(played.build.state.cursor, wandered, "the view moved with Centre on Nexus off")
  }
})

test("Watch again replays from the top and frames the view again", () => {
  const played = victorious()
  const moments = times(played)
  at(played, moments.homeMs + 500)
  played.build.run([{ kind: "move-cursor", dx: 30, dy: 12, fast: true }])
  assert.match(screenText(played), /^\| VICTORY /m)
  played.build.dispatch({ kind: "pulse", control: "restart" })
  at(played, moments.homeMs + 600)
  assert.match(screenText(played), /^\| NEXUS PULSE /m)
  assert.deepEqual(played.build.state.cursor, nexusTile(played.context), "the view was not framed again")
})

test("changing an ending Experiment is felt at once, and `d` opens Settings at the first of them", () => {
  const played = victorious()
  const moments = times(played)
  at(played, moments.stopMs - 1500)
  assert.match(screenText(played), /PULSE ENDING/, "the default alarm lead of four seconds")
  // The alarm lead to off: the same instant is now plain fighting.
  for (let step = 0; step < 4; step += 1) played.build.dispatch({ kind: "debug-adjust", field: "endAlarmLeadMs", step: -1 })
  assert.equal(played.build.state.debug.endAlarmLeadMs, 0)
  assert.doesNotMatch(screenText(played), /PULSE ENDING/)

  played.build.handleData("d", played.layout)
  assert.equal(played.build.state.overlay, "settings")
  assert.equal(played.build.state.overlayHighlight, rowOfField("endAlarmLeadMs"), "d did not open at the ending's Experiments")
  assert.match(screenText(played), /Alarm lead/)
  // Before a Pulse it is still the first Experiment.
  const before = newSession()
  before.build.handleData("d", before.layout)
  assert.equal(before.build.state.overlayHighlight, rowOfField("placeFramesMs"))
})

test("the frame timer runs while the Pulse plays, and stops when it is paused or the result stands", () => {
  const played = victorious()
  const pulse = played.build.pulse!
  const flags = played.build.state.debug
  assert.ok(pulse.busyUntil(1000, flags) !== null, "nothing to draw while it plays")
  played.build.dispatch({ kind: "pulse", control: "toggle" })
  assert.equal(pulse.busyUntil(1000, flags), null, "a paused Pulse kept the timer running")
  played.build.dispatch({ kind: "pulse", control: "toggle" })
  at(played, times(played).homeMs + 10)
  assert.equal(pulse.busyUntil(1000, flags), null, "the timer ran on over a standing result")
})

test("time holds while the terminal is too small to draw it, and the clock starts when the Pulse does", () => {
  const played = play({ plan: DEFENCE })
  const pulse = played.build.pulse!
  // The first advance only starts the clock — a Pulse is at zero when it begins, however long ago the screen did.
  played.build.advance(1_000_000)
  assert.equal(pulse.timeMs, 0)
  played.build.advance(1_002_000)
  assert.equal(pulse.timeMs, 2000)
  played.build.advance(1_030_000, true)
  assert.equal(pulse.timeMs, 2000, "the Pulse ran on behind the resize gate")
  played.build.advance(1_031_000)
  assert.equal(pulse.timeMs, 3000, "it did not resume from where it was held")
})

test("starting over from the game menu is a fresh Build Phase with the Experiments kept; committing again plays a new Pulse", () => {
  const played = play({ plan: DEFENCE, raid: 1 })
  assert.equal(played.build.state.debug.raid, "none")
  const first = played.build.pulse
  played.build.handleData(ESC, played.layout)
  played.build.handleData("r", played.layout)
  assert.equal(played.build.state.committed, false)
  assert.equal(played.build.pulse, null, "the Pulse outlived the Build Phase it came from")
  assert.deepEqual(played.build.state.planned, [])
  assert.equal(played.build.state.debug.raid, "none", "restarting lost an Experiment")
  assert.match(screenText(played), /\[1\] Barracks/, "the Build Phase's menu is not back")
  prepare(played.build)
  played.build.run([{ kind: "commit" }, { kind: "confirm-commit", accept: true }])
  assert.ok(played.build.pulse !== null && played.build.pulse !== first, "a new Pulse did not start")
})

test("a Pulse the kernel cannot start from undoes the commit and says why, rather than leaving a dead screen", () => {
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = new BuildSession({
    context,
    cursor: SPIKE_START_CURSOR,
    viewport: layout.viewport,
    startPulse: () => {
      throw new Error("no room for the units")
    },
  })
  build.run([{ kind: "pick-nexus", index: 0 }, { kind: "commit" }, { kind: "confirm-commit", accept: true }])
  assert.equal(build.state.committed, false, "the commit stood with no Pulse behind it")
  assert.equal(build.pulse, null)
  assert.equal(build.state.status.tone, "danger")
  assert.match(build.state.status.text, /The Nexus Pulse could not start: no room for the units/)
  // The plan is still editable: they can fix it and try again.
  build.dispatch({ kind: "arm", index: 0 })
  assert.equal(build.state.armed, 0)
})

test("a session with nothing to start a Pulse still freezes the plan and draws the committed screen", () => {
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = new BuildSession({ context, cursor: SPIKE_START_CURSOR, viewport: layout.viewport })
  build.run([{ kind: "pick-nexus", index: 0 }, { kind: "commit" }, { kind: "confirm-commit", accept: true }])
  assert.equal(build.state.committed, true)
  assert.equal(build.pulse, null)
  const text = frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))
  assert.match(text, /BUILD COMMITTED/)
})

test("nobody draws the Pulse in the Build Phase, and the Build Phase's frame is untouched by it", () => {
  const session = newSession()
  const plain = frameToText(composeBuildFrame({ context: session.context, state: session.build.state, layout: session.layout }, "monochrome"))
  assert.match(plain, /TERMINAL NEXUS build phase/)
  assert.doesNotMatch(plain, /NEXUS PULSE|Watch again/)
  assert.equal(session.build.pulse, null)
  assert.equal(session.build.pulseFrame(session.layout), undefined)
})
