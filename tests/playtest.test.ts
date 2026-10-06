// The scripted playtest (`scripts/playtest.mjs`): readable key names become the exact bytes a
// terminal sends, each goes through the real adapters on its own, and every step's frame is kept.
// No Chromium here — the pictures are the script's business; what is tested is that a script does
// what it says.

import { test } from "node:test"
import assert from "node:assert/strict"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { frameToText } from "../src/view/frame.ts"
import { ESC } from "./build-helpers.ts"
import { DEFENCE_KEYS } from "./pulse-helpers.ts"


test("key names map to the bytes a real terminal sends", () => {
  const steps = parseKeyScript("Up S-Left M-Right Tab Esc Enter Space Bksp PgDn q 1")
  assert.deepEqual(
    steps.map((step) => (step.kind === "key" ? step.bytes : null)),
    [`${ESC}[A`, `${ESC}[1;2D`, `${ESC}${ESC}[C`, "\t", ESC, "\r", " ", "\u007f", `${ESC}[6~`, "q", "1"],
  )
})

test("a repeat, a comment and a mouse click parse into separate steps", () => {
  const steps = parseKeyScript("Down*3  # three times\nclick:20,13 rclick@4,5")
  assert.equal(steps.length, 5)
  assert.deepEqual(steps[3], { kind: "mouse", label: "click:20,13", button: 0, target: { kind: "tile", tile: { x: 20, y: 13 } } })
  assert.deepEqual(steps[4], { kind: "mouse", label: "rclick@4,5", button: 2, target: { kind: "cell", column: 4, row: 5 } })
})

test("an unknown key name fails loudly instead of becoming some other key", () => {
  assert.throws(() => parseKeyScript("Down Dwn"), /unknown key "Dwn"/)
})

test("the owner's menu flow — Down three times, then Space four times — plans two hatcheries", () => {
  // Nexus, Explore, Barracks, Hatchery: the menu gained an Explore entry under Nexus (2026-09-27).
  const run = runBuildPlaytest({ scenes: false, steps: parseKeyScript("Down*3 Space*4") })
  assert.equal(run.frames.length, 8, "the opening screen plus one frame per key")
  const states = run.frames.map((frame) => frame.state)
  // Arming from the menu moves focus to the Grid; placing sends it back to the menu.
  assert.deepEqual(
    states.map((state) => state.focus),
    ["menu", "menu", "menu", "menu", "grid", "menu", "grid", "menu"],
  )
  assert.deepEqual(
    states.map((state) => state.planned.length),
    [0, 0, 0, 0, 0, 1, 1, 2],
  )
  const final = frameToText(run.frames[7]!.frame)
  assert.match(final, /Hatchery placed \(resources: 40\) - \[u\] undo/)
  assert.match(final, /\* 40[|+]/)
  assert.equal(run.ended, null)
})

test("a click on a tile goes through the mouse adapter at wherever that tile is drawn", () => {
  // Pick a Nexus power (which closes its popup), arm Barracks by its digit, then click the same tile twice: the first click moves the cursor
  // there, the second places — south of the standing Barracks, inside the build range.
  const run = runBuildPlaytest({ scenes: false, steps: parseKeyScript("n 1 1 click:26,13 click:26,13") })
  const last = run.frames[run.frames.length - 1]!
  assert.equal(last.state.planned.length, 1)
  assert.match(frameToText(last.frame), /Barracks placed \(resources: 90\)/)
  assert.match(last.bytes, /^\u001b\[<0;\d+;\d+M\u001b\[<0;\d+;\d+m$/u, "a press and then a release")
})

test("leaving the screen stops the script and says how many steps were not run", () => {
  // q asks "Exit the game?" first; its own q is what leaves.
  const run = runBuildPlaytest({ scenes: false, steps: parseKeyScript("Tab q q Down Down") })
  assert.deepEqual(run.ended, { by: "quit", atStep: 3, skipped: 2 })
  assert.equal(run.frames.length, 4)
})

test("a terminal below the 80x24 floor is refused rather than played", () => {
  assert.throws(() => runBuildPlaytest({ steps: [], columns: 79, rows: 24 }), /below/)
})

test("wait is a step where nothing is pressed and time passes: a second by default, or the milliseconds given", () => {
  const steps = parseKeyScript("wait wait~4000 Wait~250*2 Down")
  assert.deepEqual(
    steps.map((step) => [step.kind, step.label, step.afterMs]),
    [
      ["wait", "wait", undefined],
      ["wait", "wait~4000", 4000],
      ["wait", "Wait~250", 250],
      ["wait", "Wait~250", 250],
      ["key", "Down", undefined],
    ],
  )
})

test("a scripted playtest plays a Nexus Pulse on the script's own clock and shows every phase of its ending", () => {
  // A Nexus power, two Turrets and a Hatchery, the commit and its confirmation; then the script lets it play.
  const plan = `${DEFENCE_KEYS} s s`
  // Quarter-second frames, so the half-second cease fire is never stepped over.
  const run = runBuildPlaytest({ scenes: false, steps: parseKeyScript(`${plan} wait~250*104`) })
  const texts = run.frames.map((frame) => frameToText(frame.frame))
  const started = texts.findIndex((text) => text.includes("battle round"))
  assert.ok(started > 0, "the script never reached the Pulse")
  // The frame right after the second `s` is the Pulse's own first moment, already looking at the Nexus.
  assert.match(texts[started]!, /^\| BATTLE ROUND 1 +0:22 /m)
  // Centred on the Nexus's own tile (the position readout that once said so is gone).
  const first = run.frames[started]!.state
  assert.deepEqual(first.cursor, { x: 18, y: 10 })
  assert.equal(first.camera.y, first.cursor.y - Math.floor((first.viewport.height - 1) / 2))
  const seen = [/^\| BATTLE ROUND /m, /The battle is about to end\./, /^\| CEASE FIRE /m, /^\| RECALL /m, /^\| VICTORY /m].map((phase) =>
    texts.findIndex((text) => phase.test(text)),
  )
  assert.ok(seen.every((index) => index >= 0), `a phase never appeared: ${JSON.stringify(seen)}`)
  assert.deepEqual([...seen].sort((a, b) => a - b), seen, "the phases did not come in order")
})
