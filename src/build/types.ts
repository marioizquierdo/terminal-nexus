// The Build Phase command vocabulary — engine.md 9.7's RULE: "Everything a player can do on an
// interactive screen... is a named command. Commands are the only way input reaches the application
// shell, and a command's effect never depends on which adapter produced it."
//
// Keyboard, mouse and driver all produce exactly these. Nothing below this line knows a key code, a
// terminal cell, or which of the three it was — which is the whole point, and what makes "the same
// plan, entered by hotkeys or by clicks, is the same plan" a thing a test can assert rather than a
// thing a comment can claim.

import type { Coord } from "../grid/types.ts"

/**
 * The click question this spike exists to make observable rather than argue about — Q37, and
 * engine.md 9.7's own "a feel decision the spike makes observable as a toggle." Both behaviours
 * ship; one key flips between them; the screen always says which one is live.
 *
 *   `place`   — a click on a tile places the armed structure there immediately. The keymap's own
 *               recommendation, and safe in principle because a plan stays revisable until commit.
 *   `confirm` — a click moves the cursor there; a second click on the same tile places. Costs a
 *               gesture, and makes a misclick cost nothing.
 */
export type ClickMode = "place" | "confirm"

/** One row of the construct menu. A `MenuItem` is derived from this for the list widget and for
 *  mouse hit-testing, so the panel and the adapter cannot disagree about where a row is. */
export type ConstructItem = Readonly<{
  hotkey: string
  contentId: string
  label: string
}>

export type BuildCommand =
  /** Arrows, and the five-tile jump: one command, a different distance. */
  | Readonly<{ kind: "move-cursor"; dx: number; dy: number }>
  /** A click on a Grid tile. What it *does* depends on the click mode, and that decision lives in
   *  the reducer rather than the mouse adapter, so the driver reproduces it exactly. */
  | Readonly<{ kind: "click-tile"; x: number; y: number }>
  /** Arm item *n* of the construct menu — a digit, or a click on the row. Stays armed after
   *  placing, so a run of the same structure is one digit then arrows and Enter. */
  | Readonly<{ kind: "arm"; index: number }>
  | Readonly<{ kind: "disarm" }>
  /** Place the armed structure at the cursor — Enter. */
  | Readonly<{ kind: "place" }>
  /** Remove the planned, uncommitted placement under the cursor — Backspace or Delete. */
  | Readonly<{ kind: "remove" }>
  | Readonly<{ kind: "undo" }>
  | Readonly<{ kind: "toggle-click-mode" }>
  /** Leave this screen for whatever it was reached from — Esc with nothing armed, or right-click. */
  | Readonly<{ kind: "back" }>
  | Readonly<{ kind: "quit" }>

/** A structure the player has planned but not committed. Nothing here ever reaches the kernel: a
 *  plan is a plan on a screen, and gate 5D is what turns one into a commit. */
export type PlannedPlacement = Readonly<{
  ordinal: number
  contentId: string
  anchor: Coord
}>

/** Something already standing on the Grid when the screen opens. The spike has two, so there is
 *  something to build next to and something a placement can illegally overlap. */
export type StandingStructure = Readonly<{
  contentId: string
  anchor: Coord
}>
