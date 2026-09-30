// What the live Build Phase screen draws *between* commands — everything on it that depends on time
// (gate 5H). The reducer has no clock and never will; this is where the screen's clock is read, as a
// number the caller passes in, so every animation here is a pure function of the state and the time
// and a test can drive it without waiting:
//
//   - **the view slides** (engine.md 3.3's "camera moves eased over a few frames"): whenever the
//     state's camera changes — a click, an arrow at the margin, a Shift jump, arming that moved the
//     cursor, anything — the drawn camera eases from wherever it was drawn toward it over `easeMs`
//     milliseconds, whole tiles at a time, fast at first and settling at the end. Only a resize snaps
//     (`snap`);
//   - **the cursor glides** (owner, 2026-09-28: "interpolations are easy and powerful"): whenever the
//     state's cursor changes, the drawn cursor eases from the tile it was drawn on to the new one over
//     `cursorGlideMs`, so a Shift jump or a far click reads as motion rather than a teleport. The glide
//     is of the cursor's place **in the view** (its tile less the camera's), added to the drawn camera:
//     when only the camera moves — the cursor dragging it at the margin — the cursor rides along with
//     the slide, and a gliding cursor can never be drawn outside the view it is gliding across. The
//     armed preview and the refused flash move with it;
//   - **a menu row flashes** "pressed" or flickers "refused" (gate 5F), for `pressedFlashMs` or
//     `refusedFlashMs`;
//   - **the cursor flashes** where a placement was just tried and refused (gate 5H), for
//     `refusedCursorMs`;
//   - **a building goes up** (gate 5I): each planned placement plays its frames, light and sparks
//     for `placeFramesMs` and `placeGlowMs`, timed from the frame that first drew it;
//   - **a building comes down** (feedback F33): one that leaves the plan — undone, or removed with
//     Backspace/Delete — throws the same sparks where it stood, timed from the first frame without it;
//   - **a hand-off flies, and the cursor blinks** (feedback F54): when a menu row hands the keyboard
//     to the map (`BuildState.handoff`), the focus arrow — or, from Explore Map's row, the see-through
//     cursor (F64) — flies from the row to the cursor for the "Focus arrow" Experiment's milliseconds,
//     and when it lands the cursor blinks `cursorBlinks` times in the pressed flash's look and at its
//     speed. Keys work throughout; it all stops the moment the keyboard leaves the map, a popup opens or
//     the plan is committed. One flight, two travellers: which one flies is the view's to draw;
//   - **the menu turns into a card** (feedback F68): whenever the panel goes from the menu to a card —
//     Explore Map opened, a building armed from the menu or with a digit on the map — or from one card
//     to another armed building, the view plays the "Card reveal" Experiment's transition (the other
//     rows fade, the chosen row slides up to the header, the card types in). The reducer never hears
//     of it: this loop watches the state turn into a card the way it watches the plan grow. Closing a
//     card is instant.
//
// The numbers in backticks are the owner's tuned values (`src/build/tuning.ts`), which a `BuildAnimation`
// is handed when it is made (a test hands it others).
//
// `busyUntil` says whether anything is still moving, and until when: the live loop runs its frame
// timer only while it is not `null`, and otherwise draws once per input, as the screen always has.
//
// Under reduced motion both snap: the view jumps and the cursor jumps.
//
// Presentation only (engine.md Section 1: "presentation may interpolate... without changing
// simulation"): state, commands and a scripted playtest all use the state's own camera and cursor —
// the state is already where things are going. The one place the drawn camera reaches input is the
// mouse, so a click lands on the tile drawn under the pointer while the view is still sliding. The
// drawn cursor never reaches input: a click names a tile, and a second click on the tile the cursor
// is heading for places there even mid-glide.

import type { Camera } from "../build/camera.ts"
import type { Coord } from "../grid/types.ts"
import type { BuildState } from "../build/state.ts"
import { cardEntry } from "../build/state.ts"
import type { Tuning } from "../build/tuning.ts"
import { TUNING } from "../build/tuning.ts"
import type { BuildCompositionInput, CardReveal, RowAck } from "./build.ts"
import type { Footprint } from "../grid/types.ts"
import type { PlacedStructure, PlacementClock, PlacementTuning, RemovalClock } from "./placement.ts"
import { placementRequest, removalSchedule } from "./placement.ts"
import { scheduleTrack, trackBusyAt } from "./animation.ts"
import type { Point, Tween } from "./tween.ts"
import { retarget, samePoint, still, tileAt, tweenActive, tweenEnd } from "./tween.ts"

/**
 * What a live frame hands the composer — the fields of `BuildCompositionInput` that depend on time, and
 * only those (each documented there), so the live screen, the browser page and the capture scripts turn
 * a `LiveFrame` into a frame the same way and a new field reaches all of them at once.
 */
export type LivePresentation = Pick<
  BuildCompositionInput,
  | "camera"
  | "cursor"
  | "ack"
  | "refusedTry"
  | "placing"
  | "removing"
  | "placementTuning"
  | "handoffFlight"
  | "cursorBlink"
  | "cardReveal"
>

/** Everything time-dependent the frame at one instant shows — always a camera and a cursor, the state's
 *  own once they have finished moving — and when the last thing still moving ends, or `null` when
 *  nothing is. */
export type LiveFrame = LivePresentation & Readonly<{ camera: Camera; cursor: Coord; busyUntil: number | null }>

export function livePresentation(live: LiveFrame): LivePresentation {
  const { busyUntil: _busyUntil, ...presentation } = live
  return presentation
}

/**
 * The card reveal `elapsedMs` after the panel turned into a card, or `null` once it is over (or never
 * plays: its tuned length 0, or reduced motion). `fromMenu` says what the panel showed before: the menu,
 * whose rows fade and whose chosen row slides up, or another card, which gives way at once.
 */
export function cardRevealAt(
  tuning: Pick<Tuning, "cardRevealMs">,
  reducedMotion: boolean,
  elapsedMs: number,
  fromMenu: boolean,
): CardReveal | null {
  const lengthMs = reducedMotion ? 0 : Math.max(0, tuning.cardRevealMs)
  if (lengthMs <= 0 || elapsedMs < 0 || elapsedMs >= lengthMs) return null
  return { elapsedMs, lengthMs, fromMenu }
}

/**
 * When a menu row hands the keyboard to the map (feedback F54): its flight — the focus arrow, or the
 * see-through cursor — lasts `flightMs`, then the cursor blinks `blinks` times — each blink "on" for
 * `pulseMs` (the pressed flash's own duration, so it has the menu's speed), with an "off" gap of
 * `pulseMs` between two — and everything is over at `endMs`, counted from the hand-off. Under reduced
 * motion nothing flies and the blink plays at once; with the flight off it plays at once too; with no
 * blinks, or a pressed flash of 0, there is none.
 */
export type HandoffSchedule = Readonly<{ flightMs: number; pulseMs: number; blinks: number; endMs: number }>

/** What the hand-off is timed from: the "Focus arrow" Experiment (which times both travellers' flight),
 *  and the pressed flash and the blink count, which are tuned values. */
export type HandoffTiming = Readonly<{ focusArrowMs: number; pressedFlashMs: number; cursorBlinks: number }>

export function handoffSchedule(timing: HandoffTiming, reducedMotion: boolean): HandoffSchedule {
  const flightMs = reducedMotion ? 0 : Math.max(0, timing.focusArrowMs)
  const pulseMs = Math.max(0, timing.pressedFlashMs)
  const blinks = pulseMs > 0 ? Math.max(0, timing.cursorBlinks) : 0
  return { flightMs, pulseMs, blinks, endMs: flightMs + (blinks > 0 ? (2 * blinks - 1) * pulseMs : 0) }
}

/** What the hand-off shows `elapsedMs` after it: the flight's progress while it flies, and whether the
 *  cursor is in a blink's "on" half. A pure function of the time, like every effect. */
export function handoffAt(
  schedule: HandoffSchedule,
  elapsedMs: number,
): Readonly<{ flight: number | null; blink: boolean }> {
  if (elapsedMs < 0 || elapsedMs >= schedule.endMs) return { flight: null, blink: false }
  if (elapsedMs < schedule.flightMs) return { flight: elapsedMs / schedule.flightMs, blink: false }
  const phase = Math.floor((elapsedMs - schedule.flightMs) / schedule.pulseMs)
  return { flight: null, blink: phase % 2 === 0 }
}

/** How to time a frame beyond what the state says: whether motion is reduced — the live screen passes
 *  the player's setting (`state.settings.reducedMotion`), a test whatever it tests — and each
 *  structure's footprint. */
export type LiveOptions = Readonly<{
  reducedMotion?: boolean
  /** A structure's footprint, for the placement tracks. Only their shape depends on it — when each
   *  one settles, all this loop reads, depends on the timings alone — so without it (a test) every
   *  structure is scheduled as one tile. */
  footprintOf?: (contentId: string) => Footprint
}>

const ONE_TILE: Footprint = [{ x: 0, y: 0 }]

const cameraAtTime = (tween: Tween<Camera>, now: number): Camera => tileAt(tween, now)

const offsetOf = (tile: Coord, camera: Camera): Point => ({ x: tile.x - camera.x, y: tile.y - camera.y })

/** The tuned values the live loop times things by. */
export type LiveTuning = Pick<
  Tuning,
  | "easeMs"
  | "cursorGlideMs"
  | "focusArrowMs"
  | "cardRevealMs"
  | "pressedFlashMs"
  | "refusedFlashMs"
  | "refusedCursorMs"
  | "cursorBlinks"
  | "placeFramesMs"
  | "placeGlowMs"
  | "placeSparks"
>

export class BuildAnimation {
  /** The tuned timings — the owner's (`TUNING`), unless a test hands in others. */
  private readonly tuning: LiveTuning
  /** The part of them a placement's track is timed by, handed to the view with the tracks it times. */
  private readonly placementTuning: PlacementTuning
  private ease: Tween<Camera> | null = null
  /** The cursor's place in the view — its tile less the camera's — on its way somewhere. */
  private glide: Tween<Point> | null = null
  private seenAck: Readonly<{ seq: number; at: number }> | null = null
  private seenRefusal: Readonly<{ seq: number; at: number }> | null = null
  /** The last hand-off seen (F54), when it was first seen, and whether it has been cut short — the
   *  keyboard left the map, a popup opened, the plan was committed — after which it never resumes. */
  private seenHandoff: Readonly<{ seq: number; at: number; stopped: boolean }> | null = null
  /** The menu entry whose card the panel showed at the last frame (`cardEntry`, `null` for the menu),
   *  when it turned into it, and whether the menu was there before it (F68). `at` is `null` for a card
   *  already showing when the screen first drew, which never plays a reveal — like a placement already
   *  planned then. */
  private seenCard: Readonly<{ entry: number | null; at: number | null; fromMenu: boolean }> | null = null
  /**
   * Each planned ordinal's animation track (`animation.ts`), by the one thing about it that varies:
   * when its `play` was requested — the first frame that drew it — or `null` for what was already
   * planned when the screen first drew, which never animates. The request itself is rebuilt every
   * frame from the timings (`placementRequest`). A different structure or anchor
   * under the same ordinal (a restart numbers the plan from 1 again) is a new target, with
   * a new track.
   */
  private tracks = new Map<number, Readonly<{ key: string; placement: PlacedStructure; playedAt: number | null }>>()
  /** Buildings that left the plan while the screen was showing them, and when (feedback F33): kept
   *  until their sparks settle. Presentation's own memory — the plan never hears of it. */
  private removals: Readonly<{ placement: PlacedStructure; removedAt: number }>[] = []
  /** False until the first frame: whatever is already planned then was not placed just now. */
  private primed = false

  constructor(tuning: LiveTuning = TUNING) {
    this.tuning = tuning
    this.placementTuning = { placeFramesMs: tuning.placeFramesMs, placeGlowMs: tuning.placeGlowMs, placeSparks: tuning.placeSparks }
  }

  /**
   * The camera drawn at `now`. A new target starts a slide from wherever the view is drawn at that
   * moment, so a second scroll in the middle of the first continues smoothly rather than snapping.
   */
  cameraAt(state: BuildState, now: number, options: LiveOptions = {}): Camera {
    const target = state.camera
    if (this.ease === null) {
      this.ease = still(target, now)
      return target
    }
    const duration = options.reducedMotion === true ? 0 : this.tuning.easeMs
    this.ease = retarget(this.ease, target, now, duration, cameraAtTime, samePoint)
    return tileAt(this.ease, now)
  }

  /**
   * The tile the cursor is drawn on at `now`, through the drawn `camera`. A new cursor or camera
   * starts a glide of the cursor's place in the view from wherever it is drawn at that moment, like
   * the camera's own slide.
   */
  cursorAt(state: BuildState, now: number, camera: Camera, options: LiveOptions = {}): Coord {
    const target = offsetOf(state.cursor, state.camera)
    if (this.glide === null) this.glide = still(target, now)
    else {
      const duration = options.reducedMotion === true ? 0 : this.tuning.cursorGlideMs
      this.glide = retarget(this.glide, target, now, duration, tileAt, samePoint)
    }
    const offset = tileAt(this.glide, now)
    return { x: camera.x + offset.x, y: camera.y + offset.y }
  }

  /** Stop any slide or glide and draw the state's own camera and cursor — after a resize, when a
   *  slide from a view of another size would mean nothing. */
  snap(state: BuildState, now: number): void {
    this.ease = still(state.camera, now)
    this.glide = still(offsetOf(state.cursor, state.camera), now)
  }

  /**
   * The planned placements still going up at `now` — each one's track, scheduled and asked whether it
   * has settled. Each is timed from the first frame that drew it — the frame the key press that placed
   * it produced — and forgotten the moment it leaves the plan, so an undo or a removal mid-animation
   * draws nothing at once, and a placement put back later starts over.
   */
  placementsAt(
    state: BuildState,
    now: number,
    options: LiveOptions = {},
  ): { placing: PlacementClock[]; removing: RemovalClock[]; until: number | null } {
    const planned = new Map<number, BuildState["planned"][number]>()
    for (const placement of state.planned) {
      const key = `${placement.contentId}@${placement.anchor.x},${placement.anchor.y}`
      const seen = this.tracks.get(placement.ordinal)
      if (seen === undefined || seen.key !== key) {
        // The same ordinal under a different building (a restart numbers the plan from 1 again): the
        // one it replaced has left the plan.
        if (seen !== undefined) this.removals.push({ placement: seen.placement, removedAt: now })
        this.tracks.set(placement.ordinal, { key, placement, playedAt: this.primed ? now : null })
      }
      planned.set(placement.ordinal, placement)
    }
    for (const [ordinal, track] of [...this.tracks]) {
      if (planned.has(ordinal)) continue
      this.tracks.delete(ordinal)
      this.removals.push({ placement: track.placement, removedAt: now })
    }
    this.primed = true

    const reducedMotion = options.reducedMotion === true
    const timing = this.placementTuning
    const placing: PlacementClock[] = []
    let until: number | null = null
    for (const [ordinal, track] of this.tracks) {
      const placement = planned.get(ordinal)
      if (track.playedAt === null || placement === undefined) continue
      const footprint = options.footprintOf?.(placement.contentId) ?? ONE_TILE
      const schedule = scheduleTrack([placementRequest(placement, footprint, reducedMotion, track.playedAt, timing)])
      if (!trackBusyAt(schedule, now)) continue
      placing.push({ ordinal, elapsedMs: now - track.playedAt })
      until = Math.max(until ?? 0, schedule.settlesAtMs)
    }

    const removing: RemovalClock[] = []
    this.removals = this.removals.filter(({ placement, removedAt }) => {
      const footprint = options.footprintOf?.(placement.contentId) ?? ONE_TILE
      const schedule = removalSchedule(placement, footprint, reducedMotion, timing)
      const elapsedMs = now - removedAt
      if (!trackBusyAt(schedule, elapsedMs)) return false
      removing.push({ ...placement, elapsedMs })
      until = Math.max(until ?? 0, removedAt + schedule.settlesAtMs)
      return true
    })
    return { placing, removing, until }
  }

  /** Everything time-dependent the frame at `now` shows. */
  frame(state: BuildState, now: number, options: LiveOptions = {}): LiveFrame {
    const camera = this.cameraAt(state, now, options)
    const cursor = this.cursorAt(state, now, camera, options)
    const ends: number[] = []
    for (const tween of [this.ease, this.glide]) {
      if (tween !== null && tweenActive(tween, now)) ends.push(tweenEnd(tween))
    }

    let ack: RowAck | undefined
    if (state.ack !== null) {
      const { seq, kind, entry } = state.ack
      if (this.seenAck?.seq !== seq) this.seenAck = { seq, at: now }
      const end = this.seenAck.at + (kind === "pressed" ? this.tuning.pressedFlashMs : this.tuning.refusedFlashMs)
      if (now < end) {
        ack = { kind, entry }
        ends.push(end)
      }
    }

    let refusedTry = false
    const refused = state.refusedTry
    if (refused !== null) {
      if (this.seenRefusal?.seq !== refused.seq) this.seenRefusal = { seq: refused.seq, at: now }
      const end = this.seenRefusal.at + this.tuning.refusedCursorMs
      // Only while the cursor is still on the tile that was refused: moving off it ends the flash.
      if (now < end && refused.tile.x === state.cursor.x && refused.tile.y === state.cursor.y) {
        refusedTry = true
        ends.push(end)
      }
    }

    const { placing, removing, until } = this.placementsAt(state, now, options)
    if (until !== null) ends.push(until)

    let handoffFlight: Readonly<{ progress: number }> | undefined
    let cursorBlink = false
    const handoff = state.handoff
    if (handoff !== null) {
      if (this.seenHandoff?.seq !== handoff.seq) this.seenHandoff = { seq: handoff.seq, at: now, stopped: false }
      const onMap = state.focus === "grid" && state.popup === null && !state.committed
      if (!onMap) this.seenHandoff = { ...this.seenHandoff, stopped: true }
      if (!this.seenHandoff.stopped) {
        const { focusArrowMs, pressedFlashMs, cursorBlinks } = this.tuning
        const timing = { focusArrowMs, pressedFlashMs, cursorBlinks }
        const schedule = handoffSchedule(timing, options.reducedMotion === true)
        const look = handoffAt(schedule, now - this.seenHandoff.at)
        if (look.flight !== null) handoffFlight = { progress: look.flight }
        cursorBlink = look.blink
        const end = this.seenHandoff.at + schedule.endMs
        if (now < end) ends.push(end)
      }
    }

    // The menu turning into a card (F68). Watched, not recorded: the card's entry changes the frame the
    // state first shows a new card, and the reveal plays from that frame. Closing a card is instant.
    const entry = cardEntry(state)
    if (this.seenCard === null) this.seenCard = { entry, at: null, fromMenu: entry === null }
    else if (this.seenCard.entry !== entry) this.seenCard = { entry, at: now, fromMenu: this.seenCard.entry === null }
    let cardReveal: CardReveal | undefined
    const card = this.seenCard
    if (card.entry !== null && card.at !== null) {
      const reveal = cardRevealAt(this.tuning, options.reducedMotion === true, now - card.at, card.fromMenu)
      if (reveal !== null) {
        cardReveal = reveal
        ends.push(card.at + reveal.lengthMs)
      }
    }

    return {
      camera,
      cursor,
      ...(ack === undefined ? {} : { ack }),
      ...(refusedTry ? { refusedTry } : {}),
      ...(placing.length === 0 ? {} : { placing }),
      ...(removing.length === 0 ? {} : { removing }),
      ...(placing.length === 0 && removing.length === 0 ? {} : { placementTuning: this.placementTuning }),
      ...(handoffFlight === undefined ? {} : { handoffFlight }),
      ...(cursorBlink ? { cursorBlink } : {}),
      ...(cardReveal === undefined ? {} : { cardReveal }),
      busyUntil: ends.length === 0 ? null : Math.max(...ends),
    }
  }
}

/** A terminal redraws at about 60 frames a second; the frame timer never asks for more. */
export const FRAME_MS = 16

/** How long the frame timer waits before the next frame: a frame's length, or less when the last
 *  animation ends sooner — so the frame that shows it over is drawn on time. `null`: stop. */
export function nextFrameDelay(busyUntil: number | null, now: number): number | null {
  if (busyUntil === null) return null
  return Math.max(1, Math.min(FRAME_MS, busyUntil - now))
}
