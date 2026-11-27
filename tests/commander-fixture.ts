// The Commander's named fixture — not a test file itself: the runners only pick up `*.test.ts`. Three rounds on the
// starter map, played by the rules between rounds as a battle plays them, built so Vasse falls in round 1: she walks
// out ahead of her line into a pack of runners, and the line beats them after she is gone. She sits no round out (her
// `roundsOut` is 0), so the Nexus restores her as round 2 opens.
//
// It was the second level of her story, a mission, until Story stopped (the owner, 2026-11-26); the same three rounds
// are written here as forces on the battlefield, with nothing scripted beyond who stands where as each round opens.
//
// A Commander who sits rounds out is a disadvantage no Commander has yet, so its path is proven on the same rounds
// with a test-only Vasse who sits one round out, or two (`sittingOut`).

import { FIXTURE_REGISTRY, createRegistry } from "../src/content/index.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import { fallen, openingState, regroup, restoreCommanders } from "../src/match/index.ts"
import type { Absence, Force, Restoration, StructurePlacement } from "../src/match/index.ts"
import { resolvePulse } from "../src/engine/pulse/index.ts"
import type { DomainEvent } from "../src/engine/events/types.ts"
import type { EntityState, MatchState } from "../src/engine/state/types.ts"
import { starterTerrain } from "./starter-fixture.ts"

export const VASSE = "unit.citizen.vasse"
const TROOPER = "unit.citizen.trooper"
const MARKSMAN = "unit.citizen.marksman"
const RUNNER = "unit.ravel.runner"

/** The starter map's Nexus, where she is restored. */
export const FIXTURE_BASE: readonly StructurePlacement[] = [{ contentId: "structure.citizen.nexus", player: "A", anchor: { x: 17, y: 10 } }]

/** How long each round lasts at most, in ticks. */
export const FIXTURE_ROUND_TICKS = 360

/** Who stands where as each round opens: round 1 has her ahead of her line, beside a pack of runners; the later rounds
 *  a pair of runners from the east, which her line beats. */
export function fixtureForces(round: number, ambush = true): readonly Force[] {
  if (round > 1) return [{ player: "B", muster: { x: 70, y: 12 }, units: [RUNNER, RUNNER] }]
  return [
    { player: "A", muster: ambush ? { x: 44, y: 12 } : { x: 26, y: 15 }, units: [VASSE] },
    { player: "A", muster: { x: 26, y: 15 }, units: [TROOPER, TROOPER, TROOPER, TROOPER, TROOPER, TROOPER, MARKSMAN, MARKSMAN] },
    ...(ambush ? [{ player: "B" as const, muster: { x: 50, y: 12 }, units: [RUNNER, RUNNER, RUNNER, RUNNER, RUNNER] }] : [{ player: "B" as const, muster: { x: 70, y: 12 }, units: [RUNNER, RUNNER] }]),
  ]
}

/** One round as it was played: its states from the opening on, its events, and its last state. */
export type FixturePulse = Readonly<{ states: readonly MatchState[]; events: readonly DomainEvent[]; final: MatchState }>

export type FixtureRound = Readonly<{ pulse: FixturePulse; restored: readonly Restoration[]; absent: readonly Absence[] }>

/**
 * The three rounds played as a battle plays them: the regroup between rounds, the Commanders who fell counted, and
 * whoever is due set down beside the Nexus before the next round opens. `absent` is who is out when the round has
 * ended. `ambush` false: she stays with her line and lives through round 1.
 */
export function playWithCommanders(registry: ContentRegistry = FIXTURE_REGISTRY, ambush = true, rounds = 3): FixtureRound[] {
  const terrain = starterTerrain()
  const played: FixtureRound[] = []
  let carried: MatchState | null = null
  let absent: Absence[] = []
  for (let number = 1; number <= rounds; number += 1) {
    let restored: readonly Restoration[] = []
    if (carried !== null) {
      const back = restoreCommanders(carried, absent, number, registry)
      carried = back.state
      absent = back.absent
      restored = back.restored
    }
    const initialState = openingState({
      terrain,
      registry,
      structures: number === 1 ? FIXTURE_BASE : [],
      setup: { seed: 11, pulseTicks: FIXTURE_ROUND_TICKS, forces: fixtureForces(number, ambush) },
      ...(carried === null ? {} : { carried }),
    })
    const states: MatchState[] = []
    const run = resolvePulse({ initialState, registry, pulseTicks: FIXTURE_ROUND_TICKS, seed: 11, watch: (state) => states.push(state) })
    absent = [...absent, ...fallen(run.events, registry, number)]
    played.push({ pulse: { states, events: run.events, final: run.finalState }, restored, absent })
    carried = regroup(run.finalState, registry).state
  }
  return played
}

/** `registry` with Vasse sitting `rounds` whole rounds out after the round she falls in: test-only content, the
 *  rule's other path. Nothing else is touched. */
export function sittingOut(rounds: number, registry: ContentRegistry = FIXTURE_REGISTRY): ContentRegistry {
  return createRegistry(registry.ids().map((id) => (id === VASSE ? { ...registry.get(id), roundsOut: rounds } : registry.get(id))))
}

// --- The same on the screen: a Skirmish she falls in ---------------------------------------------------------------

import { readFileSync } from "node:fs"
import { playRound } from "../src/battle/index.ts"
import type { SaveFile } from "../src/skirmish/save.ts"
import { battleOf, readSave, saveOf } from "../src/skirmish/save.ts"
import type { PlayableLevel } from "../src/cli/levels.ts"
import { skirmishLevel } from "../src/cli/skirmish-play.ts"

/** The starter map's battle (`saves/starter.save.json`), `rounds` long, one round played with nothing built and the
 *  battlefield it left changed by `edit`: a save whose Build Phase is round 2. */
function starterRoundTwo(name: string, edit: (entity: EntityState) => EntityState, rounds: number): SaveFile {
  const read = readSave(readFileSync(new URL("../saves/starter.save.json", import.meta.url), "utf8"))
  if (read.save === null) throw new Error(read.problems.join("; "))
  const setup = { ...read.save.setup, rounds }
  const first = playRound(battleOf({ ...read.save, setup }), { A: { build: [] }, B: { build: [] } }).state
  const carried = first.carried
  if (carried === null) throw new Error("the starter battle's first round left nothing on the battlefield")
  return saveOf(setup, { ...first, carried: { ...carried, entities: carried.entities.map(edit) } }, { name })
}

/**
 * **A Skirmish she falls in**, for what a player reads of it: the starter map's battle `rounds` long, one round played
 * with nothing built, and Vasse then found wounded in the way of Dob Hunter's army as it walks home, in view of her
 * base, so the round the screen opens on is the one she falls in. Its Build Phase is round 2.
 */
export const commanderFallsSave = (rounds = 8): SaveFile =>
  starterRoundTwo(
    "Vasse falls",
    (entity) =>
      entity.contentId === VASSE
        ? { ...entity, anchor: { x: 40, y: 18 }, hp: 20 }
        : entity.player === "B" && entity.contentId.startsWith("unit.")
          ? { ...entity, anchor: { x: entity.anchor.x - 26, y: entity.anchor.y - 2 } }
          : entity,
    rounds,
  )

/** `commanderFallsSave` as the screen opens it. */
export const commanderFallsLevel = (rounds = 8): PlayableLevel => skirmishLevel(commanderFallsSave(rounds), { route: "skirmish?load=vasse-falls.save.json" })

/**
 * **A Skirmish she fights in**: the same battle, with Dob Hunter's army found behind her line as round 2 opens, so it
 * walks home through her troops and the round is a fight from a few seconds in, for what she says and shows in one.
 */
export const commanderFightsLevel = (): PlayableLevel =>
  skirmishLevel(
    starterRoundTwo("Vasse fights", (entity) => (entity.player === "B" && entity.contentId.startsWith("unit.") ? { ...entity, anchor: { x: entity.anchor.x - OFFSET, y: entity.anchor.y - DY } } : entity), 8),
    { route: "skirmish?load=vasse-fights.save.json" },
  )
const OFFSET = 40
const DY = 6
