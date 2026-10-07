// Armies, as the game reads them once the loader has checked them (`load.ts`): the shapes an army's JSON
// manifest holds, and what the loader resolves them into — each campaign's levels, with what each offers.
//
// The owner, 2026-10-04: organize content "as a tree where the campaign progression is at the top, depending on
// levels, that depend on buildings and units (that may be on the same bundle or another dependent bundle like
// the common)" — and, the round after, "call the folder armies/vasse and armies/all". So an army is a folder of
// data (`armies/<id>/army.json`) that names the armies it builds on, and sees what they provide and nothing
// else: `all` holds the buildings and Nexus powers any Commander may use; `vasse` requires it, and holds her
// Commander and her campaign, its levels in order, what each unlocks and its mission. A level offers what its
// campaign has unlocked by then.
//
// The Campaign is one producer of these shapes; the run mode will be another, with its own progression over
// the same cards and units, in its own section of an army. Nothing here knows which mode reads it, and the
// kernel never reads an army.

import type { GridTerrain } from "../grid/types.ts"
import type { MissionDefinition } from "../mission/types.ts"
import type { Barks } from "./barks.ts"

// --- What an army's manifest holds ---------------------------------------------------------------------

/**
 * What a building spawns in a battle, in **waves** — the units it sets down at once, side by side, and the word
 * means nothing else in the game: the unit, how many a wave, how many waves a round, and the seconds from one
 * wave to the next. Every number is a positive whole number. When the first wave comes is the same for every
 * building (a tuned setting, `firstWave`), so it is not here. A Nexus power that gives a building a second or
 * third wave raises `waves`, and nothing else changes shape.
 */
export type BuildingSpawns = Readonly<{
  /** The unit's content id: a unit, never a building. */
  unit: string
  /** How many units one wave sets down. */
  perWave: number
  /** How many waves it spawns in a round. */
  waves: number
  /** Seconds from one wave to the next; unused while there is one wave. */
  secondsBetween: number
}>

/** A building a Commander may be offered: a structure, what it costs out of a Build Phase's credits, and — for
 *  one that makes units — what it spawns in a battle. */
export type BuildingCard = Readonly<{
  id: string
  /** The structure's content id: a building (`src/content`). */
  structure: string
  cost: number
  /** What it spawns in each battle of a campaign that offers it. Absent: it spawns nothing. */
  spawns?: BuildingSpawns
  notes?: string
}>

/**
 * What a Nexus power does once it is kept: one key, which names its kind — the effect kinds of
 * commander-armies.md ("what a Nexus power does"), named for the code and never shown to a player — and what it
 * does. Four of the six kinds are built, the four PERIMETER's powers need; `credits` is not one of them but War
 * Chest's, the owner's tool for testing placement, kept beside the real draft.
 *
 * - `spawnUnits`: so many of a unit join the player's troops at the Grid Nexus as the round's Battle Round
 *   starts, and stay with the army after (Reserve Callup).
 * - `modifyCommander`: the Commander's aura reaches so many times as far, for the rest of the mission
 *   (Standing Order).
 * - `modifyContent`: a building that spawns sends so many more waves a round, for the rest of the mission
 *   (Drill Schedule). `building` is a building card's id.
 * - `addBuilding`: a building joins the build menu, for the rest of the mission (Aid Station Permit). A power
 *   adds; only the tech tree unlocks. `building` is a building card's id; no level unlocks it.
 * - `credits`: so many credits to spend this Build Phase (War Chest).
 */
export type PowerEffect =
  | Readonly<{ spawnUnits: Readonly<{ unit: string; count: number }> }>
  | Readonly<{ modifyCommander: Readonly<{ auraReachTimes: number }> }>
  | Readonly<{ modifyContent: Readonly<{ building: string; addWaves: number }> }>
  | Readonly<{ addBuilding: Readonly<{ building: string }> }>
  | Readonly<{ credits: number }>

/**
 * How rare a Nexus power is, least to most: what each card of a hand is dealt from, round by round, by the
 * Nexus Pulse's schedule (`Schedule`). A common does one readable thing, an uncommon combines with something or
 * leans into a plan, a rare changes the plan; a legendary is dealt only by a slot that asks for one.
 */
export const RARITIES = ["common", "uncommon", "rare", "legendary"] as const
export type Rarity = (typeof RARITIES)[number]

/** What a Nexus power is for. A hand deals powers of different roles while the rarity it deals from has them. */
export const ROLES = ["troops", "production", "offense", "defense", "support", "economy", "commander", "information", "movement"] as const
export type Role = (typeof ROLES)[number]

/** A power's chance raised for some rounds: `times` as likely as an ordinary power of its rarity, from round
 *  `from` to round `to` (absent: to the end). "Twice as likely in rounds 1 to 3" is `{ from: 1, to: 3, times: 2 }`. */
export type ChanceModifier = Readonly<{ from: number; to?: number; times: number }>

/** What must be true before a power can be dealt; every part given must hold. */
export type PowerRequirements = Readonly<{
  /** Nexus powers kept this mission, by id. */
  powers?: readonly string[]
  /** Buildings standing for the player when the round opens, by building card id (Drill Schedule: a Barracks). */
  buildings?: readonly string[]
  /** The first round it may be dealt in, counted from 1. */
  round?: number
}>

/** A Nexus power: a name and one plain line of description — all a player reads of it — and what it does, with
 *  what the Nexus Pulse deals it by: its rarity and role, and the modifiers below. */
export type PowerCard = Readonly<{
  id: string
  name: string
  description: string
  effect: PowerEffect
  rarity: Rarity
  role: Role
  /** May be dealt again once kept (Reserve Callup: two more troopers each time). Absent: kept once a mission. */
  repeatable?: boolean
  /** Offered beside every hand rather than dealt into one (War Chest, the owner's testing tool). */
  always?: boolean
  /** Its chance raised for some rounds. Absent: as likely as any power of its rarity. */
  chance?: readonly ChanceModifier[]
  /** What must be true before it can be dealt. Absent: nothing. */
  requires?: PowerRequirements
  /** The power it upgrades, by id: it is dealt only once that one is kept, and once kept itself it is listed
   *  in that one's place. What both do adds up (Drill Schedule II's third wave on Drill Schedule's second). */
  upgrades?: string
  notes?: string
}>

/** One card of a scheduled hand: dealt from a rarity, or a named power a level makes sure of (`{ power }`). */
export type ScheduleSlot = Rarity | Readonly<{ power: string }>

/** From round `round` on, until the next entry, each hand deals one card for each of `deal`'s slots. */
export type ScheduleEntry = Readonly<{ round: number; deal: readonly ScheduleSlot[] }>

/**
 * The Nexus Pulse's schedule: what each round's hand deals, its first entry from round 1 and each later entry from
 * a later round. The game has a default (`DEFAULT_SCHEDULE`, `deal.ts`); a campaign level may give its own, to make
 * sure of a power in the round it teaches.
 */
export type Schedule = readonly ScheduleEntry[]

/** A Commander: her name, and her unit — the persistent `@`, a content definition flagged `commander`. */
export type CommanderEntry = Readonly<{
  id: string
  name: string
  unit: string
  /** What she says during a Battle Round, by moment (`barks.ts`). Absent: she says nothing. */
  barks?: Barks
  notes?: string
}>

/** The cards a level adds to what its campaign offers, by id: from its own army or one it requires. */
export type Unlocks = Readonly<{ buildings?: readonly string[]; powers?: readonly string[] }>

/** A level of a campaign, as its army writes it. */
export type LevelEntry = Readonly<{
  /** What a route names (`campaign?level=vasse-test-1`): unique across every army. */
  id: string
  /** The map it is played on, by its name in the map table (`src/build/maps.ts`). */
  map: string
  /** The credits a Build Phase of it starts with. */
  credits: number
  /** What it adds to what its campaign offers. Absent: nothing new. */
  unlocks?: Unlocks
  /** What its Nexus Pulse deals, round by round, in place of the game's default. Absent: the default. */
  schedule?: Schedule
  mission: MissionDefinition
  notes?: string
}>

/** A campaign: its Commander, and its levels in the order they are played. */
export type CampaignEntry = Readonly<{
  id: string
  title: string
  /** Its Commander, by id: defined by its army or by one it requires. */
  commander: string
  levels: readonly LevelEntry[]
  notes?: string
}>

/** An army's manifest, `armies/<id>/army.json`. Every section is optional. */
export type ArmyManifest = Readonly<{
  id: string
  title: string
  /** The armies it builds on. It sees what they provide, and what theirs provide; nothing else. */
  requires: readonly string[]
  notes?: string
  /**
   * The content ids it brings to the game: the units and structures its cards, its levels and their maps put
   * on the Grid. The definitions themselves (stats, footprints) are still TypeScript, in `src/content`.
   */
  content?: readonly string[]
  buildings?: readonly BuildingCard[]
  powers?: readonly PowerCard[]
  commanders?: readonly CommanderEntry[]
  campaigns?: readonly CampaignEntry[]
}>

// --- What the loader needs besides the armies -----------------------------------------------------------

/** A map a level can name: its Grid, and the structures already standing on it. */
export type LevelMap = Readonly<{
  grid: () => GridTerrain
  standing: readonly Readonly<{ contentId: string }>[]
}>

// --- What the loader hands the game ----------------------------------------------------------------------

/** A Commander, and the army that defines her: with her lines by moment, none when her army wrote none. */
export type Commander = Readonly<{ id: string; army: string; name: string; unit: string; barks: Barks }>

/** What a level offers: every card its campaign has unlocked by then, in the order first unlocked (so a hotkey
 *  never moves when a later level adds a card), its credits, the buildings its Nexus powers can add, and its own
 *  schedule for the Nexus Pulse when it has one. */
export type Offer = Readonly<{
  credits: number
  buildings: readonly BuildingCard[]
  powers: readonly PowerCard[]
  /** The building cards its powers name (`addBuilding`), which no level unlocks: what such a power adds to the
   *  build menu once kept. */
  addable: readonly BuildingCard[]
  /** What its Nexus Pulse deals, round by round. Absent: the game's default (`DEFAULT_SCHEDULE`). */
  schedule?: Schedule
}>

/** A level, resolved: where it stands in its campaign, what it offers, and what is new in it. */
export type Level = Readonly<{
  id: string
  /** Its campaign's id. */
  campaign: string
  /** The army that defines it. */
  army: string
  /** Its place in its campaign, counted from 1. */
  number: number
  /** Its map's name in the map table. */
  map: string
  mission: MissionDefinition
  offer: Offer
  /** What it unlocks that no earlier level did: what the screen between levels shows as new. */
  unlocked: Readonly<{ buildings: readonly BuildingCard[]; powers: readonly PowerCard[] }>
}>

/** A campaign, resolved: its Commander and its levels, in order. */
export type Campaign = Readonly<{
  id: string
  army: string
  title: string
  commander: Commander
  levels: readonly Level[]
}>

/** Every army the loader was given, checked and resolved. */
export type Armies = Readonly<{
  /** Each army after the armies it requires. */
  armies: readonly ArmyManifest[]
  commanders: readonly Commander[]
  campaigns: readonly Campaign[]
  /** Every campaign's levels: campaign by campaign, each campaign's in order. */
  levels: readonly Level[]
}>

/** Armies that fail to load, with every problem found — not just the first. */
export class ArmyError extends Error {
  readonly problems: readonly string[]
  constructor(problems: readonly string[]) {
    super(`the armies are invalid:\n- ${problems.join("\n- ")}`)
    this.problems = problems
  }
}
