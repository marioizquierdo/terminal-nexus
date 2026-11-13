// Resolving a whole Pulse (pulse.md).
//
// The kernel has no real-time loop: it may resolve 240 ticks in a microsecond or over an hour, and
// nothing downstream may care which. Verification re-runs these inputs and compares the two hashes.

import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { hashEvents } from "../events/serialize.ts"
import { hashOf } from "../state/canonical.ts"
import { hashState } from "../state/serialize.ts"
import type { MatchState } from "../state/types.ts"
import type { PulseContext, PulseOptions } from "./context.ts"
import { createContext } from "./context.ts"
import { stepTick } from "./tick.ts"

/** Bumped whenever a rule changes an outcome. Recorded with every run (pulse.md). */
export const ENGINE_VERSION = "0.1.0-gate1a"

export type PulseRun = Readonly<{
  schemaVersion: number
  engineVersion: string
  contentLock: string
  ticksPerSecond: number
  pulseTicks: number
  seed: number
  initialState: MatchState
  finalState: MatchState
  events: readonly DomainEvent[]
  stateHash: string
  eventsHash: string
}>

/** Content ids and their definitions, hashed — the "content lock" of the game log (pulse.md). */
export function contentLockOf(registry: ContentRegistry): string {
  return hashOf(registry.ids().map((id) => registry.get(id)))
}

/**
 * Spawn events are emitted by the kernel rather than the loader, so that a report or a renderer
 * reading only the event stream still learns the whole cast.
 */
function spawnEvents(initialState: MatchState, registry: ContentRegistry): DomainEvent[] {
  return initialState.entities.map((entity) => ({
    kind: "entity.spawned",
    tick: initialState.tick,
    entity: entity.id,
    ordinal: entity.ordinal,
    player: entity.player,
    contentId: registry.get(entity.contentId).id,
    at: entity.anchor,
    hp: entity.hp,
  }))
}

export type ResolveOptions = Readonly<{
  initialState: MatchState
  registry: ContentRegistry
  pulseTicks: number
  seed: number
  /** Shown every state as it is reached, the opening first (with no events), then each tick with its own events: what
   *  a measurement records a battle from. It sees; it changes nothing. */
  watch?: (state: MatchState, events: readonly DomainEvent[]) => void
}> &
  PulseOptions

export function resolvePulse(options: ResolveOptions): PulseRun {
  const { initialState, registry, pulseTicks, seed, sides, abilities, watch } = options
  const context = createContext(initialState, registry, pulseTicks, { ...(sides === undefined ? {} : { sides }), ...(abilities === undefined ? {} : { abilities }) })
  const events: DomainEvent[] = spawnEvents(initialState, registry)

  let state = initialState
  watch?.(state, [])
  while (state.outcome === null && state.tick < pulseTicks) {
    const result = stepTick(state, context)
    state = result.state
    events.push(...result.events)
    watch?.(state, result.events)
  }

  return {
    schemaVersion: initialState.schemaVersion,
    engineVersion: ENGINE_VERSION,
    contentLock: contentLockOf(registry),
    ticksPerSecond: initialState.ticksPerSecond,
    pulseTicks,
    seed,
    initialState,
    finalState: state,
    events,
    stateHash: hashState(state),
    eventsHash: hashEvents(events),
  }
}

/** The context a caller needs to drive `stepTick` itself, one tick at a time. */
export function contextFor(
  initialState: MatchState,
  registry: ContentRegistry,
  pulseTicks: number,
  options: PulseOptions = {},
): PulseContext {
  return createContext(initialState, registry, pulseTicks, options)
}

export { spawnEvents }
