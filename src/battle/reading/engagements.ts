// Where and when the two sides fought in a Battle Round: each engagement starts at a hit of one side on the other, takes
// in every later hit within `ENGAGEMENT_REACH` tiles of one already in it, and ends once `ENGAGEMENT_QUIET` ticks pass
// with no hit in it — so two or three fights on one map are told apart. Each says when, where (the first hit's tile)
// and how wide, and for each side the damage it dealt there, the units and buildings that took part (a composition with
// its value) and what it lost there. Public.

import type { DomainEvent } from "../../events/types.ts"
import { gridDistance } from "../../grid/coords.ts"
import type { Coord } from "../../grid/types.ts"
import type { MatchState } from "../../state/types.ts"
import type { Side } from "../types.ts"
import type { Composition, RoundContext } from "./context.ts"
import type { Tracker } from "./index.ts"

/** How near a hit must be to one already in an engagement to belong to it, in tiles (a row counting two). */
export const ENGAGEMENT_REACH = 5
/** How long an engagement lasts with no hit in it before it is over: 5 seconds, at 12 ticks a second. */
export const ENGAGEMENT_QUIET = 60

export type EngagementSide = Readonly<{ dealt: number; engaged: Composition; lost: Composition }>

export type Engagement = Readonly<{
  start: number
  end: number
  /** The first hit's tile. */
  at: Coord
  /** How far from it the furthest hit landed, in tiles. */
  reach: number
  sides: Readonly<Record<Side, EngagementSide>>
}>

type Open = {
  start: number
  last: number
  at: Coord
  tiles: Coord[]
  dealt: Record<Side, number>
  engaged: Record<Side, Map<string, string>>
  lost: Record<Side, string[]>
}

export function readEngagements(context: RoundContext): Tracker<readonly Engagement[]> {
  const open: Open[] = []
  const closed: Open[] = []
  const near = (engagement: Open, at: Coord): boolean => engagement.tiles.some((tile) => gridDistance(tile, at) <= ENGAGEMENT_REACH)
  const finish = (engagement: Open): Engagement => {
    const side = (which: Side): EngagementSide => ({
      dealt: engagement.dealt[which],
      engaged: context.composition(which, [...engagement.engaged[which].values()]),
      lost: context.composition(which, engagement.lost[which]),
    })
    return {
      start: engagement.start,
      end: engagement.last,
      at: engagement.at,
      reach: Math.max(0, ...engagement.tiles.map((tile) => gridDistance(tile, engagement.at))),
      sides: { A: side("A"), B: side("B") },
    }
  }
  return {
    step(state: MatchState, events: readonly DomainEvent[]) {
      for (let index = open.length - 1; index >= 0; index -= 1) {
        if (state.tick - (open[index] as Open).last > ENGAGEMENT_QUIET) closed.push(...open.splice(index, 1))
      }
      const position = new Map(state.entities.map((entity) => [entity.id, entity.anchor] as const))
      for (const event of events) {
        if (event.kind === "damage.applied") {
          const victim = context.owner(event.entity)
          const attacker = context.owner(event.source)
          const at = position.get(event.entity)
          if (victim === undefined || attacker === undefined || attacker === victim || at === undefined) continue
          let engagement = open.find((candidate) => near(candidate, at))
          if (engagement === undefined) {
            engagement = { start: state.tick, last: state.tick, at, tiles: [], dealt: { A: 0, B: 0 }, engaged: { A: new Map(), B: new Map() }, lost: { A: [], B: [] } }
            open.push(engagement)
          }
          engagement.last = state.tick
          if (!engagement.tiles.some((tile) => tile.x === at.x && tile.y === at.y)) engagement.tiles.push(at)
          engagement.dealt[attacker] += event.amount
          engagement.engaged[victim].set(event.entity, context.content(event.entity) ?? "")
          engagement.engaged[attacker].set(event.source, context.content(event.source) ?? "")
        }
        if (event.kind === "entity.died" || event.kind === "structure.destroyed") {
          const engagement = open.find((candidate) => near(candidate, event.at))
          if (engagement !== undefined) engagement.lost[event.player as Side].push(event.contentId)
        }
      }
    },
    done() {
      return [...closed, ...open].sort((a, b) => a.start - b.start).map(finish)
    },
  }
}
