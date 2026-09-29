// The Build Phase command vocabulary — engine.md 9.7's RULE that everything a player can do is a
// named command whose effect never depends on which adapter produced it.
//
// Keyboard, mouse and driver all produce exactly these, and nothing downstream knows a key code or a
// terminal cell. That is what makes "the same plan, entered by hotkeys or by clicks, is the same
// plan" assertable.

import type { Coord } from "../grid/types.ts"
import type { DebugField } from "./debug.ts"
import type { PlayerField } from "./settings.ts"

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
   *   the panel follows it; from the menu it arrives in plain navigation, the menu still drawn, so a
   *   mouse player who clicked around the map can still click a building on it (feedback F22).
   */
  | Readonly<{ kind: "click-tile"; x: number; y: number }>
  /**
   * A click on menu entry *n* (an index into `menuEntries`). **A click activates what it lands on**
   * (owner, 2026-09-28, feedback F22 — reversing the 2026-09-27 rule that a first click only
   * highlighted): a construct row arms at once and hands the mouse to the Grid with the ghost at the
   * cursor, or the nearest spot that takes it; the Nexus entry opens its popup; Explore Map opens the
   * map. All three are the menu's, so finishing them comes back to the menu. Only the keyboard has a
   * "highlighted, not yet chosen" state. Two exceptions, both about what the click could see: with a
   * popup open it only closes the popup and brings focus to the menu; and while Explore Map covers the
   * menu, a click on its own row or anywhere else on the panel closes it, as Esc does — the row it
   * landed on was not drawn, so it chooses nothing.
   */
  | Readonly<{ kind: "click-menu"; entry: number }>
  /** Arm item *n* of the construct menu — its digit, from anywhere. Moves focus to the Grid; the cursor
   *  stays where it is when the building can go there, and otherwise moves to the nearest spot that
   *  can take it (feedback F30). A placement or Esc goes back to whichever half had the keyboard. */
  | Readonly<{ kind: "arm"; index: number }>
  /** Place the armed structure at the cursor — Enter or Space on the Grid while something is armed. */
  | Readonly<{ kind: "place" }>
  /** Enter or Space on the Grid in plain navigation: Explore Map, the side panel showing what is under
   *  the cursor, begun on the map — so Esc comes back to the map (feedback F30). Nothing, when Explore
   *  Map is already open. */
  | Readonly<{ kind: "inspect" }>
  /** Remove the planned, uncommitted placement under the cursor — Backspace or Delete. */
  | Readonly<{ kind: "remove" }>
  | Readonly<{ kind: "undo" }>
  /**
   * Esc, `x` and a right click: step back one level — close a popup (Settings opened from the game
   * menu goes back to it), close the information panel, give the keyboard back to the menu
   * (disarming), and on the menu open the game menu. One command for every way of saying "back", so
   * they cannot drift apart (owner, 2026-09-27: "it should be equivalent to do [esc], and x").
   */
  | Readonly<{ kind: "cancel" }>
  /** Leave the screen. Only the game menu's `[q]` (or Ctrl+C) sends it; the session decides what
   *  leaving means. */
  | Readonly<{ kind: "quit" }>
  /** `q` anywhere but the game menu: open the game menu — Settings, Restart and Quit — rather than
   *  quit outright and lose a plan (owner, 2026-09-28). */
  | Readonly<{ kind: "open-menu" }>
  /** Pick Nexus power *n* — a digit or a click while the Nexus popup is open. */
  | Readonly<{ kind: "pick-nexus"; index: number }>
  /** `p` — ask, in a popup, whether to start the Nexus Pulse. Refused while a Nexus power is still
   *  waiting to be picked — the one thing that pick refuses. */
  | Readonly<{ kind: "commit" }>
  /** `y`/`n` (or a click on either) inside the start-the-Pulse popup. */
  | Readonly<{ kind: "confirm-commit"; accept: boolean }>
  /** Tab, and a second Right on the menu: move keyboard focus. To the Grid it arrives in plain
   *  navigation (feedback F30); to the menu it disarms (a building is armed only while the Grid has
   *  focus). */
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
  /** `e`: Explore Map, a toggle — focus to the Grid with nothing armed, the side panel showing what is
   *  under the cursor as it moves (feedback F23); with it open, back one level exactly as Esc (F32). */
  | Readonly<{ kind: "explore" }>
  /**
   * The Settings popup: the player's own settings, then Experiments (owner, 2026-09-28). `[s]` in the
   * game menu opens it at the settings; `d` — the old Debug Mode key, kept as a shortcut — opens it at
   * the experiments.
   */
  | Readonly<{ kind: "open-settings"; section: "settings" | "experiments" }>
  /** One step of a player setting (background, colour depth, symbols, reduced motion): Left or Right
   *  on its row, or a click on either half of its value. Named by field, like `debug-adjust`. */
  | Readonly<{ kind: "setting-adjust"; field: PlayerField; step: -1 | 1 }>
  /**
   * One step of an experiment (a Debug Mode flag): Left (`-1`) or Right (`+1`) on its row, or a click
   * on the left or right half of its value. Named by field rather than by the popup's highlight, so a
   * driver script can set a flag without walking the list; with the popup open it also moves the
   * highlight there.
   */
  | Readonly<{ kind: "debug-adjust"; field: DebugField; step: -1 | 1 }>
  /** A click on a Settings row away from its value, or on the popup's scroll bar: highlight it, so
   *  what it is for shows and the list scrolls to it. `row` is the row's id (`src/build/settings.ts`). */
  | Readonly<{ kind: "settings-select"; row: number }>
  /** `r` in the game menu, or its `[r] Restart` row (feedback F34 moved it there from Settings): start
   *  the Build Phase over, keeping every setting and experiment — how one that applies only after a
   *  restart takes effect. */
  | Readonly<{ kind: "debug-restart" }>
  /**
   * `e` in the Settings popup, or its export row: show the settings and experiments as text to paste
   * into a pull request comment. The reducer only opens the popup that shows it; copying the text to
   * the clipboard and a file is the session's side effect (`BuildSession`'s `onExport`).
   */
  | Readonly<{ kind: "export-settings" }>
  /** A click on the export popup's scroll bar: highlight line `line` of the text, bringing it into
   *  view. Up/Down and the wheel move the highlight a line at a time. */
  | Readonly<{ kind: "export-select"; line: number }>

/**
 * How the sides of the Grid rectangle that have reached the map's own edge are drawn — **the map's
 * own style**, named in its definition (`BuildContext.edgeStyle`; the solid bar when it names none).
 * The owner chose this over one style for every map after trying both (2026-09-29, feedback F25:
 * "using map-specific borders looks a lot better... allowing the map to define different styles will
 * be awesome"). Every style keeps the rectangle's rule — the same weight on all four sides and the
 * same meaning in every glyph pack — and is a name, not glyphs: `src/view/edge.ts` draws them.
 *
 * - `solid`: an inverse-video cell — the wall canon 2.21 chose, and what a map that names none gets;
 * - `half`: a half block on the map's side of the cell (quadrants at the corners);
 * - `heavy`: a heavy box line, joined to the frame's light lines with mixed-weight junctions;
 * - `double`: a double box line;
 * - `shade`: a light shade, a dotted band;
 * - `fence`: a dashed heavy line with posts (the PERIMETER stand-in's, `SPIKE_EDGE_STYLE`).
 */
export type MapEdgeStyle = "solid" | "half" | "heavy" | "double" | "shade" | "fence"

/** Every style a map may name, in the order the tests walk them. */
export const MAP_EDGE_STYLES: readonly MapEdgeStyle[] = ["solid", "half", "heavy", "double", "shade", "fence"]

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

/** The popups this screen has — one overlay shape for all of them (`src/build/overlay.ts`): the Nexus
 *  powers, the start-the-Pulse question, the game menu (Settings, Restart, Quit), Settings, the export,
 *  and a message — `BuildState.message`, a title and text with nothing to choose. */
export type Overlay = "nexus-powers" | "confirm-commit" | "menu" | "settings" | "export" | "message"

/**
 * A message popup's words (feedback F34, owner 2026-09-29: "This popup does not have an action, it's
 * just a warning message ... clicking outside or pressing esc should close it"). Any warning the screen
 * needs to give once, and out of the way of the status line, is one of these.
 */
export type PopupMessage = Readonly<{ title: string; text: string }>

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
