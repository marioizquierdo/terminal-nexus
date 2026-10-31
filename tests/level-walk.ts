// Two ways to walk a level's rounds with nothing built (`openRound`, src/cli/levels.ts), kept apart on purpose.
//
// `undecided` plays the same walk with every battle before the last forced to go on, whatever it did: a test of how
// a level is laid out (how many rounds, each one opened and numbered, its hands and raids) uses it, so a change to
// how battles play cannot fail it. Whether an empty base actually survives to each round is a property of the
// level's content, not of its layout, and `emptyWalk` measures it on its own: one guard (tests/levels.test.ts) holds
// it, with the low point of the Nexus each round reported, so when it tips it reads as what it is.

import type { PlayableLevel } from "../src/cli/levels.ts"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { buildLayout } from "../src/build/layout.ts"
import { createBuildState, withoutScene } from "../src/build/state.ts"

/** The level with every battle but its last forced to go on: its rounds open whatever its battles do. */
export function undecided(level: PlayableLevel): PlayableLevel {
  return {
    ...level,
    play: {
      ...level.play,
      startPulse(context, state) {
        const resolved = level.play.startPulse(context, state)
        const mission = resolved?.mission
        if (resolved === null || mission === undefined || mission.round >= mission.of) return resolved
        return { ...resolved, mission: { ...mission, verdict: { kind: "continue" } } }
      },
    },
  }
}

/** One round of the empty walk: the battle's verdict, and the lowest health player A's Grid Nexus fell to in it. */
export type EmptyRound = Readonly<{ round: number; verdict: string; nexusLow: number; nexusMax: number }>

/** The empty walk, round by round, until the level ends: what `openRound` plays to reach a later round. */
export function emptyWalk(level: PlayableLevel): EmptyRound[] {
  const rounds: EmptyRound[] = []
  let context = level.firstRound()
  for (let round = 1; round <= level.rounds; round += 1) {
    const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
    const state = createBuildState(withoutScene(context), STARTER_START_CURSOR, viewport)
    const resolved = level.play.startPulse(context, state)
    if (resolved === null) break
    let nexusLow = Number.POSITIVE_INFINITY
    let nexusMax = 0
    for (const tick of resolved.timeline.states) {
      const nexus = tick.entities.find((entity) => entity.player === "A" && entity.contentId.endsWith(".nexus"))
      nexusLow = Math.min(nexusLow, nexus?.hp ?? 0)
      if (nexus !== undefined) nexusMax = Math.max(nexusMax, resolved.timeline.registry.get(nexus.contentId).maxHp)
    }
    rounds.push({ round, verdict: resolved.mission?.verdict.kind ?? "none", nexusLow, nexusMax })
    const next = level.play.nextRound(context, state, resolved)
    if (next === null) break
    context = next
  }
  return rounds
}
