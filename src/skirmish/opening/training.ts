// What a building does in a sandbox's Battle Round: what its army's card says (docs/system-design/sandboxes.md,
// "A building's wave"). The owner's decision: "if you are testing a building, you are placing it in there in battle
// mode, and the sandbox has enough resources, then the buildings will start doing its thing."
//
// A battle gives each building whose card has `spawns` a production recipe (`battleContent`, `src/battle/round.ts`);
// this gives a Battle Round sandbox the same recipe, with the same first wave (the tuned `firstWave`) and roof exit
// (the default, along the route). Nothing is checked about resources: production costs no credits in a battle, so a
// sandbox has always had "enough". The Build Phase trains nothing, and a building that already has a recipe (a caller's
// own, as `measure formations` gives its Barracks) keeps it, so it never doubles up. A building's structure belongs to
// one army's card, so two cards giving it different spawns does not arise; if it ever did, the first army in
// `ARMIES` order wins, as in a battle.

import { ARMIES } from "../../armies/index.ts"
import type { BuildingSpawns } from "../../armies/index.ts"
import { defaultValue } from "../../build/all-settings.ts"
import type { ContentRegistry } from "../../content/index.ts"
import { spawningRegistry } from "../../match/index.ts"
import { TICKS_PER_SECOND } from "../../state/types.ts"
import { phaseOf } from "./phase.ts"
import type { BattleOpening } from "./types.ts"

/** Each structure's spawns by the first card of the armies that gives it any. */
const CARD_SPAWNS: Readonly<Record<string, BuildingSpawns>> = (() => {
  const spawns: Record<string, BuildingSpawns> = {}
  for (const army of ARMIES.armies) for (const card of army.buildings ?? []) if (card.spawns !== undefined) spawns[card.structure] ??= card.spawns
  return spawns
})()

/**
 * `registry`, with each building the opening places that has a card that spawns training as the card says, in a Battle
 * Round; `registry` itself in the Build Phase, or when nothing placed trains. Called before the entities are made:
 * a building's production counters start from the registry it is created with.
 */
export function trainingRegistry(opening: BattleOpening, registry: ContentRegistry): ContentRegistry {
  if (phaseOf(opening) !== "battle-round") return registry
  const spawns: Record<string, BuildingSpawns> = {}
  for (const block of Object.values(opening.placements)) {
    for (const entry of Object.values(block.legend)) {
      const own = CARD_SPAWNS[entry.content]
      if (own === undefined || !registry.has(entry.content) || !registry.has(own.unit)) continue
      if (registry.get(entry.content).production !== undefined) continue
      spawns[entry.content] = own
    }
  }
  return spawningRegistry(registry, spawns, defaultValue("firstWave") * TICKS_PER_SECOND)
}
