// The bundle loader: the game's content bundles, checked and resolved before anything reads them.
//
// A bundle is data a modder can write without TypeScript (`bundles/<id>/bundle.json`), so everything is checked
// here, and every problem is reported at once, by name, the way a mission's own validation reports
// (`validateMission`): the shape of each manifest, every id unique, every `requires` known and none of them in a
// circle, every reference to something its bundle can see — its own, or what a bundle it requires (directly or
// through another) provides — and every level's mission against its map. Then each campaign's levels are
// resolved into what each one offers: everything the campaign has unlocked by then.
//
// Pure, like the rest of the rules around the kernel: no clock, no randomness, nothing read from disk. The
// manifests, the content registry and the map table are arguments (`src/bundles/index.ts` passes the game's).

import type { ContentRegistry } from "../content/index.ts"
import type { MissionDefinition, TriggerAction } from "../mission/types.ts"
import { MissionError } from "../mission/types.ts"
import { actionName, validateMission } from "../mission/validate.ts"
import { missionShape } from "./mission-shape.ts"
import type { Say, Shape } from "./shape.ts"
import { anything, fieldAt, isObject, itemAt, list, record, shown, text, wholeNumber } from "./shape.ts"
import type {
  BuildingCard,
  BundleManifest,
  Bundles,
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
import { BundleError } from "./types.ts"

// --- The shapes of a manifest's parts ----------------------------------------------------------------------
//
// A list of a bundle's things is checked item by item, and an item with the wrong shape is left out of
// everything after: one broken level, or one broken mission, never hides the problems of the rest.

const buildingCard = record<BuildingCard>({ id: text, structure: text, cost: wholeNumber }, { notes: text })
const powerCard = record<PowerCard>(
  { id: text, name: text, description: text, effect: record<PowerEffect>({ credits: wholeNumber }, {}) },
  { notes: text },
)
const commanderEntry = record<CommanderEntry>({ id: text, name: text, unit: text }, { notes: text })
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
const manifestEntry = record<BundleManifest>(
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
type ReadBundle = Readonly<{
  manifest: BundleManifest
  id: string
  requires: readonly string[]
  content: readonly string[]
  buildings: readonly BuildingCard[]
  powers: readonly PowerCard[]
  commanders: readonly CommanderEntry[]
  campaigns: readonly ReadCampaign[]
}>

/** A manifest as far as its shape allows, or `null` when it has no id to be known by. */
function readManifest(manifest: unknown, label: string, problems: string[]): ReadBundle | null {
  const id = isObject(manifest) && typeof manifest["id"] === "string" && manifest["id"].trim() !== "" ? manifest["id"] : null
  const say: Say = (problem) => problems.push(`${id === null ? label : `bundle "${id}"`}: ${problem}`)
  manifestEntry.check(manifest, "", say)
  if (!isObject(manifest) || id === null) {
    if (isObject(manifest) && typeof manifest["id"] === "string") say(`id should be the bundle's name, not ${shown(manifest["id"])}`)
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
  return { manifest: manifest as BundleManifest, id, requires, content, buildings, powers, commanders, campaigns }
}

// --- Requires: what each bundle sees, and the circles ----------------------------------------------------------

/** Each circle of `requires` once, as the bundle ids around it, the first id the least. */
function circles(bundles: ReadonlyMap<string, ReadBundle>): string[][] {
  const found = new Map<string, string[]>()
  const state = new Map<string, "visiting" | "done">()
  const stack: string[] = []
  const visit = (id: string): void => {
    state.set(id, "visiting")
    stack.push(id)
    for (const next of bundles.get(id)?.requires ?? []) {
      if (!bundles.has(next)) continue
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
  for (const id of bundles.keys()) if (state.get(id) === undefined) visit(id)
  return [...found.values()]
}

/** The bundles one sees: itself and everything it requires, directly or through another. */
function seenBy(bundles: ReadonlyMap<string, ReadBundle>, id: string): ReadonlySet<string> {
  const seen = new Set<string>()
  const queue = [id]
  while (queue.length > 0) {
    const next = queue.pop() as string
    if (seen.has(next) || !bundles.has(next)) continue
    seen.add(next)
    queue.push(...(bundles.get(next)?.requires ?? []))
  }
  return seen
}

/** The bundles in an order where each comes after the bundles it requires; otherwise in the order given. */
function loadOrder(bundles: ReadonlyMap<string, ReadBundle>): ReadBundle[] {
  const ordered: ReadBundle[] = []
  const placed = new Set<string>()
  const place = (id: string, path: ReadonlySet<string>): void => {
    const bundle = bundles.get(id)
    if (bundle === undefined || placed.has(id) || path.has(id)) return
    for (const required of bundle.requires) place(required, new Set([...path, id]))
    placed.add(id)
    ordered.push(bundle)
  }
  for (const id of bundles.keys()) place(id, new Set())
  return ordered
}

const quoted = (ids: readonly string[]): string =>
  ids.length === 1 ? `"${ids[0]}"` : `${ids.slice(0, -1).map((id) => `"${id}"`).join(", ")} and "${ids[ids.length - 1]}"`

/** Every content id a mission names: what it spawns, plans, trains, has speak and looks at. */
function contentOfMission(mission: MissionDefinition, registry: ContentRegistry): string[] {
  const ids: string[] = []
  for (const entry of mission.trains ?? []) ids.push(entry.structure, entry.unit)
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

/** What the loader checks a bundle's references against: the content the game has, and the maps a level can name. */
export type LoadWorld = Readonly<{
  registry: ContentRegistry
  maps: Readonly<Record<string, LevelMap>>
}>

/**
 * The bundles, checked and resolved: each campaign's levels in order, each with what it offers. Throws
 * `BundleError` listing every problem found in any of them.
 */
export function loadBundles(manifests: readonly unknown[], world: LoadWorld): Bundles {
  const { registry, maps } = world
  const problems: string[] = []

  // The shapes, every manifest's, and what can be read of each.
  const read = new Map<string, ReadBundle>()
  manifests.forEach((given, index) => {
    const bundle = readManifest(copied(given), `bundle ${index + 1}`, problems)
    if (bundle === null) return
    if (read.has(bundle.id)) problems.push(`two bundles are called "${bundle.id}"; the second is left out`)
    else read.set(bundle.id, bundle)
  })

  // Requires: each one a bundle, and none of them in a circle.
  for (const bundle of read.values()) {
    for (const required of bundle.requires) {
      if (required === bundle.id) problems.push(`bundle "${bundle.id}" requires itself`)
      else if (!read.has(required)) problems.push(`bundle "${bundle.id}" requires "${required}", which is not a bundle`)
    }
  }
  for (const loop of circles(read).filter((ids) => ids.length > 1)) {
    problems.push(`bundles ${quoted(loop)} require each other in a circle: ${[...loop, loop[0]].join(" -> ")}`)
  }
  const sees = new Map([...read.keys()].map((id) => [id, seenBy(read, id)] as const))

  // Every id once: content a bundle brings, cards, Commanders, campaigns and levels (a level's id is what a
  // route names, so it is unique across every campaign).
  type Owned<V = object> = Readonly<{ bundle: string }> & V
  const contentBy = new Map<string, Owned>()
  const buildingsBy = new Map<string, Owned<{ card: BuildingCard }>>()
  const powersBy = new Map<string, Owned<{ card: PowerCard }>>()
  const commandersBy = new Map<string, Owned<{ entry: CommanderEntry }>>()
  const campaignsBy = new Map<string, Owned>()
  const levelsBy = new Map<string, Owned>()
  const once = <V extends Owned>(table: Map<string, V>, id: string, value: V, what: string): void => {
    const first = table.get(id)?.bundle
    if (first === undefined) table.set(id, value)
    else problems.push(first === value.bundle ? `bundle "${first}" has the ${what} "${id}" twice` : `the ${what} "${id}" is in both "${first}" and "${value.bundle}"`)
  }
  for (const bundle of read.values()) {
    const owned = { bundle: bundle.id }
    for (const id of bundle.content) once(contentBy, id, owned, "content")
    for (const card of bundle.buildings) once(buildingsBy, card.id, { ...owned, card }, "building")
    for (const card of bundle.powers) once(powersBy, card.id, { ...owned, card }, "Nexus power")
    for (const entry of bundle.commanders) once(commandersBy, entry.id, { ...owned, entry }, "Commander")
    for (const campaign of bundle.campaigns) {
      once(campaignsBy, campaign.entry.id, owned, "campaign")
      for (const level of campaign.levels) once(levelsBy, level.entry.id, owned, "level")
    }
  }

  /** Why `id` is not content `bundle` can use, or `null` when it is. */
  const unseenContent = (bundle: string, id: string): string | null => {
    if (!registry.has(id)) return `"${id}", which is not content the game has`
    const owner = contentBy.get(id)?.bundle
    if (owner === undefined) return `"${id}", which no bundle brings`
    return sees.get(bundle)?.has(owner) === true ? null : `"${id}", which "${owner}" brings and "${bundle}" does not require`
  }
  /** Why the card `id` of `kind` is not one `bundle` can offer, or `null` when it is. */
  const unseenCard = (bundle: string, kind: "building" | "Nexus power", id: string): string | null => {
    const table: ReadonlyMap<string, Readonly<{ bundle: string }>> = kind === "building" ? buildingsBy : powersBy
    const owner = table.get(id)?.bundle
    if (owner === undefined) {
      const other = kind === "building" ? powersBy.has(id) && "a Nexus power" : buildingsBy.has(id) && "a building"
      return `the ${kind} "${id}", which no bundle has${other === false ? "" : ` (it is ${other})`}`
    }
    return sees.get(bundle)?.has(owner) === true ? null : `the ${kind} "${id}", which "${owner}" has and "${bundle}" does not require`
  }

  // Content: what each bundle brings exists, and what it puts on the Grid in turn is content the bundle sees.
  for (const bundle of read.values()) {
    const say = (problem: string): void => {
      problems.push(`bundle "${bundle.id}": ${problem}`)
    }
    for (const id of bundle.content) {
      if (!registry.has(id)) {
        say(`content names "${id}", which is not content the game has`)
        continue
      }
      const definition = registry.get(id)
      for (const made of [definition.spawn?.contentId, definition.splitOnDeath?.contentId, definition.production?.output]) {
        if (made === undefined) continue
        const unseen = unseenContent(bundle.id, made)
        if (unseen !== null) say(`"${id}" puts on the Grid ${unseen}`)
      }
    }

    // Cards: a building is a structure the bundle sees; a Nexus power says what it is.
    for (const card of bundle.buildings) {
      const unseen = unseenContent(bundle.id, card.structure)
      if (unseen !== null) say(`the building "${card.id}" names ${unseen}`)
      else if (registry.get(card.structure).layer !== "obstacles") say(`the building "${card.id}" names "${card.structure}", which is not a building`)
    }
    for (const card of bundle.powers) {
      if (card.name.trim() === "" || card.description.trim() === "") say(`the Nexus power "${card.id}" needs a name and a description`)
    }

    // Commanders: her unit is a Commander the bundle sees.
    for (const entry of bundle.commanders) {
      if (entry.name.trim() === "") say(`the Commander "${entry.id}" has no name`)
      const unseen = unseenContent(bundle.id, entry.unit)
      if (unseen !== null) say(`the Commander "${entry.id}" is ${unseen}`)
      else if (registry.get(entry.unit).commander !== true) say(`the Commander "${entry.id}" is "${entry.unit}", which is not a Commander`)
    }

    // Campaigns: a Commander the bundle sees, levels, and each level's map, unlocks and mission.
    for (const campaign of bundle.campaigns) {
      const { entry } = campaign
      const owner = commandersBy.get(entry.commander)
      if (owner === undefined) say(`the campaign "${entry.id}" is led by "${entry.commander}", which is not a Commander any bundle has`)
      else if (sees.get(bundle.id)?.has(owner.bundle) !== true) {
        say(`the campaign "${entry.id}" is led by "${entry.commander}", whom "${owner.bundle}" has and "${bundle.id}" does not require`)
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
            const unseen = unseenCard(bundle.id, kind, id)
            if (unseen !== null) say(`${where} unlocks ${unseen}`)
          }
          for (const id of own) if (!seen.has(id)) seen.set(id, level.id)
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
            const unseen = unseenContent(bundle.id, id)
            if (unseen !== null) say(`${where} is played on the map "${level.map}", which has standing on it ${unseen}`)
          }
        }
        for (const id of contentOfMission(mission, registry)) {
          const unseen = registry.has(id) ? unseenContent(bundle.id, id) : null
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

  if (problems.length > 0) throw new BundleError(problems)

  // Resolved: each campaign's levels, each offering what the campaign has unlocked by then.
  const ordered = loadOrder(read)
  const commanders = new Map<string, Commander>()
  for (const bundle of ordered) {
    for (const entry of bundle.commanders) commanders.set(entry.id, { id: entry.id, bundle: bundle.id, name: entry.name, unit: entry.unit })
  }
  const campaigns: Campaign[] = []
  for (const bundle of ordered) {
    for (const campaign of bundle.campaigns) {
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
          bundle: bundle.id,
          number: index + 1,
          map: entry.map,
          mission: mission as MissionDefinition,
          offer: { credits: entry.credits, buildings, powers },
          unlocked: { buildings: newBuildings, powers: newPowers },
        })
      })
      campaigns.push({
        id: campaign.entry.id,
        bundle: bundle.id,
        title: campaign.entry.title,
        commander: commanders.get(campaign.entry.commander) as Commander,
        levels,
      })
    }
  }
  return frozen({
    bundles: ordered.map((bundle) => bundle.manifest),
    commanders: [...commanders.values()],
    campaigns,
    levels: campaigns.flatMap((campaign) => campaign.levels),
  })
}
