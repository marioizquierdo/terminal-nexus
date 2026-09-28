// What the live Build Phase screen draws *between* commands — everything on it that depends on time
// (gate 5H). The reducer has no clock and never will; this is where the screen's clock is read, as a
// number the caller passes in, so every animation here is a pure function of the state and the time
// and a test can drive it without waiting:
//
//   - **the view slides** (engine.md 3.3's "camera moves eased over a few frames"): whenever the
//     state's camera changes — a click, an arrow at the margin, a Shift jump, arming with the smart
//     cursor, anything — the drawn camera eases from wherever it was drawn toward it over Debug
//     Mode's "View slide" milliseconds, whole tiles at a time, fast at first and settling at the end.
//     Only a resize snaps (`snap`);
//   - **the cursor glides** (owner, 2026-09-28: "interpolations are easy and powerful"): whenever the
//     state's cursor changes, the drawn cursor eases from the tile it was drawn on to the new one over
//     Debug Mode's "Cursor glide" milliseconds, so a Shift jump or a far click reads as motion rather
//     than a teleport. The glide is of the cursor's place **in the view** (its tile less the
//     camera's), added to the drawn camera: when only the camera moves — the cursor dragging it at the
//     margin — the cursor rides along with the slide, and a gliding cursor can never be drawn outside
//     the view it is gliding across. The armed preview and the refused flash move with it;
//   - **a menu row flashes** "pressed" or flickers "refused" (gate 5F), for Debug Mode's durations;
//   - **the cursor flashes** where a placement was just tried and refused (gate 5H);
//   - **a building goes up** (gate 5I): each planned placement plays its frames, light and sparks
//     for Debug Mode's "Build animation" and "Glow time", timed from the frame that first drew it.
//
// `busyUntil` says whether anything is still moving, and until when: the live loop runs its frame
// timer only while it is not `null`, and otherwise draws once per input, as the screen always has.
//
// Under reduced motion both snap: the view jumps and the cursor jumps, as they did before gate 5H.
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
import { flashDuration } from "../build/debug.ts"
import type { BuildFlash } from "./build.ts"
import type { PlacementClock } from "./placement.ts"
import { placementTiming } from "./placement.ts"
import type { Point, Tween } from "./tween.ts"
import { retarget, samePoint, still, tileAt, tweenActive, tweenEnd } from "./tween.ts"

export type LiveFrame = Readonly<{
  /** The camera to draw through. */
  camera: Camera
  /** The tile to draw the cursor on — the state's own once it has finished gliding. */
  cursor: Coord
  flash?: BuildFlash
  refusedFlash?: boolean
  /** Planned placements still going up, and how long ago each was placed (gate 5I). */
  placing?: readonly PlacementClock[]
  /** When the last thing still animating ends, or `null` when nothing is. */
  busyUntil: number | null
}>

/** What the live screen knows that the reducer does not: the player's reduced-motion setting. */
export type LiveOptions = Readonly<{ reducedMotion?: boolean }>

const cameraAtTime = (tween: Tween<Camera>, now: number): Camera => tileAt(tween, now)

const offsetOf = (tile: Coord, camera: Camera): Point => ({ x: tile.x - camera.x, y: tile.y - camera.y })

export class BuildAnimation {
  private ease: Tween<Camera> | null = null
  /** The cursor's place in the view — its tile less the camera's — on its way somewhere. */
  private glide: Tween<Point> | null = null
  private seenAck: Readonly<{ seq: number; at: number }> | null = null
  private seenRefusal: Readonly<{ seq: number; at: number }> | null = null
  /** When each planned ordinal was first drawn, and what it was then — a different structure or
   *  anchor under the same ordinal (a Debug Mode restart numbers the plan from 1 again) is a new
   *  placement. */
  private placedAt = new Map<number, Readonly<{ key: string; at: number }>>()
  /** False until the first frame: whatever is already planned then was not placed just now. */
  private primed = false

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
    const duration = options.reducedMotion === true ? 0 : state.debug.easeMs
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
      const duration = options.reducedMotion === true ? 0 : state.debug.cursorGlideMs
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
   * The planned placements still going up at `now`. Each is timed from the first frame that drew it
   * — the frame the key press that placed it produced — and forgotten the moment it leaves the plan,
   * so an undo or a removal mid-animation draws nothing at once, and a placement put back later starts
   * over.
   */
  placementsAt(state: BuildState, now: number, options: LiveOptions = {}): { placing: PlacementClock[]; until: number | null } {
    const planned = new Set<number>()
    for (const placement of state.planned) {
      const key = `${placement.contentId}@${placement.anchor.x},${placement.anchor.y}`
      const seen = this.placedAt.get(placement.ordinal)
      if (seen === undefined || seen.key !== key) {
        this.placedAt.set(placement.ordinal, { key, at: this.primed ? now : Number.NEGATIVE_INFINITY })
      }
      planned.add(placement.ordinal)
    }
    for (const ordinal of [...this.placedAt.keys()]) if (!planned.has(ordinal)) this.placedAt.delete(ordinal)
    this.primed = true

    const { totalMs } = placementTiming(state.debug, options.reducedMotion === true)
    const placing: PlacementClock[] = []
    let until: number | null = null
    if (totalMs <= 0) return { placing, until }
    for (const [ordinal, seen] of this.placedAt) {
      const elapsedMs = now - seen.at
      if (elapsedMs >= totalMs) continue
      placing.push({ ordinal, elapsedMs })
      until = Math.max(until ?? 0, seen.at + totalMs)
    }
    return { placing, until }
  }

  /** Everything time-dependent the frame at `now` shows. */
  frame(state: BuildState, now: number, options: LiveOptions = {}): LiveFrame {
    const camera = this.cameraAt(state, now, options)
    const cursor = this.cursorAt(state, now, camera, options)
    const ends: number[] = []
    for (const tween of [this.ease, this.glide]) {
      if (tween !== null && tweenActive(tween, now)) ends.push(tweenEnd(tween))
    }

    let flash: BuildFlash | undefined
    const ack = state.ack
    if (ack !== null) {
      if (this.seenAck?.seq !== ack.seq) this.seenAck = { seq: ack.seq, at: now }
      const end = this.seenAck.at + flashDuration(state.debug, ack.kind)
      if (now < end) {
        flash = { kind: ack.kind, entry: ack.entry }
        ends.push(end)
      }
    }

    let refusedFlash = false
    const refused = state.refusedTry
    if (refused !== null) {
      if (this.seenRefusal?.seq !== refused.seq) this.seenRefusal = { seq: refused.seq, at: now }
      const end = this.seenRefusal.at + state.debug.refusedCursorMs
      // Only while the cursor is still on the tile that was refused: moving off it ends the flash.
      if (now < end && refused.tile.x === state.cursor.x && refused.tile.y === state.cursor.y) {
        refusedFlash = true
        ends.push(end)
      }
    }

    const { placing, until } = this.placementsAt(state, now, options)
    if (until !== null) ends.push(until)

    return {
      camera,
      cursor,
      ...(flash === undefined ? {} : { flash }),
      ...(refusedFlash ? { refusedFlash } : {}),
      ...(placing.length === 0 ? {} : { placing }),
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
