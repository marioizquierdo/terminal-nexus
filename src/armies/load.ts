// The army loader: the game's armies, checked and resolved before anything reads them.
//
// An army is data a modder can write without TypeScript, so everything is checked here, and every problem is reported
// at once, by name. In order:
//
// 1. **read** each file's shape (`read.ts`): a broken item is left out of what follows, never hiding the rest;
// 2. **see**: each army sees itself and what it requires, directly or through another; a circle of `requires` is
//    refused;
// 3. **index** every id once: content, building cards, Nexus powers, Commanders;
// 4. **check** that everything a file names is in its sight: a building's structure and units, a power's effect
//    (`effects.ts`), a Commander's unit and voice;
// 5. **resolve** each army's arsenal: what a Commander leading it may build and be dealt.
//
// Pure, like the rest of the rules around the battle engine: no clock, no randomness, nothing read from disk. The files
// and the content registry are arguments (`src/armies/index.ts` passes the game's).
//
// Story's levels and missions were loaded here too until Story stopped (the owner, 2026-11-26): it returns as a
// scripting layer over a Skirmish (docs/game-design/story.md).

import type { ContentRegistry } from "../content/index.ts"
import { createRegistry, withFitter } from "../content/index.ts"
import { definitionOf } from "../content/data.ts"
import type { BarkMoment } from "./barks.ts"
import { BARK_MOMENTS, barkProblem } from "./barks.ts"
import { EARLIEST_ROUND, LEANS, MAX_LEANS, MAX_TIER } from "./curve.ts"
import { ACTION_KEYS, ACTION_LABEL_MAX, ORDERS, fitterOf, modeSet } from "./actions.ts"
import type { EffectKind, EffectSight } from "./effects.ts"
import { EFFECTS, addsOf, effectParts } from "./effects.ts"
import type { ReadArmy } from "./read.ts"
import { readArmy } from "./read.ts"
import type { Armies, BuildingActionCard, BuildingCard, Commander, CommanderEntry, PowerCard, Schedule } from "./types.ts"
import { ArmyError, PORTRAIT_ROWS, PORTRAIT_WIDTH } from "./types.ts"

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

/** What the loader checks the files' references against: the content the game has. The content an army defines as
 *  data is added to `registry` where it is not there already. */
export type LoadWorld = Readonly<{
  registry: ContentRegistry
}>

/** The army files to load. */
export type GameFiles = Readonly<{ armies: readonly unknown[] }>

/** A file's sight, by name: an army's own and what it requires. */
type Viewer = Readonly<{ name: string; sees: ReadonlySet<string> }>

/** The armies, checked and resolved. Throws `ArmyError` listing every problem found in any of them. */
export function loadArmies(files: GameFiles, world: LoadWorld): Armies {
  const problems: string[] = []

  // 1. The shapes, every file's, and what can be read of each.
  const read = new Map<string, ReadArmy>()
  files.armies.forEach((given, index) => {
    const army = readArmy(copied(given), `army ${index + 1}`, problems)
    if (army === null) return
    if (read.has(army.id)) problems.push(`two armies are called "${army.id}"; the second is left out`)
    else read.set(army.id, army)
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
  const armyViewer = (id: string): Viewer => ({ name: id, sees: sightOf(read, [id]) })

  // 3. Every id once: content an army brings, cards and Commanders.
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
    if ((card.rarity === undefined) !== (card.role === undefined)) said.push(`has ${card.rarity === undefined ? "a role but no rarity" : "a rarity but no role"}: a run's draft needs both`)
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

  /**
   * What is wrong with a building's actions (`actions.ts`), each said after its name: an id that is not lower case,
   * digits and dashes, or one given twice; a label empty or too long for its row; more upgrades and modes than there are
   * keys for them; an upgrade with no price or nothing it changes; a set of modes of one alone, whose first changes
   * something or costs, or whose later ones change nothing; an order the game does not have, given twice, or on a
   * building it cannot be given to; what one changes said by a kind a building's action cannot carry, or naming another
   * building, or what that kind refuses itself; and what one requires that the card or the army does not have.
   */
  const actionProblems = (viewer: Viewer, card: BuildingCard): string[] => {
    const actions = card.actions ?? []
    const said: string[] = []
    const ids = new Set<string>()
    for (const action of actions) {
      const what = `action "${action.id}"`
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(action.id)) said.push(`has the ${what}: an action's id is lower case, digits and dashes`)
      if (ids.has(action.id)) said.push(`has the ${what} twice`)
      ids.add(action.id)
      const label = action.label.trim()
      if (label === "") said.push(`has the ${what} with no label`)
      else if (label.length > ACTION_LABEL_MAX) said.push(`has the ${what} labelled "${label}", ${label.length} glyphs: a card's row has room for ${ACTION_LABEL_MAX}`)
      const stray = (field: string, kinds: string): void => {
        said.push(`has the ${action.kind} ${what} with a ${field}, which only ${kinds} has`)
      }
      if (action.kind !== "mode" && action.set !== undefined) stray("set", "a mode")
      if (action.kind !== "order" && action.order !== undefined) stray("order", "an order")
      if (action.kind === "order" && (action.effects ?? []).length > 0) stray("list of effects", "an upgrade or a mode")
      if (action.kind === "order" && action.cost !== undefined) stray("cost", "an upgrade or a mode")
      if (action.kind === "upgrade") {
        if (action.cost === undefined) said.push(`has the upgrade ${what} with no cost: an upgrade is bought with credits`)
        if ((action.effects ?? []).length === 0) said.push(`has the upgrade ${what}, which changes nothing`)
      }
      if (action.kind === "order") {
        const order = action.order === undefined ? undefined : ORDERS[action.order]
        if (order === undefined) said.push(`has the order ${what}, which gives ${action.order === undefined ? "no order" : `"${action.order}"`}: the game's orders are ${Object.keys(ORDERS).map((name) => `"${name}"`).join(", ")}`)
        else if (order.needsSpawns && card.spawns === undefined) said.push(`has the order ${what}, "${action.order}", and makes no units for it to hold`)
        if (actions.some((other) => other !== action && other.kind === "order" && other.order === action.order && actions.indexOf(other) < actions.indexOf(action))) said.push(`gives the order "${action.order}" twice`)
      }
      for (const effect of action.effects ?? []) {
        const { name, kind, params } = effectParts(effect)
        const named = kind.names?.(params)
        if (named === undefined || kind.refit === undefined) {
          said.push(`has the ${what} changing it by "${name}", which a building's action cannot: ${Object.entries(EFFECTS).filter(([, each]) => (each as EffectKind<unknown>).refit !== undefined).map(([each]) => `"${each}"`).join(", ")} can`)
          continue
        }
        const target = named.building ?? named.content
        if (named.building !== undefined ? named.building !== card.id : named.content !== card.structure) {
          said.push(`has the ${what} changing "${target}": a building's action changes that building alone, "${named.building !== undefined ? card.id : card.structure}"`)
          continue
        }
        for (const problem of kind.problems(params, sightFor(viewer))) said.push(`has the ${what}, which ${problem}`)
      }
      for (const id of action.requires?.actions ?? []) {
        const required = actions.find((other) => other.id === id)
        if (id === action.id) said.push(`has the ${what} requiring itself, so it is never taken`)
        else if (required === undefined) said.push(`has the ${what} requiring "${id}", which is not one of its actions`)
        else if (required.kind !== "upgrade") said.push(`has the ${what} requiring "${id}", a ${required.kind}: an action requires the building's upgrades`)
      }
      for (const id of action.requires?.buildings ?? []) {
        const unseen = unseenCard(viewer, "building", id)
        if (unseen !== null) said.push(`has the ${what} requiring ${unseen}`)
      }
    }
    // Its modes, set by set: the first is the building as it is written, so it changes nothing and costs nothing, and
    // every other changes something; a set of one is not a choice.
    const sets = new Map<string, BuildingActionCard[]>()
    for (const action of actions) if (action.kind === "mode") sets.set(modeSet(action), [...(sets.get(modeSet(action)) ?? []), action])
    for (const [set, modes] of sets) {
      const [first, ...rest] = modes
      if (first === undefined) continue
      if (rest.length === 0) said.push(`has one mode in the set "${set}", "${first.id}": a set of modes has two or more`)
      if ((first.effects ?? []).length > 0 || (first.cost ?? 0) > 0) said.push(`has "${first.id}" first in the set of modes "${set}", which changes or costs something: the first is the building as it is written`)
      for (const mode of rest) if ((mode.effects ?? []).length === 0) said.push(`has the mode "${mode.id}", which changes nothing`)
    }
    const keyed = actions.filter((action) => action.kind !== "order").length
    if (keyed > ACTION_KEYS.length) said.push(`has ${keyed} upgrades and modes: a building has keys for ${ACTION_KEYS.length}`)
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
    if (card.tier !== undefined && card.tier > MAX_TIER) said.push(`is of tier ${card.tier}: a run has tiers 1 to ${MAX_TIER}`)
    if (card.doctrine === true) {
      for (const [field, present] of [["offered beside every hand", card.always === true], ["from another Nexus", card.from !== undefined], ["an upgrade of a power", card.upgrades !== undefined], ["dealt by chance", card.chance !== undefined], ["dealt on requirements", card.requires !== undefined]] as const) {
        if (present) said.push(`is a Doctrine, a standing order a run's draft offers, and is also ${field}: the Nexus Pulse never deals it`)
      }
    }
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

  /** What is wrong with a Commander's schedule: one that does not start at round 1, an entry that does not come
   *  after the one before it, a rarity dealt before its act on the power curve, and a power it makes sure of that her
   *  army does not offer, or that is offered beside every hand anyway. `offered` is every Nexus power it offers, by id. */
  const scheduleProblems = (given: Schedule, offered: ReadonlySet<string>): string[] => {
    const said: string[] = []
    if (given.length === 0) said.push(`has a schedule with no entries: leave it out for the default`)
    else if (given[0]?.round !== 1) said.push(`has a schedule whose first entry is for round ${given[0]?.round}: it starts at round 1`)
    given.forEach((entry, index) => {
      const before = given[index - 1]
      if (before !== undefined && entry.round <= before.round) said.push(`has a schedule entry for round ${entry.round} after one for round ${before.round}: entries go in order`)
      for (const slot of entry.deal) {
        if (typeof slot !== "string" && "from" in slot) {
          // A card from another Nexus: her army must offer one, or the slot would always deal nothing.
          const any = [...offered].some((id) => powersBy.get(id)?.card.from === slot.from)
          if (!any) said.push(`deals a card from the ${slot.from} Nexus in round ${entry.round}, and her army offers none`)
          continue
        }
        // A rarity is never dealt before its act on the power curve, whether a slot asks for it or names a power of it.
        const rarity = typeof slot === "string" ? slot : powersBy.get(slot.power)?.card.rarity
        if (rarity !== undefined && entry.round < EARLIEST_ROUND[rarity]) {
          const what = typeof slot === "string" ? `a ${rarity}` : `"${slot.power}", a ${rarity},`
          said.push(`deals ${what} from round ${entry.round}: the power curve deals a ${rarity} from round ${EARLIEST_ROUND[rarity]}`)
        }
        if (typeof slot === "string") continue
        if (!offered.has(slot.power)) said.push(`makes sure of the Nexus power "${slot.power}" in round ${entry.round}, which her army does not offer`)
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
        if (unseen !== null) say(`"${id}" puts on the battlefield ${unseen}`)
      }
    }

    // Cards: a building is a structure the army sees, and what it spawns a unit the army sees; a Nexus power
    // says what it is.
    for (const card of army.buildings) {
      const unseen = unseenContent(viewer, card.structure)
      if (unseen !== null) say(`the building "${card.id}" names ${unseen}`)
      else if (registry.get(card.structure).layer !== "obstacles") say(`the building "${card.id}" names "${card.structure}", which is not a building`)
      for (const problem of treeProblems(viewer, card)) say(`the building "${card.id}" ${problem}`)
      for (const problem of actionProblems(viewer, card)) say(`the building "${card.id}" ${problem}`)
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
      // Her faction: an army she sees that brings a Nexus.
      if (!viewer.sees.has(entry.faction)) say(`the Commander "${entry.id}" names the faction "${entry.faction}", which is not an army "${army.id}" requires`)
      else if (!(read.get(entry.faction)?.content ?? []).some((id) => registry.has(id) && registry.get(id).nexus === true)) {
        say(`the Commander "${entry.id}" names the faction "${entry.faction}", which brings no Nexus`)
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

  // A building's actions are its structure's, wherever it is offered: one card says them.
  const actionsOn = new Map<string, string>()
  for (const { card } of buildingsBy.values()) {
    if ((card.actions ?? []).length === 0) continue
    const first = actionsOn.get(card.structure)
    if (first === undefined) actionsOn.set(card.structure, card.id)
    else problems.push(`the buildings "${first}" and "${card.id}" both give "${card.structure}" actions; one card says what a building can do`)
  }

  if (problems.length > 0) throw new ArmyError(problems)

  // 5. Resolved: the Commanders, and each army's arsenal.
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
  return frozen({
    armies: ordered.map((army) => army.file),
    commanders: [...commanders.values()],
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
    // A building that carries an upgrade or a mode has a content id of its own, which the registry resolves from its
    // card's actions (`actions.ts`): every registry made from this one does too.
    registry: withFitter(registry, fitterOf([...buildingsBy.values()].map((owned) => owned.card))),
  })
}
