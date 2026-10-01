// The interpolation toolkit (`src/view/tween.ts`): pure functions of time, retargeting from where a
// tween is drawn, whole tiles for a point. The camera's slide and the cursor's glide are built on it
// and tested through the screen (`build-motion.test.ts`); this pins the module's own contract, since
// animations and effects lean on it too (docs/system-design/effects.md).

import { test } from "node:test"
import assert from "node:assert/strict"
import { EASINGS, numberAt, retarget, samePoint, still, tileAt, tweenActive, tweenEnd, tweenProgress } from "../src/view/tween.ts"
import type { Point, Tween } from "../src/view/tween.ts"

const rise = (durationMs: number, easing: keyof typeof EASINGS = "linear"): Tween<number> => ({
  from: 0,
  to: 100,
  startMs: 1000,
  durationMs,
  easing,
})

test("every easing starts at 0, ends at 1 and stays inside [0,1]", () => {
  for (const [name, ease] of Object.entries(EASINGS)) {
    assert.equal(ease(0), 0, `${name} does not start at 0`)
    assert.equal(ease(1), 1, `${name} does not end at 1`)
    assert.equal(ease(-5), 0, `${name} did not clamp below 0`)
    assert.equal(ease(7), 1, `${name} did not clamp above 1`)
    for (let step = 0; step <= 20; step += 1) {
      const value = ease(step / 20)
      assert.ok(value >= 0 && value <= 1, `${name}(${step / 20}) = ${value}`)
    }
  }
})

test("easeOut is fast at first and settles; easeInOut is slow at both ends", () => {
  assert.ok(EASINGS.easeOut(0.25) > 0.5, "ease-out should have covered most of the way early")
  assert.ok(EASINGS.easeInOut(0.1) < 0.1 && EASINGS.easeInOut(0.9) > 0.9)
  assert.equal(EASINGS.easeInOut(0.5), 0.5)
})

test("a tween is a pure function of absolute time, in any order", () => {
  const tween = rise(200)
  const times = [1000, 1050, 1100, 1150, 1200, 900, 5000, 1100]
  const forwards = times.map((now) => numberAt(tween, now))
  const again = [...times].reverse().map((now) => numberAt(tween, now)).reverse()
  assert.deepEqual(forwards, again)
  assert.equal(numberAt(tween, 900), 0, "before it starts it is at its start")
  assert.equal(numberAt(tween, 1100), 50)
  assert.equal(numberAt(tween, 5000), 100, "after it ends it is at its end")
})

test("no duration means already there; progress and activity follow the window", () => {
  const instant = rise(0)
  assert.equal(numberAt(instant, 1000), 100)
  assert.equal(tweenActive(instant, 1000), false)
  const tween = rise(200, "easeOut")
  assert.equal(tweenProgress(tween, 1000), 0)
  assert.equal(tweenProgress(tween, 1200), 1)
  assert.equal(tweenActive(tween, 1199), true)
  assert.equal(tweenActive(tween, 1200), false)
  assert.equal(tweenEnd(tween), 1200)
  assert.equal(tweenEnd(instant), 1000, "an instant tween ends where it starts")
})

test("a point moves in whole tiles and lands exactly", () => {
  const glide: Tween<Point> = { from: { x: 0, y: 0 }, to: { x: 12, y: 5 }, startMs: 0, durationMs: 100, easing: "linear" }
  for (let now = 0; now <= 100; now += 7) {
    const at = tileAt(glide, now)
    assert.ok(Number.isInteger(at.x) && Number.isInteger(at.y), `half a tile at ${now} ms: ${at.x},${at.y}`)
  }
  assert.deepEqual(tileAt(glide, 50), { x: 6, y: 3 })
  assert.deepEqual(tileAt(glide, 100), { x: 12, y: 5 })
})

test("retargeting starts from wherever the tween is drawn, and does nothing to the same target", () => {
  const first: Tween<Point> = { from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, startMs: 0, durationMs: 100, easing: "linear" }
  const same = retarget(first, { x: 10, y: 0 }, 40, 100, tileAt, samePoint)
  assert.equal(same, first, "an unchanged target must not restart the tween")
  const second = retarget(first, { x: 0, y: 8 }, 50, 100, tileAt, samePoint)
  assert.deepEqual(second.from, { x: 5, y: 0 }, "it should continue from the drawn position, not snap")
  assert.equal(second.startMs, 50)
  assert.deepEqual(tileAt(second, 50), { x: 5, y: 0 })
  assert.deepEqual(tileAt(second, 150), { x: 0, y: 8 })
  // Retargeting to exactly where it is drawn is instant: nothing to animate.
  const resting = still({ x: 3, y: 3 }, 0)
  const nowhere = retarget(resting, { x: 3, y: 3 }, 10, 100, tileAt, samePoint)
  assert.equal(tweenActive(nowhere, 11), false)
})
