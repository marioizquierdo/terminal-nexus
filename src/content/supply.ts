// Supply (Commander Armies, the curve on the Grid; the owner, 2026-10-16: "go with your recommendation, supply cap",
// and "Supply should be controlled by another building"): how many units a side may field at once. A side's supply
// is what its standing structures give (`supplyProvided`); each of its units takes its `supplyCost` (1 when it says
// nothing, a Commander none). A building whose next unit would take its side past its supply keeps the unit owed
// and waits (`production.ts`): so once an army is full, a new unit comes only as an old one falls, and stronger units
// take the places of weaker ones rather than piling on them. Units a mission or a Nexus power sets down are not
// production and are never held back; they count once they stand.
//
// A side whose structures give no supply has no cap — every map and scenario from before supply resolves exactly as
// it did. Pure, and content's own arithmetic: the kernel holds production to it (`src/pulse/production.ts`) and the
// Build Phase reads the same numbers for its supply line (`src/view/build-menu.ts`).

import type { ContentDef } from "./types.ts"

/** The places a thing takes of its side's supply: a unit's `supplyCost`, 1 when it says nothing; none for anything
 *  that is not a unit. */
export function supplyCostOf(definition: ContentDef): number {
  if (definition.layer !== "units" && definition.layer !== "air" && definition.layer !== "workers") return 0
  return definition.supplyCost ?? 1
}

/** A side's supply: the places its things take, and how many its structures give (`null` when none gives any: no cap). */
export type Supply = Readonly<{ used: number; cap: number | null }>

/** The supply of the things one side fields. */
export function supplyOf(definitions: Iterable<ContentDef>): Supply {
  let used = 0
  let cap = 0
  for (const definition of definitions) {
    used += supplyCostOf(definition)
    cap += definition.supplyProvided ?? 0
  }
  return { used, cap: cap > 0 ? cap : null }
}

/** Whether a side at `supply` has room for a unit of `definition`. */
export function hasRoom(supply: Supply, definition: ContentDef): boolean {
  return supply.cap === null || supply.used + supplyCostOf(definition) <= supply.cap
}
