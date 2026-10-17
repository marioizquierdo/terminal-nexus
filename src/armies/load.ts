// The army loader: the game's armies and campaigns, checked and resolved before anything reads them.
//
// An army or a campaign is data a modder can write without TypeScript, so everything is checked here, and every
// problem is reported at once, by name, the way a mission's own validation reports (`validateMission`). In order:
//
// 1. **read** each file's shape (`read.ts`): a broken item is left out of what follows, never hiding the rest;
// 2. **see**: each army sees itself and what it requires, directly or through another, and a campaign sees what it
//    requires; a circle of `requires` is refused;
// 3. **index** every id once: content, building cards, Nexus powers, Commanders, levels;
// 4. **check** that everything a file names is in its sight: a building's structure and units, a power's effect
//    (`effects.ts`), a Commander's unit and voice, a level's map, unlocks, schedule and mission (made whole first,
//    `levels.ts`);
// 5. **resolve** each campaign's levels into what each offers: everything the campaign has unlocked by then.
//
// Pure, like the rest of the rules around the kernel: no clock, no randomness, nothing read from disk. The files,
// the content registry and the map table are arguments (`src/armies/index.ts` passes the game's).

import type { ContentRegistry } from "../content/index.ts"
import { createRegistry } from "../content/index.ts"
import { definitionOf } from "../content/data.ts"
import type { MissionDefinition, TriggerAction } from "../mission/types.ts"
import { MissionError } from "../mission/types.ts"
import { actionName, validateMission } from "../mission/validate.ts"
import { missionShape } from "./mission-shape.ts"
import type { BarkMoment } from "./barks.ts"
import { BARK_MOMENTS, barkProblem } from "./barks.ts"
import { EARLIEST_ROUND, LEANS, MAX_LEANS, MAX_TIER } from "./curve.ts"
import type { EffectSight } from "./effects.ts"
import { addsOf, effectParts } from "./effects.ts"
import { wholeLevels, withCommander } from "./levels.ts"
import type { ReadArmy, ReadCampaign } from "./read.ts"
import { readArmy, readCampaign } from "./read.ts"
import type { Armies, BuildingCard, Campaign, Commander, CommanderEntry, Level, LevelEntry, LevelMap, PowerCard, Schedule } from "./types.ts"
import { ArmyError, COMMANDER_PLACEHOLDER, PORTRAIT_ROWS, PORTRAIT_WIDTH } from "./types.ts"

// --- Requires: what each file sees, and the circles ----------------------------------------------------------

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

/** The armies `requires` brings into sight: each, and everything each requires, directly or through another. */
function sightOf(armies: ReadonlyMap<string, ReadArmy>, requires: readonly string[]): ReadonlySet<string> {
  const seen = new Set<string>()
  const queue = [...requires]
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

/** Every content id a mission names: what it spawns, plans, has speak and looks at — but the campaign's Commander,
 *  which it names as "@commander". */
function contentOfMission(mission: MissionDefinition, registry: ContentRegistry): string[] {
  const ids: string[] = []
  for (const trigger of mission.triggers) {
    for (const action of trigger.do) {
      if ("spawn" in action) ids.push(...action.spawn.units.map((entry) => entry.unit).filter((unit) => unit !== COMMANDER_PLACEHOLDER))
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

// --- A Commander's own problems ------------------------------------------------------------------------------

/** What is wrong with a Commander's lines: a moment she cannot speak at, a moment with no lines, and a line that says
 *  nothing or does not fit where it is shown (`barkProblem`). */
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

/** What is wrong with what a Commander's army leans on: none named, more than `MAX_LEANS`, or one named twice. */
function leanProblems(entry: CommanderEntry): string[] {
  const whose = `the Commander "${entry.id}"`
  if (entry.lean.length === 0) return [`${whose} leans on nothing: name one or two of ${LEANS.map((name) => `"${name}"`).join(", ")}`]
  const problems: string[] = []
  if (entry.lean.length > MAX_LEANS) problems.push(`${whose} leans on ${entry.lean.length} things: ${MAX_LEANS} at most, or it leans on nothing`)
  if (new Set(entry.lean).size !== entry.lean.length) problems.push(`${whose} names a lean twice`)
  return problems
}

/** What is wrong with a Commander's portrait: not three rows, rows of different widths, a row wider than the panel
 *  gives it, or a glyph outside plain ASCII (the monochrome floor draws every one). */
function portraitProblems(entry: CommanderEntry): string[] {
  if (entry.portrait === undefined) return (entry.portraitFalls ?? []).length > 0 ? [`the Commander "${entry.id}" has frames for her fall and no portrait for them to follow`] : []
  const whose = `the Commander "${entry.id}"'s portrait`
  const rows = entry.portrait
  if (rows.length !== PORTRAIT_ROWS) return [`${whose} has ${rows.length} rows; it takes ${PORTRAIT_ROWS}`]
  const problems: string[] = []
  const width = rows[0]?.length ?? 0
  rows.forEach((row, index) => {
    if (row.length !== width) problems.push(`${whose} row ${index + 1} is ${row.length} glyphs wide and row 1 is ${width}: every row is as wide as the first`)
    if (row.length === 0 || row.length > PORTRAIT_WIDTH) problems.push(`${whose} row ${index + 1} is ${row.length} glyphs wide; a row is 1 to ${PORTRAIT_WIDTH}`)
    if (!/^[\x20-\x7e]*$/.test(row)) problems.push(`${whose} row ${index + 1} has a glyph outside plain ASCII`)
  })
  const frames = entry.portraitFalls ?? []
  frames.forEach((frame, index) => {
    const same = frame.length === rows.length && frame.every((row, at) => row.length === rows[at]?.length)
    if (!same) problems.push(`the Commander "${entry.id}"'s fall frame ${index + 1} is not shaped like her portrait: ${rows.length} rows, each as wide as hers`)
    if (frame.some((row) => !/^[\x20-\x7e]*$/.test(row))) problems.push(`the Commander "${entry.id}"'s fall frame ${index + 1} has a glyph outside plain ASCII`)
  })
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

/** What the loader checks the files' references against: the content the game has, and the maps a level can name.
 *  The content an army defines as data is added to `registry` where it is not there already. */
export type LoadWorld = Readonly<{
  registry: ContentRegistry
  maps: Readonly<Record<string, LevelMap>>
}>

/** The army files and the campaign files to load. */
export type GameFiles = Readonly<{ armies: readonly unknown[]; campaigns?: readonly unknown[] }>

/** A file's sight, by name: an army's own and what it requires, or what a campaign requires. */
type Viewer = Readonly<{ name: string; sees: ReadonlySet<string> }>

/**
 * The armies and campaigns, checked and resolved: each campaign's levels in order, each with what it offers. Throws
 * `ArmyError` listing every problem found in any of them.
 */
export function loadArmies(files: GameFiles, world: LoadWorld): Armies {
  const { maps } = world
  const problems: string[] = []

  // 1. The shapes, every file's, and what can be read of each.
  const read = new Map<string, ReadArmy>()
  files.armies.forEach((given, index) => {
    const army = readArmy(copied(given), `army ${index + 1}`, problems)
    if (army === null) return
    if (read.has(army.id)) problems.push(`two armies are called "${army.id}"; the second is left out`)
    else read.set(army.id, army)
  })
  const campaignFiles = new Map<string, ReadCampaign>()
  ;(files.campaigns ?? []).forEach((given, index) => {
    const campaign = readCampaign(copied(given), `campaign ${index + 1}`, problems)
    if (campaign === null) return
    if (campaignFiles.has(campaign.id)) problems.push(`two campaigns are called "${campaign.id}"; the second is left out`)
    else campaignFiles.set(campaign.id, campaign)
  })

  // An army may not define what the engine already defines another way.
  for (const army of read.values()) {
    for (const entry of army.entries) {
      if (world.registry.has(entry.id) && JSON.stringify(world.registry.get(entry.id)) !== JSON.stringify(definitionOf(entry))) {
        problems.push(`army "${army.id}": the content "${entry.id}" is defined differently already; name it by id, or give it an id of its own`)
      }
    }
  }
  // What the armies define as data joins the content the game has.
  const defined = [...read.values()].flatMap((army) => army.entries.filter((entry) => !world.registry.has(entry.id)).map(definitionOf))
  const registry = defined.length === 0 ? world.registry : createRegistry([...world.registry.ids().map((id) => world.registry.get(id)), ...defined])

  // 2. Requires: each one an army, and none of them in a circle.
  for (const army of read.values()) {
    for (const required of army.requires) {
      if (required === army.id) problems.push(`army "${army.id}" requires itself`)
      else if (!read.has(required)) problems.push(`army "${army.id}" requires "${required}", which is not an army`)
    }
  }
  for (const loop of circles(read).filter((ids) => ids.length > 1)) {
    problems.push(`armies ${quoted(loop)} require each other in a circle: ${[...loop, loop[0]].join(" -> ")}`)
  }
  for (const campaign of campaignFiles.values()) {
    for (const required of campaign.requires) if (!read.has(required)) problems.push(`campaign "${campaign.id}" requires "${required}", which is not an army`)
  }
  const armyViewer = (id: string): Viewer => ({ name: id, sees: sightOf(read, [id]) })

  // 3. Every id once: content an army brings, cards, Commanders and levels (a level's id is what a route names, so it
  // is unique across every campaign).
  type Owned<V = object> = Readonly<{ army: string }> & V
  const contentBy = new Map<string, Owned>()
  const buildingsBy = new Map<string, Owned<{ card: BuildingCard }>>()
  const powersBy = new Map<string, Owned<{ card: PowerCard }>>()
  const commandersBy = new Map<string, Owned<{ entry: CommanderEntry }>>()
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
    if (army.commander !== null) once(commandersBy, army.commander.id, { ...owned, entry: army.commander }, "Commander")
  }
  const levelEntries = new Map<string, LevelEntry>()
  const levelCampaign = new Map<string, string>()
  for (const campaign of campaignFiles.values()) {
    for (const level of campaign.levels) {
      const first = levelCampaign.get(level.id)
      if (first !== undefined) {
        problems.push(first === campaign.id ? `campaign "${first}" has the level "${level.id}" twice` : `the level "${level.id}" is in both "${first}" and "${campaign.id}"`)
        continue
      }
      levelCampaign.set(level.id, campaign.id)
      levelEntries.set(level.id, level)
    }
  }

  /** Why `id` is not content the viewer can use, or `null` when it is. */
  const unseenContent = (viewer: Viewer, id: string): string | null => {
    if (!registry.has(id)) return `"${id}", which is not content the game has`
    const owner = contentBy.get(id)?.army
    if (owner === undefined) return `"${id}", which no army brings`
    return viewer.sees.has(owner) ? null : `"${id}", which "${owner}" brings and "${viewer.name}" does not require`
  }
  /** Why the card `id` of `kind` is not one the viewer can offer, or `null` when it is. */
  const unseenCard = (viewer: Viewer, kind: "building" | "Nexus power", id: string): string | null => {
    const table: ReadonlyMap<string, Readonly<{ army: string }>> = kind === "building" ? buildingsBy : powersBy
    const owner = table.get(id)?.army
    if (owner === undefined) {
      const other = kind === "building" ? powersBy.has(id) && "a Nexus power" : buildingsBy.has(id) && "a building"
      return `the ${kind} "${id}", which no army has${other === false ? "" : ` (it is ${other})`}`
    }
    return viewer.sees.has(owner) ? null : `the ${kind} "${id}", which "${owner}" has and "${viewer.name}" does not require`
  }

  /** What is wrong with a building's place in the tech tree, each said after its name: a tier past `MAX_TIER`; a
   *  building it requires that the army cannot offer, itself, or one not of a lower tier; and a building above tier 1
   *  that requires none of the tier below it, which nothing would ever unlock in order. */
  const treeProblems = (viewer: Viewer, card: BuildingCard): string[] => {
    const said: string[] = []
    const tier = card.tier ?? 1
    if (tier > MAX_TIER) said.push(`is of tier ${tier}: the tree has tiers 1 to ${MAX_TIER}`)
    const tiers: number[] = []
    for (const id of card.requires ?? []) {
      if (id === card.id) {
        said.push(`requires itself, so it is never unlocked`)
        continue
      }
      const unseen = unseenCard(viewer, "building", id)
      if (unseen !== null) {
        said.push(`requires ${unseen}`)
        continue
      }
      const required = buildingsBy.get(id)?.card.tier ?? 1
      tiers.push(required)
      if (required >= tier) said.push(`of tier ${tier} requires "${id}", of tier ${required}: a building requires only lower tiers`)
    }
    if (tier > 1 && tier <= MAX_TIER && (card.requires ?? []).length > 0 && !tiers.includes(tier - 1) && said.length === 0) {
      said.push(`of tier ${tier} requires no building of tier ${tier - 1}`)
    }
    if (tier > 1 && (card.requires ?? []).length === 0) said.push(`of tier ${tier} requires nothing: name the building of tier ${tier - 1} that unlocks it`)
    return said
  }

  /** What an effect may ask of the power's army (`effects.ts`). */
  const sightFor = (viewer: Viewer): EffectSight => ({
    unit: (id) => {
      const unseen = unseenContent(viewer, id)
      if (unseen !== null) return unseen
      return registry.get(id).layer === "obstacles" ? `"${id}", which is a building, not a unit` : null
    },
    building: (id) => unseenCard(viewer, "building", id),
    spawns: (id) => buildingsBy.get(id)?.card.spawns !== undefined,
    content: (id) => unseenContent(viewer, id),
    registry,
  })

  /** What is wrong with how a Nexus power is dealt, each said after its name: a chance that changes nothing or
   *  ends before it starts; a requirement naming a power or a building the army does not see, or the power itself;
   *  an upgrade of a power the army does not see, of itself, or of one offered beside every hand. */
  const dealProblems = (viewer: Viewer, card: PowerCard): string[] => {
    const said: string[] = []
    for (const modifier of card.chance ?? []) {
      if (modifier.times === 1) said.push(`has a chance ${modifier.times} times as likely, which changes nothing`)
      if (modifier.to !== undefined && modifier.to < modifier.from) said.push(`has a chance from round ${modifier.from} to round ${modifier.to}, which ends before it starts`)
    }
    for (const id of card.requires?.powers ?? []) {
      if (id === card.id) said.push(`requires itself, so it is never dealt`)
      else {
        const unseen = unseenCard(viewer, "Nexus power", id)
        if (unseen !== null) said.push(`requires ${unseen}`)
      }
    }
    for (const id of card.requires?.buildings ?? []) {
      const unseen = unseenCard(viewer, "building", id)
      if (unseen !== null) said.push(`requires ${unseen}`)
    }
    if (card.upgrades !== undefined) {
      if (card.upgrades === card.id) said.push(`upgrades itself`)
      else {
        const unseen = unseenCard(viewer, "Nexus power", card.upgrades)
        if (unseen !== null) said.push(`upgrades ${unseen}`)
        else if (powersBy.get(card.upgrades)?.card.always === true) said.push(`upgrades "${card.upgrades}", which is offered beside every hand and never kept`)
      }
      if (card.always === true) said.push(`is offered beside every hand, so it cannot be an upgrade`)
    }
    return said
  }

  /** What is wrong with a level's own schedule: one that does not start at round 1, an entry that does not come
   *  after the one before it, a rarity dealt before its act on the power curve, and a power it makes sure of that the
   *  level does not offer, or that is offered beside every hand anyway. `offered` is every Nexus power the level
   *  offers, by id. */
  const scheduleProblems = (given: Schedule, offered: ReadonlySet<string>): string[] => {
    const said: string[] = []
    if (given.length === 0) said.push(`has a schedule with no entries: leave it out for the default`)
    else if (given[0]?.round !== 1) said.push(`has a schedule whose first entry is for round ${given[0]?.round}: it starts at round 1`)
    given.forEach((entry, index) => {
      const before = given[index - 1]
      if (before !== undefined && entry.round <= before.round) said.push(`has a schedule entry for round ${entry.round} after one for round ${before.round}: entries go in order`)
      for (const slot of entry.deal) {
        if (typeof slot !== "string" && "from" in slot) {
          // A card from another Nexus: the level must offer one, or the slot would always deal nothing.
          const any = [...offered].some((id) => powersBy.get(id)?.card.from === slot.from)
          if (!any) said.push(`deals a card from the ${slot.from} Nexus in round ${entry.round}, and the level offers none`)
          continue
        }
        // A rarity is never dealt before its act on the power curve, whether a slot asks for it or names a power of it.
        const rarity = typeof slot === "string" ? slot : powersBy.get(slot.power)?.card.rarity
        if (rarity !== undefined && entry.round < EARLIEST_ROUND[rarity]) {
          const what = typeof slot === "string" ? `a ${rarity}` : `"${slot.power}", a ${rarity},`
          said.push(`deals ${what} from round ${entry.round}: the power curve deals a ${rarity} from round ${EARLIEST_ROUND[rarity]}`)
        }
        if (typeof slot === "string") continue
        if (!offered.has(slot.power)) said.push(`makes sure of the Nexus power "${slot.power}" in round ${entry.round}, which the level does not offer`)
        else if (powersBy.get(slot.power)?.card.always === true) said.push(`makes sure of "${slot.power}" in round ${entry.round}, which is offered beside every hand anyway`)
      }
    })
    return said
  }

  // 4a. Armies: what each brings and offers is in its sight.
  for (const army of read.values()) {
    const viewer = armyViewer(army.id)
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
        const unseen = unseenContent(viewer, made)
        if (unseen !== null) say(`"${id}" puts on the Grid ${unseen}`)
      }
    }

    // Cards: a building is a structure the army sees, and what it spawns a unit the army sees; a Nexus power
    // says what it is.
    for (const card of army.buildings) {
      const unseen = unseenContent(viewer, card.structure)
      if (unseen !== null) say(`the building "${card.id}" names ${unseen}`)
      else if (registry.get(card.structure).layer !== "obstacles") say(`the building "${card.id}" names "${card.structure}", which is not a building`)
      for (const problem of treeProblems(viewer, card)) say(`the building "${card.id}" ${problem}`)
      if (card.spawns === undefined) continue
      const unit = card.spawns.unit
      const unseenUnit = unseenContent(viewer, unit)
      if (unseenUnit !== null) say(`the building "${card.id}" spawns ${unseenUnit}`)
      else if (registry.get(unit).layer === "obstacles") say(`the building "${card.id}" spawns "${unit}", which is a building, not a unit`)
    }
    for (const card of army.powers) {
      if (card.name.trim() === "" || card.description.trim() === "") say(`the Nexus power "${card.id}" needs a name and a description`)
      if (card.from !== undefined && !viewer.sees.has(card.from)) say(`the Nexus power "${card.id}" names "${card.from}" as the Nexus it comes from, which is not an army "${army.id}" requires`)
      const { kind, params } = effectParts(card.effect)
      for (const problem of kind.problems(params, sightFor(viewer))) say(`the Nexus power "${card.id}" ${problem}`)
      for (const problem of dealProblems(viewer, card)) say(`the Nexus power "${card.id}" ${problem}`)
    }

    // The Commander: her unit is a Commander the army sees, and her lines are for moments she can speak at, each
    // saying something that fits where it is shown.
    const entry = army.commander
    if (entry !== null) {
      if (entry.name.trim() === "") say(`the Commander "${entry.id}" has no name`)
      // Her faction: an army she sees that brings a Grid Nexus.
      if (!viewer.sees.has(entry.faction)) say(`the Commander "${entry.id}" names the faction "${entry.faction}", which is not an army "${army.id}" requires`)
      else if (!(read.get(entry.faction)?.content ?? []).some((id) => registry.has(id) && registry.get(id).nexus === true)) {
        say(`the Commander "${entry.id}" names the faction "${entry.faction}", which brings no Grid Nexus`)
      }
      const unseen = unseenContent(viewer, entry.unit)
      if (unseen !== null) say(`the Commander "${entry.id}" is ${unseen}`)
      else if (registry.get(entry.unit).commander !== true) say(`the Commander "${entry.id}" is "${entry.unit}", which is not a Commander`)
      for (const problem of [...barkProblems(entry), ...portraitProblems(entry), ...leanProblems(entry)]) say(problem)
      // Her starting package: units her army sees.
      for (const { unit } of entry.start ?? []) {
        const problem = sightFor(viewer).unit(unit)
        if (problem !== null) say(`the Commander "${entry.id}" starts with ${problem}`)
      }
      // Her army's schedule, against every power her army can offer.
      if (entry.schedule !== undefined) {
        const offered = new Set([...powersBy.entries()].filter(([, owned]) => viewer.sees.has(owned.army)).map(([id]) => id))
        for (const problem of scheduleProblems(entry.schedule, offered)) say(`the Commander "${entry.id}" ${problem}`)
      }
    }
  }

  // 4b. Campaigns: a Commander they see, levels made whole, and each level's map, unlocks and mission.
  const whole = wholeLevels(levelEntries, (level, problem) => problems.push(`campaign "${levelCampaign.get(level)}": level "${level}" ${problem}`))
  const missions = new Map<string, MissionDefinition>()
  for (const campaign of campaignFiles.values()) {
    const viewer: Viewer = { name: campaign.id, sees: sightOf(read, campaign.requires) }
    const say = (problem: string): void => {
      problems.push(`campaign "${campaign.id}": ${problem}`)
    }
    // What its shape check already refused (no Commander named, no list of levels) is not said again here.
    const { commander, levels: written } = campaign.file
    const owner = typeof commander === "string" ? commandersBy.get(commander) : undefined
    if (typeof commander === "string" && owner === undefined) say(`it is led by "${commander}", which is not a Commander any army has`)
    else if (owner !== undefined && !viewer.sees.has(owner.army)) say(`it is led by "${commander}", whom "${owner.army}" has and "${campaign.id}" does not require`)
    if (Array.isArray(written) && written.length === 0) say(`it has no levels`)
    const commanderUnit = owner?.entry.unit
    const unlocked = { buildings: new Map<string, string>(), powers: new Map<string, string>() }

    for (const written of campaign.levels) {
      const made = whole.get(written.id)
      if (made === undefined || levelCampaign.get(written.id) !== campaign.id) continue
      const level = made.entry
      const where = `level "${level.id}"`
      const map = level.map !== undefined && Object.hasOwn(maps, level.map) ? maps[level.map] : undefined
      if (map === undefined && level.map !== undefined) {
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
          const unseen = unseenCard(viewer, kind, id)
          if (unseen !== null) say(`${where} unlocks ${unseen}`)
        }
        for (const id of own) if (!seen.has(id)) seen.set(id, level.id)
      }
      // The tree: every building the level offers can be reached — what it requires is offered too, or stands on
      // the level's map from the start.
      const onMap = new Set((map?.standing ?? []).map((structure) => structure.contentId))
      for (const id of unlocked.buildings.keys()) {
        for (const needed of buildingsBy.get(id)?.card.requires ?? []) {
          const structure = buildingsBy.get(needed)?.card.structure
          if (!unlocked.buildings.has(needed) && (structure === undefined || !onMap.has(structure)) && unlocked.buildings.get(id) === level.id) {
            say(`${where} offers the building "${id}", which requires "${needed}", which the level neither offers nor has standing`)
          }
        }
      }
      if (level.schedule !== undefined) for (const problem of scheduleProblems(level.schedule, new Set(unlocked.powers.keys()))) say(`${where} ${problem}`)

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

      // Its mission, whole: its shape, then what it names, then against its map.
      if (!missionShape.check(made.mission, `levels[${level.id}].mission`, say)) continue
      // A mission that brings "@commander" in a campaign whose Commander is not found is not checked further: that she
      // is not found is said, and every line naming her would only say it again.
      if (commanderUnit === undefined && JSON.stringify(made.mission).includes(`"${COMMANDER_PLACEHOLDER}"`)) continue
      const mission = commanderUnit === undefined ? made.mission : withCommander(made.mission, commanderUnit)
      missions.set(level.id, mission)
      const inMission = `${where}, mission "${mission.id}"`
      if (map !== undefined) {
        try {
          validateMission(mission, map.grid(), registry)
        } catch (error) {
          if (!(error instanceof MissionError)) throw error
          for (const problem of error.problems) say(`${inMission}: ${problem}`)
        }
        for (const id of new Set(map.standing.map((structure) => structure.contentId))) {
          const unseen = unseenContent(viewer, id)
          if (unseen !== null) say(`${where} is played on the map "${level.map}", which has standing on it ${unseen}`)
        }
      }
      for (const id of contentOfMission(made.mission, registry)) {
        const unseen = registry.has(id) ? unseenContent(viewer, id) : null
        if (unseen !== null) say(`${inMission} uses ${unseen}`)
      }
      // The Commander a level brings for the player is its campaign's: "@commander", or her own id.
      mission.triggers.forEach((trigger) =>
        trigger.do.forEach((action: TriggerAction, index) => {
          if (!("spawn" in action) || action.spawn.side !== "A" || commanderUnit === undefined) return
          for (const unit of action.spawn.units) {
            if (!registry.has(unit.unit) || registry.get(unit.unit).commander !== true || unit.unit === commanderUnit) continue
            say(
              `${inMission}: trigger "${trigger.id}", action ${index + 1} (${actionName(action)}) brings the Commander "${unit.unit}" for the player, whose campaign's Commander is "${commanderUnit}": bring "${COMMANDER_PLACEHOLDER}"`,
            )
          }
        }),
      )
    }
  }

  if (problems.length > 0) throw new ArmyError(problems)

  // 5. Resolved: each campaign's levels, each offering what the campaign has unlocked by then.
  const ordered = loadOrder(read)
  const commanders = new Map<string, Commander>()
  for (const army of ordered) {
    const entry = army.commander
    if (entry === null) continue
    commanders.set(entry.id, {
      id: entry.id,
      army: army.id,
      name: entry.name,
      unit: entry.unit,
      faction: entry.faction,
      lean: entry.lean,
      start: entry.start ?? [],
      ...(entry.schedule === undefined ? {} : { schedule: entry.schedule }),
      barks: entry.barks ?? {},
      portrait: entry.portrait ?? [],
      portraitFalls: entry.portraitFalls ?? [],
    })
  }
  const campaigns: Campaign[] = []
  for (const campaign of campaignFiles.values()) {
    const commander = commanders.get(campaign.file.commander) as Commander
    const levels: Level[] = []
    let buildings: readonly BuildingCard[] = []
    let powers: readonly PowerCard[] = []
    campaign.levels.forEach((written, index) => {
      const entry = (whole.get(written.id) as Readonly<{ entry: LevelEntry }>).entry
      const newBuildings = (entry.unlocks?.buildings ?? []).map((id) => (buildingsBy.get(id) as Readonly<{ card: BuildingCard }>).card)
      const newPowers = (entry.unlocks?.powers ?? []).map((id) => (powersBy.get(id) as Readonly<{ card: PowerCard }>).card)
      buildings = [...buildings, ...newBuildings]
      powers = [...powers, ...newPowers]
      // The buildings the offered powers can add, once each, in the order the powers name them.
      const addable = [...new Set(powers.flatMap((card) => addsOf(card.effect) ?? []))].map(
        (id) => (buildingsBy.get(id) as Readonly<{ card: BuildingCard }>).card,
      )
      levels.push({
        id: entry.id,
        campaign: campaign.id,
        army: commander.army,
        number: index + 1,
        map: entry.map as string,
        mission: missions.get(entry.id) as MissionDefinition,
        // The level's own schedule, or else her army's: how her army bends the Nexus Pulse holds in every level.
        offer: { credits: entry.credits as number, buildings, powers, addable, ...((entry.schedule ?? commander.schedule) === undefined ? {} : { schedule: entry.schedule ?? commander.schedule }) },
        unlocked: { buildings: newBuildings, powers: newPowers },
      })
    })
    campaigns.push({ id: campaign.id, army: commander.army, title: campaign.file.title, commander, levels })
  }
  return frozen({
    armies: ordered.map((army) => army.file),
    commanders: [...commanders.values()],
    campaigns,
    levels: campaigns.flatMap((campaign) => campaign.levels),
    arsenals: Object.fromEntries(
      ordered.map((army) => {
        const sees = sightOf(read, [army.id])
        // A Commander's own: her army and her faction's chain. What else she sees belongs to another faction.
        const own = army.commander === null ? sees : new Set([army.id, ...sightOf(read, [army.commander.faction])])
        const factionOf = (owner: string): string => [...sees].find((id) => id !== army.id && read.get(id)?.commander === null && sightOf(read, [id]).has(owner) && (read.get(id)?.content ?? []).some((content) => registry.has(content) && registry.get(content).nexus === true)) ?? owner
        return [
          army.id,
          {
            buildings: [...buildingsBy.values()].filter((owned) => own.has(owned.army)).map((owned) => owned.card),
            powers: [...powersBy.values()]
              .filter((owned) => sees.has(owned.army))
              .map((owned) => (own.has(owned.army) || owned.card.from !== undefined ? owned.card : { ...owned.card, from: factionOf(owned.army) })),
            content: [...contentBy.entries()].filter(([, owned]) => sees.has(owned.army)).map(([id]) => id),
          },
        ]
      }),
    ),
    registry,
  })
}
