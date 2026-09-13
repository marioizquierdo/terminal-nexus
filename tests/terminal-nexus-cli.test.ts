// `terminal-nexus` as a real subprocess — mirrors tests/cli.test.ts's approach for `grid`.

import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { REPO_ROOT } from "./helpers.ts"

const TERMINAL_NEXUS_BIN = join(REPO_ROOT, "bin", "terminal-nexus.ts")
const ESC = String.fromCharCode(27)

function runTerminalNexus(args: readonly string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [TERMINAL_NEXUS_BIN, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  })
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr }
}

test("launching without a TTY prints one readable line and no escape sequences (engine.md 10.1)", () => {
  const result = runTerminalNexus([])
  assert.equal(result.status, 0)
  assert.equal(result.stderr, "")
  assert.doesNotMatch(result.stdout, new RegExp(ESC), "a non-TTY launch emitted an escape sequence")
  const lines = result.stdout.trimEnd().split("\n")
  assert.equal(lines.length, 1, `expected exactly one line, got ${lines.length}`)
  assert.match(lines[0] ?? "", /interactive terminal/)
})

test("--help prints usage and exits zero without needing a terminal at all", () => {
  const result = runTerminalNexus(["--help"])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /terminal-nexus/)
  assert.match(result.stdout, /Campaign, Challenge, Settings, Exit/)
})

test("an unknown --capability is a clear error, not a silent fallback", () => {
  const result = runTerminalNexus(["--capability", "hd"])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unknown capability/)
})

test("an unknown --theme is a clear error", () => {
  const result = runTerminalNexus(["--theme", "sepia"])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unknown theme/)
})
