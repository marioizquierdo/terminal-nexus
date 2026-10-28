// Content written as data: a unit or a structure defined in an army file (`armies/<id>/army.json`, its `content`
// list), with the words its card says and the glyphs that draw it beside its numbers — so a Commander, her units and
// her buildings live in one file a modder can write without TypeScript (docs/system-design/army-authoring.md).
//
// The engine's own bench rosters are still TypeScript (`citizen.ts`, `ravel.ts`, `proving-grounds.ts`): the bench
// maps and the kernel's tests are written against them. An army may name one of those by its id instead of defining
// it; everything an army defines comes through here.
//
// One entry is three things, split here and never mixed again:
//
// - **the definition** (`ContentDef`): what the kernel reads. Every field is a `ContentDef` field under the same
//   name, but `size` (the footprint, as `[width, height]`) and the defaults below;
// - **the card** (`CardText`): what a card says of it, read by the Build Phase (`src/content/cards.ts`);
// - **the glyph** (`UnitArt`): how it is drawn, read only by the view (`src/content/art.ts`). The kernel never sees
//   a glyph (presentation.md): the registry is built from the definition alone.
//
// Pure: the JSON is an argument, every problem is said at once, by path.

import type { EntityLayer } from "../grid/types.ts"
import { ENTITY_LAYERS } from "../grid/types.ts"
import type { Say, Shape } from "./shape.ts"
import { dictionary, fieldAt, list, literal, positiveWholeNumber, record, text, wholeNumber } from "./shape.ts"
import type { AbilityUse, AreaDamage, AttackDef, Behavior, Burn, ContentDef, Detonation, FormationLine, MovementRate, UnitClass } from "./types.ts"
import { rectFootprint } from "./types.ts"
import { abilityProblems } from "../abilities/index.ts"
import type { CardText } from "./cards.ts"

/** How a unit or a structure is drawn: rows north to south, one glyph per tile (`src/content/art.ts`). */
export type Glyph = readonly string[]

/**
 * A unit or a structure as an army file writes it. Every field but `size`, `card`, `glyph` and `notes` is the
 * `ContentDef` field of the same name (`src/content/types.ts` says what each does); what may be left out has the
 * default its comment gives.
 */
export type ContentEntry = Readonly<{
  /** Unique across the game: `<kind>.<faction>.<name>` by convention (`unit.ravel.dob`). Only its last part means
   *  anything to the engine, as the default `short` name; the army that defines it is whichever file it is in. */
  id: string
  /** The short name report lines use (`A:trooper#1`). Absent: the id's last part. */
  short?: string
  layer: EntityLayer
  /** Its footprint, `[width, height]` in tiles. */
  size: readonly [number, number]
  maxHp: number
  movementRate?: MovementRate
  /** Absent: 2 for anything that moves, 9 for a structure. */
  speedTier?: number
  attack?: AttackDef
  /** Absent: what its layer collides with (`DEFAULT_COLLISIONS`). */
  collidesWith?: readonly EntityLayer[]
  /** Absent: `"advance"` for anything that moves, `"static"` for a structure. */
  behavior?: Behavior
  /** Absent: 0. */
  salvage?: number
  detonation?: Detonation
  nexus?: true
  commander?: true
  roundsOut?: number
  vision?: number
  targetLayers?: readonly EntityLayer[]
  targetPreference?: readonly EntityLayer[]
  aim?: "crowd"
  line?: FormationLine
  class?: UnitClass
  spawn?: NonNullable<ContentDef["spawn"]>
  splitOnDeath?: NonNullable<ContentDef["splitOnDeath"]>
  constructionRadius?: number
  supplyProvided?: number
  mends?: number
  supplyCost?: number
  abilities?: readonly AbilityUse[]
  card: CardText
  glyph: Glyph
  notes?: string
}>

/** What each layer collides with when an entry does not say: a ground unit bumps buildings and units, a worker
 *  buildings and workers, a structure everything on the ground, a flyer only other flyers. */
export const DEFAULT_COLLISIONS: Readonly<Record<EntityLayer, readonly EntityLayer[]>> = {
  units: ["obstacles", "units"],
  workers: ["obstacles", "workers"],
  obstacles: ["obstacles", "workers", "units"],
  air: ["air"],
}

const layer = literal(...ENTITY_LAYERS)
const movementRate = record<MovementRate>({ numerator: positiveWholeNumber, denominator: positiveWholeNumber }, {})
const areaDamage = record<AreaDamage>({ radius: positiveWholeNumber, damage: positiveWholeNumber }, { hits: literal("enemies") })
const attack = record<AttackDef>(
  { kind: literal("melee", "ranged", "heal"), range: positiveWholeNumber, damage: wholeNumber, cooldownTicks: positiveWholeNumber },
  {
    projectileTilesPerTick: positiveWholeNumber,
    windupTicks: positiveWholeNumber,
    splash: areaDamage,
    burn: record<Burn>({ radius: positiveWholeNumber, damage: positiveWholeNumber, everyTicks: positiveWholeNumber, ticks: positiveWholeNumber }, {}),
    focusRamp: record<Readonly<{ perHitPercent: number; maxPercent: number }>>({ perHitPercent: positiveWholeNumber, maxPercent: positiveWholeNumber }, {}),
  },
)
const detonation = record<Detonation>({ radius: positiveWholeNumber, damage: positiveWholeNumber }, { hits: literal("enemies"), triggerRange: positiveWholeNumber })
/** An ability as content names it: its kind and its own numbers, checked by its kind (`src/abilities/`). */
const abilityUse: Shape<AbilityUse> = {
  check(value: unknown, at: string, say: Say): value is AbilityUse {
    if (!dictionary(abilityValue).check(value, at, say)) return false
    if (typeof (value as Record<string, unknown>)["kind"] !== "string") {
      say(`${fieldAt(at, "kind")} should name the ability's kind`)
      return false
    }
    return true
  },
}
/** An ability's own numbers and words: whole numbers, text, or lists of them — what a canonical hash can hold. */
const abilityValue: Shape<unknown> = {
  check(value: unknown, at: string, say: Say): value is unknown {
    if (typeof value === "string" || (typeof value === "number" && Number.isInteger(value))) return true
    if (Array.isArray(value)) return value.every((item, index) => abilityValue.check(item, `${at}[${index}]`, say))
    say(`${at} should be a whole number, text or a list of them`)
    return false
  },
}
const pronouns = record<NonNullable<CardText["pronouns"]>>({ subject: text, possessive: text }, {})
const card = record<CardText>({ title: text, subtitle: text, description: text }, { pronouns })

/** The shape of a content entry: every field named, every number a whole number. */
export const contentEntry: Shape<ContentEntry> = record<ContentEntry>(
  { id: text, layer, size: list(positiveWholeNumber) as unknown as Shape<readonly [number, number]>, maxHp: positiveWholeNumber, card, glyph: list(text) },
  {
    short: text,
    movementRate,
    speedTier: wholeNumber,
    attack,
    collidesWith: list(layer),
    behavior: literal("advance", "flee", "static", "support"),
    salvage: wholeNumber,
    detonation,
    nexus: literal(true),
    commander: literal(true),
    roundsOut: wholeNumber,
    vision: positiveWholeNumber,
    targetLayers: list(layer),
    targetPreference: list(layer),
    aim: literal("crowd"),
    line: literal("flanker", "melee", "ranged"),
    class: literal("tank", "fighter", "support", "siege"),
    spawn: record<NonNullable<ContentDef["spawn"]>>({ contentId: text, intervalTicks: positiveWholeNumber, maxAlive: positiveWholeNumber }, {}),
    splitOnDeath: record<NonNullable<ContentDef["splitOnDeath"]>>({ contentId: text, count: positiveWholeNumber }, {}),
    constructionRadius: positiveWholeNumber,
    supplyProvided: positiveWholeNumber,
    mends: positiveWholeNumber,
    supplyCost: wholeNumber,
    abilities: list(abilityUse),
    notes: text,
  },
)

/** What is wrong with an entry that has the shape: a size that is not two numbers, a glyph not as big as its size,
 *  a glyph outside plain ASCII, a Commander's card without pronouns, a `roundsOut` on something not a Commander. */
export function entryProblems(entry: ContentEntry): string[] {
  const problems: string[] = []
  const whose = `the content "${entry.id}"`
  if (entry.size.length !== 2) return [`${whose} has a size of ${entry.size.length} numbers: [width, height]`]
  const [width, height] = entry.size
  if (entry.glyph.length !== height) problems.push(`${whose} is ${height} tall and its glyph has ${entry.glyph.length} rows`)
  entry.glyph.forEach((row, index) => {
    if (row.length !== width) problems.push(`${whose} is ${width} wide and its glyph's row ${index + 1} is ${row.length}`)
    if (!/^[\x21-\x7e]*$/.test(row)) problems.push(`${whose}'s glyph row ${index + 1} has a space or a glyph outside plain ASCII`)
  })
  if (entry.commander === true && entry.card.pronouns === undefined) problems.push(`${whose} is a Commander, and its card needs pronouns`)
  if (entry.roundsOut !== undefined && entry.commander !== true) problems.push(`${whose} sits rounds out, and only a Commander does`)
  if (entry.layer === "obstacles" && entry.movementRate !== undefined) problems.push(`${whose} is a structure, and a structure does not move`)
  ;(entry.abilities ?? []).forEach((ability, index) => problems.push(...abilityProblems(ability, `${whose}'s ability ${index + 1}`)))
  // Whole rows (grid.md): a reach of R covers R / 2 rows up and down, so an odd reach above 1 buys a column at each
  // end of its rows and no row. Every reach is 1, which is touching, or even; a melee range is 1.
  const reaches: Readonly<Record<string, number | undefined>> = {
    "attack range": entry.attack?.range,
    "splash radius": entry.attack?.splash?.radius,
    "burn radius": entry.attack?.burn?.radius,
    "detonation radius": entry.detonation?.radius,
    "detonation trigger": entry.detonation?.triggerRange,
    "construction radius": entry.constructionRadius,
    vision: entry.vision,
    ...Object.fromEntries((entry.abilities ?? []).map((ability, index) => [`ability ${index + 1}'s radius`, typeof ability["radius"] === "number" ? ability["radius"] : undefined])),
  }
  for (const [what, reach] of Object.entries(reaches)) {
    if (reach !== undefined && reach !== 1 && reach % 2 !== 0) problems.push(`${whose}'s ${what} is ${reach}: a reach is 1, which is touching, or even, a whole number of rows`)
  }
  // A crowd is counted within the unit's area (`areaOf`, src/pulse/perception.ts): a unit with none has no crowd to aim at.
  if (entry.aim === "crowd" && entry.attack?.burn === undefined && entry.attack?.splash === undefined && entry.detonation === undefined) {
    problems.push(`${whose} aims at a crowd, and has no area to count one in: a splash, a burn or a detonation`)
  }
  if (entry.attack?.burn !== undefined && entry.attack.kind === "heal") problems.push(`${whose} heals, and a heal never sets the ground burning`)
  if (entry.attack?.kind === "melee" && entry.attack.range !== 1) problems.push(`${whose}'s melee range is ${entry.attack.range}: melee reaches what touches it, 1`)
  return problems
}

/** The kernel's definition of an entry: its fields, its size as a footprint, and the defaults filled in. */
export function definitionOf(entry: ContentEntry): ContentDef {
  const { size, card: _card, glyph: _glyph, notes: _notes, short, speedTier, collidesWith, behavior, salvage, ...rest } = entry
  const moves = entry.layer !== "obstacles"
  return {
    ...rest,
    short: short ?? entry.id.slice(entry.id.lastIndexOf(".") + 1),
    footprint: rectFootprint(size[0], size[1]),
    speedTier: speedTier ?? (moves ? 2 : 9),
    collidesWith: collidesWith ?? DEFAULT_COLLISIONS[entry.layer],
    behavior: behavior ?? (moves ? "advance" : "static"),
    salvage: salvage ?? 0,
  }
}

/** The entries of some army files: every object in their `content` lists (a string there names content the engine
 *  defines), the first of each id, none that `known` already has. What does not have the shape is left out here; the
 *  army loader says why (`src/armies/load.ts`). */
export function entriesOf(files: readonly unknown[], known: (id: string) => boolean = () => false): ContentEntry[] {
  const entries: ContentEntry[] = []
  const seen = new Set<string>()
  const quiet: Say = () => {}
  for (const file of files) {
    const content = file !== null && typeof file === "object" ? (file as Record<string, unknown>)["content"] : undefined
    if (!Array.isArray(content)) continue
    for (const item of content) {
      if (typeof item === "string") continue
      // The first of an id only, and none the engine already defines: the loader names the second one, with the rest.
      if (!contentEntry.check(item, "content", quiet) || entryProblems(item).length > 0 || seen.has(item.id) || known(item.id)) continue
      seen.add(item.id)
      entries.push(item)
    }
  }
  return entries
}

/** Every problem of an army file's content entries, each naming where. */
export function contentProblems(content: readonly unknown[], at: string): string[] {
  const problems: string[] = []
  const say: Say = (problem) => problems.push(problem)
  content.forEach((item, index) => {
    if (typeof item === "string") return
    const where = fieldAt(at, `content[${index}]`)
    if (contentEntry.check(item, where, say)) problems.push(...entryProblems(item))
  })
  return problems
}
