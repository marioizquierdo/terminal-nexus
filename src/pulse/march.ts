// The march (pulse.md, routes; movement.md, the march): how an army walks for its side's goal as one, the Commander
// at its head and its lines in order. The owner, 2026-10-21: "Is it possible we make that line the commander? ... When
// the commander is not in battle, then a line from nexus to nexus (or target banner or campaign target marker)", and
// "rangers would defer to melee units while moving through the map so when they arrive at the enemy they are more or
// less already prepared in formation ... when marching next to other units they would yield and slowly
// self-arrange. Movement has many states and we should take advantage of that."
//
// **What a unit is doing, in a word** (`MoveState`): a unit *marches* when it walks for its side's goal — its side's
// target, or the enemy's Grid Nexus while that is beyond its engage reach — rather than for an enemy within its reach;
// one walking to an enemy within its reach is *engaged*; one that stands is fighting, gathered or idle (*standing*);
// one that runs is *fleeing*; one stepping off its own roofs the nearest way is *leaving the roof*; and a marcher that
// waits this tick for its army to come up round it is *yielding*. Only marchers keep the formation; an engaged unit
// fights as it always did.
//
// **Progress.** Each side has one march field a tick: the walk, for a body of one tile, to its march goal over the
// Grid's rock and the enemy's buildings that stand (units ignored, its own buildings open), worked out only when a
// yield is in question. A marcher's progress is its walk on it: smaller is further forward.
//
// **The guide.** A side's Commander, while she stands on the Grid (on the ground), is its guide. The
// guide line runs from her to the march goal — from the side's own Grid Nexus with no guide — and a marcher more than
// `BAND` columns off it takes, among its steps that are equally good, the one that brings it nearest the line
// (`bandOrder`). While she marches herself, no marcher but a backliner goes further forward than its line's place
// behind her (`PLACE`); once she fights, her army comes up to fight beside her.
//
// **Formation lines** (`lineOf`): a marcher of the short or the long line yields while a marching ally of a line ahead
// of it (melee before short before long), within `NEAR` columns of it, is not at least `SPACING` columns of progress
// ahead of it for each line between them. Backliners never yield and are never yielded to. Yielding goes one way, to a
// line ahead or to the guide, and the guide never yields, so no ring of units waits on itself.
//
// **Closing.** The formation is for the way there: a marcher with an enemy within `NEAR` columns of it is closing on
// the enemy, and yields no more, so a shooter walks up into its range behind a front that has stopped to fight rather
// than waiting on the allies queued behind it.
//
// Worked out once a tick, after perception has set every target and before intents read them, from the state the tick
// began with: positions, targets, distances and whole numbers only, so a mirrored map marches mirrored and the answer
// is the same in whatever order units are read. A unit that yields still walks, as far as the tick's routes are
// concerned (`purposeOf` is unchanged), so it is no wall: an ally behind it routes through it and swaps with it, or
// releases it (`intents.ts`).

import type { FormationLine } from "../content/types.ts"
import { lineOf } from "../content/types.ts"
import { footprintBox, tilesOf } from "../grid/coords.ts"
import type { Coord, Footprint } from "../grid/types.ts"
import type { Ground, RankedStep } from "../routing/index.ts"
import { addWall, DistanceField, goalsInside, goalsNear, groundFor, UNREACHABLE, wallsOf } from "../routing/index.ts"
import type { PlayerId, TargetArea } from "../state/types.ts"
import type { Purpose } from "./routes.ts"
import { purposeOf } from "./routes.ts"
import type { Actor, TickContext } from "./shared.ts"
import { distanceBetween, onRoof, resolveTarget, within } from "./shared.ts"
import { engageRange } from "./target.ts"

/** What a unit is doing this tick, as its movement goes: the states movement.md describes a unit's default behaviour
 *  by. */
export type MoveState = "marching" | "engaged" | "standing" | "fleeing" | "leaving the roof" | "yielding"

/** A line's place in the formation, front to back: a backliner first (it goes beyond the enemy's line, and keeps to
 *  none of its own), then melee, short range, long range. */
const RANK: Readonly<Record<FormationLine, number>> = { backliner: 0, melee: 1, short: 2, long: 3 }

/**
 * How far behind the guide each line marches, in columns of progress: the melee line may be up to 2 ahead of her,
 * the short range 4 behind her, the long range 8 behind. A marcher yields while it is further forward than that.
 */
const PLACE: Readonly<Record<Exclude<FormationLine, "backliner">, number>> = { melee: -2, short: 4, long: 8 }

/** How far apart, in progress, a line marches behind the line ahead of it, for each line between them. */
export const SPACING = 4

/** How near a marching ally of a line ahead must be for a unit to wait on it: 12 columns, measured as the Grid
 *  measures (a row counting two). */
export const NEAR = 12

/** The guide line's band, each side of it: a marcher further than 6 columns off it is drawn back toward it. */
export const BAND = 6

const ONE_TILE: Footprint = [{ x: 0, y: 0 }]

/** Where a side marches: its target, or the enemy's Grid Nexus. */
type MarchGoal = Readonly<{ kind: "area"; area: TargetArea }> | Readonly<{ kind: "nexus"; nexus: Actor }>

/** One side's march this tick. */
type SideMarch = {
  readonly player: PlayerId
  readonly goal: MarchGoal
  /** The walk from every tile to the goal, for one tile, over rock and the enemy's buildings: worked out the first
   *  time a yield is in question (`marchFieldOf`). */
  field?: DistanceField
  /** Its guide, while it has one: its Commander, on the Grid and on the ground. */
  readonly guide: Actor | null
  /** The guide line's two ends, in half tiles (a tile's middle is twice its coordinates), or `null` with no line. */
  readonly ends: Readonly<{ from: Coord; to: Coord }> | null
  /** How far each tile is from the guide line, a row counting two columns: worked out the first time it is asked. */
  lane?: DistanceField
}

/** The march this tick, for every side: who marches, who yields, and each side's field and line. */
export class March {
  private readonly context: TickContext
  private readonly sides: ReadonlyMap<PlayerId, SideMarch>
  /** The ordinals of the units that march this tick, yielders included. */
  readonly marching: ReadonlySet<number>
  /** The ordinals of the marchers that wait this tick for their army. */
  readonly yielding: ReadonlySet<number>

  constructor(context: TickContext, sides: ReadonlyMap<PlayerId, SideMarch>, marching: ReadonlySet<number>, yielding: ReadonlySet<number>) {
    this.context = context
    this.sides = sides
    this.marching = marching
    this.yielding = yielding
  }

  /**
   * **The band**: `groups` (a marcher's steps, as `rankSteps` ranks them) with the steps that tie for the best walk
   * put in order of how near each lands to its side's guide line, nearest first, when `actor` stands more than `BAND`
   * columns off it; then by the turn, as before. Unchanged inside the band, for a unit that does not march, and on a
   * side with no line.
   */
  bandOrder(actor: Actor, groups: RankedStep[][]): RankedStep[][] {
    if (!this.marching.has(actor.ordinal)) return groups
    const side = this.sides.get(actor.player)
    if (side === undefined || side.ends === null) return groups
    const total = (candidate: RankedStep): number => candidate.cost + candidate.after
    const best = groups[0]?.[0]
    if (best === undefined) return groups
    let tiedGroups = 0
    while (tiedGroups < groups.length && total(groups[tiedGroups]?.[0] as RankedStep) === total(best)) tiedGroups += 1
    const tied = groups.slice(0, tiedGroups).flat()
    if (tied.length < 2) return groups
    const lane = this.laneOf(side)
    const offLine = (anchor: Coord): number => nearestOn(lane, anchor, actor.definition.footprint)
    if (offLine(actor.anchor) <= BAND) return groups
    const keyed = tied.map((candidate) => ({ candidate, off: offLine(candidate.to) })).sort((a, b) => a.off - b.off || a.candidate.turn - b.candidate.turn)
    const regrouped: RankedStep[][] = []
    let last: (typeof keyed)[number] | undefined
    for (const entry of keyed) {
      const group = regrouped[regrouped.length - 1]
      if (group !== undefined && last !== undefined && last.off === entry.off && last.candidate.turn === entry.candidate.turn) group.push(entry.candidate)
      else regrouped.push([entry.candidate])
      last = entry
    }
    return [...regrouped, ...groups.slice(tiedGroups)]
  }

  /** How far each tile is from `side`'s guide line, a row counting two columns: a field from the line's tiles over
   *  open ground, worked out once a tick and only when a marcher asks. */
  private laneOf(side: SideMarch): DistanceField {
    if (side.lane === undefined) {
      const { width, height } = this.context.index.grid
      const open: Ground = { width, height, open: new Uint8Array(width * height).fill(1) }
      side.lane = new DistanceField(open, side.ends === null ? [] : lineTiles(side.ends.from, side.ends.to))
    }
    return side.lane
  }
}

/** The state `actor` is in this tick, given its purpose (`purposeOf`) and the tick's march. */
export function moveStateOf(context: TickContext, actor: Actor, purpose: Purpose): MoveState {
  if (purpose.kind === "stand") return "standing"
  if (purpose.kind === "flee") return "fleeing"
  const goal = purpose.goal
  if (goal.kind === "ground") return "leaving the roof"
  if (goal.kind === "unit" && !marchesOn(actor, goal.target)) return "engaged"
  return context.march?.yielding.has(actor.ordinal) === true ? "yielding" : "marching"
}

/** Whether a unit walking to `target` walks for its side's goal: the enemy's Grid Nexus, while it is beyond the
 *  unit's engage reach. */
function marchesOn(actor: Actor, target: Actor): boolean {
  return target.definition.nexus === true && target.player !== actor.player && !within(actor, target, engageRange(actor.definition))
}

/** Whether a purpose is a march: a walk to its side's target, or to the enemy's Nexus while it is beyond reach. */
function isMarch(actor: Actor, purpose: Purpose): boolean {
  if (purpose.kind !== "walk") return false
  const goal = purpose.goal
  return goal.kind === "area" || (goal.kind === "unit" && marchesOn(actor, goal.target))
}

/** A unit's line in the march: its own, on the ground; a flyer passes over the ranks and keeps none. */
function keepsLine(actor: Actor): FormationLine | null {
  return actor.definition.layer === "air" ? null : lineOf(actor.definition)
}

/**
 * The tick's march: who marches, and who yields. Read after perception has set every target (`perception.ts`), from
 * the state the tick began with; a side with nothing marching costs nothing.
 */
export function marchOf(context: TickContext): March {
  const marching = new Set<number>()
  const bySide = new Map<PlayerId, Actor[]>()
  for (const actor of context.actors) {
    if (actor.pendingDead || actor.definition.layer === "obstacles") continue
    if (!isMarch(actor, purposeOf(context, actor, resolveTarget(context, actor)))) continue
    marching.add(actor.ordinal)
    const side = bySide.get(actor.player)
    if (side === undefined) bySide.set(actor.player, [actor])
    else side.push(actor)
  }
  const sides = new Map<PlayerId, SideMarch>()
  const yielding = new Set<number>()
  for (const [player, marchers] of bySide) {
    const side = sideMarchOf(context, player)
    if (side === null) continue
    sides.set(player, side)
    const guideMarches = side.guide !== null && marching.has(side.guide.ordinal)
    for (const ordinal of yieldersOf(context, side, marchers, guideMarches)) yielding.add(ordinal)
  }
  return new March(context, sides, marching, yielding)
}

/** One side's march goal, field, guide and line, or `null` when it has nowhere to march to. */
function sideMarchOf(context: TickContext, player: PlayerId): SideMarch | null {
  const area = context.targets[player]
  const nexus = area === undefined ? context.actors.find((other) => other.player !== player && !other.pendingDead && other.definition.nexus === true) : undefined
  const goal: MarchGoal | null = area !== undefined ? { kind: "area", area } : nexus !== undefined ? { kind: "nexus", nexus } : null
  if (goal === null) return null
  // Her side's Commander, on the Grid and on the ground.
  const guide = context.actors.find((other) => other.player === player && !other.pendingDead && other.definition.commander === true && other.definition.layer !== "air") ?? null
  const to = goal.kind === "area" ? { x: 2 * goal.area.x + goal.area.width - 1, y: 2 * goal.area.y + goal.area.height - 1 } : middleOf(goal.nexus)
  const home = guide ?? context.actors.find((other) => other.player === player && !other.pendingDead && other.definition.nexus === true)
  return { player, goal, guide, ends: home === undefined ? null : { from: middleOf(home), to } }
}

/** `side`'s march field: the walk to its goal for a body of one tile, over the Grid's rock and the enemy's buildings
 *  that stand (units are no walls to a march, and its own buildings are open). Worked out once a tick, when asked. */
function marchFieldOf(context: TickContext, side: SideMarch): DistanceField {
  if (side.field === undefined) {
    const walls = wallsOf(context.index.grid, "impassable")
    for (const other of context.actors) {
      if (other.pendingDead || other.player === side.player || other.definition.layer !== "obstacles") continue
      addWall(walls, other.anchor, other.definition.footprint)
    }
    const ground = groundFor(walls, ONE_TILE)
    const goal = side.goal
    const goals = goal.kind === "area" ? goalsInside(ground, ONE_TILE, goal.area) : goalsNear(ground, ONE_TILE, goal.nexus.anchor, goal.nexus.definition.footprint, { kind: "touch", steps: 1 })
    side.field = new DistanceField(ground, goals)
  }
  return side.field
}

/** The middle of an actor's body, in half tiles: twice its coordinates for a tile, between two tiles for an even
 *  width. */
function middleOf(actor: Actor): Coord {
  const box = footprintBox(actor.anchor, actor.definition.footprint)
  return { x: box.left + box.right, y: box.top + box.bottom }
}

/** The walk to the field's goal from `actor`'s nearest tile. */
function progressOn(field: DistanceField, actor: Actor): number {
  return nearestOn(field, actor.anchor, actor.definition.footprint)
}

/** The least of `field` over the tiles of a body anchored at `anchor`: the same for a body and its mirror. */
function nearestOn(field: DistanceField, anchor: Coord, body: Footprint): number {
  let best = UNREACHABLE
  for (const tile of tilesOf(anchor, body)) best = Math.min(best, field.distanceAt(tile))
  return best
}

/**
 * Which of a side's marchers yield this tick. A marcher with a line, other than a backliner and the guide, yields when
 * it is further forward than its line's place behind the guide while she marches (**pacing**), or, in the short or the
 * long line, when a marching ally of a line ahead of it within `NEAR` columns is not `SPACING` columns of progress ahead
 * of it for each line between them (**lines**); unless an enemy stands within `NEAR` columns of it (**closing**). Each
 * against the progress every one had as the tick began.
 */
function yieldersOf(context: TickContext, side: SideMarch, marchers: readonly Actor[], guideMarches: boolean): number[] {
  type Member = Readonly<{ actor: Actor; line: FormationLine; rank: number; progress: number }>
  const placed: Array<Readonly<{ actor: Actor; line: FormationLine }>> = []
  for (const actor of marchers) {
    const line = keepsLine(actor)
    // A unit still on its own roof keeps no place yet: it steps off first, so the building has room for the next.
    if (line === null || onRoof(context, actor)) continue
    placed.push({ actor, line })
  }
  // Nothing to work out when no one could yield: no guide marching ahead of anyone, and no line behind another.
  const ranks = placed.filter((each) => each.line !== "backliner" && each.actor !== side.guide).map((each) => RANK[each.line])
  const paced = guideMarches && ranks.length > 0
  const lined = ranks.some((rank) => rank >= 2) && ranks.some((rank) => rank < Math.max(...ranks))
  if (!paced && !lined) return []
  const field = marchFieldOf(context, side)
  const guideProgress = side.guide === null ? UNREACHABLE : progressOn(field, side.guide)
  const members: Member[] = []
  for (const { actor, line } of placed) {
    const progress = progressOn(field, actor)
    if (progress !== UNREACHABLE) members.push({ actor, line, rank: RANK[line], progress })
  }
  // The lines ahead, for the short and long lines to look for: the melee and short lines' members.
  const ahead = members.filter((member) => member.rank === 1 || member.rank === 2)
  const enemies = context.actors.filter((other) => other.player !== side.player && !other.pendingDead)
  const closing = (actor: Actor): boolean => closingOn(actor, enemies)
  const yielders: number[] = []
  for (const member of members) {
    if (member.line === "backliner" || member.actor === side.guide) continue
    if (guideMarches && guideProgress !== UNREACHABLE && member.progress < guideProgress + PLACE[member.line]) {
      if (!closing(member.actor)) yielders.push(member.actor.ordinal)
      continue
    }
    if (member.rank < 2) continue
    const waits = ahead.some(
      (ally) =>
        ally.rank < member.rank &&
        ally.actor !== member.actor &&
        ally.progress > member.progress - SPACING * (member.rank - ally.rank) &&
        // Cheap first: two bodies far apart on the Grid are never near.
        Math.abs(ally.actor.anchor.x - member.actor.anchor.x) <= NEAR + 8 &&
        Math.abs(ally.actor.anchor.y - member.actor.anchor.y) <= NEAR / 2 + 8 &&
        distanceBetween(ally.actor, member.actor) <= NEAR,
    )
    if (waits && !closing(member.actor)) yielders.push(member.actor.ordinal)
  }
  return yielders
}

/** Whether an enemy of any kind stands within `NEAR` columns of `actor`, measured as `distanceBetween` measures (a row
 *  counting two columns): `enemies` are the other side's, as the tick began. */
function closingOn(actor: Actor, enemies: readonly Actor[]): boolean {
  for (const enemy of enemies) {
    // Cheap first: a body far off on the Grid is never near.
    if (Math.abs(enemy.anchor.x - actor.anchor.x) > NEAR + 8 || Math.abs(enemy.anchor.y - actor.anchor.y) > NEAR / 2 + 8) continue
    if (distanceBetween(actor, enemy) <= NEAR) return true
  }
  return false
}

/**
 * The tiles of the line between two points given in half tiles (`middleOf`), as the Grid draws a straight line with
 * whole numbers: a point every half tile of the longer way, each on its nearest tile — and on both, where it falls
 * exactly between two — so a line and its mirror cover mirrored tiles, whichever end of the map it starts from.
 */
export function lineTiles(from: Coord, to: Coord): Coord[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1)
  const seen = new Set<string>()
  const tiles: Coord[] = []
  for (let t = 0; t <= steps; t += 1) {
    // The point, in tiles, is (from * steps + t * d) / (2 * steps) on each axis.
    for (const x of nearestWhole(from.x * steps + t * dx, 2 * steps)) {
      for (const y of nearestWhole(from.y * steps + t * dy, 2 * steps)) {
        const key = `${x},${y}`
        if (seen.has(key)) continue
        seen.add(key)
        tiles.push({ x, y })
      }
    }
  }
  return tiles
}

/** The whole numbers nearest `numerator / denominator` (`denominator` above 0): one, or both where it is exactly
 *  between two. */
function nearestWhole(numerator: number, denominator: number): number[] {
  const whole = Math.floor(numerator / denominator)
  const rest = numerator - whole * denominator
  if (2 * rest < denominator) return [whole]
  if (2 * rest > denominator) return [whole + 1]
  return [whole, whole + 1]
}
