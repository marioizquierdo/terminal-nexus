// What a Nexus power does once it is kept, one kind at a time (commander-armies.md, "What a Nexus power does"): each
// kind is one entry of `EFFECTS`, which says everything about it in one place —
//
// - `shape`: what its JSON holds (`{ "spawnUnits": { "unit": ..., "count": 2 } }` is the kind `spawnUnits`);
// - `problems`: what the army loader refuses about it, given what the power's army can see (`load.ts`);
// - `apply`: what keeping it changes, for the rest of the mission, in a side's `Loadout` — its content, its build
//   menu, the units called up for this round — so the Build Phase shows it the moment it is picked and the battle
//   runs on it. The same function serves the campaign (`src/cli/pulse-run.ts`) and the duel (`src/duel/`);
// - `lasts`: whether it stays on the Nexus Pulse's list of kept powers, or is spent where it is picked;
// - `credits`: the credits it adds to spend when it is picked, if any.
//
// A new kind is a new entry here and nothing else: no reader branches on an effect's kind
// (docs/system-design/army-authoring.md, "Nexus powers"). Pure: no clock, no randomness.

import type { ContentDef, ContentRegistry } from "../content/index.ts"
import { createRegistry } from "../content/index.ts"
import type { Say, Shape } from "../content/shape.ts"
import { dictionary, isObject, list, literal, number, positiveWholeNumber, record, shown, text, wholeNumber } from "../content/shape.ts"
import type { EntityLayer } from "../grid/types.ts"
import { ENTITY_LAYERS } from "../grid/types.ts"
import type { AbilityUse } from "../content/types.ts"
import { abilityProblems } from "../abilities/index.ts"
import type { BuildingCard, BuildingSpawns, PowerEffect } from "./types.ts"

/** A row of a side's build menu, as far as an effect reads it: the structure it builds and what it spawns. */
export type BuildingRow = Readonly<{ contentId: string; spawns?: BuildingSpawns }>

/** Units a power calls up for the round it is picked in, set down at the side's Grid Nexus as the battle starts. */
export type Callup = Readonly<{ unit: string; count: number }>

/**
 * What a kept power can change for one side: the content its battles run on, its build menu (`catalog`, rows of the
 * caller's own type), and the units called up this round. `cards` is every building card the side could be offered,
 * and `row` makes a new menu row from one (`addBuilding`).
 */
export type Loadout<Row extends BuildingRow> = Readonly<{
  registry: ContentRegistry
  catalog: readonly Row[]
  callups: readonly Callup[]
  cards: readonly BuildingCard[]
  row: (card: BuildingCard, index: number) => Row
}>

/** What the loader can tell an effect about the power's army: why a unit (one that moves: never a building) or a
 *  building card is not one it can name, or `null` when it is; and whether a building card spawns anything. */
export type EffectSight = Readonly<{
  unit: (id: string) => string | null
  building: (id: string) => string | null
  spawns: (id: string) => boolean
  /** Why a content id, a unit or a building, is not one the army can name, or `null` when it is. */
  content: (id: string) => string | null
  /** The content the power's army sees, for an effect that reads what it changes (`modifyAbility`). */
  registry: ContentRegistry
}>

/** One kind of effect: everything about it. `P` is what its JSON holds under its key. */
export type EffectKind<P> = Readonly<{
  shape: Shape<P>
  problems: (params: P, sight: EffectSight) => string[]
  apply: <Row extends BuildingRow>(loadout: Loadout<Row>, params: P) => Partial<Pick<Loadout<Row>, "registry" | "catalog" | "callups">>
  lasts: boolean
  credits?: (params: P) => number
  /** The building card it adds to the build menu, by id, for one that adds one: what a level offering it can add. */
  adds?: (params: P) => string
  /**
   * **For a kind a building's own action may carry** (an upgrade, a mode: `BuildingActionCard`): what it names — a
   * building card by id, or a content id — so the loader can hold an action to naming its own building; and what it
   * changes of that one building's definition, which is the same change `apply` makes to every one of its kind. A kind
   * without these is a power's alone.
   */
  names?: (params: P) => Readonly<{ building?: string; content?: string }>
  refit?: (definition: ContentDef, params: P) => ContentDef
}>

/** `registry` with every definition `change` returns in place of the one it was given: the same registry, untouched,
 *  when nothing changed. */
function changedRegistry(registry: ContentRegistry, change: (definition: ContentDef) => ContentDef): ContentRegistry {
  const ids = registry.ids()
  const changed = ids.map((id) => change(registry.get(id)))
  // What a building carries is resolved from its base as changed, so a power and a building's own upgrade add up.
  return changed.every((definition, index) => definition === registry.get(ids[index] as string)) ? registry : createRegistry(changed, registry.fitter)
}

/** Why `unit` is not a unit the power can name, after what the power does to it (`calls up`). */
const unitProblem = (verb: string, unit: string, sight: EffectSight): string[] => {
  const unseen = sight.unit(unit)
  return unseen === null ? [] : [`${verb} ${unseen}`]
}

const spawnUnits: EffectKind<Readonly<{ unit: string; count: number }>> = {
  shape: record({ unit: text, count: positiveWholeNumber }, {}),
  problems: ({ unit }, sight) => unitProblem("calls up", unit, sight),
  apply: (loadout, { unit, count }) => ({ callups: [...loadout.callups, { unit, count }] }),
  lasts: false,
}

const addWaves: EffectKind<Readonly<{ building: string; waves: number }>> = {
  shape: record({ building: text, waves: positiveWholeNumber }, {}),
  problems: ({ building }, sight) => {
    const unseen = sight.building(building)
    if (unseen !== null) return [`names ${unseen}`]
    return sight.spawns(building) ? [] : [`adds waves to the building "${building}", which spawns nothing`]
  },
  apply: (loadout, { building, waves }) => {
    const structure = loadout.cards.find((card) => card.id === building)?.structure
    return {
      catalog: loadout.catalog.map((row) =>
        row.contentId === structure && row.spawns !== undefined ? { ...row, spawns: { ...row.spawns, waves: row.spawns.waves + waves } } : row,
      ),
    }
  },
  lasts: true,
  names: ({ building }) => ({ building }),
  refit: (definition, { waves }) =>
    definition.production === undefined ? definition : { ...definition, production: { ...definition.production, waves: definition.production.waves + waves } },
}

/** Units a wave: the Barracks's production line, as one Barracks's upgrade; as a power, every Barracks's. */
const addPerWave: EffectKind<Readonly<{ building: string; perWave: number }>> = {
  shape: record({ building: text, perWave: positiveWholeNumber }, {}),
  problems: ({ building }, sight) => {
    const unseen = sight.building(building)
    if (unseen !== null) return [`names ${unseen}`]
    return sight.spawns(building) ? [] : [`adds units a wave to the building "${building}", which spawns nothing`]
  },
  apply: (loadout, { building, perWave }) => {
    const structure = loadout.cards.find((card) => card.id === building)?.structure
    return {
      catalog: loadout.catalog.map((row) =>
        row.contentId === structure && row.spawns !== undefined ? { ...row, spawns: { ...row.spawns, perWave: row.spawns.perWave + perWave } } : row,
      ),
    }
  },
  lasts: true,
  names: ({ building }) => ({ building }),
  refit: (definition, { perWave }) =>
    definition.production === undefined ? definition : { ...definition, production: { ...definition.production, perWave: definition.production.perWave + perWave } },
}

/** The numbers of an attack an effect may add to. */
const ATTACK_NUMBERS = ["damage", "range", "cooldownTicks"] as const

/** `attack` with `add` added to its numbers. */
const attackAdded = (attack: NonNullable<ContentDef["attack"]>, add: Readonly<Record<string, number>>): NonNullable<ContentDef["attack"]> =>
  ({ ...attack, ...Object.fromEntries(Object.entries(add).map(([key, more]) => [key, (attack[key as (typeof ATTACK_NUMBERS)[number]] ?? 0) + more])) })

/** A better gun: a Turret's upgrade, as one Turret's; as a power, every one of its kind's. */
const modifyAttack: EffectKind<Readonly<{ content: string; add: Readonly<Record<string, number>> }>> = {
  shape: record({ content: text, add: dictionary(number) }, {}),
  problems: ({ content, add }, sight) => {
    const unseen = sight.content(content)
    if (unseen !== null) return [`changes ${unseen}`]
    const attack = sight.registry.get(content).attack
    if (attack === undefined) return [`changes the attack of "${content}", which has none`]
    const said: string[] = []
    for (const [key, more] of Object.entries(add)) {
      if (!(ATTACK_NUMBERS as readonly string[]).includes(key)) said.push(`adds to "${key}", which is not one of an attack's ${ATTACK_NUMBERS.map((name) => `"${name}"`).join(", ")}`)
      else if (!Number.isInteger(more) || more === 0) said.push(`adds ${more} to "${key}": a whole number, never 0`)
    }
    if (said.length > 0) return said
    // What it makes must still be an attack: something dealt, a cooldown, and a reach of a whole number of rows — 1,
    // touching (a melee attack's always), or even (grid.md).
    const made = attackAdded(attack, add)
    if (made.damage <= 0) said.push(`leaves the attack of "${content}" dealing ${made.damage}`)
    if (made.cooldownTicks <= 0) said.push(`leaves the attack of "${content}" a cooldown of ${made.cooldownTicks}`)
    if (attack.kind === "melee" && made.range !== 1) said.push(`makes the melee attack of "${content}" reach ${made.range}: melee reaches 1`)
    else if (made.range !== 1 && (made.range <= 0 || made.range % 2 !== 0)) said.push(`makes the attack of "${content}" reach ${made.range}: a reach is 1 or even`)
    return said
  },
  apply: (loadout, { content, add }) => ({
    registry: changedRegistry(loadout.registry, (definition) =>
      definition.id !== content || definition.attack === undefined ? definition : { ...definition, attack: attackAdded(definition.attack, add) },
    ),
  }),
  lasts: true,
  names: ({ content }) => ({ content }),
  refit: (definition, { add }) => (definition.attack === undefined ? definition : { ...definition, attack: attackAdded(definition.attack, add) }),
}

/** What a unit or a building fires at first: a Turret's mode, units first, as one Turret's. `prefer` empty is the
 *  nearest of any. */
const setTargetPreference: EffectKind<Readonly<{ content: string; prefer: readonly string[] }>> = {
  shape: record({ content: text, prefer: list(literal(...ENTITY_LAYERS)) }, {}),
  problems: ({ content }, sight) => {
    const unseen = sight.content(content)
    if (unseen !== null) return [`changes ${unseen}`]
    return sight.registry.get(content).attack === undefined ? [`changes what "${content}" fires at first, and it has no attack`] : []
  },
  apply: (loadout, params) => ({
    registry: changedRegistry(loadout.registry, (definition) => (definition.id === params.content ? preferring(definition, params.prefer) : definition)),
  }),
  lasts: true,
  names: ({ content }) => ({ content }),
  refit: (definition, { prefer }) => preferring(definition, prefer),
}

/** `definition` preferring targets on `prefer`, or none. */
function preferring(definition: ContentDef, prefer: readonly string[]): ContentDef {
  const { targetPreference: _before, ...rest } = definition
  return prefer.length === 0 ? rest : { ...rest, targetPreference: prefer as readonly EntityLayer[] }
}

const addBuilding: EffectKind<Readonly<{ building: string }>> = {
  shape: record({ building: text }, {}),
  problems: ({ building }, sight) => {
    const unseen = sight.building(building)
    return unseen === null ? [] : [`names ${unseen}`]
  },
  apply: (loadout, { building }) => {
    const card = loadout.cards.find((candidate) => candidate.id === building)
    if (card === undefined || loadout.catalog.some((row) => row.contentId === card.structure)) return {}
    return { catalog: [...loadout.catalog, loadout.row(card, loadout.catalog.length)] }
  },
  lasts: true,
  adds: ({ building }) => building,
}

const setDetonation: EffectKind<Readonly<{ unit: string; detonation: Readonly<{ radius: number; damage: number }> }>> = {
  shape: record({ unit: text, detonation: record({ radius: positiveWholeNumber, damage: positiveWholeNumber }, {}) }, {}),
  problems: ({ unit }, sight) => unitProblem("changes", unit, sight),
  apply: (loadout, { unit, detonation }) => ({
    registry: changedRegistry(loadout.registry, (definition) => (definition.id === unit ? { ...definition, detonation } : definition)),
  }),
  lasts: true,
}

/** A number of each of an ability's numbers to add (`{ "credits": 3 }`, or `{ "chanceIn": -1 }` to take one away). */
type Addition = Readonly<Record<string, number>>

/** `use` with `add` added to its numbers. */
const added = (use: AbilityUse, add: Addition): AbilityUse =>
  ({ ...use, ...Object.fromEntries(Object.entries(add).map(([key, more]) => [key, (typeof use[key] === "number" ? (use[key] as number) : 0) + more])) }) as AbilityUse

const modifyAbility: EffectKind<Readonly<{ content: string; kind: string; add: Addition }>> = {
  shape: record({ content: text, kind: text, add: dictionary(number) }, {}),
  problems: ({ content: unit, kind, add }, sight) => {
    const unseen = sight.content(unit)
    if (unseen !== null) return [`changes ${unseen}`]
    const uses = (sight.registry.get(unit).abilities ?? []).filter((use) => use.kind === kind)
    if (uses.length === 0) return [`changes the ability "${kind}" of "${unit}", which has none`]
    const said: string[] = []
    for (const [key, more] of Object.entries(add)) {
      if (!Number.isInteger(more) || more === 0) said.push(`adds ${more} to "${key}": a whole number, never 0`)
      else if (typeof uses[0]?.[key] !== "number") said.push(`adds to "${key}", which the ability "${kind}" of "${unit}" has no number for`)
    }
    if (said.length > 0) return said
    // What it makes must still be an ability of its kind (a lucky hit one time in zero is not one), and a reach still a
    // whole number of rows (grid.md): 1, which is touching, or even.
    return uses.flatMap((use) => {
      const made = added(use, add)
      const radius = made["radius"]
      const reach = typeof radius === "number" && radius !== 1 && radius % 2 !== 0 ? [`makes the ability "${kind}" of "${unit}" reach ${radius}: a reach is 1 or even`] : []
      return [...abilityProblems(made, `the ability "${kind}" of "${unit}" once changed`), ...reach]
    })
  },
  apply: (loadout, { content: unit, kind, add }) => ({
    registry: changedRegistry(loadout.registry, (definition) => (definition.id !== unit ? definition : abilityAdded(definition, kind, add))),
  }),
  lasts: true,
  names: ({ content }) => ({ content }),
  refit: (definition, { kind, add }) => abilityAdded(definition, kind, add),
}

/** `definition` with its abilities of `kind` given `add`. */
function abilityAdded(definition: ContentDef, kind: string, add: Addition): ContentDef {
  return definition.abilities === undefined ? definition : { ...definition, abilities: definition.abilities.map((use) => (use.kind === kind ? added(use, add) : use)) }
}

const credits: EffectKind<number> = {
  shape: wholeNumber,
  problems: () => [],
  apply: () => ({}),
  lasts: false,
  credits: (amount) => amount,
}

/** Every kind of effect, by the key that names it in a power's JSON. */
export const EFFECTS = { spawnUnits, addWaves, addPerWave, addBuilding, setDetonation, modifyAbility, modifyAttack, setTargetPreference, credits } as const

export type EffectName = keyof typeof EFFECTS

/** An effect's kind and what it holds. */
export function effectParts(effect: PowerEffect): Readonly<{ name: EffectName; kind: EffectKind<unknown>; params: unknown }> {
  const name = Object.keys(effect)[0] as EffectName
  return { name, kind: EFFECTS[name] as EffectKind<unknown>, params: (effect as Readonly<Record<string, unknown>>)[name] }
}

/** Whether a kept power stays on the list of kept powers, or is spent where it is picked. */
export const lasts = (effect: PowerEffect): boolean => effectParts(effect).kind.lasts

/** The building card a power adds to the build menu, by id, or `null` for one that adds none. */
export function addsOf(effect: PowerEffect): string | null {
  const { kind, params } = effectParts(effect)
  return kind.adds?.(params) ?? null
}

/** The credits a power adds to spend when it is picked. */
export function creditsOf(effect: PowerEffect): number {
  const { kind, params } = effectParts(effect)
  return kind.credits?.(params) ?? 0
}

/** What keeping a power changes in a side's loadout. */
export function applyEffect<Row extends BuildingRow>(loadout: Loadout<Row>, effect: PowerEffect): Loadout<Row> {
  const { kind, params } = effectParts(effect)
  return { ...loadout, ...kind.apply(loadout, params) }
}

/** The shape of a power's effect: an object with one key, the kind, holding what that kind needs. */
export const effectShape: Shape<PowerEffect> = {
  check(value: unknown, at: string, say: Say): value is PowerEffect {
    const known = Object.keys(EFFECTS).map((name) => `"${name}"`).join(", ")
    const keys = isObject(value) ? Object.keys(value) : []
    const [name] = keys
    if (!isObject(value) || keys.length !== 1 || name === undefined || !Object.hasOwn(EFFECTS, name)) {
      say(`${at} should be a Nexus power's effect: an object with one of ${known}, not ${isObject(value) ? (keys.length === 0 ? "an empty object" : keys.map((key) => `"${key}"`).join(" and ")) : shown(value)}`)
      return false
    }
    return (EFFECTS[name as EffectName].shape as Shape<unknown>).check(value[name], `${at}.${name}`, say)
  },
}
