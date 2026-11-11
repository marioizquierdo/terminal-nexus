// The demo: two short battles made to be shown, each one duel on the Crossing between Edda Vasse's Citizen Nexus and
// Dob Hunter's Ravel one, played on the same Build Phase screen as a Challenge run's battle (docs/game-design/demo.md).
//
// - **the mirror** is the playable one: the two Nexuses face each other across the ridge, the enemy is the showman
//   (`src/duel/players.ts`, an opponent that says what it is doing and never reacts), and four rounds take a person
//   two to five minutes — a probe, a build-up, a push and an all-in, with the Nexus Pulse's hand, the build menu,
//   Vasse's own voice and the enemy's army growing in plain sight. A plain plan wins it in the last round.
// - **the battle** is the spectacle: both sides open with their armies already in the field, a battle a few dozen
//   units a side wide, and three rounds of it; the enemy is the rush, which marches every round.
//
// A demo is a run of one battle, so everything a run does (the Build Phase, the round after a round, the result)
// works unchanged. What is its own is here: the duel, its fixed seed (the same hand is dealt every time it is shown),
// and the words. Pure: no clock, no randomness.

import { ARMIES } from "../armies/index.ts"
import type { DuelSetup } from "../duel/index.ts"
import { DUEL_PULSE_TICKS } from "../duel/index.ts"
import type { RunBattle, RunDefinition, RunSetup } from "./types.ts"

/** The demo's builds: the playable mirror and the full-on battle. */
export const DEMO_BUILDS = ["mirror", "battle"] as const
export type DemoBuild = (typeof DEMO_BUILDS)[number]

/** The build a demo opens when none is named. */
export const DEFAULT_DEMO_BUILD: DemoBuild = "mirror"

/** Whether `text` names a build. */
export const isDemoBuild = (text: string): text is DemoBuild => (DEMO_BUILDS as readonly string[]).includes(text)

/** The Commander a demo is played with, and the one it is played against. */
export const DEMO_COMMANDER = "vasse"
export const DEMO_OPPONENT = "dob"

/** The map both builds are fought on: the Crossing, two Nexuses at the ends of the middle row, a ridge between. */
export const DEMO_MAP = "crossing"

/** The fixed seeds: the same hand of Nexus powers and the same chances every time the build is shown. Found by
 *  looking at what each seed deals (a Reserve Callup, a Standing Order and an Aid Station Permit to choose from in
 *  round 1) and at how a plain plan fares on it. */
const SEEDS: Readonly<Record<DemoBuild, number>> = { mirror: 4, battle: 9 }

/** What a build is, to the person who runs it. */
export type DemoSpec = Readonly<{
  build: DemoBuild
  /** What the screen's header calls it. */
  title: string
  /** The scripted player that plans the enemy's side (`src/duel/players.ts`). */
  policy: string
  /** What the enemy does, in a few words. */
  policyWords: string
  duel: DuelSetup
}>

/** Troops by name, for a muster. */
const troops = (...entries: readonly (readonly [string, number])[]): readonly Readonly<{ unit: string; count: number }>[] => entries.map(([unit, count]) => ({ unit, count }))

/** The armies the battle opens with, a side each, besides its Commander and her starting package: troopers in front,
 *  marksmen and mortars behind, pikemen between; runners in numbers, slingers behind, raiders and bombers among them. */
const BATTLE_MUSTER = {
  A: troops(["unit.citizen.trooper", 16], ["unit.citizen.marksman", 8], ["unit.citizen.pikeman", 4], ["unit.citizen.mortar", 2]),
  B: troops(["unit.ravel.runner", 20], ["unit.ravel.slinger", 8], ["unit.ravel.raider", 4], ["unit.ravel.bomber", 3]),
}

/** Both builds, by name. The mirror gives the Ravel a war chest of 220 in the first round against the player's 100:
 *  a first tuning so that a plain plan, built as a person would build it, fells the enemy Nexus in the last round, close
 *  to the end of it (`tests/demo.test.ts`). */
export const DEMOS: Readonly<Record<DemoBuild, DemoSpec>> = {
  mirror: {
    build: "mirror",
    title: "The Mirror",
    policy: "showman",
    policyWords: "plays it plainly: a probe, a build-up, a push, an all-in",
    duel: { map: DEMO_MAP, seed: SEEDS.mirror, rounds: 4, pulseTicks: DUEL_PULSE_TICKS, commanders: { A: DEMO_COMMANDER, B: DEMO_OPPONENT }, credits: { A: 100, B: 220 } },
  },
  battle: {
    build: "battle",
    title: "The Grand Battle",
    policy: "rush",
    policyWords: "marches every round with everything it has",
    duel: {
      map: DEMO_MAP,
      seed: SEEDS.battle,
      rounds: 3,
      pulseTicks: DUEL_PULSE_TICKS,
      commanders: { A: DEMO_COMMANDER, B: DEMO_OPPONENT },
      muster: BATTLE_MUSTER,
    },
  },
}

/** The seed a demo run carries in its setup: its build's. */
export const demoSeed = (build: DemoBuild): number => SEEDS[build]

/** The demo a run setup names, or `undefined` for an ordinary run. */
export const demoOf = (setup: RunSetup): DemoSpec | undefined => (setup.demo === undefined ? undefined : DEMOS[setup.demo])

/** The setup of a demo run: Vasse, the build's seed, and the build named. */
export const demoSetup = (build: DemoBuild): RunSetup => ({ seed: demoSeed(build), commander: DEMO_COMMANDER, demo: build })

/** A demo run's definition: one act of one battle, against the Ravel on the Crossing, and no run after it but itself. */
export function demoDefinition(setup: RunSetup): RunDefinition {
  const spec = demoOf(setup)
  if (spec === undefined) throw new Error("a demo run names its build")
  const battle: RunBattle = { number: 1, act: 1, opponent: DEMO_OPPONENT, policy: spec.policy, duel: spec.duel }
  return { setup, acts: [{ number: 1, battles: [battle] }], battles: [battle], nextSeed: setup.seed }
}

/** Dob Hunter's own line as the battle opens, from his army (the first of what he says on appearing). */
export function opponentOpening(): string {
  return ARMIES.commanders.find((commander) => commander.id === DEMO_OPPONENT)?.barks?.appears?.[0] ?? "Here."
}

/** The words a demo opens on, each line the dialog's: what the game says, what Vasse says, what the enemy says. The
 *  `who` of a line is `game`, `vasse` or `enemy`; the shell turns it into a speaker and a place to look. */
export type DemoLine = Readonly<{ who: "game" | "vasse" | "enemy"; text: string }>

export function demoOpening(build: DemoBuild): readonly DemoLine[] {
  if (build === "mirror") {
    return [
      { who: "game", text: "THE MIRROR. Two Grid Nexuses on one Grid, a ridge between. The one across it is a copy of yours." },
      { who: "vasse", text: "Same pyramid, other side of the ridge. We build, we commit, the Grid settles it." },
      { who: "enemy", text: opponentOpening() },
      { who: "game", text: "Four rounds. Pick a Nexus power [n], build [1] to [3], start the round [s]. Fell their Nexus, or keep yours healthier." },
    ]
  }
  return [
    { who: "game", text: "THE GRAND BATTLE. Two armies already in the field, a ridge with one wide gap between them." },
    { who: "vasse", text: "Everyone I have, and everyone they have. Hold your spacing." },
    { who: "enemy", text: opponentOpening() },
    { who: "game", text: "Three rounds. Add what you like [1] to [3], start the round [s], and watch them meet." },
  ]
}

/** The line under the screen as a demo's round opens. */
export const demoStatus = (build: DemoBuild): string =>
  build === "mirror" ? "The Mirror, round 1 of 4. The Nexus Pulse deals: [n]." : "The Grand Battle, round 1 of 3. Add what you like, then [s]."

/** How a demo's result reads, as the lines its scene shows once it is over: how it ended, what the enemy did, and how to
 *  play it again. `won` is whether the player's Nexus kept its place. */
export function demoEndLines(build: DemoBuild, outcome: "won" | "lost" | "drawn", reason: string): readonly string[] {
  const spec = DEMOS[build]
  const verdict = outcome === "won" ? `${spec.title}: won. ${reason}` : outcome === "lost" ? `${spec.title}: lost. ${reason}` : `${spec.title}: drawn. ${reason}`
  return [verdict, `Dob Hunter's army ${spec.policyWords}. The same hands are dealt every time: play it again to try another plan.`]
}
