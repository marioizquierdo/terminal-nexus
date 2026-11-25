// Straight on (the owner, 2026-11-25: "When the battle ends, it will be nice that it goes directly to build mode ...
// which means you immediately see the units retreating"): with the Next round Experiment on its default, `straight`,
// a round whose battle goes on opens the next Build Phase the moment its fight stops, with no result to close; a
// battle won or lost still stops on its result.

import { test } from "node:test"
import assert from "node:assert/strict"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { playtestOpening, runBuildPlaytest } from "../src/playtest/build.ts"
import { frameToText } from "../src/view/frame.ts"
import { defaultExperiments } from "../src/build/experiments.ts"
import { withoutScene } from "../src/build/state.ts"
import { buildLayout } from "../src/build/layout.ts"
import { createBuildState, nexusTile } from "../src/build/state.ts"
import { newSkirmishLevel } from "../src/cli/skirmish-play.ts"
import { PulsePresenter } from "../src/view/pulse-live.ts"
import type { ResolvedPulse } from "../src/view/pulse-live.ts"

test("Next round goes straight on by default", () => {
  assert.equal(defaultExperiments().nextRound, "straight")
})

test("a round whose battle goes on opens the next Build Phase as its fight stops: no result to close", { timeout: 60_000 }, () => {
  const steps = parseKeyScript("Esc n 1 1 Enter s s wait~1000*36")
  const run = runBuildPlaytest({ steps, at: playtestOpening({ at: "skirmish?seed=1" }).at })
  const texts = run.frames.map((frame) => frameToText(frame.frame))
  assert.ok(texts.every((text) => !/\[enter\] Next round/u.test(text)), "a result asked for Enter")
  const last = texts[texts.length - 1] as string
  assert.match(last, /build phase - round 2 of 8/u)
  // The round ended on the battlefield before the Build Phase opened: some frame showed the Battle Round.
  assert.ok(texts.some((text) => /battle round/u.test(text)), "the Battle Round was never shown")
})

/** Round 1 of a Skirmish, its Pulse resolved, with the round's verdict as `verdict`. */
function resolvedWith(verdict: "continue" | "won"): ResolvedPulse {
  const level = newSkirmishLevel(1, { newSeed: () => 4242 })
  const context = withoutScene(level.firstRound())
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.terrain).viewport
  const state = createBuildState(context, nexusTile(context) ?? { x: 0, y: 0 }, viewport)
  const resolved = level.play.startPulse(context, state)
  assert.ok(resolved !== null && resolved.mission !== undefined)
  return verdict === "continue" ? resolved : { ...resolved, mission: { ...resolved.mission, verdict: { kind: "won", trigger: "test" } } }
}

/** The moments a presenter asks to move on, run to well past its ending. */
function movesOn(presenter: PulsePresenter): readonly number[] {
  const at: number[] = []
  for (let now = 0; now <= presenter.times.homeMs + 10_000; now += 100) {
    presenter.advance(now)
    if (presenter.due().some((command) => command.kind === "next-round")) at.push(presenter.timeMs)
  }
  return at
}

test("straight on moves on once, as the fight stops; a battle won or lost waits on its result", { timeout: 60_000 }, () => {
  const going = new PulsePresenter(resolvedWith("continue"), undefined, { straight: true })
  const moved = movesOn(going)
  assert.equal(moved.length, 1, "it moved on more than once, or never")
  assert.ok((moved[0] as number) >= going.times.stopMs && (moved[0] as number) < going.times.homeMs, `moved on at ${moved[0]} ms, not between the stop and the result`)

  const over = new PulsePresenter(resolvedWith("won"), undefined, { straight: true })
  assert.deepEqual(movesOn(over), [], "a battle that is over moved on without its result")
  assert.equal(over.canMoveOn(), true, "the result, once up, could not be closed")

  const manual = new PulsePresenter(resolvedWith("continue"), undefined, { straight: false })
  assert.deepEqual(movesOn(manual), [], "manual moved on by itself")
})

// --- Replay last battle (the owner: "when you're in build mode, you should be able to replay the previous battle if
// you want to ... in the general menu") ------------------------------------------------------------------------------

test("Replay last battle: refused before any battle; after one, the game menu plays it again and Enter comes back", { timeout: 120_000 }, () => {
  const before = runBuildPlaytest({ steps: parseKeyScript("Esc Esc b"), at: playtestOpening({ at: "skirmish?seed=1" }).at })
  const first = before.frames[before.frames.length - 1]!
  assert.equal(first.state.replayRequests, 0)
  assert.match(first.state.status.text, /No battle to replay yet/u)

  const steps = parseKeyScript("Esc n 1 s Enter wait~1000*36 Esc Esc b wait~1000*36 Enter")
  const run = runBuildPlaytest({ steps, at: playtestOpening({ at: "skirmish?seed=1" }).at })
  const texts = run.frames.map((frame) => frameToText(frame.frame))
  const menu = texts.findIndex((text, index) => index > 0 && /\[b\] Replay last battle/u.test(text) && /round 2 of 8/u.test(text))
  assert.ok(menu > 0, "the game menu in round 2 did not offer the replay")
  const replay = texts.slice(menu + 1)
  assert.ok(replay.some((text) => /battle round/u.test(text)), "b did not play a Battle Round")
  assert.ok(replay.some((text) => /A replay of round 1\./u.test(text) && /\[enter\] Build Phase/u.test(text)), "the replay's result did not say what it was")
  const last = run.frames[run.frames.length - 1]!
  assert.match(texts[texts.length - 1] as string, /build phase - round 2 of 8/u)
  assert.equal(last.state.pulseNumber, 2, "the replay moved the battle on")
  assert.equal(last.state.canReplay, true, "the replay was forgotten")
})
