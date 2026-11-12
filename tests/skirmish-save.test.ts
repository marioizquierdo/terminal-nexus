// Skirmish save files and the `skirmish` command (docs/system-design/skirmish-saves.md). Here: a battle saved after any
// round and loaded plays on exactly as the battle played straight through; a save the loader refuses names every
// problem at once; the command checks a plan without building it, plays a round and saves, keeps a slot's controller
// across a load, keeps a plan as the save's draft, and refuses what a loaded battle cannot change; and every save
// checked in loads and plays a round.

import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { EXIT, main } from "../src/cli/skirmish.ts"
import type { DuelState } from "../src/duel/index.ts"
import { briefOf, playRound, SCRIPTED } from "../src/duel/index.ts"
import { spawnSync } from "node:child_process"
import { duelOf, newSetup, readSave, saveOf, saveText } from "../src/skirmish/save.ts"
import { openBattle } from "../src/skirmish/opening/open.ts"
import { loadTestingSave, testingSaveCatalog } from "../src/skirmish/testing-saves.ts"
import { hashOf } from "../src/state/canonical.ts"
import { REPO_ROOT } from "./helpers.ts"

const SAVES = join(REPO_ROOT, "saves")

/** One round, side A by the balanced script and side B by rush. */
const round = (state: DuelState): DuelState => playRound(state, { A: SCRIPTED.balanced!(briefOf(state, "A").data), B: SCRIPTED.rush!(briefOf(state, "B").data) }).state

/** Runs the command, returning its exit code and what it wrote; when it could not run (exit 1), throws what it said. */
function run(args: readonly string[]): Readonly<{ code: number; out: string }> {
  const lines: string[] = []
  const failed: string[] = []
  const code = main(args, (line) => lines.push(line), undefined, (line) => failed.push(line))
  if (code === EXIT.failed) throw new Error(failed.join("\n"))
  return { code, out: lines.join("\n") }
}

test("a battle saved after every round and loaded plays on as the battle played straight through", { timeout: 60_000 }, () => {
  const setup = newSetup({ map: "crossing", seed: 3, rounds: 4, roundTicks: 240 })
  let straight = duelOf(saveOf(setup, duelOf({ format: "terminal-nexus.save/1", setup })))
  let saved = straight
  for (let index = 0; index < 4 && straight.result === null; index += 1) {
    straight = round(straight)
    const read = readSave(saveText(saveOf(setup, round(saved))))
    assert.deepEqual(read.problems, [])
    saved = duelOf(read.save!)
    assert.equal(hashOf(saved), hashOf(straight), `round ${index + 1}: the loaded battle differs from the one played straight through`)
  }
  // The ground is the map's, never the save's.
  assert.ok(!saveText(saveOf(setup, saved)).includes('"tiles"'), "a save carried the Grid's ground")
})

test("a save the loader refuses names every problem at once", () => {
  const { save, problems } = readSave(
    JSON.stringify({
      format: "terminal-nexus.save/0",
      setup: { map: "nowhere", seed: 1.5, goal: "economy", modifiers: ["triple-income"], rounds: 0, roundTicks: 360, slots: { p1: { commander: "nobody", controller: "player" }, p2: { commander: "dob", controller: "script:nope" }, p3: {} } },
      draft: { p1: { build: "barracks" } },
    }),
  )
  assert.equal(save, null)
  for (const part of ["format", "setup.map", "setup.seed", "setup.goal", "setup.modifiers", "setup.rounds", "setup.slots.p1.commander", "setup.slots.p2.controller", "setup.slots.p3", "draft.p1"]) {
    assert.ok(problems.some((problem) => problem.startsWith(part)), `nothing said about ${part}: ${problems.join(" | ")}`)
  }
  assert.deepEqual(readSave("{ not json").save, null)
})

test("skirmish: a plan is checked without building, a round is played and saved, and a load keeps the slots' controllers", { timeout: 60_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "skirmish-"))
  try {
    const plan = join(dir, "build.json")
    writeFileSync(plan, JSON.stringify({ build: [{ building: "barracks", at: "forward" }, { building: "garrison" }], stance: "attack" }))
    const save = join(dir, "s.save.json")

    // No plan: p1's brief. A plan: checked, the refusal said with its reason, and the exit code says so.
    const brief = run(["--map", "crossing", "--p1", "build:", "--p2", "script:rush"])
    assert.equal(brief.code, 0)
    assert.match(brief.out, /--- brief for p1 \(west, vasse, player\)/)
    const checked = run(["--map", "crossing", "--p1", `build:${plan}`, "--p2", "script:rush"])
    assert.equal(checked.code, EXIT.refused)
    assert.match(checked.out, /builds barracks at/)
    assert.match(checked.out, /REFUSED garrison: needs Barracks/)

    // A folder means the build.json in it; --battle plays the round, --save writes the next Build Phase.
    const played = run(["--map", "crossing", "--p1", `build:${dir}`, "--p2", "script:rush", "--battle", "--save", save])
    assert.equal(played.code, 0)
    assert.match(played.out, /round 1: ended/)
    assert.match(played.out, /saved .* at round 2's Build Phase/)
    const written = readSave(readFileSync(save, "utf8")).save!
    assert.deepEqual([written.state?.round, written.setup.slots.p1.controller, written.setup.slots.p2.controller], [2, "player", "script:rush"])

    // Loaded with no slots named: the player's brief; with them swapped: the other's.
    assert.match(run(["--load", save]).out, /brief for p1/)
    assert.match(run(["--load", save, "--p1", "script:", "--p2", "build:"]).out, /brief for p2 \(east, dob, player\)/)

    // A plan kept as the draft, no battle; then -f plays it and saves over the file.
    writeFileSync(plan, JSON.stringify({ build: [{ building: "turret" }], stance: "attack" }))
    run(["--load", save, `--p1=build:${plan}`, "--save", save])
    assert.equal(readSave(readFileSync(save, "utf8")).save!.draft?.p1?.build[0]?.building, "turret")
    const fromDraft = run(["-f", save, "--battle"])
    assert.match(fromDraft.out, /p1 vasse: .* built 1/)
    const after = readSave(readFileSync(save, "utf8")).save!
    assert.deepEqual([after.state?.round, after.draft], [3, undefined])

    // What a loaded battle keeps, and an option nobody knows, are refused by name.
    assert.throws(() => run(["--load", save, "--p1-commander", "averno"]), /keeps its Commanders/)
    assert.throws(() => run(["--load", save, "--map", "crossing"]), /keeps its map/)
    assert.throws(() => run(["--load", save, "--battel"]), /no option --battel/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("skirmish: two scripts play a battle to its end, a round a command", { timeout: 60_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "skirmish-"))
  try {
    const save = join(dir, "s.save.json")
    run(["--map", "pocket", "--p1", "script:rush", "--p2", "script:turtle", "--rounds", "3", "--battle", "--save", save])
    for (let index = 0; index < 3 && readSave(readFileSync(save, "utf8")).save!.state?.result === null; index += 1) run(["-f", save, "--battle"])
    const over = readSave(readFileSync(save, "utf8")).save!
    assert.notEqual(over.state?.result, null, "three rounds did not end a three-round battle")
    assert.throws(() => run(["-f", save, "--battle"]), /the battle is over/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("the JSON Schema names the loader's fields and nothing else", () => {
  const schema = JSON.parse(readFileSync(join(SAVES, "save.schema.json"), "utf8")) as { properties: Record<string, { properties?: Record<string, unknown> }> }
  assert.deepEqual(Object.keys(schema.properties).sort(), ["draft", "format", "name", "notes", "setup", "start", "state"])
  assert.deepEqual(Object.keys(schema.properties["setup"]!.properties!).sort(), Object.keys(newSetup({})).sort())
})

test("every save checked in loads and plays its next round", { timeout: 120_000 }, () => {
  const files = readdirSync(SAVES).filter((name) => name.endsWith(".save.json"))
  assert.ok(files.length >= 4, `only ${files.length} saves in saves/`)
  for (const file of files) {
    const { save, problems } = readSave(readFileSync(join(SAVES, file), "utf8"))
    assert.deepEqual(problems, [], file)
    const state = duelOf(save!)
    if (state.result === null) assert.equal(round(state).round, state.round + 1, file)
    // Written by the game, a save reads back byte for byte.
    assert.equal(saveText(save!), readFileSync(join(SAVES, file), "utf8"), `${file} is not as the game writes it: run node scripts/make-example-saves.ts`)
  }
})

// --- Testing saves: a save whose start writes its first Battle Round by hand ----------------------------------------

test("every testing save reads as a save, plays one Battle Round with idle slots, and is as the game writes it", () => {
  const catalog = testingSaveCatalog()
  assert.ok(catalog.length >= 11, `only ${catalog.length} testing saves in skirmish-testing/`)
  for (const { id, path } of catalog) {
    const text = readFileSync(path, "utf8")
    const { save, problems } = readSave(text)
    assert.deepEqual(problems, [], id)
    assert.ok(save!.start !== undefined, `${id} has no start`)
    assert.equal(save!.setup.rounds, 1, id)
    assert.deepEqual([save!.setup.slots.p1.controller, save!.setup.slots.p2.controller], ["script:idle", "script:idle"], id)
    assert.equal(saveText(save!), text, `${id} is not written as saveText writes it`)
  }
})

test("a testing save's start opens the kernel as the map it came from did: the same entities, targets and seed", async () => {
  // melee-kill, as its map file wrote it before the maps became saves: two troopers at (10,5) and (10,6) close on one
  // at (13,5), each side's target the other.
  const opening = await loadTestingSave("melee-kill")
  assert.deepEqual(opening.placements, {
    A: { at: { x: 10, y: 5 }, rows: ["t", "t"], legend: { t: { content: "unit.citizen.trooper" } } },
    B: { at: { x: 13, y: 5 }, rows: ["t"], legend: { t: { content: "unit.citizen.trooper" } } },
  })
  assert.deepEqual(opening.targets, { A: { x: 13, y: 5, width: 1, height: 1 }, B: { x: 10, y: 5, width: 1, height: 2 } })
  assert.equal(opening.seed, 40961)
  assert.equal(opening.pulseTicks, 180)
  assert.deepEqual(openBattle(opening).state.entities.map((entity) => entity.id), ["A:trooper#1", "B:trooper#2", "A:trooper#3"])
})

test("a testing save the loader refuses names every problem at once, its units' fit included", () => {
  const map = { id: "broken", rows: ["....", "...."] }
  const slots = { p1: { controller: "script:rush" }, p2: { controller: "script:idle" } }
  const shape = readSave(
    JSON.stringify({
      format: "terminal-nexus.save/1",
      setup: { map, seed: 1, goal: "elimination", modifiers: [], rounds: 3, roundTicks: 60, slots },
      start: { p1: { rows: ["t"] }, p3: {}, p2: { rows: ["t"], legend: { t: { content: "unit.citizen.trooper" } }, target: { x: 1 } } },
      draft: {},
    }),
  )
  assert.equal(shape.save, null)
  for (const part of ["setup.rounds", "setup.slots.p1.controller", "start.p1.legend", "start.p3", "start.p2.target", "draft"]) {
    assert.ok(shape.problems.some((problem) => problem.startsWith(part)), `nothing said about ${part}: ${shape.problems.join(" | ")}`)
  }
  // The shape right, a unit off the Grid is the opening's refusal, named by its place in the start.
  const fit = readSave(
    JSON.stringify({
      format: "terminal-nexus.save/1",
      setup: { map, seed: 1, goal: "elimination", modifiers: [], rounds: 1, roundTicks: 60, slots: { ...slots, p1: { controller: "script:idle" } } },
      start: { p1: { at: { x: 6, y: 0 }, rows: ["t"], legend: { t: { content: "unit.citizen.trooper" } } } },
    }),
  )
  assert.equal(fit.save, null)
  assert.match(fit.problems.join("\n"), /^start: broken: .*outside the 4x2 Grid/m)
})

test("skirmish: a testing save's --battle plays the Battle Round grid plays, and says so in grid's report", () => {
  const path = join(REPO_ROOT, "skirmish-testing/rules/melee-kill.save.json")
  const brief = run(["--load", path])
  assert.equal(brief.code, 0)
  assert.match(brief.out, /a testing save, its Battle Round written by hand/)
  assert.match(brief.out, /add --battle to play it/)
  const played = run(["--load", path, "--battle"])
  assert.equal(played.code, 0)
  assert.match(played.out, /WARN {2}report {3}melee-kill .* outcome A wins/)
  const grid = spawnSync(process.execPath, [join(REPO_ROOT, "bin/grid.ts"), "melee-kill", "--headless"], { encoding: "utf8" })
  assert.ok(played.out.includes(grid.stdout.trim()), `skirmish and grid disagree:\n${played.out}\n---\n${grid.stdout}`)
  assert.throws(() => run(["--load", path, "--battle", "--save", join(tmpdir(), "x.save.json")]), /nothing to save/)
  assert.throws(() => run(["--load", path, "--p1", "script:rush"]), /plan nothing/)
})
