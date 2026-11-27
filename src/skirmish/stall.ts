// **A stalled battle**: one that goes nowhere. `--play-to end` raises a battle's limit to 100 rounds so a battle is
// played to a Nexus falling rather than judged after its eight (the Skirmish milestone found a rush that never reaches a
// turtle on the Crossing that way, docs/milestones/milestone-20-skirmish-worth-showing.md). Two sides that hold apart
// would then play all hundred rounds, and a tally of many battles ran for a day (docs/history/reports/
// 2026-11-26-rally-point-session.md). A battle in which neither Nexus has lost or gained health for `STALL_ROUNDS`
// rounds in a row has stalled: the run stops it there and says so, and a tally counts it apart.

import type { BattleState } from "../battle/index.ts"
import { SIDES } from "../battle/index.ts"

/** How many rounds in a row with no change to either Nexus make a battle stalled. */
export const STALL_ROUNDS = 10

/** The round a battle's stall began in, when its last `STALL_ROUNDS` rounds left both Nexuses as they found them; else
 *  `null`. Read from the round reports alone, so a saved battle reads the same. */
export function stalledSince(state: BattleState): number | null {
  if (state.result !== null) return null
  const last = state.history.slice(-STALL_ROUNDS)
  if (last.length < STALL_ROUNDS) return null
  const still = last.every((report) => SIDES.every((side) => report.reading.sides[side].buildings.nexus.before === report.reading.sides[side].buildings.nexus.after))
  return still ? (last[0]?.round ?? null) : null
}
