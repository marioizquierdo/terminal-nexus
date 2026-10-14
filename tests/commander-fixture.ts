// The Commander's named scenario — not a test file itself: the runners only pick up `*.test.ts`. A three-round
// mission on the starter map built so Vasse falls in round 1: she sits no round out (her `roundsOut` is 0), so the
// Nexus restores her as round 2 opens. PERIMETER is not built to make her fall early, so her return is proven
// here.
//
// It is the second level of her campaign now (`armies/vasse/army.json`, level `vasse-test-2`), so the game can
// open it by route and her return can be played. Re-exported here, by its old name, so the tests keep one import.
//
// A Commander who sits rounds out is a disadvantage no Commander has yet, so its path is proven on the same
// mission with a test-only Vasse who sits one round out, or two (`sittingOut`).

import { campaignLevel } from "../src/armies/index.ts"
import { FIXTURE_REGISTRY, createRegistry } from "../src/content/index.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import type { MissionDefinition } from "../src/mission/index.ts"

export const VASSE = "unit.citizen.vasse"

export const COMMANDER_FALLS: MissionDefinition = campaignLevel("vasse-test-2").mission

/** `registry` with Vasse sitting `rounds` whole rounds out after the round she falls in: test-only content, the
 *  rule's other path. Nothing else is touched. */
export function sittingOut(rounds: number, registry: ContentRegistry = FIXTURE_REGISTRY): ContentRegistry {
  return createRegistry(registry.ids().map((id) => (id === VASSE ? { ...registry.get(id), roundsOut: rounds } : registry.get(id))))
}
