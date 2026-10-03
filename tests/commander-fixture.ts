// The Commander's named scenario — not a test file itself: the runners only pick up `*.test.ts`. A
// three-round mission on the starter map built to spend the whole cadence pulse.md gives a Commander:
// Vasse falls in round 1, sits round 2 out, and the Nexus restores her for round 3. It is a fixture, not a
// mission of the game: in PERIMETER she cannot fall before round 2, so her return would come in a round 4
// that does not exist, and the rule is proven here and only shown there.

import type { MissionDefinition } from "../src/mission/index.ts"

export const VASSE = "unit.citizen.vasse"
const TROOPER = "unit.citizen.trooper"
const RAIDER = "unit.ravel.raider"
const RUNNER = "unit.ravel.runner"

export const COMMANDER_FALLS: MissionDefinition = {
  id: "mission.test.commander-falls",
  name: "The Commander falls",
  pulses: 3,
  // Twenty seconds a round, more than the line needs to finish what kills her.
  pulseTicks: 240,
  // "VASS".
  seed: 0x56415353,
  regions: [
    // Out in front of the base, alone: where the ambush finds her.
    { id: "front", x: 30, y: 10, width: 1, height: 1 },
    // Beside the Nexus, where the line stands.
    { id: "muster", x: 21, y: 9, width: 3, height: 3 },
    // Right beside her.
    { id: "ambush", x: 32, y: 9, width: 2, height: 3 },
    { id: "nexus", x: 17, y: 10, width: 3, height: 2 },
  ],
  triggers: [
    { id: "vasse", when: { pulse: 1, tick: 0 }, do: [{ spawn: { side: "A", units: [{ unit: VASSE, count: 1 }], at: "front" } }] },
    { id: "line", when: { pulse: 1, tick: 0 }, do: [{ spawn: { side: "A", units: [{ unit: TROOPER, count: 5 }], at: "muster" } }] },
    {
      id: "ambush",
      when: { pulse: 1, tick: 0 },
      do: [{ spawn: { side: "B", units: [{ unit: RAIDER, count: 2 }], at: "ambush", order: { advance: "nexus" }, intent: "Catch the Commander alone." } }],
    },
    { id: "probe-2", when: { pulse: 2, tick: 0 }, do: [{ spawn: { side: "B", units: [{ unit: RUNNER, count: 2 }], at: "ambush" } }] },
    { id: "probe-3", when: { pulse: 3, tick: 0 }, do: [{ spawn: { side: "B", units: [{ unit: RUNNER, count: 2 }], at: "ambush" } }] },
    { id: "fallen", when: { event: "nexus.destroyed", side: "A" }, do: [{ lose: true }] },
    { id: "hold", when: { event: "pulse.end", pulse: 3 }, do: [{ win: true }] },
  ],
}
