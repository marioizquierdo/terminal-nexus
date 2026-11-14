// Building a presentable timeline from a resolved Pulse.
//
// This lives in the application shell rather than in `src/view`, because it is where the kernel and
// the presentation meet: the view never imports the kernel, and the kernel never hears about the
// view. The shell resolves the Pulse, keeps the state settled at every tick, and hands the pair
// (states, events) to the view — which is why `watch` and `run` can be asserted to agree.

import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { hashEvents } from "../events/serialize.ts"
import { phaseOf, playPhase } from "../skirmish/opening/index.ts"
import { hashState } from "../state/serialize.ts"
import type { MatchState } from "../state/types.ts"
import type { PulseTimeline } from "../view/index.ts"
import type { BattleOpening } from "../skirmish/opening/index.ts"

export function buildTimeline(
  opening: Pick<BattleOpening, "id" | "name" | "phase">,
  initialState: MatchState,
  registry: ContentRegistry,
  pulseTicks: number,
  seed: number,
): PulseTimeline {
  // The sandbox's own run, every state it reaches kept: the same events and hashes `grid --headless` reports (the
  // kernel's in the Battle Round, the regroup's in the Build Phase, `playPhase`).
  const states: MatchState[] = []
  const run = playPhase(phaseOf(opening), initialState, registry, pulseTicks, seed, { watch: (state) => states.push(state) })
  return {
    battleId: opening.id,
    battleName: opening.name,
    seed,
    pulseTicks: run.pulseTicks,
    ticksPerSecond: initialState.ticksPerSecond,
    grid: initialState.grid,
    registry,
    states,
    events: run.events,
    stateHash: run.stateHash,
    eventsHash: run.eventsHash,
  }
}

/**
 * A timeline from a Pulse already resolved elsewhere — a mission's, by the trigger runner, which steps
 * the same kernel and keeps the same states and events (`src/match/mission.ts`). Hashed the same way, so a
 * mission's Pulse and a sandbox's are compared by the same two numbers.
 */
export function timelineOf(
  opening: Pick<BattleOpening, "id" | "name" | "phase">,
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
    battleId: opening.id,
    battleName: opening.name,
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
