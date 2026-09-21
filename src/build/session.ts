// The Build Phase spike's dispatch core — the state plus the one function a live terminal's stdin
// handler, a test, and an agent playtest all call. `src/menu/session.ts` is the same shape for the
// menu, and the same sentence applies: this *is* the real adapter dispatch, not a parallel copy
// built for tests, which is the only reason "the driver injects raw key and mouse events into the
// real adapters" (engine.md 9.7) is a true statement rather than an aspiration.
//
// No stdin, no ANSI, no backend, and no `src/view` import: composing what this looks like is
// `src/view/build.ts`'s job and wiring it to a terminal is `src/cli/spike.ts`'s.

import { keysFromChunk } from "../view/playback.ts"
import type { BuildLayout } from "./layout.ts"
import type { Viewport } from "./camera.ts"
import { buildKeyboardCommand } from "./keyboard.ts"
import { buildMouseCommand, parseMouseEvent } from "./mouse.ts"
import type { BuildContext, BuildState } from "./state.ts"
import { applyBuildCommand, createBuildState, withViewport } from "./state.ts"
import type { BuildCommand } from "./types.ts"
import type { Coord } from "../grid/types.ts"

export type BuildSessionOptions = Readonly<{
  context: BuildContext
  cursor: Coord
  viewport: Viewport
  /** Esc with nothing armed, or a right click with nothing armed: leave this screen for whatever it
   *  was reached from. What that means is the caller's business. */
  onBack?: () => void
  onQuit?: () => void
}>

export class BuildSession {
  private buildState: BuildState
  private readonly context: BuildContext
  private readonly onBack: () => void
  private readonly onQuit: () => void

  constructor(options: BuildSessionOptions) {
    this.context = options.context
    this.buildState = createBuildState(options.context, options.cursor, options.viewport)
    this.onBack = options.onBack ?? ((): void => {})
    this.onQuit = options.onQuit ?? ((): void => {})
  }

  get state(): BuildState {
    return this.buildState
  }

  /** The driver's direct-command path — "a scripted list of commands" (engine.md 9.7). */
  dispatch(command: BuildCommand): void {
    if (command.kind === "quit") {
      this.onQuit()
      return
    }
    if (command.kind === "back") {
      this.onBack()
      return
    }
    this.buildState = applyBuildCommand(this.context, this.buildState, command)
  }

  /** A whole script at once, which is what an agent playtest actually looks like. */
  run(commands: readonly BuildCommand[]): void {
    for (const command of commands) this.dispatch(command)
  }

  /**
   * One already-split raw key or mouse report through both real adapters: tried first as an SGR
   * mouse report, then as a key, and whichever recognises it produces the command. Exposed
   * separately from `handleData` so a caller juggling more than one screen can re-check which screen
   * is current between keys of the same chunk — the bug Gate 3B found and fixed for the menu, which
   * would be exactly as easy to reintroduce here.
   */
  handleKey(key: string, layout: BuildLayout): void {
    const mouse = parseMouseEvent(key)
    const command =
      mouse !== null
        ? buildMouseCommand(mouse, this.buildState.camera, layout, this.context.catalog)
        : buildKeyboardCommand(key, {
            itemCount: this.context.catalog.length,
            armed: this.buildState.armed !== null,
          })
    if (command !== null) this.dispatch(command)
  }

  /** The driver's raw-bytes path — "a scripted list of... raw key and mouse events" — and what a
   *  live terminal's `data` handler calls. */
  handleData(rawChunk: string, layout: BuildLayout): void {
    for (const key of keysFromChunk(rawChunk)) this.handleKey(key, layout)
  }

  /** A new terminal size. Not a command: nobody pressed anything. */
  resize(viewport: Viewport): void {
    this.buildState = withViewport(this.context, this.buildState, viewport)
  }
}
