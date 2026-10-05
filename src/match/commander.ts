// The Commander between rounds — pulse.md: "On death it is absent for the rest of that round's Pulse and
// for one full round after it, then the Prime Nexus may replicate it again."
//
// **Beside the kernel's tick and never inside it**, like Recall. The kernel sees a Commander as a unit like
// any other: she fights, she dies, and a dead entity is gone from the state, so nothing in a Pulse brings
// her back and her death decides nothing (the victory check never reads the `commander` flag). What the
// state cannot hold is the memory that she fell, and when; that is an `Absence`, which the round loop
// carries from one round to the next beside the state (`src/cli/pulse-run.ts`, and the mission tests do the
// same). Two pure functions read and write it:
//
// - `fallen` reads a round's events for the Commanders that died in it: each is absent for the rest of
//   that Pulse (she is dead) and for the whole of the round after, and is due back at the start of the one
//   after that;
// - `restoreCommanders` runs where one round hands over to the next, after Recall: every Commander due back
//   by then is set down on the free tile nearest her side's Grid Nexus, a new entity at full health (the
//   Prime Nexus replicating its Symbol onto the Grid again), and stands there through the round's Build
//   Phase like any survivor. A side with no Grid Nexus standing has nowhere to restore her to, so her
//   absence goes on until it has one.
//
// Deterministic like the kernel: no clock, no randomness; the answer depends only on the state, the
// events, the registry and the round number.

import type { ContentRegistry } from "../content/index.ts"
import { createRegistry, freshEntityFields } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { OccupancyIndex, maskFrom } from "../grid/occupancy.ts"
import type { Coord } from "../grid/types.ts"
import { ENTITY_LAYERS } from "../grid/types.ts"
import type { EntityState, MatchState, PlayerId } from "../state/types.ts"
import { centreTile, nearestFit } from "./placement.ts"

/** How many whole rounds a fallen Commander sits out after the one she fell in (pulse.md: one). */
export const ROUNDS_ABSENT = 1

/** How far from her Grid Nexus a restored Commander may be set down. */
const RESTORE_RADIUS = 8

/** A Commander who fell and is not on the Grid: whose, which, when she fell, and the round she is due back
 *  at the start of. */
export type Absence = Readonly<{
  player: PlayerId
  contentId: string
  fellInRound: number
  returnsInRound: number
}>

/** A Commander the Nexus set down again as a round began, and where. */
export type Restoration = Readonly<{ player: PlayerId; contentId: string; ordinal: number; anchor: Coord }>

/** The Commanders that died in a round, from its events, in the order they fell: each due back at the start
 *  of the round after the one she sits out. */
export function fallen(events: readonly DomainEvent[], registry: ContentRegistry, round: number): Absence[] {
  const fell: Absence[] = []
  for (const event of events) {
    if (event.kind !== "entity.died" || registry.get(event.contentId).commander !== true) continue
    fell.push({ player: event.player, contentId: event.contentId, fellInRound: round, returnsInRound: round + 1 + ROUNDS_ABSENT })
  }
  return fell
}

/**
 * The state round `round` starts from: `state` (what the last round left, after Recall) with every
 * Commander whose absence is over set down beside her side's Grid Nexus, and the absences that go on.
 */
export function restoreCommanders(
  state: MatchState,
  absent: readonly Absence[],
  round: number,
  registry: ContentRegistry,
): Readonly<{ state: MatchState; absent: Absence[]; restored: Restoration[] }> {
  const due = absent.filter((absence) => absence.returnsInRound <= round)
  if (due.length === 0) return { state, absent: [...absent], restored: [] }

  // The room there is: everything standing, and each Commander as she is set down.
  const index = new OccupancyIndex(state.grid)
  for (const entity of state.entities) {
    const definition = registry.get(entity.contentId)
    index.add(definition.layer, entity.ordinal, entity.anchor, definition.footprint)
  }

  const born: EntityState[] = []
  const restored: Restoration[] = []
  const still: Absence[] = []
  let nextOrdinal = state.nextOrdinal
  for (const absence of absent) {
    if (absence.returnsInRound > round) {
      still.push(absence)
      continue
    }
    // Her side's Grid Nexus, the lowest ordinal if it has several: the Commander's anchor on the Grid.
    const nexus = state.entities.find((entity) => entity.player === absence.player && registry.get(entity.contentId).nexus === true)
    const definition = registry.get(absence.contentId)
    const mask = maskFrom(index, { layers: ENTITY_LAYERS, terrain: definition.layer === "air" ? "ignore" : "impassable" })
    const anchor =
      nexus === undefined
        ? null
        : nearestFit(mask, definition.footprint, centreTile(nexus.anchor, registry.get(nexus.contentId).footprint), RESTORE_RADIUS)
    if (anchor === null) {
      still.push(absence)
      continue
    }
    const ordinal = nextOrdinal
    nextOrdinal += 1
    born.push({
      ordinal,
      id: `${absence.player}:${definition.short}#${ordinal + 1}`,
      player: absence.player,
      contentId: absence.contentId,
      hp: definition.maxHp,
      anchor,
      facing: absence.player === "A" ? "e" : "w",
      ...freshEntityFields(definition),
    })
    index.add(definition.layer, ordinal, anchor, definition.footprint)
    restored.push({ player: absence.player, contentId: absence.contentId, ordinal, anchor })
  }
  return { state: { ...state, entities: [...state.entities, ...born], nextOrdinal }, absent: still, restored }
}

/**
 * `registry` with every aura letting through `100 - less` percent of a hit — what the Pulse reads while the
 * Experiment "By the Book" (Vasse's aura) is tuned — and, with `less` 0, no aura at all. The same registry,
 * untouched, when nothing in it has an aura.
 */
export function auraRegistry(registry: ContentRegistry, less: number): ContentRegistry {
  if (!Number.isInteger(less) || less < 0 || less >= 100) throw new Error(`an aura takes away 0 to 99 percent of a hit, received ${less}`)
  const ids = registry.ids()
  if (!ids.some((id) => registry.get(id).aura !== undefined)) return registry
  return createRegistry(
    ids.map((id) => {
      const definition = registry.get(id)
      if (definition.aura === undefined) return definition
      if (less === 0) {
        const { aura: _off, ...without } = definition
        return without
      }
      return { ...definition, aura: { ...definition.aura, damageTakenPercent: 100 - less } }
    }),
  )
}

/** `registry` with every Commander's health set to `health` — what the Pulse reads while the Experiment
 *  "Vasse's health" is tuned. The same registry, untouched, when nothing in it is a Commander. */
export function commanderRegistry(registry: ContentRegistry, health: number): ContentRegistry {
  if (!Number.isInteger(health) || health <= 0) throw new Error(`a Commander's health must be a positive integer, received ${health}`)
  const ids = registry.ids()
  if (!ids.some((id) => registry.get(id).commander === true)) return registry
  return createRegistry(
    ids.map((id) => {
      const definition = registry.get(id)
      return definition.commander === true ? { ...definition, maxHp: health } : definition
    }),
  )
}
