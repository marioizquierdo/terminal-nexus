// **The battle banner** (the challenge runs, step 11G): where the player planted the army's banner in the Build Phase,
// and its stance — the rules layer's half of it. The kernel already sends a side's fighting units to a target area and
// has them stand there (`src/pulse/target.ts`); a side with none marches on the enemy's Grid Nexus. So the banner needs
// no kernel change:
//
// - **defensive**: the banner's area is the side's target for the whole round: they go there, fight what comes within
//   reach, and hold it;
// - **aggressive**: the banner's area is the side's target until the army has reached it — at least half of the side's
//   fighting units standing in it or within a tile of it, read between two ticks as a mission's `target` is — and from
//   the next tick the side has no target, so it marches on the enemy's Grid Nexus (or, with none on the map, fights the
//   nearest enemy). A route of two legs, the second the march the side makes by default.
//
// Read and set between ticks by the trigger runner (`mission.ts`), never inside one: integers, ordinal order, the
// state the tick settled — nothing here can make two runs differ. A round with no banner (`MissionPulseInput.banner`
// absent) resolves byte for byte as before.

import type { ContentRegistry } from "../content/index.ts"
import { tilesOf } from "../grid/coords.ts"
import { followsTarget } from "../pulse/target.ts"
import type { MatchState, PlayerId, TargetArea } from "../state/types.ts"

/** Aggressive: there, then on to the enemy's Nexus. Defensive: hold it. */
export type BannerStance = "aggressive" | "defensive"

/** The player's banner for a round: the area its troops head for, what the screen calls it, and its stance. */
export type BannerOrder = Readonly<{ side: PlayerId; area: TargetArea; name: string; stance: BannerStance }>

/** The sides' targets with the banner's side sent to its banner — or, once an aggressive banner is reached, sent
 *  nowhere, so it marches on. `undefined` when no side is left with one. */
export function withBannerTargets(targets: MatchState["targets"], banner: BannerOrder | undefined, released: boolean): MatchState["targets"] {
  if (banner === undefined) return targets
  const next: Partial<Record<PlayerId, TargetArea>> = { ...(targets ?? {}) }
  if (released) delete next[banner.side]
  else next[banner.side] = banner.area
  return Object.keys(next).length === 0 ? undefined : next
}

/** How far outside the banner's area a unit still counts as having reached it, in tiles. */
const REACHED_RING = 1

/**
 * Whether the army has reached an aggressive banner: at least half of the side's fighting units (those that follow a
 * target), rounded up, stand with a tile of their footprint inside the area or within `REACHED_RING` of it. A side
 * with no fighting unit has not reached it.
 */
export function bannerReached(state: MatchState, registry: ContentRegistry, banner: BannerOrder): boolean {
  const area = banner.area
  const left = area.x - REACHED_RING
  const top = area.y - REACHED_RING
  const right = area.x + area.width - 1 + REACHED_RING
  const bottom = area.y + area.height - 1 + REACHED_RING
  let fighters = 0
  let there = 0
  for (const entity of state.entities) {
    if (entity.player !== banner.side || entity.hp <= 0) continue
    const definition = registry.get(entity.contentId)
    if (!followsTarget(definition)) continue
    fighters += 1
    if (tilesOf(entity.anchor, definition.footprint).some((tile) => tile.x >= left && tile.x <= right && tile.y >= top && tile.y <= bottom)) there += 1
  }
  return fighters > 0 && there * 2 >= fighters
}
