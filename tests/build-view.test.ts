// The Build Phase spike's frame, at both ends of the supported terminal size range. What is being
// checked is the two things engine.md 3.3 requires *in place of a minimap* — edge markers on the
// sides with more Grid, and a position readout naming the visible range — plus the placement
// preview, which is the only thing on screen that says whether Enter will work before it is pressed.

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildLayout, cellForTile, constructLines } from "../src/build/layout.ts"
import { BuildSession } from "../src/build/session.ts"
import { SPIKE_ALLOTMENT, SPIKE_CATALOG } from "../src/build/catalog.ts"
import { remaining } from "../src/build/state.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { bindingLines, composeBuildFrame } from "../src/view/build.ts"
import { cellAt, frameToText, offendingGlyph } from "../src/view/frame.ts"
import { CAPABILITY_MODES } from "../src/view/roles.ts"
import type { GridTerrain, TerrainId } from "../src/grid/types.ts"
import { buildKeyboardCommand } from "../src/build/keyboard.ts"

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

test("the construct rows and the armed item's own line are all on screen", () => {
  const armed = screenAt(MINIMUM, (build, layout) => {
    build.handleData("2", layout)
  })
  assert.match(armed.text, /\[1\] Barracks/)
  assert.match(armed.text, /\[2\] Hatchery/)
  assert.match(armed.text, /\[3\] Turret/)
  // Both groups are labelled, and the empty one says so rather than vanishing.
  assert.match(armed.text, /COMMON/)
  assert.match(armed.text, /ARMY/)
  assert.match(armed.text, /none for this Commander/)
  // Every item's cost is on its own row, and the budget is on the panel's first line.
  assert.match(armed.text, /RESOURCE/)
  for (const item of SPIKE_CATALOG) assert.match(armed.text, new RegExp(String(item.cost)))
  // The selected item says what it does — the thing a player is actually choosing between.
  assert.match(armed.text, /Spawns swarmers, slowly/)
  // Every binding the footer has no room for at 80 columns is on the panel instead, because a
  // binding that is displayed nowhere does not exist (engine.md 9.7).
  assert.match(armed.text, /u undo/)
  assert.match(armed.text, /bksp remove/)
})

test("the panel says nothing about an item until one is selected", () => {
  // "Simple and direct" (Mario, accepting gate 5A) taken literally: a panel that is always full is
  // a panel nobody reads, so the item detail and the legality block appear only while they apply.
  const idle = screenAt(MINIMUM)
  assert.doesNotMatch(idle.text, /Spawns swarmers/)
  assert.doesNotMatch(idle.text, /Trains troopers/)
  assert.doesNotMatch(idle.text, /CANNOT BUILD HERE/)
  // But the menu, the budget and the revision keys are always there.
  assert.match(idle.text, /RESOURCE/)
  assert.match(idle.text, /\[1\] Barracks/)
  assert.match(idle.text, /u undo/)
})

test("the panel says why a placement is refused, and which tile it means", () => {
  const onRock = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }])
  })
  assert.match(onRock.text, /CANNOT BUILD HERE/)
  assert.match(onRock.text, /rock in the way/)
  assert.match(onRock.text, /at 8,5/, "the panel names the tile the reason is about")

  const onNexus = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 0, dy: -3 }])
  })
  assert.match(onNexus.text, /the nexus is here/)

  // And it is gone the moment the placement is legal again, rather than lingering.
  const fine = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 12, dy: 1 }])
  })
  assert.doesNotMatch(fine.text, /CANNOT BUILD HERE/)
})

test("the budget on screen is the budget the reducer is enforcing", () => {
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = new BuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
  const show = (): string =>
    frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))

  assert.match(show(), new RegExp(`${SPIKE_ALLOTMENT} of ${SPIKE_ALLOTMENT}`))
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  assert.match(show(), new RegExp(`${remaining(context, build.state)} of ${SPIKE_ALLOTMENT}`))
  // A row that can no longer be afforded is dimmed — an attribute, not a colour, so it survives
  // monochrome. Checked on an *unselected* row: the selected one is inverse video, which is what
  // "selected" means everywhere in this game, and it gets the CANNOT BUILD HERE block instead.
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
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = new BuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  build.run([{ kind: "move-cursor", dx: 4, dy: 0 }, { kind: "place" }])
  // Barracks still selected, and now unaffordable wherever the cursor is.
  const text = frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))
  assert.match(text, /CANNOT BUILD HERE/)
  assert.match(text, /costs 40, 20 left/)
  assert.doesNotMatch(text, /at \d+,\d+$/m, "affordability is not about a tile, so none is named")
})

test("the footer never advertises a key the keyboard adapter does not bind", () => {
  // A retired binding that is still printed is worse than one that never existed, and the adapter
  // test alone cannot catch it: the footer only shows its optional extras once the terminal is wide
  // enough, so `t click mode` survived the toggle's deletion and rendered at 142 columns and up,
  // where no screenshot in this gate was ever taken. Checked on the widest composition there is.
  const widest = screenAt({ columns: 200, rows: 44 })
  const controls = widest.text
    .split("\n")
    .find((row) => row.includes("arrows move"))
  assert.ok(controls !== undefined, "the controls line is on screen")

  // Every single-character key the line names, checked against the real adapter.
  const named = [...new Set(controls.match(/\b[a-z]\b/g) ?? [])]
  assert.ok(named.length > 0, "the line names at least one letter key")
  for (const key of named) {
    assert.notEqual(
      buildKeyboardCommand(key, { itemCount: 3, armed: true }),
      null,
      `the footer offers "${key}", which the adapter does not bind`,
    )
  }
  assert.doesNotMatch(controls, /click mode/, "the click-mode toggle is gone (Q50)")
})

test("no header or footer line is cut off at the 80-column floor", () => {
  // 80x24 is the acceptance target, and the Grid pane is only 46 usable columns of it. Every line
  // below has been truncated mid-word at some point in this gate's own history and only a
  // screenshot showed it, so each one is now asserted whole at the narrowest size that must work.
  const { text } = screenAt(MINIMUM)
  assert.match(text, /TERMINAL NEXUS build phase/)
  assert.match(text, /view x 0-47 y 1-16 of 96x40 {3}cursor 18,13/)
  assert.match(text, /arrows move.*q quit/)
  assert.match(text, /RESOURCE {10}100 of 100/, "the panel's own first line, whole")
})

test("the scroll margin the screen prints is the one it is actually using", () => {
  // Mario deferred confirming the three-tile default and will judge it against another number, so
  // a header that printed one margin while the camera used another would waste exactly that check.
  for (const margin of [2, 5]) {
    const context = { ...spikeContext(), scrollMargin: margin }
    const layout = buildLayout(MINIMUM, context.grid)
    const build = new BuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
    const text = frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))
    assert.match(text, new RegExp(`margin ${margin}`))
    // And the camera really follows at that distance, not at the default.
    build.dispatch({ kind: "move-cursor", dx: 0, dy: 0 })
    let steps = 0
    while (build.state.camera.x === 0 && steps < context.grid.width) {
      build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
      steps += 1
    }
    assert.equal(layout.viewport.width - 1 - (build.state.cursor.x - build.state.camera.x), margin)
  }
})

test("the ghost preview answers the same question Enter does, budget included", () => {
  // A review found this: the preview checked legality without the budget, so after spending down it
  // drew a perfectly normal-looking structure on a tile where Enter was refused. "What you see is
  // what Enter places" is the whole point of having a preview at all.
  const context = spikeContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = new BuildSession({ context, cursor: { x: 18, y: 13 }, viewport: layout.viewport })
  build.handleData("1", layout)
  build.run([{ kind: "move-cursor", dx: 12, dy: 1 }, { kind: "place" }])
  build.run([{ kind: "move-cursor", dx: 4, dy: 0 }, { kind: "place" }])
  build.run([{ kind: "move-cursor", dx: 8, dy: 0 }])
  assert.ok(remaining(context, build.state) < SPIKE_CATALOG[0]!.cost, "not actually unaffordable")

  const frame = composeBuildFrame({ context, state: build.state, layout }, "monochrome")
  const cell = cellForTile(layout, build.state.camera, build.state.cursor)
  assert.equal(
    cellAt(frame, cell.x, cell.y).glyph,
    "x",
    "the preview says this placement is fine, and pressing Enter refuses it",
  )
  // And the refusal is real, so the two genuinely agree.
  const planned = build.state.planned.length
  build.dispatch({ kind: "place" })
  assert.equal(build.state.planned.length, planned)
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
  const context = { ...spikeContext(), grid: small, standing: [] }
  const layout = buildLayout(MINIMUM, small)
  const build = new BuildSession({ context, cursor: { x: 2, y: 2 }, viewport: layout.viewport })
  build.handleData("1", layout) // a 3x2 barracks at 2,2 hangs off the Grid, so it is refused
  const text = frameToText(composeBuildFrame({ context, state: build.state, layout }, "monochrome"))

  // The furniture that must survive, whole.
  assert.match(text, /u undo/)
  assert.match(text, /view x 0-19 y 0-9 of 20x10/)
  assert.match(text, /arrows move.*q quit/, "the quit key fell off a narrower footer")
  // And the menu itself is still there — it is the block below it that gave way.
  assert.match(text, /\[1\] Barracks/)
  assert.match(text, /RESOURCE/)

  // Every line is still exactly the width it should be: nothing was written over anything.
  for (const row of text.split("\n")) assert.ok(row.length <= 80, `a row ran past 80: "${row}"`)
})

test("a panel with room for the detail block still draws it", () => {
  // The other half of the clamp: it must give way only when it genuinely has to.
  const roomy = screenAt(MINIMUM, (build, layout) => {
    build.handleData("1", layout)
    build.run([{ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }])
  })
  assert.match(roomy.text, /CANNOT BUILD HERE/)
  assert.match(roomy.text, /rock in the way/)
})

test("every binding survives the split whole, at every width the screen can have", () => {
  // The footer shrinks with the composition and the composition shrinks with the Grid. Whatever the
  // two lines end up being, a binding must never be cut in half — a player reading "esc dis" learns
  // nothing and one who cannot find "q quit" is stuck in an alternate screen. And nothing may be
  // lost between the two surfaces: what leaves the footer arrives in the panel.
  const all = bindingLines(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY).footer.split("  ")
  for (let footerLimit = 10; footerLimit <= all.join("  ").length + 5; footerLimit += 1) {
    for (const panelLimit of [26, 28, 40]) {
      const { footer, panel } = bindingLines(footerLimit, panelLimit)
      assert.ok(footer.length <= footerLimit, `footer "${footer}" is wider than ${footerLimit}`)
      for (const line of panel) {
        assert.ok(line.length <= panelLimit, `panel "${line}" is wider than ${panelLimit}`)
      }
      const shown = [footer, ...panel].flatMap((line) => (line === "" ? [] : line.split("  ")))
      assert.deepEqual(shown, all, `a binding was lost or cut at ${footerLimit}/${panelLimit}`)
    }
  }
  // The four a player cannot work the screen without come first, so they are the last to leave the
  // footer.
  assert.deepEqual(all.slice(0, 4), ["arrows move", "enter place", "esc disarm", "q quit"])
})

test("every key the adapters bind is named on screen at the 80-column floor", () => {
  // The converse of the test above, and the one that matters at the acceptance size: a key nobody
  // can find is a key that does not exist (engine.md 9.7). The footer alone cannot hold them at 80
  // columns, which is why the overflow goes in the panel — so the check is against the whole
  // screen, not one line.
  const { text } = screenAt(MINIMUM)
  const bound: readonly (readonly [string, string, RegExp])[] = [
    ["\u001b[A", "arrows", /arrows move/],
    ["\r", "enter", /enter place/],
    ["\u001b", "esc", /esc disarm/],
    ["q", "quit", /q quit/],
    ["\u001b[1;2A", "shift+arrow", /shift\+arrow jump 5/],
    ["\u001b[5~", "pgup", /pgup pgdn jump 5/],
    ["\u001bOH", "home", /home end jump 5/],
    ["\u007f", "backspace", /bksp remove/],
    ["u", "undo", /u undo/],
  ]
  for (const [key, name, shown] of bound) {
    assert.notEqual(
      buildKeyboardCommand(key, { itemCount: 3, armed: true }),
      null,
      `the adapter should bind ${name}`,
    )
    assert.match(text, shown, `${name} is bound but named nowhere on an 80x24 screen`)
  }
})

test("a terminal wide enough puts every binding in the footer and leaves the panel alone", () => {
  // The whole of the layout's adaptation to width, in one assertion: the footer takes what it can
  // hold and the panel shows the remainder, so a wide terminal simply has no remainder.
  const wide = screenAt({ columns: 160, rows: 40 })
  const footer = wide.text.split("\n").find((row) => row.includes("arrows move"))
  assert.ok(footer !== undefined)
  assert.match(footer, /u undo/, "a wide footer holds the last binding too")
  assert.equal(bindingLines(wide.layout.footerLimit, wide.layout.panelLimit).panel.length, 0)
})

test("engine-3.3-markers: the markers keep the same spacing in tiles at both tile widths", () => {
  // They are drawn on terminal cells but they mark *Grid*, so their density is counted in tiles. A
  // step measured in columns halves the moment a tile becomes two columns wide, which is the width
  // a wide terminal actually uses.
  const spacing = (terminal: { columns: number; rows: number }): number => {
    const { text, layout } = screenAt(terminal, (build) => {
      build.run([{ kind: "move-cursor", dx: 20, dy: 20 }])
    })
    const top = text.split("\n")[layout.offset.row] as string
    const columns = [...top].flatMap((glyph, index) => (glyph === "^" ? [index] : []))
    assert.ok(columns.length >= 2, `the north edge should be marked on ${terminal.columns} columns`)
    return ((columns[1] as number) - (columns[0] as number)) / layout.tileWidth
  }
  assert.equal(spacing(MINIMUM), spacing({ columns: 160, rows: 40 }))
})

test("no line is drawn over another, at every terminal size in the supported range", () => {
  // The range is 48x16 to 72x24 tiles, and the screenshots only ever catch the sizes somebody
  // thought to capture. Every size in between is swept here instead: the frame stays the terminal's
  // own size, the footer keeps all three of its lines, and the panel never reaches them.
  for (let columns = 80; columns <= 106; columns += 1) {
    for (let rows = 24; rows <= 32; rows += 1) {
      const { text, layout, frame } = screenAt({ columns, rows }, (build, l) => {
        build.handleData("1", l)
        build.run([{ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }])
      })
      assert.equal(frame.width, columns, `frame width at ${columns}x${rows}`)
      assert.equal(frame.height, rows, `frame height at ${columns}x${rows}`)
      const lines = text.split("\n")
      assert.match(lines[layout.footerRow] as string, /view x /, `readout at ${columns}x${rows}`)
      assert.match(lines[layout.footerRow + 1] as string, /arrows move/, `keys at ${columns}x${rows}`)
      assert.match(lines[layout.footerRow + 2] as string, /Barracks selected/, `status at ${columns}x${rows}`)
      // And the thing the player is being told stays on screen through the whole range.
      assert.match(text, /CANNOT BUILD HERE/, `the refusal at ${columns}x${rows}`)
    }
  }
})

test("engine-3.3-markers: the side markers are an unbroken run, not a column of carets", () => {
  // The east border is the rule between the Grid and the side panel. A marker every few rows there
  // reads as a caret pointing at whichever panel row it lands beside — `> [1] Barracks` looks
  // selected. Every row carrying one is what makes it a border instead.
  // Far enough in that all four sides have more Grid beyond them.
  const { text, layout } = screenAt(MINIMUM, (build) => {
    build.run([{ kind: "move-cursor", dx: 40, dy: 20 }])
  })
  const lines = text.split("\n")
  for (let row = layout.origin.row; row < layout.origin.row + layout.viewport.height; row += 1) {
    assert.equal(
      (lines[row] as string)[layout.dividerColumn],
      ">",
      `the east edge is unmarked on row ${row}`,
    )
    assert.equal(
      (lines[row] as string)[layout.offset.column],
      "<",
      `the west edge is unmarked on row ${row}`,
    )
  }
})
