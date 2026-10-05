// The menu list shape (`input.md`): every menu item displays its hotkey before its label, and a
// hotkey that is not displayed does not exist. One small, reusable shape rather than a screen-
// specific one: a menu is data a list widget renders, not a bespoke thing built per screen.

/**
 * One selectable row. `hotkey` is stable across screens, sessions, and terminal sizes, so
 * muscle memory transfers (`input.md`). `id` is what application code switches on; `hotkey` and
 * `label` are what the player sees, and only ever those two things: `[${hotkey}] ${label}`.
 *
 * `disabled` is a rendering hint only — dimmed instead of the normal hotkey/label colours when not
 * highlighted. It changes nothing about the command vocabulary:
 * the item still has a real, displayed hotkey, and it is a RULE (`input.md`) that a displayed hotkey
 * activates the item it belongs to, so `disabled` never suppresses that. A row using it just has
 * nothing further to do once activated (a disabled item shows its reason in its label; that is not a
 * new kind of command).
 */
export type MenuItem = Readonly<{
  id: string
  hotkey: string
  label: string
  disabled?: boolean
  /**
   * The route this row opens (`src/cli/route.ts`) — `settings`, `campaign` — when it opens a place: choosing
   * the row and following its route are one thing, so `--at settings` and pressing Settings open the same
   * screen. A row that does something else (Exit) or changes a value (a Settings row) names none.
   */
  route?: string
}>

/**
 * The one command vocabulary a menu screen understands — the `input.md` RULE. Keyboard, mouse, and
 * the driver are three producers of this same type; nothing downstream ever learns which adapter
 * produced a given command.
 *
 *   - `highlight`  — move the highlight to this item, without activating it (arrow keys).
 *   - `activate`   — run this item now (a hotkey, a mouse click, or Enter on the highlighted item).
 *   - `back`       — leave the current screen for whatever it was reached from (Esc). A screen with
 *     nowhere to go back to (the top-level menu) simply does nothing with it: Esc backs out of a screen and
 *     never quits the game by itself (`input.md`).
 *   - `quit`       — leave the application (`q`, an interrupt byte, SIGINT, SIGTERM).
 */
export type MenuCommand =
  | Readonly<{ kind: "highlight"; index: number }>
  | Readonly<{ kind: "activate"; index: number }>
  | Readonly<{ kind: "back" }>
  | Readonly<{ kind: "quit" }>
