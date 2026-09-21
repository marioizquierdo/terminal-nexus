// The pure menu-list reducer. No stdin, no ANSI, no backend — a `MenuCommand` in, the next state and
// whatever got activated out, so this is testable without a terminal and reusable by any future list
// (a construct menu, a Nexus draft) that wants the same "hotkey, arrows-and-Enter, or a click" shape.

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
 * The next highlighted index after moving by `delta`, wrapping around both ends. Wrapping degrades
 * correctly at the acceptance criterion's own edge case — a one-item list — since `(0 + delta) % 1`
 * is always `0`: the highlight simply never leaves the only item there is.
 */
export function moveHighlight(state: MenuListState, delta: -1 | 1): number {
  const count = state.items.length
  if (count === 0) return 0
  return ((state.highlighted + delta) % count + count) % count
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
