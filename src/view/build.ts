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
  NEXUS_ROW,
  RESOURCE_ROW,
  cellForTile,
  confirmLayout,
  constructLines,
  nexusPopupLayout,
  summaryRows,
} from "../build/layout.ts"
import { menuItemRow } from "../menu/layout.ts"
import type { ArmedPreview, BuildContext, BuildState } from "../build/state.ts"
import { armedPreview, menuEntries, nexusPowers, pendingPicks, refusalText, remaining } from "../build/state.ts"
import type { ConstructGroup, ConstructItem, MenuEntry, PlannedPlacement } from "../build/types.ts"
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

/**
 * The key help: where keyboard focus is, and the bindings live there, most important first — one list
 * per focus, because focus makes arrows and Enter/Space mean two things and engine.md 9.7's first
 * convention asks the footer to say which (gate 5F). The label is drawn ahead of the list, in the
 * title's weight, so it is the first thing read on the line.
 *
 * Trimmed to the essentials a player would not otherwise guess (2026-09-26 owner feedback: "no need
 * to explain shift+arrow is a jump 5, just say arrows move, shift+arrow fast move, leave pgup/home
 * keys out, people will figure that out just fine") — the keys themselves (PageUp/PageDown,
 * Home/End) are unchanged, only this help text shrank. `p` is listed on the menu's own list: the
 * commit is the menu's business, and on the Grid's list it would push a third row onto the panel at
 * 80 columns.
 */
export type KeyHelp = Readonly<{ label: string; bindings: readonly string[] }>

export const GRID_KEY_HELP: KeyHelp = {
  label: "GRID",
  bindings: [
    "arrows move",
    "enter/space place",
    "tab/esc menu",
    "q quit",
    "shift+arrow fast move",
    "bksp remove",
    "u undo",
  ],
}

export const MENU_KEY_HELP: KeyHelp = {
  label: "MENU",
  bindings: ["up/down choose", "enter/space select", "tab grid", "q quit", "p start pulse"],
}

const POPUP_KEY_HELP: KeyHelp = {
  label: "NEXUS POWERS",
  bindings: ["up/down choose", "enter/space pick", "esc close", "q quit"],
}

const CONFIRM_KEY_HELP: KeyHelp = { label: "START PULSE?", bindings: ["y yes", "n/esc no", "q quit"] }

const COMMITTED_KEY_HELP: KeyHelp = { label: "COMMITTED", bindings: ["q quit"] }

/** Which key help is live: whatever holds the keyboard right now. */
export function keyHelp(state: BuildState): KeyHelp {
  if (state.committed) return COMMITTED_KEY_HELP
  if (state.confirmingCommit) return CONFIRM_KEY_HELP
  if (state.overlay !== null) return POPUP_KEY_HELP
  return state.focus === "menu" ? MENU_KEY_HELP : GRID_KEY_HELP
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
 * packs into panel-width rows. A wide terminal fits them all in the footer and the panel rows come
 * back as blank space. **Only whole bindings, anywhere**: a key cut in half is a key nobody can
 * press, and the jump keys that fall off first are exactly the ones the terminal survey found some
 * emulators deliver only one of.
 */
export function bindingLines(
  footerLimit: number,
  panelLimit: number,
  help: KeyHelp = GRID_KEY_HELP,
): Readonly<{ footer: string; panel: readonly string[] }> {
  // The focus label takes the front of the footer's line, and a gap after it.
  const { line: footer, rest } = packed(help.bindings, footerLimit - help.label.length - BINDING_GAP.length)
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
  const left = layout.offset.column + 2
  const headerRow = layout.offset.row + 1
  const range = visibleRange(state.camera, state.viewport)

  // The top bar: the game's title and where the player is (engine.md 9.2), across the whole width.
  // Nothing goes here that a player does not need while choosing where to build. Not dimmed: the
  // owner could not find the interface at all in daylight (2026-09-26), and `chrome.muted` is already
  // the quieter role.
  const limit = layout.headerLimit
  text(cells, band, left, headerRow, "TERMINAL NEXUS", "chrome.title", { bold: true, limit })
  text(cells, band, left + 15, headerRow, "build phase", "chrome.muted", { limit: limit - 15 })

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
  // The screen documents itself (engine.md 9.7), starting with where focus is. What does not fit
  // here is drawn in the panel.
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
  extra: Readonly<{ dim?: boolean; bold?: boolean; inverse?: boolean }> = {},
): void {
  const column = layout.panelColumn + layout.panelLimit - value.length
  text(cells, BANDS.chrome, column, row, value, role, extra)
}

const GROUP_LABELS: Readonly<Record<ConstructGroup, string>> = {
  common: "COMMON",
  army: "ARMY",
}

/** `[x] label`, the one two-tone split every plain (unselected, non-inverse) menu row on this
 *  screen uses — the construct menu's own rows, the Nexus powers, the commit confirmation, the
 *  popup's `[esc] Close`. */
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
  const after = hotkey.length + 2
  text(cells, BANDS.chrome, column + after, row, ` ${label}`, "chrome.value", { dim, limit: limit - after })
}

/**
 * The bindings the footer had no room for, pinned to the bottom of the panel and growing upward. A
 * wide enough terminal fits them all in the footer and this is empty.
 *
 * Bounded by the construct menu and the SPECIAL row below it, which win: the panel is as tall as the
 * viewport and the viewport shrinks to fit a small Grid, so the block can reach them. A hidden menu
 * row is still a live click target — worse than a binding the player has to find elsewhere — so the
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

/**
 * One entry of the side panel's menu. **Two marks, two meanings** (gate 5F): a `>` before the row
 * says *armed* — the one structure Enter places — and an inverse bar across the whole row says
 * *here* — the row the keyboard is on. While the menu has focus the bar is its highlight; while the
 * Grid has it, the bar sits on the armed row, which is exactly how the armed row read before focus
 * existed. The two agree most of the time (arming moves the highlight onto its row), and when they
 * do not — Up/Down after arming — both are drawn, so neither fact is lost.
 */
function drawMenuRow(
  cells: BandCell[],
  layout: BuildLayout,
  row: number,
  entry: Readonly<{
    hotkey: string
    label: string
    /** Drawn straight after the label in the hotkey's colour — the pending count on "Nexus Powers". */
    badge?: string
    /** Right-aligned against the divider: a cost, or how many powers are active. */
    value?: string
    armed: boolean
    bar: boolean
    /** The row costs more than is left. Dim is an attribute, not a colour, so it survives
     *  monochrome — and the reason is spelled out in full the moment the player tries it anyway. */
    unaffordable?: boolean
  }>,
): void {
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const inverse = entry.bar
  const dim = entry.unaffordable === true && !entry.bar
  if (entry.bar) text(cells, band, column, row, " ".repeat(limit), "chrome.title", { inverse: true, limit })
  let at = column
  if (entry.armed) {
    text(cells, band, at, row, ">", "chrome.title", { bold: true, inverse, limit })
    at += 2
  }
  // Inside the bar every part takes the bar's own role, so it reads as one bar rather than a teal
  // block, a white block and a grey one side by side (found in the gate 5F screenshots).
  const hotkey = `[${entry.hotkey}]`
  const hotkeyRole: StyleRole = entry.bar ? "chrome.title" : "chrome.hotkey"
  text(cells, band, at, row, hotkey, hotkeyRole, { bold: true, inverse, dim, limit: column + limit - at })
  at += hotkey.length + 1
  const labelRole: StyleRole = entry.armed || entry.bar ? "chrome.title" : "chrome.value"
  text(cells, band, at, row, entry.label, labelRole, {
    bold: entry.armed,
    inverse,
    dim,
    limit: column + limit - at,
  })
  at += entry.label.length
  if (entry.badge !== undefined) {
    text(cells, band, at, row, entry.badge, hotkeyRole, { bold: true, inverse, limit: column + limit - at })
  }
  if (entry.value !== undefined) {
    // Unaffordable always wins: `dim` and `bold` together cancel out on most terminals, so a row that
    // is both armed and no longer affordable used to read identically to a plain armed row.
    // In the bar the cost keeps only its dimness, the one fact it adds there: this row no longer fits.
    rightAlign(cells, layout, row, entry.value, entry.bar ? "chrome.title" : "chrome.value", {
      dim: entry.unaffordable === true,
      bold: entry.armed && entry.unaffordable !== true,
      inverse,
    })
  }
}

function sameEntry(a: MenuEntry | undefined, b: MenuEntry): boolean {
  if (a === undefined || a.kind !== b.kind) return false
  return a.kind === "nexus" || (b.kind === "construct" && a.index === b.index)
}

/**
 * The one line under the menu that says what a row is for — the highlighted row's while the menu
 * has focus (so a player reads what they are choosing before they choose it), the armed structure's
 * while the Grid has it. `null` when there is nothing to say.
 */
function effectLine(context: BuildContext, state: BuildState, preview: ArmedPreview | null): string | null {
  if (state.focus === "menu") {
    const entry = menuEntries(context)[state.menuHighlight]
    if (entry === undefined) return null
    if (entry.kind === "nexus") {
      return pendingPicks(context, state) > 0 ? "Pick one before the Pulse" : "Read the active powers"
    }
    return context.catalog[entry.index]?.effect ?? null
  }
  return preview?.item.effect ?? null
}

/**
 * The side panel — engine.md 9.2's Build Phase list: the Nexus Powers entry at the top (gate 5F),
 * what is left to spend, the construct menu, the Special slot, and one line saying what the row in
 * question does. Why a placement is refused is the status line's to say (canon 2.19), and there is no
 * radius preview, because nothing placed here has a radius.
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
  const highlighted = menuEntries(context)[state.menuHighlight]
  const barOn = (entry: MenuEntry, armed: boolean): boolean =>
    state.focus === "menu" ? sameEntry(highlighted, entry) : armed

  // The Nexus Powers entry. Its "(1)" is the number of picks waiting — the one thing that will stop
  // the commit — drawn in the hotkey's colour so it catches the eye without a popup forcing it.
  const pending = pendingPicks(context, state)
  const active = nexusPowers(context, state).active.length
  drawMenuRow(cells, layout, layout.panelRow + NEXUS_ROW, {
    hotkey: "n",
    label: "Nexus Powers",
    ...(pending > 0 ? { badge: ` (${pending})` } : {}),
    ...(active > 0 ? { value: `${active} active` } : {}),
    armed: false,
    bar: barOn({ kind: "nexus" }, false),
  })

  // What there is to spend, directly above the costs it is measured against.
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
      bar: barOn({ kind: "construct", index: line.index }, armed),
      unaffordable: item.cost > left,
    })
  }

  // The Special slot: PERIMETER has none to arm — honest about the empty slot rather than hiding it,
  // the same call the empty army group already makes.
  const { special: specialRow } = summaryRows(layout, context.catalog)
  text(cells, band, column, specialRow, "SPECIAL", "chrome.label", { limit })
  rightAlign(cells, layout, specialRow, "none available", "chrome.muted", { dim: true })

  const effect = effectLine(context, state, preview)
  if (effect === null) return
  const row = specialRow + 2
  // One row of clearance above the bindings block, so the two never touch. The panel's height is the
  // viewport's, and the viewport shrinks to fit a small Grid, so the line is dropped rather than
  // drawn over the bindings or the footer when there is no room for it.
  const bindingRows = panelBindings(layout, context.catalog, keyHelp(state)).length
  if (row > layout.panelBindingsRow - bindingRows - 1) return
  text(cells, band, column, row, effect, "chrome.value", { limit })
}

/**
 * The Nexus Powers popup — the game's first overlay (gate 5F; engine.md 9.7), opened only by the
 * player, centred over the Grid pane and drawn over everything on it. A pending power is picked here
 * by its digit, by Up/Down and Enter, or by a click; the active ones are read here. A dealt power may
 * not be skipped, but that is the commit's to refuse, not this popup's to force (canon 2.19).
 *
 * Drawn last, in the chrome band: bands are fixed (engine.md 9.4, RULE), and within one band a later
 * write replaces an earlier one, so an overlay needs no band of its own to sit on top.
 */
function drawNexusPopup(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const powers = nexusPowers(context, state)
  const popup = nexusPopupLayout(layout, powers.pending.length, powers.active.length)
  const { box, textColumn, textLimit } = popup

  for (let y = box.top; y <= box.bottom; y += 1) {
    for (let x = box.left; x <= box.right; x += 1) {
      const top = y === box.top
      const bottom = y === box.bottom
      const side = x === box.left || x === box.right
      let glyph = " "
      if ((top || bottom) && side) {
        glyph = chromeGlyph(pack, top ? (x === box.left ? "topLeft" : "topRight") : x === box.left ? "bottomLeft" : "bottomRight")
      } else if (top || bottom) {
        glyph = chromeGlyph(pack, "horizontal")
      } else if (side) {
        glyph = chromeGlyph(pack, "vertical")
      }
      put(cells, band, x, y, glyph, "chrome.frame", { bold: glyph !== " " })
    }
  }
  text(cells, band, box.left + 2, box.top, " NEXUS POWERS ", "chrome.title", { bold: true, limit: textLimit })

  text(
    cells,
    band,
    textColumn,
    popup.pendingHeadingRow,
    powers.pending.length > 0 ? "PICK ONE - needed before the Pulse" : "PICK",
    "chrome.label",
    { limit: textLimit },
  )
  if (powers.pending.length === 0) {
    text(cells, band, textColumn, popup.pendingHeadingRow + 1, "Nothing waiting.", "chrome.muted", { limit: textLimit })
  }
  powers.pending.forEach(({ option }, index) => {
    const row = popup.pendingRows[index] as number
    if (index === state.overlayHighlight) {
      text(cells, band, textColumn, row, " ".repeat(textLimit), "chrome.title", { inverse: true, limit: textLimit })
      text(cells, band, textColumn, row, `[${option.hotkey}]`, "chrome.title", { bold: true, inverse: true, limit: textLimit })
      text(cells, band, textColumn + option.hotkey.length + 3, row, option.name, "chrome.title", {
        inverse: true,
        limit: textLimit - option.hotkey.length - 3,
      })
    } else {
      drawHotkeyRow(cells, textColumn, row, option.hotkey, option.name, textLimit)
    }
    // The line a player actually chooses by — quieter than the name, never dimmed out of reach.
    text(cells, band, textColumn + 4, row + 1, option.description, "chrome.muted", { limit: textLimit - 4 })
  })

  text(cells, band, textColumn, popup.activeHeadingRow, "ACTIVE", "chrome.label", { limit: textLimit })
  if (powers.active.length === 0) {
    text(cells, band, textColumn, popup.activeHeadingRow + 1, "None yet.", "chrome.muted", { limit: textLimit })
  }
  powers.active.forEach((option, index) => {
    const row = popup.activeRows[index] as number
    text(cells, band, textColumn, row, option.name, "chrome.value", { bold: true, limit: textLimit })
    text(cells, band, textColumn + 4, row + 1, option.description, "chrome.muted", { limit: textLimit - 4 })
  })

  drawHotkeyRow(cells, textColumn, popup.closeRow, "esc", "Close", textLimit)
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

  // The panel's own content changes with where the Build Phase is: the commit confirmation replaces
  // the menu while it is open, and a committed Build Phase replaces both. The Grid, the cursor and the
  // bars are the same throughout; the Nexus Powers popup goes over all of it.
  if (input.state.committed) {
    drawCommittedPanel(cells, input)
  } else if (input.state.confirmingCommit) {
    drawConfirmPanel(cells, input)
  } else {
    // Clipped to the panel's own rows: on a terminal too short for the whole menu, a row that does
    // not fit is left off rather than drawn over the rule and the bottom bar.
    const panel: BandCell[] = []
    drawPanel(panel, input, preview)
    drawPanelBindings(panel, input)
    for (const cell of panel) if (cell.y <= input.layout.panelBindingsRow) cells.push(cell)
  }
  if (input.state.overlay === "nexus-powers") drawNexusPopup(cells, input, pack)

  return composeBands(input.layout.frame.width, input.layout.frame.height, cells)
}
