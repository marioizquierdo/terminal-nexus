// What a tester reads from `grid` on a Build Phase sandbox (docs/system-design/sandboxes.md, "Build Phase or Battle
// Round"): the end of each entity, the options the run refuses, the report that names the run, the help, and the hints.

import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { openBattle } from "../src/skirmish/opening/index.ts"
import type { BattleOpening } from "../src/skirmish/opening/index.ts"
import { REPO_ROOT, loadSandbox } from "./helpers.ts"

const GRID_BIN = join(REPO_ROOT, "bin", "grid.ts")
const grid = (args: readonly string[]) => {
  const r = spawnSync(process.execPath, [GRID_BIN, ...args], { cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } })
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr }
}

test("a headless Build Phase run ends with what each entity became, at the default level, before its report", () => {
  const run = grid(["build-phase-between-rounds", "--headless"])
  assert.equal(run.status, 0)
  const ends = run.stdout.split("\n").filter((line) => line.includes(" end "))
  assert.equal(ends.length, 4, "one line for each of the four entities")
  assert.match(run.stdout, /A:nexus#1\s+hp 100->140\/400\s+at \(3,8\)->\(3,8\)\s+stayed/, "the Nexus mends")
  assert.match(run.stdout, /A:trooper#2\s+hp 40->40\/40\s+at \(14,8\)->\(8,9\)\s+moved/, "a unit in a fight steps back")
  assert.match(run.stdout.trimEnd().split("\n").at(-1) ?? "", / report /, "the report closes the log")
  assert.match(run.stdout, /\(Build Phase regroup\)/)
  assert.doesNotMatch(run.stdout, /full pulse/)
})

test("a Battle Round shows its end states only when asked (--end-states), so its default output is unchanged", () => {
  assert.doesNotMatch(grid(["melee-kill", "--headless"]).stdout, / end /)
  assert.match(grid(["melee-kill", "--headless", "--end-states"]).stdout, / WARN {2}end {6}/)
})

test("--ticks is refused for a Build Phase sandbox, and still read for a Battle Round", () => {
  for (const mode of ["--headless", "--verify"]) {
    const refused = grid(["build-phase-between-rounds", mode, "--ticks", "5"])
    assert.equal(refused.status, 2)
    assert.match(refused.stderr, /--ticks does not apply to build-phase-between-rounds.*120 ticks/)
  }
  assert.equal(grid(["melee-kill", "--headless", "--ticks", "5"]).status, 0)
})

test("grid --help names start.phase and no longer says a sandbox is only a Battle Round", () => {
  const help = grid(["--help"]).stdout
  assert.match(help, /start\.phase: absent or one of "battle-round"/)
  assert.match(help, /--end-states/)
  assert.doesNotMatch(help, /watches the sandbox's Battle Round resolve live/)
})

test("a fitted building in a sandbox is refused with the reason", async () => {
  const base = await loadSandbox("melee-kill")
  const sideA = base.placements["A"]
  assert.ok(sideA !== undefined)
  const fitted: BattleOpening = {
    ...base,
    placements: { ...base.placements, A: { ...sideA, legend: { ...sideA.legend, [Object.keys(sideA.legend)[0] ?? "t"]: { content: "structure.citizen.barracks+production-line" } } } },
  }
  assert.throws(() => openBattle(fitted), /fitted building.*cannot stand in a sandbox/)
})

test("the state hash of a Build Phase run follows --seed because the state carries the random stream; the events hash does not", () => {
  const hashes = (seed: string) => /state sha256:(\S+)\s+events sha256:(\S+)/.exec(grid(["build-phase-between-rounds", "--headless", "--seed", seed]).stdout)?.slice(1)
  const [a, b] = [hashes("1"), hashes("2")]
  assert.ok(a !== undefined && b !== undefined)
  assert.notEqual(a[0], b[0])
  assert.equal(a[1], b[1])
})
