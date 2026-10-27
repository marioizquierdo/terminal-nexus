// A Challenge run, pure (docs/game-design/game-modes.md, Challenge — runs): its definition from a seed, how a battle's
// end moves it on, and its summary as data and as lines a screen shows.
//
// **Everything a run decides comes from its seed**, on its own seeded stream (`STREAM_RUN`): which scripted duel player
// plans the opponent's side in which battle, each battle's own seed, and the seed of the run after it. Nothing here
// reads a clock or a screen; a seed the game chooses is the shell's to choose (`src/cli/run-play.ts`).
//
// This is step 11A's skeleton: one act of three battles, each against Dob Hunter's Ravel army on the Crossing, the
// player's army the Commander's duel package every battle. The run draft between battles, escalation and bosses come
// in later steps; each is a change to `runDefinition` and to what happens between battles, not to the battle itself.

import { ARMIES } from "../armies/index.ts"
import type { DuelResult, DuelSetup } from "../duel/index.ts"
import { DUEL_MAPS, DUEL_PULSE_TICKS, DUEL_ROUNDS, duelArmy } from "../duel/index.ts"
import { Pcg32, STREAM_RUN } from "../rng/pcg32.ts"
import type { DraftChoice } from "./draft.ts"
import { REQUISITION_FOR_SKIPPING, choose, dealDraft } from "./draft.ts"
import type { DraftRecord } from "./draft.ts"
import { KIND_WORDS, cardByKey, keyOf, ownedCards, startingRoster } from "./army.ts"
import type { BattleOutcome, BattleRecord, RunAct, RunBattle, RunDefinition, RunSetup, RunState, RunSummary } from "./types.ts"

/** How many battles a run has: one act of three, the step's "three battles". The design's 6–9 in 2–3 acts waits
 *  for escalation and bosses. */
export const RUN_BATTLES = 3

/** The Commander a run plays when none is chosen: Vasse, the Campaign's first. */
export const DEFAULT_RUN_COMMANDER = "vasse"

/** The Commanders a run may be played with: every Commander the duel armies have. */
export const RUN_COMMANDERS: readonly string[] = ARMIES.commanders.map((commander) => commander.id)

/** Who every battle is against, for now: Dob Hunter's Ravel army, the step's "Ravel fixture army". */
export const RUN_OPPONENT = "dob"

/** The map every battle is fought on: the Crossing, the one duel map made for a whole duel (the Pocket is a test's
 *  close quarters). One map also keeps the screen's Grid one size for the whole run. */
export const RUN_MAP = "crossing"

/**
 * **Rounds a battle lasts at most: 8**, each Battle Round 30 seconds with the front kept between rounds (step 11D). Measured
 * on the between-rounds experiment's own matrix (the six pairings of different Commanders, every pairing of the three
 * scripts, seeds 1–6, on the Crossing, played to 10 rounds, 324 duels): a Nexus fell by the end of round 6 in 36% of
 * the duels, of round 8 in 41%, of round 10 in 44%; the rest are the scripts' stalemates (rush or turtle against rush or
 * turtle), which no limit ends. Eight takes in 134 of the 142 battles that end on a fallen Nexus within ten rounds, and a
 * battle averages under seven rounds: with a Build Phase of half a minute to a minute, about 7 to 12 minutes.
 */
export const RUN_ROUNDS = DUEL_ROUNDS
/** A run's Battle Round is a duel's: 30 seconds (`DUEL_PULSE_TICKS`). */
export const RUN_PULSE_TICKS = DUEL_PULSE_TICKS

/** The scripted duel players that plan the opponent's side: each battle of a run gets a different one, in an order
 *  the seed shuffles, so the three battles of a run are three different plans. */
export const RUN_POLICIES: readonly string[] = ["balanced", "rush", "turtle"]

/** Seeds a run is shown with stay below a million: six digits to read out and type back. */
export const RUN_SEED_LIMIT = 1_000_000

/** A seed a run may have: a whole number from 0 up to `RUN_SEED_LIMIT`. */
export const isRunSeed = (seed: number): boolean => Number.isInteger(seed) && seed >= 0 && seed < RUN_SEED_LIMIT

/**
 * **A run from its setup**: three battles in one act, each against Dob Hunter on the Crossing, played by a different
 * scripted player in a seeded order, each with its own seed; and the seed of the run after it. The same setup gives
 * the same definition on every machine. Throws for a seed out of range or a Commander no army has.
 */
export function runDefinition(setup: RunSetup): RunDefinition {
  if (!isRunSeed(setup.seed)) throw new Error(`a run's seed is a whole number from 0 to ${RUN_SEED_LIMIT - 1}, not ${setup.seed}`)
  if (!RUN_COMMANDERS.includes(setup.commander)) {
    throw new Error(`no Commander "${setup.commander}" for a run (${RUN_COMMANDERS.map((id) => `"${id}"`).join(", ")})`)
  }
  duelArmy(setup.commander)
  const rng = Pcg32.seeded(BigInt(setup.seed), STREAM_RUN)
  // The policies shuffled (Fisher–Yates, from the run's stream), then each battle's seed, then the next run's seed:
  // drawn in that order always, so adding a draw at the end never moves one before it.
  const policies = [...RUN_POLICIES]
  for (let index = policies.length - 1; index > 0; index -= 1) {
    const other = rng.nextBelow(index + 1)
    const swap = policies[index] as string
    policies[index] = policies[other] as string
    policies[other] = swap
  }
  const battles: RunBattle[] = []
  for (let number = 1; number <= RUN_BATTLES; number += 1) {
    battles.push({
      number,
      act: 1,
      opponent: RUN_OPPONENT,
      policy: policies[(number - 1) % policies.length] as string,
      duel: {
        map: RUN_MAP,
        seed: rng.nextBelow(RUN_SEED_LIMIT),
        rounds: RUN_ROUNDS,
        pulseTicks: RUN_PULSE_TICKS,
        commanders: { A: setup.commander, B: RUN_OPPONENT },
      },
    })
  }
  const acts: RunAct[] = [{ number: 1, battles }]
  return { setup, acts, battles, nextSeed: rng.nextBelow(RUN_SEED_LIMIT) }
}

/** A run before its first battle. */
export function newRun(setup: RunSetup): RunState {
  return { definition: runDefinition(setup), played: [], over: false, army: startingRoster(setup.commander), requisition: 0, pity: 0, drafts: [], draft: null }
}

/** The duel a battle is, as the run plays it now: the battle's own setup, with the army the run holds on the
 *  player's side (the opponent's is its Commander's whole army). */
export function duelFor(run: RunState, battle: RunBattle): DuelSetup {
  return { ...battle.duel, rosters: { A: run.army } }
}

/** Whether the next battle waits for a draft. */
export const awaitingDraft = (run: RunState): boolean => !run.over && run.draft !== null

/** The battle to play next, or `null` once the run is over. */
export function currentBattle(run: RunState): RunBattle | null {
  if (run.over) return null
  return run.definition.battles[run.played.length] ?? null
}

/** How a duel's result reads for the player, on side A. */
export function outcomeFor(result: DuelResult): BattleOutcome {
  if (result.winner === null) return "drawn"
  return result.winner === "A" ? "won" : "lost"
}

/**
 * The run after its current battle ended with `result`: the battle recorded, and the run over when the battle was
 * lost (a lost battle ends the run) or was its last. A drawn battle is not lost: the run goes on, and so does a won
 * one — to a draft, dealt now, that the next battle waits for (`drafted`). Throws for a run already over, or one
 * whose draft is still waiting.
 */
export function battleEnded(run: RunState, result: DuelResult): RunState {
  const battle = currentBattle(run)
  if (battle === null) throw new Error("the run is over")
  if (run.draft !== null) throw new Error("the run is waiting for its draft")
  const record: BattleRecord = { battle: battle.number, outcome: outcomeFor(result), by: result.by, round: result.round }
  const played = [...run.played, record]
  const over = record.outcome === "lost" || played.length >= run.definition.battles.length
  if (over) return { ...run, played, over }
  const { offer, pity } = dealDraft({ commander: run.definition.setup.commander, roster: run.army, seed: run.definition.setup.seed, battle: record.battle + 1, pity: run.pity })
  return { ...run, played, over, pity, draft: offer }
}

/** The run after the draft on offer was settled by `choice`: the army changed or the requisition taken, the draft kept in
 *  the run's record, and the next battle free to start. Throws for a run with no draft, or a choice it does not offer. */
export function drafted(run: RunState, choice: DraftChoice): RunState {
  const offer = run.draft
  if (offer === null) throw new Error("the run has no draft to settle")
  const made = choose(run.army, offer, choice)
  if (typeof made === "string") throw new Error(made)
  const record = { battle: offer.battle, offered: offer.cards.map(keyOf), choice }
  return { ...run, army: made.roster, requisition: run.requisition + made.requisition, drafts: [...run.drafts, record], draft: null }
}

/** A Commander's name, as her army writes it. */
export const commanderNameOf = (id: string): string => ARMIES.commanders.find((commander) => commander.id === id)?.name ?? id

/** A duel map's name. */
export const mapNameOf = (id: string): string => DUEL_MAPS[id]?.name ?? id

/** What each scripted player does, in a few words a battle's opening says. */
const POLICY_WORDS: Readonly<Record<string, string>> = {
  balanced: "builds its strongest units, holds two rounds and attacks from the third",
  rush: "rushes: its cheapest units, all forward, attacking every round",
  turtle: "digs in: Turrets forward, units behind them, attacking in the last two rounds",
}

/** Why a battle ended as it did: "Dob Hunter's Nexus fell.", "The rounds ran out, and your Nexus kept more of its
 *  health." */
export function reasonWords(record: BattleRecord, opponentName: string): string {
  const won = record.outcome === "won"
  switch (record.by) {
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

/** How a battle ended, as words after its number: "won in round 4. Dob Hunter's Nexus fell." */
export function endedWords(record: BattleRecord, opponentName: string): string {
  return `${record.outcome} in round ${record.round}. ${reasonWords(record, opponentName)}`
}

/** A battle by its number. */
const battleOf = (run: RunState, number: number): RunBattle => run.definition.battles[number - 1] as RunBattle

/** "Battle 2 of 3" */
export const battleCount = (run: RunState, number: number): string => `Battle ${number} of ${run.definition.battles.length}`

/** The lines a battle opens with: which battle, against whom, where and for how long; and how the opponent plays. */
export function battleIntroLines(run: RunState, battle: RunBattle): string[] {
  const opponent = commanderNameOf(battle.opponent)
  return [
    `${battleCount(run, battle.number)}: against ${opponent} on ${mapNameOf(battle.duel.map)}. Destroy the enemy Nexus within ${battle.duel.rounds} rounds, or have the healthier Nexus when they run out.`,
    `${opponent}'s army ${POLICY_WORDS[battle.policy] ?? `plays ${battle.policy}`}.`,
  ]
}

/** The line that says how a played battle ended: "Battle 1 of 3: won in round 4. Dob Hunter's Nexus fell." */
export function battleEndedLine(run: RunState, record: BattleRecord): string {
  return `${battleCount(run, record.battle)}: ${endedWords(record, commanderNameOf(battleOf(run, record.battle).opponent))}`
}

/** What a draft was, in words after the battle it follows: "took Garrison (Structure, uncommon)", "removed Drill
 *  Schedule", "took 15 requisition". */
export function draftWords(run: RunState, record: DraftRecord): string {
  const commander = run.definition.setup.commander
  const named = (key: string): string => {
    const card = cardByKey(commander, key)
    return card === undefined ? key : `${card.name} (${KIND_WORDS[card.kind]}, ${card.rarity})`
  }
  const after = `After battle ${record.battle - 1}: `
  switch (record.choice.kind) {
    case "take":
      return `${after}took ${named(record.choice.card)}.`
    case "remove":
      return `${after}removed ${named(record.choice.card)}.`
    case "requisition":
      return `${after}took ${REQUISITION_FOR_SKIPPING} requisition.`
  }
}

/** A run's summary, as data. */
export function runSummary(run: RunState): RunSummary {
  const { setup } = run.definition
  return {
    commander: setup.commander,
    commanderName: commanderNameOf(setup.commander),
    seed: setup.seed,
    won: run.played.filter((record) => record.outcome === "won").length,
    of: run.definition.battles.length,
    over: run.over,
    army: ownedCards(setup.commander, run.army).map((card) => card.name),
    requisition: run.requisition,
    drafts: run.drafts.map((record) => draftWords(run, record)),
    battles: run.definition.battles.map((battle) => ({
      number: battle.number,
      opponent: battle.opponent,
      opponentName: commanderNameOf(battle.opponent),
      policy: battle.policy,
      record: run.played.find((record) => record.battle === battle.number) ?? null,
    })),
  }
}

/**
 * **A run's summary as lines**: how it went, the Commander and the seed, then every battle — its opponent, how that
 * opponent played, and how it ended, or that it was not played.
 *
 *     The run is over: 1 of 3 battles won. Battle 2 was lost.
 *     Edda Vasse, seed 1234.
 *     Battle 1 against Dob Hunter (rush): won in round 3. Dob Hunter's Nexus fell.
 *     Battle 2 against Dob Hunter (turtle): lost in round 5. Your Nexus fell.
 *     Battle 3 against Dob Hunter (balanced): not played.
 */
export function summaryLines(run: RunState): string[] {
  const summary = runSummary(run)
  const lost = summary.battles.find((battle) => battle.record?.outcome === "lost")
  const headline = !summary.over
    ? `The run so far: ${summary.won} of ${summary.of} battles won.`
    : summary.won === summary.of
      ? `The run is won: all ${summary.of} battles won.`
      : `The run is over: ${summary.won} of ${summary.of} battles won.${lost === undefined ? "" : ` Battle ${lost.number} was lost.`}`
  return [
    headline,
    `${summary.commanderName}, seed ${summary.seed}.`,
    ...summary.battles.map(
      (battle) =>
        `Battle ${battle.number} against ${battle.opponentName} (${battle.policy}): ${battle.record === null ? "not played." : endedWords(battle.record, battle.opponentName)}`,
    ),
    ...summary.drafts,
    `The army: ${summary.army.join(", ")}.${summary.requisition > 0 ? ` Requisition: ${summary.requisition}.` : ""}`,
  ]
}
