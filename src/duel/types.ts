// A duel: two Commander Armies, one a side, on one map, round after round — each round a Nexus Pulse and a Build Phase
// for each side, planned blind and revealed together, then a Battle Round between them (milestone 14, the headless
// duel; the owner, 2026-10-17: "put each commander nexus on one side of the map and play ... script vs script").
//
// Everything here is plain data, serializable as JSON, so a duel can be saved after any round, a plan can come from a
// script, a file or a language model, and the same setup and plans resolve the same duel on every machine.

import type { Absence } from "../match/commander.ts"
import type { MatchState, PlayerId } from "../state/types.ts"

/** A side of the duel, the state's own `PlayerId`: A starts in the west, B in the east. */
export type Side = PlayerId
export const SIDES: readonly Side[] = ["A", "B"]

/** What a duel is: the map, the gameplay seed, how many rounds at most, how long each Battle Round may last, and the
 *  Commander each side plays. */
export type DuelSetup = Readonly<{
  map: string
  seed: number
  rounds: number
  /** Ticks a Battle Round lasts at most (12 a second). */
  pulseTicks: number
  commanders: Readonly<Record<Side, string>>
}>

/** Where a building should go, as a plan names it: a place relative to the side's own base, or a tile. A named place
 *  is the legal spot nearest it (`zonePoint`, `round.ts`). */
export const ZONES = ["nexus", "forward", "back", "north", "south"] as const
export type Zone = (typeof ZONES)[number]

/** A building a plan asks for: its card id, and where. */
export type Placement = Readonly<{ building: string; at?: Zone; x?: number; y?: number }>

/** What a side's troops do this round: march on the enemy Nexus, or hold in front of their own. */
export const STANCES = ["attack", "hold"] as const
export type Stance = (typeof STANCES)[number]

/**
 * A side's plan for one round, the whole of what a player decides: which card of the Nexus Pulse's hand to keep (1 to
 * the hand's size; 0 or absent keeps none), what to build and where (in order, while credits last), and the stance.
 * `note` is the player's own words on why, kept in the record and shown to nobody else during the duel.
 */
export type SidePlan = Readonly<{ power?: number; build: readonly Placement[]; stance: Stance; note?: string }>

/** A side between rounds: its Commander, what it has to spend, the powers it kept (by id, in the order kept), and its
 *  Commander's absence when she is out. */
export type SideState = Readonly<{
  commander: string
  credits: number
  kept: readonly string[]
  absent: readonly Absence[]
}>

/** What one side did and suffered in a round. */
export type SideReport = Readonly<{
  commander: string
  /** Credits as the Build Phase opened, the ones spent, and the ones the battle earned (a bounty's). */
  credits: number
  spent: number
  earned: number
  /** The card it kept, by name, or `null`. */
  kept: string | null
  /** The hand it was dealt, by name. */
  hand: readonly string[]
  built: readonly string[]
  /** What it asked for and could not have, each with the reason. */
  refused: readonly string[]
  stance: Stance
  note?: string
  /** Its units on the Grid as the battle began, by name and count; those its buildings trained during it; its losses
   *  and kills, by name and count. */
  fielded: Readonly<Record<string, number>>
  trained: Readonly<Record<string, number>>
  lost: Readonly<Record<string, number>>
  killed: Readonly<Record<string, number>>
  /** Damage it dealt to units, to buildings, and to the enemy Nexus. */
  dealt: Readonly<{ units: number; buildings: number; nexus: number }>
  /** Its Nexus's health as the battle began and ended. */
  nexus: Readonly<{ before: number; after: number; most: number }>
  commanderFell: boolean
  /** Notable things its abilities did, counted by name ("Bounty": 4, "Loaded Dice": 2). */
  abilities: Readonly<Record<string, number>>
}>

/** One round of the duel, both sides. */
export type RoundReport = Readonly<{
  round: number
  sides: Readonly<Record<Side, SideReport>>
  /** The tick the battle ended on, and why: a Nexus fell, or time ran out. */
  ticks: number
  ended: "nexus" | "time"
}>

/** How a duel ended: who won, and how. */
export type DuelResult = Readonly<{
  winner: Side | null
  /** "nexus": one side's Nexus fell; "health": the rounds ran out and the healthier Nexus won; "damage": the Nexuses
   *  were as healthy, and the side that dealt more over the duel won; "draw": neither. */
  by: "nexus" | "health" | "damage" | "draw"
  round: number
}>

/** A duel between rounds: what it is, the round to play next, what the last round left on the Grid (after Recall), each
 *  side, every round so far, and how it ended once it has. */
export type DuelState = Readonly<{
  setup: DuelSetup
  round: number
  carried: MatchState | null
  sides: Readonly<Record<Side, SideState>>
  history: readonly RoundReport[]
  result: DuelResult | null
}>
