// A card, as data (the owner: "the cards have title, subtitle, description, stats"): what the side panel shows in place of the menu while something has the map's attention —
// the building being placed, or in Explore Map whatever is under the cursor. Built here, in one place,
// from the content's own words (`src/content/cards.ts`) and numbers (the content definition, the
// catalog); drawn by one function (`src/view/build-card.ts`), which is where a later round would make it
// look different while placing, exploring in the Build Phase, or exploring during a Pulse.
//
// No status line: whether a building is planned, standing or about to be placed "is obvious from the
// rest of the UI", so a card says only what the thing is.

import { footprintExtent, tilesOf } from "../grid/coords.ts"
import { TICKS_PER_SECOND } from "../scenario/load.ts"
import type { SettingSource } from "./all-settings.ts"
import { setting } from "./all-settings.ts"
import type { FieldEntity, IncomingEntity } from "./types.ts"
import type { Coord, TerrainId } from "../grid/types.ts"
import { CARD_TEXT } from "../content/cards.ts"
import type { CardText } from "../content/cards.ts"
import type { BuildContext, BuildState } from "./state.ts"
import { structureAtTile } from "./state.ts"

/** What a card's icon is: a thing's own glyphs, or a bare tile's. The view resolves either to glyphs. */
export type CardIcon =
  | Readonly<{ kind: "entity"; contentId: string; player?: "A" | "B" }>
  | Readonly<{ kind: "terrain"; terrainId: TerrainId }>

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
    return item === undefined ? null : entityCard(context, item.contentId, state)
  }
  const structure = structureAtTile(context, state.planned, state.cursor)
  if (structure !== null) return entityCard(context, structure.contentId, state)
  const field = (context.field ?? []).find((entity) => covers(context, entity, state.cursor))
  if (field !== undefined) return fieldCard(context, field, state)
  const incoming = (context.incoming ?? []).find((entity) => covers(context, entity, state.cursor))
  if (incoming !== undefined) return incomingCard(context, incoming, state)
  return groundCard(context, state.cursor)
}

const covers = (context: Pick<BuildContext, "registry">, entity: Readonly<{ contentId: string; anchor: Coord }>, tile: Coord): boolean =>
  tilesOf(entity.anchor, context.registry.get(entity.contentId).footprint).some((t) => t.x === tile.x && t.y === tile.y)

/** How much a thing can take: its content's health, or — for a Commander, while the Experiment "Vasse's
 *  health" is tuned — the Experiment's, which is what the Pulse will run on. */
function maxHpOf(context: Pick<BuildContext, "registry">, contentId: string, state?: SettingSource): number {
  const definition = context.registry.get(contentId)
  return definition.commander === true && state !== undefined ? setting(state, "commanderHealth") : definition.maxHp
}

/** A thing's health and attack, the numbers a unit's card shows. */
function fightStats(context: Pick<BuildContext, "registry">, contentId: string, hp?: number, state?: SettingSource): CardStat[] {
  const definition = context.registry.get(contentId)
  const max = maxHpOf(context, contentId, state)
  const stats: CardStat[] = [{ label: "HEALTH", value: hp === undefined ? String(max) : `${Math.min(hp, max)}/${max}` }]
  if (definition.attack !== undefined) {
    stats.push({ label: "ATTACK", value: `${definition.attack.damage} at range ${definition.attack.range}` })
  }
  return stats
}

/** Something on the map after a round — a survivor of either side, or the raid's structure: its
 *  words, whose it is, and its health as it stands now. */
export function fieldCard(context: Pick<BuildContext, "registry">, entity: FieldEntity, state?: SettingSource): Card {
  return {
    icon: { kind: "entity", contentId: entity.contentId, player: entity.player },
    ...cardText(context, entity.contentId),
    stats: [{ label: "SIDE", value: entity.player === "A" ? "yours" : "the raid" }, ...fightStats(context, entity.contentId, entity.hp, state)],
  }
}

/** A unit the next round will bring ("see what is coming"): what it is, when it arrives, and —
 *  where its group has one — what it means to do, in place of its description. */
export function incomingCard(context: Pick<BuildContext, "registry">, entity: IncomingEntity, state?: SettingSource): Card {
  const text = cardText(context, entity.contentId)
  const seconds = Math.round(entity.tick / TICKS_PER_SECOND)
  return {
    icon: { kind: "entity", contentId: entity.contentId, player: entity.player },
    title: text.title,
    subtitle: entity.player === "A" ? "Yours, next round" : "Incoming",
    description: entity.intent ?? text.description,
    stats: [{ label: "ARRIVES", value: seconds === 0 ? "as the round starts" : `${seconds}s in` }, ...fightStats(context, entity.contentId, undefined, state)],
  }
}

/** How often a building the mission trains with trains, at the pace the Experiments set now — what a
 *  Barracks's card says — or `null` for a building that trains nothing. */
export function trainsStat(context: Pick<BuildContext, "trains">, contentId: string, state: SettingSource): CardStat | null {
  if (!(context.trains ?? []).some((entry) => entry.structure === contentId)) return null
  return { label: "TRAINS", value: `1 per ${setting(state, "trainEvery")}s, ${setting(state, "trainPerRound")} a round` }
}

/** A building's card — the same whether it is being placed, planned or standing: its words,
 *  then its cost where the menu sells it, its health and size, its attack where it has one, and what it
 *  trains where the mission has it train. */
export function entityCard(
  context: Pick<BuildContext, "registry" | "catalog" | "trains">,
  contentId: string,
  state?: SettingSource,
): Card {
  const definition = context.registry.get(contentId)
  const item = context.catalog.find((candidate) => candidate.contentId === contentId)
  const size = footprintExtent(definition.footprint)
  const stats: CardStat[] = []
  if (item !== undefined) stats.push({ label: "COST", value: String(item.cost) })
  stats.push({ label: "HEALTH", value: String(definition.maxHp) }, { label: "SIZE", value: `${size.width}x${size.height}` })
  if (definition.attack !== undefined) {
    stats.push({ label: "ATTACK", value: `${definition.attack.damage} at range ${definition.attack.range}` })
  }
  const trains = state === undefined ? null : trainsStat(context, contentId, state)
  if (trains !== null) stats.push(trains)
  return { icon: { kind: "entity", contentId }, ...cardText(context, contentId), stats }
}

/** A bare tile's card: what the ground is, and where. */
export function groundCard(context: Pick<BuildContext, "grid">, tile: Coord): Card {
  const terrainId = context.grid.tiles[tile.y * context.grid.width + tile.x] ?? "terrain.plain"
  const text = CARD_TEXT[terrainId] ?? { title: "Ground", subtitle: "", description: "" }
  return { icon: { kind: "terrain", terrainId }, ...text, stats: [{ label: "TILE", value: `${tile.x},${tile.y}` }] }
}
