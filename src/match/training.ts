// The registry a mission's Pulse runs on, with the buildings it lists under `trains` given a recipe
// (step 6C). The mission says which building trains what; how often and how many a round is the
// caller's — the shell reads it from the Experiments — so the mission's data holds no number Mario
// should be the one to feel. One unit a wave: the smallest recipe there is.

import type { ContentRegistry } from "../content/index.ts"
import { withProduction } from "../content/index.ts"
import type { MissionDefinition } from "../mission/types.ts"

export type TrainingPace = Readonly<{
  /** Ticks between two trainings, the first one full interval into the Pulse. */
  intervalTicks: number
  /** How many times one building trains in a Pulse, at most. */
  perPulse: number
}>

export function trainingRegistry(mission: MissionDefinition, registry: ContentRegistry, pace: TrainingPace): ContentRegistry {
  const trains = mission.trains ?? []
  if (trains.length === 0) return registry
  const recipe = { perWave: 1, waves: pace.perPulse, firstTicks: pace.intervalTicks, intervalTicks: pace.intervalTicks }
  return withProduction(registry, Object.fromEntries(trains.map((entry) => [entry.structure, { output: entry.unit, ...recipe }])))
}
