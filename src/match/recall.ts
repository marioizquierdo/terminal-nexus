// Recall — the end-of-Pulse rule in pulse.md: "At Pulse end survivors regroup near home producers. Orphans are
// adopted by the nearest compatible producer or regroup near the Grid Nexus. Production cooldowns
// reset to a full interval."
//
// It was written into the design early and answered as "already runs", but nothing implemented it
// until the Pulse start/end/Recall pull request (docs/history/reports/2026-09-29-pulse-start-end-recall.md): `MatchState` has no link from a unit to the producer that made it, so there was
// nothing for a regroup to read. It is built here as a pure function of the state a Pulse ended in,
// **beside the kernel's tick and never inside it** — `stepTick` does not call it, so no Pulse's
// hashes move — and it is what both the walk home on screen (the moves) and the next Build Phase
// (the state) read, so the two can never disagree about where a survivor ended up.
//
// The rule, in the terms the state can express today:
//
// - a **survivor** is anything alive on `workers`, `units` or `air`; structures stay where they are;
// - its **home** is the nearest structure of its own side that makes units like it (a building whose
//   production recipe trains its content id, or whose `spawn` makes it), else
//   the side's Grid Nexus (the "orphan" rule), else nothing: a side with neither has nowhere to go and
//   its survivors stay where they stand. Nearest by the Grid's own distance (`footprintDistance`: a row counts
//   two columns), so the home it walks to is the one it can reach soonest;
// - it is set down on the free tile nearest that building, on the side it is nearest to, under its own
//   collision mask, one survivor at a time in ordinal order — so the answer never depends on anything
//   but the state, the registry and the order of the entities;
// - every entity's transient fields go back to what a fresh one starts with (`freshEntityFields`), which
//   is what starts a producer's waves afresh (its first one its recipe's delay away, none come, nothing
//   owed) and clears a shot in progress; and
// - the Pulse's own bookkeeping is cleared: the clock is zero, there is no outcome, no tile is still
//   cooling from a death. The gameplay stream carries on where it stopped.

import type { ContentDef, ContentRegistry } from "../content/index.ts"
import { freshEntityFields } from "../content/index.ts"
import { footprintDistance, nearestFootprintTile } from "../grid/coords.ts"
import { OccupancyIndex, maskFrom } from "../grid/occupancy.ts"
import type { Coord } from "../grid/types.ts"
import { ENTITY_LAYERS } from "../grid/types.ts"
import type { EntityState, MatchState } from "../state/types.ts"
import { centreTile, nearestFit } from "./placement.ts"
import type { RecallMove, RecallResult } from "./types.ts"

/** How far from its home a survivor may be set down before Recall gives the search up and widens it, by the
 *  Grid's own distance (`nearestFit`): 8 rows up and down, 16 columns across. */
const HOME_RADIUS = 16
/** The wider search a survivor whose own tile was taken falls back on, around where it stands. */
const FALLBACK_RADIUS = 80

type Home = Readonly<{ entity: EntityState; definition: ContentDef; kind: "producer" | "nexus" }>

/** The nearest of `candidates` to `survivor`, by the distance range is measured in (`footprintDistance`); ties
 *  to the lower ordinal. `null` when there are none. */
function nearest(survivor: EntityState, survivorDefinition: ContentDef, candidates: readonly Home[]): Home | null {
  let best: Home | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const distance = footprintDistance(survivor.anchor, survivorDefinition.footprint, candidate.entity.anchor, candidate.definition.footprint)
    // Candidates arrive in ordinal order, so a strict comparison keeps the lower ordinal on a tie.
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

export function recall(state: MatchState, registry: ContentRegistry): RecallResult {
  const definitions = new Map<number, ContentDef>()
  for (const entity of state.entities) definitions.set(entity.ordinal, registry.get(entity.contentId))
  const definitionOf = (entity: EntityState): ContentDef => definitions.get(entity.ordinal) as ContentDef

  const structures = state.entities.filter((entity) => definitionOf(entity).layer === "obstacles")
  const survivors = state.entities.filter((entity) => definitionOf(entity).layer !== "obstacles")

  // The room Recall has to work with: every structure where it stands, and each survivor as it is set
  // down. A survivor that is going somewhere is not in it at its old place — it is about to leave it.
  const index = new OccupancyIndex(state.grid)
  for (const structure of structures) {
    const definition = definitionOf(structure)
    index.add(definition.layer, structure.ordinal, structure.anchor, definition.footprint)
  }

  // Who goes where, before anyone moves: a survivor's home is decided from the state the Pulse ended in.
  const homeOf = (survivor: EntityState): Home | null => {
    const definition = definitionOf(survivor)
    const mates = structures.filter((structure) => structure.player === survivor.player)
    const producers: Home[] = mates
      .filter((structure) => {
        const producer = definitionOf(structure)
        return producer.production?.output === survivor.contentId || producer.spawn?.contentId === survivor.contentId
      })
      .map((entity) => ({ entity, definition: definitionOf(entity), kind: "producer" as const }))
    const nexuses: Home[] = mates
      .filter((structure) => definitionOf(structure).nexus === true)
      .map((entity) => ({ entity, definition: definitionOf(entity), kind: "nexus" as const }))
    return nearest(survivor, definition, producers) ?? nearest(survivor, definition, nexuses)
  }
  const homes = new Map<number, Home | null>(survivors.map((survivor) => [survivor.ordinal, homeOf(survivor)]))

  // A survivor with no home to go to stays exactly where it stands — and is set down first, so the
  // ones that do move make room for it rather than the other way round.
  const anchors = new Map<number, Coord>()
  for (const survivor of survivors) {
    if (homes.get(survivor.ordinal) !== null) continue
    const definition = definitionOf(survivor)
    index.add(definition.layer, survivor.ordinal, survivor.anchor, definition.footprint)
    anchors.set(survivor.ordinal, survivor.anchor)
  }

  for (const survivor of survivors) {
    const home = homes.get(survivor.ordinal) ?? null
    if (home === null) continue
    const definition = definitionOf(survivor)
    // Nobody shares a tile after Recall, on any layer: the screen draws one glyph a tile, and a survivor
    // hidden under another is a survivor that did not visibly come home.
    const mask = maskFrom(index, {
      layers: ENTITY_LAYERS,
      terrain: definition.layer === "air" ? "ignore" : "impassable",
    })
    const here = centreTile(survivor.anchor, definition.footprint)
    // The tile of the home building nearest the survivor is what it comes back *to*: it arrives on the
    // side it was already on, not on the far side of the building.
    const target = nearestFootprintTile(here, home.entity.anchor, home.definition.footprint)
    // Nowhere free near home: take the nearest free tile to where it stands rather than overlap anyone.
    const to =
      nearestFit(mask, definition.footprint, target, HOME_RADIUS, here) ??
      nearestFit(mask, definition.footprint, here, FALLBACK_RADIUS)
    if (to === null) throw new Error(`recall: no free tile for ${survivor.id} within ${FALLBACK_RADIUS} tiles of it`)
    index.add(definition.layer, survivor.ordinal, to, definition.footprint)
    anchors.set(survivor.ordinal, to)
  }

  const moves: RecallMove[] = survivors.map((survivor) => ({
    ordinal: survivor.ordinal,
    player: survivor.player,
    contentId: survivor.contentId,
    from: survivor.anchor,
    to: anchors.get(survivor.ordinal) as Coord,
    home: homes.get(survivor.ordinal)?.kind ?? "none",
  }))

  const entities: EntityState[] = state.entities.map((entity) => ({
    ...entity,
    anchor: anchors.get(entity.ordinal) ?? entity.anchor,
    ...freshEntityFields(definitionOf(entity)),
  }))
  return {
    state: { ...state, tick: 0, outcome: null, vacatedTiles: [], entities },
    moves,
  }
}
