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
// - its **home** is the building that trained it (`EntityState.home`, set as a building's wave sets it down) while
//   that building still stands; else the nearest structure of its own side that makes units like it (a building
//   whose production recipe trains its content id, or whose `spawn` makes it), else the side's Grid Nexus (the
//   "orphan" rule, a Commander's too), else nothing: a side with neither has nowhere to go and its survivors stay
//   where they stand. Nearest by the Grid's own distance (`footprintDistance`: a row counts two columns), so the
//   home it walks to is the one it can reach soonest;
// - one going home to a building that makes it is set down **on its roof** (the owner, 2026-10-21: "survivors should
//   return to their building piling on the roof as close to original position as possible"): its body wholly on the
//   building's tiles, as near the tile it came out on (`homeAt`) as there is room — for one with no such tile, as near
//   the tile of the building it was nearest. A unit shares a tile with its own building, never with another unit. A
//   body too wide for the roof, a roof already full, and a unit in the air (which comes out beside its building, never
//   on it) are set down on the free ground nearest that tile instead, on the side it is nearest to, under its own
//   collision mask. One going home to the Grid Nexus — an orphan, a Commander — is set down on the free ground beside
//   it, never on it: the Nexus is what the player watches, its health and its warnings drawn on its own tiles, and it
//   made none of them;
// - one survivor at a time, nearest its home first, then nearer the enemy, then by ordinal — so the answer never
//   depends on anything but the state, the registry and the order of the entities, and a mirrored state gives
//   mirrored places;
// - every entity's transient fields go back to what a fresh one starts with (`freshEntityFields`), which
//   is what starts a producer's waves afresh (its first one its recipe's delay away, none come, nothing
//   owed) and clears a shot in progress;
// - a structure that `mends` regains that much health, never past its `maxHp` (the Grid Nexus, so an early
//   raid is not a wound it carries all match); and
// - the Pulse's own bookkeeping is cleared: the clock is zero, there is no outcome, no tile is still
//   cooling from a death. The gameplay stream carries on where it stopped.

import type { ContentDef, ContentRegistry } from "../content/index.ts"
import { freshEntityFields } from "../content/index.ts"
import { footprintDistance, gridDistance, nearestFootprintTile, tilesOf } from "../grid/coords.ts"
import type { CollisionMask } from "../grid/occupancy.ts"
import { OccupancyIndex, maskFrom } from "../grid/occupancy.ts"
import type { Coord, Footprint } from "../grid/types.ts"
import { ENTITY_LAYERS } from "../grid/types.ts"
import type { EntityState, MatchState, PlayerId } from "../state/types.ts"
import { centreTile, enemyNexusMiddle, nearestFit } from "./placement.ts"
import type { RecallMove, RecallResult } from "./types.ts"

/** How far from its home a survivor may be set down before Recall gives the search up and widens it, by the
 *  Grid's own distance (`nearestFit`): 8 rows up and down, 16 columns across. */
const HOME_RADIUS = 16
/** The wider search a survivor whose own tile was taken falls back on, around where it stands. */
const FALLBACK_RADIUS = 80

type Home = Readonly<{ entity: EntityState; definition: ContentDef; kind: "producer" | "nexus" }>

/** Every layer but the buildings': what a unit coming home onto a roof must find empty. */
const UNIT_LAYERS = ENTITY_LAYERS.filter((layer) => layer !== "obstacles")

/** `mask`, with the doorsteps kept clear: no body on a tile in `doorsteps`. */
function offTheDoorsteps(mask: CollisionMask, doorsteps: ReadonlySet<string>): Pick<CollisionMask, "footprintFits"> {
  return {
    footprintFits: (anchor: Coord, footprint: Footprint): boolean =>
      !tilesOf(anchor, footprint).some((tile) => doorsteps.has(`${tile.x},${tile.y}`)) && mask.footprintFits(anchor, footprint),
  }
}

/**
 * How many survivors `home`'s roof takes: as many bodies like `survivor`'s as its tiles hold, less the units of one of
 * its waves, so the next round's first wave always has room on its roof and never waits behind the units that came
 * home. A playtest of the curve level, whose target lies on its own base, found survivors standing on full roofs inside
 * the target, the wave held behind them and the units sent down to make way jamming the ground round the base.
 */
function roofRoom(home: Home, survivor: ContentDef): number {
  const tiles = home.definition.footprint.length
  const wave = home.definition.production?.perWave ?? 0
  return Math.max(0, Math.floor(tiles / survivor.footprint.length) - wave)
}

/** A building's **doorstep**: the ground touching it, corners included — where the units on its roof step down. */
function doorstepOf(anchor: Coord, footprint: Footprint): string[] {
  const own = new Set(tilesOf(anchor, footprint).map((tile) => `${tile.x},${tile.y}`))
  const step = new Set<string>()
  for (const tile of tilesOf(anchor, footprint)) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const key = `${tile.x + dx},${tile.y + dy}`
        if (!own.has(key)) step.add(key)
      }
    }
  }
  return [...step]
}

/** `mask` narrowed to `home`'s roof: a body fits only where all of it stands on the building's tiles and the mask
 *  (every layer but the buildings') has room for it. */
function roofOf(mask: CollisionMask, home: Home): Pick<CollisionMask, "footprintFits"> {
  const roof = new Set(tilesOf(home.entity.anchor, home.definition.footprint).map((tile) => `${tile.x},${tile.y}`))
  return {
    footprintFits: (anchor: Coord, footprint: Footprint): boolean =>
      tilesOf(anchor, footprint).every((tile) => roof.has(`${tile.x},${tile.y}`)) && mask.footprintFits(anchor, footprint),
  }
}

/** The nearest of `candidates` to `survivor`, by the distance range is measured in (`footprintDistance`); on a tie
 *  the one nearer the enemy (`toward`, as `nearestFit` breaks its ties), then the lower ordinal — so the same home
 *  for either side of the map, mirrored. `null` when there are none. */
function nearest(survivor: EntityState, survivorDefinition: ContentDef, candidates: readonly Home[], toward: Coord | undefined): Home | null {
  let best: Home | null = null
  let bestKey: readonly [number, number] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  for (const candidate of candidates) {
    const distance = footprintDistance(survivor.anchor, survivorDefinition.footprint, candidate.entity.anchor, candidate.definition.footprint)
    const facing = toward === undefined ? 0 : gridDistance(centreTile(candidate.entity.anchor, candidate.definition.footprint), toward)
    // Candidates arrive in ordinal order, so a strict comparison keeps the lower ordinal on a full tie.
    if (distance < bestKey[0] || (distance === bestKey[0] && facing < bestKey[1])) {
      best = candidate
      bestKey = [distance, facing]
    }
  }
  return best
}

/** `entity`'s health after Recall: what it ended the Pulse on, plus what its definition `mends`, capped at its `maxHp`. */
function mended(entity: EntityState, definition: ContentDef): number {
  if (definition.mends === undefined) return entity.hp
  return Math.min(definition.maxHp, entity.hp + definition.mends)
}

export function recall(state: MatchState, registry: ContentRegistry, sides?: Readonly<Partial<Record<PlayerId, ContentRegistry>>>): RecallResult {
  const definitions = new Map<number, ContentDef>()
  // Each thing as its side defines it (a duel's sides may differ: `PulseContext.sides`).
  for (const entity of state.entities) definitions.set(entity.ordinal, (sides?.[entity.player] ?? registry).get(entity.contentId))
  const definitionOf = (entity: EntityState): ContentDef => definitions.get(entity.ordinal) as ContentDef

  const structures = state.entities.filter((entity) => definitionOf(entity).layer === "obstacles")
  const survivors = state.entities.filter((entity) => definitionOf(entity).layer !== "obstacles")
  const standing = structures.map((entity) => ({ player: entity.player, anchor: entity.anchor, definition: definitionOf(entity) }))

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
    // The building that trained it, while it stands (a building's ordinal is never reused, so a fallen one is not found).
    const trainer = survivor.home === undefined ? undefined : mates.find((structure) => structure.ordinal === survivor.home)
    if (trainer !== undefined) return { entity: trainer, definition: definitionOf(trainer), kind: "producer" }
    const producers: Home[] = mates
      .filter((structure) => {
        const producer = definitionOf(structure)
        return producer.production?.output === survivor.contentId || producer.spawn?.contentId === survivor.contentId
      })
      .map((entity) => ({ entity, definition: definitionOf(entity), kind: "producer" as const }))
    const nexuses: Home[] = mates
      .filter((structure) => definitionOf(structure).nexus === true)
      .map((entity) => ({ entity, definition: definitionOf(entity), kind: "nexus" as const }))
    const toward = enemyNexusMiddle(standing, survivor.player, centreTile(survivor.anchor, definition.footprint))
    return nearest(survivor, definition, producers, toward) ?? nearest(survivor, definition, nexuses, toward)
  }
  const homes = new Map<number, Home | null>(survivors.map((survivor) => [survivor.ordinal, homeOf(survivor)]))
  // Each side's doorsteps: the ground touching its buildings that make units. A survivor that finds no room on a roof
  // is set down off them while there is room elsewhere near home, so the units on a roof can always step down to make
  // way for a wave (`src/pulse/make-way.ts`) — a roof ringed by survivors standing idle would hold its wave for good.
  const doorsteps = new Map<PlayerId, Set<string>>()
  for (const structure of structures) {
    const definition = definitionOf(structure)
    if (definition.production === undefined && definition.spawn === undefined) continue
    const own = doorsteps.get(structure.player) ?? new Set<string>()
    for (const key of doorstepOf(structure.anchor, definition.footprint)) own.add(key)
    doorsteps.set(structure.player, own)
  }

  // A survivor with no home to go to stays exactly where it stands — and is set down first, so the
  // ones that do move make room for it rather than the other way round.
  const anchors = new Map<number, Coord>()
  for (const survivor of survivors) {
    if (homes.get(survivor.ordinal) !== null) continue
    const definition = definitionOf(survivor)
    index.add(definition.layer, survivor.ordinal, survivor.anchor, definition.footprint)
    anchors.set(survivor.ordinal, survivor.anchor)
  }

  // Set down nearest home first, then the one nearer the enemy, then by ordinal: an order that is the same for
  // either side of the map, mirrored — by ordinal alone, which the opening hands out in reading order, the western
  // survivor of a side would always take the nearer tile.
  const homeward = (survivor: EntityState): readonly number[] => {
    const home = homes.get(survivor.ordinal)
    const here = centreTile(survivor.anchor, definitionOf(survivor).footprint)
    if (home === null || home === undefined) return [0, 0]
    const toward = enemyNexusMiddle(standing, survivor.player, here)
    return [
      gridDistance(here, nearestFootprintTile(here, home.entity.anchor, home.definition.footprint)),
      toward === undefined ? 0 : gridDistance(here, toward),
    ]
  }
  const keys = new Map(survivors.map((survivor) => [survivor.ordinal, homeward(survivor)]))
  const inTurn = [...survivors].sort((a, b) => {
    const [homeA = 0, enemyA = 0] = keys.get(a.ordinal) ?? []
    const [homeB = 0, enemyB = 0] = keys.get(b.ordinal) ?? []
    return homeA - homeB || enemyA - enemyB || a.ordinal - b.ordinal
  })
  /** How many survivors each building's roof has taken so far. */
  const onRoofs = new Map<number, number>()
  for (const survivor of inTurn) {
    const home = homes.get(survivor.ordinal) ?? null
    if (home === null) continue
    const definition = definitionOf(survivor)
    // Nobody shares a tile after Recall, on any layer, but a unit and its own home's roof: the screen draws one glyph
    // a tile, and a survivor hidden under another is a survivor that did not visibly come home.
    const mask = maskFrom(index, {
      layers: ENTITY_LAYERS,
      terrain: definition.layer === "air" ? "ignore" : "impassable",
    })
    const here = centreTile(survivor.anchor, definition.footprint)
    // The tile it comes back *to*: the one it came out on, when it is going back to the building that trained it;
    // else the tile of its home nearest it, so it arrives on the side it was already on, not the far side.
    const trainedHere = survivor.home === home.entity.ordinal && survivor.homeAt !== undefined
    const target = trainedHere ? centreTile(survivor.homeAt as Coord, definition.footprint) : nearestFootprintTile(here, home.entity.anchor, home.definition.footprint)
    const toward = enemyNexusMiddle(standing, survivor.player, here)
    // On the roof while it has room — a building's that makes it, never the Grid Nexus's, and never for a unit in the
    // air, which comes out beside its building; then the nearest free ground; nowhere free near home, the nearest free
    // tile to where it stands rather than overlap anyone.
    const onTheRoof =
      home.kind !== "producer" || definition.layer === "air" || (onRoofs.get(home.entity.ordinal) ?? 0) >= roofRoom(home, definition)
        ? null
        : nearestFit(roofOf(maskFrom(index, { layers: UNIT_LAYERS, terrain: "impassable" }), home), definition.footprint, target, HOME_RADIUS, here, toward)
    if (onTheRoof !== null) onRoofs.set(home.entity.ordinal, (onRoofs.get(home.entity.ordinal) ?? 0) + 1)
    const clear = doorsteps.get(survivor.player)
    const to =
      onTheRoof ??
      (clear === undefined || definition.layer === "air" ? null : nearestFit(offTheDoorsteps(mask, clear), definition.footprint, target, HOME_RADIUS, here, toward)) ??
      nearestFit(mask, definition.footprint, target, HOME_RADIUS, here, toward) ??
      nearestFit(mask, definition.footprint, here, FALLBACK_RADIUS, here, toward)
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
    hp: mended(entity, definitionOf(entity)),
  }))
  // Recall puts out whatever still burns (`MatchState.burning`): the next Pulse opens on ground with no fire.
  const { burning: _burning, ...rest } = state
  return {
    state: { ...rest, tick: 0, outcome: null, vacatedTiles: [], entities },
    moves,
  }
}
