// A building's actions (commander-armies.md, "What changes between rounds, and how"): what a player can do with a
// building of theirs in a Build Phase, selected in Explore Map — never with a unit, never during a Battle Round. Each is
// declared with the building on its card in its army file (`BuildingActionCard`), of one of three kinds:
//
// - an **upgrade**, bought with credits and kept by that one building for the rest of the match;
// - a **mode**, one of the building's named states, switched between rounds and kept until switched again;
// - an **order**, for the coming Battle Round only: Hold production.
//
// What an upgrade or a mode changes is written as a Nexus power's effect naming the building (`EFFECTS`, the kinds
// that can `refit` one building), and it is that building's alone: a building carrying any is given a content id of its
// own, its base's and what it carries (`fittedId`, `src/content/fitted.ts`), which its side's registry resolves here
// (`fitterOf`). So the kernel resolves a battle with an upgraded Barracks as it resolves any other, and a Barracks
// beside it is untouched. An order changes nothing of the building's content: what it does is the opening's, for one
// round (`ORDERS`).
//
// Pure: no clock, no randomness.

import type { ContentDef, Fitter } from "../content/index.ts"
import { effectParts } from "./effects.ts"
import type { BuildingActionCard, BuildingCard } from "./types.ts"

/**
 * **The orders the game has**, by the name a card's order gives (`BuildingActionCard.order`): its key, the same on
 * every building that has it, and whether it needs a building that makes units. What each does is the opening's for
 * the round it is given (`held`, `src/match/opening.ts`): an order never changes a building's content.
 *
 * - `hold`: **Hold production** — the building sends no wave this round's Battle Round, and trains again the round
 *   after (the owner, 2026-10-16: "Pause production, that stops producing units for the next round"). `z`, not `h`,
 *   which is an arrow (h j k l).
 */
export const ORDERS: Readonly<Record<string, OrderKind>> = {
  hold: {
    hotkey: "z",
    needsSpawns: true,
    undoLabel: "Resume production",
    given: (name) => `${name} holds its wave this round: it trains again the round after.`,
    undone: (name) => `${name} trains its wave this round again.`,
  },
}

/** An order the game has: its key, whether it needs a building that makes units, what its row says once given (to
 *  take it back), and what the bottom line says when it is given and taken back, of the building by name. */
export type OrderKind = Readonly<{
  hotkey: string
  needsSpawns: boolean
  undoLabel: string
  given: (name: string) => string
  undone: (name: string) => string
}>

/**
 * The keys a building's upgrades and modes are under, by their place among them on its card: the first is `c`, the
 * second `v`. Left-hand letters no other Build Phase key uses (ui-patterns.md, "a key means one thing per screen"), the
 * same on every building, so a key never moves while a card is read. A card has at most as many upgrades and modes.
 */
export const ACTION_KEYS: readonly string[] = ["c", "v", "b", "f"]

/** How many glyphs an action's label may have: a card's row at the 80-column floor, after its key and before what its
 *  value says (`on`, `undo`, a price). */
export const ACTION_LABEL_MAX = 18

/** The set of modes a mode belongs to. */
export const modeSet = (action: BuildingActionCard): string => action.set ?? "mode"

/** The key an action is under on its building's card: its order's own key, or its place among the card's upgrades and
 *  modes. `undefined` for one past the keys there are (the loader refuses a card with that many). */
export function actionKey(actions: readonly BuildingActionCard[], action: BuildingActionCard): string | undefined {
  if (action.kind === "order") return ORDERS[action.order ?? ""]?.hotkey
  const own = actions.filter((each) => each.kind !== "order")
  return ACTION_KEYS[own.indexOf(action)]
}

/** The mode of each set a building of these actions is in as it is written: the first of each set its card lists. */
export function startingModes(actions: readonly BuildingActionCard[]): ReadonlyMap<string, string> {
  const first = new Map<string, string>()
  for (const action of actions) if (action.kind === "mode" && !first.has(modeSet(action))) first.set(modeSet(action), action.id)
  return first
}

/** The mode a building carrying `fittings` is in, for `set`: the one it carries, or the set's first. */
export function modeIn(actions: readonly BuildingActionCard[], fittings: readonly string[], set: string): string | undefined {
  const carried = actions.find((action) => action.kind === "mode" && modeSet(action) === set && fittings.includes(action.id))
  return carried?.id ?? startingModes(actions).get(set)
}

/**
 * What a building carries once `action` is taken on it, from what it carried before, in its card's order — the
 * fittings of its content id (`fittedId`): an upgrade added; a mode put in place of its set's other, and none at all for
 * the set's first, which is the building as written. An order carries nothing.
 */
export function fittingsWith(actions: readonly BuildingActionCard[], fittings: readonly string[], action: BuildingActionCard): string[] {
  if (action.kind === "order") return [...fittings]
  const others = action.kind === "mode" ? actions.filter((each) => each.kind === "mode" && modeSet(each) === modeSet(action)).map((each) => each.id) : []
  const kept = new Set(fittings.filter((id) => !others.includes(id)))
  if (!(action.kind === "mode" && startingModes(actions).get(modeSet(action)) === action.id)) kept.add(action.id)
  return actions.filter((each) => kept.has(each.id)).map((each) => each.id)
}

/**
 * **What a building carrying these is**: its definition with each upgrade's and mode's effects applied, in its card's
 * order, by the effect's own `refit` — or `null` when they are not ones it can carry: an action its card does not have,
 * an order, a set's first mode (which is the building as written), two of one set, one twice, or out of its card's
 * order. One id for one building, whatever order it took them in.
 */
export function fitted(actions: readonly BuildingActionCard[], base: ContentDef, fittings: readonly string[]): ContentDef | null {
  const starting = new Set(startingModes(actions).values())
  const sets = new Set<string>()
  let last = -1
  let definition = base
  for (const id of fittings) {
    const at = actions.findIndex((action) => action.id === id)
    const action = actions[at]
    if (action === undefined || at <= last || action.kind === "order" || starting.has(id)) return null
    if (action.kind === "mode") {
      if (sets.has(modeSet(action))) return null
      sets.add(modeSet(action))
    }
    last = at
    for (const effect of action.effects ?? []) {
      const { kind, params } = effectParts(effect)
      if (kind.refit === undefined) return null
      definition = kind.refit(definition, params)
    }
  }
  return definition
}

/** The fitter the game's registries resolve a building's own content by: each building's actions, from its card. One
 *  card declares a structure's actions (the loader refuses two). */
export function fitterOf(cards: readonly BuildingCard[]): Fitter {
  const byStructure = new Map<string, readonly BuildingActionCard[]>()
  for (const card of cards) if ((card.actions ?? []).length > 0 && !byStructure.has(card.structure)) byStructure.set(card.structure, card.actions ?? [])
  return (base, fittings) => {
    const actions = byStructure.get(base.id)
    return actions === undefined ? null : fitted(actions, base, fittings)
  }
}
