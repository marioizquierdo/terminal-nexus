// The Battle Round as the live screen plays it — the one place a resolved Pulse meets a clock.
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
// here can change what the Pulse did — presentation never can (`docs/system-design/grid-engine.md`).
//
// Two more things the presenter works out for the scene, the same way: what the player's Commander says and
// when (`pulse-voice.ts`, planned once from the resolved Pulse, shown beside her, or in the panel while she is out
// of view), and the reach of her aura while the fight is on — both read off the Pulse, neither able to touch it.

import type { Barks } from "../armies/barks.ts"
import type { BuildCommand, CommanderAbsence } from "../build/types.ts"
import type { Camera, Viewport, VisibleRange } from "../build/camera.ts"
import { visibleRange } from "../build/camera.ts"
import type { Coord } from "../grid/types.ts"
import type { RecallResult } from "../match/types.ts"
import type { MissionVerdict } from "../mission/types.ts"
import type { Outcome, PlayerId } from "../state/types.ts"
import { endingTimes, missionResultOf, nexusStrain, phaseAt, redAlert, resultOf, walkPositions } from "./ending.ts"
import type { EndingPhase, EndingTimes, NexusStrain, PulseResult } from "./ending.ts"
import type { CapabilityMode } from "./roles.ts"
import { FRAME_MS } from "./build-live.ts"
import type { ActiveEffect } from "./effects/index.ts"
import { EFFECT_RECIPES } from "./effects/recipes.ts"
import { Playback } from "../terminal/playback.ts"
import type { PlaybackControl } from "../terminal/playback.ts"
import type { AuraFrame, PulseFrame, VoiceFrame } from "./pulse-scene.ts"
import type { Speaker, SpokenLine } from "./pulse-voice.ts"
import { VOICE, commanderOf, labelPlace, planVoice, shippedBarks, speakerOf, voiceAt, voiceLight, voiceMoments } from "./pulse-voice.ts"
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
  /** How the mission stands after this Pulse: which round it was, and whether the mission goes
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
  /** The Commanders who fell this round, and the round each is back for (`src/match/commander.ts`). */
  fell?: readonly CommanderAbsence[]
}>

/** Frames a second the playback's own single-frame step is worth (`grid watch`'s 30). */
const STEP_FRAMES_PER_SECOND = 30

/** How a frame is drawn: the player's display settings, and — for her voice — the part of the map in view (her
 *  words go to the panel when she is out of it). */
export type PulseFrameOptions = Readonly<{
  capability: CapabilityMode
  reducedMotion: boolean
  /** The part of the map on screen. Absent: all of it. */
  view?: Readonly<{ camera: Camera; viewport: Viewport }>
}>

/** The player's Commander in a resolved Pulse, as her aura and her voice read her: her ordinal, her unit, and
 *  her aura's reach in tiles (`null` without one). */
type Bearer = Readonly<{ ordinal: number; contentId: string; player: PlayerId; aura: number | null }>

/** Her voice in one Pulse, planned once: who speaks, what she says when, where she fell (her last words are
 *  said there), and where on the map each line beside her is shown, worked out the first time it is drawn. */
type VoicePlan = Readonly<{ speaker: Speaker; lines: readonly SpokenLine[]; fellAt: Coord | null; places: Map<SpokenLine, Coord> }>

/** How the presenter finds a Commander's lines: by her unit's id, in the armies the game ships unless a test
 *  hands it others. */
export type BarksOf = (contentId: string) => Barks

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
   *  player (the Next round Experiment). */
  private readonly autoNextMs: number | null

  /** The player's Commander in this Pulse, or `null` when she is not on the Grid in it. */
  private readonly bearer: Bearer | null
  /** What she says in this Pulse and when, or `null` when she says nothing in it (`pulse-voice.ts`). */
  private readonly voice: VoicePlan | null

  constructor(
    resolved: ResolvedPulse,
    presentation: PresentationOptions = DEFAULT_PRESENTATION,
    options: Readonly<{ autoNextMs?: number | null; barksOf?: BarksOf }> = {},
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
    this.bearer = bearerOf(resolved.timeline)
    this.voice = this.planLines(options.barksOf ?? shippedBarks, presentation.cosmeticSeed)
  }

  /** Her voice in this Pulse, planned once from the resolved fight: its moments, and the lines she says at the
   *  ones there is room for. The round's number steps the line each moment picks (`pickLine`). */
  private planLines(barksOf: BarksOf, cosmeticSeed: number): VoicePlan | null {
    const { timeline } = this.resolved
    const speaker = speakerOf(timeline, barksOf)
    if (speaker === null) return null
    const end = { resultMs: this.times.homeMs, won: this.result.tone === "success" }
    const lines = planVoice(voiceMoments(timeline, speaker, end), speaker.barks, { round: this.resolved.mission?.round ?? 1, cosmeticSeed })
    if (lines.length === 0) return null
    const fell = timeline.events.find((event) => event.kind === "entity.died" && event.ordinal === speaker.ordinal)
    return { speaker, lines, fellAt: fell?.kind === "entity.died" ? fell.at : null, places: new Map() }
  }

  /** What she says in this Pulse, in the order she says it — none when she says nothing. What the session
   *  records in the Activity Logs as each one starts. */
  get spoken(): readonly SpokenLine[] {
    return this.voice?.lines ?? []
  }

  /** Her name as the screen gives it, when she says anything in this Pulse. */
  get speakerName(): string | null {
    return this.voice?.speaker.name ?? null
  }

  /** The tile she stands on at a presentation instant, by the resolved states (not the drawn glide), or where
   *  she fell once she has: where a line of hers is said, for the Activity Logs. `null` when she is not on the
   *  Grid. */
  speakerTileAt(timeMs: number): Coord | null {
    const voice = this.voice
    if (voice === null) return null
    const standing = this.stateAt(timeMs).entities.find((entity) => entity.ordinal === voice.speaker.ordinal)
    return standing?.anchor ?? voice.fellAt
  }

  /** What stands where at a presentation instant, by the resolved states: the fight's state at that tick, and
   *  once the walk home has begun, where Recall puts everyone. */
  private stateAt(timeMs: number): PulseTimeline["states"][number] {
    if (timeMs >= this.times.walkMs) return this.resolved.recall.state
    const { states } = this.resolved.timeline
    return states[Math.max(0, Math.min(this.view.lastTick, Math.floor(timeMs / this.view.tickDurationMs)))] ?? this.resolved.recall.state
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
   * so the next Build Phase starts where the base is. Each once per run.
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
    // A line of hers still typing, being read or thinning out over the result: every frame until it is gone.
    if (this.voice !== null && this.voice.lines.some((line) => this.timeMs < line.endMs)) return now + FRAME_MS
    // The result stands still; the timer runs on only to begin the next round on its own, when it will.
    if (this.autoNextMs === null || this.fired.has("next")) return null
    return now + Math.max(FRAME_MS, this.times.homeMs + this.autoNextMs - this.timeMs)
  }

  /** What the scene draws at the Pulse's current time, the red flashes on the border when the player's
   *  Nexus is hurt included (the owner kept them, 2026-09-30), and — while she is on the Grid — her aura's
   *  reach and what she is saying. */
  frame(options: PulseFrameOptions): PulseFrame {
    const { capability, reducedMotion } = options
    const timeMs = this.timeMs
    const times = this.times
    const drawn = this.view.sampleAt(timeMs, capability, reducedMotion)
    const walk = walkPositions(this.resolved.recall.moves, times, timeMs, reducedMotion)
    const positions = walk.size === 0 ? drawn.positions : new Map([...drawn.positions, ...walk])
    const forces = { A: { units: 0, hp: 0 }, B: { units: 0, hp: 0 } }
    for (const entity of drawn.state.entities) {
      if (!isMobile(this.resolved.timeline, entity.contentId)) continue
      forces[entity.player].units += 1
      forces[entity.player].hp += entity.hp
    }
    const phase = phaseAt(times, timeMs)
    const aura = this.auraAt(drawn.state.entities, positions, phase)
    const voice = this.voiceFrame(options, drawn.state.entities, drawn.heldCorpses, positions)
    // The light on her as she starts to speak, painted with every other effect, under the corruption law.
    const light = voice === null ? null : this.lightOn(voice, options)
    const sample = light === null ? drawn : { ...drawn, effects: [...drawn.effects, light] }
    return {
      ...(aura === null ? {} : { aura }),
      ...(voice === null ? {} : { voice: voice.frame }),
      sample,
      registry: this.resolved.timeline.registry,
      openingHealth: this.view.openingHealth,
      ticksPerSecond: this.resolved.timeline.ticksPerSecond,
      paused: this.playback.paused,
      speed: this.playback.speed,
      phase,
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

  /**
   * Her aura's reach, while the fight is on and she stands in it: the tile she is drawn on, and the radius the
   * content gives her aura. Gone at cease fire — it protects in a fight, and the walk home is not one — and
   * gone when she falls.
   */
  private auraAt(standing: readonly Readonly<{ ordinal: number }>[], positions: ReadonlyMap<number, Coord>, phase: EndingPhase): AuraFrame | null {
    const bearer = this.bearer
    if (bearer === null || bearer.aura === null || bearer.aura <= 0) return null
    if (phase !== "fighting" && phase !== "final") return null
    if (!standing.some((entity) => entity.ordinal === bearer.ordinal)) return null
    const at = positions.get(bearer.ordinal)
    return at === undefined ? null : { at, radius: bearer.aura, player: bearer.player }
  }

  /**
   * What she is saying at this instant, as the scene draws it, or `null` when she is saying nothing. Said where
   * she is drawn, or where she fell for her last words: beside her on the map, or in the panel while she, or the
   * row her line sits on, is out of the part of the map on screen.
   */
  private voiceFrame(
    options: PulseFrameOptions,
    standing: readonly Readonly<{ ordinal: number }>[],
    held: readonly Readonly<{ ordinal: number }>[],
    positions: ReadonlyMap<number, Coord>,
  ): Readonly<{ frame: VoiceFrame; line: SpokenLine; at: Coord }> | null {
    const voice = this.voice
    if (voice === null) return null
    const now = voiceAt(voice.lines, this.timeMs, options.reducedMotion)
    if (now === null) return null
    const { speaker } = voice
    const here = standing.some((entity) => entity.ordinal === speaker.ordinal) || held.some((entity) => entity.ordinal === speaker.ordinal)
    const at = here ? (positions.get(speaker.ordinal) ?? voice.fellAt) : voice.fellAt
    if (at === null) return null
    const place = this.placeFor(now.line, options.view)
    // Beside her only while she, and the row her line sits on, are in the part of the map on screen.
    const range = options.view === undefined ? null : visibleRange(options.view.camera, options.view.viewport)
    const seen =
      place !== null && (range === null || (inRange(at, range) && place.y >= range.firstY && place.y <= range.lastY))
    const frame: VoiceFrame = {
      text: now.line.text,
      typed: now.typed,
      fading: now.fading,
      name: speaker.name,
      contentId: speaker.contentId,
      player: speaker.player,
      where: seen ? "map" : "panel",
      at,
      place: place ?? at,
    }
    return { frame, line: now.line, at }
  }

  /** Where on the map a line beside her is shown (`labelPlace`): worked out the first time the line is drawn,
   *  from where she stands as it begins, everything it will be shown over and the part of the map in view then,
   *  and kept while it is said. `null` when she is nowhere to say it from. */
  private placeFor(line: SpokenLine, view: PulseFrameOptions["view"]): Coord | null {
    const voice = this.voice
    if (voice === null) return null
    const known = voice.places.get(line)
    if (known !== undefined) return known
    const { timeline } = this.resolved
    // Everything the line is shown over: the fight's states from its start to its end — or, once the walk home
    // has begun, everyone where Recall puts them.
    const tickOf = (ms: number): number => Math.max(0, Math.min(this.view.lastTick, Math.floor(ms / this.view.tickDurationMs)))
    const over = line.startMs >= this.times.walkMs ? [this.resolved.recall.state] : timeline.states.slice(tickOf(line.startMs), tickOf(line.endMs) + 1)
    const her = this.speakerTileAt(line.startMs)
    const opening = timeline.states[0]
    if (her === null || opening === undefined) return null
    const within = view === undefined ? undefined : visibleRange(view.camera, view.viewport)
    const place = labelPlace(line.text, her, over, timeline.registry, opening.grid, within)
    voice.places.set(line, place)
    return place
  }

  /** The light on her as a line starts (`voiceLight`), while it lasts: none for her last words — she is gone
   *  from the tile — and none with the effects off. */
  private lightOn(voice: Readonly<{ line: SpokenLine; at: Coord }>, options: PulseFrameOptions): ActiveEffect | null {
    const { line, at } = voice
    if (line.moment === "falls" || !this.view.presentation.effects) return null
    if (this.timeMs >= line.startMs + VOICE.lightMs) return null
    const instance = voiceLight(line, at)
    const recipe = EFFECT_RECIPES[instance.recipe]
    if (recipe === undefined) return null
    const cells = recipe(instance, {
      timeMs: this.timeMs,
      cosmeticSeed: this.view.presentation.cosmeticSeed,
      reducedMotion: options.reducedMotion,
      capability: options.capability,
    })
    return { instance, cells }
  }
}

/** Whether a tile is in the part of the map on screen. */
function inRange(tile: Coord, range: VisibleRange): boolean {
  return tile.x >= range.firstX && tile.x <= range.lastX && tile.y >= range.firstY && tile.y <= range.lastY
}

/** The player's Commander in a resolved Pulse, with her aura's reach, or `null` when she is not on the Grid in it. */
function bearerOf(timeline: PulseTimeline): Bearer | null {
  const commander = commanderOf(timeline)
  if (commander === null) return null
  const aura = timeline.registry.get(commander.contentId).aura?.radius ?? null
  return { ordinal: commander.ordinal, contentId: commander.contentId, player: commander.player, aura }
}
