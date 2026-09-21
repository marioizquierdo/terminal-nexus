// The Build Phase spike's frame — engine.md 9.2's Build Phase composition, built for the first
// time. Same band compositor, same style roles, same glyph packs as the Pulse view and the menu, so
// monochrome, the colour tiers and the optional pack come free rather than needing a third
// accessibility pass.
//
// What is new here, and what gate 5A is actually about: the Grid pane shows a **window onto a Grid
// larger than itself**. Every tile is drawn at `tile - camera`, clipped to the viewport, and the two
// signals engine.md 3.3 requires in place of a minimap — edge markers on the frame border, and a
// position readout naming the visible range — are drawn from the same camera the cursor moved.

import { tilesOf } from "../grid/coords.ts"
import { menuItemLabel, menuItemRow } from "../menu/layout.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { Coord } from "../grid/types.ts"
import { TERRAIN } from "../grid/types.ts"
import { SCROLL_MARGIN, edgeMarkers, visibleRange } from "../build/camera.ts"
import type { BuildLayout } from "../build/layout.ts"
import { cellForTile } from "../build/layout.ts"
import { menuItemsFor } from "../build/catalog.ts"
import type { BuildContext, BuildState } from "../build/state.ts"
import { anchorForCursor, legalityAt, shortName } from "../build/state.ts"
import type { BandCell, ReadonlyCellFrame } from "./frame.ts"
import { BANDS, composeBands } from "./frame.ts"
import { put, text } from "./draw.ts"
import type { CapabilityMode } from "./roles.ts"
import { chromeGlyph, entityGlyph, playerRole, terrainGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"

/**
 * The edge markers. Plain ASCII arrows rather than pack glyphs: they carry "there is more Grid this
 * way" and nothing else does, so under engine.md 9.6 they must survive monochrome and the ASCII
 * baseline unchanged. Drawn every `EDGE_MARKER_STEP` cells along the border segment beside the Grid
 * pane, so they read as an edge rather than as a stray character.
 */
const EDGE_GLYPHS = { north: "^", south: "v", west: "<", east: ">" } as const
/**
 * How often a marker repeats along its border. The vertical sides are denser than the horizontal
 * ones for a reason the first real screenshot made obvious: the east markers sit on the rule between
 * the Grid and the side panel, and a *single* `>` there sits right beside the first construct row
 * and reads as a caret pointing at it. A run of them down the whole rule cannot be read as pointing
 * at anything — it reads as an edge, which is what it is.
 */
const EDGE_MARKER_STEP = { horizontal: 6, vertical: 2 } as const

/** A structure the player is about to place, and whether they may. Drawn in the highlights band, so
 *  it is presentation and can never change occupancy (engine.md 9.4). */
const ILLEGAL_PREVIEW_GLYPH = "x"

export type BuildCompositionInput = Readonly<{
  context: BuildContext
  state: BuildState
  layout: BuildLayout
  glyphPack?: GlyphPack
}>

function drawChrome(cells: BandCell[], layout: BuildLayout, pack: GlyphPack): void {
  const band = BANDS.chrome
  const horizontal = chromeGlyph(pack, "horizontal")
  const vertical = chromeGlyph(pack, "vertical")
  const left = layout.offset.column
  const right = layout.offset.column + layout.composition.width - 1
  const top = layout.offset.row
  const bottom = layout.offset.row + layout.composition.height - 1

  for (let x = left; x <= right; x += 1) {
    put(cells, band, x, top, horizontal, "chrome.frame")
    put(cells, band, x, bottom, horizontal, "chrome.frame")
  }
  for (let y = top + 1; y < bottom; y += 1) {
    put(cells, band, left, y, vertical, "chrome.frame")
    put(cells, band, right, y, vertical, "chrome.frame")
    // The Grid/panel divider stops above the footer. The footer's three rows then run the whole
    // interior width, which is the only way the position readout, the live bindings and the status
    // line all fit at 80 columns — where the Grid pane alone is 46 usable columns, and every one of
    // those three lines is longer than that. A reversible layout choice, made here rather than
    // registered as a question (project-governance.md Section 2), and recorded in the gate report.
    if (y < layout.footerRow) put(cells, band, layout.dividerColumn, y, vertical, "chrome.frame")
  }
  for (const [x, y] of [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
  ] as const) {
    const part =
      y === top ? (x === left ? "topLeft" : "topRight") : x === left ? "bottomLeft" : "bottomRight"
    put(cells, band, x, y, chromeGlyph(pack, part), "chrome.frame")
  }
}

/** engine.md 3.3: "The UI must show that there is more Grid... edge markers on the frame border for
 *  each side with more Grid beyond it" — required, because there is no minimap. */
function drawEdgeMarkers(cells: BandCell[], input: BuildCompositionInput): void {
  const { layout, state, context } = input
  const markers = edgeMarkers(state.camera, state.viewport, context.grid)
  const band = BANDS.chrome
  const firstColumn = layout.origin.column
  const lastColumn = layout.dividerColumn - 1
  const top = layout.offset.row
  const bottom = layout.offset.row + layout.composition.height - 1

  for (let x = firstColumn; x <= lastColumn; x += EDGE_MARKER_STEP.horizontal) {
    if (markers.north) put(cells, band, x, top, EDGE_GLYPHS.north, "chrome.hotkey", { bold: true })
    if (markers.south) put(cells, band, x, bottom, EDGE_GLYPHS.south, "chrome.hotkey", { bold: true })
  }
  const lastRow = layout.origin.row + layout.viewport.height
  for (let y = layout.origin.row; y < lastRow; y += EDGE_MARKER_STEP.vertical) {
    if (markers.west) {
      put(cells, band, layout.offset.column, y, EDGE_GLYPHS.west, "chrome.hotkey", { bold: true })
    }
    if (markers.east) {
      put(cells, band, layout.dividerColumn, y, EDGE_GLYPHS.east, "chrome.hotkey", { bold: true })
    }
  }
}

/** Everything that is actually on the Grid, drawn through the camera and clipped to the viewport. */
function drawGrid(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const { context, state, layout } = input
  const range = visibleRange(state.camera, state.viewport)

  for (let y = range.firstY; y <= range.lastY; y += 1) {
    for (let x = range.firstX; x <= range.lastX; x += 1) {
      const terrainId = context.grid.tiles[y * context.grid.width + x]
      if (terrainId === undefined) continue
      const { glyph, role } = terrainGlyph(terrainId, pack)
      const cell = cellForTile(layout, state.camera, { x, y })
      // The same lattice the Pulse view draws featureless ground with: 288 identical dots compete
      // with everything on top of them, and negative space is material. Rock and deposits are
      // features and are always drawn. The lattice is keyed to absolute tile coordinates, not to
      // screen position, so it scrolls *with* the Grid instead of crawling across it.
      const featureless = terrainId === "terrain.plain"
      const onLattice = x % 4 === 0 && y % 2 === 0
      put(cells, BANDS.terrain, cell.x, cell.y, featureless && !onLattice ? " " : glyph, role, {
        dim: true,
      })
      for (let extra = 1; extra < layout.tileWidth; extra += 1) {
        put(cells, BANDS.terrain, cell.x + extra, cell.y, " ", role)
      }
    }
  }

  const drawStructure = (contentId: string, anchor: Coord, planned: boolean): void => {
    const definition = context.registry.get(contentId)
    for (const offset of definition.footprint) {
      const tile = { x: anchor.x + offset.x, y: anchor.y + offset.y }
      if (tile.x < range.firstX || tile.x > range.lastX) continue
      if (tile.y < range.firstY || tile.y > range.lastY) continue
      const cell = cellForTile(layout, state.camera, tile)
      const glyph = entityGlyph(contentId, "A", { x: offset.x, y: offset.y })
      // A planned structure is dimmed rather than recoloured: dim survives monochrome, and a plan
      // that looks exactly like a built structure is how a player commits one they did not mean to.
      put(cells, BANDS.structures, cell.x, cell.y, glyph, playerRole("A"), {
        bold: !planned,
        dim: planned,
      })
      for (let extra = 1; extra < layout.tileWidth; extra += 1) {
        put(cells, BANDS.structures, cell.x + extra, cell.y, " ", playerRole("A"))
      }
    }
  }

  for (const structure of context.standing) drawStructure(structure.contentId, structure.anchor, false)
  for (const placement of state.planned) drawStructure(placement.contentId, placement.anchor, true)
}

/** The armed structure's footprint under the cursor, and whether it would be refused there. Shape
 *  carries the answer, not colour: a legal preview is the structure's own glyphs, an illegal one is
 *  a block of `x`. Both read identically in monochrome, which is the point. */
function drawPreview(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  if (state.armed === null) return
  const item = context.catalog[state.armed]
  if (item === undefined) return
  const definition = context.registry.get(item.contentId)
  const anchor = anchorForCursor(state.cursor, definition.footprint)
  const legal = legalityAt(context, state.planned, item.contentId, anchor).ok
  const range = visibleRange(state.camera, state.viewport)

  for (const offset of definition.footprint) {
    const tile = { x: anchor.x + offset.x, y: anchor.y + offset.y }
    if (tile.x < range.firstX || tile.x > range.lastX) continue
    if (tile.y < range.firstY || tile.y > range.lastY) continue
    const cell = cellForTile(layout, state.camera, tile)
    const glyph = legal
      ? entityGlyph(item.contentId, "A", { x: offset.x, y: offset.y })
      : ILLEGAL_PREVIEW_GLYPH
    put(cells, BANDS.highlights, cell.x, cell.y, glyph, legal ? "chrome.hotkey" : "notice.gate", {
      bold: !legal,
    })
  }
}

/** One cursor, drawn as a style-only write so it keeps whatever glyph is beneath it — the mechanism
 *  `src/view/frame.ts` already provides, and the only honest way to mark a tile without deleting
 *  what is standing on it. Inverse video carries "here" at every capability tier. */
function drawCursor(cells: BandCell[], input: BuildCompositionInput): void {
  const { state, layout } = input
  const range = visibleRange(state.camera, state.viewport)
  if (state.cursor.x < range.firstX || state.cursor.x > range.lastX) return
  if (state.cursor.y < range.firstY || state.cursor.y > range.lastY) return
  const cell = cellForTile(layout, state.camera, state.cursor)
  for (let extra = 0; extra < layout.tileWidth; extra += 1) {
    cells.push({
      band: BANDS.highlights,
      x: cell.x + extra,
      y: cell.y,
      style: { inverse: true },
    })
  }
}

/**
 * The live bindings, as many as the width honestly holds. The first five are the ones a player
 * cannot work the screen without; the rest are also on the panel, so dropping them here loses
 * nothing.
 */
function controlsLine(limit: number): string {
  const essential = [
    "arrows move",
    "shift+arrow / pgup pgdn jump 5",
    "enter place",
    "esc disarm",
    "q quit",
  ]
  const extra = ["home end jump sideways", "bksp remove", "u undo", "t click mode"]
  let line = essential.join("  ")
  for (const binding of extra) {
    const grown = `${line}  ${binding}`
    if (grown.length > limit) break
    line = grown
  }
  return line
}

function drawHeaderAndFooter(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const limit = layout.paneLimit
  const left = layout.offset.column + 2
  const headerRow = layout.offset.row + 1
  const range = visibleRange(state.camera, state.viewport)

  text(cells, band, left, headerRow, "TERMINAL NEXUS", "chrome.title", { bold: true, limit })
  text(cells, band, left + 15, headerRow, "build spike - gate 5A", "chrome.muted", {
    dim: true,
    limit: limit - 16,
  })
  text(
    cells,
    band,
    left,
    headerRow + 1,
    `Grid ${context.grid.width}x${context.grid.height}   ` +
      `view ${state.viewport.width}x${state.viewport.height}   ` +
      `${layout.tileWidth} col/tile   margin ${context.scrollMargin ?? SCROLL_MARGIN}`,
    "chrome.value",
    { limit },
  )
  text(
    cells,
    band,
    left,
    headerRow + 2,
    "Nothing here reaches the simulation.",
    "chrome.muted",
    { dim: true, limit },
  )

  // The footer runs the whole interior width, under both panes — see `drawChrome`.
  const footerLimit = layout.offset.column + layout.composition.width - 2 - left

  // engine.md 3.3's second required signal: "a position readout in the footer naming the visible
  // tile range and the Grid size."
  text(
    cells,
    band,
    left,
    layout.footerRow,
    `view x ${range.firstX}-${range.lastX} y ${range.firstY}-${range.lastY} ` +
      `of ${context.grid.width}x${context.grid.height}   cursor ${state.cursor.x},${state.cursor.y}`,
    "chrome.label",
    { limit: footerLimit },
  )
  // The screen documents itself — engine.md 9.7's second convention. Both jump bindings are listed
  // first, because the terminal survey found emulators that deliver only one of them, and a fast pan
  // nobody can find is the same as no fast pan. The rest are appended only while they fit: at 80
  // columns the line is full after `q quit`, and what falls off is shown in the panel instead rather
  // than silently truncated mid-word.
  text(cells, band, left, layout.footerRow + 1, controlsLine(footerLimit), "chrome.muted", {
    dim: true,
    limit: footerLimit,
  })
  text(cells, band, left, layout.footerRow + 2, state.message, "chrome.value", {
    limit: footerLimit,
  })
}

function drawPanel(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const top = layout.offset.row + 1

  text(cells, band, column, top, "BUILD PHASE", "chrome.title", { bold: true, limit })
  text(cells, band, column, top + 1, "scrolling + placement spike", "chrome.muted", {
    dim: true,
    limit,
  })

  text(cells, band, column, layout.construct.row - 1, "CONSTRUCT", "chrome.label", { limit })
  const items = menuItemsFor(context.catalog)
  items.forEach((item, index) => {
    const row = menuItemRow(layout.construct, index)
    const label = menuItemLabel(item)
    if (index === state.armed) {
      // Inverse video is what "armed" looks like, the same way it is what "selected" looks like on
      // every other list in the game — one visual vocabulary, and it survives monochrome.
      text(cells, band, layout.construct.column, row, label, "chrome.title", {
        bold: true,
        inverse: true,
        limit,
      })
      return
    }
    text(cells, band, layout.construct.column, row, `[${item.hotkey}]`, "chrome.hotkey", {
      bold: true,
      limit,
    })
    text(cells, band, layout.construct.column + 3, row, ` ${item.label}`, "chrome.value", { limit })
  })

  let row = menuItemRow(layout.construct, items.length) + 1
  const block = (label: string, lines: readonly (readonly [string, "chrome.value" | "chrome.muted"])[]): void => {
    text(cells, band, column, row, label, "chrome.label", { limit })
    lines.forEach(([value, role], index) => {
      text(cells, band, column, row + 1 + index, value, role, { limit })
    })
    row += lines.length + 2
  }

  const armedItem = state.armed === null ? null : context.catalog[state.armed]
  block("ARMED", [
    armedItem === undefined || armedItem === null
      ? ["nothing - press 1, 2 or 3", "chrome.muted"]
      : [shortName(context, armedItem.contentId), "chrome.value"],
  ])
  block("CLICK MODE  [t]", [
    [state.clickMode === "place" ? "click places it" : "click, then click again", "chrome.value"],
  ])
  block("PLANNED", [
    state.planned.length === 0
      ? ["nothing planned yet", "chrome.muted"]
      : [`${state.planned.length} structure${state.planned.length === 1 ? "" : "s"}`, "chrome.value"],
    // The two revision bindings live here because the footer's one control line cannot hold them at
    // 80 columns — and a binding that is displayed nowhere does not exist (engine.md 9.7).
    ["[u] undo   [bksp] remove", "chrome.muted"],
  ])

  // The tile under the cursor, named. Cheap, and the fastest way to tell whether the thing refusing
  // a placement is the rock you can see or the plan you forgot about.
  const terrainId = context.grid.tiles[state.cursor.y * context.grid.width + state.cursor.x]
  const terrainName = terrainId === undefined ? "off Grid" : terrainId.replace("terrain.", "")
  block("UNDER CURSOR", [
    [
      `${terrainName}${terrainId !== undefined && TERRAIN[terrainId].impassable ? " (blocked)" : ""}`,
      "chrome.value",
    ],
  ])
}

export function composeBuildFrame(
  input: BuildCompositionInput,
  capability: CapabilityMode,
): ReadonlyCellFrame {
  void capability
  const pack: GlyphPack = input.glyphPack ?? "ascii"
  const cells: BandCell[] = []

  drawGrid(cells, input, pack)
  drawPreview(cells, input)
  drawCursor(cells, input)
  drawChrome(cells, input.layout, pack)
  drawEdgeMarkers(cells, input)
  drawHeaderAndFooter(cells, input)
  drawPanel(cells, input)

  return composeBands(input.layout.frame.width, input.layout.frame.height, cells)
}
