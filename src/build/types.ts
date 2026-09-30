// The Build Phase command vocabulary — engine.md 9.7's RULE that everything a player can do is a
// named command whose effect never depends on which adapter produced it.
//
// Keyboard, mouse and driver all produce exactly these, and nothing downstream knows a key code or a
// terminal cell. That is what makes "the same plan, entered by hotkeys or by clicks, is the same
// plan" assertable.

import type { Coord } from "../grid/types.ts"
import type { PlaybackControl } from "../view/playback.ts"
import type { ExperimentField } from "./experiments.ts"
import type { PlayerField } from "./settings.ts"

/**
 * One building on the Build Phase menu, in catalog order (no group headings since the owner's feedback
 * F56). `hotkey` addresses the row's position in the **whole menu**: engine.md 9.7's first convention
 * is that digits always address the list and never mean anything else, so should the menu grow groups
 * again — a faction's common structures and one Commander's own — one digit sequence runs through them.
 */
export type ConstructItem = Readonly<{
  hotkey: string
  contentId: string
  label: string
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
   * reducer never sees, and arrives here as an ordinary distance. The fast move (Shift, Option,
   * PageUp/Home and the like, a jump) is just a longer one: it carried a `fast` mark so the reducer could
   * re-centre the view on it, until the owner turned "Shift centres" off (2026-09-30).
   */
  | Readonly<{ kind: "move-cursor"; dx: number; dy: number }>
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
   * map; Start Pulse opens its confirmation. All four are the menu's, so finishing them comes back to the menu. Only the keyboard has a
   * "highlighted, not yet chosen" state. Two exceptions, both about what the click could see: with a
   * popup open it only closes the popup and brings focus to the menu; and while Explore Map covers the
   * menu, a click on its own row or anywhere else on the panel closes it, as Esc does — the row it
   * landed on was not drawn, so it chooses nothing.
   */
  | Readonly<{ kind: "click-menu"; entry: number }>
  /** Arm item *n* of the construct menu — its digit, from anywhere. Moves focus to the Grid; the cursor
   *  stays where it is when the building can go there, and otherwise moves to the nearest spot that
   *  can take it (feedback F30). A placement or Esc goes back to whichever half had the keyboard.
   *  **While a building is armed the menu stays on it** (owner, 2026-09-30, feedback F69, F70): its own
   *  digit cancels it, exactly as Esc does, and another building's digit is refused until it is placed
   *  or cancelled. */
  | Readonly<{ kind: "arm"; index: number }>
  /** Place the armed structure at the cursor — Enter or Space on the Grid while something is armed. */
  | Readonly<{ kind: "place" }>
  /** Enter or Space on the Grid in plain navigation: Explore Map, the side panel showing what is under
   *  the cursor, begun on the map — so Esc comes back to the map (feedback F30). Nothing, when Explore
   *  Map is already open. */
  | Readonly<{ kind: "open-explore" }>
  /** Remove the planned, uncommitted placement under the cursor — Backspace or Delete. Refused on the
   *  menu, where the cursor is hidden, with the flicker of a key that had nothing to do there. */
  | Readonly<{ kind: "remove" }>
  | Readonly<{ kind: "undo" }>
  /**
   * Esc, and a click on the top bar's `menu [esc]`: step back one level — close a popup (Settings
   * opened from the game menu goes back to it), stop placing or close Explore Map (to where it was
   * begun), give the keyboard back to the menu (disarming), and on the menu open the game menu.
   */
  | Readonly<{ kind: "cancel" }>
  /**
   * `x` and a right click: every step `cancel` takes **but the last** — on the menu, with nothing open,
   * it does nothing at all (owner, 2026-09-30, feedback F62: "Menu should only open with 'esc', but not
   * with 'x' ... I like to type x-x-x and I'd like that always gets back to the regular state with the
   * focus on the menu"). So `x x x` from anywhere lands on the menu and stays, and a stray right click
   * never opens a menu. Its own command rather than a flag on `cancel`, so a driver says which it means
   * and the reducer has one place where the two differ.
   */
  | Readonly<{ kind: "back" }>
  /** Leave the screen. Only the game menu's `[q]` (or Ctrl+C) sends it; the session decides what
   *  leaving means. */
  | Readonly<{ kind: "quit" }>
  /** `q` anywhere but the game menu: open the game menu — Settings, Restart and Quit — rather than
   *  quit outright and lose a plan (owner, 2026-09-28). */
  | Readonly<{ kind: "open-game-menu" }>
  /** Pick Nexus power *n* — a digit or a click while the Nexus popup is open. */
  | Readonly<{ kind: "pick-nexus"; index: number }>
  /** `s` (or `p`), or the menu's last row, `[s] Start Pulse` — open the Battle Round confirmation.
   *  Refused while a Nexus power is still waiting to be picked — the one thing that pick refuses — and
   *  while a building is armed (feedback F69). */
  | Readonly<{ kind: "open-battle-round" }>
  /** `[s] Start` — the confirmation's one row, by Enter, Space, `s` or a click: the Nexus Pulse starts.
   *  Going back is the cancel every popup has (owner, 2026-09-29, feedback F50). */
  | Readonly<{ kind: "start-pulse" }>
  /** Tab: move keyboard focus. To the Grid it arrives in plain navigation (feedback F30); to the menu
   *  it disarms (a building is armed only while the Grid has focus). */
  | Readonly<{ kind: "focus"; target: Focus }>
  /**
   * Up/Down on the menu or inside a popup's list: move its highlight `delta` rows (negative is up),
   * **stopping at either end** — no list comes round (owner, 2026-09-30, feedback F75: "should not
   * rotate ... if I keep down pressed, it should quickly move to the bottom and stay there"). A tap is
   * one row; how far a held arrow goes is the input path's decision, the map cursor's own ramp
   * (`src/build/motion.ts`), and arrives here as an ordinary distance. `jump` is the fast move — Shift,
   * Option, PageUp/PageDown, Home/End — which goes all the way: to the first row for a negative
   * `delta`, the last for a positive one.
   */
  | Readonly<{ kind: "highlight"; delta: number; jump?: boolean }>
  /** Enter/Space on the menu or inside a popup's list: do what the highlighted entry is for. */
  | Readonly<{ kind: "activate" }>
  /** Left or Right on the menu, where they have nothing to do: the highlighted row flickers "refused"
   *  to say the key arrived, and the keyboard stays on the menu (owner, 2026-09-30, feedback F55). */
  | Readonly<{ kind: "refuse-row" }>
  /** `n`, or activating the Nexus entry: open the Nexus popup. */
  | Readonly<{ kind: "open-nexus-powers" }>
  /** `e`: Explore Map, a toggle — focus to the Grid with nothing armed, the side panel showing what is
   *  under the cursor as it moves (feedback F23); with it open, back one level exactly as Esc (F32).
   *  Opening it puts the cursor on clear ground by the arming rule for one tile (F66); refused while a
   *  building is armed (F69). */
  | Readonly<{ kind: "explore" }>
  /**
   * The Settings popup: the player's own settings, then Experiments (owner, 2026-09-28). `[s]` in the
   * game menu opens it at the settings; `d` opens it at the
   * experiments.
   */
  | Readonly<{ kind: "open-settings"; section: "settings" | "experiments" }>
  /** One step of a player setting (background, colour depth, symbols, reduced motion): Left or Right
   *  on its row, or a click on either half of its value. Named by field, like `experiment-adjust`. */
  | Readonly<{ kind: "setting-adjust"; field: PlayerField; step: -1 | 1 }>
  /**
   * One step of an Experiment: Left (`-1`) or Right (`+1`) on its row, or a click
   * on the left or right half of its value. Named by field rather than by the popup's highlight, so a
   * driver script can set a flag without walking the list; with the popup open it also moves the
   * highlight there.
   */
  | Readonly<{ kind: "experiment-adjust"; field: ExperimentField; step: -1 | 1 }>
  /**
   * A click on a popup's row away from what the row does (a setting's name rather than its value), or
   * on the popup's scroll bar: highlight row `row` of its list, clamped to the list, so what the row is
   * for shows and the list scrolls to it. `row` counts the list as `popupHighlight` does — Settings'
   * rows, the export's lines, the Controls page's key lines.
   */
  | Readonly<{ kind: "select-row"; row: number }>
  /** `r` in the game menu, or its `[r] Restart` row (feedback F34 moved it there from Settings): start
   *  the Build Phase over, keeping every setting and experiment — how one that applies only after a
   *  restart takes effect. */
  | Readonly<{ kind: "restart" }>
  /**
   * `e` in the Settings popup, or its export row: show the settings and experiments as text to paste
   * into a pull request comment. The reducer only opens the popup that shows it; copying the text to
   * the clipboard and a file is the session's side effect (`BuildSession`'s `onExport`).
   */
  | Readonly<{ kind: "export-settings" }>
  /**
   * The Controls and hotkeys page (owner, 2026-09-30, feedback F60: "an option for 'Controls and
   * hotkeys' that opens a section that explains how to use the keyboard, hotkeys and mouse clicks"):
   * `c` or its row in the game menu, which Esc then goes back to, or `?` from the game, which Esc
   * closes. Opens over nothing but the game menu.
   */
  | Readonly<{ kind: "open-controls" }>
  /**
   * A Nexus Pulse playback control — Space, `[`, `]`, `.`, `,` and `r` while a Pulse is on screen, or a
   * click on the panel's control rows (gate 6A): the same vocabulary `grid watch` has, one keymap across
   * both. The reducer has nothing to change for it — the Pulse's clock is the presenter's, never the
   * state's — so it passes through like `quit`, and the session hands it to the Pulse it belongs to.
   */
  | Readonly<{ kind: "pulse"; control: PlaybackControl }>
  /**
   * Centre the view on a tile and put the cursor there. Sent by the Pulse when it starts and when its
   * ending begins ("the camera is centred at the nexus", milestone 6 Section 2.2): a state change like
   * any other move, so what the player does next — scrolling, looking around — starts from where the
   * story left the view, and the view's slide is the presentation's to draw.
   */
  | Readonly<{ kind: "look-at"; x: number; y: number }>
  /** The shell could not start the Pulse the player just committed: the commit is undone, so they can fix
   *  the plan, and the reason is said on the status line. */
  | Readonly<{ kind: "pulse-failed"; reason: string }>

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
 * 2026-09-28), Nexus, the construct rows in hotkey order, and Start Pulse last (owner, 2026-09-29,
 * feedback F47). The menu highlight is an index into this list (`menuEntries` in `state.ts`), so every
 * construct row keeps its digit.
 */
export type MenuEntry =
  | Readonly<{ kind: "nexus" }>
  | Readonly<{ kind: "explore" }>
  | Readonly<{ kind: "construct"; index: number }>
  | Readonly<{ kind: "start" }>

/** The popups this screen has — one popup shape for all of them (`src/build/popup.ts`): the Nexus
 *  powers, the Battle Round confirmation, the game menu (Settings, Controls, Restart, Quit), Settings,
 *  the export, a message — `BuildState.message`, a title and text with nothing to choose — and the
 *  Controls and hotkeys page (feedback F60). */
export type Popup = "nexus-powers" | "battle-round" | "game-menu" | "settings" | "export" | "message" | "controls"

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
