// THE PULSE — how state changes. A pure function stepping state forward in fixed logical ticks,
// with no clock, no terminal, no frames, and no colour (engine.md 1).
//
// The nine phases below are engine.md 4.3, in order, including the two economy phases that exist
// and deliberately do nothing: the slot matters, the content does not. Every phase reads the state
// settled at the end of the previous phase, so iteration order over entities can never decide an
// outcome — it only ever decides the order events are emitted in.

import type { ContentDef } from "../content/types.ts"
import { directionOf, footprintDistance, nearestFootprintTile, step } from "../grid/coords.ts"
import type { CollisionMask } from "../grid/occupancy.ts"
import { ClaimOverlay, OccupancyIndex, VacatedOverlay, maskFrom } from "../grid/occupancy.ts"
import type { BlockReason } from "../events/types.ts"
import type { Coord, Direction } from "../grid/types.ts"
import type { DomainEvent } from "../events/types.ts"
import { Pcg32 } from "../rng/pcg32.ts"
import type { EntityState, GroundItem, MatchState, Outcome, PlayerId } from "../state/types.ts"
import { PLAYERS } from "../state/types.ts"
import type { PulseContext } from "./context.ts"
import type { StepChoice } from "./movement.ts"
import { accrueCredit, canStep, rankedSteps, stepCost } from "./movement.ts"

type Actor = {
  ordinal: number
  id: string
  player: PlayerId
  contentId: string
  definition: ContentDef
  hp: number
  anchor: Coord
  facing: Direction
  moveCredit: number
  cooldown: number
  targetOrdinal: number | null
  pendingDead: boolean
  killer: string | null
}

type Intent = {
  actor: Actor
  choices: StepChoice[]
  chosen: number
}

type TickContext = {
  tick: number
  pulse: PulseContext
  actors: Actor[]
  byOrdinal: Map<number, Actor>
  index: OccupancyIndex
  vacated: VacatedOverlay
  /** Ordinals that settled a move this tick — checked by attacks(). See the note there. */
  movedThisTick: Set<number>
  rng: Pcg32
  events: DomainEvent[]
  groundItems: GroundItem[]
}

export type TickResult = Readonly<{ state: MatchState; events: readonly DomainEvent[] }>

/**
 * Ticks a vacated tile stays blocked after a death — the owner's playtest finding that another
 * unit stepping into a corpse's tile the instant it opens reads as a glitch. Two ticks is about
 * 160ms at 12Hz: long enough to register as a pause, short enough that it never reads as a second
 * rule players have to learn.
 */
export const DEATH_SETTLE_TICKS = 2

/** Maps a mask's blocker to the reason a `move.blocked` event reports. */
function blockReasonFor(blocker: "edge" | "terrain" | "settling" | number | null): BlockReason {
  if (typeof blocker === "number") return "entity"
  if (blocker === "terrain" || blocker === "settling") return blocker
  return "edge"
}

/** Attacks and movement claims both read this. Lower acts first — engine.md 4.3. */
function speedTier(actor: Actor): number {
  return actor.definition.speedTier
}

function isMobile(actor: Actor): boolean {
  return actor.definition.layer !== "obstacles"
}

function maskForActor(
  context: TickContext,
  actor: Actor,
  overlay?: ClaimOverlay,
): CollisionMask {
  return maskFrom(context.index, {
    layers: actor.definition.collidesWith,
    // Air ignores what is on the ground, including impassable terrain: the mask is composed from
    // chosen layers, never inferred from a layer's position in the render order.
    terrain: actor.definition.layer === "air" ? "ignore" : "impassable",
    ignore: [actor.ordinal],
    vacated: context.vacated,
    ...(overlay === undefined ? {} : { overlay }),
  })
}

// ---------------------------------------------------------------------------
// 2. Economy and production
// ---------------------------------------------------------------------------

function economyAndProduction(_context: TickContext): void {
  // Deliberately empty for Gate 1A (milestone-1-spike-battle.md 3.7). Scheduled resource yield and
  // producer recipes belong to Milestone 2; the phase exists here so that the tick order it will
  // land in is already proven and already ordered relative to perception.
}

// ---------------------------------------------------------------------------
// 3. Perception
// ---------------------------------------------------------------------------

function hostilesOf(context: TickContext, actor: Actor): Actor[] {
  return context.actors.filter((other) => other.player !== actor.player && !other.pendingDead)
}

/**
 * The whole scoring function is "nearest enemy by Chebyshev distance across every hostile layer,
 * ties broken by entity id" (milestone-1-spike-battle.md 3.7). Resisting the urge to improve it is
 * part of the gate.
 */
function selectTarget(
  context: TickContext,
  actor: Actor,
  candidates: readonly Actor[],
): { target: Actor; distance: number } | null {
  let best: { target: Actor; distance: number } | null = null
  for (const candidate of candidates) {
    const distance = footprintDistance(
      actor.anchor,
      actor.definition.footprint,
      candidate.anchor,
      candidate.definition.footprint,
    )
    if (best === null || distance < best.distance) {
      best = { target: candidate, distance }
    }
    // Ties break on the entity id, and ordinals are assigned in scenario order, so the earlier
    // entity wins. `<` above already keeps the first-seen candidate, and `context.actors` is
    // ordered by ordinal.
  }
  return best
}

function perception(context: TickContext): void {
  for (const actor of context.actors) {
    if (!isMobile(actor) && actor.definition.attack === undefined) {
      actor.targetOrdinal = null
      continue
    }
    const previous = actor.targetOrdinal
    if (previous !== null && context.byOrdinal.get(previous) === undefined) {
      // Resolution clears the target of everything aiming at an entity as it dies, so reaching
      // here means a target left the Grid without a death event. That is suspicious rather than
      // normal, and the report says so at WARN.
      context.events.push({
        kind: "target.lost",
        tick: context.tick,
        entity: actor.id,
        ordinal: actor.ordinal,
        target: `#${previous}`,
        targetOrdinal: previous,
      })
      actor.targetOrdinal = null
    }

    const hostiles = hostilesOf(context, actor)
    const candidates =
      actor.definition.behavior === "flee"
        ? hostiles.filter((other) => other.definition.attack !== undefined)
        : hostiles
    const selection = selectTarget(context, actor, candidates)
    if (selection === null) {
      actor.targetOrdinal = null
      continue
    }

    const changed = actor.targetOrdinal !== selection.target.ordinal
    actor.targetOrdinal = selection.target.ordinal
    // Facing is derived from the current target when stationary, and from the last step when
    // moving. Nothing in the rules reads it (Q9).
    actor.facing = directionOf(actor.anchor, selection.target.anchor, actor.facing)
    if (changed) {
      context.events.push({
        kind: "target.selected",
        tick: context.tick,
        entity: actor.id,
        ordinal: actor.ordinal,
        target: selection.target.id,
        targetOrdinal: selection.target.ordinal,
        distance: selection.distance,
        score: selection.distance,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Intents
// ---------------------------------------------------------------------------

function fleeTrigger(threat: Actor): number {
  // "when a hostile attacker is within range + 2" — milestone-1-spike-battle.md 3.7.
  return (threat.definition.attack?.range ?? 0) + 2
}

function intents(context: TickContext): Intent[] {
  const declared: Intent[] = []
  for (const actor of context.actors) {
    const rate = actor.definition.movementRate
    if (rate === undefined || actor.definition.behavior === "static" || actor.pendingDead) continue

    actor.moveCredit = accrueCredit(actor.moveCredit, rate)

    const target = actor.targetOrdinal === null ? null : context.byOrdinal.get(actor.targetOrdinal)
    if (target === undefined || target === null) continue

    const distance = footprintDistance(
      actor.anchor,
      actor.definition.footprint,
      target.anchor,
      target.definition.footprint,
    )

    let intent: "toward" | "away"
    if (actor.definition.behavior === "flee") {
      if (distance > fleeTrigger(target)) continue
      intent = "away"
      context.events.push({
        kind: "behavior.flee",
        tick: context.tick,
        entity: actor.id,
        ordinal: actor.ordinal,
        threat: target.id,
        threatOrdinal: target.ordinal,
        distance,
      })
    } else {
      const attack = actor.definition.attack
      // An actor already in range holds and shoots or swings; melee is the special case of that,
      // where the step it wanted is the tile the enemy is standing in.
      if (attack !== undefined && distance <= attack.range) continue
      intent = "toward"
    }

    if (!canStep(actor.moveCredit, rate)) continue

    const mask = maskForActor(context, actor)
    const goal = movementGoal(actor.anchor, target)
    const choices = rankedSteps(actor.anchor, actor.definition, mask, { goal, intent })
    if (choices.length === 0) {
      const desired = desiredTile(actor, target, intent)
      const blocker = mask.blockerAt(desired)
      context.events.push({
        kind: "move.blocked",
        tick: context.tick,
        entity: actor.id,
        ordinal: actor.ordinal,
        desired,
        reason: blockReasonFor(blocker),
        blocker: typeof blocker === "number" ? (context.byOrdinal.get(blocker)?.id ?? null) : null,
        credit: actor.moveCredit,
        cost: stepCost(rate),
      })
      continue
    }
    const first = choices[0]
    if (first === undefined) continue
    context.events.push({
      kind: "move.intended",
      tick: context.tick,
      entity: actor.id,
      ordinal: actor.ordinal,
      from: actor.anchor,
      to: first.to,
      direction: first.direction,
      credit: actor.moveCredit,
      cost: stepCost(rate),
    })
    declared.push({ actor, choices, chosen: 0 })
  }
  return declared
}

/**
 * The tile a mover is actually walking toward: the nearest tile of the target's footprint, not its
 * anchor. Routing and range-checking must agree on this point, or a mover can rank every step that
 * would put it in range as "further from the goal" and never take it (see `nearestFootprintTile`).
 */
function movementGoal(from: Coord, target: Actor): Coord {
  return nearestFootprintTile(from, target.anchor, target.definition.footprint)
}

/** The tile the actor wanted, for the report: one step along the direction it was heading. */
function desiredTile(actor: Actor, target: Actor, intent: "toward" | "away"): Coord {
  const goal = movementGoal(actor.anchor, target)
  const direction =
    intent === "toward" ? directionOf(actor.anchor, goal, actor.facing) : directionOf(goal, actor.anchor, actor.facing)
  return step(actor.anchor, direction)
}

// ---------------------------------------------------------------------------
// 5. Arbitration
// ---------------------------------------------------------------------------

type Grant = { actor: Actor; to: Coord; direction: Direction }

/**
 * Contested claims resolve by speed tier — lower outranks higher — with any remaining tie broken by
 * one draw from the seeded stream (engine.md 4.3). Entity ordinals order iteration and event
 * emission, never outcomes.
 *
 * Termination: every pass grants at least one claim per conflict group, so the number of unresolved
 * movers strictly decreases; the loop is bounded by that count and the bound is reported as a WARN
 * if it is ever reached.
 */
function arbitrate(context: TickContext, declared: Intent[]): Grant[] {
  const overlay = new ClaimOverlay()
  const grants: Grant[] = []
  let unresolved = [...declared].sort((a, b) => a.actor.ordinal - b.actor.ordinal)
  const bound = declared.length + 1
  let passes = 0

  while (unresolved.length > 0 && passes < bound) {
    passes += 1
    const before = unresolved.length

    // Re-rank every unresolved mover against the claims granted so far. A loser that recalculated
    // in an earlier pass may have chosen a tile that a later group then claimed, so a claim is only
    // ever granted from a ranking computed against the current overlay — never a stale one.
    const live: Intent[] = []
    for (const intent of unresolved) {
      const refreshed = rerank(context, intent, overlay)
      if (refreshed === null) {
        reportBlocked(context, intent, overlay)
        continue
      }
      intent.choices = refreshed
      intent.chosen = 0
      live.push(intent)
    }
    unresolved = live
    if (unresolved.length === 0) break

    for (const group of conflictGroups(unresolved)) {
      const winner = group.length === 1 ? group[0] : contestWinner(context, group)
      if (winner === undefined) continue
      const choice = winner.choices[winner.chosen]
      if (choice === undefined) continue
      grants.push({ actor: winner.actor, to: choice.to, direction: choice.direction })
      overlay.claim(
        winner.actor.definition.layer,
        winner.actor.ordinal,
        choice.to,
        winner.actor.definition.footprint,
      )
      // Losers hold or recalculate; either way they leave this group, so the number of unresolved
      // movers strictly decreases every pass. That is the progress measure the bound protects.
      unresolved = unresolved.filter((intent) => intent !== winner)
    }

    if (unresolved.length >= before) {
      context.events.push({
        kind: "arbitration.bounded",
        tick: context.tick,
        passes,
        unresolved: unresolved.map((intent) => intent.actor.id),
      })
      break
    }
  }

  if (unresolved.length > 0) {
    context.events.push({
      kind: "arbitration.bounded",
      tick: context.tick,
      passes,
      unresolved: unresolved.map((intent) => intent.actor.id),
    })
  }

  return grants
}

/** A fresh ranking for a mover, against occupancy plus every claim granted so far this tick. */
function rerank(context: TickContext, intent: Intent, overlay: ClaimOverlay): StepChoice[] | null {
  const actor = intent.actor
  const target = actor.targetOrdinal === null ? null : (context.byOrdinal.get(actor.targetOrdinal) ?? null)
  if (target === null) return null
  const mask = maskForActor(context, actor, overlay)
  const choices = rankedSteps(actor.anchor, actor.definition, mask, {
    goal: movementGoal(actor.anchor, target),
    intent: actor.definition.behavior === "flee" ? "away" : "toward",
  })
  return choices.length === 0 ? null : choices
}

function reportBlocked(context: TickContext, intent: Intent, overlay: ClaimOverlay): void {
  const actor = intent.actor
  const desired = intent.choices[intent.chosen]?.to ?? actor.anchor
  const blocker = maskForActor(context, actor, overlay).blockerAt(desired)
  context.events.push({
    kind: "move.blocked",
    tick: context.tick,
    entity: actor.id,
    ordinal: actor.ordinal,
    desired,
    reason: blockReasonFor(blocker),
    blocker: typeof blocker === "number" ? (context.byOrdinal.get(blocker)?.id ?? null) : null,
    credit: actor.moveCredit,
    cost: actor.definition.movementRate === undefined ? 0 : stepCost(actor.definition.movementRate),
  })
}

/**
 * Movers whose destination footprints touch the same tile on the same layer contest that claim.
 * Grouping is transitive — a three-tile hauler can bridge two one-tile claims that do not touch
 * each other — so the groups are unions, not first-match buckets.
 */
function conflictGroups(intents: readonly Intent[]): Intent[][] {
  const parent = intents.map((_, index) => index)
  const find = (index: number): number => {
    let root = index
    while (parent[root] !== root) {
      const next = parent[root]
      if (next === undefined) break
      root = next
    }
    let walk = index
    while (parent[walk] !== walk) {
      const next = parent[walk]
      if (next === undefined) break
      parent[walk] = root
      walk = next
    }
    return root
  }
  const union = (a: number, b: number): void => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA === rootB) return
    // Always attach the later group to the earlier one, so group identity follows entity order.
    if (rootA < rootB) parent[rootB] = rootA
    else parent[rootA] = rootB
  }

  const claimedBy = new Map<string, number>()
  intents.forEach((intent, index) => {
    const choice = intent.choices[intent.chosen]
    if (choice === undefined) return
    for (const offset of intent.actor.definition.footprint) {
      const key = `${intent.actor.definition.layer}:${choice.to.x + offset.x},${choice.to.y + offset.y}`
      const existing = claimedBy.get(key)
      if (existing === undefined) claimedBy.set(key, index)
      else union(index, existing)
    }
  })

  const groups = new Map<number, Intent[]>()
  intents.forEach((intent, index) => {
    const root = find(index)
    const group = groups.get(root)
    if (group === undefined) groups.set(root, [intent])
    else group.push(intent)
  })
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, group]) => group)
}

function contestWinner(context: TickContext, group: Intent[]): Intent | undefined {
  let bestTier = Number.POSITIVE_INFINITY
  for (const intent of group) bestTier = Math.min(bestTier, speedTier(intent.actor))
  const tied = group.filter((intent) => speedTier(intent.actor) === bestTier)
  const first = tied[0]
  if (first === undefined) return undefined

  const winner = tied.length === 1 ? first : context.rng.pick(tied)
  const choice = winner.choices[winner.chosen]
  if (choice === undefined) return undefined
  context.events.push({
    kind: "move.contested",
    tick: context.tick,
    tile: choice.to,
    winner: winner.actor.id,
    winnerOrdinal: winner.actor.ordinal,
    losers: group.filter((intent) => intent !== winner).map((intent) => intent.actor.id),
    loserOrdinals: group.filter((intent) => intent !== winner).map((intent) => intent.actor.ordinal),
    resolvedBy: tied.length === 1 ? "speed-tier" : "random",
  })
  return winner
}

// ---------------------------------------------------------------------------
// 6. Settle
// ---------------------------------------------------------------------------

function settle(context: TickContext, grants: readonly Grant[]): void {
  const ordered = [...grants].sort((a, b) => a.actor.ordinal - b.actor.ordinal)
  for (const grant of ordered) {
    const actor = grant.actor
    const from = actor.anchor
    const rate = actor.definition.movementRate
    if (rate === undefined) continue
    context.index.move(
      actor.definition.layer,
      actor.ordinal,
      actor.definition.footprint,
      from,
      grant.to,
    )
    actor.anchor = grant.to
    actor.facing = grant.direction
    actor.moveCredit -= stepCost(rate)
    // A unit that just arrived does not also fire this tick — attacks() skips it. Stop first,
    // then attack, is the owner's second finding: without this a unit can step into range and
    // land a hit in the same instant, which reads as the shot causing the step rather than the
    // other way around.
    context.movedThisTick.add(actor.ordinal)
    context.events.push({
      kind: "entity.moved",
      tick: context.tick,
      entity: actor.id,
      ordinal: actor.ordinal,
      from,
      to: grant.to,
      facing: grant.direction,
    })
  }
}

// ---------------------------------------------------------------------------
// 7 and 8. Attacks and resolution
// ---------------------------------------------------------------------------

function flightWindowTicks(distance: number, tilesPerTick: number | undefined): number {
  if (tilesPerTick === undefined || tilesPerTick <= 0) return 0
  return Math.max(1, Math.ceil(distance / tilesPerTick))
}

function attacks(context: TickContext): void {
  for (const actor of context.actors) {
    if (actor.cooldown > 0) actor.cooldown -= 1
  }

  const tiers = [
    ...new Set(
      context.actors
        .filter((actor) => actor.definition.attack !== undefined)
        .map((actor) => speedTier(actor)),
    ),
  ].sort((a, b) => a - b)

  for (const tier of tiers) {
    // Every attack in a tier is computed against the state at tier start and applied
    // simultaneously, so no entity survives merely by being iterated first.
    const hpAtTierStart = new Map<number, number>()
    for (const actor of context.actors) hpAtTierStart.set(actor.ordinal, actor.hp)

    const damage = new Map<number, { total: number; source: Actor }>()
    for (const actor of context.actors) {
      const attack = actor.definition.attack
      if (attack === undefined || speedTier(actor) !== tier) continue
      if (actor.pendingDead || actor.cooldown > 0) continue
      // Stop, then attack: an actor that settled a move this tick waits for the next one.
      if (context.movedThisTick.has(actor.ordinal)) continue
      const target = actor.targetOrdinal === null ? null : context.byOrdinal.get(actor.targetOrdinal)
      if (target === undefined || target === null || target.pendingDead) continue
      const distance = footprintDistance(
        actor.anchor,
        actor.definition.footprint,
        target.anchor,
        target.definition.footprint,
      )
      if (distance > attack.range) continue

      actor.cooldown = attack.cooldownTicks
      context.events.push({
        kind: "attack.launched",
        tick: context.tick,
        attacker: actor.id,
        attackerOrdinal: actor.ordinal,
        target: target.id,
        targetOrdinal: target.ordinal,
        attackKind: attack.kind,
        damage: attack.damage,
        distance,
        flightWindowTicks:
          attack.kind === "ranged"
            ? flightWindowTicks(distance, attack.projectileTilesPerTick)
            : 0,
      })
      const existing = damage.get(target.ordinal)
      if (existing === undefined) {
        damage.set(target.ordinal, { total: attack.damage, source: actor })
      } else {
        existing.total += attack.damage
      }
    }

    const targets = [...damage.keys()].sort((a, b) => a - b)
    for (const ordinal of targets) {
      const entry = damage.get(ordinal)
      const target = context.byOrdinal.get(ordinal)
      if (entry === undefined || target === undefined) continue
      const hpBefore = hpAtTierStart.get(ordinal) ?? target.hp
      const hpAfter = Math.max(0, hpBefore - entry.total)
      target.hp = hpAfter
      context.events.push({
        kind: "damage.applied",
        tick: context.tick,
        entity: target.id,
        ordinal: target.ordinal,
        source: entry.source.id,
        sourceOrdinal: entry.source.ordinal,
        amount: hpBefore - hpAfter,
        hpBefore,
        hpAfter,
      })
      if (hpAfter <= 0 && !target.pendingDead) {
        target.pendingDead = true
        target.killer = entry.source.id
      }
    }
  }
}

/**
 * Deaths, destruction, salvage — and detonations, which can cause more of all three.
 *
 * Volatile munitions make death contagious, so resolution is a queue rather than a pass: an entity
 * that dies detonates, the blast damages everything inside its radius including its own side, and
 * anything that reaches zero joins the queue. **The chain is bounded because an entity can only die
 * once**, so the queue drains after at most one round per entity, and the order is ordinal order
 * throughout — the same fight resolves the same way whichever entity happens to be checked first.
 */
function resolution(context: TickContext): void {
  const settled = new Set<number>()
  for (;;) {
    const dying = context.actors
      .filter((actor) => actor.pendingDead && !settled.has(actor.ordinal))
      .sort((a, b) => a.ordinal - b.ordinal)
    if (dying.length === 0) break
    for (const actor of dying) settled.add(actor.ordinal)
    resolveDeaths(context, dying)
  }
  const dead = context.actors.filter((actor) => actor.pendingDead)
  if (dead.length > 0) {
    context.actors = context.actors.filter((actor) => !actor.pendingDead)
  }
}

function detonate(context: TickContext, actor: Actor): void {
  const blast = actor.definition.detonation
  if (blast === undefined) return

  const caught = context.actors
    .filter((other) => other.ordinal !== actor.ordinal && !other.pendingDead)
    .filter(
      (other) =>
        footprintDistance(
          actor.anchor,
          actor.definition.footprint,
          other.anchor,
          other.definition.footprint,
        ) <= blast.radius,
    )
    .sort((a, b) => a.ordinal - b.ordinal)

  context.events.push({
    kind: "entity.detonated",
    tick: context.tick,
    entity: actor.id,
    ordinal: actor.ordinal,
    player: actor.player,
    contentId: actor.contentId,
    at: actor.anchor,
    radius: blast.radius,
    damage: blast.damage,
    caught: caught.map((other) => other.id),
  })

  for (const other of caught) {
    const hpBefore = other.hp
    const hpAfter = Math.max(0, hpBefore - blast.damage)
    other.hp = hpAfter
    context.events.push({
      kind: "damage.applied",
      tick: context.tick,
      entity: other.id,
      ordinal: other.ordinal,
      source: actor.id,
      sourceOrdinal: actor.ordinal,
      amount: hpBefore - hpAfter,
      hpBefore,
      hpAfter,
    })
    if (hpAfter <= 0 && !other.pendingDead) {
      other.pendingDead = true
      other.killer = actor.id
    }
  }
}

function resolveDeaths(context: TickContext, dying: readonly Actor[]): void {
  for (const actor of dying) {
    const structure = actor.definition.layer === "obstacles"
    context.events.push(
      structure
        ? {
            kind: "structure.destroyed",
            tick: context.tick,
            entity: actor.id,
            ordinal: actor.ordinal,
            player: actor.player,
            contentId: actor.contentId,
            at: actor.anchor,
            killer: actor.killer,
          }
        : {
            kind: "entity.died",
            tick: context.tick,
            entity: actor.id,
            ordinal: actor.ordinal,
            player: actor.player,
            contentId: actor.contentId,
            at: actor.anchor,
            killer: actor.killer,
          },
    )
    if (actor.definition.salvage > 0) {
      context.groundItems.push({
        at: actor.anchor,
        amount: actor.definition.salvage,
        sourceId: actor.id,
        sourceContentId: actor.contentId,
      })
      context.events.push({
        kind: "salvage.dropped",
        tick: context.tick,
        at: actor.anchor,
        amount: actor.definition.salvage,
        source: actor.id,
        sourceContentId: actor.contentId,
      })
    }
    // Everything that was aiming at this entity loses its target now, while the dying actor's id
    // is still in hand — so the event names the entity rather than a bare ordinal, and the loss is
    // reported on the tick it actually happened.
    for (const observer of context.actors) {
      if (observer.targetOrdinal !== actor.ordinal) continue
      observer.targetOrdinal = null
      context.events.push({
        kind: "target.lost",
        tick: context.tick,
        entity: observer.id,
        ordinal: observer.ordinal,
        target: actor.id,
        targetOrdinal: actor.ordinal,
      })
    }
    context.index.remove(
      actor.definition.layer,
      actor.ordinal,
      actor.anchor,
      actor.definition.footprint,
    )
    context.byOrdinal.delete(actor.ordinal)
    // The tile stays blocked for a couple of ticks — the settle rule the owner's playtest asked
    // for. Another unit stepping into a corpse's footprint the instant it clears reads as a glitch.
    context.vacated.add(
      actor.definition.layer,
      actor.anchor,
      actor.definition.footprint,
      context.tick + DEATH_SETTLE_TICKS,
    )
    // The blast comes after the death is announced, so a reader of the event stream sees the entity
    // die and then take its neighbours with it, in that order.
    detonate(context, actor)
  }
}

// ---------------------------------------------------------------------------
// 9. Objectives and victory
// ---------------------------------------------------------------------------

function victory(context: TickContext): Outcome | null {
  const nexusAlive: Record<PlayerId, boolean> = { A: false, B: false }
  const mobileAlive: Record<PlayerId, boolean> = { A: false, B: false }
  for (const actor of context.actors) {
    if (actor.definition.nexus === true) nexusAlive[actor.player] = true
    if (isMobile(actor)) mobileAlive[actor.player] = true
  }

  const nexusLost = PLAYERS.filter(
    (player) => context.pulse.roster[player].hasNexus && !nexusAlive[player],
  )
  if (nexusLost.length === 2) {
    return { winner: null, reason: "nexus-destroyed", tick: context.tick }
  }
  const loser = nexusLost[0]
  if (loser !== undefined) {
    return { winner: loser === "A" ? "B" : "A", reason: "nexus-destroyed", tick: context.tick }
  }

  // "Annihilated" means every entity on `workers`, `units`, and `air` is dead — workers count (Q13).
  const annihilated = PLAYERS.filter(
    (player) => context.pulse.roster[player].hasMobile && !mobileAlive[player],
  )
  if (annihilated.length === 2) {
    return { winner: null, reason: "annihilation", tick: context.tick }
  }
  const wiped = annihilated[0]
  if (wiped !== undefined) {
    return { winner: wiped === "A" ? "B" : "A", reason: "annihilation", tick: context.tick }
  }

  if (context.tick >= context.pulse.pulseTicks) {
    return { winner: null, reason: "tick-limit", tick: context.tick }
  }
  return null
}

// ---------------------------------------------------------------------------
// One tick
// ---------------------------------------------------------------------------

export function stepTick(state: MatchState, pulse: PulseContext): TickResult {
  if (state.outcome !== null) return { state, events: [] }

  const actors: Actor[] = state.entities.map((entity) => ({
    ordinal: entity.ordinal,
    id: entity.id,
    player: entity.player,
    contentId: entity.contentId,
    definition: pulse.registry.get(entity.contentId),
    hp: entity.hp,
    anchor: entity.anchor,
    facing: entity.facing,
    moveCredit: entity.moveCredit,
    cooldown: entity.cooldown,
    targetOrdinal: entity.targetOrdinal,
    pendingDead: false,
    killer: null,
  }))

  const index = new OccupancyIndex(state.grid)
  for (const actor of actors) {
    index.add(actor.definition.layer, actor.ordinal, actor.anchor, actor.definition.footprint)
  }

  const tick = state.tick + 1

  const context: TickContext = {
    // 1. Tick open. Advance the tick counter. Nothing else.
    tick,
    pulse,
    actors,
    byOrdinal: new Map(actors.map((actor) => [actor.ordinal, actor])),
    index,
    // Entries expired as of this tick are dropped rather than carried forward: every entry left in
    // the overlay is active for the whole tick, so a query never has to ask "as of when?".
    vacated: new VacatedOverlay(state.vacatedTiles.filter((entry) => entry.until >= tick)),
    movedThisTick: new Set(),
    rng: Pcg32.restore(state.rng),
    events: [],
    groundItems: [...state.groundItems],
  }

  economyAndProduction(context) // 2
  perception(context) // 3
  const declared = intents(context) // 4
  const grants = arbitrate(context, declared) // 5
  settle(context, grants) // 6
  attacks(context) // 7
  resolution(context) // 8
  const outcome = victory(context) // 9

  const entities: EntityState[] = context.actors
    .map((actor) => ({
      ordinal: actor.ordinal,
      id: actor.id,
      player: actor.player,
      contentId: actor.contentId,
      hp: actor.hp,
      anchor: actor.anchor,
      facing: actor.facing,
      moveCredit: actor.moveCredit,
      cooldown: actor.cooldown,
      targetOrdinal: actor.targetOrdinal,
    }))
    .sort((a, b) => a.ordinal - b.ordinal)

  if (outcome !== null) {
    context.events.push({
      kind: "pulse.ended",
      tick: context.tick,
      winner: outcome.winner,
      reason: outcome.reason,
    })
  }

  const next: MatchState = {
    ...state,
    tick: context.tick,
    entities,
    groundItems: context.groundItems,
    vacatedTiles: context.vacated.activeAt(context.tick),
    outcome,
    rng: context.rng.snapshot(),
  }
  return { state: next, events: context.events }
}

/** Exposed for the collision invariant test: the occupancy the kernel would build for a state. */
export function occupancyFor(state: MatchState, pulse: PulseContext): OccupancyIndex {
  const index = new OccupancyIndex(state.grid)
  for (const entity of state.entities) {
    const definition = pulse.registry.get(entity.contentId)
    index.add(definition.layer, entity.ordinal, entity.anchor, definition.footprint)
  }
  return index
}
