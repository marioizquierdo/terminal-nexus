// The Build Phase's menu: its rows — two states (highlighted, active) and two acknowledgements
// (pressed, refused) — the credits line, and the side panel as the menu. The highlight bar and the
// pressed look are drawn here for every row that has them, the popups' included.

import type { BuildLayout } from "../build/layout.ts"
import { CREDITS_ROW, START_KEY, START_LABEL, menuEntryRow } from "../build/layout.ts"
import type { BuildContext, BuildState } from "../build/state.ts"
import {
  EXPLORE_ENTRY,
  NEXUS_ENTRY,
  cardEntry,
  entryOfConstruct,
  exploring,
  menuEntries,
  nexusPowers,
  pendingPicks,
  remaining,
  startEntry,
} from "../build/state.ts"
import type { Popup } from "../build/types.ts"
import type { BandCell, CellStyle } from "./frame.ts"
import { BANDS } from "./frame.ts"
import type { DrawExtra } from "./draw.ts"
import { put, text } from "./draw.ts"
import type { CapabilityMode, StyleRole } from "./roles.ts"
import { terrainGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import type { BuildCompositionInput, RowAck } from "./build.ts"
import { drawRaidPanel } from "./raid-panel.ts"

/** A bar under a row: the role every part on it takes, and the weight it adds to them. */
type Bar = Readonly<{ role: StyleRole; bold: boolean; underline: boolean }>

/**
 * The **highlight bar**: the keyboard is on this row and has not chosen it yet — the row in reverse
 * video, in one role. The same bar on the menu and in every popup's list.
 */
export const HIGHLIGHT_BAR: Bar = { role: "chrome.title", bold: false, underline: false }

/**
 * The **pressed** look, a menu row's acknowledgement the moment it is activated: the bar in the hotkey's
 * colour, bold and underlined — stronger than the highlight at every tier, monochrome included. The
 * cursor's blink borrows it (Mario: "the same exact effect as the one we use when selecting menu
 * items").
 */
export const PRESSED_LOOK: Bar = { role: "chrome.hotkey", bold: true, underline: true }

/** The column `value` starts at, right-aligned against the panel's own right edge — a column of costs
 *  reads as a column only if the numbers line up. */
const rightColumn = (layout: BuildLayout, value: string): number => layout.panelColumn + layout.panelLimit - value.length

/** `value` right-aligned against the panel's own right edge (`rightColumn`). */
export function rightAlign(cells: BandCell[], layout: BuildLayout, row: number, value: string, role: StyleRole, extra: DrawExtra = {}): void {
  text(cells, BANDS.chrome, rightColumn(layout, value), row, value, role, extra)
}

/** Fill `limit` cells of `row` from `column` with `bar`: the row's background, reversed. */
export function drawHighlightBar(cells: BandCell[], column: number, row: number, limit: number, bar: Bar = HIGHLIGHT_BAR): void {
  text(cells, BANDS.chrome, column, row, " ".repeat(limit), bar.role, { inverse: true, bold: bar.bold, underline: bar.underline, limit })
}

/** Draws one part of a row — a hotkey, a label, a value — at column `x`, in its own role and weight. */
type RowPart = (x: number, value: string, role: StyleRole, extra?: DrawExtra) => void

/**
 * How the parts of `row` are drawn on `bar` (drawn first, by `drawHighlightBar`): every part in the
 * bar's role, reversed, with the bar's weight added to its own, so the row reads as one bar rather
 * than a teal block, a white block and a grey one side by side. With no bar, each part is
 * drawn as itself.
 */
export function rowParts(cells: BandCell[], row: number, bar: Bar | null): RowPart {
  return (x, value, role, extra = {}) => {
    if (bar === null) {
      text(cells, BANDS.chrome, x, row, value, role, extra)
      return
    }
    text(cells, BANDS.chrome, x, row, value, bar.role, {
      ...extra,
      inverse: true,
      bold: extra.bold === true || bar.bold,
      underline: extra.underline === true || bar.underline,
    })
  }
}

/**
 * One menu row, as it is drawn: what `drawMenuRow` needs, and all it needs. A menu row has **two
 * states** — *highlighted* (the keyboard is on it, not yet chosen) and *active* (its action is under
 * way, `menuRowActive`) — and **two brief acknowledgements**, *pressed* and *refused*, played on top of
 * whichever it is. A row that costs more than is left is also *disabled* (dim).
 */
type MenuRowSpec = Readonly<{
  hotkey: string
  label: string
  /** Drawn straight after the label in the hotkey's colour — the pending count on "Nexus". */
  badge?: string
  /** Right-aligned against the divider: a cost, or how many powers are active. */
  value?: string
  active: boolean
  /** The keyboard's bar: only while the menu has the keyboard, and never on an active row. */
  highlighted: boolean
  /**
   * The acknowledgement playing on the row, if any. **Pressed**: a brief, stronger bar the moment a row
   * is activated. **Refused** (Mario: "it should probably just grey out the
   * text and not change the background"): for its few frames the row's words turn grey and nothing
   * else changes — the highlight stays the highlight, a plain row stays plain — so it reads as "nothing
   * here" rather than as a press.
   */
  ack: RowAck["kind"] | null
  disabled?: boolean
}>

/** What an active row shows at its right end in place of its value: an arrow pointing at the map, where
 *  the row's action is under way (Mario: "change the 'active in grid' arrow to
 *  just one '>'"). It keeps its own hotkey, so the key that chose it is the key that ends it. */
export const ACTIVE_VALUE = ">"

/**
 * Whether menu entry `entry`'s action is under way right now — **the one test for the "active" style**
 * every menu row shares: a building while it is armed, `[e] Explore
 * Map` while Explore Map is open, `[n] Nexus` while its popup is, `[s] Start Battle Round` while its
 * confirmation is. A menu row has two states and no more: *highlighted* by the keyboard (the bar, only
 * while the menu has the keyboard) and *active*.
 */
export function menuRowActive(context: BuildContext, state: BuildState, entry: number): boolean {
  if (state.committed) return false
  const popupRow = state.popup === null ? null : POPUP_ROW[state.popup]
  if (entry === NEXUS_ENTRY) return popupRow === "nexus"
  if (entry === EXPLORE_ENTRY) return exploring(state)
  if (entry === startEntry(context.catalog.length)) return popupRow === "start"
  return state.armed !== null && entryOfConstruct(state.armed) === entry
}

/**
 * Which menu row each popup belongs to, or `null` for one that belongs to none — said once, so every
 * new popup has to choose. A popup that belongs to a row keeps that row active behind it (the Nexus
 * powers, the Battle Round screen); one that belongs to none (the game menu, Settings, the export, the
 * Controls page, the Activity logs window, a message) leaves the menu unlit while it has the keyboard,
 * so its own highlight (or none) is the only one on screen.
 */
const POPUP_ROW: Readonly<Record<Popup, "nexus" | "start" | null>> = {
  "nexus-powers": "nexus",
  "battle-round": "start",
  "game-menu": null,
  settings: null,
  export: null,
  controls: null,
  "activity-logs": null,
  message: null,
  dialog: null,
}

/**
 * How a refused row's words are drawn, by tier — the only thing the flicker changes. On a plain
 * row: the grey muted role, dim, which greys them at every tier (monochrome and 16 colours, where the
 * muted grey is the value's own, by the dim alone). On the highlight bar: still the bar — inverse, in
 * the bar's role — with the words' colour, which inverse video takes from the background role, made
 * the grey: `chrome.muted` where colours blend, `chrome.edge` at 16 colours (the light theme draws the
 * bar and the muted role in the same ANSI black, so muted words would vanish into it rather than grey);
 * and in monochrome, which has no grey, the bar with its words dim. Never bold, never underlined, never
 * the hotkey's colour: always weaker than the pressed flash, which is all three.
 */
function refusedWords(bar: boolean, capability: CapabilityMode): CellStyle {
  if (!bar) return { fgRole: "chrome.muted", dim: true }
  if (capability === "monochrome") return { fgRole: HIGHLIGHT_BAR.role, inverse: true, dim: true }
  return { fgRole: HIGHLIGHT_BAR.role, bgRole: capability === "color16" ? "chrome.edge" : "chrome.muted", inverse: true }
}

/**
 * One entry of the side panel's menu. `[1] Barracks  >` says *active* — its action under way — and
 * the bar says *where the keyboard is, not yet chosen*. Every row is
 * drawn here, the menu's and a card's header alike, so a change to either style reaches every row that
 * has it.
 */
export function drawMenuRow(cells: BandCell[], layout: BuildLayout, row: number, entry: MenuRowSpec, capability: CapabilityMode): void {
  const column = layout.panelColumn
  const limit = layout.panelLimit
  // A pressed acknowledgement is drawn as its own bar, over the highlight or on a row without one.
  const bar = entry.ack === "pressed" ? PRESSED_LOOK : entry.highlighted ? HIGHLIGHT_BAR : null
  if (bar !== null) drawHighlightBar(cells, column, row, limit, bar)
  const part = rowParts(cells, row, bar)
  const words = cells.length
  // Active is not the keyboard's bar: the bar says "the keyboard is here, not
  // chosen yet", and an active row is chosen. It reads `[1] Barracks  >`: its own
  // hotkey — which ends it — the whole row in the hotkey's colour and bold, and one `>` at its right
  // end pointing at the map where it is under way; no underline. Legible in monochrome by the `>` and
  // the bold. A pressed acknowledgement on it still wins, drawn as the bar.
  const own: StyleRole = entry.active ? "chrome.hotkey" : "chrome.value"
  // A row that no longer fits the budget is dim; on a bar only its cost keeps the dimness, the one fact
  // it adds there.
  const dim = entry.disabled === true && bar === null
  let at = column
  const hotkey = `[${entry.hotkey}]`
  part(at, hotkey, "chrome.hotkey", { bold: true, dim, limit: column + limit - at })
  at += hotkey.length + 1
  part(at, entry.label, own, { bold: entry.active, dim, limit: column + limit - at })
  at += entry.label.length
  if (entry.badge !== undefined) part(at, entry.badge, "chrome.hotkey", { bold: true, dim, limit: column + limit - at })
  const value = entry.active ? ACTIVE_VALUE : entry.value
  if (value !== undefined) {
    part(rightColumn(layout, value), value, own, { bold: entry.active, dim: !entry.active && entry.disabled === true })
  }
  if (entry.ack === "refused") {
    const style = refusedWords(bar !== null, capability)
    for (let index = words; index < cells.length; index += 1) {
      const drawn = cells[index]
      if (drawn !== undefined && "cell" in drawn) cells[index] = { ...drawn, cell: { glyph: drawn.cell.glyph, style } }
    }
  }
}

/**
 * Whether the row for menu entry `entry` is highlighted right now, and which acknowledgement is playing
 * on it. **The highlight means one thing: the keyboard is on this row and has not chosen it yet**. So it is drawn only while the menu has focus, and not after the mouse worked the menu
 * (`highlightHidden` — a click chooses, it does not highlight); an active row is never highlighted — the
 * Nexus row behind its own popup included. A pressed acknowledgement is drawn as a stronger bar on
 * any row; a refused one greys the row's words over whatever it is.
 */
function rowState(input: BuildCompositionInput, entry: number, active: boolean): Readonly<{ highlighted: boolean; ack: RowAck["kind"] | null }> {
  const { state } = input
  const own = input.ack !== undefined && input.ack.entry === entry ? input.ack.kind : null
  // The row a card reveal from the menu carries up to the header is drawn active throughout, never
  // pressed: turning active and sliding up is its acknowledgement (Mario: "the
  // currently selected menu item that changed to the active state, then quickly interpolates (moves) the
  // item to the top"). The pressed flash outlasts the reveal's fade and slide, and would cover both.
  const carried = input.cardReveal?.fromMenu === true && cardEntry(state) === entry
  const ack = own === "pressed" && carried ? null : own
  // A popup that belongs to no row holds the keyboard with its own highlight: the menu's goes dark.
  const popupOfNoRow = state.popup !== null && POPUP_ROW[state.popup] === null
  const highlighted =
    !active && !popupOfNoRow && state.focus === "menu" && !state.highlightHidden && state.menuHighlight === entry
  return { highlighted, ack }
}

/**
 * Menu entry `entry` as a row: its hotkey, its label, what it shows at its right end, and how it is
 * drawn right now — the one description of every row, read by the menu and by a card's header alike,
 * so a row is the same wherever it shows. `null` for an entry the menu does not have.
 */
export function menuRowSpec(input: BuildCompositionInput, entry: number): MenuRowSpec | null {
  const { context, state } = input
  const target = menuEntries(context)[entry]
  if (target === undefined) return null
  const active = menuRowActive(context, state, entry)
  const look = { active, ...rowState(input, entry, active) }
  switch (target.kind) {
    case "explore":
      return { hotkey: "e", label: "Explore Map", ...look }
    case "nexus": {
      // Its "(1)" is the number of picks waiting — optional for now, so it stops nothing — drawn in the
      // hotkey's colour so it catches the eye without a popup forcing it.
      const pending = pendingPicks(context, state)
      const active = nexusPowers(context, state).active.length
      return {
        hotkey: "n",
        label: "Nexus Pulse",
        ...(pending > 0 ? { badge: ` (${pending})` } : {}),
        ...(active > 0 ? { value: `${active} active` } : {}),
        ...look,
      }
    }
    case "start":
      // Never dim: a Nexus power still waiting to be picked does not hold the round back (the owner, round 5:
      // "Nexus Powers should be optional for now"), and the Battle Round screen says it is waiting.
      return { hotkey: START_KEY, label: START_LABEL, ...look }
    case "construct": {
      const item = context.catalog[target.index]
      if (item === undefined) return null
      return {
        hotkey: item.hotkey,
        label: item.label,
        value: String(item.cost),
        ...look,
        disabled: item.cost > remaining(context, state),
      }
    }
  }
}

/**
 * The **credits line** (Mario: "they should be on the empty line right before
 * the build/construction list ... the same as the symbol used on the map to represent resources"): the
 * map's own resource-deposit glyph (`*` in ASCII, `◆` in Unicode, from the same table the map draws it
 * from, in the deposit's colour) and what there is to spend, right-aligned in the column the costs are
 * in — `◆ 130` — on the blank line above the first building. No label and no maximum. On the menu
 * alone: a card has none, so a card's top line is the row that opened it.
 */
function drawCredits(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack): void {
  const { context, state, layout } = input
  const row = layout.panelRow + CREDITS_ROW
  const amount = String(remaining(context, state))
  const deposit = terrainGlyph("terrain.deposit", pack)
  const end = layout.panelColumn + layout.panelLimit
  put(cells, BANDS.chrome, end - amount.length - 2, row, deposit.glyph, deposit.role, { bold: true })
  text(cells, BANDS.chrome, end - amount.length, row, amount, "chrome.title", { bold: true })
}

/**
 * The side panel as the menu (shaped over several playtests): `[e] Explore Map`,
 * `[n] Nexus` under it, the credits line, the buildings one to a row in catalog order, and
 * `[s] Start Battle Round` on its last line. No headings, no help text: what a row does, and why a placement
 * is refused, are the bottom line's to say, and there is no radius preview, because
 * nothing placed here has a radius. A row the panel is too short for is not drawn (`menuEntryRow` says
 * so, and the mouse reads the same answer). In the free rows between the buildings and Start Battle Round, the
 * coming raid (`raid-panel.ts`): information, not rows, so it fades and comes back with the menu.
 */
export function drawPanel(cells: BandCell[], input: BuildCompositionInput, pack: GlyphPack, capability: CapabilityMode): void {
  const { context, layout } = input
  drawCredits(cells, input, pack)
  menuEntries(context).forEach((target, entry) => {
    const row = menuEntryRow(layout, context.catalog, target)
    const spec = menuRowSpec(input, entry)
    if (row === null || spec === null) return
    drawMenuRow(cells, layout, row, spec, capability)
  })
  drawRaidPanel(cells, input)
}
