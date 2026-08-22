// THE PULSE — how state changes. A pure function stepping state forward in fixed logical ticks,
// with no clock, no terminal, no frames, and no colour (engine.md 1).
//
// The nine phases below are engine.md 4.3, in order, including the two economy phases that exist
// and deliberately do nothing: the slot matters, the content does not. Every phase reads the state
// settled at the end of the previous phase, so iteration order over entities can never decide an
// outcome — it only ever decides the order events are emitted in.
//
// Each phase's functions live in their own file — perception.ts, intents.ts, arbitration.ts,
// attacks.ts, death.ts, victory.ts — and this file is only the composition: build the tick's
// context, call the phases in order, fold the result back into a MatchState.

import type { DomainEvent } from "../events/types.ts"
import { OccupancyIndex, VacatedOverlay } from "../grid/occupancy.ts"
import { Pcg32 } from "../rng/pcg32.ts"
import type { EntityState, MatchState } from "../state/types.ts"
import type { PulseContext } from "./context.ts"
import { arbitrate, settle } from "./arbitration.ts"
import { attacks } from "./attacks.ts"
import { resolution } from "./death.ts"
import { intents } from "./intents.ts"
import { perception } from "./perception.ts"
import type { Actor, TickContext } from "./shared.ts"
import { victory } from "./victory.ts"

export type TickResult = Readonly<{ state: MatchState; events: readonly DomainEvent[] }>

export { DEATH_SETTLE_TICKS } from "./death.ts"

// ---------------------------------------------------------------------------
// 2. Economy and production
// ---------------------------------------------------------------------------

function economyAndProduction(_context: TickContext): void {
  // Deliberately empty for Gate 1A (milestone-1-spike-battle.md 3.7). Scheduled resource yield and
  // producer recipes belong to Milestone 2; the phase exists here so that the tick order it will
  // land in is already proven and already ordered relative to perception.
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
