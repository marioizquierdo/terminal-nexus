// The direct-ANSI backend: the fallback the milestone requires to stay a half-day\'s work
// (milestone-1-spike-battle.md 3.8), and the one that always exists.
//
// Terminal lifecycle is a RULE (engine.md 10.1). Everything that can end a session — `q`, SIGINT,
// SIGTERM, a setup failure, a caught render failure — runs through **one idempotent disposer**.
// Calling it twice is harmless. A renderer that leaves the terminal in raw mode is a reason to
// reject it, so the restore path is the part written first.

import type { ReadonlyCellFrame, TerminalBackend } from "../frame.ts"
import { frameToAnsi } from "../frame.ts"
import type { CapabilityMode } from "../roles.ts"

const ESC = "\u001b"
const ALT_SCREEN_ON = `${ESC}[?1049h`
const ALT_SCREEN_OFF = `${ESC}[?1049l`
const CURSOR_HIDE = `${ESC}[?25l`
const CURSOR_SHOW = `${ESC}[?25h`
const CURSOR_HOME = `${ESC}[H`
const CLEAR = `${ESC}[2J`
const RESET = `${ESC}[0m`

export type AnsiBackendOptions = Readonly<{
  stdout: NodeJS.WriteStream
  stdin: NodeJS.ReadStream
  capability: CapabilityMode
}>

export class AnsiBackend implements TerminalBackend {
  readonly name = "direct-ansi"
  private readonly options: AnsiBackendOptions
  private started = false
  private stopped = false

  constructor(options: AnsiBackendOptions) {
    this.options = options
  }

  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    const { stdout, stdin } = this.options
    if (stdout.isTTY) stdout.write(ALT_SCREEN_ON + CURSOR_HIDE + CLEAR)
    if (stdin.isTTY && typeof stdin.setRawMode === "function") {
      stdin.setRawMode(true)
      stdin.resume()
    }
  }

  present(frame: ReadonlyCellFrame): void {
    this.options.stdout.write(CURSOR_HOME + frameToAnsi(frame, this.options.capability) + RESET)
  }

  /** Idempotent: safe from a signal handler, an error path, and the normal exit, in any order. */
  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    const { stdout, stdin } = this.options
    if (stdin.isTTY && typeof stdin.setRawMode === "function") {
      stdin.setRawMode(false)
      stdin.pause()
    }
    if (stdout.isTTY) stdout.write(RESET + CURSOR_SHOW + ALT_SCREEN_OFF)
  }
}
