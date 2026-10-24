// A Challenge run as plain data (docs/game-design/game-modes.md, Challenge — runs): what a run is from its seed, its
// battles in order, how each one played, and whether the run is over. Serializable as JSON, so a run can be saved
// between battles and its seed shared: the same seed and the same plans give the same run on every machine.
//
// A run battle is a duel (`src/duel/`): the player's Commander Army on side A, an opponent's on side B played by a
// scripted duel player, round after round until a Nexus falls or the rounds run out.

import type { DuelResult, DuelSetup, Roster } from "../duel/index.ts"
import type { DraftOffer, DraftRecord } from "./draft.ts"

/** What a run starts from: its seed, and the Commander the player chose (a duel army's: `vasse`, `averno`, `dob`). */
export type RunSetup = Readonly<{ seed: number; commander: string }>

/** One battle of a run: its number in the run (from 1), its act, the opponent's Commander, the scripted duel player
 *  that plans the opponent's side (`balanced`, `rush`, `turtle`: `src/duel/players.ts`), and the duel it is — the
 *  map, the battle's own seed, its rounds and how long each Battle Round may last, the player on side A. */
export type RunBattle = Readonly<{
  number: number
  act: number
  opponent: string
  policy: string
  duel: DuelSetup
}>

/** A segment of a run. A run of this step has one act; escalation and a named boss at an act's end come later. */
export type RunAct = Readonly<{ number: number; battles: readonly RunBattle[] }>

/** A run, worked out from its setup alone: its acts, every battle in order, and the seed of the run that follows
 *  it (what the game offers next, so a new run is as shareable as the first). */
export type RunDefinition = Readonly<{
  setup: RunSetup
  acts: readonly RunAct[]
  battles: readonly RunBattle[]
  nextSeed: number
}>

/** How a battle ended for the player. */
export type BattleOutcome = "won" | "lost" | "drawn"

/** A battle played: which one, how it ended for the player, how (the duel's own word: a Nexus fell, or judged on
 *  health, on damage, or a draw), and in which round. */
export type BattleRecord = Readonly<{
  battle: number
  outcome: BattleOutcome
  by: DuelResult["by"]
  round: number
}>

/** A run in play: its definition, the battles played so far, and whether it is over — a lost battle ends it, and so
 *  does its last battle. And what the run is made of between them: the army it holds (a roster the next battle plays
 *  on), the requisition it has taken, the pity offset the draft dealer carries, every draft taken, and the draft on
 *  offer — after a battle that was not lost and was not the last, the next battle waits for it. */
export type RunState = Readonly<{
  definition: RunDefinition
  played: readonly BattleRecord[]
  over: boolean
  army: Roster
  requisition: number
  pity: number
  drafts: readonly DraftRecord[]
  draft: DraftOffer | null
}>

/** A run's summary as data: the Commander, the seed, how many battles were won, and each battle with its opponent and
 *  result (`null` for one not played). */
export type RunSummary = Readonly<{
  commander: string
  commanderName: string
  seed: number
  won: number
  of: number
  over: boolean
  battles: readonly Readonly<{ number: number; opponent: string; opponentName: string; policy: string; record: BattleRecord | null }>[]
  /** The army the run ended with, as card names; the requisition it took; every draft taken, in words. */
  army: readonly string[]
  requisition: number
  drafts: readonly string[]
}>
