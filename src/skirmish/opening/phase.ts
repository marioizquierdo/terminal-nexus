// The phase a sandbox is in (docs/system-design/sandboxes.md, "Build Phase or Battle Round"): what its opening plays.
//
// - **Battle Round** (the default): the kernel runs from the opening for its ticks. Units march, strike, spawn, die.
// - **Build Phase**: the kernel does not run. Units and buildings stand where they were placed, idle, as the Build
//   Phase finds them between two rounds; what time does to them is the regroup's alone (`src/match/regroup.ts`):
//   what a round's end resets is reset, a building that mends mends, and a unit in a fight steps back and forms up
//   over the regroup's ten seconds. Nothing attacks, trains, spawns or burns.
//
// Pure: the same opening, content and seed give the same states and the same hashes on every machine. It plays the
// match layer's own rule (`regroup`) beside the kernel and never inside it, as the game's Build Phase does.

import type { ContentRegistry } from "../../content/index.ts"
import type { DomainEvent } from "../../events/types.ts"
import { hashEvents } from "../../events/serialize.ts"
import { regroup, regroupAt } from "../../match/index.ts"
import { ENGINE_VERSION, contentLockOf, resolvePulse, spawnEvents } from "../../pulse/index.ts"
import type { PulseRun } from "../../pulse/index.ts"
import { hashState } from "../../state/serialize.ts"
import type { MatchState } from "../../state/types.ts"

/** Which part of a round a sandbox's opening is in. Absent in a file: the Battle Round. */
export type SandboxPhase = "battle-round" | "build-phase"

export const SANDBOX_PHASES: readonly SandboxPhase[] = ["battle-round", "build-phase"]

/** The phase a sandbox opens in, the Battle Round unless it says another. */
export const phaseOf = (opening: Readonly<{ phase?: SandboxPhase }>): SandboxPhase => opening.phase ?? "battle-round"

export type PhaseOptions = Readonly<{
  /** Shown every state, the opening first, with the events of the tick that made it: as `resolvePulse` shows them. */
  watch?: (state: MatchState, events: readonly DomainEvent[]) => void
}>

/**
 * **A sandbox's phase played**: the kernel for its `pulseTicks` in the Battle Round; the regroup's walk (`REGROUP_TICKS`)
 * in the Build Phase, whose run has no events but the spawns that say who stands where, and whose `pulseTicks` is the
 * regroup's own, whatever the sandbox's `roundTicks` say.
 */
export function playPhase(
  phase: SandboxPhase,
  initialState: MatchState,
  registry: ContentRegistry,
  pulseTicks: number,
  seed: number,
  options: PhaseOptions = {},
): PulseRun {
  if (phase === "battle-round") return resolvePulse({ initialState, registry, pulseTicks, seed, ...(options.watch === undefined ? {} : { watch: options.watch }) })
  const result = regroup(initialState, registry)
  const paths = new Map(result.paths.map((path) => [path.ordinal, path]))
  /** The state at tick `tick` of the walk: the regroup's settled state with each walker where its walk had it. */
  const at = (tick: number): MatchState => ({
    ...result.state,
    tick,
    entities: result.state.entities.map((entity) => {
      const path = paths.get(entity.ordinal)
      return path === undefined ? entity : { ...entity, anchor: regroupAt(path, tick) }
    }),
  })
  const events: DomainEvent[] = spawnEvents(initialState, registry)
  options.watch?.(at(0), [])
  for (let tick = 1; tick <= result.ticks; tick += 1) options.watch?.(at(tick), [])
  const finalState = at(result.ticks)
  return {
    schemaVersion: initialState.schemaVersion,
    engineVersion: ENGINE_VERSION,
    contentLock: contentLockOf(registry),
    ticksPerSecond: initialState.ticksPerSecond,
    pulseTicks: result.ticks,
    seed,
    initialState,
    finalState,
    events,
    stateHash: hashState(finalState),
    eventsHash: hashEvents(events),
  }
}
