// The Build Phase frame — engine.md 9.2's composition, on the same band compositor, style roles and
// glyph packs as the Pulse view and the menu, so monochrome and the colour tiers come free.
//
// The Grid pane is a **window onto a Grid larger than itself**: every tile is drawn at
// `tile - camera` and clipped to the viewport, and the two signals engine.md 3.3 requires in place
// of a minimap — the weight of the lines around the Grid pane, a position readout naming the visible
// range — come from the same camera the cursor moved.

import { tilesOf } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import { SCROLL_MARGIN, edgeMarkers, visibleRange } from "../build/camera.ts"
import type { BuildLayout } from "../build/layout.ts"
import {
  CONFIRM_ITEMS,
  RESOURCE_ROW,
  cellForTile,
  confirmLayout,
  constructLines,
  nexusDraftLayout,
  summaryRows,
} from "../build/layout.ts"
import { menuItemRow } from "../menu/layout.ts"
import type { ArmedPreview, BuildContext, BuildState } from "../build/state.ts"
import { armedPreview, refusalText, remaining } from "../build/state.ts"
import type { ConstructGroup, ConstructItem, PlannedPlacement } from "../build/types.ts"
import type { BandCell, ReadonlyCellFrame } from "./frame.ts"
import { BANDS, composeBands } from "./frame.ts"
import { put, text } from "./draw.ts"
import type { CapabilityMode, StyleRole } from "./roles.ts"
import { chromeGlyph, entityGlyph, playerRole, terrainGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import { statusStyle } from "./status.ts"
import type { StatusMessage } from "../status.ts"
import { status } from "../status.ts"

/** A structure the player is about to place, and whether they may. Drawn in the highlights band, so
 *  it is presentation and can never change occupancy (engine.md 9.4). */
const ILLEGAL_PREVIEW_GLYPH = "x"

export type BuildCompositionInput = Readonly<{
  context: BuildContext
  state: BuildState
  layout: BuildLayout
  glyphPack?: GlyphPack
}>

/** Which of a frame cell's four neighbours a line continues into. */
type Joins = { n: boolean; s: boolean; e: boolean; w: boolean }

/** The glyph for a frame cell, from which way its lines run — a straight run, a corner, a tee, or a
 *  crossing. Every junction is derived rather than placed by hand, so moving a line (the side panel
 *  moving to the left is the next one, canon 2.19) moves its junctions with it. */
function lineGlyph(pack: GlyphPack, { n, s, e, w }: Joins): string {
  if (n && s && !e && !w) return chromeGlyph(pack, "vertical")
  if (e && w && !n && !s) return chromeGlyph(pack, "horizontal")
  if (n && s && e && w) return chromeGlyph(pack, "cross")
  if (n && s) return chromeGlyph(pack, e ? "teeRight" : "teeLeft")
  if (e && w) return chromeGlyph(pack, s ? "teeDown" : "teeUp")
  if (s) return chromeGlyph(pack, e ? "topLeft" : "topRight")
  return chromeGlyph(pack, e ? "bottomLeft" : "bottomRight")
}

/**
 * The frame: an outer border, a rule under the top bar and another over the bottom bar (both the
 * whole width), and the divider between the Grid pane and the side panel. Together they close the
 * Grid pane into **a rectangle of its own** — the owner's 2026-09-26 playtest could not tell where the
 * Grid ended, because two blank header rows sat between its top edge and the nearest line, and the
 * footer sat against its bottom edge with no line at all.
 *
 * engine.md 3.3's required "there is more Grid" signal is drawn as the weight of that rectangle's
 * four sides, not overlaid on them (canon 2.19, the owner's "'---' UI, and '===' for the map edge"): a
 * side with more Grid to scroll to is the frame's own line drawn dim, and a side that has actually
 * reached the Grid's own edge is drawn heavy — a wall, not merely a border. Heavy is a real glyph
 * where the pack has one (`=`, or the box-drawing heavy lines) plus `bold`; ASCII has no heavier
 * vertical bar, so its vertical heavy is `|` carried by `bold` alone (`open-questions.md` Q56).
 * Everything else — the outer border, the rules where they cross the side panel — never scrolls and
 * is drawn plain.
 */
function drawChrome(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const { layout, state, context } = input
  const box = layout.gridBox
  const left = layout.offset.column
  const right = layout.offset.column + layout.composition.width - 1
  const top = layout.offset.row
  const bottom = layout.offset.row + layout.composition.height - 1

  const lines = new Map<number, Joins & { x: number; y: number }>()
  const join = (x: number, y: number, side: keyof Joins): void => {
    const key = y * layout.frame.width + x
    const cell = lines.get(key) ?? { x, y, n: false, s: false, e: false, w: false }
    lines.set(key, { ...cell, [side]: true })
  }
  const horizontalLine = (y: number, from: number, to: number): void => {
    for (let x = from; x <= to; x += 1) {
      if (x > from) join(x, y, "w")
      if (x < to) join(x, y, "e")
    }
  }
  const verticalLine = (x: number, from: number, to: number): void => {
    for (let y = from; y <= to; y += 1) {
      if (y > from) join(x, y, "n")
      if (y < to) join(x, y, "s")
    }
  }
  horizontalLine(top, left, right)
  horizontalLine(bottom, left, right)
  verticalLine(left, top, bottom)
  verticalLine(right, top, bottom)
  horizontalLine(box.top, left, right)
  horizontalLine(box.bottom, left, right)
  // The divider stops at the rule over the bottom bar, so the bar's three lines run the whole width:
  // at 80 columns the Grid pane is 46 usable columns and all three are longer than that.
  verticalLine(layout.dividerColumn, top, box.bottom)

  const markers = edgeMarkers(state.camera, state.viewport, context.grid)
  // A Grid that fits the viewport whole never scrolls in any direction, so every side has reached its
  // edge at once — and the rectangle's four corners read heavy too, as one statement ("you are
  // seeing the whole map") rather than four sides that merely agree. When the sides differ, a plain
  // corner is still right (Q56).
  const wholeGridVisible = !markers.north && !markers.south && !markers.west && !markers.east
  const soft = { dim: true }
  const heavy = { bold: true }

  for (const cell of lines.values()) {
    const { x, y } = cell
    const alongTopOrBottom = (y === box.top || y === box.bottom) && x > box.left && x < box.right
    const alongLeftOrRight = (x === box.left || x === box.right) && y > box.top && y < box.bottom
    const gridCorner = (x === box.left || x === box.right) && (y === box.top || y === box.bottom)
    if (alongTopOrBottom) {
      const more = y === box.top ? markers.north : markers.south
      const glyph = chromeGlyph(pack, more ? "softHorizontal" : "heavyHorizontal")
      put(cells, BANDS.chrome, x, y, glyph, "chrome.frame", more ? soft : heavy)
    } else if (alongLeftOrRight) {
      const more = x === box.left ? markers.west : markers.east
      const glyph = chromeGlyph(pack, more ? "softVertical" : "heavyVertical")
      put(cells, BANDS.chrome, x, y, glyph, "chrome.frame", more ? soft : heavy)
    } else {
      put(cells, BANDS.chrome, x, y, lineGlyph(pack, cell), "chrome.frame", {
        bold: gridCorner && wholeGridVisible,
      })
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

/**
 * The armed structure's footprint under the cursor, and whether it would be refused there. Shape
 * carries the answer, not colour: a legal preview is the structure's own glyphs, an illegal one is a
 * block of `x`. Both read identically in monochrome, which is the point.
 *
 * The illegal block is grey, not red (owner, 2026-09-26: "the red color seems a bit too intense, we
 * should try grey instead"). Red is kept for the moment a placement is actually *attempted* and
 * refused — the status line's job, not the ghost's — so looking and trying read differently.
 */
function drawPreview(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null): void {
  const { state, layout } = input
  // Nothing armed — or the tile a placement just succeeded on, where the dimmed plan `drawGrid`
  // already drew shows through undisturbed.
  if (preview === null || preview.justPlaced) return
  const legal = preview.refusal === null
  const range = visibleRange(state.camera, state.viewport)

  for (const offset of preview.footprint) {
    const tile = { x: preview.anchor.x + offset.x, y: preview.anchor.y + offset.y }
    if (tile.x < range.firstX || tile.x > range.lastX) continue
    if (tile.y < range.firstY || tile.y > range.lastY) continue
    const cell = cellForTile(layout, state.camera, tile)
    const glyph = legal
      ? entityGlyph(preview.item.contentId, "A", { x: offset.x, y: offset.y })
      : ILLEGAL_PREVIEW_GLYPH
    put(cells, BANDS.highlights, cell.x, cell.y, glyph, legal ? "chrome.hotkey" : "chrome.muted")
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
 *  panel share it — see `bindingLines`. Trimmed to the essentials a player would not otherwise guess
 *  (2026-09-26 owner feedback: "no need to explain shift+arrow is a jump 5, just say arrows move,
 *  shift+arrow fast move, leave pgup/home keys out, people will figure that out just fine") — the
 *  keys themselves (PageUp/PageDown, Home/End) are unchanged, only this help text shrank. */
const BINDINGS = [
  "arrows move",
  "enter/space place",
  "esc disarm",
  "q quit",
  "shift+arrow fast move",
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

function drawHeaderAndFooter(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const limit = layout.paneLimit
  const left = layout.offset.column + 2
  const headerRow = layout.offset.row + 1
  const range = visibleRange(state.camera, state.viewport)

  // The header is one line; the other two rows of its budget stay blank. Nothing goes here that a
  // player does not need while choosing where to build. Not dimmed: the owner could not find the
  // interface at all in daylight (2026-09-26), and `chrome.muted` is already the quieter role.
  text(cells, band, left, headerRow, "TERMINAL NEXUS", "chrome.title", { bold: true, limit })
  text(cells, band, left + 15, headerRow, "build phase", "chrome.muted", { limit: limit - 16 })

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
    { limit: footerLimit },
  )
  const shown = statusLine(state, preview)
  const style = statusStyle(shown.tone)
  text(cells, band, left, layout.footerRow + 2, shown.text, style.role, {
    ...(style.bold === undefined ? {} : { bold: style.bold }),
    limit: footerLimit,
  })
}

/**
 * The status line — the footer's last row, and the one place the Build Phase answers "what just
 * happened, or why not" (owner, 2026-09-26: "we keep that low bar for cursor status feedback"). It
 * shows the reducer's own `state.status`, with one exception: while the armed ghost sits on a tile
 * Enter would refuse, the refusal is what it says, naming the tile — quietly while the player is only
 * looking, and in the reducer's own red once they actually try (a refused `place()` leaves a
 * `danger` status scoped to this tile, and that one is shown as it is).
 */
function statusLine(state: BuildState, preview: ArmedPreview | null): StatusMessage {
  if (preview === null || preview.refusal === null) return state.status
  const tile = state.status.tile
  const attempted = tile !== undefined && tile.x === state.cursor.x && tile.y === state.cursor.y
  return attempted ? state.status : status(refusalText(preview.refusal))
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

/** `[x] label`, the one two-tone split every plain (unselected, non-inverse) menu row on this
 *  screen uses — the construct menu's own rows, the Nexus draft's options, the commit confirmation.
 *  `column + 3` assumes a one-character hotkey, true of every hotkey this screen has. */
function drawHotkeyRow(
  cells: BandCell[],
  column: number,
  row: number,
  hotkey: string,
  label: string,
  limit: number,
  dim = false,
): void {
  text(cells, BANDS.chrome, column, row, `[${hotkey}]`, "chrome.hotkey", { bold: true, dim, limit })
  text(cells, BANDS.chrome, column + 3, row, ` ${label}`, "chrome.value", { dim, limit })
}

/**
 * The bindings the footer had no room for, pinned to the bottom of the panel and growing upward. A
 * wide enough terminal fits them all in the footer and this is empty.
 *
 * Bounded by the construct menu and the NEXUS/SPECIAL rows below it, which win: the panel is as
 * tall as the viewport and the viewport shrinks to fit a small Grid, so the block can reach them. A
 * hidden menu row is still a live click target — worse than a binding the player has to find
 * elsewhere — so the lowest-priority lines are dropped instead. (The bound once stopped at the menu
 * alone, and the NEXUS/SPECIAL rows gate 5D added below it were drawn over on a small Grid.)
 */
function panelBindings(
  layout: BuildLayout,
  catalog: readonly ConstructItem[],
): readonly string[] {
  const lines = bindingLines(layout.footerLimit, layout.panelLimit).panel
  const floor = summaryRows(layout, catalog).special + 2
  return lines.slice(0, Math.max(0, Math.min(lines.length, layout.panelBindingsRow - floor + 1)))
}

function drawPanelBindings(cells: BandCell[], input: BuildCompositionInput): void {
  const { layout } = input
  const lines = panelBindings(layout, input.context.catalog)
  lines.forEach((line, index) => {
    const row = layout.panelBindingsRow - (lines.length - 1 - index)
    text(cells, BANDS.chrome, layout.panelColumn, row, line, "chrome.muted", { limit: layout.panelLimit })
  })
}

/**
 * The side panel — engine.md 9.2's Build Phase list: the construct menu, what is left to spend, and
 * the selected item's cost and effect. Why a placement is refused is the status line's to say (canon
 * 2.19), and there is no radius preview, because nothing placed here has a radius.
 *
 * One rule decides what goes on it: every line is something a player needs while deciding where to
 * build. Most of it is blank until they are doing something — a panel that is always full is a
 * panel nobody reads.
 */
function drawPanel(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const left = remaining(context, state)

  // What there is to spend, on the panel's first line, because it is the number every choice below
  // it is measured against.
  text(cells, band, column, layout.panelRow + RESOURCE_ROW, "RESOURCE", "chrome.label", { limit })
  // Out of the whole budget, the picked Nexus power's share included — "130 of 100" read as a bug.
  rightAlign(
    cells,
    layout,
    layout.panelRow + RESOURCE_ROW,
    `${left} of ${context.allotment + state.bonusAllotment}`,
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
      drawHotkeyRow(cells, column, line.row, item.hotkey, item.label, limit, !affordable)
    }
    // Unaffordable always wins: `dim` and `bold` together cancel out on most terminals, so a row
    // that is both armed and no longer affordable used to read identically to a plain armed row.
    rightAlign(cells, layout, line.row, String(item.cost), "chrome.value", {
      dim: !affordable,
      bold: selected && affordable,
    })
  }

  // The other two of `commander-armies.md` Section 2.1's four Build Phase places, drawn in its own
  // order: the construct menu's two groups (above), the Nexus draft, then the Special. The pick is
  // already made by the time this panel ever draws — the draft is its own screen, before this one.
  // One row each, label and value on the same line the way RESOURCE already is, rather than the
  // group's own two-line shape: this pair is a fact to glance at, not a list to choose from, and the
  // effect line below still has to fit in what a floor-sized terminal leaves after them.
  const { nexus: nexusRow, special: specialRow } = summaryRows(layout, context.catalog)
  const picked = state.nexusPick === null ? null : context.nexusDraft[state.nexusPick]
  if (picked !== undefined && picked !== null) {
    text(cells, band, column, nexusRow, "NEXUS", "chrome.label", { limit })
    rightAlign(cells, layout, nexusRow, picked.name, "chrome.value", {})
  }
  // PERIMETER has none to arm — honest about the empty slot rather than hiding it, the same call
  // the empty army group already makes. Whether the Build Phase actually wanted a fourth channel
  // here is this gate's own report's to answer, not this panel's.
  text(cells, band, column, specialRow, "SPECIAL", "chrome.label", { limit })
  rightAlign(cells, layout, specialRow, "none available", "chrome.muted", { dim: true })

  // The armed item's one line of effect, and only while something is armed — nothing to build,
  // nothing to read. Why a placement would be refused is not here any more: the status line says it,
  // with its tile, where the owner looked for it (2026-09-26), so the panel stays the menu and what
  // the selected row does.
  if (preview === null) return
  const row = specialRow + 2
  // One row of clearance above the bindings block, so the two never touch. The panel's height is the
  // viewport's, and the viewport shrinks to fit a small Grid, so the line is dropped rather than
  // drawn over the bindings or the footer when there is no room for it.
  const bindingRows = panelBindings(layout, context.catalog).length
  if (row > layout.panelBindingsRow - bindingRows - 1) return
  text(cells, band, column, row, preview.item.effect, "chrome.value", { limit })
}

/**
 * The Nexus draft — its own screen, shown instead of the normal panel until picked. `commander-
 * armies.md` Section 4.5: a power "may not be skipped", so there is nothing here but the choice
 * itself; the construct menu, the budget, the Special slot all wait behind it.
 */
function drawNexusDraftPanel(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  text(cells, band, column, layout.panelRow, "NEXUS POWER", "chrome.label", { limit })
  const menuLayout = nexusDraftLayout(layout)
  context.nexusDraft.forEach((option, index) => {
    const row = menuItemRow(menuLayout, index)
    drawHotkeyRow(cells, column, row, option.hotkey, option.name, limit)
    // The line a player actually chooses by — quieter than the name, never dimmed out of reach.
    text(cells, band, column, row + 1, option.description, "chrome.muted", { limit })
  })
}

/** `p`'s one confirmation — engine.md 9.7: "asks once, [y]es/[n]o; the one action that must not
 *  fire by accident." Its own screen for the same reason the draft gets one: nothing else should be
 *  reachable while an unanswered "are you sure" is on the table. */
function drawConfirmPanel(cells: BandCell[], input: BuildCompositionInput): void {
  const { layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  text(cells, band, column, layout.panelRow, "START NEXUS PULSE?", "chrome.label", { limit })
  const menuLayout = confirmLayout(layout)
  CONFIRM_ITEMS.forEach((item, index) => {
    drawHotkeyRow(cells, column, menuItemRow(menuLayout, index), item.hotkey, item.label, limit)
  })
}

/** The Build Phase is done. Nothing here reaches a Nexus Pulse — Milestone 6 builds that — so this
 *  is the whole of the screen from here: what happened, and how to leave. The footer's own status
 *  line already carries the full sentence (`state.status`); this is the short, panel-width form. */
function drawCommittedPanel(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const picked = state.nexusPick === null ? null : context.nexusDraft[state.nexusPick]
  text(cells, band, column, layout.panelRow, "BUILD COMMITTED", "chrome.label", { limit })
  if (picked !== undefined && picked !== null) {
    text(cells, band, column, layout.panelRow + 2, `Nexus: ${picked.name}`, "chrome.value", { limit })
  }
  const count = state.planned.length
  text(
    cells,
    band,
    column,
    layout.panelRow + 3,
    `${count} structure${count === 1 ? "" : "s"} planned`,
    "chrome.value",
    { limit },
  )
  text(cells, band, column, layout.panelRow + 5, "[q] to exit", "chrome.muted", { limit })
}

export function composeBuildFrame(
  input: BuildCompositionInput,
  capability: CapabilityMode,
): ReadonlyCellFrame {
  void capability
  const pack: GlyphPack = input.glyphPack ?? "ascii"
  const cells: BandCell[] = []
  // What Enter would do at the cursor, derived once and read by the ghost, the status line and the
  // panel alike — the reducer's `place()` acts on the very same derivation.
  const preview = armedPreview(input.context, input.state)

  drawGrid(cells, input, pack)
  drawPreview(cells, input, preview)
  drawCursor(cells, input)
  drawChrome(cells, input, pack)
  drawHeaderAndFooter(cells, input, preview)

  // Three screens share this one frame, in the order a Build Phase actually moves through them:
  // the Nexus draft (nothing may be skipped), the construct menu and its budget, and the commit
  // confirmation on top of it when `p` is pressed. The Grid, the cursor and the footer are the same
  // in all three — only the panel's own content changes.
  if (input.state.committed) {
    drawCommittedPanel(cells, input)
  } else if (input.state.confirmingCommit) {
    drawConfirmPanel(cells, input)
  } else if (input.state.nexusPick === null) {
    drawNexusDraftPanel(cells, input)
  } else {
    drawPanel(cells, input, preview)
    drawPanelBindings(cells, input)
  }

  return composeBands(input.layout.frame.width, input.layout.frame.height, cells)
}
