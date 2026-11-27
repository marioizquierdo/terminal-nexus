// What the Build Phase screen is handed to play a battle's rounds, and how a battle is opened at any of its rounds.
//
// A Skirmish is the one thing the screen plays (`./skirmish-play.ts`): a save, opened at its Build Phase. The screens
// that open one (the title menu, a route, the browser page, the scripted playtest) get its first round, or any later
// round, ready for the Build Phase. Story's missions were opened here too until Story stopped (the owner, 2026-11-26):
// it returns as a scripting layer over a Skirmish. In the application shell because opening a round plays the
// battle, which reaches the battle engine (`tests/architecture.test.ts`).

import { STARTER_START_CURSOR } from "../build/catalog.ts"
import { buildLayout } from "../build/layout.ts"
import type { BuildContext, BuildState } from "../build/state.ts"
import { createBuildState, withoutScene } from "../build/state.ts"
import type { PowerCard } from "../armies/index.ts"
import type { RaidForecast } from "../build/types.ts"
import type { ResolvedPulse } from "../view/pulse-live.ts"

/** What the Build Phase screen is handed to play a battle's rounds (`BuildSession`): starting a round's Pulse, the
 *  round after it, what the round brings foreseen, a Nexus power kept, and what a save left planned. */
export type LevelPlay = Readonly<{
  /** The round's context once `card`, the Nexus power just picked, is kept: what it does, applied for the rest of the
   *  battle, and what the round brings foreseen again with it. */
  keep: (context: BuildContext, card: PowerCard) => BuildContext
  /** The round's Pulse, played from the plan as it stands, or `null` when the battle is over. */
  startPulse: (context: BuildContext, state: BuildState) => ResolvedPulse | null
  /** What each group the round brings goes for first, for the Build Phase to draw and say: none in a Skirmish, where
   *  the enemy plans in secret. */
  foresee: (context: BuildContext, state: BuildState) => RaidForecast
  /** The round after a played one, or `null`; `alternative` when the player took the result's other way on (a
   *  Skirmish's New seed). */
  nextRound: (context: BuildContext, state: BuildState, resolved: ResolvedPulse, alternative?: boolean) => BuildContext | null
  /** The Build Phase as it opens, with what a save left planned laid on it: a Skirmish loaded with a draft. Absent:
   *  every round opens with nothing planned. */
  resume?: (context: BuildContext, state: BuildState) => Readonly<{ context: BuildContext; state: BuildState }>
}>

/** A battle the game can open: a Skirmish, whose rounds the Build Phase screen plays. */
export type PlayableLevel = Readonly<{
  /** Its id: `skirmish-<seed>`. */
  id: string
  /** What it is: `skirmish`. */
  story: string
  /** What the player reads: the save's name, or the battle's map and seed. */
  title: string
  /** How many rounds its battle may last. */
  rounds: number
  /** The route that opens it: `skirmish?seed=1234` or `skirmish?load=<file>`. */
  route: string
  /** Its connection to the Build Phase: starting a round's Pulse, the round after it. */
  play: LevelPlay
  /** Round 1's Build Phase (or the round the save stands at), on its map. */
  firstRound: (scrollMargin?: number, extra?: Partial<BuildContext>) => BuildContext
}>

/**
 * The Build Phase of `round` (counted from 1, as the screen counts it). Round 1 opens as the battle does; a later
 * round is reached by playing the ones before it as a player who builds nothing and keeps no Nexus power (the pick
 * is optional), so a route to round 3 opens the same round 3 every time. Throws for a round the battle does not
 * have, or one it ends before reaching.
 */
export function openRound(level: PlayableLevel, round: number, scrollMargin?: number, extra: Partial<BuildContext> = {}): BuildContext {
  if (!Number.isInteger(round) || round < 1 || round > level.rounds) {
    throw new Error(`"${level.id}" has rounds 1 to ${level.rounds}, not ${round}`)
  }
  let context = level.firstRound(scrollMargin, extra)
  for (let played = 1; played < round; played += 1) {
    // The scene a round opens on is the player's to read, not this walk's: it plays from the state without it.
    const viewport = buildLayout({ columns: 80, rows: 24 }, context.terrain).viewport
    const state = createBuildState(withoutScene(context), STARTER_START_CURSOR, viewport)
    const resolved = level.play.startPulse(context, state)
    if (resolved === null) throw new Error(`"${level.id}": round ${played} could not start, so round ${round} cannot be reached`)
    const next = level.play.nextRound(context, state, resolved)
    if (next === null) throw new Error(`"${level.id}" ends in round ${played}, before round ${round}`)
    context = next
  }
  return context
}
