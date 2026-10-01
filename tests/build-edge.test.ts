// The map's edge (feedback F25, settled by the owner's playtest of 2026-09-29): the sides of the Grid
// rectangle where the map ends are drawn in **the map's own style** — the solid bar when the map names
// none — in the quieter edge colour, and the menu's divider **is** the Grid's west side. What is
// checked is the rule every style a map may name keeps — **the same weight on all four sides**, in
// both glyph packs — and that drawing and hit-testing read one geometry with the shared west side.

import { test } from "node:test"
import assert from "node:assert/strict"
import { isGated } from "../src/build/camera.ts"
import { EXPERIMENT_FIELDS } from "../src/build/experiments.ts"
import { EXPLORE_ROW, buildLayout, cellForTile, menuEntryAt, tileAtCell } from "../src/build/layout.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildContext, BuildState } from "../src/build/state.ts"
import { STARTER_EDGE_STYLE } from "../src/build/catalog.ts"
import { MAP_EDGE_STYLES } from "../src/build/types.ts"
import type { MapEdgeStyle } from "../src/build/types.ts"
import { starterContext } from "../src/cli/build-phase.ts"
import type { GridTerrain, TerrainId } from "../src/grid/types.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { cellAt, offendingGlyph } from "../src/view/frame.ts"
import type { Cell, ReadonlyCellFrame } from "../src/view/frame.ts"
import { sgrFor } from "../src/view/roles.ts"
import type { GlyphPack } from "../src/view/theme.ts"
import { chromeGlyph, terrainGlyph } from "../src/view/theme.ts"
import { MINIMUM } from "./build-helpers.ts"

const PACKS: readonly GlyphPack[] = ["ascii", "unicode"]

/** A Grid exactly the minimum viewport: the whole map on screen, so all four sides are its edge. */
function wholeMap(width = 48, height = 16): GridTerrain {
  return { width, height, tiles: new Array<TerrainId>(width * height).fill("terrain.plain") }
}

/** The spike's context on another Grid, naming `edgeStyle` as its own — or none, when `null`. */
function contextFor(grid: GridTerrain, edgeStyle: MapEdgeStyle | null = STARTER_EDGE_STYLE): BuildContext {
  const { edgeStyle: _spike, ...rest } = { ...starterContext(), grid, standing: [] }
  return edgeStyle === null ? rest : { ...rest, edgeStyle }
}

type Screen = Readonly<{ layout: BuildLayout; state: BuildState; frame: ReadonlyCellFrame; context: BuildContext }>

function screen(context: BuildContext, pack: GlyphPack, cursor = { x: 2, y: 2 }, terminal = MINIMUM): Screen {
  const layout = buildLayout(terminal, context.grid)
  const build = new BuildSession({ context, cursor, viewport: layout.viewport })
  const state = build.state
  const frame = composeBuildFrame({ context, state, layout, glyphPack: pack }, "truecolor")
  return { layout, state, frame, context }
}

/** The rectangle's sides, corners excluded, as the cells drawn there — the west side being the menu's
 *  divider. */
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

/** The glyphs each style draws along a horizontal and a vertical side (Unicode). The fence's ASCII
 *  form is a pattern, checked separately. */
const UNICODE_RUNS: Readonly<Record<MapEdgeStyle, readonly [string, string, string, string]>> = {
  //        north south west east
  solid: [" ", " ", " ", " "],
  half: ["▄", "▀", "▐", "▌"],
  heavy: ["━", "━", "┃", "┃"],
  double: ["═", "═", "║", "║"],
  shade: ["░", "░", "░", "░"],
  fence: ["┅", "┅", "┇", "┇"],
}

test("every style a map may name draws the same weight on all four sides, in both packs, in the quiet edge colour", () => {
  for (const pack of PACKS) {
    for (const style of MAP_EDGE_STYLES) {
      const s = screen(contextFor(wholeMap(), style), pack)
      const label = `${style}/${pack}`
      const all = sides(s)
      // One look — role and attributes — on every cell of every side, and that look is the quiet edge.
      const looks = new Set(Object.values(all).flat().map(look))
      assert.equal(looks.size, 1, `${label}: the four sides differ in style: ${[...looks].join(" | ")}`)
      assert.equal(all.north[0]?.style.fgRole, "chrome.edge", `${label}: the quieter edge colour`)
      assert.notEqual(all.north[0]?.style.dim, true, `${label}: quiet by its role, not dimmed`)
      // The four corners are the edge too, in the same role, and never soft.
      const box = s.layout.gridBox
      for (const [x, y] of [[box.left, box.top], [box.right, box.top], [box.left, box.bottom], [box.right, box.bottom]] as const) {
        assert.equal(cellAt(s.frame, x, y).style.fgRole, "chrome.edge", `${label}: corner ${x},${y}`)
        assert.notEqual(cellAt(s.frame, x, y).style.dim, true, `${label}: a soft corner at ${x},${y}`)
      }
      // The glyphs: one per side, matching across opposite sides.
      const glyphs = (cells: readonly Cell[]): Set<string> => new Set(cells.map((cell) => cell.glyph))
      const inverse = cellAt(s.frame, box.left + 1, box.top).style.inverse === true
      if (pack === "ascii") {
        if (style === "shade") {
          for (const side of Object.values(all)) assert.deepEqual([...glyphs(side)], [":"], label)
        } else if (style === "fence") {
          assert.ok([...glyphs(all.north), ...glyphs(all.south)].every((g) => g === "+" || g === "-"), `${label}: north/south`)
          assert.ok([...glyphs(all.west), ...glyphs(all.east)].every((g) => g === "+" || g === "|"), `${label}: west/east`)
        } else {
          // ASCII has no thinner equal-weight glyph: the solid bar, the same both ways (Q56).
          for (const side of Object.values(all)) assert.deepEqual([...glyphs(side)], [" "], label)
          assert.ok(inverse, `${label}: the ASCII fallback is the solid bar`)
        }
      } else {
        const [north, south, west, east] = UNICODE_RUNS[style]
        assert.deepEqual([...glyphs(all.north)], [north], `${label}: north`)
        assert.deepEqual([...glyphs(all.south)], [south], `${label}: south`)
        assert.deepEqual([...glyphs(all.west)], [west], `${label}: west`)
        assert.deepEqual([...glyphs(all.east)], [east], `${label}: east`)
        assert.equal(inverse, style === "solid", `${label}: only the solid bar is inverse video`)
      }
      assert.equal(offendingGlyph(s.frame), null, `${label}: a glyph outside the packs`)
    }
  }
})

test("a map shorter and narrower than the pane closes its rectangle in its edge style on all four sides", () => {
  for (const style of MAP_EDGE_STYLES) {
    const s = screen(contextFor(wholeMap(20, 10), style), "unicode")
    const all = sides(s)
    const looks = new Set(Object.values(all).flat().map(look))
    assert.equal(looks.size, 1, `${style}: ${[...looks].join(" | ")}`)
    const [north, south, west, east] = UNICODE_RUNS[style]
    assert.deepEqual([...new Set(all.south.map((cell) => cell.glyph))], [south], `${style}: the short map's own bottom`)
    assert.deepEqual([...new Set(all.north.map((cell) => cell.glyph))], [north])
    assert.deepEqual([...new Set(all.west.map((cell) => cell.glyph))], [west])
    assert.deepEqual([...new Set(all.east.map((cell) => cell.glyph))], [east])
  }
})

test("the edge style changes only the sides where the map ends: in the middle of the map the frame is the same for every style", () => {
  const middle = { x: 48, y: 20 }
  const grid = starterContext().grid
  for (const pack of PACKS) {
    const plain = screen(contextFor(grid, null), pack, middle).frame
    for (const style of MAP_EDGE_STYLES) {
      const other = screen(contextFor(grid, style), pack, middle).frame
      assert.deepEqual(other, plain, `${style}/${pack}`)
    }
  }
})

test("the map's own edge is the style the map names, and the solid bar for a map that names none", () => {
  assert.equal(STARTER_EDGE_STYLE, "fence")
  assert.equal(starterContext().edgeStyle, STARTER_EDGE_STYLE, "the spike map names its own")
  const own = screen(contextFor(wholeMap()), "unicode")
  assert.equal(cellAt(own.frame, own.layout.gridBox.left + 3, own.layout.gridBox.top).glyph, "┅")
  const none = screen(contextFor(wholeMap(), null), "unicode")
  const bar = cellAt(none.frame, none.layout.gridBox.left + 3, none.layout.gridBox.top)
  assert.equal(bar.style.inverse, true)
  assert.equal(bar.style.fgRole, "chrome.edge")
})

test("the map edge is the rule now, not an Experiment: none of the three settled flags is left in the list", () => {
  const fields = new Set<string>(EXPERIMENT_FIELDS.map((spec) => spec.field))
  for (const field of ["mapEdge", "mapEdgeColour", "sharedWestBorder"]) {
    assert.equal(fields.has(field), false, `${field} was settled by the owner's playtest and deleted`)
  }
})

test("a quiet edge is a role of its own, resolved in both themes at every colour tier", () => {
  const s = screen(contextFor(wholeMap(), "solid"), "unicode")
  assert.equal(cellAt(s.frame, s.layout.gridBox.left + 3, s.layout.gridBox.top).style.fgRole, "chrome.edge")
  for (const theme of ["dark", "light"] as const) {
    for (const tier of ["color16", "color256", "truecolor"] as const) {
      assert.ok(sgrFor("chrome.edge", tier, theme).length > 0, `${theme} ${tier}`)
      assert.notDeepEqual(sgrFor("chrome.edge", tier, theme), sgrFor("chrome.frame", tier, theme), `${theme} ${tier}: quieter, not the same`)
    }
  }
})

test("the ASCII fence's posts are fixed to the map, not the screen: they scroll with it", () => {
  // Hard against the north edge, then further east: the posts stay on the map's own columns.
  const context = starterContext()
  const at = (cursorX: number): Screen => screen(context, "ascii", { x: cursorX, y: 0 })
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
  assert.ok(postsAt(before).length > 0 && postsAt(after).length > 0, "there are posts to check")
  assert.ok(postsAt(before).every((column) => column % 4 === 0), "posts stand on map columns 0, 4, 8...")
  assert.ok(postsAt(after).every((column) => column % 4 === 0), "and still do after scrolling")
})

test("the shared west side: the divider is the Grid's west side, the Grid gets its column, and drawing and hit-testing agree", () => {
  const context = starterContext()
  const layout = buildLayout(MINIMUM, context.grid)
  assert.equal(layout.gridBox.left, layout.dividerColumn, "the divider is the Grid's west side")
  assert.equal(layout.origin.column, layout.dividerColumn + 1, "the Grid starts right beside it")
  assert.equal(layout.dividerColumn, 29, "the menu keeps its width: border, 28 columns of panel, divider")
  assert.equal(layout.panelLimit, 27)
  assert.equal(layout.viewport.width, 49, "one more tile of Grid than the minimum at 80 columns")
  assert.equal(layout.composition.width, 80)
  assert.equal(layout.frame.width, 80)
  // The floor did not move with it: 80 x 24 is still the smallest terminal that plays.
  assert.equal(isGated(MINIMUM, context.grid), false)
  assert.equal(isGated({ columns: 79, rows: 24 }, context.grid), true)
  const camera = { x: 5, y: 3 }
  for (let row = layout.origin.row; row < layout.origin.row + layout.viewport.height; row += 1) {
    for (let column = 0; column < layout.frame.width; column += 1) {
      const tile = tileAtCell(layout, camera, column, row)
      const onGrid = column >= layout.origin.column && column < layout.gridBox.right
      assert.equal(tile !== null, onGrid, `column ${column}: on the Grid is where tiles are drawn`)
      if (tile !== null) assert.deepEqual(cellForTile(layout, camera, tile), { x: column, y: row })
    }
  }
  // The menu's click targets are on the panel, left of the divider.
  assert.equal(menuEntryAt(layout, context.catalog, layout.panelColumn, layout.panelRow + EXPLORE_ROW), 0)
  assert.equal(menuEntryAt(layout, context.catalog, layout.dividerColumn, layout.panelRow + EXPLORE_ROW), null)
  // Wide tiles and the largest view keep the arithmetic.
  for (const terminal of [{ columns: 104, rows: 32 }, { columns: 128, rows: 24 }, { columns: 200, rows: 44 }]) {
    const wide = buildLayout(terminal, context.grid)
    assert.equal(wide.gridBox.left, wide.dividerColumn, `${terminal.columns}: shared`)
    assert.equal(wide.composition.width, 2 + 29 + wide.viewport.width * wide.tileWidth, `${terminal.columns}`)
    assert.ok(wide.composition.width <= wide.frame.width)
  }
})

test("a scripted playtest draws every tile where the layout says, and a click on the Grid's first column lands on the tile drawn there", () => {
  const run = runBuildPlaytest({ steps: parseKeyScript("Tab") })
  const last = run.frames[run.frames.length - 1]
  assert.ok(last !== undefined)
  assert.equal(run.layout.viewport.width, 49)
  assert.equal(last.state.viewport.width, 49, "the session has the layout's viewport")
  // Every tile on screen is drawn where the layout says: a rock is where cellForTile puts it.
  const { context } = run
  const camera = last.state.camera
  let rocks = 0
  for (let y = camera.y; y < camera.y + run.layout.viewport.height; y += 1) {
    for (let x = camera.x; x < camera.x + run.layout.viewport.width; x += 1) {
      if (context.grid.tiles[y * context.grid.width + x] !== "terrain.rock") continue
      const cell = cellForTile(run.layout, camera, { x, y })
      assert.equal(cellAt(last.frame, cell.x, cell.y).glyph, terrainGlyph("terrain.rock").glyph, `rock at ${x},${y}`)
      rocks += 1
    }
  }
  assert.ok(rocks > 0, "there are rocks on screen to check")
  // A click on a screen cell of the Grid's first column lands on the tile drawn there.
  const column = run.layout.origin.column
  const row = run.layout.origin.row + 4
  const clicked = runBuildPlaytest({ steps: parseKeyScript(`Tab click@${column},${row}`) })
  const final = clicked.frames[clicked.frames.length - 1]
  const before = clicked.frames[clicked.frames.length - 2]
  assert.ok(final !== undefined && before !== undefined)
  // Measured against the view the click was made on: an exploring click near an edge then scrolls.
  assert.deepEqual(final.state.cursor, tileAtCell(clicked.layout, before.state.camera, column, row))
  // And a click on the divider — the Grid's west side — is not a tile.
  assert.equal(tileAtCell(clicked.layout, before.state.camera, clicked.layout.dividerColumn, row), null)
})

test("a light side on the shared divider is the divider drawn soft; the map's edge there is the map's edge style", () => {
  const grid = starterContext().grid
  const middle = screen(contextFor(grid), "ascii", { x: 48, y: 20 })
  const row = middle.layout.origin.row + 4
  assert.equal(cellAt(middle.frame, middle.layout.dividerColumn, row).glyph, chromeGlyph("ascii", "softVertical"))
  assert.equal(cellAt(middle.frame, middle.layout.dividerColumn, row).style.dim, true)
  const west = screen(contextFor(grid, "half"), "unicode", { x: 0, y: 20 })
  assert.equal(cellAt(west.frame, west.layout.dividerColumn, row).glyph, "▐", "a half block on the map's side of the divider")
  assert.equal(cellAt(west.frame, west.layout.dividerColumn, row).style.fgRole, "chrome.edge")
  // Below a short map's rows the divider runs on beside the menu as the menu's own plain line.
  const short = screen(contextFor(wholeMap(20, 10), "half"), "unicode")
  assert.ok(short.layout.gridBox.bottom < short.layout.paneBottom, "the map is shorter than the pane")
  const beside = cellAt(short.frame, short.layout.dividerColumn, short.layout.gridBox.bottom + 1)
  assert.equal(beside.glyph, "│")
  assert.equal(beside.style.fgRole, "chrome.frame")
  assert.notEqual(beside.style.dim, true)
})
