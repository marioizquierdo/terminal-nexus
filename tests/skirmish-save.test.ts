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
import { main } from "../src/cli/skirmish.ts"
import type { DuelState } from "../src/duel/index.ts"
import { briefOf, playRound, SCRIPTED } from "../src/duel/index.ts"
import { duelOf, newSetup, readSave, saveOf, saveText } from "../src/skirmish/save.ts"
import { hashOf } from "../src/state/canonical.ts"
import { REPO_ROOT } from "./helpers.ts"

const SAVES = join(REPO_ROOT, "saves")

/** One round, side A by the balanced script and side B by rush. */
const round = (state: DuelState): DuelState => playRound(state, { A: SCRIPTED.balanced!(briefOf(state, "A").data), B: SCRIPTED.rush!(briefOf(state, "B").data) }).state

/** Runs the command, returning its exit code and what it wrote. */
function run(args: readonly string[]): Readonly<{ code: number; out: string }> {
  const lines: string[] = []
  const code = main(args, (line) => lines.push(line))
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
    assert.equal(checked.code, 1)
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
  assert.deepEqual(Object.keys(schema.properties).sort(), ["draft", "format", "name", "notes", "setup", "state"])
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
