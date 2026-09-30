// A card, as data (owner, 2026-09-30, feedback F84: "the cards have title, subtitle, description,
// stats"): what the side panel shows in place of the menu while something has the map's attention —
// the building being placed, or in Explore Map whatever is under the cursor. Built here, in one place,
// from the content's own words (`src/content/cards.ts`) and numbers (the content definition, the
// catalog); drawn by one function (`src/view/build-card.ts`), which is where a later round would make it
// look different while placing, exploring in the Build Phase, or exploring during a Pulse.
//
// No status line: whether a building is planned, standing or about to be placed "is obvious from the
// rest of the UI" (F84), so a card says only what the thing is.

import { footprintExtent } from "../grid/coords.ts"
import type { Coord, TerrainId } from "../grid/types.ts"
import { CARD_TEXT } from "../content/cards.ts"
import type { CardText } from "../content/cards.ts"
import type { BuildContext, BuildState } from "./state.ts"
import { structureAtTile } from "./state.ts"

/** What a card's icon is: a thing's own glyphs, or a bare tile's. The view resolves either to glyphs. */
export type CardIcon = Readonly<{ kind: "entity"; contentId: string }> | Readonly<{ kind: "terrain"; terrainId: TerrainId }>

/** One of a card's numbers, as a label/value row. */
export type CardStat = Readonly<{ label: string; value: string }>

export type Card = Readonly<{
  icon: CardIcon
  /** The thing's name. */
  title: string
  /** One short line on what it is for, beside the icon under the title. */
  subtitle: string
  /** A few plain sentences more, wrapped under the icon. */
  description: string
  /** Its numbers: cost, health, size, attack — or a bare tile's position. */
  stats: readonly CardStat[]
}>

/** A thing's words, or — for content nobody has written a card for yet — its short name and nothing
 *  more, so a new piece of content still shows a card rather than breaking one. */
export function cardText(context: Pick<BuildContext, "registry">, id: string): CardText {
  const written = CARD_TEXT[id]
  if (written !== undefined) return written
  const short = context.registry.get(id).short
  return { title: short.charAt(0).toUpperCase() + short.slice(1), subtitle: "", description: "" }
}

/** What the card shows right now: the building being placed, else — in Explore Map — the building or
 *  the bare tile under the cursor. `null` only when nothing is armed and no card would show; the caller
 *  asks `cardShowing` first. */
export function currentCard(context: BuildContext, state: BuildState): Card | null {
  if (state.armed !== null) {
    const item = context.catalog[state.armed]
    return item === undefined ? null : entityCard(context, item.contentId)
  }
  const structure = structureAtTile(context, state.planned, state.cursor)
  return structure === null ? groundCard(context, state.cursor) : entityCard(context, structure.contentId)
}

/** A building's card — the same whether it is being placed, planned or standing (F58, F84): its words,
 *  then its cost where the menu sells it, its health and size, and its attack where it has one. */
export function entityCard(context: Pick<BuildContext, "registry" | "catalog">, contentId: string): Card {
  const definition = context.registry.get(contentId)
  const item = context.catalog.find((candidate) => candidate.contentId === contentId)
  const size = footprintExtent(definition.footprint)
  const stats: CardStat[] = []
  if (item !== undefined) stats.push({ label: "COST", value: String(item.cost) })
  stats.push({ label: "HEALTH", value: String(definition.maxHp) }, { label: "SIZE", value: `${size.width}x${size.height}` })
  if (definition.attack !== undefined) {
    stats.push({ label: "ATTACK", value: `${definition.attack.damage} at range ${definition.attack.range}` })
  }
  return { icon: { kind: "entity", contentId }, ...cardText(context, contentId), stats }
}

/** A bare tile's card: what the ground is, and where. */
export function groundCard(context: Pick<BuildContext, "grid">, tile: Coord): Card {
  const terrainId = context.grid.tiles[tile.y * context.grid.width + tile.x] ?? "terrain.plain"
  const text = CARD_TEXT[terrainId] ?? { title: "Ground", subtitle: "", description: "" }
  return { icon: { kind: "terrain", terrainId }, ...text, stats: [{ label: "TILE", value: `${tile.x},${tile.y}` }] }
}
