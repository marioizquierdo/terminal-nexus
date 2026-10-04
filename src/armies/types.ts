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

// --- What an army's manifest holds ---------------------------------------------------------------------

/** A building a Commander may be offered: a structure, and what it costs out of a Build Phase's credits. */
export type BuildingCard = Readonly<{
  id: string
  /** The structure's content id: a building (`src/content`). */
  structure: string
  cost: number
  notes?: string
}>

/**
 * What a Nexus power does when it is picked. A plain number of credits for now — the placeholder draft the
 * Build Phase has always dealt — until the Nexus draft step gives powers their real effect kinds
 * (commander-armies.md, what a Nexus power does), each one more key here.
 */
export type PowerEffect = Readonly<{ credits: number }>

/** A Nexus power: a name and one plain line of description — all a player reads of it — and what it does. */
export type PowerCard = Readonly<{
  id: string
  name: string
  description: string
  effect: PowerEffect
  notes?: string
}>

/** A Commander: her name, and her unit — the persistent `@`, a content definition flagged `commander`. */
export type CommanderEntry = Readonly<{ id: string; name: string; unit: string; notes?: string }>

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

/** A Commander, and the army that defines her. */
export type Commander = Readonly<{ id: string; army: string; name: string; unit: string }>

/** What a level offers: every card its campaign has unlocked by then, in the order first unlocked (so a hotkey
 *  never moves when a later level adds a card), and its credits. */
export type Offer = Readonly<{
  credits: number
  buildings: readonly BuildingCard[]
  powers: readonly PowerCard[]
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
