// Building a presentable timeline from a resolved Pulse.
//
// This lives in the application shell rather than in `src/view`, because it is where the kernel and
// the presentation meet: the view never imports the kernel, and the kernel never hears about the
// view. The shell resolves the Pulse, keeps the state settled at every tick, and hands the pair
// (states, events) to the view — which is why `watch` and `run` can be asserted to agree.

import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { hashEvents } from "../events/serialize.ts"
import { contextFor, spawnEvents, stepTick } from "../pulse/index.ts"
import { hashState } from "../state/serialize.ts"
import type { MatchState } from "../state/types.ts"
import type { PulseTimeline } from "../view/index.ts"
import type { ScenarioDefinition } from "../scenario/index.ts"

export function buildTimeline(
  scenario: Pick<ScenarioDefinition, "id" | "name">,
  initialState: MatchState,
  registry: ContentRegistry,
  pulseTicks: number,
  seed: number,
): PulseTimeline {
  const context = contextFor(initialState, registry, pulseTicks)
  const states: MatchState[] = [initialState]
  const events: DomainEvent[] = spawnEvents(initialState, registry)

  let state = initialState
  while (state.outcome === null && state.tick < pulseTicks) {
    const result = stepTick(state, context)
    state = result.state
    states.push(state)
    events.push(...result.events)
  }

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    seed,
    pulseTicks,
    ticksPerSecond: initialState.ticksPerSecond,
    grid: initialState.grid,
    registry,
    states,
    events,
    stateHash: hashState(state),
    eventsHash: hashEvents(events),
  }
}

/**
 * A timeline from a Pulse already resolved elsewhere — a mission's, by the trigger runner, which steps
 * the same kernel and keeps the same states and events (`src/match/mission.ts`). Hashed the same way, so a
 * mission's Pulse and a scenario's are compared by the same two numbers.
 */
export function timelineOf(
  scenario: Pick<ScenarioDefinition, "id" | "name">,
  states: readonly MatchState[],
  events: readonly DomainEvent[],
  pulseTicks: number,
  seed: number,
  registry: ContentRegistry,
): PulseTimeline {
  const first = states[0]
  const last = states[states.length - 1]
  if (first === undefined || last === undefined) throw new Error("a timeline needs at least its opening state")
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    seed,
    pulseTicks,
    ticksPerSecond: first.ticksPerSecond,
    grid: first.grid,
    registry,
    states,
    events,
    stateHash: hashState(last),
    eventsHash: hashEvents(events),
  }
}
