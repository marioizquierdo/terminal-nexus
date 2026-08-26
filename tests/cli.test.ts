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

test("--headless defaults to WARN and closes with the report line, on one stream", () => {
  const result = runGrid(["scenarios/melee-kill", "--headless"])
  assert.equal(result.status, 0)
  assert.equal(result.stderr, "")
  assert.doesNotMatch(result.stdout, / INFO /, "INFO lines leaked past the default WARN level")
  assert.match(result.stdout, /^\[\d+\] WARN {2}report {3}melee-kill\s+seed 0x/m)
  assert.match(result.stdout, /outcome A wins/)

  const info = runGrid(["scenarios/melee-kill", "--headless", "--log-level", "info"])
  assert.match(info.stdout, /\[0000\] INFO {2}spawn/)
})

test("the .map.json suffix is optional", () => {
  const bare = runGrid(["scenarios/melee-kill", "--headless", "--json"])
  const suffixed = runGrid(["scenarios/melee-kill.map.json", "--headless", "--json"])
  assert.equal(bare.status, 0)
  assert.equal(JSON.parse(bare.stdout).stateHash, JSON.parse(suffixed.stdout).stateHash)
})

test("--seed, --ticks and --log-level are honoured", () => {
  const shallow = runGrid(["scenarios/citizen-mirror-skirmish", "--headless", "--ticks", "24"])
  assert.match(shallow.stdout, /^\[\d+\] WARN  report   citizen-mirror-skirmish\s+seed 0x\S+\s+ticks 24 of 24 \(full pulse\)/m)

  const seeded = runGrid([
    "scenarios/citizen-mirror-skirmish",
    "--headless",
    "--seed",
    "0xABCD",
    "--ticks",
    "60",
  ])
  assert.match(seeded.stdout, /seed 0x0000ABCD/)

  const debug = runGrid(["scenarios/melee-kill", "--headless", "--log-level", "debug"])
  assert.match(debug.stdout, /DEBUG intent/)
  assert.match(debug.stdout, /DEBUG claim|DEBUG move /)
})

test("--turn filters the log to that tick onward, keeping ERRORs and the report", () => {
  const full = runGrid(["scenarios/citizen-mirror-skirmish", "--headless", "--log-level", "debug"])
  const fromTurn = runGrid([
    "scenarios/citizen-mirror-skirmish",
    "--headless",
    "--log-level",
    "debug",
    "--turn",
    "50",
  ])
  assert.equal(fromTurn.status, 0)
  assert.ok(fromTurn.stdout.length < full.stdout.length, "the filtered log should be shorter")
  for (const line of fromTurn.stdout.trim().split("\n")) {
    const match = /^\[(\d+)\]/.exec(line)
    if (match?.[1] !== undefined) assert.ok(Number(match[1]) >= 50, line)
  }
  assert.match(fromTurn.stdout, /WARN {2}report/, "the report line survives the --turn filter")
})

test("--save-log writes the log to a file independent of --json", () => {
  const directory = mkdtempSync(join(tmpdir(), "grid-save-log-"))
  try {
    const file = join(directory, "run.log")
    const result = runGrid(["scenarios/melee-kill", "--headless", "--json", "--save-log", file])
    assert.equal(result.status, 0)
    JSON.parse(result.stdout) // --json still produced structured output on stdout
    const saved = readFileSync(file, "utf8")
    assert.match(saved, /WARN {2}report/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("--events writes the ordered event stream as JSONL", () => {
  const directory = mkdtempSync(join(tmpdir(), "grid-events-"))
  try {
    const file = join(directory, "events.jsonl")
    const result = runGrid(["scenarios/melee-kill", "--headless", "--events", file])
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

test("--json produces a machine-readable summary instead of the log", () => {
  const result = runGrid(["scenarios/melee-kill", "--headless", "--json"])
  const parsed = JSON.parse(result.stdout) as Record<string, unknown>
  assert.equal(parsed["scenario"], "melee-kill")
  assert.equal(typeof parsed["stateHash"], "string")
  assert.equal((parsed["stateHash"] as string).length, 64)
  assert.equal(typeof parsed["contentLock"], "string")
  assert.equal(parsed["engineVersion"], "0.1.0-gate1a")
})

test("--verify defaults to 10 runs and is green on every checked-in map", { timeout: 120_000 }, () => {
  for (const name of scenarioFiles()) {
    const result = runGrid([`scenarios/${name}`, "--verify"])
    assert.equal(result.status, 0, `${name}: ${result.stderr}`)
    assert.match(result.stdout, /^runs {7}10 identical$/m, name)
  }
})

test("--verify --runs overrides the default, and --turn compares an intermediate tick", () => {
  const result = runGrid(["scenarios/citizen-mirror-skirmish", "--verify", "--runs", "3", "--turn", "10"])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /^runs {7}3 identical$/m)
  assert.match(result.stdout, /^tick 10 {3}sha256:[0-9a-f]{16}$/m)
})

test("watch (no flags) without a TTY prints one line and no escapes", () => {
  const result = runGrid(["scenarios/melee-kill"])
  assert.equal(result.status, 0)
  const lines = result.stdout.trim().split("\n")
  assert.equal(lines.length, 1, `watch printed ${lines.length} lines`)
  assert.doesNotMatch(result.stdout, new RegExp(String.fromCharCode(27)), "watch emitted escapes")
  assert.match(lines[0] ?? "", /^melee-kill  ticks \d+  state sha256:[0-9a-f]{16}  events sha256:[0-9a-f]{16}$/)
})

test("watch and --headless --json agree on the hashes they report", () => {
  const headless = JSON.parse(
    runGrid(["scenarios/citizen-mirror-skirmish", "--headless", "--json"]).stdout,
  ) as { stateHash: string; eventsHash: string }
  const watched = runGrid(["scenarios/citizen-mirror-skirmish"]).stdout
  assert.ok(watched.includes(`state sha256:${headless.stateHash.slice(0, 16)}`), watched)
  assert.ok(watched.includes(`events sha256:${headless.eventsHash.slice(0, 16)}`), watched)
})

test("a map that fails to load reports an ERROR and a non-zero status", () => {
  const result = runGrid(["scenarios/does-not-exist", "--headless"])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /ERROR/)
})

test("no map given is a usage error, not a crash", () => {
  const result = runGrid([])
  assert.equal(result.status, 2)
  assert.match(result.stderr, /needs a map file/)
})

// Cross-runtime agreement is the only cheap test of the serialization and iteration assumptions
// that twenty runs on one machine can never catch, so it is registered whenever Bun exists.
if (bunAvailable()) {
  // Two subprocess spawns per scenario (Node and Bun each), so this is the single most expensive
  // test in the suite and the one whose cost scales most directly with scenario count - the exact
  // class of test DEVELOPMENT.md warns about. It first crossed Bun's 5000ms default per-test timeout
  // when the unit-design-architecture spike's eleven new scenarios landed; the fix is the same one
  // documented there, an explicit timeout third argument, not a smaller scenario count.
  test(
    "--headless --json produces identical hashes under Bun and under Node",
    { timeout: 120_000 },
    () => {
      for (const name of scenarioFiles()) {
        const node = runGrid([`scenarios/${name}`, "--headless", "--json"])
        const bun = runGrid([`scenarios/${name}`, "--headless", "--json"], "bun")
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
    },
  )
}
