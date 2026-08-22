// The CLI, end to end, including the cross-runtime check that a single machine can never make.

import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { REPO_ROOT, scenarioFiles } from "./helpers.ts"

const GRID_BIN = join(REPO_ROOT, "bin", "grid.ts")

function runGrid(
  args: readonly string[],
  runtime = process.execPath,
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(runtime, [GRID_BIN, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  })
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr }
}

function bunAvailable(): boolean {
  try {
    execFileSync("bun", ["--version"], { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

test("run prints the summary on stdout and the log on stderr", () => {
  const result = runGrid(["run", "scenarios/melee-kill.ts"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /^scenario   melee-kill$/m)
  assert.match(result.stdout, /^outcome    A wins$/m)
  assert.doesNotMatch(result.stdout, /INFO/, "the log leaked into stdout")
  assert.match(result.stderr, /\[0000\] INFO  spawn/)
  assert.doesNotMatch(result.stderr, /^scenario/m, "the summary leaked into stderr")
})

test("--seed, --ticks and --log-level are honoured", () => {
  const shallow = runGrid(["run", "scenarios/citizen-mirror-skirmish.ts", "--ticks", "24"])
  assert.match(shallow.stdout, /^ticks      24 of 24 \(full pulse\)$/m)

  const seeded = runGrid([
    "run",
    "scenarios/citizen-mirror-skirmish.ts",
    "--seed",
    "0xABCD",
    "--ticks",
    "60",
  ])
  assert.match(seeded.stdout, /^seed       0x0000ABCD$/m)

  const debug = runGrid([
    "run",
    "scenarios/melee-kill.ts",
    "--log-level",
    "debug",
  ])
  assert.match(debug.stderr, /DEBUG intent/)
  assert.match(debug.stderr, /DEBUG claim|DEBUG move /)
})

test("--events writes the ordered event stream as JSONL", () => {
  const directory = mkdtempSync(join(tmpdir(), "grid-events-"))
  try {
    const file = join(directory, "events.jsonl")
    const result = runGrid(["run", "scenarios/melee-kill.ts", "--events", file])
    assert.equal(result.status, 0)
    const lines = readFileSync(file, "utf8").trim().split("\n")
    assert.ok(lines.length > 10)
    const parsed = lines.map((line) => JSON.parse(line) as { kind: string; tick: number })
    assert.equal(parsed[0]?.kind, "entity.spawned")
    assert.equal(parsed[parsed.length - 1]?.kind, "pulse.ended")
    for (let index = 1; index < parsed.length; index += 1) {
      const previous = parsed[index - 1]
      const current = parsed[index]
      if (previous === undefined || current === undefined) continue
      assert.ok(current.tick >= previous.tick, "the event stream is not ordered by tick")
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("--json produces a machine-readable summary", () => {
  const result = runGrid(["run", "scenarios/melee-kill.ts", "--json"])
  const parsed = JSON.parse(result.stdout) as Record<string, unknown>
  assert.equal(parsed["scenario"], "melee-kill")
  assert.equal(typeof parsed["stateHash"], "string")
  assert.equal((parsed["stateHash"] as string).length, 64)
  assert.equal(typeof parsed["contentLock"], "string")
  assert.equal(parsed["engineVersion"], "0.1.0-gate1a")
})

test("verify --runs 20 is green on every checked-in scenario", { timeout: 120_000 }, () => {
  for (const name of scenarioFiles()) {
    const result = runGrid(["verify", `scenarios/${name}`, "--runs", "20"])
    assert.equal(result.status, 0, `${name}: ${result.stderr}`)
    assert.match(result.stdout, /^runs       20 identical$/m, name)
  }
})

test("watch without a TTY prints one line and no escapes", () => {
  const result = runGrid(["watch", "scenarios/melee-kill.ts"])
  assert.equal(result.status, 0)
  const lines = result.stdout.trim().split("\n")
  assert.equal(lines.length, 1, `watch printed ${lines.length} lines`)
  assert.doesNotMatch(result.stdout, new RegExp(String.fromCharCode(27)), "watch emitted escapes")
  assert.match(lines[0] ?? "", /^melee-kill  ticks \d+  state sha256:[0-9a-f]{16}  events sha256:[0-9a-f]{16}$/)
})

test("watch and run agree on the hashes they print", () => {
  const run = JSON.parse(
    runGrid(["run", "scenarios/citizen-mirror-skirmish.ts", "--json"]).stdout,
  ) as { stateHash: string; eventsHash: string }
  const watched = runGrid(["watch", "scenarios/citizen-mirror-skirmish.ts"]).stdout
  assert.ok(watched.includes(`state sha256:${run.stateHash.slice(0, 16)}`), watched)
  assert.ok(watched.includes(`events sha256:${run.eventsHash.slice(0, 16)}`), watched)
})

test("a scenario that fails to load reports an ERROR and a non-zero status", () => {
  const result = runGrid(["run", "scenarios/does-not-exist.ts"])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /ERROR/)
})

// Cross-runtime agreement is the only cheap test of the serialization and iteration assumptions
// that twenty runs on one machine can never catch, so it is registered whenever Bun exists.
if (bunAvailable()) {
  test("verify produces identical hashes under Bun and under Node", () => {
    for (const name of scenarioFiles()) {
      const node = runGrid(["run", `scenarios/${name}`, "--json"])
      const bun = runGrid(["run", `scenarios/${name}`, "--json"], "bun")
      assert.equal(bun.status, 0, `${name} failed under bun: ${bun.stderr}`)
      const left = JSON.parse(node.stdout) as Record<string, unknown>
      const right = JSON.parse(bun.stdout) as Record<string, unknown>
      assert.equal(
        right["stateHash"],
        left["stateHash"],
        `${name}: state hash differs across runtimes`,
      )
      assert.equal(
        right["eventsHash"],
        left["eventsHash"],
        `${name}: event hash differs across runtimes`,
      )
      assert.equal(right["contentLock"], left["contentLock"], `${name}: content lock differs`)
    }
  })
}
