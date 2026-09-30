// Gate 5D: the Nexus draft slot and commit; gate 5F: the draft as a popup the player opens. "A dealt
// Nexus power may not be skipped" (commander-armies.md Section 4.5) — so the commit is refused until
// one is picked, and since gate 5F *only* the commit: an optional popup must not nag like a forced
// screen. Committing asks once — engine.md 9.7: "the one action that must not fire by accident."

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_CATALOG } from "../src/build/catalog.ts"
import { NEXUS_ROW, buildLayout, cellForTile, constructLines, escLabelSpan, escLabel } from "../src/build/layout.ts"
import { popupSpec, placePopup } from "../src/build/popup.ts"
import type { PlacedPopup } from "../src/build/popup.ts"
import { buildKeyboardCommand } from "../src/build/keyboard.ts"
import { MOUSE_LEFT, MOUSE_RIGHT, buildMouseCommand, formatMouseEvent, parseMouseEvent } from "../src/build/mouse.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { startPulse } from "../src/cli/pulse-run.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { frameToText } from "../src/view/frame.ts"

const ESC = String.fromCharCode(27)
const MINIMUM = { columns: 80, rows: 24 }

function session(): { build: BuildSession; layout: ReturnType<typeof buildLayout> } {
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = new BuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport, startPulse })
  return { build, layout }
}

test("a waiting Nexus power refuses the commit, and nothing else", () => {
  // Gate 5D refused every edit until the pick was made, which was right for a forced full screen.
  // With a popup the player opens when they choose, the invariant is kept where it has to hold — the
  // Build Phase cannot end without a pick — and nowhere else (engine.md 9.7, canon 2.19).
  const { build } = session()
  build.dispatch({ kind: "arm", index: 0 })
  assert.equal(build.state.armed, 0, "arming was refused while a pick was waiting")
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  assert.equal(build.state.planned.length, 1, "placing was refused while a pick was waiting")
  build.dispatch({ kind: "move-cursor", dx: 4, dy: 0 })
  build.dispatch({ kind: "place" })
  build.dispatch({ kind: "remove" })
  assert.equal(build.state.planned.length, 1, "removing was refused while a pick was waiting")
  build.dispatch({ kind: "undo" })
  assert.equal(build.state.planned.length, 0, "undo was refused while a pick was waiting")

  build.dispatch({ kind: "open-battle-round" })
  assert.equal(build.state.popup === "battle-round", false)
  assert.match(build.state.status.text, /Pick a Nexus power first: \[n\] Nexus\./)
  assert.equal(build.state.status.tone, "warning")
})

test("moving the cursor is never refused while a pick is waiting", () => {
  const { build } = session()
  build.dispatch({ kind: "move-cursor", dx: 3, dy: 2 })
  assert.deepEqual(build.state.cursor, { x: 21, y: 15 })
  assert.doesNotMatch(build.state.status.text, /Pick a Nexus power first/)
})

test("nothing opens the Nexus popup but the player", () => {
  // Owner, 2026-09-26: never forced open the instant the Build Phase begins. Not at the start, not
  // after building, and not when the commit refuses for want of a pick — the refusal names the key.
  const { build, layout } = session()
  assert.equal(build.state.popup, null, "the Build Phase opened on the popup")
  build.handleData("1", layout)
  build.handleData("p", layout)
  assert.equal(build.state.popup, null, "something other than the player opened the popup")
  build.handleData("n", layout)
  assert.equal(build.state.popup, "nexus-powers")
})

test("the popup holds the keyboard until a pick or Esc: arrows work its list, and nothing reaches the plan", () => {
  const { build, layout } = session()
  build.handleData("1", layout) // arm a barracks, focus on the Grid
  build.handleData("n", layout)
  const cursor = build.state.cursor
  build.handleData(`${ESC}[B`, layout)
  assert.equal(build.state.popupHighlight, 1, "Down did not move the popup's own highlight")
  assert.deepEqual(build.state.cursor, cursor, "Down moved the Grid cursor behind the popup")
  for (const key of ["u", "\u007f", "\t", "2"]) build.handleData(key, layout)
  // "2" is the popup's own second option — digits address the popup's list while it is open.
  assert.equal(build.state.nexusPick, 1)
  assert.equal(build.state.planned.length, 0)
  // The pick closes the popup (owner, 2026-09-27 — Q60), and leaves what was behind it as it was.
  assert.equal(build.state.popup, null, "picking left the popup open")
  assert.equal(build.state.focus, "grid", "Tab moved focus from behind the popup")
  assert.equal(build.state.armed, 0, "the pick disarmed what was armed behind the popup")
  // Esc closes it without a pick, and x is Esc, everywhere.
  build.handleData("n", layout)
  build.handleData(ESC, layout)
  assert.equal(build.state.popup, null)
  assert.equal(build.state.armed, 0, "Esc closed the popup and disarmed in the same press")
  build.handleData("n", layout)
  build.handleData("x", layout)
  assert.equal(build.state.popup, null)
})

test("the popup picks by Up/Down and Enter too, closes, and lists the pick as active when reopened", () => {
  const context = spikeContext()
  const { build, layout } = session()
  build.handleData("n", layout)
  build.handleData(`${ESC}[B`, layout)
  build.handleData(" ", layout)
  assert.equal(build.state.nexusPick, 1)
  assert.equal(build.state.popup, null)
  build.handleData("n", layout)
  const text = frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))
  assert.match(text, /NEXUS POWERS/)
  assert.match(text, /Nothing waiting\./)
  assert.match(text, /ACTIVE/)
  assert.match(text, /War Chest/)
  assert.match(text, /\[esc\]/)
  // Enter with nothing left to pick says so, rather than doing something else.
  build.handleData("\r", layout)
  assert.match(build.state.status.text, /No Nexus power waiting/)
})

test("an open popup draws no placement ghost behind it, and refuses edits sent by a driver", () => {
  const context = spikeContext()
  const { build, layout } = session()
  build.dispatch({ kind: "arm", index: 2 })
  build.dispatch({ kind: "open-nexus-powers" })
  build.dispatch({ kind: "place" })
  assert.equal(build.state.planned.length, 0)
  assert.match(build.state.status.text, /Close the popup first/)
  const text = frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))
  const cursorCell = cellForTile(layout, build.state.camera, build.state.cursor)
  const turretGlyph = text.split("\n")[cursorCell.y]?.[cursorCell.x]
  assert.notEqual(turretGlyph, "x", "an illegal-placement block was drawn behind the popup")
})

test("picking applies its own effect exactly once, and cannot be changed afterward", () => {
  const { build, layout } = session()
  const context = spikeContext()
  build.dispatch({ kind: "pick-nexus", index: 1 }) // War Chest, +2000
  assert.equal(build.state.nexusPick, 1)
  assert.equal(build.state.bonusAllotment, context.nexusDraft[1]!.bonusAllotment)
  // The owner's number (2026-09-28, feedback F24): enough to place buildings freely in a playtest.
  assert.equal(build.state.bonusAllotment, 2000)
  const text = frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))
  assert.match(text, /\| {22}\* 2100[|+]/, "the panel's credits line, whole, with the War Chest")
  assert.match(build.state.status.text, /War Chest picked/)

  const after = build.state
  build.dispatch({ kind: "pick-nexus", index: 0 })
  assert.equal(build.state.nexusPick, after.nexusPick, "a second pick changed the first")
  assert.equal(build.state.bonusAllotment, after.bonusAllotment)
  assert.match(build.state.status.text, /Already picked/)
})

test("the budget on screen counts the picked power's share in what is left", () => {
  // Reserve Fund adds 30 to a 100-point allotment. The panel once read "130 of 100" — more left than
  // there ever was; since feedback F57 it shows no maximum at all, only what is left — since F71 with
  // the map's resource symbol: `* 130`.
  const context = spikeContext()
  const { build, layout } = session()
  build.dispatch({ kind: "pick-nexus", index: 0 })
  const text = frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))
  assert.match(text, /\* 130[|+]/)
  assert.doesNotMatch(text, / of 1[03]0/)
})

test("an out-of-range pick is ignored, not a crash and not a partial pick", () => {
  const { build } = session()
  const before = build.state
  build.dispatch({ kind: "pick-nexus", index: 99 })
  assert.deepEqual(build.state, before)
})

test("once picked, the construct menu and every other command work exactly as before this gate", () => {
  const { build } = session()
  build.dispatch({ kind: "pick-nexus", index: 0 })
  build.dispatch({ kind: "arm", index: 0 })
  assert.equal(build.state.armed, 0)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  assert.equal(build.state.planned.length, 1)
})

test("commit is refused before a pick, and opens the confirmation once one is made", () => {
  const { build } = session()
  build.dispatch({ kind: "open-battle-round" })
  assert.equal(build.state.popup === "battle-round", false, "commit opened the prompt before a pick")
  assert.match(build.state.status.text, /Pick a Nexus power first/)

  build.dispatch({ kind: "pick-nexus", index: 0 })
  build.dispatch({ kind: "open-battle-round" })
  assert.equal(build.state.popup, "battle-round")
  assert.match(build.state.status.text, /Battle Round 1/)
})

test("nothing but the confirmation itself changes state while it is open", () => {
  const { build } = session()
  build.dispatch({ kind: "pick-nexus", index: 0 })
  build.dispatch({ kind: "arm", index: 0 })
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  const beforeCommit = build.state
  build.dispatch({ kind: "open-battle-round" })

  for (const command of [
    { kind: "arm", index: 1 },
    { kind: "place" },
    { kind: "remove" },
    { kind: "undo" },
    { kind: "pick-nexus", index: 1 },
    { kind: "open-battle-round" },
    { kind: "open-nexus-powers" },
  ] as const) {
    build.dispatch(command)
    assert.equal(build.state.popup, "battle-round", `${command.kind} closed the prompt`)
    assert.deepEqual(build.state.planned, beforeCommit.planned, `${command.kind} changed the plan`)
  }
})

test("going back from the confirmation (Esc) cancels it and changes nothing else", () => {
  const { build } = session()
  build.dispatch({ kind: "pick-nexus", index: 0 })
  build.dispatch({ kind: "arm", index: 0 })
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  const beforeCommit = build.state
  build.dispatch({ kind: "open-battle-round" })
  build.dispatch({ kind: "cancel" })

  assert.equal(build.state.popup === "battle-round", false)
  assert.equal(build.state.committed, false)
  assert.deepEqual(build.state.planned, beforeCommit.planned)
  assert.match(build.state.status.text, /Cancelled/)

  // And building can continue exactly as if nothing happened.
  build.dispatch({ kind: "arm", index: 1 })
  assert.equal(build.state.armed, 1)
})

test("accepting the confirmation commits, and locks every state-changing command from then on", () => {
  const { build } = session()
  build.dispatch({ kind: "pick-nexus", index: 0 })
  build.dispatch({ kind: "arm", index: 0 })
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  build.dispatch({ kind: "open-battle-round" })
  build.dispatch({ kind: "start-pulse" })

  assert.equal(build.state.committed, true)
  assert.equal(build.state.popup === "battle-round", false)
  assert.match(build.state.status.text, /Build committed/)
  assert.match(build.state.status.text, /1 planned/)

  const committed = build.state
  for (const command of [
    { kind: "arm", index: 1 },
    { kind: "place" },
    { kind: "remove" },
    { kind: "undo" },
    { kind: "pick-nexus", index: 1 },
    { kind: "open-battle-round" },
    { kind: "start-pulse" },
  ] as const) {
    build.dispatch(command)
    assert.deepEqual(build.state.planned, committed.planned, `${command.kind} changed the plan after commit`)
    assert.equal(build.state.committed, true, `${command.kind} un-committed the Build Phase`)
  }
})

test("a stray y or n outside the confirmation is exactly as inert as a stray digit before anything is armed", () => {
  const { build } = session()
  const before = build.state
  build.dispatch({ kind: "start-pulse" })
  assert.deepEqual(build.state, before)
})

test("keyboard: a digit picks from the Nexus popup while it is open, and arms the construct menu otherwise", () => {
  const side = session()
  side.build.dispatch({ kind: "open-nexus-powers" })
  const popupContext = { itemCount: 3, armed: false, popup: "nexus-powers" as const, popupSpec: popupSpec(spikeContext(), side.build.state) }
  assert.deepEqual(buildKeyboardCommand("1", popupContext), { kind: "pick-nexus", index: 0 })
  assert.deepEqual(buildKeyboardCommand("2", popupContext), { kind: "pick-nexus", index: 1 })
  assert.equal(buildKeyboardCommand("3", popupContext), null, "a third popup digit picks nothing")
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.dispatch({ kind: "open-nexus-powers" })
  assert.equal(buildKeyboardCommand("1", { ...popupContext, popupSpec: popupSpec(spikeContext(), side.build.state) }), null)

  const builtContext = { itemCount: 3, armed: false }
  assert.deepEqual(buildKeyboardCommand("1", builtContext), { kind: "arm", index: 0 })
  assert.deepEqual(buildKeyboardCommand("1", { ...builtContext, focus: "menu" as const }), { kind: "arm", index: 0 })
})

test("keyboard: n opens the Nexus popup, and means nothing on the Battle Round confirmation", () => {
  const idle = { itemCount: 3, armed: false }
  assert.equal(buildKeyboardCommand("y", idle), null)
  assert.deepEqual(buildKeyboardCommand("n", idle), { kind: "open-nexus-powers" })
  assert.deepEqual(buildKeyboardCommand("p", idle), { kind: "open-battle-round" })
  assert.deepEqual(buildKeyboardCommand("n", { ...idle, popup: "nexus-powers" as const }), { kind: "cancel" })

  const confirming = { itemCount: 3, armed: false, popup: "battle-round" as const }
  assert.deepEqual(buildKeyboardCommand("y", confirming), { kind: "start-pulse" })
  // Only [s] Start is a row there (feedback F50): `n` is not "keep building", Esc is the way back.
  assert.equal(buildKeyboardCommand("n", confirming), null)
  assert.deepEqual(buildKeyboardCommand("\u001b", confirming), { kind: "cancel" })
  // The question is modal: the arrows do not reach the Grid behind it.
  assert.equal(buildKeyboardCommand(`${ESC}[C`, confirming), null)
})

/** The open popup, placed exactly as the composer and the mouse adapter place it. */
function placedPopup(side: ReturnType<typeof session>): PlacedPopup {
  const spec = popupSpec(spikeContext(), side.build.state)
  assert.ok(spec !== null, "no popup is open")
  return placePopup(side.layout, spec)
}

/** The click bytes for the popup option whose command matches, or for the top bar's "close [esc]". */
function clickPopupBytes(side: ReturnType<typeof session>, match: (command: BuildCommand) => boolean): string {
  const popup = placedPopup(side)
  const row = popup.rows.find((candidate) => candidate.spec.kind === "option" && match(candidate.spec.command))
  assert.ok(row !== undefined, "no such option in the popup")
  return formatMouseEvent(MOUSE_LEFT, popup.textColumn + 2, row.row + 1)
}
function clickPopupCloseBytes(side: ReturnType<typeof session>): string {
  const hint = escLabelSpan(side.layout, escLabel(side.build.state))
  assert.equal(escLabel(side.build.state), "close [esc]")
  return formatMouseEvent(MOUSE_LEFT, hint.from + 1, hint.row + 1)
}
function clickNexusEntryBytes(layout: ReturnType<typeof buildLayout>): string {
  return formatMouseEvent(MOUSE_LEFT, layout.panelColumn + 5, layout.panelRow + NEXUS_ROW + 1)
}

test("mouse: inside a popup a click picks or closes; outside it, a click closes it and brings focus there", () => {
  const side = session()
  side.build.handleData("n", side.layout)
  const popup = placedPopup(side)
  // Either row of an option — its name or its description — picks it.
  const second = popup.rows.filter((row) => row.spec.kind === "option")[2]!
  side.build.handleData(formatMouseEvent(MOUSE_LEFT, popup.textColumn + 6, second.row + 1), side.layout)
  assert.equal(side.build.state.nexusPick, 1)
  assert.equal(side.build.state.popup, null, "a pick closes the popup")
  // The top bar's "close [esc]" closes it without a pick.
  side.build.handleData("n", side.layout)
  side.build.handleData(clickPopupCloseBytes(side), side.layout)
  assert.equal(side.build.state.popup, null)

  // A click outside it — here, on the Grid — closes it and moves focus and the cursor there, and does
  // nothing more (owner, 2026-09-27).
  side.build.handleData("n", side.layout)
  side.build.dispatch({ kind: "focus", target: "menu" })
  const cell = cellForTile(side.layout, side.build.state.camera, { x: 20, y: 15 })
  side.build.handleData(formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1), side.layout)
  assert.equal(side.build.state.popup, null)
  assert.equal(side.build.state.focus, "grid")
  assert.deepEqual(side.build.state.cursor, { x: 20, y: 15 })
  assert.equal(side.build.state.planned.length, 0)

  // A right click is Esc.
  side.build.handleData("n", side.layout)
  side.build.handleData(formatMouseEvent(MOUSE_RIGHT, 10, 10), side.layout)
  assert.equal(side.build.state.popup, null)
})

test("a Nexus power is picked only in its own popup, or with none open: every other popup refuses a driver's pick", () => {
  for (const open of [["q"], ["d"], ["d", "e"], ["?"], ["q", "c"]]) {
    const side = session()
    for (const key of open) side.build.handleData(key, side.layout)
    const popup = side.build.state.popup
    assert.notEqual(popup, null)
    side.build.dispatch({ kind: "pick-nexus", index: 0 })
    assert.equal(side.build.state.nexusPick, null, `${open.join(" ")}: a pick went through with ${popup} open`)
    assert.equal(side.build.state.popup, popup)
    assert.equal(side.build.state.status.text, "Close the popup first: [esc].")
  }
  const bare = session()
  bare.build.dispatch({ kind: "pick-nexus", index: 0 })
  assert.equal(bare.build.state.nexusPick, 0)
})

test("a click outside the Battle Round screen says Cancelled, on the map as on the menu", () => {
  for (const where of ["map", "menu"] as const) {
    const side = session()
    side.build.dispatch({ kind: "pick-nexus", index: 0 })
    side.build.handleData("s", side.layout)
    assert.equal(side.build.state.popup, "battle-round")
    const cell = cellForTile(side.layout, side.build.state.camera, { x: side.build.state.camera.x + 2, y: side.build.state.camera.y + 1 })
    side.build.handleData(where === "map" ? formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1) : clickNexusEntryBytes(side.layout), side.layout)
    assert.equal(side.build.state.popup, null, where)
    assert.equal(side.build.state.committed, false)
    assert.equal(side.build.state.status.text, "Cancelled.", where)
  }
})

test("mouse: the Battle Round confirmation starts by click on [s] Start, and a click outside it cancels", () => {
  const yes = session()
  yes.build.dispatch({ kind: "pick-nexus", index: 0 })
  yes.build.handleData("p", yes.layout)
  yes.build.handleData(clickPopupBytes(yes, (c) => c.kind === "start-pulse"), yes.layout)
  assert.equal(yes.build.state.committed, true)

  const outside = session()
  outside.build.dispatch({ kind: "pick-nexus", index: 0 })
  outside.build.handleData("p", outside.layout)
  outside.build.handleData(clickNexusEntryBytes(outside.layout), outside.layout)
  assert.equal(outside.build.state.popup, null)
  assert.equal(outside.build.state.committed, false)
})

/** A click on a construct row, from `constructLines` — the same geometry the panel itself draws
 *  with, so a click that lands on a row nobody drew is structurally impossible here. */
function clickRowBytes(layout: ReturnType<typeof buildLayout>, index: number): string {
  const line = constructLines(layout, SPIKE_CATALOG).find((candidate) => candidate.index === index)
  assert.ok(line !== undefined, `no construct row is drawn for item ${index}`)
  const item = SPIKE_CATALOG[index]!
  const column = layout.panelColumn + Math.floor(`[${item.hotkey}] ${item.label}`.length / 2)
  return formatMouseEvent(MOUSE_LEFT, column + 1, line.row + 1)
}

/** The raw bytes a left click on this Grid tile sends, from the composer's own `cellForTile`. */
function clickTileBytes(
  layout: ReturnType<typeof buildLayout>,
  build: BuildSession,
  tile: { x: number; y: number },
): string {
  const cell = cellForTile(layout, build.state.camera, tile)
  return formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1)
}

test("the same pick-build-commit script produces an identical state by hotkeys, by clicks, and from a driver script", () => {
  // An armed click scrolls inside the view's edge zones (F22) and an arrow scrolls at the margin: the
  // parity here is the plan and the camera, so every tile clicked is clear of both, and neither scrolls.
  const byKeyboard = session()
  byKeyboard.build.handleData("n", byKeyboard.layout) // open the Nexus Powers
  byKeyboard.build.handleData("1", byKeyboard.layout) // pick Reserve Fund, which closes the popup
  byKeyboard.build.handleData("1", byKeyboard.layout) // arm Barracks
  // Row 13, clear of the scroll margin and of the click's edge zones.
  for (let step = 0; step < 12; step += 1) byKeyboard.build.handleData(`${ESC}[C`, byKeyboard.layout)
  byKeyboard.build.handleData("\r", byKeyboard.layout)
  // Placing handed the keyboard back to the menu, where the arming came from. The cursor is on the
  // new Barracks, so arming another moves it to the nearest spot with a free tile around it — a free
  // column to its right, 34,13 (feedback F30) — and Enter places it there.
  byKeyboard.build.handleData("1", byKeyboard.layout)
  assert.deepEqual(byKeyboard.build.state.cursor, { x: 34, y: 13 })
  byKeyboard.build.handleData("\r", byKeyboard.layout)
  byKeyboard.build.handleData("p", byKeyboard.layout)
  byKeyboard.build.handleData("y", byKeyboard.layout)

  const byMouse = session()
  // The screen opens with the keyboard on the menu, so one click on Nexus opens it.
  byMouse.build.handleData(clickNexusEntryBytes(byMouse.layout), byMouse.layout)
  byMouse.build.handleData(clickPopupBytes(byMouse, (c) => c.kind === "pick-nexus" && c.index === 0), byMouse.layout)
  // Digits are the hotkey path both players share; the rest is clicks.
  byMouse.build.handleData("1", byMouse.layout)
  // A click only arms the preview at a tile; a second click on that same tile places it (Q52).
  // Recomputed fresh each time, since the camera can move between clicks.
  const clickTile = (tile: { x: number; y: number }): void => {
    byMouse.build.handleData(clickTileBytes(byMouse.layout, byMouse.build, tile), byMouse.layout)
  }
  clickTile({ x: 30, y: 13 })
  clickTile({ x: 30, y: 13 })
  byMouse.build.handleData("1", byMouse.layout)
  // Arming already put the cursor on 34,13, so one click there is the confirming second click.
  clickTile({ x: 34, y: 13 })
  byMouse.build.handleData("p", byMouse.layout)
  byMouse.build.handleData(clickPopupBytes(byMouse, (c) => c.kind === "start-pulse"), byMouse.layout)

  const script: readonly BuildCommand[] = [
    { kind: "open-nexus-powers" },
    { kind: "pick-nexus", index: 0 },
    { kind: "arm", index: 0 },
    { kind: "move-cursor", dx: 12, dy: 0 },
    { kind: "place" },
    { kind: "arm", index: 0 },
    { kind: "place" },
    { kind: "open-battle-round" },
    { kind: "start-pulse" },
  ]
  const byDriver = session()
  byDriver.build.run(script)

  assert.equal(byKeyboard.build.state.committed, true, "the test did not actually reach committed")
  assert.equal(byKeyboard.build.state.planned.length, 2)
  // The one difference is the point of feedback F22: a placement by the mouse leaves the menu with no
  // "highlighted, not yet chosen" bar, one by the keyboard leaves it showing for the next key. The
  // committed screen draws no menu, so the frames still match.
  assert.equal(byMouse.build.state.highlightHidden, true)
  assert.equal(byKeyboard.build.state.highlightHidden, false)
  assert.deepEqual({ ...byMouse.build.state, highlightHidden: false }, byKeyboard.build.state)
  assert.deepEqual(byDriver.build.state, byKeyboard.build.state)
  const frame = (side: ReturnType<typeof session>): string =>
    frameToText(composeBuildFrame({ context: spikeContext(), state: side.build.state, layout: side.layout }, "monochrome"))
  assert.equal(frame(byMouse), frame(byKeyboard))
  assert.equal(frame(byDriver), frame(byKeyboard))

  // Gate 6A: the commit starts a Nexus Pulse, and whichever adapter started it, it is the same Pulse —
  // the kernel's own two hashes, the ending's Recall, and what each of them shows at the same instant.
  const pulseOf = (side: ReturnType<typeof session>) => {
    assert.ok(side.build.pulse !== null, "the commit did not start a Pulse")
    return side.build.pulse.resolved
  }
  for (const side of [byKeyboard, byMouse, byDriver]) side.build.advance(0)
  for (const other of [byMouse, byDriver]) {
    assert.equal(pulseOf(other).timeline.stateHash, pulseOf(byKeyboard).timeline.stateHash)
    assert.equal(pulseOf(other).timeline.eventsHash, pulseOf(byKeyboard).timeline.eventsHash)
    assert.deepEqual(pulseOf(other).recall.moves, pulseOf(byKeyboard).recall.moves)
    assert.deepEqual(other.build.pulseFrame(other.layout)?.sample.state, byKeyboard.build.pulseFrame(byKeyboard.layout)?.sample.state)
  }
})
