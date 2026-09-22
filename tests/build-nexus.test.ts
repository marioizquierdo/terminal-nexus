// Gate 5D: the Nexus draft slot and commit. "A dealt Nexus power may not be skipped"
// (commander-armies.md Section 4.5), so every state-changing command is refused until one is picked,
// and committing asks once — engine.md 9.7: "the one action that must not fire by accident."

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_CATALOG } from "../src/build/catalog.ts"
import { buildLayout, cellForTile, confirmLayout, constructLines, nexusDraftLayout } from "../src/build/layout.ts"
import { CONFIRM_ITEMS } from "../src/build/layout.ts"
import { menuItemRow } from "../src/menu/layout.ts"
import { buildKeyboardCommand } from "../src/build/keyboard.ts"
import { MOUSE_LEFT, buildMouseCommand, formatMouseEvent, parseMouseEvent } from "../src/build/mouse.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { spikeContext } from "../src/cli/spike.ts"

const ESC = String.fromCharCode(27)
const MINIMUM = { columns: 80, rows: 24 }

function session(): { build: BuildSession; layout: ReturnType<typeof buildLayout> } {
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = new BuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
  return { build, layout }
}

test("drafting refuses every state-changing command, and names the reason", () => {
  const { build } = session()
  const before = build.state
  for (const command of [
    { kind: "arm", index: 0 },
    { kind: "place" },
    { kind: "remove" },
    { kind: "undo" },
    { kind: "commit" },
  ] as const) {
    build.dispatch(command)
    assert.match(build.state.message, /Pick a Nexus power first/, `${command.kind} was not refused`)
    assert.equal(build.state.armed, before.armed, `${command.kind} changed armed`)
    assert.deepEqual(build.state.planned, before.planned, `${command.kind} changed the plan`)
  }
})

test("moving the cursor is not refused while drafting - only state-changing commands are", () => {
  const { build } = session()
  build.dispatch({ kind: "move-cursor", dx: 3, dy: 2 })
  assert.deepEqual(build.state.cursor, { x: 21, y: 15 })
  assert.doesNotMatch(build.state.message, /Pick a Nexus power first/)
})

test("picking applies its own effect exactly once, and cannot be changed afterward", () => {
  const { build } = session()
  const context = spikeContext()
  build.dispatch({ kind: "pick-nexus", index: 1 }) // War Chest, +60
  assert.equal(build.state.nexusPick, 1)
  assert.equal(build.state.bonusAllotment, context.nexusDraft[1]!.bonusAllotment)
  assert.match(build.state.message, /War Chest picked/)

  const after = build.state
  build.dispatch({ kind: "pick-nexus", index: 0 })
  assert.equal(build.state.nexusPick, after.nexusPick, "a second pick changed the first")
  assert.equal(build.state.bonusAllotment, after.bonusAllotment)
  assert.match(build.state.message, /Already picked/)
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
  build.dispatch({ kind: "commit" })
  assert.equal(build.state.confirmingCommit, false, "commit opened the prompt before a pick")
  assert.match(build.state.message, /Pick a Nexus power first/)

  build.dispatch({ kind: "pick-nexus", index: 0 })
  build.dispatch({ kind: "commit" })
  assert.equal(build.state.confirmingCommit, true)
  assert.match(build.state.message, /Start Nexus Pulse/)
})

test("nothing but the confirmation itself changes state while it is open", () => {
  const { build } = session()
  build.dispatch({ kind: "pick-nexus", index: 0 })
  build.dispatch({ kind: "arm", index: 0 })
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  const beforeCommit = build.state
  build.dispatch({ kind: "commit" })

  for (const command of [
    { kind: "arm", index: 1 },
    { kind: "place" },
    { kind: "remove" },
    { kind: "undo" },
    { kind: "pick-nexus", index: 1 },
    { kind: "commit" },
  ] as const) {
    build.dispatch(command)
    assert.equal(build.state.confirmingCommit, true, `${command.kind} closed the prompt`)
    assert.deepEqual(build.state.planned, beforeCommit.planned, `${command.kind} changed the plan`)
  }
})

test("declining the confirmation cancels it and changes nothing else", () => {
  const { build } = session()
  build.dispatch({ kind: "pick-nexus", index: 0 })
  build.dispatch({ kind: "arm", index: 0 })
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  const beforeCommit = build.state
  build.dispatch({ kind: "commit" })
  build.dispatch({ kind: "confirm-commit", accept: false })

  assert.equal(build.state.confirmingCommit, false)
  assert.equal(build.state.committed, false)
  assert.deepEqual(build.state.planned, beforeCommit.planned)
  assert.match(build.state.message, /Cancelled/)

  // And building can continue exactly as if nothing happened.
  build.dispatch({ kind: "arm", index: 1 })
  assert.equal(build.state.armed, 1)
})

test("accepting the confirmation commits, and locks every state-changing command from then on", () => {
  const { build } = session()
  build.dispatch({ kind: "pick-nexus", index: 0 })
  build.dispatch({ kind: "arm", index: 0 })
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  build.dispatch({ kind: "commit" })
  build.dispatch({ kind: "confirm-commit", accept: true })

  assert.equal(build.state.committed, true)
  assert.equal(build.state.confirmingCommit, false)
  assert.match(build.state.message, /Build committed/)
  assert.match(build.state.message, /1 planned/)

  const committed = build.state
  for (const command of [
    { kind: "arm", index: 1 },
    { kind: "place" },
    { kind: "remove" },
    { kind: "undo" },
    { kind: "pick-nexus", index: 1 },
    { kind: "commit" },
    { kind: "confirm-commit", accept: true },
  ] as const) {
    build.dispatch(command)
    assert.deepEqual(build.state.planned, committed.planned, `${command.kind} changed the plan after commit`)
    assert.equal(build.state.committed, true, `${command.kind} un-committed the Build Phase`)
  }
})

test("a stray y or n outside the confirmation is exactly as inert as a stray digit before anything is armed", () => {
  const { build } = session()
  const before = build.state
  build.dispatch({ kind: "confirm-commit", accept: true })
  assert.deepEqual(build.state, before)
})

test("keyboard: a digit picks the Nexus draft first, then arms the construct menu", () => {
  const draftContext = { itemCount: 3, armed: false, draftOptionCount: 2 }
  assert.deepEqual(buildKeyboardCommand("1", draftContext), { kind: "pick-nexus", index: 0 })
  assert.deepEqual(buildKeyboardCommand("2", draftContext), { kind: "pick-nexus", index: 1 })
  assert.equal(buildKeyboardCommand("3", draftContext), null, "a third draft digit picks nothing")

  const builtContext = { itemCount: 3, armed: false }
  assert.deepEqual(buildKeyboardCommand("1", builtContext), { kind: "arm", index: 0 })
})

test("keyboard: y, n and p are bound, and Esc answers the confirmation when it is open", () => {
  const idle = { itemCount: 3, armed: false }
  assert.deepEqual(buildKeyboardCommand("y", idle), { kind: "confirm-commit", accept: true })
  assert.deepEqual(buildKeyboardCommand("n", idle), { kind: "confirm-commit", accept: false })
  assert.deepEqual(buildKeyboardCommand("p", idle), { kind: "commit" })

  const confirming = { itemCount: 3, armed: false, confirming: true }
  assert.deepEqual(buildKeyboardCommand("\u001b", confirming), { kind: "confirm-commit", accept: false })
  // Esc's ordinary meaning returns the moment the prompt is answered.
  assert.deepEqual(buildKeyboardCommand("\u001b", { itemCount: 3, armed: true }), { kind: "disarm" })
})

test("mouse: a click on a draft row picks it, and does not fall through to the construct menu", () => {
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const draftLayout = nexusDraftLayout(layout)
  const row = menuItemRow(draftLayout, 1)
  const event = parseMouseEvent(formatMouseEvent(MOUSE_LEFT, draftLayout.column + 1, row + 1))
  assert.ok(event !== null)
  const command = buildMouseCommand(event, { x: 0, y: 0 }, layout, SPIKE_CATALOG, {
    draftOptions: context.nexusDraft,
  })
  assert.deepEqual(command, { kind: "pick-nexus", index: 1 })
})

test("mouse: a click on the confirmation's own rows answers it, not the tile beneath", () => {
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const layoutY = confirmLayout(layout)
  const yesRow = menuItemRow(layoutY, 0)
  const noRow = menuItemRow(layoutY, 1)
  const yesEvent = parseMouseEvent(formatMouseEvent(MOUSE_LEFT, layoutY.column + 1, yesRow + 1))
  const noEvent = parseMouseEvent(formatMouseEvent(MOUSE_LEFT, layoutY.column + 1, noRow + 1))
  assert.ok(yesEvent !== null && noEvent !== null)
  assert.deepEqual(
    buildMouseCommand(yesEvent, { x: 0, y: 0 }, layout, SPIKE_CATALOG, { confirming: true }),
    { kind: "confirm-commit", accept: true },
  )
  assert.deepEqual(
    buildMouseCommand(noEvent, { x: 0, y: 0 }, layout, SPIKE_CATALOG, { confirming: true }),
    { kind: "confirm-commit", accept: false },
  )
  assert.equal(CONFIRM_ITEMS.length, 2)
})

/** A click on a construct row, from `constructLines` — the same geometry the panel itself draws
 *  with, so a click that lands on a group heading is structurally impossible here. */
function clickRowBytes(layout: ReturnType<typeof buildLayout>, index: number): string {
  const line = constructLines(layout, SPIKE_CATALOG).find(
    (candidate) => candidate.kind === "item" && candidate.index === index,
  )
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

/** A click on Nexus draft option *n*, or on the confirmation's `y`/`n` row — the same
 *  `nexusDraftLayout`/`confirmLayout` geometry the composer draws those two screens with. */
function clickMenuBytes(menuLayout: ReturnType<typeof nexusDraftLayout>, index: number): string {
  const row = menuItemRow(menuLayout, index)
  return formatMouseEvent(MOUSE_LEFT, menuLayout.column + 1, row + 1)
}

test("the same pick-build-commit script produces an identical state by hotkeys, by clicks, and from a driver script", () => {
  const byKeyboard = session()
  byKeyboard.build.handleData("1", byKeyboard.layout) // pick Reserve Fund
  byKeyboard.build.handleData("1", byKeyboard.layout) // arm Barracks
  for (let step = 0; step < 12; step += 1) byKeyboard.build.handleData(`${ESC}[C`, byKeyboard.layout)
  byKeyboard.build.handleData(`${ESC}[B`, byKeyboard.layout)
  byKeyboard.build.handleData("\r", byKeyboard.layout)
  for (let step = 0; step < 4; step += 1) byKeyboard.build.handleData(`${ESC}[C`, byKeyboard.layout)
  byKeyboard.build.handleData("\r", byKeyboard.layout)
  byKeyboard.build.handleData("p", byKeyboard.layout)
  byKeyboard.build.handleData("y", byKeyboard.layout)

  const byMouse = session()
  byMouse.build.handleData(clickMenuBytes(nexusDraftLayout(byMouse.layout), 0), byMouse.layout)
  byMouse.build.handleData(clickRowBytes(byMouse.layout, 0), byMouse.layout)
  byMouse.build.handleData(clickTileBytes(byMouse.layout, byMouse.build, { x: 30, y: 14 }), byMouse.layout)
  byMouse.build.handleData(clickTileBytes(byMouse.layout, byMouse.build, { x: 34, y: 14 }), byMouse.layout)
  byMouse.build.handleData("p", byMouse.layout)
  byMouse.build.handleData(clickMenuBytes(confirmLayout(byMouse.layout), 0), byMouse.layout)

  const script: readonly BuildCommand[] = [
    { kind: "pick-nexus", index: 0 },
    { kind: "arm", index: 0 },
    { kind: "move-cursor", dx: 12, dy: 1 },
    { kind: "place" },
    { kind: "move-cursor", dx: 4, dy: 0 },
    { kind: "place" },
    { kind: "commit" },
    { kind: "confirm-commit", accept: true },
  ]
  const byDriver = session()
  byDriver.build.run(script)

  assert.equal(byKeyboard.build.state.committed, true, "the test did not actually reach committed")
  assert.equal(byKeyboard.build.state.planned.length, 2)
  assert.deepEqual(byMouse.build.state, byKeyboard.build.state)
  assert.deepEqual(byDriver.build.state, byKeyboard.build.state)
})
