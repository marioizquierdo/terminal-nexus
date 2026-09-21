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
 * Which of a Commander Army's two structure groups a construct-menu row belongs to —
 * `commander-armies.md` Section 2.1: a faction's **common** structures, mostly shared across its
 * Commanders, and the **army** structures that make one Commander's package its own. PERIMETER
 * offers nothing army-specific (milestone-02-campaign-design.md Section 4.2: "The menu draws
 * entirely from the Citizen common tier"), so that group is empty here — drawn as empty rather than
 * assumed away, because a layout that silently depends on there never being one breaks the first
 * time there is.
 */
export type ConstructGroup = "common" | "army"

/**
 * One row of the construct menu. A `MenuItem` is derived from this for the list widget and for
 * mouse hit-testing, so the panel and the adapter cannot disagree about where a row is.
 *
 * `hotkey` addresses the row's position in the **whole menu**, not its position within its group:
 * engine.md 9.7's first convention is that digits always address the list and never mean anything
 * else, and two groups each counting from 1 would need a mode or a focus concept to disambiguate —
 * which is the thing that convention exists to forbid.
 */
export type ConstructItem = Readonly<{
  hotkey: string
  contentId: string
  label: string
  group: ConstructGroup
  /** What it costs out of the Build Phase's starting allotment. */
  cost: number
  /**
   * One short authored line saying what this structure is *for*. Authored rather than derived from
   * the content definition on purpose: "120 hp, 3x2" is a fact about a structure, and what a player
   * is choosing between is what it does.
   */
  effect: string
}>

export type BuildCommand =
  /** Arrows, and the five-tile jump: one command, a different distance. */
  | Readonly<{ kind: "move-cursor"; dx: number; dy: number }>
  /**
   * A click on a Grid tile: move the cursor there and, if a structure is armed, place it — "the
   * same as arrows then Enter" (engine.md 9.7). What a click *does* lives in the reducer rather
   * than in the mouse adapter, so the driver reproduces it exactly.
   *
   * Gate 5A shipped a second behaviour beside this one — click to move the cursor, click again to
   * confirm — as a toggle, because engine.md 9.7 called the choice "a feel decision the spike makes
   * observable as a toggle rather than argues about". Mario looked at both and chose this one
   * (Q50, answered 2026-09-21), so the other is gone rather than kept as a setting.
   */
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
