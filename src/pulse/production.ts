// Automatic production — phase 2 of the tick (pulse.md): "a producer attempts a fixed recipe on a
// recurring interval". The smallest slice of it, step 6C's: a building with a `production` recipe trains
// its output on its own, and nothing else of the economy exists — no cost, no resource, no supply, no
// workers. With nothing to pay and nothing to supply, two producers training on the same tick never
// compete for anything, so the seeded contention process pulse.md describes has nothing to decide and is
// not built: producers simply act in ordinal order, and the only thing that order decides is which of
// two neighbours claims a shared free tile first — which `spawnOneNear`'s fixed search settles the same
// way on every run.
//
// The cadence follows `spawning()`'s (spawn.ts): count down first, act on reaching zero, start a full
// interval again. One difference, on purpose: a building with no free tile beside it does not lose its
// turn. It waits at zero and trains on the first tick there is room, since a barracks whose doorway
// was crowded by its own troopers should not quietly train fewer of them.

import { spawnOneNear } from "./spawn.ts"
import type { TickContext } from "./shared.ts"

export function production(context: TickContext): void {
  // Snapshotted, so a unit trained this tick is never itself asked to train.
  const producers = context.actors.filter((actor) => actor.definition.production !== undefined && !actor.pendingDead)
  for (const actor of producers) {
    const recipe = actor.definition.production
    if (recipe === undefined) continue
    const produced = actor.produced ?? 0
    if (produced >= recipe.perPulse) continue
    const cooldown = Math.max(0, (actor.productionCooldown ?? recipe.intervalTicks) - 1)
    actor.productionCooldown = cooldown
    if (cooldown > 0) continue

    let trained = 0
    for (let count = 0; count < recipe.quantity; count += 1) {
      if (spawnOneNear(context, actor, recipe.output, actor.id) !== null) trained += 1
    }
    if (trained === 0) continue
    actor.produced = produced + 1
    actor.productionCooldown = recipe.intervalTicks
  }
}
