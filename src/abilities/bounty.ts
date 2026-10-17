// A bounty (Dob Hunter's, commander-armies.md: "his powers pay him for aggression and for wreckage, so his economy
// runs on the fight rather than beside it"): every enemy that dies within its radius of the bearer, while the bearer
// stands, earns the bearer's side `credits` to spend from its next Build Phase — `structureCredits` for a building.
// The kernel only notes it (`ability.triggered`, with the credits); the rules between rounds add the credits up
// (`src/match/earnings.ts`), so a bounty is an economy that runs on the Battle Round itself.

import type { Shape } from "../content/shape.ts"
import { literal, positiveWholeNumber, record, text, wholeNumber } from "../content/shape.ts"
import type { AbilityKind } from "./types.ts"

/** A bounty's numbers: its name on a card, how near a death must be, and what one pays. */
export type Bounty = Readonly<{ kind: "bounty"; name: string; radius: number; credits: number; structureCredits?: number }>

const params: Shape<Bounty> = record<Bounty>(
  { kind: literal("bounty"), name: text, radius: positiveWholeNumber, credits: positiveWholeNumber },
  { structureCredits: wholeNumber },
)

export const BOUNTY: AbilityKind<Bounty> = {
  kind: "bounty",
  params,
  describe: (bounty) => `${bounty.name}: every enemy that falls within range ${bounty.radius} pays ${bounty.credits} credits next round.`,
  reach: (bounty) => bounty.radius,
  death: (bearer, dying, _killer, bounty, world) => {
    if (dying.player === bearer.player || dying.ordinal === bearer.ordinal || !world.within(bearer, dying, bounty.radius)) return
    const credits = dying.layer === "obstacles" ? (bounty.structureCredits ?? bounty.credits) : bounty.credits
    if (credits > 0) world.note(bearer, bounty, { target: dying, credits })
  },
}
