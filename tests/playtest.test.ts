// The scripted playtest (`scripts/playtest.mjs`): readable key names become the exact bytes a
// terminal sends, each goes through the real adapters on its own, and every step's frame is kept.
// No Chromium here — the pictures are the script's business; what is tested is that a script does
// what it says.

import { test } from "node:test"
import assert from "node:assert/strict"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { frameToText } from "../src/view/frame.ts"

const ESC = String.fromCharCode(27)

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

test("the owner's menu flow — Down, Down, then Space four times — plans two hatcheries", () => {
  const run = runBuildPlaytest({ steps: parseKeyScript("Down Down Space*4") })
  assert.equal(run.frames.length, 7, "the opening screen plus one frame per key")
  const states = run.frames.map((frame) => frame.state)
  // Arming from the menu moves focus to the Grid; placing sends it back to the menu.
  assert.deepEqual(
    states.map((state) => state.focus),
    ["menu", "menu", "menu", "grid", "menu", "grid", "menu"],
  )
  assert.deepEqual(
    states.map((state) => state.planned.length),
    [0, 0, 0, 0, 1, 1, 2],
  )
  const final = frameToText(run.frames[6]!.frame)
  assert.match(final, /hatch planned at 21,13 for 30\./)
  assert.match(final, /RESOURCE\s+40 of 100/)
  assert.equal(run.ended, null)
})

test("a click on a tile goes through the mouse adapter at wherever that tile is drawn", () => {
  // Arm Barracks by its digit, then click the same tile twice: the first click moves the cursor
  // there, the second places.
  const run = runBuildPlaytest({ steps: parseKeyScript("n 1 n 1 click:30,10 click:30,10") })
  const last = run.frames[run.frames.length - 1]!
  assert.equal(last.state.planned.length, 1)
  assert.match(frameToText(last.frame), /barracks planned at 30,10/)
  assert.match(last.bytes, /^\u001b\[<0;\d+;\d+M\u001b\[<0;\d+;\d+m$/u, "a press and then a release")
})

test("leaving the screen stops the script and says how many steps were not run", () => {
  const run = runBuildPlaytest({ steps: parseKeyScript("Tab q Down Down") })
  assert.deepEqual(run.ended, { by: "quit", atStep: 2, skipped: 2 })
  assert.equal(run.frames.length, 3)
})

test("a terminal below the 80x24 floor is refused rather than played", () => {
  assert.throws(() => runBuildPlaytest({ steps: [], columns: 79, rows: 24 }), /below/)
})
