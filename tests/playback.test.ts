// Playback controls and the resize gate — engine.md 9.6 (RULE) and milestone 3.8.

import { test } from "node:test"
import assert from "node:assert/strict"
import { Playback, compositionSize, controlForKey, keysFromChunk } from "../src/view/index.ts"

const TICK_MS = 1000 / 12
const FRAME_MS = 1000 / 30

function playback(): Playback {
  return new Playback({ tickDurationMs: TICK_MS, frameDurationMs: FRAME_MS })
}

test("presentation time advances with real time, scaled by speed", () => {
  const clock = playback()
  clock.advance(100)
  assert.equal(clock.presentationTimeMs, 100)

  clock.apply("faster")
  assert.equal(clock.speed, 2)
  clock.advance(100)
  assert.equal(clock.presentationTimeMs, 300)

  clock.apply("slower")
  clock.apply("slower")
  assert.equal(clock.speed, 0.5)
  clock.advance(100)
  assert.equal(clock.presentationTimeMs, 350)
})

test("speed is clamped at both ends", () => {
  const clock = playback()
  for (let index = 0; index < 10; index += 1) clock.apply("faster")
  assert.equal(clock.speed, 8)
  for (let index = 0; index < 20; index += 1) clock.apply("slower")
  assert.equal(clock.speed, 0.25)
})

test("pause holds time still, and stepping moves it by exactly one frame or one tick", () => {
  const clock = playback()
  clock.advance(500)
  clock.apply("toggle")
  assert.equal(clock.paused, true)

  clock.advance(1000)
  assert.equal(clock.presentationTimeMs, 500, "a paused session advanced with the wall clock")

  clock.apply("step-frame")
  assert.equal(clock.presentationTimeMs, 500 + FRAME_MS)
  clock.apply("step-tick")
  assert.equal(clock.presentationTimeMs, 500 + FRAME_MS + TICK_MS)

  clock.apply("resume")
  assert.equal(clock.paused, false)
  clock.advance(100)
  assert.equal(clock.presentationTimeMs, 600 + FRAME_MS + TICK_MS)
})

test("restart returns to the beginning without touching speed", () => {
  const clock = playback()
  clock.apply("faster")
  clock.advance(5000)
  clock.apply("restart")
  assert.equal(clock.presentationTimeMs, 0)
  assert.equal(clock.speed, 2)
})

test("the resize gate freezes presentation time and resumes from the same instant", () => {
  const required = compositionSize(1)
  const clock = playback()
  clock.fit(80, 24, required)
  assert.equal(clock.gated, false)

  clock.advance(1000)
  const frozenAt = clock.presentationTimeMs
  assert.equal(frozenAt, 1000)

  // The viewer drags the terminal narrower.
  clock.fit(60, 24, required)
  assert.equal(clock.gated, true)
  clock.advance(5000)
  clock.advance(5000)
  assert.equal(clock.presentationTimeMs, frozenAt, "presentation time ran while the gate was up")

  // Stepping is inert behind the gate: it is not a pause the viewer chose.
  clock.apply("step-tick")
  clock.apply("step-frame")
  assert.equal(clock.presentationTimeMs, frozenAt)

  // And back.
  clock.fit(80, 24, required)
  assert.equal(clock.gated, false)
  clock.advance(250)
  assert.equal(
    clock.presentationTimeMs,
    frozenAt + 250,
    "playback did not resume from the same presentation time",
  )
})

test("too few rows gates just as too few columns does", () => {
  const required = compositionSize(1)
  const clock = playback()
  clock.fit(80, 23, required)
  assert.equal(clock.gated, true)
  clock.fit(79, 24, required)
  assert.equal(clock.gated, true)
  clock.fit(200, 60, required)
  assert.equal(clock.gated, false)
})

test("the key map covers every control the milestone lists", () => {
  assert.equal(controlForKey("q"), "quit")
  assert.equal(controlForKey(String.fromCharCode(3)), "quit")
  assert.equal(controlForKey(" "), "toggle")
  assert.equal(controlForKey("."), "step-frame")
  assert.equal(controlForKey(","), "step-tick")
  assert.equal(controlForKey("]"), "faster")
  assert.equal(controlForKey("["), "slower")
  assert.equal(controlForKey("r"), "restart")
  assert.equal(controlForKey("z"), null)
})

test("a chunk of input is several keys, and an escape sequence is one", () => {
  // A terminal delivers what it has, not one key per read. Driving the view through a pseudo-
  // terminal showed this the hard way: ten step-a-tick presses arrived as one ten-byte chunk and
  // every one of them was dropped.
  assert.deepEqual(keysFromChunk(",,,"), [",", ",", ","])
  assert.deepEqual(keysFromChunk(" q"), [" ", "q"])
  assert.deepEqual(keysFromChunk(""), [])

  const escape = String.fromCharCode(27)
  assert.deepEqual(keysFromChunk(`${escape}[A`), [`${escape}[A`], "an arrow key was split apart")
  assert.equal(controlForKey(`${escape}[A`), null)
})

test("stepping a chunk of ticks advances by exactly that many ticks", () => {
  const clock = playback()
  clock.apply("pause")
  for (const key of keysFromChunk(",,,,,")) {
    const control = controlForKey(key)
    if (control !== null && control !== "quit") clock.apply(control)
  }
  assert.equal(clock.presentationTimeMs, TICK_MS * 5)
})
