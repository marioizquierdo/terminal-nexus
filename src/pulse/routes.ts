// The tick's routes (milestone 16, "the tick's routes"): the distance fields a tick's movers walk by, built from
// routing's parts (`src/routing/`) and the state the tick began with, once a tick, and shared.
//
// **What stands still is a wall; what walks is not.** A building, a unit fighting what its attack reaches, a unit
// standing at its side's target, a unit that cannot move: none of them will step this tick, so a route goes round them,
// and a crowd round one target spreads to the tiles still free beside it rather than queuing behind the first. A unit
// that walks is no wall: it will have moved by the time a follower gets there, and the tick order settles who steps
// where (arbitration). Who walks is decided before anyone moves (`intents.ts`, `walkers`), from the same state, so the
// walls are the same whichever unit asks first.
//
// A field is kept by what decides it — the ground (what a body collides with, and its shape) and the goal — so every
// unit of the same shape heading for the same goal walks one field. A goal is the anchors from which a unit's attack
// reaches its target (`goalsNear`) or from which it stands inside its side's target (`goalsInside`): a route ends where
// an attack begins. Pure: built from the tick's state, never kept from one tick to the next, the same on every machine.

import { gridDistance, tilesOf } from "../grid/coords.ts"
import type { Coord, Footprint } from "../grid/types.ts"
import type { Area, Ground, Reach, Seed } from "../routing/index.ts"
import { addWall, bodyKey, canStand, DistanceField, goalsInside, goalsNear, groundFor, UNREACHABLE, wallsOf, weightsFor } from "../routing/index.ts"
import type { TargetArea } from "../state/types.ts"
import type { Actor, TickContext } from "./shared.ts"
import { drawAmong, inAttackRange, sideLayerOf, within } from "./shared.ts"
import { fleeTrigger } from "./perception.ts"
import { insideArea, targetFor } from "./target.ts"

/** Where a mover heads: a unit's footprint — an enemy's, or a wounded ally's for a healer — to stand where its attack
 *  reaches it, or its side's target. */
export type RouteGoal =
  | Readonly<{ kind: "unit"; target: Actor; reach: Reach }>
  | Readonly<{ kind: "area"; area: TargetArea }>

/** The reach a unit's goal is measured by: what its attack reaches, or touching, for a unit with no attack. */
export function reachOf(actor: Actor): Reach {
  const attack = actor.definition.attack
  if (attack === undefined) return { kind: "touch", steps: 1 }
  return attack.kind === "melee" ? { kind: "touch", steps: attack.range } : { kind: "within", radius: attack.range }
}

const maskKey = (actor: Actor): string => {
  const side = sideLayerOf(actor.definition)
  return `${actor.definition.layer === "air" ? "air" : "ground"}:${[...actor.definition.collidesWith].sort().join(",")}${side === null ? "" : `|${side} of ${actor.player === "A" ? "B" : "A"}`}`
}

const goalKey = (goal: RouteGoal): string =>
  goal.kind === "unit"
    ? `unit:${goal.target.ordinal}@${goal.target.anchor.x},${goal.target.anchor.y}:${goal.reach.kind === "touch" ? `t${goal.reach.steps}` : `w${goal.reach.radius}`}`
    : `area:${goal.area.x},${goal.area.y},${goal.area.width},${goal.area.height}`

export class TickRoutes {
  private readonly context: TickContext
  private readonly walking: ReadonlySet<number>
  private readonly grounds = new Map<string, Ground>()
  private readonly fields = new Map<string, DistanceField>()
  private readonly weights = new Map<string, Uint8Array | null>()
  private readonly patches = new Map<string, Int32Array>()
  private readonly nearest = new Map<string, Coord[]>()

  /** `walking`: the ordinals of the actors that walk this tick; every other actor stands, and is a wall. */
  constructor(context: TickContext, walking: ReadonlySet<number>) {
    this.context = context
    this.walking = walking
  }

  /**
   * The ground `actor`'s body walks on this tick: its mask's walls, for its shape. `alsoStanding`, when given, are
   * walkers to count as standing too — the ones held up this tick, for a unit finding its own way round them
   * (`detourOf`); such ground is the actor's own and is not kept.
   */
  groundOf(actor: Actor, alsoStanding?: ReadonlySet<number>): Ground {
    const key = `${maskKey(actor)}|${bodyKey(actor.definition.footprint)}`
    const kept = alsoStanding === undefined ? this.grounds.get(key) : undefined
    if (kept !== undefined) return kept
    const layers = actor.definition.collidesWith
    const side = sideLayerOf(actor.definition)
    const walls = wallsOf(this.context.index.grid, actor.definition.layer === "air" ? "ignore" : "impassable")
    for (const other of this.context.actors) {
      if (other.pendingDead || other === actor) continue
      if (this.walking.has(other.ordinal) && alsoStanding?.has(other.ordinal) !== true) continue
      // What it collides with, of either side; on the layer it shares with its own side, only the enemy's.
      const blocks = layers.includes(other.definition.layer) || (other.definition.layer === side && other.player !== actor.player)
      if (blocks) addWall(walls, other.anchor, other.definition.footprint)
    }
    const ground = groundFor(walls, actor.definition.footprint)
    if (alsoStanding === undefined) this.grounds.set(key, ground)
    return ground
  }

  /** What stepping onto each anchor costs `actor`'s body: slow ground weighed in (`weightsFor`), or `null` on a Grid
   *  with none. Kept for the tick by the body's shape and how it moves. */
  weightsOf(actor: Actor): Uint8Array | null {
    const key = `${maskKey(actor)}|${bodyKey(actor.definition.footprint)}`
    if (!this.weights.has(key)) {
      this.weights.set(key, weightsFor(this.context.index.grid, actor.definition.footprint, actor.definition.layer === "air" ? "ignore" : "impassable"))
    }
    return this.weights.get(key) ?? null
  }

  /** The field `actor` walks toward `goal` by, shared with every actor of its mask and shape heading there. */
  fieldOf(actor: Actor, goal: RouteGoal): DistanceField {
    const key = `${maskKey(actor)}|${bodyKey(actor.definition.footprint)}|${goalKey(goal)}`
    let field = this.fields.get(key)
    if (field === undefined) {
      field = fieldOver(this.groundOf(actor), this.weightsOf(actor), actor, goal)
      this.fields.set(key, field)
    }
    return field
  }

  /**
   * How far, to walk, every anchor is from the nearest enemy that can strike: a field from the tiles beside each of
   * them, over `actor`'s ground. A unit that flees walks it uphill, away from all of them at once, round rock and into
   * open ground, rather than straight away from the nearest (`intents.ts`). Shared by the units of one side, body
   * and ground.
   */
  dangerOf(actor: Actor): DistanceField {
    const key = `${maskKey(actor)}|${bodyKey(actor.definition.footprint)}|danger of ${actor.player}`
    let field = this.fields.get(key)
    if (field === undefined) {
      const ground = this.groundOf(actor)
      const goals: Coord[] = []
      for (const threat of this.context.actors) {
        if (threat.player === actor.player || threat.pendingDead || threat.definition.attack === undefined) continue
        goals.push(...goalsNear(ground, actor.definition.footprint, threat.anchor, threat.definition.footprint, { kind: "touch", steps: 1 }))
      }
      field = new DistanceField(ground, goals, this.weightsOf(actor) ?? undefined)
      this.fields.set(key, field)
    }
    return field
  }

  /**
   * Where a unit that flees should go, as a field to walk downhill: the flight map of roguelikes. Every anchor starts
   * at a cost that falls as its danger rises — 1.2 times its walk from the nearest threat, taken from the furthest any
   * anchor stands — and the field is worked out from all of them at once. Walking it downhill takes a unit away from
   * every threat and toward open ground, and the 1.2 makes running past a threat toward the open better than backing
   * into a corner, where straight away from the nearest would go. Ground no threat can reach is the safest of all.
   */
  safetyOf(actor: Actor): DistanceField {
    const key = `${maskKey(actor)}|${bodyKey(actor.definition.footprint)}|safety of ${actor.player}`
    let field = this.fields.get(key)
    if (field === undefined) {
      const ground = this.groundOf(actor)
      const danger = this.dangerOf(actor)
      const reach: number[] = []
      let furthest = 0
      for (let index = 0; index < ground.open.length; index += 1) {
        if (ground.open[index] !== 1) continue
        const walk = danger.distanceAt({ x: index % ground.width, y: Math.floor(index / ground.width) })
        reach[index] = walk
        if (walk !== UNREACHABLE && walk > furthest) furthest = walk
      }
      const seeds: Seed[] = []
      for (let index = 0; index < ground.open.length; index += 1) {
        if (ground.open[index] !== 1) continue
        const walk = Math.min(reach[index] ?? UNREACHABLE, furthest + 1)
        seeds.push({ anchor: { x: index % ground.width, y: Math.floor(index / ground.width) }, cost: Math.round((6 * (furthest + 1 - walk)) / 5) })
      }
      field = new DistanceField(ground, seeds, this.weightsOf(actor) ?? undefined)
      this.fields.set(key, field)
    }
    return field
  }

  /**
   * A field of `actor`'s own toward `goal`, round the walkers in `held` as well as what stands: for a unit held up
   * behind allies that are held up themselves, so a crowd that cannot move is walked round rather than waited on for
   * good. Not kept: it is one unit's, this tick.
   */
  detourOf(actor: Actor, goal: RouteGoal, held: ReadonlySet<number>): DistanceField {
    return fieldOver(this.groundOf(actor, held), this.weightsOf(actor), actor, goal)
  }

  /**
   * When `actor` cannot reach its goal from where it stands: the field toward the anchor it can reach that is nearest
   * `toward` (the goal's own tile), nearest by the Grid's distance, then by the walk to it, then by a seeded draw —
   * what it heads for instead. `null` when it can reach nowhere at all.
   */
  nearestReachable(actor: Actor, toward: Coord): Readonly<{ field: DistanceField; anchor: Coord }> | null {
    const ground = this.groundOf(actor)
    const body = actor.definition.footprint
    if (!canStand(ground, actor.anchor)) return null
    // The anchors it can walk to are the patch of ground it stands on; of those, the ones nearest `toward`, shared by
    // every unit on that patch heading there. Then the nearest of them to walk to, by a field from where it stands
    // (walking is symmetric: a step costs the same either way on ground with no weights), asked only about them.
    const groundKey = `${maskKey(actor)}|${bodyKey(body)}`
    const patches = this.patchesOf(groundKey, ground)
    const patch = patches[actor.anchor.y * ground.width + actor.anchor.x] as number
    const nearKey = `${groundKey}|patch ${patch}|nearest ${toward.x},${toward.y}`
    let nearest = this.nearest.get(nearKey)
    if (nearest === undefined) {
      nearest = []
      let bestNear = UNREACHABLE
      for (let index = 0; index < patches.length; index += 1) {
        if (patches[index] !== patch) continue
        const anchor = { x: index % ground.width, y: (index - (index % ground.width)) / ground.width }
        const near = nearestOf(anchor, body, toward)
        if (near < bestNear) {
          nearest = [anchor]
          bestNear = near
        } else if (near === bestNear) nearest.push(anchor)
      }
      this.nearest.set(nearKey, nearest)
    }
    const from = new DistanceField(ground, [actor.anchor])
    let tied: Coord[] = []
    let bestWalk = UNREACHABLE
    for (const anchor of nearest) {
      const walk = from.distanceAt(anchor)
      if (walk < bestWalk) {
        tied = [anchor]
        bestWalk = walk
      } else if (walk === bestWalk) tied.push(anchor)
    }
    // Where it stands, when that is as near as any: it stays. Otherwise a tie is a draw, never reading order.
    const best = tied.find((anchor) => anchor.x === actor.anchor.x && anchor.y === actor.anchor.y) ?? drawAmong(this.context, tied)
    if (best === undefined) return null
    const key = `${groundKey}|near:${best.x},${best.y}`
    let field = this.fields.get(key)
    if (field === undefined) {
      field = new DistanceField(ground, [best])
      this.fields.set(key, field)
    }
    return { field, anchor: best }
  }

  /** Which patch of `ground` each anchor is on, numbered from 1 (0 where the body cannot stand): two anchors on one
   *  patch can each be walked to from the other. Kept for the tick with the ground. */
  private patchesOf(groundKey: string, ground: Ground): Int32Array {
    let patches = this.patches.get(groundKey)
    if (patches !== undefined) return patches
    const { width, height, open } = ground
    patches = new Int32Array(width * height)
    const queue = new Int32Array(width * height)
    let count = 0
    for (let start = 0; start < open.length; start += 1) {
      if (open[start] !== 1 || patches[start] !== 0) continue
      count += 1
      patches[start] = count
      let head = 0
      let tail = 0
      queue[tail++] = start
      while (head < tail) {
        const index = queue[head++] as number
        const x = index % width
        const y = (index - x) / width
        const offer = (next: number): void => {
          if (open[next] !== 1 || patches[next] !== 0) return
          patches[next] = count
          queue[tail++] = next
        }
        if (y > 0) offer(index - width)
        if (x < width - 1) offer(index + 1)
        if (y < height - 1) offer(index + width)
        if (x > 0) offer(index - 1)
      }
    }
    this.patches.set(groundKey, patches)
    return patches
  }
}

/** A field over `ground` toward the anchors from which `actor` reaches `goal`. */
function fieldOver(ground: Ground, weights: Uint8Array | null, actor: Actor, goal: RouteGoal): DistanceField {
  const goals =
    goal.kind === "unit"
      ? goalsNear(ground, actor.definition.footprint, goal.target.anchor, goal.target.definition.footprint, goal.reach)
      : goalsInside(ground, actor.definition.footprint, goal.area as Area)
  return new DistanceField(ground, goals, weights ?? undefined)
}

/** How near a body anchored at `anchor` comes to `tile`: from its nearest tile, by the Grid's distance. */
function nearestOf(anchor: Coord, body: Footprint, tile: Coord): number {
  let best = UNREACHABLE
  for (const offset of body) best = Math.min(best, gridDistance({ x: anchor.x + offset.x, y: anchor.y + offset.y }, tile))
  return best
}

/**
 * What an actor means to do this tick, with `target` as its target: stand (nothing to walk for, its attack already
 * reaches, or it cannot move), walk to a unit, walk to its side's target, or flee. Decided from the state alone — no
 * credit, no event — so perception and intents decide it alike, and who walks is known before anyone reads a route.
 */
export type Purpose =
  | Readonly<{ kind: "stand" }>
  | Readonly<{ kind: "walk"; goal: RouteGoal }>
  | Readonly<{ kind: "flee"; threat: Actor }>

export function purposeOf(context: TickContext, actor: Actor, target: Actor | null): Purpose {
  const rate = actor.definition.movementRate
  if (rate === undefined || actor.definition.behavior === "static" || actor.pendingDead) return { kind: "stand" }
  if (target === null) {
    // No enemy within reach: a fighting unit of a side with a target heads for it, and stands once it is inside
    // (`target.ts`). Anything else with nothing to go for holds, as it always has.
    const area = targetFor(context, actor)
    if (area === null || insideArea(actor, area)) return { kind: "stand" }
    return { kind: "walk", goal: { kind: "area", area } }
  }
  if (actor.definition.behavior === "flee") {
    // Measured as range is, so the threat's reach and the worker's nerve are counted alike.
    return within(actor, target, fleeTrigger(target.definition)) ? { kind: "flee", threat: target } : { kind: "stand" }
  }
  // An actor already in range holds and shoots or swings: the attacks step's own test, so the two never disagree.
  const attack = actor.definition.attack
  if (attack !== undefined && inAttackRange(actor, target, attack)) return { kind: "stand" }
  return { kind: "walk", goal: { kind: "unit", target, reach: reachOf(actor) } }
}
