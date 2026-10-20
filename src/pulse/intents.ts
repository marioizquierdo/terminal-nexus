// 4. Intents (phase order in pulse.md). What each actor wants to do this tick, before arbitration decides who
// actually gets it.
//
// Two passes over the same state. The first decides who walks this tick and toward what: an enemy its attack does not
// reach yet, its side's target, or away from a threat. Everyone else stands, and what stands is a wall to the routes
// (`routes.ts`). The second has each walker read its route and declare its steps, best first: it walks its distance
// field downhill (`src/routing/`), so it goes round rock, out of pockets and round what stands still, and a step that
// leaves as long a walk as another goes by the turn from the way it faces its goal, then a seeded draw.

import { directionOf, nearestFootprintTile, step, tilesOf, footprintDistance } from "../grid/coords.ts"
import type { Coord, Direction } from "../grid/types.ts"
import type { DistanceField } from "../routing/index.ts"
import { rankSteps, UNREACHABLE, weightAt } from "../routing/index.ts"
import { DIRECTIONS } from "../grid/coords.ts"
import { TERRAIN } from "../grid/types.ts"
import type { PlayerId, TargetArea } from "../state/types.ts"
import type { StepChoice } from "./movement.ts"
import { accrueCredit, canStep, choiceCost, stepCost } from "./movement.ts"
import type { MovementRate } from "../content/types.ts"
import type { RouteGoal } from "./routes.ts"
import { purposeOf, TickRoutes } from "./routes.ts"
import type { Actor, TickContext } from "./shared.ts"
import { blockReasonFor, distanceBetween, drawAmong, maskForActor, resolveTarget } from "./shared.ts"
import { areaGoal, gatheredAt } from "./target.ts"

export type Intent = {
  actor: Actor
  /** The steps it may take, best first: what arbitration falls back along when a claim is lost. */
  choices: StepChoice[]
  chosen: number
  /** The tile it walks toward and which way: what arbitration ranks its steps against again when a claim
   *  is lost. Fixed for the tick — nothing it was worked out from moves before the moves settle. */
  goal: Coord
  heading: "toward" | "away"
  /** For two allies that swap tiles: the other. Their steps are granted together, outside the contest for tiles. */
  swapWith?: Actor
}

/** What an actor means to do this tick, decided before anyone reads a route. */
type Plan = Readonly<{
  actor: Actor
  heading: "toward" | "away"
  /** The tile it faces its goal by: the enemy's tile nearest it, or the nearest free tile of its side's target. */
  toward: Coord
  /** Its route's goal; none for one that flees. */
  route: RouteGoal | null
  /** Its side's target, when that is where it heads. */
  area: TargetArea | null
}>

/** Who walks this tick and toward what (`purposeOf`). Credit accrues here for every actor that moves at all, walking
 *  or not. */
function plans(context: TickContext): Plan[] {
  const planned: Plan[] = []
  for (const actor of context.actors) {
    const rate = actor.definition.movementRate
    if (rate === undefined || actor.definition.behavior === "static" || actor.pendingDead) continue
    actor.moveCredit = accrueCredit(actor.moveCredit, rate, dearestStepFrom(context, actor, rate))
    const target = resolveTarget(context, actor)
    const purpose = purposeOf(context, actor, target)
    if (purpose.kind === "stand") continue
    if (purpose.kind === "flee") {
      context.events.push({
        kind: "behavior.flee",
        tick: context.tick,
        entity: actor.id,
        ordinal: actor.ordinal,
        threat: purpose.threat.id,
        threatOrdinal: purpose.threat.ordinal,
        distance: distanceBetween(actor, purpose.threat),
      })
      planned.push({ actor, heading: "away", toward: movementGoal(actor, purpose.threat), route: null, area: null })
      continue
    }
    const goal = purpose.goal
    if (goal.kind === "area") {
      const toward = areaGoal(actor.anchor, actor.definition.footprint, goal.area, maskForActor(context, actor))
      planned.push({ actor, heading: "toward", toward, route: goal, area: goal.area })
    } else planned.push({ actor, heading: "toward", toward: movementGoal(actor, goal.target), route: goal, area: null })
  }
  return planned
}

/** A walker that could not step this tick, held for the second look (`intents`). */
type Held = {
  plan: Plan
  /** The tile it wanted, and the step's cost. */
  desired: Coord
  cost: number
  /** What is in its way: an entity's ordinal, or the reason it is not one. */
  blocker: "edge" | "terrain" | "settling" | number | null
  noRoute: boolean
}

export function intents(context: TickContext): Intent[] {
  const declared: Intent[] = []
  const planned = plans(context)
  // Perception built the tick's routes once every actor had chosen; a tick driven without it builds them here.
  const routes = context.routes ?? new TickRoutes(context, new Set(planned.map((plan) => plan.actor.ordinal)))
  /** Who is gathered at each side's target this tick, worked out once a side first needs it (`gatheredAt`). */
  const gathered = new Map<PlayerId, ReadonlySet<number>>()
  const gatheredOf = (player: PlayerId, area: TargetArea): ReadonlySet<number> => {
    let found = gathered.get(player)
    if (found === undefined) {
      found = gatheredAt(context, player, area)
      gathered.set(player, found)
    }
    return found
  }
  const held: Held[] = []

  // First, every walker that can pay for a step declares the best one it fits; the rest are held.
  for (const plan of planned) {
    const { actor, heading, toward, route, area } = plan
    const rate = actor.definition.movementRate
    if (rate === undefined || !canStep(actor.moveCredit, rate)) continue

    const mask = maskForActor(context, actor)
    let choices: StepChoice[]
    /** The step it would take with the way clear, for the report when it cannot. */
    let wanted: Coord | null
    let noRoute = false
    if (route === null) {
      // Fleeing walks the flight map downhill: away from every enemy that can strike, not only the nearest, and
      // toward open ground rather than into a corner (`TickRoutes.safetyOf`).
      const fled = walk(context, routes.safetyOf(actor), routes, actor, toward, desiredDirection(actor, toward, "away"), (to) => mask.footprintFits(to, actor.definition.footprint))
      choices = fled.choices
      wanted = fled.wanted
    } else {
      const facing = desiredDirection(actor, toward, heading)
      const walked = walk(context, routes.fieldOf(actor, route), routes, actor, toward, facing, (to) => mask.footprintFits(to, actor.definition.footprint))
      choices = walked.choices
      wanted = walked.wanted
      noRoute = walked.noRoute
    }

    if (choices.length === 0) {
      // Nothing brings it closer to its side's target, and it is gathered there beside its own: it stands,
      // rather than pressing on them.
      if (area !== null && gatheredOf(actor.player, area).has(actor.ordinal)) continue
      const direction = wanted === null ? desiredDirection(actor, toward, heading) : directionOf(actor.anchor, wanted, actor.facing)
      const cost = stepCost(rate, direction, weightAt(context.index.grid, actor.definition.footprint, step(actor.anchor, direction), terrainRuleOf(actor)))
      // Blocked is a step it could pay for and could not take; short of that step's credit — a step up or down
      // costs more than one across — it is still waiting for it, as it would be with the way clear.
      if (actor.moveCredit < cost) continue
      const desired = wanted ?? step(actor.anchor, direction)
      // The full footprint, not just the anchor tile: a multi-tile mover's naive "straight at the
      // goal" tile can itself be perfectly clear while a *different* tile in its footprint is what's
      // actually occupied - checking only the anchor then reports "edge" (blockReasonFor's fallback
      // for "nothing was wrong with the one tile I looked at"), which is simply false. A three-tile
      // raider crowded by an ally's tail in a populous scenario is what surfaced this.
      const blocker = noRoute ? null : mask.footprintBlockerAt(desired, actor.definition.footprint)
      held.push({ plan, desired, cost, blocker, noRoute })
      continue
    }
    declareStep(context, declared, plan, choices)
  }

  // Then the held: two allies that want each other's tile swap, and one held up behind allies that are stuck — with no
  // route, or in a ring of units each waiting on the next — finds its own way round them. One that only waits behind
  // a walker that will step on soon waits: walking round a queue and back would pace. The rest wait, and say why.
  const heldBy = new Map(held.map((entry) => [entry.plan.actor.ordinal, entry]))
  const swapped = new Set<number>()
  for (const entry of held) {
    const actor = entry.plan.actor
    if (swapped.has(actor.ordinal) || entry.noRoute || typeof entry.blocker !== "number") continue
    const other = heldBy.get(entry.blocker)
    if (other !== undefined && !swapped.has(other.plan.actor.ordinal) && swaps(entry, other)) {
      swapped.add(actor.ordinal)
      swapped.add(other.plan.actor.ordinal)
      declareSwap(context, declared, entry, other)
    }
  }
  const stuck = stuckOf(heldBy, swapped)
  for (const entry of held) {
    const { actor, heading, toward, route } = entry.plan
    if (swapped.has(actor.ordinal)) continue
    const blocker = typeof entry.blocker === "number" ? context.byOrdinal.get(entry.blocker) : undefined
    if (route !== null && !entry.noRoute && blocker !== undefined && blocker.player === actor.player && stuck.has(blocker.ordinal)) {
      const mask = maskForActor(context, actor)
      const facing = desiredDirection(actor, toward, heading)
      const field = routes.detourOf(actor, route, stuck)
      if (field.distanceAt(actor.anchor) !== UNREACHABLE) {
        const around = walk(context, field, routes, actor, toward, facing, (to) => mask.footprintFits(to, actor.definition.footprint))
        const first = around.choices[0]
        const rate = actor.definition.movementRate
        if (first !== undefined && rate !== undefined && actor.moveCredit >= choiceCost(rate, first)) {
          declareStep(context, declared, entry.plan, around.choices)
          continue
        }
      }
    }
    context.events.push({
      kind: "move.blocked",
      tick: context.tick,
      entity: actor.id,
      ordinal: actor.ordinal,
      desired: entry.desired,
      reason: entry.noRoute ? "no-route" : blockReasonFor(entry.blocker),
      blocker: typeof entry.blocker === "number" ? (context.byOrdinal.get(entry.blocker)?.id ?? null) : null,
      credit: actor.moveCredit,
      cost: entry.cost,
    })
  }
  return declared
}

/**
 * The held walkers that are stuck, not merely queuing: one with no route, one held up by a stuck one, and every one of
 * a ring of walkers each held up by the next. Worked out from who holds up whom this tick, so the answer is the same in
 * whatever order they are read.
 */
function stuckOf(heldBy: ReadonlyMap<number, Held>, swapped: ReadonlySet<number>): Set<number> {
  const stuck = new Set<number>()
  for (const [ordinal, entry] of heldBy) if (entry.noRoute && !swapped.has(ordinal)) stuck.add(ordinal)
  for (const start of heldBy.keys()) {
    if (swapped.has(start) || stuck.has(start)) continue
    // Follow who holds up whom from here: into a stuck one, or round a ring, and the whole way is stuck.
    const path: number[] = []
    const onPath = new Set<number>()
    let at: number | undefined = start
    while (at !== undefined && !onPath.has(at) && !stuck.has(at) && !swapped.has(at)) {
      path.push(at)
      onPath.add(at)
      const blocker: Held["blocker"] | undefined = heldBy.get(at)?.blocker
      at = typeof blocker === "number" && heldBy.has(blocker) ? blocker : undefined
    }
    if (at !== undefined && (onPath.has(at) || stuck.has(at))) for (const ordinal of path) stuck.add(ordinal)
  }
  return stuck
}

/** Whether two held walkers swap: allies of one tile each, on one layer, each wanting the other's tile, each able to
 *  pay for the step. */
function swaps(a: Held, b: Held): boolean {
  const one = (held: Held): boolean => held.plan.actor.definition.footprint.length === 1
  const wants = (held: Held, other: Held): boolean => held.desired.x === other.plan.actor.anchor.x && held.desired.y === other.plan.actor.anchor.y
  return (
    a.plan.actor.player === b.plan.actor.player &&
    a.plan.actor.definition.layer === b.plan.actor.definition.layer &&
    one(a) &&
    one(b) &&
    wants(a, b) &&
    wants(b, a) &&
    a.plan.actor.moveCredit >= a.cost &&
    b.plan.actor.moveCredit >= b.cost
  )
}

/** Declares `plan`'s best step, its credit capped at that step's cost. */
function declareStep(context: TickContext, declared: Intent[], plan: Plan, choices: StepChoice[]): void {
  const { actor, toward, heading } = plan
  const rate = actor.definition.movementRate
  const first = choices[0]
  if (rate === undefined || first === undefined) return
  // A step up or down costs more than one across (`stepCost`). The actor waits for the step it wants rather than
  // taking a cheaper one it likes less — which would bend every walk across first — and once it can pay, its
  // credit is capped at that step's cost, so waiting never banks a sprint across.
  const cost = choiceCost(rate, first)
  if (actor.moveCredit < cost) return
  actor.moveCredit = Math.min(actor.moveCredit, cost)
  context.events.push({
    kind: "move.intended",
    tick: context.tick,
    entity: actor.id,
    ordinal: actor.ordinal,
    from: actor.anchor,
    to: first.to,
    direction: first.direction,
    credit: actor.moveCredit,
    cost,
  })
  declared.push({ actor, choices, chosen: 0, goal: toward, heading })
}

/** Declares two held allies' swap: each steps onto the other's tile, together (`settle`). */
function declareSwap(context: TickContext, declared: Intent[], a: Held, b: Held): void {
  for (const [mover, other] of [[a, b], [b, a]] as const) {
    const actor = mover.plan.actor
    const direction = directionOf(actor.anchor, other.plan.actor.anchor, actor.facing)
    actor.moveCredit = Math.min(actor.moveCredit, mover.cost)
    context.events.push({
      kind: "move.intended",
      tick: context.tick,
      entity: actor.id,
      ordinal: actor.ordinal,
      from: actor.anchor,
      to: other.plan.actor.anchor,
      direction,
      credit: actor.moveCredit,
      cost: mover.cost,
    })
    declared.push({
      actor,
      choices: [{ direction, to: other.plan.actor.anchor, distanceAfter: 0, weight: weightAt(context.index.grid, actor.definition.footprint, other.plan.actor.anchor, terrainRuleOf(actor)) }],
      chosen: 0,
      goal: mover.plan.toward,
      heading: mover.plan.heading,
      swapWith: other.plan.actor,
    })
  }
}

/**
 * The steps a walker may take along its route this tick, best first: every step down its field that it fits now,
 * the best of them first — a tie among the best drawn from the seeded stream, so no side wins by where it stands — and
 * the step it would take with the way clear. A walker its goal cannot be reached from walks toward the nearest anchor
 * it can reach instead; standing there, it has no route (`noRoute`).
 */
function walk(
  context: TickContext,
  routeField: DistanceField,
  routes: TickRoutes,
  actor: Actor,
  toward: Coord,
  facing: Direction,
  fits: (to: Coord) => boolean,
): Readonly<{ choices: StepChoice[]; wanted: Coord | null; noRoute: boolean }> {
  let field = routeField
  if (field.distanceAt(actor.anchor) === UNREACHABLE) {
    const nearest = routes.nearestReachable(actor, toward)
    if (nearest === null) return { choices: [], wanted: null, noRoute: true }
    if (nearest.anchor.x === actor.anchor.x && nearest.anchor.y === actor.anchor.y) return { choices: [], wanted: null, noRoute: true }
    field = nearest.field
  }
  const choices: StepChoice[] = []
  let wanted: Coord | null = null
  for (const group of rankSteps(field, actor.anchor, facing)) {
    const downhill = group.filter((candidate) => candidate.downhill)
    if (downhill.length === 0) continue
    wanted ??= downhill[0]?.to ?? null
    const free = downhill.filter((candidate) => fits(candidate.to))
    if (free.length === 0) continue
    // The first group with a step it can take decides the step; a tie in it is a draw. The rest follow in order, for
    // arbitration to fall back on.
    const first = choices.length === 0 && free.length > 1 ? drawAmong(context, free) : undefined
    const ordered = first === undefined ? free : [first, ...free.filter((candidate) => candidate !== first)]
    for (const candidate of ordered) choices.push({ direction: candidate.direction, to: candidate.to, distanceAfter: candidate.after, weight: field.weightAt(candidate.to) })
  }
  return { choices, wanted, noRoute: false }
}

/**
 * The tile a mover is actually walking toward: the tile of the target's footprint nearest the mover's own footprint,
 * not either anchor. What it faces its goal by, and what fleeing runs from. Footprint to footprint, so a wide mover
 * heading east or west aims alike.
 */
export function movementGoal(mover: Actor, target: Actor): Coord {
  let best = target.anchor
  let bestDistance = Number.POSITIVE_INFINITY
  for (const tile of tilesOf(target.anchor, target.definition.footprint)) {
    const distance = footprintDistance(mover.anchor, mover.definition.footprint, tile, ONE_TILE)
    if (distance < bestDistance) {
      best = tile
      bestDistance = distance
    }
  }
  return best
}

const ONE_TILE = [{ x: 0, y: 0 }]

/** The tile the actor wanted, for the report: one step along the direction it was heading. */
export function desiredTile(actor: Actor, target: Actor, intent: "toward" | "away"): Coord {
  return step(actor.anchor, desiredDirection(actor, movementGoal(actor, target), intent))
}

/** Which way the actor heads along the way to — or, fleeing, away from — `goal`: straight at it, along the
 *  screen's own diagonal (`directionOf`). */
function desiredDirection(actor: Actor, goal: Coord, intent: "toward" | "away"): Direction {
  const nose = nearestFootprintTile(goal, actor.anchor, actor.definition.footprint)
  return intent === "toward" ? directionOf(nose, goal, actor.facing) : directionOf(goal, nose, actor.facing)
}

/** Whether a unit walks on the ground, where rock and slow ground count, or flies over them. */
function terrainRuleOf(actor: Actor): "impassable" | "ignore" {
  return actor.definition.layer === "air" ? "ignore" : "impassable"
}

/** Grids with slow ground, worked out once for each Grid a battle is played on. */
const SLOW_GROUND = new WeakMap<object, boolean>()

/**
 * What credit is capped at for `actor` this tick: the dearest of its four steps from where it stands, slow ground
 * weighed in, so it can save up for a step onto scrub; on a Grid with no slow ground, the dearest step on open ground,
 * as it always was.
 */
function dearestStepFrom(context: TickContext, actor: Actor, rate: MovementRate): number {
  const grid = context.index.grid
  let slow = SLOW_GROUND.get(grid)
  if (slow === undefined) {
    slow = grid.tiles.some((id) => TERRAIN[id].stepWeight !== 1)
    SLOW_GROUND.set(grid, slow)
  }
  if (!slow || actor.definition.layer === "air") return stepCost(rate)
  let dearest = stepCost(rate)
  for (const direction of DIRECTIONS) {
    dearest = Math.max(dearest, stepCost(rate, direction, weightAt(grid, actor.definition.footprint, step(actor.anchor, direction))))
  }
  return dearest
}
