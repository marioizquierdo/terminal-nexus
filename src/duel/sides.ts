// A duel side's army, as the round reads it: its Commander, what it can build and be dealt (its army's arsenal, every
// card in its sight), its faction's Nexus, and its loadout — the content its battles run on and its build menu, with
// every power it has kept applied in order (`applyEffect`, `src/armies/effects.ts`, the same function the campaign
// keeps a power with).
//
// A loadout is never stored: it is worked out again from the side's kept powers each time, so a saved duel is plain
// data, and two sides of the same faction never share a change one of them made — each side's content is its own
// (`PulseContext.sides`).

import type { Armies, BuildingCard, Commander, Loadout, PowerCard } from "../armies/index.ts"
import { ARMIES, addsOf, applyEffect } from "../armies/index.ts"
import { constructItem } from "../build/catalog.ts"
import type { ConstructItem } from "../build/types.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { Roster, SideState } from "./types.ts"

/** A side's army: its Commander, the building cards and Nexus powers it can be offered, and its faction's Nexus. */
export type DuelArmy = Readonly<{
  commander: Commander
  buildings: readonly BuildingCard[]
  /** The powers a hand is dealt from: its arsenal's, but the ones offered beside every hand (War Chest, the owner's
   *  testing tool, has no place in a duel). */
  powers: readonly PowerCard[]
  /** The content id of its Grid Nexus: the one her faction brings. */
  nexus: string
}>

/** The army of the Commander `id`, from the loaded armies. Throws for a Commander no army has, or one whose army sees
 *  no Nexus. */
export function duelArmy(id: string, armies: Armies = ARMIES): DuelArmy {
  const commander = armies.commanders.find((candidate) => candidate.id === id)
  if (commander === undefined) throw new Error(`no army has the Commander "${id}" (${armies.commanders.map((candidate) => `"${candidate.id}"`).join(", ")})`)
  const arsenal = armies.arsenals[commander.army]
  if (arsenal === undefined) throw new Error(`the Commander "${id}" has no army to field`)
  // Her faction's Nexus: the one the army she names as her faction brings.
  const faction = armies.armies.find((army) => army.id === commander.faction)
  const nexus = (faction?.content ?? []).flatMap((entry) => (typeof entry === "string" ? entry : entry.id)).find((contentId) => armies.registry.has(contentId) && armies.registry.get(contentId).nexus === true)
  if (nexus === undefined) throw new Error(`the Commander "${id}"'s army sees no Grid Nexus to build from`)
  return { commander, buildings: arsenal.buildings, powers: arsenal.powers.filter((card) => card.always !== true), nexus }
}

/**
 * An army cut down to a roster: only the building cards the roster lists, and the buildings its Nexus powers add; only
 * the Nexus powers in the pool and the Doctrines it keeps (a Doctrine is looked up to be kept, never dealt). What was
 * left out cannot be built, dealt or kept.
 */
export function restrictedTo(army: DuelArmy, roster: Roster | undefined): DuelArmy {
  if (roster === undefined) return army
  const powers = army.powers.filter((card) => roster.powers.includes(card.id) || roster.doctrines.includes(card.id))
  const added = new Set(powers.flatMap((card) => addsOf(card.effect) ?? []))
  const buildings = army.buildings.filter((card) => roster.buildings.includes(card.id) || added.has(card.id))
  return { ...army, buildings, powers }
}

/** A side's army as the duel plays it: its Commander's, cut down to its roster when it has one. */
export function armyOf(state: Readonly<{ sides: Readonly<Record<"A" | "B", Pick<SideState, "commander" | "roster">>> }>, side: "A" | "B"): DuelArmy {
  return restrictedTo(duelArmy(state.sides[side].commander), state.sides[side].roster)
}

/** The build menu an army starts with: every building card it can be offered but the ones only a power adds, tier by
 *  tier, each tier in the order the armies list its cards. */
export function startingMenu(army: DuelArmy): ConstructItem[] {
  const added = new Set(army.powers.flatMap((card) => addsOf(card.effect) ?? []))
  const offered = army.buildings.filter((card) => !added.has(card.id))
  const ordered = [...offered].sort((a, b) => (a.tier ?? 1) - (b.tier ?? 1))
  return ordered.map((card, index) => constructItem(card, index, army.buildings))
}

/** What a side fields this round: its content and build menu with every kept power applied, in the order kept. */
export function loadoutOf(army: DuelArmy, side: Pick<SideState, "kept">, armies: Armies = ARMIES): Loadout<ConstructItem> {
  let loadout: Loadout<ConstructItem> = {
    registry: armies.registry,
    catalog: startingMenu(army),
    callups: [],
    cards: army.buildings,
    row: (card, index) => constructItem(card, index, army.buildings),
  }
  for (const id of side.kept) {
    const card = army.powers.find((candidate) => candidate.id === id)
    if (card !== undefined) loadout = applyEffect(loadout, card.effect)
  }
  // Units a power called up are called up for the round it is picked in: none carry over.
  return { ...loadout, callups: [] }
}

/** A power of the army by id. */
export function powerOf(army: DuelArmy, id: string): PowerCard | undefined {
  return army.powers.find((card) => card.id === id)
}

/** The content a side's battles run on, by its loadout: what the round hands the kernel for that side. */
export type SideContent = Readonly<{ registry: ContentRegistry; catalog: readonly ConstructItem[] }>
