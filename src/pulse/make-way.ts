// Making way for a wave — the queue at a building's door (the owner, 2026-10-21: "We should also solve how to "queue"
// a unit that spawned but has no space yet because there are other units on top").
//
// A building that has no room on its roof for its wave owes the rest (`production.ts`, `owed`) and sets each down the
// first tick there is room. Survivors come home onto the roof of the building that trained them (Recall), so a round
// can open with the roof full and the first wave owed. A unit standing there with somewhere to go walks off the roof
// on its way and frees it; one with nothing to walk for would stand on it for good, and the wave would never come.
// So **a unit on its side's roofs while one of its side's buildings owes units, with nothing to walk for, makes way**:
// it walks to the nearest ground off its side's roofs (the "ground" goal, `routes.ts`), facing where it would look, and
// stands there. Any of its side's roofs, not only the owing building's: a base's buildings stand side by side, their
// roofs one floor, and a playtest of the curve level found a wave held for ninety ticks behind units idle on the
// roofs next door, every one of them waiting for the one beside it.
//
// What "nothing to walk for" means is what its purpose already says: it would stand — idle, gathered at its side's
// target, or already in reach of its target and fighting. A unit **in the middle of its windup** keeps its place
// until its first shot fires: a shot the rules have already begun to aim is not thrown away for a door, and the wave
// waits a few ticks longer. A unit that cannot move never makes way, and nothing here reads anything but the state.

import { hasRoom, supplyOf } from "../content/supply.ts"
import type { Coord } from "../grid/types.ts"
import { contentOf } from "./context.ts"
import type { Purpose } from "./routes.ts"
import type { Actor, TickContext } from "./shared.ts"
import { inAttackRange, onRoof } from "./shared.ts"
import { targetFor } from "./target.ts"

/** `purpose`, unless `actor` is on its side's roofs while its side owes a wave (`onOwingRoof`): then off the roofs, to
 *  the nearest ground — facing where it was walking to, or for one that would stand, its target, else its side's
 *  target, else where it stands. One fleeing flees, and one mid-windup holds. */
export function makingWay(context: TickContext, actor: Actor, target: Actor | null, purpose: Purpose): Purpose {
  if (purpose.kind === "flee" || (purpose.kind === "walk" && purpose.goal.kind === "ground")) return purpose
  if (actor.definition.movementRate === undefined || actor.definition.behavior === "static" || actor.pendingDead) return purpose
  if (!onOwingRoof(context, actor)) return purpose
  if (purpose.kind === "walk") {
    // Already on its way: off the roofs the nearest way first, facing where it was going.
    const goal = purpose.goal
    const toward = goal.kind === "unit" ? goal.target.anchor : goal.kind === "area" ? { x: goal.area.x, y: goal.area.y } : goal.toward
    return { kind: "walk", goal: { kind: "ground", toward } }
  }
  if (midWindup(actor, target)) return purpose
  const area = targetFor(context, actor)
  const toward: Coord = target !== null ? target.anchor : area !== null ? { x: area.x, y: area.y } : actor.anchor
  return { kind: "walk", goal: { kind: "ground", toward } }
}

/** Whether `actor` stands on its side's roofs while one of its side's buildings still owes units of a wave that its
 *  army has room for. Any of its side's roofs, not only the owing building's: buildings stand side by side, their
 *  roofs one floor, and a unit idle on the next roof is as much in the way of the one behind it as a unit on the
 *  building's own. A wave its side's supply holds back waits for a place in the army, not for room on a roof, so it
 *  moves nobody: a playtest of the curve level, its army at its supply cap from the fourth round, found every unit on
 *  its roofs sent down into ground already full, walking and never moving, and the base jammed round them. */
export function onOwingRoof(context: Pick<TickContext, "index" | "byOrdinal" | "actors" | "pulse">, actor: Actor): boolean {
  if (!onRoof(context, actor)) return false
  const owing = context.actors.filter((other) => other.player === actor.player && !other.pendingDead && (other.owed ?? 0) > 0)
  if (owing.length === 0) return false
  const supply = supplyOf(context.actors.filter((other) => other.player === actor.player && !other.pendingDead).map((other) => other.definition))
  const content = contentOf(context.pulse, actor.player)
  return owing.some((building) => {
    const output = building.definition.production?.output
    return output === undefined || !content.has(output) || hasRoom(supply, content.get(output))
  })
}

/** Whether `actor` is part way through its windup on `target`: in reach, its windup begun and not yet spent. */
function midWindup(actor: Actor, target: Actor | null): boolean {
  const attack = actor.definition.attack
  const full = attack?.windupTicks ?? 0
  if (attack === undefined || target === null || full === 0) return false
  return actor.windup > 0 && actor.windup < full && inAttackRange(actor, target, attack)
}
