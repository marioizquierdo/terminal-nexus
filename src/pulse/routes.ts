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
import { addWall, bodyKey, canStand, DistanceField, patchesOf, goalsInside, goalsNear, groundFor, rankSteps, UNREACHABLE, wallsOf, weightsFor } from "../routing/index.ts"
import type { BurningGround, TargetArea } from "../state/types.ts"
import type { Actor, TickContext } from "./shared.ts"
import { inAttackRange, onRoof, ownSideLayers, sideLayerOf, within } from "./shared.ts"
import { fleeTrigger } from "./perception.ts"
import { insideArea, targetFor } from "./target.ts"
import { burnsOn, onPatch } from "./burning.ts"

/** Where a mover heads: a unit's footprint — an enemy's, or a wounded ally's for a healer — to stand where its attack
 *  reaches it; its side's target; or, for a unit leaving a roof the nearest way (`roofExit`), the nearest ground wholly
 *  off its side's roofs, `toward` being where it is going after. */
export type RouteGoal =
  | Readonly<{ kind: "unit"; target: Actor; reach: Reach }>
  | Readonly<{ kind: "area"; area: TargetArea }>
  | Readonly<{ kind: "ground"; toward: Coord }>

/** The reach a unit's goal is measured by: what its attack reaches, or touching, for a unit with no attack. */
export function reachOf(actor: Actor): Reach {
  const attack = actor.definition.attack
  if (attack === undefined) return { kind: "touch", steps: 1 }
  return attack.kind === "melee" ? { kind: "touch", steps: attack.range } : { kind: "within", radius: attack.range }
}

const goalKey = (goal: RouteGoal): string =>
  goal.kind === "unit"
    ? `unit:${goal.target.ordinal}@${goal.target.anchor.x},${goal.target.anchor.y}:${goal.reach.kind === "touch" ? `t${goal.reach.steps}` : `w${goal.reach.radius}`}`
    : goal.kind === "area"
      ? `area:${goal.area.x},${goal.area.y},${goal.area.width},${goal.area.height}`
      : "off the roofs"

/**
 * What a step onto ground an enemy building stands on weighs, when a unit works out which building to break
 * (`breachOf`): eight steps of open ground, so a way through one building is taken over a way through two, and a short
 * walk round to a thin wall over a long one through a thick. Never a step anyone takes: the unit breaks the building
 * and walks the ground it leaves.
 */
const BREACH_WEIGHT = 8

/**
 * What a step onto burning ground weighs, times the ground under it, while it burns (`MatchState.burning`): four steps
 * of its ground, so a walker goes round a patch of fire when the way round is less than four times as long, and walks
 * through it when it is not. Only a route weighs it; a step through fire takes as long as one beside it.
 */
export const BURNING_WEIGHT = 4

export class TickRoutes {
  private readonly context: TickContext
  private readonly walking: ReadonlySet<number>
  private readonly grounds = new Map<string, Ground>()
  private readonly fields = new Map<string, DistanceField>()
  private readonly weights = new Map<string, Uint8Array | null>()
  private readonly patches = new Map<string, Int32Array>()
  private readonly nearest = new Map<string, Readonly<{ field: DistanceField; anchors: ReadonlySet<number> }>>()
  private readonly masks = new Map<number, string>()
  private readonly breaches = new Map<string, Readonly<{ ground: Ground; weights: Uint8Array; buildings: ReadonlyMap<number, Actor>; fields: Map<string, DistanceField> }>>()

  /** The ground burning as the tick's routes were built (`TickRoutes.weightsOf`): what the attacks light later in
   *  the tick weighs from the next. */
  private readonly burning: readonly BurningGround[]
  private burningTiles: Uint8Array | undefined

  /** `walking`: the ordinals of the actors that walk this tick; every other actor stands, and is a wall. */
  constructor(context: TickContext, walking: ReadonlySet<number>) {
    this.context = context
    this.walking = walking
    this.burning = [...context.burning]
  }

  /** A name for what blocks `actor` this tick, the same for every unit it blocks alike: its layer, what it collides
   *  with, the side it shares a layer with, and whether it is on the roofs (`onRoof`). What ground and fields are kept
   *  by, with the body's shape. */
  private maskOf(actor: Actor): string {
    let key = this.masks.get(actor.ordinal)
    if (key === undefined) {
      const side = sideLayerOf(actor.definition)
      const roof = onRoof(this.context, actor)
      // Which side it is only matters where it passes its own side and not the enemy's.
      const own = side === null && !roof ? "" : `|${side ?? ""} of ${actor.player}${roof ? " on the roofs" : ""}`
      key = `${actor.definition.layer === "air" ? "air" : "ground"}:${[...actor.definition.collidesWith].sort().join(",")}${own}`
      this.masks.set(actor.ordinal, key)
    }
    return key
  }

  /**
   * The ground `actor`'s body walks on this tick: its mask's walls, for its shape. `alsoStanding`, when given, are
   * walkers to count as standing too — the ones held up this tick, for a unit finding its own way round them
   * (`detourOf`); such ground is the actor's own and is not kept.
   */
  groundOf(actor: Actor, alsoStanding?: ReadonlySet<number>): Ground {
    const key = `${this.maskOf(actor)}|${bodyKey(actor.definition.footprint)}`
    const kept = alsoStanding === undefined ? this.grounds.get(key) : undefined
    if (kept !== undefined) return kept
    const { layers, sideLayers } = ownSideLayers(this.context, actor.definition, actor.player, onRoof(this.context, actor))
    const walls = wallsOf(this.context.index.grid, actor.definition.layer === "air" ? "ignore" : "impassable")
    for (const other of this.context.actors) {
      if (other.pendingDead || other === actor) continue
      if (this.walking.has(other.ordinal) && alsoStanding?.has(other.ordinal) !== true) continue
      // What it collides with, of either side; on the layers it shares with its own side, only the enemy's: its side
      // layer, and its own buildings while it is on their roofs.
      const blocks = layers.includes(other.definition.layer) || (sideLayers?.layers.includes(other.definition.layer) === true && other.player !== actor.player)
      if (blocks) addWall(walls, other.anchor, other.definition.footprint)
    }
    const ground = groundFor(walls, actor.definition.footprint)
    if (alsoStanding === undefined) this.grounds.set(key, ground)
    return ground
  }

  /** What stepping onto each anchor costs `actor`'s body: slow ground weighed in (`weightsFor`), or `null` on a Grid
   *  with none; and, while anything burns, an anchor whose body covers a burning tile weighs `BURNING_WEIGHT` times its
   *  ground, for what fire hurts (a flyer flies over it). Kept for the tick by the body's shape and how it moves. */
  weightsOf(actor: Actor): Uint8Array | null {
    const key = `${this.maskOf(actor)}|${bodyKey(actor.definition.footprint)}`
    if (!this.weights.has(key)) {
      const ground = weightsFor(this.context.index.grid, actor.definition.footprint, actor.definition.layer === "air" ? "ignore" : "impassable")
      this.weights.set(key, this.burning.length > 0 && burnsOn(actor.definition.layer) ? this.withFire(ground, actor.definition.footprint) : ground)
    }
    return this.weights.get(key) ?? null
  }

  /** `ground`'s weights (one everywhere when `null`), each anchor whose `body` covers a burning tile `BURNING_WEIGHT`
   *  times as dear, never past what a weight holds. A new array: `weightsFor`'s are the Grid's, kept for every tick. */
  private withFire(ground: Uint8Array | null, body: Footprint): Uint8Array {
    const { width, height } = this.context.index.grid
    const fire = this.fireTiles()
    const weights = new Uint8Array(width * height)
    for (let index = 0; index < weights.length; index += 1) {
      const x = index % width
      const y = (index - x) / width
      const base = ground?.[index] ?? 1
      const burns = body.some((offset) => {
        const tx = x + offset.x
        const ty = y + offset.y
        return tx >= 0 && ty >= 0 && tx < width && ty < height && fire[ty * width + tx] === 1
      })
      weights[index] = burns ? Math.min(255, base * BURNING_WEIGHT) : base
    }
    return weights
  }

  /** Which tiles burn as the tick began, 1 for a burning one: every tile on a patch, measured as range is. */
  private fireTiles(): Uint8Array {
    if (this.burningTiles === undefined) {
      const { width, height } = this.context.index.grid
      const tiles = new Uint8Array(width * height)
      for (const patch of this.burning) {
        // A reach of R covers R columns across and R / 2 rows up and down, touching always: a box of R each way holds it.
        for (let y = Math.max(0, patch.centre.y - patch.radius); y <= Math.min(height - 1, patch.centre.y + patch.radius); y += 1) {
          for (let x = Math.max(0, patch.centre.x - patch.radius); x <= Math.min(width - 1, patch.centre.x + patch.radius); x += 1) {
            if (onPatch(patch, { x, y })) tiles[y * width + x] = 1
          }
        }
      }
      this.burningTiles = tiles
    }
    return this.burningTiles
  }

  /** The field `actor` walks toward `goal` by, shared with every actor of its mask and shape heading there. */
  fieldOf(actor: Actor, goal: RouteGoal): DistanceField {
    const key = `${this.maskOf(actor)}|${bodyKey(actor.definition.footprint)}|${goalKey(goal)}`
    let field = this.fields.get(key)
    if (field === undefined) {
      const ground = this.groundOf(actor)
      field = fieldOver(this.context, ground, this.weightsOf(actor), actor, goal, this.patchesOf(`${this.maskOf(actor)}|${bodyKey(actor.definition.footprint)}`, ground))
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
    const key = `${this.maskOf(actor)}|${bodyKey(actor.definition.footprint)}|danger of ${actor.player}`
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
    const key = `${this.maskOf(actor)}|${bodyKey(actor.definition.footprint)}|safety of ${actor.player}`
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
    return fieldOver(this.context, this.groundOf(actor, held), this.weightsOf(actor), actor, goal)
  }

  /**
   * When `actor` cannot reach its goal from where it stands: a field toward the anchors it can reach that are nearest
   * `toward` (the goal's own tile), nearest by the Grid's distance — what it heads for instead, walking downhill to
   * the nearest of them to walk to. `here` when it already stands on one: it stays. `null` when it can reach nowhere
   * at all. The anchors it can reach are the patch of ground it stands on (`patchesOf`), so the field is one for every
   * unit on that patch heading toward that tile, worked out once a tick.
   */
  nearestReachable(actor: Actor, toward: Coord): Readonly<{ field: DistanceField; here: boolean }> | null {
    const ground = this.groundOf(actor)
    const body = actor.definition.footprint
    if (!canStand(ground, actor.anchor)) return null
    const groundKey = `${this.maskOf(actor)}|${bodyKey(body)}`
    const patches = this.patchesOf(groundKey, ground)
    const at = actor.anchor.y * ground.width + actor.anchor.x
    const patch = patches[at] as number
    const key = `${groundKey}|patch ${patch}|nearest ${toward.x},${toward.y}`
    let entry = this.nearest.get(key)
    if (entry === undefined) {
      let nearest: Coord[] = []
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
      entry = { field: new DistanceField(ground, nearest, undefined, patches), anchors: new Set(nearest.map((anchor) => anchor.y * ground.width + anchor.x)) }
      this.nearest.set(key, entry)
    }
    return { field: entry.field, here: entry.anchors.has(at) }
  }

  /**
   * **Breaching: rock and buildings are not the same wall.** When `actor` cannot reach `goal` from where it stands, the
   * enemy building in its way that it should break, if breaking buildings opens one: a field toward the goal over the
   * same ground with the enemy's buildings open, each step onto one weighing `BREACH_WEIGHT` times a step of open
   * ground, so the way through the fewest buildings is the one taken; walked downhill from where the actor stands, the
   * first enemy building its body would overlap is the one. `null` when the goal can be reached, or when nothing but
   * rock (or what is not the enemy's to break) closes the way. The owner, 2026-10-21: "if the enemy blocks the entrance
   * with buildings, then the pathfinding should know the difference between rocks and buildings and should decide to
   * target one of the buildings."
   */
  breachOf(actor: Actor, goal: RouteGoal): Actor | null {
    if (this.fieldOf(actor, goal).distanceAt(actor.anchor) !== UNREACHABLE) return null
    const body = actor.definition.footprint
    const key = `${this.maskOf(actor)}|${bodyKey(body)}|breaching ${actor.player}`
    let entry = this.breaches.get(key)
    if (entry === undefined) {
      const { layers, sideLayers } = ownSideLayers(this.context, actor.definition, actor.player, onRoof(this.context, actor))
      const walls = wallsOf(this.context.index.grid, actor.definition.layer === "air" ? "ignore" : "impassable")
      const buildings = new Map<number, Actor>()
      for (const other of this.context.actors) {
        if (other.pendingDead || other === actor || this.walking.has(other.ordinal)) continue
        if (other.player !== actor.player && other.definition.layer === "obstacles") {
          for (const tile of tilesOf(other.anchor, other.definition.footprint)) buildings.set(tile.y * walls.width + tile.x, other)
          continue
        }
        const blocks = layers.includes(other.definition.layer) || (sideLayers?.layers.includes(other.definition.layer) === true && other.player !== actor.player)
        if (blocks) addWall(walls, other.anchor, other.definition.footprint)
      }
      const ground = groundFor(walls, body)
      const base = this.weightsOf(actor)
      const weights = new Uint8Array(ground.width * ground.height)
      for (let index = 0; index < weights.length; index += 1) {
        const x = index % ground.width
        const y = (index - x) / ground.width
        const inBuilding = body.some((offset) => buildings.has((y + offset.y) * ground.width + x + offset.x))
        weights[index] = (base?.[index] ?? 1) * (inBuilding ? BREACH_WEIGHT : 1)
      }
      entry = { ground, weights, buildings, fields: new Map() }
      this.breaches.set(key, entry)
    }
    const goalName = goalKey(goal)
    let field = entry.fields.get(goalName)
    if (field === undefined) {
      field = fieldOver(this.context, entry.ground, entry.weights, actor, goal)
      entry.fields.set(goalName, field)
    }
    // Downhill from where it stands, the best step each time, to the first tile of an enemy building.
    let at = actor.anchor
    let distance = field.distanceAt(at)
    while (distance !== UNREACHABLE && distance > 0) {
      for (const offset of body) {
        const building = entry.buildings.get((at.y + offset.y) * entry.ground.width + at.x + offset.x)
        if (building !== undefined) return building
      }
      const next = rankSteps(field, at, actor.facing)[0]?.[0]
      if (next === undefined || !next.downhill) return null
      at = next.to
      distance = next.after
    }
    return null
  }

  /** Which patch of `ground` each anchor is on (`patchesOf`, `src/routing/`), kept for the tick with the ground. */
  private patchesOf(groundKey: string, ground: Ground): Int32Array {
    let patches = this.patches.get(groundKey)
    if (patches === undefined) {
      patches = patchesOf(ground)
      this.patches.set(groundKey, patches)
    }
    return patches
  }

}

/** A field over `ground` toward the anchors from which `actor` reaches `goal`. */
function fieldOver(context: TickContext, ground: Ground, weights: Uint8Array | null, actor: Actor, goal: RouteGoal, patches?: Int32Array): DistanceField {
  const goals =
    goal.kind === "unit"
      ? goalsNear(ground, actor.definition.footprint, goal.target.anchor, goal.target.definition.footprint, goal.reach)
      : goal.kind === "area"
        ? goalsInside(ground, actor.definition.footprint, goal.area as Area)
        : offTheRoofs(context, ground, actor)
  return new DistanceField(ground, goals, weights ?? undefined, patches)
}

/** Every anchor `actor`'s body may stand on with no tile of it over one of its side's buildings: the ground. */
function offTheRoofs(context: TickContext, ground: Ground, actor: Actor): Coord[] {
  const goals: Coord[] = []
  for (let index = 0; index < ground.open.length; index += 1) {
    if (ground.open[index] !== 1) continue
    const x = index % ground.width
    const anchor = { x, y: (index - x) / ground.width }
    if (!onRoof(context, { ...actor, anchor })) goals.push(anchor)
  }
  return goals
}

/** How `actor`, on a roof, leaves it: as the building under it says (`ProductionRecipe.exit`); along its route when
 *  none says otherwise. */
function roofExitOf(context: TickContext, actor: Actor): "route" | "ground" {
  for (const offset of actor.definition.footprint) {
    const occupant = context.index.occupantAt("obstacles", { x: actor.anchor.x + offset.x, y: actor.anchor.y + offset.y })
    const building = occupant === null ? undefined : context.byOrdinal.get(occupant)
    if (building !== undefined && building.player === actor.player && building.definition.production?.exit === "ground") return "ground"
  }
  return "route"
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
    return offTheRoofFirst(context, actor, { kind: "walk", goal: { kind: "area", area } })
  }
  if (actor.definition.behavior === "flee") {
    // Measured as range is, so the threat's reach and the worker's nerve are counted alike.
    return within(actor, target, fleeTrigger(target.definition)) ? { kind: "flee", threat: target } : { kind: "stand" }
  }
  // An actor already in range holds and shoots or swings: the attacks step's own test, so the two never disagree.
  const attack = actor.definition.attack
  if (attack !== undefined && inAttackRange(actor, target, attack)) return { kind: "stand" }
  return offTheRoofFirst(context, actor, { kind: "walk", goal: { kind: "unit", target, reach: reachOf(actor) } })
}

/** A walk, unless `actor` is on a roof its building says to leave the nearest way (`roofExit`): then to the nearest
 *  ground first, facing where the walk was going. */
function offTheRoofFirst(context: TickContext, actor: Actor, walk: Extract<Purpose, { kind: "walk" }>): Purpose {
  if (!onRoof(context, actor) || roofExitOf(context, actor) !== "ground") return walk
  const goal = walk.goal
  const toward = goal.kind === "unit" ? goal.target.anchor : goal.kind === "area" ? { x: goal.area.x, y: goal.area.y } : goal.toward
  return { kind: "walk", goal: { kind: "ground", toward } }
}
