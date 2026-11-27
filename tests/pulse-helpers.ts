// Shared scaffolding for the Battle Round tests — not a test file itself: the runners only pick up
// `*.test.ts`. A Build Phase played through the driver's commands, into a Pulse — on the Build Phase's own
// scaffolding (`tests/build-helpers.ts`).

import { strict as assert } from "node:assert"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import type { BuildSession } from "../src/view/build-session.ts"
import type { BuildContext, BuildState } from "../src/build/state.ts"
import { nexusTile, remaining, withoutScene } from "../src/build/state.ts"
import type { FieldEntity, StandingStructure } from "../src/build/types.ts"
import type { LevelPlay, PlayableLevel } from "../src/cli/levels.ts"
import { starterContext } from "../src/cli/starter.ts"
import { testBase } from "./starter-fixture.ts"
import { keepPower } from "../src/cli/skirmish-play.ts"
import { timelineOf } from "../src/cli/timeline.ts"
import { fallen, openingState, regroup, standDown } from "../src/match/index.ts"
import type { Force } from "../src/match/index.ts"
import { resolvePulse } from "../src/engine/pulse/index.ts"
import type { MatchState } from "../src/engine/state/types.ts"
import type { RoundVerdict } from "../src/view/pulse-live.ts"
import type { ReadonlyCellFrame } from "../src/view/frame.ts"
import type { ResolvedPulse } from "../src/view/pulse-live.ts"
import type { ColorDepth } from "../src/view/roles.ts"
import { MINIMUM, buildSide, clickCell, compose, screenText } from "./build-helpers.ts"

export { MINIMUM }

/** The test base's build menu's rows, by index (`testBase`, tests/starter-fixture.ts). */
export const BARRACKS = 0
export const HATCHERY = 1
export const TURRET = 2

export type Spot = readonly [index: number, x: number, y: number]

/**
 * The plan that beat the probe while the placeholder Pulse was being tuned: two Turrets and a Hatchery — moved
 * inside the build range when construction territory was built (it stood at 22,9, 22,12 and 20,14, past the
 * range at its first default). A Turret on the Barracks's flank and one by the squads' muster, inside the ranges
 * of the Barracks and the Nexus, and the Hatchery behind them inside the Nexus's — a tile further west since a
 * Hatchery keeps room round it for what it spawns, so a free tile now lies between it and the second Turret.
 * The first Turret alone still wins, the whole plan sooner, and the survivors still have a walk home worth
 * drawing.
 */
export const DEFENCE: readonly Spot[] = [
  [TURRET, 28, 12],
  [TURRET, 23, 12],
  [HATCHERY, 20, 12],
]

/** Where War Chest sits in a round's hand, when it is offered: beside the powers dealt, after them (`dealHand`). */
export function warChest(context: Pick<BuildContext, "nexusDraft">): number | null {
  const index = context.nexusDraft.findIndex((option) => option.card.always === true && "credits" in option.card.effect)
  return index < 0 ? null : index
}

/** The same plan as a key script: each spot's building armed by its digit and placed by two clicks on its tile — for
 *  the tests, screenshots and playtests that press keys rather than drive commands. It fits the starter round's
 *  credits, so it needs no power picked. */
export const DEFENCE_KEYS = DEFENCE.map(([index, x, y]) => `${index + 1} click:${x},${y} click:${x},${y}`).join(" ")

export type RaidSize = "none" | "probe" | "heavy"
export type CrewSize = "some" | "none"

export type TestSetup = Readonly<{
  plan?: readonly Spot[]
  /** Which raid comes: the probe (the default), a heavy one, or none. */
  raid?: RaidSize
  /** Whether the player has units of their own (the default) or none. */
  crew?: CrewSize
  /** How many rounds the test mission has: 2 (the default), so a round's result goes on to a next one. */
  rounds?: number
}>

const unitsOf = (unit: string, count: number): readonly string[] => Array.from({ length: count }, () => unit)

/** The raids these tests play against: none, the probe the first placeholder Pulse offered, and a heavy raid that
 *  takes the Nexus when nothing is built, whether the player has units of their own or none — ten runners and five
 *  raiders, so it falls well before the round's end. */
const RAIDS: Readonly<Record<RaidSize, readonly string[]>> = {
  none: [],
  probe: [...unitsOf("unit.ravel.runner", 4), ...unitsOf("unit.ravel.raider", 3)],
  heavy: [...unitsOf("unit.ravel.runner", 10), ...unitsOf("unit.ravel.raider", 5)],
}

const SEED = 0x50554c53
const ROUND_TICKS = 360

/** Round 1's forces: the player's squads beside the Nexus, and the raid at the far edge of a view opened on the base. */
function forcesOf(setup: TestSetup): Force[] {
  const forces: Force[] = []
  if ((setup.crew ?? "some") === "some") forces.push({ player: "A", muster: { x: 22, y: 10 }, units: [...unitsOf("unit.citizen.trooper", 3), ...unitsOf("unit.citizen.marksman", 2)] })
  const raid = RAIDS[setup.raid ?? "probe"]
  if (raid.length > 0) forces.push({ player: "B", muster: { x: 46, y: 10 }, units: raid })
  return forces
}

/**
 * **The test battle**: the first placeholder Pulse, played on the starter map by the rules between rounds — the
 * player's squads beside the Nexus, a raid at the far edge of a view opened on the base, the same seed and length — so
 * a first round is the very Pulse it was, and every ending the tests reach is reachable. Its rounds after the first
 * bring nothing new; the last one's end holds, unless the Nexus fell. It was a test mission until Story stopped
 * (the owner, 2026-11-26): what the Battle Round's screen shows does not depend on what scripted the battle.
 */
export function testPlay(setup: TestSetup = {}): Pick<LevelPlay, "startPulse" | "nextRound" | "keep"> {
  const rounds = setup.rounds ?? 2
  const endText = { won: "The test held.", lost: "The Nexus fell." }
  return {
    keep: keepPower,
    startPulse(context: BuildContext, state: BuildState) {
      const round = context.round?.number ?? 1
      const { registry } = context
      const standing = context.carried == null ? context.standing.map((structure) => ({ contentId: structure.contentId, anchor: structure.anchor })) : []
      const initialState = openingState({
        terrain: context.terrain,
        registry,
        structures: [...standing, ...state.planned.map((placement) => ({ contentId: placement.contentId, anchor: placement.anchor }))],
        setup: { seed: SEED, pulseTicks: ROUND_TICKS, forces: round === 1 ? forcesOf(setup) : [] },
        ...(context.carried == null ? {} : { carried: context.carried }),
      })
      const states: MatchState[] = []
      const run = resolvePulse({ initialState, registry, pulseTicks: ROUND_TICKS, seed: SEED, watch: (each) => states.push(each) })
      const final = run.finalState
      const fell = !final.entities.some((entity) => entity.player === "A" && registry.get(entity.contentId).nexus === true)
      const verdict: RoundVerdict = fell ? { kind: "lost", trigger: "fallen" } : round >= rounds ? { kind: "won", trigger: "hold" } : { kind: "continue" }
      const commanders = fallen(run.events, registry, round)
      return {
        timeline: timelineOf({ id: "test.placeholder", name: "Placeholder" }, states, run.events, ROUND_TICKS, SEED, registry),
        regroup: verdict.kind === "continue" ? regroup(final, registry) : standDown(final, registry),
        nexus: nexusTile(context),
        mission: { verdict, round, of: rounds, endText, ...(commanders.length === 0 ? {} : { fell: commanders }) },
      }
    },
    nextRound(context, state, resolved) {
      if (resolved.mission?.verdict.kind !== "continue") return null
      const carried = resolved.regroup.state
      const standing: StandingStructure[] = []
      const field: FieldEntity[] = []
      for (const entity of carried.entities) {
        if (entity.player === "A" && context.registry.get(entity.contentId).layer === "obstacles") standing.push({ contentId: entity.contentId, anchor: entity.anchor })
        else {
          // A survivor walks to where it stands as the Build Phase opens: its regroup, played on the map.
          const walk = resolved.regroup.paths.find((path) => path.ordinal === entity.ordinal)
          field.push({
            contentId: entity.contentId,
            anchor: entity.anchor,
            ordinal: entity.ordinal,
            player: entity.player,
            hp: entity.hp,
            ...(walk === undefined || walk.steps.length === 0 ? {} : { walk: { from: walk.from, steps: walk.steps } }),
          })
        }
      }
      const number = (context.round?.number ?? 1) + 1
      return { ...withoutScene(context), standing, field, carried, incoming: [], round: { number, of: rounds }, allotment: remaining(context, state), callups: [] }
    },
  }
}

export type Played = Readonly<{
  build: BuildSession
  pulse: ResolvedPulse
  context: BuildContext
  layout: BuildLayout
  mission: Pick<LevelPlay, "startPulse" | "nextRound" | "keep">
}>

/**
 * The test base (a Barracks standing beside the Nexus, tests/starter-fixture.ts) as the placeholder Pulse was played
 * on it: buildings that spawn nothing (as before buildings made units), and the test battle's own squads and raid
 * arriving for `setup`.
 */
export function placeholderContext(setup: TestSetup = {}): BuildContext {
  const context = testBase()
  // Round 1's squads and raid, shown arriving where the battle sets them down, as the Build Phase shows what is coming.
  const opened = openingState({
    terrain: context.terrain,
    registry: context.registry,
    structures: context.standing.map((structure) => ({ contentId: structure.contentId, anchor: structure.anchor })),
    setup: { seed: SEED, pulseTicks: ROUND_TICKS, forces: forcesOf(setup) },
  })
  const incoming = opened.entities
    .filter((entity) => context.registry.get(entity.contentId).layer === "units")
    .map((entity) => ({ contentId: entity.contentId, anchor: entity.anchor, player: entity.player, tick: 0, intent: null }))
  return { ...withoutScene(context), catalog: context.catalog.map(({ spawns: _spawns, ...item }) => item), incoming, field: [] }
}

/** A session on the starter map, opening on the Nexus as the game does, playing the test battle for a setup (the
 *  probe, by default). */
export function newSession(
  size: Readonly<{ columns: number; rows: number }> = MINIMUM,
  onQuit?: () => void,
  setup: TestSetup = {},
): Omit<Played, "pulse"> {
  const mission = testPlay(setup)
  const { build, context, layout } = buildSide({
    context: placeholderContext(setup),
    cursor: STARTER_START_CURSOR,
    terminal: size,
    startPulse: mission.startPulse,
    nextRound: mission.nextRound,
    keep: mission.keep,
    // Its screens are read at instants of the round's own clock (`at`): fast forward off (tests/fast-forward.test.ts).
    fastForwardSpeed: 1,
    ...(onQuit === undefined ? {} : { onQuit }),
  })
  return { build, context, layout, mission }
}

/** The Build Phase's commands up to (not including) the commit: a Nexus power, and the plan, each
 *  building placed by two clicks on its tile. */
export function prepare(build: BuildSession, setup: TestSetup = {}): void {
  const chest = warChest(build.round)
  if (chest !== null) build.dispatch({ kind: "pick-nexus", index: chest }) // War Chest: 2000 to spend
  for (const [index, x, y] of setup.plan ?? []) {
    build.run([{ kind: "arm", index }, { kind: "click-tile", x, y }, { kind: "click-tile", x, y }])
  }
  assert.equal(build.state.planned.length, (setup.plan ?? []).length, "the plan was not placed as drawn")
}

/**
 * A Build Phase played through the driver's commands — a Nexus power, some buildings, the commit and its
 * yes — and the Pulse the shell resolved for it.
 */
export function play(setup: TestSetup = {}, size: Readonly<{ columns: number; rows: number }> = MINIMUM): Played {
  const session = newSession(size, undefined, setup)
  prepare(session.build, setup)
  session.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  assert.ok(session.build.pulse !== null, "committing did not start a Pulse")
  return { ...session, pulse: session.build.pulse.resolved }
}

/** The screen as text, and as cells — what the live loop would draw at the Pulse's current time. */
export { screenText }

export function frameOf(played: Pick<Played, "build" | "context" | "layout">, colors: ColorDepth = "monochrome"): ReadonlyCellFrame {
  return compose(played, {}, colors)
}

/** A mouse click at a frame cell (0-based column and row), through the real mouse adapter; `now` is the screen's
 *  clock when the click arrived, for anything that times it. */
export { clickCell as click }

/** Time passes for the Pulse on screen: the session's clock starts at zero when this is first called
 *  right after the commit, and `ms` is then milliseconds since. */
export function at(played: Pick<Played, "build">, ms: number): void {
  played.build.advance(ms)
}

/** The Pulse played from its start until just after its result stands (a hundred milliseconds past the walk
 *  home). A Pulse's time only moves forward, so this is for a Pulse nothing else has been asked of yet. */
export function atHome(played: Pick<Played, "build">): void {
  const pulse = played.build.pulse
  assert.ok(pulse !== null, "there is no Pulse on screen")
  played.build.advance(0)
  played.build.advance(pulse.prelude.lengthMs + pulse.times.homeMs + 100)
}

/** The test battle as a level the game's screens open (`runBuildPhase`'s and the scripted playtest's `at`): its first
 *  round the placeholder context, played by `testPlay`. */
export function testLevel(setup: TestSetup = {}): PlayableLevel {
  const play = testPlay(setup)
  return {
    id: "test-battle",
    story: "test",
    title: "The test battle",
    rounds: setup.rounds ?? 2,
    route: "skirmish?load=test-battle.save.json",
    play: { ...play, foresee: () => [] },
    firstRound: (scrollMargin, extra = {}) => ({ ...placeholderContext(setup), ...(scrollMargin === undefined ? {} : { scrollMargin }), ...extra }),
  }
}
