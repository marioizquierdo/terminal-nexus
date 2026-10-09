// The Build Phase command vocabulary — the RULE in docs/system-design/input.md that everything a player can do is a
// named command whose effect never depends on which adapter produced it.
//
// Keyboard, mouse and driver all produce exactly these, and nothing downstream knows a key code or a
// terminal cell. That is what makes "the same plan, entered by hotkeys or by clicks, is the same
// plan" assertable.

import type { BuildingSpawns, PowerCard } from "../armies/types.ts"
import type { Coord } from "../grid/types.ts"
import type { PlaybackControl } from "../terminal/playback.ts"
import type { ShownName } from "./all-settings.ts"

/**
 * One building on the Build Phase menu, in catalog order (it has no group headings). `hotkey` addresses
 * the row's position in the **whole menu**: the first convention in docs/system-design/input.md is
 * that digits always address the list and never mean anything else, so should the menu grow groups
 * again — a faction's common structures and one Commander's own — one digit sequence runs through them.
 */
export type ConstructItem = Readonly<{
  hotkey: string
  contentId: string
  label: string
  /** What it costs out of the Build Phase's starting allotment. */
  cost: number
  /** What it spawns in each battle, in waves, as its army's card says (`BuildingSpawns`): what its card
   *  shows, and what the shell gives it to spawn when a battle starts (`src/cli/pulse-run.ts`). Absent: it
   *  spawns nothing. */
  spawns?: BuildingSpawns
  // What it is *for* is not here: a building's card words — title, subtitle, description — are written
  // with the content (`src/content/cards.ts`) and read through `cardText` (`card.ts`).
}>

export type BuildCommand =
  /**
   * Arrows, and the fast move: one command, a different distance. **How far is the input path's
   * decision, never the reducer's**: how far a held arrow goes comes from key timing the
   * reducer never sees, and arrives here as an ordinary distance. The fast move (Shift, Option,
   * PageUp/Home and the like, a jump) is just a longer one: it carried a `fast` mark so the reducer could
   * re-centre the view on it, until the owner turned "Shift centres" off.
   */
  | Readonly<{ kind: "move-cursor"; dx: number; dy: number }>
  /**
   * `g`: the cursor goes to the player's Nexus, from the menu or the map, and the keyboard goes to the map
   * (the owner: "type 'n' to jump to nexus sounds good"; `n` is the Nexus Pulse, so it is `g`, go). The
   * enemy Nexus, by pressing it again, is for when a map has one.
   */
  | Readonly<{ kind: "go-nexus" }>
  /**
   * A click on a Grid tile. What it does is the reducer's to decide, from what is on screen — so the
   * driver reproduces a click exactly (docs/system-design/input.md):
   *
   * - with a popup open, it closes the popup and moves focus and the cursor there — nothing more;
   * - otherwise it moves focus to the Grid and the cursor to the tile; with a structure armed and the
   *   cursor *already* on that tile, it places (a second click on the same tile, compared by
   *   tile, never by screen position). With nothing armed it only moves the cursor: in Explore Map
   *   the panel follows it; from the menu it arrives in plain navigation, the menu still drawn, so a
   *   mouse player who clicked around the map can still click a building on it.
   */
  | Readonly<{ kind: "click-tile"; x: number; y: number }>
  /**
   * A click on menu entry *n* (an index into `menuEntries`). **A click activates what it lands on**
   * (a first click does not merely highlight): a building row arms at once and hands the mouse to the Grid with the ghost at the
   * cursor, or the nearest spot that takes it; the Nexus Pulse row opens its popup; Explore Map opens the
   * map; Start Battle Round opens its confirmation. All four are the menu's, so finishing them comes back to
   * the menu. Only the keyboard has a "highlighted, not yet chosen" state. Two exceptions, both about
   * what the click could see: with a popup open it only closes the popup (and brings focus to the menu,
   * unless a card covers it); and while a card covers the menu — Explore Map's, or the building being
   * placed — a click on its header or anywhere else on the panel goes back, as Esc does: the row it
   * landed on was not drawn, so it chooses nothing.
   */
  | Readonly<{ kind: "click-menu"; entry: number }>
  /** Arm item *n* of the build menu — its digit, from anywhere. Moves focus to the Grid; the cursor
   *  stays where it is when the building can go there, and otherwise moves to the nearest spot that
   *  can take it. A placement or Esc goes back to whichever half had the keyboard.
   *  **While a building is armed the menu stays on it**: its own
   *  digit cancels it, exactly as Esc does, and another building's digit is refused until it is placed
   *  or cancelled. */
  | Readonly<{ kind: "arm"; index: number }>
  /** Place the armed structure at the cursor — Enter or Space on the Grid while something is armed. */
  | Readonly<{ kind: "place" }>
  /** Enter or Space on the Grid in plain navigation: Explore Map, the side panel showing what is under
   *  the cursor, begun on the map — so Esc comes back to the map. Nothing, when Explore
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
   * it does nothing at all (the owner: "Menu should only open with 'esc', but not
   * with 'x' ... I like to type x-x-x and I'd like that always gets back to the regular state with the
   * focus on the menu"). So `x x x` from anywhere lands on the menu and stays, and a stray right click
   * never opens a menu. Its own command rather than a flag on `cancel`, so a driver says which it means
   * and the reducer has one place where the two differ.
   */
  | Readonly<{ kind: "back" }>
  /** Leave the screen. Only the game menu's `[q]` (or Ctrl+C) sends it; the session decides what
   *  leaving means. */
  | Readonly<{ kind: "quit" }>
  /** `q` anywhere but the game menu: open the game menu — Settings, Controls, Activity logs, Restart and
   *  Quit — rather than quit outright and lose a plan. */
  | Readonly<{ kind: "open-game-menu" }>
  /** Pick Nexus power *n* — a digit or a click while the Nexus Pulse popup is open. */
  | Readonly<{ kind: "pick-nexus"; index: number }>
  /** `s` (or `p`), or the menu's last row, `[s] Start Battle Round` — open the Battle Round confirmation.
   *  Refused while a Nexus power is still waiting to be picked — the one thing that pick refuses — and
   *  while a building is armed. */
  | Readonly<{ kind: "open-battle-round" }>
  /** `[s] Start` — the confirmation's one row, by Enter, Space, `s` or a click: the Battle Round starts.
   *  Going back is the cancel every popup has. */
  | Readonly<{ kind: "start-pulse" }>
  /** Tab: move keyboard focus. To the Grid it arrives in plain navigation; to the menu
   *  it disarms (a building is armed only while the Grid has focus). */
  | Readonly<{ kind: "focus"; target: Focus }>
  /**
   * Up/Down on the menu or inside a popup's list: move its highlight `delta` rows (negative is up),
   * **stopping at either end** — no list comes round (the owner: "should not
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
   *  to say the key arrived, and the keyboard stays on the menu. */
  | Readonly<{ kind: "refuse-row" }>
  /** `n`, or activating the Nexus Pulse row: open its popup. */
  | Readonly<{ kind: "open-nexus-powers" }>
  /** `e`: Explore Map, a toggle — focus to the Grid with nothing armed, the side panel showing what is
   *  under the cursor as it moves; with it open, back one level exactly as Esc.
   *  Opening it puts the cursor on clear ground by the arming rule for one tile; refused while a
   *  building is armed. */
  | Readonly<{ kind: "explore" }>
  /**
   * The Settings popup: every setting Settings shows, in sections. `[s]` in the
   * game menu opens it at its first row; `d` opens it at its first Experiment.
   */
  | Readonly<{ kind: "open-settings"; section: "settings" | "experiments" }>
  /**
   * One step of a setting Settings shows, a player setting or an Experiment alike: Left (`-1`) or Right
   * (`+1`) on its row, or a click on the left or right half of its value. Named by field rather than by
   * the popup's highlight, so a driver script can set one without walking the list — and without caring
   * which tier it stands on; with the popup open it also moves the highlight there.
   */
  | Readonly<{ kind: "setting-adjust"; field: ShownName; step: -1 | 1 }>
  /** The same, by its older name, which driver scripts written before the tiers met still send. */
  | Readonly<{ kind: "experiment-adjust"; field: ShownName; step: -1 | 1 }>
  /**
   * A click on a popup's row away from what the row does (a setting's name rather than its value), or
   * on the popup's scroll bar: highlight row `row` of its list, clamped to the list, so what the row is
   * for shows and the list scrolls to it. `row` counts the list as `popupHighlight` does — Settings'
   * rows, the export's lines, the Controls page's key lines.
   */
  | Readonly<{ kind: "select-row"; row: number }>
  /** `r` in the game menu, or its `[r] Restart` row (it lives in the game menu, not Settings): start
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
   * The Controls and hotkeys page (the owner: "an option for 'Controls and
   * hotkeys' that opens a section that explains how to use the keyboard, hotkeys and mouse clicks"):
   * `c` or its row in the game menu, which Esc then goes back to, or `?` from the game, which Esc
   * closes. Opens over nothing but the game menu.
   */
  | Readonly<{ kind: "open-controls" }>
  /**
   * The Activity logs window: `a` or its row in the game menu, which Esc then goes back to. Opening it freezes a copy of the list
   * (`BuildState.activityFrozen`), so what it shows holds still while it is read.
   */
  | Readonly<{ kind: "open-activity-logs" }>
  /**
   * One step of the Activity logs window's filter: Left
   * (`-1`) or Right (`+1`) on its Filter row, or a click on the left or right half of its value. A
   * filter is a choice, so it comes round at both ends, as every choice in Settings does.
   */
  | Readonly<{ kind: "activity-filter"; step: -1 | 1 }>
  /**
   * `e` in the Activity logs window, or its `[e] Export logs` row: export what the filter shows. The
   * reducer counts the export (`BuildState.activityExports`) and says so in a message popup; copying the
   * text out is the session's side effect, as the settings export's is (`BuildSession`'s `onExport`).
   */
  | Readonly<{ kind: "export-activity" }>
  /**
   * A Battle Round playback control — Space, `[`, `]`, `.`, `,` and `r` while a Pulse is on screen, or a
   * click on the panel's control rows: the same vocabulary `grid watch` has, one keymap across
   * both. The reducer has nothing to change for it — the Pulse's clock is the presenter's, never the
   * state's — so it passes through like `quit`, and the session hands it to the Pulse it belongs to.
   */
  | Readonly<{ kind: "pulse"; control: PlaybackControl }>
  /**
   * Centre the view on a tile and put the cursor there. Sent by the Pulse when it starts and when its
   * ending begins ("the camera is centred at the nexus"): a state change like
   * any other move, so what the player does next — scrolling, looking around — starts from where the
   * story left the view, and the view's slide is the presentation's to draw.
   */
  | Readonly<{ kind: "look-at"; x: number; y: number }>
  /** The shell could not start the Pulse the player just committed: the commit is undone, so they can fix
   *  the plan, and the reason is said on the bottom line. */
  | Readonly<{ kind: "pulse-failed"; reason: string }>
  /**
   * Once a round's result stands: the next round's Build Phase, or — the mission over — the mission again
   * from round 1. Enter, Space, `n` or a click on the result's row; or the Pulse itself a moment
   * after the result, when the Next round Experiment says so. Like `pulse`, the reducer never sees it: the
   * session swaps in the next round's context, which the shell works out (`src/cli/pulse-run.ts`).
   */
  | Readonly<{ kind: "next-round" }>
  /**
   * **The dialog**: the next line of the round's scene — Enter, Space, or a click anywhere while the dialog
   * is open — or, after its last line, the dialog closes and the Build Phase is exactly as the round opened
   * it. Esc, `x` and a right click skip the rest instead (`cancel` and `back`, as every popup closes).
   */
  | Readonly<{ kind: "dialog-next" }>

/**
 * How the sides of the Grid rectangle that have reached the map's own edge are drawn — **the map's
 * own style**, named in its definition (`BuildContext.edgeStyle`; the solid bar when it names none).
 * The owner chose this over one style for every map after trying both (the owner:
 * "using map-specific borders looks a lot better... allowing the map to define different styles will
 * be awesome"). Every style keeps the rectangle's rule — the same weight on all four sides and the
 * same meaning in every glyph pack — and is a name, not glyphs: `src/view/edge.ts` draws them.
 *
 * - `solid`: an inverse-video cell — the wall the design chose, and what a map that names none gets;
 * - `half`: a half block on the map's side of the cell (quadrants at the corners);
 * - `heavy`: a heavy box line, joined to the frame's light lines with mixed-weight junctions;
 * - `double`: a double box line;
 * - `shade`: a light shade, a dotted band;
 * - `fence`: a dashed heavy line with posts (the PERIMETER stand-in's, `STARTER_EDGE_STYLE`).
 */
export type MapEdgeStyle = "solid" | "half" | "heavy" | "double" | "shade" | "fence"

/** Every style a map may name, in the order the tests walk them. */
export const MAP_EDGE_STYLES: readonly MapEdgeStyle[] = ["solid", "half", "heavy", "double", "shade", "fence"]

/** Which half of the screen the arrow keys and Enter/Space belong to. The digit hotkeys ignore it. */
export type Focus = "menu" | "grid"

/**
 * One entry of the side panel's menu, in the order Up/Down walk it: Explore Map first, Nexus, the building rows in hotkey order, and Start Battle Round last. The menu highlight is an index into this list (`menuEntries` in `state.ts`), so every
 * building row keeps its digit.
 */
export type MenuEntry =
  | Readonly<{ kind: "nexus" }>
  | Readonly<{ kind: "explore" }>
  | Readonly<{ kind: "construct"; index: number }>
  | Readonly<{ kind: "start" }>

/** The popups this screen has — one popup shape for all of them (`src/build/popup.ts`): the Nexus
 *  powers, the Battle Round confirmation, the game menu (Settings, Controls, Activity logs, Restart,
 *  Quit), Settings, the export, a message — `BuildState.message`, a title and text with nothing to
 *  choose — the Controls and hotkeys page, the Activity logs window, and **the dialog**: a round's scene,
 *  a line at a time, docked at the bottom of the map — the one popup the player does not open
 *  (`BuildState.dialog`). */
export type Popup =
  | "nexus-powers"
  | "battle-round"
  | "game-menu"
  | "settings"
  | "export"
  | "message"
  | "controls"
  | "activity-logs"
  | "dialog"

/**
 * Where a line of dialog looks, on this round's map: the tile the camera centres on, and the focus's own
 * tiles — a unit's one, each of a group's units', a region's — which the intro highlight lights around
 * (`src/view/build-dialog.ts`). Worked out by the shell when the round opens (`src/cli/pulse-run.ts`).
 */
export type DialogFocus = Readonly<{ tile: Coord; own: readonly Coord[] }>

/**
 * One line of a round's scene as the dialog shows it (`BuildContext.scene`): who says it — their name, or
 * `null` for the game's own voice, which has none — the side they speak for (their name's colour, `null`
 * for none), the unit they are when they stand on this round's map (their glyph beside their name), the
 * words, and where the camera looks while it is shown. Plain data: the mission's `say`, resolved on the
 * round's own map.
 */
export type DialogLine = Readonly<{
  speaker: string | null
  side: "A" | "B" | null
  unit: string | null
  text: string
  focus: DialogFocus | null
}>

/**
 * Which export a text is, so the shell that copies it out knows where it goes: the settings and
 * Experiments, or the Activity Logs. The terminal writes each to its own file beside the settings; the
 * browser page puts each in its own text box under the screen.
 */
export type ExportKind = "settings" | "activity"

/**
 * A message popup's words (the owner: "This popup does not have an action, it's
 * just a warning message ... clicking outside or pressing esc should close it"). Any warning the screen
 * needs to give once, and out of the way of the bottom line, is one of these.
 */
export type PopupMessage = Readonly<{ title: string; text: string }>

/**
 * What the last command wants acknowledged on screen — a brief "pressed" flash on the row it
 * activated, or a flicker on the row that had nothing to do. The reducer records
 * it with a sequence number and no clock; the live loop shows it for a few frames from the moment it
 * first sees a new `seq`, so timing stays in the adapter and the reducer stays pure.
 */
export type Ack = Readonly<{ seq: number; kind: "pressed" | "refused"; entry: number }>

/** A structure the player has planned but not committed. Nothing here ever reaches the kernel: a
 *  plan is a plan on a screen, and committing it is what turns it into one. */
export type PlannedPlacement = Readonly<{
  ordinal: number
  contentId: string
  anchor: Coord
}>

/** Something already standing on the Grid when the screen opens. The starter map has two, so there is
 *  something to build next to and something a placement can illegally overlap. */
export type StandingStructure = Readonly<{
  contentId: string
  anchor: Coord
}>

/**
 * Something on the map the player did not build and does not own a plan for: a unit of
 * either side that survived the last round, or a scripted side's structure. Drawn in its side's colour,
 * read by Explore Map's card; a structure blocks a placement, a unit steps aside for one when the Pulse
 * starts (`src/match/opening.ts`).
 */
export type FieldEntity = Readonly<{
  contentId: string
  anchor: Coord
  player: "A" | "B"
  hp: number
}>

/**
 * A unit the next round's triggers will bring (the owner's "see what is coming"): where it will
 * arrive, when, and the line of intention its group carries. Always drawn, see-through; nothing about it
 * is state — the Pulse decides where it actually lands.
 */
export type IncomingEntity = Readonly<{
  contentId: string
  anchor: Coord
  player: "A" | "B"
  /** The tick of the round it arrives at: 0 is when the round starts. */
  tick: number
  intent: string | null
}>

/**
 * A Commander who fell and sits a round out: whose, which, the round she fell in and the round the Nexus
 * restores her at the start of (the rule is the match layer's, `src/match/commander.ts`). Plain data, so
 * the Build Phase can say she is absent without reaching the rules.
 */
export type CommanderAbsence = Readonly<{
  player: "A" | "B"
  contentId: string
  fellInRound: number
  returnsInRound: number
}>

/**
 * One option of the Nexus Pulse: a Nexus power as the popup offers it, "a name and one plain line of
 * description" (docs/game-design/commander-armies.md), its key, and the card it came from — what it does once
 * kept, which the reducer never reads beyond its credits.
 */
export type NexusPowerOption = Readonly<{
  hotkey: string
  name: string
  description: string
  /** Added to the starting allotment the moment this option is picked: War Chest's credits, 0 for the rest. */
  bonusAllotment: number
  card: PowerCard
}>

/**
 * What a group of the coming raid goes for first: the entity, where it stands as the round starts, and
 * every tile it covers — so the map can mark it and the panel can name it.
 */
export type RaidTarget = Readonly<{
  contentId: string
  player: "A" | "B"
  anchor: Coord
  tiles: readonly Coord[]
}>

/**
 * One group the coming round brings, and its intent as the kernel will act on it (the owner: "reading
 * the enemy intent is very important"): how many and of what, when it arrives, where it stands, what it
 * goes for first and the way it would go — worked out by the shell on the plan as it stands
 * (`src/match/intent.ts`), so placing, undoing or removing a building can change it. Plain data, so the
 * Build Phase draws and says it without reaching the rules.
 */
export type RaidGroup = Readonly<{
  /** The mission's name for the group. */
  group: string
  player: "A" | "B"
  /** Each kind that arrives, in the order the mission lists them, and how many. */
  units: readonly Readonly<{ contentId: string; count: number }>[]
  /** The tick of the round it arrives at: 0 is as the round starts. */
  tick: number
  /** The mission's one line of what it means to do, or `null`. */
  intent: string | null
  /** Every tile its units stand on as they arrive. */
  tiles: readonly Coord[]
  /** The tile of the group nearest its middle. */
  centre: Coord
  /** What most of its units go for first, or `null` when there is nothing to go for. */
  target: RaidTarget | null
  /** The way it would go to the target by the kernel's own steps, a tile a step, ending next to it — or,
   *  when none of its units can get there, pressed on what stops them. */
  path: readonly Coord[]
}>

/** Every group of the raid the coming round brings, in order of arrival — empty when it brings none. */
export type RaidForecast = readonly RaidGroup[]
