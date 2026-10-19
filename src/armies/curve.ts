// The expected power curve: the numbers every Commander Army is designed against (docs/game-design/commander-armies.md,
// "The expected power curve" and "What an army leans on").
//
// The owner, 2026-10-13: "We can focus on the expected power curve, with some rules on expected power per nexus
// pulse, so armies can build around this curve with different tradeoffs." Power is counted in credits, the one
// resource: what a round is expected to bring, what a Nexus Pulse's pick is expected to be worth, and from which
// round each rarity may be dealt. An army's difference is where it takes its power, never how much. Every number is
// a first guess for the next step to put on the Grid and measure; only the earliest round of each rarity is a rule
// today, which the loader holds a level's schedule to and the dealer keeps when it falls back to a rarer card.
//
// Pure data and whole-number arithmetic, like the dealer beside it: the same on every runtime.

import type { Rarity } from "./types.ts"

/** The most rounds a match is written for: six to nine, twelve for a long one (the owner, 2026-10-14). */
export const MAX_ROUNDS = 12

/** The acts a match's rounds fall into: what the curve and the tiers are written by. */
export const ACTS = [
  { name: "opening", from: 1, to: 3 },
  { name: "middle", from: 4, to: 6 },
  { name: "closing", from: 7, to: 9 },
  { name: "long game", from: 10, to: 12 },
] as const

/** The credits each round is expected to bring, round 1 first: about a fifth more each round, flat after round 9. */
export const ROUND_CREDITS: readonly number[] = [100, 120, 140, 170, 210, 250, 300, 360, 430, 430, 430, 430]

/** What a pick is expected to be worth over the rest of the match, as a share of its round's credits: a common a
 *  fifth, an uncommon a third, a rare a half, a legendary a whole round's. */
export const PICK_WORTH: Readonly<Record<Rarity, Readonly<{ of: number; per: number }>>> = {
  common: { of: 1, per: 5 },
  uncommon: { of: 1, per: 3 },
  rare: { of: 1, per: 2 },
  legendary: { of: 1, per: 1 },
}

/** RULE: the first round each rarity may be dealt in — a rare from the middle act, a legendary from the closing. */
export const EARLIEST_ROUND: Readonly<Record<Rarity, number>> = { common: 1, uncommon: 1, rare: 4, legendary: 7 }

/** The tiers of an army's tech tree: a tier's units can first fight about the act its number names (the first
 *  from round 1, the second from round 4, the third from round 7). */
export const MAX_TIER = 3

/** What an army may name as what its build leans on: one or two of these (`lean` on a Commander). */
export const LEANS = ["units", "nexus", "structures", "commander", "economy"] as const
export type Lean = (typeof LEANS)[number]

/** The most leans an army names: a lean on everything is no lean. */
export const MAX_LEANS = 2

/** The credits round `round` is expected to bring (counted from 1, at most `MAX_ROUNDS`). */
export function roundCredits(round: number): number {
  const credits = ROUND_CREDITS[round - 1]
  if (!Number.isInteger(round) || credits === undefined) throw new Error(`the curve is written for rounds 1 to ${MAX_ROUNDS}, received ${round}`)
  return credits
}

/** The credits round `number` adds as it opens, in any mode: the curve's, and past its last round the last round's. */
export function roundIncome(number: number): number {
  return roundCredits(Math.min(Math.max(1, number), MAX_ROUNDS))
}

/** What a pick of `rarity` dealt in round `round` is expected to be worth, in credits, rounded down. */
export function pickWorth(rarity: Rarity, round: number): number {
  const { of, per } = PICK_WORTH[rarity]
  return Math.floor((roundCredits(round) * of) / per)
}

/** Whether a card of `rarity` may be dealt in round `round`. */
export function dealtBy(rarity: Rarity, round: number): boolean {
  return round >= EARLIEST_ROUND[rarity]
}
