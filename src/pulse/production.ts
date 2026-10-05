// Automatic production — phase 2 of the tick (pulse.md): "a producer attempts a fixed recipe on a
// recurring interval". The smallest slice of it: a building with a `production` recipe spawns its unit on
// its own, and nothing else of the economy exists — no cost, no resource, no supply, no workers. With
// nothing to pay and nothing to supply, two producers acting on the same tick never compete for anything,
// so the seeded contention process pulse.md describes has nothing to decide and is not built: producers
// simply act in ordinal order, and the only thing that order decides is which of two neighbours claims a
// shared free tile first — which `spawnOneNear`'s fixed search settles the same way on every run.
//
// **It spawns in waves** (the owner, 2026-10-05: "spawning units: should happen simultaneously at the
// beginning of the round, creating a more predictable squad formation"). A wave is the units a building sets
// down at once, and the word means nothing else in the game. The first comes `firstTicks` into the Pulse,
// each after it `intervalTicks` later, `waves` of them a Pulse; the schedule is the building's own and never
// slips. Every unit of a wave is set down on the tick it comes, one after another in the fixed ring order
// round the building's footprint (`footprintRing`, through `spawnOneNear`), so a wave stands together as a
// squad beside the building that made it.
//
// A building short of room never spawns fewer: what fits comes out now, and every unit still owed comes out
// on the first tick there is room beside it — the rule that a barracks whose doorway is crowded by its own
// troopers should not quietly train fewer of them, kept for a wave. What a wave owes rides on the building's
// state (`owed`), so it is part of the state every hash covers.
//
// The timer counts down first and acts on reaching zero, as `spawning()`'s does (spawn.ts), so a building's
// first wave comes on tick `firstTicks` exactly.

import { spawnOneNear } from "./spawn.ts"
import type { TickContext } from "./shared.ts"

export function production(context: TickContext): void {
  // Snapshotted, so a unit spawned this tick is never itself asked to spawn.
  const producers = context.actors.filter((actor) => actor.definition.production !== undefined && !actor.pendingDead)
  for (const actor of producers) {
    const recipe = actor.definition.production
    if (recipe === undefined) continue
    let owed = actor.owed ?? 0
    const come = actor.produced ?? 0
    if (come < recipe.waves) {
      const cooldown = Math.max(0, (actor.productionCooldown ?? recipe.firstTicks) - 1)
      if (cooldown > 0) actor.productionCooldown = cooldown
      else {
        // A wave comes: all of it is owed at once, and the next one is a full gap away.
        actor.produced = come + 1
        owed += recipe.perWave
        actor.productionCooldown = recipe.intervalTicks
      }
    }
    // Everything owed, together, as far as the room beside the building goes; the rest waits for room.
    while (owed > 0 && spawnOneNear(context, actor, recipe.output, actor.id) !== null) owed -= 1
    actor.owed = owed
  }
}
