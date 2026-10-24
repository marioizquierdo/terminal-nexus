// A run's draft as a popup of the Build Phase (docs/game-design/runs.md, the army): three cards to take one of, or a card the
// army holds to remove, or the requisition instead — the second popup the player does not open, which a round whose context
// carries a `RunDraft` opens on and which cannot be dismissed, because what is chosen changes the army the round is built
// from. Hand-made contexts, since the run (`src/run/`) deals the real ones; driven through the real session where a key, a
// click or the screen is what is claimed, and through the reducer where a rule is.

import { test } from "node:test"
import assert from "node:assert/strict"
import { controlsPage, hint } from "../src/build/help.ts"
import { buildLayout, escLabel } from "../src/build/layout.ts"
import { MOUSE_RIGHT } from "../src/build/mouse.ts"
import { placePopup, popupSpec } from "../src/build/popup.ts"
import type { PopupRow } from "../src/build/popup.ts"
import { applyBuildCommand, createBuildState, draftPending, withoutScene } from "../src/build/state.ts"
import type { BuildContext } from "../src/build/state.ts"
import type { DialogLine, RunDraftChoice } from "../src/build/types.ts"
import { starterContext } from "../src/cli/starter.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import { ACTIVITY_EVENTS, ACTIVITY_FILTERS, filteredEntries } from "../src/log/activity.ts"
import { entryProblems } from "../src/log/index.ts"
import { BuildSession } from "../src/view/build-session.ts"
import {
  DOWN,
  ENTER,
  ESC,
  MINIMUM,
  OPEN_GROUND,
  SPACE,
  UP,
  activityLog,
  bottomLineText,
  buildSide,
  clickCell,
  clickEscLabel,
  clickPopupOption,
  draftContext,
  keys,
  placed,
  runDraft,
  screenText,
} from "./build-helpers.ts"
import type { BuildSide, SideOptions } from "./build-helpers.ts"

const HOLD = "Choose a card, remove one, or take the requisition."

/** A session on a round that opens with the draft. */
function draftSide(options: SideOptions = {}): BuildSide {
  return buildSide({ context: draftContext(), ...options })
}

/** The rows of the open popup that are options, with their hotkeys. */
function options(side: BuildSide): Extract<PopupRow, { kind: "option" }>[] {
  const spec = popupSpec(side.build.round, side.build.state)
  assert.ok(spec !== null, "no popup is open")
  return spec.rows.flatMap((row) => (row.kind === "option" ? [row] : []))
}

/** The same session, after the round moved on to a context the draft's choice made. */
const REFIT: BuildContext = { ...starterContext(), allotment: 777 }

// --- It opens by itself ----------------------------------------------------------------------------

test("a round whose context holds a draft opens on its popup, nothing chosen and the plan untouched", () => {
  const side = draftSide()
  const { state } = side.build
  assert.equal(state.popup, "run-draft")
  assert.equal(state.popupHighlight, 0)
  assert.deepEqual(state.popupUnder, [])
  assert.equal(state.draftChoice, null)
  assert.equal(draftPending(side.build.round, state), true)
  assert.deepEqual(state.planned, [])
  // The draft belongs to no menu row: nothing of the menu is drawn lit behind it.
  const text = screenText(side)
  assert.match(text, /Draft after battle 1/)
  // A round with no draft opens as it always did.
  assert.equal(buildSide().build.state.popup, null)
})

test("the popup is the one shape: the intro, the cards on 1 2 3, Remove on r, the requisition on t, then the army", () => {
  const side = draftSide()
  const spec = popupSpec(side.build.round, side.build.state)
  assert.ok(spec !== null)
  assert.equal(spec.title, "Draft after battle 1")
  assert.deepEqual(
    spec.rows.map((row) => (row.kind === "note" || row.kind === "heading" || row.kind === "text" ? row.text : row.kind === "option" ? `[${row.hotkey}] ${row.label}` : row.kind)),
    [
      "Battle 1 won. Take a card, remove one,",
      "or take requisition instead.",
      "[1] Turret",
      "[2] War Drums",
      "[3] Hold the Line",
      "[r] Remove a card",
      "[t] Take 15 requisition",
      "ARMY",
      "Structures: Barracks, Wall",
      "Nexus powers: War Chest, Flare",
      "Doctrines: none",
    ],
  )
  const [turret, drums, line, remove, take] = options(side)
  assert.equal(turret?.tag, "common")
  assert.equal(drums?.tag, "uncommon")
  assert.equal(line?.tag, "rare")
  assert.equal(turret?.description, "Structure · Defence: Shoots what comes near.")
  assert.equal(drums?.description, "Nexus power · Offence: Units hit harder this round.")
  assert.deepEqual(turret?.command, { kind: "draft-take", index: 0 })
  assert.deepEqual(line?.command, { kind: "draft-take", index: 2 })
  assert.deepEqual(remove?.command, { kind: "draft-open-remove" })
  assert.deepEqual(take?.command, { kind: "draft-requisition" })
  assert.equal(remove?.muted, undefined)
  // The first row is the one the keyboard is on.
  assert.deepEqual(options(side).map((row) => row.highlighted === true), [true, false, false, false, false])
})

test("fewer than three cards means fewer card rows, the keys still counting from 1; Remove and the requisition stay", () => {
  const draft = runDraft({ cards: runDraft().cards.slice(0, 1) })
  const side = buildSide({ context: draftContext(draft) })
  assert.deepEqual(options(side).map((row) => row.hotkey), ["1", "r", "t"])
  keys(side, DOWN, DOWN, DOWN)
  assert.equal(side.build.state.popupHighlight, 2, "the list has the card, Remove and the requisition: three rows")
  const none = buildSide({ context: draftContext(runDraft({ cards: [] })) })
  assert.deepEqual(options(none).map((row) => row.hotkey), ["r", "t"])
  keys(none, "r")
  assert.equal(none.build.state.popup, "run-draft-remove")
})

test("with nothing to remove the Remove row is quiet and refuses, saying so", () => {
  const side = buildSide({ context: draftContext(runDraft({ removable: [] })) })
  const remove = options(side).find((row) => row.hotkey === "r")
  assert.equal(remove?.muted, true)
  assert.equal(remove?.tag, "none")
  keys(side, "r")
  assert.equal(side.build.state.popup, "run-draft")
  assert.equal(bottomLineText(side), "Nothing can be removed.")
  assert.equal(side.build.state.status.tone, "warning")
  // Enter on it, and a click, say the same and change nothing.
  keys(side, DOWN, DOWN, DOWN, ENTER)
  assert.equal(side.build.state.popup, "run-draft")
  assert.equal(side.build.state.draftChoice, null)
  clickPopupOption(side, "r")
  assert.equal(side.build.state.popup, "run-draft")
  assert.match(hint(side.build.round, side.build.state).text, /Nothing to remove\.$/)
})

// --- It cannot be dismissed ------------------------------------------------------------------------

test("Esc, x, a right click, a click outside and the top bar change nothing; the line says what to do", () => {
  const side = draftSide()
  const before = side.build.state
  const outside = [side.layout.panelColumn + 3, side.layout.panelRow + 3] as const
  const map = [side.layout.gridBox.right - 2, side.layout.gridBox.top + 1] as const
  for (const act of [
    () => keys(side, ESC),
    () => keys(side, "x"),
    () => clickCell(side, ...outside, MOUSE_RIGHT),
    () => clickCell(side, ...outside),
    () => clickCell(side, ...map),
    () => clickCell(side, ...map, MOUSE_RIGHT),
    () => clickEscLabel(side),
    () => keys(side, "u", "e", "n", "s", "p", "?", "\t", "d", "g", "z", "7"),
  ]) {
    act()
    const { state } = side.build
    assert.equal(state.popup, "run-draft")
    assert.equal(state.draftChoice, null)
    assert.deepEqual(state.popupUnder, [])
    assert.deepEqual(state.cursor, before.cursor)
    assert.equal(state.focus, before.focus)
    assert.equal(state.armed, null)
    assert.deepEqual(state.planned, [])
  }
  keys(side, ESC)
  assert.equal(bottomLineText(side), HOLD)
  assert.equal(side.build.state.status.tone, "warning")
  keys(side, "x")
  assert.equal(bottomLineText(side), HOLD)
})

test("the top bar offers no close while the draft waits, and says back on the remove list", () => {
  const side = draftSide()
  assert.equal(escLabel(side.build.state), "")
  const bar = screenText(side).split("\n")[1] ?? ""
  assert.doesNotMatch(bar, /\[esc\]|close|back|menu/)
  assert.match(bar, /TERMINAL NEXUS/)
  keys(side, "r")
  assert.equal(escLabel(side.build.state), "back [esc]")
  assert.match(screenText(side).split("\n")[1] ?? "", /back \[esc\]\s*\|$/)
  // Clicking it goes back to the draft, as Esc does.
  clickEscLabel(side)
  assert.equal(side.build.state.popup, "run-draft")
  // And with nothing to click, a click where it used to be does nothing.
  const label = side.layout.escLabelEnd
  clickCell(side, label.to - 2, label.row)
  assert.equal(side.build.state.popup, "run-draft")
})

test("a driver's commands cannot get past it: the plan, the Battle Round and the other popups are refused", () => {
  const side = draftSide()
  side.build.run([{ kind: "arm", index: 0 }, { kind: "place" }, { kind: "open-nexus-powers" }, { kind: "open-battle-round" }, { kind: "open-controls" }])
  assert.equal(side.build.state.popup, "run-draft")
  assert.deepEqual(side.build.state.planned, [])
  assert.equal(side.build.state.committed, false)
  side.build.run([{ kind: "cancel" }, { kind: "back" }, { kind: "pulse-failed", reason: "x" }])
  assert.equal(side.build.state.popup, "run-draft", "a command that closes every popup left the draft closed")
  assert.equal(side.build.state.draftChoice, null)
})

// --- Remove ----------------------------------------------------------------------------------------

test("r, its row and a click on it open the remove list; Esc, x, a right click and the top bar go back to the Remove row", () => {
  for (const open of [
    (side: BuildSide) => keys(side, "r"),
    (side: BuildSide) => keys(side, DOWN, DOWN, DOWN, ENTER),
    (side: BuildSide) => keys(side, DOWN, DOWN, DOWN, SPACE),
    (side: BuildSide) => clickPopupOption(side, "r"),
    (side: BuildSide) => side.build.dispatch({ kind: "draft-open-remove" }),
  ]) {
    const side = draftSide()
    open(side)
    assert.equal(side.build.state.popup, "run-draft-remove")
    assert.deepEqual(side.build.state.popupUnder.map((level) => level.popup), ["run-draft"])
    assert.equal(side.build.state.popupHighlight, 0)
    assert.deepEqual(options(side).map((row) => row.hotkey), ["1", "2", "3", "4"])
    assert.deepEqual(options(side).map((row) => row.label), ["Barracks", "Wall", "War Chest", "Flare"])
    assert.deepEqual(options(side).map((row) => row.tag), ["common", "common", "common", "uncommon"])
    assert.equal(options(side)[0]?.description, "Structure · Offence: Trains Riflemen.")
  }
  for (const back of [
    (side: BuildSide) => keys(side, ESC),
    (side: BuildSide) => keys(side, "x"),
    (side: BuildSide) => clickCell(side, side.layout.panelColumn + 3, side.layout.panelRow + 3, MOUSE_RIGHT),
    (side: BuildSide) => clickEscLabel(side),
  ]) {
    const side = draftSide()
    keys(side, "r")
    back(side)
    assert.equal(side.build.state.popup, "run-draft")
    assert.equal(side.build.state.popupHighlight, 3, "back lands on the Remove row")
    assert.equal(side.build.state.draftChoice, null)
  }
  // A click outside the list does nothing at all; the draft is still the question.
  const side = draftSide()
  keys(side, "r")
  clickCell(side, side.layout.panelColumn + 3, side.layout.panelRow + 3)
  assert.equal(side.build.state.popup, "run-draft-remove")
  assert.equal(side.build.state.draftChoice, null)
})

test("choosing from the remove list settles the draft: a digit, a click, Enter on the highlighted card", () => {
  const settled = (side: BuildSide, choice: RunDraftChoice): void => {
    assert.deepEqual(side.build.state.draftChoice, choice)
    assert.equal(side.build.state.popup, null)
    assert.deepEqual(side.build.state.popupUnder, [])
  }
  const byDigit = draftSide()
  keys(byDigit, "r", "3")
  settled(byDigit, { kind: "remove", key: "power:war-chest" })
  assert.equal(bottomLineText(byDigit), "War Chest removed.")
  const byEnter = draftSide()
  keys(byEnter, "r", DOWN, ENTER)
  settled(byEnter, { kind: "remove", key: "structure:wall" })
  const byClick = draftSide()
  keys(byClick, "r")
  clickPopupOption(byClick, "4")
  settled(byClick, { kind: "remove", key: "power:flare" })
  // Every part of a row is its click target, the description's line included.
  const bySecondLine = draftSide()
  keys(bySecondLine, "r")
  const row = placed(bySecondLine).rows.find((each) => each.secondLine && each.spec.kind === "option" && each.spec.hotkey === "2")
  assert.ok(row !== undefined)
  clickCell(bySecondLine, placed(bySecondLine).textColumn + 6, row.row)
  settled(bySecondLine, { kind: "remove", key: "structure:wall" })
  const byDriver = draftSide()
  byDriver.build.run([{ kind: "draft-open-remove" }, { kind: "draft-remove", index: 0 }])
  settled(byDriver, { kind: "remove", key: "structure:barracks" })
  // A digit past the list means nothing.
  const past = draftSide()
  keys(past, "r", "9", "a")
  assert.equal(past.build.state.popup, "run-draft-remove")
  assert.equal(past.build.state.draftChoice, null)
})

test("a long remove list scrolls with its highlight, its keys going 1 to 9 and then a, b, c", () => {
  const removable = Array.from({ length: 14 }, (_, index) => ({
    key: `structure:card-${index}`,
    name: `Card ${index + 1}`,
    family: "Structure",
    rarity: "common",
    role: "Defence",
    line: "Does a thing.",
  }))
  const side = buildSide({ context: draftContext(runDraft({ removable })) })
  keys(side, "r")
  assert.deepEqual(options(side).map((row) => row.hotkey).slice(8, 12), ["9", "a", "b", "c"])
  const popup = placed(side)
  assert.ok(popup.window !== null && popup.window.visible < 14, "a list this long should scroll")
  assert.ok(popup.scrollBar !== null)
  for (let index = 0; index < 13; index += 1) keys(side, DOWN)
  assert.equal(side.build.state.popupHighlight, 13)
  keys(side, DOWN)
  assert.equal(side.build.state.popupHighlight, 13, "the highlight stops at the end")
  const after = placed(side)
  assert.equal(after.window !== null && after.window.offset + after.window.visible, 14, "the window followed the highlight to the end")
  assert.ok(placed(side).rows.some((row) => row.spec.kind === "option" && row.spec.label === "Card 14"))
  keys(side, "b")
  assert.deepEqual(side.build.state.draftChoice, { kind: "remove", key: "structure:card-10" })
})

// --- Choosing --------------------------------------------------------------------------------------

test("a digit, Enter or Space on a card, a click on it, and t each settle the draft", () => {
  const take = (key: string): RunDraftChoice => ({ kind: "take", key })
  const cases: readonly (readonly [string, (side: BuildSide) => void, RunDraftChoice])[] = [
    ["digit 1", (side) => keys(side, "1"), take("structure:turret")],
    ["digit 3", (side) => keys(side, "3"), take("doctrine:hold-the-line")],
    ["Enter on the highlighted first", (side) => keys(side, ENTER), take("structure:turret")],
    ["Down, Space", (side) => keys(side, DOWN, SPACE), take("power:war-drums")],
    ["a click on a card's name", (side) => clickPopupOption(side, "2"), take("power:war-drums")],
    ["t", (side) => keys(side, "t"), { kind: "requisition" }],
    ["its row, by Enter", (side) => keys(side, DOWN, DOWN, DOWN, DOWN, ENTER), { kind: "requisition" }],
    ["a click on the requisition", (side) => clickPopupOption(side, "t"), { kind: "requisition" }],
    ["a driver's draft-take", (side) => side.build.dispatch({ kind: "draft-take", index: 1 }), take("power:war-drums")],
  ]
  for (const [name, act, choice] of cases) {
    const side = draftSide()
    act(side)
    assert.deepEqual(side.build.state.draftChoice, choice, name)
    assert.equal(side.build.state.popup, null, `${name} left the popup open`)
    assert.equal(draftPending(side.build.round, side.build.state), false)
  }
  const side = draftSide()
  keys(side, "t")
  assert.equal(bottomLineText(side), "15 requisition taken.")
})

test("a card past the dealt ones, and a choice with no draft waiting, mean nothing; a settled draft cannot be settled again", () => {
  const side = draftSide()
  side.build.dispatch({ kind: "draft-take", index: 5 })
  assert.equal(side.build.state.draftChoice, null)
  assert.equal(side.build.state.popup, "run-draft")
  keys(side, "4")
  assert.equal(side.build.state.draftChoice, null)
  keys(side, "1")
  assert.deepEqual(side.build.state.draftChoice, { kind: "take", key: "structure:turret" })
  side.build.dispatch({ kind: "draft-requisition" })
  assert.match(side.build.state.status.text, /No draft waiting/)
  assert.deepEqual(side.build.state.draftChoice, { kind: "take", key: "structure:turret" })
  const plain = buildSide()
  plain.build.dispatch({ kind: "draft-take", index: 0 })
  assert.equal(plain.build.state.status.text, "No draft waiting.")
  assert.equal(plain.build.state.draftChoice, null)
})

test("Up and Down walk the cards, Remove and the requisition, and stop at the ends", () => {
  const side = draftSide()
  keys(side, UP)
  assert.equal(side.build.state.popupHighlight, 0)
  for (let index = 1; index <= 4; index += 1) {
    keys(side, DOWN)
    assert.equal(side.build.state.popupHighlight, index)
  }
  keys(side, DOWN, DOWN)
  assert.equal(side.build.state.popupHighlight, 4, "the list ends at the requisition")
  assert.deepEqual(options(side).map((row) => row.highlighted === true), [false, false, false, false, true])
  assert.equal(side.build.state.popup, "run-draft")
})

// --- The game menu over it -------------------------------------------------------------------------

test("q opens the game menu over the draft, and closing it comes back to the draft exactly as it was", () => {
  for (const [name, close] of [
    ["Esc", (side: BuildSide) => keys(side, ESC)],
    ["x", (side: BuildSide) => keys(side, "x")],
    ["the top bar", (side: BuildSide) => clickEscLabel(side)],
    ["a right click", (side: BuildSide) => clickCell(side, side.layout.panelColumn + 3, side.layout.panelRow + 3, MOUSE_RIGHT)],
    ["a click outside", (side: BuildSide) => clickCell(side, side.layout.panelColumn + 3, side.layout.panelRow + 3)],
  ] as const) {
    const side = draftSide()
    keys(side, DOWN, DOWN)
    keys(side, "q")
    assert.equal(side.build.state.popup, "game-menu", name)
    assert.deepEqual(side.build.state.popupUnder.map((level) => level.popup), ["run-draft"])
    close(side)
    assert.equal(side.build.state.popup, "run-draft", `${name} did not come back to the draft`)
    assert.equal(side.build.state.popupHighlight, 2, `${name}: the draft was not as it was`)
    assert.equal(side.build.state.draftChoice, null)
  }
  // Over the remove list too: it comes back to the list, on the row it was on.
  const side = draftSide()
  keys(side, "r", DOWN, "q")
  assert.equal(side.build.state.popup, "game-menu")
  keys(side, ESC)
  assert.equal(side.build.state.popup, "run-draft-remove")
  assert.equal(side.build.state.popupHighlight, 1)
  // Settings reached through the game menu goes back through it, and q does not stack a second menu.
  const deep = draftSide()
  keys(deep, "q", "s", ESC, ESC)
  assert.equal(deep.build.state.popup, "run-draft")
  keys(deep, "q")
  const stack = deep.build.state.popupUnder.length
  deep.build.dispatch({ kind: "open-game-menu" })
  assert.equal(deep.build.state.popupUnder.length, stack, "the game menu was opened over itself")
})

test("whatever closes every popup at once, the draft opens again on the row it was on", () => {
  const side = draftSide()
  keys(side, DOWN, "q")
  // A driver's click outside, the one command that used to close the game menu and everything under it.
  side.build.dispatch({ kind: "click-menu", entry: 2 })
  assert.equal(side.build.state.popup, "run-draft")
  assert.equal(side.build.state.popupHighlight, 1)
  assert.equal(side.build.state.focus, "menu")
  assert.equal(side.build.state.armed, null)
})

// --- Handing the choice on -------------------------------------------------------------------------

test("the session hands the choice to its draft hook and moves the screen on to the context it returns", () => {
  const asked: { context: BuildContext; choice: RunDraftChoice }[] = []
  const side = draftSide({
    draft: (context, choice) => {
      asked.push({ context, choice })
      return REFIT
    },
  })
  const opening = side.build.round
  // A setting changed on the way, to see it carried over.
  keys(side, "q", "s")
  side.build.dispatch({ kind: "setting-adjust", field: "reducedMotion", step: 1 })
  const settings = side.build.state.settings
  keys(side, ESC, ESC)
  assert.equal(side.build.state.popup, "run-draft")
  keys(side, "2")
  assert.equal(asked.length, 1)
  assert.equal(asked[0]?.context, opening)
  assert.deepEqual(asked[0]?.choice, { kind: "take", key: "power:war-drums" })
  assert.equal(side.build.round.runDraft, undefined, "the round the choice made is the session's")
  assert.equal(side.build.round.allotment, 777)
  // A fresh Build Phase on it: no popup, no choice, the plan empty, the settings carried.
  assert.equal(side.build.state.popup, null)
  assert.equal(side.build.state.draftChoice, null)
  assert.deepEqual(side.build.state.planned, [])
  assert.equal(side.build.state.settings, settings)
  // The next keys are the new round's: n opens its Nexus Pulse, and nothing asks the hook again.
  keys(side, "n")
  assert.equal(side.build.state.popup, "nexus-powers")
  assert.equal(asked.length, 1)
})

test("a hook that returns another draft, or a scene, is honoured: the new round opens on it", () => {
  const next = draftContext(runDraft({ title: "Draft after battle 2" }))
  const side = draftSide({ draft: () => next })
  keys(side, "t")
  assert.equal(side.build.state.popup, "run-draft")
  assert.match(screenText(side), /Draft after battle 2/)
  const scene: DialogLine[] = [{ speaker: null, side: null, unit: null, text: "The army is refitted.", focus: null }]
  const played = buildSide({ draft: () => ({ ...REFIT, scene }), scenes: true, context: draftContext() })
  keys(played, "1")
  assert.equal(played.build.state.popup, "dialog", "the new round's scene plays")
  // Without scenes the session does not play it: the round opens on the menu.
  const silent = draftSide({ draft: () => ({ ...REFIT, scene }) })
  keys(silent, "1")
  assert.equal(silent.build.state.popup, null)
})

test("without a draft hook the choice only closes the popup and the round stays", () => {
  const side = draftSide()
  const round = side.build.round
  keys(side, "1")
  assert.equal(side.build.round, round)
  assert.equal(side.build.state.popup, null)
  assert.deepEqual(side.build.state.draftChoice, { kind: "take", key: "structure:turret" })
  // It is settled, so the draft does not come back and the round plays.
  keys(side, "n")
  assert.equal(side.build.state.popup, "nexus-powers")
})

test("the reducer alone records the choice and closes both popups", () => {
  const context = withoutScene(draftContext())
  const layout = buildLayout(MINIMUM, context.grid)
  const opened = createBuildState(context, OPEN_GROUND, layout.viewport)
  const removing = applyBuildCommand(context, opened, { kind: "draft-open-remove" })
  const done = applyBuildCommand(context, removing, { kind: "draft-remove", index: 1 })
  assert.deepEqual(done.draftChoice, { kind: "remove", key: "structure:wall" })
  assert.equal(done.popup, null)
  assert.deepEqual(done.popupUnder, [])
  // A remove sent without the list open is refused; so is a take sent with the list open.
  assert.equal(applyBuildCommand(context, opened, { kind: "draft-remove", index: 0 }).draftChoice, null)
  assert.equal(applyBuildCommand(context, removing, { kind: "draft-take", index: 0 }).draftChoice, null)
})

// --- Behind a scene --------------------------------------------------------------------------------

test("a round with a scene and a draft plays the scene first, then the draft opens, however the scene ends", () => {
  const scene: DialogLine[] = [
    { speaker: null, side: null, unit: null, text: "One.", focus: null },
    { speaker: null, side: null, unit: null, text: "Two.", focus: null },
  ]
  const context = { ...draftContext(), scene }
  for (const [name, end] of [
    ["reading on", (side: BuildSide) => keys(side, ENTER, ENTER)],
    ["skipping", (side: BuildSide) => keys(side, ESC)],
    ["clicking through", (side: BuildSide) => side.build.run([{ kind: "dialog-next" }, { kind: "dialog-next" }])],
  ] as const) {
    const side = buildSide({ context, scenes: true })
    assert.equal(side.build.state.popup, "dialog", name)
    assert.equal(side.build.state.draftChoice, null)
    end(side)
    assert.equal(side.build.state.popup, "run-draft", `${name}: the draft did not open after the scene`)
    assert.equal(side.build.state.dialog, null)
    assert.equal(side.build.state.popupHighlight, 0)
  }
  // The game menu over the dialog, closed by a click outside, leaves the draft rather than the plain menu.
  const side = buildSide({ context, scenes: true })
  keys(side, "q")
  side.build.dispatch({ kind: "click-menu", entry: 0 })
  assert.equal(side.build.state.popup, "run-draft")
})

test("the opening answer is the intro's to give: the bottom line opens on the draft's own hint", () => {
  const context = { ...draftContext(), openingStatus: { text: "Battle Round 1: VICTORY", tone: "success" as const } }
  const side = buildSide({ context })
  assert.match(bottomLineText(side), /^Number or \[enter\] takes a card/)
})

// --- Hints and keys --------------------------------------------------------------------------------

test("the bottom line says what to do in the draft, and with a real draft names Remove", () => {
  const side = draftSide()
  assert.equal(bottomLineText(side), "Number or [enter] takes a card, [r] removes one, [t] takes the requisition.")
  assert.equal(hint(side.build.round, side.build.state).tone, "hint")
  keys(side, "r")
  assert.equal(bottomLineText(side), "Number or [enter] removes that card for good. [esc] back to the draft.")
  assert.ok(bottomLineText(side).length <= side.layout.footerLimit)
})

test("the Controls page lists the draft's keys and the remove list's, every row with its key", () => {
  const page = controlsPage()
  const draft = page.find((section) => section.heading === "THE DRAFT")
  const remove = page.find((section) => section.heading === "THE REMOVE LIST")
  assert.ok(draft !== undefined && remove !== undefined)
  assert.deepEqual(draft.lines.map((line) => line.keys), ["1 2 3", "r", "t", "up/down", "enter/space", "click a row", "esc/x", "q"])
  assert.deepEqual(remove.lines.map((line) => line.keys), ["1-9 a-z", "up/down", "enter/space", "esc/x"])
  for (const line of [...draft.lines, ...remove.lines]) assert.ok(line.keys !== "" && line.text.length <= 28, line.text)
  assert.ok(page.indexOf(draft) < page.findIndex((section) => section.heading === "ANY LIST"))
})

// --- The Activity Logs -----------------------------------------------------------------------------

test("the choice is logged as run.draft with the draft's title, the kind and the key; the popups are named in popup.open", () => {
  const take = draftSide()
  keys(take, "2")
  const remove = draftSide()
  keys(remove, "r", "1")
  const requisition = draftSide()
  keys(requisition, "t")
  const drafts = (side: BuildSide): unknown[] => side.activity.entries().filter((entry) => entry.event === "run.draft").map((entry) => entry.props)
  assert.deepEqual(drafts(take), [{ draft: "Draft after battle 1", choice: "take", key: "power:war-drums" }])
  assert.deepEqual(drafts(remove), [{ draft: "Draft after battle 1", choice: "remove", key: "structure:barracks" }])
  assert.deepEqual(drafts(requisition), [{ draft: "Draft after battle 1", choice: "requisition" }])
  for (const entry of take.activity.entries()) assert.deepEqual(entryProblems(ACTIVITY_EVENTS, entry), [], entry.event)
  const side = draftSide({ activity: activityLog() })
  keys(side, "r", ESC, "r")
  const opens = side.activity.entries().filter((entry) => entry.event === "popup.open").map((entry) => entry.props["popup"])
  assert.deepEqual(opens, ["run-draft-remove", "run-draft-remove"])
  assert.match(ACTIVITY_EVENTS["popup.open"].props.popup.description, /run-draft, run-draft-remove/)
  // The Interactions filter, which the window opens on, shows it.
  const interactions = ACTIVITY_FILTERS.find((filter) => filter.name === "Interactions")
  assert.ok(interactions !== undefined)
  assert.equal(filteredEntries(take.activity.entries(), interactions).filter((entry) => entry.event === "run.draft").length, 1)
})

test("a refused Esc is a refusal in the log, and a choice with a hook is logged before the round changes", () => {
  const side = draftSide({ draft: () => REFIT })
  keys(side, ESC)
  const refused = side.activity.entries().filter((entry) => entry.event === "build.refused")
  assert.equal(refused.length, 1)
  assert.equal(refused[0]?.props["reason"], HOLD)
  keys(side, "1")
  const events = side.activity.entries().map((entry) => entry.event)
  assert.ok(events.includes("run.draft"))
})

// --- The screen ------------------------------------------------------------------------------------

test("at 80 x 24, in monochrome and with reduced motion, the draft and its remove list read whole", () => {
  for (const settings of [{}, { reducedMotion: true }]) {
    const context = { ...draftContext(), settings: { ...DEFAULT_SETTINGS, ...settings } }
    const side = buildSide({ context, terminal: MINIMUM })
    const draft = screenText(side)
    for (const wanted of [
      "Draft after battle 1",
      "Battle 1 won. Take a card, remove one,",
      "[1] Turret",
      "common",
      "Structure · Defence:",
      "[2] War Drums",
      "uncommon",
      "[3] Hold the Line",
      "[r] Remove a card",
      "[t] Take 15 requisition",
      "ARMY",
      "Structures: Barracks, Wall",
      "Nexus powers: War Chest, Flare",
      "Doctrines: none",
    ]) {
      assert.ok(draft.includes(wanted), `the draft lacks "${wanted}":\n${draft}`)
    }
    assert.equal(draft.split("\n").length, 24)
    keys(side, "r")
    const list = screenText(side)
    for (const wanted of ["REMOVE A CARD", "[1] Barracks", "[4] Flare", "Nexus power · Support:"]) {
      assert.ok(list.includes(wanted), `the remove list lacks "${wanted}":\n${list}`)
    }
    assert.equal(list.split("\n").length, 24)
  }
})

test("a long intro and a long army never push the popup off the screen: the army scrolls instead", () => {
  const army = Array.from({ length: 7 }, (_, index) => ({ family: `Family ${index + 1}`, names: ["One", "Two"] }))
  const side = buildSide({ context: draftContext(runDraft({ army, intro: ["A long first line of the intro that wraps onto a second.", "And a second."] })), terminal: MINIMUM })
  const popup = placed(side)
  assert.ok(popup.box.top >= side.layout.gridBox.top + 1)
  assert.ok(popup.box.bottom < side.layout.paneBottom, "the popup runs past the Grid pane")
  const text = screenText(side)
  assert.ok(text.includes("[t] Take 15 requisition"), "the choices must always be on screen")
  assert.ok(text.includes("[r] Remove a card"))
})
