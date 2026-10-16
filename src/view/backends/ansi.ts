// The direct-ANSI backend: the fallback the design requires to stay a half-day's work,
// and the one that always exists.
//
// Terminal lifecycle is a RULE (`docs/system-design/runtime.md`). Everything that can end a session — `q`, SIGINT,
// SIGTERM, a setup failure, a caught render failure — runs through **one idempotent disposer**.
// Calling it twice is harmless. A renderer that leaves the terminal in raw mode is a reason to
// reject it, so the restore path is the part written first.

import type { ReadonlyCellFrame, TerminalBackend } from "../frame.ts"
import { frameToAnsi, padFrame } from "../frame.ts"
import type { ColorDepth, Theme } from "../roles.ts"
import { DEFAULT_THEME } from "../roles.ts"
import type { TerminalInput, TerminalOutput } from "./ports.ts"

const ESC = "\u001b"
const ALT_SCREEN_ON = `${ESC}[?1049h`
const ALT_SCREEN_OFF = `${ESC}[?1049l`
const CURSOR_HIDE = `${ESC}[?25l`
const CURSOR_SHOW = `${ESC}[?25h`
const CURSOR_HOME = `${ESC}[H`
const CLEAR = `${ESC}[2J`
const RESET = `${ESC}[0m`

export type AnsiBackendOptions = Readonly<{
  stdout: TerminalOutput
  stdin: TerminalInput
  colors: ColorDepth
  theme?: Theme
}>

export class AnsiBackend implements TerminalBackend {
  readonly name = "direct-ansi"
  private readonly options: AnsiBackendOptions
  // Held separately from `options` (which stays exactly what the caller passed in, unread after
  // construction for these two) so `setPresentation` can change them without needing `options`
  // itself to be mutable.
  private colors: ColorDepth
  private theme: Theme
  private started = false
  private stopped = false
  // Set when the depth or theme changed since the last frame: the next one starts the screen over.
  private startOver = false

  constructor(options: AnsiBackendOptions) {
    this.options = options
    this.colors = options.colors
    this.theme = options.theme ?? DEFAULT_THEME
  }

  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    const { stdout, stdin } = this.options
    if (stdout.isTTY) stdout.write(ALT_SCREEN_ON + CURSOR_HIDE + CLEAR)
    if (stdin.isTTY && typeof stdin.setRawMode === "function") {
      stdin.setRawMode(true)
      stdin.resume?.()
    }
  }

  present(frame: ReadonlyCellFrame): void {
    const { stdout } = this.options
    // With colours the game paints the whole screen, so a frame smaller than the terminal is grown with
    // background. Monochrome leaves the terminal's own colours alone, beside the frame as in it.
    const drawn =
      this.colors === "monochrome" ? frame : padFrame(frame, stdout.columns ?? frame.width, stdout.rows ?? frame.height)
    // A new depth or theme starts the screen over: going from colours to monochrome must not leave the
    // background painted where the frame no longer reaches.
    const reset = this.startOver ? RESET + CLEAR : ""
    this.startOver = false
    stdout.write(reset + CURSOR_HOME + frameToAnsi(drawn, this.colors, this.theme) + RESET)
  }

  setPresentation(colors: ColorDepth, theme: Theme): void {
    if (colors !== this.colors || theme !== this.theme) this.startOver = true
    this.colors = colors
    this.theme = theme
  }

  /** Idempotent: safe from a signal handler, an error path, and the normal exit, in any order. */
  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    const { stdout, stdin } = this.options
    if (stdin.isTTY && typeof stdin.setRawMode === "function") {
      stdin.setRawMode(false)
      stdin.pause?.()
    }
    if (stdout.isTTY) stdout.write(RESET + CURSOR_SHOW + ALT_SCREEN_OFF)
  }
}
