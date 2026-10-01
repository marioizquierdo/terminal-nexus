// The Build Phase's pure reducer: a command in, the next state out. No terminal, no frame, no
// clock — the same separation `src/menu/list.ts` draws for the menu, so every claim about scrolling
// and placement is checkable without a TTY.

import type { LogEntry } from "../log/logger.ts"
import { footprintCentre, footprintExtent, inBounds, tilesOf } from "../grid/coords.ts"
import type { ContentRegistry } from "../content/index.ts"
import { stepListIndex } from "../menu/list-keys.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import { TERRAIN } from "../grid/types.ts"
import type { MatchState } from "../state/types.ts"
import type { StatusMessage } from "../status.ts"
import { NO_STATUS, status } from "../status.ts"
import type { Camera, Margin, Viewport } from "./camera.ts"
import { centreOn, clampToGrid, edgeClickCamera, followCursor, marginForView } from "./camera.ts"
import type { ShownName } from "./all-settings.ts"
import { setting, shownSetting } from "./all-settings.ts"
import type { Experiments } from "./experiments.ts"
import { stepExperiment, defaultExperiments } from "./experiments.ts"
import { TUNING } from "./tuning.ts"
import type { Settings } from "../settings/types.ts"
import { DEFAULT_SETTINGS } from "../settings/types.ts"
import type { GameMenuRow } from "./settings.ts"
import {
  FIRST_EXPERIMENT_ROW,
  FIRST_PULSE_EXPERIMENT_ROW,
  FIRST_SETTING_ROW,
  GAME_MENU_ROWS,
  SETTINGS_EXPORT_ROW,
  SETTINGS_ROWS,
  adjustSetting,
  settingRow,
  pendingRestart,
  restartMessage,
} from "./settings.ts"
import { formatSettingsExport } from "./settings-export.ts"
import type { ActivitySource } from "./activity.ts"
import {
  ACTIVITY_EXPORT_ROW,
  ACTIVITY_FILTER_ROW,
  activityExportMessage,
  activityExportStatus,
  activityFilter,
  activityFilterStatus,
  activityRowCount,
  shownEntries,
  stepActivityFilter,
} from "./activity.ts"
// A cycle, and a harmless one: help.ts reads this module's helpers only when a hint is asked for, and
// this module reads help.ts's page length only when a command runs — neither at load time.
import { controlsLineCount } from "./help.ts"
import type {
  Ack,
  BuildCommand,
  ConstructItem,
  FieldEntity,
  Focus,
  IncomingEntity,
  MapEdgeStyle,
  MenuEntry,
  NexusPowerOption,
  Popup,
  PlannedPlacement,
  PopupMessage,
  StandingStructure,
} from "./types.ts"

/** Everything about the screen that never changes while it is open. Split from the state proper so
 *  the reducer's signature says plainly which half a command can move. */
export type BuildContext = Readonly<{
  grid: GridTerrain
  registry: ContentRegistry
  catalog: readonly ConstructItem[]
  standing: readonly StandingStructure[]
  /** The Build Phase's starting allotment. Build Phase only *spends* it; Milestone 7's worker
   *  economy is what eventually earns it (milestone-05-build-phase.md Section 4). */
  allotment: number
  /**
   * How close to a viewport edge the cursor gets before the camera follows. Three tiles was the
   * canon's number, and `project-governance.md` Section 7 says in as many words that it is "locked
   * direction" whose tuning "Milestone 5 may retune on evidence from the first person who actually
   * scrolls a Grid". So the spike takes it as a parameter and puts it on the command line
   * (`--scroll-margin`) — a number Mario can feel the difference between beats a number this session
   * argues for. **Since gate 5H it is a percentage of the view** — of its width for the sides and its
   * height for the top and bottom — rather than a number of tiles. It was an Experiment from gate 5G
   * until the owner settled it (2026-09-30); absent, the reducer reads the tuned value
   * (`TUNING.scrollMargin`, `src/build/tuning.ts`).
   */
  scrollMargin?: number
  /** The Nexus draft this Build Phase offers — placeholder options, not Milestone 8's real one
   *  (`types.ts`'s own doc comment on `NexusPowerOption` has the reasoning). */
  nexusDraft: readonly NexusPowerOption[]
  /**
   * The map's own border style — the "map-defined border" of feedback F25 ("defining custom borders
   * could accentuate the location"), drawn wherever the Grid rectangle reaches the map's edge; the
   * owner's choice over one style for every map (2026-09-29). Presentation only, and a name rather
   * than glyphs: the view owns what each style looks like (`src/view/edge.ts`). Absent: the solid bar.
   */
  edgeStyle?: MapEdgeStyle
  /** The player's settings the screen opens with — saved ones, or a command line's. The Settings
   *  popup changes them in `BuildState.settings`; saving is the live loop's (`src/cli/spike.ts`). */
  settings?: Settings
  /** Experiments to open with instead of this build's defaults — an imported export
   *  (`settings-export.ts`), so an agent can start from exactly what the owner had. */
  experiments?: Partial<Experiments>
  /** The commit this build is, when the adapter knows it: the first line of an export names it. */
  buildId?: string
  /**
   * Which round of a mission this Build Phase plans, and how many the mission has (gate 6B): the Battle
   * Round screen's number and the top bar's "round 2 of 3". Absent: round 1 of a Build Phase with no
   * mission — every context the tests build by hand.
   */
  round?: Readonly<{ number: number; of: number }>
  /**
   * The resolved state the last round left, after Recall — what the next Pulse starts from, handed back
   * to the shell untouched (the reducer never reads it). `null` or absent for a first round.
   */
  carried?: MatchState | null
  /** What else is on the map: survivors of both sides, and a scripted side's structures (gate 6B). */
  field?: readonly FieldEntity[]
  /** What the next round's triggers will bring, and where (gate 6B; drawn while the Incoming wave
   *  Experiment shows it). */
  incoming?: readonly IncomingEntity[]
  /** The bottom line's first answer when this Build Phase opens — how the last round ended. */
  openingStatus?: StatusMessage
  /**
   * What the Battle Round confirmation announces for round *n*, keyed by its number (owner, 2026-09-29,
   * feedback F49: "campaign missions may inject pulse-n text here"). A round with no entry says
   * `DEFAULT_ROUND_TEXT` (`popup.ts`). Nothing supplies one yet; a mission's own data will.
   */
  roundText?: Readonly<Record<number, string>>
  /** Where the adapter puts an export besides the screen, said in the export popup — "Copied to the
   *  clipboard and saved to ...". Absent: the popup says nothing about a copy. */
  exportDestination?: string
  /**
   * The log the Activity logs window shows (owner, 2026-10-01, feedback F91) — read-only, and read by
   * the reducer for that window alone: the newest sequence number when it opens, and how many rows it
   * lists (`src/build/activity.ts`). The source never changes while the screen is open; what it holds
   * grows, which is why the window freezes its list when it opens. Absent: the window lists nothing.
   */
  activity?: ActivitySource
  /** Where the adapter puts an Activity logs export, said in the message that confirms it — "Copied to
   *  the clipboard and saved to ...". Absent: the message says nothing was copied. */
  activityExportDestination?: string
}>

/** A popup under the open one, and the row of it to come back to (`BuildState.popupUnder`). */
export type PopupLevel = Readonly<{ popup: Popup; highlight: number }>

export type BuildState = Readonly<{
  cursor: Coord
  camera: Camera
  viewport: Viewport
  /**
   * Index into `catalog`, or `null` for nothing armed. **A structure is armed only while the Grid has
   * focus** (owner, 2026-09-27): every way focus leaves the Grid — Tab, Esc, a placement from the
   * menu — disarms, so the screen is always in one of a few plain modes: the menu (no cursor), placing
   * (a row marked active, the cursor carrying its ghost), Explore Map (the bare cursor, and the side
   * panel showing what is under it — `exploring`), or plain navigation (the bare cursor, the menu
   * still drawn beside it).
   */
  armed: number | null
  /**
   * Where the Grid's current activity — placing, or Explore Map — was started from, and so where
   * finishing it goes back to (owner, 2026-09-29, feedback F30): `grid` when it began on the map (a
   * digit pressed there, Enter/Space or `e` in plain navigation) — a placement and Esc then leave the
   * keyboard on the map in plain navigation; `menu` when it began on the menu (Enter/Space or a click
   * on its row, a digit while the menu had the keyboard) — they go back to the menu. Meaningless while
   * nothing is under way.
   */
  returnTo: Focus
  /**
   * Arming found no spot for the building within reach of the cursor (`TUNING.armSearchTiles`), so the
   * cursor stepped one tile right and one down and the preview is drawn as the building itself rather
   * than the refusal's block of `x` (owner, 2026-09-29, feedback F30) — until the player moves the
   * cursor or tries to place, after which the refusal is drawn as usual. Pure: set by arming, cleared
   * by the next move, click or placement.
   */
  noSpotFound: boolean
  /** Which half of the screen the arrow keys and Enter/Space belong to (engine.md 9.7, gate 5F).
   *  Reducer state, not adapter state, so a driver can assert it and the bottom line's hint can say it. */
  focus: Focus
  /**
   * **Explore Map** (feedback F23, owner 2026-09-28; its look since F32, F53 and F61): the panel is a
   * card for what is under the cursor, following it as it moves, headed by the Explore Map row in the
   * active style, `[e] Explore Map  >`, over a separator. Reached only by `e`, the menu's first entry,
   * and Enter/Space in plain navigation; `e` again, Esc, `x` or a click on the panel go back to where
   * it was opened from (`returnTo`). Only ever true while the Grid has focus and nothing is armed (read
   * it through `mapMode` or `exploring`).
   *
   * **Tab and a click on the map do not open it** (feedback F30): they arrive in plain navigation,
   * with the menu still drawn beside the map, so a player who clicks around the map with the mouse can
   * still click a building on the menu and have it armed at once (feedback F22).
   */
  exploreMap: boolean
  /** The last thing a command asked to have acknowledged on screen — see `Ack`. */
  ack: Ack | null
  /**
   * The last placement that was tried and refused, with a sequence number and no clock, the way `ack`
   * is: the live loop flashes the cursor there for a moment from when it first sees a new `seq`
   * (gate 5H; for `TUNING.refusedCursorMs`). Counts up across a restart.
   */
  refusedTry: Readonly<{ seq: number; tile: Coord }> | null
  /**
   * The last time a menu row handed the keyboard to the map — a building armed, or Explore Map opened,
   * from the menu (owner, 2026-09-30, feedback F54) — with a sequence number and no clock, the way
   * `ack` is: the live loop flies the **focus arrow** from that row to the cursor and then blinks the
   * cursor, from when it first sees a new `seq`. Not bumped by Tab, a click on the map, a digit or `e`
   * while the map already has the keyboard, or anything on the way back. Counts up across a restart.
   */
  handoff: Readonly<{ seq: number; entry: number }> | null
  /** Index into `menuEntries(context)` — the side panel's highlighted entry. Drawn only while the
   *  menu has focus; kept while it does not, so Tab returns to the same row. */
  menuHighlight: number
  /**
   * The menu highlight is not drawn: the last thing that worked the menu was the mouse (feedback F22,
   * owner 2026-09-28 — "the selected state only makes sense when using the keyboard, but using the
   * mouse should activate what is being clicked"). A click activates rather than selects, so after
   * one the menu shows no "highlighted, not yet chosen" bar. The first menu key after it (Up, Down,
   * Left, Right, Enter, Space) only shows the bar again, on the row it remembers, and does nothing
   * else — a key that acted on a row the player could not see would be a surprise.
   */
  highlightHidden: boolean
  /** The popup drawn over the Grid and holding the keyboard and mouse, or `null`: the Nexus powers,
   *  the Battle Round confirmation (`s` — "the one action that must not fire by accident", engine.md
   *  9.7), the game menu, Settings, the export, or a message. Never opened by anything but the player —
   *  a message only as the answer to something the player did (closing Settings with a change that
   *  needs a restart). */
  popup: Popup | null
  /** The open popup's highlight, an index into its list (`popupRowCount`), set whenever one opens: the
   *  Nexus popup's pending powers, the game menu's rows, Settings' rows (`SETTINGS_ROWS`), the export's
   *  lines, the Controls page's key lines, the Activity logs window's filter, export and entries. */
  popupHighlight: number
  /** The popups under the open one, nearest last, each with the row to come back to — the row that
   *  opened the popup above it: what Esc goes back to, one at a time (the game menu under Settings or
   *  Controls opened from it, Settings under the export, the game menu's Restart under the message that
   *  a restart is needed). Empty: Esc closes the popup. `pushPopup`, `popPopup`, `closePopups`. */
  popupUnder: readonly PopupLevel[]
  /** What the message popup says while `popup` is `"message"`, and `null` otherwise (feedback F34):
   *  a title and text, nothing to choose. */
  message: PopupMessage | null
  planned: readonly PlannedPlacement[]
  /** The last command's answer, which the bottom line shows: what just happened, or why it did not.
   *  It lapses at the next command that says nothing (`lapseStatus`); a refused placement names its
   *  tile (`status.tile`). */
  status: StatusMessage
  nextOrdinal: number
  /** Index into `context.nexusDraft`, or `null` before a pick. A Nexus power, once dealt, may not be
   *  skipped (`commander-armies.md` Section 4.5), so the **commit** is refused until this stops being
   *  `null` — and, since gate 5F, only the commit: everything else proceeds, so an optional popup
   *  does not nag like a forced one (engine.md 9.7). */
  nexusPick: number | null
  /** Added to `context.allotment` by whichever option `nexusPick` names. Kept separately rather than
   *  folded into a mutated allotment, for the same reason `spent` is summed rather than tracked: one
   *  stored total is one number that can drift from what actually produced it. */
  bonusAllotment: number
  /** The Build Phase is done: the plan is frozen and every state-changing command is refused from here
   *  on. With a Pulse to start (`BuildSession`'s `startPulse`) the Nexus Pulse plays from this moment. */
  committed: boolean
  /** Which Pulse of the mission this Build Phase is planning — "Battle Round 1" — from the context's
   *  round (gate 6B's loop counts it up), 1 without one. */
  pulseNumber: number
  /**
   * the Experiments (gate 5G; every setting on the experiment tier, `src/build/all-settings.ts`). State
   * rather than context because they change while the screen is open; the input path reads keyboard
   * navigation's, the view the popup pulse, and a commit the placeholder Pulse's raid and crew — each
   * through `setting(state, name)` where it may move between tiers. Survive a restart; not saved
   * anywhere else.
   */
  experiments: Experiments
  /**
   * The player's own settings — background, colour depth, symbols, reduced motion — as the Settings
   * popup last left them. The reducer only records them; the live loop draws with them and saves them
   * whenever they change (owner, 2026-09-28: settings players may adjust, beside the experiments).
   */
  settings: Settings
  /** Where the cursor started — where a restart puts it back. */
  startCursor: Coord
  /** The flags this Build Phase started with: an experiment that applies only after a restart is
   *  pending while its value differs from its value here (`pendingRestart`). */
  startExperiments: Experiments
  /** The names of the pending restart settings the message popup last announced, so closing Settings
   *  again without changing them does not say it again — the player may keep playing and restart
   *  later (feedback F34). Empty after a restart. */
  restartWarned: readonly string[]
  /** The Activity logs window's filter, an index into `ACTIVITY_FILTERS` (feedback F91). Kept while the
   *  window is closed, and across a restart, so a playtester who picked one finds it again; 0 — the
   *  filter an agent put first for the pull request that asks — until then. */
  activityFilter: number
  /**
   * What the Activity logs window lists: a copy of the log's entries taken when the window opened
   * (`BuildContext.activity`). A copy, not a cut-off: the log keeps a bounded memory, so once it is full
   * every key pressed in the window would drop its oldest entry from under the list. Everything logged
   * after the copy waits until the window opens again, so the list holds still while it is read. The
   * entries are shared, never cloned, so carrying them costs one array.
   */
  activityFrozen: readonly LogEntry[]
  /** How many times the Activity logs have been exported, counting up across a restart: the session
   *  hands the text to the shell each time it goes up — a side effect the reducer only records, the way
   *  `ack` records a flash. */
  activityExports: number
}>

/**
 * The tile the cursor opens on when nothing has been pointed at yet: the player's Grid Nexus — its
 * centre tile, the way the cursor points at every structure (owner, 2026-09-29, feedback F30: "or on
 * top of the nexus by default"). Found by the Nexus flag on its content definition, never by an id;
 * `null` for a map with no Nexus standing on it.
 */
export function nexusTile(context: Pick<BuildContext, "registry" | "standing">): Coord | null {
  const nexus = context.standing.find((structure) => context.registry.get(structure.contentId).nexus === true)
  if (nexus === undefined) return null
  const centre = footprintCentre(context.registry.get(nexus.contentId).footprint)
  return { x: nexus.anchor.x + centre.x, y: nexus.anchor.y + centre.y }
}

/**
 * What the plan has cost so far, summed from the plan itself rather than tracked beside it. Two
 * numbers that have to agree are one number too many: a stored total drifts the first time a code
 * path removes a placement and forgets to refund, and that is exactly the bug a Build Phase would
 * hide until someone counted.
 */
export function spent(context: BuildContext, state: BuildState): number {
  return state.planned.reduce((total, placement) => total + costOf(context, placement.contentId), 0)
}

/** What is left to spend. Never negative, because nothing can be placed that costs more than this. */
export function remaining(context: BuildContext, state: BuildState): number {
  return context.allotment + state.bonusAllotment - spent(context, state)
}

/** The scroll margin in force, in tiles along each axis: a percentage of the view (gate 5H) — the
 *  context's (`--scroll-margin`), or the owner's tuned one. */
function marginOf(context: BuildContext, viewport: Viewport): Margin {
  return marginForView(context.scrollMargin ?? TUNING.scrollMargin, viewport)
}

/**
 * A fresh Build Phase. `experiments` carries a restart's over; otherwise they are this build's
 * defaults, under whatever the context imports (`defaultExperiments`, `BuildContext.experiments`).
 */
export function createBuildState(
  context: BuildContext,
  cursor: Coord,
  viewport: Viewport,
  experiments: Experiments = { ...defaultExperiments(), ...context.experiments },
  settings: Settings = context.settings ?? DEFAULT_SETTINGS,
): BuildState {
  const start = clampToGrid(cursor, context.grid)
  return {
    cursor: start,
    camera: followCursor({ x: 0, y: 0 }, start, viewport, context.grid, marginOf(context, viewport)),
    viewport,
    armed: null,
    returnTo: "menu",
    noSpotFound: false,
    exploreMap: false,
    ack: null,
    refusedTry: null,
    handoff: null,
    // The menu, on its first entry, Explore Map (owner, 2026-09-29, feedback F31: "When the build mode
    // is launched, the focus should be on the Menu, at the Explore Map option").
    focus: "menu",
    menuHighlight: EXPLORE_ENTRY,
    highlightHidden: false,
    popup: null,
    popupHighlight: 0,
    popupUnder: [],
    message: null,
    planned: [],
    status: context.openingStatus ?? NO_STATUS,
    nextOrdinal: 1,
    nexusPick: null,
    bonusAllotment: 0,
    committed: false,
    pulseNumber: context.round?.number ?? 1,
    experiments,
    settings,
    startCursor: cursor,
    startExperiments: experiments,
    restartWarned: [],
    activityFilter: 0,
    activityFrozen: [],
    activityExports: 0,
  }
}

/**
 * Why a command that edits the plan (arm, place, remove, undo) is refused right now, or `null` when
 * none of these apply. Checked in priority order — most-final first, exactly the way `legalityAt`
 * checks affordability before a tile: a player told to answer the confirmation when the real reason
 * is "already committed" would be sent to fix the wrong thing.
 *
 * **A Nexus power still waiting to be picked is not one of these** (gate 5F). Gate 5D refused every
 * edit until the pick was made, which was right for a forced full-screen draft; for a popup the
 * player opens when they choose, it would make every other action nag just as hard. The invariant
 * only has to hold where the Build Phase ends, so that is the only place it is checked —
 * `commitLock`, below. Split rather than loosened, so `armedPreview` still draws no ghost behind an
 * popup or the commit question.
 */
function editLock(state: BuildState): StatusMessage | null {
  if (state.committed) return status("The Build Phase is committed.", "warning")
  if (state.popup === "battle-round") return status("Start or go back first: [s] start, [esc] back.", "warning")
  if (state.popup !== null) return status("Close the popup first: [esc].", "warning")
  return null
}

/** Why the commit is refused right now: everything `editLock` says, and — the one place it is
 *  enforced — a dealt Nexus power that has not been picked (`commander-armies.md` Section 4.5). */
function commitLock(state: BuildState): StatusMessage | null {
  const edit = editLock(state)
  if (edit !== null) return edit
  if (state.nexusPick === null) return status("Pick a Nexus power first: [n] Nexus.", "warning")
  return null
}

/**
 * The side panel's menu, in the order Up/Down walk it — Explore Map first (owner, 2026-09-28, feedback
 * F23), then the Nexus Powers entry, every construct row, and Start Pulse last (owner, 2026-09-29,
 * feedback F47). Derived from the catalog rather than stored, so the highlight and the rows drawn can
 * never disagree about how many there are.
 */
export function menuEntries(context: BuildContext): readonly MenuEntry[] {
  return [
    { kind: "explore" },
    { kind: "nexus" },
    ...context.catalog.map((_, index) => ({ kind: "construct" as const, index })),
    { kind: "start" },
  ]
}

/** Where the two entries above the construct rows sit in `menuEntries`. */
export const EXPLORE_ENTRY = 0
export const NEXUS_ENTRY = 1

/**
 * **Where the keyboard is** — the menu, or the map in one of its three modes (docs/ui-patterns.md, "The
 * screen and the keyboard"): **placing** a building (its ghost at the cursor, its card in the panel),
 * **Explore Map** (the panel describes what is under the cursor), or **plain navigation** (the bare
 * cursor, the menu beside it). Derived from the stored fields — `focus`, `armed`, `exploreMap` — in
 * this one place, so every reader agrees. A committed plan's map is only looked at: plain navigation.
 */
export type MapMode = "menu" | "placing" | "explore" | "plain"

export function mapMode(state: Pick<BuildState, "focus" | "committed" | "armed" | "exploreMap">): MapMode {
  if (state.focus === "menu") return "menu"
  if (state.committed) return "plain"
  if (state.armed !== null) return "placing"
  return state.exploreMap ? "explore" : "plain"
}

/** Whether the screen is in **Explore Map**: the side panel shows what is under the cursor in place
 *  of the menu. */
export function exploring(state: BuildState): boolean {
  return mapMode(state) === "explore"
}

/**
 * Whether the side panel is a **card** rather than the menu (owner, 2026-09-30, feedback F58): Explore
 * Map's, for what is under the cursor, or — while a building is being placed — that building's own,
 * "to allow players to read more details about the thing that is going to be placed". Either way the
 * row that opened it heads the card, drawn active, and a click anywhere on the panel goes back, as Esc
 * does.
 */
export function cardShowing(state: BuildState): boolean {
  return cardEntry(state) !== null
}

/** The menu entry the showing card belongs to — the building being placed, or Explore Map — or `null`
 *  while the panel shows the menu. The card's header is that row, drawn active. */
export function cardEntry(state: BuildState): number | null {
  const mode = mapMode(state)
  if (mode === "placing" && state.armed !== null) return entryOfConstruct(state.armed)
  return mode === "explore" ? EXPLORE_ENTRY : null
}

/** How many entries sit above the construct rows. */
const ENTRIES_BEFORE_CONSTRUCT = 2

/** The menu entry a construct row is — so arming by digit moves the highlight onto its row, and focus
 *  back on the menu lands where the player's attention already is. */
export function entryOfConstruct(index: number): number {
  return index + ENTRIES_BEFORE_CONSTRUCT
}

/** The menu's last entry, Start Pulse: the one after the last construct row of a catalog this long. */
export function startEntry(catalogSize: number): number {
  return entryOfConstruct(catalogSize)
}

/** The Nexus powers as the popup shows them: those still waiting to be picked (a draft of several,
 *  one to take), and those already active. One deal per Build Phase today; Milestone 8 decides
 *  whether there are ever more. */
export type NexusPowers = Readonly<{
  pending: readonly Readonly<{ index: number; option: NexusPowerOption }>[]
  active: readonly NexusPowerOption[]
}>

export function nexusPowers(context: BuildContext, state: BuildState): NexusPowers {
  if (state.nexusPick === null) {
    return { pending: context.nexusDraft.map((option, index) => ({ index, option })), active: [] }
  }
  const picked = context.nexusDraft[state.nexusPick]
  return { pending: [], active: picked === undefined ? [] : [picked] }
}

/** How many picks are waiting — the "(1)" on the menu entry. A draft is one pick however many
 *  options it deals. */
export function pendingPicks(context: BuildContext, state: BuildState): number {
  return state.nexusPick === null && context.nexusDraft.length > 0 ? 1 : 0
}

/**
 * The cursor points at a structure's **centre tile**, not its anchor — the same convention the
 * scenario format already uses for a placement symbol (`footprintCentre`, `src/grid/coords.ts`).
 * A 3x2 barracks under the cursor therefore straddles the cursor the way it looks like it does,
 * rather than hanging south-east of it.
 */
export function anchorForCursor(cursor: Coord, footprint: readonly Coord[]): Coord {
  const centre = footprintCentre(footprint)
  return { x: cursor.x - centre.x, y: cursor.y - centre.y }
}

function sameTile(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y
}

/**
 * Why a placement is refused, in a form a caller can lay out rather than only print. `reason` is
 * the sentence; `tile` is the one the reason is about, when it is about a tile, so "there is rock
 * here" can point at *which* here — the difference between a screen that says why and one that only
 * says no (milestone-05-build-phase.md gate 5B).
 */
export type Legality =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: string; tile?: Coord }>

export type Refusal = Readonly<{ reason: string; tile?: Coord }>

/**
 * The one sentence a refused placement is reported in — the reducer's own status after a refused
 * Enter, and the bottom line's live reading of the armed preview, word for word. Names the tile when
 * the reason is about one (engine.md 9.2's RULE: the player can fix it rather than guess).
 */
export function refusalText(refusal: Refusal): string {
  return refusal.tile === undefined
    ? `Cannot build here: ${refusal.reason}.`
    : `Cannot build here: ${refusal.reason} at ${refusal.tile.x},${refusal.tile.y}.`
}

/** Every tile a plan already claims, planned and standing alike, keyed `x,y`. Rebuilt per check
 *  rather than cached: a spike's plan is a handful of structures, and a stale cache is a bug that
 *  costs more than the scan ever could. */
function claimedTiles(
  context: BuildContext,
  planned: readonly PlannedPlacement[],
): Map<string, string> {
  const claimed = new Map<string, string>()
  const record = (contentId: string, anchor: Coord): void => {
    const footprint = context.registry.get(contentId).footprint
    for (const tile of tilesOf(anchor, footprint)) claimed.set(`${tile.x},${tile.y}`, contentId)
  }
  for (const structure of context.standing) record(structure.contentId, structure.anchor)
  for (const placement of planned) record(placement.contentId, placement.anchor)
  // A scripted side's structure blocks a placement like the player's own; a unit steps aside for one
  // when the Pulse starts, so it claims nothing here (gate 6B).
  for (const entity of context.field ?? []) {
    if (context.registry.get(entity.contentId).layer === "obstacles") record(entity.contentId, entity.anchor)
  }
  return claimed
}

/** The short, plain name a message uses for a content id — "barracks", not
 *  "structure.citizen.barracks". */
export function shortName(context: BuildContext, contentId: string): string {
  return context.registry.get(contentId).short
}

/** The menu's row for a content id, or `undefined` for content the menu does not sell (the standing
 *  structures). The one catalog lookup by content. */
export function catalogItem(context: Pick<BuildContext, "catalog">, contentId: string): ConstructItem | undefined {
  return context.catalog.find((row) => row.contentId === contentId)
}

/** A structure's name as the menu writes it ("Barracks"), for a sentence that starts with it; the
 *  content's short name for anything the menu does not sell. */
export function displayName(context: BuildContext, contentId: string): string {
  return catalogItem(context, contentId)?.label ?? shortName(context, contentId)
}

/** What a catalog row costs, or 0 for content the catalog does not sell (the standing structures). */
export function costOf(context: BuildContext, contentId: string): number {
  return catalogItem(context, contentId)?.cost ?? 0
}

/**
 * Why a placement is refused, in a sentence a player can act on — and **never a silent correction**.
 * Nothing here moves a structure to a legal tile: a plan the player did not draw is worse than a
 * refusal they can understand.
 *
 * Order matters, and it is cheapest-answer-first only by coincidence; what it really is, is
 * *most-informative*-first. Affordability is checked before the tiles because "you cannot afford
 * this" is true wherever the cursor is, and reporting a rock the player could just move off would
 * send them to fix the wrong thing.
 */
export function legalityAt(
  context: BuildContext,
  planned: readonly PlannedPlacement[],
  contentId: string,
  anchor: Coord,
  remaining?: number,
): Legality {
  const item = catalogItem(context, contentId)
  if (item !== undefined && remaining !== undefined && item.cost > remaining) {
    return { ok: false, reason: `costs ${item.cost}, ${remaining} left` }
  }
  const footprint = context.registry.get(contentId).footprint
  const claimed = claimedTiles(context, planned)
  for (const tile of tilesOf(anchor, footprint)) {
    if (!inBounds(context.grid, tile)) {
      return { ok: false, reason: "it would hang off the Grid" }
    }
    const terrainId = context.grid.tiles[tile.y * context.grid.width + tile.x]
    if (terrainId !== undefined && TERRAIN[terrainId].impassable) {
      return { ok: false, reason: "rock in the way", tile }
    }
    const occupant = claimed.get(`${tile.x},${tile.y}`)
    if (occupant !== undefined) {
      return { ok: false, reason: `the ${shortName(context, occupant)} is here`, tile }
    }
  }
  return { ok: true }
}

/**
 * Where arming puts the cursor (owner, 2026-09-29, feedback F30 — replacing gate 5F's smart cursor,
 * which put it beside the last thing planned): **where the cursor already is**, whenever the building
 * can go there, so a player who found a good spot and pressed the building's key places it there.
 * Otherwise the nearest spot within `TUNING.armSearchTiles` of the cursor along each axis where it can:
 *
 * 1. first among spots that leave **one free tile** between it and every other structure — "leaving
 *    1 space with the previous building if possible" (rock and the map's edge may touch it; only
 *    structures need the gap);
 * 2. then, when no such spot is in reach, among spots that merely fit, touching or not.
 *
 * "Nearest" is the cheapest cursor move, where a tile sideways costs 1 and a tile up or down costs
 * `TUNING.armVerticalCost` — the owner expects the cursor to move "only a few tiles to the right" in
 * most cases; ties go to the more horizontal move, then east before west, then south before north — a
 * total order, so there is exactly one answer, and a pure function of the plan and the cursor, so the
 * reducer owns it and a driver can assert it. **Never chosen from the last building placed**: the
 * typical run — place a Barracks, press its key again — finds the spot nearest the cursor, which is
 * sitting on the new Barracks, so the next one lands a gap to its right.
 *
 * `found: false` when nothing within reach fits: the cursor then steps one tile right and one down,
 * so the player sees something happened, and the preview is drawn as the building rather than the
 * refusal (`BuildState.noSpotFound`).
 *
 * Affordability is not a tile question and is left out: an unaffordable row is refused before it is
 * armed (`armItem`).
 *
 * **Over a footprint, not a building** (owner, 2026-09-30, feedback F66: "Explore Map should use the
 * same smart cursor placement as then placing a building ... it's guaranteed to have high contrast
 * with the background"): arming passes the building's footprint; opening Explore Map from the menu
 * passes one tile (`ONE_TILE`), so its cursor starts on clear ground by exactly the same rule — and,
 * where nothing in reach is clear, stays where it is rather than stepping aside.
 */
export type ArmingSpot = Readonly<{ tile: Coord; found: boolean }>

/** The footprint Explore Map's cursor is placed by, opened from the menu (feedback F66): one tile. */
export const ONE_TILE: readonly Coord[] = [{ x: 0, y: 0 }]

export function armingSpot(
  context: BuildContext,
  planned: readonly PlannedPlacement[],
  footprint: readonly Coord[],
  cursor: Coord,
): ArmingSpot {
  const size = footprintExtent(footprint)
  const offset = footprintCentre(footprint)
  const claimed = claimedTiles(context, planned)
  const { grid } = context

  const anchorOf = (tile: Coord): Coord => ({ x: tile.x - offset.x, y: tile.y - offset.y })
  const fits = (anchor: Coord): boolean => {
    for (const tile of tilesOf(anchor, footprint)) {
      if (!inBounds(grid, tile)) return false
      const terrainId = grid.tiles[tile.y * grid.width + tile.x]
      if (terrainId !== undefined && TERRAIN[terrainId].impassable) return false
      if (claimed.has(`${tile.x},${tile.y}`)) return false
    }
    return true
  }
  // One free tile between structures: nothing claimed on the ring around the footprint's box.
  const spaced = (anchor: Coord): boolean => {
    for (let y = anchor.y - 1; y <= anchor.y + size.height; y += 1) {
      for (let x = anchor.x - 1; x <= anchor.x + size.width; x += 1) {
        if (claimed.has(`${x},${y}`)) return false
      }
    }
    return true
  }

  if (fits(anchorOf(cursor))) return { tile: cursor, found: true }

  // The order candidates are ranked in: cost (sideways tiles plus twice the vertical ones), then the
  // more horizontal move, then east, then south. Written as a comparison of the move (dx, dy) alone,
  // so the answer cannot depend on the order the square is scanned in.
  const cost = (move: Coord): number => Math.abs(move.x) + TUNING.armVerticalCost * Math.abs(move.y)
  const better = (a: Coord, b: Coord): boolean => {
    const da = cost(a)
    const db = cost(b)
    if (da !== db) return da < db
    if (Math.abs(a.y) !== Math.abs(b.y)) return Math.abs(a.y) < Math.abs(b.y)
    if (a.x !== b.x) return a.x > b.x
    return a.y > b.y
  }
  for (const needSpace of [true, false]) {
    let best: Coord | null = null
    const reach = TUNING.armSearchTiles
    for (let dy = -reach; dy <= reach; dy += 1) {
      for (let dx = -reach; dx <= reach; dx += 1) {
        const anchor = anchorOf({ x: cursor.x + dx, y: cursor.y + dy })
        if (!fits(anchor) || (needSpace && !spaced(anchor))) continue
        const move = { x: dx, y: dy }
        if (best === null || better(move, best)) best = move
      }
    }
    if (best !== null) return { tile: { x: cursor.x + best.x, y: cursor.y + best.y }, found: true }
  }
  return { tile: clampToGrid({ x: cursor.x + 1, y: cursor.y + 1 }, grid), found: false }
}

/**
 * What Enter would do right now with the armed structure, derived in one place: `place()` acts on
 * it, and the view draws it — the ghost under the cursor, the bottom line's live refusal. "What you
 * see is what Enter does" is then one function rather than several copies that have to agree (they
 * once disagreed about the budget).
 */
export type ArmedPreview = Readonly<{
  item: ConstructItem
  footprint: readonly Coord[]
  anchor: Coord
  /** Why Enter would be refused here, or `null` when it would place. */
  refusal: Refusal | null
}>

/** `null` when there is nothing to place: nothing armed, or the plan cannot be edited right now (an
 *  open popup, the commit confirmation, a committed Build Phase), where no ghost should be drawn
 *  either. */
export function armedPreview(context: BuildContext, state: BuildState): ArmedPreview | null {
  if (state.armed === null || editLock(state) !== null) return null
  const item = context.catalog[state.armed]
  if (item === undefined) return null
  const footprint = context.registry.get(item.contentId).footprint
  const anchor = anchorForCursor(state.cursor, footprint)
  // The same call, budget and all, whichever side is asking.
  const legality = legalityAt(context, state.planned, item.contentId, anchor, remaining(context, state))
  const refusal: Refusal | null =
    legality.ok
      ? null
      : { reason: legality.reason, ...(legality.tile === undefined ? {} : { tile: legality.tile }) }
  return { item, footprint, anchor, refusal }
}

/** The planned placement covering this tile, if any — what Backspace removes. */
export function plannedAt(
  context: BuildContext,
  planned: readonly PlannedPlacement[],
  tile: Coord,
): PlannedPlacement | null {
  for (let index = planned.length - 1; index >= 0; index -= 1) {
    const placement = planned[index] as PlannedPlacement
    const footprint = context.registry.get(placement.contentId).footprint
    for (const occupied of tilesOf(placement.anchor, footprint)) {
      if (occupied.x === tile.x && occupied.y === tile.y) return placement
    }
  }
  return null
}

/**
 * Moves the cursor and lets it drag the camera — the one place scrolling ever happens. Every move gets
 * the scroll margin's follow rule; `placeCamera`, when given, places the camera first — centred on a
 * tile, or brought to an edge-zone click — and the follow rule holds on top of it, so the margin still
 * holds wherever the camera can scroll.
 */
function withCursor(
  context: BuildContext,
  state: BuildState,
  tile: Coord,
  placeCamera?: (camera: Camera, cursor: Coord) => Camera,
): BuildState {
  const cursor = clampToGrid(tile, context.grid)
  const placed = placeCamera === undefined ? state.camera : placeCamera(state.camera, cursor)
  const camera = followCursor(placed, cursor, state.viewport, context.grid, marginOf(context, state.viewport))
  return { ...state, cursor, camera }
}

/**
 * A click on a Grid tile, as a cursor move: the view comes to the click (feedback F6) — a click inside
 * an edge zone (`TUNING.clickZone` deep) scrolls, further the nearer the edge it lands, and the middle
 * of the view does not scroll. **With a structure armed it scrolls the same way** (owner, 2026-09-28,
 * F22: "keep clicking on the grid with the ghost building placement cursor to keep scrolling, and
 * double click will place"), reversing Q58's option B: a view that slid under the pointer would make a
 * slow second click land on a different tile, so a quick **double click** places where the first click
 * pointed — the input path's call, since only it knows when the clicks came (`BuildSession`). Both were
 * Experiments, beside "centres every click", "margin only" and "armed clicks never scroll", until the
 * owner settled them (2026-09-30).
 */
function withClickedCursor(context: BuildContext, state: BuildState, tile: Coord): BuildState {
  return withCursor(context, state, tile, (camera, cursor) => edgeClickCamera(camera, cursor, state.viewport, context.grid, TUNING.clickZone))
}

/** The next acknowledgement: a new sequence number, so the live loop sees a fresh one even when two
 *  in a row are for the same row. */
function acknowledge(state: BuildState, kind: Ack["kind"], entry: number): Ack {
  return { seq: (state.ack?.seq ?? 0) + 1, kind, entry }
}

/** Gives the keyboard to the menu. A structure is armed only while the Grid has focus, so this
 *  disarms, and Explore Map — a Grid-side view — gives way to the menu with it. */
function toMenu(state: BuildState): BuildState {
  return { ...state, focus: "menu", armed: null, exploreMap: false }
}

/** The first menu key after the mouse worked the menu: show the highlight where it is, and nothing
 *  else (`BuildState.highlightHidden`). */
function revealHighlight(state: BuildState): BuildState {
  return { ...state, highlightHidden: false }
}

/**
 * A key that reached the menu with nothing to do there — Left, Right, Backspace: the highlighted row
 * flickers "refused" to say the key arrived, and the keyboard stays on the menu, however many come
 * (owner, 2026-09-30, feedback F55 - reversing 2026-09-27's "a second Right moves focus to the Grid";
 * Tab and a click on the map still do). After the mouse, it only shows the highlight again.
 */
function refuseOnMenu(state: BuildState): BuildState {
  if (state.highlightHidden) return revealHighlight(state)
  return { ...state, ack: acknowledge(state, "refused", state.menuHighlight) }
}

/** Gives the keyboard to the Grid in **plain navigation**: nothing armed, no Explore Map — the bare
 *  cursor with the menu drawn beside it. Where Tab, a click on the map and finishing something begun
 *  on the map all arrive (owner, 2026-09-29, feedback F30). */
function toMap(state: BuildState): BuildState {
  return { ...state, focus: "grid", armed: null, exploreMap: false }
}

/** Finishing what the Grid was doing — a placement, or Esc while placing or exploring: back to where
 *  it was started from (`BuildState.returnTo`), one level. */
function backToOrigin(state: BuildState): BuildState {
  return state.returnTo === "grid" ? toMap(state) : toMenu(state)
}

/** The next hand-off of the keyboard from menu row `entry` to the map (`BuildState.handoff`), when
 *  what was started began on the menu; otherwise the last one, unchanged. */
function handOff(state: BuildState, from: Focus, entry: number): BuildState["handoff"] {
  if (from !== "menu") return state.handoff
  return { seq: (state.handoff?.seq ?? 0) + 1, entry }
}

/**
 * Arms catalog row `index`: the one path a digit, the menu's own Enter/Space and a click on the row
 * share. Focus moves to the Grid, where the placing happens, and the menu highlight follows the row.
 * `from` is where it was started — the menu (Enter/Space or a click on the row, or a digit while the
 * menu had the keyboard) or the map (a digit there) — and is where a placement or Esc goes back to.
 * The cursor stays where it is when the building can go there, and otherwise moves to the nearest
 * spot that can take it (`armingSpot`, feedback F30). A row that costs more than is left is refused
 * here, with the reason, rather than armed to be refused later.
 *
 * Armed, the bottom line says nothing (feedback F58): the panel is the building's card, which says
 * what it is and what it costs. Only when no spot was in reach does it warn. Armed from the menu, the
 * row hands the keyboard to the map (`BuildState.handoff`, F54).
 *
 * **With a building already armed, the menu stays on it** (feedback F69, F70): its own row's key
 * cancels it, exactly as Esc does, and any other building's is refused (`refuseWhileArmed`).
 */
function armItem(context: BuildContext, state: BuildState, index: number, from: Focus): BuildState {
  const lock = editLock(state)
  if (lock !== null) return { ...state, status: lock }
  const item = context.catalog[index]
  if (item === undefined) return state
  if (state.armed === index) return cancel(state)
  const refused = refuseWhileArmed(context, state)
  if (refused !== null) return refused
  const entry = entryOfConstruct(index)
  const left = remaining(context, state)
  if (item.cost > left) {
    // A disabled row: the key was understood, and nothing happens — the row flickers and the status
    // line says why, affordability first (engine.md 9.2).
    return {
      ...state,
      menuHighlight: entry,
      ack: acknowledge(state, "refused", entry),
      status: status(refusalText({ reason: `costs ${item.cost}, ${left} left` }), "warning"),
    }
  }
  const armed: BuildState = {
    ...state,
    armed: index,
    returnTo: from,
    focus: "grid",
    exploreMap: false,
    menuHighlight: entry,
    ack: acknowledge(state, "pressed", entry),
    handoff: handOff(state, from, entry),
  }
  const spot = armingSpot(context, state.planned, context.registry.get(item.contentId).footprint, state.cursor)
  const moved = withCursor(context, armed, spot.tile)
  if (!spot.found) {
    return {
      ...moved,
      noSpotFound: true,
      status: status(`${item.label} selected - no room within ${TUNING.armSearchTiles} tiles, move to find one.`, "warning"),
    }
  }
  return { ...moved, noSpotFound: false, status: NO_STATUS }
}

/**
 * **While a building is armed, the menu stays on it** (owner, 2026-09-30, feedback F69: "the current
 * building ghost needs to be placed, or canceled, before the menu can select another one"): another
 * building's key, `e` and `s` answer with this — nothing changes, the armed row (the card's header)
 * flickers "refused", and the bottom line says, as a warning, how to go on, naming the keys. `null`
 * when nothing is armed, or a popup or a committed plan already answers the key. The popups that
 * belong to no row choice — the Nexus powers, the game menu, Controls, Settings — still open over the
 * building and give it back when they close.
 */
function refuseWhileArmed(context: BuildContext, state: BuildState): BuildState | null {
  if (state.armed === null || state.popup !== null || state.committed) return null
  const item = context.catalog[state.armed]
  if (item === undefined) return null
  return {
    ...state,
    ack: acknowledge(state, "refused", entryOfConstruct(state.armed)),
    status: status(`Place the ${item.label} or cancel it first: [${item.hotkey}] or [esc].`, "warning"),
  }
}

/** Enter/Space on the highlighted menu row, or a click on a row (from the menu or from plain
 *  navigation — a card covers the menu otherwise): whatever the row is for. It is the menu's doing
 *  either way, so whatever it starts goes back to the menu when it is done. */
function activateEntry(context: BuildContext, state: BuildState, entry: number): BuildState {
  const target = menuEntries(context)[entry]
  if (target === undefined) return state
  const highlighted: BuildState = { ...state, menuHighlight: entry }
  if (target.kind === "construct") return armItem(context, highlighted, target.index, "menu")
  // The keyboard goes to the menu, where a click from the map landed, before the popup takes it — so
  // the pick hands the player back to the menu.
  if (target.kind === "nexus") return openNexus(toMenu(highlighted))
  if (target.kind === "start") return openBattleRound(context, highlighted)
  return openExplore(context, highlighted, "menu")
}

/** `s`, or the Start Pulse entry: open the Battle Round confirmation over the Grid, the menu lit behind
 *  it. Its row flashes "pressed" however it was reached — or, refused (a Nexus power still waiting), a
 *  flicker beside the bottom line's reason. With a building armed, the building comes first
 *  (`refuseWhileArmed`, feedback F69). */
function openBattleRound(context: BuildContext, state: BuildState): BuildState {
  const entry = startEntry(context.catalog.length)
  const refused = refuseWhileArmed(context, state)
  if (refused !== null) return refused
  const lock = commitLock(state)
  if (lock !== null) return { ...state, status: lock, ack: acknowledge(state, "refused", entry) }
  return {
    ...pushPopup(toMenu(state), "battle-round", 0),
    menuHighlight: entry,
    ack: acknowledge(state, "pressed", entry),
    status: status(`Battle Round ${state.pulseNumber}: Enter starts it, Esc goes back.`),
  }
}

/** `n`, or the Nexus entry: open its popup. Its row flashes "pressed", however it was reached — a
 *  hotkey is the row's own activation, the same as Enter on it or a click. **Over a card** — a
 *  building being placed, or Explore Map — the menu is not drawn, so its highlight stays on the row the
 *  card came from: closing the popup gives the building (or Explore Map) back, and going back from
 *  that lands on its row (feedback F69). */
function openNexus(state: BuildState): BuildState {
  const opened = openPopup(state, "nexus-powers")
  if (opened.popup !== "nexus-powers") return opened
  if (cardShowing(state)) return opened
  return { ...opened, menuHighlight: NEXUS_ENTRY, ack: acknowledge(state, "pressed", NEXUS_ENTRY) }
}

/**
 * `e`, the Explore Map entry, or Enter/Space in plain navigation: the Grid with nothing armed, and
 * the side panel showing what is under the cursor (feedback F23). `from` is where Esc, `e` again or
 * a click on its row go back to. The bottom line says nothing: the card and its active header say
 * where the player is (feedback F58). Opened from the menu, the row hands the keyboard to the map
 * (`BuildState.handoff`, F54).
 *
 * **Opened from the menu, the cursor starts on clear ground** (owner, 2026-09-30, feedback F66: "Having
 * the cursor on a clear background when starting the movement is easier to follow"): the arming rule
 * for a one-tile footprint (`armingSpot` with `ONE_TILE`) — where it is when that tile is free,
 * otherwise the nearest free tile with a free tile around it within reach, and where it is when there
 * is none. The camera follows as it does for arming. **Only on that hand-off**, when the keyboard jumps
 * from the menu to the map and the eye has to find the cursor: opened from the map — Enter/Space in
 * plain navigation, or `e` while the map has the keyboard — the cursor stays put, since pointing at a
 * building and pressing Enter is how a player reads it. Refused while a building is armed (F69).
 */
function openExplore(context: BuildContext, state: BuildState, from: Focus): BuildState {
  if (state.popup !== null || state.committed) return state
  const refused = refuseWhileArmed(context, state)
  if (refused !== null) return refused
  const opened: BuildState = {
    ...state,
    focus: "grid",
    armed: null,
    exploreMap: true,
    returnTo: from,
    menuHighlight: EXPLORE_ENTRY,
    ack: acknowledge(state, "pressed", EXPLORE_ENTRY),
    handoff: handOff(state, from, EXPLORE_ENTRY),
    status: NO_STATUS,
  }
  if (from !== "menu") return opened
  const spot = armingSpot(context, state.planned, ONE_TILE, state.cursor)
  return spot.found ? withCursor(context, opened, spot.tile) : opened
}

/** `e`: Explore Map is a toggle — open it from wherever the keyboard is, or, open, go back one level
 *  exactly as Esc does (owner, 2026-09-29, feedback F32: "Pressing [e] again, or [esc], should be
 *  equivalent"). */
function toggleExplore(context: BuildContext, state: BuildState): BuildState {
  if (exploring(state) && state.popup === null) return cancel(state)
  return openExplore(context, state, state.focus)
}

/**
 * Opens `popup` over the open one, on row `highlight`; Esc then comes back to the open one on row
 * `returnTo` — the row that opened the new one (its current highlight unless the opener says). With no
 * popup open it opens alone, and Esc closes it.
 */
function pushPopup(state: BuildState, popup: Popup, highlight: number, returnTo = state.popupHighlight): BuildState {
  const under = state.popup === null ? [] : [...state.popupUnder, { popup: state.popup, highlight: returnTo }]
  return { ...state, popup, popupHighlight: highlight, popupUnder: under }
}

/** Esc in a popup: back to the one under it, on the row that opened this one — or, with none under,
 *  closed. A message's words go with it. */
function popPopup(state: BuildState): BuildState {
  const under = state.popupUnder[state.popupUnder.length - 1]
  if (under === undefined) return closePopups(state)
  return { ...state, popup: under.popup, popupHighlight: under.highlight, popupUnder: state.popupUnder.slice(0, -1), message: null }
}

/** Every popup closed at once — a click outside, a pick, the Pulse starting — and a message's words
 *  with them. */
function closePopups(state: BuildState): BuildState {
  return { ...state, popup: null, popupHighlight: 0, popupUnder: [], message: null }
}

/** A popup that belongs to no other — the Nexus powers, the game menu — opened alone, over whatever
 *  was open. */
function openPopup(state: BuildState, popup: Popup): BuildState {
  // The start-the-Pulse question and a committed Build Phase each own the whole screen; a popup over
  // either would be a second question on top of one. The game menu is the one exception: leaving can
  // always be asked about.
  if (popup !== "game-menu") {
    const lock = state.committed || state.popup === "battle-round" ? editLock(state) : null
    if (lock !== null) return { ...state, status: lock }
  }
  return pushPopup(closePopups(state), popup, 0)
}

function pickNexus(context: BuildContext, state: BuildState, index: number): BuildState {
  // Defensively guarded like every other command: a driver script is free to send one anywhere, and
  // the answer must be the same refusal a player pressing an unavailable key gets. A pick is made in
  // the Nexus popup, or by a driver with no popup open; any other popup holds the keyboard, and a
  // committed plan is past picking.
  if (state.committed || (state.popup !== null && state.popup !== "nexus-powers")) {
    return { ...state, status: editLock(state) ?? state.status }
  }
  if (state.nexusPick !== null) return { ...state, status: status("Already picked.", "warning") }
  const option = context.nexusDraft[index]
  if (option === undefined) return state
  // The popup closes on the pick (owner, 2026-09-27 — answering Q60): open, pick, and the player is
  // back where they were. The confirmation is the bottom line, and the menu's "(1)" going out.
  return {
    ...closePopups(state),
    nexusPick: index,
    bonusAllotment: option.bonusAllotment,
    status: status(`${option.name} picked.`, "success"),
  }
}

function place(context: BuildContext, state: BuildState): BuildState {
  const lock = editLock(state)
  if (lock !== null) return { ...state, status: lock }
  const preview = armedPreview(context, state)
  if (preview === null) {
    return { ...state, status: status("Nothing armed - pick something to build from the menu first.", "warning") }
  }
  if (preview.refusal !== null) {
    // Refused, and nothing moved. Silently sliding a structure to the nearest legal tile is the one
    // failure this check exists to prevent. The message names this tile, and its "danger" tone is how
    // the bottom line tells an attempt apart from merely looking.
    return {
      ...state,
      status: status(refusalText(preview.refusal), "danger", state.cursor),
      refusedTry: { seq: (state.refusedTry?.seq ?? 0) + 1, tile: state.cursor },
    }
  }
  const { item, anchor } = preview
  const placed: BuildState = {
    ...state,
    planned: [...state.planned, { ordinal: state.nextOrdinal, contentId: item.contentId, anchor }],
    nextOrdinal: state.nextOrdinal + 1,
  }
  // Back to where the arming came from, disarmed (owner, 2026-09-29, feedback F30, refining Q57's
  // "always the menu"): a building armed on the map leaves the keyboard on the map in plain
  // navigation, the cursor on what was just placed; one armed from the menu goes back to the menu,
  // with the building's row flashing once, "to help bring the eye back to the building selection"
  // (owner, 2026-09-30, feedback F55).
  const back = backToOrigin(placed)
  const entry = entryOfConstruct(state.armed as number)
  return {
    ...back,
    ...(back.focus === "menu" ? { ack: acknowledge(state, "pressed", entry) } : {}),
    status: status(`${item.label} placed (resources: ${remaining(context, placed)}) - [u] undo`, "success"),
  }
}

/** The screen's "back" — Esc (and `x`, a right click, until their last step: `goBack`). One level per
 *  press: a popup goes back to the one it was opened from (Settings to the game menu, the export to
 *  Settings), or closes; placing or Explore Map goes back to where it began; the map to the menu; and
 *  on the menu, the game menu opens. */
function cancel(state: BuildState): BuildState {
  if (state.popup === "battle-round") return { ...closePopups(state), status: status("Cancelled.") }
  if (state.popup !== null) return popPopup(state)
  if (state.committed) return openPopup(state, "game-menu")
  switch (mapMode(state)) {
    // Placing or exploring: back one level, to where it was started from.
    case "placing":
      return { ...backToOrigin(state), status: status("Cancelled.") }
    case "explore":
      return backToOrigin(state)
    case "plain":
      return toMenu(state)
    case "menu":
      return openPopup(state, "game-menu")
  }
}

/**
 * `x` and a right click (owner, 2026-09-30, feedback F62): Esc's walk back one level, every step of it
 * but the last — with nothing open on the menu, or on a committed plan, where Esc would open the game
 * menu, nothing happens at all: no status, no flicker. `x x x` from anywhere lands on the menu with the
 * keyboard there and stays, and a stray right click never opens a menu.
 */
function goBack(state: BuildState): BuildState {
  if (state.popup === null && (state.committed || mapMode(state) === "menu")) return state
  return cancel(state)
}

/**
 * The Settings popup, from the game menu's `[s]` (at the player's settings) or from `d` (at the
 * experiments). Opens over nothing but the game menu, which it then goes back to — and over a
 * committed Build Phase, since starting over from there is exactly what a playtest wants.
 */
function openSettings(state: BuildState, section: "settings" | "experiments"): BuildState {
  // While the Nexus Pulse is on screen, `d` opens the Experiments already at the placeholder Pulse's —
  // the raid and the crew, which someone watching it wants to change (gate 6A) — rather than at the
  // Build Phase's first.
  const experiments = state.committed ? FIRST_PULSE_EXPERIMENT_ROW : FIRST_EXPERIMENT_ROW
  return openFromGameMenu(state, "settings", "settings", section === "settings" ? FIRST_SETTING_ROW : experiments)
}

/**
 * A popup the game menu has a row for — Settings, Controls — opened from the game menu, which Esc then
 * goes back to on that row; or from the game by its shortcut (`d`, `?`), which Esc closes. Over no
 * other popup.
 */
function openFromGameMenu(state: BuildState, popup: Popup, row: GameMenuRow, highlight: number): BuildState {
  if (state.popup !== null && state.popup !== "game-menu") return state
  return pushPopup(state, popup, highlight, GAME_MENU_ROWS.indexOf(row))
}

/**
 * The Controls and hotkeys page (feedback F60): from the game menu's `[c]` row, which Esc then goes back
 * to, on that row; or from the game by `?`, which Esc closes. Over a committed Build Phase too — a Pulse
 * is watched with keys as well. Opens over no popup but the game menu.
 */
function openControls(state: BuildState): BuildState {
  return openFromGameMenu(state, "controls", "controls", 0)
}

/**
 * The Activity logs window (owner, 2026-10-01, feedback F91): from the game menu's `[a]` row, which Esc
 * then goes back to, on that row; over a committed Build Phase too, so a playtester can export what a
 * Pulse logged. It opens on the filter, and **freezes the list** — a copy of the log's entries: what the
 * window shows holds still while it is read, though every key pressed in it is logged as well.
 */
function openActivityLogs(context: BuildContext, state: BuildState): BuildState {
  const opened = openFromGameMenu(state, "activity-logs", "activity", ACTIVITY_FILTER_ROW)
  if (opened.popup !== "activity-logs") return opened
  return { ...opened, activityFrozen: context.activity?.entries() ?? [] }
}

/** One step of the window's filter, said on the bottom line with how many events it shows. With the
 *  window open the highlight goes to the Filter row, as a setting's step goes to its row; a driver may
 *  step it with the window closed. */
function stepActivity(context: BuildContext, state: BuildState, step: -1 | 1): BuildState {
  const next: BuildState = {
    ...state,
    activityFilter: stepActivityFilter(state.activityFilter, step),
    ...(state.popup === "activity-logs" ? { popupHighlight: ACTIVITY_FILTER_ROW } : {}),
  }
  return { ...next, status: status(activityFilterStatus(activityFilter(next), shownEntries(next).length)) }
}

/**
 * The window's export: counted (`activityExports`), so the session hands the text to the shell, and
 * confirmed in a message over the window — how many events, from which filter, and where they went —
 * which Esc closes back to the export row. Only from the window, where the player can see what it holds.
 */
function exportActivity(context: BuildContext, state: BuildState): BuildState {
  if (state.popup !== "activity-logs") return state
  const count = shownEntries(state).length
  return {
    ...showMessage(state, activityExportMessage(count, activityFilter(state), context.activityExportDestination), ACTIVITY_EXPORT_ROW),
    activityExports: state.activityExports + 1,
    status: status(activityExportStatus(count), "success"),
  }
}

/**
 * One step of a setting Settings shows, said on the bottom line — whichever tier it stands on: an
 * Experiment's is said as one ("Experiment - ..."), and a number at the end of its range stays and says
 * so; a player setting is recorded here and nowhere else — the live loop sees the new value, draws with
 * it and saves it.
 */
function adjustShownSetting(state: BuildState, field: ShownName, step: -1 | 1): BuildState {
  const spec = shownSetting(field)
  const highlight = state.popup === "settings" ? { popupHighlight: settingRow(field) } : {}
  if (spec.tier === "player") {
    const settings = adjustSetting(state.settings, field as keyof Settings, step)
    return { ...state, ...highlight, settings, status: status(`${spec.label}: ${spec.format(setting({ ...state, settings }, field))}.`) }
  }
  const { flags, changed } = stepExperiment(state.experiments, field as keyof Experiments, step)
  if (!changed) {
    const end = step > 0 ? "largest" : "smallest"
    return {
      ...state,
      ...highlight,
      status: status(`Experiment - ${spec.label} is already ${spec.format(setting(state, field))}, the ${end} value.`, "warning"),
    }
  }
  const later = spec.applies === "restart" ? " - applies after a restart" : ""
  return {
    ...state,
    ...highlight,
    experiments: flags,
    status: status(`Experiment - ${spec.label}: ${spec.format(setting({ ...state, experiments: flags }, field))}${later}.`),
  }
}

/** Starts the Build Phase over, keeping the settings and the experiments — how an experiment marked
 *  "restart" takes effect. The last acknowledgement is carried over so its sequence keeps counting up
 *  and the live loop never mistakes a new one for one it has already shown. */
function restartBuildPhase(context: BuildContext, state: BuildState): BuildState {
  const fresh = createBuildState(context, state.startCursor, state.viewport, state.experiments, state.settings)
  return {
    ...fresh,
    ack: state.ack,
    refusedTry: state.refusedTry,
    handoff: state.handoff,
    activityFilter: state.activityFilter,
    activityExports: state.activityExports,
    status: status("Build Phase restarted with these settings."),
  }
}

/** The export popup: the settings as text, from Settings (which Esc goes back to) or a driver. */
function exportSettings(state: BuildState): BuildState {
  if (state.popup !== null && state.popup !== "settings") return state
  return {
    ...pushPopup(state, "export", 0, SETTINGS_EXPORT_ROW),
    status: status("Settings exported - paste them into the pull request.", "success"),
  }
}

/** The export's text for this state — what the popup shows and what the session copies. */
export function exportText(context: BuildContext, state: BuildState): string {
  return formatSettingsExport({ settings: state.settings, experiments: state.experiments }, context.buildId)
}

function exportLineCount(context: BuildContext, state: BuildState): number {
  return exportText(context, state).trimEnd().split("\n").length
}

/** How many rows the open popup's list has — what `popupHighlight` indexes, and where Up/Down stop:
 *  the Nexus powers waiting, the game menu's rows, Settings' rows, the export's lines, the Controls
 *  page's key lines, the Activity logs window's filter, export and the entries it froze, the Battle
 *  Round screen's one row, and none in a message. */
function popupRowCount(context: BuildContext, state: BuildState): number {
  switch (state.popup) {
    case "nexus-powers":
      return nexusPowers(context, state).pending.length
    case "game-menu":
      return GAME_MENU_ROWS.length
    case "settings":
      return SETTINGS_ROWS.length
    case "export":
      return exportLineCount(context, state)
    case "controls":
      return controlsLineCount()
    case "activity-logs":
      return activityRowCount(state)
    case "battle-round":
      return 1
    default:
      return 0
  }
}

/** Settings, or the export opened from it, is showing. */
function inSettings(popup: Popup | null): boolean {
  return popup === "settings" || popup === "export"
}

/**
 * The message popup over whatever is open — which Esc then goes back to, on row `returnTo` — or over
 * the game. Any warning the screen needs to give once is one of these (feedback F34).
 */
function showMessage(state: BuildState, message: PopupMessage, returnTo = state.popupHighlight): BuildState {
  return { ...pushPopup(state, "message", 0, returnTo), message }
}

/**
 * Settings has just closed — by Esc back to the game menu, by `q`, by a click outside, whichever way —
 * with a setting changed that only takes effect when the Build Phase starts over: say so, once, in a
 * message popup (feedback F34). **When Settings closes rather than as the value changes**, so a player
 * stepping through a setting's values is not interrupted at every press, and one who puts it back
 * hears nothing; and **once per change**, so closing Settings again later does not repeat it — the
 * player may keep playing and restart when they choose. The bottom line says "applies after a
 * restart" at the change itself.
 */
function warnIfRestartNeeded(before: BuildState, next: BuildState): BuildState {
  if (!inSettings(before.popup) || inSettings(next.popup)) return next
  const pending = pendingRestart(next.startExperiments, next.experiments)
  if (pending.length === 0 || pending.join("\n") === next.restartWarned.join("\n")) return next
  // Over the game menu, going back from it lands on Restart, the row it points at.
  const restartRow = next.popup === "game-menu" ? GAME_MENU_ROWS.indexOf("restart") : next.popupHighlight
  return { ...showMessage(next, restartMessage(pending), restartRow), restartWarned: pending }
}

/**
 * One command, applied. `quit` passes through untouched — leaving the screen is not a Build Phase
 * concern, and the session that owns the disposer decides what it means, exactly as
 * `src/menu/list.ts` already does for the menu.
 */
export function applyBuildCommand(
  context: BuildContext,
  state: BuildState,
  command: BuildCommand,
): BuildState {
  // The arming ghost (feedback F30) lasts until the player moves the cursor or tries to place.
  const moves = command.kind === "move-cursor" || command.kind === "click-tile" || command.kind === "place"
  const base: BuildState = moves && state.noSpotFound ? { ...state, noSpotFound: false } : state
  const applied = applyCommand(context, base, command)
  // Nothing armed, nothing to draw as a ghost.
  const next = applied.armed === null && applied.noSpotFound ? { ...applied, noSpotFound: false } : applied
  return lapseStatus(state, warnIfRestartNeeded(base, next))
}

/**
 * **A status is the answer of the command that set it** (owner, 2026-09-30, feedback F59: the bottom
 * line "offers contextual help"): a command that answers sets a new message, so one that leaves the
 * incoming message in place said nothing, and the old answer lapses — the bottom line then shows the
 * hint for where the keyboard is (`src/build/help.ts`). Compared by identity, which is exactly "did this
 * command set a status". A refusal about a tile lapses with the next move like any answer.
 */
function lapseStatus(before: BuildState, after: BuildState): BuildState {
  return after.status === before.status && after.status.text !== "" ? { ...after, status: NO_STATUS } : after
}

/**
 * A click outside the open popup, wherever it lands: the popup closes (the ones under it with it), and
 * the Battle Round screen says it was cancelled, as Esc there does. What else the click does — only
 * focus, never a placement or a pick — is the caller's (owner, 2026-09-27).
 */
function dismissPopup(state: BuildState): BuildState {
  return { ...closePopups(state), ...(state.popup === "battle-round" ? { status: status("Cancelled.") } : {}) }
}

function applyCommand(context: BuildContext, state: BuildState, command: BuildCommand): BuildState {
  switch (command.kind) {
    case "move-cursor":
      // Every key move, the fast move's jump included, drags the view at the margin: a jump does not
      // re-centre it (the owner's settings export, 2026-09-30, turned "Shift centres" off).
      return withCursor(context, state, { x: state.cursor.x + command.dx, y: state.cursor.y + command.dy })

    case "click-tile": {
      const target = clampToGrid({ x: command.x, y: command.y }, context.grid)
      // A click outside an open popup closes it and brings focus to where it landed — and does
      // nothing else, so a click meant to dismiss never also places or picks (owner, 2026-09-27).
      if (state.popup !== null) {
        const dismissed = dismissPopup(state)
        if (state.popup === "battle-round" || state.committed) return dismissed
        return withClickedCursor(context, { ...dismissed, focus: "grid" }, target)
      }
      // A committed plan locks every edit but not looking: a click on the map moves the cursor there and
      // scrolls the view as it does while exploring (gate 6A — the Pulse's map is a map to look around).
      // Nothing is armed once committed, so no second click can place anything.
      // Two clicks, not one — Q52. A click on a tile that is not already where the cursor sits only
      // moves the cursor there and shows the armed preview; a second click **on that same tile** is
      // what places. Checked against `state.cursor` (tile identity), never the click's screen cell.
      const confirming =
        state.focus === "grid" && state.armed !== null && target.x === state.cursor.x && target.y === state.cursor.y
      // A click on the Grid is attention on the Grid: it takes keyboard focus there too. With nothing
      // armed it only moves the cursor: in Explore Map the panel follows it; from the menu it arrives
      // in plain navigation with the menu still drawn, so the next click can arm a building from it
      // (feedback F22).
      const moved = { ...withClickedCursor(context, state, target), focus: "grid" as const }
      if (!confirming) return moved
      // Placed by the mouse: back where the arming came from — for a building clicked on the menu,
      // the menu with nothing looking chosen (feedback F22, F30: "get back to the menu, focused but
      // unselected").
      const placed = place(context, moved)
      return placed.focus === "menu" ? { ...placed, highlightHidden: true } : placed
    }

    case "click-menu": {
      if (state.committed) return state
      // A click anywhere outside a popup dismisses it first — and only that, plus focus.
      if (state.popup !== null) {
        const dismissed = dismissPopup(state)
        // Over a card the menu is not drawn, so the click chooses nothing (a click can only choose what
        // it could see): it closes the popup and hands the card back — the building still armed, the
        // menu's highlight where it was.
        if (state.popup === "battle-round" || cardShowing(state)) return dismissed
        return { ...toMenu(dismissed), menuHighlight: command.entry, highlightHidden: true }
      }
      // A card — Explore Map's, or the armed building's (feedback F58) — covers the menu below its
      // header row: a click on that row, drawn active, goes back, as Esc (and `e` for Explore Map) does
      // (feedback F32), and so does a click anywhere else on the panel, where the row under the click
      // was not drawn: it chooses nothing, whatever `entry` says. Either way the menu is drawn again.
      if (cardShowing(state)) return { ...cancel(state), highlightHidden: true }
      // Otherwise a click activates what it lands on, whatever had focus (feedback F22): a building
      // arms at once, its ghost at the cursor; Nexus opens its popup; Explore Map opens the map.
      return { ...activateEntry(context, state, command.entry), highlightHidden: true }
    }

    case "arm":
      // A digit is the menu's when the menu has the keyboard, and the map's when the map does: where
      // the placement, or Esc, will go back to.
      return armItem(context, state, command.index, state.focus)

    case "place": {
      // Placed by the keyboard: back on the menu with its highlight showing, for the next key.
      const placed = place(context, state)
      return placed.focus === "menu" ? { ...placed, highlightHidden: false } : placed
    }

    case "open-explore":
      // Enter/Space in plain navigation: Explore Map, begun on the map. Already open, nothing more.
      if (mapMode(state) !== "plain") return state
      return openExplore(context, state, "grid")

    case "remove": {
      const lock = editLock(state)
      if (lock !== null) return { ...state, status: lock }
      // What the menu hides — the map cursor, and what is under it — it cannot remove (feedback F17).
      if (mapMode(state) === "menu") return refuseOnMenu(state)
      const target = plannedAt(context, state.planned, state.cursor)
      if (target === null) return { ...state, status: status("Nothing planned under the cursor.", "warning") }
      return {
        ...state,
        planned: state.planned.filter((placement) => placement.ordinal !== target.ordinal),
        status: status(`${displayName(context, target.contentId)} removed, ${costOf(context, target.contentId)} back.`),
      }
    }

    case "undo": {
      const lock = editLock(state)
      if (lock !== null) return { ...state, status: lock }
      const last = state.planned[state.planned.length - 1]
      if (last === undefined) return { ...state, status: status("Nothing to undo.", "warning") }
      return {
        ...state,
        planned: state.planned.slice(0, -1),
        status: status(`${displayName(context, last.contentId)} undone, ${costOf(context, last.contentId)} back.`),
      }
    }

    case "cancel":
      return cancel(state)

    case "back":
      return goBack(state)

    case "open-game-menu":
      return openPopup(state, "game-menu")

    case "pick-nexus":
      return pickNexus(context, state, command.index)

    case "open-battle-round":
      return openBattleRound(context, state)

    case "start-pulse": {
      // Meaningless outside the one moment it answers — a stray "y" is not a command here any more
      // than a stray "3" is one before anything is armed.
      if (state.popup !== "battle-round") return state
      // The Nexus Pulse starts (gate 6A). The keyboard goes to the Grid, where the arrows look around it
      // — a committed plan locks every edit but not the cursor — and nothing is armed or being explored.
      return {
        ...closePopups(toMap(state)),
        committed: true,
        status: status(`Build committed - ${state.planned.length} planned.`, "success"),
      }
    }

    case "look-at": {
      const tile = clampToGrid({ x: command.x, y: command.y }, context.grid)
      return withCursor(context, state, tile, (_camera, cursor) => centreOn(cursor, state.viewport, context.grid))
    }

    case "pulse-failed":
      return {
        ...closePopups(state),
        committed: false,
        status: status(`The Nexus Pulse could not start: ${command.reason}`, "danger"),
      }

    case "focus":
      if (state.popup !== null || state.committed || state.focus === command.target) return state
      // To the Grid, Tab arrives in plain navigation (feedback F30) — Explore Map is `e`'s.
      return command.target === "menu" ? { ...toMenu(state), highlightHidden: false } : toMap(state)

    case "highlight": {
      // Every list stops at its ends — no list comes round — and the fast move goes all the way to one
      // (owner, 2026-09-30, feedback F75). Up at the top and Down at the bottom do nothing at all, not
      // even a flicker: holding a key down "should quickly move to the bottom and stay there", and a
      // flicker at every auto-repeat would read as something happening. A popup's window follows its
      // highlight (`src/build/popup.ts`).
      const step = (index: number, count: number): number => stepListIndex(index, count, command.delta, command.jump === true)
      if (state.popup !== null) return { ...state, popupHighlight: step(state.popupHighlight, popupRowCount(context, state)) }
      if (state.focus !== "menu") return state
      if (state.highlightHidden) return revealHighlight(state)
      return { ...state, menuHighlight: step(state.menuHighlight, menuEntries(context).length) }
    }

    case "activate": {
      // In a popup, Enter/Space send what the highlighted row names (`src/build/keyboard.ts`); this is
      // what is left when there is no row to press — the Nexus powers once the pick is made.
      if (state.popup === "nexus-powers" && nexusPowers(context, state).pending.length === 0) {
        return { ...state, status: status("No Nexus power waiting.", "warning") }
      }
      if (state.popup !== null || state.focus !== "menu" || state.committed) return state
      if (state.highlightHidden) return revealHighlight(state)
      return activateEntry(context, state, state.menuHighlight)
    }

    case "refuse-row":
      if (state.popup !== null || state.committed || mapMode(state) !== "menu") return state
      return refuseOnMenu(state)

    case "open-nexus-powers":
      return openNexus(state)

    case "explore":
      return toggleExplore(context, state)

    case "open-settings":
      return openSettings(state, command.section)

    // A driver may change a setting with the popup closed; a player reaches these only through it.
    case "experiment-adjust":
    case "setting-adjust":
      return adjustShownSetting(state, command.field, command.step)

    case "select-row":
      if (state.popup === null) return state
      return { ...state, popupHighlight: stepListIndex(command.row, popupRowCount(context, state), 0) }

    case "restart":
      return restartBuildPhase(context, state)

    case "export-settings":
      return exportSettings(state)

    case "open-controls":
      return openControls(state)

    case "open-activity-logs":
      return openActivityLogs(context, state)

    case "activity-filter":
      return stepActivity(context, state, command.step)

    case "export-activity":
      return exportActivity(context, state)

    case "quit":
      return state

    default:
      return state
  }
}

/** The structure covering a tile, standing or planned, or `null` — what Explore Map's card shows. */
export function structureAtTile(
  context: BuildContext,
  planned: readonly PlannedPlacement[],
  tile: Coord,
): Readonly<{ contentId: string; anchor: Coord; planned: boolean }> | null {
  const plannedHere = plannedAt(context, planned, tile)
  if (plannedHere !== null) return { contentId: plannedHere.contentId, anchor: plannedHere.anchor, planned: true }
  for (const structure of context.standing) {
    const footprint = context.registry.get(structure.contentId).footprint
    if (tilesOf(structure.anchor, footprint).some((t) => sameTile(t, tile))) {
      return { contentId: structure.contentId, anchor: structure.anchor, planned: false }
    }
  }
  return null
}

/**
 * A new terminal size: re-fit the viewport and let the camera settle inside it, keeping the cursor
 * where it was. A resize is not a command — nobody pressed anything — so it is its own entry point
 * rather than a member of the vocabulary.
 */
export function withViewport(
  context: BuildContext,
  state: BuildState,
  viewport: Viewport,
): BuildState {
  return {
    ...state,
    viewport,
    camera: followCursor(state.camera, state.cursor, viewport, context.grid, marginOf(context, viewport)),
  }
}
