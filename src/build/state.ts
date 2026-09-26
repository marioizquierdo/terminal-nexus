// The Build Phase's pure reducer: a command in, the next state out. No terminal, no frame, no
// clock — the same separation `src/menu/list.ts` draws for the menu, so every claim about scrolling
// and placement is checkable without a TTY.

import { footprintCentre, footprintExtent, inBounds, tilesOf } from "../grid/coords.ts"
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
  Focus,
  MenuEntry,
  NexusPowerOption,
  Overlay,
  PlannedPlacement,
  StandingStructure,
} from "./types.ts"

/**
 * Where keyboard focus goes after a successful placement — Q57, open. `"origin"` is its
 * recommendation and the default: back to wherever the arming came from (the menu for a
 * menu-driven arm, the Grid for a digit or a click on a row). `"menu"` and `"grid"` are its other two
 * options, always and never. A context field rather than a guess baked in, so gate 5G's Debug Mode
 * can let the owner feel all three.
 */
export type FocusAfterPlace = "origin" | "menu" | "grid"

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
  /** Q55's smart cursor: arming from the menu moves the cursor to a tile the structure can go.
   *  Defaults on; off leaves the cursor where it is, which is the comparison gate 5G's Debug Mode
   *  offers. */
  smartCursor?: boolean
  /** Q57 — see `FocusAfterPlace`. Defaults to its recommendation, `"origin"`. */
  focusAfterPlace?: FocusAfterPlace
}>

export type BuildState = Readonly<{
  cursor: Coord
  camera: Camera
  viewport: Viewport
  /** Index into `catalog`, or `null` for nothing armed. */
  armed: number | null
  /** How the armed item was armed: from the menu's highlight (`activate`), or by its hotkey — a
   *  digit, or a click on its row. Decides where focus goes after a placement (Q57's "back to
   *  wherever the arming came from"). Meaningless while nothing is armed. */
  armedFrom: "menu" | "hotkey"
  /** Which half of the screen the arrow keys and Enter/Space belong to (engine.md 9.7, gate 5F).
   *  Reducer state, not adapter state, so a driver can assert it and the key help can say it. */
  focus: Focus
  /** Index into `menuEntries(context)` — the side panel's highlighted entry. Drawn only while the
   *  menu has focus; kept while it does not, so Tab returns to the same row. */
  menuHighlight: number
  /** The overlay drawn over the Grid and holding the keyboard, or `null`. Never opened by anything
   *  but the player (owner, 2026-09-26). */
  overlay: Overlay | null
  /** Index into the popup's pending powers — its own highlight, reset whenever it opens. */
  overlayHighlight: number
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
  /** Index into `context.nexusDraft`, or `null` before a pick. A Nexus power, once dealt, may not be
   *  skipped (`commander-armies.md` Section 4.5), so the **commit** is refused until this stops being
   *  `null` — and, since gate 5F, only the commit: everything else proceeds, so an optional popup
   *  does not nag like a forced one (engine.md 9.7). */
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
    armedFrom: "hotkey",
    // The menu, on its first entry — the side panel is where the owner's eyes went first (2026-09-26),
    // and the first entry is the Nexus Powers one, so Enter from a standing start opens the choice
    // the commit will eventually insist on.
    focus: "menu",
    menuHighlight: 0,
    overlay: null,
    overlayHighlight: 0,
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
  if (state.confirmingCommit) return status("Answer the Nexus Pulse prompt first: [y]es or [n]o.", "warning")
  if (state.overlay !== null) return status("Close Nexus Powers first: [esc].", "warning")
  return null
}

/** Why the commit is refused right now: everything `editLock` says, and — the one place it is
 *  enforced — a dealt Nexus power that has not been picked (`commander-armies.md` Section 4.5). */
function commitLock(state: BuildState): StatusMessage | null {
  const edit = editLock(state)
  if (edit !== null) return edit
  if (state.nexusPick === null) return status("Pick a Nexus power first: [n] Nexus Powers.", "warning")
  return null
}

/**
 * The side panel's menu, in the order Up/Down walk it — the Nexus Powers entry first, then every
 * construct row. Derived from the catalog rather than stored, so the highlight and the rows drawn
 * can never disagree about how many there are.
 */
export function menuEntries(context: BuildContext): readonly MenuEntry[] {
  return [{ kind: "nexus" }, ...context.catalog.map((_, index) => ({ kind: "construct" as const, index }))]
}

/** The menu entry a construct row is — so arming by digit moves the highlight onto its row, and Tab
 *  back to the menu lands where the player's attention already is. */
function entryOfConstruct(index: number): number {
  return index + 1
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

/** `null` when there is nothing to place: nothing armed, or the plan cannot be edited right now (an
 *  open overlay, the commit confirmation, a committed Build Phase), where no ghost should be drawn
 *  either. */
export function armedPreview(context: BuildContext, state: BuildState): ArmedPreview | null {
  if (state.armed === null || editLock(state) !== null) return null
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

/** Q57: where focus goes once a placement succeeds. Its recommendation, the default, sends it back to
 *  wherever the arming came from — so the menu-driven flow ("down, down, space, place, space,
 *  place") and the digit-then-arrows fast path both keep working. */
function focusAfterPlacing(context: BuildContext, state: BuildState): Focus {
  const rule = context.focusAfterPlace ?? "origin"
  if (rule === "menu" || rule === "grid") return rule
  return state.armedFrom === "menu" ? "menu" : "grid"
}

/**
 * Arms catalog row `index`: the one path a digit, a click on the row and the menu's own Enter/Space
 * share. Focus moves to the Grid, where the placing happens, and the menu highlight follows the row,
 * so Tab or Esc back to the menu lands on what was just armed. Only a menu-driven arm moves the
 * cursor (Q55): a digit is the fast path of a player already pointing somewhere.
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
  const armed: BuildState = {
    ...state,
    armed: index,
    armedFrom: from,
    focus: "grid",
    menuHighlight: entryOfConstruct(index),
    // A fresh arm always re-evaluates its own tile rather than inheriting a suppression the last
    // armed item earned — a different (or re-picked) item at this tile is a new question.
    justPlacedAt: null,
  }
  const smart =
    from === "menu" && context.smartCursor !== false
      ? smartCursorTile(context, state.planned, item.contentId, state.cursor)
      : null
  const moved = smart === null ? armed : withCursor(context, armed, smart)
  return { ...moved, status: status(`${item.label} selected - ${item.cost} to build.`) }
}

/** Enter/Space on the menu: whatever the highlighted entry is for. */
function activateMenu(context: BuildContext, state: BuildState): BuildState {
  const entry = menuEntries(context)[state.menuHighlight]
  if (entry === undefined) return state
  if (entry.kind === "nexus") return openNexusPowers(state)
  return armItem(context, state, entry.index, "menu")
}

function openNexusPowers(state: BuildState): BuildState {
  // Reading the powers does not edit the plan, but the commit question and a committed Build Phase
  // each own the whole screen, and a popup over either would be a second question on top of one.
  if (state.committed || state.confirmingCommit) return { ...state, status: editLock(state) ?? state.status }
  return { ...state, overlay: "nexus-powers", overlayHighlight: 0 }
}

function pickNexus(context: BuildContext, state: BuildState, index: number): BuildState {
  // Defensively guarded like every other command: a driver script is free to send one anywhere, and
  // the answer must be the same refusal a player pressing an unavailable key gets. An open popup is
  // where a pick is normally made, so unlike the edits it is not a reason to refuse one.
  if (state.committed || state.confirmingCommit) return { ...state, status: editLock(state) ?? state.status }
  if (state.nexusPick !== null) return { ...state, status: status("Already picked.", "warning") }
  const option = context.nexusDraft[index]
  if (option === undefined) return state
  return {
    ...state,
    nexusPick: index,
    bonusAllotment: option.bonusAllotment,
    overlayHighlight: 0,
    status: status(`${option.name} picked.`, "success"),
  }
}

function place(context: BuildContext, state: BuildState): BuildState {
  const lock = editLock(state)
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
    focus: focusAfterPlacing(context, state),
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
      // A click on the Grid is attention on the Grid: it takes keyboard focus there too, so the next
      // arrow press moves the cursor that was just clicked rather than a menu highlight.
      const moved = { ...withCursor(context, state, target), focus: "grid" as const }
      return confirming ? place(context, moved) : moved
    }

    case "arm":
      return armItem(context, state, command.index, "hotkey")

    case "disarm":
      // Esc on the Grid, and a right click: cancel, and give the keyboard back to the menu (Q57 — the
      // same "cancel" Esc already was, one level further). With nothing armed, only the focus moves.
      if (state.armed === null) return state.focus === "menu" ? state : { ...state, focus: "menu" }
      return { ...state, armed: null, justPlacedAt: null, focus: "menu", status: status("Disarmed.") }

    case "place":
      return place(context, state)

    case "remove": {
      const lock = editLock(state)
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
      const lock = editLock(state)
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

    case "pick-nexus":
      return pickNexus(context, state, command.index)

    case "commit": {
      const lock = commitLock(state)
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

    case "focus":
      // An open overlay holds the keyboard until it is closed (engine.md 9.7).
      if (state.overlay !== null || state.focus === command.target) return state
      return { ...state, focus: command.target }

    case "highlight": {
      if (state.overlay !== null) {
        const count = nexusPowers(context, state).pending.length
        return { ...state, overlayHighlight: wrap(state.overlayHighlight + command.delta, count) }
      }
      const count = menuEntries(context).length
      return { ...state, menuHighlight: wrap(state.menuHighlight + command.delta, count) }
    }

    case "activate": {
      if (state.overlay === null) return activateMenu(context, state)
      const pending = nexusPowers(context, state).pending[state.overlayHighlight]
      if (pending === undefined) return { ...state, status: status("No Nexus power waiting.", "warning") }
      return pickNexus(context, state, pending.index)
    }

    case "open-nexus-powers":
      return openNexusPowers(state)

    case "close-overlay":
      return state.overlay === null ? state : { ...state, overlay: null }

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
