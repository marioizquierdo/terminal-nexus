// The Build Phase spike's frame, at both ends of the supported terminal size range. What is being
// checked is the two things engine.md 3.3 requires *in place of a minimap* — edge markers on the
// sides with more Grid, and a position readout naming the visible range — plus the placement
// preview, which is the only thing on screen that says whether Enter will work before it is pressed.

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildLayout, cellForTile } from "../src/build/layout.ts"
import { BuildSession } from "../src/build/session.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { cellAt, frameToText, offendingGlyph } from "../src/view/frame.ts"
import { CAPABILITY_MODES } from "../src/view/roles.ts"

const MINIMUM = { columns: 80, rows: 24 }
const MAXIMUM = { columns: 104, rows: 32 }
const WIDE = { columns: 128, rows: 24 }

function screenAt(terminal: { columns: number; rows: number }, drive: (build: BuildSession, layout: ReturnType<typeof buildLayout>) => void = () => {}) {
  const context = spikeContext()
  const layout = buildLayout(terminal, context.grid)
  const build = new BuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
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
  // is 128 — engine.md 3.1's "the two compositions fall out of one number".
  const wide = screenAt(WIDE)
  assert.equal(wide.layout.tileWidth, 2)
  assert.equal(wide.layout.composition.width, 128)
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

test("engine-3.3-markers: the frame shows which sides have more Grid, and stops when they do not", () => {
  // Hard against the Grid's north-west corner: nothing north of here, nothing west of here.
  const corner = screenAt(MINIMUM, (build) => {
    build.run([{ kind: "move-cursor", dx: -999, dy: -999 }])
  })
  const rows = corner.text.split("\n")
  const top = rows[corner.layout.offset.row] ?? ""
  const bottom = rows[corner.layout.offset.row + corner.layout.composition.height - 1] ?? ""
  assert.equal(top.includes("^"), false, "nothing north of the Grid's own top edge")
  assert.ok(bottom.includes("v"), "more Grid to the south")

  const west = rows
    .slice(corner.layout.origin.row, corner.layout.origin.row + corner.layout.viewport.height)
    .map((row) => row[corner.layout.offset.column] ?? " ")
    .join("")
  assert.equal(west.includes("<"), false, "nothing west of the Grid's own left edge")

  // Walk into the middle and every side has more Grid beyond it.
  const middle = screenAt(MINIMUM, (build) => {
    build.run([{ kind: "move-cursor", dx: 30, dy: 12 }])
  })
  const middleRows = middle.text.split("\n")
  assert.ok((middleRows[middle.layout.offset.row] ?? "").includes("^"))
  assert.ok(
    (middleRows[middle.layout.offset.row + middle.layout.composition.height - 1] ?? "").includes("v"),
  )
  const middleWest = middleRows
    .slice(middle.layout.origin.row, middle.layout.origin.row + middle.layout.viewport.height)
    .map((row) => row[middle.layout.offset.column] ?? " ")
    .join("")
  assert.ok(middleWest.includes("<"))
})

test("engine-3.3-readout: the footer names the visible tile range and the Grid's own size", () => {
  const opening = screenAt(MINIMUM)
  assert.match(opening.text, /view x 0-47 y 1-16 of 96x40/)
  assert.match(opening.text, /cursor 18,13/)

  const scrolled = screenAt(MINIMUM, (build) => {
    build.run([{ kind: "move-cursor", dx: 40, dy: 10 }])
  })
  assert.match(scrolled.text, /view x \d+-\d+ y \d+-\d+ of 96x40/)
  assert.match(scrolled.text, /cursor 58,23/)
  // The maximum viewport genuinely shows more Grid than the minimum: 72 tiles across, not 48.
  const large = screenAt(MAXIMUM)
  assert.match(large.text, /view x 0-71 y \d+-\d+ of 96x40/)
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

test("a planned structure is drawn, and reads differently from one already standing", () => {
  const planned = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }, { kind: "disarm" }])
  })
  const cell = cellForTile(planned.layout, planned.build.state.camera, { x: 30, y: 14 })
  assert.equal(cellAt(planned.frame, cell.x, cell.y).style.dim, true, "a plan is dimmed")
  const standing = cellForTile(planned.layout, planned.build.state.camera, { x: 18, y: 10 })
  assert.equal(cellAt(planned.frame, standing.x, standing.y).style.bold, true, "a built one is not")
  assert.match(planned.text, /1 structure/)
})

test("every capability tier puts identical glyphs on screen", () => {
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = new BuildSession({ context, cursor: { x: 30, y: 20 }, viewport: layout.viewport })
  build.handleData("1", layout)
  const texts = CAPABILITY_MODES.map((capability) =>
    frameToText(composeBuildFrame({ context, state: build.state, layout }, capability)),
  )
  for (const text of texts) assert.equal(text, texts[0])
})

test("every glyph on the frame is one cell wide, at both sizes and in both packs", () => {
  for (const terminal of [MINIMUM, MAXIMUM, WIDE]) {
    for (const glyphPack of ["ascii", "unicode"] as const) {
      const context = spikeContext()
      const layout = buildLayout(terminal, context.grid)
      const build = new BuildSession({ context, cursor: { x: 40, y: 20 }, viewport: layout.viewport })
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

test("the construct rows, the armed item and the click mode are all on screen", () => {
  const armed = screenAt(MINIMUM, (build, layout) => {
    build.handleData("2", layout)
  })
  assert.match(armed.text, /\[1\] Barracks/)
  assert.match(armed.text, /\[2\] Hatchery/)
  assert.match(armed.text, /\[3\] Turret/)
  assert.match(armed.text, /ARMED/)
  assert.match(armed.text, /hatch/)
  assert.match(armed.text, /CLICK MODE {2}\[t\]/)
  assert.match(armed.text, /click places it/)

  const confirmMode = screenAt(MINIMUM, (build, layout) => {
    build.handleData("t", layout)
  })
  assert.match(confirmMode.text, /click again/i)
})
