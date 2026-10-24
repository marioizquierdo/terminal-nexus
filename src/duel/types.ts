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

/**
 * What a side brings to a duel when it is not its Commander's whole army (a run's army, runs.md): the building cards on
 * its build menu and the Nexus powers in the pool its Nexus Pulse deals from, by id, and the Doctrines kept from the
 * first round. Everything else the army could field is left out, as if the army never had it.
 */
export type Roster = Readonly<{
  buildings: readonly string[]
  powers: readonly string[]
  doctrines: readonly string[]
}>

/** What a duel is: the map, the gameplay seed, how many rounds at most, how long each Battle Round may last, and the
 *  Commander each side plays; and, for a side that is not its Commander's whole army, its roster. */
export type DuelSetup = Readonly<{
  map: string
  seed: number
  rounds: number
  /** Ticks a Battle Round lasts at most (12 a second). */
  pulseTicks: number
  commanders: Readonly<Record<Side, string>>
  rosters?: Readonly<Partial<Record<Side, Roster>>>
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
 * How tight a side builds the buildings that train units, and so how tight its army fights: units come out on the
 * roofs of the buildings that made them (pulse.md), so where those buildings stand is where each wave starts.
 *
 * - **block**: each one touching another along a side, the block grown round where the plan asks for the first of
 *   them: the waves come off the roofs together and meet the enemy as one.
 * - **apart**: each one set at least `APART_GAP` from every other (columns, a row counting two), as near where the
 *   plan asks for the first as that allows: the waves come out apart, and an area attack catches fewer at once.
 * - **zones**: no formation, each building where its own placement says (a named place or a tile): how every plan
 *   placed before formations, and what a plan that names none still does.
 *
 * A formation places only the buildings that train units; a Turret or a Supply Depot goes where its placement says.
 */
export const FORMATIONS = ["block", "apart", "zones"] as const
export type Formation = (typeof FORMATIONS)[number]

/** How far apart an `apart` formation sets its buildings that train units, from the nearest tile of one to the
 *  nearest of the other, a row counting two columns: about the formations measure's square set apart. */
export const APART_GAP = 10

/**
 * A side's plan for one round, the whole of what a player decides: which card of the Nexus Pulse's hand to keep (1 to
 * the hand's size; 0 or absent keeps none), what to build and where (in order, while credits last), how tight to set
 * the buildings that train units (`formation`; absent, each goes where its placement says), and the stance.
 * `note` is the player's own words on why, kept in the record and shown to nobody else during the duel.
 */
export type SidePlan = Readonly<{
  power?: number
  build: readonly Placement[]
  formation?: Formation
  stance: Stance
  /** The side's buildings standing as the round opens, by anchor, that hold their waves this round (Hold production,
   *  the Build Phase's building action): they send none. Absent: none held, as every script plays. */
  hold?: readonly Readonly<{ x: number; y: number }>[]
  /**
   * What it does with its buildings this round, in order, each a building of its own by anchor — standing as the round
   * opens, or placed by this plan at that tile — and one of its card's actions by id (`BuildingActionCard`): an
   * upgrade bought (`production-line`), a mode switched to (`units-first`), an order given (`hold`). Taken after its
   * buildings are placed, from the credits they leave, by the Build Phase's rules; what cannot be is refused and said.
   * Absent: none, as every script but the `-upgrade` ones plays.
   */
  actions?: readonly BuildingOrder[]
  note?: string
}>

/** One of a plan's building actions: the building by its anchor, and the action by its id. */
export type BuildingOrder = Readonly<{ x: number; y: number; action: string }>

/** A side between rounds: its Commander, what it has to spend, the powers it kept (by id, in the order kept), and its
 *  Commander's absence when she is out. */
export type SideState = Readonly<{
  commander: string
  /** Its roster, when it is not its Commander's whole army. */
  roster?: Roster
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
  /** The building actions it took, each with its building and where (`production-line on barracks at 9,5`). Absent:
   *  none. */
  actions?: readonly string[]
  /** What it asked for and could not have, each with the reason. */
  refused: readonly string[]
  stance: Stance
  /** The formation its plan named, when it named one. */
  formation?: Formation
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
