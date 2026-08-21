// PRESENTATION — what it looks like. It consumes state and events, samples them at an arbitrary
// presentation time, and composes cells. It may interpolate, skip, pause, accelerate and lie about
// timing freely, because none of it can change an outcome (engine.md 1).
//
// `snapshotAt` is pure: same arguments, same frame. It never reads a clock, so a frame at time t is
// identical whether every earlier frame rendered or most were skipped.

import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import type { MatchState } from "../state/types.ts"
import type { ReadonlyCellFrame } from "./frame.ts"
import type { CapabilityMode } from "./roles.ts"
import type { TileWidth } from "./compose.ts"
import { FEED_KINDS, composeFrame } from "./compose.ts"

export type PulseTimeline = Readonly<{
  scenarioId: string
  scenarioName: string
  seed: number
  pulseTicks: number
  ticksPerSecond: number
  grid: GridTerrain
  registry: ContentRegistry
  /** `states[t]` is the state settled at the end of tick `t`; `states[0]` is the opening state. */
  states: readonly MatchState[]
  events: readonly DomainEvent[]
  stateHash: string
  eventsHash: string
}>

export type ViewControls = Readonly<{ paused: boolean; speed: number }>

/**
 * A step lands halfway through the tick interval that precedes it. At a frame sampled exactly on a
 * tick boundary every entity therefore stands on its authoritative tile — which is the check that
 * catches a compositor drawing a deterministic, correctly-sized picture of the wrong fight.
 */
const STEP_LANDS_AT = 0.5

export type PulseView = Readonly<{
  timeline: PulseTimeline
  lastTick: number
  durationMs: number
  tickDurationMs: number
  snapshotAt(timeMs: number, capability: CapabilityMode, tileWidth: TileWidth): ReadonlyCellFrame
  /** The same composition with live playback controls filled in — what `watch` presents. */
  composeAt(
    timeMs: number,
    capability: CapabilityMode,
    tileWidth: TileWidth,
    controls: ViewControls,
  ): ReadonlyCellFrame
}>

export function createView(timeline: PulseTimeline): PulseView {
  const lastTick = timeline.states.length - 1
  const tickDurationMs = 1000 / timeline.ticksPerSecond
  const movesByTick = new Map<number, DomainEvent[]>()
  for (const event of timeline.events) {
    if (event.kind !== "entity.moved") continue
    const bucket = movesByTick.get(event.tick)
    if (bucket === undefined) movesByTick.set(event.tick, [event])
    else bucket.push(event)
  }
  const feed = timeline.events.filter((event) =>
    (FEED_KINDS as readonly string[]).includes(event.kind),
  )

  const clampTick = (tick: number): number => Math.max(0, Math.min(lastTick, tick))

  const composeAt = (
    timeMs: number,
    capability: CapabilityMode,
    tileWidth: TileWidth,
    controls: ViewControls,
  ): ReadonlyCellFrame => {
    const exact = (Math.max(0, timeMs) * timeline.ticksPerSecond) / 1000
    const tick = clampTick(Math.floor(exact))
    const state = timeline.states[tick]
    if (state === undefined) throw new Error("timeline holds no states")

    // Interpolation lives entirely here. The simulation never learns about the in-between position.
    const positions = new Map<number, Coord>()
    for (const entity of state.entities) positions.set(entity.ordinal, entity.anchor)
    const fraction = tick >= lastTick ? 0 : exact - Math.floor(exact)
    if (fraction >= STEP_LANDS_AT) {
      for (const event of movesByTick.get(tick + 1) ?? []) {
        if (event.kind !== "entity.moved") continue
        if (positions.has(event.ordinal)) positions.set(event.ordinal, event.to)
      }
    }

    return composeFrame(
      {
        scenarioId: timeline.scenarioId,
        scenarioName: timeline.scenarioName,
        seed: timeline.seed,
        pulseTicks: timeline.pulseTicks,
        grid: timeline.grid,
        registry: timeline.registry,
        state,
        positions,
        tick,
        recent: feed.filter((event) => event.tick <= tick),
        paused: controls.paused,
        speed: controls.speed,
        status: statusOf(state, tick, lastTick),
      },
      capability,
      tileWidth,
    )
  }

  return {
    timeline,
    lastTick,
    durationMs: (lastTick + 1) * tickDurationMs,
    tickDurationMs,
    // `snapshotAt` deliberately takes no controls, so a snapshot test never depends on what the
    // player happened to be doing when it was taken.
    snapshotAt: (timeMs, capability, tileWidth) =>
      composeAt(timeMs, capability, tileWidth, { paused: false, speed: 1 }),
    composeAt,
  }
}

function statusOf(state: MatchState, tick: number, lastTick: number): string {
  if (state.outcome !== null) {
    return state.outcome.winner === null
      ? `pulse over - draw by ${state.outcome.reason}`
      : `pulse over - ${state.outcome.winner} wins by ${state.outcome.reason}`
  }
  return tick >= lastTick ? "pulse complete" : "pulse running"
}
