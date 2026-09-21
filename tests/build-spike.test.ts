// Gate 5A's sharp edge: the same Build Phase plan, entered by raw keystrokes, by raw mouse bytes,
// and from a command script, must be the same plan and the same screen. engine.md 9.7 is a RULE
// that "a command's effect never depends on which adapter produced it", and the only way to prove
// that is to start each path from bytes a terminal actually sends — never from a hand-built command,
// which would assert that the thing downstream of the mapping works while leaving the mapping, the
// part most likely to drift, untested.

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_ALLOTMENT, SPIKE_CATALOG, spikeGrid } from "../src/build/catalog.ts"
import { buildLayout, cellForTile, constructLines } from "../src/build/layout.ts"
import { buildKeyboardCommand } from "../src/build/keyboard.ts"
import {
  MOUSE_LEFT,
  MOUSE_RIGHT,
  MOUSE_WHEEL_DOWN,
  MOUSE_WHEEL_UP,
  formatMouseEvent,
  parseMouseEvent,
} from "../src/build/mouse.ts"
import { BuildSession } from "../src/build/session.ts"
import { JUMP_TILES, anchorForCursor, legalityAt, remaining, spent } from "../src/build/state.ts"
import type { BuildCommand } from "../src/build/types.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { frameToText } from "../src/view/frame.ts"
import { fitViewport } from "../src/build/camera.ts"

const ESC = String.fromCharCode(27)
const UP = `${ESC}[A`
const DOWN = `${ESC}[B`
const RIGHT = `${ESC}[C`
const LEFT = `${ESC}[D`
const SHIFT_RIGHT = `${ESC}[1;2C`
const RXVT_SHIFT_RIGHT = `${ESC}[c`
const PAGE_DOWN = `${ESC}[6~`
const ENTER = "\r"

const MINIMUM = { columns: 80, rows: 24 }
const MAXIMUM = { columns: 104, rows: 32 }

function session(terminal = MINIMUM): { build: BuildSession; layout: ReturnType<typeof buildLayout> } {
  const context = spikeContext()
  const layout = buildLayout(terminal, context.grid)
  const build = new BuildSession({
    context,
    cursor: { x: 18, y: 13 },
    viewport: layout.viewport,
  })
  return { build, layout }
}

/** The frame as text, which is what "the same screen" means for an assertion. */
function screen(build: BuildSession, layout: ReturnType<typeof buildLayout>): string {
  return frameToText(
    composeBuildFrame({ context: spikeContext(), state: build.state, layout }, "monochrome"),
  )
}

/** The raw bytes a left click on this Grid tile sends, derived from the composer's own geometry —
 *  1-based, like a terminal's own coordinates. A hand-picked number here could quietly stop matching
 *  the screen; this cannot. */
function clickTileBytes(
  layout: ReturnType<typeof buildLayout>,
  build: BuildSession,
  tile: { x: number; y: number },
): string {
  const cell = cellForTile(layout, build.state.camera, tile)
  return formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1)
}

/** Likewise for a construct row, from `constructLines` — the same function the panel draws with,
 *  which is what makes a click that lands on a group heading's row impossible to mistake for a
 *  click on an item. */
function clickRowBytes(layout: ReturnType<typeof buildLayout>, index: number): string {
  const line = constructLines(layout, SPIKE_CATALOG).find(
    (candidate) => candidate.kind === "item" && candidate.index === index,
  )
  assert.ok(line !== undefined, `no construct row is drawn for item ${index}`)
  const item = SPIKE_CATALOG[index]!
  // Anywhere inside the row's own drawn text; the middle proves the whole row is live, not just its
  // first cell.
  const column = layout.panelColumn + Math.floor(`[${item.hotkey}] ${item.label}`.length / 2)
  return formatMouseEvent(MOUSE_LEFT, column + 1, line.row + 1)
}

test("the same plan by hotkeys, by clicks, and from a script is the same plan and the same screen", () => {
  // Two barracks, side by side, at tiles that are on screen from the start: 1 arms it, the cursor
  // walks to 30,14, Enter places, and — because the item stays armed — four more steps east and one
  // more Enter places the second without re-arming.
  const byKeyboard = session()
  byKeyboard.build.handleData("1", byKeyboard.layout)
  for (let step = 0; step < 12; step += 1) byKeyboard.build.handleData(RIGHT, byKeyboard.layout)
  byKeyboard.build.handleData(DOWN, byKeyboard.layout)
  byKeyboard.build.handleData(ENTER, byKeyboard.layout)
  for (let step = 0; step < 4; step += 1) byKeyboard.build.handleData(RIGHT, byKeyboard.layout)
  byKeyboard.build.handleData(ENTER, byKeyboard.layout)

  const byMouse = session()
  byMouse.build.handleData(clickRowBytes(byMouse.layout, 0), byMouse.layout)
  byMouse.build.handleData(clickTileBytes(byMouse.layout, byMouse.build, { x: 30, y: 14 }), byMouse.layout)
  byMouse.build.handleData(clickTileBytes(byMouse.layout, byMouse.build, { x: 34, y: 14 }), byMouse.layout)

  const script: readonly BuildCommand[] = [
    { kind: "arm", index: 0 },
    { kind: "move-cursor", dx: 12, dy: 1 },
    { kind: "place" },
    { kind: "move-cursor", dx: 4, dy: 0 },
    { kind: "place" },
  ]
  const byDriver = session()
  byDriver.build.run(script)

  assert.equal(byKeyboard.build.state.planned.length, 2, "two structures were actually planned")
  assert.deepEqual(byMouse.build.state.planned, byKeyboard.build.state.planned)
  assert.deepEqual(byDriver.build.state.planned, byKeyboard.build.state.planned)
  // Not just the plan: the whole state, camera and cursor and message included.
  assert.deepEqual(byMouse.build.state, byKeyboard.build.state)
  assert.deepEqual(byDriver.build.state, byKeyboard.build.state)
  assert.equal(screen(byMouse.build, byMouse.layout), screen(byKeyboard.build, byKeyboard.layout))
  assert.equal(screen(byDriver.build, byDriver.layout), screen(byKeyboard.build, byKeyboard.layout))
})

test("the armed item stays armed after placing - the fast path a proficient player types", () => {
  const { build, layout } = session()
  build.handleData("1", layout)
  assert.equal(build.state.armed, 0)
  build.handleData(ENTER, layout)
  assert.equal(build.state.armed, 0, "still armed after a placement")
  assert.match(build.state.message, /planned at/)
})

test("keyboard: Shift+Arrow and its modifier-free fallback both jump exactly five tiles", () => {
  // Measured, not assumed — scripts/probe-modified-keys.mjs found three live encodings for a
  // shifted arrow and none at all on several terminals, which is why all of these are bound.
  const context = { itemCount: 3, armed: false }
  assert.deepEqual(buildKeyboardCommand(RIGHT, context), { kind: "move-cursor", dx: 1, dy: 0 })
  assert.deepEqual(buildKeyboardCommand(SHIFT_RIGHT, context), {
    kind: "move-cursor",
    dx: JUMP_TILES,
    dy: 0,
  })
  assert.deepEqual(buildKeyboardCommand(RXVT_SHIFT_RIGHT, context), {
    kind: "move-cursor",
    dx: JUMP_TILES,
    dy: 0,
  })
  assert.deepEqual(buildKeyboardCommand(PAGE_DOWN, context), {
    kind: "move-cursor",
    dx: 0,
    dy: JUMP_TILES,
  })
  // Home and End have three live spellings between xterm, screen/tmux/linux and rxvt; all of them
  // mean the same five tiles.
  for (const home of [`${ESC}OH`, `${ESC}[1~`, `${ESC}[7~`, `${ESC}[H`]) {
    assert.deepEqual(buildKeyboardCommand(home, context), {
      kind: "move-cursor",
      dx: -JUMP_TILES,
      dy: 0,
    })
  }
  // A terminal that switched to application cursor mode sends `ESC O A`, not `ESC [ A`. Both are
  // plain arrows, and both move one tile.
  assert.deepEqual(buildKeyboardCommand(`${ESC}OB`, context), { kind: "move-cursor", dx: 0, dy: 1 })
})

test("keyboard: digits always address the list, and a digit past its end means nothing", () => {
  const context = { itemCount: 3, armed: false }
  assert.deepEqual(buildKeyboardCommand("2", context), { kind: "arm", index: 1 })
  assert.equal(buildKeyboardCommand("4", context), null)
  assert.equal(buildKeyboardCommand("0", context), null)
})

test("keyboard: Esc disarms when something is armed, and otherwise backs out", () => {
  assert.deepEqual(buildKeyboardCommand(ESC, { itemCount: 3, armed: true }), { kind: "disarm" })
  assert.deepEqual(buildKeyboardCommand(ESC, { itemCount: 3, armed: false }), { kind: "back" })
})

test("keyboard: a letter this screen does not bind means nothing at all", () => {
  // `t` was the click-mode toggle until Q50 was answered. A retired binding that quietly still does
  // something is worse than one that never existed, so it is asserted dead rather than forgotten.
  const context = { itemCount: 3, armed: true }
  for (const key of ["t", "h", "j", "k", "l", "x"]) {
    assert.equal(buildKeyboardCommand(key, context), null, `"${key}" should mean nothing here`)
  }
})

test("mouse: the wheel moves the cursor five tiles and drags the camera with it", () => {
  const { build, layout } = session()
  const before = { ...build.state.camera }
  const startY = build.state.cursor.y
  build.handleData(formatMouseEvent(MOUSE_WHEEL_DOWN, 10, 10), layout)
  assert.equal(build.state.cursor.y, startY + JUMP_TILES)
  assert.ok(build.state.camera.y > before.y, "the camera followed the cursor south")
  build.handleData(formatMouseEvent(MOUSE_WHEEL_UP, 10, 10), layout)
  assert.equal(build.state.cursor.y, startY)
})

test("mouse: right click is Esc, and a click on a construct row is that row's hotkey", () => {
  const { build, layout } = session()
  build.handleData(clickRowBytes(layout, 1), layout)
  assert.equal(build.state.armed, 1)
  build.handleData(formatMouseEvent(MOUSE_RIGHT, 10, 10), layout)
  assert.equal(build.state.armed, null)
})

test("mouse: a click on the side panel is not a click on the Grid", () => {
  const { build, layout } = session()
  const cursorBefore = { ...build.state.cursor }
  // Well below the construct rows, inside the panel: neither a row nor a tile.
  build.handleData(
    formatMouseEvent(MOUSE_LEFT, layout.panelColumn + 3, layout.footerRow - 1),
    layout,
  )
  assert.deepEqual(build.state.cursor, cursorBefore)
})

test("parseMouseEvent: a release is not a press, and the bytes round-trip", () => {
  assert.deepEqual(parseMouseEvent(formatMouseEvent(MOUSE_LEFT, 12, 7)), {
    button: MOUSE_LEFT,
    column: 11,
    row: 6,
    press: true,
  })
  assert.equal(parseMouseEvent(`${ESC}[<0;12;7m`)?.press, false)
  assert.equal(parseMouseEvent("not a mouse report"), null)
})

test("a click on a tile places the armed structure there, exactly as arrows then Enter would", () => {
  // Q50, answered: a click places it. Gate 5A shipped a second behaviour beside this one — click,
  // then click again to confirm — as a toggle; Mario chose this one and the other is gone.
  const byClick = session()
  byClick.build.handleData("1", byClick.layout)
  byClick.build.handleData(
    clickTileBytes(byClick.layout, byClick.build, { x: 30, y: 14 }),
    byClick.layout,
  )
  assert.equal(byClick.build.state.planned.length, 1)

  const byKeyboard = session()
  byKeyboard.build.handleData("1", byKeyboard.layout)
  byKeyboard.build.run([{ kind: "move-cursor", dx: 12, dy: 1 }])
  byKeyboard.build.handleData(ENTER, byKeyboard.layout)
  assert.deepEqual(byClick.build.state, byKeyboard.build.state)
})

test("a misclick costs one undo, which is what makes placing on the first click safe", () => {
  // The whole argument for single-click placement (engine.md 9.7): a plan is revisable until the
  // commit. If that stopped being true, the click behaviour would have to be revisited with it.
  const { build, layout } = session()
  build.handleData("1", layout)
  build.handleData(clickTileBytes(layout, build, { x: 30, y: 14 }), layout)
  assert.equal(build.state.planned.length, 1)
  build.handleData("u", layout)
  assert.equal(build.state.planned.length, 0)
})

test("legality: an illegal placement is refused with a reason and nothing is moved to fit", () => {
  const { build, layout } = session()
  const context = spikeContext()
  build.handleData("1", layout)

  // The north-west wall: rock at 8,5 through 21,5.
  build.run([{ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }])
  const cursorBefore = { ...build.state.cursor }
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 0)
  assert.match(build.state.message, /rock in the way/)
  assert.deepEqual(build.state.cursor, cursorBefore, "the cursor did not slide somewhere legal")

  // The standing Grid Nexus, at 17,10 through 19,11.
  build.run([{ kind: "move-cursor", dx: 18 - 8, dy: 10 - 5 }])
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 0)
  assert.match(build.state.message, /the nexus is here/)

  // The Grid's own north-west corner, where a 3x2 footprint hangs off the edge.
  build.run([{ kind: "move-cursor", dx: -999, dy: -999 }])
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 0)
  assert.match(build.state.message, /off the Grid/)

  // And a legal one, for contrast: the refusals above are about the tile, not about placement.
  build.run([{ kind: "move-cursor", dx: 30, dy: 14 }])
  build.handleData(ENTER, layout)
  assert.equal(build.state.planned.length, 1)
  const placed = build.state.planned[0]!
  assert.ok(
    legalityAt(context, [], placed.contentId, placed.anchor).ok,
    "what was planned is legal on its own terms",
  )
})

test("legality: a second structure may not overlap the first one planned", () => {
  const { build, layout } = session()
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  assert.equal(build.state.planned.length, 1)
  build.run([{ kind: "move-cursor", dx: 1, dy: 0 }, { kind: "place" }])
  assert.equal(build.state.planned.length, 1)
  assert.match(build.state.message, /the barracks is here/)
})

test("a plan is revisable: remove under the cursor, and undo the last one", () => {
  const { build, layout } = session()
  build.handleData("1", layout)
  build.run([
    { kind: "move-cursor", dx: 12, dy: 1 },
    { kind: "place" },
    { kind: "move-cursor", dx: 4, dy: 0 },
    { kind: "place" },
  ])
  assert.equal(build.state.planned.length, 2)
  build.handleData("u", layout)
  assert.equal(build.state.planned.length, 1)
  // Backspace removes whatever is under the cursor, wherever in the plan it came from.
  build.run([{ kind: "move-cursor", dx: -4, dy: 0 }])
  build.handleData(String.fromCharCode(127), layout)
  assert.equal(build.state.planned.length, 0)
  build.handleData("u", layout)
  assert.match(build.state.message, /Nothing to undo/)
})

test("the cursor points at a structure's centre tile, the way the scenario format already does", () => {
  const context = spikeContext()
  const barracks = context.registry.get("structure.citizen.barracks")
  // A 3x2 footprint centres on its second column and its first row.
  assert.deepEqual(anchorForCursor({ x: 30, y: 14 }, barracks.footprint), { x: 29, y: 14 })
  const turret = context.registry.get("structure.bench.beamturret")
  assert.deepEqual(anchorForCursor({ x: 30, y: 14 }, turret.footprint), { x: 30, y: 14 })
})

test("every construct row names content that exists, costs something, and says what it does", () => {
  const context = spikeContext()
  for (const item of SPIKE_CATALOG) {
    assert.ok(context.registry.has(item.contentId), `${item.contentId} is not real content`)
    assert.ok(item.cost > 0, `${item.label} costs nothing`)
    assert.ok(item.effect.length > 0, `${item.label} does not say what it does`)
    // The effect line has to fit the panel it is drawn in, or it says what it does only halfway.
    assert.ok(item.effect.length <= 28, `"${item.effect}" is wider than the panel`)
  }
})

test("the budget actually runs out, which is the only thing that makes the menu a choice", () => {
  // Asserted as behaviour rather than as arithmetic over the constants: what matters is that a
  // player placing things hits the wall, not that three particular numbers sum a particular way.
  const { build, layout } = session()
  build.handleData("1", layout) // the most expensive row
  const context = spikeContext()
  assert.equal(remaining(context, build.state), SPIKE_ALLOTMENT)

  let placed = 0
  for (let step = 0; step < 20 && !/costs/.test(build.state.message); step += 1) {
    build.run([{ kind: "move-cursor", dx: 4, dy: 0 }, { kind: "place" }])
    placed = build.state.planned.length
  }
  assert.ok(placed > 0, "nothing could be placed at all")
  assert.match(build.state.message, /costs \d+, \d+ left/, "the budget never ran out")
  assert.ok(remaining(context, build.state) >= 0, "spending went past the allotment")
})

test("spending is exactly as revisable as the plan: placing spends, removing and undoing refund", () => {
  const context = spikeContext()
  const { build, layout } = session()
  const barracks = SPIKE_CATALOG[0]!
  const turret = SPIKE_CATALOG[2]!

  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  assert.equal(spent(context, build.state), barracks.cost)

  build.handleData("3", layout)
  build.run([{ kind: "move-cursor", dx: 6, dy: 0 }, { kind: "place" }])
  assert.equal(spent(context, build.state), barracks.cost + turret.cost)
  assert.equal(remaining(context, build.state), SPIKE_ALLOTMENT - barracks.cost - turret.cost)

  // Undo refunds the last one exactly, and Backspace refunds whichever is under the cursor.
  build.handleData("u", layout)
  assert.equal(spent(context, build.state), barracks.cost)
  build.run([{ kind: "move-cursor", dx: -6, dy: 0 }])
  build.handleData(String.fromCharCode(127), layout)
  assert.equal(spent(context, build.state), 0)
  assert.equal(remaining(context, build.state), SPIKE_ALLOTMENT, "the allotment came back whole")
})

test("a placement that cannot be afforded is refused, and changes nothing at all", () => {
  const context = spikeContext()
  const { build, layout } = session()
  // Spend down to less than the barracks costs, then try a barracks.
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  build.run([{ kind: "move-cursor", dx: 4, dy: 0 }, { kind: "place" }])
  const before = build.state
  const left = remaining(context, build.state)
  assert.ok(left < SPIKE_CATALOG[0]!.cost, "the test did not actually spend enough to matter")

  build.run([{ kind: "move-cursor", dx: 4, dy: 0 }])
  build.handleData("\r", layout)
  assert.equal(build.state.planned.length, before.planned.length, "it was planned anyway")
  assert.equal(remaining(context, build.state), left, "the budget moved on a refused placement")
  assert.match(build.state.message, /costs 40, \d+ left/)
})

test("affordability is reported before a tile problem, because it is true wherever the cursor is", () => {
  const context = spikeContext()
  const { build } = session()
  // Onto rock, with a budget that cannot pay for it either. Reporting the rock would send the
  // player to move the cursor, which would not help.
  const anchor = anchorForCursor({ x: 8, y: 5 }, context.registry.get(SPIKE_CATALOG[0]!.contentId).footprint)
  const broke = legalityAt(context, [], SPIKE_CATALOG[0]!.contentId, anchor, 5)
  assert.equal(broke.ok, false)
  assert.match(broke.ok === false ? broke.reason : "", /costs 40, 5 left/)
  // With money, the same tile reports the rock, and says which tile it means.
  const rich = legalityAt(context, [], SPIKE_CATALOG[0]!.contentId, anchor, 100)
  assert.equal(rich.ok, false)
  assert.match(rich.ok === false ? rich.reason : "", /rock in the way/)
  assert.deepEqual(rich.ok === false ? rich.tile : null, { x: 8, y: 5 })
  void build
})

test("the two groups share one digit sequence, with no mode to tell them apart", () => {
  // engine.md 9.7's first convention: "digits always address the list; they never mean anything
  // else". Two groups each counting from 1 would need a focus concept to disambiguate, which is the
  // thing that convention exists to forbid — so a hotkey addresses the whole menu.
  const hotkeys = SPIKE_CATALOG.map((item) => item.hotkey)
  assert.deepEqual(hotkeys, [...new Set(hotkeys)], "two rows share a hotkey")
  assert.deepEqual(hotkeys, ["1", "2", "3"], "the digits do not run straight through the menu")
  const { build, layout } = session()
  build.handleData("3", layout)
  assert.equal(build.state.armed, 2, "the third digit armed the third row of the whole menu")
})

test("the empty army group is drawn, not skipped, so no hotkey moves when it fills", () => {
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const lines = constructLines(layout, context.catalog)
  const groups = lines.filter((line) => line.kind === "group")
  assert.equal(groups.length, 2, "both groups have a heading")
  assert.ok(
    lines.some((line) => line.kind === "empty"),
    "the empty army group is drawn as empty rather than vanishing",
  )
  // Every item row is distinct and ordered, which is what a click relies on.
  const itemRows = lines.filter((line) => line.kind === "item").map((line) => line.row)
  assert.deepEqual(itemRows, [...itemRows].sort((a, b) => a - b))
  assert.deepEqual(itemRows, [...new Set(itemRows)])
})

test("scrolling: the whole Grid is reachable, at the smallest terminal and the largest", () => {
  for (const terminal of [MINIMUM, MAXIMUM]) {
    const { build, layout } = session(terminal)
    // Walk into the far south-east corner with the five-tile jump, the way a player would.
    for (let step = 0; step < 40; step += 1) {
      build.handleData(SHIFT_RIGHT, layout)
      build.handleData(PAGE_DOWN, layout)
    }
    const grid = spikeGrid()
    assert.deepEqual(build.state.cursor, { x: grid.width - 1, y: grid.height - 1 })
    assert.deepEqual(build.state.camera, {
      x: grid.width - layout.viewport.width,
      y: grid.height - layout.viewport.height,
    })
    // And back out again, to the opposite corner.
    for (let step = 0; step < 40; step += 1) {
      build.handleData(`${ESC}[1;2D`, layout)
      build.handleData(`${ESC}[5~`, layout)
    }
    assert.deepEqual(build.state.cursor, { x: 0, y: 0 })
    assert.deepEqual(build.state.camera, { x: 0, y: 0 })
  }
})

test("the scroll margin is a parameter, so the canon's three tiles can be felt against another number", () => {
  // project-governance.md Section 7: the 3-tile margin is "locked direction, and Milestone 5 may
  // retune [it] on evidence from the first person who actually scrolls a Grid". A number nobody can
  // change is a number nobody can judge, so the spike takes it from the command line.
  for (const margin of [1, 3, 5]) {
    const context = { ...spikeContext(), scrollMargin: margin }
    const layout = buildLayout(MINIMUM, context.grid)
    const build = new BuildSession({ context, cursor: { x: 0, y: 0 }, viewport: layout.viewport })
    // Walk east until the camera first moves: it should be exactly at the margin from the east edge.
    let steps = 0
    while (build.state.camera.x === 0 && steps < context.grid.width) {
      build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
      steps += 1
    }
    assert.equal(
      layout.viewport.width - 1 - (build.state.cursor.x - build.state.camera.x),
      margin,
      `margin ${margin}`,
    )
  }
})

test("a resize keeps the cursor where it was and re-fits the camera around it", () => {
  const context = spikeContext()
  const small = buildLayout(MINIMUM, context.grid)
  const build = new BuildSession({ context, cursor: { x: 60, y: 30 }, viewport: small.viewport })
  const cursor = { ...build.state.cursor }
  build.resize(fitViewport(MAXIMUM, context.grid, 1))
  assert.deepEqual(build.state.cursor, cursor)
  assert.deepEqual(build.state.viewport, { width: 72, height: 24 })
  assert.ok(build.state.camera.x >= 0 && build.state.camera.x <= context.grid.width - 72)
  assert.ok(build.state.camera.y >= 0 && build.state.camera.y <= context.grid.height - 24)
})

test("back and quit leave the screen rather than changing it", () => {
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  let backs = 0
  let quits = 0
  const build = new BuildSession({
    context,
    cursor: { x: 18, y: 13 },
    viewport: layout.viewport,
    onBack: () => {
      backs += 1
    },
    onQuit: () => {
      quits += 1
    },
  })
  const before = build.state
  build.handleData(ESC, layout) // nothing armed
  build.handleData("q", layout)
  assert.equal(backs, 1)
  assert.equal(quits, 1)
  assert.equal(build.state, before, "neither of them touched the plan")
})

test("two keys arriving in one chunk are two keys, not one", () => {
  // The bug Gate 3A found on a real terminal and no fake-stdin test had ever produced: the OS
  // delivers two quick presses in a single read. Both arrows must move the cursor.
  const { build, layout } = session()
  const start = { ...build.state.cursor }
  build.handleData(RIGHT + RIGHT, layout)
  assert.deepEqual(build.state.cursor, { x: start.x + 2, y: start.y })
  build.handleData(UP + LEFT, layout)
  assert.deepEqual(build.state.cursor, { x: start.x + 1, y: start.y - 1 })
})
