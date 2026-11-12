// A Skirmish in words: what its opening, its result and its seed say to a person. Pure, as the save is: the screen
// (`src/cli/skirmish-play.ts`) and the command line read them, and nothing here knows a terminal or a clock.

import { ARMIES } from "../armies/index.ts"
import type { DuelResult, Side } from "../duel/index.ts"
import { DUEL_MAPS } from "../duel/index.ts"
import type { SaveSetup, Slot } from "./save.ts"
import { controllerKind, duelMapOf, IDLE_SCRIPT, scriptOf, SIDE_OF } from "./save.ts"

/** A seed a person reads out and types back: six digits at most. */
export const SKIRMISH_SEED_LIMIT = 1_000_000

/** Whether `seed` is one a Skirmish takes. */
export const isSkirmishSeed = (seed: number): boolean => Number.isInteger(seed) && seed >= 0 && seed < SKIRMISH_SEED_LIMIT

/** A new battle's seed from a clock's milliseconds: their last six digits. The screens choose it (the title menu's
 *  Skirmish, a result's New seed); a Skirmish itself never reads a clock. */
export const clockSeed = (now: number): number => Math.floor(Math.abs(now)) % SKIRMISH_SEED_LIMIT

/** A Commander's name, by her id: "Dob Hunter" for `dob`. */
export const commanderNameOf = (id: string | undefined): string => (id === undefined ? "no Commander" : (ARMIES.commanders.find((commander) => commander.id === id)?.name ?? id))

/** A map's name for a person: "the Crossing" is `crossing`'s. */
export function mapNameOf(map: SaveSetup["map"]): string {
  const duel = duelMapOf(map)
  return typeof duel === "string" ? (DUEL_MAPS[duel]?.name ?? duel) : duel.name
}

/** What each scripted player does, in a few words a battle's opening says. */
const SCRIPT_WORDS: Readonly<Record<string, string>> = {
  balanced: "builds its strongest units, holds two rounds and attacks from the third",
  rush: "rushes: its cheapest units, all forward, attacking every round",
  turtle: "digs in: Turrets forward, units behind them, attacking in the last two rounds",
  [IDLE_SCRIPT]: "builds nothing and holds",
}

/** How a slot's controller plays, in words: "plays balanced: builds its strongest units, ...". */
export function controllerWords(setup: SaveSetup, slot: Slot): string {
  const controller = setup.slots[slot].controller
  if (controllerKind(controller) !== "script") return "is played by a person"
  const script = scriptOf(controller)
  const base = script.replace(/-(area|upgrade|block|apart|zones)$/u, "")
  const words = SCRIPT_WORDS[script] ?? SCRIPT_WORDS[base]
  return words === undefined ? `plays the ${script} script` : `plays the ${script} script: it ${words}`
}

/** The lines a Skirmish opens with: who against whom, where, for how long, and how the other side plays. */
export function openingLines(setup: SaveSetup): string[] {
  const player = commanderNameOf(setup.slots.p1.commander)
  const opponent = commanderNameOf(setup.slots.p2.commander)
  return [
    `A Skirmish on ${mapNameOf(setup.map)}, seed ${setup.seed}: ${player} against ${opponent}. Destroy the enemy Nexus within ${setup.rounds} rounds, or have the healthier Nexus when they run out.`,
    `${opponent}'s army ${controllerWords(setup, "p2")}.`,
  ]
}

/** How a battle ended for the player: won, lost or drawn. */
export type BattleOutcome = "won" | "lost" | "drawn"

/** How a battle ended for `side`. */
export const outcomeFor = (result: DuelResult, side: Side = SIDE_OF.p1): BattleOutcome =>
  result.winner === null ? "drawn" : result.winner === side ? "won" : "lost"

/** Why a battle ended as it did, for the player: "Dob Hunter's Nexus fell.", "The rounds ran out, and your Nexus kept
 *  more of its health." */
export function reasonWords(result: DuelResult, opponentName: string): string {
  const won = outcomeFor(result) === "won"
  switch (result.by) {
    case "nexus":
      return won ? `${opponentName}'s Nexus fell.` : "Your Nexus fell."
    case "health":
      return won ? "The rounds ran out, and your Nexus kept more of its health." : `The rounds ran out, and ${opponentName}'s Nexus kept more of its health.`
    case "damage":
      return `The rounds ran out with the Nexuses as healthy, and ${won ? "you" : opponentName} dealt more damage.`
    case "draw":
      return "Neither side won."
  }
}

/** The line that says how a battle ended: "Won in round 4. Dob Hunter's Nexus fell." */
export function endedLine(setup: SaveSetup, result: DuelResult): string {
  const outcome = outcomeFor(result)
  return `${outcome[0]?.toUpperCase() ?? ""}${outcome.slice(1)} in round ${result.round}. ${reasonWords(result, commanderNameOf(setup.slots.p2.commander))}`
}
