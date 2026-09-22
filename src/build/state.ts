// The Build Phase's pure reducer: a command in, the next state out. No terminal, no frame, no
// clock — the same separation `src/menu/list.ts` draws for the menu, so every claim about scrolling
// and placement is checkable without a TTY.

import { footprintCentre, inBounds, tilesOf } from "../grid/coords.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import { TERRAIN } from "../grid/types.ts"
import type { Camera, Viewport } from "./camera.ts"
import { SCROLL_MARGIN, clampToGrid, followCursor } from "./camera.ts"
import type {
  BuildCommand,
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
}>

export type BuildState = Readonly<{
  cursor: Coord
  camera: Camera
  viewport: Viewport
  /** Index into `catalog`, or `null` for nothing armed. */
  armed: number | null
  planned: readonly PlannedPlacement[]
  /** The one line of feedback the footer shows: what just happened, or why it did not. */
  message: string
  nextOrdinal: number
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
  return context.allotment - spent(context, state)
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
    message: "",
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

/**
 * Why a placement is refused, in a form the panel can lay out rather than only print. `reason` is
 * the sentence; `tile` is the one the reason is about, when it is about a tile, so "there is rock
 * here" can point at *which* here — the difference between a panel that says why and one that only
 * says no (milestone-05-build-phase.md gate 5B).
 */
export type Legality =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: string; tile?: Coord }>

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
  const legality = legalityAt(
    context,
    state.planned,
    item.contentId,
    anchor,
    remaining(context, state),
  )
  if (!legality.ok) {
    // Refused, and nothing moved. Silently sliding a structure to the nearest legal tile is the one
    // failure this check exists to prevent: the player would learn nothing and get a plan they did
    // not draw.
    return { ...state, message: `Cannot build here: ${legality.reason}.` }
  }
  return {
    ...state,
    planned: [
      ...state.planned,
      { ordinal: state.nextOrdinal, contentId: item.contentId, anchor },
    ],
    nextOrdinal: state.nextOrdinal + 1,
    // Still armed: engine.md 9.7's own fast path, "a run of the same structure is one digit
    // followed by arrows and Enter."
    message: `${shortName(context, item.contentId)} planned at ${state.cursor.x},${state.cursor.y} for ${item.cost}.`,
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
      // "Move the cursor there; if a structure is armed, place it — the same as arrows then Enter"
      // (engine.md 9.7). Single-click placement is safe because a plan stays revisable until the
      // commit: `u` undoes the last one and Backspace removes the one under the cursor.
      const moved = withCursor(context, state, clampToGrid({ x: command.x, y: command.y }, context.grid))
      return state.armed === null ? moved : place(context, moved)
    }

    case "arm": {
      const item = context.catalog[command.index]
      if (item === undefined) return state
      return {
        ...state,
        armed: command.index,
        message: `${item.label} selected - ${item.cost} to build.`,
      }
    }

    case "disarm":
      if (state.armed === null) return state
      return { ...state, armed: null, message: "Disarmed." }

    case "place":
      return place(context, state)

    case "remove": {
      const target = plannedAt(context, state.planned, state.cursor)
      if (target === null) return { ...state, message: "Nothing planned under the cursor." }
      return {
        ...state,
        planned: state.planned.filter((placement) => placement.ordinal !== target.ordinal),
        message: `${shortName(context, target.contentId)} removed, ${costOf(context, target.contentId)} back.`,
      }
    }

    case "undo": {
      const last = state.planned[state.planned.length - 1]
      if (last === undefined) return { ...state, message: "Nothing to undo." }
      return {
        ...state,
        planned: state.planned.slice(0, -1),
        message: `${shortName(context, last.contentId)} undone, ${costOf(context, last.contentId)} back.`,
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
