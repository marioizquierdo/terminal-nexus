// The pure menu-list reducer. No stdin, no ANSI, no backend — a `MenuCommand` in, the next state and
// whatever got activated out, so this is testable without a terminal and reusable by any future list
// (a construct menu, a Nexus draft) that wants the same "hotkey, arrows-and-Enter, or a click" shape.

import { stepListIndex } from "./list-keys.ts"
import type { MenuCommand, MenuItem } from "./types.ts"

export type MenuListState = Readonly<{
  items: readonly MenuItem[]
  /** Index into `items`. Meaningless, and left at 0, when `items` is empty. */
  highlighted: number
}>

export function createMenuList(items: readonly MenuItem[]): MenuListState {
  return { items, highlighted: 0 }
}

/**
 * The next highlighted index after moving by `delta`, **stopping at either end** (owner, 2026-09-30,
 * feedback F75: menus "should not rotate", the same rule as every list in the Build Phase) — or, with
 * `jump` (Shift+Up/Down, PageUp/PageDown, Home/End), the first row for a negative `delta` and the last
 * for a positive one. A one-item list never leaves its only item; an empty one answers 0.
 */
export function moveHighlight(state: MenuListState, delta: number, jump = false): number {
  return stepListIndex(state.highlighted, state.items.length, delta, jump)
}

export type MenuOutcome = Readonly<{
  state: MenuListState
  /** Non-null exactly when this command activated an item — the caller's cue to act on it. */
  activated: MenuItem | null
}>

/**
 * Applies one command. `quit` and `back` both pass through untouched — leaving the application or
 * the current screen is not a list concern, and the session that owns the disposer/the screen stack
 * decides what either means — so this reducer only ever changes `highlighted`, and only ever in
 * response to `highlight` or `activate`.
 */
export function applyMenuCommand(state: MenuListState, command: MenuCommand): MenuOutcome {
  switch (command.kind) {
    case "highlight": {
      if (command.index < 0 || command.index >= state.items.length) return { state, activated: null }
      return { state: { ...state, highlighted: command.index }, activated: null }
    }
    case "activate": {
      const item = state.items[command.index]
      if (item === undefined) return { state, activated: null }
      return { state: { ...state, highlighted: command.index }, activated: item }
    }
    case "quit":
    case "back":
      return { state, activated: null }
    default:
      return { state, activated: null }
  }
}
