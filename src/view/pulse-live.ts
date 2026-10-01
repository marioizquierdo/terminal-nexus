// The Nexus Pulse as the live screen plays it (gate 6A) — the one place a resolved Pulse meets a clock.
//
// The kernel resolved the whole Pulse before the first frame (`src/cli/pulse-run.ts`); what is left is
// **when to show what**, and that is presentation: a playback clock the player can pause, slow, step and
// restart (`Playback`, `grid watch`'s own), and from it the ending's moments (`ending.ts`), every one a
// pure function of the Pulse's presentation time. The clock is read in one place — the caller hands in
// `now` as a number, as `BuildAnimation` is handed it — so a test drives a whole Pulse, its last seconds
// and its walk home included, without waiting a second.
//
// Two things reach back into the Build Phase's state, both as ordinary named commands (`due`): the view
// is centred on the player's Grid Nexus when the Pulse starts and again when its ending begins. Nothing
// here can change what the Pulse did — presentation never can (engine.md Section 1).

import type { BuildCommand } from "../build/types.ts"
import type { TileWidth } from "../build/camera.ts"
import type { Coord } from "../grid/types.ts"
import type { RecallResult } from "../match/types.ts"
import type { MissionVerdict } from "../mission/types.ts"
import type { Outcome } from "../state/types.ts"
import { endingTimes, missionResultOf, nexusStrain, phaseAt, redAlert, resultOf, walkPositions } from "./ending.ts"
import type { EndingPhase, EndingTimes, NexusStrain, PulseResult } from "./ending.ts"
import type { CapabilityMode } from "./roles.ts"
import { FRAME_MS } from "./build-live.ts"
import { Playback } from "./playback.ts"
import type { PlaybackControl } from "./playback.ts"
import type { PulseFrame } from "./pulse-scene.ts"
import { DEFAULT_PRESENTATION, createView } from "./snapshot.ts"
import type { PresentationOptions, PulseTimeline, PulseView } from "./snapshot.ts"

/** A Pulse the kernel has resolved, and what Recall does at the end of it — everything the screen needs
 *  to play it, built by the application shell (`src/cli/pulse-run.ts`) and never by the view. */
export type ResolvedPulse = Readonly<{
  timeline: PulseTimeline
  recall: RecallResult
  /** The tile the player's Grid Nexus stands on, where the view looks at the start and the end; `null`
   *  for a map with none. */
  nexus: Coord | null
  /** How the mission stands after this Pulse (gate 6B): which round it was, and whether the mission goes
   *  on or a trigger ended it. Absent for a Pulse with no mission. */
  mission?: MissionRound
}>

/** A mission's round, as the result reads it. */
export type MissionRound = Readonly<{
  verdict: MissionVerdict
  round: number
  of: number
  /** The mission's own line for a won or lost mission. */
  endText?: Readonly<{ won: string; lost: string }>
}>

/** Frames a second the playback's own single-frame step is worth (`grid watch`'s 30). */
const STEP_FRAMES_PER_SECOND = 30

/** A unit rather than a structure: structures sit on the obstacles layer, and a force bar leaves them out
 *  (a 400-point Grid Nexus would swamp it). */
const isMobile = (timeline: PulseTimeline, contentId: string): boolean => timeline.registry.get(contentId).layer !== "obstacles"

const finalStateOf = (timeline: PulseTimeline) => timeline.states[timeline.states.length - 1]

/** How the resolved Pulse ended. Always one: the resolver only stops on an outcome, and the tick limit is
 *  one. A timeline with none (a hand-built one) reads as the tick limit at its last tick. */
export function outcomeOf(timeline: PulseTimeline): Outcome {
  const last = finalStateOf(timeline)
  return last?.outcome ?? { winner: null, reason: "tick-limit", tick: last?.tick ?? 0 }
}

export class PulsePresenter {
  readonly resolved: ResolvedPulse
  private readonly view: PulseView
  private readonly playback: Playback
  private readonly result: PulseResult
  /** What happened to the player's Nexus, read once: the red flashes are timed from it. */
  private readonly strain: NexusStrain
  /** How many mobile units the player has once Recall is done. It never changes, so it is counted once. */
  private readonly home: number
  /** The ending's moments: when the warning starts, the fight stops, the walk home starts and ends. The
   *  timings are the owner's tuned ones and fixed for a Pulse, so they are worked out once. */
  readonly times: EndingTimes
  private lastNow: number | null = null
  /** The commands already sent this run, so each is sent once: the camera's `start` and `end`, and the
   *  move on to the next round. */
  private fired = new Set<"start" | "end" | "next">()

  /** How long after the result appears the next round begins on its own, or `null`: it waits for the
   *  player (the Next round Experiment, gate 6B). */
  private readonly autoNextMs: number | null

  constructor(
    resolved: ResolvedPulse,
    presentation: PresentationOptions = DEFAULT_PRESENTATION,
    options: Readonly<{ autoNextMs?: number | null }> = {},
  ) {
    this.resolved = resolved
    this.autoNextMs = options.autoNextMs ?? null
    this.view = createView(resolved.timeline, presentation)
    this.times = endingTimes(this.view.lastTick * this.view.tickDurationMs, this.view.effectsEndMs)
    this.result = missionResultOf(resultOf(outcomeOf(resolved.timeline)), resolved.mission)
    this.strain = nexusStrain(resolved.timeline)
    this.home = resolved.recall.state.entities.filter(
      (entity) => entity.player === "A" && isMobile(resolved.timeline, entity.contentId),
    ).length
    this.playback = new Playback({
      tickDurationMs: this.view.tickDurationMs,
      frameDurationMs: 1000 / STEP_FRAMES_PER_SECOND,
    })
  }

  /** Where in the Pulse the screen is, in presentation milliseconds. */
  get timeMs(): number {
    return this.playback.presentationTimeMs
  }

  get paused(): boolean {
    return this.playback.paused
  }

  get speed(): number {
    return this.playback.speed
  }

  /**
   * Time passes: `now` is the screen's own clock in milliseconds. The first call only starts the clock —
   * a Pulse is at zero when it begins, however long ago the screen did. `hold` keeps the presentation
   * still while the clock moves on (the terminal is too small to draw it), so resizing back resumes from
   * the same instant.
   */
  advance(now: number, hold = false): void {
    if (this.lastNow === null) {
      this.lastNow = now
      return
    }
    const elapsed = Math.max(0, now - this.lastNow)
    this.lastNow = now
    if (!hold) this.playback.advance(elapsed)
  }

  /** A playback control: pause, speed, a step, or watching it again from the top. */
  apply(control: PlaybackControl): void {
    this.playback.apply(control)
    // From the top, the camera moves are due again: the story starts over, and so does the view.
    if (control === "restart") this.fired.clear()
  }

  /**
   * What the Pulse asks of the screen now: to centre on the player's Nexus when it starts, and again when
   * its last seconds begin (or the stop, when there is no warning) — "the camera is centred at the nexus",
   * so the next Build Phase starts where the base is (owner, 2026-09-30). Each once per run.
   */
  due(): BuildCommand[] {
    const commands: BuildCommand[] = []
    // The next round begins on its own a moment after the result, when the Next round Experiment says so.
    // Sent once; a paused Pulse's clock does not move, so it waits with it.
    if (this.autoNextMs !== null && !this.fired.has("next") && this.timeMs >= this.times.homeMs + this.autoNextMs) {
      this.fired.add("next")
      commands.push({ kind: "next-round" })
    }
    const { nexus } = this.resolved
    if (nexus === null) return commands
    const look: BuildCommand = { kind: "look-at", x: nexus.x, y: nexus.y }
    if (!this.fired.has("start")) {
      this.fired.add("start")
      commands.push(look)
    }
    if (!this.fired.has("end") && this.timeMs >= (this.times.warnMs ?? this.times.stopMs)) {
      this.fired.add("end")
      commands.push(look)
    }
    return commands
  }

  /** Where the Pulse is in its ending right now. */
  phase(): EndingPhase {
    return phaseAt(this.times, this.timeMs)
  }

  /** When the last thing still moving finishes, or `null` when nothing is: the frame timer runs until
   *  then. While it runs the picture changes every frame — a fight, a timer's flash, a walk home. */
  busyUntil(now: number): number | null {
    if (this.playback.paused) return null
    if (this.phase() !== "home") return now + FRAME_MS
    // The result stands still; the timer runs on only to begin the next round on its own, when it will.
    if (this.autoNextMs === null || this.fired.has("next")) return null
    return now + Math.max(FRAME_MS, this.times.homeMs + this.autoNextMs - this.timeMs)
  }

  /** What the scene draws at the Pulse's current time, the red flashes on the border when the player's
   *  Nexus is hurt included (the owner kept them, 2026-09-30). */
  frame(options: Readonly<{ capability: CapabilityMode; tileWidth: TileWidth; reducedMotion: boolean }>): PulseFrame {
    const { capability, tileWidth, reducedMotion } = options
    const timeMs = this.timeMs
    const times = this.times
    const sample = this.view.sampleAt(timeMs, capability, tileWidth, reducedMotion)
    const walk = walkPositions(this.resolved.recall.moves, times, timeMs, reducedMotion)
    const positions = walk.size === 0 ? sample.positions : new Map([...sample.positions, ...walk])
    const forces = { A: { units: 0, hp: 0 }, B: { units: 0, hp: 0 } }
    for (const entity of sample.state.entities) {
      if (!isMobile(this.resolved.timeline, entity.contentId)) continue
      forces[entity.player].units += 1
      forces[entity.player].hp += entity.hp
    }
    return {
      sample,
      registry: this.resolved.timeline.registry,
      openingHealth: this.view.openingHealth,
      ticksPerSecond: this.resolved.timeline.ticksPerSecond,
      paused: this.playback.paused,
      speed: this.playback.speed,
      phase: phaseAt(times, timeMs),
      timeMs,
      times,
      reducedMotion,
      redAlert: redAlert(this.strain, times, this.result.tone === "danger", timeMs, reducedMotion),
      positions,
      result: this.result,
      forces,
      home: this.home,
    }
  }
}
