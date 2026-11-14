// openSave (src/skirmish/request.ts): the one way a door opens a Skirmish save. Slots seated, a build file read
// through readFile with its problems returned, a battle over opened under a round limit below its end, the command and
// the screen opening a save to the same setup, and a sandbox refused.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { positionOf } from "../src/cli/skirmish-play.ts"
import { openSkirmish } from "../src/cli/skirmish-open.ts"
import { playOn } from "../src/skirmish/play.ts"
import { readProfiles } from "../src/skirmish/profile-files.ts"
import { newBattle, openSave } from "../src/skirmish/request.ts"
import { readSave, saveOf } from "../src/skirmish/save.ts"
import { slotAsk } from "../src/skirmish/slots.ts"
import { REPO_ROOT } from "./helpers.ts"

const profiles = readProfiles()

test("a new battle opened with slot changes seats them", () => {
  const opened = openSave(newBattle({ map: "pocket" }, profiles), { slots: { p2: { ask: slotAsk("script:agro", profiles) } }, profiles })
  assert.equal(opened.setup.slots.p2.controller, "script:agro")
  assert.equal(opened.state.round, 1)
  assert.equal(opened.state.result, null)
})

test("a build file comes through readFile, its problems returned, not thrown", () => {
  const readFile = (): string => JSON.stringify([{ round: "soon", build: [] }])
  const opened = openSave(newBattle({ map: "pocket" }, profiles), { slots: { p1: { ask: slotAsk("build:x.json", profiles) } }, readFile, profiles })
  assert.ok(opened.seated.fromFile.has("p1"))
  assert.match(opened.seated.problems[0]!, /entry 1: "round" should be a round/)
})

test("a build file named with no readFile is refused", () => {
  assert.throws(() => openSave(newBattle({ map: "pocket" }, profiles), { slots: { p1: { ask: slotAsk("build:x.json", profiles) } }, profiles }), /no files to read x\.json from/)
})

test("a battle over takes a round limit below the round it ended in", { timeout: 60_000 }, () => {
  const scripts = { p1: { ask: slotAsk("script:agro", profiles) }, p2: { ask: slotAsk("script:agro", profiles) } }
  const opened = openSave(newBattle({ map: "pocket" }, profiles), { slots: scripts, rules: { rounds: 2 }, profiles })
  const ran = playOn(opened.setup, opened.state, {}, Number.POSITIVE_INFINITY, profiles)
  assert.notEqual(ran.state.result, null)
  assert.ok(ran.state.round >= 2)
  const again = openSave(saveOf(opened.setup, ran.state), { rules: { rounds: 1 }, profiles })
  assert.equal(again.setup.rounds, 1)
})

test("the command and the screen open a save to the same setup", () => {
  const path = join(REPO_ROOT, "saves", "crossing-round-4.save.json")
  const save = readSave(readFileSync(path, "utf8"), profiles).save!
  const command = openSave(save, { slots: {}, profiles })
  const level = openSkirmish({ load: path }, { readFile: (file) => readFileSync(file, "utf8"), profiles })
  assert.equal(level.kind, "level")
  const screen = positionOf((level as unknown as { level: { firstRound: () => Parameters<typeof positionOf>[0] } }).level.firstRound()).setup
  assert.deepEqual(screen, command.setup)
})

test("a sandbox is refused", () => {
  const dir = join(REPO_ROOT, "sandboxes", "rules")
  const file = readdirSync(dir).find((name) => name.endsWith(".save.json"))!
  const save = readSave(readFileSync(join(dir, file), "utf8"), profiles).save!
  assert.throws(() => openSave(save, { profiles }), /sandbox/)
})

test("a save from another map is refused at open, naming the save, the map and the first unit that does not fit", () => {
  const path = join(REPO_ROOT, "saves", "crossing-round-4.save.json")
  const parsed = JSON.parse(readFileSync(path, "utf8"))
  const other = JSON.stringify({ ...parsed, setup: { ...parsed.setup, map: "pocket" } })
  const message = /othermap\.save\.json does not fit its map: .* stands at \d+,\d+, which is outside the map pocket/
  assert.throws(() => openSave(readSave(other, profiles).save!, { profiles, file: "othermap.save.json" }), message)
  // The screen's door refuses the same way.
  assert.throws(() => openSkirmish({ load: "othermap.save.json" }, { readFile: () => other, profiles }), message)
})
