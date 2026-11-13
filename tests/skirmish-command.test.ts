// The `skirmish` command's combinations (its manual is src/cli/skirmish.ts's opening comment): two slots' build actions
// against each other, several rounds, a battle played until it ends, many seeds with a tally, every round kept as a
// save and a report, the battle's log, script profiles and credits shares, the modifiers, and what it refuses. On the
// Pocket with short limits, so each stays quick.

import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { EXIT, main } from "../src/cli/skirmish.ts"
import { scriptedName } from "../src/duel/index.ts"
import { agentProfiles, readProfiles } from "../src/skirmish/profile-files.ts"
import { duelOf, duelSetupOf, newSetup, readSave as readWith } from "../src/skirmish/save.ts"

/** A save read with the profiles that ship. */
const readSave = (text: string): ReturnType<typeof readWith> => readWith(text, readProfiles())

/** Runs the command, returning its exit code and what it wrote; when it could not run (exit 1), throws what it said. */
function run(args: readonly string[]): Readonly<{ code: number; out: string }> {
  const lines: string[] = []
  const failed: string[] = []
  const code = main(args, (line) => lines.push(line), undefined, (line) => failed.push(line))
  if (code === EXIT.failed) throw new Error(failed.join("\n"))
  return { code, out: lines.join("\n") }
}

function inTemp(work: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "skirmish-command-"))
  try {
    work(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test("two slots' build actions of one's own play against each other; a build file by round plays blind until it has no entry", { timeout: 30_000 }, () => {
  inTemp((dir) => {
    writeFileSync(join(dir, "a.json"), JSON.stringify({ build: [{ building: "turret" }], stance: "hold" }))
    writeFileSync(join(dir, "b.json"), JSON.stringify({ build: [{ building: "hatchery" }], stance: "attack" }))
    // Without a round to play, both slots' build actions are checked.
    const checked = run(["--map", "pocket", "--p1", `build:${dir}/a.json`, "--p2", `build:${dir}/b.json`])
    assert.match(checked.out, /p1 \(west, vasse, player\): build actions for round 1 checked[\s\S]*builds turret/)
    assert.match(checked.out, /p2 \(east, dob, player\): build actions for round 1 checked[\s\S]*builds hatchery/)
    const played = run(["--map", "pocket", "--p1", `build:${dir}/a.json`, "--p2", `build:${dir}/b.json`, "--play-to", "next"])
    assert.match(played.out, /p1 vasse: .*built 1; hold/)
    assert.match(played.out, /p2 dob: .*built 1; attack/)
    // A file of one object is for the first round played: the battle stops at round 2, both briefs printed.
    assert.match(played.out, /^round 2 of 8, at its Build Phase[\s\S]*--- brief for p1[\s\S]*--- brief for p2/m)
    // A build file by round: round 1, then rounds 2 and 3, then every round; played blind to the end.
    writeFileSync(join(dir, "rounds.json"), JSON.stringify([
      { round: 1, build: [{ building: "turret" }], stance: "hold" },
      { round: "2-3", build: ["barracks"], stance: "hold" },
      { round: "*", build: ["depot"], stance: "attack" },
    ]))
    const blind = run(["--map", "pocket", "--p1", `build:${dir}/rounds.json`, "--p2", "script:", "--rounds", "4", "--play-to", "end"])
    assert.match(blind.out, /^round 1: [\s\S]*p1 vasse: .*built 1; hold[\s\S]*^round 3: [\s\S]*hold[\s\S]*^round 4: [\s\S]*attack[\s\S]*^over: /m, blind.out)
    // Without a "*" entry it stops at the first round it has nothing for, and prints the brief.
    writeFileSync(join(dir, "two.json"), JSON.stringify([{ round: "1-2", build: [], stance: "hold" }]))
    const stopped = run(["--map", "pocket", "--p1", `build:${dir}/two.json`, "--p2", "script:", "--play-to", "end"])
    assert.match(stopped.out, /^round 2: ended[\s\S]*p1 has no build actions for round 3[\s\S]*--- brief for p1/m)
    assert.throws(() => run(["--map", "pocket", "--p1", `build:${dir}/two.json`, "--p2", "script:", "--play-to", "end", "--seeds", "1-2"]), /no build actions for round 3: give its build file a "\*" entry/)
    writeFileSync(join(dir, "bad.json"), JSON.stringify([{ round: "soon", build: [] }]))
    assert.match(run(["--map", "pocket", "--p1", `build:${dir}/bad.json`, "--p2", "script:agro"]).out, /entry 1: "round" should be a round/)
  })
})

test("several rounds, until the battle ends, and each round kept as a save, a report and a log", { timeout: 60_000 }, () => {
  inTemp((dir) => {
    const two = run(["--map", "pocket", "--p1", "script:steady", "--p2", "script:agro", "--play-to", "3", "--save", join(dir, "two.save.json")])
    assert.equal((two.out.match(/^round \d+: ended/gm) ?? []).length, 2, two.out)
    const out = join(dir, "rounds")
    const log = join(dir, "battle.log")
    const ended = run(["--map", "pocket", "--p1", "script:steady", "--p2", "script:defensive", "--rounds", "3", "--play-to", "end", "--out", out, "--log", log, "--log-level", "info", "--save", join(dir, "end.save.json")])
    assert.match(ended.out, /^over: /m)
    const save = readSave(readFileSync(join(dir, "end.save.json"), "utf8")).save!
    assert.notEqual(save.state?.result, null)
    assert.equal(save.setup.rounds, 3, "--rounds wins over the until-the-end limit")
    const played = save.state!.history.length
    const files = readdirSync(out)
    for (let round = 1; round <= played; round += 1) for (const kind of [".save.json", ".txt"]) assert.ok(files.includes(`round-${round}${kind}`), `no round-${round}${kind}`)
    const text = readFileSync(log, "utf8")
    assert.match(text, /=== round 1: \d+ events/)
    assert.match(text, /INFO {2}\S/, "the log carries the battle's own lines")
    // A battle over plays no more.
    assert.throws(() => run(["-f", join(dir, "end.save.json"), "--play-to", "next"]), /the battle is over/)
    // Until the end raises the limit to 100 rounds when none is given.
    assert.equal(readSave(readFileSync(join(dir, "two.save.json"), "utf8")).save!.setup.rounds, 8)
  })
})

test("many seeds: a line each and a tally, kept with --out, never --save", { timeout: 60_000 }, () => {
  inTemp((dir) => {
    const many = run(["--map", "pocket", "--p1", "script:agro", "--p2", "script:defensive", "--play-to", "next", "--seeds", "1-3", "--out", dir])
    assert.equal((many.out.match(/^seed \d: /gm) ?? []).length, 3, many.out)
    assert.match(many.out, /3 seeds: p1 won \d+, p2 won \d+, \d+ drawn, 3 unfinished/)
    assert.ok(existsSync(join(dir, "seed-2-round-1.save.json")))
    assert.throws(() => run(["--map", "pocket", "--p1", "script:agro", "--p2", "script:agro", "--play-to", "next", "--seeds", "1-2", "--save", "x.json"]), /kept with --out/)
    assert.throws(() => run(["--map", "pocket", "--p1", "script:agro", "--p2", "script:agro", "--seeds", "1-2"]), /how far each battle plays/)
  })
})

test("profiles and shares: a profile names a script and may carry a share; a slot's own share wins", () => {
  const profiles = readProfiles()
  for (const [name, profile] of profiles) assert.ok(scriptedName(profile.script) !== undefined, `${name} plays no script`)
  assert.ok(["agro", "defensive", "steady"].every((name) => profiles.has(name)), [...profiles.keys()].join(", "))
  assert.ok(agentProfiles().includes("curious"))
  const credits = (args: readonly string[]): number => {
    const brief = run(["--map", "pocket", "--p1", "build:", ...args, "--json"])
    return (JSON.parse(brief.out.slice(brief.out.indexOf("{"))) as { credits: number }).credits
  }
  assert.equal(credits(["--p2", "script:agro"]), 100)
  assert.equal(credits(["--p1-credits", "1.5"]), 150)
  // The rich profile's share is the profile's, side B's alone.
  const setup = newSetup({ map: "pocket", slots: { p2: { controller: "script:agro-rich" } } })
  assert.deepEqual(duelSetupOf(setup, profiles).income, { A: 1, B: 1.25 })
  assert.equal(duelOf({ format: "terminal-nexus.save/1", setup }, profiles).sides.B.credits, 125)
  assert.throws(() => run(["--map", "pocket", "--p2", "script:nobody"]), /no script or profile "nobody"/)
  assert.throws(() => run(["--map", "pocket", "--p2", "agent:curious"]), /agent players are not built yet/)
})

test("modifiers: fast rounds last half as long, double income doubles both sides', and a loaded battle may change them", { timeout: 30_000 }, () => {
  inTemp((dir) => {
    const save = join(dir, "m.save.json")
    const fast = run(["--map", "pocket", "--p1", "script:defensive", "--p2", "script:defensive", "--modifiers", "fast-rounds,double-income", "--play-to", "next", "--save", save])
    assert.match(fast.out, /The Pocket, seed 1, fast-rounds, double-income/)
    assert.match(fast.out, /round 1: ended on time at tick 180/)
    assert.match(fast.out, /p1 vasse: 200 credits/)
    const cleared = run(["-f", save, "--modifiers", "none", "--play-to", "next"])
    assert.match(cleared.out, /round 2: ended on time at tick 360/)
    assert.deepEqual(readSave(readFileSync(save, "utf8")).save!.setup.modifiers, [])
    assert.throws(() => run(["--map", "pocket", "--modifiers", "triple-income"]), /no modifier "triple-income"/)
  })
})

test("what the command refuses: a round already passed, a round limit already passed, a missing build file", () => {
  inTemp((dir) => {
    const save = join(dir, "s.save.json")
    run(["--map", "pocket", "--p1", "script:defensive", "--p2", "script:defensive", "--play-to", "3", "--save", save])
    assert.throws(() => run(["-f", save, "--play-to", "2"]), /--play-to 2: the battle is already at round 3/)
    assert.throws(() => run(["-f", save, "--play-to", "soon"]), /next, a round \(4\) or end/)
    assert.throws(() => run(["-f", save, "--rounds", "1"]), /already at round 3/)
    assert.throws(() => run(["-f", save, "--p1", `build:${dir}/missing.json`]), /no build file/)
    assert.throws(() => run(["-f", save, "--seed", "4"]), /keeps its own/)
    assert.throws(() => run(["-f", save, "--p1-credits", "0"]), /a share above 0/)
  })
})

test("every pairing of the Commanders named, each from both sides, once a seed: who won by Commander", { timeout: 60_000 }, () => {
  const bench = run(["--map", "pocket", "--p1", "script:steady", "--p2", "script:steady", "--commanders", "vasse,dob", "--seeds", "1", "--play-to", "next"])
  assert.match(bench.out, /^vasse against dob, 2 battles: vasse won \d+, dob won \d+, /m, bench.out)
  assert.match(bench.out, /^every battle by slot, 2 battles: p1 \(west\) won \d+, p2 \(east\) won \d+/m)
  assert.throws(() => run(["--map", "pocket", "--commanders", "vasse", "--seeds", "1", "--play-to", "next", "--p1", "script:agro"]), /two Commanders or more/)
  assert.throws(() => run(["--map", "pocket", "--commanders", "all", "--p1-commander", "vasse", "--play-to", "next"]), /names every Commander played/)
  assert.throws(() => run(["--map", "pocket", "--commanders", "all", "--play-to", "next"]), /p1 has no build actions for round 1/)
})

test("no turns: either slot's build actions may be handed in alone, in any order, and the round plays both", { timeout: 60_000 }, () => {
  inTemp((dir) => {
    const save = join(dir, "two.save.json")
    run(["--map", "pocket", "--p1", "build:", "--p2", "build:", "--rounds", "2", "--ticks", "120", "--save", save])
    writeFileSync(join(dir, "a.json"), '{"power": 1, "build": [{"building": "barracks", "at": "forward"}], "stance": "hold"}')
    writeFileSync(join(dir, "b.json"), '{"power": 0, "build": [], "stance": "attack"}')
    // Both slots read the same battle: p2's brief is the same before and after p1 hands its actions in.
    const before = run(["-f", save, "--json"]).out
    run(["-f", save, "--p1", `build:${dir}/a.json`])
    const after = run(["-f", save, "--json"]).out
    const p2Brief = (text: string): string => text.slice(text.indexOf("--- brief for p2"))
    assert.equal(p2Brief(after), p2Brief(before))
    // p2 hands its actions in later and plays the round: p1's, kept as the draft, play too.
    const played = run(["-f", save, "--p2", `build:${dir}/b.json`, "--play-to", "next"])
    assert.match(played.out, /p1 vasse: .*built 1; hold/)
    assert.match(played.out, /p2 dob: .*built 0; attack/)
    assert.match(played.out, /--- brief for p1[\s\S]*round 2 of 2/)
    assert.match(played.out, /on screen: \.\/bin\/terminal-nexus\.ts --load /)
    // A finished battle loaded prints every round's report.
    run(["-f", save, "--p1", `build:${dir}/b.json`, "--p2", `build:${dir}/b.json`, "--play-to", "next"])
    assert.match(run(["--load", save]).out, /over: [\s\S]*^round 2: ended/m)
    assert.throws(() => run(["-f", save, "--wait", "p1"]), /no option --wait/)
  })
})
