// The Build Phase command vocabulary — engine.md 9.7's RULE that everything a player can do is a
// named command whose effect never depends on which adapter produced it.
//
// Keyboard, mouse and driver all produce exactly these, and nothing downstream knows a key code or a
// terminal cell. That is what makes "the same plan, entered by hotkeys or by clicks, is the same
// plan" assertable.

import type { Coord } from "../grid/types.ts"
import type { DebugField } from "./debug.ts"

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
  /**
   * Arrows, and the fast move: one command, a different distance. **How far is the input path's
   * decision, never the reducer's** (gate 5H): how far a held arrow goes comes from key timing the
   * reducer never sees, and arrives here as an ordinary distance. `fast` marks the fast move (Shift,
   * Option, PageUp/Home and the like, a jump) — not a distance but what it is for, so the reducer can
   * recentre the view on it when Debug Mode's "Shift centres" says so.
   */
  | Readonly<{ kind: "move-cursor"; dx: number; dy: number; fast?: boolean }>
  /**
   * A click on a Grid tile. What it does is the reducer's to decide, from what is on screen — so the
   * driver reproduces a click exactly (engine.md 9.7):
   *
   * - with a popup open, it closes the popup and moves focus and the cursor there — nothing more;
   * - otherwise it moves focus to the Grid and the cursor to the tile; with a structure armed and the
   *   cursor *already* on that tile, it places (a second click on the same tile — Q52, compared by
   *   tile, never by screen position). With nothing armed it only moves the cursor: in Explore Map
   *   the panel follows it; from the menu the menu stays drawn, so a mouse player who clicked around
   *   the map can still click a building on it (feedback F22).
   */
  | Readonly<{ kind: "click-tile"; x: number; y: number }>
  /**
   * A click on menu entry *n* (an index into `menuEntries`). **A click activates what it lands on**
   * (owner, 2026-09-28, feedback F22 — reversing the 2026-09-27 rule that a first click only
   * highlighted): a construct row arms at once and hands the mouse to the Grid with the ghost at the
   * cursor, the Nexus entry opens its popup, Explore Map opens the map. Only the keyboard has a
   * "highlighted, not yet chosen" state. Two exceptions, both about what the click could see: with a
   * popup open it only closes the popup and brings focus to the menu; and while the Explore Map panel
   * covers the menu it only gives the menu back, since the row it landed on was not drawn.
   */
  | Readonly<{ kind: "click-menu"; entry: number }>
  /** Arm item *n* of the construct menu — its digit, from anywhere. Moves focus to the Grid and leaves
   *  the cursor where it is: the fast path of a player already pointing. */
  | Readonly<{ kind: "arm"; index: number }>
  /** Place the armed structure at the cursor — Enter or Space on the Grid while something is armed. */
  | Readonly<{ kind: "place" }>
  /** Enter or Space on the Grid with nothing armed: Explore Map, the side panel showing what is under
   *  the cursor. Reached this way only from the map a mouse click opened with the menu still showing;
   *  `[e]`, Tab and the menu entry arrive in Explore Map directly (feedback F23). */
  | Readonly<{ kind: "inspect" }>
  /** Remove the planned, uncommitted placement under the cursor — Backspace or Delete. */
  | Readonly<{ kind: "remove" }>
  | Readonly<{ kind: "undo" }>
  /**
   * Esc, `x` and a right click: step back one level — close a popup, close the information panel,
   * give the keyboard back to the menu (disarming), and on the menu ask whether to exit. One command
   * for every way of saying "back", so they cannot drift apart (owner, 2026-09-27: "it should be
   * equivalent to do [esc], and x").
   */
  | Readonly<{ kind: "cancel" }>
  /** Leave the screen. Only the exit question's `[q]` (or Ctrl+C) sends it; the session decides what
   *  leaving means. */
  | Readonly<{ kind: "quit" }>
  /** `q` anywhere but the exit question: ask it, rather than quit outright and lose a plan. */
  | Readonly<{ kind: "request-exit" }>
  /** Pick Nexus power *n* — a digit or a click while the Nexus popup is open. */
  | Readonly<{ kind: "pick-nexus"; index: number }>
  /** `p` — ask, in a popup, whether to start the Nexus Pulse. Refused while a Nexus power is still
   *  waiting to be picked — the one thing that pick refuses. */
  | Readonly<{ kind: "commit" }>
  /** `y`/`n` (or a click on either) inside the start-the-Pulse popup. */
  | Readonly<{ kind: "confirm-commit"; accept: boolean }>
  /** Tab, and a second Right on the menu: move keyboard focus. To the Grid it arrives in Explore Map;
   *  to the menu it disarms (a building is armed only while the Grid has focus). */
  | Readonly<{ kind: "focus"; target: Focus }>
  /** Up/Down on the menu or inside a popup's list: move its highlight, wrapping at both ends. */
  | Readonly<{ kind: "highlight"; delta: -1 | 1 }>
  /** Enter/Space on the menu or inside a popup's list: do what the highlighted entry is for. */
  | Readonly<{ kind: "activate" }>
  /** Left/Right on the menu: nothing to do there, so the row flickers to say the key arrived; a second
   *  Right in a row moves focus to the Grid (owner, 2026-09-27). */
  | Readonly<{ kind: "nudge"; direction: "left" | "right" }>
  /** `n`, or activating the Nexus entry: open the Nexus popup. */
  | Readonly<{ kind: "open-nexus-powers" }>
  /** `e`, or activating the Explore Map entry: focus to the Grid with nothing armed, the side panel
   *  showing what is under the cursor as it moves (feedback F23). */
  | Readonly<{ kind: "explore" }>
  /** `d`, or a click on the top bar's `[d] debug`: open the Debug Mode popup (gate 5G). */
  | Readonly<{ kind: "open-debug" }>
  /**
   * One step of a Debug Mode flag: Left (`-1`) or Right (`+1`) on its row, or a click on the left or
   * right half of its value. Named by field rather than by the popup's highlight, so a driver script
   * can set a flag without walking the list; with the popup open it also moves the highlight there.
   */
  | Readonly<{ kind: "debug-adjust"; field: DebugField; step: -1 | 1 }>
  /** A click on a Debug Mode row away from its value: highlight it, so its question shows. */
  | Readonly<{ kind: "debug-select"; row: number }>
  /** `r` in the Debug Mode popup, or its restart row: start the Build Phase over, keeping the flags —
   *  how a flag marked "restart" takes effect. */
  | Readonly<{ kind: "debug-restart" }>

/** Which half of the screen the arrow keys and Enter/Space belong to. The digit hotkeys ignore it. */
export type Focus = "menu" | "grid"

/**
 * One entry of the side panel's menu, in the order Up/Down walk it: Explore Map (first, owner
 * 2026-09-28), Nexus, then the construct rows in hotkey order. The menu highlight is an index into
 * this list (`menuEntries` in `state.ts`), so every construct row keeps its digit.
 */
export type MenuEntry =
  | Readonly<{ kind: "nexus" }>
  | Readonly<{ kind: "explore" }>
  | Readonly<{ kind: "construct"; index: number }>

/** The popups this screen has — one overlay shape for all four (`src/build/overlay.ts`). */
export type Overlay = "nexus-powers" | "confirm-commit" | "exit" | "debug"

/**
 * What the last command wants acknowledged on screen — a brief "pressed" flash on the row it
 * activated, or a flicker on the row that had nothing to do (owner, 2026-09-27). The reducer records
 * it with a sequence number and no clock; the live loop shows it for a few frames from the moment it
 * first sees a new `seq`, so timing stays in the adapter and the reducer stays pure.
 */
export type Ack = Readonly<{ seq: number; kind: "pressed" | "refused"; entry: number }>

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

/**
 * One option in the Nexus draft. **Placeholder content, not Milestone 8's real draft** — a Nexus
 * power there is "a name and one plain line of description" applying one of six effect kinds
 * (`commander-armies.md` Section 4.5); these two are plain numbers instead, on purpose, so nothing
 * here reads as an attempt at real design. What this gate builds is the *mechanism* — offer a
 * choice, accept a pick, apply its effect — against whatever option happens to be in the slot.
 */
export type NexusPowerOption = Readonly<{
  hotkey: string
  name: string
  description: string
  /** Added to the starting allotment the moment this option is picked. */
  bonusAllotment: number
}>
