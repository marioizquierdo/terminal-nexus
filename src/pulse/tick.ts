// THE PULSE — how state changes. A pure function stepping state forward in fixed logical ticks,
// with no clock, no terminal, no frames, and no colour (grid-engine.md).
//
// The nine phases below are the ones pulse.md describes, in order. The economy-and-production phase
// holds only production so far (a building training its recipe, `production.ts`); a resource yield
// waits for the worker economy. Every phase reads the state
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
import { production } from "./production.ts"
import type { Actor, TickContext } from "./shared.ts"
import { spawning } from "./spawn.ts"
import { victory } from "./victory.ts"

export type TickResult = Readonly<{ state: MatchState; events: readonly DomainEvent[] }>

export { DEATH_SETTLE_TICKS } from "./death.ts"

// ---------------------------------------------------------------------------
// 2. Economy and production
// ---------------------------------------------------------------------------

function economyAndProduction(context: TickContext): void {
  // No resource yields yet: that is the worker-economy milestone's. Producers train their recipes
  // (step 6C), ahead of perception, so a unit trained this tick perceives, moves and fights in it.
  production(context)
}

// ---------------------------------------------------------------------------
// One tick
// ---------------------------------------------------------------------------

export function stepTick(state: MatchState, pulse: PulseContext): TickResult {
  if (state.outcome !== null) return { state, events: [] }

  const actors: Actor[] = state.entities.map((entity) => ({
    ...entity,
    definition: pulse.registry.get(entity.contentId),
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
    // Rebuilt from scratch every tick: perception() unconditionally reassigns every actor's
    // targetOrdinal through setTarget(), so by the time anything reads this it already reflects
    // this tick's state in full — nothing needs to be seeded from the previous tick.
    targetObservers: new Map(),
    nextOrdinal: state.nextOrdinal,
    // The sides' targets are the state's, read and never written: only the trigger runner sets them.
    targets: state.targets ?? {},
    // Who an aura guards is decided as the attacks begin (`attacks.ts`), once the tick's moves have settled.
    guards: new Map(),
  }

  // 1.5. Spawning — from the unit-architecture spike; not one of the nine phases pulse.md names.
  // Ahead of perception so anything created this tick is a full participant in every phase after it:
  // perceived, able to move or fire, and counted for victory, exactly as if it had stood since tick 0.
  spawning(context)
  economyAndProduction(context) // 2
  perception(context) // 3
  const declared = intents(context) // 4
  const grants = arbitrate(context, declared) // 5
  settle(context, grants) // 6
  attacks(context) // 7
  resolution(context) // 8
  const outcome = victory(context) // 9

  // Named field by field on purpose, unlike the actor.ts -> Actor conversion above: this is the
  // boundary back into MatchState, which is hashed, serialized, and replayed (state/serialize.ts).
  // `Actor` carries `definition` and the two per-tick flags `pendingDead`/`killer` that must never
  // reach that boundary; spreading and destructuring them away would work today, but it would also
  // mean a *new* actor-only field some future phase adds (a target lock timer, anything else that
  // is bookkeeping rather than truth) leaks into state the instant someone forgets to name it here.
  // The exhaustive list is what makes "does this belong in state" a decision at every field, not a
  // default.
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
      windup: actor.windup,
      spawnCooldown: actor.spawnCooldown,
      focusStreak: actor.focusStreak,
      // Only a producer has these; leaving them off everything else keeps every other state's bytes.
      ...(actor.productionCooldown === undefined ? {} : { productionCooldown: actor.productionCooldown }),
      ...(actor.produced === undefined ? {} : { produced: actor.produced }),
      ...(actor.owed === undefined ? {} : { owed: actor.owed }),
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
    nextOrdinal: context.nextOrdinal,
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
