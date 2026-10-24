// Armies and campaigns, as the game reads them once the loader has checked them (`load.ts`): the shapes their JSON
// files hold, and what the loader resolves them into — each campaign's levels, with what each offers.
//
// The owner, 2026-10-04: organize content "as a tree where the campaign progression is at the top, depending on
// levels, that depend on buildings and units (that may be on the same bundle or another dependent bundle like
// the common)" — and, once a second Commander stood beside the first, to "solidify the commander army files" and keep
// what a campaign plays apart from the armies (2026-10-17). So there are two kinds of file:
//
// - **an army** (`armies/<id>/army.json`): what a side can field. It names the armies it builds on (`requires`) and
//   sees what they provide and nothing else. `all` holds what any army may use; a faction army (`citizen`, `ravel`)
//   holds a Nexus's units, buildings and powers; a Commander army (`vasse`, `averno`) holds one Commander — her unit,
//   her voice, her own cards — on top of a faction. An army may define units and structures as data (`content`).
// - **a campaign** (`campaigns/<id>/campaign.json`): a Commander's levels in order, what each unlocks and its
//   mission. It names the armies it plays with (`requires`: the Commander's, and the raid's), and a level may extend
//   another level, its own campaign's or another's, so a second Commander replays a first one's rounds unchanged.
//
// The Campaign is one mode reading armies; the duel (`src/duel/`) is another, over the same cards and units. Nothing
// here knows which mode reads it, and the kernel never reads an army. docs/system-design/army-authoring.md is the guide.

import type { ContentEntry } from "../content/data.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { GridTerrain } from "../grid/types.ts"
import type { MissionDefinition } from "../mission/types.ts"
import type { Barks } from "./barks.ts"
import type { Lean } from "./curve.ts"

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
  /** What it spawns in each battle, in any mode that offers it. Absent: it spawns nothing. */
  spawns?: BuildingSpawns
  /** Its tier in the army's tech tree, 1 to `MAX_TIER` (`curve.ts`). Absent: 1, open from the start. A run draft
   *  deals it by the same tier (runs.md): the tier gates *when* it may be offered. */
  tier?: number
  /** How rare it is, for a run's draft to weigh (runs.md). Absent: never offered by a draft; the army's own at the start. */
  rarity?: Rarity
  /** What it is for, for a run's draft to bring variety by. Absent with `rarity`. */
  role?: Role
  /** The buildings, by card id, that must stand for the player as a Build Phase opens before this one can be built:
   *  the tech tree. Each is of a lower tier, and a building above tier 1 requires one of the tier below it. Absent:
   *  none. The same in every mode; a mode decides only which cards it offers. */
  requires?: readonly string[]
  /** What a building of this card lets its player do in a Build Phase, selected in Explore Map, in the order its card
   *  lists them (`BuildingActionCard`). Absent: nothing. */
  actions?: readonly BuildingActionCard[]
  notes?: string
}>

/**
 * The three kinds of a building's action (commander-armies.md, what changes between rounds): an **upgrade**, bought
 * with credits and kept by that one building for the rest of the match; a **mode**, one of the building's named states,
 * switched between rounds and kept until switched again; an **order**, for the coming Battle Round only.
 */
export const ACTION_KINDS = ["upgrade", "mode", "order"] as const
export type ActionKind = (typeof ACTION_KINDS)[number]

/**
 * One thing a building lets its player do in a Build Phase, declared with the building on its card. What an upgrade
 * or a mode changes is written in the Nexus powers' own words (`PowerEffect`), naming this building — the same effect a
 * power would apply to every building of its kind — and applies to this one building alone (`fittedId`, `src/content`).
 */
export type BuildingActionCard = Readonly<{
  /** Its name in data, in a building's content id and in a duel plan: lower case, digits and dashes, unique on its
   *  card. */
  id: string
  kind: ActionKind
  /** What its row says on the card, in the game's own plain words: "Production line". */
  label: string
  /** The credits taking it spends, at once. Absent: none. An upgrade always says. */
  cost?: number
  /** The set of the building's modes this one belongs to: one of a set is in force at a time, and the first of a set
   *  the card lists is the building as it is written. Absent: `"mode"`. A mode's only. */
  set?: string
  /** What must be true before it can be taken: the building's own actions taken first (an upgrade it improves on), and
   *  buildings standing for the player as the Build Phase opens, by card id. Absent: nothing. */
  requires?: Readonly<{ actions?: readonly string[]; buildings?: readonly string[] }>
  /** What it changes of this building, as a Nexus power's effects name it: an upgrade's and a mode's. */
  effects?: readonly PowerEffect[]
  /** The order it gives, by the game's name for it (`ORDERS`, `src/armies/actions.ts`): an order's only. */
  order?: string
  notes?: string
}>

/**
 * What a Nexus power does once it is kept: one key, which names its kind — named for the code and never shown to a
 * player (commander-armies.md, "what a Nexus power does") — and what it does. `credits` is War Chest's, the owner's
 * tool for testing placement, kept beside the real draft.
 *
 * - `spawnUnits`: so many of a unit join the player's troops at the Grid Nexus as the round's Battle Round
 *   starts, and stay with the army after (Reserve Callup).
 * - `addWaves`: a building that spawns sends so many more waves a round, for the rest of the mission
 *   (Drill Schedule). `building` is a building card's id.
 * - `addBuilding`: a building joins the build menu, for the rest of the mission (Aid Station Permit). A power
 *   adds; only the tech tree unlocks. `building` is a building card's id; no level unlocks it.
 * - `setDetonation`: a kind of unit bursts when it dies, for the rest of the mission (Unfiled Ordnance, Averno's).
 *   `unit` is a unit's content id.
 * - `modifyAbility`: a unit's or a building's ability of a kind gains so much of its numbers, for the rest of the
 *   mission (Standing Order: By the Book reaches 4 further; Lucky Scrap: Dob's Bounty pays more). `content` is its
 *   content id; `add` a number to add to each named number.
 * - `addPerWave`: a building that spawns sends so many more units a wave. `building` is a building card's id.
 * - `modifyAttack`: a unit's or a building's attack gains so much of its `damage`, `range` or `cooldownTicks`.
 *   `content` is its content id.
 * - `setTargetPreference`: a unit or a building prefers, among the enemies it could target, those on these layers
 *   (`ContentDef.targetPreference`); none, to go back to the nearest of any. `content` is its content id.
 * - `credits`: so many credits to spend this Build Phase (War Chest).
 *
 * The kinds that change a building's own content (`addWaves`, `addPerWave`, `modifyAttack`, `modifyAbility`,
 * `setTargetPreference`) are also what a building's upgrade or mode changes, naming that building: as a power they
 * change every building of the kind, as a building's action that one building alone (`BuildingActionCard`).
 *
 * Each kind is one entry of `EFFECTS` (`effects.ts`), which says what it holds, what the loader refuses and what it
 * changes: no reader branches on a kind.
 */
export type PowerEffect =
  | Readonly<{ spawnUnits: Readonly<{ unit: string; count: number }> }>
  | Readonly<{ addWaves: Readonly<{ building: string; waves: number }> }>
  | Readonly<{ addBuilding: Readonly<{ building: string }> }>
  | Readonly<{ setDetonation: Readonly<{ unit: string; detonation: Readonly<{ radius: number; damage: number }> }> }>
  | Readonly<{ modifyAbility: Readonly<{ content: string; kind: string; add: Readonly<Record<string, number>> }> }>
  | Readonly<{ addPerWave: Readonly<{ building: string; perWave: number }> }>
  | Readonly<{ modifyAttack: Readonly<{ content: string; add: Readonly<Record<string, number>> }> }>
  | Readonly<{ setTargetPreference: Readonly<{ content: string; prefer: readonly string[] }> }>
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
  /**
   * A Doctrine (runs.md): a standing order, never dealt by the Nexus Pulse. A run's draft offers it, and once taken it is
   * kept from the first round of every battle of the run, so its effect is on for the whole of each. Absent: a Nexus power
   * the Pulse deals, as every power was.
   */
  doctrine?: boolean
  /** The earliest tier of a run it may be offered in, 1 to `MAX_TIER` (the draft's tier schedule, runs.md). Absent: 1. */
  tier?: number
  /** The Nexus it comes from when not the army's own (`"ravel"`: a card from the Ravel Nexus in a Citizen
   *  Commander's hand, Averno's leak). Dealt only by a schedule slot that asks for that Nexus, `{ "from": "ravel" }`,
   *  and marked as such where it is shown. Absent: the army's own Nexus. */
  from?: string
  /** Its chance raised for some rounds. Absent: as likely as any power of its rarity. */
  chance?: readonly ChanceModifier[]
  /** What must be true before it can be dealt. Absent: nothing. */
  requires?: PowerRequirements
  /** The power it upgrades, by id: it is dealt only once that one is kept, and once kept itself it is listed
   *  in that one's place. What both do adds up (Drill Schedule II's third wave on Drill Schedule's second). */
  upgrades?: string
  notes?: string
}>

/** One card of a scheduled hand: dealt from a rarity, a named power a level makes sure of (`{ power }`), or one of
 *  the cards from another Nexus (`{ from }`: an army bending the schedule, Averno's leak). */
export type ScheduleSlot = Rarity | Readonly<{ power: string }> | Readonly<{ from: string }>

/** From round `round` on, until the next entry, each hand deals one card for each of `deal`'s slots. */
export type ScheduleEntry = Readonly<{ round: number; deal: readonly ScheduleSlot[] }>

/**
 * The Nexus Pulse's schedule: what each round's hand deals, its first entry from round 1 and each later entry from
 * a later round. The game has a default (`DEFAULT_SCHEDULE`, `deal.ts`); a campaign level may give its own, to make
 * sure of a power in the round it teaches.
 */
export type Schedule = readonly ScheduleEntry[]

/** A Commander army's Commander: her name, and her unit — a content definition flagged `commander`, usually defined
 *  in the same file. How a card names her (she, he, they) is her unit's card's `pronouns`. */
export type CommanderEntry = Readonly<{
  /** What a campaign's `commander` and a duel's `--a` name her by. By convention her army's id too (`vasse` leads
   *  `armies/vasse` and `campaigns/vasse`): a campaign's `requires` names armies, its `commander` names her. */
  id: string
  name: string
  unit: string
  /** Her faction, by army id (`citizen`, `ravel`): the Nexus she builds from, and the army whose buildings and Nexus
   *  powers are hers. Anything she sees from another faction (Averno's Ravel cards) is foreign: never built, and dealt
   *  only by a schedule slot that asks for that Nexus (`{ "from": "ravel" }`). */
  faction: string
  /** What her army's build leans on, one or two of `LEANS` (`curve.ts`): where it takes its power from on the
   *  expected power curve. Every army names one. */
  lean: readonly Lean[]
  /** Her starting package: the units that walk out with her where a mode does not script its own (a duel's first
   *  round). A campaign's level brings its own. Absent: she walks out alone. */
  start?: readonly Readonly<{ unit: string; count: number }>[]
  /** How her army bends the Nexus Pulse's schedule, in every mode: what each round's hand deals (Averno's: a card
   *  from the Ravel Nexus some rounds). A level that gives its own schedule replaces it. Absent: the game's default. */
  schedule?: Schedule
  /** What a run starts her army with (runs.md): the building cards on its build menu and the Nexus powers in its pool.
   *  Everything else her army can field is waiting in the run's draft. Absent: the whole of her army, as in a duel. */
  run?: RunStart
  /** What she says during a Battle Round, by moment (`barks.ts`). Absent: she says nothing. */
  barks?: Barks
  /** Her face on her card in Explore Map and in the vignette of her fall: three rows of the same width, at most
   *  `PORTRAIT_WIDTH` glyphs of plain ASCII (`src/view/commander-moments.ts`). Absent: none is drawn. */
  portrait?: readonly string[]
  /** The frames her face goes through as she falls, after the portrait, each shaped like it: the vignette that opens
   *  beside where she fell (`src/view/commander-moments.ts`). Absent: the portrait alone. */
  portraitFalls?: readonly (readonly string[])[]
  notes?: string
}>

/** What a run starts an army with: building cards (by id) and Nexus powers (by id). */
export type RunStart = Readonly<{ buildings: readonly string[]; powers: readonly string[] }>

/** How many rows a Commander's portrait has, and how many glyphs wide it may be. */
export const PORTRAIT_ROWS = 3
export const PORTRAIT_WIDTH = 5

/** The cards a level adds to what its campaign offers, by id: from its own army or one it requires. */
export type Unlocks = Readonly<{ buildings?: readonly string[]; powers?: readonly string[] }>

/** The trigger a mission reads when its campaign's Commander walks onto the Grid: a spawn of `"@commander"` sets down
 *  whichever Commander leads the campaign that plays the level, so a level is written once for every Commander. */
export const COMMANDER_PLACEHOLDER = "@commander"

/**
 * What a level that extends another changes of its mission: any of its fields, whole; and its triggers, either as a
 * whole new list or as a change to the extended one's — the triggers to drop by id, and the triggers to put in (in
 * place of the one with the same id, or after the rest).
 */
export type MissionPatch = Readonly<
  Partial<Omit<MissionDefinition, "triggers">> & {
    triggers?: MissionDefinition["triggers"] | Readonly<{ remove?: readonly string[]; replace?: MissionDefinition["triggers"] }>
  }
>

/** A level of a campaign, as its campaign file writes it. */
export type LevelEntry = Readonly<{
  /** What a route names (`campaign?level=vasse-test-1`): unique across every campaign. */
  id: string
  /** Another level, by id, this one is a copy of, with what it gives in place of that one's: its own campaign's or
   *  another's. `unlocks` and `schedule` given here replace the extended level's; `mission` changes it (`MissionPatch`).
   *  Absent: it says everything itself. */
  extends?: string
  /** The map it is played on, by its name in the map table (`src/build/maps.ts`). */
  map?: string
  /** The credits a Build Phase of it starts with. */
  credits?: number
  /** What it adds to what its campaign offers. Absent: nothing new. */
  unlocks?: Unlocks
  /** What its Nexus Pulse deals, round by round, in place of its Commander's schedule and the game's default. Absent:
   *  her schedule, or the default. */
  schedule?: Schedule
  /** Its mission; for a level that extends another, what it changes of that one's. */
  mission?: MissionDefinition | MissionPatch
  notes?: string
}>

/** A campaign's file, `campaigns/<id>/campaign.json`: its Commander, the armies it plays with, and its levels in the
 *  order they are played. */
export type CampaignManifest = Readonly<{
  id: string
  title: string
  /** Its Commander, by id: the Commander of one of the armies it requires. */
  commander: string
  /** The armies its levels use: the Commander's (which brings her faction's), and the raid's. It sees what they
   *  provide, and what theirs provide; nothing else. */
  requires: readonly string[]
  levels: readonly LevelEntry[]
  notes?: string
}>

/** An army's file, `armies/<id>/army.json`. Every section but its name and what it requires is optional. */
export type ArmyManifest = Readonly<{
  id: string
  title: string
  /** The armies it builds on. It sees what they provide, and what theirs provide; nothing else. */
  requires: readonly string[]
  notes?: string
  /**
   * The units and structures it brings: each one either defined here, as data (`ContentEntry`, `src/content/data.ts`:
   * its numbers, its card and its glyph), or named by id when the engine defines it in TypeScript (the bench rosters,
   * `src/content`).
   */
  content?: readonly (string | ContentEntry)[]
  buildings?: readonly BuildingCard[]
  powers?: readonly PowerCard[]
  /** Its Commander, when it is a Commander army: one a file. Absent: a faction or a shared army. */
  commander?: CommanderEntry
}>

// --- What the loader needs besides the armies -----------------------------------------------------------

/** A map a level can name: its Grid, and the structures already standing on it. */
export type LevelMap = Readonly<{
  grid: () => GridTerrain
  standing: readonly Readonly<{ contentId: string }>[]
}>

// --- What the loader hands the game ----------------------------------------------------------------------

/** A Commander, and the army that defines her: with her lines by moment, none when her army wrote none. */
export type Commander = Readonly<{
  id: string
  army: string
  name: string
  unit: string
  faction: string
  lean: readonly Lean[]
  start: readonly Readonly<{ unit: string; count: number }>[]
  /** What a run starts her army with (`CommanderEntry.run`). Absent: the whole of it. */
  run?: RunStart
  /** Her army's own schedule for the Nexus Pulse; absent, the game's default. */
  schedule?: Schedule
  barks: Barks
  portrait: readonly string[]
  portraitFalls: readonly (readonly string[])[]
}>

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
  /** Its Commander's army. */
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
  /** Its Commander's army. */
  army: string
  title: string
  commander: Commander
  levels: readonly Level[]
}>

/** What an army can field: every building card, Nexus power and content id in its sight, in the order the armies list
 *  them (the ones it requires first). A Commander army's is her faction's and her own: what she sees of another faction
 *  is not among its buildings, and its powers are marked `from` that faction, dealt only by a slot that asks for it. */
export type Arsenal = Readonly<{ buildings: readonly BuildingCard[]; powers: readonly PowerCard[]; content: readonly string[] }>

/** Every army and campaign the loader was given, checked and resolved. */
export type Armies = Readonly<{
  /** Each army after the armies it requires. */
  armies: readonly ArmyManifest[]
  commanders: readonly Commander[]
  campaigns: readonly Campaign[]
  /** Every campaign's levels: campaign by campaign, each campaign's in order. */
  levels: readonly Level[]
  /** What each army can field, by its id: every building card and Nexus power of the armies in its sight, its own
   *  and what it requires — what a mode that is not a campaign offers a side (`src/duel/`). */
  arsenals: Readonly<Record<string, Arsenal>>
  /** The content the files were checked against, with everything the armies define as data. */
  registry: ContentRegistry
}>

/** Armies or campaigns that fail to load, with every problem found — not just the first. */
export class ArmyError extends Error {
  readonly problems: readonly string[]
  constructor(problems: readonly string[]) {
    super(`the armies are invalid:\n- ${problems.join("\n- ")}`)
    this.problems = problems
  }
}
