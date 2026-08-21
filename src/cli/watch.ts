// `playground watch` — the ASCII view, played back at 12 logical ticks and 30 frames per second.
//
// Presentation samples **absolute presentation time**, so pausing, stepping, changing speed, or
// dropping frames changes nothing about what a given moment looks like. The resize gate freezes
// that clock and resuming continues from the same instant (engine.md 9.6).
//
// Every path out — `q`, SIGINT, SIGTERM, a setup failure, a caught render failure, the end of the
// Pulse — goes through one idempotent disposer.

import { compositionSize, createView, frameToText, gateFrame } from "../view/index.ts"
import type { CapabilityMode, PulseTimeline, TileWidth } from "../view/index.ts"
import { AnsiBackend } from "../view/backends/ansi.ts"
import { selectBackend } from "../view/backends/index.ts"

const FRAMES_PER_SECOND = 30
/** Raw mode delivers an interrupt as a byte rather than a signal, so `watch` handles both. */
const CTRL_C = String.fromCharCode(3)

export type WatchOptions = Readonly<{
  timeline: PulseTimeline
  capability: CapabilityMode
  tileWidth: TileWidth
  speed: number
  backend: string
  stdout: NodeJS.WriteStream
  stdin: NodeJS.ReadStream
}>

function hashLine(timeline: PulseTimeline): string {
  return (
    `${timeline.scenarioId}  ticks ${timeline.states.length - 1}  ` +
    `state sha256:${timeline.stateHash.slice(0, 16)}  ` +
    `events sha256:${timeline.eventsHash.slice(0, 16)}`
  )
}

export async function watchPulse(options: WatchOptions): Promise<number> {
  const { timeline, stdout, stdin } = options
  const view = createView(timeline)
  const required = compositionSize(options.tileWidth)

  // Non-TTY prints one line and no escapes. It still reports the hashes, so a scripted watch and a
  // headless run can be compared without a terminal in the loop.
  if (!stdout.isTTY) {
    stdout.write(`${hashLine(timeline)}\n`)
    return 0
  }

  const backend = await selectBackend(options.backend, {
    stdout,
    stdin,
    capability: options.capability,
    width: required.width,
    height: required.height,
  })

  let presentationTimeMs = 0
  let paused = false
  let speed = options.speed
  let gated = false
  let timer: NodeJS.Timeout | null = null
  let disposed = false
  let lastRealMs = Date.now()
  let failure: unknown = null

  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    if (timer !== null) clearInterval(timer)
    stdin.off("data", onKey)
    stdout.off("resize", onResize)
    process.off("SIGINT", onSignal)
    process.off("SIGTERM", onSignal)
    await backend.stop()
  }

  const leave = (): void => {
    void dispose().then(() => {
      stdout.write(`${hashLine(timeline)}\n`)
      process.exit(0)
    })
  }

  function onSignal(): void {
    leave()
  }

  function onResize(): void {
    gated = (stdout.columns ?? 0) < required.width || (stdout.rows ?? 0) < required.height
  }

  function onKey(data: Buffer): void {
    const key = data.toString("utf8")
    if (key === "q" || key === CTRL_C) {
      leave()
      return
    }
    if (key === " ") paused = !paused
    else if (key === ".") presentationTimeMs += 1000 / FRAMES_PER_SECOND
    else if (key === ",") presentationTimeMs += view.tickDurationMs
    else if (key === "[") speed = Math.max(0.25, speed / 2)
    else if (key === "]") speed = Math.min(8, speed * 2)
    else if (key === "r") presentationTimeMs = 0
  }

  try {
    await backend.start()
    onResize()
    stdin.on("data", onKey)
    stdout.on("resize", onResize)
    process.on("SIGINT", onSignal)
    process.on("SIGTERM", onSignal)

    await new Promise<void>((settle) => {
      timer = setInterval(() => {
        const now = Date.now()
        const elapsed = now - lastRealMs
        lastRealMs = now
        try {
          if (gated) {
            // Presentation time is frozen while gated, so resuming continues from the same instant.
            backend.present(
              gateFrame(stdout.columns ?? required.width, stdout.rows ?? required.height, required),
            )
            return
          }
          if (!paused) presentationTimeMs += elapsed * speed
          backend.present(
            view.composeAt(presentationTimeMs, options.capability, options.tileWidth, {
              paused,
              speed,
            }),
          )
          if (presentationTimeMs > view.durationMs + 2000) settle()
        } catch (error) {
          failure = error
          settle()
        }
      }, 1000 / FRAMES_PER_SECOND)
    })
  } catch (error) {
    failure = error
  } finally {
    await dispose()
  }

  if (failure !== null) {
    process.stderr.write(`watch failed: ${String(failure)}\n`)
    return 1
  }
  stdout.write(`${hashLine(timeline)}\n`)
  return 0
}

/** Render one frame as plain text, for evidence capture and for eyeballing without a terminal. */
export function renderStill(
  timeline: PulseTimeline,
  timeMs: number,
  capability: CapabilityMode,
  tileWidth: TileWidth,
): string {
  return frameToText(createView(timeline).snapshotAt(timeMs, capability, tileWidth))
}

export { AnsiBackend }
