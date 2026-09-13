// The menu list shape — engine.md 9.7: "every menu item displays its hotkey before its label... a
// hotkey that is not displayed does not exist." One small, reusable shape rather than a screen-
// specific one, per milestone-03-game-menu.md Section 2: a menu is data a list widget renders, not a
// bespoke thing built per screen.

/**
 * One selectable row. `hotkey` is stable across screens, sessions, and terminal sizes — engine.md
 * 9.7's own reason: muscle memory transfers. `id` is what application code switches on; `hotkey` and
 * `label` are what the player sees, and only ever those two things: `[${hotkey}] ${label}`.
 */
export type MenuItem = Readonly<{
  id: string
  hotkey: string
  label: string
}>

/**
 * The one command vocabulary a menu screen understands — engine.md 9.7's RULE. Keyboard, mouse, and
 * the driver are three producers of this same type; nothing downstream ever learns which adapter
 * produced a given command.
 *
 *   - `highlight`  — move the highlight to this item, without activating it (arrow keys).
 *   - `activate`   — run this item now (a hotkey, a mouse click, or Enter on the highlighted item).
 *   - `quit`       — leave the application (`q`, an interrupt byte, SIGINT, SIGTERM).
 */
export type MenuCommand =
  | Readonly<{ kind: "highlight"; index: number }>
  | Readonly<{ kind: "activate"; index: number }>
  | Readonly<{ kind: "quit" }>
