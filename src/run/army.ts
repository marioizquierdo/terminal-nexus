// A run's army (docs/game-design/runs.md, the army): what a Commander starts a run with, and what is added to it and
// taken from it between battles. It is a roster (`Roster`, `src/duel/types.ts`): the building cards on the build menu, the
// Nexus powers in the pool the Nexus Pulse deals from, and the Doctrines kept from the first round of every battle. A
// battle plays on it by the duel's own rules, with everything the army could field but does not left out.

import { MAX_TIER } from "../armies/curve.ts"
import type { BuildingCard, PowerCard, Rarity, Role } from "../armies/index.ts"
import { addsOf } from "../armies/index.ts"
import { cardTextFor } from "../content/cards.ts"
import type { Roster } from "../duel/index.ts"
import { duelArmy } from "../duel/index.ts"

/** The three families of card a run deals (runs.md): a **structure** joins the build menu; a **Nexus power** joins the
 *  pool the Nexus Pulse deals from; a **Doctrine** is a standing order, kept from round one of every battle. */
export const CARD_KINDS = ["structure", "power", "doctrine"] as const
export type CardKind = (typeof CARD_KINDS)[number]

/** A card a run can offer, hold or remove: what it is called and does in the words a player reads, what a draft deals it
 *  by (rarity, role, and the earliest tier of the run it may come in), and the family it is of. */
export type RunCard = Readonly<{
  kind: CardKind
  /** Its card id in its army file: a building's or a power's. Unique within its kind. */
  id: string
  name: string
  /** One plain line on what it does. */
  line: string
  rarity: Rarity
  role: Role
  tier: number
}>

/** A card's key, unique across the families: `structure:turret`. What a draft and a summary name a card by. */
export const keyOf = (card: Pick<RunCard, "kind" | "id">): string => `${card.kind}:${card.id}`

/** What a family is called in a player's words. */
export const KIND_WORDS: Readonly<Record<CardKind, string>> = { structure: "Structure", power: "Nexus power", doctrine: "Doctrine" }

function structureCard(card: BuildingCard): RunCard | null {
  if (card.rarity === undefined || card.role === undefined) return null
  const text = cardTextFor(card.structure)
  return { kind: "structure", id: card.id, name: text?.title ?? card.id, line: text?.subtitle ?? "", rarity: card.rarity, role: card.role, tier: card.tier ?? 1 }
}

function powerCard(card: PowerCard): RunCard {
  return { kind: card.doctrine === true ? "doctrine" : "power", id: card.id, name: card.name, line: card.description, rarity: card.rarity, role: card.role, tier: Math.min(card.tier ?? 1, MAX_TIER) }
}

/** The cards of a Commander's own army a run can deal: its structures that carry a rarity and a role, its Nexus powers
 *  and its Doctrines — not the cards offered beside every hand, nor another Nexus's, nor a building only a power adds. */
export function cardsOf(commander: string): RunCard[] {
  const army = duelArmy(commander)
  const added = new Set(army.powers.flatMap((card) => addsOf(card.effect) ?? []))
  return [
    ...army.buildings.filter((card) => !added.has(card.id)).flatMap((card) => structureCard(card) ?? []),
    ...army.powers.filter((card) => card.always !== true && card.from === undefined).map(powerCard),
  ]
}

/** The army a Commander's run starts with: what her army file lists (`run`), or the whole of her army when it lists
 *  none — every building but the ones only a power adds, every Nexus power the Pulse deals, no Doctrine. */
export function startingRoster(commander: string): Roster {
  const army = duelArmy(commander)
  const start = army.commander.run
  if (start !== undefined) return { buildings: start.buildings, powers: start.powers, doctrines: [] }
  const added = new Set(army.powers.flatMap((card) => addsOf(card.effect) ?? []))
  return {
    buildings: army.buildings.filter((card) => !added.has(card.id)).map((card) => card.id),
    powers: army.powers.filter((card) => card.always !== true && card.doctrine !== true && card.from === undefined).map((card) => card.id),
    doctrines: [],
  }
}

/** A card of a Commander's army by its key (`structure:turret`). */
export function cardByKey(commander: string, key: string): RunCard | undefined {
  return cardsOf(commander).find((card) => keyOf(card) === key)
}

/** The tier a run's draft may deal in the battle it prepares: tier *t* from battle 2*t* − 1 (game-modes.md), at most the
 *  tree's last. */
export const tierFor = (battle: number): number => Math.max(1, Math.min(MAX_TIER, Math.floor((battle + 1) / 2)))

const ownedKeys = (roster: Roster): Set<string> =>
  new Set([...roster.buildings.map((id) => `structure:${id}`), ...roster.powers.map((id) => `power:${id}`), ...roster.doctrines.map((id) => `doctrine:${id}`)])

/** The cards the army holds, in the order it holds them: structures, then Nexus powers, then Doctrines. */
export function ownedCards(commander: string, roster: Roster): RunCard[] {
  const all = new Map(cardsOf(commander).map((card) => [keyOf(card), card]))
  const keys = [...roster.buildings.map((id) => `structure:${id}`), ...roster.powers.map((id) => `power:${id}`), ...roster.doctrines.map((id) => `doctrine:${id}`)]
  return keys.flatMap((key) => all.get(key) ?? [])
}

/**
 * The cards a draft may deal an army for the battle it prepares: those it does not hold, of a tier the run has reached
 * (`tierFor`), whose requirements it meets — a structure's tech tree needs, a power's `requires`, and the power it
 * upgrades kept.
 */
export function offerable(commander: string, roster: Roster, battle: number): RunCard[] {
  const army = duelArmy(commander)
  const held = ownedKeys(roster)
  const buildings = new Set(roster.buildings)
  const powers = new Set([...roster.powers, ...roster.doctrines])
  const structures = new Map(army.buildings.map((card) => [card.id, card]))
  const powerCards = new Map(army.powers.map((card) => [card.id, card]))
  return cardsOf(commander).filter((card) => {
    if (held.has(keyOf(card)) || card.tier > tierFor(battle)) return false
    if (card.kind === "structure") return (structures.get(card.id)?.requires ?? []).every((id) => buildings.has(id))
    const power = powerCards.get(card.id)
    if (power === undefined) return false
    if (power.upgrades !== undefined && !powers.has(power.upgrades)) return false
    return (power.requires?.powers ?? []).every((id) => powers.has(id)) && (power.requires?.buildings ?? []).every((id) => buildings.has(id))
  })
}

/**
 * The cards the army may remove: any it holds but a structure another structure it holds requires (the Garrison needs
 * the Barracks), the last structure that makes units, and a power another power it holds upgrades.
 */
export function removable(commander: string, roster: Roster): RunCard[] {
  const army = duelArmy(commander)
  const structures = new Map(army.buildings.map((card) => [card.id, card]))
  const powerCards = new Map(army.powers.map((card) => [card.id, card]))
  const needed = new Set<string>()
  for (const id of roster.buildings) for (const required of structures.get(id)?.requires ?? []) needed.add(`structure:${required}`)
  for (const id of [...roster.powers, ...roster.doctrines]) {
    const upgrades = powerCards.get(id)?.upgrades
    if (upgrades !== undefined) needed.add(`power:${upgrades}`).add(`doctrine:${upgrades}`)
  }
  const makers = roster.buildings.filter((id) => structures.get(id)?.spawns !== undefined)
  return ownedCards(commander, roster).filter((card) => {
    if (needed.has(keyOf(card))) return false
    return !(card.kind === "structure" && makers.length === 1 && makers[0] === card.id)
  })
}

/** The army with a card taken in. A structure joins the end of the build menu, so no hotkey moves. */
export function withCard(roster: Roster, card: Pick<RunCard, "kind" | "id">): Roster {
  switch (card.kind) {
    case "structure":
      return { ...roster, buildings: [...roster.buildings, card.id] }
    case "power":
      return { ...roster, powers: [...roster.powers, card.id] }
    case "doctrine":
      return { ...roster, doctrines: [...roster.doctrines, card.id] }
  }
}

/** The army without a card. */
export function withoutCard(roster: Roster, card: Pick<RunCard, "kind" | "id">): Roster {
  switch (card.kind) {
    case "structure":
      return { ...roster, buildings: roster.buildings.filter((id) => id !== card.id) }
    case "power":
      return { ...roster, powers: roster.powers.filter((id) => id !== card.id) }
    case "doctrine":
      return { ...roster, doctrines: roster.doctrines.filter((id) => id !== card.id) }
  }
}
