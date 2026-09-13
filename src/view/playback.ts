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
 * The index just past one complete escape sequence starting at `chunk[start]` (which must be ESC).
 * A CSI sequence (`ESC [ ... final`, arrow keys and mouse reports alike — mouse's leading `<` is a
 * legal CSI parameter byte) runs through parameter bytes `0x30`-`0x3F` and intermediate bytes
 * `0x20`-`0x2F` to one final byte `0x40`-`0x7E`; an SS3 sequence (`ESC O` plus one character, the
 * form some terminals use for arrows in application cursor-key mode) is fixed at three characters.
 * Anything else — including a sequence truncated at the end of this chunk, which a byte-level split
 * across two reads can still produce — is a bare ESC, one character long, so an unrecognised prefix
 * terminates rather than swallowing whatever follows it in the same chunk.
 */
function endOfEscapeSequence(chunk: string, start: number): number {
  const next = chunk.charCodeAt(start + 1)
  if (next === 0x5b /* [ */) {
    for (let index = start + 2; index < chunk.length; index += 1) {
      const code = chunk.charCodeAt(index)
      if (code >= 0x40 && code <= 0x7e) return index + 1
    }
    return chunk.length
  }
  if (next === 0x4f /* O */) return Math.min(start + 3, chunk.length)
  return Math.min(start + 1, chunk.length)
}

/**
 * Split one chunk of terminal input into keys.
 *
 * A terminal does not promise one key per read: a fast typist, a paste, or a script driving the
 * session through a pseudo-terminal all deliver several bytes at once, and treating the chunk as a
 * single key silently drops every one of them. An escape sequence — an arrow key, a mouse report —
 * is the opposite case and must stay whole rather than be split mid-sequence, but **more than one
 * complete sequence can still arrive in the same chunk** (two quick arrow presses, a mouse move and
 * a click) and each must come back as its own key. A menu screen's own real-terminal evidence is
 * what found this: two arrow-down presses sent close enough together arrived as one six-byte chunk,
 * and the original version of this function — which treated any ESC-prefixed chunk as one key in
 * full, correct only because Gate 1A bound no escape sequence to anything — silently dropped the
 * second press's worth of movement, undetected by any fake-stdin unit test because nothing before
 * Milestone 3 ever fed this function two real sequences in one call.
 */
export function keysFromChunk(chunk: string): string[] {
  const keys: string[] = []
  let index = 0
  while (index < chunk.length) {
    if (chunk.charCodeAt(index) === 27) {
      const end = endOfEscapeSequence(chunk, index)
      keys.push(chunk.slice(index, end))
      index = end
      continue
    }
    keys.push(chunk[index] as string)
    index += 1
  }
  return keys
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
