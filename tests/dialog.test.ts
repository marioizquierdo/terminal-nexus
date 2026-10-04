// The dialog and the intro highlight (the owner's Commander round 2: "Vasse is visible on the map. She should
// have an intro highlight when she shows up ... perhaps a new type of popup at the bottom that shows dialogs").
//
// A mission's lines as data (`say` at `build.start`, checked when the mission loads and never read by the
// runner); a round's scene in the Build Phase's context; **the dialog** — the popup the player does not open,
// docked at the bottom of the map, read on by Enter, Space or a click and skipped by Esc, the camera on each
// line's focus and the Build Phase afterwards exactly as the round opened it; **the intro highlight** around
// that focus, in its three forms; the line the game says when a Commander comes back (the named scenario,
// `tests/commander-fixture.ts`); the Activity Logs that say whether it was read; and Vasse bold at full
// strength while a Pulse plays.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import {
  STARTER_ALLOTMENT,
  STARTER_CATALOG,
  STARTER_NEXUS_DRAFT,
  STARTER_STANDING,
  STARTER_START_CURSOR,
  starterGrid,
} from "../src/build/catalog.ts"
import { centreOn } from "../src/build/camera.ts"
import { buildKeyboardCommand } from "../src/build/keyboard.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import { buildLayout, cellForTile, escLabel } from "../src/build/layout.ts"
import { MOUSE_LEFT, buildMouseCommand } from "../src/build/mouse.ts"
import type { PlacedPopup } from "../src/build/popup.ts"
import { placePopup, popupHitAt, popupSpec } from "../src/build/popup.ts"
import type { BuildContext } from "../src/build/state.ts"
import { applyBuildCommand, createBuildState, nexusTile } from "../src/build/state.ts"
import { runBuildPhase } from "../src/cli/build-phase.ts"
import type { MissionPlay } from "../src/cli/pulse-run.ts"
import { STARTER_MISSION, missionPlay } from "../src/cli/pulse-run.ts"
import { starterContext } from "../src/cli/starter.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { tilesOf } from "../src/grid/coords.ts"
import type { Coord } from "../src/grid/types.ts"
import { ACTIVITY_FILTERS, filteredEntries } from "../src/log/activity.ts"
import { recall, resolveMissionPulse } from "../src/match/index.ts"
import type { MissionPulse } from "../src/match/index.ts"
import { PERIMETER } from "../src/bundles/index.ts"
import { MissionError, SAY_COLUMNS, SAY_LINES, sayLines, sceneOf, validateMission } from "../src/mission/index.ts"
import type { MissionDefinition, TriggerAction, TriggerDefinition } from "../src/mission/index.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import { hashState } from "../src/state/serialize.ts"
import type { MatchState } from "../src/state/types.ts"
import { BuildSession } from "../src/view/build-session.ts"
import { BREATH_FRAME_MS, BuildAnimation } from "../src/view/build-live.ts"
import { drawnBold } from "../src/view/compose.ts"
import { EFFECT_RECIPES } from "../src/view/effects/recipes.ts"
import { FOCUS_LIGHT } from "../src/view/effects/shading.ts"
import type { EffectContext, EffectInstance } from "../src/view/effects/types.ts"
import type { ReadonlyCellFrame } from "../src/view/frame.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import { CAPABILITY_MODES, resolveCell } from "../src/view/roles.ts"
import type { CapabilityMode } from "../src/view/roles.ts"
import {
  BACKSPACE,
  CTRL_C,
  DOWN,
  ENTER,
  ESC,
  MAXIMUM,
  MINIMUM,
  ROOMY,
  SPACE,
  TAB,
  WIDE,
  activityLog,
  bottomLineText,
  clickCell,
  clickEscLabel,
  compose,
  keys,
  panelCells,
  rightClickMap,
  screenText,
} from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"
import { COMMANDER_FALLS, VASSE } from "./commander-fixture.ts"

const grid = starterGrid()
const registry = FIXTURE_REGISTRY

/** A Build Phase session as the game opens one — scenes played unless told otherwise — on PERIMETER's first
 *  round, or the context and mission given. */
function sceneSide(
  options: Readonly<{ context?: BuildContext; mission?: Pick<MissionPlay, "startPulse" | "nextRound">; scenes?: boolean; terminal?: Readonly<{ columns: number; rows: number }> }> = {},
): BuildSide {
  const activity = activityLog()
  const context: BuildContext = { ...(options.context ?? starterContext()), activity }
  const layout = buildLayout(options.terminal ?? MINIMUM, context.grid)
  const play = options.mission ?? STARTER_MISSION
  const build = new BuildSession({
    context,
    cursor: STARTER_START_CURSOR,
    viewport: layout.viewport,
    activity,
    startPulse: play.startPulse,
    nextRound: play.nextRound,
    scenes: options.scenes ?? true,
  })
  return { build, layout, context, quits: () => 0, activity }
}

/** The dialog as drawn and hit-tested, on the session's own round. */
function dialogBox(side: BuildSide): PlacedPopup {
  const spec = popupSpec(side.build.round, side.build.state)
  assert.ok(spec !== null && side.build.state.popup === "dialog", "no dialog is open")
  return placePopup(side.layout, spec)
}

/** The text across a frame row, from a column, `length` cells long. */
const rowText = (frame: ReadonlyCellFrame, row: number, from: number, length: number): string =>
  Array.from({ length }, (_, index) => cellAt(frame, from + index, row).glyph).join("")

/** A Nexus power picked and the round's Pulse started, nothing built; then played to its result. */
function playRound(side: BuildSide): void {
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  const pulse = side.build.pulse
  assert.ok(pulse !== null, "the round's Pulse did not start")
  side.build.advance(0)
  side.build.advance(pulse.times.homeMs + 100)
  assert.equal(pulse.phase(), "home")
}

/** The named scenario's first round on the starter map: Vasse falls in round 1 and is back for round 3. */
function fixtureSide(scenes = true): BuildSide {
  const play = missionPlay(COMMANDER_FALLS)
  const context = play.firstRound({
    grid,
    registry,
    catalog: STARTER_CATALOG,
    standing: STARTER_STANDING,
    allotment: STARTER_ALLOTMENT,
    nexusDraft: STARTER_NEXUS_DRAFT,
  })
  return sceneSide({ context, mission: play, scenes })
}

// --- A mission's lines, as data -----------------------------------------------------------------------

test("PERIMETER's round 1 has the intro's four lines, in order, every word already written in the campaign design", () => {
  assert.deepEqual(
    sceneOf(PERIMETER, 1).map((line) => [line.speaker, line.text]),
    [
      [VASSE, "By the book. The new book."],
      ["Corvane", "Nice fence, roadmakers. We brought wire cutters."],
      [VASSE, "It is not our fence I would worry about."],
      ["Corvane", "...Why is your pyramid looking at me?"],
    ],
  )
  assert.deepEqual(sceneOf(PERIMETER, 2), [])
  assert.deepEqual(sceneOf(PERIMETER, 3), [])
  // In trigger order, and in a trigger's own order.
  const twice: MissionDefinition = {
    ...PERIMETER,
    triggers: [
      { id: "first", when: { event: "build.start", pulse: 2 }, do: [say("Corvane", "One."), say("Corvane", "Two.")] },
      ...PERIMETER.triggers,
      { id: "last", when: { event: "build.start", pulse: 2 }, do: [say("Corvane", "Three.")] },
    ],
  }
  assert.deepEqual(sceneOf(twice, 2).map((line) => line.text), ["One.", "Two.", "Three."])
})

test("every PERIMETER line fits the dialog at 80 x 24: the text budget is the dialog's own width", () => {
  const side = sceneSide()
  assert.equal(dialogBox(side).textLimit, SAY_COLUMNS, "the mission's text budget and the dialog's width disagree")
  for (const line of sceneOf(PERIMETER, 1)) assert.ok(sayLines(line.text).length <= SAY_LINES, line.text)
})

/** A line by `speaker`, looking at the Nexus. */
function say(speaker: string, text: string, focus: Record<string, string> = { region: "nexus" }): TriggerAction {
  return { say: { speaker, text, focus } } as TriggerAction
}

const problemsOf = (mission: MissionDefinition): readonly string[] => {
  try {
    validateMission(mission, grid, registry)
    return []
  } catch (error) {
    assert.ok(error instanceof MissionError, `not a MissionError: ${String(error)}`)
    return error.problems
  }
}

const withTriggers = (...extra: readonly TriggerDefinition[]): MissionDefinition => ({ ...PERIMETER, triggers: [...PERIMETER.triggers, ...extra] })
const at = (pulse: number) => ({ event: "build.start" as const, pulse })

test("validation refuses every broken line by name, and reports them all at once", () => {
  const long = Array.from({ length: 40 }, () => "word").join(" ")
  const cases: readonly (readonly [string, MissionDefinition, RegExp])[] = [
    ["a line at a moment of a Pulse", withTriggers({ id: "t", when: { pulse: 1, tick: 0 }, do: [say("Corvane", "Now.")] }), /must wait for a Build Phase to open \(build\.start\)/],
    ["a line at a Pulse's end", withTriggers({ id: "t", when: { event: "pulse.end", pulse: 1 }, do: [say("Corvane", "Done.")] }), /must wait for a Build Phase to open/],
    ["no speaker", withTriggers({ id: "t", when: at(1), do: [say("", "Hm.")] }), /has no speaker/],
    ["no words", withTriggers({ id: "t", when: at(1), do: [say("Corvane", "   ")] }), /says nothing/],
    ["too long for the dialog", withTriggers({ id: "t", when: at(1), do: [say("Corvane", long)] }), /too long for the dialog: it takes \d+ lines of 42 columns at 80 x 24, and the dialog holds 3/],
    ["an unknown region", withTriggers({ id: "t", when: at(1), do: [say("Corvane", "There.", { region: "moon" })] }), /looks at the unknown region "moon"/],
    ["a group not there yet", withTriggers({ id: "t", when: at(1), do: [say("Corvane", "Them.", { group: "push" })] }), /looks at the group "push", which no trigger brings by round 1/],
    ["a unit not there yet", withTriggers({ id: "t", when: at(1), do: [say("Corvane", "That.", { unit: "unit.ravel.slinger" })] }), /looks at "unit\.ravel\.slinger", which no trigger brings by round 1/],
    ["an unknown unit", withTriggers({ id: "t", when: at(1), do: [say("Corvane", "That.", { unit: "unit.nope" })] }), /looks at the unknown content id "unit\.nope"/],
    ["two things at once", withTriggers({ id: "t", when: at(1), do: [say("Corvane", "Both.", { unit: VASSE, region: "nexus" })] }), /looks at 2 things at once/],
    ["a mistyped speaker", withTriggers({ id: "t", when: at(1), do: [say("unit.citizen.vase", "Hm.")] }), /names the unknown speaker "unit\.citizen\.vase"/],
    ["a building speaking", withTriggers({ id: "t", when: at(1), do: [say("structure.citizen.barracks", "Hm.")] }), /has the structure "structure\.citizen\.barracks" speak/],
    ["a speaker not there yet", withTriggers({ id: "t", when: at(1), do: [say("unit.ravel.slinger", "Soon.")] }), /has "unit\.ravel\.slinger" speak, which no trigger brings by round 1/],
    ["an unknown side", withTriggers({ id: "t", when: at(1), do: [{ say: { speaker: "Corvane", side: "C", text: "Hm." } } as unknown as TriggerAction] }), /names the unknown side "C"/],
    ["a round the mission does not have", withTriggers({ id: "t", when: at(4), do: [say("Corvane", "Later.")] }), /waits for the Build Phase of round 4, but the mission has rounds 1 to 3/],
    [
      "a spawn as a Build Phase opens",
      withTriggers({ id: "t", when: at(2), do: [{ spawn: { side: "B", units: [{ unit: "unit.ravel.runner", count: 1 }], at: "ridge" } }] }),
      /action 1 \(spawn\) cannot run when a Build Phase opens: only a line of dialog \(say\) can/,
    ],
    ["a win as a Build Phase opens", withTriggers({ id: "t", when: at(2), do: [{ win: true }] }), /action 1 \(win\) cannot run when a Build Phase opens/],
  ]
  for (const [name, mission, expected] of cases) {
    const problems = problemsOf(mission)
    assert.ok(problems.some((problem) => expected.test(problem)), `${name}: ${JSON.stringify(problems)}`)
    // Each by its trigger and action.
    assert.ok(problems.every((problem) => /^trigger "t", action \d+ \((say|spawn|win)\)|^trigger "t" /.test(problem)), `${name}: ${JSON.stringify(problems)}`)
  }
  // Every problem at once, not just the first.
  const many = withTriggers({ id: "t", when: at(1), do: [say("", " ", { region: "moon" }), say("unit.nope.x", long, { group: "ghosts" })] })
  assert.ok(problemsOf(many).length >= 5, JSON.stringify(problemsOf(many)))
  // And a group or a unit some trigger brings by the round is fine — the probe, Vasse.
  assert.deepEqual(problemsOf(withTriggers({ id: "t", when: at(1), do: [say("Corvane", "You.", { group: "probe" }), say(VASSE, "Me.", { unit: VASSE })] })), [])
})

/** A whole mission, round by round, with Recall between them: nothing planned, as the hash test in
 *  tests/mission.test.ts plays it. */
function playMission(mission: MissionDefinition): MissionPulse[] {
  const pulses: MissionPulse[] = []
  let carried: MatchState | null = null
  for (let pulse = 1; pulse <= mission.pulses; pulse += 1) {
    const run = resolveMissionPulse({ mission, grid, registry, pulse, carried, structures: pulse === 1 ? STARTER_STANDING : [] })
    pulses.push(run)
    if (run.verdict.kind !== "continue") break
    carried = recall(run.final, registry).state
  }
  return pulses
}

test("a mission's lines never change what its Pulses resolve: with or without them, the same states, Pulse by Pulse", () => {
  const shape = (pulses: readonly MissionPulse[]) =>
    pulses.map((pulse) => [pulse.states.map(hashState), pulse.events.length, pulse.verdict, pulse.fired])
  const withLines = shape(playMission(PERIMETER))
  const without: MissionDefinition = { ...PERIMETER, triggers: PERIMETER.triggers.filter((trigger) => trigger.id !== "intro") }
  const more = withTriggers({ id: "chatter", when: at(2), do: [say("Corvane", "Again.", { region: "ridge" })] })
  validateMission(more, grid, registry)
  assert.deepEqual(shape(playMission(without)), withLines, "the intro changed a Pulse")
  assert.deepEqual(shape(playMission(more)), withLines, "a line in round 2 changed a Pulse")
  // The runner never fires a line: its triggers fire in the Pulse, and a line is the Build Phase's.
  assert.ok(playMission(PERIMETER).every((pulse) => pulse.fired.every((fired) => fired.trigger !== "intro")))
})

// --- The dialog --------------------------------------------------------------------------------------

test("PERIMETER's round 1 opens on the dialog when the session plays scenes: Vasse's line, under her name", () => {
  const side = sceneSide()
  const { state } = side.build
  assert.equal(state.popup, "dialog")
  assert.equal(state.dialog?.line, 0)
  assert.deepEqual(
    (side.build.round.scene ?? []).map((line) => [line.speaker, line.side, line.unit]),
    [
      ["Vasse", "A", VASSE],
      ["Corvane", "B", null],
      ["Vasse", "A", VASSE],
      ["Corvane", "B", null],
    ],
  )
  const text = screenText(side, "truecolor")
  assert.match(text, / @ VASSE /)
  assert.match(text, /By the book\. The new book\./)
  assert.match(text, /close \[esc\]/)
  assert.equal(bottomLineText(side), "Line 1 of 4. [enter] next line, [esc] skips the rest.")
  // A session a test builds without scenes opens on the menu, as the screen always has.
  const plain = sceneSide({ scenes: false })
  assert.equal(plain.build.state.popup, null)
  assert.equal(plain.build.round.scene, undefined)
})

test("Enter, Space and a click anywhere read on, line by line; after the last the dialog closes", () => {
  const byKeys = sceneSide()
  keys(byKeys, ENTER)
  assert.equal(byKeys.build.state.dialog?.line, 1)
  assert.match(screenText(byKeys), / CORVANE /)
  assert.match(screenText(byKeys), /Nice fence, roadmakers\. We brought wire/)
  keys(byKeys, SPACE)
  assert.equal(byKeys.build.state.dialog?.line, 2)
  keys(byKeys, ENTER)
  assert.equal(byKeys.build.state.dialog?.line, 3)
  assert.equal(bottomLineText(byKeys), "Line 4 of 4. [enter] or [esc] closes it.")
  keys(byKeys, ENTER)
  assert.equal(byKeys.build.state.popup, null)
  assert.equal(byKeys.build.state.dialog, null)

  // The mouse: on the dialog, on the map, on the menu, on the bottom line — each reads on, so a stray click
  // never skips the scene.
  const byMouse = sceneSide()
  const { layout } = byMouse
  const box = dialogBox(byMouse).box
  const targets: readonly (readonly [string, number, number])[] = [
    ["the dialog", box.left + 4, box.top + 1],
    ["the map", layout.origin.column + 3, layout.origin.row + 2],
    ["the menu", layout.panelColumn + 2, layout.panelRow + 3],
    ["the bottom line", layout.panelColumn + 4, layout.footerRow],
  ]
  for (const [index, [where, column, row]] of targets.entries()) {
    clickCell(byMouse, column, row)
    if (index < 3) assert.equal(byMouse.build.state.dialog?.line, index + 1, `a click on ${where} did not read on`)
  }
  assert.equal(byMouse.build.state.popup, null, "the fourth click did not close the dialog")
  assert.deepEqual(byMouse.build.state, byKeys.build.state, "the mouse and the keys did not end in the same place")
  // As commands: the adapters send `dialog-next` for both, and a driver's clicks read on too.
  const placed = dialogBox(sceneSide())
  assert.deepEqual(popupHitAt(placed, box.left + 4, box.top + 1), { kind: "command", command: { kind: "dialog-next" } })
  const fresh = sceneSide()
  const outside = buildMouseCommand({ button: MOUSE_LEFT, column: layout.origin.column + 3, row: layout.origin.row + 2, press: true }, fresh.build.state.camera, layout, STARTER_CATALOG, {
    popup: placed,
    escLabel: escLabel(fresh.build.state),
  })
  assert.deepEqual(outside, { kind: "dialog-next" })
  fresh.build.run([{ kind: "click-tile", x: 30, y: 20 }, { kind: "click-menu", entry: 2 }])
  assert.equal(fresh.build.state.dialog?.line, 2)
})

test("Esc, x, a right click and the top bar's close [esc] skip the rest, onto the round as it opened", () => {
  const plain = sceneSide({ scenes: false })
  const ways: readonly (readonly [string, (side: BuildSide) => void])[] = [
    ["Esc", (side) => keys(side, ESC)],
    ["x", (side) => keys(side, "x")],
    ["a right click", (side) => rightClickMap(side)],
    ["the top bar's label", (side) => clickEscLabel(side)],
  ]
  for (const [name, skip] of ways) {
    const side = sceneSide()
    keys(side, ENTER)
    skip(side)
    assert.equal(side.build.state.popup, null, `${name} did not close the dialog`)
    assert.deepEqual(side.build.state, plain.build.state, `${name} did not leave the round as it opened`)
  }
})

test("after the dialog the Build Phase is exactly the one a session without scenes opens, and the next key does the same", () => {
  for (const through of [[ENTER, ENTER, ENTER, ENTER], [ESC], [ENTER, ENTER, "x"]]) {
    const side = sceneSide()
    const plain = sceneSide({ scenes: false })
    keys(side, ...through)
    assert.deepEqual(side.build.state, plain.build.state, `after ${JSON.stringify(through)}`)
    for (const key of ["1", "e", DOWN]) {
      keys(side, key)
      keys(plain, key)
      assert.deepEqual(side.build.state, plain.build.state, `${JSON.stringify(key)} after ${JSON.stringify(through)}`)
    }
    assert.equal(screenText(side), screenText(plain))
  }
})

test("each line takes the camera to what it looks at: Vasse, the raid on the ridge, the Nexus", () => {
  const side = sceneSide()
  const round = side.build.round
  const scene = round.scene ?? []
  const vasse = (round.incoming ?? []).find((entity) => entity.contentId === VASSE)
  assert.ok(vasse !== undefined, "she is not arriving with the squads")
  // What each line looks at, on round 1's own map.
  assert.deepEqual(scene[0]?.focus, { tile: vasse.anchor, own: [vasse.anchor] })
  assert.deepEqual(scene[2]?.focus, scene[0]?.focus)
  const raid = (round.incoming ?? []).filter((entity) => entity.player === "B" && entity.tick === 0)
  const raidTiles = raid.flatMap((entity) => tilesOf(entity.anchor, registry.get(entity.contentId).footprint))
  assert.deepEqual(
    [...(scene[1]?.focus?.own ?? [])].sort((a, b) => a.y - b.y || a.x - b.x),
    [...raidTiles].sort((a, b) => a.y - b.y || a.x - b.x),
    "the probe's line does not look at the probe",
  )
  const nexus = scene[3]?.focus
  assert.deepEqual(nexus?.tile, { x: 18, y: 10 })
  assert.equal(nexus?.own.length, 6)
  // The camera centres on each in turn, and the cursor (hidden) goes there: the Pulse's own look-at.
  for (const [index, line] of scene.entries()) {
    const focus = line.focus
    assert.ok(focus !== null)
    assert.equal(side.build.state.dialog?.line, index)
    assert.deepEqual(side.build.state.camera, centreOn(focus.tile, side.layout.viewport, grid), `line ${index + 1}'s camera`)
    assert.deepEqual(side.build.state.cursor, focus.tile)
    keys(side, ENTER)
  }
  // The ridge is far from the base: the view really moved, and came back.
  assert.notDeepEqual(centreOn(scene[1]?.focus?.tile ?? { x: 0, y: 0 }, side.layout.viewport, grid), centreOn(vasse.anchor, side.layout.viewport, grid))
  assert.deepEqual(side.build.state.cursor, STARTER_START_CURSOR)
})

test("while it is open the dialog holds the keyboard: nothing reaches the plan, the menu is unlit and the cursor hidden", () => {
  const side = sceneSide()
  const before = side.build.state
  for (const key of ["1", "2", "n", "e", "s", "p", "u", "d", "?", TAB, DOWN, BACKSPACE]) {
    keys(side, key)
    assert.deepEqual(side.build.state, before, `${JSON.stringify(key)} reached past the dialog`)
  }
  // The keyboard adapter's word for each.
  const context = { itemCount: 3, armed: false, focus: "menu" as const, popup: "dialog" as const }
  assert.deepEqual(buildKeyboardCommand(ENTER, context), { kind: "dialog-next" })
  assert.deepEqual(buildKeyboardCommand(SPACE, context), { kind: "dialog-next" })
  assert.deepEqual(buildKeyboardCommand(ESC, context), { kind: "cancel" })
  assert.deepEqual(buildKeyboardCommand("x", context), { kind: "back" })
  assert.deepEqual(buildKeyboardCommand("q", context), { kind: "open-game-menu" })
  for (const key of ["1", "n", "e", "s", "d", "?", "u"]) assert.equal(buildKeyboardCommand(key, context), null, key)

  // The menu's bar is dark while the dialog has the keyboard, and lights on Explore Map once it closes.
  const frame = compose(side, {}, "truecolor")
  const exploreRow = side.layout.panelRow
  assert.ok(panelCells(side, frame, exploreRow).every((cell) => cell.style.inverse !== true), "the menu is lit under the dialog")
  // No cursor where the line looks (her tile), only her own glyph.
  const her = cellForTile(side.layout, side.build.state.camera, side.build.state.cursor)
  assert.equal(cellAt(frame, her.x, her.y).glyph, "@")
  assert.notEqual(cellAt(frame, her.x, her.y).style.inverse, true, "the map cursor is drawn under the dialog")
  keys(side, ESC)
  assert.ok(panelCells(side, compose(side, {}, "truecolor"), exploreRow).some((cell) => cell.style.inverse === true), "the menu did not light again")
})

test("q opens the game menu over the dialog, and going back from it comes back to the same line", () => {
  const side = sceneSide()
  keys(side, ENTER, "q")
  assert.equal(side.build.state.popup, "game-menu")
  assert.equal(side.build.state.dialog?.line, 1, "the scene was lost to the game menu")
  keys(side, ESC)
  assert.equal(side.build.state.popup, "dialog")
  assert.equal(side.build.state.dialog?.line, 1)
  // Restart, from there, is the mission from round 1: its intro again.
  keys(side, "q", "r")
  assert.equal(side.build.state.popup, "dialog")
  assert.equal(side.build.state.dialog?.line, 0)
})

test("the dialog is docked at the bottom of the map, its height kept through the scene, at every size", () => {
  for (const terminal of [MINIMUM, MAXIMUM, WIDE, ROOMY]) {
    const side = sceneSide({ terminal })
    const { layout } = side
    const heights = new Set<number>()
    for (let line = 0; line < 4; line += 1) {
      const { box } = dialogBox(side)
      const size = `${terminal.columns}x${terminal.rows}`
      // Over the map, its shadow on the map's last row, the bottom line clear below it.
      assert.equal(box.bottom, layout.paneBottom - 2, `${size}: not docked at the bottom`)
      assert.ok(box.left > layout.gridBox.left && box.right + 1 < layout.gridBox.right, `${size}: wider than the map`)
      assert.ok(box.top > layout.gridBox.top, `${size}: taller than the map`)
      heights.add(box.bottom - box.top + 1)
      keys(side, ENTER)
    }
    assert.equal(heights.size, 1, `${terminal.columns}x${terminal.rows}: the dialog changed height as it read on`)
    const [height] = heights
    assert.ok(height !== undefined && height >= 3 && height <= 5, `${height} rows`)
  }
})

test("the speaker's name is in the border, inverse in their side's colour, their glyph beside it when they stand on the map", () => {
  const side = sceneSide()
  for (const [name, role, glyph] of [
    ["VASSE", "player.a", "@"],
    ["CORVANE", "player.b", null],
  ] as const) {
    const frame = compose(side, {}, "truecolor")
    const { box } = dialogBox(side)
    const title = glyph === null ? ` ${name} ` : ` ${glyph} ${name} `
    assert.equal(rowText(frame, box.top, box.left + 2, title.length), title)
    for (let x = box.left + 2; x < box.left + 2 + title.length; x += 1) {
      const cell = cellAt(frame, x, box.top)
      assert.equal(cell.style.fgRole, role, `${name}: ${JSON.stringify(cell)}`)
      assert.equal(cell.style.inverse, true)
      assert.equal(cell.style.bold, true)
    }
    keys(side, ENTER)
  }
})

// --- The intro highlight ------------------------------------------------------------------------------

const focusInstance = (origin: Coord, params: Record<string, number> = { periodMs: 2000 }): EffectInstance => ({
  recipe: "fx.focus.light",
  band: "highlights",
  startMs: 0,
  durationMs: Number.MAX_SAFE_INTEGER,
  origin,
  family: "neutral",
  params,
})
const effectAt = (overrides: Partial<EffectContext> = {}): EffectContext => ({
  timeMs: 0,
  cosmeticSeed: 0,
  tileWidth: 1,
  reducedMotion: false,
  capability: "truecolor",
  ...overrides,
})

test("the intro highlight's three forms: a breathing ring, a steady one under reduced motion, the focus inverted in monochrome", () => {
  const recipe = EFFECT_RECIPES["fx.focus.light"]
  assert.ok(recipe !== undefined)
  const origin = { x: 10, y: 10 }
  const key = (tile: Coord): string => `${tile.x},${tile.y}`
  const alphaAt = (timeMs: number, tile: Coord, overrides: Partial<EffectContext> = {}): number | undefined =>
    recipe(focusInstance(origin), effectAt({ timeMs, ...overrides })).find((cell) => key(cell.tile) === key(tile))?.seeThrough?.alpha

  // Full: a ring of glyphless light around the focus — two tiles deep at the sides where a tile is a
  // column wide, one where it is two — never on the focus itself.
  const full = recipe(focusInstance(origin), effectAt())
  assert.equal(full.length, 5 * 3 - 1)
  assert.equal(recipe(focusInstance(origin), effectAt({ tileWidth: 2 })).length, 3 * 3 - 1)
  assert.ok(full.every((cell) => cell.glyph === "" && cell.seeThrough?.role === "fx.flash" && cell.inverse !== true))
  assert.ok(!full.some((cell) => key(cell.tile) === key(origin)), "the light falls on the focus's own glyph")
  // Lit as the line appears, at rest half a breath later, lit again a breath on; the far columns at half.
  const near = { x: 11, y: 10 }
  assert.equal(alphaAt(0, near), FOCUS_LIGHT.peak)
  assert.equal(alphaAt(1000, near), FOCUS_LIGHT.rest)
  assert.equal(alphaAt(2000, near), FOCUS_LIGHT.peak)
  assert.ok((alphaAt(500, near) ?? 0) < FOCUS_LIGHT.peak && (alphaAt(500, near) ?? 0) > FOCUS_LIGHT.rest)
  assert.equal(alphaAt(0, { x: 12, y: 10 }), FOCUS_LIGHT.peak / 2)
  // Under the half at which a see-through style shows at 16 colours and in monochrome.
  assert.ok(FOCUS_LIGHT.peak < 0.5)

  // Reduced motion: the same ring, steady, between rest and peak.
  const held = [0, 300, 1000, 1700].map((timeMs) => alphaAt(timeMs, near, { reducedMotion: true }))
  assert.equal(new Set(held).size, 1, `it moved: ${held.join(", ")}`)
  assert.ok((held[0] ?? 0) > FOCUS_LIGHT.rest && (held[0] ?? 0) < FOCUS_LIGHT.peak)
  // A breath of 0 holds it steady too.
  assert.equal(
    recipe(focusInstance(origin, { periodMs: 0 }), effectAt({ timeMs: 700 }))[0]?.seeThrough?.alpha,
    recipe(focusInstance(origin, { periodMs: 0 }), effectAt({ timeMs: 0 }))[0]?.seeThrough?.alpha,
  )

  // Monochrome, and 16 colours, which cannot blend a light: the focus's own cells in inverse video, an
  // attribute and never a glyph, and nothing on the ground around it.
  for (const capability of ["monochrome", "color16"] as const) {
    for (const reducedMotion of [false, true]) {
      const cells = recipe(focusInstance({ x: 10, y: 10 }, { width: 3, height: 2 }), effectAt({ capability, reducedMotion, timeMs: 900 }))
      assert.deepEqual(
        cells.map((cell) => key(cell.tile)).sort(),
        tilesOf({ x: 10, y: 10 }, [0, 1].flatMap((y) => [0, 1, 2].map((x) => ({ x, y })))).map(key).sort(),
      )
      assert.ok(cells.every((cell) => cell.glyph === "" && cell.inverse === true && cell.seeThrough === undefined), capability)
    }
  }
})

test("drawn on the map: a ring around the line's focus as drawn, the focus's own glyph untouched, every glyph as it was", () => {
  const side = sceneSide()
  const her = side.build.state.cursor
  const at = (tile: Coord) => cellForTile(side.layout, side.build.state.camera, tile)
  const full = compose(side, {}, "truecolor")
  const own = at(her)
  assert.equal(cellAt(full, own.x, own.y).glyph, "@")
  assert.equal(cellAt(full, own.x, own.y).style.seeThrough, undefined, "her own cell is lit over")
  for (const dx of [-2, -1, 1, 2]) {
    const cell = at({ x: her.x + dx, y: her.y })
    assert.equal(cellAt(full, cell.x, cell.y).style.seeThrough?.role, "fx.flash", `no light ${dx} beside her`)
  }
  for (const dy of [-1, 1]) {
    const cell = at({ x: her.x, y: her.y + dy })
    assert.equal(cellAt(full, cell.x, cell.y).style.seeThrough?.role, "fx.flash", `no light ${dy} above or below her`)
  }
  // The live loop's clock breathes it: at rest half a breath after the line appeared.
  const beside = at({ x: her.x + 1, y: her.y })
  const later = compose(side, { dialogLight: { elapsedMs: 1000 } }, "truecolor")
  assert.equal(cellAt(full, beside.x, beside.y).style.seeThrough?.alpha, FOCUS_LIGHT.peak)
  assert.equal(cellAt(later, beside.x, beside.y).style.seeThrough?.alpha, FOCUS_LIGHT.rest)
  // Monochrome: her cell inverted, no light around her (an arriving trooper beside her keeps its own look).
  const mono = compose(side, {}, "monochrome")
  assert.equal(cellAt(mono, own.x, own.y).style.inverse, true)
  assert.notEqual(cellAt(mono, beside.x, beside.y).style.seeThrough?.role, "fx.flash")
  // The highlight never changes a glyph: every depth draws the same characters.
  const glyphs = new Set(CAPABILITY_MODES.map((capability: CapabilityMode) => frameToText(compose(side, {}, capability))))
  assert.equal(glyphs.size, 1)
  // Gone with the dialog.
  keys(side, ESC)
  const after = compose(side, {}, "truecolor")
  for (let y = 0; y < after.height; y += 1) {
    for (let x = 0; x < after.width; x += 1) assert.notEqual(cellAt(after, x, y).style.seeThrough?.role, "fx.flash", `light left at ${x},${y}`)
  }
})

test("the live loop breathes the light from the frame that first showed each line, on slow frames, and holds it still where it cannot breathe", () => {
  const context = starterContext()
  const viewport = buildLayout(MINIMUM, context.grid).viewport
  const opened = createBuildState(context, STARTER_START_CURSOR, viewport)
  const animation = new BuildAnimation()
  const first = animation.frame(opened, 1000, { capability: "truecolor" })
  assert.deepEqual(first.dialogLight, { elapsedMs: 0 })
  const breathing = animation.frame(opened, 1700, { capability: "truecolor" })
  assert.deepEqual(breathing.dialogLight, { elapsedMs: 700 })
  assert.equal(breathing.frameMs, BREATH_FRAME_MS, "the light did not ask for the breath's slow frames")
  // The next line starts its light afresh; the camera's slide to it runs at the full rate meanwhile.
  const next = applyBuildCommand(context, opened, { kind: "dialog-next" })
  const moved = animation.frame(next, 2000, { capability: "truecolor" })
  assert.deepEqual(moved.dialogLight, { elapsedMs: 0 })
  assert.equal(moved.frameMs, undefined)
  // Reduced motion and monochrome: still, and nothing asks for a frame.
  for (const options of [{ reducedMotion: true, capability: "truecolor" as const }, { capability: "monochrome" as const }]) {
    const still = new BuildAnimation()
    still.frame(opened, 0, options)
    const later = still.frame(opened, 5000, options)
    assert.equal(later.busyUntil, null, JSON.stringify(options))
    assert.deepEqual(later.dialogLight, { elapsedMs: 5000 })
  }
  // No dialog, no light.
  const closed = applyBuildCommand(context, opened, { kind: "cancel" })
  assert.equal(animation.frame(closed, 3000, { capability: "truecolor" }).dialogLight, undefined)
})

// --- A Commander back: the game's own line ----------------------------------------------------------

test("round 2 of the Commander's named scenario opens on her absence, round 3 on her return, each one line in the game's own voice", () => {
  const side = fixtureSide()
  assert.equal(side.build.state.popup, null, "the named scenario has no intro")
  playRound(side)
  keys(side, ENTER)
  assert.equal(side.build.state.pulseNumber, 2)
  // Commanders die as part of the game: the round without her opens by saying so, looking at the Nexus that
  // will restore her.
  assert.equal(side.build.state.popup, "dialog", "round 2, with her out, did not say so")
  const nexus = nexusTile(side.build.round)
  assert.ok(nexus !== null)
  assert.equal(side.build.round.scene?.length, 1)
  assert.equal(side.build.round.scene?.[0]?.text, "Vasse is out this round, back for round 3.")
  assert.equal(side.build.round.scene?.[0]?.speaker, null)
  assert.deepEqual(side.build.round.scene?.[0]?.focus?.tile, nexus)
  keys(side, ENTER)
  assert.equal(side.build.state.popup, null)
  assert.equal(bottomLineText(side), "Round 1: victory. Vasse is out this round, back for round 3.")
  playRound(side)
  keys(side, ENTER)
  const { state } = side.build
  assert.equal(state.pulseNumber, 3)
  assert.equal(state.popup, "dialog")
  const vasse = (side.build.round.field ?? []).find((entity) => entity.contentId === VASSE)
  assert.ok(vasse !== undefined, "she is not on round 3's map")
  assert.deepEqual(side.build.round.scene, [
    { speaker: null, side: null, unit: null, text: "Vasse is back beside the Nexus.", focus: { tile: vasse.anchor, own: [vasse.anchor] } },
  ])
  assert.deepEqual(state.camera, centreOn(vasse.anchor, side.layout.viewport, grid))
  assert.equal(bottomLineText(side), "[enter] or [esc] closes it.")
  // The game's own voice has no name: the border runs unbroken where a speaker's would be.
  const frame = compose(side, {}, "truecolor")
  const { box } = dialogBox(side)
  assert.match(frameToText(frame), /Vasse is back beside the Nexus\./)
  for (const x of [box.left + 2, box.left + 3]) {
    const cell = cellAt(frame, x, box.top)
    assert.deepEqual([cell.glyph, cell.style.fgRole, cell.style.inverse], [" ", "chrome.frame", true])
  }
  // The light is around her. Then the round, as it opened: the bottom line says it again.
  const beside = cellForTile(side.layout, state.camera, { x: vasse.anchor.x + 1, y: vasse.anchor.y })
  assert.equal(cellAt(frame, beside.x, beside.y).style.seeThrough?.role, "fx.flash")
  keys(side, ENTER)
  assert.equal(side.build.state.popup, null)
  assert.equal(bottomLineText(side), "Round 2: victory. Vasse is back beside the Nexus.")
  // Without scenes, the same round opens straight on the menu.
  const plain = fixtureSide(false)
  playRound(plain)
  keys(plain, ENTER)
  playRound(plain)
  keys(plain, ENTER)
  assert.equal(plain.build.state.popup, null)
  assert.deepEqual(side.build.state, plain.build.state)
})

test("round 2 of PERIMETER opens without a scene; Restart is the mission from round 1, intro and all", () => {
  const side = sceneSide()
  keys(side, ESC)
  playRound(side)
  keys(side, ENTER)
  assert.equal(side.build.state.pulseNumber, 2)
  assert.equal(side.build.state.popup, null)
  assert.equal(side.build.round.scene, undefined, "round 1's scene was carried into round 2")
  side.build.dispatch({ kind: "restart" })
  assert.equal(side.build.state.pulseNumber, 1)
  assert.equal(side.build.state.popup, "dialog")
  assert.equal(side.build.state.dialog?.line, 0)
})

test("a resize while the dialog is open: the camera it gives back fits the new view", () => {
  const side = sceneSide()
  const plain = sceneSide({ scenes: false })
  const viewport = buildLayout(MAXIMUM, grid).viewport
  side.build.resize(viewport)
  plain.build.resize(viewport)
  keys(side, ENTER, ESC)
  assert.deepEqual([side.build.state.camera, side.build.state.cursor], [plain.build.state.camera, plain.build.state.cursor])
})

// --- Whether it was read ------------------------------------------------------------------------------

test("the Activity Logs say which lines were shown and where the rest was skipped, under their own filter", () => {
  const skipped = runBuildPlaytest({ steps: parseKeyScript("Enter Esc") })
  const dialog = (run: typeof skipped) =>
    run.activity
      .entries()
      .filter((entry) => entry.event.startsWith("dialog."))
      .map((entry) => [entry.event, entry.props])
  assert.deepEqual(dialog(skipped), [
    ["dialog.line", { round: 1, line: 1, of: 4, speaker: "Vasse" }],
    ["dialog.line", { round: 1, line: 2, of: 4, speaker: "Corvane" }],
    ["dialog.skip", { round: 1, line: 2, of: 4 }],
  ])
  const read = runBuildPlaytest({ steps: parseKeyScript("Enter*4") })
  assert.deepEqual(
    dialog(read).map(([event]) => event),
    ["dialog.line", "dialog.line", "dialog.line", "dialog.line"],
    "reading to the end is not a skip",
  )
  const filter = ACTIVITY_FILTERS.find((each) => each.name === "Intro")
  assert.ok(filter !== undefined)
  assert.deepEqual(
    filteredEntries(skipped.activity.entries(), filter).map((entry) => entry.event).reverse(),
    ["dialog.line", "dialog.line", "dialog.skip"],
  )
})

test("the scripted playtest plays scenes as the game does: an old script runs as before after one Esc", () => {
  const run = runBuildPlaytest({ steps: parseKeyScript("Esc Down*3 Space*4") })
  assert.equal(run.frames[0]?.state.popup, "dialog")
  assert.equal(run.frames[1]?.state.popup, null)
  const last = run.frames[run.frames.length - 1]
  assert.equal(last?.state.planned.length, 2)
  assert.match(frameToText(last?.frame ?? run.frames[0]!.frame), /Hatchery placed \(resources: 40\)/)
})

// --- The live game ------------------------------------------------------------------------------------

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = 80
  rows = 24
  written = ""
  lastWrite = ""
  write(text: string): boolean {
    this.written += text
    this.lastWrite = text
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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

test("the game opens PERIMETER on its intro, and Enter reads on", async () => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const exits: number[] = []
  const session = runBuildPhase({
    settings: { ...DEFAULT_SETTINGS, capability: "monochrome" },
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: (code) => {
      exits.push(code)
    },
    activity: activityLog(),
  })
  await sleep(40)
  assert.match(stdout.written, /VASSE/)
  assert.match(stdout.written, /By the book\. The new book\./)
  stdin.emit("data", Buffer.from(ENTER))
  await sleep(40)
  assert.match(stdout.written, /CORVANE/)
  stdin.emit("data", Buffer.from(CTRL_C))
  assert.equal(await session, 0)
  assert.deepEqual(exits, [0])
})

// --- Her look in the Pulse ----------------------------------------------------------------------------

test("Vasse is drawn bold at full strength in her side's colour while a Pulse plays, at every colour depth", () => {
  assert.equal(drawnBold(registry.get(VASSE)), true)
  assert.equal(drawnBold(registry.get("unit.citizen.trooper")), false)
  assert.equal(drawnBold(registry.get("structure.citizen.barracks")), true)
  const side = sceneSide({ scenes: false })
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  side.build.advance(0)
  side.build.advance(400)
  const map = (layout: BuildLayout, frame: ReadonlyCellFrame) =>
    Array.from({ length: layout.viewport.height }, (_, row) =>
      Array.from({ length: layout.viewport.width }, (_, column) => ({
        cell: cellAt(frame, layout.origin.column + column, layout.origin.row + row),
      })),
    ).flat()
  for (const capability of CAPABILITY_MODES) {
    const frame = compose(side, {}, capability)
    const cells = map(side.layout, frame).map((entry) => entry.cell)
    const her = cells.filter((cell) => cell.glyph === "@")
    assert.equal(her.length, 1, `${capability}: ${her.length} of her`)
    const [cell] = her
    assert.ok(cell !== undefined)
    assert.deepEqual([cell.style.fgRole, cell.style.bold, cell.style.dim === true], ["player.a", true, false], capability)
    const resolved = resolveCell(cell, capability)
    assert.equal(resolved.bold, true, capability)
    assert.equal(resolved.dim, false, capability)
    assert.ok(resolved.sgr.includes(1), `${capability}: no bold in ${JSON.stringify(resolved.sgr)}`)
    // A trooper beside her is not.
    const trooper = cells.find((each) => each.glyph === "t")
    assert.equal(trooper?.style.bold, undefined, `${capability}: the squads are bold too`)
  }
})
