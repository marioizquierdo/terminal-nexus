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
import type { ContentRegistry } from "../content/index.ts"
import type { Coord } from "../grid/types.ts"
import { TERRAIN } from "../grid/types.ts"
import { SCROLL_MARGIN, edgeMarkers, visibleRange } from "../build/camera.ts"
import type { BuildLayout } from "../build/layout.ts"
import { RESOURCE_ROW, cellForTile, constructLines } from "../build/layout.ts"
import type { BuildContext, BuildState } from "../build/state.ts"
import { anchorForCursor, legalityAt, remaining } from "../build/state.ts"
import type { ConstructGroup } from "../build/types.ts"
import type { BandCell, ReadonlyCellFrame } from "./frame.ts"
import { BANDS, composeBands } from "./frame.ts"
import { put, text } from "./draw.ts"
import type { CapabilityMode, StyleRole } from "./roles.ts"
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

  // Drawn in the frame's own colour rather than the hotkey colour they used in gate 5A. A marker is
  // part of the border, and `chrome.hotkey` is the role that means "this is a key you can press" —
  // an edge marker wearing it competes with the construct menu's own `[1]` for the same meaning,
  // which is the opposite of what it is for. Bold keeps it distinct from the plain border glyph, and
  // the shape carries it in monochrome either way. Where these markers *sit*, and how dense they
  // are, is gate 5C's to tune along with the rest of the scrolling furniture.
  const marker = { bold: true }
  for (let x = firstColumn; x <= lastColumn; x += EDGE_MARKER_STEP.horizontal) {
    if (markers.north) put(cells, band, x, top, EDGE_GLYPHS.north, "chrome.frame", marker)
    if (markers.south) put(cells, band, x, bottom, EDGE_GLYPHS.south, "chrome.frame", marker)
  }
  const lastRow = layout.origin.row + layout.viewport.height
  for (let y = layout.origin.row; y < lastRow; y += EDGE_MARKER_STEP.vertical) {
    if (markers.west) put(cells, band, layout.offset.column, y, EDGE_GLYPHS.west, "chrome.frame", marker)
    if (markers.east) put(cells, band, layout.dividerColumn, y, EDGE_GLYPHS.east, "chrome.frame", marker)
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
  const extra = ["home end jump sideways", "bksp remove", "u undo"]
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

  // The header is one line, and the other two rows of its budget are deliberately blank. Gate 5A's
  // header carried a gate number, a line of viewport diagnostics and a promise that nothing reached
  // the simulation — true, and none of it anything a player needs while choosing where to build.
  // Mario, accepting that gate: "still has too much text focused on demo instead of trying to be as
  // simple and direct as possible." The diagnostics still genuinely wanted — the scroll margin he
  // has not finished judging — moved to the footer row that was already diagnostics.
  text(cells, band, left, headerRow, "TERMINAL NEXUS", "chrome.title", { bold: true, limit })
  text(cells, band, left + 15, headerRow, "build phase", "chrome.muted", {
    dim: true,
    limit: limit - 16,
  })

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
      `of ${context.grid.width}x${context.grid.height}   cursor ${state.cursor.x},${state.cursor.y}` +
      `   margin ${context.scrollMargin ?? SCROLL_MARGIN}`,
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

/** Right-aligned against the panel's own right edge — a column of costs reads as a column only if
 *  the numbers line up, and they do not line up if each one starts after a different-length name. */
function rightAlign(
  cells: BandCell[],
  layout: BuildLayout,
  row: number,
  value: string,
  role: StyleRole,
  extra: Readonly<{ dim?: boolean; bold?: boolean }> = {},
): void {
  const column = layout.panelColumn + layout.panelLimit - value.length
  text(cells, BANDS.chrome, column, row, value, role, extra)
}

const GROUP_LABELS: Readonly<Record<ConstructGroup, string>> = {
  common: "COMMON",
  army: "ARMY",
}

/**
 * The side panel — engine.md 9.2's Build Phase list, at the scope Q30 recommends: the construct
 * menu, the selected item's cost and effect, and the panel that says *why* a placement was refused.
 * No radius preview, because nothing this gate places has a radius worth previewing.
 *
 * **It says less than gate 5A's did, on purpose.** Mario, accepting that gate: "still has too much
 * text focused on demo instead of trying to be as simple and direct as possible." The subtitle
 * naming the spike is gone, and so is the running commentary. What is left follows one rule — every
 * line is something a player needs while deciding where to build — and most of the panel is blank
 * until they are actually doing something, because a panel that is always full is a panel nobody
 * reads.
 */
/** The two revision bindings, pinned to the panel's last line. They live here because the footer's
 *  one control row cannot hold them at 80 columns, and a binding displayed nowhere does not exist
 *  (engine.md 9.7). Pinned rather than appended so they do not move as the panel above them grows
 *  and shrinks with what the player is doing. */
function drawPanelBindings(cells: BandCell[], layout: BuildLayout): void {
  text(
    cells,
    BANDS.chrome,
    layout.panelColumn,
    layout.panelBindingsRow,
    "[u] undo  [bksp] remove",
    "chrome.muted",
    { dim: true, limit: layout.panelLimit },
  )
}

function drawPanel(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const left = remaining(context, state)

  // What there is to spend, on the panel's first line, because it is the number every choice below
  // it is measured against.
  text(cells, band, column, layout.panelRow + RESOURCE_ROW, "RESOURCE", "chrome.label", { limit })
  rightAlign(
    cells,
    layout,
    layout.panelRow + RESOURCE_ROW,
    `${left} of ${context.allotment}`,
    "chrome.title",
    { bold: true },
  )

  for (const line of constructLines(layout, context.catalog)) {
    if (line.kind === "group") {
      text(cells, band, column, line.row, GROUP_LABELS[line.group], "chrome.label", { limit })
      continue
    }
    if (line.kind === "empty") {
      // Honest about the empty group rather than hiding it — PERIMETER offers nothing
      // army-specific, and that is an answer, not a gap.
      text(cells, band, column, line.row, "none for this Commander", "chrome.muted", {
        dim: true,
        limit,
      })
      continue
    }
    const item = context.catalog[line.index]
    if (item === undefined) continue
    const selected = line.index === state.armed
    // A row costing more than is left is dimmed. Dim is an attribute, not a colour, so it survives
    // monochrome — and the reason is spelled out in full the moment the player tries it anyway.
    const affordable = item.cost <= left
    const label = `[${item.hotkey}] ${item.label}`
    if (selected) {
      text(cells, band, column, line.row, label, "chrome.title", { bold: true, inverse: true, limit })
    } else {
      text(cells, band, column, line.row, `[${item.hotkey}]`, "chrome.hotkey", {
        bold: true,
        dim: !affordable,
        limit,
      })
      text(cells, band, column + 3, line.row, ` ${item.label}`, "chrome.value", {
        dim: !affordable,
        limit,
      })
    }
    rightAlign(cells, layout, line.row, String(item.cost), "chrome.value", {
      dim: !affordable,
      bold: selected,
    })
  }

  // Everything below here appears only while something is selected. Nothing to build, nothing to
  // read.
  const item = state.armed === null ? null : context.catalog[state.armed]
  if (item === undefined || item === null) return

  const lines = constructLines(layout, context.catalog)
  const lastLine = lines[lines.length - 1]
  let row = (lastLine?.row ?? layout.panelRow) + 2

  text(cells, band, column, row, item.effect, "chrome.value", { limit })
  row += 2

  const anchor = anchorForCursor(state.cursor, context.registry.get(item.contentId).footprint)
  const legality = legalityAt(context, state.planned, item.contentId, anchor, left)
  if (!legality.ok) {
    // The panel that says *why* — gate 5B's own reason to exist. A footer line would do for one
    // message, but it is gone the moment anything else happens, and "why can I not build here" is
    // a question the player asks while looking at the Grid, not while reading a status line.
    text(cells, band, column, row, "CANNOT BUILD HERE", "notice.gate", { bold: true, limit })
    text(cells, band, column, row + 1, legality.reason, "chrome.value", { limit })
    if (legality.tile !== undefined) {
      text(
        cells,
        band,
        column,
        row + 2,
        `at ${legality.tile.x},${legality.tile.y}`,
        "chrome.muted",
        { dim: true, limit },
      )
    }
  }
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
  drawPanelBindings(cells, input.layout)

  return composeBands(input.layout.frame.width, input.layout.frame.height, cells)
}
