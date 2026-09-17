// The menu's dispatch core — state plus the one function a live terminal's stdin handler and a test
// or agent driver both call. engine.md 9.7's RULE names three adapters; this file is where keyboard
// and mouse actually become the same commands, and it is also, itself, the driver: "the driver
// injects raw key and mouse events into the real adapters" is true because `handleData` *is* the
// real adapter dispatch, not a parallel copy of it built for tests.
//
// No stdin, no ANSI, no backend, and no `src/view` import here on purpose — a `MenuSession` is
// exactly as terminal-agnostic as `src/pulse` is renderer-agnostic. Composing what it looks like is
// `src/view/menu.ts`'s job; wiring it to a real terminal is `src/cli/menu.ts`'s.

import { keysFromChunk } from "../view/playback.ts"
import { applyMenuCommand, createMenuList } from "./list.ts"
import type { MenuListState } from "./list.ts"
import { keyboardCommand } from "./keyboard.ts"
import type { MenuLayout } from "./layout.ts"
import { mouseCommand, parseMouseClick } from "./mouse.ts"
import type { MenuCommand, MenuItem } from "./types.ts"

export type MenuSessionOptions = Readonly<{
  items: readonly MenuItem[]
  /** Called when a command activates an item — a hotkey, a click, or Enter on the highlight. */
  onActivate: (item: MenuItem) => void
  /** Called on a `quit` command. What "quit" means (the disposer, the exit code) is the caller's
   *  business, not this class's — the same separation `list.ts`'s reducer already draws. */
  onQuit: () => void
}>

export class MenuSession {
  private listState: MenuListState
  private readonly onActivate: (item: MenuItem) => void
  private readonly onQuit: () => void

  constructor(options: MenuSessionOptions) {
    this.listState = createMenuList(options.items)
    this.onActivate = options.onActivate
    this.onQuit = options.onQuit
  }

  get state(): MenuListState {
    return this.listState
  }

  /**
   * The driver's direct-command path — "a scripted list of commands" (engine.md 9.7). Applies one
   * command exactly as if the keyboard or mouse adapter had produced it.
   */
  dispatch(command: MenuCommand): void {
    if (command.kind === "quit") {
      this.onQuit()
      return
    }
    const outcome = applyMenuCommand(this.listState, command)
    this.listState = outcome.state
    if (outcome.activated !== null) this.onActivate(outcome.activated)
  }

  /**
   * The driver's raw-bytes path — "a scripted list of... raw key and mouse events" (engine.md 9.7) —
   * and what a live terminal's `stdin.on("data", ...)` handler calls too. `keysFromChunk` is the same
   * split `grid watch` already uses (`src/view/playback.ts`); each resulting key is tried first as an
   * SGR mouse report, then as a keyboard key, and whichever adapter recognises it produces the
   * command that reaches `dispatch`.
   */
  handleData(rawChunk: string, layout: MenuLayout): void {
    for (const key of keysFromChunk(rawChunk)) {
      const click = parseMouseClick(key)
      const command =
        click !== null
          ? mouseCommand(click, this.listState.items, layout)
          : keyboardCommand(key, this.listState)
      if (command !== null) this.dispatch(command)
    }
  }
}
