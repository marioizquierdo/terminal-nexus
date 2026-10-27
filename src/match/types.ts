// The match layer's data — what a Battle Round starts from.
//
// `src/match/` is the rules layer *around* the tick kernel (the "scenario runtime" of grid-engine.md):
// it builds the state a Pulse starts from out of what the Build Phase committed, and it does what
// pulse.md says happens when a Pulse ends. It sits beside `src/pulse` and never inside its
// tick — nothing here is called by `stepTick`, so no existing hash can move — and it is deterministic
// the way the kernel is: no clock, no unseeded randomness, no terminal, nothing from the view.

import type { Coord } from "../grid/types.ts"
import type { MatchState, PlayerId } from "../state/types.ts"

/** A structure standing on the Grid when the Pulse starts: the player's own standing buildings and the
 *  ones the Build Phase committed, which "reveal together and become operational" at Pulse start
 *  (pulse.md), and a scripted side's own plan (a mission's `commitPlan`). */
export type StructurePlacement = Readonly<{
  contentId: string
  /** Whose it is; the player's own, side A, when absent. */
  player?: PlayerId
  /** The footprint's anchor — its north-west tile, the way the Build Phase stores a placement. */
  anchor: Coord
}>

/**
 * A group of mobile units that begins the Pulse gathered around one tile. Units are set down on the
 * free tiles nearest the muster point, in the order listed, under their own collision masks — so a
 * building the player committed on top of a muster point moves the units aside rather than failing.
 */
export type Force = Readonly<{
  player: PlayerId
  /** The tile the force gathers around: the centre tile of its first unit, when that tile is free. */
  muster: Coord
  /** Content ids, one per unit, in placement order. */
  units: readonly string[]
}>

/**
 * What a Pulse needs besides the plan: who is on the Grid and how long it may last. **Placeholder
 * content** — the Build Phase's starting force and raid, in the same standing as its placeholder
 * Nexus powers. In a mission the trigger runner (`mission.ts`) supplies PERIMETER's raid instead of
 * the static raid.
 */
export type PulseSetup = Readonly<{
  /** The gameplay seed: one PCG32 stream, the kernel's only randomness (pulse.md). */
  seed: number
  /** The Pulse's length in ticks — the tick limit its end condition falls back on. */
  pulseTicks: number
  forces: readonly Force[]
}>

// ---------------------------------------------------------------------------------------------
// The regroup between rounds (`regroup.ts`): its timing and its walks, here so the view may read them without
// reaching the rules that work them out.
// ---------------------------------------------------------------------------------------------

/** The regroup's three parts, in ticks at 12 a second: the step back (2 s), forming up (6 s), standing formed (2 s). */
export const STEP_BACK_TICKS = 24
export const FORM_TICKS = 72
export const STAND_TICKS = 24
/** The whole regroup: 10 seconds. */
export const REGROUP_TICKS = STEP_BACK_TICKS + FORM_TICKS + STAND_TICKS

/** One step of a survivor's walk: the tick of the regroup it lands on (1 to `REGROUP_TICKS`), and where. */
export type RegroupStep = Readonly<{ tick: number; to: Coord }>

/** A survivor's whole walk: where it stood as the round ended, every step it took, where it ends, and the slot it was
 *  given in its side's formation (`null` for none: no line to form on, or no room). */
export type RegroupPath = Readonly<{
  ordinal: number
  player: PlayerId
  contentId: string
  from: Coord
  to: Coord
  steps: readonly RegroupStep[]
  slot: Coord | null
}>

export type RegroupResult = Readonly<{
  /** The state the next Build Phase and Battle Round start from: survivors where the regroup leaves them, transient
   *  fields reset, the clock, outcome, cooling tiles and fire cleared. */
  state: MatchState
  /** One per survivor, in ordinal order: what the Build Phase plays. */
  paths: readonly RegroupPath[]
  /** How long the regroup lasts, in ticks. */
  ticks: number
}>

/** Where a survivor stands at a tick of its walk (0: as the round ended). */
export function regroupAt(path: Pick<RegroupPath, "from" | "steps">, tick: number): Coord {
  let at = path.from
  for (const each of path.steps) {
    if (each.tick > tick) break
    at = each.to
  }
  return at
}

/** A setup or a plan the kernel could not start from: named, so the caller can say why. */
export class PulseSetupError extends Error {}
