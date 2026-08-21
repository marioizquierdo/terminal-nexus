// The OpenTUI backend — milestone-1-spike-battle.md 3.8 adopts the imperative core behind the
// `TerminalBackend` interface, with direct ANSI as the fallback.
//
// MEASURED, 2026-08-21, `@opentui/core@0.5.6` (see evidence/report.md Section 4):
//
//   * exact cell control works: a frame written cell by cell through `OptimizedBuffer.setCell`
//     comes back out of the test harness character for character;
//   * **the native core runs under Bun and refuses to load under Node 22.22.2**, which reports
//     "OpenTUI native FFI is not available for this runtime yet". The package's `node` export
//     imports cleanly — that is what the standing evidence measured — but constructing a renderer
//     throws. So OpenTUI is a Bun-only backend today, and `selectBackend("auto")` falls back to
//     direct ANSI on Node rather than failing.
//
// The adapter boundary is what keeps "the terminal library and the runtime are independent
// choices" true: the library that cannot run on Node is one of two interchangeable backends, and
// neither the compositor nor the kernel knows which one presented a frame.

import type { ReadonlyCellFrame } from "../frame.ts"
import type { CapabilityMode } from "../roles.ts"
import { rgbFor } from "../roles.ts"
import type { BackendOptions, NamedBackend } from "./index.ts"

type OpenTuiCore = Awaited<typeof import("@opentui/core")>

/** Anything with `setCell` — the live renderer's buffer and the test harness's are both this. */
export type CellSink = Readonly<{
  setCell(
    x: number,
    y: number,
    char: string,
    fg: unknown,
    bg: unknown,
    attributes: number,
  ): void
}>

/**
 * Write one engine-owned frame into an OpenTUI buffer. Exported so the headless harness draws
 * through exactly the code the live backend uses — a snapshot taken any other way would be
 * evidence about the test, not about the backend.
 */
export function drawFrameInto(
  core: OpenTuiCore,
  buffer: CellSink,
  frame: ReadonlyCellFrame,
  capability: CapabilityMode,
): void {
  const background = core.RGBA.fromValues(0, 0, 0, 1)
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const cell = frame.cells[y * frame.width + x]
      if (cell === undefined) continue
      const [red, green, blue] = rgbFor(cell.style.fgRole, capability)
      const attributes = core.createTextAttributes({
        bold: cell.style.bold === true,
        dim: cell.style.dim === true,
        underline: cell.style.underline === true,
        reverse: cell.style.inverse === true,
      })
      buffer.setCell(
        x,
        y,
        cell.glyph,
        core.RGBA.fromValues(red / 255, green / 255, blue / 255, 1),
        background,
        attributes,
      )
    }
  }
}

export async function createOpenTuiBackend(options: BackendOptions): Promise<NamedBackend> {
  const core: OpenTuiCore = await import("@opentui/core")
  const renderer = await core.createCliRenderer({
    stdin: options.stdin,
    stdout: options.stdout,
    targetFps: 30,
    exitOnCtrlC: false,
  })

  let stopped = false
  return {
    name: "opentui",
    async start(): Promise<void> {
      renderer.start()
    },
    present(frame: ReadonlyCellFrame): void {
      const buffer = renderer.nextRenderBuffer
      if (buffer === undefined) throw new Error("opentui renderer exposed no buffer")
      drawFrameInto(core, buffer as unknown as CellSink, frame, options.capability)
      renderer.requestRender()
    },
    /** Idempotent, like every other exit path. */
    async stop(): Promise<void> {
      if (stopped) return
      stopped = true
      await renderer.destroy()
    },
  }
}
