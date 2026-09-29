// The presentation toolkit's Animations (src/view/animation.ts): an animation is frames and a little
// metadata, and a track's frame at any instant is a pure function of the requests made of it. Only
// `play` is used live today (a building going up); the rest is held to its contract here so the next
// use — a unit's attack interrupting its walk, a fast-forwarded Pulse — is a request, not a new system.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  accelerate,
  animationOf,
  cancel,
  finish,
  frameGlyph,
  frameIndexAt,
  play,
  scheduleTrack,
  trackBusyAt,
  trackEffectsAt,
  trackFrameAt,
} from "../src/view/animation.ts"
import type { Animation, FollowUp, TrackRequest, TrackSchedule } from "../src/view/animation.ts"

/** Four one-tile frames, 100 ms each: `a`, `b`, `c`, `d`. */
const ABCD = animationOf("abcd", [["a"], ["b"], ["c"], ["d"]], 400)
/** Two frames, 100 ms each: `x`, `y`. */
const XY = animationOf("xy", [["x"], ["y"]], 200)

/** What the track draws at one tile at `t`: its glyph, or `-` for nothing (the entity's own art). */
function glyphAt(schedule: TrackSchedule, t: number): string {
  const drawn = trackFrameAt(schedule, t)
  return drawn === null ? "-" : frameGlyph(drawn.frame, { x: 0, y: 0 }) ?? " "
}

/** The track sampled every 50 ms from `from` to `to`, as one string. */
function strip(requests: readonly TrackRequest[], from: number, to: number): string {
  const schedule = scheduleTrack(requests)
  let out = ""
  for (let t = from; t < to; t += 50) out += glyphAt(schedule, t)
  return out
}

const spark = (delayMs = 0): FollowUp => ({
  kind: "effect",
  delayMs,
  effect: { recipe: "fx.sparks.burst", band: "effects", durationMs: 300, origin: { x: 4, y: 4 }, family: "neutral", params: {} },
})

// --- The asset ------------------------------------------------------------------------------------

test("an animation's frames share its duration equally, or by weight", () => {
  assert.deepEqual([0, 99, 100, 250, 399].map((t) => frameIndexAt(ABCD, t)), [0, 0, 1, 2, 3])
  const weighted: Animation = { ...ABCD, frames: ABCD.frames.map((frame, i) => (i === 0 ? { ...frame, weight: 5 } : frame)) }
  // 5 : 1 : 1 : 1 over 400 ms — the first frame holds 250 ms.
  assert.deepEqual([0, 249, 250, 300, 350].map((t) => frameIndexAt(weighted, t)), [0, 0, 1, 2, 3])
})

test("after its last frame an animation clears, holds, or loops", () => {
  assert.equal(frameIndexAt(ABCD, 400), null)
  assert.equal(frameIndexAt({ ...ABCD, end: "hold" }, 5_000), 3)
  assert.deepEqual([400, 550, 800].map((t) => frameIndexAt({ ...ABCD, end: "loop" }, t)), [0, 1, 0])
  // A zero-length animation passes at once: nothing to draw, or its last frame held.
  assert.equal(frameIndexAt({ ...ABCD, durationMs: 0 }, 0), null)
  assert.equal(frameIndexAt({ ...ABCD, durationMs: 0, end: "hold" }, 0), 3)
})

test("a space in a frame is transparent", () => {
  const frame = { rows: [". ", "|_"] }
  assert.equal(frameGlyph(frame, { x: 0, y: 0 }), ".")
  assert.equal(frameGlyph(frame, { x: 1, y: 0 }), null)
  assert.equal(frameGlyph(frame, { x: 5, y: 5 }), null)
})

// --- play and its stacking policies -----------------------------------------------------------------

test("play: nothing before it, its frames in order, then the entity's own art", () => {
  assert.equal(strip([play(ABCD, 100)], 0, 600), "--aabbccdd--")
})

test("replace (the default) cancels what is playing and starts over — its follow-ups never happen", () => {
  const requests = [play(ABCD, 0, { then: [spark()] }), play(XY, 150)]
  assert.equal(strip(requests, 0, 450), "aabxxyy--")
  assert.deepEqual(scheduleTrack(requests).effects, [])
})

test("queue starts after the current one ends, and the first one's follow-ups fire at its end", () => {
  const requests = [play(ABCD, 0, { then: [spark()] }), play(XY, 150, { policy: "queue" })]
  assert.equal(strip(requests, 0, 700), "aabbccddxxyy--")
  const schedule = scheduleTrack(requests)
  assert.deepEqual(schedule.effects.map((effect) => effect.startMs), [400])
  assert.equal(schedule.runs[1]?.startMs, 400)
})

test("ignore drops a request while something plays, and plays it once nothing does", () => {
  assert.equal(strip([play(ABCD, 0), play(XY, 150, { policy: "ignore" })], 0, 500), "aabbccdd--")
  assert.equal(strip([play(ABCD, 0), play(XY, 450, { policy: "ignore" })], 0, 750), "aabbccdd-xxyy--")
})

test("a held last frame is not playing: queue and ignore start at once over it", () => {
  const held = { ...ABCD, end: "hold" as const }
  assert.equal(strip([play(held, 0), play(XY, 500, { policy: "ignore" })], 0, 800), "aabbccddddxxyy--")
  assert.equal(strip([play(held, 0)], 300, 1_000), "dddddddddddddd")
})

// --- cancel, accelerate, finish ---------------------------------------------------------------------

test("cancel stops at once, drops what was queued, and fires no follow-ups", () => {
  const requests = [play(ABCD, 0, { then: [spark()] }), play(XY, 50, { policy: "queue" }), cancel(150)]
  assert.equal(strip(requests, 0, 700), "aab-----------")
  assert.deepEqual(scheduleTrack(requests).effects, [])
})

test("accelerate changes pace from that instant without a jump, and moves the end — and its follow-ups", () => {
  const requests = [play(ABCD, 0, { then: [spark()] }), accelerate(200, 2)]
  // Normal pace to 200 ms (frame c), then twice as fast: c and d take 50 ms each, so it ends at 300.
  assert.equal(strip(requests, 0, 400), "aabbcd--")
  const schedule = scheduleTrack(requests)
  assert.equal(glyphAt(schedule, 200), glyphAt(scheduleTrack([play(ABCD, 0)]), 200), "the change jumped")
  assert.deepEqual(schedule.effects.map((effect) => effect.startMs), [300])
  // Slowed to half, it ends later; paused, it never ends and the track never settles.
  assert.equal(scheduleTrack([play(ABCD, 0), accelerate(200, 0.5)]).runs[0]?.completedMs, 600)
  const paused = scheduleTrack([play(ABCD, 0, { then: [spark()] }), accelerate(200, 0)])
  assert.equal(glyphAt(paused, 10_000), "c")
  assert.equal(paused.effects.length, 0)
  assert.equal(paused.settlesAtMs, Number.POSITIVE_INFINITY)
  // A play can start at its own speed.
  assert.equal(strip([play(ABCD, 0, { speed: 2 })], 0, 300), "abcd--")
})

test("finish jumps to the end now: follow-ups fire then, a held animation shows its last frame", () => {
  const requests = [play(ABCD, 0, { then: [spark()] }), finish(120)]
  assert.equal(strip(requests, 0, 300), "aab---")
  assert.deepEqual(scheduleTrack(requests).effects.map((effect) => effect.startMs), [120])
  assert.equal(strip([play({ ...ABCD, end: "hold" }, 0), finish(120)], 0, 300), "aabddd")
  // A loop ends only when finished.
  const loop = { ...XY, end: "loop" as const }
  assert.equal(strip([play(loop, 0)], 0, 600), "xxyyxxyyxxyy")
  assert.equal(strip([play(loop, 0), finish(250)], 0, 450), "xxyyx----")
  assert.equal(scheduleTrack([play(loop, 0)]).settlesAtMs, Number.POSITIVE_INFINITY)
})

// --- Completion as data -------------------------------------------------------------------------------

test("follow-ups are data scheduled at the completion time: effects and further plays, with a delay", () => {
  const requests = [
    play(ABCD, 0, { then: [spark(50), { kind: "play", delayMs: 100, play: { animation: XY } }] }),
  ]
  assert.equal(strip(requests, 0, 800), "aabbccdd--xxyy--")
  const schedule = scheduleTrack(requests)
  assert.deepEqual(schedule.effects.map((effect) => [effect.recipe, effect.startMs]), [["fx.sparks.burst", 450]])
  assert.deepEqual(trackEffectsAt(schedule, 449), [])
  assert.equal(trackEffectsAt(schedule, 450).length, 1)
  assert.equal(trackEffectsAt(schedule, 750).length, 0)
  // Settles when the last thing ends: the chained play at 700, the sparks at 750.
  assert.equal(schedule.settlesAtMs, 750)
  assert.equal(trackBusyAt(schedule, 749), true)
  assert.equal(trackBusyAt(schedule, 750), false)
})

test("a follow-up that plays itself for ever is cut off rather than hanging the frame", () => {
  const zero = animationOf("zero", [["z"]], 0)
  const request: { kind: "play"; atMs: number; animation: Animation; then: FollowUp[] } = { kind: "play", atMs: 0, animation: zero, then: [] }
  request.then.push({ kind: "play", play: request })
  const schedule = scheduleTrack([request])
  assert.equal(schedule.settlesAtMs, Number.POSITIVE_INFINITY)
})

// --- Purity ----------------------------------------------------------------------------------------

test("a track's frame is a pure function of its requests and the time, in any order", () => {
  const requests: TrackRequest[] = [
    play(ABCD, 0, { then: [spark()] }),
    play(XY, 120, { policy: "queue" }),
    accelerate(250, 3),
    play(ABCD, 900),
    finish(1_000),
  ]
  const times = Array.from({ length: 60 }, (_unused, i) => i * 20)
  const forward = times.map((t) => glyphAt(scheduleTrack(requests), t))
  const shuffled = [...times].sort((a, b) => ((a * 7919) % 61) - ((b * 7919) % 61))
  const once = scheduleTrack(requests)
  const sampled = new Map(shuffled.map((t) => [t, glyphAt(once, t)]))
  assert.deepEqual(times.map((t) => sampled.get(t)), forward)
  // The same requests given in another order schedule the same way: time orders them, not the list.
  assert.deepEqual(times.map((t) => glyphAt(scheduleTrack([...requests].reverse()), t)), forward)
})

test("a request never changes a frame before its own time", () => {
  const base: TrackRequest[] = [play(ABCD, 0), play(XY, 100, { policy: "queue" })]
  const later: TrackRequest[] = [cancel(260), play(ABCD, 300), accelerate(310, 4), finish(330)]
  const all = scheduleTrack([...base, ...later])
  for (let cut = 0; cut < later.length; cut += 1) {
    // Everything before the first request left out is drawn exactly as with every request in.
    const some = scheduleTrack([...base, ...later.slice(0, cut)])
    const leftOutFrom = later[cut]?.atMs ?? 0
    for (let t = 0; t < leftOutFrom; t += 10) {
      assert.equal(glyphAt(some, t), glyphAt(all, t), `a request at ${leftOutFrom} ms changed the frame at ${t} ms`)
    }
  }
})
