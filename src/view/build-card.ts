// Cards: what replaces the menu while something has the map's attention — Explore Map's (what is under
// the cursor) or a building's (the one being placed) — and the card reveal that turns the menu into one.
// What a card says is data built elsewhere (`src/build/card.ts`, from `src/content/cards.ts`); this file
// only draws it.

import type { Card, CardIcon } from "../build/card.ts"
import { currentCard } from "../build/card.ts"
import type { BuildLayout } from "../build/layout.ts"
import { CARD_FIRST_ROW, CARD_HEADER_ROW, CARD_SEPARATOR_ROW, menuEntryRow, menuFloor } from "../build/layout.ts"
import { wrapWords } from "../build/popup.ts"
import { cardEntry, menuEntries } from "../build/state.ts"
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

/** The screen row a card's header is drawn on: the panel's first line. */
export const cardHeaderRow = (layout: BuildLayout): number => layout.panelRow + CARD_HEADER_ROW

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
  const header = cardHeaderRow(layout)
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
 * itself (`currentCard`) — in Explore Map whatever is under the cursor, following it as it moves; while
 * placing, the building about to be placed ("This will create visual consistency for anything that
 * gains focus on the map"). No credits (F71) and no Start Pulse: both belong to the menu. A click
 * anywhere on the panel goes back, as Esc does.
 */
function drawCardPanel(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack, look: CardLook): void {
  const { context, state, layout } = input
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const entry = cardEntry(state)
  const header = entry === null ? null : menuRowSpec(input, entry)
  if (header !== null) drawMenuRow(cells, layout, cardHeaderRow(layout), header, look.capability)
  const separator = cells.length
  text(cells, BANDS.chrome, column, layout.panelRow + CARD_SEPARATOR_ROW, chromeGlyph(pack, "horizontal").repeat(limit), "chrome.frame", { limit })
  fadeFrom(cells, separator, look.hidden, look.capability)
  const card = currentCard(context, state)
  if (card !== null) drawCardBody(cells, input, pack, layout.panelRow + CARD_FIRST_ROW, card, look)
}

/**
 * One card, drawn one way (feedback F84: "title, subtitle, description, stats"): its icon — a building's
 * own glyphs, or a bare tile's — with its title beside it and its subtitle under the title, wrapped
 * there should it ever be wider than the room beside the icon; then its description, wrapped between
 * words and never cut; then its numbers as label/value rows, as many as the panel has room for. The
 * same for every card: a building being placed, a planned or standing one, open ground, rock, a deposit.
 *
 * **The one place a card's look would change with where it shows** — placing a building (whose title
 * the header row above already says: "the title may not be needed when building"), exploring in the
 * Build Phase, exploring during a Pulse (live health, say). The owner left those for later polish
 * rounds; a later round passes that setting here and changes only this function, never the card's data.
 *
 * While the card is being revealed (F68) its words are typed in reading order — title, subtitle,
 * description — its numbers and a tile's icon fade in, and a building's icon plays the building's
 * placement frames, the very frames a building going up on the map plays (`placementSchedule`,
 * `placementLook`), squeezed into the card's beat.
 */
function drawCardBody(
  cells: BandCell[],
  input: BuildCompositionInput,
  pack: GlyphPack,
  top: number,
  card: Card,
  look: CardLook,
): void {
  const { layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const floor = menuFloor(layout)

  const icon = drawCardIcon(cells, input, top, card.icon, pack, look)
  const textColumn = column + icon.width + 2
  const textLimit = column + limit - textColumn
  text(cells, band, textColumn, top, look.typed(card.title), "chrome.title", { bold: true, limit: textLimit })
  const subtitle = wrapWords(card.subtitle, textLimit)
  subtitle.forEach((line, index) => {
    text(cells, band, textColumn, top + 1 + index, look.typed(line), "chrome.muted", { limit: textLimit })
  })
  let row = top + Math.max(icon.height, 1 + subtitle.length) + 1

  // Wrapped at word boundaries: the panel is 27 glyphs wide at the floor, and a description cut
  // mid-sentence was the first thing the screenshots of this panel showed (2026-09-27). The words are
  // written to fit (`src/content/cards.ts`, and a test draws every card at 80 x 24); the floor is only
  // a guard.
  const description = wrapWords(card.description, limit)
  for (const line of description) {
    if (row > floor) return
    text(cells, band, column, row, look.typed(line), "chrome.value", { limit })
    row += 1
  }
  if (description.length > 0) row += 1

  const numbers = cells.length
  for (const stat of card.stats) {
    if (row > floor) break
    text(cells, band, column, row, stat.label, "chrome.label", { limit })
    rightAlign(cells, layout, row, stat.value, "chrome.value")
    row += 1
  }
  fadeFrom(cells, numbers, look.hidden, look.capability)
}

/** A card's icon at `top`: a thing's own glyphs as its side draws them — or, while the card is
 *  revealed, its placement frames — or a bare tile's glyph, fading in. Returns the room it took. */
function drawCardIcon(
  cells: BandCell[],
  input: BuildCompositionInput,
  top: number,
  icon: CardIcon,
  pack: GlyphPack,
  look: CardLook,
): Readonly<{ width: number; height: number }> {
  const band = BANDS.chrome
  const column = input.layout.panelColumn
  if (icon.kind === "terrain") {
    const { glyph, role } = terrainGlyph(icon.terrainId, pack)
    const from = cells.length
    put(cells, band, column, top, glyph === " " ? "." : glyph, role, {})
    fadeFrom(cells, from, look.hidden, look.capability)
    return { width: 1, height: 1 }
  }
  const { contentId } = icon
  // Whose it is: the player's own, or the raid's — a unit on the map after a round (gate 6B).
  const player = icon.player ?? "A"
  const definition = input.context.registry.get(contentId)
  const art = CONTENT_ART[contentId] ?? [definition.short.charAt(0)]
  // Only a building rises through placement frames as its card opens; a unit's icon is simply itself.
  const rising =
    look.icon === null || definition.layer !== "obstacles"
      ? null
      : placementSchedule(
          { ordinal: 0, contentId, anchor: { x: 0, y: 0 } },
          definition.footprint,
          false,
          { placeFramesMs: look.icon.framesMs, placeGlowMs: 0, placeSparks: 0 },
        )
  art.forEach((line, index) => {
    ;[...line].forEach((_drawn, offset) => {
      if (rising !== null && look.icon !== null) {
        const frame = placementLook(rising, contentId, { x: offset, y: index }, look.icon.elapsedMs)
        if (frame.glyph !== null) put(cells, band, column + offset, top + index, frame.glyph, playerRole("A"), frame.bold ? { bold: true } : {})
        return
      }
      put(cells, band, column + offset, top + index, entityGlyph(contentId, player, { x: offset, y: index }), playerRole(player), { bold: true })
    })
  })
  return { width: Math.max(...art.map((line) => line.length)), height: art.length }
}
