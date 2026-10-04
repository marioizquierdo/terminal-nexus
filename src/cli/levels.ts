// The campaign levels the game can open, by id: what a route's `campaign?level=<id>` names, and how a level is
// opened at any of its rounds.
//
// This is the seam between where a level's definition comes from (its campaign's bundle) and the screens that
// open it (the title menu, a route, the browser page, the scripted playtest): they ask for a level by id and get
// its first round, or any later round, ready for the Build Phase. In the application shell because opening a
// round plays the mission, which reaches the kernel (`tests/architecture.test.ts`).

import { STARTER_START_CURSOR } from "../build/catalog.ts"
import { buildLayout } from "../build/layout.ts"
import type { BuildContext } from "../build/state.ts"
import { applyBuildCommand, createBuildState, withoutScene } from "../build/state.ts"
import type { MissionPlay } from "./pulse-run.ts"
import { STARTER_MISSION } from "./pulse-run.ts"
import { starterContext } from "./starter.ts"

/** A level the game can open. */
export type PlayableLevel = Readonly<{
  /** The id a route names: `campaign?level=vasse-test-1`. */
  id: string
  /** The campaign it belongs to. */
  campaign: string
  /** What the player reads: the mission's name. */
  title: string
  /** How many rounds it plays. */
  rounds: number
  /** Its mission's connection to the Build Phase: starting a round's Pulse, the round after it, the raid foreseen. */
  play: MissionPlay
  /** Round 1's Build Phase, with what the level offers, on its map. */
  firstRound: (scrollMargin?: number, extra?: Partial<BuildContext>) => BuildContext
}>

/** Every level the game can open, in campaign order. */
export const LEVELS: readonly PlayableLevel[] = [
  {
    id: "vasse-test-1",
    campaign: "vasse",
    title: STARTER_MISSION.mission.name,
    rounds: STARTER_MISSION.mission.pulses,
    play: STARTER_MISSION,
    firstRound: starterContext,
  },
]

/** The level the game opens when a route names none: PERIMETER, Vasse's first. */
export const DEFAULT_LEVEL_ID = "vasse-test-1"

/** A level by id, or `undefined`. */
export function levelById(id: string): PlayableLevel | undefined {
  return LEVELS.find((level) => level.id === id)
}

/**
 * The Build Phase of `round` (counted from 1, as the screen counts it). Round 1 opens as the level does; a later
 * round is reached by playing the ones before it as a player who picks the first Nexus power and builds nothing,
 * so a route to round 3 opens the same round 3 every time. Throws for a round the level does not have, or one the
 * mission ends before reaching.
 */
export function openRound(level: PlayableLevel, round: number, scrollMargin?: number, extra: Partial<BuildContext> = {}): BuildContext {
  if (!Number.isInteger(round) || round < 1 || round > level.rounds) {
    throw new Error(`level "${level.id}" has rounds 1 to ${level.rounds}, not ${round}`)
  }
  let context = level.firstRound(scrollMargin, extra)
  for (let played = 1; played < round; played += 1) {
    // The scene a round opens on is the player's to read, not this walk's: it plays from the state without it.
    const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
    const state = applyBuildCommand(context, createBuildState(withoutScene(context), STARTER_START_CURSOR, viewport), { kind: "pick-nexus", index: 0 })
    const resolved = level.play.startPulse(context, state)
    if (resolved === null) throw new Error(`level "${level.id}": round ${played} could not start, so round ${round} cannot be reached`)
    const next = level.play.nextRound(context, state, resolved)
    if (next === null) throw new Error(`level "${level.id}" ends in round ${played}, before round ${round}`)
    context = next
  }
  return context
}
