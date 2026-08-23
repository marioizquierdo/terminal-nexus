// Playback state for the ASCII view: the clock, the controls, and the resize gate.
//
// It is separated from `watch` for one reason: engine.md 9.6 makes "below minimum size, playback
// pauses behind a resize gate and resumes from the same presentation time" a RULE, and a rule that
// only exists inside a live terminal loop cannot be tested. Everything here is a pure function of
// the elapsed time handed to it, so a test can drive a whole session without a TTY.

export type PlaybackControl =
  | "pause"
  | "resume"
  | "toggle"
  | "step-frame"
  | "step-tick"
  | "faster"
  | "slower"
  | "restart"

export type PlaybackOptions = Readonly<{
  /** Milliseconds of presentation time in one logical tick. */
  tickDurationMs: number
  /** Milliseconds between frames — one step of `step-frame`. */
  frameDurationMs: number
  speed?: number
  /** Presentation time to start at — `grid --turn`, seeking straight to a tick. Defaults to 0. */
  startTimeMs?: number
}>

const MIN_SPEED = 0.25
const MAX_SPEED = 8

export class Playback {
  private timeMs: number
  private pausedFlag = false
  private gatedFlag = false
  private speedValue: number
  private readonly options: PlaybackOptions

  constructor(options: PlaybackOptions) {
    this.options = options
    this.speedValue = options.speed ?? 1
    this.timeMs = Math.max(0, options.startTimeMs ?? 0)
  }

  get presentationTimeMs(): number {
    return this.timeMs
  }

  get paused(): boolean {
    return this.pausedFlag
  }

  get gated(): boolean {
    return this.gatedFlag
  }

  get speed(): number {
    return this.speedValue
  }

  /**
   * Advance by real elapsed time. **A gated or paused session advances by nothing**, which is what
   * "freezes presentation time" means: resizing back resumes from the same instant rather than
   * from wherever the wall clock got to while the gate was up.
   */
  advance(elapsedMs: number): void {
    if (this.gatedFlag || this.pausedFlag) return
    this.timeMs += Math.max(0, elapsedMs) * this.speedValue
  }

  /** Called on every resize: the gate is a function of the terminal size, not of a key press. */
  fit(width: number, height: number, required: Readonly<{ width: number; height: number }>): void {
    this.gatedFlag = width < required.width || height < required.height
  }

  apply(control: PlaybackControl): void {
    switch (control) {
      case "pause":
        this.pausedFlag = true
        break
      case "resume":
        this.pausedFlag = false
        break
      case "toggle":
        this.pausedFlag = !this.pausedFlag
        break
      case "step-frame":
        // Stepping works while paused and while gated it does not, because the gate is not a pause
        // the viewer chose.
        if (!this.gatedFlag) this.timeMs += this.options.frameDurationMs
        break
      case "step-tick":
        if (!this.gatedFlag) this.timeMs += this.options.tickDurationMs
        break
      case "faster":
        this.speedValue = Math.min(MAX_SPEED, this.speedValue * 2)
        break
      case "slower":
        this.speedValue = Math.max(MIN_SPEED, this.speedValue / 2)
        break
      case "restart":
        this.timeMs = 0
        break
      default:
        break
    }
  }
}

/**
 * Split one chunk of terminal input into keys.
 *
 * A terminal does not promise one key per read: a fast typist, a paste, or a script driving the
 * session through a pseudo-terminal all deliver several bytes at once, and treating the chunk as a
 * single key silently drops every one of them. An escape sequence — an arrow key, a mouse report —
 * is the opposite case and must stay whole, so a chunk that begins with ESC is returned as one key
 * and, since Gate 1A binds none of them, ignored.
 */
export function keysFromChunk(chunk: string): string[] {
  if (chunk.length === 0) return []
  if (chunk.startsWith(String.fromCharCode(27))) return [chunk]
  return [...chunk]
}

/** The key map, so `watch` and a test agree on what a key means. */
export function controlForKey(key: string): PlaybackControl | "quit" | null {
  switch (key) {
    case "q":
    case String.fromCharCode(3):
      return "quit"
    case " ":
      return "toggle"
    case ".":
      return "step-frame"
    case ",":
      return "step-tick"
    case "]":
      return "faster"
    case "[":
      return "slower"
    case "r":
      return "restart"
    default:
      return null
  }
}
