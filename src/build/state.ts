// The Build Phase spike's pure reducer: a command in, the next state out. No terminal, no frame, no
// clock — the same separation `src/menu/list.ts` already draws for the menu, and for the same
// reason. Every claim gate 5A makes about scrolling and placement is a claim about this file, and
// none of it needs a TTY to check.

import { footprintCentre, inBounds, tilesOf } from "../grid/coords.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import { TERRAIN } from "../grid/types.ts"
import type { Camera, Viewport } from "./camera.ts"
import { SCROLL_MARGIN, clampToGrid, followCursor } from "./camera.ts"
import type {
  BuildCommand,
  ClickMode,
  ConstructItem,
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
  /**
   * How close to a viewport edge the cursor gets before the camera follows. Three tiles is the
   * canon's number, and `project-governance.md` Section 7 says in as many words that it is "locked
   * direction" whose tuning "Milestone 5 may retune on evidence from the first person who actually
   * scrolls a Grid". So the spike takes it as a parameter and puts it on the command line and in
   * the header — a number Mario can feel the difference between beats a number this session argues
   * for. Defaults to the canon's three.
   */
  scrollMargin?: number
}>

export type BuildState = Readonly<{
  cursor: Coord
  camera: Camera
  viewport: Viewport
  /** Index into `catalog`, or `null` for nothing armed. */
  armed: number | null
  planned: readonly PlannedPlacement[]
  clickMode: ClickMode
  /** In `confirm` click mode, the tile a first click landed on and a second click would place on.
   *  Always `null` in `place` mode, where there is no second click to wait for. */
  pendingConfirm: Coord | null
  /** The one line of feedback the footer shows: what just happened, or why it did not. */
  message: string
  nextOrdinal: number
}>

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
    clickMode: "place",
    pendingConfirm: null,
    message: "Pick a structure, move the cursor, place it.",
    nextOrdinal: 1,
  }
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

export type Legality = Readonly<{ ok: true }> | Readonly<{ ok: false; reason: string }>

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

/**
 * Why a placement is refused, in a sentence a player can act on. The Build Phase proper gets a whole
 * side panel for this (gate 5B); the spike needs only enough to prove that an illegal placement is
 * refused *with a reason* and — the part that actually matters — is **never silently moved to a
 * legal tile instead**.
 */
export function legalityAt(
  context: BuildContext,
  planned: readonly PlannedPlacement[],
  contentId: string,
  anchor: Coord,
): Legality {
  const footprint = context.registry.get(contentId).footprint
  const claimed = claimedTiles(context, planned)
  for (const tile of tilesOf(anchor, footprint)) {
    if (!inBounds(context.grid, tile)) return { ok: false, reason: "it would hang off the Grid" }
    const terrainId = context.grid.tiles[tile.y * context.grid.width + tile.x]
    if (terrainId !== undefined && TERRAIN[terrainId].impassable) {
      return { ok: false, reason: `there is rock at ${tile.x},${tile.y}` }
    }
    const occupant = claimed.get(`${tile.x},${tile.y}`)
    if (occupant !== undefined) {
      return { ok: false, reason: `it would overlap the ${shortName(context, occupant)}` }
    }
  }
  return { ok: true }
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
  return {
    ...state,
    cursor,
    camera: followCursor(state.camera, cursor, state.viewport, context.grid, marginOf(context)),
    // A cursor that moved is no longer waiting on a second click at the tile it left.
    pendingConfirm: null,
  }
}

function place(context: BuildContext, state: BuildState): BuildState {
  if (state.armed === null) {
    return { ...state, message: "Nothing armed - press a construct menu key first." }
  }
  const item = context.catalog[state.armed]
  if (item === undefined) return state
  const footprint = context.registry.get(item.contentId).footprint
  const anchor = anchorForCursor(state.cursor, footprint)
  const legality = legalityAt(context, state.planned, item.contentId, anchor)
  if (!legality.ok) {
    // Refused, and nothing moved. Silently sliding a structure to the nearest legal tile is the one
    // failure this check exists to prevent: the player would learn nothing and get a plan they did
    // not draw.
    return { ...state, pendingConfirm: null, message: `No - ${legality.reason}.` }
  }
  return {
    ...state,
    planned: [
      ...state.planned,
      { ordinal: state.nextOrdinal, contentId: item.contentId, anchor },
    ],
    nextOrdinal: state.nextOrdinal + 1,
    pendingConfirm: null,
    // Still armed: engine.md 9.7's own fast path, "a run of the same structure is one digit
    // followed by arrows and Enter."
    message: `Placed a ${shortName(context, item.contentId)} at ${state.cursor.x},${state.cursor.y}. Still armed.`,
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
      const tile = clampToGrid({ x: command.x, y: command.y }, context.grid)
      const onPendingTile =
        state.pendingConfirm !== null &&
        state.pendingConfirm.x === tile.x &&
        state.pendingConfirm.y === tile.y
      const moved = withCursor(context, state, tile)
      if (state.armed === null) return moved
      if (state.clickMode === "place") return place(context, moved)
      // `confirm` mode: the first click on a tile only arms the confirmation; the second one places.
      if (onPendingTile) return place(context, moved)
      return {
        ...moved,
        pendingConfirm: tile,
        message: `Click again at ${tile.x},${tile.y} to place, or press Enter.`,
      }
    }

    case "arm": {
      const item = context.catalog[command.index]
      if (item === undefined) return state
      return {
        ...state,
        armed: command.index,
        pendingConfirm: null,
        message: `Armed: ${shortName(context, item.contentId)}. Enter places it at the cursor.`,
      }
    }

    case "disarm":
      if (state.armed === null && state.pendingConfirm === null) return state
      return { ...state, armed: null, pendingConfirm: null, message: "Disarmed." }

    case "place":
      return place(context, state)

    case "remove": {
      const target = plannedAt(context, state.planned, state.cursor)
      if (target === null) return { ...state, message: "Nothing planned under the cursor." }
      return {
        ...state,
        planned: state.planned.filter((placement) => placement.ordinal !== target.ordinal),
        pendingConfirm: null,
        message: `Removed the planned ${shortName(context, target.contentId)}.`,
      }
    }

    case "undo": {
      const last = state.planned[state.planned.length - 1]
      if (last === undefined) return { ...state, message: "Nothing to undo." }
      return {
        ...state,
        planned: state.planned.slice(0, -1),
        pendingConfirm: null,
        message: `Undid the planned ${shortName(context, last.contentId)}.`,
      }
    }

    case "toggle-click-mode": {
      const clickMode: ClickMode = state.clickMode === "place" ? "confirm" : "place"
      return {
        ...state,
        clickMode,
        pendingConfirm: null,
        message:
          clickMode === "place"
            ? "Clicking a tile now places straight away."
            : "Clicking a tile now moves the cursor; click again to place.",
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
