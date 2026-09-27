// The Build Phase frame — engine.md 9.2's composition, on the same band compositor, style roles and
// glyph packs as the Pulse view and the menu, so monochrome and the colour tiers come free.
//
// The Grid pane is a **window onto a Grid larger than itself**: every tile is drawn at
// `tile - camera` and clipped to the viewport, and the two signals engine.md 3.3 requires in place
// of a minimap — the weight of the lines around the Grid pane, a position readout naming the visible
// range — come from the same camera the cursor moved.

import { footprintExtent, tilesOf } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import { SCROLL_MARGIN, edgeMarkers, visibleRange } from "../build/camera.ts"
import type { BuildLayout } from "../build/layout.ts"
import {
  EXPLORE_ROW,
  NEXUS_ROW,
  RESOURCE_ROW,
  cellForTile,
  constructLines,
  summaryRows,
} from "../build/layout.ts"
import { CLOSE_LABEL, overlaySpec, placeOverlay } from "../build/overlay.ts"
import type { ArmedPreview, BuildContext, BuildState } from "../build/state.ts"
import {
  armedPreview,
  entryOfConstruct,
  menuEntries,
  nexusPowers,
  pendingPicks,
  refusalText,
  remaining,
  structureAtTile,
} from "../build/state.ts"
import type { ConstructGroup, ConstructItem, PlannedPlacement } from "../build/types.ts"
import { CONTENT_ART } from "../content/art.ts"
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
  /** A menu row's brief acknowledgement, while the live loop is showing one — a "pressed" flash or a
   *  "refused" flicker. Presentation only; absent in every still frame. */
  flash?: BuildFlash
}>

export type BuildFlash = Readonly<{ kind: "pressed" | "refused"; entry: number }>

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
 * whole width), and the divider between the side panel and the Grid pane, which runs only between
 * those two rules so both bars run the whole width (gate 5F; engine.md 9.2). Together they close the
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
  horizontalLine(layout.paneBottom, left, right)
  // A Grid shorter than the pane still closes directly under its last row (engine.md 3.3), across
  // the Grid pane alone — the panel beside it runs on down to the bottom bar.
  if (box.bottom < layout.paneBottom) horizontalLine(box.bottom, box.left, box.right)
  // The divider runs only between the two rules, so the top bar and the bottom bar each run the
  // whole width: at 80 columns the Grid pane is 48 columns, and the key help, the position readout
  // and the status line are all longer than that.
  verticalLine(layout.dividerColumn, box.top, layout.paneBottom)

  const markers = edgeMarkers(state.camera, state.viewport, context.grid)
  // The Grid's west side is its own column next to the divider. It is drawn only where the map ends
  // there: beside the plain divider a second, lighter line would read as a double border, so while
  // there is more Grid to the west the divider alone is the light side, and the column is a gutter.
  if (!markers.west) verticalLine(box.left, box.top, box.bottom)
  const soft = { dim: true }
  // A side that has reached the map's own edge is a **solid bar** — an inverse-video cell — on all
  // four sides alike (owner, 2026-09-27: "the rectangle needs to be a rectangle"). The `=` / bold `|`
  // pair it replaces could not be the same weight in both directions in ASCII (Q56); a solid bar is,
  // in every glyph pack and in monochrome, and needs no colour to read. A corner is solid when either
  // side meeting there is, so a heavy side runs unbroken to its end.
  const topHeavy = !markers.north
  const bottomHeavy = !markers.south
  const leftHeavy = !markers.west
  const rightHeavy = !markers.east
  const solid = (x: number, y: number): void => put(cells, BANDS.chrome, x, y, " ", "chrome.frame", { inverse: true })

  for (const cell of lines.values()) {
    const { x, y } = cell
    const westGutter = x === box.left && !leftHeavy
    // While there is more Grid to the west, the divider is the Grid's light west side, drawn soft
    // like the other three — beside the Grid's rows only; above and below it is the panel's rule.
    if (x === layout.dividerColumn && !leftHeavy && y > box.top && y < box.bottom) {
      put(cells, BANDS.chrome, x, y, chromeGlyph(pack, "softVertical"), "chrome.frame", soft)
      continue
    }
    const alongTopOrBottom = (y === box.top || y === box.bottom) && (x > box.left || westGutter) && x < box.right
    const alongLeftOrRight = (x === box.left || x === box.right) && y > box.top && y < box.bottom
    const gridCorner = (x === box.left || x === box.right) && (y === box.top || y === box.bottom)
    if (alongTopOrBottom) {
      const heavy = y === box.top ? topHeavy : bottomHeavy
      if (heavy) solid(x, y)
      else put(cells, BANDS.chrome, x, y, chromeGlyph(pack, "softHorizontal"), "chrome.frame", soft)
    } else if (alongLeftOrRight) {
      const heavy = x === box.left ? leftHeavy : rightHeavy
      if (heavy) solid(x, y)
      else put(cells, BANDS.chrome, x, y, chromeGlyph(pack, "softVertical"), "chrome.frame", soft)
    } else if (
      gridCorner &&
      ((y === box.top ? topHeavy : bottomHeavy) || (x === box.left ? leftHeavy : rightHeavy))
    ) {
      solid(x, y)
    } else {
      put(cells, BANDS.chrome, x, y, lineGlyph(pack, cell), "chrome.frame")
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
      // Drawn at full strength, planned or standing (owner, 2026-09-27: "it will look better if
      // they are fully built"). A plan stays revisable — undo, remove — until the Pulse starts.
      void planned
      put(cells, BANDS.structures, cell.x, cell.y, glyph, playerRole("A"), { bold: true })
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
  if (preview === null) return
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
  // The cursor is the Grid's own focus mark: drawn only while the Grid has the keyboard, so the
  // screen never shows two "you are here"s at once (owner, 2026-09-27).
  if (state.focus !== "grid" || state.overlay !== null || state.committed) return
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

/**
 * The key help: where the keyboard is, and the keys that work there, most important first — one list
 * per mode, because focus makes arrows and Enter/Space mean different things and engine.md 9.7's
 * first convention asks the footer to say which. The label is drawn ahead of the list in the title's
 * weight, so it is the first thing read on the line.
 *
 * Trimmed to what a player would not otherwise guess: PageUp/PageDown, Home/End and Option+Arrow are
 * still bound, only unlisted (owner, 2026-09-26). `q` is not listed at all (owner, 2026-09-27): Esc on
 * the menu asks "Exit the game?", and that question shows `[q] Quit` itself.
 */
export type KeyHelp = Readonly<{ label: string; bindings: readonly string[] }>

export const MENU_KEY_HELP: KeyHelp = {
  label: "MENU",
  bindings: ["up/down choose", "enter/space select", "tab grid", "u undo", "p start pulse"],
}

/** The Grid, with a building armed. */
export const PLACE_KEY_HELP: KeyHelp = {
  label: "PLACE",
  bindings: ["arrows move", "enter/space place", "esc cancel", "shift+arrow fast move", "bksp remove", "u undo"],
}

/** The Grid, with nothing armed. */
export const EXPLORE_KEY_HELP: KeyHelp = {
  label: "EXPLORE",
  bindings: ["arrows move", "enter/space inspect", "tab/esc menu", "shift+arrow fast move", "bksp remove"],
}

const INFO_KEY_HELP: KeyHelp = {
  label: "INFO",
  bindings: ["arrows move", "esc close", "tab menu", "shift+arrow fast move"],
}

const NEXUS_KEY_HELP: KeyHelp = { label: "NEXUS", bindings: ["up/down choose", "enter/space pick", "esc close"] }
const CONFIRM_KEY_HELP: KeyHelp = { label: "START PULSE?", bindings: ["y yes", "n/esc no"] }
const EXIT_KEY_HELP: KeyHelp = { label: "EXIT?", bindings: ["q quit", "esc keep playing"] }
const COMMITTED_KEY_HELP: KeyHelp = { label: "COMMITTED", bindings: ["esc exit"] }

/** Which key help is live: whatever holds the keyboard right now. */
export function keyHelp(state: BuildState): KeyHelp {
  if (state.overlay === "exit") return EXIT_KEY_HELP
  if (state.committed) return COMMITTED_KEY_HELP
  if (state.overlay === "confirm-commit") return CONFIRM_KEY_HELP
  if (state.overlay === "nexus-powers") return NEXUS_KEY_HELP
  if (state.focus === "menu") return MENU_KEY_HELP
  if (state.armed !== null) return PLACE_KEY_HELP
  return state.inspecting ? INFO_KEY_HELP : EXPLORE_KEY_HELP
}

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
 * packs into panel-width rows. **Only whole bindings, anywhere**: a key cut in half is a key nobody
 * can press.
 */
export function bindingLines(
  footerLimit: number,
  panelLimit: number,
  help: KeyHelp = PLACE_KEY_HELP,
): Readonly<{ footer: string; panel: readonly string[] }> {
  // The focus label takes the front of the footer's line, and a gap after it.
  const { line: footer, rest } = packed(help.bindings, footerLimit - help.label.length - BINDING_GAP.length)
  const panel: string[] = []
  let remainingBindings = rest
  while (remainingBindings.length > 0) {
    const { line, rest: next } = packed(remainingBindings, panelLimit)
    // A binding longer than the panel is wide would otherwise loop forever producing empty rows.
    if (line === "") break
    panel.push(line)
    remainingBindings = next
  }
  return { footer, panel }
}

function drawHeaderAndFooter(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const left = layout.offset.column + 2
  const headerRow = layout.offset.row + 1
  const range = visibleRange(state.camera, state.viewport)

  // The top bar: the game's title and where the player is (engine.md 9.2), across the whole width.
  const limit = layout.headerLimit
  text(cells, band, left, headerRow, "TERMINAL NEXUS", "chrome.title", { bold: true, limit })
  text(cells, band, left + 15, headerRow, "build phase", "chrome.muted", { limit: limit - 15 })

  const footerLimit = layout.footerLimit
  // engine.md 3.3's second required signal: "a position readout in the footer naming the visible
  // tile range and the Grid size."
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
  // The screen documents itself (engine.md 9.7), starting with where the keyboard is.
  const help = keyHelp(state)
  text(cells, band, left, layout.footerRow + 1, help.label, "chrome.title", { bold: true, limit: footerLimit })
  const helpColumn = left + help.label.length + BINDING_GAP.length
  text(
    cells,
    band,
    helpColumn,
    layout.footerRow + 1,
    bindingLines(footerLimit, layout.panelLimit, help).footer,
    "chrome.muted",
    { limit: footerLimit - (helpColumn - left) },
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
 * happened, or why not". It shows the reducer's own `state.status`, with one exception: while the
 * armed ghost sits on a tile Enter would refuse, the refusal is what it says, naming the tile —
 * quietly while the player is only looking, and in the reducer's own red once they actually try.
 */
function statusLine(state: BuildState, preview: ArmedPreview | null): StatusMessage {
  if (preview === null || preview.refusal === null) return state.status
  const tile = state.status.tile
  const attempted = tile !== undefined && tile.x === state.cursor.x && tile.y === state.cursor.y
  return attempted ? state.status : status(refusalText(preview.refusal))
}

/** Right-aligned against the panel's own right edge — a column of costs reads as a column only if
 *  the numbers line up. */
function rightAlign(
  cells: BandCell[],
  layout: BuildLayout,
  row: number,
  value: string,
  role: StyleRole,
  extra: Readonly<{ dim?: boolean; bold?: boolean; inverse?: boolean; underline?: boolean }> = {},
): void {
  const column = layout.panelColumn + layout.panelLimit - value.length
  text(cells, BANDS.chrome, column, row, value, role, extra)
}

const GROUP_LABELS: Readonly<Record<ConstructGroup, string>> = {
  common: "COMMON",
  army: "ARMY",
}

/**
 * The bindings the footer had no room for, pinned to the bottom of the panel and growing upward.
 * Bounded by the menu, which wins: a hidden menu row is still a live click target, so the
 * lowest-priority lines are dropped instead.
 */
function panelBindings(layout: BuildLayout, catalog: readonly ConstructItem[], help: KeyHelp): readonly string[] {
  const lines = bindingLines(layout.footerLimit, layout.panelLimit, help).panel
  const floor = summaryRows(layout, catalog).special + 2
  return lines.slice(0, Math.max(0, Math.min(lines.length, layout.panelBindingsRow - floor + 1)))
}

function drawPanelBindings(cells: BandCell[], input: BuildCompositionInput): void {
  const { layout } = input
  const lines = panelBindings(layout, input.context.catalog, keyHelp(input.state))
  lines.forEach((line, index) => {
    const row = layout.panelBindingsRow - (lines.length - 1 - index)
    text(cells, BANDS.chrome, layout.panelColumn, row, line, "chrome.muted", { limit: layout.panelLimit })
  })
}

/** How a menu row is drawn. The four states the owner named (2026-09-27), plus armed:
 *  `plain`; `selected` — the inverse bar, where the keyboard is; `pressed` — a brief, stronger bar
 *  the moment a row is activated; `refused` — a brief flicker when a key reached the row but had
 *  nothing to do; and a row that costs more than is left is `disabled` (dim) in any of them. */
type RowState = "plain" | "selected" | "pressed" | "refused"

/**
 * One entry of the side panel's menu. `>` before the row says *armed* — the one structure Enter
 * places — and the bar says *where the keyboard is*. A structure is armed only while the Grid has
 * focus, so the bar is the menu highlight while the menu has focus, the armed row while placing, and
 * nowhere while exploring (owner, 2026-09-27).
 */
function drawMenuRow(
  cells: BandCell[],
  layout: BuildLayout,
  row: number,
  entry: Readonly<{
    hotkey: string
    label: string
    /** Drawn straight after the label in the hotkey's colour — the pending count on "Nexus". */
    badge?: string
    /** Right-aligned against the divider: a cost, or how many powers are active. */
    value?: string
    armed: boolean
    state: RowState
    disabled?: boolean
  }>,
): void {
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const bar = entry.state !== "plain"
  const inverse = entry.state === "selected" || entry.state === "pressed"
  // Pressed: the bar in the hotkey's colour, bold and underlined — stronger than "selected" at every
  // tier, monochrome included. Refused: the bar dimmed for a moment, a flicker against the bar the
  // row goes back to.
  const barRole: StyleRole = entry.state === "pressed" ? "chrome.hotkey" : "chrome.title"
  const extra = {
    inverse,
    bold: entry.state === "pressed" || entry.armed,
    underline: entry.state === "pressed",
    dim: entry.state === "refused" || (entry.disabled === true && !inverse),
  }
  if (bar) text(cells, band, column, row, " ".repeat(limit), barRole, { ...extra, limit })
  let at = column
  if (entry.armed) {
    text(cells, band, at, row, ">", barRole, { ...extra, limit })
    at += 2
  }
  const hotkey = `[${entry.hotkey}]`
  // Inside the bar every part takes the bar's own role, so it reads as one bar rather than a teal
  // block, a white block and a grey one side by side.
  text(cells, band, at, row, hotkey, bar ? barRole : "chrome.hotkey", { ...extra, bold: true, limit: column + limit - at })
  at += hotkey.length + 1
  text(cells, band, at, row, entry.label, bar ? barRole : entry.armed ? "chrome.title" : "chrome.value", {
    ...extra,
    limit: column + limit - at,
  })
  at += entry.label.length
  if (entry.badge !== undefined) {
    text(cells, band, at, row, entry.badge, bar ? barRole : "chrome.hotkey", { ...extra, bold: true, limit: column + limit - at })
  }
  if (entry.value !== undefined) {
    // In the bar the cost keeps only its dimness, the one fact it adds there: this row no longer fits.
    rightAlign(cells, layout, row, entry.value, bar ? barRole : "chrome.value", {
      ...extra,
      dim: entry.disabled === true || entry.state === "refused",
    })
  }
}

/**
 * The one line under the menu that says what a row is for — the highlighted row's while the menu has
 * focus (so a player reads what they are choosing before they choose it), the armed structure's while
 * placing. `null` when there is nothing to say.
 */
function effectLine(context: BuildContext, state: BuildState, preview: ArmedPreview | null): string | null {
  if (state.focus === "menu") {
    const entry = menuEntries(context)[state.menuHighlight]
    if (entry === undefined) return null
    if (entry.kind === "nexus") {
      return pendingPicks(context, state) > 0 ? "Pick one before the Pulse" : "Read the active powers"
    }
    if (entry.kind === "explore") return "Look around; inspect anything"
    return context.catalog[entry.index]?.effect ?? null
  }
  return preview?.item.effect ?? null
}

/** How the row for menu entry `entry` is drawn right now. */
function rowState(input: BuildCompositionInput, entry: number, armed: boolean): RowState {
  const { state, flash } = input
  if (flash !== undefined && flash.entry === entry) return flash.kind
  if (state.overlay !== null && state.focus !== "menu") return "plain"
  if (state.focus === "menu") return state.menuHighlight === entry ? "selected" : "plain"
  return armed ? "selected" : "plain"
}

/**
 * The side panel — engine.md 9.2's Build Phase list: the Nexus and Explore entries at the top, what
 * is left to spend, the construct menu, the Special slot, and one line saying what the row in
 * question does. Why a placement is refused is the status line's to say, and there is no radius
 * preview, because nothing placed here has a radius.
 */
function drawPanel(cells: BandCell[], input: BuildCompositionInput, preview: ArmedPreview | null): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const left = remaining(context, state)

  // Nexus. Its "(1)" is the number of picks waiting — the one thing that will stop the commit —
  // drawn in the hotkey's colour so it catches the eye without a popup forcing it.
  const pending = pendingPicks(context, state)
  const active = nexusPowers(context, state).active.length
  drawMenuRow(cells, layout, layout.panelRow + NEXUS_ROW, {
    hotkey: "n",
    label: "Nexus",
    ...(pending > 0 ? { badge: ` (${pending})` } : {}),
    ...(active > 0 ? { value: `${active} active` } : {}),
    armed: false,
    state: rowState(input, 0, false),
  })
  drawMenuRow(cells, layout, layout.panelRow + EXPLORE_ROW, {
    hotkey: "e",
    label: "Explore",
    armed: false,
    state: rowState(input, 1, false),
  })

  // What there is to spend, directly above the costs it is measured against.
  text(cells, band, column, layout.panelRow + RESOURCE_ROW, "RESOURCE", "chrome.label", { limit })
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
      text(cells, band, column, line.row, GROUP_LABELS[line.group], "chrome.label", { limit })
      rightAlign(cells, layout, line.row, "none available", "chrome.muted", { dim: true })
      continue
    }
    const item = context.catalog[line.index]
    if (item === undefined) continue
    const armed = line.index === state.armed
    drawMenuRow(cells, layout, line.row, {
      hotkey: item.hotkey,
      label: item.label,
      value: String(item.cost),
      armed,
      state: rowState(input, entryOfConstruct(line.index), armed),
      disabled: item.cost > left,
    })
  }

  // The Special slot: PERIMETER has none to arm — honest about the empty slot rather than hiding it.
  const { special: specialRow } = summaryRows(layout, context.catalog)
  text(cells, band, column, specialRow, "SPECIAL", "chrome.label", { limit })
  rightAlign(cells, layout, specialRow, "none available", "chrome.muted", { dim: true })

  const effect = effectLine(context, state, preview)
  if (effect === null) return
  const row = specialRow + 2
  // One row of clearance above the bindings block, so the two never touch; dropped rather than drawn
  // over the bindings when a short panel has no room.
  const bindingRows = panelBindings(layout, context.catalog, keyHelp(state)).length
  if (row > layout.panelBindingsRow - bindingRows - 1) return
  text(cells, band, column, row, effect, "chrome.value", { limit })
}

/** A plain name for what is under the cursor — the catalog's own label where there is one. */
function displayName(context: BuildContext, contentId: string): string {
  const item = context.catalog.find((row) => row.contentId === contentId)
  if (item !== undefined) return item.label
  const definition = context.registry.get(contentId)
  if (definition.nexus === true) {
    // Each Nexus is named for its faction (AGENTS.md): "structure.citizen.nexus" is the Citizen Nexus.
    const faction = contentId.split(".")[1] ?? ""
    return `${faction.charAt(0).toUpperCase()}${faction.slice(1)} Nexus`
  }
  return definition.short.charAt(0).toUpperCase() + definition.short.slice(1)
}

/**
 * The information panel (owner, 2026-09-27): exploring, Enter/Space — or a click on a building —
 * replaces the menu with what is under the cursor: its own glyphs as its icon, its name and one line
 * of what it is for, and its numbers. `[esc]` top-right brings the menu back. A first version of the
 * presentation card he described; the larger art and live stats during a Pulse come later.
 */
function drawInfoPanel(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  let row = layout.panelRow
  text(cells, band, column + limit - CLOSE_LABEL.length, row, CLOSE_LABEL, "chrome.hotkey", { bold: true })

  const structure = structureAtTile(context, state.planned, state.cursor)
  if (structure === null) {
    const terrainId = context.grid.tiles[state.cursor.y * context.grid.width + state.cursor.x] ?? "terrain.plain"
    const { glyph, role } = terrainGlyph(terrainId, pack)
    put(cells, band, column, row, glyph === " " ? "." : glyph, role, {})
    const terrain = TERRAIN_INFO[terrainId] ?? { name: "Ground", line: "" }
    text(cells, band, column + 3, row, terrain.name, "chrome.title", { bold: true, limit: limit - 3 - CLOSE_LABEL.length - 1 })
    text(cells, band, column, row + 2, terrain.line, "chrome.value", { limit })
    text(cells, band, column, row + 4, "TILE", "chrome.label", { limit })
    rightAlign(cells, layout, row + 4, `${state.cursor.x},${state.cursor.y}`, "chrome.value")
    return
  }

  const definition = context.registry.get(structure.contentId)
  const art = CONTENT_ART[structure.contentId] ?? [definition.short.charAt(0)]
  const artWidth = Math.max(...art.map((line) => line.length))
  art.forEach((line, index) => {
    ;[...line].forEach((character, offset) => {
      const glyph = entityGlyph(structure.contentId, "A", { x: offset, y: index })
      put(cells, band, column + offset, row + index, glyph === "?" ? character : glyph, playerRole("A"), { bold: true })
    })
  })
  const nameColumn = column + artWidth + 2
  text(cells, band, nameColumn, row, displayName(context, structure.contentId), "chrome.title", {
    bold: true,
    limit: column + limit - CLOSE_LABEL.length - 1 - nameColumn,
  })
  text(cells, band, nameColumn, row + 1, structure.planned ? "planned" : "standing", "chrome.muted", {
    limit: column + limit - nameColumn,
  })
  row += Math.max(art.length, 2) + 1

  const item = context.catalog.find((candidate) => candidate.contentId === structure.contentId)
  const line = item?.effect ?? (definition.nexus === true ? "Your base. Lose it, lose the Pulse." : "")
  // Wrapped at word boundaries: the panel is 28 glyphs wide at the floor, and a description cut
  // mid-sentence was the first thing the screenshots of this panel showed (2026-09-27).
  for (const wrapped of wrapWords(line, limit)) {
    text(cells, band, column, row, wrapped, "chrome.value", { limit })
    row += 1
  }
  if (line !== "") row += 1
  const size = footprintExtent(definition.footprint)
  const stats: [string, string][] = [
    ["HEALTH", String(definition.maxHp)],
    ["SIZE", `${size.width}x${size.height}`],
  ]
  if (item !== undefined) stats.push(["COST", String(item.cost)])
  if (definition.attack !== undefined) {
    stats.push(["ATTACK", `${definition.attack.damage} at range ${definition.attack.range}`])
  }
  for (const [label, value] of stats) {
    if (row > layout.panelBindingsRow) break
    text(cells, band, column, row, label, "chrome.label", { limit })
    rightAlign(cells, layout, row, value, "chrome.value")
    row += 1
  }
  if (structure.planned && row + 1 <= layout.panelBindingsRow) {
    text(cells, band, column, row + 1, "[bksp] remove  [u] undo", "chrome.muted", { limit })
  }
}

/** Splits text into lines of at most `limit` glyphs, breaking between words. */
function wrapWords(value: string, limit: number): readonly string[] {
  const lines: string[] = []
  let current = ""
  for (const word of value.split(" ").filter((part) => part !== "")) {
    const grown = current === "" ? word : `${current} ${word}`
    if (grown.length <= limit || current === "") current = grown
    else {
      lines.push(current)
      current = word
    }
  }
  if (current !== "") lines.push(current)
  return lines
}

/** What a bare tile is, for the information panel. */
const TERRAIN_INFO: Readonly<Record<string, Readonly<{ name: string; line: string }>>> = {
  "terrain.plain": { name: "Open ground", line: "You can build here." },
  "terrain.rock": { name: "Rock", line: "Blocks building and movement." },
  "terrain.deposit": { name: "Deposit", line: "Resources lie here." },
}

/**
 * A popup — the Nexus powers, the start-the-Pulse question, or the exit question — drawn from its
 * spec (`src/build/overlay.ts`), over everything on the Grid. A solid border in the same weight as a
 * map edge, `[esc]` in its top-right corner, and a one-cell shadow that blanks what is behind it, so
 * it cannot be missed (owner, 2026-09-27: he clicked Nexus, did not notice the popup, and thought the
 * mouse had stopped working).
 *
 * Drawn last in the chrome band: bands are fixed (engine.md 9.4, RULE), and within one band a later
 * write replaces an earlier one, so a popup needs no band of its own to sit on top.
 */
function drawOverlay(cells: BandCell[], input: BuildCompositionInput): void {
  const spec = overlaySpec(input.context, input.state)
  if (spec === null) return
  const placed = placeOverlay(input.layout, spec)
  const band = BANDS.chrome
  const { box, textColumn, textLimit } = placed

  // The shadow: one cell right and one below, blanked.
  for (let y = box.top + 1; y <= box.bottom + 1; y += 1) put(cells, band, box.right + 1, y, " ")
  for (let x = box.left + 1; x <= box.right + 1; x += 1) put(cells, band, x, box.bottom + 1, " ")

  for (let y = box.top; y <= box.bottom; y += 1) {
    for (let x = box.left; x <= box.right; x += 1) {
      const edge = y === box.top || y === box.bottom || x === box.left || x === box.right
      put(cells, band, x, y, " ", "chrome.frame", edge ? { inverse: true } : {})
    }
  }
  // Title and `[esc]` sit in the top border, drawn in reverse so they read as part of it.
  text(cells, band, box.left + 2, box.top, ` ${spec.title} `, "chrome.title", {
    bold: true,
    inverse: true,
    limit: placed.close.from - box.left - 3,
  })
  text(cells, band, placed.close.from, placed.close.row, CLOSE_LABEL, "chrome.frame", { bold: true, inverse: true })

  for (const { row, spec: entry, secondLine } of placed.rows) {
    switch (entry.kind) {
      case "blank":
        break
      case "heading":
        text(cells, band, textColumn, row, entry.text, "chrome.label", { limit: textLimit })
        break
      case "text":
        text(cells, band, textColumn, row, entry.text, entry.muted === true ? "chrome.muted" : "chrome.value", {
          bold: entry.strong === true,
          limit: textLimit,
        })
        break
      case "option": {
        if (secondLine) {
          // The line a player actually chooses by — quieter than the name, never dimmed out of reach.
          text(cells, band, textColumn + 4, row, entry.description ?? "", "chrome.muted", { limit: textLimit - 4 })
          break
        }
        const on = entry.highlighted === true
        if (on) text(cells, band, textColumn, row, " ".repeat(textLimit), "chrome.title", { inverse: true, limit: textLimit })
        const hotkey = `[${entry.hotkey}]`
        text(cells, band, textColumn, row, hotkey, on ? "chrome.title" : "chrome.hotkey", { bold: true, inverse: on, limit: textLimit })
        text(cells, band, textColumn + hotkey.length + 1, row, entry.label, on ? "chrome.title" : "chrome.value", {
          inverse: on,
          limit: textLimit - hotkey.length - 1,
        })
        break
      }
    }
  }
}

/** The Build Phase is done. Nothing here reaches a Nexus Pulse — Milestone 6 builds that. */
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
  text(cells, band, column, layout.panelRow + 3, `${count} structure${count === 1 ? "" : "s"} planned`, "chrome.value", {
    limit,
  })
  text(cells, band, column, layout.panelRow + 5, "[esc] to exit", "chrome.muted", { limit })
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

  // The panel shows the menu, or — exploring — what is under the cursor, or the committed summary.
  // Clipped to the panel's own rows: on a terminal too short for the whole menu, a row that does not
  // fit is left off rather than drawn over the rule and the bottom bar.
  const panel: BandCell[] = []
  if (input.state.committed) drawCommittedPanel(panel, input)
  else if (input.state.inspecting && input.state.focus === "grid") drawInfoPanel(panel, input, pack)
  else {
    drawPanel(panel, input, preview)
    drawPanelBindings(panel, input)
  }
  for (const cell of panel) if (cell.y <= input.layout.panelBindingsRow) cells.push(cell)
  drawOverlay(cells, input)

  return composeBands(input.layout.frame.width, input.layout.frame.height, cells)
}
