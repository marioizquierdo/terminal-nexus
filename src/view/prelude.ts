// **The prelude** (the owner, 2026-11-26: "right before the battle starts, the enemy script plans the move and places
// the banner, so the first thing to show when the rally point is placed is the enemy buildings or units that appear:
// they should appear with the cool building placement animation, and do it one by one, starting from the ones that
// were placed closer to the nexus, in quick succession (e.g. one every 200 ms). If there is a building conflict, it is
// resolved here with the right animation. Then the battle can officially start!").
//
// Before the fight's first tick, the round's presentation plays the reveal: every entity of the other side in the
// round's opening state that the Build Phase's map did not show (`newEnemies`: neither its standing structures nor its
// field, by ordinal or by what stands where) appears one at a time with the Build Phase's placement animation
// (`placement.ts`: its going-up frames, its light, its sparks), nearest its own Nexus first, `REVEAL_STEP_MS` apart —
// closer together when there are many, so the reveals never take longer than `REVEAL_SPAN_MS` to start. The fight's
// clock starts when the last one has settled. Nothing new: no prelude, the fight starts at once.
//
// **Clashes** (both sides built on the same ground, so neither stands: `RoundReport.clashes`, another change in
// flight). HOOK: `ResolvedPulse.clashes` takes them; each plays first, in the order given, as a building of its side
// still standing on the map and then thrown down with the removal's sparks (`removalSchedule`). Nothing supplies them
// yet: the shell that builds a `ResolvedPulse` (`src/cli/pulse-run.ts`, `src/cli/skirmish-play.ts`) passes the round
// report's clashes when they exist.
//
// Presentation only: worked out from the resolved round's opening state and the Build Phase's map, it changes nothing
// the round did — a match resolves the same with the renderer deleted. Pure in time: `preludeAt` reads only the plan
// and the milliseconds since Enter.

import type { ContentRegistry } from "../content/index.ts"
import { tileDistance } from "../engine/geometry/coords.ts"
import type { Coord } from "../engine/geometry/types.ts"
import type { MatchState, PlayerId } from "../engine/state/types.ts"
import type { Tuning } from "../build/tuning.ts"
import { TUNING } from "../build/tuning.ts"
import { trackEffectsAt, trackFrameAt } from "./animation.ts"
import type { ActiveEffect } from "./effects/index.ts"
import { EFFECT_RECIPES } from "./effects/recipes.ts"
import type { ColorDepth } from "./roles.ts"
import { placementEffectContext, placementLook, placementSchedule, placementTiming, removalSchedule } from "./placement.ts"
import type { PlacementLook } from "./placement.ts"

/** How far apart two reveals start: the owner's "e.g. one every 200 ms". */
export const REVEAL_STEP_MS = 200
/** The longest the reveals take to start, however many there are: past ten, they come closer together. */
export const REVEAL_SPAN_MS = 2000

/** A building both sides placed on the same ground, so neither stands (`RoundReport.clashes`). */
export type Clash = Readonly<{ side: PlayerId; contentId: string; anchor: Coord }>

/** What the Build Phase showed on the map: its standing structures (the player's), its field, and what the round was
 *  foreseen to bring (`BuildContext.incoming`, drawn see-through: the raid is seen coming, so it is no news). */
export type KnownMap = Readonly<{
  incoming?: readonly Readonly<{ contentId: string; player: PlayerId }>[]
  standing: readonly Readonly<{ contentId: string; anchor: Coord }>[]
  field: readonly Readonly<{ contentId: string; anchor: Coord; ordinal?: number; player: PlayerId }>[]
}>

/** One thing the prelude shows: a new entity rising, or a clash thrown down, from `atMs` after Enter. */
export type PreludeStep = Readonly<{ kind: "reveal" | "clash"; ordinal: number; contentId: string; player: PlayerId; anchor: Coord; atMs: number }>

/** The prelude of one round, worked out once: its steps in order and how long it lasts — when the fight starts. */
export type PreludePlan = Readonly<{ steps: readonly PreludeStep[]; lengthMs: number }>

export const NO_PRELUDE: PreludePlan = { steps: [], lengthMs: 0 }

type Opening = Pick<MatchState, "entities">

/** The other side's entities in the round's opening that the Build Phase's map did not show, nearest their own Nexus
 *  first (then top to bottom, left to right, by ordinal). */
export function newEnemies(opening: Opening, registry: ContentRegistry, known: KnownMap, side: PlayerId = "B"): Opening["entities"] {
  const ordinals = new Set<number>()
  const places = new Set<string>()
  const at = (contentId: string, anchor: Coord): string => `${contentId}@${anchor.x},${anchor.y}`
  for (const entity of known.field) {
    if (entity.ordinal !== undefined) ordinals.add(entity.ordinal)
    places.add(at(entity.contentId, entity.anchor))
  }
  for (const structure of known.standing) places.add(at(structure.contentId, structure.anchor))
  const theirs = opening.entities.filter((entity) => entity.player === side)
  const nexus = theirs.find((entity) => registry.get(entity.contentId).nexus === true)?.anchor ?? null
  // What was foreseen lands where the round decides: each foreseen one accounts for one of its kind.
  const foreseen = new Map<string, number>()
  for (const entity of known.incoming ?? []) if (entity.player === side) foreseen.set(entity.contentId, (foreseen.get(entity.contentId) ?? 0) + 1)
  const fresh = theirs.filter((entity) => {
    if (ordinals.has(entity.ordinal) || places.has(at(entity.contentId, entity.anchor))) return false
    const left = foreseen.get(entity.contentId) ?? 0
    if (left > 0) {
      foreseen.set(entity.contentId, left - 1)
      return false
    }
    return true
  })
  const distance = (anchor: Coord): number => (nexus === null ? 0 : tileDistance(nexus, anchor))
  return [...fresh].sort((a, b) => distance(a.anchor) - distance(b.anchor) || a.anchor.y - b.anchor.y || a.anchor.x - b.anchor.x || a.ordinal - b.ordinal)
}

/** The prelude's steps and length: the clashes first, then the reveals, `REVEAL_STEP_MS` apart (closer past ten), and
 *  the fight once the last has settled — its placement frames and its light (`placementTiming`). */
export function preludePlan(
  opening: Opening,
  registry: ContentRegistry,
  known: KnownMap,
  clashes: readonly Clash[] = [],
  reducedMotion = false,
  tuning: Pick<Tuning, "placeFramesMs" | "placeGlowMs" | "placeSparks"> = TUNING,
): PreludePlan {
  const fresh = newEnemies(opening, registry, known)
  const count = clashes.length + fresh.length
  if (count === 0) return NO_PRELUDE
  const stepMs = count <= 1 ? 0 : Math.min(REVEAL_STEP_MS, REVEAL_SPAN_MS / (count - 1))
  const steps: PreludeStep[] = [
    ...clashes.map((clash, index): PreludeStep => ({ kind: "clash", ordinal: -1 - index, contentId: clash.contentId, player: clash.side, anchor: clash.anchor, atMs: 0 })),
    ...fresh.map((entity): PreludeStep => ({ kind: "reveal", ordinal: entity.ordinal, contentId: entity.contentId, player: entity.player, anchor: entity.anchor, atMs: 0 })),
  ].map((step, index) => ({ ...step, atMs: Math.round(index * stepMs) }))
  const last = steps[steps.length - 1] as PreludeStep
  return { steps, lengthMs: last.atMs + Math.max(1, placementTiming(reducedMotion, tuning).totalMs) }
}

/** What the prelude shows at one instant: the ordinals not yet revealed (the scene leaves them off), the ones rising,
 *  each tile's look as it goes up, the clashed buildings still standing, and the light and sparks painting now. */
export type PreludeFrame = Readonly<{
  hidden: ReadonlySet<number>
  /** A rising entity's look at an offset of its footprint, by ordinal, while its going-up frames play; `null` once
   *  they are over and it is drawn as itself. */
  rising: ReadonlyMap<number, (offset: Coord) => PlacementLook | null>
  clashing: readonly PreludeStep[]
  effects: readonly ActiveEffect[]
}>

/** The prelude `elapsedMs` after Enter, or `null` once it is over. */
export function preludeAt(
  plan: PreludePlan,
  elapsedMs: number,
  registry: ContentRegistry,
  reducedMotion: boolean,
  colors: ColorDepth,
  tuning: Pick<Tuning, "placeFramesMs" | "placeGlowMs" | "placeSparks"> = TUNING,
): PreludeFrame | null {
  if (elapsedMs >= plan.lengthMs || plan.steps.length === 0) return null
  const hidden = new Set<number>()
  const rising = new Map<number, (offset: Coord) => PlacementLook | null>()
  const clashing: PreludeStep[] = []
  const effects: ActiveEffect[] = []
  for (const step of plan.steps) {
    const local = elapsedMs - step.atMs
    if (step.kind === "clash" && local < 0) {
      clashing.push(step)
      continue
    }
    if (step.kind === "reveal" && local < 0) {
      hidden.add(step.ordinal)
      continue
    }
    const footprint = registry.get(step.contentId).footprint
    const placed = { ordinal: step.ordinal, contentId: step.contentId, anchor: step.anchor }
    const schedule = step.kind === "reveal" ? placementSchedule(placed, footprint, reducedMotion, tuning) : removalSchedule(placed, footprint, reducedMotion, tuning)
    if (step.kind === "reveal") rising.set(step.ordinal, (offset) => (trackFrameAt(schedule, local) === null ? null : placementLook(schedule, step.contentId, offset, local)))
    const context = placementEffectContext(local, reducedMotion, colors)
    for (const instance of trackEffectsAt(schedule, local)) {
      const recipe = EFFECT_RECIPES[instance.recipe]
      if (recipe !== undefined) effects.push({ instance, cells: recipe(instance, context) })
    }
  }
  return { hidden, rising, clashing, effects }
}
