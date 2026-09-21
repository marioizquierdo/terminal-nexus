// `terminal-nexus --spike` — the live terminal loop for Milestone 5's gate 5A.
//
// Deliberately built the same way `src/cli/menu.ts` is, on the same pieces: the shared idempotent
// disposer (`lifecycle.ts`), the same backend selection, the same opt-in SGR mouse reporting
// switched off on every exit path. Nothing about a terminal session is reinvented here; what is new
// is that the frame's size now depends on the terminal's, because the whole point of the screen is
// that a bigger terminal shows more Grid — up to the 72 x 24 ceiling and not one tile past it.

import { FIXTURE_REGISTRY } from "../content/index.ts"
import { MOUSE_REPORTING_OFF, MOUSE_REPORTING_ON } from "../menu/mouse.ts"
import { BuildSession } from "../build/session.ts"
import {
  SPIKE_ALLOTMENT,
  SPIKE_CATALOG,
  SPIKE_STANDING,
  SPIKE_START_CURSOR,
  spikeGrid,
} from "../build/catalog.ts"
import { isGated } from "../build/camera.ts"
import { buildLayout } from "../build/layout.ts"
import type { BuildContext } from "../build/state.ts"
import { composeBuildFrame } from "../view/build.ts"
import { gateFrame, keysFromChunk } from "../view/index.ts"
import { selectBackend } from "../view/backends/index.ts"
import { createTerminalSession } from "./lifecycle.ts"
import type { Settings } from "../settings/index.ts"

const ESC = "\u001b"
/** Written before a frame whose size just changed: the backend draws from the cursor home position
 *  outward, so a frame that shrank would otherwise leave the old one's right-hand and bottom edges
 *  on screen. The menu never needed this because its frame is a fixed 80 x 24. */
const CLEAR = `${ESC}[2J`

/** The floor the resize gate is measured against — engine.md 3.3's own "80 x 24 remains the floor
 *  and the acceptance target". */
export const SPIKE_MINIMUM = { width: 80, height: 24 } as const

export type SpikeOptions = Readonly<{
  settings: Settings
  backend: string
  stdout: NodeJS.WriteStream
  stdin: NodeJS.ReadStream
  exit?: (code: number) => void
  /** `--scroll-margin`, so the one tuning number this milestone is allowed to retune can be felt
   *  rather than argued about. Omitted means the canon's three tiles. */
  scrollMargin?: number
}>

export function spikeContext(scrollMargin?: number): BuildContext {
  return {
    grid: spikeGrid(),
    registry: FIXTURE_REGISTRY,
    catalog: SPIKE_CATALOG,
    standing: SPIKE_STANDING,
    allotment: SPIKE_ALLOTMENT,
    ...(scrollMargin === undefined ? {} : { scrollMargin }),
  }
}

export async function runSpike(options: SpikeOptions): Promise<number> {
  const { stdout, stdin } = options

  if (!stdout.isTTY || !stdin.isTTY) {
    stdout.write("terminal-nexus --spike needs an interactive terminal.\n")
    return 0
  }

  const context = spikeContext(options.scrollMargin)
  const terminalSize = (): { columns: number; rows: number } => ({
    columns: stdout.columns ?? SPIKE_MINIMUM.width,
    rows: stdout.rows ?? SPIKE_MINIMUM.height,
  })

  let layout = buildLayout(terminalSize(), context.grid)
  const backend = await selectBackend(options.backend, {
    stdout,
    stdin,
    capability: options.settings.capability,
    theme: options.settings.theme,
    width: layout.frame.width,
    height: layout.frame.height,
  })

  let gated = false
  let leaving = false
  let failure: unknown = null
  let settleSession: (() => void) | null = null
  /** The frame size last presented, so a redraw only clears when the size genuinely changed. */
  let lastFrame = { width: layout.frame.width, height: layout.frame.height }

  const session = createTerminalSession()
  const dispose = session.dispose
  const exit = options.exit ?? ((code: number): void => process.exit(code))

  const leave = (): void => {
    if (leaving) return
    leaving = true
    void dispose().then(() => {
      exit(0)
      settleSession?.()
    })
  }

  const build = new BuildSession({
    context,
    cursor: SPIKE_START_CURSOR,
    viewport: layout.viewport,
    onBack: leave,
    onQuit: leave,
  })

  function render(): void {
    if (leaving) return
    const size = terminalSize()
    const frame = gated
      ? gateFrame(size.columns, size.rows, SPIKE_MINIMUM)
      : composeBuildFrame(
          { context, state: build.state, layout, glyphPack: options.settings.glyphPack },
          options.settings.capability,
        )
    if (frame.width !== lastFrame.width || frame.height !== lastFrame.height) {
      stdout.write(CLEAR)
      lastFrame = { width: frame.width, height: frame.height }
    }
    try {
      backend.present(frame)
    } catch (error) {
      failure = error
      leave()
    }
  }

  function onResize(): void {
    const size = terminalSize()
    gated = isGated(size, context.grid)
    if (!gated) {
      layout = buildLayout(size, context.grid)
      build.resize(layout.viewport)
    }
    render()
  }

  function onData(data: Buffer): void {
    if (gated || leaving) return
    for (const key of keysFromChunk(data.toString("utf8"))) {
      if (leaving) break
      build.handleKey(key, layout)
    }
    render()
  }

  session.onDispose(() => {
    stdin.off("data", onData)
  })
  session.onDispose(() => {
    stdout.off("resize", onResize)
  })
  session.onSignal(leave)
  session.onDispose(() => {
    stdout.write(MOUSE_REPORTING_OFF)
  })
  session.onDispose(() => backend.stop())

  try {
    await backend.start()
    stdout.write(MOUSE_REPORTING_ON)
    onResize()
    stdin.on("data", onData)
    stdout.on("resize", onResize)
    await new Promise<void>((settle) => {
      settleSession = settle
    })
  } catch (error) {
    failure = error
  } finally {
    await dispose()
  }

  if (failure !== null) {
    process.stderr.write(`terminal-nexus --spike failed: ${String(failure)}\n`)
    return 1
  }
  return 0
}
