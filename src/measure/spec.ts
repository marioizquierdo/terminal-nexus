// What a measurement plays, and what it writes down (docs/system-design/measurement.md). One spec, so a result
// measured before a rule changed and one measured after it compare like with like.

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
    /** Scripted players (`src/duel/players.ts`); both sides of a duel play the same one. */
    players: readonly string[]
    /** The Commanders that play side A, each against every one of `commanders`: all of them when absent. A share of
     *  the duels, for one of several processes (`jobsOf`, `src/measure/merge.ts`). */
    west?: readonly string[]
  }>
  /** Campaign levels by id (empty: every level), each played by every plan. */
  levels: readonly string[]
  plans: readonly LevelPlan[]
}>

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
  duels: { map: "crossing", rounds: 8, pulseTicks: 600, commanders: ["vasse", "averno", "dob"], players: ["balanced", "rush", "turtle"] },
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
