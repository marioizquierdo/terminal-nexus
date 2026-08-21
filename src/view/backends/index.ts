import type { TerminalBackend } from "../frame.ts"
import type { CapabilityMode } from "../roles.ts"
import { AnsiBackend } from "./ansi.ts"

export type BackendOptions = Readonly<{
  stdout: NodeJS.WriteStream
  stdin: NodeJS.ReadStream
  capability: CapabilityMode
  width: number
  height: number
}>

export type NamedBackend = TerminalBackend & Readonly<{ name: string }>

/**
 * `auto` prefers OpenTUI and falls back to direct ANSI when it is not installed or fails to load —
 * the fallback the milestone requires to stay a half-day's work, kept working rather than assumed.
 */
export async function selectBackend(
  choice: string,
  options: BackendOptions,
): Promise<NamedBackend> {
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
