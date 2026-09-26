// The Build Phase's pure reducer: a command in, the next state out. No terminal, no frame, no
// clock — the same separation `src/menu/list.ts` draws for the menu, so every claim about scrolling
// and placement is checkable without a TTY.

import { footprintCentre, inBounds, tilesOf } from "../grid/coords.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import { TERRAIN } from "../grid/types.ts"
import type { StatusMessage } from "../status.ts"
import { NO_STATUS, status } from "../status.ts"
import type { Camera, Viewport } from "./camera.ts"
import { SCROLL_MARGIN, clampToGrid, followCursor } from "./camera.ts"
import type {
  BuildCommand,
  ConstructItem,
  NexusPowerOption,
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
   * for. Defaults to the canon's three.
   */
  scrollMargin?: number
  /** The Nexus draft this Build Phase offers — placeholder options, not Milestone 8's real one
   *  (`types.ts`'s own doc comment on `NexusPowerOption` has the reasoning). */
  nexusDraft: readonly NexusPowerOption[]
}>

export type BuildState = Readonly<{
  cursor: Coord
  camera: Camera
  viewport: Viewport
  /** Index into `catalog`, or `null` for nothing armed. */
  armed: number | null
  planned: readonly PlannedPlacement[]
  /** The one line of feedback the status line shows: what just happened, or why it did not. A
   *  message about a tile (`status.tile`, a refused placement) lapses once the cursor leaves it. */
  status: StatusMessage
  /** The tile a placement just succeeded on, or `null`. Set by a successful `place()`; cleared the
   *  moment the cursor actually moves off it (`withCursor`), or anything changes what that tile
   *  means — a fresh `arm`, a `disarm`, a `remove` or an `undo`. While it matches the cursor, a
   *  repeated place is a no-op and the preview shows the plan undisturbed, rather than recomputing
   *  "occupied by itself" as a refusal — the false "just failed" reading an owner playtest found
   *  confusing (2026-09-26). */
  justPlacedAt: Coord | null
  nextOrdinal: number
  /** Index into `context.nexusDraft`, or `null` before a pick — and a Nexus power, once dealt, may
   *  not be skipped (`commander-armies.md` Section 4.5), so every state-changing command is refused
   *  until this stops being `null`. */
  nexusPick: number | null
  /** Added to `context.allotment` by whichever option `nexusPick` names. Kept separately rather than
   *  folded into a mutated allotment, for the same reason `spent` is summed rather than tracked: one
   *  stored total is one number that can drift from what actually produced it. */
  bonusAllotment: number
  /** `p` was pressed and the Build Phase is waiting on `[y]es`/`[n]o` — "the one action that must
   *  not fire by accident" (engine.md 9.7). Every other state-changing command is refused while this
   *  is true, so answering the prompt is the only way forward. */
  confirmingCommit: boolean
  /** The Build Phase is done. Nothing here reaches a Nexus Pulse — Milestone 6 builds that — so this
   *  just freezes the plan and says so; every state-changing command is refused from here on. */
  committed: boolean
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

/** The five-tile jump — Shift+Arrow, its modifier-free fallback, and the mouse wheel all produce a
 *  `move-cursor` of this size. GUIDANCE (engine.md 9.7's bindings table), not RULE. */
export const JUMP_TILES = 5

function marginOf(context: BuildContext): number {
  return context.scrollMargin ?? SCROLL_MARGIN
}

export function createBuildState(
  context: BuildContext,
  cursor: Coord,
  viewport: Viewport,
): BuildState {
  const start = clampToGrid(cursor, context.grid)
  return {
    cursor: start,
    camera: followCursor({ x: 0, y: 0 }, start, viewport, context.grid, marginOf(context)),
    viewport,
    armed: null,
    planned: [],
    status: NO_STATUS,
    justPlacedAt: null,
    nextOrdinal: 1,
    nexusPick: null,
    bonusAllotment: 0,
    confirmingCommit: false,
    committed: false,
  }
}

/**
 * Why a state-changing command is refused right now, or `null` when none of these apply. Checked in
 * priority order — most-final first, exactly the way `legalityAt` checks affordability before a
 * tile: a player told to answer the confirmation when the real reason is "already committed" would
 * be sent to fix the wrong thing.
 */
function lockReason(state: BuildState): StatusMessage | null {
  if (state.committed) return status("The Build Phase is committed.", "warning")
  if (state.confirmingCommit) return status("Answer the Nexus Pulse prompt first: [y]es or [n]o.", "warning")
  if (state.nexusPick === null) return status("Pick a Nexus power first.", "warning")
  return null
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
 * What Enter would do right now with the armed structure, derived in one place: `place()` acts on
 * it, and the view draws it — the ghost under the cursor, the status line's live refusal, the panel's
 * effect line. "What you see is what Enter does" is then one function rather than several copies
 * that have to agree (they once disagreed about the budget, and later about the tile just built on).
 */
export type ArmedPreview = Readonly<{
  item: ConstructItem
  footprint: readonly Coord[]
  anchor: Coord
  /** The cursor is still on the tile this item was just placed on: Enter does nothing there, and the
   *  view lets the dimmed plan show through rather than recomputing "occupied by itself". */
  justPlaced: boolean
  /** Why Enter would be refused here, or `null` when it would place — or, on the just-placed tile,
   *  do nothing at all. */
  refusal: Refusal | null
}>

/** `null` when there is nothing to place: nothing armed, or the screen is locked (the Nexus draft,
 *  the commit confirmation, a committed Build Phase), where no ghost should be drawn either. */
export function armedPreview(context: BuildContext, state: BuildState): ArmedPreview | null {
  if (state.armed === null || lockReason(state) !== null) return null
  const item = context.catalog[state.armed]
  if (item === undefined) return null
  const footprint = context.registry.get(item.contentId).footprint
  const anchor = anchorForCursor(state.cursor, footprint)
  const justPlaced = state.justPlacedAt !== null && sameTile(state.justPlacedAt, state.cursor)
  // The same call, budget and all, whichever side is asking.
  const legality = justPlaced
    ? null
    : legalityAt(context, state.planned, item.contentId, anchor, remaining(context, state))
  const refusal: Refusal | null =
    legality === null || legality.ok
      ? null
      : { reason: legality.reason, ...(legality.tile === undefined ? {} : { tile: legality.tile }) }
  return { item, footprint, anchor, justPlaced, refusal }
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

/** Moves the cursor and lets it drag the camera — the one place scrolling ever happens. */
function withCursor(context: BuildContext, state: BuildState, tile: Coord): BuildState {
  const cursor = clampToGrid(tile, context.grid)
  const moved = !sameTile(cursor, state.cursor)
  // A refusal names a tile, and the view already recomputes its own live reading from wherever the
  // cursor now is — so a refusal left behind after the cursor moves away disagrees with what is drawn
  // above it. Every other message is about the last action rather than a tile, and stays until the
  // next one — and so does a tile-scoped one when the cursor did not actually move: pressing further
  // into the Grid's own edge is clamped back to the same tile, which is not "the cursor left the tile
  // this was about."
  const lapsed = moved && state.status.tile !== undefined
  return {
    ...state,
    cursor,
    camera: followCursor(state.camera, cursor, state.viewport, context.grid, marginOf(context)),
    status: lapsed ? NO_STATUS : state.status,
    justPlacedAt: moved ? null : state.justPlacedAt,
  }
}

function place(context: BuildContext, state: BuildState): BuildState {
  const lock = lockReason(state)
  if (lock !== null) return { ...state, status: lock }
  const preview = armedPreview(context, state)
  if (preview === null) {
    return { ...state, status: status("Nothing armed - press a construct menu key first.", "warning") }
  }
  // The tile a placement just succeeded on absorbs a repeated place entirely rather than re-placing
  // or recomputing a refusal against the plan's own last entry — the false "just failed" reading an
  // owner playtest found confusing. Nothing changes at all until the cursor actually moves.
  if (preview.justPlaced) return state
  if (preview.refusal !== null) {
    // Refused, and nothing moved. Silently sliding a structure to the nearest legal tile is the one
    // failure this check exists to prevent: the player would learn nothing and get a plan they did
    // not draw. The message is about this tile, so it lapses when the cursor leaves it — and its
    // "danger" tone is how the status line tells an attempt apart from merely looking: hovering an
    // illegal tile reads the same sentence quietly, trying to build there reads it in red.
    return { ...state, status: status(refusalText(preview.refusal), "danger", state.cursor) }
  }
  const { item, anchor } = preview
  return {
    ...state,
    planned: [
      ...state.planned,
      { ordinal: state.nextOrdinal, contentId: item.contentId, anchor },
    ],
    nextOrdinal: state.nextOrdinal + 1,
    justPlacedAt: state.cursor,
    // Still armed: engine.md 9.7's own fast path, "a run of the same structure is one digit
    // followed by arrows and Enter."
    status: status(
      `${shortName(context, item.contentId)} planned at ${state.cursor.x},${state.cursor.y} for ${item.cost}.`,
      "success",
    ),
  }
}

/**
 * One command, applied. `back` and `quit` pass through untouched — leaving the screen is not a
 * Build Phase concern, and the session that owns the disposer decides what either means, exactly as
 * `src/menu/list.ts` already does for the menu.
 */
export function applyBuildCommand(
  context: BuildContext,
  state: BuildState,
  command: BuildCommand,
): BuildState {
  switch (command.kind) {
    case "move-cursor":
      return withCursor(context, state, {
        x: state.cursor.x + command.dx,
        y: state.cursor.y + command.dy,
      })

    case "click-tile": {
      // Two clicks, not one — Q52 (2026-09-26), reversing gate 5A's own Q50. A click on a tile that
      // is not already where the cursor sits only moves the cursor there and shows the armed preview,
      // exactly like arriving by arrow keys; a second click **on that same tile** is what places, by
      // simply calling `place()` once the cursor is already there. Checked against `state.cursor`
      // (tile identity) rather than the click's own screen cell, which is what makes this safe against
      // the exact asymmetry Q50's own writeup found unsafe: a first click within the scroll margin can
      // slide the Grid under the pointer, so a second click at the same *screen position* can resolve
      // to a different *tile* — and correctly reads here as a fresh first click, not a wrong placement.
      const target = clampToGrid({ x: command.x, y: command.y }, context.grid)
      const confirming = state.armed !== null && target.x === state.cursor.x && target.y === state.cursor.y
      const moved = withCursor(context, state, target)
      return confirming ? place(context, moved) : moved
    }

    case "arm": {
      const lock = lockReason(state)
      if (lock !== null) return { ...state, status: lock }
      const item = context.catalog[command.index]
      if (item === undefined) return state
      return {
        ...state,
        armed: command.index,
        // A fresh arm always re-evaluates its own tile rather than inheriting a suppression the last
        // armed item earned — a different (or re-picked) item at this tile is a new question.
        justPlacedAt: null,
        status: status(`${item.label} selected - ${item.cost} to build.`),
      }
    }

    case "disarm":
      if (state.armed === null) return state
      return { ...state, armed: null, justPlacedAt: null, status: status("Disarmed.") }

    case "place":
      return place(context, state)

    case "remove": {
      const lock = lockReason(state)
      if (lock !== null) return { ...state, status: lock }
      const target = plannedAt(context, state.planned, state.cursor)
      if (target === null) return { ...state, status: status("Nothing planned under the cursor.", "warning") }
      return {
        ...state,
        planned: state.planned.filter((placement) => placement.ordinal !== target.ordinal),
        // The plan changed under the cursor, so "just placed here" no longer describes this tile —
        // left set, the next Enter here would be silently absorbed instead of placing again.
        justPlacedAt: null,
        status: status(`${shortName(context, target.contentId)} removed, ${costOf(context, target.contentId)} back.`),
      }
    }

    case "undo": {
      const lock = lockReason(state)
      if (lock !== null) return { ...state, status: lock }
      const last = state.planned[state.planned.length - 1]
      if (last === undefined) return { ...state, status: status("Nothing to undo.", "warning") }
      return {
        ...state,
        planned: state.planned.slice(0, -1),
        justPlacedAt: null,
        status: status(`${shortName(context, last.contentId)} undone, ${costOf(context, last.contentId)} back.`),
      }
    }

    case "pick-nexus": {
      // Defensively guarded like every other command, even though the keyboard and mouse adapters
      // only ever produce this while the draft is showing — a driver script is free to send one
      // anywhere, and the answer must be the same refusal a player pressing an unavailable key gets.
      if (state.nexusPick !== null) return { ...state, status: status("Already picked.", "warning") }
      const option = context.nexusDraft[command.index]
      if (option === undefined) return state
      return {
        ...state,
        nexusPick: command.index,
        bonusAllotment: option.bonusAllotment,
        status: status(`${option.name} picked.`, "success"),
      }
    }

    case "commit": {
      const lock = lockReason(state)
      if (lock !== null) return { ...state, status: lock }
      return { ...state, confirmingCommit: true, status: status("Start Nexus Pulse? [y]es / [n]o") }
    }

    case "confirm-commit": {
      // Meaningless outside the one moment it answers — a stray "y" is not a command here any more
      // than a stray "3" is one before anything is armed.
      if (!state.confirmingCommit) return state
      if (!command.accept) return { ...state, confirmingCommit: false, status: status("Cancelled.") }
      return {
        ...state,
        confirmingCommit: false,
        committed: true,
        status: status(
          `Build committed - ${state.planned.length} planned, Nexus Pulse would begin here (Milestone 6).`,
          "success",
        ),
      }
    }

    case "back":
    case "quit":
      return state

    default:
      return state
  }
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
    camera: followCursor(state.camera, state.cursor, viewport, context.grid, marginOf(context)),
  }
}
