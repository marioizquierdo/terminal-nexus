// How what a side is offered becomes what the Build Phase offers: its build menu and its Nexus Pulse's hand.
//
// What can be built and drafted is not chosen here: it is the side's army (`src/armies`, `src/battle/`).

import { creditsOf } from "../armies/index.ts"
import type { BuildingCard, Offer } from "../armies/types.ts"
import { CARD_TEXT } from "../content/cards.ts"
import type { ConstructItem, NexusPowerOption } from "./types.ts"

/** Where the Build Phase's cursor opens when the round names no Nexus to open on: the starter map's Nexus, its centre
 *  tile (`saves/starter.save.json`; a test holds the two together). */
export const STARTER_START_CURSOR = { x: 18, y: 10 } as const

/**
 * An offer's build menu: its buildings in order, each row's digit its place in that order (a building a Nexus power
 * adds goes after the ones already there, so no hotkey moves). A row's
 * label is the building's card title, so a building says the same about itself wherever it is named
 * (`src/content/cards.ts`). A building that makes units carries what it spawns, as its army's card says.
 */
export function constructMenu(offer: Pick<Offer, "buildings" | "addable">): ConstructItem[] {
  const cards = [...offer.buildings, ...offer.addable]
  return offer.buildings.map((card, index) => constructItem(card, index, cards))
}

/** A building card as the build menu's row number `index` (from 0): its digit, its structure, its card
 *  title, its cost, what it spawns, and the structures it needs standing (its `requires`, found among `cards`). */
export function constructItem(card: BuildingCard, index: number, cards: readonly BuildingCard[] = []): ConstructItem {
  const needs = (card.requires ?? []).flatMap((id) => cards.find((other) => other.id === id)?.structure ?? [])
  return {
    hotkey: String(index + 1),
    contentId: card.structure,
    label: CARD_TEXT[card.structure]?.title ?? card.structure,
    cost: card.cost,
    ...(card.spawns === undefined ? {} : { spawns: card.spawns }),
    ...(needs.length === 0 ? {} : { needs }),
    ...((card.actions ?? []).length === 0 ? {} : { actions: card.actions }),
  }
}

/** Nexus powers as the popup offers them, by digit in the order given: a dealt hand, or an offer's every power. */
export function nexusDraftOf(offer: Pick<Offer, "powers">): NexusPowerOption[] {
  return offer.powers.map((card, index) => ({
    hotkey: String(index + 1),
    name: card.name,
    description: card.description,
    bonusAllotment: creditsOf(card.effect),
    card,
  }))
}
