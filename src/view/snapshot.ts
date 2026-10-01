// PRESENTATION — what it looks like. It consumes state and events, samples them at an arbitrary
// presentation time, and composes cells. It may interpolate, skip, pause, accelerate and lie about
// timing freely, because none of it can change an outcome (`docs/system-design/grid-engine.md`).
//
// `snapshotAt` is pure: same arguments, same frame. It never reads a clock, so a frame at time t is
// identical whether every earlier frame rendered or most were skipped.

import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import type { MatchState, PlayerId } from "../state/types.ts"
import type { ActiveEffect } from "./effects/index.ts"
import { EffectTimeline, buildFlightHoldTicks, deriveEffects, flightHoldTicks } from "./effects/index.ts"
import type { GlyphPack } from "./theme.ts"
import type { ReadonlyCellFrame } from "./frame.ts"
import type { CapabilityMode } from "./roles.ts"
import type { HeldCorpse, TileWidth } from "./compose.ts"
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
 * How the view is dressed. None of it can reach the kernel: the cosmetic seed feeds effects only,
 * and a test asserts that changing it moves no state or event hash.
 */
export type PresentationOptions = Readonly<{
  effects: boolean
  reducedMotion: boolean
  cosmeticSeed: number
  glyphPack: GlyphPack
}>

export const DEFAULT_PRESENTATION: PresentationOptions = {
  effects: true,
  reducedMotion: false,
  cosmeticSeed: 0x0c05e7,
  glyphPack: "ascii",
}

/**
 * A step lands halfway through the tick interval that precedes it. At a frame sampled exactly on a
 * tick boundary every entity therefore stands on its authoritative tile — which is the check that
 * catches a compositor drawing a deterministic, correctly-sized picture of the wrong fight.
 */
const STEP_LANDS_AT = 0.5

/**
 * Everything the view draws at one presentation instant, before it is laid onto a screen: which tick's
 * state, where each entity is drawn between ticks, the ranged kills still waiting for their tracers, what
 * every effect is painting, and the feed up to that tick. `composeAt` puts it in the old Pulse frame; the
 * Build Phase's own frame puts it on the Grid through the camera. Pure, like the rest of the view.
 */
export type PulseSample = Readonly<{
  tick: number
  state: MatchState
  /** Where each entity is drawn — interpolated, and never known to the simulation. */
  positions: ReadonlyMap<number, Coord>
  heldCorpses: readonly HeldCorpse[]
  effects: readonly ActiveEffect[]
  /** The feed's events up to this tick. */
  recent: readonly DomainEvent[]
}>

export type PulseView = Readonly<{
  timeline: PulseTimeline
  presentation: PresentationOptions
  /** How many effect instances the whole Pulse produced. Evidence, and a smoke test. */
  effectCount: number
  lastTick: number
  durationMs: number
  tickDurationMs: number
  /** Each side's health at tick zero, structures excluded — what a force bar is measured against. */
  openingHealth: ReadonlyMap<PlayerId, number>
  /** When the last effect finishes: everything still "in flight" at the end of the fight has landed by
   *  then — the Pulse's ending waits for it before Recall plays. At least the
   *  last tick's own time. */
  effectsEndMs: number
  /** The drawable data at a presentation time. `reducedMotion` overrides the view's own — a player who
   *  turns it on mid-Pulse — without rebuilding the view. */
  sampleAt(timeMs: number, capability: CapabilityMode, tileWidth: TileWidth, reducedMotion?: boolean): PulseSample
  snapshotAt(timeMs: number, capability: CapabilityMode, tileWidth: TileWidth): ReadonlyCellFrame
  /** The same composition with live playback controls filled in — what `watch` presents. */
  composeAt(
    timeMs: number,
    capability: CapabilityMode,
    tileWidth: TileWidth,
    controls: ViewControls,
  ): ReadonlyCellFrame
}>

export function createView(
  timeline: PulseTimeline,
  presentation: PresentationOptions = DEFAULT_PRESENTATION,
): PulseView {
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
  const instances = presentation.effects
    ? deriveEffects({
        states: timeline.states,
        events: timeline.events,
        registry: timeline.registry,
        ticksPerSecond: timeline.ticksPerSecond,
      })
    : []
  const effects = new EffectTimeline(instances)
  const effectsEndMs = instances.reduce(
    (latest, instance) => Math.max(latest, instance.startMs + instance.durationMs),
    lastTick * tickDurationMs,
  )

  const clampTick = (tick: number): number => Math.max(0, Math.min(lastTick, tick))

  /**
   * A ranged kill's target vanishes from `state.entities` the instant it dies, but its own tracer
   * keeps travelling for the rest of its flight window (`fx.ranged.tracer`, held to the same beat
   * `fx.death.collapse` already waits for) — so without this, the unit disappeared before the shot
   * that killed it arrived (owner playtest, 2026-08-22: "the enemy dies instantly while the
   * projectile arrives later"). One record per `entity.died`/`structure.destroyed`, built once
   * rather than re-scanned every frame; `holdTicks` is 0 for anything not killed by a ranged attack
   * this same tick (melee, or a chain death from a blast), so this is a no-op for those.
   */
  const flightHolds = buildFlightHoldTicks(timeline.events)
  const deathRecords = timeline.events
    .filter((event) => event.kind === "entity.died" || event.kind === "structure.destroyed")
    .map((event) => {
      if (event.kind !== "entity.died" && event.kind !== "structure.destroyed") {
        throw new Error("unreachable")
      }
      return {
        ordinal: event.ordinal,
        contentId: event.contentId,
        player: event.player,
        anchor: event.at,
        deathTick: event.tick,
        holdTicks: flightHoldTicks(flightHolds, event.tick, event.ordinal),
      }
    })
    .filter((record) => record.holdTicks > 0)

  const roster = (timeline.states[0]?.entities ?? []).map((entity) => entity.contentId)
  const openingHealth = new Map<PlayerId, number>()
  for (const entity of timeline.states[0]?.entities ?? []) {
    if (timeline.registry.get(entity.contentId).layer === "obstacles") continue
    openingHealth.set(entity.player, (openingHealth.get(entity.player) ?? 0) + entity.hp)
  }

  const sampleAt = (
    timeMs: number,
    capability: CapabilityMode,
    tileWidth: TileWidth,
    reducedMotion: boolean = presentation.reducedMotion,
  ): PulseSample => {
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

    // Still travelling toward this one: at or past the tick it died (otherwise it is drawn for real,
    // out of `state.entities`, and adding it again here would double it), but its tracer's flight
    // window has not run out yet.
    const heldCorpses: HeldCorpse[] = []
    for (const record of deathRecords) {
      if (record.deathTick > tick) continue
      const impactAtMs = (record.deathTick + record.holdTicks) * tickDurationMs
      if (timeMs >= impactAtMs) continue
      heldCorpses.push({
        ordinal: record.ordinal,
        contentId: record.contentId,
        player: record.player,
        anchor: record.anchor,
      })
    }

    return {
      tick,
      state,
      positions,
      heldCorpses,
      effects: effects.cellsAt({
        timeMs: Math.max(0, timeMs),
        cosmeticSeed: presentation.cosmeticSeed,
        tileWidth,
        reducedMotion,
        capability,
      }),
      recent: feed.filter((event) => event.tick <= tick),
    }
  }

  const composeAt = (
    timeMs: number,
    capability: CapabilityMode,
    tileWidth: TileWidth,
    controls: ViewControls,
  ): ReadonlyCellFrame => {
    const sample = sampleAt(timeMs, capability, tileWidth)
    return composeFrame(
      {
        scenarioId: timeline.scenarioId,
        scenarioName: timeline.scenarioName,
        seed: timeline.seed,
        pulseTicks: timeline.pulseTicks,
        grid: timeline.grid,
        registry: timeline.registry,
        state: sample.state,
        roster,
        openingHealth,
        positions: sample.positions,
        heldCorpses: sample.heldCorpses,
        tick: sample.tick,
        recent: sample.recent,
        paused: controls.paused,
        speed: controls.speed,
        status: statusOf(sample.state, sample.tick, lastTick),
        glyphPack: presentation.glyphPack,
        effects: sample.effects,
      },
      capability,
      tileWidth,
    )
  }

  return {
    timeline,
    presentation,
    effectCount: effects.size,
    lastTick,
    durationMs: (lastTick + 1) * tickDurationMs,
    tickDurationMs,
    openingHealth,
    effectsEndMs,
    sampleAt,
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
