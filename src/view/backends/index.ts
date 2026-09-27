import type { TerminalBackend } from "../frame.ts"
import type { CapabilityMode, Theme } from "../roles.ts"
import { AnsiBackend } from "./ansi.ts"
import type { TerminalInput, TerminalOutput } from "./ports.ts"

export type BackendOptions = Readonly<{
  stdout: TerminalOutput
  stdin: TerminalInput
  capability: CapabilityMode
  /** Defaults to `DEFAULT_THEME` ("dark") wherever a caller has not been taught about themes yet. */
  theme?: Theme
  width: number
  height: number
}>

export type NamedBackend = TerminalBackend & Readonly<{ name: string }>

/**
 * `auto` prefers OpenTUI and falls back to direct ANSI when it is not installed or fails to load —
 * the fallback the milestone requires to stay a half-day's work, kept working rather than assumed.
 * A backend object passes straight through: that is how the browser playtest page hands a screen
 * loop its canvas instead of a terminal backend, without the loop knowing the difference.
 */
export async function selectBackend(
  choice: string | NamedBackend,
  options: BackendOptions,
): Promise<NamedBackend> {
  if (typeof choice !== "string") return choice
  if (choice === "ansi") return new AnsiBackend(options)
  if (choice === "opentui" || choice === "auto") {
    try {
      const module = await import("./opentui.ts")
      return await module.createOpenTuiBackend(options)
    } catch (error) {
      if (choice === "opentui") throw error
      return new AnsiBackend(options)
    }
  }
  throw new Error(`unknown backend "${choice}"; expected auto, ansi, or opentui`)
}

export { AnsiBackend }
