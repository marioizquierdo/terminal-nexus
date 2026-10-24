// Reading an army file and a campaign file: the shape each part must have, checked item by item before anything
// reads it, every problem said by path (`src/content/shape.ts`). A list's item with the wrong shape is left out of
// everything after, so one broken level, one broken power or one broken unit never hides the problems of the rest.
//
// What a part *means* — that what it names exists and is in sight, that a tier requires the one below, that a level's
// mission fits its map — is checked after, once every file has been read (`load.ts`).
//
// Pure: the JSON is an argument; nothing is read from disk.

import type { ContentEntry } from "../content/data.ts"
import { contentEntry, entryProblems } from "../content/data.ts"
import type { Say, Shape } from "../content/shape.ts"
import { anything, dictionary, fieldAt, isObject, itemAt, list, literal, positiveWholeNumber, record, shown, text, wholeNumber } from "../content/shape.ts"
import type { Barks } from "./barks.ts"
import { LEANS } from "./curve.ts"
import { effectShape } from "./effects.ts"
import type {
  ArmyManifest,
  BuildingActionCard,
  BuildingCard,
  BuildingSpawns,
  CampaignManifest,
  ChanceModifier,
  CommanderEntry,
  LevelEntry,
  PowerCard,
  PowerRequirements,
  Schedule,
  ScheduleEntry,
  ScheduleSlot,
  Unlocks,
} from "./types.ts"
import { ACTION_KINDS, RARITIES, ROLES } from "./types.ts"

// --- The shapes of an army's parts ---------------------------------------------------------------------------

/** What a building spawns: every number a whole number above zero, said by name when one is not. */
const buildingSpawns = record<BuildingSpawns>(
  { unit: text, perWave: positiveWholeNumber, waves: positiveWholeNumber, secondsBetween: positiveWholeNumber },
  {},
)
/** One of a building's actions: what it is, its row's words, and, as its kind needs, its price, its set of modes, what
 *  it requires, what it changes and the order it gives. What each kind must and may not have is the loader's to say. */
const buildingAction = record<BuildingActionCard>(
  { id: text, kind: literal(...ACTION_KINDS), label: text },
  {
    cost: wholeNumber,
    set: text,
    requires: record<NonNullable<BuildingActionCard["requires"]>>({}, { actions: list(text), buildings: list(text) }),
    effects: list(effectShape),
    order: text,
    notes: text,
  },
)
const buildingCard = record<BuildingCard>(
  { id: text, structure: text, cost: wholeNumber },
  { spawns: buildingSpawns, tier: positiveWholeNumber, rarity: literal(...RARITIES), role: literal(...ROLES), requires: list(text), actions: list(buildingAction), notes: text },
)
const rarity = literal(...RARITIES)
/** A power's chance raised for some rounds: from a round, to a later one or the end, so many times as likely. */
const chanceModifier = record<ChanceModifier>({ from: positiveWholeNumber, times: positiveWholeNumber }, { to: positiveWholeNumber })
const powerRequirements = record<PowerRequirements>({}, { powers: list(text), buildings: list(text), round: positiveWholeNumber })
const powerCard = record<PowerCard>(
  { id: text, name: text, description: text, effect: effectShape, rarity, role: literal(...ROLES) },
  {
    repeatable: literal(true, false),
    always: literal(true, false),
    doctrine: literal(true, false),
    tier: positiveWholeNumber,
    chance: list(chanceModifier),
    requires: powerRequirements,
    upgrades: text,
    from: text,
    notes: text,
  },
)
/** One card of a scheduled hand: a rarity's name, `{ "power": id }` for a power the level makes sure of, or
 *  `{ "from": a Nexus }` for one of the cards from another Nexus. */
const pinnedPower = record<Readonly<{ power: string }>>({ power: text }, {})
const otherNexus = record<Readonly<{ from: string }>>({ from: text }, {})
const scheduleSlot: Shape<ScheduleSlot> = {
  check(value: unknown, at: string, say: Say): value is ScheduleSlot {
    if (typeof value === "string") return rarity.check(value, at, say)
    if (isObject(value)) return "from" in value ? otherNexus.check(value, at, say) : pinnedPower.check(value, at, say)
    say(`${at} should be a rarity (${RARITIES.map((name) => `"${name}"`).join(", ")}), { "power": its id } or { "from": a Nexus }, not ${shown(value)}`)
    return false
  },
}
export const scheduleShape: Shape<Schedule> = list(record<ScheduleEntry>({ round: positiveWholeNumber, deal: list(scheduleSlot) }, {}))
/** A Commander's own fields. Her lines' moments and their fit are checked after, with the rest of what she names. */
const commanderEntry = record<CommanderEntry>(
  { id: text, name: text, unit: text, faction: text, lean: list(literal(...LEANS)) },
  {
    notes: text,
    barks: dictionary(list(text)) as Shape<Barks>,
    portrait: list(text),
    portraitFalls: list(list(text)),
    start: list(record<Readonly<{ unit: string; count: number }>>({ unit: text, count: positiveWholeNumber }, {})),
    run: record<NonNullable<CommanderEntry["run"]>>({ buildings: list(text), powers: list(text) }, {}),
    schedule: scheduleShape,
  },
)
/** An army file's own fields. Its lists are checked item by item, after. */
const armyFields = record<ArmyManifest>(
  { id: text, title: text, requires: list(text) },
  {
    notes: text,
    content: anything as Shape<readonly (string | ContentEntry)[]>,
    buildings: anything as Shape<readonly BuildingCard[]>,
    powers: anything as Shape<readonly PowerCard[]>,
    commander: anything as Shape<CommanderEntry>,
  },
)

// --- The shapes of a campaign's parts ------------------------------------------------------------------------

const unlocks = record<Unlocks>({}, { buildings: list(text), powers: list(text) })
/** A level's own fields. Its mission is checked after the level it extends is resolved (`levels.ts`), by the
 *  mission's own shape. */
export const levelShape = record<LevelEntry>(
  { id: text },
  { extends: text, map: text, credits: wholeNumber, unlocks, schedule: scheduleShape, mission: anything as Shape<LevelEntry["mission"] & object>, notes: text },
)
/** A campaign file's own fields. Its levels are checked one by one, after. */
const campaignFields = record<CampaignManifest>(
  { id: text, title: text, commander: text, requires: list(text), levels: anything as Shape<readonly LevelEntry[]> },
  { notes: text },
)

/** The items of a list that have `shape`, every problem with the others said. */
function keep<T>(value: unknown, at: string, shape: Shape<T>, say: Say): T[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    say(`${at} should be a list, not ${shown(value)}`)
    return []
  }
  return value.filter((item: unknown, index): item is T => shape.check(item, itemAt(at, item, index), say))
}

/** A file's id, when it has one to be known by. */
function idOf(file: unknown): string | null {
  return isObject(file) && typeof file["id"] === "string" && file["id"].trim() !== "" ? file["id"] : null
}

// --- An army file, read ----------------------------------------------------------------------------------------

/** An army file as far as its shape allows. */
export type ReadArmy = Readonly<{
  file: ArmyManifest
  id: string
  requires: readonly string[]
  /** Every content id it brings: what it names and what it defines. */
  content: readonly string[]
  /** What it defines as data. */
  entries: readonly ContentEntry[]
  buildings: readonly BuildingCard[]
  powers: readonly PowerCard[]
  commander: CommanderEntry | null
}>

/** An army file as far as its shape allows, or `null` when it has no id to be known by. */
export function readArmy(file: unknown, label: string, problems: string[]): ReadArmy | null {
  const id = idOf(file)
  const say: Say = (problem) => problems.push(`${id === null ? label : `army "${id}"`}: ${problem}`)
  armyFields.check(file, "", say)
  if (!isObject(file) || id === null) {
    if (isObject(file) && typeof file["id"] === "string") say(`id should be the army's name, not ${shown(file["id"])}`)
    return null
  }
  const requires = Array.isArray(file["requires"]) ? file["requires"].filter((entry): entry is string => typeof entry === "string") : []
  const content: string[] = []
  const entries: ContentEntry[] = []
  const listed = file["content"]
  if (listed !== undefined && !Array.isArray(listed)) say(`content should be a list, not ${shown(listed)}`)
  if (Array.isArray(listed)) {
    listed.forEach((item: unknown, index) => {
      if (typeof item === "string") {
        content.push(item)
        return
      }
      const at = itemAt("content", item, index)
      if (!contentEntry.check(item, at, say)) return
      const problems = entryProblems(item)
      for (const problem of problems) say(problem)
      if (problems.length > 0) return
      content.push(item.id)
      entries.push(item)
    })
  }
  const buildings = keep(file["buildings"], "buildings", buildingCard, say)
  const powers = keep(file["powers"], "powers", powerCard, say)
  const commander = file["commander"] === undefined ? null : commanderEntry.check(file["commander"], "commander", say) ? (file["commander"] as CommanderEntry) : null
  return { file: file as ArmyManifest, id, requires, content, entries, buildings, powers, commander }
}

// --- A campaign file, read -------------------------------------------------------------------------------------

/** A campaign file as far as its shape allows, its levels as written (not yet resolved against what they extend). */
export type ReadCampaign = Readonly<{
  file: CampaignManifest
  id: string
  requires: readonly string[]
  levels: readonly LevelEntry[]
}>

/** A campaign file as far as its shape allows, or `null` when it has no id to be known by. */
export function readCampaign(file: unknown, label: string, problems: string[]): ReadCampaign | null {
  const id = idOf(file)
  const say: Say = (problem) => problems.push(`${id === null ? label : `campaign "${id}"`}: ${problem}`)
  campaignFields.check(file, "", say)
  if (!isObject(file) || id === null) return null
  const requires = Array.isArray(file["requires"]) ? file["requires"].filter((entry): entry is string => typeof entry === "string") : []
  const levels = keep(file["levels"], "levels", levelShape, say)
  for (const level of levels) {
    if (level.extends !== undefined) continue
    for (const needed of ["map", "credits", "mission"] as const) {
      if (level[needed] === undefined) say(`${fieldAt(`levels[${level.id}]`, needed)} is needed: the level extends no other`)
    }
  }
  return { file: file as CampaignManifest, id, requires, levels }
}
