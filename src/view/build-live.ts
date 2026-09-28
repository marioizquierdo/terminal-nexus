// What the live Build Phase screen draws *between* commands — everything on it that depends on time
// (gate 5H). The reducer has no clock and never will; this is where the screen's clock is read, as a
// number the caller passes in, so every animation here is a pure function of the state and the time
// and a test can drive it without waiting:
//
//   - **the view slides** (engine.md 3.3's "camera moves eased over a few frames"): when the state's
//     camera jumps, the drawn camera eases from wherever it was drawn toward it over Debug Mode's
//     "View slide" milliseconds, whole tiles at a time, fast at first and settling at the end;
//   - **a menu row flashes** "pressed" or flickers "refused" (gate 5F), for Debug Mode's durations;
//   - **the cursor flashes** where a placement was just tried and refused (gate 5H).
//
// `busyUntil` says whether anything is still moving, and until when: the live loop runs its frame
// timer only while it is not `null`, and otherwise draws once per input, as the screen always has.
//
// Presentation only (engine.md Section 1: "presentation may interpolate... without changing
// simulation"): state, commands and a scripted playtest all use the state's own camera. The one
// place the drawn camera reaches input is the mouse, so a click lands on the tile drawn under the
// pointer while the view is still sliding.

import type { Camera } from "../build/camera.ts"
import type { BuildState } from "../build/state.ts"
import { flashDuration } from "../build/debug.ts"
import type { BuildFlash } from "./build.ts"

export type LiveFrame = Readonly<{
  /** The camera to draw through. */
  camera: Camera
  flash?: BuildFlash
  refusedFlash?: boolean
  /** When the last thing still animating ends, or `null` when nothing is. */
  busyUntil: number | null
}>

type Ease = Readonly<{ from: Camera; to: Camera; start: number; duration: number }>

/** Fast at first and settling at the end: a slide that starts where the player's eye already is. */
function easeOut(progress: number): number {
  return 1 - (1 - progress) ** 3
}

function sameCamera(a: Camera, b: Camera): boolean {
  return a.x === b.x && a.y === b.y
}

/** Where an ease has got to at `now`, in whole tiles. */
function easedAt(ease: Ease, now: number): Camera {
  if (ease.duration <= 0) return ease.to
  const progress = Math.min(1, Math.max(0, (now - ease.start) / ease.duration))
  if (progress >= 1) return ease.to
  const eased = easeOut(progress)
  return {
    x: Math.round(ease.from.x + (ease.to.x - ease.from.x) * eased),
    y: Math.round(ease.from.y + (ease.to.y - ease.from.y) * eased),
  }
}

export class BuildAnimation {
  private ease: Ease | null = null
  private seenAck: Readonly<{ seq: number; at: number }> | null = null
  private seenRefusal: Readonly<{ seq: number; at: number }> | null = null

  /**
   * The camera drawn at `now`. A new target starts a slide from wherever the view is drawn at that
   * moment, so a second scroll in the middle of the first continues smoothly rather than snapping.
   */
  cameraAt(state: BuildState, now: number): Camera {
    const target = state.camera
    if (this.ease === null) {
      this.ease = { from: target, to: target, start: now, duration: 0 }
      return target
    }
    if (!sameCamera(this.ease.to, target)) {
      const from = easedAt(this.ease, now)
      this.ease = { from, to: target, start: now, duration: sameCamera(from, target) ? 0 : state.debug.easeMs }
    }
    return easedAt(this.ease, now)
  }

  /** Stop any slide and draw the state's own camera — after a resize, when a slide from a view of
   *  another size would mean nothing. */
  snap(state: BuildState, now: number): void {
    this.ease = { from: state.camera, to: state.camera, start: now, duration: 0 }
  }

  /** Everything time-dependent the frame at `now` shows. */
  frame(state: BuildState, now: number): LiveFrame {
    const camera = this.cameraAt(state, now)
    const ends: number[] = []
    const ease = this.ease
    if (ease !== null && ease.duration > 0 && now < ease.start + ease.duration) ends.push(ease.start + ease.duration)

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

    return {
      camera,
      ...(flash === undefined ? {} : { flash }),
      ...(refusedFlash ? { refusedFlash } : {}),
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
