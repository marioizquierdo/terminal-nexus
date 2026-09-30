// The Nexus Pulse on the Build Phase's screen — gate 6A. What a player sees and can do once the plan is
// committed: the screen it becomes, the ending's words at each moment of it, the playback keys and the
// panel rows a click reaches, where the view looks, and the way back to a fresh Build Phase. Driven through
// the real session (the keyboard and mouse adapters, the reducer and the presenter), with the screen's clock
// handed in as a number, so a whole Pulse plays in a millisecond.

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_START_CURSOR } from "../src/build/catalog.ts"
import { centreOn } from "../src/build/camera.ts"
import { EXPERIMENT_FIELDS, experimentRow } from "../src/build/experiments.ts"
import { escLabelSpan, escLabel, pulseControlRows } from "../src/build/layout.ts"
import { MOUSE_RIGHT } from "../src/build/mouse.ts"
import { BuildSession } from "../src/build/session.ts"
import { nexusTile } from "../src/build/state.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { buildLayout } from "../src/build/layout.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import { frameToAnsi, frameToText } from "../src/view/frame.ts"
import type { CellStyle, ReadonlyCellFrame } from "../src/view/frame.ts"
import { CAPABILITY_MODES } from "../src/view/index.ts"
import { BEAM_PERIOD_MS, TIMER_HALF_PERIOD_MS } from "../src/view/ending.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { isColourCode, sgrCodes } from "./helpers.ts"
import { DEFENCE, MINIMUM, at, atHome, click, frameOf, newSession, play, prepare, screenText } from "./pulse-helpers.ts"
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
  return pulse.times()
}

/** The frame's cells that satisfy `test`, each with the screen position it is drawn at. */
const cellsWhere = (frame: ReadonlyCellFrame, test: (style: CellStyle) => boolean): Array<{ x: number; y: number; style: CellStyle }> =>
  frame.cells.flatMap((cell, index) => (test(cell.style) ? [{ x: index % frame.width, y: Math.floor(index / frame.width), style: cell.style }] : []))

/** The timer's cells: the reversed ones inside the panel, west of the Grid. (Reversed video is also the
 *  cursor's and a spark's, out on the map.) */
const timerCells = (frame: ReadonlyCellFrame, layout: BuildLayout) =>
  cellsWhere(frame, (style) => style.inverse === true).filter((cell) => cell.x < layout.gridBox.left)

/** The light's cells: the tinted ones on the Grid's border. */
const lightCells = (frame: ReadonlyCellFrame, layout: BuildLayout) => {
  const box = layout.gridBox
  return cellsWhere(frame, (style) => style.tint?.role === "fx.flash").filter(
    (cell) => cell.x === box.left || cell.x === box.right || cell.y === box.top || cell.y === box.bottom,
  )
}

test("answering yes turns the screen into the Nexus Pulse, with the keyboard on the map", () => {
  const played = victorious()
  const { state } = played.build
  assert.equal(state.committed, true)
  assert.equal(state.focus, "grid", "the keyboard is not on the map, so the arrows would move a menu highlight")
  assert.equal(state.armed, null)
  const text = screenText(played)
  assert.match(text, /TERMINAL NEXUS nexus pulse/)
  assert.match(text, /^\| NEXUS PULSE 1 +\d:\d\d +[|+]/m)
  assert.match(text, /^\| time left {2}1x/m)
  assert.match(text, /YOU {3}5 \[#+\]/)
  assert.match(text, /RAID {2}7 \[#+\]/)
  assert.match(text, /\[space\] Pause/)
  assert.match(text, /\[r\] Watch again/)
  // The bottom bar's one line is the Pulse's own (feedback F59); its keys are on the Controls page.
  assert.doesNotMatch(text, /space pause {2}\[ \] speed/)
  assert.match(text, /Nexus Pulse - 5 of yours against 7 of the raid\./)
  assert.match(text, /menu \[esc\]/)
  // The Build Phase's menu is gone: nothing left to build, nothing to pick.
  assert.doesNotMatch(text, /\[1\] Barracks|\$ \d|\[e\] Explore Map/)
})

test("the view is centred on the player's Nexus when the Pulse starts, wherever they had scrolled", () => {
  const session = newSession()
  prepare(session.build)
  session.build.run([
    { kind: "focus", target: "grid" },
    { kind: "move-cursor", dx: 40, dy: 14 },
    { kind: "move-cursor", dx: 20, dy: 10 },
  ])
  assert.ok(session.build.state.camera.x > 0, "the player did not scroll away")
  session.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  session.build.advance(0)
  const nexus = nexusTile(session.context)
  assert.ok(nexus !== null)
  assert.deepEqual(session.build.state.cursor, nexus, "the cursor did not come to the Nexus")
  assert.deepEqual(
    session.build.state.camera,
    centreOn(nexus, session.build.state.viewport, session.context.grid),
    "the view is not centred on the Nexus",
  )
})

test("the ending says what is happening in words at every moment: the last seconds, cease fire, recall, the result", () => {
  const played = victorious()
  const moments = times(played)
  assert.ok(moments.warnMs !== null && moments.warnMs < moments.stopMs)

  at(played, 500)
  assert.doesNotMatch(screenText(played), /about to end|CEASE FIRE|RECALL|VICTORY/)

  // The last seconds: the title is still the Pulse's, with the time left beside it, and the status line
  // says the end is near in plain words — no banner, nothing that needs a flash or a colour to be read.
  at(played, moments.warnMs + 40)
  const final = screenText(played)
  assert.match(final, /TERMINAL NEXUS nexus pulse\b/)
  assert.match(final, /^\| NEXUS PULSE 1 +0:0[123] +[|+]/m)
  assert.match(final, /The Pulse is about to end\./)
  assert.doesNotMatch(final, /PULSE ENDING|hold your fire/)

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

test("the timer counts down the seconds left to the last shot, and its last second reads 0:01", () => {
  const played = victorious()
  const moments = times(played)
  const stop = Math.ceil(moments.stopMs / 1000)
  const clock = (ms: number): string => {
    at(played, ms)
    return /^\| NEXUS PULSE 1 +(\d:\d\d) +[|+]/m.exec(screenText(played))?.[1] ?? "none"
  }
  const m = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
  assert.equal(clock(0), m(stop))
  assert.equal(clock(1000), m(stop - 1))
  assert.equal(clock(moments.stopMs - 1), "0:01", "the last second reads 0:01, not 0:00")
})

test("a lost Pulse and a timed-out one say so plainly, and a draw is a draw", () => {
  const lost = play()
  atHome(lost)
  assert.match(screenText(lost), /^\| DEFEAT /m)
  assert.match(screenText(lost), /Your force was wiped out\./)
  // Nobody left to walk home is said as that, not as "0 of yours".
  assert.match(screenText(lost), /None of yours came home\./)
  assert.doesNotMatch(screenText(lost), /\b0 of yours came home/)

  const nexusFell = play({ crew: 1 })
  atHome(nexusFell)
  assert.match(screenText(nexusFell), /^\| DEFEAT /m)
  assert.match(screenText(nexusFell), /Your Nexus was destroyed\./)

  const timedOut = play({ raid: 1 })
  at(timedOut, 0)
  // A scheduled ending reads like a sudden one: it too gets its last seconds, ahead of the stop.
  at(timedOut, times(timedOut).warnMs! + 40)
  assert.match(screenText(timedOut), /The Pulse is about to end\./)
  at(timedOut, times(timedOut).homeMs + 100)
  assert.match(screenText(timedOut), /^\| TIME'S UP /m)
  assert.match(screenText(timedOut), /The time ran out before either side won\./)

  const draw = play({ plan: [DEFENCE[0]!] })
  atHome(draw)
  assert.match(screenText(draw), /^\| DRAW /m)
})

test("at 80x24 the result's words are never cut off, whichever way the Pulse ended", () => {
  // The status line is one row, 76 characters wide; the panel's text is 27 columns and its prose keeps the
  // last one clear, so nothing touches the divider. A result that ran off the edge would be one nobody could read.
  const scenarios = [{}, { plan: DEFENCE }, { raid: 1 }, { crew: 1 }, { raid: 2 }, { plan: [DEFENCE[0]!] }] as const
  for (const scenario of scenarios) {
    const played = play(scenario)
    atHome(played)
    const lines = screenText(played).split("\n")
    const name = JSON.stringify(scenario)
    const statusRows = lines.filter((line) => /^\| (VICTORY|DEFEAT|DRAW|TIME'S UP) - /.test(line))
    assert.equal(statusRows.length, 1, `${name}: the status line is missing`)
    assert.match(statusRows[0]!, /came home\. +\|$/, `${name}: the status line is cut off: ${statusRows[0]}`)
    const first = lines.findIndex((line) => /^\| (VICTORY|DEFEAT|DRAW|TIME'S UP) +[|+]/.test(line))
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

test("reduced motion holds the timer and the light steady and puts the survivors home the moment the walk begins", () => {
  const played = victorious()
  played.build.dispatch({ kind: "setting-adjust", field: "reducedMotion", step: 1 })
  assert.equal(played.build.state.settings.reducedMotion, true)
  const moments = times(played)
  const shown = (ms: number): string => {
    at(played, ms)
    const frame = frameOf(played, "truecolor")
    return JSON.stringify([timerCells(frame, played.layout), lightCells(frame, played.layout)])
  }
  const first = shown(moments.warnMs! + 10)
  assert.ok(JSON.parse(first)[0].length > 0, "the timer is not held lit")
  assert.ok(JSON.parse(first)[1].length > 0, "the light is not on")
  for (let ms = moments.warnMs! + 500; ms < moments.stopMs - 50; ms += 173) {
    assert.equal(shown(ms), first, `the timer or the light moved at ${ms} ms`)
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

test("the timer is the only thing that flashes: it goes inverse in the last seconds and nothing else on screen does", () => {
  const played = victorious()
  const moments = times(played)
  const inverse = (ms: number) => {
    at(played, ms)
    return timerCells(frameOf(played, "truecolor"), played.layout)
  }
  assert.equal(inverse(500).length, 0, "something was reversed before the last seconds")
  const seen = new Set<number>()
  for (let ms = moments.warnMs! + 10; ms < moments.stopMs; ms += 50) {
    const cells = inverse(ms)
    seen.add(cells.length)
    // Never more than the four characters of `0:03`, and always on the title's row.
    assert.ok(cells.length <= 4, `${cells.length} cells flashed at ${ms} ms: more than the timer`)
    assert.ok(cells.every((cell) => cell.y === played.layout.panelRow), `something other than the timer flashed at ${ms} ms`)
  }
  assert.ok(seen.has(0) && [...seen].some((count) => count > 0), "the timer never flashed on and off")
  assert.equal(inverse(moments.stopMs + 20).length, 0, "it kept flashing after the fight stopped")
})

test("the timer's blink is slow: lit for 0.3 s, then plain for the next 0.3 s — a racing game's clock, not a strobe", () => {
  // A Pulse's time only moves forward, so this one starts from the top.
  const played = victorious()
  const moments = times(played)
  const lit = (ms: number): number => {
    at(played, ms)
    return timerCells(frameOf(played, "truecolor"), played.layout).length
  }
  assert.ok(lit(moments.warnMs! + 20) > 0, "the timer is not lit as the last seconds begin")
  assert.equal(lit(moments.warnMs! + 20 + TIMER_HALF_PERIOD_MS), 0)
  assert.ok(lit(moments.warnMs! + 20 + 2 * TIMER_HALF_PERIOD_MS) > 0)
})

test("a light sweeps the map's border in the last seconds, and goes out soon after the shooting stops", () => {
  const played = victorious()
  const moments = times(played)
  const lightAt = (ms: number) => {
    at(played, ms)
    return lightCells(frameOf(played, "truecolor"), played.layout)
  }
  assert.equal(lightAt(500).length, 0, "there was light before the last seconds")
  const one = lightAt(moments.warnMs! + 800)
  assert.ok(one.length > 20, `only ${one.length} border cells were lit`)
  // A turn later it has moved on: the brightest cell is somewhere else.
  const brightest = (cells: typeof one): number => cells.reduce((best, cell) => Math.max(best, cell.style.tint!.amount), 0)
  const head = (cells: typeof one) => cells.find((cell) => cell.style.tint!.amount === brightest(cells))
  const later = lightAt(moments.warnMs! + 800 + 500)
  assert.notDeepEqual([head(one)?.x, head(one)?.y], [head(later)?.x, head(later)?.y], "the light did not move")
  const again = lightAt(moments.warnMs! + 800 + BEAM_PERIOD_MS)
  assert.deepEqual([head(one)?.x, head(one)?.y], [head(again)?.x, head(again)?.y], "one turn is not one period")
  // It goes out soon after the shooting stops, and never lights a glyph: every cell it touches is a tint only.
  assert.ok(lightAt(moments.stopMs + 20).length > 0, "the light went out the instant the shooting stopped")
  assert.equal(lightAt(moments.stopMs + 1000).length, 0, "the light stayed on after the fight")
})

test("the ending is plain to see at every colour depth: monochrome uses bold and reversed video, never a colour code", () => {
  for (const capability of CAPABILITY_MODES) {
    // A Pulse's time only moves forward, so each depth plays its own from the top.
    const played = victorious()
    const moments = times(played)
    const ansiAt = (ms: number): string => {
      at(played, ms)
      return frameToAnsi(frameOf(played, capability), capability)
    }
    const lit = ansiAt(moments.warnMs! + 20)
    const dark = ansiAt(moments.warnMs! + 20 + TIMER_HALF_PERIOD_MS)
    const phases = { lit, dark, ceaseFire: ansiAt(moments.stopMs + 500), recall: ansiAt(moments.walkMs + 20), result: ansiAt(moments.homeMs + 20) }
    if (capability === "monochrome") {
      for (const [phase, ansi] of Object.entries(phases)) {
        assert.ok(!sgrCodes(ansi).some(isColourCode), `${phase}: monochrome emitted a colour code`)
      }
    }
    assert.ok(sgrCodes(lit).includes(7), `${capability}: the lit timer is not reversed video`)
    assert.notEqual(lit, dark, `${capability}: the timer's flash cannot be seen`)
    // The phases are told apart by their words as much as by anything drawn: each screen differs from the last.
    assert.equal(new Set(Object.values(phases)).size, 5, `${capability}: two moments of the ending look the same`)
  }
})

test("red is for the player's Nexus being hurt: faint, brief, and never under reduced motion", () => {
  // A Nexus that falls: the raid gets through an undefended base.
  const redLevels = (played: Played, mutate: (played: Played) => void = () => {}): number[] => {
    at(played, 0)
    mutate(played)
    const levels: number[] = []
    for (let ms = 0; ms < times(played).homeMs + 400; ms += 25) {
      at(played, ms)
      levels.push(played.build.pulseFrame(played.layout)!.redAlert)
    }
    return levels
  }
  const fell = redLevels(play({ crew: 1 }))
  assert.equal(fell[0], 0, "the border was red before anything was hit")
  assert.ok(Math.max(...fell) > 0, "a Nexus that fell never flashed red")
  assert.ok(Math.max(...fell) <= 0.6, `the red reached ${Math.max(...fell)}: it should stay a faint tint`)
  const redFrames = fell.filter((level) => level > 0).length
  assert.ok(redFrames < fell.length / 3, `red for ${redFrames} of ${fell.length} frames is not brief`)

  // A Pulse the player's Nexus never suffers in is never red: the last seconds are light, not alarm.
  const safe = redLevels(play({ plan: DEFENCE }))
  assert.equal(Math.max(...safe), 0, "the border went red in a Pulse that was won cleanly")

  // Under reduced motion it is gone, every flash of it being said again in words. (It was an Experiment
  // that could switch it off until the owner kept it, 2026-09-30.)
  const still = redLevels(play({ crew: 1 }), (played) => played.build.dispatch({ kind: "setting-adjust", field: "reducedMotion", step: 1 }))
  assert.equal(Math.max(...still), 0, "red under reduced motion")
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
  assert.equal(played.build.state.popup, "game-menu")
  for (const bytes of ["]", "[", ",", "."]) key(bytes, 11_000)
  assert.equal(pulse.speed, 0.5, "a speed key reached the Pulse through a popup")
  key(" ", 11_000)
  assert.equal(pulse.paused, false, "Space under a popup paused the Pulse")
  for (let step = 0; step < 3 && played.build.state.popup !== null; step += 1) key(ESC, 11_000)
  assert.equal(played.build.state.popup, null)
})

test("nothing that edits the plan works once the Pulse is on screen, and q still asks", () => {
  const played = victorious()
  const planned = played.build.state.planned
  const key = (bytes: string): void => played.build.handleData(bytes, played.layout)
  for (const bytes of ["1", "2", "3", "u", "\u007f", "p", "e", "n", "\t"]) key(bytes)
  assert.deepEqual(played.build.state.planned, planned)
  assert.equal(played.build.state.committed, true)
  assert.equal(played.build.state.popup, null, "a key opened a popup over the Pulse")
  key("q")
  assert.equal(played.build.state.popup, "game-menu", "q did not open the game menu")
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

test("once the result stands there is nothing to pause: Space and a click on the row where Pause was do nothing", () => {
  const played = victorious()
  const pulse = played.build.pulse!
  atHome(played)
  assert.equal(pulse.paused, false)
  played.build.handleData(" ", played.layout)
  assert.equal(pulse.paused, false, "Space paused a Pulse whose result was standing")
  const [pause, again] = pulseControlRows(played.layout)
  click(played, played.layout.panelColumn + 3, pause!.row)
  assert.equal(pulse.paused, false, "a click on the blank Pause row paused it")
  // Watch again still works from there, and the Pause row is back with the Pulse.
  click(played, played.layout.panelColumn + 3, again!.row)
  assert.equal(pulse.timeMs, 0)
})

test("the top bar's Esc label and Esc open the game menu over a Pulse too; x and a right click never do", () => {
  const played = victorious()
  assert.equal(escLabel(played.build.state), "menu [esc]")
  const hint = escLabelSpan(played.layout, "menu [esc]")
  click(played, hint.from + 2, hint.row)
  assert.equal(played.build.state.popup, "game-menu")
  // A right click walks back as x does: it closes the game menu...
  click(played, 40, 12, MOUSE_RIGHT)
  assert.equal(played.build.state.popup, null)
  // ...and with nothing open it does nothing, nor does x — only Esc (and q, and the label) open the menu
  // (owner, 2026-09-30, feedback F62: a right click was one of the ways in until then).
  click(played, 40, 12, MOUSE_RIGHT)
  played.build.handleData("x", played.layout)
  assert.equal(played.build.state.popup, null)
  played.build.handleData(ESC, played.layout)
  assert.equal(played.build.state.popup, "game-menu")
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

test("the view looks at the Nexus again when the last seconds start", () => {
  const played = victorious()
  const moments = times(played)
  at(played, moments.warnMs! - 200)
  // The player looks around: far to the east, then south.
  played.build.run([{ kind: "move-cursor", dx: 30, dy: 12 }])
  assert.notDeepEqual(played.build.state.cursor, nexusTile(played.context), "the player did not look away")
  at(played, moments.warnMs! + 50)
  assert.deepEqual(played.build.state.cursor, nexusTile(played.context), "the last seconds did not bring the view back to the Nexus")
})

test("Watch again replays from the top and frames the view again", () => {
  const played = victorious()
  const moments = times(played)
  at(played, moments.homeMs + 500)
  played.build.run([{ kind: "move-cursor", dx: 30, dy: 12 }])
  assert.match(screenText(played), /^\| VICTORY /m)
  played.build.dispatch({ kind: "pulse", control: "restart" })
  at(played, moments.homeMs + 600)
  assert.match(screenText(played), /^\| NEXUS PULSE /m)
  assert.deepEqual(played.build.state.cursor, nexusTile(played.context), "the view was not framed again")
})

test("the last three seconds warn, and `d` over a Pulse opens Settings at the placeholder Pulse's raid", () => {
  const played = victorious()
  const moments = times(played)
  at(played, moments.stopMs - 1500)
  assert.match(screenText(played), /about to end/, "the warning of three seconds")
  const frame = frameOf(played, "truecolor")
  assert.ok(timerCells(frame, played.layout).length + lightCells(frame, played.layout).length > 0, "the warning shows nothing")

  played.build.handleData("d", played.layout)
  assert.equal(played.build.state.popup, "settings")
  assert.equal(played.build.state.popupHighlight, experimentRow("raid"), "d did not open at the placeholder Pulse's Experiments")
  assert.match(screenText(played), /Raid\s+<\s+probe\s+>/)
  // Before a Pulse it is still the first Experiment.
  const before = newSession()
  before.build.handleData("d", before.layout)
  assert.equal(before.build.state.popupHighlight, experimentRow(EXPERIMENT_FIELDS[0]!.field))
})

test("the frame timer runs while the Pulse plays, and stops when it is paused or the result stands", () => {
  const played = victorious()
  const pulse = played.build.pulse!
  assert.ok(pulse.busyUntil(1000) !== null, "nothing to draw while it plays")
  played.build.dispatch({ kind: "pulse", control: "toggle" })
  assert.equal(pulse.busyUntil(1000), null, "a paused Pulse kept the timer running")
  played.build.dispatch({ kind: "pulse", control: "toggle" })
  at(played, times(played).homeMs + 10)
  assert.equal(pulse.busyUntil(1000), null, "the timer ran on over a standing result")
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
  assert.equal(played.build.state.experiments.raid, "none")
  const first = played.build.pulse
  played.build.handleData(ESC, played.layout)
  played.build.handleData("r", played.layout)
  assert.equal(played.build.state.committed, false)
  assert.equal(played.build.pulse, null, "the Pulse outlived the Build Phase it came from")
  assert.deepEqual(played.build.state.planned, [])
  assert.equal(played.build.state.experiments.raid, "none", "restarting lost an Experiment")
  assert.match(screenText(played), /\[1\] Barracks/, "the Build Phase's menu is not back")
  prepare(played.build)
  played.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
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
  build.run([{ kind: "pick-nexus", index: 0 }, { kind: "open-battle-round" }, { kind: "start-pulse" }])
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
  build.run([{ kind: "pick-nexus", index: 0 }, { kind: "open-battle-round" }, { kind: "start-pulse" }])
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
