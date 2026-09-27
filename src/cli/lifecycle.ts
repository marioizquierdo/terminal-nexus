// The shared idempotent disposer — engine.md 10.1's RULE that every exit path (a quit key, an
// interrupt byte, SIGINT, SIGTERM, a setup failure, a caught render failure) restores the terminal
// exactly once, regardless of which one triggered it, and that calling it twice is harmless.
//
// Extracted out of `watch.ts` for Milestone 3 gate 3A rather than reinvented for the menu: `grid
// watch` and `terminal-nexus`'s menu both build their session lifecycle on this one implementation.
// "There must not be a second one" only holds if both callers actually go through it.

export type TerminalSession = Readonly<{
  /**
   * Registers a cleanup step. Steps run in registration order, and — because `dispose()` guards
   * against re-entry, not each step individually — every step still runs exactly once in total, no
   * matter how many times or from where `dispose()` is called. Any return value is awaited and then
   * ignored, so a step reading naturally as one expression (`() => stdin.off("data", onKey)`) never
   * needs an empty block just to discard what `.off()` or `.write()` hands back.
   */
  onDispose(step: () => unknown): void
  /**
   * Hooks the host's interrupts (SIGINT and SIGTERM, for a terminal program) to `leave` and registers
   * their own removal as a dispose step, so a caller never has to remember to unhook one by hand.
   */
  onSignal(leave: () => void): void
  /**
   * Runs every registered step exactly once, in registration order. Safe to call from a signal
   * handler, a catch block, or the normal exit path — any number of times, in any order. It cannot
   * promise anything after `SIGKILL`.
   */
  dispose(): Promise<void>
}>

/**
 * What a screen loop needs from the program around it, beyond the terminal itself: interrupts to
 * listen for, how to end, and where a failure is reported once the screen is restored. A terminal
 * program is `PROCESS_HOST`; the browser playtest page supplies its own (no signals, a tab never
 * exits, errors to the console) — so no loop reaches for `process` directly.
 */
export type Host = Readonly<{
  /** Calls `leave` on an interrupt; returns what unhooks it again. */
  onInterrupt(leave: () => void): () => void
  exit(code: number): void
  reportError(text: string): void
}>

export const PROCESS_HOST: Host = {
  onInterrupt(leave) {
    const handler = (): void => leave()
    process.on("SIGINT", handler)
    process.on("SIGTERM", handler)
    return () => {
      process.off("SIGINT", handler)
      process.off("SIGTERM", handler)
    }
  },
  exit(code) {
    process.exit(code)
  },
  reportError(text) {
    process.stderr.write(text)
  },
}

export function createTerminalSession(host: Host = PROCESS_HOST): TerminalSession {
  const steps: Array<() => unknown> = []
  let settled: Promise<void> | null = null

  return {
    onDispose(step) {
      steps.push(step)
    },
    onSignal(leave) {
      steps.push(host.onInterrupt(leave))
    },
    dispose() {
      settled ??= (async () => {
        for (const step of steps) await step()
      })()
      return settled
    },
  }
}
