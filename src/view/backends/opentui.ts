// The OpenTUI backend — the design adopts the imperative core behind the
// `TerminalBackend` interface, with direct ANSI as the fallback.
//
// MEASURED, 2026-08-21, `@opentui/core@0.5.6` (see docs/history/reports/2026-08-21-pulse-playground.md):
//
//   * exact cell control works: a frame written cell by cell through `OptimizedBuffer.setCell`
//     comes back out of the test harness character for character;
//   * **the native core runs under Bun and refuses to load under Node 22.22.2**, which reports
//     "OpenTUI native FFI is not available for this runtime yet". The package's `node` export
//     imports cleanly — that is what the standing measurements showed — but constructing a renderer
//     throws. So OpenTUI is a Bun-only backend today, and `selectBackend("auto")` falls back to
//     direct ANSI on Node rather than failing.
//
// The adapter boundary is what keeps "the terminal library and the runtime are independent
// choices" true: the library that cannot run on Node is one of two interchangeable backends, and
// neither the compositor nor the kernel knows which one presented a frame.

import type { ReadonlyCellFrame } from "../frame.ts"
import { padFrame } from "../frame.ts"
import type { ColorDepth, Rgb, Theme } from "../roles.ts"
import { BACKGROUND_RGB, DEFAULT_THEME, resolveCell } from "../roles.ts"
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
  /** The buffer's size, where it says: the screen the game's ground is painted across. */
  readonly width?: number
  readonly height?: number
}>

/**
 * Write one engine-owned frame into an OpenTUI buffer. Exported so the headless harness draws
 * through exactly the code the live backend uses — a snapshot taken any other way would be
 * information about the test, not about the backend.
 */
export function drawFrameInto(
  core: OpenTuiCore,
  buffer: CellSink,
  frame: ReadonlyCellFrame,
  colors: ColorDepth,
  theme: Theme = DEFAULT_THEME,
): void {
  const colour = ([red, green, blue]: Rgb) => core.RGBA.fromValues(red / 255, green / 255, blue / 255, 1)
  // Monochrome's cells have no fill of their own, so what shows behind them is the ground; the colour
  // depths always give one (`resolveCell`). A frame smaller than the screen is grown with blank ground,
  // the way the direct-ANSI backend does.
  const ground = colour(BACKGROUND_RGB[theme])
  const screen = padFrame(frame, buffer.width ?? frame.width, buffer.height ?? frame.height)
  for (let y = 0; y < screen.height; y += 1) {
    for (let x = 0; x < screen.width; x += 1) {
      const cell = screen.cells[y * screen.width + x]
      if (cell === undefined) continue
      // Inverse video is already in the colours `resolveCell` gives, so no reverse attribute is sent.
      const resolved = resolveCell(cell, colors, theme)
      const attributes = core.createTextAttributes({
        bold: resolved.bold,
        dim: resolved.dim,
        underline: resolved.underline,
      })
      const fill = resolved.background === null ? ground : colour(resolved.background)
      buffer.setCell(x, y, cell.glyph, colour(resolved.foreground), fill, attributes)
    }
  }
}

export async function createOpenTuiBackend(options: BackendOptions): Promise<NamedBackend> {
  const core: OpenTuiCore = await import("@opentui/core")
  // OpenTUI drives a real terminal and nothing else, so here the ports are the Node streams they
  // always are on this path (`ports.ts` describes only what the screen loops themselves use).
  const renderer = await core.createCliRenderer({
    stdin: options.stdin as NodeJS.ReadStream,
    stdout: options.stdout as NodeJS.WriteStream,
    targetFps: 30,
    exitOnCtrlC: false,
  })

  // Mutable, like `AnsiBackend`'s own colors/theme fields — `setPresentation` changes these
  // without touching the renderer's own lifecycle, so a live Settings change never flashes the
  // alternate screen.
  let colors = options.colors
  let theme = options.theme ?? DEFAULT_THEME
  let stopped = false
  return {
    name: "opentui",
    async start(): Promise<void> {
      renderer.start()
    },
    present(frame: ReadonlyCellFrame): void {
      const buffer = renderer.nextRenderBuffer
      if (buffer === undefined) throw new Error("opentui renderer exposed no buffer")
      drawFrameInto(core, buffer as unknown as CellSink, frame, colors, theme)
      renderer.requestRender()
    },
    setPresentation(nextColorDepth: ColorDepth, nextTheme: Theme): void {
      colors = nextColorDepth
      theme = nextTheme
    },
    /** Idempotent, like every other exit path. */
    async stop(): Promise<void> {
      if (stopped) return
      stopped = true
      await renderer.destroy()
    },
  }
}
