// The army loader: the game's armies, checked and resolved before anything reads them.
//
// An army is data a modder can write without TypeScript (`armies/<id>/army.json`), so everything is checked
// here, and every problem is reported at once, by name, the way a mission's own validation reports
// (`validateMission`): the shape of each manifest, every id unique, every `requires` known and none of them in a
// circle, every reference to something its army can see — its own, or what an army it requires (directly or
// through another) provides — every level's mission against its map, and every line a Commander says in battle
// against the moments she can speak at and the room it has on screen (`barks.ts`). Then each campaign's levels
// are resolved into what each one offers: everything the campaign has unlocked by then.
//
// Pure, like the rest of the rules around the kernel: no clock, no randomness, nothing read from disk. The
// manifests, the content registry and the map table are arguments (`src/armies/index.ts` passes the game's).

import type { ContentRegistry } from "../content/index.ts"
import type { MissionDefinition, TriggerAction } from "../mission/types.ts"
import { MissionError } from "../mission/types.ts"
import { actionName, validateMission } from "../mission/validate.ts"
import { missionShape } from "./mission-shape.ts"
import type { BarkMoment, Barks } from "./barks.ts"
import { BARK_MOMENTS, barkProblem } from "./barks.ts"
import type { Say, Shape } from "./shape.ts"
import { anything, dictionary, fieldAt, isObject, itemAt, list, positiveWholeNumber, record, shown, text, wholeNumber } from "./shape.ts"
import type {
  BuildingCard,
  BuildingSpawns,
  ArmyManifest,
  Armies,
  Campaign,
  CampaignEntry,
  Commander,
  CommanderEntry,
  Level,
  LevelEntry,
  LevelMap,
  PowerCard,
  PowerEffect,
  Unlocks,
} from "./types.ts"
import { ArmyError } from "./types.ts"

// --- The shapes of a manifest's parts ----------------------------------------------------------------------
//
// A list of an army's things is checked item by item, and an item with the wrong shape is left out of
// everything after: one broken level, or one broken mission, never hides the problems of the rest.

/** What a building spawns: every number a whole number above zero, said by name when one is not. */
const buildingSpawns = record<BuildingSpawns>(
  { unit: text, perWave: positiveWholeNumber, waves: positiveWholeNumber, secondsBetween: positiveWholeNumber },
  {},
)
const buildingCard = record<BuildingCard>({ id: text, structure: text, cost: wholeNumber }, { spawns: buildingSpawns, notes: text })
const powerCard = record<PowerCard>(
  { id: text, name: text, description: text, effect: record<PowerEffect>({ credits: wholeNumber }, {}) },
  { notes: text },
)
/** A Commander's own fields. Her lines' moments and their fit are checked after, with the rest of what she names. */
const commanderEntry = record<CommanderEntry>(
  { id: text, name: text, unit: text },
  { notes: text, barks: dictionary(list(text)) as Shape<Barks> },
)
const unlocks = record<Unlocks>({}, { buildings: list(text), powers: list(text) })
/** A level's own fields. Its mission is checked by its own shape, after. */
const levelEntry = record<LevelEntry>(
  { id: text, map: text, credits: wholeNumber, mission: anything as Shape<MissionDefinition> },
  { unlocks, notes: text },
)
/** A campaign's own fields. Its levels are checked one by one, after. */
const campaignEntry = record<CampaignEntry>(
  { id: text, title: text, commander: text, levels: anything as Shape<readonly LevelEntry[]> },
  { notes: text },
)
/** A manifest's own fields. Its sections are checked item by item, after. */
const manifestEntry = record<ArmyManifest>(
  { id: text, title: text, requires: list(text) },
  {
    notes: text,
    content: list(text),
    buildings: anything as Shape<readonly BuildingCard[]>,
    powers: anything as Shape<readonly PowerCard[]>,
    commanders: anything as Shape<readonly CommanderEntry[]>,
    campaigns: anything as Shape<readonly CampaignEntry[]>,
  },
)

/** The items of a section that have its shape, every problem with the others said. */
function keep<T>(value: unknown, at: string, shape: Shape<T>, say: Say): T[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    say(`${at} should be a list, not ${shown(value)}`)
    return []
  }
  return value.filter((item: unknown, index): item is T => shape.check(item, itemAt(at, item, index), say))
}

// --- A manifest, read ---------------------------------------------------------------------------------------

type ReadLevel = Readonly<{ entry: LevelEntry; mission: MissionDefinition | null }>
type ReadCampaign = Readonly<{ entry: CampaignEntry; levels: readonly ReadLevel[] }>
type ReadArmy = Readonly<{
  manifest: ArmyManifest
  id: string
  requires: readonly string[]
  content: readonly string[]
  buildings: readonly BuildingCard[]
  powers: readonly PowerCard[]
  commanders: readonly CommanderEntry[]
  campaigns: readonly ReadCampaign[]
}>

/** A manifest as far as its shape allows, or `null` when it has no id to be known by. */
function readManifest(manifest: unknown, label: string, problems: string[]): ReadArmy | null {
  const id = isObject(manifest) && typeof manifest["id"] === "string" && manifest["id"].trim() !== "" ? manifest["id"] : null
  const say: Say = (problem) => problems.push(`${id === null ? label : `army "${id}"`}: ${problem}`)
  manifestEntry.check(manifest, "", say)
  if (!isObject(manifest) || id === null) {
    if (isObject(manifest) && typeof manifest["id"] === "string") say(`id should be the army's name, not ${shown(manifest["id"])}`)
    return null
  }
  const requires = Array.isArray(manifest["requires"]) ? manifest["requires"].filter((entry): entry is string => typeof entry === "string") : []
  const content = Array.isArray(manifest["content"]) ? manifest["content"].filter((entry): entry is string => typeof entry === "string") : []
  const buildings = keep(manifest["buildings"], "buildings", buildingCard, say)
  const powers = keep(manifest["powers"], "powers", powerCard, say)
  const commanders = keep(manifest["commanders"], "commanders", commanderEntry, say)
  const campaigns = keep(manifest["campaigns"], "campaigns", campaignEntry, say).map((entry, index): ReadCampaign => {
    const at = itemAt("campaigns", entry, index)
    const levels = keep(entry.levels, fieldAt(at, "levels"), levelEntry, say).map((level, number): ReadLevel => {
      const mission = missionShape.check(level.mission, fieldAt(itemAt(fieldAt(at, "levels"), level, number), "mission"), say) ? level.mission : null
      return { entry: level, mission }
    })
    return { entry, levels }
  })
  return { manifest: manifest as ArmyManifest, id, requires, content, buildings, powers, commanders, campaigns }
}

// --- Requires: what each army sees, and the circles ----------------------------------------------------------

/** Each circle of `requires` once, as the army ids around it, the first id the least. */
function circles(armies: ReadonlyMap<string, ReadArmy>): string[][] {
  const found = new Map<string, string[]>()
  const state = new Map<string, "visiting" | "done">()
  const stack: string[] = []
  const visit = (id: string): void => {
    state.set(id, "visiting")
    stack.push(id)
    for (const next of armies.get(id)?.requires ?? []) {
      if (!armies.has(next)) continue
      if (state.get(next) === "visiting") {
        const loop = stack.slice(stack.indexOf(next))
        const start = loop.indexOf([...loop].sort()[0] as string)
        const turned = [...loop.slice(start), ...loop.slice(0, start)]
        found.set(turned.join(" "), turned)
      } else if (state.get(next) === undefined) visit(next)
    }
    stack.pop()
    state.set(id, "done")
  }
  for (const id of armies.keys()) if (state.get(id) === undefined) visit(id)
  return [...found.values()]
}

/** The armies one sees: itself and everything it requires, directly or through another. */
function seenBy(armies: ReadonlyMap<string, ReadArmy>, id: string): ReadonlySet<string> {
  const seen = new Set<string>()
  const queue = [id]
  while (queue.length > 0) {
    const next = queue.pop() as string
    if (seen.has(next) || !armies.has(next)) continue
    seen.add(next)
    queue.push(...(armies.get(next)?.requires ?? []))
  }
  return seen
}

/** The armies in an order where each comes after the armies it requires; otherwise in the order given. */
function loadOrder(armies: ReadonlyMap<string, ReadArmy>): ReadArmy[] {
  const ordered: ReadArmy[] = []
  const placed = new Set<string>()
  const place = (id: string, path: ReadonlySet<string>): void => {
    const army = armies.get(id)
    if (army === undefined || placed.has(id) || path.has(id)) return
    for (const required of army.requires) place(required, new Set([...path, id]))
    placed.add(id)
    ordered.push(army)
  }
  for (const id of armies.keys()) place(id, new Set())
  return ordered
}

const quoted = (ids: readonly string[]): string =>
  ids.length === 1 ? `"${ids[0]}"` : `${ids.slice(0, -1).map((id) => `"${id}"`).join(", ")} and "${ids[ids.length - 1]}"`

/** Every content id a mission names: what it spawns, plans, has speak and looks at. */
function contentOfMission(mission: MissionDefinition, registry: ContentRegistry): string[] {
  const ids: string[] = []
  for (const trigger of mission.triggers) {
    for (const action of trigger.do) {
      if ("spawn" in action) ids.push(...action.spawn.units.map((entry) => entry.unit))
      if ("commitPlan" in action) ids.push(...action.commitPlan.structures.map((structure) => structure.contentId))
      if ("say" in action) {
        if (registry.has(action.say.speaker)) ids.push(action.say.speaker)
        const focus = action.say.focus
        if (focus !== undefined && "unit" in focus) ids.push(focus.unit)
      }
    }
  }
  return [...new Set(ids)]
}

/**
 * What is wrong with a Commander's lines, each problem by name: a moment she cannot speak at, a moment with no
 * lines, and a line that says nothing or does not fit where it is shown (`barkProblem`). Her lines' shape — an
 * object of lists of text — is the manifest's shape check's.
 */
function barkProblems(entry: CommanderEntry): string[] {
  const problems: string[] = []
  const known = BARK_MOMENTS.map((moment) => `"${moment}"`).join(", ")
  for (const [moment, lines] of Object.entries(entry.barks ?? {})) {
    const whose = `the Commander "${entry.id}"`
    if (!(BARK_MOMENTS as readonly string[]).includes(moment)) {
      problems.push(`${whose} has lines for "${moment}", which is not a moment a Commander speaks at (${known})`)
      continue
    }
    if (lines === undefined || lines.length === 0) {
      problems.push(`${whose} has no lines for "${moment as BarkMoment}": leave the moment out for her to stay quiet there`)
      continue
    }
    lines.forEach((line, index) => {
      const problem = barkProblem(line)
      if (problem !== null) problems.push(`${whose}'s line ${index + 1} for "${moment}" ${problem}`)
    })
  }
  return problems
}

/** A copy of a JSON value, so freezing what the loader hands out never freezes what it was given. (Not
 *  `structuredClone`: that is the host's, and the game's code runs where only the language is.) */
function copied(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copied)
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, copied(inner)]))
  return value
}

/** `value`, frozen all the way down: what the loader hands out can never be changed by whoever reads it. */
function frozen<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const inner of Object.values(value)) frozen(inner)
    Object.freeze(value)
  }
  return value
}

// --- The loader ---------------------------------------------------------------------------------------------

/** What the loader checks an army's references against: the content the game has, and the maps a level can name. */
export type LoadWorld = Readonly<{
  registry: ContentRegistry
  maps: Readonly<Record<string, LevelMap>>
}>

/**
 * The armies, checked and resolved: each campaign's levels in order, each with what it offers. Throws
 * `ArmyError` listing every problem found in any of them.
 */
export function loadArmies(manifests: readonly unknown[], world: LoadWorld): Armies {
  const { registry, maps } = world
  const problems: string[] = []

  // The shapes, every manifest's, and what can be read of each.
  const read = new Map<string, ReadArmy>()
  manifests.forEach((given, index) => {
    const army = readManifest(copied(given), `army ${index + 1}`, problems)
    if (army === null) return
    if (read.has(army.id)) problems.push(`two armies are called "${army.id}"; the second is left out`)
    else read.set(army.id, army)
  })

  // Requires: each one an army, and none of them in a circle.
  for (const army of read.values()) {
    for (const required of army.requires) {
      if (required === army.id) problems.push(`army "${army.id}" requires itself`)
      else if (!read.has(required)) problems.push(`army "${army.id}" requires "${required}", which is not an army`)
    }
  }
  for (const loop of circles(read).filter((ids) => ids.length > 1)) {
    problems.push(`armies ${quoted(loop)} require each other in a circle: ${[...loop, loop[0]].join(" -> ")}`)
  }
  const sees = new Map([...read.keys()].map((id) => [id, seenBy(read, id)] as const))

  // Every id once: content an army brings, cards, Commanders, campaigns and levels (a level's id is what a
  // route names, so it is unique across every campaign).
  type Owned<V = object> = Readonly<{ army: string }> & V
  const contentBy = new Map<string, Owned>()
  const buildingsBy = new Map<string, Owned<{ card: BuildingCard }>>()
  const powersBy = new Map<string, Owned<{ card: PowerCard }>>()
  const commandersBy = new Map<string, Owned<{ entry: CommanderEntry }>>()
  const campaignsBy = new Map<string, Owned>()
  const levelsBy = new Map<string, Owned>()
  const once = <V extends Owned>(table: Map<string, V>, id: string, value: V, what: string): void => {
    const first = table.get(id)?.army
    if (first === undefined) table.set(id, value)
    else problems.push(first === value.army ? `army "${first}" has the ${what} "${id}" twice` : `the ${what} "${id}" is in both "${first}" and "${value.army}"`)
  }
  for (const army of read.values()) {
    const owned = { army: army.id }
    for (const id of army.content) once(contentBy, id, owned, "content")
    for (const card of army.buildings) once(buildingsBy, card.id, { ...owned, card }, "building")
    for (const card of army.powers) once(powersBy, card.id, { ...owned, card }, "Nexus power")
    for (const entry of army.commanders) once(commandersBy, entry.id, { ...owned, entry }, "Commander")
    for (const campaign of army.campaigns) {
      once(campaignsBy, campaign.entry.id, owned, "campaign")
      for (const level of campaign.levels) once(levelsBy, level.entry.id, owned, "level")
    }
  }

  /** Why `id` is not content `army` can use, or `null` when it is. */
  const unseenContent = (army: string, id: string): string | null => {
    if (!registry.has(id)) return `"${id}", which is not content the game has`
    const owner = contentBy.get(id)?.army
    if (owner === undefined) return `"${id}", which no army brings`
    return sees.get(army)?.has(owner) === true ? null : `"${id}", which "${owner}" brings and "${army}" does not require`
  }
  /** Why the card `id` of `kind` is not one `army` can offer, or `null` when it is. */
  const unseenCard = (army: string, kind: "building" | "Nexus power", id: string): string | null => {
    const table: ReadonlyMap<string, Readonly<{ army: string }>> = kind === "building" ? buildingsBy : powersBy
    const owner = table.get(id)?.army
    if (owner === undefined) {
      const other = kind === "building" ? powersBy.has(id) && "a Nexus power" : buildingsBy.has(id) && "a building"
      return `the ${kind} "${id}", which no army has${other === false ? "" : ` (it is ${other})`}`
    }
    return sees.get(army)?.has(owner) === true ? null : `the ${kind} "${id}", which "${owner}" has and "${army}" does not require`
  }

  // Content: what each army brings exists, and what it puts on the Grid in turn is content the army sees.
  for (const army of read.values()) {
    const say = (problem: string): void => {
      problems.push(`army "${army.id}": ${problem}`)
    }
    for (const id of army.content) {
      if (!registry.has(id)) {
        say(`content names "${id}", which is not content the game has`)
        continue
      }
      const definition = registry.get(id)
      for (const made of [definition.spawn?.contentId, definition.splitOnDeath?.contentId, definition.production?.output]) {
        if (made === undefined) continue
        const unseen = unseenContent(army.id, made)
        if (unseen !== null) say(`"${id}" puts on the Grid ${unseen}`)
      }
    }

    // Cards: a building is a structure the army sees, and what it spawns a unit the army sees; a Nexus power
    // says what it is.
    for (const card of army.buildings) {
      const unseen = unseenContent(army.id, card.structure)
      if (unseen !== null) say(`the building "${card.id}" names ${unseen}`)
      else if (registry.get(card.structure).layer !== "obstacles") say(`the building "${card.id}" names "${card.structure}", which is not a building`)
      if (card.spawns === undefined) continue
      const unit = card.spawns.unit
      const unseenUnit = unseenContent(army.id, unit)
      if (unseenUnit !== null) say(`the building "${card.id}" spawns ${unseenUnit}`)
      else if (registry.get(unit).layer === "obstacles") say(`the building "${card.id}" spawns "${unit}", which is a building, not a unit`)
    }
    for (const card of army.powers) {
      if (card.name.trim() === "" || card.description.trim() === "") say(`the Nexus power "${card.id}" needs a name and a description`)
    }

    // Commanders: her unit is a Commander the army sees, and her lines are for moments she can speak at, each
    // saying something that fits where it is shown.
    for (const entry of army.commanders) {
      if (entry.name.trim() === "") say(`the Commander "${entry.id}" has no name`)
      const unseen = unseenContent(army.id, entry.unit)
      if (unseen !== null) say(`the Commander "${entry.id}" is ${unseen}`)
      else if (registry.get(entry.unit).commander !== true) say(`the Commander "${entry.id}" is "${entry.unit}", which is not a Commander`)
      for (const problem of barkProblems(entry)) say(problem)
    }

    // Campaigns: a Commander the army sees, levels, and each level's map, unlocks and mission.
    for (const campaign of army.campaigns) {
      const { entry } = campaign
      const owner = commandersBy.get(entry.commander)
      if (owner === undefined) say(`the campaign "${entry.id}" is led by "${entry.commander}", which is not a Commander any army has`)
      else if (sees.get(army.id)?.has(owner.army) !== true) {
        say(`the campaign "${entry.id}" is led by "${entry.commander}", whom "${owner.army}" has and "${army.id}" does not require`)
      }
      if (entry.levels.length === 0) say(`the campaign "${entry.id}" has no levels`)
      const commanderUnit = owner?.entry.unit
      const unlocked = { buildings: new Map<string, string>(), powers: new Map<string, string>() }

      for (const { entry: level, mission } of campaign.levels) {
        const where = `level "${level.id}"`
        const map = Object.hasOwn(maps, level.map) ? maps[level.map] : undefined
        if (map === undefined) {
          say(`${where} is played on the map "${level.map}", which is not one the game has (${Object.keys(maps).map((name) => `"${name}"`).join(", ")})`)
        }

        for (const [kind, ids, seen] of [
          ["building", level.unlocks?.buildings ?? [], unlocked.buildings],
          ["Nexus power", level.unlocks?.powers ?? [], unlocked.powers],
        ] as const) {
          const own = new Set<string>()
          for (const id of ids) {
            if (own.has(id)) say(`${where} unlocks the ${kind} "${id}" twice`)
            else if (seen.has(id)) say(`${where} unlocks the ${kind} "${id}", which level "${seen.get(id)}" already unlocked`)
            own.add(id)
            const unseen = unseenCard(army.id, kind, id)
            if (unseen !== null) say(`${where} unlocks ${unseen}`)
          }
          for (const id of own) if (!seen.has(id)) seen.set(id, level.id)
        }

        // A building spawns one way in a battle: two cards the level offers for one structure may not say two
        // different things about what it spawns. Said at the level that unlocks the second, once.
        const spawnsOf = new Map<string, Readonly<{ card: string; spawns: string }>>()
        for (const [id, unlockedIn] of unlocked.buildings) {
          const card = buildingsBy.get(id)?.card
          if (card === undefined) continue
          const spawns = JSON.stringify(card.spawns ?? null)
          const first = spawnsOf.get(card.structure)
          if (first === undefined) spawnsOf.set(card.structure, { card: card.id, spawns })
          else if (first.spawns !== spawns && unlockedIn === level.id) {
            say(`${where} offers "${card.structure}" as the buildings "${first.card}" and "${card.id}", which spawn differently; a building spawns one way`)
          }
        }

        if (mission === null) continue
        const inMission = `${where}, mission "${mission.id}"`
        if (map !== undefined) {
          try {
            validateMission(mission, map.grid(), registry)
          } catch (error) {
            if (!(error instanceof MissionError)) throw error
            for (const problem of error.problems) say(`${inMission}: ${problem}`)
          }
          for (const id of new Set(map.standing.map((structure) => structure.contentId))) {
            const unseen = unseenContent(army.id, id)
            if (unseen !== null) say(`${where} is played on the map "${level.map}", which has standing on it ${unseen}`)
          }
        }
        for (const id of contentOfMission(mission, registry)) {
          const unseen = registry.has(id) ? unseenContent(army.id, id) : null
          if (unseen !== null) say(`${inMission} uses ${unseen}`)
        }
        // The Commander a level brings for the player is her campaign's.
        mission.triggers.forEach((trigger) =>
          trigger.do.forEach((action: TriggerAction, index) => {
            if (!("spawn" in action) || action.spawn.side !== "A" || commanderUnit === undefined) return
            for (const unit of action.spawn.units) {
              if (!registry.has(unit.unit) || registry.get(unit.unit).commander !== true || unit.unit === commanderUnit) continue
              say(
                `${inMission}: trigger "${trigger.id}", action ${index + 1} (${actionName(action)}) brings the Commander "${unit.unit}" for the player, whose campaign's Commander is "${commanderUnit}"`,
              )
            }
          }),
        )
      }
    }
  }

  if (problems.length > 0) throw new ArmyError(problems)

  // Resolved: each campaign's levels, each offering what the campaign has unlocked by then.
  const ordered = loadOrder(read)
  const commanders = new Map<string, Commander>()
  for (const army of ordered) {
    for (const entry of army.commanders) {
      commanders.set(entry.id, { id: entry.id, army: army.id, name: entry.name, unit: entry.unit, barks: entry.barks ?? {} })
    }
  }
  const campaigns: Campaign[] = []
  for (const army of ordered) {
    for (const campaign of army.campaigns) {
      const levels: Level[] = []
      let buildings: readonly BuildingCard[] = []
      let powers: readonly PowerCard[] = []
      campaign.levels.forEach(({ entry, mission }, index) => {
        const newBuildings = (entry.unlocks?.buildings ?? []).map((id) => (buildingsBy.get(id) as Readonly<{ card: BuildingCard }>).card)
        const newPowers = (entry.unlocks?.powers ?? []).map((id) => (powersBy.get(id) as Readonly<{ card: PowerCard }>).card)
        buildings = [...buildings, ...newBuildings]
        powers = [...powers, ...newPowers]
        levels.push({
          id: entry.id,
          campaign: campaign.entry.id,
          army: army.id,
          number: index + 1,
          map: entry.map,
          mission: mission as MissionDefinition,
          offer: { credits: entry.credits, buildings, powers },
          unlocked: { buildings: newBuildings, powers: newPowers },
        })
      })
      campaigns.push({
        id: campaign.entry.id,
        army: army.id,
        title: campaign.entry.title,
        commander: commanders.get(campaign.entry.commander) as Commander,
        levels,
      })
    }
  }
  return frozen({
    armies: ordered.map((army) => army.manifest),
    commanders: [...commanders.values()],
    campaigns,
    levels: campaigns.flatMap((campaign) => campaign.levels),
  })
}
