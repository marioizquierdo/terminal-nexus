// A run's draft (docs/game-design/runs.md, the army): after a battle is won, three cards dealt by the army's rarity and tier,
// and the player takes one, **or** removes a card the army holds, **or** takes requisition instead. The dealer is the
// Nexus Pulse's sibling at the next scale up (game-modes.md): it weighs rarity, gates by tier against the battle's place in the
// run, lifts the chance of a rare each time none is offered (the pity offset), and brings a family or role the offer
// lacks before it weighs rarity.
//
// Pure, and seeded: a draft is dealt from a stream of its own (`STREAM_RUN_DRAFT`) made of the run's seed and the battle
// it prepares — never of the path to it — so the same seed, army and pity deal the same three cards on every runtime.

import type { Rarity } from "../armies/index.ts"
import type { Roster } from "../duel/index.ts"
import { Pcg32, STREAM_RUN_DRAFT } from "../rng/pcg32.ts"
import type { RunCard } from "./army.ts"
import { keyOf, offerable, removable, withCard, withoutCard } from "./army.ts"

/** Cards a draft deals. */
export const DRAFT_SIZE = 3

/** What a rarity weighs in a draft before the pity offset: out of a hundred, a common 60, an uncommon 37, a rare 3
 *  (Slay the Spire's mechanism in spirit, game-modes.md). A legendary is not dealt by a run's draft. */
export const RARITY_WEIGHTS: Readonly<Record<Exclude<Rarity, "legendary">, number>> = { common: 60, uncommon: 37, rare: 3 }

/** The requisition a player takes instead of a draft (runs.md, rewards). */
export const REQUISITION_FOR_SKIPPING = 15

/** A draft on offer: the battle it prepares, the cards dealt, the cards the army could remove instead, and the
 *  requisition for taking neither. */
export type DraftOffer = Readonly<{
  battle: number
  cards: readonly RunCard[]
  removable: readonly RunCard[]
  requisition: number
}>

/** What the player chose: a card of the offer, a card of the army to remove, or the requisition. */
export type DraftChoice =
  | Readonly<{ kind: "take"; card: string }>
  | Readonly<{ kind: "remove"; card: string }>
  | Readonly<{ kind: "requisition" }>

/** A draft as the run keeps it: what was offered, and what was chosen. */
export type DraftRecord = Readonly<{ battle: number; offered: readonly string[]; choice: DraftChoice }>

/**
 * What each rarity of `present` weighs in a slot after `pity`: a rare's weight rises by the pity offset and a common's falls
 * by it (never below one), an uncommon's stays. A rarity not present weighs nothing and is left out.
 */
export function rarityWeights(present: ReadonlySet<Rarity>, pity: number): readonly Readonly<{ rarity: Rarity; weight: number }>[] {
  return (["common", "uncommon", "rare"] as const).flatMap((rarity) => {
    if (!present.has(rarity)) return []
    const base = RARITY_WEIGHTS[rarity]
    return [{ rarity, weight: rarity === "rare" ? base + pity : rarity === "common" ? Math.max(1, base - pity) : base }]
  })
}

/** What the pity offset adds to a rare's weight for each card dealt that was not rare, and takes from a common's. */
const PITY_STEP = 1

/**
 * The draft that prepares battle `battle` (counted from 1) for an army: up to three cards, and the pity offset after
 * them. A slot deals a card of a family the offer lacks, else of a role it lacks, else any; among those it picks a
 * rarity by weight (a rarity with no card left weighs nothing) and then a card of it by the stream. An offer holds fewer
 * than three when the army has run out of cards to be offered.
 */
export function dealDraft(input: Readonly<{ commander: string; roster: Roster; seed: number; battle: number; pity: number }>): Readonly<{ offer: DraftOffer; pity: number }> {
  const rng = Pcg32.seeded(BigInt(input.seed) * 1000n + BigInt(input.battle), STREAM_RUN_DRAFT)
  const left = offerable(input.commander, input.roster, input.battle)
  const cards: RunCard[] = []
  let pity = input.pity
  for (let slot = 0; slot < DRAFT_SIZE && left.length > 0; slot += 1) {
    const kinds = new Set(cards.map((card) => card.kind))
    const roles = new Set(cards.map((card) => card.role))
    const unseenKind = left.filter((card) => !kinds.has(card.kind))
    const unseenRole = left.filter((card) => !roles.has(card.role))
    const pool = unseenKind.length > 0 ? unseenKind : unseenRole.length > 0 ? unseenRole : left
    const weighted = rarityWeights(new Set(pool.map((card) => card.rarity)), pity)
    // A legendary is never dealt; a pool of nothing else deals nothing.
    if (weighted.length === 0) break
    let roll = rng.nextBelow(weighted.reduce((sum, entry) => sum + entry.weight, 0))
    let rarity = weighted[0]?.rarity ?? "common"
    for (const entry of weighted) {
      if (roll < entry.weight) {
        rarity = entry.rarity
        break
      }
      roll -= entry.weight
    }
    const options = pool.filter((card) => card.rarity === rarity)
    const card = options[rng.nextBelow(options.length)] as RunCard
    cards.push(card)
    left.splice(left.indexOf(card), 1)
    pity = rarity === "rare" ? 0 : pity + PITY_STEP
  }
  const offer: DraftOffer = { battle: input.battle, cards, removable: removable(input.commander, input.roster), requisition: REQUISITION_FOR_SKIPPING }
  return { offer, pity }
}

/** The army after a choice, or why it cannot be made: a card not on offer, one the army cannot remove. */
export function choose(roster: Roster, offer: DraftOffer, choice: DraftChoice): Readonly<{ roster: Roster; requisition: number }> | string {
  switch (choice.kind) {
    case "requisition":
      return { roster, requisition: offer.requisition }
    case "take": {
      const card = offer.cards.find((candidate) => keyOf(candidate) === choice.card)
      return card === undefined ? `${choice.card} is not among the cards on offer` : { roster: withCard(roster, card), requisition: 0 }
    }
    case "remove": {
      const card = offer.removable.find((candidate) => keyOf(candidate) === choice.card)
      return card === undefined ? `${choice.card} is not a card the army can remove` : { roster: withoutCard(roster, card), requisition: 0 }
    }
  }
}
