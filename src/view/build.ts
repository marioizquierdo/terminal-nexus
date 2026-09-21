// The Build Phase frame — engine.md 9.2's composition, on the same band compositor, style roles and
// glyph packs as the Pulse view and the menu, so monochrome and the colour tiers come free.
//
// The Grid pane is a **window onto a Grid larger than itself**: every tile is drawn at
// `tile - camera` and clipped to the viewport, and the two signals engine.md 3.3 requires in place
// of a minimap — edge markers on the frame border, a position readout naming the visible range —
// come from the same camera the cursor moved.

import { tilesOf } from "../grid/coords.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { Coord } from "../grid/types.ts"
import { TERRAIN } from "../grid/types.ts"
import { SCROLL_MARGIN, edgeMarkers, visibleRange } from "../build/camera.ts"
import type { BuildLayout } from "../build/layout.ts"
import { RESOURCE_ROW, cellForTile, constructLines } from "../build/layout.ts"
import type { BuildContext, BuildState } from "../build/state.ts"
import { anchorForCursor, legalityAt, remaining } from "../build/state.ts"
import type { ConstructGroup, ConstructItem } from "../build/types.ts"
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
 * How often a marker repeats along its border. Horizontally it is **counted in tiles**, so the
 * spacing does not halve when a tile becomes two columns wide, and the dashes between them keep the
 * border reading as one line.
 *
 * Vertically there is no gap at all. The east border is the rule between the Grid and the side
 * panel, and a broken column of arrows beside panel rows reads as a caret pointing at the row it
 * happens to sit next to — `> [1] Barracks` looks selected. An unbroken run cannot point at any one
 * row, because it points at all of them.
 */
const EDGE_MARKER_STEP = { horizontal: 4, vertical: 1 } as const

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
    // The divider stops above the footer, so the footer's three rows run the whole interior width.
    // At 80 columns the Grid pane is 46 usable columns and all three lines are longer than that.
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

  // The frame's own colour and weight. A marker replaces a piece of border, so it should read as a
  // border made of arrows — `chrome.hotkey` means "a key you can press", and bold made the run beside
  // the panel shout over the menu it sits next to.
  const marker = {}
  const step = EDGE_MARKER_STEP.horizontal * layout.tileWidth
  for (let x = firstColumn; x <= lastColumn; x += step) {
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
      // The same lattice the Pulse view draws featureless ground with — a full field of dots
      // competes with everything on top of it. Rock and deposits are features and always drawn. The
      // lattice is keyed to absolute tile coordinates, so it scrolls with the Grid rather than
      // crawling across it.
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
  // The same call `place()` makes, budget and all, so the ghost answers exactly the question Enter
  // answers.
  const legal = legalityAt(
    context,
    state.planned,
    item.contentId,
    anchor,
    remaining(context, state),
  ).ok
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

/** Every binding live on this screen, most important first. One list, because the footer and the
 *  panel share it — see `bindingLines`. */
const BINDINGS = [
  "arrows move",
  "enter place",
  "esc disarm",
  "q quit",
  "shift+arrow jump 5",
  "pgup pgdn jump 5",
  "home end jump 5",
  "bksp remove",
  "u undo",
] as const

/** Two glyphs between bindings, so a pair of them cannot read as one. */
const BINDING_GAP = "  "

function packed(bindings: readonly string[], limit: number): { line: string; rest: string[] } {
  let line = ""
  for (let index = 0; index < bindings.length; index += 1) {
    const binding = bindings[index] as string
    const grown = line === "" ? binding : line + BINDING_GAP + binding
    if (grown.length > limit) return { line, rest: [...bindings.slice(index)] }
    line = grown
  }
  return { line, rest: [] }
}

/**
 * How the bindings divide between the footer's one row and the side panel's last few — the screen's
 * adaptation to its own width. The footer takes them in order while they fit; whatever is left over
 * packs into panel-width rows. A wide terminal fits them all in the footer and the panel rows come
 * back as blank space. **Only whole bindings, anywhere**: a key cut in half is a key nobody can
 * press, and the jump keys that fall off first are exactly the ones the terminal survey found some
 * emulators deliver only one of.
 */
export function bindingLines(
  footerLimit: number,
  panelLimit: number,
): Readonly<{ footer: string; panel: readonly string[] }> {
  const { line: footer, rest } = packed(BINDINGS, footerLimit)
  const panel: string[] = []
  let remaining = rest
  while (remaining.length > 0) {
    const { line, rest: next } = packed(remaining, panelLimit)
    // A binding longer than the panel is wide would otherwise loop forever producing empty rows.
    if (line === "") break
    panel.push(line)
    remaining = next
  }
  return { footer, panel }
}

function drawHeaderAndFooter(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const limit = layout.paneLimit
  const left = layout.offset.column + 2
  const headerRow = layout.offset.row + 1
  const range = visibleRange(state.camera, state.viewport)

  // The header is one line; the other two rows of its budget stay blank. Nothing goes here that a
  // player does not need while choosing where to build.
  text(cells, band, left, headerRow, "TERMINAL NEXUS", "chrome.title", { bold: true, limit })
  text(cells, band, left + 15, headerRow, "build phase", "chrome.muted", {
    dim: true,
    limit: limit - 16,
  })

  // The footer runs the whole interior width, under both panes — see `drawChrome`.
  const footerLimit = layout.footerLimit

  // engine.md 3.3's second required signal: "a position readout in the footer naming the visible
  // tile range and the Grid size." The margin joins it only when `--scroll-margin` overrode the
  // canon's three, so the default screen carries no number nobody needs.
  const margin = context.scrollMargin ?? SCROLL_MARGIN
  text(
    cells,
    band,
    left,
    layout.footerRow,
    `view x ${range.firstX}-${range.lastX} y ${range.firstY}-${range.lastY} ` +
      `of ${context.grid.width}x${context.grid.height}   cursor ${state.cursor.x},${state.cursor.y}` +
      (margin === SCROLL_MARGIN ? "" : `   margin ${margin}`),
    "chrome.label",
    { limit: footerLimit },
  )
  // The screen documents itself (engine.md 9.7). What does not fit here is drawn in the panel.
  text(
    cells,
    band,
    left,
    layout.footerRow + 1,
    bindingLines(footerLimit, layout.panelLimit).footer,
    "chrome.muted",
    { dim: true, limit: footerLimit },
  )
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
 * The side panel — engine.md 9.2's Build Phase list: the construct menu, what is left to spend, the
 * selected item's cost and effect, and why a placement was refused. No radius preview, because
 * nothing placed here has a radius.
 *
 * One rule decides what goes on it: every line is something a player needs while deciding where to
 * build. Most of it is blank until they are doing something — a panel that is always full is a
 * panel nobody reads.
 */
/**
 * The bindings the footer had no room for, pinned to the bottom of the panel and growing upward. A
 * wide enough terminal fits them all in the footer and this is empty.
 *
 * Bounded by the construct menu, which wins: the panel is as tall as the viewport and the viewport
 * shrinks to fit a small Grid, so the block can reach the menu. A hidden menu row is still a live
 * click target — worse than a binding the player has to find elsewhere — so the lowest-priority
 * lines are dropped instead.
 */
function panelBindings(
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
): readonly string[] {
  const lines = bindingLines(layout.footerLimit, layout.panelLimit).panel
  const menu = constructLines(layout, catalog)
  const floor = (menu[menu.length - 1]?.row ?? layout.panelRow) + 2
  return lines.slice(0, Math.max(0, Math.min(lines.length, layout.panelBindingsRow - floor + 1)))
}

function drawPanelBindings(cells: BandCell[], input: BuildCompositionInput): void {
  const { layout } = input
  const lines = panelBindings(layout, input.context.catalog)
  lines.forEach((line, index) => {
    const row = layout.panelBindingsRow - (lines.length - 1 - index)
    text(cells, BANDS.chrome, layout.panelColumn, row, line, "chrome.muted", {
      dim: true,
      limit: layout.panelLimit,
    })
  })
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
  const anchor = anchorForCursor(state.cursor, context.registry.get(item.contentId).footprint)
  const legality = legalityAt(context, state.planned, item.contentId, anchor, left)

  // Written as a list and then laid out, so the whole block can be dropped in one piece when the
  // panel is too short for it. The panel's height is the viewport's, and the viewport shrinks to fit
  // a small Grid, so a block that keeps writing downward would reach the bindings and then the
  // footer. Omitting a line beats drawing over one.
  const detail: readonly (readonly [string, StyleRole, Readonly<{ bold?: boolean; dim?: boolean }>])[] =
    [
      [item.effect, "chrome.value", {}],
      ...(legality.ok
        ? []
        : ([
            ["", "chrome.value", {}],
            // In the panel, not the status line: a footer message is gone the moment anything else
            // happens, and "why can I not build here" is asked while looking at the Grid.
            ["CANNOT BUILD HERE", "notice.gate", { bold: true }],
            [legality.reason, "chrome.value", {}],
            ...(legality.tile === undefined
              ? []
              : ([[`at ${legality.tile.x},${legality.tile.y}`, "chrome.muted", { dim: true }]] as const)),
          ] as const)),
    ]

  const first = (lastLine?.row ?? layout.panelRow) + 2
  // One row of clearance above the bindings block, so the two never touch. The block's height is
  // the terminal's to decide, so this is read rather than assumed.
  const bindingRows = panelBindings(layout, context.catalog).length
  const available = layout.panelBindingsRow - bindingRows - first
  if (available < detail.length) return
  detail.forEach(([value, role, extra], index) => {
    if (value === "") return
    text(cells, band, column, first + index, value, role, { ...extra, limit })
  })
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
  drawPanelBindings(cells, input)

  return composeBands(input.layout.frame.width, input.layout.frame.height, cells)
}
