// How a Battle Round opens, in one place: what the regroup left, the Commanders due back set down beside their Nexus, the
// buildings that go down, and the forces mustered (the first round's Commander and starting package, then each side's
// call-ups), handed to the match's `opening`. `playRound` opens every round with `roundOpening`, and the Skirmish's Build
// Phase screen asks the same function what arrives, so the see-through preview and the battle are one piece of code.
//
// Pure: the same battle and input give the same opening.

import type { ContentRegistry } from "../content/index.ts"
import type { Coord } from "../grid/types.ts"
import type { Absence, Force, Restoration, StructurePlacement } from "../match/index.ts"
import { opening, restoreCommanders } from "../match/index.ts"
import type { MatchState } from "../state/types.ts"
import { battleGrid } from "./maps.ts"
import { armyOf } from "./sides.ts"
import { mapOf, musterOf, standingOf } from "./round.ts"
import type { BattleState, Side } from "./types.ts"
import { SIDES } from "./types.ts"

/** Units a power kept this round calls up, by kind. */
export type Callup = Readonly<{ unit: string; count: number }>

/** The Commanders due back set down beside their Nexus, and who is still out. */
export type Restored = Readonly<{ state: MatchState; absent: Absence[]; restored: Restoration[] }>

/** What a round's opening is made from beyond the battle itself. */
export type RoundOpeningInput = Readonly<{
  /** Each side's content this round: what its things are defined by. */
  sides: Readonly<Record<Side, ContentRegistry>>
  /** Each side's call-ups this round (empty for none). */
  callups: Readonly<Record<Side, readonly Callup[]>>
  /** This round's buildings, both sides', in the order they go down. Absent: none (a preview). */
  built?: readonly StructurePlacement[]
  /** Buildings told to hold production this round. Absent or empty: none. */
  held?: readonly Coord[]
  /** Standing buildings refitted this round, as the content id each starts with. Absent or empty: none. */
  refits?: readonly Readonly<{ anchor: Coord; contentId: string }>[]
}>

/** The Commanders due back this round set down beside their Nexus; `null` before a battle's first round. */
export function restoredOf(state: BattleState, sides: Readonly<Record<Side, ContentRegistry>>): Restored | null {
  if (state.carried === null) return null
  return restoreCommanders(state.carried, [...state.sides.A.absent, ...state.sides.B.absent], state.round, sides.A, sides)
}

/** **A round's opening**: what the Battle Round starts from, and the restoration it was built on. Throws when the
 *  match's `opening` finds no room. */
export function roundOpening(state: BattleState, input: RoundOpeningInput): Readonly<{ state: MatchState; restored: Restored | null }> {
  const { sides } = input
  const restored = restoredOf(state, sides)
  const structures: StructurePlacement[] = []
  if (state.carried === null) for (const side of SIDES) structures.push(...standingOf(state, side))
  structures.push(...(input.built ?? []))
  const forces: Force[] = []
  for (const side of SIDES) {
    const muster = musterOf(state, side, sides[side])
    const units: string[] = []
    if (state.carried === null) {
      const { commander } = armyOf(state, side)
      units.push(commander.unit)
      for (const { unit, count } of commander.start) for (let n = 0; n < count; n += 1) units.push(unit)
    }
    for (const { unit, count } of input.callups[side]) for (let n = 0; n < count; n += 1) units.push(unit)
    if (units.length > 0) forces.push({ player: side, muster, units })
  }
  const opened = opening({
    grid: battleGrid(mapOf(state)),
    registry: sides.A,
    sides,
    structures,
    setup: { seed: state.setup.seed, pulseTicks: state.setup.pulseTicks, forces },
    ...(restored === null ? {} : { carried: restored.state }),
    ...(input.held === undefined || input.held.length === 0 ? {} : { held: input.held }),
    ...(input.refits === undefined || input.refits.length === 0 ? {} : { refits: input.refits }),
  }).state
  return { state: opened, restored }
}
