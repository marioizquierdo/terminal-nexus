// The ability kinds the game ships, and what the rest of the game asks of an ability without knowing its kind: its
// problems when content is loaded, the line its card says, how far it reaches. What each kind is and when its hooks
// run is `types.ts`; the kernel's half — calling the hooks inside a tick — is `src/pulse/abilities.ts`.
//
// A new kind is a module beside these and one line in `ABILITIES` (docs/system-design/army-authoring.md,
// "Abilities"). Nothing else branches on a kind.

import type { Say } from "../content/shape.ts"
import type { AbilityUse, ContentDef } from "../content/types.ts"
import { AURA } from "./aura.ts"
import type { Aura } from "./aura.ts"
import { BOUNTY } from "./bounty.ts"
import { LOADED_DICE } from "./loaded-dice.ts"
import type { AbilityKind, AbilityTable, Pronouns } from "./types.ts"

export type { AbilityKind, AbilityTable, AbilityView, AbilityWorld, Body, DamageOffer, Pronouns, Side } from "./types.ts"
export type { Aura } from "./aura.ts"
export { boostedAmount, guardedAmount } from "./aura.ts"

/** Every ability kind the game ships, by the `kind` data names it with. */
export const ABILITIES: AbilityTable = Object.fromEntries([AURA, BOUNTY, LOADED_DICE].map((kind) => [kind.kind, kind as unknown as AbilityKind]))

/** What is wrong with an ability as content names it: a kind the table does not have, or numbers its kind refuses —
 *  each said with `at`, the path to it. */
export function abilityProblems(use: AbilityUse, at: string, table: AbilityTable = ABILITIES): string[] {
  const kind = table[use.kind]
  if (kind === undefined) return [`${at} is of the kind "${use.kind}", which is not an ability the game has (${Object.keys(table).map((name) => `"${name}"`).join(", ")})`]
  const problems: string[] = []
  const say: Say = (problem) => problems.push(problem)
  kind.params.check(use, at, say)
  return problems
}

/** What each of a unit's abilities says on its card, in the order its content lists them. */
export function abilityLines(definition: ContentDef, pronouns: Pronouns, table: AbilityTable = ABILITIES): string[] {
  return (definition.abilities ?? []).flatMap((use) => {
    const kind = table[use.kind]
    return kind === undefined ? [] : [kind.describe(use, pronouns)]
  })
}

/** The furthest any of a unit's abilities reaches round it, for the view to draw; `null` when none reaches anywhere. */
export function abilityReach(definition: ContentDef, table: AbilityTable = ABILITIES): number | null {
  let furthest: number | null = null
  for (const use of definition.abilities ?? []) {
    const reach = table[use.kind]?.reach?.(use) ?? null
    if (reach !== null && (furthest === null || reach > furthest)) furthest = reach
  }
  return furthest
}

/** A unit's aura, when it has one: what a Nexus power that widens auras changes, and what a card's numbers show. */
export function auraOf(definition: ContentDef): Aura | null {
  const use = (definition.abilities ?? []).find((ability) => ability.kind === "aura")
  return use === undefined ? null : (use as unknown as Aura)
}
