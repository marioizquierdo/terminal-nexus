// The Nexus draft's dealer: a small hand dealt from an army's Nexus power pool at each Build Phase, one kept
// (commander-armies.md, what a Nexus power does). The Campaign deals it from what a level offers; Milestone 11's
// run draft reuses it at the next scale, with rarity and role on top.
//
// Gameplay randomness, so seeded and repeatable: the same pool, the same powers kept, the same seed and round
// deal the same hand on every runtime, every time. It draws from a PCG32 stream of its own (`STREAM_DRAFT`), never
// the kernel's, so dealing a hand never moves a single draw of a battle. Pure: no clock, no state.

import { Pcg32, STREAM_DRAFT } from "../rng/pcg32.ts"
import type { PowerCard } from "./types.ts"

/** How many powers a hand deals, before the ones offered beside every hand (War Chest): a first guess, small
 *  enough that a pool of four still makes each round a choice. */
export const HAND_SIZE = 2

/**
 * The cards a hand is dealt from: the pool, in its own order, without the cards offered beside every hand
 * (`always`) and without a card kept already unless it may be kept again (`repeatable`).
 */
export function dealable(pool: readonly PowerCard[], kept: readonly PowerCard[]): PowerCard[] {
  const once = new Set(kept.filter((card) => card.repeatable !== true).map((card) => card.id))
  return pool.filter((card) => card.always !== true && !once.has(card.id))
}

/** The stream a round's hand is drawn from: the mission's seed, and the round counted from 1. */
function draftRng(seed: number, round: number): Pcg32 {
  return Pcg32.seeded((BigInt(Math.trunc(seed)) << 16n) + BigInt(round), STREAM_DRAFT)
}

/**
 * The hand round `round` deals: `size` cards drawn without replacement from what is dealable (fewer when fewer
 * are), in the order drawn, then every card offered beside every hand, in pool order.
 */
export function dealHand(pool: readonly PowerCard[], kept: readonly PowerCard[], seed: number, round: number, size: number = HAND_SIZE): PowerCard[] {
  if (!Number.isInteger(size) || size < 0) throw new Error(`a hand deals a whole number of cards, received ${size}`)
  if (!Number.isInteger(round) || round < 1) throw new Error(`a hand is dealt for a round counted from 1, received ${round}`)
  const deck = dealable(pool, kept)
  const rng = draftRng(seed, round)
  // A partial Fisher-Yates shuffle: the first `size` places, each drawn from what is left.
  const count = Math.min(size, deck.length)
  for (let place = 0; place < count; place += 1) {
    const from = place + rng.nextBelow(deck.length - place)
    const drawn = deck[from] as PowerCard
    deck[from] = deck[place] as PowerCard
    deck[place] = drawn
  }
  return [...deck.slice(0, count), ...pool.filter((card) => card.always === true)]
}
