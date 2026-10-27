// What a measurement plays, and what it writes down (docs/system-design/measurement.md). One spec, so a result
// measured before a rule changed and one measured after it compare like with like.

import { DUEL_PULSE_TICKS, DUEL_ROUNDS } from "../duel/types.ts"
import type { DuelMeasure, LevelMeasure, LevelPlan, ScenarioMeasure } from "./suites.ts"

export type MeasureSpec = Readonly<{
  name: string
  /** The seeds every scenario and every duel is played on. */
  seeds: readonly number[]
  /** Which maps of `scenarios/`: every one, or only the route scenarios (`route-*`). */
  scenarios: "all" | "routes"
  duels: Readonly<{
    map: string
    rounds: number
    pulseTicks: number
    /** Every ordered pair of these, mirrors included, so each Commander plays from both ends of the map. */
    commanders: readonly string[]
    /** Scripted players (`src/duel/players.ts`); both sides of a duel play the same one, unless `formations` sets
     *  them apart. */
    players: readonly string[]
    /** Formations the players play by (`Formation`, `src/duel/types.ts`): one, and both sides play it; several, and
     *  each player plays every ordered pair of two different ones, side A by the first, so each formation meets each
     *  other from both ends. Its duels' players are named with it, `rush-block` against `rush-apart`. Absent: each
     *  player as it is, by its bare name. */
    formations?: readonly string[]
    /** The Commanders that play side A, each against every one of `commanders`: all of them when absent. A share of
     *  the duels, for one of several processes (`jobsOf`, `src/measure/merge.ts`). */
    west?: readonly string[]
  }>
  /** Campaign levels by id (empty: every level), each played by every plan. */
  levels: readonly string[]
  plans: readonly LevelPlan[]
}>

/** The players a spec's duels set against each other for one of its scripted players, side A's name and side B's, in
 *  the order they are played: the player against itself; with one formation, the player by it on both sides; with
 *  several, every ordered pair of two different ones, in the order they are listed. */
export function playerPairs(duels: MeasureSpec["duels"], player: string): readonly Readonly<{ A: string; B: string }>[] {
  const formations = duels.formations ?? []
  if (formations.length === 0) return [{ A: player, B: player }]
  if (formations.length === 1) return [{ A: `${player}-${formations[0]}`, B: `${player}-${formations[0]}` }]
  return formations.flatMap((first) => formations.flatMap((second) => (first === second ? [] : [{ A: `${player}-${first}`, B: `${player}-${second}` }])))
}

/** Where a duel between `players` comes in a spec's order of play: by its scripted player, then its pair of
 *  formations. `null` for players the spec does not set against each other. */
export function pairingIndex(duels: MeasureSpec["duels"], players: Readonly<{ A: string; B: string }>): number | null {
  let index = 0
  for (const player of duels.players) {
    for (const pair of playerPairs(duels, player)) {
      if (pair.A === players.A && pair.B === players.B) return index
      index += 1
    }
  }
  return null
}

const BARRACKS = "structure.citizen.barracks"
const DEPOT = "structure.citizen.depot"

/** The plans every campaign level is played by: building nothing, and a base that trains a defence each round. */
export const LEVEL_PLANS: readonly LevelPlan[] = [
  { name: "nothing built", buys: [[]] },
  { name: "a defended base", buys: [[BARRACKS, DEPOT]] },
]

/** The whole spec: what a step that changes routes is measured by. */
export const FULL_SPEC: MeasureSpec = {
  name: "full",
  seeds: [1, 2, 3, 4, 5, 6],
  scenarios: "all",
  duels: { map: "crossing", rounds: DUEL_ROUNDS, pulseTicks: DUEL_PULSE_TICKS, commanders: ["vasse", "averno", "dob"], players: ["balanced", "rush", "turtle"] },
  levels: [],
  plans: LEVEL_PLANS,
}

/** A quick look while working: two seeds, one player, the route scenarios. */
export const QUICK_SPEC: MeasureSpec = {
  ...FULL_SPEC,
  name: "quick",
  seeds: [1, 2],
  scenarios: "routes",
  duels: { ...FULL_SPEC.duels, players: ["balanced"] },
}

export const SPECS: Readonly<Record<string, MeasureSpec>> = { full: FULL_SPEC, quick: QUICK_SPEC }

/** A measurement as it is written down: the spec it followed, the build and the day it was measured on (the build
 *  ends "+uncommitted" when the work it measured was not yet committed), how long a tick took on the machine that
 *  measured it, and every battle. */
export type Measurement = Readonly<{
  spec: string
  build: string
  date: string
  /** What the routes were when it was measured, in a few words: "the greedy step", "distance fields". */
  routing: string
  /** The one question it was played to answer, written before it was played. Absent in results written before
   *  it was asked for. */
  question?: string
  /** How many processes played it side by side (`measure run --jobs`); absent for one. Under load a tick takes
   *  longer, so its time compares only with a run played the same way. */
  jobs?: number
  /** Milliseconds a tick took, on average over every battle: the machine's, so compared only between runs on one. */
  msPerTick: number | null
  scenarios: readonly ScenarioMeasure[]
  duels: readonly DuelMeasure[]
  levels: readonly LevelMeasure[]
}>
