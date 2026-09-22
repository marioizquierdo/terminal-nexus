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
import type { ConstructGroup, ConstructItem, PlannedPlacement } from "../build/types.ts"
import type { BandCell, ReadonlyCellFrame } from "./frame.ts"
import { BANDS, composeBands } from "./frame.ts"
import { put, text } from "./draw.ts"
import type { CapabilityMode, StyleRole } from "./roles.ts"
import { chromeGlyph, entityGlyph, playerRole, terrainGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"

/** A structure the player is about to place, and whether they may. Drawn in the highlights band, so
 *  it is presentation and can never change occupancy (engine.md 9.4). */
const ILLEGAL_PREVIEW_GLYPH = "x"

export type BuildCompositionInput = Readonly<{
  context: BuildContext
  state: BuildState
  layout: BuildLayout
  glyphPack?: GlyphPack
}>

/**
 * The frame border, and engine.md 3.3's required "there is more Grid" signal drawn as part of it
 * rather than overlaid on it: solid where a side genuinely ends, a dim dashed run where it does not.
 * Only the border segment actually beside the Grid pane carries this — the header, the footer, and
 * the side panel's own border never scroll, so they stay solid regardless.
 */
function drawChrome(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const { layout, state, context } = input
  const band = BANDS.chrome
  const hardH = chromeGlyph(pack, "horizontal")
  const hardV = chromeGlyph(pack, "vertical")
  const softH = chromeGlyph(pack, "softHorizontal")
  const softV = chromeGlyph(pack, "softVertical")
  const left = layout.offset.column
  const right = layout.offset.column + layout.composition.width - 1
  const top = layout.offset.row
  const bottom = layout.offset.row + layout.composition.height - 1
  const markers = edgeMarkers(state.camera, state.viewport, context.grid)
  const gridLeft = layout.origin.column
  const gridRight = layout.dividerColumn - 1
  const gridTop = layout.origin.row
  const gridBottom = layout.origin.row + layout.viewport.height - 1

  for (let x = left; x <= right; x += 1) {
    const overGrid = x >= gridLeft && x <= gridRight
    const north = overGrid && markers.north
    const south = overGrid && markers.south
    put(cells, band, x, top, north ? softH : hardH, "chrome.frame", { dim: north })
    put(cells, band, x, bottom, south ? softH : hardH, "chrome.frame", { dim: south })
  }
  for (let y = top + 1; y < bottom; y += 1) {
    const overGrid = y >= gridTop && y <= gridBottom
    const west = overGrid && markers.west
    const east = overGrid && markers.east
    put(cells, band, left, y, west ? softV : hardV, "chrome.frame", { dim: west })
    // The divider stops above the footer, so the footer's three rows run the whole interior width.
    // At 80 columns the Grid pane is 46 usable columns and all three lines are longer than that.
    if (y < layout.footerRow) put(cells, band, layout.dividerColumn, y, east ? softV : hardV, "chrome.frame", { dim: east })
  }
  // Corners sit outside the Grid pane's own column/row range, so they are always the plain corner
  // glyph — a run that goes soft only steps away from one never looks broken at the point itself.
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

/** Whether a structure — standing or still only planned — covers this tile. */
function structureAt(context: BuildContext, planned: readonly PlannedPlacement[], tile: Coord): boolean {
  const covers = (contentId: string, anchor: Coord): boolean =>
    tilesOf(anchor, context.registry.get(contentId).footprint).some((t) => t.x === tile.x && t.y === tile.y)
  return (
    context.standing.some((s) => covers(s.contentId, s.anchor)) ||
    planned.some((p) => covers(p.contentId, p.anchor))
  )
}

/** One cursor, drawn as a style-only write so it keeps whatever glyph is beneath it — the mechanism
 *  `src/view/frame.ts` already provides, and the only honest way to mark a tile without deleting
 *  what is standing on it. Inverse video carries "here" at every capability tier.
 *
 * Bare ground gets a contrast boost on top of that: it is drawn dim, and inverting a dim cell is
 * still a dim one, so `bold` and an explicit `dim: false` are added — `composeBands` merges a
 * style-only write onto whatever is beneath rather than replacing it, so without clearing it the
 * ground's own `dim: true` would survive underneath and fight the cursor's `bold` for intensity. A
 * structure does not get this: its own dim means something else — "this one is still only planned"
 * — and the cursor must not blur that distinction away.
 */
function drawCursor(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  const range = visibleRange(state.camera, state.viewport)
  if (state.cursor.x < range.firstX || state.cursor.x > range.lastX) return
  if (state.cursor.y < range.firstY || state.cursor.y > range.lastY) return
  const cell = cellForTile(layout, state.camera, state.cursor)
  const onStructure = structureAt(context, state.planned, state.cursor)
  // `chrome.title` rather than the ground's own role: bold survives monochrome but changes nothing
  // about which colour a terminal picks for it, so a coloured screen still needs an explicit,
  // reliably bright role to get the same lift monochrome gets from the attribute alone. The same
  // role and weight the armed construct row already uses, so "here" and "active" read as one idea.
  const style = onStructure
    ? { inverse: true }
    : { inverse: true, bold: true, dim: false, fgRole: "chrome.title" as const }
  for (let extra = 0; extra < layout.tileWidth; extra += 1) {
    cells.push({ band: BANDS.highlights, x: cell.x + extra, y: cell.y, style })
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
      // The inverse bar says "this row"; the arrow says "armed" specifically, in a symbol a player
      // can learn independent of any one render tier — and, now that the border no longer prints a
      // `>` on every row beside it, this is the only one on screen.
      text(cells, band, column, line.row, `> ${label}`, "chrome.title", { bold: true, inverse: true, limit })
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
    // Unaffordable always wins: `dim` and `bold` together cancel out on most terminals, so a row
    // that is both armed and no longer affordable used to read identically to a plain armed row.
    rightAlign(cells, layout, line.row, String(item.cost), "chrome.value", {
      dim: !affordable,
      bold: selected && affordable,
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
  drawChrome(cells, input, pack)
  drawHeaderAndFooter(cells, input)
  drawPanel(cells, input)
  drawPanelBindings(cells, input)

  return composeBands(input.layout.frame.width, input.layout.frame.height, cells)
}
