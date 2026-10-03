// A Commander's deck: what a player who picks her brings to a battle — her Commander, the credits a Build
// Phase starts with, what she can build and her Nexus power pool (commander-armies.md calls the whole package
// a Commander Army; the owner calls it her deck). It is defined once, here, beside the content, so every mode
// reads the same one: a mode that lets a player pick Vasse takes her deck whole, and a Campaign mission names
// the deck it plays and overrides what it needs, because the Campaign develops the deck level by level (the
// owner, 2026-10-03: "a campaign level should be able to override the actual deck").
//
// **At the size of what exists**: the bench buildings PERIMETER has always offered and the two placeholder Nexus
// powers. Choosing the Citizens' real roster, its balance and the effect kinds behind real Nexus powers are
// still to come (the Commander milestone's Nexus draft step, and the microgame milestone after it); what is
// settled here is the deck's shape and that a mission overrides it.
//
// Data only, read by the Build Phase's assembly and the mission's validation. The kernel never reads a deck.

import type { ContentRegistry } from "./index.ts"

/** One building a deck can build, and what it costs out of a Build Phase's credits. */
export type Blueprint = Readonly<{ structure: string; cost: number }>

/**
 * One Nexus power in a deck's pool. Its effect is a plain number of credits for now — the placeholder draft
 * the Build Phase has always dealt — until the Nexus draft step gives powers their real effect kinds
 * (commander-armies.md, what a Nexus power does).
 */
export type NexusPowerCard = Readonly<{ id: string; name: string; description: string; bonusAllotment: number }>

/** A Commander's deck. */
export type CommanderArmy = Readonly<{
  id: string
  /** The faction whose pools it draws from. */
  faction: string
  /** Her unit: the persistent `@` (a content definition with `commander: true`). */
  commander: string
  /** The credits a Build Phase starts with. */
  allotment: number
  /** What she can build, in menu order: the construct menu's digits follow this order. */
  blueprints: readonly Blueprint[]
  /** Her Nexus power pool, which a Build Phase deals from. */
  nexusPowers: readonly NexusPowerCard[]
}>

/**
 * What a mission makes of the deck it plays. Each part it names replaces the deck's own; a part it leaves out
 * is the deck's. In the lists, an id picks the deck's own entry (a level unlocking part of the deck) and a full
 * entry is the level's own (a level overriding it: another cost, a card the deck does not hold).
 */
export type DeckOverride = Readonly<{
  allotment?: number
  /** By structure id (the deck's own entry), or a whole blueprint. */
  blueprints?: readonly (string | Blueprint)[]
  /** By power id (the deck's own entry), or a whole power. */
  nexusPowers?: readonly (string | NexusPowerCard)[]
}>

/**
 * Commander Edda Vasse's deck: the three buildings and the two Nexus powers the Build Phase has offered since
 * it was built, now hers.
 */
export const VASSE_ARMY: CommanderArmy = {
  id: "army.citizen.vasse",
  faction: "citizen",
  commander: "unit.citizen.vasse",
  // A few things and not everything: the three buildings cost 85, and a second Barracks takes a plan past 100.
  allotment: 100,
  // Three footprints (3x2, 2x2, 1x1), so placement exercises three anchor calculations and three ways to
  // straddle a rock. Round numbers, not balance: real costs wait for the content-iteration milestone.
  blueprints: [
    { structure: "structure.citizen.barracks", cost: 40 },
    { structure: "structure.bench.hatchery", cost: 30 },
    { structure: "structure.bench.beamturret", cost: 15 },
  ],
  nexusPowers: [
    // Each description fits the 28 glyphs a panel row has at the 80-column floor.
    { id: "power.citizen.reserve-fund", name: "Reserve Fund", description: "Adds 30 resource to spend.", bonusAllotment: 30 },
    // 2000, not a balanced number (the owner's choice): enough to place buildings freely while playtesting
    // placement. Placeholder content, like the whole pool.
    { id: "power.citizen.war-chest", name: "War Chest", description: "Adds 2000 resource to spend.", bonusAllotment: 2000 },
  ],
}

/** Every deck a mode may offer, in the order a picker lists them. Vasse is the only Commander built. */
export const COMMANDER_ARMIES: readonly CommanderArmy[] = [VASSE_ARMY]

/** A deck by id, or `undefined`. */
export function armyById(id: string): CommanderArmy | undefined {
  return COMMANDER_ARMIES.find((army) => army.id === id)
}

/** The deck a battle is played with: the army's own, with a mission's override applied. Assumes both are valid
 *  (`deckProblems`); an id the deck does not hold is skipped. */
export function deckOf(army: CommanderArmy, override: DeckOverride = {}): CommanderArmy {
  const blueprints =
    override.blueprints === undefined
      ? army.blueprints
      : override.blueprints.flatMap((entry) => (typeof entry === "string" ? army.blueprints.filter((own) => own.structure === entry) : [entry]))
  const nexusPowers =
    override.nexusPowers === undefined
      ? army.nexusPowers
      : override.nexusPowers.flatMap((entry) => (typeof entry === "string" ? army.nexusPowers.filter((own) => own.id === entry) : [entry]))
  return { ...army, allotment: override.allotment ?? army.allotment, blueprints, nexusPowers }
}

const isWholeNumber = (value: number): boolean => Number.isInteger(value) && value >= 0

/**
 * Every problem with a deck, or with a mission's override of it, against the content it names — by name, all
 * at once, as a mission's own validation reports. An empty list is a deck a battle can be played with.
 */
export function deckProblems(army: CommanderArmy, registry: ContentRegistry, override: DeckOverride = {}): string[] {
  const problems: string[] = []
  const where = `deck "${army.id}"`
  if (!registry.has(army.commander)) problems.push(`${where} names the unknown Commander "${army.commander}"`)
  else if (registry.get(army.commander).commander !== true) problems.push(`${where} names "${army.commander}" as its Commander, which is not one`)

  const checkBlueprint = (blueprint: Blueprint, place: string): void => {
    if (!registry.has(blueprint.structure)) problems.push(`${place} names the unknown building "${blueprint.structure}"`)
    else if (registry.get(blueprint.structure).layer !== "obstacles") problems.push(`${place} names "${blueprint.structure}", which is not a building`)
    if (!isWholeNumber(blueprint.cost)) problems.push(`${place} gives "${blueprint.structure}" the cost ${blueprint.cost}; a cost is a whole number`)
  }
  const checkPower = (power: NexusPowerCard, place: string): void => {
    if (power.id.trim() === "") problems.push(`${place} has a Nexus power with no id`)
    if (power.name.trim() === "" || power.description.trim() === "") problems.push(`${place}'s Nexus power "${power.id}" needs a name and a description`)
    if (!isWholeNumber(power.bonusAllotment)) problems.push(`${place}'s Nexus power "${power.id}" adds ${power.bonusAllotment}; credits are a whole number`)
  }
  const unique = (ids: readonly string[], what: string, place: string): void => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) problems.push(`${place} lists the ${what} "${id}" twice`)
      seen.add(id)
    }
  }

  if (!isWholeNumber(army.allotment)) problems.push(`${where} starts with ${army.allotment} credits; credits are a whole number`)
  army.blueprints.forEach((blueprint) => checkBlueprint(blueprint, where))
  army.nexusPowers.forEach((power) => checkPower(power, where))
  unique(army.blueprints.map((blueprint) => blueprint.structure), "building", where)
  unique(army.nexusPowers.map((power) => power.id), "Nexus power", where)

  const over = `the override of ${where}`
  if (override.allotment !== undefined && !isWholeNumber(override.allotment)) {
    problems.push(`${over} starts with ${override.allotment} credits; credits are a whole number`)
  }
  for (const entry of override.blueprints ?? []) {
    if (typeof entry !== "string") checkBlueprint(entry, over)
    else if (!army.blueprints.some((own) => own.structure === entry)) problems.push(`${over} unlocks "${entry}", which the deck does not hold`)
  }
  for (const entry of override.nexusPowers ?? []) {
    if (typeof entry !== "string") checkPower(entry, over)
    else if (!army.nexusPowers.some((own) => own.id === entry)) problems.push(`${over} unlocks the Nexus power "${entry}", which the deck does not hold`)
  }
  unique((override.blueprints ?? []).map((entry) => (typeof entry === "string" ? entry : entry.structure)), "building", over)
  unique((override.nexusPowers ?? []).map((entry) => (typeof entry === "string" ? entry : entry.id)), "Nexus power", over)
  return problems
}
