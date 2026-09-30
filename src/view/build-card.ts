// Cards: what replaces the menu while something has the map's attention — Explore Map's (what is under
// the cursor) or a building's (the one being placed) — and the card reveal that turns the menu into one.

import { footprintExtent } from "../grid/coords.ts"
import { CARD_FIRST_ROW, CARD_HEADER_ROW, CARD_SEPARATOR_ROW, menuEntryRow, menuFloor } from "../build/layout.ts"
import { wrapWords } from "../build/popup.ts"
import type { BuildContext } from "../build/state.ts"
import { cardEntry, menuEntries, structureAtTile } from "../build/state.ts"
import { CONTENT_ART } from "../content/art.ts"
import type { BandCell } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { put, text } from "./draw.ts"
import type { CapabilityMode } from "./roles.ts"
import { chromeGlyph, entityGlyph, playerRole, terrainGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import { placementLook, placementSchedule } from "./placement.ts"
import { EASINGS } from "./tween.ts"
import type { BuildCompositionInput } from "./build.ts"
import { rightAlign, drawMenuRow, menuRowSpec, drawPanel } from "./build-menu.ts"

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
 * The menu turning into a card (owner, 2026-09-30, feedback F68), as the live loop times it: `elapsedMs`
 * into a reveal `lengthMs` long (the "Card reveal" Experiment's length); `fromMenu` says the menu was on
 * the panel before (its rows fade and the chosen row slides up), rather than another card (which gives
 * way at once, and only the card's own beat plays). Absent — every still frame — the finished card.
 */
export type CardReveal = Readonly<{ elapsedMs: number; lengthMs: number; fromMenu: boolean }>

/** How far through its reveal the card is, 0 to 1 and linear in time; a reveal of no length is over. */
const revealProgress = (reveal: CardReveal): number => (reveal.lengthMs <= 0 ? 1 : reveal.elapsedMs / reveal.lengthMs)

/**
 * The card reveal's three beats, as shares of its length (F68: "all the menu disappears except for the
 * currently selected menu item that changed to the active state, then quickly interpolates (moves) the
 * item to the top, and then the detail card appears"): the other rows fade out; the chosen row, drawn
 * active, slides from its place on the menu to the header line; then the separator and the card fade in,
 * the card's name, subtitle and description typed out and a building's icon playing the frames of a
 * building going up. The card's beat is the longest, since it has the most to show; at 150 ms the three
 * are about 38, 45 and 67 ms.
 */
export const CARD_BEATS = { fade: 0.25, slide: 0.3, card: 0.45 } as const

/** How a card is drawn: finished (every still frame, and the end of its reveal), or partway through
 *  its reveal's last beat. */
type CardLook = Readonly<{
  /** The first characters of `text` shown so far — the typing — from one budget shared in reading
   *  order, so the name types first, then the subtitle, then the description. */
  typed: (value: string) => string
  /** Everything on the card below its header that is neither typed nor its icon — the separator, the
   *  numbers — fading in: 1 not there yet, 0 all there. */
  hidden: number
  capability: CapabilityMode
  /** How far into its placement frames a building's icon is, and how long they run, or `null` for the
   *  finished icon. */
  icon: Readonly<{ elapsedMs: number; framesMs: number }> | null
}>

const finishedCard = (capability: CapabilityMode): CardLook => ({ typed: (value) => value, hidden: 0, capability, icon: null })

/** Whether a tier can show a continuous fade (`CellStyle.fade` resolves only there). */
const blends = (capability: CapabilityMode): boolean => capability === "truecolor" || capability === "color256"

/**
 * One panel cell, `hidden` of the way to gone (0 as it is, 1 not drawn): the `fade` style where a tier
 * blends, and where it cannot — 16 colours, monochrome — the cell drawn dim for the half nearer gone,
 * so every tier sees the step. `null` when it is not drawn at all.
 */
function fadedCell(entry: BandCell, hidden: number, capability: CapabilityMode): BandCell | null {
  if (hidden <= 0) return entry
  if (hidden >= 1) return null
  if (!("cell" in entry)) return entry
  const patch = blends(capability) ? { fade: hidden } : hidden >= 0.5 ? { dim: true } : null
  return patch === null ? entry : { ...entry, cell: { glyph: entry.cell.glyph, style: { ...entry.cell.style, ...patch } } }
}

/** Fade every cell pushed onto `cells` from index `from` on. */
function fadeFrom(cells: BandCell[], from: number, hidden: number, capability: CapabilityMode): void {
  const drawn = cells.splice(from)
  for (const entry of drawn) {
    const faded = fadedCell(entry, hidden, capability)
    if (faded !== null) cells.push(faded)
  }
}

/**
 * The side panel while a card shows: finished, or — while the live loop says the card is being
 * revealed (F68) — partway through its three beats (`CARD_BEATS`). Presentation only: the state is the
 * card's all along, and a still frame draws the finished card.
 */
export function drawCard(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack, capability: CapabilityMode): void {
  const reveal = input.cardReveal
  const entry = cardEntry(input.state)
  if (reveal === undefined || entry === null || revealProgress(reveal) >= 1) {
    drawCardPanel(cells, input, pack, finishedCard(capability))
    return
  }
  const { context, layout } = input
  const t = Math.max(0, revealProgress(reveal))
  const header = layout.panelRow + CARD_HEADER_ROW
  const target = menuEntries(context)[entry]
  const home = (target === undefined ? null : menuEntryRow(layout, context.catalog, target)) ?? header
  const menuEnds = reveal.fromMenu ? CARD_BEATS.fade + CARD_BEATS.slide : 0
  if (reveal.fromMenu && t < CARD_BEATS.fade) {
    // Beat 1: the menu as it stands — its chosen row already active — with every other row fading out.
    const menu: BandCell[] = []
    drawPanel(menu, input, pack, capability)
    const hidden = t / CARD_BEATS.fade
    for (const drawn of menu) {
      const faded = drawn.y === home ? drawn : fadedCell(drawn, hidden, capability)
      if (faded !== null) cells.push(faded)
    }
    return
  }
  const spec = menuRowSpec(input, entry)
  if (reveal.fromMenu && t < menuEnds) {
    // Beat 2: the chosen row alone, sliding a whole row at a time from its place to the header line.
    if (spec === null) return
    // Slow at both ends: a row that starts from rest and comes to rest on the header line.
    const along = EASINGS.easeInOut((t - CARD_BEATS.fade) / CARD_BEATS.slide)
    drawMenuRow(cells, layout, Math.round(home + (header - home) * along), spec, capability)
    return
  }
  // Beat 3 (the whole reveal, from another card): the card itself.
  const shown = (t - menuEnds) / (1 - menuEnds)
  const lengthMs = Math.max(0, reveal.lengthMs) * (1 - menuEnds)
  let total = 0
  drawCardPanel([], input, pack, {
    typed: (value) => {
      total += value.length
      return value
    },
    hidden: 0,
    capability,
    icon: null,
  })
  let budget = Math.floor(total * shown)
  drawCardPanel(cells, input, pack, {
    typed: (value) => {
      const visible = value.slice(0, Math.max(0, budget))
      budget -= value.length
      return visible
    },
    hidden: 1 - shown,
    capability,
    icon: lengthMs > 0 ? { elapsedMs: shown * lengthMs, framesMs: lengthMs } : null,
  })
}

/**
 * A **card** in place of the menu (owner, 2026-09-27 to 2026-09-30, feedback F23, F32, F58, F70, F71):
 * the row that opened it as its header on the panel's first line, drawn active — `[e] Explore Map  >`,
 * or `[1] Barracks  >` while a building is being placed, its own hotkey, which ends it — its flashes
 * playing there; a separator across the panel (`-` in ASCII, `─` in Unicode); and under it the card
 * itself — in Explore Map whatever is under the cursor, following it as it moves; while placing, the
 * building about to be placed ("This will create visual consistency for anything that gains focus on
 * the map"). No credits (F71) and no Start Pulse: both belong to the menu. A click anywhere on the
 * panel goes back, as Esc does.
 */
function drawCardPanel(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack, look: CardLook): void {
  const { context, state, layout } = input
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const entry = cardEntry(state)
  const header = entry === null ? null : menuRowSpec(input, entry)
  if (header !== null) drawMenuRow(cells, layout, layout.panelRow + CARD_HEADER_ROW, header, look.capability)
  const separator = cells.length
  text(cells, BANDS.chrome, column, layout.panelRow + CARD_SEPARATOR_ROW, chromeGlyph(pack, "horizontal").repeat(limit), "chrome.frame", { limit })
  fadeFrom(cells, separator, look.hidden, look.capability)
  const top = layout.panelRow + CARD_FIRST_ROW

  if (state.armed !== null) {
    const item = context.catalog[state.armed]
    if (item !== undefined) drawBuildingCard(cells, input, top, item.contentId, "to build", look)
    return
  }
  const structure = structureAtTile(context, state.planned, state.cursor)
  if (structure === null) drawGroundCard(cells, input, pack, top, look)
  else drawBuildingCard(cells, input, top, structure.contentId, structure.planned ? "planned" : "standing", look)
}

/** A bare tile's card: its own glyph, what it is, what it means, and where it is. */
function drawGroundCard(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack, top: number, look: CardLook): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const terrainId = context.grid.tiles[state.cursor.y * context.grid.width + state.cursor.x] ?? "terrain.plain"
  const { glyph, role } = terrainGlyph(terrainId, pack)
  const icon = cells.length
  put(cells, band, column, top, glyph === " " ? "." : glyph, role, {})
  fadeFrom(cells, icon, look.hidden, look.capability)
  const terrain = TERRAIN_INFO[terrainId] ?? { name: "Ground", line: "" }
  text(cells, band, column + 3, top, look.typed(terrain.name), "chrome.title", { bold: true, limit: limit - 3 })
  text(cells, band, column, top + 2, look.typed(terrain.line), "chrome.value", { limit })
  const tile = cells.length
  text(cells, band, column, top + 4, "TILE", "chrome.label", { limit })
  rightAlign(cells, layout, top + 4, `${state.cursor.x},${state.cursor.y}`, "chrome.value")
  fadeFrom(cells, tile, look.hidden, look.capability)
}

/**
 * One building's card — the same for the building under the cursor in Explore Map and for the one being
 * placed (feedback F58): its own glyphs as its icon, its name with a word under it on where it stands
 * ("planned", "standing", "to build"), what it does, wrapped at words and never cut, then its numbers
 * as label/value rows — cost, health, size, attack — as many as the panel has room for. A first version
 * of the presentation card the owner described; the larger art and live stats during a Pulse come later.
 * While the card is being revealed (F68) its icon plays the building's placement frames — the very
 * frames a building going up on the map plays (`placementSchedule`, `placementLook`) — squeezed into the
 * card's beat, and its words are typed.
 */
function drawBuildingCard(
  cells: BandCell[],
  input: BuildCompositionInput,
  top: number,
  contentId: string,
  subtitle: string,
  look: CardLook,
): void {
  const { context, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  let row = top

  const definition = context.registry.get(contentId)
  const art = CONTENT_ART[contentId] ?? [definition.short.charAt(0)]
  const artWidth = Math.max(...art.map((line) => line.length))
  const rising =
    look.icon === null
      ? null
      : placementSchedule(
          { ordinal: 0, contentId, anchor: { x: 0, y: 0 } },
          definition.footprint,
          false,
          { placeFramesMs: look.icon.framesMs, placeGlowMs: 0, placeSparks: 0 },
        )
  art.forEach((line, index) => {
    ;[...line].forEach((character, offset) => {
      if (rising !== null && look.icon !== null) {
        const frame = placementLook(rising, contentId, { x: offset, y: index }, look.icon.elapsedMs)
        if (frame.glyph !== null) put(cells, band, column + offset, row + index, frame.glyph, playerRole("A"), frame.bold ? { bold: true } : {})
        return
      }
      const glyph = entityGlyph(contentId, "A", { x: offset, y: index })
      put(cells, band, column + offset, row + index, glyph === "?" ? character : glyph, playerRole("A"), { bold: true })
    })
  })
  const nameColumn = column + artWidth + 2
  text(cells, band, nameColumn, row, look.typed(displayName(context, contentId)), "chrome.title", {
    bold: true,
    limit: column + limit - nameColumn,
  })
  text(cells, band, nameColumn, row + 1, look.typed(subtitle), "chrome.muted", { limit: column + limit - nameColumn })
  row += Math.max(art.length, 2) + 1

  const item = context.catalog.find((candidate) => candidate.contentId === contentId)
  const line = item?.effect ?? (definition.nexus === true ? "Your base. Lose it, lose the Pulse." : "")
  // Wrapped at word boundaries: the panel is 28 glyphs wide at the floor, and a description cut
  // mid-sentence was the first thing the screenshots of this panel showed (2026-09-27).
  for (const wrapped of wrapWords(line, limit)) {
    if (row > menuFloor(layout)) return
    text(cells, band, column, row, look.typed(wrapped), "chrome.value", { limit })
    row += 1
  }
  if (line !== "") row += 1
  const size = footprintExtent(definition.footprint)
  const stats: [string, string][] = []
  if (item !== undefined) stats.push(["COST", String(item.cost)])
  stats.push(["HEALTH", String(definition.maxHp)], ["SIZE", `${size.width}x${size.height}`])
  if (definition.attack !== undefined) {
    stats.push(["ATTACK", `${definition.attack.damage} at range ${definition.attack.range}`])
  }
  const numbers = cells.length
  for (const [label, value] of stats) {
    if (row > menuFloor(layout)) break
    text(cells, band, column, row, label, "chrome.label", { limit })
    rightAlign(cells, layout, row, value, "chrome.value")
    row += 1
  }
  fadeFrom(cells, numbers, look.hidden, look.capability)
}

/** What a bare tile is, for the information panel. */
const TERRAIN_INFO: Readonly<Record<string, Readonly<{ name: string; line: string }>>> = {
  "terrain.plain": { name: "Open ground", line: "You can build here." },
  "terrain.rock": { name: "Rock", line: "Blocks building and movement." },
  "terrain.deposit": { name: "Deposit", line: "Resources lie here." },
}
