// The map-edge Experiments (feedback F25): the style and colour of the Grid rectangle's sides where the
// map ends, and whether its west side shares the menu's divider. What is checked is the rule every
// option keeps — **the same weight on all four sides**, in both glyph packs — and that drawing and
// hit-testing still read one geometry when the Grid pane moves by a column.

import { test } from "node:test"
import assert from "node:assert/strict"
import type { MapEdgeChoice, MapEdgeColour } from "../src/build/debug.ts"
import { DEBUG_FIELDS, initialDebugFlags } from "../src/build/debug.ts"
import { buildLayout, cellForTile, layoutMatches, layoutOptions, menuEntryAt, tileAtCell } from "../src/build/layout.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildContext, BuildState } from "../src/build/state.ts"
import { SPIKE_EDGE_STYLE } from "../src/build/catalog.ts"
import { spikeContext } from "../src/cli/spike.ts"
import type { GridTerrain, TerrainId } from "../src/grid/types.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { cellAt, offendingGlyph } from "../src/view/frame.ts"
import type { Cell, ReadonlyCellFrame } from "../src/view/frame.ts"
import { sgrFor } from "../src/view/roles.ts"
import type { GlyphPack } from "../src/view/theme.ts"
import { chromeGlyph, terrainGlyph } from "../src/view/theme.ts"

const MINIMUM = { columns: 80, rows: 24 }
const STYLES: readonly MapEdgeChoice[] = ["solid", "half", "heavy", "double", "shade", "map"]
const COLOURS: readonly MapEdgeColour[] = ["strong", "dim", "quiet"]
const PACKS: readonly GlyphPack[] = ["ascii", "unicode"]

/** A Grid exactly the minimum viewport: the whole map on screen, so all four sides are its edge. */
function wholeMap(width = 48, height = 16): GridTerrain {
  return { width, height, tiles: new Array<TerrainId>(width * height).fill("terrain.plain") }
}

function contextFor(grid: GridTerrain): BuildContext {
  return { ...spikeContext(), grid, standing: [] }
}

type Screen = Readonly<{ layout: BuildLayout; state: BuildState; frame: ReadonlyCellFrame; context: BuildContext }>

function screen(
  context: BuildContext,
  flags: Partial<BuildState["debug"]>,
  pack: GlyphPack,
  cursor = { x: 2, y: 2 },
  terminal = MINIMUM,
): Screen {
  const debug = { ...initialDebugFlags({}), ...flags }
  const layout = buildLayout(terminal, context.grid, layoutOptions(debug))
  const build = new BuildSession({ context, cursor, viewport: layout.viewport })
  const state = { ...build.state, debug }
  const frame = composeBuildFrame({ context, state, layout, glyphPack: pack }, "truecolor")
  return { layout, state, frame, context }
}

/** The rectangle's sides, corners excluded, as the cells drawn there — the west side being the Grid's
 *  own column, which is the divider when shared. */
function sides(s: Screen): Readonly<Record<"north" | "south" | "west" | "east", readonly Cell[]>> {
  const box = s.layout.gridBox
  const row = (y: number): Cell[] => {
    const cells: Cell[] = []
    for (let x = box.left + 1; x < box.right; x += 1) cells.push(cellAt(s.frame, x, y))
    return cells
  }
  const column = (x: number): Cell[] => {
    const cells: Cell[] = []
    for (let y = box.top + 1; y < box.bottom; y += 1) cells.push(cellAt(s.frame, x, y))
    return cells
  }
  return { north: row(box.top), south: row(box.bottom), west: column(box.left), east: column(box.right) }
}

/** What a cell looks like apart from its glyph: its role and attributes. */
function look(cell: Cell): string {
  const { fgRole, inverse, dim, bold } = cell.style
  return JSON.stringify({ fgRole, inverse: inverse === true, dim: dim === true, bold: bold === true })
}

/** The glyphs each style draws along a horizontal and a vertical side (Unicode); `null` for a style
 *  drawn as the solid bar. The fence's ASCII form is a pattern, checked separately. */
const UNICODE_RUNS: Readonly<Record<string, readonly [string, string, string, string]>> = {
  //        north south west east
  solid: [" ", " ", " ", " "],
  half: ["▄", "▀", "▐", "▌"],
  heavy: ["━", "━", "┃", "┃"],
  double: ["═", "═", "║", "║"],
  shade: ["░", "░", "░", "░"],
  map: ["┅", "┅", "┇", "┇"],
}

test("every map-edge style draws the same weight on all four sides, in both packs and every colour", () => {
  for (const shared of [false, true]) {
    for (const pack of PACKS) {
      for (const style of STYLES) {
        for (const colour of COLOURS) {
          const s = screen(contextFor(wholeMap()), { mapEdge: style, mapEdgeColour: colour, sharedWestBorder: shared }, pack)
          const label = `${style}/${colour}/${pack}/${shared ? "shared" : "own column"}`
          const all = sides(s)
          // One look — role and attributes — on every cell of every side.
          const looks = new Set(Object.values(all).flat().map(look))
          assert.equal(looks.size, 1, `${label}: the four sides differ in style: ${[...looks].join(" | ")}`)
          // The four corners are the edge too, in the same role.
          const box = s.layout.gridBox
          for (const [x, y] of [[box.left, box.top], [box.right, box.top], [box.left, box.bottom], [box.right, box.bottom]] as const) {
            assert.equal(cellAt(s.frame, x, y).style.fgRole, cellAt(s.frame, box.left + 1, box.top).style.fgRole, `${label}: corner ${x},${y}`)
            assert.notEqual(cellAt(s.frame, x, y).style.dim === true && colour !== "dim", true, `${label}: a soft corner at ${x},${y}`)
          }
          // The glyphs: one per side, matching across opposite sides.
          const glyphs = (cells: readonly Cell[]): Set<string> => new Set(cells.map((cell) => cell.glyph))
          const inverse = cellAt(s.frame, box.left + 1, box.top).style.inverse === true
          if (pack === "ascii") {
            if (style === "shade") {
              for (const side of Object.values(all)) assert.deepEqual([...glyphs(side)], [":"], label)
            } else if (style === "map") {
              assert.ok([...glyphs(all.north), ...glyphs(all.south)].every((g) => g === "+" || g === "-"), `${label}: north/south`)
              assert.ok([...glyphs(all.west), ...glyphs(all.east)].every((g) => g === "+" || g === "|"), `${label}: west/east`)
            } else {
              // ASCII has no thinner equal-weight glyph: the solid bar, the same both ways (Q56).
              for (const side of Object.values(all)) assert.deepEqual([...glyphs(side)], [" "], label)
              assert.ok(inverse, `${label}: the ASCII fallback is the solid bar`)
            }
          } else {
            const [north, south, west, east] = UNICODE_RUNS[style] ?? []
            assert.deepEqual([...glyphs(all.north)], [north], `${label}: north`)
            assert.deepEqual([...glyphs(all.south)], [south], `${label}: south`)
            assert.deepEqual([...glyphs(all.west)], [west], `${label}: west`)
            assert.deepEqual([...glyphs(all.east)], [east], `${label}: east`)
            assert.equal(inverse, style === "solid", `${label}: only the solid bar is inverse video`)
          }
          assert.equal(offendingGlyph(s.frame), null, `${label}: a glyph outside the packs`)
        }
      }
    }
  }
})

test("a map shorter and narrower than the pane closes its rectangle in the edge style on all four sides", () => {
  for (const style of STYLES) {
    const s = screen(contextFor(wholeMap(20, 10)), { mapEdge: style }, "unicode")
    const all = sides(s)
    const looks = new Set(Object.values(all).flat().map(look))
    assert.equal(looks.size, 1, `${style}: ${[...looks].join(" | ")}`)
    const [north, south, west, east] = UNICODE_RUNS[style] ?? []
    assert.deepEqual([...new Set(all.south.map((cell) => cell.glyph))], [south], `${style}: the short map's own bottom`)
    assert.deepEqual([...new Set(all.north.map((cell) => cell.glyph))], [north])
    assert.deepEqual([...new Set(all.west.map((cell) => cell.glyph))], [west])
    assert.deepEqual([...new Set(all.east.map((cell) => cell.glyph))], [east])
  }
})

test("the edge style changes only the sides where the map ends: in the middle of the map the frame is the same for every option", () => {
  const context = spikeContext()
  const middle = { x: 48, y: 20 }
  for (const pack of PACKS) {
    const plain = screen(context, {}, pack, middle).frame
    for (const style of STYLES) {
      for (const colour of COLOURS) {
        const other = screen(context, { mapEdge: style, mapEdgeColour: colour }, pack, middle).frame
        assert.deepEqual(other, plain, `${style}/${colour}/${pack}`)
      }
    }
  }
})

test("the defaults: a solid bar in the quieter edge colour (\"less accentuated\"), in a column of its own", () => {
  const flags = initialDebugFlags({})
  assert.equal(flags.mapEdge, "solid")
  assert.equal(flags.mapEdgeColour, "quiet")
  assert.equal(flags.sharedWestBorder, false)
  const s = screen(spikeContext(), {}, "ascii", { x: 0, y: 0 })
  const west = cellAt(s.frame, s.layout.gridBox.left, s.layout.origin.row + 3)
  assert.equal(west.style.inverse, true)
  assert.equal(west.style.fgRole, "chrome.edge")
  assert.equal(s.layout.gridBox.left, s.layout.dividerColumn + 1)
  // The three flags are in Debug Mode's list, each naming its question.
  for (const field of ["mapEdge", "mapEdgeColour", "sharedWestBorder"]) {
    const spec = DEBUG_FIELDS.find((entry) => entry.field === field)
    assert.ok(spec !== undefined && spec.question.includes("F25"), `${field} is listed and names F25`)
  }
})

test("a quiet edge is a role of its own, resolved in both themes at every colour tier", () => {
  const s = screen(contextFor(wholeMap()), { mapEdgeColour: "quiet" }, "unicode")
  assert.equal(cellAt(s.frame, s.layout.gridBox.left + 3, s.layout.gridBox.top).style.fgRole, "chrome.edge")
  for (const theme of ["dark", "light"] as const) {
    for (const tier of ["color16", "color256", "truecolor"] as const) {
      assert.ok(sgrFor("chrome.edge", tier, theme).length > 0, `${theme} ${tier}`)
      assert.notDeepEqual(sgrFor("chrome.edge", tier, theme), sgrFor("chrome.frame", tier, theme), `${theme} ${tier}: quieter, not the same`)
    }
  }
})

test("the map's own edge is the style the map names, and the solid bar for a map that names none", () => {
  assert.equal(SPIKE_EDGE_STYLE, "fence")
  const own = screen(contextFor(wholeMap()), { mapEdge: "map" }, "unicode")
  assert.equal(cellAt(own.frame, own.layout.gridBox.left + 3, own.layout.gridBox.top).glyph, "┅")
  const { edgeStyle: _unused, ...unnamed } = contextFor(wholeMap())
  const none = screen(unnamed, { mapEdge: "map" }, "unicode")
  assert.equal(cellAt(none.frame, none.layout.gridBox.left + 3, none.layout.gridBox.top).style.inverse, true)
})

test("the ASCII fence's posts are fixed to the map, not the screen: they scroll with it", () => {
  // Hard against the north edge, then one tile east: the post under map column 4 moves with it.
  const context = spikeContext()
  const at = (cursorX: number): Screen => screen(context, { mapEdge: "map" }, "ascii", { x: cursorX, y: 0 })
  const postsAt = (s: Screen): number[] => {
    const columns: number[] = []
    for (let x = s.layout.origin.column; x < s.layout.gridBox.right; x += 1) {
      if (cellAt(s.frame, x, s.layout.gridBox.top).glyph === "+") columns.push(x - s.layout.origin.column + s.state.camera.x)
    }
    return columns
  }
  const before = at(30)
  const after = at(60)
  assert.notEqual(before.state.camera.x, after.state.camera.x, "the view scrolled")
  assert.ok(postsAt(before).every((column) => column % 4 === 0), "posts stand on map columns 0, 4, 8...")
  assert.ok(postsAt(after).every((column) => column % 4 === 0), "and still do after scrolling")
})

test("shared west side: the Grid gets the column, and drawing and hit-testing agree on every tile", () => {
  const context = spikeContext()
  const own = buildLayout(MINIMUM, context.grid)
  const shared = buildLayout(MINIMUM, context.grid, { sharedWest: true })
  assert.equal(shared.sharedWest, true)
  assert.equal(shared.gridBox.left, shared.dividerColumn, "the divider is the Grid's west side")
  assert.equal(shared.dividerColumn, own.dividerColumn, "the menu keeps its width")
  assert.equal(shared.panelLimit, own.panelLimit)
  assert.equal(shared.origin.column, own.origin.column - 1)
  assert.equal(shared.viewport.width, own.viewport.width + 1, "one more tile of Grid at 80 columns")
  assert.equal(shared.composition.width, 80)
  assert.equal(shared.frame.width, 80)
  for (const layout of [own, shared]) {
    const camera = { x: 5, y: 3 }
    for (let row = layout.origin.row; row < layout.origin.row + layout.viewport.height; row += 1) {
      for (let column = 0; column < layout.frame.width; column += 1) {
        const tile = tileAtCell(layout, camera, column, row)
        const onGrid = column >= layout.origin.column && column < layout.gridBox.right
        assert.equal(tile !== null, onGrid, `column ${column}: on the Grid is where tiles are drawn`)
        if (tile !== null) assert.deepEqual(cellForTile(layout, camera, tile), { x: column, y: row })
      }
    }
    // The menu's click targets did not move.
    assert.equal(menuEntryAt(layout, context.catalog, layout.panelColumn, layout.panelRow), 0)
  }
  // Wide tiles and the largest view keep the arithmetic.
  for (const terminal of [{ columns: 104, rows: 32 }, { columns: 128, rows: 24 }, { columns: 200, rows: 44 }]) {
    const wide = buildLayout(terminal, context.grid, { sharedWest: true })
    assert.equal(wide.composition.width, 2 + 29 + wide.viewport.width * wide.tileWidth, `${terminal.columns}`)
    assert.ok(wide.composition.width <= wide.frame.width)
  }
})

test("shared west side is live: flipping it re-lays the screen out, and a click lands on the tile drawn under it", () => {
  // From Settings' first row, Up comes round to Export, then Restart, then the shared-west row (the last).
  const run = runBuildPlaytest({ steps: parseKeyScript("Esc s Up Up Up Right Esc Esc Tab") })
  const last = run.frames[run.frames.length - 1]
  assert.ok(last !== undefined)
  assert.equal(last.state.debug.sharedWestBorder, true)
  assert.ok(layoutMatches(run.layout, last.state.debug), "the playtest's layout follows the flag")
  assert.equal(run.layout.viewport.width, 49)
  assert.equal(last.state.viewport.width, 49, "the session was told its new viewport")
  // Every tile on screen is drawn where the new layout says: a rock is where cellForTile puts it.
  const { context } = run
  const camera = last.state.camera
  for (let y = camera.y; y < camera.y + run.layout.viewport.height; y += 1) {
    for (let x = camera.x; x < camera.x + run.layout.viewport.width; x += 1) {
      if (context.grid.tiles[y * context.grid.width + x] !== "terrain.rock") continue
      const cell = cellForTile(run.layout, camera, { x, y })
      assert.equal(cellAt(last.frame, cell.x, cell.y).glyph, terrainGlyph("terrain.rock").glyph, `rock at ${x},${y}`)
    }
  }
  // And a click on a screen cell of the Grid's new first column lands on the tile drawn there.
  const column = run.layout.origin.column
  const row = run.layout.origin.row + 4
  const clicked = runBuildPlaytest({ steps: parseKeyScript(`Esc s Up Up Up Right Esc Esc Tab click@${column},${row}`) })
  const final = clicked.frames[clicked.frames.length - 1]
  const before = clicked.frames[clicked.frames.length - 2]
  assert.ok(final !== undefined && before !== undefined)
  // Measured against the view the click was made on: an exploring click near an edge then scrolls.
  assert.deepEqual(final.state.cursor, tileAtCell(clicked.layout, before.state.camera, column, row))
  // Flipped back, the layout is the separate column again.
  const back = runBuildPlaytest({ steps: parseKeyScript("Esc s Up Up Up Right Right Esc Esc") })
  assert.equal(back.layout.sharedWest, false)
  assert.equal(back.layout.viewport.width, 48)
})

test("a light side beside the shared divider is the divider drawn soft; the map's edge there is the edge style", () => {
  const context = spikeContext()
  const middle = screen(context, { sharedWestBorder: true }, "ascii", { x: 48, y: 20 })
  const row = middle.layout.origin.row + 4
  assert.equal(cellAt(middle.frame, middle.layout.dividerColumn, row).glyph, chromeGlyph("ascii", "softVertical"))
  assert.equal(cellAt(middle.frame, middle.layout.dividerColumn, row).style.dim, true)
  const west = screen(context, { sharedWestBorder: true, mapEdge: "half" }, "unicode", { x: 0, y: 20 })
  assert.equal(cellAt(west.frame, west.layout.dividerColumn, row).glyph, "▐", "a half block on the map's side of the divider")
})
