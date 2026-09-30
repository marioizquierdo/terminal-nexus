// The Build Phase's pure reducer: a command in, the next state out. No terminal, no frame, no
// clock — the same separation `src/menu/list.ts` draws for the menu, so every claim about scrolling
// and placement is checkable without a TTY.

import { footprintCentre, footprintExtent, inBounds, tilesOf } from "../grid/coords.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import { TERRAIN } from "../grid/types.ts"
import type { PulseSetup } from "../match/types.ts"
import type { StatusMessage } from "../status.ts"
import { NO_STATUS, status } from "../status.ts"
import type { Camera, Margin, Viewport } from "./camera.ts"
import { centreOn, clampToGrid, edgeClickCamera, followCursor, marginForView } from "./camera.ts"
import type { DebugField, DebugFlags } from "./debug.ts"
import { FIRST_PULSE_EXPERIMENT_ROW, adjustDebug, fieldSpec, formatDebugValue, initialDebugFlags, rowOfField } from "./debug.ts"
import type { Settings } from "../settings/types.ts"
import { DEFAULT_SETTINGS } from "../settings/types.ts"
import type { PlayerField } from "./settings.ts"
import {
  FIRST_EXPERIMENT_ROW,
  GAME_MENU_ROWS,
  FIRST_SETTING_ROW,
  SETTINGS_EXPORT_ROW,
  adjustSetting,
  formatPlayerValue,
  playerRow,
  playerSpec,
  pendingRestart,
  restartMessage,
  settingsRowAt,
  stepSettingsRow,
} from "./settings.ts"
import { formatSettingsExport } from "./settings-export.ts"
// A cycle, and a harmless one: help.ts reads this module's helpers only when a hint is asked for, and
// this module reads help.ts's page length only when a command runs — neither at load time.
import { controlsLineCount } from "./help.ts"
import type {
  Ack,
  BuildCommand,
  ConstructItem,
  Focus,
  MapEdgeStyle,
  MenuEntry,
  NexusPowerOption,
  Overlay,
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
   * How close to a viewport edge the cursor gets before the camera follows. Three tiles is the
   * canon's number, and `project-governance.md` Section 7 says in as many words that it is "locked
   * direction" whose tuning "Milestone 5 may retune on evidence from the first person who actually
   * scrolls a Grid". So the spike takes it as a parameter and puts it on the command line and in
   * the header — a number Mario can feel the difference between beats a number this session argues
   * for. **Only where the margin starts**: since gate 5G it is an Experiment,
   * `state.debug.scrollMargin`, and that is what the reducer reads. **Since gate 5H it is a
   * percentage of the view** — of its width for the sides and its height for the top and bottom —
   * defaulting to the owner's 25%, rather than a number of tiles.
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
  experiments?: Partial<DebugFlags>
  /** The commit this build is, when the adapter knows it: the first line of an export names it. */
  buildId?: string
  /**
   * What a Nexus Pulse starts with besides the plan, as a function of the Experiments (gate 6A: the
   * "Raid" and "Your units" flags pick which placeholder Pulse). Absent: committing only freezes the
   * plan — every context the tests build by hand.
   */
  pulse?: (experiments: DebugFlags) => PulseSetup
  /**
   * What the Battle Round confirmation announces for round *n*, keyed by its number (owner, 2026-09-29,
   * feedback F49: "campaign missions may inject pulse-n text here"). A round with no entry says
   * `DEFAULT_ROUND_TEXT` (`overlay.ts`). Nothing supplies one yet; a mission's own data will.
   */
  roundText?: Readonly<Record<number, string>>
  /** Where the adapter puts an export besides the screen, said in the export popup — "Copied to the
   *  clipboard and saved to ...". Absent: the popup says nothing about a copy. */
  exportDestination?: string
}>

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
  origin: Focus
  /**
   * Arming found no spot for the building within reach of the cursor (`ARM_SEARCH_TILES`), so the
   * cursor stepped one tile right and one down and the preview is drawn as the building itself rather
   * than the refusal's block of `x` (owner, 2026-09-29, feedback F30) — until the player moves the
   * cursor or tries to place, after which the refusal is drawn as usual. Pure: set by arming, cleared
   * by the next move, click or placement.
   */
  armGhost: boolean
  /** Which half of the screen the arrow keys and Enter/Space belong to (engine.md 9.7, gate 5F).
   *  Reducer state, not adapter state, so a driver can assert it and the key help can say it. */
  focus: Focus
  /**
   * **Explore Map** (feedback F23, owner 2026-09-28; its look since F32): the side panel's first row
   * reads `> [e] Explore Map` in the active style, and under a separator the rest of the panel shows
   * what is under the cursor, following it as it moves. Reached only by `e`, the menu's first entry,
   * and Enter/Space in plain navigation; `e` again, Esc, or a click on its row go back to where it was
   * opened from (`origin`). Only ever true while the Grid has focus and nothing is armed (read it
   * through `exploring`).
   *
   * **Tab, a second Right and a click on the map do not open it** (feedback F30): they arrive in plain
   * navigation, with the menu still drawn beside the map, so a player who clicks around the map with
   * the mouse can still click a building on the menu and have it armed at once (feedback F22).
   */
  exploreMap: boolean
  /** The last thing a command asked to have acknowledged on screen — see `Ack`. */
  ack: Ack | null
  /**
   * The last placement that was tried and refused, with a sequence number and no clock, the way `ack`
   * is: the live loop flashes the cursor there for a moment from when it first sees a new `seq`
   * (gate 5H; how long is the "Refused cursor" Experiment). Counts up across a restart.
   */
  refusedTry: Readonly<{ seq: number; tile: Coord }> | null
  /** The previous command was a Right on the menu that only flickered: a second one in a row moves
   *  focus to the Grid. Cleared by any other command. */
  nudged: boolean
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
  overlay: Overlay | null
  /** The popup's own highlight, reset whenever one opens: an index into the Nexus popup's pending
   *  powers or the game menu's rows, a row id in Settings (`src/build/settings.ts`), and the first
   *  line shown in the export. */
  overlayHighlight: number
  /** The popups under the open one, nearest last — what Esc goes back to, one at a time: the game menu
   *  under Settings opened from it, Settings under the export. Empty: Esc goes back to the game. */
  overlayUnder: readonly Overlay[]
  /** What the message popup says while `overlay` is `"message"`, and `null` otherwise (feedback F34):
   *  a title and text, nothing to choose. */
  message: PopupMessage | null
  planned: readonly PlannedPlacement[]
  /** The one line of feedback the status line shows: what just happened, or why it did not. A
   *  message about a tile (`status.tile`, a refused placement) lapses once the cursor leaves it. */
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
  /** Which Pulse of the mission this Build Phase is planning — "Battle Round 1". It is 1 until the loop
   *  into a next Build Phase exists (Milestone 6's second gate), which is what will count it up. */
  pulseNumber: number
  /**
   * the Experiments (gate 5G, `src/build/debug.ts`). State rather than context because they change
   * while the screen is open; the reducer reads the ones that change what a command does, and the
   * live loop reads the flash timings. Survive a restart; not saved anywhere else.
   */
  debug: DebugFlags
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
  startFlags: DebugFlags
  /** The names of the pending restart settings the message popup last announced, so closing Settings
   *  again without changing them does not say it again — the player may keep playing and restart
   *  later (feedback F34). Empty after a restart. */
  restartWarned: readonly string[]
}>

/** What a tile of vertical cursor movement costs, against one of horizontal, when arming ranks spots:
 *  "in most cases this should move the cursor only a few tiles to the right" (owner, 2026-09-29), so
 *  a run of the same building grows into a row rather than a column. */
export const ARM_VERTICAL_COST = 2

/**
 * How far arming looks for a spot when the building cannot go where the cursor is: up to this many
 * tiles from the cursor along each axis (owner, 2026-09-29, feedback F30: "if there's no empty space
 * in 12 tiles around, it should stay").
 */
export const ARM_SEARCH_TILES = 12

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
  let total = 0
  for (const placement of state.planned) {
    const item = context.catalog.find((row) => row.contentId === placement.contentId)
    total += item?.cost ?? 0
  }
  return total
}

/** What is left to spend. Never negative, because nothing can be placed that costs more than this. */
export function remaining(context: BuildContext, state: BuildState): number {
  return context.allotment + state.bonusAllotment - spent(context, state)
}

/** The mouse wheel's five-tile step. GUIDANCE (engine.md 9.7's bindings table), not RULE. Until gate
 *  5H Shift+Arrow and its modifier-free fallbacks moved this far too; since then they jump Debug
 *  Mode's "Shift jump" (12 since the owner's 2026-09-28 playtest), and the wheel alone keeps five. */
export const JUMP_TILES = 5

/** The scroll margin in force, in tiles along each axis: the Experiment's percentage of the view (gate 5H),
 *  which starts at the context's (`--scroll-margin`) or the owner's 25%. */
function marginOf(state: Readonly<{ debug: DebugFlags; viewport: Viewport }>): Margin {
  return marginForView(state.debug.scrollMargin, state.viewport)
}

/**
 * A fresh Build Phase. `debug` carries a restart's flags over; otherwise they start from
 * the context (`initialDebugFlags`).
 */
export function createBuildState(
  context: BuildContext,
  cursor: Coord,
  viewport: Viewport,
  debug: DebugFlags = { ...initialDebugFlags(context), ...context.experiments },
  settings: Settings = context.settings ?? DEFAULT_SETTINGS,
): BuildState {
  const start = clampToGrid(cursor, context.grid)
  return {
    cursor: start,
    camera: followCursor({ x: 0, y: 0 }, start, viewport, context.grid, marginOf({ debug, viewport })),
    viewport,
    armed: null,
    origin: "menu",
    armGhost: false,
    exploreMap: false,
    ack: null,
    refusedTry: null,
    nudged: false,
    // The menu, on its first entry, Explore Map (owner, 2026-09-29, feedback F31: "When the build mode
    // is launched, the focus should be on the Menu, at the Explore Map option").
    focus: "menu",
    menuHighlight: EXPLORE_ENTRY,
    highlightHidden: false,
    overlay: null,
    overlayHighlight: 0,
    overlayUnder: [],
    message: null,
    planned: [],
    status: NO_STATUS,
    nextOrdinal: 1,
    nexusPick: null,
    bonusAllotment: 0,
    committed: false,
    pulseNumber: 1,
    debug,
    settings,
    startCursor: cursor,
    startFlags: debug,
    restartWarned: [],
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
 * overlay or the commit question.
 */
function editLock(state: BuildState): StatusMessage | null {
  if (state.committed) return status("The Build Phase is committed.", "warning")
  if (state.overlay === "confirm-commit") return status("Start or go back first: [s] start, [esc] back.", "warning")
  if (state.overlay !== null) return status("Close the popup first: [esc].", "warning")
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

/** Whether the screen is in **Explore Map** (`BuildState.exploreMap`): the side panel shows what is
 *  under the cursor in place of the menu. */
export function exploring(state: BuildState): boolean {
  return state.exploreMap && state.focus === "grid" && state.armed === null && !state.committed
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

function wrap(index: number, count: number): number {
  if (count <= 0) return 0
  return ((index % count) + count) % count
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
 * Enter, and the status line's live reading of the armed preview, word for word. Names the tile when
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
  return claimed
}

/** The short, plain name a message uses for a content id — "barracks", not
 *  "structure.citizen.barracks". */
export function shortName(context: BuildContext, contentId: string): string {
  return context.registry.get(contentId).short
}

/** A structure's name as the menu writes it ("Barracks"), for a sentence that starts with it; the
 *  content's short name for anything the menu does not sell. */
function displayName(context: BuildContext, contentId: string): string {
  return context.catalog.find((row) => row.contentId === contentId)?.label ?? shortName(context, contentId)
}

/** What a catalog row costs, or 0 for content the catalog does not sell (the standing structures). */
export function costOf(context: BuildContext, contentId: string): number {
  return context.catalog.find((row) => row.contentId === contentId)?.cost ?? 0
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
  const item = context.catalog.find((row) => row.contentId === contentId)
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
 * Otherwise the nearest spot within `ARM_SEARCH_TILES` of the cursor along each axis where it can:
 *
 * 1. first among spots that leave **one free tile** between it and every other structure — "leaving
 *    1 space with the previous building if possible" (rock and the map's edge may touch it; only
 *    structures need the gap);
 * 2. then, when no such spot is in reach, among spots that merely fit, touching or not.
 *
 * "Nearest" is the cheapest cursor move, where a tile sideways costs 1 and a tile up or down costs
 * `ARM_VERTICAL_COST` (2) — the owner expects the cursor to move "only a few tiles to the right" in
 * most cases; ties go to the more horizontal move, then east before west, then south before north — a
 * total order, so there is exactly one answer, and a pure function of the plan and the cursor, so the
 * reducer owns it and a driver can assert it. **Never chosen from the last building placed**: the
 * typical run — place a Barracks, press its key again — finds the spot nearest the cursor, which is
 * sitting on the new Barracks, so the next one lands a gap to its right.
 *
 * `found: false` when nothing within reach fits: the cursor then steps one tile right and one down,
 * so the player sees something happened, and the preview is drawn as the building rather than the
 * refusal (`BuildState.armGhost`).
 *
 * Affordability is not a tile question and is left out: an unaffordable row is refused before it is
 * armed (`armItem`).
 */
export type ArmingSpot = Readonly<{ tile: Coord; found: boolean }>

export function armingSpot(
  context: BuildContext,
  planned: readonly PlannedPlacement[],
  contentId: string,
  cursor: Coord,
): ArmingSpot {
  const footprint = context.registry.get(contentId).footprint
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
  const cost = (move: Coord): number => Math.abs(move.x) + ARM_VERTICAL_COST * Math.abs(move.y)
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
    for (let dy = -ARM_SEARCH_TILES; dy <= ARM_SEARCH_TILES; dy += 1) {
      for (let dx = -ARM_SEARCH_TILES; dx <= ARM_SEARCH_TILES; dx += 1) {
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
 * it, and the view draws it — the ghost under the cursor, the status line's live refusal, the panel's
 * effect line. "What you see is what Enter does" is then one function rather than several copies
 * that have to agree (they once disagreed about the budget).
 */
export type ArmedPreview = Readonly<{
  item: ConstructItem
  footprint: readonly Coord[]
  anchor: Coord
  /** Why Enter would be refused here, or `null` when it would place. */
  refusal: Refusal | null
}>

/** `null` when there is nothing to place: nothing armed, or the plan cannot be edited right now (an
 *  open overlay, the commit confirmation, a committed Build Phase), where no ghost should be drawn
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
 * How a cursor move treats the camera:
 *
 * - `follow` — the scroll margin's follow rule, what every move did before gate 5H;
 * - `still` — the camera stays put (an armed click, Q58: the confirming click must land where the
 *   first one did);
 * - a function — the camera placed first (recentred, or an edge-zone click), then the follow rule on
 *   top, so the margin still holds wherever the camera can scroll.
 */
type CameraMove = "follow" | "still" | ((camera: Camera, cursor: Coord) => Camera)

/** Moves the cursor and lets it drag the camera — the one place scrolling ever happens. */
function withCursor(context: BuildContext, state: BuildState, tile: Coord, scroll: CameraMove = "follow"): BuildState {
  const cursor = clampToGrid(tile, context.grid)
  const moved = !sameTile(cursor, state.cursor)
  const placed = typeof scroll === "function" ? scroll(state.camera, cursor) : state.camera
  const camera =
    scroll === "still" ? state.camera : followCursor(placed, cursor, state.viewport, context.grid, marginOf(state))
  // A refusal names a tile, and the view already recomputes its own live reading from wherever the
  // cursor now is — so a refusal left behind after the cursor moves away disagrees with what is drawn
  // above it. Every other message is about the last action rather than a tile, and stays until the
  // next one — and so does a tile-scoped one when the cursor did not actually move: pressing further
  // into the Grid's own edge is clamped back to the same tile.
  const lapsed = moved && state.status.tile !== undefined
  return {
    ...state,
    cursor,
    camera,
    status: lapsed ? NO_STATUS : state.status,
  }
}

/**
 * A click on a Grid tile, as a cursor move: the view comes to the click (feedback F6) — nearer an
 * edge scrolls further, or every click centres, or (the gate 5A-5G behaviour) only the margin
 * follows. **With a structure armed it scrolls the same way** (owner, 2026-09-28, F22: "keep clicking
 * on the grid with the ghost building placement cursor to keep scrolling, and double click will
 * place"), reversing Q58's option B: a view that slid under the pointer would make a slow second
 * click land on a different tile, so a quick **double click** places where the first click pointed —
 * the input path's call, since only it knows when the clicks came (`BuildSession`). The Experiment
 * "Armed click scrolls" switches back to a still view.
 */
function clickCameraMove(context: BuildContext, state: BuildState): CameraMove {
  const flags = state.debug
  if (state.armed !== null && !flags.armedClickScrolls) return "still"
  switch (flags.clickScroll) {
    case "centre":
      return (camera, cursor) => centreOn(camera, cursor, state.viewport, context.grid)
    case "edges":
      return (camera, cursor) => edgeClickCamera(camera, cursor, state.viewport, context.grid, flags.clickZone)
    default:
      return "follow"
  }
}

/** A fast move (Shift and its fallbacks) re-centres the view on the cursor along the axis it moved,
 *  when the "Fast move centres" Experiment is on (engine.md 3.3's recentring). */
function moveCameraMove(context: BuildContext, state: BuildState, command: Readonly<{ dx: number; dy: number; fast?: boolean }>): CameraMove {
  if (command.fast !== true || !state.debug.fastRecentres) return "follow"
  return (camera, cursor) =>
    centreOn(camera, cursor, state.viewport, context.grid, { x: command.dx !== 0, y: command.dy !== 0 })
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

/** Gives the keyboard to the Grid in **plain navigation**: nothing armed, no Explore Map — the bare
 *  cursor with the menu drawn beside it. Where Tab, a second Right, a click on the map and finishing
 *  something begun on the map all arrive (owner, 2026-09-29, feedback F30). */
function toMap(state: BuildState): BuildState {
  return { ...state, focus: "grid", armed: null, exploreMap: false }
}

/** Finishing what the Grid was doing — a placement, or Esc while placing or exploring: back to where
 *  it was started from (`BuildState.origin`), one level. */
function backToOrigin(state: BuildState): BuildState {
  return state.origin === "grid" ? toMap(state) : toMenu(state)
}

/**
 * Arms catalog row `index`: the one path a digit, the menu's own Enter/Space and a click on the row
 * share. Focus moves to the Grid, where the placing happens, and the menu highlight follows the row.
 * `from` is where it was started — the menu (Enter/Space or a click on the row, or a digit while the
 * menu had the keyboard) or the map (a digit there) — and is where a placement or Esc goes back to.
 * The cursor stays where it is when the building can go there, and otherwise moves to the nearest
 * spot that can take it (`armingSpot`, feedback F30). A row that costs more than is left is refused
 * here, with the reason, rather than armed to be refused later.
 */
function armItem(context: BuildContext, state: BuildState, index: number, from: Focus): BuildState {
  const lock = editLock(state)
  if (lock !== null) return { ...state, status: lock }
  const item = context.catalog[index]
  if (item === undefined) return state
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
    origin: from,
    focus: "grid",
    exploreMap: false,
    menuHighlight: entry,
    ack: acknowledge(state, "pressed", entry),
  }
  const spot = armingSpot(context, state.planned, item.contentId, state.cursor)
  const moved = withCursor(context, armed, spot.tile)
  if (!spot.found) {
    return {
      ...moved,
      armGhost: true,
      status: status(`${item.label} selected - no room within ${ARM_SEARCH_TILES} tiles, move to find one.`, "warning"),
    }
  }
  return { ...moved, armGhost: false, status: status(`${item.label} selected - ${item.cost} to build.`) }
}

/** Enter/Space (or a click) on menu entry `entry`: whatever it is for. Both are the menu's own, so
 *  whatever they start goes back to the menu when it is done. */
function activateEntry(context: BuildContext, state: BuildState, entry: number, by: "key" | "click"): BuildState {
  const target = menuEntries(context)[entry]
  if (target === undefined) return state
  const highlighted: BuildState = { ...state, menuHighlight: entry }
  if (target.kind === "construct") return armItem(context, highlighted, target.index, "menu")
  // A click on the Nexus entry puts focus where it landed, on the menu, before the popup takes the
  // keyboard — so the pick hands the player back to the menu, not to a building they had armed.
  if (target.kind === "nexus") return openNexus(by === "click" ? toMenu(highlighted) : highlighted)
  if (target.kind === "start") return startPulse(context, highlighted)
  return openExplore(highlighted, "menu")
}

/** `s`, or the Start Pulse entry: open the Battle Round confirmation over the Grid, the menu lit behind
 *  it. Its row flashes "pressed" however it was reached — or, refused (a Nexus power still waiting), a
 *  flicker beside the status line's reason. */
function startPulse(context: BuildContext, state: BuildState): BuildState {
  const entry = startEntry(context.catalog.length)
  const lock = commitLock(state)
  if (lock !== null) return { ...state, status: lock, ack: acknowledge(state, "refused", entry) }
  return {
    ...toMenu(state),
    menuHighlight: entry,
    overlay: "confirm-commit",
    ack: acknowledge(state, "pressed", entry),
    status: status(`Battle Round ${state.pulseNumber}: Enter starts it, Esc goes back.`),
  }
}

/** `n`, or the Nexus entry: open its popup. Its row flashes "pressed", however it was reached — a
 *  hotkey is the row's own activation, the same as Enter on it or a click. */
function openNexus(state: BuildState): BuildState {
  const opened = openOverlay(state, "nexus-powers")
  if (opened.overlay !== "nexus-powers") return opened
  return { ...opened, menuHighlight: NEXUS_ENTRY, ack: acknowledge(state, "pressed", NEXUS_ENTRY) }
}

/** `e`, the Explore Map entry, or Enter/Space in plain navigation: the Grid with nothing armed, and
 *  the side panel showing what is under the cursor (feedback F23). `from` is where Esc, `e` again or
 *  a click on its row go back to. */
function openExplore(state: BuildState, from: Focus): BuildState {
  if (state.overlay !== null || state.committed) return state
  return {
    ...state,
    focus: "grid",
    armed: null,
    exploreMap: true,
    origin: from,
    menuHighlight: EXPLORE_ENTRY,
    ack: acknowledge(state, "pressed", EXPLORE_ENTRY),
    status: EXPLORE_STATUS,
  }
}

/** What the status line says while Explore Map is open — and stops saying when it closes. */
const EXPLORE_STATUS = status("Explore Map - arrows look around, e or esc to go back.")

/** `e`: Explore Map is a toggle — open it from wherever the keyboard is, or, open, go back one level
 *  exactly as Esc does (owner, 2026-09-29, feedback F32: "Pressing [e] again, or [esc], should be
 *  equivalent"). */
function toggleExplore(context: BuildContext, state: BuildState): BuildState {
  if (exploring(state) && state.overlay === null) return cancel(context, state)
  return openExplore(state, state.focus)
}

function openOverlay(state: BuildState, overlay: Overlay): BuildState {
  // The start-the-Pulse question and a committed Build Phase each own the whole screen; a popup over
  // either would be a second question on top of one. The game menu is the one exception: leaving can
  // always be asked about.
  if (overlay !== "menu") {
    const lock = state.committed || state.overlay === "confirm-commit" ? editLock(state) : null
    if (lock !== null) return { ...state, status: lock }
  }
  return { ...state, overlay, overlayHighlight: 0, overlayUnder: [] }
}

function pickNexus(context: BuildContext, state: BuildState, index: number): BuildState {
  // Defensively guarded like every other command: a driver script is free to send one anywhere, and
  // the answer must be the same refusal a player pressing an unavailable key gets. An open Nexus popup
  // is where a pick is normally made, so it is not a reason to refuse one.
  if (state.committed || state.overlay === "confirm-commit" || state.overlay === "menu") {
    return { ...state, status: editLock(state) ?? state.status }
  }
  if (state.nexusPick !== null) return { ...state, status: status("Already picked.", "warning") }
  const option = context.nexusDraft[index]
  if (option === undefined) return state
  // The popup closes on the pick (owner, 2026-09-27 — answering Q60): open, pick, and the player is
  // back on the menu. The confirmation is the status line and the entry's "1 active".
  return {
    ...state,
    nexusPick: index,
    bonusAllotment: option.bonusAllotment,
    overlay: state.overlay === "nexus-powers" ? null : state.overlay,
    overlayHighlight: 0,
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
    // failure this check exists to prevent. The message is about this tile, so it lapses when the
    // cursor leaves it — and its "danger" tone is how the status line tells an attempt apart from
    // merely looking.
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
  // navigation, the cursor on what was just placed; one armed from the menu goes back to the menu.
  return {
    ...backToOrigin(placed),
    status: status(`${item.label} placed (resources: ${remaining(context, placed)}) - [u] undo`, "success"),
  }
}

/** The one "back" of the screen — Esc, `x`, a right click. One level per press: a popup goes back to
 *  the one it was opened from (Settings to the game menu, the export to Settings), or closes. */
function cancel(context: BuildContext, state: BuildState): BuildState {
  if (state.overlay === "confirm-commit") return { ...state, overlay: null, status: status("Cancelled.") }
  const under = state.overlayUnder[state.overlayUnder.length - 1]
  if (state.overlay !== null && under !== undefined) {
    // Back to the popup this one was opened from, on the row that opened it — or, from the message
    // that a restart is needed, on the game menu's Restart, the row it points at.
    const menuRow = state.overlay === "message" ? "restart" : state.overlay === "controls" ? "controls" : "settings"
    const highlight = under === "menu" ? GAME_MENU_ROWS.indexOf(menuRow) : under === "settings" ? SETTINGS_EXPORT_ROW : 0
    return { ...state, overlay: under, overlayHighlight: highlight, overlayUnder: state.overlayUnder.slice(0, -1) }
  }
  if (state.overlay !== null) return { ...state, overlay: null, overlayUnder: [] }
  if (state.committed) return openOverlay(state, "menu")
  if (state.focus === "grid") {
    // Placing or exploring: back one level, to where it was started from. Plain navigation: to the
    // menu.
    if (state.armed !== null) return { ...backToOrigin(state), status: status("Cancelled.") }
    if (!state.exploreMap) return toMenu(state)
    const back = backToOrigin(state)
    return state.status === EXPLORE_STATUS ? { ...back, status: NO_STATUS } : back
  }
  void context
  return openOverlay(state, "menu")
}

/**
 * The Settings popup, from the game menu's `[s]` (at the player's settings) or from `d` (at the
 * experiments). Opens over nothing but the game menu, which it then goes back to — and over a
 * committed Build Phase, since starting over from there is exactly what a playtest wants.
 */
function openSettings(state: BuildState, section: "settings" | "experiments"): BuildState {
  if (state.overlay !== null && state.overlay !== "menu") return state
  // While the Nexus Pulse is on screen, `d` opens the Experiments already at the ending's — the ones
  // someone watching it wants to change (gate 6A) — rather than at the Build Phase's first.
  const experiments = state.committed ? FIRST_PULSE_EXPERIMENT_ROW : FIRST_EXPERIMENT_ROW
  return {
    ...state,
    overlay: "settings",
    overlayHighlight: section === "settings" ? FIRST_SETTING_ROW : experiments,
    overlayUnder: state.overlay === "menu" ? ["menu"] : [],
  }
}

/**
 * The Controls and hotkeys page (feedback F60): from the game menu's `[c]` row, which Esc then goes back
 * to, on that row; or from the game by `?`, which Esc closes. Over a committed Build Phase too — a Pulse
 * is watched with keys as well. Opens over no popup but the game menu.
 */
function openControls(state: BuildState): BuildState {
  if (state.overlay !== null && state.overlay !== "menu") return state
  return {
    ...state,
    overlay: "controls",
    overlayHighlight: 0,
    overlayUnder: state.overlay === "menu" ? ["menu"] : [],
  }
}

/**
 * One step of an experiment, said on the status line. A new scroll margin is felt at once: the
 * camera settles under the new rule straight away rather than at the next arrow key.
 */
function adjustFlag(context: BuildContext, state: BuildState, field: DebugField, step: -1 | 1): BuildState {
  const spec = fieldSpec(field)
  const highlight = state.overlay === "settings" ? { overlayHighlight: rowOfField(field) } : {}
  const { flags, changed } = adjustDebug(state.debug, field, step)
  if (!changed) {
    const end = step > 0 ? "largest" : "smallest"
    return {
      ...state,
      ...highlight,
      status: status(`Experiment - ${spec.label} is already ${formatDebugValue(state.debug, field)}, the ${end} value.`, "warning"),
    }
  }
  const later = spec.applies === "restart" ? " - applies after a restart" : ""
  const next: BuildState = {
    ...state,
    ...highlight,
    debug: flags,
    status: status(`Experiment - ${spec.label}: ${formatDebugValue(flags, field)}${later}.`),
  }
  if (field !== "scrollMargin") return next
  return { ...next, camera: followCursor(next.camera, next.cursor, next.viewport, context.grid, marginOf(next)) }
}

/** One step of a player setting. Recorded here and nowhere else: the live loop sees the new value,
 *  draws with it and saves it. */
function adjustPlayerSetting(state: BuildState, field: PlayerField, step: -1 | 1): BuildState {
  const settings = adjustSetting(state.settings, field, step)
  const highlight = state.overlay === "settings" ? { overlayHighlight: playerRow(field) } : {}
  return {
    ...state,
    ...highlight,
    settings,
    status: status(`${playerSpec(field).label}: ${formatPlayerValue(settings, field)}.`),
  }
}

/** Starts the Build Phase over, keeping the settings and the experiments — how an experiment marked
 *  "restart" takes effect. The last acknowledgement is carried over so its sequence keeps counting up
 *  and the live loop never mistakes a new one for one it has already shown. */
function restartWithFlags(context: BuildContext, state: BuildState): BuildState {
  const fresh = createBuildState(context, state.startCursor, state.viewport, state.debug, state.settings)
  return {
    ...fresh,
    ack: state.ack,
    refusedTry: state.refusedTry,
    status: status("Build Phase restarted with these settings."),
  }
}

/** The export popup: the settings as text, from Settings (which Esc goes back to) or a driver. */
function exportSettings(state: BuildState): BuildState {
  if (state.overlay !== null && state.overlay !== "settings") return state
  return {
    ...state,
    overlay: "export",
    overlayHighlight: 0,
    overlayUnder: state.overlay === "settings" ? [...state.overlayUnder, "settings"] : [],
    status: status("Settings exported - paste them into the pull request.", "success"),
  }
}

/** The export's text for this state — what the popup shows and what the session copies. */
export function exportText(context: BuildContext, state: BuildState): string {
  return formatSettingsExport({ settings: state.settings, experiments: state.debug }, context.buildId)
}

function exportLineCount(context: BuildContext, state: BuildState): number {
  return exportText(context, state).trimEnd().split("\n").length
}

/** Enter/Space, or Right/Left, on the Settings popup's highlighted row. */
function stepHighlighted(context: BuildContext, state: BuildState, step: -1 | 1, activate: boolean): BuildState {
  const row = settingsRowAt(state.overlayHighlight)
  if (row === null) return state
  if (row.kind === "experiment") return adjustFlag(context, state, row.field, step)
  if (row.kind === "player") return adjustPlayerSetting(state, row.field, step)
  return activate ? exportSettings(state) : state
}

/** Settings, or the export opened from it, is showing. */
function inSettings(overlay: Overlay | null): boolean {
  return overlay === "settings" || overlay === "export"
}

/**
 * The message popup over whatever is open — which Esc then goes back to — or over the game. Any
 * warning the screen needs to give once is one of these (feedback F34).
 */
function showMessage(state: BuildState, message: PopupMessage): BuildState {
  return {
    ...state,
    overlay: "message",
    message,
    overlayHighlight: 0,
    overlayUnder: state.overlay === null ? [] : [...state.overlayUnder, state.overlay],
  }
}

/**
 * Settings has just closed — by Esc back to the game menu, by `q`, by a click outside, whichever way —
 * with a setting changed that only takes effect when the Build Phase starts over: say so, once, in a
 * message popup (feedback F34). **When Settings closes rather than as the value changes**, so a player
 * stepping through a setting's values is not interrupted at every press, and one who puts it back
 * hears nothing; and **once per change**, so closing Settings again later does not repeat it — the
 * player may keep playing and restart when they choose. The status line says "applies after a
 * restart" at the change itself.
 */
function warnIfRestartNeeded(before: BuildState, next: BuildState): BuildState {
  if (!inSettings(before.overlay) || inSettings(next.overlay)) return next
  const pending = pendingRestart(next.startFlags, next.debug)
  if (pending.length === 0 || pending.join("\n") === next.restartWarned.join("\n")) return next
  return { ...showMessage(next, restartMessage(pending)), restartWarned: pending }
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
  // A Right on the menu that only flickered arms the next Right to move focus; anything else between
  // the two cancels that.
  const unnudged: BuildState =
    state.nudged && !(command.kind === "nudge" && command.direction === "right") ? { ...state, nudged: false } : state
  // The arming ghost (feedback F30) lasts until the player moves the cursor or tries to place.
  const moves = command.kind === "move-cursor" || command.kind === "click-tile" || command.kind === "place"
  const base: BuildState = moves && unnudged.armGhost ? { ...unnudged, armGhost: false } : unnudged
  const applied = applyCommand(context, base, command)
  // Nothing armed, nothing to draw as a ghost.
  const unghosted = applied.armed === null && applied.armGhost ? { ...applied, armGhost: false } : applied
  // Whatever closed the popup — a click outside it, a pick, an answer — closed the ones under it too;
  // and a message's words go with it.
  const closed = unghosted.overlay === null && unghosted.overlayUnder.length > 0 ? { ...unghosted, overlayUnder: [] } : unghosted
  const next = closed.overlay !== "message" && closed.message !== null ? { ...closed, message: null } : closed
  return lapseStatus(state, warnIfRestartNeeded(base, next))
}

/**
 * **A status is the answer of the command that set it** (owner, 2026-09-30, feedback F59: the bottom
 * line "offers contextual help"): a command that answers sets a new message, so one that leaves the
 * incoming message in place said nothing, and the old answer lapses — the bottom line then shows the
 * hint for where the keyboard is (`src/build/help.ts`). Compared by identity, which is exactly "did this
 * command set a status". A message about a tile also lapses the moment the cursor leaves it
 * (`withCursor`).
 */
function lapseStatus(before: BuildState, after: BuildState): BuildState {
  return after.status === before.status && after.status.text !== "" ? { ...after, status: NO_STATUS } : after
}

function applyCommand(context: BuildContext, state: BuildState, command: BuildCommand): BuildState {
  switch (command.kind) {
    case "move-cursor":
      return withCursor(
        context,
        state,
        { x: state.cursor.x + command.dx, y: state.cursor.y + command.dy },
        moveCameraMove(context, state, command),
      )

    case "click-tile": {
      const target = clampToGrid({ x: command.x, y: command.y }, context.grid)
      // A click outside an open popup closes it and brings focus to where it landed — and does
      // nothing else, so a click meant to dismiss never also places or picks (owner, 2026-09-27).
      if (state.overlay !== null) {
        if (state.overlay === "confirm-commit" || state.committed) return { ...state, overlay: null }
        const dismissed: BuildState = { ...state, overlay: null, focus: "grid", armed: state.armed }
        return withCursor(context, dismissed, target, clickCameraMove(context, dismissed))
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
      const moved = { ...withCursor(context, state, target, clickCameraMove(context, state)), focus: "grid" as const }
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
      if (state.overlay !== null) {
        if (state.overlay === "confirm-commit") return { ...state, overlay: null, status: status("Cancelled.") }
        return { ...toMenu({ ...state, overlay: null }), menuHighlight: command.entry, highlightHidden: true }
      }
      // Explore Map covers the menu below its own row: a click on that row — drawn active — closes it,
      // as Esc and `e` do (feedback F32), and so does a click anywhere else on the panel, where the
      // row under the click was not drawn: it chooses nothing. Either way the menu is drawn again.
      if (exploring(state)) return { ...cancel(context, state), highlightHidden: true }
      // Otherwise a click activates what it lands on, whatever had focus (feedback F22): a building
      // arms at once, its ghost at the cursor; Nexus opens its popup; Explore Map opens the map.
      return { ...activateEntry(context, state, command.entry, "click"), highlightHidden: true }
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

    case "inspect":
      // Enter/Space in plain navigation: Explore Map, begun on the map. Already open, nothing more.
      if (state.focus !== "grid" || state.armed !== null || state.exploreMap) return state
      return openExplore(state, "grid")

    case "remove": {
      const lock = editLock(state)
      if (lock !== null) return { ...state, status: lock }
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
      return cancel(context, state)

    case "open-menu":
      return openOverlay(state, "menu")

    case "pick-nexus":
      return pickNexus(context, state, command.index)

    case "commit":
      return startPulse(context, state)

    case "confirm-commit": {
      // Meaningless outside the one moment it answers — a stray "y" is not a command here any more
      // than a stray "3" is one before anything is armed.
      if (state.overlay !== "confirm-commit") return state
      // The Nexus Pulse starts (gate 6A). The keyboard goes to the Grid, where the arrows look around it
      // — a committed plan locks every edit but not the cursor — and nothing is armed or being explored.
      return {
        ...toMap(state),
        overlay: null,
        committed: true,
        status: status(`Build committed - ${state.planned.length} planned.`, "success"),
      }
    }

    case "look-at": {
      const tile = clampToGrid({ x: command.x, y: command.y }, context.grid)
      return withCursor(context, state, tile, (camera, cursor) => centreOn(camera, cursor, state.viewport, context.grid))
    }

    case "pulse-failed":
      return {
        ...state,
        committed: false,
        overlay: null,
        status: status(`The Nexus Pulse could not start: ${command.reason}`, "danger"),
      }

    case "focus":
      if (state.overlay !== null || state.committed || state.focus === command.target) return state
      // To the Grid, Tab arrives in plain navigation (feedback F30) — Explore Map is `e`'s.
      return command.target === "menu" ? { ...toMenu(state), highlightHidden: false } : toMap(state)

    case "highlight": {
      if (state.overlay === "settings") return { ...state, overlayHighlight: stepSettingsRow(state.overlayHighlight, command.delta) }
      if (state.overlay === "menu") {
        return { ...state, overlayHighlight: wrap(state.overlayHighlight + command.delta, GAME_MENU_ROWS.length) }
      }
      if (state.overlay === "export") {
        // The export's highlight walks its lines, stopping at either end; the popup's window follows
        // it (`src/build/overlay.ts`).
        const last = exportLineCount(context, state) - 1
        return { ...state, overlayHighlight: Math.max(0, Math.min(last, state.overlayHighlight + command.delta)) }
      }
      if (state.overlay === "controls") {
        // The Controls page scrolls the export's way: the highlight walks its key lines, stopping at
        // either end, and the window follows it.
        return { ...state, overlayHighlight: Math.max(0, Math.min(controlsLineCount() - 1, state.overlayHighlight + command.delta)) }
      }
      if (state.overlay === "nexus-powers") {
        const count = nexusPowers(context, state).pending.length
        return { ...state, overlayHighlight: wrap(state.overlayHighlight + command.delta, count) }
      }
      if (state.overlay !== null || state.focus !== "menu") return state
      if (state.highlightHidden) return revealHighlight(state)
      const count = menuEntries(context).length
      return { ...state, menuHighlight: wrap(state.menuHighlight + command.delta, count) }
    }

    case "activate": {
      // On a setting, Enter/Space is Right: a choice of two flips, a number steps up.
      if (state.overlay === "settings") return stepHighlighted(context, state, 1, true)
      if (state.overlay === "menu") {
        // `[q] Quit` is not the reducer's to act on: the keyboard sends `quit` for Enter on it, and a
        // click on it sends `quit` too (`src/build/keyboard.ts`, the popup's own rows).
        const row = GAME_MENU_ROWS[state.overlayHighlight]
        if (row === "settings") return openSettings(state, "settings")
        if (row === "controls") return openControls(state)
        if (row === "restart") return restartWithFlags(context, state)
        return row === "back" ? cancel(context, state) : state
      }
      if (state.overlay === "nexus-powers") {
        const pending = nexusPowers(context, state).pending[state.overlayHighlight]
        if (pending === undefined) return { ...state, status: status("No Nexus power waiting.", "warning") }
        return pickNexus(context, state, pending.index)
      }
      if (state.overlay !== null || state.focus !== "menu" || state.committed) return state
      if (state.highlightHidden) return revealHighlight(state)
      return activateEntry(context, state, state.menuHighlight, "key")
    }

    case "nudge": {
      // In Settings, Left and Right are what a row is for: they change its value.
      if (state.overlay === "settings") return stepHighlighted(context, state, command.direction === "right" ? 1 : -1, false)
      if (state.focus !== "menu" || state.overlay !== null || state.committed) return state
      if (state.highlightHidden) return revealHighlight(state)
      if (command.direction === "right" && state.nudged) return { ...toMap(state), nudged: false }
      return {
        ...state,
        nudged: command.direction === "right",
        ack: acknowledge(state, "refused", state.menuHighlight),
      }
    }

    case "open-nexus-powers":
      return openNexus(state)

    case "explore":
      return toggleExplore(context, state)

    case "open-settings":
      return openSettings(state, command.section)

    // A driver may change a setting with the popup closed; a player reaches these only through it.
    case "debug-adjust":
      return adjustFlag(context, state, command.field, command.step)

    case "setting-adjust":
      return adjustPlayerSetting(state, command.field, command.step)

    case "settings-select":
      if (state.overlay !== "settings" || settingsRowAt(command.row) === null) return state
      return { ...state, overlayHighlight: command.row }

    case "debug-restart":
      return restartWithFlags(context, state)

    case "export-settings":
      return exportSettings(state)

    case "export-select":
      if (state.overlay !== "export") return state
      return { ...state, overlayHighlight: Math.max(0, Math.min(exportLineCount(context, state) - 1, command.line)) }

    case "open-controls":
      return openControls(state)

    case "controls-select":
      if (state.overlay !== "controls") return state
      return { ...state, overlayHighlight: Math.max(0, Math.min(controlsLineCount() - 1, command.line)) }

    case "quit":
      return state

    default:
      return state
  }
}

/** The structure covering a tile, standing or planned, or `null` — what the information panel shows. */
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
    camera: followCursor(state.camera, state.cursor, viewport, context.grid, marginOf(state)),
  }
}
