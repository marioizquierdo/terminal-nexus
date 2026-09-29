// The match layer's data — what a Nexus Pulse starts from and what is true after Recall.
//
// `src/match/` is the rules layer *around* the tick kernel (engine.md Section 2's "scenario runtime"):
// it builds the state a Pulse starts from out of what the Build Phase committed, and it does what
// engine.md Section 5 says happens when a Pulse ends. It sits beside `src/pulse` and never inside its
// tick — nothing here is called by `stepTick`, so no existing hash can move — and it is deterministic
// the way the kernel is: no clock, no unseeded randomness, no terminal, nothing from the view.

import type { Coord } from "../grid/types.ts"
import type { MatchState, PlayerId } from "../state/types.ts"

/** A structure standing on the Grid when the Pulse starts: the player's own standing buildings and the
 *  ones the Build Phase committed, which "reveal together and become operational" at Pulse start
 *  (engine.md Section 5). `player` defaults to the player, side A. */
export type StructurePlacement = Readonly<{
  contentId: string
  /** The footprint's anchor — its north-west tile, the way the Build Phase stores a placement. */
  anchor: Coord
  player?: PlayerId
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
 * content while Milestone 6 is at gate 6A** — the spike's starting force and raid, in the same
 * standing as its placeholder Nexus powers. The trigger runner (6B) is what will replace the static
 * raid with PERIMETER's waves.
 */
export type PulseSetup = Readonly<{
  /** The gameplay seed: one PCG32 stream, the kernel's only randomness (engine.md 4.4). */
  seed: number
  /** The Pulse's length in ticks — the tick limit its end condition falls back on. */
  pulseTicks: number
  forces: readonly Force[]
}>

/** Where one survivor stands at the end of a Pulse and where Recall puts it. */
export type RecallMove = Readonly<{
  ordinal: number
  player: PlayerId
  contentId: string
  /** Its anchor when the Pulse ended. */
  from: Coord
  /** Its anchor after Recall — the same as `from` when it has no home to go to, or is already home. */
  to: Coord
  /** What it went home to: a producer that makes units like it, the Grid Nexus, or nothing. */
  home: "producer" | "nexus" | "none"
}>

export type RecallResult = Readonly<{
  /** The state the next Build Phase starts from: survivors regrouped, cooldowns reset, the Pulse's
   *  clock and outcome cleared. */
  state: MatchState
  /** One entry per surviving mobile unit, in ordinal order — what the walk home animates. */
  moves: readonly RecallMove[]
}>

/** A setup or a plan the kernel could not start from: named, so the caller can say why. */
export class PulseSetupError extends Error {}
