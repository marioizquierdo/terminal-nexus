// Fast forward (the owner, F339: "if I am playing defensive, the unit groups arrive at the rally point, and nothing
// happens until the round ends. The game should fast forward to the end of the round"; about 8x, labelled, any key back
// to normal speed — his choice).
//
// Measurements held here (written before the change):
//   - settled: a Skirmish round 1 on the Crossing with both rally points at HOME_NEXUS settles — a tick T found, a whole
//     in-game second (12 ticks) in, after the round's last hit, its units by a second count at T at least half exactly
//     where they end, the rest within 1 tile, no more than 2 of those within 2; and the whole second before it fails
//     the rule (T is the first);
//   - a round with a fight to the end (both sides rallied on the enemy Nexus) never settles in time to fast forward: the
//     presenter's clock runs at 1x from the first frame to the result;
//   - speed: on the settled round the fight's clock runs 8x from T (or from the end of the fight's first seconds, if
//     later) until its last seconds begin, then 1x through the last seconds, cease fire and the result; any key pressed
//     while it runs fast returns it to 1x for the rest of the round, and the key still does its own work (Space pauses);
//     Replay from the top plays fast forward again; a key before the fast part ends nothing;
//   - it is labelled: "Fast forward" beside the speed in the panel and the bottom line saying why and the way back,
//     inside 80 columns; nothing of the battle changes (the states and events are the resolved ones).

import { test } from "node:test"
import assert from "node:assert/strict"
import type { BattleState, BuildActions } from "../src/battle/index.ts"
import { beginBattle, playRound } from "../src/battle/index.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import type { DomainEvent } from "../src/engine/events/types.ts"
import { spawnEvents } from "../src/engine/pulse/index.ts"
import type { MatchState } from "../src/engine/state/types.ts"
import { timelineOf } from "../src/cli/timeline.ts"
import { TUNING } from "../src/build/tuning.ts"
import { FAST_FORWARD_LEAST_MS, SETTLED, closeToFinal, fastForwardStep, fastForwardWindow, settledTick } from "../src/view/fast-forward.ts"
import { openingEndMs } from "../src/view/ending.ts"
import { PulsePresenter } from "../src/view/pulse-live.ts"
import type { ResolvedPulse } from "../src/view/pulse-live.ts"
import type { PulseTimeline } from "../src/view/snapshot.ts"
import { FAST_FORWARD, FAST_FORWARD_LINE, pulseStatus } from "../src/view/pulse-scene.ts"
import { battleRoundScreen } from "./battle-round-frame.ts"
import { frameToText } from "../src/view/frame.ts"
import { buildSide, timed } from "./build-helpers.ts"

const HITS = new Set(["attack.launched", "damage.applied", "entity.died", "entity.detonated", "structure.destroyed"])

/** Round 1 of a Skirmish on the Crossing, Vasse against Vasse, each side's plan as given: the resolved round as the
 *  screen is handed it. */
function roundOf(A: BuildActions, B: BuildActions): PulseTimeline {
  const state: BattleState = beginBattle({ map: "crossing", seed: 1, rounds: 3, pulseTicks: 360, commanders: { A: "vasse", B: "vasse" } })
  const states: MatchState[] = []
  const events: DomainEvent[] = []
  let registry: ContentRegistry | null = null
  playRound(state, { A, B }, (battle, happened, content) => {
    states.push(battle)
    events.push(...happened)
    registry ??= content
  })
  const content = registry as unknown as ContentRegistry
  return timelineOf({ id: "fast-forward", name: "fast forward" }, states, [...spawnEvents(states[0] as MatchState, content), ...events], 360, 1, content)
}

const AT_HOME = roundOf({ power: 0, build: [], rally: "HOME_NEXUS" }, { power: 0, build: [], rally: "HOME_NEXUS" })
const FIGHT = roundOf({ power: 0, build: [], rally: "ENEMY_NEXUS" }, { power: 0, build: [], rally: "ENEMY_NEXUS" })

function resolvedOf(timeline: PulseTimeline): ResolvedPulse {
  const last = timeline.states[timeline.states.length - 1] as MatchState
  return { timeline, regroup: { state: last, paths: [], ticks: 0 }, nexus: null }
}

/** The second count of the owner's rule: how many units stand exactly where they end, within 1 tile, within 2, further. */
function apart(timeline: PulseTimeline, tick: number): Readonly<{ exact: number; near: number; far: number; beyond: number; of: number }> {
  const final = timeline.states[timeline.states.length - 1] as MatchState
  const now = timeline.states[tick] as MatchState
  const units = (state: MatchState) => state.entities.filter((entity) => timeline.registry.get(entity.contentId).layer !== "obstacles")
  const counts = { exact: 0, near: 0, far: 0, beyond: 0, of: 0 }
  for (const unit of units(final)) {
    counts.of += 1
    const was = units(now).find((entity) => entity.ordinal === unit.ordinal)
    const tiles = was === undefined ? 99 : Math.max(Math.abs(was.anchor.x - unit.anchor.x), Math.abs(was.anchor.y - unit.anchor.y))
    if (tiles === 0) counts.exact += 1
    else if (tiles === 1) counts.near += 1
    else if (tiles === 2) counts.far += 1
    else counts.beyond += 1
  }
  return counts
}

test("a round both sides hold at home settles: the first whole second after its last hit with the units close to where they end", () => {
  const settled = settledTick(AT_HOME)
  assert.notEqual(settled, null, "the round never settled")
  const tick = settled as number
  assert.equal(tick % AT_HOME.ticksPerSecond, 0, "not checked on a whole in-game second")
  assert.ok(tick < 360 - 5 * AT_HOME.ticksPerSecond, `settled only at tick ${tick}: nothing left to fast forward`)
  const lastHit = Math.max(-1, ...AT_HOME.events.filter((event) => HITS.has(event.kind)).map((event) => event.tick))
  assert.ok(tick >= lastHit, `settled at ${tick}, before the last hit at ${lastHit}`)
  // The second count: the owner's rule, unit by unit.
  const counts = apart(AT_HOME, tick)
  assert.ok(counts.of > 0, "no units in the round")
  assert.ok(counts.exact * 2 >= counts.of, `only ${counts.exact} of ${counts.of} exactly where they end`)
  assert.ok(counts.far <= 2 && counts.beyond === 0, `${counts.far} within 2 tiles, ${counts.beyond} further`)
  // The first: a second earlier the rule does not hold yet.
  if (tick > 0) {
    const before = apart(AT_HOME, tick - AT_HOME.ticksPerSecond)
    assert.ok(before.exact * 2 < before.of || before.far > 2 || before.beyond > 0, `already settled at ${tick - AT_HOME.ticksPerSecond}`)
  }
  assert.deepEqual(SETTLED, { exactShare: 0.5, nearTiles: 1, farTiles: 2, farMost: 2 })
})

test("a round with a fight to the end never fast-forwards", () => {
  const presenter = new PulsePresenter(resolvedOf(FIGHT))
  assert.equal(presenter.fastWindow, null, `a fight to the end fast-forwards from tick ${presenter.settled}`)
  presenter.advance(0)
  let now = 0
  while (presenter.phase() !== "home") {
    const before = presenter.timeMs
    now += 50
    presenter.advance(now)
    assert.ok(presenter.timeMs - before <= 50 + 1e-6, `faster than 1x at ${before} ms`)
    assert.equal(presenter.fastForward, false)
  }
})

test("the owner's rule: half exactly where they end, the rest within a tile, at most two within two", () => {
  const final = AT_HOME.states[AT_HOME.states.length - 1] as MatchState
  const units = final.entities.filter((entity) => AT_HOME.registry.get(entity.contentId).layer !== "obstacles")
  assert.ok(units.length >= 6, "the test wants six units at least")
  /** The final state with the first `count` units moved `dx` tiles across. */
  const shifted = (moves: readonly Readonly<{ count: number; dx: number }>[]): MatchState => {
    const by = new Map<number, number>()
    let index = 0
    for (const move of moves) for (let n = 0; n < move.count; n += 1) by.set((units[index++] as (typeof units)[number]).ordinal, move.dx)
    return { ...final, entities: final.entities.map((entity) => (by.has(entity.ordinal) ? { ...entity, anchor: { x: entity.anchor.x + (by.get(entity.ordinal) as number), y: entity.anchor.y } } : entity)) }
  }
  const half = Math.floor(units.length / 2)
  assert.equal(closeToFinal(final, final, AT_HOME.registry), true, "the final state is not close to itself")
  assert.equal(closeToFinal(shifted([{ count: units.length - half - 2, dx: 1 }, { count: 2, dx: 2 }]), final, AT_HOME.registry), true, "half exact, the rest within 1, two within 2")
  assert.equal(closeToFinal(shifted([{ count: units.length - half - 3, dx: 1 }, { count: 3, dx: 2 }]), final, AT_HOME.registry), false, "three within 2 tiles")
  assert.equal(closeToFinal(shifted([{ count: 1, dx: 3 }]), final, AT_HOME.registry), false, "one 3 tiles off")
  assert.equal(closeToFinal(shifted([{ count: half + 1, dx: 1 }]), final, AT_HOME.registry), false, "less than half exact")
  // A unit trained since is not where it ends.
  const missing = { ...final, entities: final.entities.filter((entity) => entity.ordinal !== units[0]?.ordinal) }
  assert.equal(closeToFinal(missing, final, AT_HOME.registry), false, "a unit not yet on the battlefield counted as there")
})

test("the clock: 8x from the settled tick until the last seconds, a step across an edge split there", () => {
  assert.equal(TUNING.fastForwardSpeed, 8)
  const window = { fromMs: 1000, untilMs: 2000 }
  assert.equal(fastForwardStep(0, 100, 1, window, 8), 100, "before the window")
  assert.equal(fastForwardStep(1000, 100, 1, window, 8), 800, "inside it")
  assert.equal(fastForwardStep(950, 100, 1, window, 8), 50 + 50 * 8, "into it")
  assert.equal(fastForwardStep(1900, 100, 1, window, 8), 100 + (100 - 100 / 8), "out of it")
  assert.equal(fastForwardStep(1000, 50, 2, window, 8), 800, "the player's speed times 8")
  assert.equal(fastForwardStep(1000, 100, 1, null, 8), 100, "no window")
  // From the settled tick, but never in the fight's first seconds, and never through the last.
  const times = { stopMs: 30_000, warnMs: 27_000, homeMs: 30_500 }
  assert.deepEqual(fastForwardWindow(72, 1000 / 12, times), { fromMs: 6000, untilMs: 27_000 })
  assert.deepEqual(fastForwardWindow(0, 1000 / 12, times), { fromMs: openingEndMs(times) as number, untilMs: 27_000 })
  assert.equal(fastForwardWindow(null, 1000 / 12, times), null)
  assert.equal(fastForwardWindow(12 * 26.5, 1000 / 12, times), null, `less than ${FAST_FORWARD_LEAST_MS} ms to skip`)
})

test("played: the settled round runs 8x from its settled tick, 1x through its ending, labelled while it runs fast", () => {
  const presenter = new PulsePresenter(resolvedOf(AT_HOME))
  const window = presenter.fastWindow
  assert.notEqual(window, null)
  const { fromMs, untilMs } = window as NonNullable<typeof window>
  assert.equal(fromMs, Math.max((presenter.settled as number) * (1000 / AT_HOME.ticksPerSecond), openingEndMs(presenter.times) ?? 0))
  assert.equal(untilMs, presenter.times.warnMs)
  presenter.advance(0)
  let now = 0
  const rates: Array<readonly [number, number]> = []
  while (presenter.phase() !== "home") {
    const before = presenter.timeMs
    const fast = presenter.fastForward
    now += 10
    presenter.advance(now)
    rates.push([before, (presenter.timeMs - before) / 10])
    assert.equal(fast, before >= fromMs && before < untilMs, `${before} ms: labelled ${fast}`)
  }
  for (const [at, rate] of rates) {
    if (at < fromMs - 10 || at >= untilMs) assert.ok(Math.abs(rate - 1) < 1e-6, `${at} ms: ${rate}x outside the settled part`)
    else if (at >= fromMs && at < untilMs - 80) assert.ok(Math.abs(rate - 8) < 1e-6, `${at} ms: ${rate}x in the settled part`)
  }
  // Real time: the settled part took an eighth of its length.
  const realFast = rates.filter(([at]) => at >= fromMs && at < untilMs).length * 10
  assert.ok(Math.abs(realFast - (untilMs - fromMs) / 8) <= 10, `the settled part took ${realFast} ms of ${untilMs - fromMs}`)
  // Nothing of the battle changed: the presenter plays the resolved round.
  assert.equal(presenter.resolved.timeline, AT_HOME)
})

test("the label: Fast forward beside the speed, and the bottom line says why and the way back, inside 80 columns", () => {
  // Seeking from the top in one step: at 8x, 50 ms past the start of the fast part lands 400 ms into it.
  const fast = battleRoundScreen(AT_HOME, { fastForwardSpeed: TUNING.fastForwardSpeed })
  const screen = battleRoundScreen(AT_HOME)
  const fromMs = (screen.presenter.fastWindow as NonNullable<PulsePresenter["fastWindow"]>).fromMs
  const text = frameToText(fast.frameAt(fromMs + 50, "monochrome"))
  assert.ok(fast.presenter.fastForward)
  assert.match(text, new RegExp(`time left  8x ${FAST_FORWARD}`))
  assert.ok(text.includes(FAST_FORWARD_LINE), "the bottom line does not say fast forward")
  assert.ok(FAST_FORWARD_LINE.length <= 78, `${FAST_FORWARD_LINE.length} columns`)
  assert.match(FAST_FORWARD_LINE, /Any key: normal speed\./)
  // Before it, and once it is over, neither.
  assert.doesNotMatch(frameToText(screen.frameAt(fromMs - 500, "monochrome")), /Fast forward/)
  assert.doesNotMatch(frameToText(screen.frameAt(screen.presenter.times.stopMs - 500, "monochrome")), /Fast forward/)
  // Paused, it says paused.
  const frame = screen.presenter.frame({ colors: "monochrome", reducedMotion: false })
  assert.match(pulseStatus({ ...frame, fastForward: true, paused: true }).text, /^Paused\./)
})

test("any key returns the round to normal speed for the rest of it, and still does its own work; Replay plays it fast again", () => {
  const resolved = resolvedOf(AT_HOME)
  const side = buildSide({ startPulse: () => resolved })
  // Start Battle Round, place the rally point: the round begins at 1000 ms.
  timed(side, [["s", 900], ["s", 1000]])
  const presenter = side.build.pulse as PulsePresenter
  assert.notEqual(presenter, null, "the round did not start")
  const fromMs = (presenter.fastWindow as NonNullable<PulsePresenter["fastWindow"]>).fromMs
  let now = 1000
  const step = (ms: number): void => {
    now += ms
    side.build.advance(now)
  }
  // A key before the fast part ends nothing.
  step(500)
  timed(side, [["\u001b[C", now]])
  while (!presenter.fastForward) step(10)
  assert.ok(presenter.timeMs >= fromMs)
  const before = presenter.timeMs
  step(100)
  assert.ok(Math.abs(presenter.timeMs - before - 800) < 1e-6, "not 8x")
  // Space: back to normal speed, and paused, as Space does.
  timed(side, [[" ", now]])
  assert.equal(presenter.fastForward, false)
  assert.equal(presenter.paused, true, "the key did not do its own work")
  timed(side, [[" ", now]])
  const after = presenter.timeMs
  step(100)
  assert.ok(Math.abs(presenter.timeMs - after - 100) < 1e-6, `not 1x after the key: ${presenter.timeMs - after}`)
  for (let ms = 0; ms < 5000; ms += 100) {
    step(100)
    assert.equal(presenter.fastForward, false, "fast again after the key")
  }
  // Replay from the top: fast forward plays again as it did the first time.
  timed(side, [["r", now]])
  while (!presenter.fastForward && presenter.timeMs < presenter.times.stopMs) step(10)
  assert.equal(presenter.fastForward, true, "Replay did not fast forward")
  // An arrow key ends it too, a click as well (the mouse adapter's press).
  timed(side, [["\u001b[A", now]])
  assert.equal(presenter.fastForward, false)
})
