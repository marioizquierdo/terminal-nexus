// The Commander's named scenario — not a test file itself: the runners only pick up `*.test.ts`. A three-round
// mission on the starter map built to spend the whole cadence pulse.md gives a Commander: Vasse falls in round 1,
// sits round 2 out, and the Nexus restores her for round 3. In PERIMETER she cannot fall before round 2, so her
// return would come in a round 4 that does not exist; the rule is proven here.
//
// It is the second level of her campaign now (`armies/vasse/army.json`, level `vasse-test-2`), so the game can
// open it by route and her return can be played. Re-exported here, by its old name, so the tests keep one import.

import { campaignLevel } from "../src/armies/index.ts"
import type { MissionDefinition } from "../src/mission/index.ts"

export const VASSE = "unit.citizen.vasse"

export const COMMANDER_FALLS: MissionDefinition = campaignLevel("vasse-test-2").mission
