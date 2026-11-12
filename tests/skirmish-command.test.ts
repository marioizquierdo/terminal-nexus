// The `skirmish` command's combinations (docs/system-design/skirmish-saves.md, the command): two plans of one's own
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

test("two plans of one's own play against each other: both build, the battle is fought", { timeout: 30_000 }, () => {
  inTemp((dir) => {
    writeFileSync(join(dir, "a.json"), JSON.stringify({ build: [{ building: "turret" }], stance: "hold" }))
    writeFileSync(join(dir, "b.json"), JSON.stringify({ build: [{ building: "hatchery" }], stance: "attack" }))
    // Without a round to play, both plans are checked.
    const checked = run(["--map", "pocket", "--p1", `build:${dir}/a.json`, "--p2", `build:${dir}/b.json`])
    assert.match(checked.out, /p1 \(west, vasse, player\): the plan checked[\s\S]*builds turret/)
    assert.match(checked.out, /p2 \(east, dob, player\): the plan checked[\s\S]*builds hatchery/)
    const played = run(["--map", "pocket", "--p1", `build:${dir}/a.json`, "--p2", `build:${dir}/b.json`, "--battle"])
    assert.match(played.out, /p1 vasse: .*built 1; hold/)
    assert.match(played.out, /p2 dob: .*built 1; attack/)
    // But a plan plays one round: many rounds need scripts.
    assert.throws(() => run(["--map", "pocket", "--p1", `build:${dir}/a.json`, "--p2", "script:agro", "--battles", "2"]), /p1 is a player: a plan plays one round/)
    assert.throws(() => run(["--map", "pocket", "--p1", "build:", "--p2", "script:agro", "--play-until-win"]), /until the battle ends/)
  })
})

test("several rounds, until the battle ends, and each round kept as a save, a report and a log", { timeout: 60_000 }, () => {
  inTemp((dir) => {
    const two = run(["--map", "pocket", "--p1", "script:steady", "--p2", "script:agro", "--battles", "2", "--save", join(dir, "two.save.json")])
    assert.equal((two.out.match(/^round \d+: ended/gm) ?? []).length, 2, two.out)
    const out = join(dir, "rounds")
    const log = join(dir, "battle.log")
    const ended = run(["--map", "pocket", "--p1", "script:steady", "--p2", "script:defensive", "--rounds", "3", "--play-until-win", "--out", out, "--log", log, "--log-level", "info", "--save", join(dir, "end.save.json")])
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
    assert.throws(() => run(["-f", join(dir, "end.save.json"), "--battle"]), /the battle is over/)
    // Until the end raises the limit to 100 rounds when none is given.
    assert.equal(readSave(readFileSync(join(dir, "two.save.json"), "utf8")).save!.setup.rounds, 8)
  })
})

test("many seeds: a line each and a tally, kept with --out, never --save", { timeout: 60_000 }, () => {
  inTemp((dir) => {
    const many = run(["--map", "pocket", "--p1", "script:agro", "--p2", "script:defensive", "--battles", "1", "--seeds", "1-3", "--out", dir])
    assert.equal((many.out.match(/^seed \d: /gm) ?? []).length, 3, many.out)
    assert.match(many.out, /3 seeds: p1 won \d+, p2 won \d+, \d+ drawn, 3 unfinished/)
    assert.ok(existsSync(join(dir, "seed-2-round-1.save.json")))
    assert.throws(() => run(["--map", "pocket", "--p1", "script:agro", "--p2", "script:agro", "--battles", "1", "--seeds", "1-2", "--save", "x.json"]), /kept with --out/)
    assert.throws(() => run(["--map", "pocket", "--p1", "script:agro", "--p2", "script:agro", "--seeds", "1-2"]), /how many rounds each battle plays/)
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
    const fast = run(["--map", "pocket", "--p1", "script:defensive", "--p2", "script:defensive", "--modifiers", "fast-rounds,double-income", "--battle", "--save", save])
    assert.match(fast.out, /The Pocket, seed 1, fast-rounds, double-income/)
    assert.match(fast.out, /round 1: ended on time at tick 180/)
    assert.match(fast.out, /p1 vasse: 200 credits/)
    const cleared = run(["-f", save, "--modifiers", "none", "--battle"])
    assert.match(cleared.out, /round 2: ended on time at tick 360/)
    assert.deepEqual(readSave(readFileSync(save, "utf8")).save!.setup.modifiers, [])
    assert.throws(() => run(["--map", "pocket", "--modifiers", "triple-income"]), /no modifier "triple-income"/)
  })
})

test("what the command refuses: two ways to say how many rounds, a round limit already passed, a missing plan file", () => {
  inTemp((dir) => {
    const save = join(dir, "s.save.json")
    run(["--map", "pocket", "--p1", "script:defensive", "--p2", "script:defensive", "--battles", "2", "--save", save])
    assert.throws(() => run(["-f", save, "--battle", "--play-until-win"]), /give one/)
    assert.throws(() => run(["-f", save, "--rounds", "1"]), /already at round 3/)
    assert.throws(() => run(["-f", save, "--p1", `build:${dir}/missing.json`]), /no plan file/)
    assert.throws(() => run(["-f", save, "--seed", "4"]), /keeps its own/)
    assert.throws(() => run(["-f", save, "--p1-credits", "0"]), /a share above 0/)
  })
})

test("every pairing of the Commanders named, each from both sides, once a seed: who won by Commander", { timeout: 60_000 }, () => {
  const bench = run(["--map", "pocket", "--p1", "script:steady", "--p2", "script:steady", "--commanders", "vasse,dob", "--seeds", "1", "--battles", "1"])
  assert.match(bench.out, /^vasse against dob, 2 battles: vasse won \d+, dob won \d+, /m, bench.out)
  assert.match(bench.out, /^every battle by slot, 2 battles: p1 \(west\) won \d+, p2 \(east\) won \d+/m)
  assert.throws(() => run(["--map", "pocket", "--commanders", "vasse", "--seeds", "1", "--battles", "1", "--p1", "script:agro"]), /two Commanders or more/)
  assert.throws(() => run(["--map", "pocket", "--commanders", "all", "--p1-commander", "vasse", "--battles", "1"]), /names every Commander played/)
  assert.throws(() => run(["--map", "pocket", "--commanders", "all", "--battles", "1"]), /p1 is a player: a plan plays one round of one battle/)
})

test("two sessions play one save, a slot each: each waits for its turn, and the plan handed in last plays the round", { timeout: 60_000 }, () => {
  inTemp((dir) => {
    const save = join(dir, "two.save.json")
    run(["--map", "pocket", "--p1", "build:", "--p2", "build:", "--rounds", "2", "--ticks", "120", "--save", save])
    writeFileSync(join(dir, "a.json"), '{"power": 1, "build": [{"building": "barracks", "at": "forward"}], "stance": "hold"}')
    writeFileSync(join(dir, "b.json"), '{"power": 0, "build": [], "stance": "attack"}')
    // Both slots have a turn to take: each wait prints its brief at once.
    assert.match(run(["-f", save, "--wait", "p1", "--timeout", "1"]).out, /--- brief for p1 \(west, vasse, player\)/)
    assert.match(run(["-f", save, "--p1", `build:${dir}/a.json`, "--ready"]).out, /plan for round 1 kept; waiting for p2\. Run: skirmish -f .* --wait p1/)
    // p1's plan is in: its wait runs out of time while p2 thinks, and says to wait again.
    const waiting = run(["-f", save, "--wait", "p1", "--timeout", "0"])
    assert.equal(waiting.code, EXIT.waiting)
    assert.match(waiting.out, /still waiting/)
    const played = run(["-f", save, "--p2", `build:${dir}/b.json`, "--ready"])
    assert.match(played.out, /^round 1: ended/m)
    assert.match(played.out, /p1 vasse: .*built 1; hold/)
    assert.match(played.out, /round 2 is open/)
    assert.match(run(["-f", save, "--wait", "p2", "--timeout", "1"]).out, /--- brief for p2[\s\S]*round 2 of 2/)
    // The last round played, every wait says it is over and gives every round's report.
    run(["-f", save, "--p1", "build:", "--p2", "build:", "--battle"])
    assert.match(run(["-f", save, "--wait", "p1"]).out, /THE BATTLE IS OVER: over: [\s\S]*^round 2: ended/m)
    assert.throws(() => run(["--load", save, "--save", join(dir, "other.json"), "--ready"]), /share one save/)
    assert.throws(() => run(["-f", save, "--wait", "p3"]), /p1 or p2/)
    assert.throws(() => run(["-f", save, "--wait", "p1", "--battle"]), /--wait plays nothing/)
    assert.throws(() => run(["-f", save, "--timeout", "4"]), /--timeout: it says how long --wait blocks/)
  })
})
