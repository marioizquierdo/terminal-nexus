// 5 and 6. Arbitration and settle — engine.md 4.3. Who wins a contested tile, and applying the
// grants that survive it.

import { ClaimOverlay } from "../grid/occupancy.ts"
import type { Coord, Direction } from "../grid/types.ts"
import { movementGoal } from "./intents.ts"
import type { Intent } from "./intents.ts"
import { rankedSteps, stepCost } from "./movement.ts"
import type { StepChoice } from "./movement.ts"
import { blockReasonFor, maskForActor, resolveTarget, speedTier } from "./shared.ts"
import type { Actor, TickContext } from "./shared.ts"

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
export function arbitrate(context: TickContext, declared: Intent[]): Grant[] {
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
  const target = resolveTarget(context, actor)
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
  // Full footprint, same reasoning as the other move.blocked report above.
  const blocker = maskForActor(context, actor, overlay).footprintBlockerAt(
    desired,
    actor.definition.footprint,
  )
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

export function settle(context: TickContext, grants: readonly Grant[]): void {
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
