// Loaded dice (Dob Hunter's: "variance as a build", commander-armies.md): one hit in `chanceIn` its bearer lands
// deals `times` as much. The roll is the battle's own gameplay stream, so the same seed throws the same dice on every
// machine; a lucky hit is noted (`ability.triggered`), so the log and the screen can say the dice came up.

import type { Shape } from "../content/shape.ts"
import { literal, positiveWholeNumber, record, text } from "../content/shape.ts"
import type { AbilityKind } from "./types.ts"

/** Loaded dice's numbers: its name on a card, the odds (one in `chanceIn`) and how many times a lucky hit deals. */
export type LoadedDice = Readonly<{ kind: "loadedDice"; name: string; chanceIn: number; times: number }>

const params: Shape<LoadedDice> = record<LoadedDice>({ kind: literal("loadedDice"), name: text, chanceIn: positiveWholeNumber, times: positiveWholeNumber }, {})

export const LOADED_DICE: AbilityKind<LoadedDice> = {
  kind: "loadedDice",
  params,
  describe: (dice, { possessive }) => `${dice.name}: one in ${dice.chanceIn} of ${possessive} hits deals ${dice.times} times as much.`,
  hitDealt: (bearer, target, amount, dice, world) => {
    if (amount <= 0 || world.random(dice.chanceIn) !== 0) return amount
    const lucky = amount * dice.times
    world.note(bearer, dice, { target, amount: lucky })
    return lucky
  },
}
