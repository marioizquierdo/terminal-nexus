// How what a level offers becomes what the Build Phase offers — its build menu and its Nexus Pulse's hand — and the
// starter content the screen opens on: what PERIMETER, the first level of Vasse's campaign, offers.
//
// What can be built and drafted is not chosen here: it is the level's offer (`src/armies`), everything its
// campaign has unlocked by then. The starter map is the map table's (`./maps.ts`), re-exported here so the
// screens keep reading it where they always have.

import { PERIMETER_LEVEL } from "../armies/index.ts"
import type { BuildingCard, Offer } from "../armies/types.ts"
import { CARD_TEXT } from "../content/cards.ts"
import type { ConstructItem, NexusPowerOption } from "./types.ts"

export { STARTER_EDGE_STYLE, STARTER_GRID_SIZE, STARTER_STANDING, STARTER_START_CURSOR, starterGrid } from "./maps.ts"

/**
 * An offer's build menu: its buildings in the order they were unlocked, each row's digit its place in that
 * order (a level that unlocks a building puts it after the ones already there, so no hotkey moves). A row's
 * label is the building's card title, so a building says the same about itself wherever it is named
 * (`src/content/cards.ts`). A building that makes units carries what it spawns, as its army's card says.
 */
export function constructMenu(offer: Pick<Offer, "buildings">): ConstructItem[] {
  return offer.buildings.map((card, index) => constructItem(card, index))
}

/** A building card as the build menu's row number `index` (from 0): its digit, its structure, its card
 *  title, its cost and what it spawns. */
export function constructItem(card: BuildingCard, index: number): ConstructItem {
  return {
    hotkey: String(index + 1),
    contentId: card.structure,
    label: CARD_TEXT[card.structure]?.title ?? card.structure,
    cost: card.cost,
    ...(card.spawns === undefined ? {} : { spawns: card.spawns }),
  }
}

/** Nexus powers as the popup offers them, by digit in the order given: a dealt hand, or an offer's every power. */
export function nexusDraftOf(offer: Pick<Offer, "powers">): NexusPowerOption[] {
  return offer.powers.map((card, index) => ({
    hotkey: String(index + 1),
    name: card.name,
    description: card.description,
    bonusAllotment: "credits" in card.effect ? card.effect.credits : 0,
    card,
  }))
}

/** What the Build Phase can spend its credits on: the buildings PERIMETER offers. */
export const STARTER_CATALOG: readonly ConstructItem[] = constructMenu(PERIMETER_LEVEL.offer)

/** What the player has to spend: PERIMETER's credits. How a resource is *earned* is the worker-economy
 *  milestone's; this is an opening allotment and nothing more. */
export const STARTER_ALLOTMENT = PERIMETER_LEVEL.offer.credits

/** Every Nexus power PERIMETER offers, in its order: what a hand is dealt from. */
export const STARTER_NEXUS_DRAFT: readonly NexusPowerOption[] = nexusDraftOf(PERIMETER_LEVEL.offer)
