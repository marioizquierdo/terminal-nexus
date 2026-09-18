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
  /** Called on a `back` command (Esc). Defaults to doing nothing, which is exactly right for a
   *  screen with nowhere to go back to — engine.md 9.7: "never quits the game by itself." */
  onBack?: () => void
}>

export class MenuSession {
  private listState: MenuListState
  private readonly onActivate: (item: MenuItem) => void
  private readonly onQuit: () => void
  private readonly onBack: () => void

  constructor(options: MenuSessionOptions) {
    this.listState = createMenuList(options.items)
    this.onActivate = options.onActivate
    this.onQuit = options.onQuit
    this.onBack = options.onBack ?? ((): void => {})
  }

  get state(): MenuListState {
    return this.listState
  }

  /**
   * Replaces the item list in place — a settings row relabelling itself after its own value cycles
   * ("Theme: dark" -> "Theme: light") is not a new screen, just new text on the same one. The
   * highlight stays on the same index when it is still valid, so relabelling never moves the cursor
   * out from under the player; it only clamps if the list genuinely shrank.
   */
  setItems(items: readonly MenuItem[]): void {
    const highlighted = Math.min(this.listState.highlighted, Math.max(0, items.length - 1))
    this.listState = { items, highlighted }
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
    if (command.kind === "back") {
      this.onBack()
      return
    }
    const outcome = applyMenuCommand(this.listState, command)
    this.listState = outcome.state
    if (outcome.activated !== null) this.onActivate(outcome.activated)
  }

  /**
   * One already-split raw key or mouse report (as `keysFromChunk` produces) through both real
   * adapters at once: tried first as an SGR mouse report, then as a keyboard key, and whichever one
   * recognises it produces the command that reaches `dispatch`. Exposed separately from `handleData`
   * so a caller juggling more than one screen — `src/cli/menu.ts`'s top-level/Settings switch — can
   * re-check *which* screen is current between keys of the same chunk: a hotkey that changes screen
   * and a second key typed right behind it can arrive in one `data` event, and the second key belongs
   * to whichever screen is current *after* the first one ran, not whichever was current when the
   * chunk began.
   */
  handleKey(key: string, layout: MenuLayout): void {
    const click = parseMouseClick(key)
    const command =
      click !== null
        ? mouseCommand(click, this.listState.items, layout)
        : keyboardCommand(key, this.listState)
    if (command !== null) this.dispatch(command)
  }

  /**
   * The driver's raw-bytes path — "a scripted list of... raw key and mouse events" (engine.md 9.7) —
   * and what a live terminal's `stdin.on("data", ...)` handler calls too, for the common case of one
   * screen handling its own whole chunk. `keysFromChunk` is the same split `grid watch` already uses
   * (`src/view/playback.ts`).
   */
  handleData(rawChunk: string, layout: MenuLayout): void {
    for (const key of keysFromChunk(rawChunk)) this.handleKey(key, layout)
  }
}
