// The Build Phase spike's frame, at both ends of the supported terminal size range. What is being
// checked is what engine.md 3.3 requires *in place of a minimap* — edge markers on the sides with
// more Grid (a position readout naming the visible range was the second signal until feedback F59
// took it out) — plus the placement preview, which is the only thing on screen that says whether
// Enter will work before it is pressed, and the bottom bar's one contextual line.

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildLayout, cellForTile, constructLines } from "../src/build/layout.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildSessionOptions } from "../src/build/session.ts"
import { SPIKE_ALLOTMENT, SPIKE_CATALOG } from "../src/build/catalog.ts"
import { armedPreview, remaining } from "../src/build/state.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { bottomLine, hint } from "../src/build/help.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { cellAt, frameToText, offendingGlyph } from "../src/view/frame.ts"
import { CAPABILITY_MODES } from "../src/view/roles.ts"
import type { GridTerrain, TerrainId } from "../src/grid/types.ts"
import { buildKeyboardCommand } from "../src/build/keyboard.ts"

/**
 * Every test here is about rendering — not about the Nexus draft gate 5D adds in front of
 * everything else. Every `BuildSession` starts past that gate already, on the first placeholder
 * option, so the screens under test look exactly as they did before this gate existed.
 */
/** A picked power that adds nothing to the budget, so every test that is not about the Nexus
 *  draft itself sees exactly the allotment its own numbers already assume. */
const NEUTRAL_NEXUS_DRAFT = [
  { hotkey: "1", name: "Test Pick", description: "No effect.", bonusAllotment: 0 },
] as const

/** Every caller passes a context whose `nexusDraft` is already `NEUTRAL_NEXUS_DRAFT` — this only
 *  picks it, so the same context object a caller renders with is the one the pick was made against. */
function readyBuildSession(options: BuildSessionOptions): BuildSession {
  const build = new BuildSession(options)
  build.dispatch({ kind: "pick-nexus", index: 0 })
  // Keyboard focus starts on the menu since gate 5F; every test here that presses an arrow means the
  // Grid's cursor, the way every one of them was written before focus existed. The focus model's own
  // tests are in `tests/build-focus.test.ts`.
  build.dispatch({ kind: "focus", target: "grid" })
  return build
}

/** `spikeContext()`, with the neutral draft baked in from the start so every place that builds a
 *  session from it and every place that renders from it agree on what was picked. */
function neutralContext(): ReturnType<typeof spikeContext> {
  return { ...spikeContext(), nexusDraft: NEUTRAL_NEXUS_DRAFT }
}

const MINIMUM = { columns: 80, rows: 24 }
const MAXIMUM = { columns: 104, rows: 32 }
const WIDE = { columns: 128, rows: 24 }

function screenAt(
  terminal: { columns: number; rows: number },
  drive: (build: BuildSession, layout: ReturnType<typeof buildLayout>) => void = () => {},
) {
  const context = neutralContext()
  const layout = buildLayout(terminal, context.grid)
  const build = readyBuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
  drive(build, layout)
  const frame = composeBuildFrame({ context, state: build.state, layout }, "monochrome")
  return { context, layout, build, frame, text: frameToText(frame) }
}

test("the frame is exactly the terminal's size, at the minimum and at the maximum", () => {
  assert.equal(screenAt(MINIMUM).frame.width, 80)
  assert.equal(screenAt(MINIMUM).frame.height, 24)
  assert.equal(screenAt(MAXIMUM).frame.width, 104)
  assert.equal(screenAt(MAXIMUM).frame.height, 32)
  // 1 border + 48 tiles + 1 border + 30 panel = 80, and the same arithmetic at two columns per tile
  // is 128 — engine.md 3.1's "the two compositions fall out of one number" — is where the floor and
  // the switch to wide tiles still are. Since the menu's divider became the Grid's west side
  // (2026-09-29) the panel takes 29 of those columns: 49 tiles at 80, and at 128 the 48 wide tiles
  // fill 127 of them, centred.
  assert.equal(screenAt(MINIMUM).layout.viewport.width, 49)
  assert.equal(screenAt(MINIMUM).layout.composition.width, 80)
  const wide = screenAt(WIDE)
  assert.equal(wide.layout.tileWidth, 2)
  assert.equal(wide.layout.viewport.width, 48)
  assert.equal(wide.layout.composition.width, 127)
  assert.equal(wide.frame.width, 128)
})

test("a terminal larger than the maximum viewport spends the difference on centring", () => {
  // 200 columns at two per tile has room for 84 tiles; the viewport still stops at 72, and the
  // 24 columns left over become margin on both sides rather than more Grid.
  const huge = screenAt({ columns: 200, rows: 44 })
  assert.deepEqual(huge.layout.viewport, { width: 72, height: 24 })
  assert.equal(huge.layout.tileWidth, 2)
  assert.ok(huge.layout.offset.column > 0 && huge.layout.offset.row > 0, "the composition is centred")
  assert.equal(huge.frame.width, 200)
})

/** Whether the frame cell at this position is drawn as the game's "soft" (dim, more-Grid-this-way)
 *  line rather than a plain or heavy one — checked against the frame's own style, not the glyph
 *  alone, since the soft line is the frame's own `-`/`|` and dimness is the actual signal. */
function isSoftEdge(frame: ReturnType<typeof composeBuildFrame>, x: number, y: number): boolean {
  return cellAt(frame, x, y).style.dim === true
}

test("the Grid pane is a closed rectangle: a line directly above, below, and beside it", () => {
  // The owner could not tell where the Grid ended (2026-09-26): two blank header rows sat between its
  // top edge and the nearest line, and the footer sat against its bottom edge with no line at all.
  // Every side of the Grid pane is now a frame line touching the Grid's own first or last row/column.
  for (const glyphPack of ["ascii", "unicode"] as const) {
    const context = neutralContext()
    const layout = buildLayout(MINIMUM, context.grid)
    const build = readyBuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
    const frame = composeBuildFrame({ context, state: build.state, layout, glyphPack }, "monochrome")
    const { gridBox, origin, viewport } = layout
    assert.equal(gridBox.top, origin.row - 1, "the top rule sits directly on the Grid's first row")
    assert.equal(gridBox.bottom, origin.row + viewport.height, "the bottom rule directly under its last")
    // A solid (reverse-video) cell is a line too — the heavy edge where the map ends.
    const blank = (x: number, y: number): boolean =>
      cellAt(frame, x, y).glyph === " " && cellAt(frame, x, y).style.inverse !== true
    for (let x = gridBox.left + 1; x < gridBox.right; x += 1) {
      assert.ok(!blank(x, gridBox.top), `${glyphPack}: a gap in the top rule at column ${x}`)
      assert.ok(!blank(x, gridBox.bottom), `${glyphPack}: a gap in the bottom rule at column ${x}`)
    }
    for (let y = gridBox.top + 1; y < gridBox.bottom; y += 1) {
      assert.ok(!blank(gridBox.left, y), `${glyphPack}: a gap in the left side at row ${y}`)
      assert.ok(!blank(gridBox.right, y), `${glyphPack}: a gap in the right side at row ${y}`)
    }
    // The rules meet the frame and the divider in a real junction, not a line running past them. The
    // divider starts at the top rule rather than crossing it (gate 5F: the top bar runs the whole
    // width), so its top end is a tee, not a crossing.
    // Here the view touches the map's west edge, so the west side and its corners are the map's edge,
    // in its own style and the quiet edge colour; the east corners, where no heavy side meets, are
    // real junctions.
    const junctions = glyphPack === "ascii" ? ["+", "+"] : ["┤", "┤"]
    assert.equal(cellAt(frame, gridBox.right, gridBox.top).glyph, junctions[0])
    assert.equal(cellAt(frame, gridBox.right, gridBox.bottom).glyph, junctions[1])
    assert.equal(cellAt(frame, gridBox.left, gridBox.top).style.fgRole, "chrome.edge")
    assert.notEqual(cellAt(frame, gridBox.left, gridBox.top).style.dim, true)
  }
})

test("engine-3.3-markers: a Grid side goes soft where there is more Grid, and heavy where there is not", () => {
  // Hard against the Grid's north-west corner: nothing north of here, nothing west of here.
  const corner = screenAt(MINIMUM, (build) => {
    build.run([{ kind: "move-cursor", dx: -999, dy: -999 }])
  })
  const { gridBox } = corner.layout
  const midGridColumn = corner.layout.origin.column + 5
  const midGridRow = corner.layout.origin.row + 5
  assert.equal(
    isSoftEdge(corner.frame, midGridColumn, gridBox.top),
    false,
    "nothing north of the Grid's own top edge",
  )
  assert.equal(
    isSoftEdge(corner.frame, gridBox.left, midGridRow),
    false,
    "nothing west of the Grid's own left edge",
  )
  // The map's west edge is drawn on the menu's divider, which is the Grid's west side (owner,
  // 2026-09-29): in the map's own edge style and the quiet edge colour, never soft.
  assert.equal(gridBox.left, corner.layout.dividerColumn, "the divider is the Grid's west side")
  assert.equal(cellAt(corner.frame, gridBox.left, midGridRow).style.fgRole, "chrome.edge", "the west edge is the map's edge")
  assert.ok(isSoftEdge(corner.frame, midGridColumn, gridBox.bottom), "more Grid to the south")
  assert.ok(isSoftEdge(corner.frame, gridBox.right, midGridRow), "more Grid to the east")

  // Walk into the middle and every side has more Grid beyond it.
  const middle = screenAt(MINIMUM, (build) => {
    build.run([{ kind: "move-cursor", dx: 30, dy: 12 }])
  })
  const box = middle.layout.gridBox
  const midColumn = middle.layout.origin.column + 5
  const midRow = middle.layout.origin.row + 5
  assert.ok(isSoftEdge(middle.frame, midColumn, box.top), "north, from the middle")
  assert.ok(isSoftEdge(middle.frame, midColumn, box.bottom), "south, from the middle")
  // West, the light side is the divider itself, which is the Grid's west side.
  assert.equal(box.left, middle.layout.dividerColumn)
  assert.ok(isSoftEdge(middle.frame, middle.layout.dividerColumn, midRow), "west, from the middle")
  assert.ok(isSoftEdge(middle.frame, box.right, midRow), "east, from the middle")
  // Soft is the frame's own line, drawn dim — not the ground lattice's dot, which is what made the
  // earlier dotted edge read as "arbitrary" beside a field of the same dots.
  assert.equal(cellAt(middle.frame, midColumn, box.top).glyph, "-")
  assert.equal(cellAt(middle.frame, middle.layout.dividerColumn, midRow).glyph, "|")

  // The outer border and the rules where they cross the side panel never scroll, so they stay plain
  // regardless.
  assert.equal(isSoftEdge(middle.frame, box.right + 3, box.top), false, "the rule over the panel")
  assert.equal(isSoftEdge(middle.frame, midColumn, middle.layout.offset.row), false, "the outer top border")
})

test("engine-3.3-readout: no position readout any more — the bottom bar is one contextual line", () => {
  // The owner, 2026-09-30 (feedback F59): "The 'view x y' position is not needed." The weight of the
  // Grid rectangle's sides is the signal that there is more Grid (the markers tests above and below),
  // and the bottom bar's one row says what can be done instead.
  for (const terminal of [MINIMUM, MAXIMUM]) {
    const opening = screenAt(terminal)
    assert.doesNotMatch(opening.text, /view x|cursor \d+,\d+/)
    const lines = opening.text.split("\n")
    assert.match(lines[opening.layout.footerRow] as string, /Arrows move the cursor, \[enter\] explores here/)
    assert.equal(opening.layout.footerRow + 1, opening.layout.offset.row + opening.layout.composition.height - 1, "one row, then the border")
  }
  // The maximum viewport genuinely shows more Grid than the minimum: 72 tiles across, not 49.
  assert.equal(screenAt(MAXIMUM).layout.viewport.width, 72)
  assert.equal(screenAt(MINIMUM).layout.viewport.width, 49)
})

test("the Grid drawn is the Grid under the camera, not the Grid's north-west corner", () => {
  const scrolled = screenAt(MINIMUM, (build) => {
    build.run([{ kind: "move-cursor", dx: 50, dy: 20 }])
  })
  const { layout, build, context } = scrolled
  // A south-east rock block, three-quarters of the way across a Grid whose north-west corner is the
  // only part that was ever on screen before. It should be drawn exactly where the camera puts it —
  // which is the whole claim this gate makes about scrolling.
  const tile = { x: 66, y: 31 }
  assert.equal(context.grid.tiles[tile.y * context.grid.width + tile.x], "terrain.rock")
  const cell = cellForTile(layout, build.state.camera, tile)
  assert.equal(cellAt(scrolled.frame, cell.x, cell.y).glyph, "#")
})

test("the placement preview says whether Enter will work, by shape rather than by colour", () => {
  const legal = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 12, dy: 1 }])
  })
  const legalCell = cellForTile(legal.layout, legal.build.state.camera, { x: 30, y: 14 })
  assert.notEqual(cellAt(legal.frame, legalCell.x, legalCell.y).glyph, "x")

  const illegal = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    // Onto the north-west wall: rock at 8,5 through 21,5.
    build.run([{ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }])
  })
  const illegalCell = cellForTile(illegal.layout, illegal.build.state.camera, { x: 8, y: 5 })
  assert.equal(
    cellAt(illegal.frame, illegalCell.x, illegalCell.y).glyph,
    "x",
    "an illegal footprint reads as illegal in monochrome, where colour says nothing",
  )
})

test("the cursor keeps whatever glyph is beneath it", () => {
  const onNexus = screenAt(MINIMUM, (build) => {
    // The standing Grid Nexus occupies 17,10 through 19,11.
    build.run([{ kind: "move-cursor", dx: 0, dy: -3 }])
  })
  const cell = cellForTile(onNexus.layout, onNexus.build.state.camera, { x: 18, y: 10 })
  const drawn = cellAt(onNexus.frame, cell.x, cell.y)
  assert.equal(drawn.style.inverse, true, "the cursor is there")
  assert.notEqual(drawn.glyph, " ", "and the Nexus is still visible under it")
})

test("a planned structure is drawn at full strength, like one already standing", () => {
  // Owner, 2026-09-27: "not sure why they are greyed out, it will look better if they are fully
  // built." Undo and remove are what keep a plan revisable, not the grey.
  const planned = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  })
  const cell = cellForTile(planned.layout, planned.build.state.camera, { x: 30, y: 14 })
  assert.notEqual(cellAt(planned.frame, cell.x, cell.y).style.dim, true, "a plan is not dimmed")
  assert.equal(cellAt(planned.frame, cell.x, cell.y).style.bold, true)
})

test("right after a placement the tile reads as built, and the status line says so with the budget", () => {
  // The bug an owner playtest found (2026-09-26): still armed and the cursor still on the tile just
  // placed, the ghost preview used to recompute legality fresh, find the plan's own last entry "in
  // the way", and paint an illegal block over a structure that had just been correctly built - and
  // the side panel independently made the identical mistake with its own refusal block.
  const justPlaced = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  })
  assert.doesNotMatch(justPlaced.text, /Cannot build here/i, "nothing refuses the tile it just built on")
  const cell = cellForTile(justPlaced.layout, justPlaced.build.state.camera, { x: 30, y: 14 })
  assert.notEqual(cellAt(justPlaced.frame, cell.x, cell.y).glyph, "x", "no illegal block over the built structure")
  // Owner, 2026-09-27: "hatch placed (resources: 30) - [u] undo" — what is left, and the way back.
  assert.match(justPlaced.text, /Barracks placed \(resources: 60\) - \[u\] undo/, "the footer reports the success")
  // Armed by its digit on the map, so the keyboard stays on the map, where the arming began (F30).
  assert.equal(justPlaced.build.state.focus, "grid", "and the keyboard is back where the arming began")
  assert.equal(justPlaced.build.state.armed, null)
})

test("undoing the placement just made lets the same tile be built on again at once", () => {
  // The just-placed tile absorbs a repeated Enter — but only while it is still what was just placed.
  // Undo or remove it and that stops being true; a stale suppression would swallow the next Enter
  // silently, on a tile that is now empty.
  for (const revise of [{ kind: "undo" } as const, { kind: "remove" } as const]) {
    const context = neutralContext()
    const layout = buildLayout(MINIMUM, context.grid)
    const build = readyBuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }, revise])
    assert.equal(build.state.planned.length, 0, `${revise.kind} did not take the placement back`)
    build.handleData("1", layout) // placing returned the keyboard to the menu; arm again, in place
    const cell = cellForTile(layout, build.state.camera, build.state.cursor)
    const frame = composeBuildFrame({ context, state: build.state, layout }, "monochrome")
    assert.notEqual(cellAt(frame, cell.x, cell.y).glyph, " ", `after ${revise.kind} the ghost is back`)
    build.dispatch({ kind: "place" })
    assert.equal(build.state.planned.length, 1, `after ${revise.kind}, Enter on the same tile places again`)
  }
})

test("every capability tier puts identical glyphs on screen", () => {
  const context = neutralContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = readyBuildSession({ context, cursor: { x: 30, y: 20 }, viewport: layout.viewport })
  build.handleData("1", layout)
  const texts = CAPABILITY_MODES.map((capability) =>
    frameToText(composeBuildFrame({ context, state: build.state, layout }, capability)),
  )
  for (const text of texts) assert.equal(text, texts[0])
})

test("every glyph on the frame is one cell wide, at both sizes and in both packs", () => {
  for (const terminal of [MINIMUM, MAXIMUM, WIDE]) {
    for (const glyphPack of ["ascii", "unicode"] as const) {
      const context = neutralContext()
      const layout = buildLayout(terminal, context.grid)
      const build = readyBuildSession({ context, cursor: { x: 40, y: 20 }, viewport: layout.viewport })
      build.handleData("2", layout)
      const frame = composeBuildFrame({ context, state: build.state, layout, glyphPack }, "truecolor")
      assert.equal(
        offendingGlyph(frame),
        null,
        `${terminal.columns}x${terminal.rows} in ${glyphPack}`,
      )
    }
  }
})

test("the construct rows and the armed item's own line are all on screen", () => {
  const armed = screenAt(MINIMUM, (build, layout) => {
    build.handleData("2", layout)
  })
  assert.match(armed.text, /\[1\] Barracks/)
  assert.match(armed.text, /\[2\] Hatchery/)
  assert.match(armed.text, /\[3\] Turret/)
  // Both groups are labelled, and the empty one says so rather than vanishing.
  assert.match(armed.text, /COMMON/)
  assert.match(armed.text, /ARMY {2,}none available/)
  // Every item's cost is on its own row, and the budget is on the panel's first line.
  assert.match(armed.text, /RESOURCE/)
  for (const item of SPIKE_CATALOG) assert.match(armed.text, new RegExp(String(item.cost)))
  // The selected item says what it does — the thing a player is actually choosing between.
  assert.match(armed.text, /Spawns swarmers, slowly/)
  // The keys that were listed here — undo, remove — are on the Controls and hotkeys page since the key
  // help went (feedback F59, F60; `tests/build-help.test.ts`), and the panel carries none of them.
  assert.doesNotMatch(armed.text, /u undo|bksp remove/)
})

test("the panel says nothing about an item until one is selected", () => {
  // "Simple and direct" (Mario, accepting gate 5A) taken literally: a panel that is always full is
  // a panel nobody reads, so the item's effect line appears only while something is armed.
  const idle = screenAt(MINIMUM, (build) => build.dispatch({ kind: "focus", target: "menu" }))
  assert.doesNotMatch(idle.text, /Spawns swarmers/)
  assert.doesNotMatch(idle.text, /Trains troopers/)
  assert.doesNotMatch(idle.text, /Cannot build here/i)
  // But the menu and the budget are always there.
  assert.match(idle.text, /RESOURCE/)
  assert.match(idle.text, /\[1\] Barracks/)
})

/** The bottom bar's one line, where the Build Phase answers "why not" (and otherwise hints). */
function statusRow(screen: ReturnType<typeof screenAt>): string {
  return (screen.text.split("\n")[screen.layout.footerRow] as string).replace(/^\|\s*|\s*\|$/g, "")
}

test("the status line says why a placement would be refused, and which tile it means", () => {
  // Moved off the side panel, where the owner never looked for it (2026-09-26): "it would make more
  // sense to show that feedback on the low bar ... so we keep that low bar for cursor status
  // feedback." The panel keeps the menu and what the armed row does, and nothing else.
  const onRock = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }])
  })
  assert.equal(statusRow(onRock), "Cannot build here: rock in the way at 8,5.")
  assert.doesNotMatch(onRock.text, /CANNOT BUILD HERE/, "not shouted, and not on the panel as well")
  assert.match(onRock.text, /Trains troopers each Pulse/, "the panel still says what the armed row does")

  const onNexus = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 0, dy: -3 }])
  })
  assert.match(statusRow(onNexus), /^Cannot build here: the nexus is here at \d+,\d+\.$/)

  // And it is gone the moment the placement is legal again, rather than lingering.
  const fine = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 12, dy: 1 }])
  })
  assert.doesNotMatch(fine.text, /Cannot build here/i)
})

test("looking at an illegal tile reads quietly, trying to build there reads in red", () => {
  // The owner found the all-red illegal ghost too intense: "we should try grey instead, and if the
  // user tries to click, then flash the cursor so the UI shows that the action has been received
  // but it can't be done in there." Grey while looking; red — on the status line — once tried. (The
  // cursor flash needs a frame timer this screen does not have yet.)
  const looking = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }])
  })
  // A tile of the ghost's footprint beside the cursor's own, which the cursor highlight would restyle.
  const ghost = cellForTile(looking.layout, looking.build.state.camera, { x: 7, y: 5 })
  const ghostCell = cellAt(looking.frame, ghost.x, ghost.y)
  assert.equal(ghostCell.glyph, "x", "shape still carries it, for monochrome")
  assert.equal(ghostCell.style.fgRole, "chrome.muted", "the illegal ghost is grey, not red")
  assert.notEqual(ghostCell.style.bold, true)
  const statusColumn = looking.layout.offset.column + 2
  const quiet = cellAt(looking.frame, statusColumn, looking.layout.footerRow).style
  assert.equal(quiet.fgRole, "chrome.value", "a refusal nobody has tried yet is not an alarm")

  const tried = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }, { kind: "place" }])
  })
  assert.equal(statusRow(tried), "Cannot build here: rock in the way at 8,5.", "the same sentence")
  const loud = cellAt(tried.frame, statusColumn, tried.layout.footerRow).style
  assert.equal(loud.fgRole, "notice.gate", "an attempt that was refused is")
  assert.equal(loud.bold, true)
  assert.equal(tried.build.state.planned.length, 0)
})

test("while the commit question is open, the status line asks it, whatever the ghost would say", () => {
  // A refusal is about what Enter would do right now; with the confirmation open, Enter does
  // nothing to the Grid, so the ghost and its refusal both step aside for the question.
  const asking = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }, { kind: "commit" }])
  })
  assert.match(statusRow(asking), /^Battle Round 1: Enter starts it, Esc goes back\.$/)
  const ghost = cellForTile(asking.layout, asking.build.state.camera, { x: 8, y: 5 })
  assert.notEqual(cellAt(asking.frame, ghost.x, ghost.y).glyph, "x", "no ghost behind the question")
})

test("the budget on screen is the budget the reducer is enforcing", () => {
  const context = neutralContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = readyBuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
  const show = (): string =>
    frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))

  // The Grid arrives in Explore Map, whose panel covers the menu; the budget is the menu's.
  build.dispatch({ kind: "focus", target: "menu" })
  assert.match(show(), new RegExp(`${SPIKE_ALLOTMENT} of ${SPIKE_ALLOTMENT}`))
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  assert.match(show(), new RegExp(`${remaining(context, build.state)} of ${SPIKE_ALLOTMENT}`))
  build.handleData("1", layout) // placing disarms; the digit arms again, in place
  // A row that can no longer be afforded is dimmed — an attribute, not a colour, so it survives
  // monochrome. Checked on an *unselected* row: the selected one is inverse video, which is what
  // "selected" means everywhere in this game, and its unaffordability is the status line's to say.
  build.run([{ kind: "move-cursor", dx: 4, dy: 0 }, { kind: "place" }])
  build.handleData("3", layout) // select the cheap turret, leaving the barracks row unselected
  assert.ok(remaining(context, build.state) < SPIKE_CATALOG[0]!.cost, "not actually unaffordable")
  const frame = composeBuildFrame({ context, state: build.state, layout }, "monochrome")
  const barracksLine = constructLines(layout, context.catalog).find(
    (line) => line.kind === "item" && line.index === 0,
  )
  assert.ok(barracksLine !== undefined)
  assert.equal(
    cellAt(frame, layout.panelColumn, barracksLine.row).style.dim,
    true,
    "a row the player can no longer afford still looks affordable",
  )
  // The turret, which they can still afford, does not.
  const turretLine = constructLines(layout, context.catalog).find(
    (line) => line.kind === "item" && line.index === 2,
  )
  assert.ok(turretLine !== undefined)
  assert.notEqual(cellAt(frame, layout.panelColumn, turretLine.row).style.dim, true)
})

test("selecting something unaffordable says so before the player tries it", () => {
  const context = neutralContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = readyBuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 4, dy: 0 }, { kind: "place" }])
  // Arming the barracks again, now unaffordable wherever the cursor is: refused at the menu, before
  // any tile question, and the row stays unarmed.
  build.handleData("1", layout)
  assert.equal(build.state.armed, null, "an unaffordable row was armed")
  const text = frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))
  const status = (text.split("\n")[layout.footerRow] as string).replace(/^\|\s*|\s*\|$/g, "")
  // Affordability first, before any tile problem — and it is not about a tile, so none is named.
  assert.equal(status, "Cannot build here: costs 40, 20 left.")
})

test("the bottom line never names a key the keyboard adapter does not bind", () => {
  // A retired binding that is still printed is worse than one that never existed. Every key a hint
  // names in brackets, checked against the real adapter in the focus it is shown in.
  const named: Readonly<Record<string, string>> = { enter: "\r", esc: "\u001b", tab: "\t", bksp: "\u007f" }
  const modes = [
    { drive: (build: BuildSession) => build.dispatch({ kind: "focus", target: "menu" }), context: { itemCount: 3, armed: false, focus: "menu" as const } },
    { drive: (build: BuildSession) => build.run([{ kind: "focus", target: "menu" }, { kind: "highlight", delta: 1 }, { kind: "highlight", delta: 1 }]), context: { itemCount: 3, armed: false, focus: "menu" as const } },
    { drive: (build: BuildSession) => build.run([{ kind: "focus", target: "menu" }, { kind: "highlight", delta: -1 }]), context: { itemCount: 3, armed: false, focus: "menu" as const } },
    { drive: (build: BuildSession, layout: ReturnType<typeof buildLayout>) => build.handleData("1", layout), context: { itemCount: 3, armed: true, focus: "grid" as const } },
    { drive: (build: BuildSession) => build.dispatch({ kind: "explore" }), context: { itemCount: 3, armed: false, focus: "grid" as const } },
    { drive: () => {}, context: { itemCount: 3, armed: false, focus: "grid" as const } },
  ] as const
  for (const mode of modes) {
    const shown = screenAt(MINIMUM, mode.drive)
    const text = hint(shown.context, shown.build.state).text
    for (const [, key] of text.matchAll(/\[([^\]]+)\]/g)) {
      const bytes = named[key as string] ?? (key as string)
      assert.notEqual(buildKeyboardCommand(bytes, mode.context), null, `"${text}" names [${key}], which is not bound`)
    }
  }
})

test("no header or footer line is cut off at the 80-column floor", () => {
  // 80x24 is the acceptance target, and the Grid pane is only 49 columns of it. Every line
  // below has been truncated mid-word at some point in this gate's own history and only a
  // screenshot showed it, so each one is now asserted whole at the narrowest size that must work.
  const { text } = screenAt(MINIMUM)
  assert.match(text, /TERMINAL NEXUS build phase/)
  assert.match(text, /\| Arrows move the cursor, \[enter\] explores here, a number arms a building\. +\|/)
  const exploring = screenAt(MINIMUM, (build) => build.dispatch({ kind: "explore" }))
  const exploreLine = bottomLine(exploring.context, exploring.build.state, null).text
  assert.ok(exploring.text.split("\n")[exploring.layout.footerRow]?.includes(exploreLine), `"${exploreLine}" is cut`)
  const explore = exploring.text
  // Against the divider, which here is the map's own west edge (the spike map's fence: a rail or a post).
  assert.match(explore, /> \[e\] Explore Map {10}[|+]/, "the Explore Map row, whole")
  const menu = screenAt(MINIMUM, (build) => build.dispatch({ kind: "focus", target: "menu" })).text
  assert.match(menu, /RESOURCE {9}100 of 100/, "the panel's budget line, whole")
  assert.match(menu, /\[e\] Explore Map {12}[|+]/, "the first menu entry, whole")
})

test("a scroll margin given on the command line is the one the camera actually uses", () => {
  // Mario deferred confirming the three-tile default and will judge it against another number. The
  // footer printed a margin that was not the default until the position readout went (feedback F59);
  // Settings' own row is where it is read now. A share of the view since gate 5H: 49 tiles wide at 80
  // columns, so 5% is 2 tiles and 10% is 5.
  for (const [percent, margin] of [[5, 2], [10, 5]] as const) {
    const context = { ...neutralContext(), scrollMargin: percent }
    const layout = buildLayout(MINIMUM, context.grid)
    const build = readyBuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
    assert.equal(build.state.debug.scrollMargin, percent)
    // The camera really follows at that distance, not at the default.
    build.dispatch({ kind: "move-cursor", dx: 0, dy: 0 })
    let steps = 0
    while (build.state.camera.x === 0 && steps < context.grid.width) {
      build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
      steps += 1
    }
    assert.equal(layout.viewport.width - 1 - (build.state.cursor.x - build.state.camera.x), margin)
  }
})

test("a row that costs more than is left cannot be armed: it flickers and says why", () => {
  // Since a placement disarms and budgets only fall by placing, an armed structure can never become
  // unaffordable while armed; the refusal moved to the moment of arming, and names the cost first.
  const context = neutralContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = readyBuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 4, dy: 0 }, { kind: "place" }])
  assert.ok(remaining(context, build.state) < SPIKE_CATALOG[0]!.cost, "not actually unaffordable")
  const before = build.state.ack?.seq ?? 0
  build.handleData("1", layout)
  assert.equal(build.state.armed, null)
  assert.equal(build.state.ack?.kind, "refused")
  assert.ok((build.state.ack?.seq ?? 0) > before, "no flicker was asked for")
  assert.match(build.state.status.text, /costs 40, 20 left/)
  // Drawn: the row is dim, the unaffordable cost with it.
  const frame = composeBuildFrame({ context, state: build.state, layout }, "monochrome")
  const barracksLine = constructLines(layout, context.catalog).find((line) => line.kind === "item" && line.index === 0)
  assert.ok(barracksLine !== undefined)
  const costColumn = layout.panelColumn + layout.panelLimit - 2
  assert.equal(cellAt(frame, costColumn, barracksLine.row).style.dim, true)
})

test("on a Grid short enough to shrink the panel, the detail block is dropped rather than drawn over the footer", () => {
  // `isGated` deliberately never gates a Grid that fits the screen entirely ("a small tutorial Grid
  // is never gated"), so the viewport — and with it the panel's height — can be much shorter than
  // the spike's. A detail block that just keeps writing downward overwrites the pinned bindings,
  // then the footer's position readout, then the controls line. Found by review, not by use: no
  // Grid this small is wired up today, and nothing in the layout prevented it.
  const small: GridTerrain = {
    width: 20,
    height: 10,
    tiles: new Array<TerrainId>(200).fill("terrain.plain"),
  }
  const context = { ...neutralContext(), grid: small, standing: [] }
  const layout = buildLayout(MINIMUM, small)
  const build = readyBuildSession({ context, cursor: { x: 2, y: 2 }, viewport: layout.viewport })
  build.handleData("1", layout) // a 3x2 barracks at 2,2 hangs off the Grid, so it is refused
  const text = frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))

  // The furniture that must survive, whole: the bottom bar's one line, narrower here, keeps whole
  // words (it held a position readout and the key help until feedback F59).
  const full = bottomLine(context, build.state, armedPreview(context, build.state)).text
  const shown = (text.split("\n")[layout.footerRow] as string).replace(/^\s*\|\s*|\s*\|\s*$/g, "")
  assert.ok(shown.length > 0 && full.startsWith(shown), `"${shown}" is not the start of "${full}"`)
  assert.ok(shown.length === full.length || full[shown.length] === " ", `"${shown}" cuts a word of "${full}"`)
  // And the menu itself is still there — it is the block below it that gave way.
  assert.match(text, /\[1\] Barracks/)
  assert.match(text, /RESOURCE/)

  // Every line is still exactly the width it should be: nothing was written over anything.
  for (const row of text.split("\n")) assert.ok(row.length <= 80, `a row ran past 80: "${row}"`)
})

test("a panel with room for the effect line still draws it", () => {
  // The other half of the clamp: it must give way only when it genuinely has to.
  const roomy = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }])
  })
  assert.match(roomy.text, /Trains troopers each Pulse/)
})

test("on a small Grid the panel's bindings never draw over the Nexus Powers entry or the SPECIAL row", () => {
  // The bindings block grows up from the panel's bottom and was bounded by the construct menu alone,
  // so the NEXUS/SPECIAL rows gate 5D added below the menu were written over on a Grid short enough
  // to shrink the panel. Found by rendering the screen, not by a test.
  const small: GridTerrain = { width: 20, height: 10, tiles: new Array<TerrainId>(200).fill("terrain.plain") }
  const context = { ...neutralContext(), grid: small, standing: [] }
  const layout = buildLayout(MINIMUM, small)
  const build = readyBuildSession({ context, cursor: { x: 2, y: 2 }, viewport: layout.viewport })
  build.dispatch({ kind: "focus", target: "menu" }) // Explore Map's panel would cover the menu
  const text = frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))
  // Against the divider — or against the junction where this short Grid's own bottom edge meets it.
  // Against the divider — or, where this small Grid is the solid bar of a map edge, against nothing.
  assert.match(text, /\[n\] Nexus {2,}1 active(?:[|+ ]|$)/m)
  assert.match(text, /SPECIAL {2,}none available(?:[|+ ]|$)/m)
})

test("engine-3.3-markers: the soft border runs the whole Grid-pane segment, at both tile widths", () => {
  // A signal that only reaches some of a wide border is a signal a player can miss. The whole
  // segment beside the Grid pane goes soft together, at one column per tile and at two.
  const wholeSegmentIsSoft = (terminal: { columns: number; rows: number }): void => {
    const { frame, layout } = screenAt(terminal, (build) => {
      build.run([{ kind: "move-cursor", dx: 20, dy: 20 }])
    })
    for (let x = layout.gridBox.left + 1; x < layout.gridBox.right; x += 1) {
      assert.ok(
        cellAt(frame, x, layout.gridBox.top).style.dim === true,
        `column ${x} of the north border should be soft at ${terminal.columns} columns`,
      )
    }
  }
  wholeSegmentIsSoft(MINIMUM)
  wholeSegmentIsSoft({ columns: 160, rows: 40 })
})

test("no line is drawn over another, at every terminal size in the supported range", () => {
  // The range is 48x16 to 72x24 tiles, and the screenshots only ever catch the sizes somebody
  // thought to capture. Every size in between is swept here instead: the frame stays the terminal's
  // own size, the bottom bar keeps its one line (three until feedback F59), and the panel never
  // reaches it.
  for (let columns = 80; columns <= 106; columns += 1) {
    for (let rows = 24; rows <= 32; rows += 1) {
      const { text, layout, frame } = screenAt({ columns, rows }, (build, l) => {
        build.handleData("1", l)
        build.run([{ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }])
      })
      assert.equal(frame.width, columns, `frame width at ${columns}x${rows}`)
      assert.equal(frame.height, rows, `frame height at ${columns}x${rows}`)
      const lines = text.split("\n")
      // The bottom line reads the live refusal, tile and all, rather than whatever arming said a
      // moment ago — and it stays whole through the whole range.
      assert.match(
        lines[layout.footerRow] as string,
        /Cannot build here: rock in the way at 8,5\./,
        `status at ${columns}x${rows}`,
      )
      // The rule under the Grid is its own row: the Grid's last row never touches the bottom line,
      // and the frame's border closes directly under it.
      assert.equal(layout.gridBox.bottom, layout.footerRow - 1, `bottom rule at ${columns}x${rows}`)
      assert.equal(layout.footerRow + 1, layout.offset.row + layout.composition.height - 1, `bottom border at ${columns}x${rows}`)
    }
  }
})

test("engine-3.3-markers: the side border is soft on every row, not a broken column of carets", () => {
  // The west border is the rule between the side panel and the Grid (gate 5F). A signal on only
  // some rows there reads as a caret pointing at whichever panel row it lands beside — `> [1]
  // Barracks` looks selected. Soft the whole way down is what makes it read as a border instead.
  // Far enough in that all four sides have more Grid beyond them.
  const { frame, layout } = screenAt(MINIMUM, (build) => {
    build.run([{ kind: "move-cursor", dx: 40, dy: 20 }])
  })
  assert.equal(layout.gridBox.left, layout.dividerColumn, "the divider is the Grid's west side")
  for (let row = layout.origin.row; row < layout.origin.row + layout.viewport.height; row += 1) {
    assert.equal(
      cellAt(frame, layout.gridBox.right, row).style.dim,
      true,
      `the east edge is not soft on row ${row}`,
    )
    assert.equal(
      cellAt(frame, layout.dividerColumn, row).style.dim,
      true,
      `the west edge is not soft on row ${row}`,
    )
  }
})

test("the bindings block gives way to the construct menu, never draws over it", () => {
  // The panel's height is the viewport's, and the viewport shrinks to fit a Grid smaller than the
  // screen — `isGated` deliberately passes one that fits entirely. The bindings are pinned to the
  // panel's last line and grow upward, so on a short enough panel they reach the menu. The menu
  // wins: a hidden construct row is still a live click target, which is worse than a binding the
  // player has to find elsewhere.
  const tiny: GridTerrain = {
    width: 8,
    height: 6,
    tiles: new Array<TerrainId>(48).fill("terrain.plain"),
  }
  const context = { ...neutralContext(), grid: tiny, standing: [] }
  const layout = buildLayout(MINIMUM, tiny)
  const build = readyBuildSession({ context, cursor: { x: 2, y: 2 }, viewport: layout.viewport })
  // The map with the menu beside it (a click from the menu): Explore Map's panel would cover the menu.
  build.run([
    { kind: "focus", target: "menu" },
    { kind: "click-tile", x: 2, y: 2 },
  ])
  const text = frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))

  for (const line of constructLines(layout, context.catalog)) {
    if (line.kind === "item") {
      const item = context.catalog[line.index]
      assert.ok(item !== undefined)
      assert.match(
        text.split("\n")[line.row] as string,
        new RegExp(`\\[${item.hotkey}\\] ${item.label}`),
        `the menu row for ${item.label} was drawn over`,
      )
    }
    if (line.kind === "empty") {
      assert.match(text.split("\n")[line.row] as string, /ARMY {2,}none available/)
    }
  }
})

test("the armed row carries an explicit marker, not only inverse video", () => {
  // Inverse video alone survives every capability tier, but it is a video attribute, not a symbol —
  // the owner asked for something a player can point to and name. It rides alongside the bar, not
  // instead of it, and it is unambiguous now that the border no longer prints its own `>` beside
  // every panel row.
  const armed = screenAt(MINIMUM, (build, layout) => {
    build.handleData("2", layout)
  })
  assert.match(armed.text, /> \[2\] Hatchery/)
  const unselected = armed.text.split("\n").find((row) => row.includes("[1] Barracks"))
  assert.ok(unselected !== undefined)
  assert.doesNotMatch(unselected, />/, "an unarmed row carries no marker")
})

test("the cursor is bold and undimmed over bare ground, so it reads over a dim ground glyph", () => {
  const idle = screenAt(MINIMUM)
  const cell = cellForTile(idle.layout, idle.build.state.camera, idle.build.state.cursor)
  const style = cellAt(idle.frame, cell.x, cell.y).style
  assert.equal(style.inverse, true)
  assert.equal(style.bold, true)
  assert.notEqual(style.dim, true, "bold and dim on the same cell fight each other")
})

test("the cursor shows only while the Grid has the keyboard", () => {
  // Owner, 2026-09-27: focus on the menu => no cursor. One "you are here" at a time.
  const onMenu = screenAt(MINIMUM, (build) => build.dispatch({ kind: "focus", target: "menu" }))
  const cell = cellForTile(onMenu.layout, onMenu.build.state.camera, onMenu.build.state.cursor)
  assert.notEqual(cellAt(onMenu.frame, cell.x, cell.y).style.inverse, true, "a cursor is drawn with the menu focused")
  const onGrid = screenAt(MINIMUM)
  const gridCell = cellForTile(onGrid.layout, onGrid.build.state.camera, onGrid.build.state.cursor)
  assert.equal(cellAt(onGrid.frame, gridCell.x, gridCell.y).style.inverse, true)
})

test("engine-3.3-markers: a map that names no edge style ends in a solid bar, on all four sides alike", () => {
  // Owner, 2026-09-27: the heavy edge must read the same horizontally and vertically — "the rectangle
  // needs to be a rectangle". A solid (reverse-video) bar is the same weight in both directions, in
  // every glyph pack, and needs no colour. Since 2026-09-29 a map may name its own edge style (the
  // spike map's fence; every style is checked in `tests/build-edge.test.ts`); the solid bar is what a
  // map that names none gets.
  const { edgeStyle: _fence, ...unnamed } = neutralContext()
  const cornerLayout = buildLayout(MINIMUM, unnamed.grid)
  const cornerBuild = readyBuildSession({ context: unnamed, cursor: { x: 18, y: 13 }, viewport: cornerLayout.viewport })
  cornerBuild.run([{ kind: "move-cursor", dx: -999, dy: -999 }])
  const corner = {
    layout: cornerLayout,
    frame: composeBuildFrame({ context: unnamed, state: cornerBuild.state, layout: cornerLayout }, "monochrome"),
  }
  const { gridBox } = corner.layout
  const solid = (frame: typeof corner.frame, x: number, y: number): boolean =>
    cellAt(frame, x, y).glyph === " " && cellAt(frame, x, y).style.inverse === true
  assert.ok(solid(corner.frame, corner.layout.origin.column + 5, gridBox.top), "north edge")
  assert.ok(solid(corner.frame, gridBox.left, corner.layout.origin.row + 5), "west edge")
  assert.ok(solid(corner.frame, gridBox.left, gridBox.top), "the corner where both meet")
  // The sides with more map beyond them stay the thin, dim line.
  assert.ok(!solid(corner.frame, corner.layout.origin.column + 5, gridBox.bottom), "south has more map")
  assert.ok(!solid(corner.frame, gridBox.right, corner.layout.origin.row + 5), "east has more map")

  // A Grid that fits the viewport whole is solid all round.
  const small: GridTerrain = { width: 20, height: 10, tiles: new Array<TerrainId>(200).fill("terrain.plain") }
  const context = { ...unnamed, grid: small, standing: [] }
  const layout = buildLayout(MINIMUM, small)
  const build = readyBuildSession({ context, cursor: { x: 2, y: 2 }, viewport: layout.viewport })
  const frame = composeBuildFrame({ context, state: build.state, layout }, "monochrome")
  for (const [x, y] of [
    [layout.gridBox.left, layout.gridBox.top],
    [layout.gridBox.right, layout.gridBox.top],
    [layout.gridBox.left, layout.gridBox.bottom],
    [layout.gridBox.right, layout.gridBox.bottom],
    [layout.gridBox.left + 3, layout.gridBox.bottom],
    [layout.gridBox.right, layout.gridBox.top + 3],
  ] as const) {
    assert.ok(solid(frame, x, y), `the Grid's edge at ${x},${y} is solid`)
  }
  // The outer frame is not the Grid, and does not join in.
  assert.ok(!solid(frame, layout.offset.column, layout.offset.row))
})

test("the normal panel says how many Nexus powers are active, and names the empty Special slot", () => {
  const built = screenAt(MINIMUM, (build) => build.dispatch({ kind: "focus", target: "menu" }))
  assert.match(built.text, /\[n\] Nexus {2,}1 active/)
  assert.match(built.text, /SPECIAL {2,}none available/)
})

test("the commit confirmation is a screen over the Grid: Battle Round 1, what it announces, and [s] Start", () => {
  const built = screenAt(MINIMUM, (build) => {
    build.dispatch({ kind: "commit" })
  })
  assert.match(built.text, /Battle Round 1/)
  for (const order of ["Activate Nexus.", "Collect Resources.", "Spawn Units."]) assert.match(built.text, new RegExp(order.replace(".", "\\.")))
  assert.match(built.text, /\[s\] Start\b/)
  assert.doesNotMatch(built.text, /Keep building|\?\s*\|/, "one row, and no question")
  assert.match(built.text, /close \[esc\]/)
  // The bottom line answers the key that opened it; once that lapses, the hint says the same keys.
  assert.match(built.text, /Battle Round 1: Enter starts it, Esc goes back\./)
  assert.equal(hint(built.context, built.build.state).text, "Battle round 1: [enter] or [s] starts it, [esc] goes back to the plan.")
})

test("the committed screen names the pick and the count, and the footer carries the full sentence", () => {
  const built = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
    build.dispatch({ kind: "commit" })
    build.dispatch({ kind: "confirm-commit" })
  })
  assert.match(built.text, /BUILD COMMITTED/)
  assert.match(built.text, /Nexus: Test Pick/)
  assert.match(built.text, /1 structure planned/)
  assert.match(built.text, /\[esc\] menu/)
  // The committed screen a session draws when nothing starts a Pulse (no presenter here): the plan is
  // frozen and the status line says so — it no longer promises a Pulse "would begin here" (gate 6A).
  assert.match(built.text, /Build committed - 1 planned\./)
  assert.doesNotMatch(built.text, /would begin here/)
})
