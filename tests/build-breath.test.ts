// The Battle Round screen breathes (owner, 2026-09-30, feedback F80: "try a pulse effect on the border, it
// doesn't need to be intense, just relaxing turning a bit lighter and darker to create dynamism"): its
// border — and only its — slowly turns a little lighter and a little darker, one breath every "Battle Round
// pulse" Experiment milliseconds. Presentation alone: a pure function of the time the live loop hands the
// view, drawn at rest in every still frame, still under reduced motion and at colour depths with no blend
// to show it, and the frame timer runs for it only while the popup is open.

import { test } from "node:test"
import assert from "node:assert/strict"
import { popupSpec, placePopup } from "../src/build/popup.ts"
import { spikeContext } from "../src/cli/spike.ts"
import type { PopupBreath } from "../src/view/build.ts"
import { BREATH_DEPTH, breathLevel, breathStyle } from "../src/view/build-popup.ts"
import { BREATH_FRAME_MS, BuildAnimation, FRAME_MS, breathLengthMs, livePresentation, nextFrameDelay } from "../src/view/build-live.ts"
import type { Cell, ReadonlyCellFrame } from "../src/view/frame.ts"
import { cellAt } from "../src/view/frame.ts"
import type { CapabilityMode, Theme } from "../src/view/roles.ts"
import { CAPABILITY_MODES, resolveCell } from "../src/view/roles.ts"
import { ESC, buildSide, changedCells, compose, keys } from "./build-helpers.ts"
import type { Side } from "./build-helpers.ts"

const LENGTH = 2000

/** A Build Phase with a Nexus power picked and the Battle Round screen open, as `n 1 s` leaves it. */
function battleRound(experiments: Readonly<{ battleRoundPulseMs?: number }> = {}): Side {
  const side = buildSide({ context: { ...spikeContext(), experiments } })
  keys(side, "n", "1", "s")
  assert.equal(side.build.state.popup, "battle-round")
  return side
}

/** The cells of the open popup's border, less its title — what breathes. */
function borderCells(side: Side, frame: ReadonlyCellFrame): Readonly<{ x: number; y: number; cell: Cell }>[] {
  const spec = popupSpec(side.context, side.build.state)
  assert.ok(spec !== null)
  const { box } = placePopup(side.layout, spec)
  const cells: { x: number; y: number; cell: Cell }[] = []
  for (let y = box.top; y <= box.bottom; y += 1) {
    for (let x = box.left; x <= box.right; x += 1) {
      const edge = y === box.top || y === box.bottom || x === box.left || x === box.right
      const cell = cellAt(frame, x, y)
      if (edge && cell.style.fgRole === "chrome.frame") cells.push({ x, y, cell })
    }
  }
  assert.ok(cells.length > 20, "no border found")
  return cells
}

const breath = (elapsedMs: number, lengthMs = LENGTH): PopupBreath => ({ elapsedMs, lengthMs })

/** A resolved colour's brightness, the three channels summed. */
const brightness = (cell: Cell, capability: CapabilityMode, theme: Theme): number => {
  const fill = resolveCell(cell, capability, theme).background
  assert.ok(fill !== null, "an inverse border cell has a fill")
  return fill[0] + fill[1] + fill[2]
}

// --- The view: a pure function of the time -------------------------------------------------------------

test("a still frame draws the Battle Round screen's border at rest: inverse, in the frame's role, nothing more", () => {
  const side = battleRound()
  for (const { cell } of borderCells(side, compose(side, {}, "truecolor"))) {
    assert.deepEqual(cell.style, { fgRole: "chrome.frame", inverse: true })
  }
})

test("over one breath the border turns lighter, back to rest, darker, and back to rest — and nothing else changes", () => {
  const side = battleRound()
  const rest = compose(side, {}, "truecolor")
  const border = new Set(borderCells(side, rest).map(({ x, y }) => `${x},${y}`))
  const at = (elapsedMs: number) => compose(side, { popupBreath: breath(elapsedMs) }, "truecolor")
  // The quarter points: lightest, at rest half way, darkest, at rest at the end.
  assert.deepEqual(breathStyle(breath(LENGTH / 4)), { tint: { role: "chrome.title", amount: BREATH_DEPTH.lighter } })
  assert.deepEqual(breathStyle(breath(LENGTH / 2)), {})
  assert.deepEqual(breathStyle(breath((3 * LENGTH) / 4)), { fade: BREATH_DEPTH.darker })
  assert.deepEqual(at(0), rest, "the breath does not start at rest")
  assert.deepEqual(at(LENGTH / 2), rest, "half way is not at rest")
  assert.deepEqual(at(LENGTH), rest, "the breath does not return to rest")
  assert.deepEqual(at(LENGTH + LENGTH / 4), at(LENGTH / 4), "the next breath is not the same as the first")
  for (const elapsed of [LENGTH / 8, LENGTH / 4, (5 * LENGTH) / 8, (3 * LENGTH) / 4]) {
    const changed = changedCells(at(elapsed), rest)
    assert.ok(changed.length > 0, `${elapsed} ms: nothing breathes`)
    for (const { x, y, cell, was } of changed) {
      assert.ok(border.has(`${x},${y}`), `${elapsed} ms: ${x},${y} is not the border — the title, the shadow or the inside moved`)
      assert.equal(cell.glyph, was.glyph, "a breath changed a glyph")
    }
    assert.equal(changed.length, border.size, `${elapsed} ms: not every border cell breathes`)
  }
  // Smooth: never more than a small step between two frames the live loop draws.
  for (let elapsed = 0; elapsed < LENGTH; elapsed += BREATH_FRAME_MS) {
    assert.ok(Math.abs(breathLevel(breath(elapsed + BREATH_FRAME_MS)) - breathLevel(breath(elapsed))) < 0.2, `${elapsed} ms: a jolt`)
  }
})

test("lighter and darker are against the ground on both themes, at 256 colours and millions", () => {
  const side = battleRound()
  for (const capability of ["truecolor", "color256"] as const) {
    for (const theme of ["dark", "light"] as const) {
      const cellAtTime = (elapsed: number): Cell => {
        const frame = elapsed < 0 ? compose(side, {}, capability) : compose(side, { popupBreath: breath(elapsed) }, capability)
        return (borderCells(side, frame)[3] as { cell: Cell }).cell
      }
      const rest = brightness(cellAtTime(-1), capability, theme)
      const lightest = brightness(cellAtTime(LENGTH / 4), capability, theme)
      const darkest = brightness(cellAtTime((3 * LENGTH) / 4), capability, theme)
      // On a dark ground "stronger" is brighter; on a light one it is darker. Either way the breath swings
      // both sides of rest.
      const [stronger, softer] = theme === "dark" ? [lightest, darkest] : [darkest, lightest]
      assert.ok(stronger > rest, `${capability} ${theme}: the stronger half is not stronger (${stronger} vs ${rest})`)
      assert.ok(softer < rest, `${capability} ${theme}: the softer half is not softer (${softer} vs ${rest})`)
    }
  }
})

test("at 16 colours and in monochrome a breath cannot show, so the border does not flicker at all", () => {
  const side = battleRound()
  for (const capability of ["color16", "monochrome"] as const) {
    for (const theme of ["dark", "light"] as const) {
      const rest = resolveCell((borderCells(side, compose(side, {}, capability))[3] as { cell: Cell }).cell, capability, theme)
      for (let elapsed = 0; elapsed <= LENGTH; elapsed += 25) {
        const frame = compose(side, { popupBreath: breath(elapsed) }, capability)
        for (const { cell } of borderCells(side, frame)) {
          assert.deepEqual(resolveCell(cell, capability, theme), rest, `${capability} ${theme} at ${elapsed} ms`)
        }
      }
    }
  }
  // Because the depth stays under the half-way step a tint takes at 16 colours.
  assert.ok(BREATH_DEPTH.lighter < 0.5 && BREATH_DEPTH.darker < 0.5)
})

// --- The live loop: when it breathes, and the frame timer ----------------------------------------------

test("the live loop breathes the Battle Round screen from the frame that first shows it, at a modest frame rate", () => {
  const side = battleRound()
  const animation = new BuildAnimation()
  const first = animation.frame(side.build.state, 0)
  assert.deepEqual(first.popupBreath, breath(0), "the first frame showing the popup does not start a breath")
  // Start Pulse's row flashes "pressed" as the popup opens: every frame until that ends, then the breath's rate.
  assert.equal(first.frameMs, undefined, "the pressed flash was drawn at the breath's slower rate")
  assert.equal(nextFrameDelay(first.busyUntil, 0, first.frameMs), FRAME_MS)
  const later = animation.frame(side.build.state, 1234)
  assert.deepEqual(later.popupBreath, breath(1234))
  assert.deepEqual(livePresentation(later).popupBreath, breath(1234), "the view is not handed the breath")
  assert.equal(later.frameMs, BREATH_FRAME_MS)
  assert.equal(later.busyUntil, 1234 + BREATH_FRAME_MS, "the frame timer stopped while the popup breathes")
  assert.equal(nextFrameDelay(later.busyUntil, 1234, later.frameMs), BREATH_FRAME_MS)
  assert.ok(BREATH_FRAME_MS > FRAME_MS, "the breath redraws as often as a fast animation")
  // What it hands the view is what the view draws.
  const drawn = compose(side, livePresentation(later), "truecolor")
  assert.deepEqual(drawn, compose(side, { ...livePresentation(later), popupBreath: breath(1234) }, "truecolor"))
})

test("the frame timer stops the frame the Battle Round screen closes, and a screen opened again starts at rest", () => {
  const side = battleRound()
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  assert.notEqual(animation.frame(side.build.state, 1000).busyUntil, null)
  keys(side, ESC)
  assert.equal(side.build.state.popup, null)
  const closed = animation.frame(side.build.state, 1010)
  assert.equal(closed.popupBreath, undefined, "the closed popup still breathes")
  assert.equal(closed.frameMs, undefined)
  const settled = animation.frame(side.build.state, 3000)
  assert.equal(settled.busyUntil, null, "the frame timer kept running after the popup closed")
  assert.equal(nextFrameDelay(settled.busyUntil, 3000, settled.frameMs), null)
  // Opened again: a new breath, from rest.
  keys(side, "s")
  assert.equal(side.build.state.popup, "battle-round")
  assert.deepEqual(animation.frame(side.build.state, 5000).popupBreath, breath(0))
  assert.deepEqual(animation.frame(side.build.state, 5500).popupBreath, breath(500))
})

test("only the Battle Round screen breathes: no other popup, and nothing without one", () => {
  const side = buildSide()
  const animation = new BuildAnimation()
  const opening = animation.frame(side.build.state, 0)
  assert.equal(opening.popupBreath, undefined)
  keys(side, "n") // the Nexus popup
  assert.equal(side.build.state.popup, "nexus-powers")
  assert.equal(animation.frame(side.build.state, 1000).popupBreath, undefined)
  assert.equal(animation.frame(side.build.state, 3000).busyUntil, null)
  keys(side, "1", ESC, "s") // the game menu, then Settings over it
  assert.equal(side.build.state.popup, "settings")
  assert.equal(animation.frame(side.build.state, 4000).popupBreath, undefined)
  assert.equal(breathLengthMs({ ...side.build.state, popup: "battle-round" }, false), LENGTH)
})

test("the Experiment at 0, reduced motion, or a colour depth that cannot show it keep the border still and the timer quiet", () => {
  const cases: ReadonlyArray<readonly [string, Side, Readonly<{ reducedMotion?: boolean; capability?: CapabilityMode }>]> = [
    ["Battle Round pulse off", battleRound({ battleRoundPulseMs: 0 }), {}],
    ["reduced motion", battleRound(), { reducedMotion: true }],
    ...CAPABILITY_MODES.filter((mode) => mode === "color16" || mode === "monochrome").map(
      (capability) => [capability, battleRound(), { capability }] as const,
    ),
  ]
  for (const [name, side, options] of cases) {
    const animation = new BuildAnimation()
    animation.frame(side.build.state, 0, options)
    for (const now of [1000, 1500, 2250]) {
      const live = animation.frame(side.build.state, now, options)
      assert.equal(live.popupBreath, undefined, `${name}: the border breathes at ${now} ms`)
      assert.equal(live.busyUntil, null, `${name}: the frame timer runs at ${now} ms`)
      assert.deepEqual(compose(side, livePresentation(live), "truecolor"), compose(side, {}, "truecolor"), `${name}: not at rest`)
    }
  }
  // And where it does show, a shorter breath is a shorter breath.
  const quick = battleRound({ battleRoundPulseMs: 1200 })
  const animation = new BuildAnimation()
  animation.frame(quick.build.state, 0, { capability: "color256" })
  assert.deepEqual(animation.frame(quick.build.state, 300, { capability: "color256" }).popupBreath, breath(300, 1200))
})

test("the frame timer's delay honours a slower frame, and still lands on an animation's end", () => {
  assert.equal(nextFrameDelay(1050, 1000, BREATH_FRAME_MS), BREATH_FRAME_MS)
  assert.equal(nextFrameDelay(1005, 1000, BREATH_FRAME_MS), 5)
  assert.equal(nextFrameDelay(1050, 1000), FRAME_MS, "without a frame length, every frame")
  assert.equal(nextFrameDelay(null, 1000, BREATH_FRAME_MS), null)
})
