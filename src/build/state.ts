// The Build Phase's pure reducer: a command in, the next state out. No terminal, no frame, no
// clock — the same separation `src/menu/list.ts` draws for the menu, so every claim about scrolling
// and placement is checkable without a TTY.

import { footprintCentre, footprintExtent, inBounds, tilesOf } from "../grid/coords.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import { TERRAIN } from "../grid/types.ts"
import type { StatusMessage } from "../status.ts"
import { NO_STATUS, status } from "../status.ts"
import type { Camera, Margin, Viewport } from "./camera.ts"
import { centreOn, clampToGrid, edgeClickCamera, followCursor, marginForView } from "./camera.ts"
import type { DebugField, DebugFlags, MapEdgeStyle } from "./debug.ts"
import {
  DEBUG_ROW_COUNT,
  adjustDebug,
  fieldAtRow,
  fieldSpec,
  formatDebugValue,
  initialDebugFlags,
  rowOfField,
} from "./debug.ts"
import type {
  Ack,
  BuildCommand,
  ConstructItem,
  Focus,
  MenuEntry,
  NexusPowerOption,
  Overlay,
  PlannedPlacement,
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
   * for. **Only where the margin starts**: since gate 5G it is a Debug Mode flag,
   * `state.debug.scrollMargin`, and that is what the reducer reads. **Since gate 5H it is a
   * percentage of the view** — of its width for the sides and its height for the top and bottom —
   * defaulting to the owner's 20%, rather than a number of tiles.
   */
  scrollMargin?: number
  /** The Nexus draft this Build Phase offers — placeholder options, not Milestone 8's real one
   *  (`types.ts`'s own doc comment on `NexusPowerOption` has the reasoning). */
  nexusDraft: readonly NexusPowerOption[]
  /** Q55's smart cursor: arming from the menu moves the cursor to a tile the structure can go.
   *  Defaults on. Like `scrollMargin`, only the starting value of its Debug Mode flag,
   *  `state.debug.smartCursor`. */
  smartCursor?: boolean
  /**
   * The map's own border style — the "map-defined border" of feedback F25 ("defining custom borders
   * could accentuate the location"), drawn where the Grid rectangle reaches the map's edge when Debug
   * Mode's "Map edge" is set to `the map`. Presentation only, and a name rather than glyphs: the view
   * owns what each style looks like (`src/view/edge.ts`). Absent: the solid bar.
   */
  edgeStyle?: MapEdgeStyle
}>

export type BuildState = Readonly<{
  cursor: Coord
  camera: Camera
  viewport: Viewport
  /**
   * Index into `catalog`, or `null` for nothing armed. **A structure is armed only while the Grid has
   * focus** (owner, 2026-09-27): every way focus leaves the Grid — Tab, Esc, a click on the menu, a
   * placement — disarms, so the screen is always in one of three plain modes: the menu (no cursor),
   * placing (a row marked armed, the cursor carrying its ghost) or exploring (no row marked, the bare
   * cursor).
   */
  armed: number | null
  /** Which half of the screen the arrow keys and Enter/Space belong to (engine.md 9.7, gate 5F).
   *  Reducer state, not adapter state, so a driver can assert it and the key help can say it. */
  focus: Focus
  /** Exploring, the side panel shows what is under the cursor instead of the menu — Enter/Space on
   *  the Grid, or a click on a building. Only ever true while the Grid has focus and nothing is
   *  armed; Esc closes it first. */
  inspecting: boolean
  /** The last thing a command asked to have acknowledged on screen — see `Ack`. */
  ack: Ack | null
  /**
   * The last placement that was tried and refused, with a sequence number and no clock, the way `ack`
   * is: the live loop flashes the cursor there for a moment from when it first sees a new `seq`
   * (gate 5H; how long is Debug Mode's "Refused cursor"). Counts up across a Debug Mode restart.
   */
  refusedTry: Readonly<{ seq: number; tile: Coord }> | null
  /** The previous command was a Right on the menu that only flickered: a second one in a row moves
   *  focus to the Grid. Cleared by any other command. */
  nudged: boolean
  /** Index into `menuEntries(context)` — the side panel's highlighted entry. Drawn only while the
   *  menu has focus; kept while it does not, so Tab returns to the same row. */
  menuHighlight: number
  /** The popup drawn over the Grid and holding the keyboard and mouse, or `null`: the Nexus powers,
   *  the start-the-Pulse question (`p` — "the one action that must not fire by accident", engine.md
   *  9.7), or the exit question. Never opened by anything but the player. */
  overlay: Overlay | null
  /** Index into the popup's pending powers — its own highlight, reset whenever it opens. */
  overlayHighlight: number
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
  /** The Build Phase is done. Nothing here reaches a Nexus Pulse — Milestone 6 builds that — so this
   *  just freezes the plan and says so; every state-changing command is refused from here on. */
  committed: boolean
  /**
   * Debug Mode's flags (gate 5G, `src/build/debug.ts`). State rather than context because they change
   * while the screen is open; the reducer reads the ones that change what a command does, and the
   * live loop reads the flash timings. Survive a Debug Mode restart; not saved anywhere else.
   */
  debug: DebugFlags
  /** Where the cursor started — where a Debug Mode restart puts it back. */
  startCursor: Coord
}>

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

/** The scroll margin in force, in tiles along each axis: Debug Mode's percentage of the view (gate 5H),
 *  which starts at the context's (`--scroll-margin`) or the owner's 20%. */
function marginOf(state: Readonly<{ debug: DebugFlags; viewport: Viewport }>): Margin {
  return marginForView(state.debug.scrollMargin, state.viewport)
}

/**
 * A fresh Build Phase. `debug` carries a Debug Mode restart's flags over; otherwise they start from
 * the context (`initialDebugFlags`).
 */
export function createBuildState(
  context: BuildContext,
  cursor: Coord,
  viewport: Viewport,
  debug: DebugFlags = initialDebugFlags(context),
): BuildState {
  const start = clampToGrid(cursor, context.grid)
  return {
    cursor: start,
    camera: followCursor({ x: 0, y: 0 }, start, viewport, context.grid, marginOf({ debug, viewport })),
    viewport,
    armed: null,
    inspecting: false,
    ack: null,
    refusedTry: null,
    nudged: false,
    // The menu, on its first entry — the side panel is where the owner's eyes went first (2026-09-26),
    // and the first entry is the Nexus Powers one, so Enter from a standing start opens the choice
    // the commit will eventually insist on. Whether it should rather be the map is a guess gate 5F
    // left open, and a Debug Mode flag: on the map, the screen opens exploring.
    focus: debug.startFocus,
    menuHighlight: 0,
    overlay: null,
    overlayHighlight: 0,
    planned: [],
    status: NO_STATUS,
    nextOrdinal: 1,
    nexusPick: null,
    bonusAllotment: 0,
    committed: false,
    debug,
    startCursor: cursor,
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
  if (state.overlay === "confirm-commit") return status("Answer the Nexus Pulse prompt first: [y]es or [n]o.", "warning")
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
 * The side panel's menu, in the order Up/Down walk it — the Nexus Powers entry first, then every
 * construct row. Derived from the catalog rather than stored, so the highlight and the rows drawn
 * can never disagree about how many there are.
 */
export function menuEntries(context: BuildContext): readonly MenuEntry[] {
  return [
    { kind: "nexus" },
    { kind: "explore" },
    ...context.catalog.map((_, index) => ({ kind: "construct" as const, index })),
  ]
}

/** How many entries sit above the construct rows. */
const ENTRIES_BEFORE_CONSTRUCT = 2

/** The menu entry a construct row is — so arming by digit moves the highlight onto its row, and focus
 *  back on the menu lands where the player's attention already is. */
export function entryOfConstruct(index: number): number {
  return index + ENTRIES_BEFORE_CONSTRUCT
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
 * **The smart cursor** (Q55, gate 5F): the tile a menu-driven arm puts the cursor on, so the owner's
 * own keyboard flow — "down, down, space, place, space, place" — lays out a tidy row without an arrow
 * key. A pure function of the plan, so the reducer owns it and the driver can assert it; `null` when
 * nowhere on the Grid will take the structure, and the cursor then stays where it is.
 *
 * The rule, in the order it is tried:
 *
 * 1. **Beside the last thing planned** — or, before anything is, the player's Grid Nexus (a flag on
 *    its content definition, never an id) — **one tile apart and aligned with it**: to the east or
 *    west sharing its top row, to the south or north sharing its left column. The four sides are
 *    tried nearest-the-Grid's-centre first ("toward the centre of the map"), ties in the order east,
 *    south, west, north.
 * 2. Otherwise **the nearest spot anywhere** that still leaves a free tile around it: nearest by the
 *    gap between the two footprints, then by distance from the Grid's centre, then north before
 *    south and west before east — a total order, so there is exactly one answer.
 * 3. Otherwise the same search without the free tile around it.
 *
 * Affordability is not a tile question and is left out: a structure the player cannot afford still
 * lands somewhere it would fit, and the status line says what it costs (engine.md 9.2's order —
 * affordability first — is about what the *refusal* says, not about where to look).
 */
export function smartCursorTile(
  context: BuildContext,
  planned: readonly PlannedPlacement[],
  contentId: string,
  fallback: Coord,
): Coord | null {
  const footprint = context.registry.get(contentId).footprint
  const size = footprintExtent(footprint)
  const claimed = claimedTiles(context, planned)
  const { grid } = context

  const fits = (anchor: Coord): boolean => {
    for (const tile of tilesOf(anchor, footprint)) {
      if (!inBounds(grid, tile)) return false
      const terrainId = grid.tiles[tile.y * grid.width + tile.x]
      if (terrainId !== undefined && TERRAIN[terrainId].impassable) return false
      if (claimed.has(`${tile.x},${tile.y}`)) return false
    }
    return true
  }
  // "One tile free between structures": nothing already claimed on the ring around the footprint's
  // bounding box. Rock and the Grid's own edge may touch it — only structures need the gap.
  const spaced = (anchor: Coord): boolean => {
    for (let y = anchor.y - 1; y <= anchor.y + size.height; y += 1) {
      for (let x = anchor.x - 1; x <= anchor.x + size.width; x += 1) {
        if (claimed.has(`${x},${y}`)) return false
      }
    }
    return true
  }

  const last = planned.reduce<PlannedPlacement | null>(
    (latest, placement) => (latest === null || placement.ordinal > latest.ordinal ? placement : latest),
    null,
  )
  const nexus = context.standing.find((structure) => context.registry.get(structure.contentId).nexus === true)
  const origin = last ?? nexus ?? null
  const originAnchor = origin?.anchor ?? fallback
  const originSize =
    origin === null ? { width: 1, height: 1 } : footprintExtent(context.registry.get(origin.contentId).footprint)
  const centre = { x: (grid.width - 1) / 2, y: (grid.height - 1) / 2 }
  const cursorFor = (anchor: Coord): Coord => {
    const offset = footprintCentre(footprint)
    return { x: anchor.x + offset.x, y: anchor.y + offset.y }
  }

  // 1. Aligned with the origin, one tile apart, the side facing the centre first.
  const toCentre = {
    x: centre.x - (originAnchor.x + (originSize.width - 1) / 2),
    y: centre.y - (originAnchor.y + (originSize.height - 1) / 2),
  }
  const sides = [
    { score: toCentre.x, anchor: { x: originAnchor.x + originSize.width + 1, y: originAnchor.y } },
    { score: toCentre.y, anchor: { x: originAnchor.x, y: originAnchor.y + originSize.height + 1 } },
    { score: -toCentre.x, anchor: { x: originAnchor.x - size.width - 1, y: originAnchor.y } },
    { score: -toCentre.y, anchor: { x: originAnchor.x, y: originAnchor.y - size.height - 1 } },
  ]
  // `sort` is stable, so equal scores keep the east, south, west, north order written above.
  sides.sort((a, b) => b.score - a.score)
  for (const side of sides) {
    if (fits(side.anchor) && spaced(side.anchor)) return cursorFor(side.anchor)
  }

  // 2 and 3. The nearest spot anywhere, first with the free ring and then without it.
  const gapTo = (anchor: Coord): number => {
    const dx = Math.max(0, originAnchor.x - (anchor.x + size.width), anchor.x - (originAnchor.x + originSize.width))
    const dy = Math.max(0, originAnchor.y - (anchor.y + size.height), anchor.y - (originAnchor.y + originSize.height))
    return Math.max(dx, dy)
  }
  const fromCentre = (anchor: Coord): number => {
    const dx = anchor.x + (size.width - 1) / 2 - centre.x
    const dy = anchor.y + (size.height - 1) / 2 - centre.y
    return dx * dx + dy * dy
  }
  for (const needSpace of [true, false]) {
    let best: Readonly<{ anchor: Coord; gap: number; distance: number }> | null = null
    for (let y = 0; y + size.height <= grid.height; y += 1) {
      for (let x = 0; x + size.width <= grid.width; x += 1) {
        const anchor = { x, y }
        if (!fits(anchor) || (needSpace && !spaced(anchor))) continue
        const gap = gapTo(anchor)
        const distance = fromCentre(anchor)
        // Rows are scanned north to south and west to east, so a strict comparison keeps the first
        // of any exact tie — the "north before south, west before east" of the rule above.
        if (best === null || gap < best.gap || (gap === best.gap && distance < best.distance)) {
          best = { anchor, gap, distance }
        }
      }
    }
    if (best !== null) return cursorFor(best.anchor)
  }
  return null
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
 * A click on a Grid tile, as a cursor move: what it does to the camera depends on what the click is
 * for. **With a structure armed it never scrolls** (Q58, option B; Debug Mode can allow it): the
 * player is pointing at a tile to confirm with a second click, and a view that slid under the pointer
 * would make that second click land on a different tile. **Exploring**, the view comes to the click
 * (feedback F6): nearer an edge scrolls further, or every click centres, or — the gate 5A-5G
 * behaviour — only the margin follows.
 */
function clickCameraMove(context: BuildContext, state: BuildState): CameraMove {
  const flags = state.debug
  if (state.armed !== null) return flags.armedClickScrolls ? "follow" : "still"
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
 *  when Debug Mode's "Fast move centres" is on (engine.md 3.3's recentring). */
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
 *  disarms, and the information panel — a Grid-side view — closes with it. */
function toMenu(state: BuildState): BuildState {
  return { ...state, focus: "menu", armed: null, inspecting: false }
}

/** Gives the keyboard to the Grid, exploring: nothing armed. */
function toGridExploring(state: BuildState): BuildState {
  return { ...state, focus: "grid", armed: null, inspecting: false }
}

/**
 * Arms catalog row `index`: the one path a digit and the menu's own Enter/Space share. Focus moves to
 * the Grid, where the placing happens, and the menu highlight follows the row. Only a menu-driven arm
 * moves the cursor (Q55): a digit is the fast path of a player already pointing somewhere. A row that
 * costs more than is left is refused here, with the reason, rather than armed to be refused later.
 */
function armItem(
  context: BuildContext,
  state: BuildState,
  index: number,
  from: "menu" | "hotkey",
): BuildState {
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
    focus: "grid",
    inspecting: false,
    menuHighlight: entry,
    ack: acknowledge(state, "pressed", entry),
  }
  const smart =
    from === "menu" && state.debug.smartCursor
      ? smartCursorTile(context, state.planned, item.contentId, state.cursor)
      : null
  const moved = smart === null ? armed : withCursor(context, armed, smart)
  return { ...moved, status: status(`${item.label} selected - ${item.cost} to build.`) }
}

/** Enter/Space (or a click) on menu entry `entry`: whatever it is for. */
function activateEntry(context: BuildContext, state: BuildState, entry: number): BuildState {
  const target = menuEntries(context)[entry]
  if (target === undefined) return state
  const highlighted: BuildState = { ...state, menuHighlight: entry }
  if (target.kind === "construct") return armItem(context, highlighted, target.index, "menu")
  if (target.kind === "nexus") return openNexus(highlighted)
  return explore(highlighted)
}

/** `n`, or the Nexus entry: open its popup. Its row flashes "pressed", however it was reached — a
 *  hotkey is the row's own activation, the same as Enter on it or a click. */
function openNexus(state: BuildState): BuildState {
  const opened = openOverlay(state, "nexus-powers")
  if (opened.overlay !== "nexus-powers") return opened
  return { ...opened, menuHighlight: 0, ack: acknowledge(state, "pressed", 0) }
}

/** `e`, or the Explore entry: the Grid, with nothing armed. */
function explore(state: BuildState): BuildState {
  if (state.overlay !== null || state.committed) return state
  return {
    ...toGridExploring(state),
    menuHighlight: 1,
    ack: acknowledge(state, "pressed", 1),
    status: status("Exploring - arrows move, enter/space inspects."),
  }
}

function openOverlay(state: BuildState, overlay: Overlay): BuildState {
  // The start-the-Pulse question and a committed Build Phase each own the whole screen; a popup over
  // either would be a second question on top of one. The exit question is the one exception: it can
  // always be asked.
  if (overlay !== "exit") {
    const lock = state.committed || state.overlay === "confirm-commit" ? editLock(state) : null
    if (lock !== null) return { ...state, status: lock }
  }
  return { ...state, overlay, overlayHighlight: 0 }
}

function pickNexus(context: BuildContext, state: BuildState, index: number): BuildState {
  // Defensively guarded like every other command: a driver script is free to send one anywhere, and
  // the answer must be the same refusal a player pressing an unavailable key gets. An open Nexus popup
  // is where a pick is normally made, so it is not a reason to refuse one.
  if (state.committed || state.overlay === "confirm-commit" || state.overlay === "exit") {
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
  // Back to the menu, always (owner, 2026-09-27 — answering Q57): the menu orchestrates the Build
  // Phase, and the Grid cursor is for placing and exploring. Disarms with it.
  return {
    ...toMenu(placed),
    status: status(`${item.label} placed (resources: ${remaining(context, placed)}) - [u] undo`, "success"),
  }
}

/** The one "back" of the screen — Esc, `x`, a right click. One level per press. */
function cancel(context: BuildContext, state: BuildState): BuildState {
  if (state.overlay === "confirm-commit") return { ...state, overlay: null, status: status("Cancelled.") }
  if (state.overlay !== null) return { ...state, overlay: null }
  if (state.committed) return openOverlay(state, "exit")
  if (state.focus === "grid") {
    if (state.inspecting) return { ...state, inspecting: false }
    const wasArmed = state.armed !== null
    return { ...toMenu(state), status: wasArmed ? status("Cancelled.") : state.status }
  }
  void context
  return openOverlay(state, "exit")
}

/**
 * `d`: the Debug Mode popup (gate 5G). Opens over anything but another popup — including a committed
 * Build Phase, since starting over from there is exactly what a playtest of the flags wants.
 */
function openDebug(state: BuildState): BuildState {
  if (state.overlay !== null) return state
  return { ...state, overlay: "debug", overlayHighlight: 0 }
}

/**
 * One step of a Debug Mode flag, said on the status line. A new scroll margin is felt at once: the
 * camera settles under the new rule straight away rather than at the next arrow key.
 */
function adjustFlag(context: BuildContext, state: BuildState, field: DebugField, step: -1 | 1): BuildState {
  const spec = fieldSpec(field)
  const highlight = state.overlay === "debug" ? { overlayHighlight: rowOfField(field) } : {}
  const { flags, changed } = adjustDebug(state.debug, field, step)
  if (!changed) {
    const end = step > 0 ? "largest" : "smallest"
    return {
      ...state,
      ...highlight,
      status: status(`Debug - ${spec.label} is already ${formatDebugValue(state.debug, field)}, the ${end} value.`, "warning"),
    }
  }
  const later = spec.applies === "restart" ? " - applies on restart: [r]" : ""
  const next: BuildState = {
    ...state,
    ...highlight,
    debug: flags,
    status: status(`Debug - ${spec.label}: ${formatDebugValue(flags, field)}${later}.`),
  }
  if (field !== "scrollMargin") return next
  return { ...next, camera: followCursor(next.camera, next.cursor, next.viewport, context.grid, marginOf(next)) }
}

/** Starts the Build Phase over, keeping the Debug Mode flags — how a flag marked "restart" takes
 *  effect. The last acknowledgement is carried over so its sequence keeps counting up and the live
 *  loop never mistakes a new one for one it has already shown. */
function restartWithFlags(context: BuildContext, state: BuildState): BuildState {
  const fresh = createBuildState(context, state.startCursor, state.viewport, state.debug)
  return {
    ...fresh,
    ack: state.ack,
    refusedTry: state.refusedTry,
    status: status("Build Phase restarted with the debug settings."),
  }
}

/** Enter/Space, or Right/Left, on the Debug Mode popup's highlighted row. */
function stepHighlighted(context: BuildContext, state: BuildState, step: -1 | 1, activate: boolean): BuildState {
  const field = fieldAtRow(state.overlayHighlight)
  if (field !== null) return adjustFlag(context, state, field, step)
  return activate ? restartWithFlags(context, state) : state
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
  const base: BuildState =
    state.nudged && !(command.kind === "nudge" && command.direction === "right") ? { ...state, nudged: false } : state
  return applyCommand(context, base, command)
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
      if (state.committed) return state
      // Two clicks, not one — Q52. A click on a tile that is not already where the cursor sits only
      // moves the cursor there and shows the armed preview; a second click **on that same tile** is
      // what places. Checked against `state.cursor` (tile identity), never the click's screen cell.
      const confirming =
        state.focus === "grid" && state.armed !== null && target.x === state.cursor.x && target.y === state.cursor.y
      // A click on the Grid is attention on the Grid: it takes keyboard focus there too. Armed, it
      // never scrolls the view (Q58), so a second click lands on the tile the preview is on.
      const moved = { ...withCursor(context, state, target, clickCameraMove(context, state)), focus: "grid" as const }
      if (confirming) return place(context, moved)
      if (moved.armed !== null) return moved
      // Exploring: a click on a building opens its information panel; a click on bare ground closes it.
      return { ...moved, inspecting: structureCovering(context, moved.planned, target) }
    }

    case "click-menu": {
      if (state.committed) return state
      // A click anywhere outside a popup dismisses it first — and only that, plus focus.
      if (state.overlay !== null) {
        if (state.overlay === "confirm-commit") return { ...state, overlay: null, status: status("Cancelled.") }
        return { ...toMenu({ ...state, overlay: null }), menuHighlight: command.entry }
      }
      // A first click on the menu while the keyboard is elsewhere only brings focus and highlights.
      if (state.focus !== "menu") return { ...toMenu(state), menuHighlight: command.entry }
      return activateEntry(context, state, command.entry)
    }

    case "arm":
      return armItem(context, state, command.index, "hotkey")

    case "place":
      return place(context, state)

    case "inspect":
      if (state.focus !== "grid" || state.armed !== null || state.overlay !== null) return state
      return { ...state, inspecting: true }

    case "remove": {
      const lock = editLock(state)
      if (lock !== null) return { ...state, status: lock }
      const target = plannedAt(context, state.planned, state.cursor)
      if (target === null) return { ...state, status: status("Nothing planned under the cursor.", "warning") }
      return {
        ...state,
        planned: state.planned.filter((placement) => placement.ordinal !== target.ordinal),
        status: status(`${shortName(context, target.contentId)} removed, ${costOf(context, target.contentId)} back.`),
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
        status: status(`${shortName(context, last.contentId)} undone, ${costOf(context, last.contentId)} back.`),
      }
    }

    case "cancel":
      return cancel(context, state)

    case "request-exit":
      return openOverlay(state, "exit")

    case "pick-nexus":
      return pickNexus(context, state, command.index)

    case "commit": {
      const lock = commitLock(state)
      if (lock !== null) return { ...state, status: lock }
      return { ...toMenu(state), overlay: "confirm-commit", status: status("Start the Nexus Pulse? [y]es / [n]o") }
    }

    case "confirm-commit": {
      // Meaningless outside the one moment it answers — a stray "y" is not a command here any more
      // than a stray "3" is one before anything is armed.
      if (state.overlay !== "confirm-commit") return state
      if (!command.accept) return { ...state, overlay: null, status: status("Cancelled.") }
      return {
        ...state,
        overlay: null,
        committed: true,
        status: status(
          `Build committed - ${state.planned.length} planned, Nexus Pulse would begin here (Milestone 6).`,
          "success",
        ),
      }
    }

    case "focus":
      if (state.overlay !== null || state.committed || state.focus === command.target) return state
      return command.target === "menu" ? toMenu(state) : toGridExploring(state)

    case "highlight": {
      if (state.overlay === "debug") {
        return { ...state, overlayHighlight: wrap(state.overlayHighlight + command.delta, DEBUG_ROW_COUNT) }
      }
      if (state.overlay === "nexus-powers") {
        const count = nexusPowers(context, state).pending.length
        return { ...state, overlayHighlight: wrap(state.overlayHighlight + command.delta, count) }
      }
      if (state.overlay !== null || state.focus !== "menu") return state
      const count = menuEntries(context).length
      return { ...state, menuHighlight: wrap(state.menuHighlight + command.delta, count) }
    }

    case "activate": {
      // On a flag, Enter/Space is Right: a choice of two flips, a number steps up.
      if (state.overlay === "debug") return stepHighlighted(context, state, 1, true)
      if (state.overlay === "nexus-powers") {
        const pending = nexusPowers(context, state).pending[state.overlayHighlight]
        if (pending === undefined) return { ...state, status: status("No Nexus power waiting.", "warning") }
        return pickNexus(context, state, pending.index)
      }
      if (state.overlay !== null || state.focus !== "menu" || state.committed) return state
      return activateEntry(context, state, state.menuHighlight)
    }

    case "nudge": {
      // In Debug Mode, Left and Right are what a flag's row is for: they change its value.
      if (state.overlay === "debug") return stepHighlighted(context, state, command.direction === "right" ? 1 : -1, false)
      if (state.focus !== "menu" || state.overlay !== null || state.committed) return state
      if (command.direction === "right" && state.nudged) return { ...toGridExploring(state), nudged: false }
      return {
        ...state,
        nudged: command.direction === "right",
        ack: acknowledge(state, "refused", state.menuHighlight),
      }
    }

    case "open-nexus-powers":
      return openNexus(state)

    case "explore":
      return explore(state)

    case "open-debug":
      return openDebug(state)

    // A driver may set a flag with the popup closed; a player reaches this only through the popup.
    case "debug-adjust":
      return adjustFlag(context, state, command.field, command.step)

    case "debug-select":
      if (state.overlay !== "debug" || command.row < 0 || command.row >= DEBUG_ROW_COUNT) return state
      return { ...state, overlayHighlight: command.row }

    case "debug-restart":
      return restartWithFlags(context, state)

    case "quit":
      return state

    default:
      return state
  }
}

/** Whether a structure — standing or planned — covers this tile. */
export function structureCovering(context: BuildContext, planned: readonly PlannedPlacement[], tile: Coord): boolean {
  return structureAtTile(context, planned, tile) !== null
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
