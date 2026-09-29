// The Nexus Pulse as the live screen plays it (gate 6A) — the one place a resolved Pulse meets a clock.
//
// The kernel resolved the whole Pulse before the first frame (`src/cli/pulse-run.ts`); what is left is
// **when to show what**, and that is presentation: a playback clock the player can pause, slow, step and
// restart (`Playback`, `grid watch`'s own), and from it the ending's moments (`ending.ts`), every one a
// pure function of the Pulse's presentation time. The clock is read in one place — the caller hands in
// `now` as a number, as `BuildAnimation` is handed it — so a test drives a whole Pulse, alarm and walk
// home included, without waiting a second.
//
// Two things reach back into the Build Phase's state, both as ordinary named commands (`due`): the view
// is centred on the player's Grid Nexus when the Pulse starts and again when its ending begins. Nothing
// here can change what the Pulse did — presentation never can (engine.md Section 1).

import type { BuildCommand } from "../build/types.ts"
import type { DebugFlags } from "../build/debug.ts"
import type { TileWidth } from "../build/camera.ts"
import type { Coord } from "../grid/types.ts"
import type { RecallResult } from "../match/types.ts"
import type { Outcome } from "../state/types.ts"
import { endingTimes, nexusStrain, phaseAt, redAlert, resultOf, walkPositions } from "./ending.ts"
import type { EndingTimes, NexusStrain, PulseResult } from "./ending.ts"
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
}>

/** Frames a second the playback's own single-frame step is worth (`grid watch`'s 30). */
const STEP_FRAMES_PER_SECOND = 30

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
  private lastNow: number | null = null
  /** The camera moves already made this run, so each is sent once: `start` and `end`. */
  private fired = new Set<"start" | "end">()

  constructor(resolved: ResolvedPulse, presentation: PresentationOptions = DEFAULT_PRESENTATION) {
    this.resolved = resolved
    this.view = createView(resolved.timeline, presentation)
    this.result = resultOf(outcomeOf(resolved.timeline))
    this.strain = nexusStrain(resolved.timeline)
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

  /** The ending's moments under the Experiments as they are set right now — so changing one is felt at
   *  once, and "Watch again" plays the new numbers from the top. */
  times(flags: DebugFlags): EndingTimes {
    return endingTimes(this.view.lastTick * this.view.tickDurationMs, this.view.effectsEndMs, flags)
  }

  /**
   * What the Pulse asks of the screen now: to centre on the player's Nexus when it starts, and again when
   * its last seconds begin (or the stop, when there is no warning) unless "Centre on Nexus" is off — "the
   * camera is centred at the nexus", so the next Build Phase starts where the base is. Each once per run.
   */
  due(flags: DebugFlags): BuildCommand[] {
    const { nexus } = this.resolved
    if (nexus === null) return []
    const commands: BuildCommand[] = []
    const look: BuildCommand = { kind: "look-at", x: nexus.x, y: nexus.y }
    if (!this.fired.has("start")) {
      this.fired.add("start")
      commands.push(look)
    }
    if (flags.endCentre && !this.fired.has("end")) {
      const times = this.times(flags)
      if (this.timeMs >= (times.warnMs ?? times.stopMs)) {
        this.fired.add("end")
        commands.push(look)
      }
    }
    return commands
  }

  /** When the last thing still moving finishes, or `null` when nothing is: the frame timer runs until
   *  then. While it runs the picture changes every frame — a fight, a timer's flash, a walk home. */
  busyUntil(now: number, flags: DebugFlags): number | null {
    if (this.playback.paused) return null
    return phaseAt(this.times(flags), this.timeMs) === "home" ? null : now + FRAME_MS
  }

  /** What the scene draws at the Pulse's current time. */
  frame(
    options: Readonly<{ flags: DebugFlags; capability: CapabilityMode; tileWidth: TileWidth; reducedMotion: boolean; pulseNumber: number }>,
  ): PulseFrame {
    const { flags, capability, tileWidth, reducedMotion, pulseNumber } = options
    const timeMs = this.timeMs
    const times = this.times(flags)
    const sample = this.view.sampleAt(timeMs, capability, tileWidth, reducedMotion)
    const walk = walkPositions(this.resolved.recall.moves, times, timeMs, reducedMotion)
    const positions = walk.size === 0 ? sample.positions : new Map([...sample.positions, ...walk])
    const home = { A: 0, B: 0 }
    for (const entity of this.resolved.recall.state.entities) {
      if (this.resolved.timeline.registry.get(entity.contentId).layer !== "obstacles") home[entity.player] += 1
    }
    return {
      sample,
      registry: this.resolved.timeline.registry,
      openingHealth: this.view.openingHealth,
      ticksPerSecond: this.resolved.timeline.ticksPerSecond,
      pulseNumber,
      paused: this.playback.paused,
      speed: this.playback.speed,
      phase: phaseAt(times, timeMs),
      timeMs,
      times,
      reducedMotion,
      redAlert: flags.redAlerts ? redAlert(this.strain, times, this.result.tone === "danger", timeMs, reducedMotion) : 0,
      positions,
      result: this.result,
      home,
    }
  }
}
