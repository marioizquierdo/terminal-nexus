// The Nexus Pulse's dealer: the hand the Grid Nexus deals as each round opens, from the army's Nexus power pool,
// one power to keep (commander-armies.md, how the Nexus Pulse deals). The Campaign deals it from what a level
// offers; Milestone 11's run draft reuses it at the next scale.
//
// A schedule says what each card of a round's hand is dealt from: a rarity, or a power a level makes sure of
// (`Schedule`, the game's `DEFAULT_SCHEDULE` or a level's own). A slot deals a power of its rarity, of a role the
// hand does not hold yet while the rarity has one, each as likely as its chance says this round; when its rarity
// has nothing left, the nearest lower rarity, then a higher one — never a legendary, which only a slot that asks
// for one deals. A power is dealt only while its requirements hold (a power kept, a building standing, a round
// reached), an upgrade only once the power it upgrades is kept, and a kept power never again unless it may be
// kept again (`repeatable`).
//
// Gameplay randomness, so seeded and repeatable: the same pool, the same powers kept, the same buildings standing,
// the same schedule, seed and round deal the same hand on every runtime, every time. It draws from a PCG32 stream of
// its own (`STREAM_DRAFT`), never the kernel's, so dealing a hand never moves a single draw of a battle. Pure: no
// clock, no state.

import { Pcg32, STREAM_DRAFT } from "../rng/pcg32.ts"
import type { PowerCard, Rarity, Schedule, ScheduleSlot } from "./types.ts"
import { RARITIES } from "./types.ts"

/**
 * What the Nexus Pulse deals when a level gives no schedule of its own: three cards a round, the ramp of the
 * design's first guess — one uncommon in the first round, two from the second, a rare from the fourth, and two
 * uncommons beside the rare from the sixth. Legendaries wait for the hand that deals them (a design for later).
 */
export const DEFAULT_SCHEDULE: Schedule = [
  { round: 1, deal: ["common", "common", "uncommon"] },
  { round: 2, deal: ["common", "uncommon", "uncommon"] },
  { round: 4, deal: ["common", "uncommon", "rare"] },
  { round: 6, deal: ["uncommon", "uncommon", "rare"] },
]

/** What a round's hand is dealt from, and for whom. */
export type Deal = Readonly<{
  /** The powers that can be dealt: a level's offer, in its own order. */
  pool: readonly PowerCard[]
  /** The powers kept this mission so far. */
  kept: readonly PowerCard[]
  /** The mission's seed. */
  seed: number
  /** The round the hand opens, counted from 1. */
  round: number
  /** What each card is dealt from. Absent: `DEFAULT_SCHEDULE`. */
  schedule?: Schedule
  /** The buildings standing for the player as the round opens, by building card id. Absent: none. */
  standing?: ReadonlySet<string>
}>

/** The slots of round `round`'s hand: the last entry of `schedule` that starts at or before it. */
export function slotsFor(schedule: Schedule, round: number): readonly ScheduleSlot[] {
  let slots: readonly ScheduleSlot[] = []
  for (const entry of schedule) if (entry.round <= round) slots = entry.deal
  return slots
}

/**
 * The cards a hand can be dealt from: the pool, in its own order, without the cards offered beside every hand
 * (`always`), without a card kept already unless it may be kept again (`repeatable`), and without a card whose
 * requirements do not hold this round — an upgrade before the power it upgrades is kept among them.
 */
export function dealable(pool: readonly PowerCard[], kept: readonly PowerCard[], round = 1, standing: ReadonlySet<string> = new Set()): PowerCard[] {
  const keptIds = new Set(kept.map((card) => card.id))
  const once = new Set(kept.filter((card) => card.repeatable !== true).map((card) => card.id))
  return pool.filter((card) => {
    if (card.always === true || once.has(card.id)) return false
    if (card.upgrades !== undefined && !keptIds.has(card.upgrades)) return false
    const requires = card.requires
    if (requires === undefined) return true
    return (
      (requires.powers ?? []).every((id) => keptIds.has(id)) &&
      (requires.buildings ?? []).every((id) => standing.has(id)) &&
      round >= (requires.round ?? 1)
    )
  })
}

/** The rarities a slot of `rarity` deals from, in order: its own; then each lower one, nearest first; then each
 *  higher one, nearest first, up to rare — a legendary is dealt only by a slot that asks for one. */
export function rarityOrder(rarity: Rarity): readonly Rarity[] {
  const at = RARITIES.indexOf(rarity)
  const lower = RARITIES.slice(0, at).reverse()
  const higher = RARITIES.slice(at + 1).filter((name) => name !== "legendary")
  return [rarity, ...lower, ...higher]
}

/** How likely a power is this round, as a whole-number weight: 1, raised by each chance modifier in force. */
export function weightOf(card: PowerCard, round: number): number {
  let weight = 1
  for (const modifier of card.chance ?? []) {
    if (round >= modifier.from && round <= (modifier.to ?? Number.POSITIVE_INFINITY)) weight *= modifier.times
  }
  return weight
}

/** The stream a round's hand is drawn from: the mission's seed, and the round counted from 1. */
function draftRng(seed: number, round: number): Pcg32 {
  return Pcg32.seeded((BigInt(Math.trunc(seed)) << 16n) + BigInt(round), STREAM_DRAFT)
}

/** One of `cards`, each as likely as its weight this round. */
function weighted(cards: readonly PowerCard[], round: number, rng: Pcg32): PowerCard {
  const weights = cards.map((card) => weightOf(card, round))
  let draw = rng.nextBelow(weights.reduce((sum, weight) => sum + weight, 0))
  for (const [index, card] of cards.entries()) {
    draw -= weights[index] as number
    if (draw < 0) return card
  }
  return cards[cards.length - 1] as PowerCard
}

/**
 * The hand round `deal.round` deals: one card for each slot of its schedule, in the slots' order (fewer when the
 * pool has run out), then every card offered beside every hand, in pool order. A power a slot makes sure of is
 * placed first, so no other slot takes it; when it cannot be dealt (kept already, or a requirement unmet), its
 * slot deals from its rarity instead.
 */
export function dealHand(deal: Deal): PowerCard[] {
  const { pool, kept, seed, round } = deal
  if (!Number.isInteger(round) || round < 1) throw new Error(`a hand is dealt for a round counted from 1, received ${round}`)
  const eligible = dealable(pool, kept, round, deal.standing)
  const slots = slotsFor(deal.schedule ?? DEFAULT_SCHEDULE, round)
  const rng = draftRng(seed, round)
  const hand: (PowerCard | null)[] = slots.map(() => null)
  const taken = new Set<string>()
  const take = (place: number, card: PowerCard): void => {
    hand[place] = card
    taken.add(card.id)
  }

  // The powers a level makes sure of, first.
  slots.forEach((slot, place) => {
    if (typeof slot === "string") return
    const card = eligible.find((candidate) => candidate.id === slot.power && !taken.has(candidate.id))
    if (card !== undefined) take(place, card)
  })

  // Then each other slot, in order, from its rarity: a role the hand does not hold yet while the rarity has one.
  slots.forEach((slot, place) => {
    if (hand[place] !== null) return
    const rarity: Rarity = typeof slot === "string" ? slot : (pool.find((card) => card.id === slot.power)?.rarity ?? "common")
    const roles = new Set(hand.flatMap((card) => (card === null ? [] : [card.role])))
    for (const from of rarityOrder(rarity)) {
      const left = eligible.filter((card) => card.rarity === from && !taken.has(card.id))
      if (left.length === 0) continue
      const fresh = left.filter((card) => !roles.has(card.role))
      take(place, weighted(fresh.length > 0 ? fresh : left, round, rng))
      return
    }
  })

  return [...hand.filter((card): card is PowerCard => card !== null), ...pool.filter((card) => card.always === true)]
}
