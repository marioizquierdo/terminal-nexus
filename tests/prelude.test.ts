// The prelude (the owner, 2026-11-26, docs/history/feedback/2026-11-25-rally-point.md, F331 and F332): on Enter the
// rally arrows run at once for both sides, and before the fight's first tick the enemy's new buildings and units appear
// one by one with the Build Phase's placement animation, nearest their own Nexus first, one every 200 ms; then the
// fight. Presentation only. And the fight's first seconds are marked as its last are (F333). `src/view/prelude.ts`,
// `src/view/pulse-live.ts`, `src/view/ending.ts`.
//
// Measurements held here (written before the change):
//   - Enter to the fight's first tick = the prelude's length: 0 with nothing new; else (n - 1) x step + the placement's
//     frames and light (300 + 400 ms), the step 200 ms, closer when there are more than 10, so the reveals never take
//     more than 2000 ms to start (at most 2700 ms in all). Counted twice: from the plan, and as the presenter's fight
//     clock standing at 0 until then;
//   - the reveals: as many as the enemy's entities in the opening less those the Build Phase's map showed, counted again
//     by ordinal;
//   - the first seconds: the border light and the timer's flash on from the fight's first tick for as long as the last
//     seconds last (3000 ms), off between.

import { test } from "node:test"
import assert from "node:assert/strict"
import { centreOn } from "../src/build/camera.ts"
import { buildLayout } from "../src/build/layout.ts"
import { createBuildState, nexusTile, withoutScene } from "../src/build/state.ts"
import type { BuildContext } from "../src/build/state.ts"
import { TUNING } from "../src/build/tuning.ts"
import { newSkirmishLevel } from "../src/cli/skirmish-play.ts"
import { tileDistance } from "../src/engine/geometry/coords.ts"
import { hashState } from "../src/engine/state/serialize.ts"
import type { MatchState } from "../src/engine/state/types.ts"
import { beamFrame, endingTimes, openingEndMs, timerLit } from "../src/view/ending.ts"
import { PulsePresenter } from "../src/view/pulse-live.ts"
import type { ResolvedPulse } from "../src/view/pulse-live.ts"
import type { KnownMap } from "../src/view/prelude.ts"
import { REVEAL_SPAN_MS, REVEAL_STEP_MS, newEnemies, preludeAt, preludePlan } from "../src/view/prelude.ts"
import { readFileSync } from "node:fs"
import { readBuildActions } from "../src/battle/index.ts"
import { planOnRound, playedOf, skirmishLevel } from "../src/cli/skirmish-play.ts"
import { readSave } from "../src/skirmish/save.ts"
import { readProfiles } from "../src/skirmish/profile-files.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { playtestOpening, runBuildPlaytest } from "../src/playtest/build.ts"

/** Round 1 of a Skirmish on the Crossing, nothing built by the player: the enemy's script builds its first buildings. */
function round(): Readonly<{ context: BuildContext; resolved: ResolvedPulse; known: KnownMap }> {
  const level = newSkirmishLevel(1, { newSeed: () => 4242 })
  const context = withoutScene(level.firstRound())
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.terrain).viewport
  const state = createBuildState(context, nexusTile(context) ?? { x: 0, y: 0 }, viewport)
  const resolved = level.play.startPulse(context, state)
  assert.ok(resolved !== null)
  return { context, resolved, known: { standing: context.standing, field: context.field ?? [], incoming: context.incoming ?? [] } }
}

const ROUND = round()
const opening = ROUND.resolved.timeline.states[0] as MatchState
const registry = ROUND.resolved.timeline.registry

test("the reveals are the enemy's entities the Build Phase's map did not show, nearest their own Nexus first", () => {
  const fresh = newEnemies(opening, registry, ROUND.known)
  assert.ok(fresh.length > 0, "the enemy built nothing new: the test proves nothing")
  // The second count: the enemy's entities in the opening, less those on the Build Phase's map by ordinal or by place.
  const shown = new Set((ROUND.context.field ?? []).filter((entity) => entity.player === "B").map((entity) => `${entity.contentId}@${entity.anchor.x},${entity.anchor.y}`))
  const theirs = opening.entities.filter((entity) => entity.player === "B" && !shown.has(`${entity.contentId}@${entity.anchor.x},${entity.anchor.y}`))
  // ...and less those foreseen coming (drawn see-through on the Build Phase's map), one of each kind for each.
  const foreseen = (ROUND.context.incoming ?? []).filter((entity) => entity.player === "B").length
  assert.equal(fresh.length, theirs.length - foreseen)
  assert.ok(fresh.every((entity) => entity.player === "B"), "a reveal of the player's own")
  const nexus = opening.entities.find((entity) => entity.player === "B" && registry.get(entity.contentId).nexus === true)
  assert.ok(nexus !== undefined)
  const distances = fresh.map((entity) => tileDistance(nexus.anchor, entity.anchor))
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b), "not nearest the Nexus first")
  // What was foreseen is no news, and nothing new means no prelude.
  const all = { ...ROUND.known, field: [...ROUND.known.field, ...fresh.map((entity) => ({ contentId: entity.contentId, anchor: entity.anchor, player: entity.player }))] }
  assert.equal(preludePlan(opening, registry, all).lengthMs, 0)
})

test("Enter to the fight's first tick: the reveals 200 ms apart, the last one settled; the fight's clock at 0 until then", () => {
  const plan = preludePlan(opening, registry, ROUND.known)
  const n = plan.steps.length
  const step = n <= 1 ? 0 : Math.min(REVEAL_STEP_MS, REVEAL_SPAN_MS / (n - 1))
  assert.equal(plan.lengthMs, Math.round((n - 1) * step) + TUNING.placeFramesMs + TUNING.placeGlowMs)
  assert.ok(plan.lengthMs <= REVEAL_SPAN_MS + TUNING.placeFramesMs + TUNING.placeGlowMs)
  plan.steps.forEach((each, index) => assert.equal(each.atMs, Math.round(index * step)))
  // The second count: the presenter's fight clock.
  const presenter = new PulsePresenter(ROUND.resolved, undefined, { known: ROUND.known })
  assert.equal(presenter.prelude.lengthMs, plan.lengthMs)
  presenter.advance(0)
  presenter.advance(plan.lengthMs - 1)
  assert.equal(presenter.timeMs, 0, "the fight started before the prelude ended")
  presenter.advance(plan.lengthMs + 100)
  assert.equal(presenter.timeMs, 100)
  // Without the Build Phase's map (a watched replay of nothing, a test), no prelude.
  assert.equal(new PulsePresenter(ROUND.resolved).prelude.lengthMs, 0)
})

test("one by one: what is still to come is not drawn, what rises plays its going-up frames, and the arrows run meanwhile", () => {
  const presenter = new PulsePresenter(ROUND.resolved, undefined, { known: ROUND.known })
  const plan = presenter.prelude
  const at = (ms: number) => {
    presenter.apply("restart")
    presenter.advance(0)
    presenter.advance(ms)
    return presenter.frame({ colors: "truecolor", reducedMotion: false })
  }
  const first = at(10)
  assert.ok(first.prelude !== undefined)
  assert.equal(first.prelude.hidden.size, plan.steps.length - 1, "more than the first is showing")
  assert.ok(first.prelude.rising.has(plan.steps[0]!.ordinal))
  assert.ok((first.rally ?? []).length > 0, "the rally arrows waited for the prelude")
  assert.equal(first.cursorHidden, true, "the cursor stayed on Enter")
  assert.ok(first.prelude.effects.length >= 0)
  const last = plan.steps[plan.steps.length - 1]!
  assert.equal(at(last.atMs + 1).prelude?.hidden.size, 0)
  assert.equal(at(plan.lengthMs + 1).prelude, undefined, "the prelude outlived its length")
})

test("the prelude changes nothing the round did", () => {
  const hashes = ROUND.resolved.timeline.states.map((state) => hashState(state))
  const presenter = new PulsePresenter(ROUND.resolved, undefined, { known: ROUND.known })
  presenter.advance(0)
  for (let ms = 0; ms < presenter.prelude.lengthMs + 2000; ms += 50) {
    presenter.advance(ms)
    presenter.frame({ colors: "truecolor", reducedMotion: false })
  }
  assert.deepEqual(ROUND.resolved.timeline.states.map((state) => hashState(state)), hashes)
})

test("a Skirmish's clash plays in the prelude: the round's report handed on, the building thrown down before the fight", { timeout: 120_000 }, () => {
  // Round 7, Vasse against the agro script: the plan's Turret at 22,16 is where the enemy builds this round
  // (tests/round-losses.test.ts).
  const profiles = readProfiles()
  const read = readSave(readFileSync(new URL("./fixtures/clash-turret.save.json", import.meta.url), "utf8"), profiles)
  assert.ok(read.save !== null, read.problems.join("; "))
  const level = skirmishLevel(read.save, {}, { profiles })
  const context = withoutScene(level.firstRound())
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.terrain).viewport
  const opened = createBuildState(context, nexusTile(context) ?? { x: 0, y: 0 }, viewport)
  const plan = readBuildActions(read.save.draft?.p1 ?? {}).actions
  const planned = planOnRound(context, opened, plan, level.play.keep as NonNullable<typeof level.play.keep>)
  const resolved = level.play.startPulse(planned.context, planned.state)
  assert.ok(resolved !== null)
  const played = playedOf(resolved)
  assert.ok(played !== undefined && played.report.clashes.length > 0, "the fixture no longer clashes")
  assert.deepEqual(resolved.clashes, played.report.clashes, "the report's clashes were not handed on")
  const known: KnownMap = { standing: planned.context.standing, field: planned.context.field ?? [], incoming: planned.context.incoming ?? [] }
  const presenter = new PulsePresenter(resolved, undefined, { known })
  const clashSteps = presenter.prelude.steps.filter((each) => each.kind === "clash")
  assert.deepEqual(clashSteps.map((each) => [each.player, each.contentId, each.anchor]), played.report.clashes.map((clash) => [clash.side, clash.contentId, clash.anchor]))
  assert.ok(presenter.prelude.lengthMs > 0)
  // Thrown down with sparks as the round begins, before the fight's first tick.
  presenter.advance(0)
  presenter.advance(clashSteps[0]!.atMs + 50)
  assert.equal(presenter.timeMs, 0)
  const frame = presenter.frame({ colors: "truecolor", reducedMotion: false })
  assert.ok((frame.prelude?.effects.length ?? 0) > 0, "no sparks where the clash was")
})

test("the clashes hook: each clash goes first, standing until its turn, then thrown down with sparks", () => {
  const nexus = opening.entities.find((entity) => entity.player === "A" && registry.get(entity.contentId).nexus !== true && registry.get(entity.contentId).layer === "obstacles")
  const contentId = nexus?.contentId ?? newEnemies(opening, registry, ROUND.known)[0]!.contentId
  const clashes = [
    { side: "A" as const, contentId, anchor: { x: 20, y: 10 } },
    { side: "B" as const, contentId, anchor: { x: 22, y: 10 } },
  ]
  const plan = preludePlan(opening, registry, ROUND.known, clashes)
  assert.deepEqual(plan.steps.slice(0, 2).map((each) => each.kind), ["clash", "clash"])
  const second = plan.steps[1]!
  const before = preludeAt(plan, second.atMs - 1, registry, false, "truecolor")
  assert.deepEqual(before?.clashing.map((each) => each.anchor), [clashes[1]!.anchor], "the second clash is not standing before its turn")
  const after = preludeAt(plan, second.atMs + 10, registry, false, "truecolor")
  assert.equal(after?.clashing.length, 0)
  assert.ok((after?.effects.length ?? 0) > 0, "no sparks as it is thrown down")
})

test("the first seconds are marked as the last are: the light and the timer's flash, and none between", () => {
  const times = endingTimes(15_000, 15_000)
  assert.equal(openingEndMs(times), TUNING.endWarnMs)
  const length = 100
  assert.ok(beamFrame(times, 500, length, false) !== null, "no light in the first seconds")
  assert.equal(beamFrame(times, TUNING.endWarnMs + 500, length, false), null, "light between the first and the last seconds")
  assert.ok(beamFrame(times, times.warnMs! + 500, length, false) !== null)
  assert.equal(timerLit(times, 10, false), true)
  assert.equal(timerLit(times, 310, false), false, "the timer does not flash in the first seconds")
  assert.equal(timerLit(times, TUNING.endWarnMs + 10, false), false)
  // Reduced motion: lit and steady, as the last seconds are.
  assert.equal(timerLit(times, 310, true), true)
  assert.equal(beamFrame(times, 500, length, true)?.steady, true)
  // A fight shorter than both windows: the last seconds win from where they start.
  const short = endingTimes(4000, 4000)
  assert.equal(openingEndMs(short), short.warnMs)
})

// --- The prelude's camera (the rally point session's leftover: "during the prelude the camera stays on the player's
// Nexus, so on a large map the enemy's new buildings can come in off screen"). The Prelude camera Experiment: the view goes
// to the enemy's new buildings as Enter plays them, and back to the player's Nexus as the fight's first tick comes.
//
// Measured before and after on both maps, 8 seeds, 6 rounds each (scripted battles, 80 x 24, the prelude's steps on screen
// at the moment it starts): the Crossing 22 of 262 (8%), the Pocket 296 of 296 (it fits the view whole); after: 262 of 262
// and 296 of 296, the longest prelude 2500 ms both times (2026-11-26, before and after in the pull request).

const VIEWPORT = buildLayout({ columns: 80, rows: 24 }, ROUND.context.terrain).viewport
/** How many of the prelude's steps a camera shows, by each step's place in the view. */
const stepsIn = (camera: { x: number; y: number }, steps: readonly { anchor: { x: number; y: number } }[]): number =>
  steps.filter((step) => step.anchor.x - camera.x >= 0 && step.anchor.x - camera.x < VIEWPORT.width && step.anchor.y - camera.y >= 0 && step.anchor.y - camera.y < VIEWPORT.height).length

test("the prelude's camera: to the view that shows the new buildings at Enter, back to the Nexus as the fight begins, once each", () => {
  const nexus = ROUND.resolved.nexus
  assert.ok(nexus !== null)
  const home = centreOn(nexus, VIEWPORT, ROUND.context.terrain)
  const presenter = new PulsePresenter(ROUND.resolved, undefined, { known: ROUND.known })
  const steps = presenter.prelude.steps
  assert.ok(steps.length > 0 && stepsIn(home, steps) < steps.length, "the Nexus's view already shows every reveal: the test proves nothing")
  presenter.advance(0)
  const first = presenter.due(VIEWPORT)
  assert.equal(first.length, 1)
  const look = first[0]!
  assert.equal(look.kind, "look-at")
  if (look.kind !== "look-at") return
  assert.equal(stepsIn(centreOn(look, VIEWPORT, ROUND.context.terrain), steps), steps.length, "a reveal is off screen")
  // Held through the reveals, then back on the Nexus once the fight's first tick comes — and not again.
  presenter.advance(presenter.prelude.lengthMs - 1)
  assert.deepEqual(presenter.due(VIEWPORT), [])
  presenter.advance(presenter.prelude.lengthMs)
  assert.deepEqual(presenter.due(VIEWPORT), [{ kind: "look-at", x: nexus.x, y: nexus.y }])
  presenter.advance(presenter.prelude.lengthMs + 500)
  assert.deepEqual(presenter.due(VIEWPORT), [])
  // Replay from the top: the view goes to the reveals again.
  presenter.apply("restart")
  presenter.advance(0)
  assert.deepEqual(presenter.due(VIEWPORT), [look])
})

test("the Prelude camera Experiment off, or nothing new: the view goes to the Nexus at once, as it always did", () => {
  const nexus = ROUND.resolved.nexus!
  const home = { kind: "look-at", x: nexus.x, y: nexus.y }
  const stays = new PulsePresenter(ROUND.resolved, undefined, { known: ROUND.known })
  stays.advance(0)
  assert.deepEqual(stays.due(null), [home])
  stays.advance(stays.prelude.lengthMs + 100)
  assert.deepEqual(stays.due(null), [], "it looked at the Nexus again with nothing to come back from")
  // No prelude (no map to compare with): nothing to look at, even asked to.
  const none = new PulsePresenter(ROUND.resolved)
  assert.equal(none.prelude.lengthMs, 0)
  none.advance(0)
  assert.deepEqual(none.due(VIEWPORT), [home])
})

test("the Prelude camera on the screen: the view is on the enemy's side through the prelude, on the Nexus as the fight begins; off, always on the Nexus", () => {
  const at = playtestOpening({ at: "skirmish?seed=7" }).at
  const steps = parseKeyScript("Esc s wait~400*3 Enter wait~100*16")
  const enter = steps.findIndex((step) => step.label === "Enter") + 1
  const follow = runBuildPlaytest({ steps, at })
  const stay = runBuildPlaytest({ steps, at, experiments: { preludeCamera: "stay" } })
  const cameras = (run: typeof follow) => run.frames.slice(enter).map((frame) => frame.state.camera)
  const home = cameras(stay)[0]!
  assert.ok(cameras(stay).every((camera) => camera.x === home.x && camera.y === home.y), "'yours' moved the view")
  // Through the prelude (a second, here) the view is east of the Nexus's; after it, back where the Nexus is.
  const during = cameras(follow)
  assert.ok(during[0]!.x > home.x, "the view did not go to the enemy's new buildings at Enter")
  const last = during[during.length - 1]!
  assert.deepEqual(last, home, "the view did not come back to the Nexus for the fight")
})
