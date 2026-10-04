// `terminal-nexus` as a real subprocess — mirrors tests/grid-cli.test.ts's approach for `grid`.

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

test("launching without a TTY prints one readable line and no escape sequences (docs/system-design/runtime.md, Terminal lifecycle)", () => {
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
  assert.match(result.stdout, /Campaign, Challenge, Settings, About, Exit/)
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

test("--build-phase without a TTY says the Build Phase needs one, in one line, and never writes an escape sequence", () => {
  // Same rule as a plain launch: no terminal, no escape sequences, one line — the Build Phase's, which is how
  // this shows the old flag still opens the Build Phase rather than the menu.
  const result = runTerminalNexus(["--build-phase"])
  assert.equal(result.status, 0)
  assert.equal(result.stderr, "")
  assert.doesNotMatch(result.stdout, new RegExp(ESC))
  assert.match(result.stdout.trimEnd(), /^terminal-nexus needs an interactive terminal for the Build Phase\.$/)
})

test("--spike is still accepted as an alias of --build-phase", () => {
  const result = runTerminalNexus(["--spike"])
  assert.equal(result.status, 0)
  assert.match(result.stdout.trimEnd(), /^terminal-nexus needs an interactive terminal for the Build Phase\.$/)
})

test("--at reaches the screen loop its route names: a campaign level the Build Phase, a title menu place the menu", () => {
  for (const [route, loop] of [
    ["campaign?level=vasse-test-1&round=2", /for the Build Phase\.$/],
    ["campaign?level=vasse-test-1", /for the Build Phase\.$/],
    ["settings", /for its menu\.$/],
    ["challenge", /for its menu\.$/],
    ["", /for its menu\.$/],
  ] as const) {
    const result = runTerminalNexus(["--at", route])
    assert.equal(result.status, 0, `--at "${route}": ${result.stderr}`)
    assert.equal(result.stderr, "")
    assert.match(result.stdout.trimEnd(), loop, `--at "${route}"`)
  }
})

test("a route that is not a place is refused before any screen, every problem at once, naming what exists", () => {
  const result = runTerminalNexus(["--at", "campaign?level=nowhere&round=9&colour=red"])
  assert.equal(result.status, 2)
  assert.equal(result.stdout, "")
  assert.match(result.stderr, /--at "campaign\?level=nowhere&round=9&colour=red" is not a place in the game:/)
  assert.match(result.stderr, /campaign takes no colour: it reads level and round/)
  assert.match(result.stderr, /no level "nowhere": the levels are vasse-test-1 \(/)
  const place = runTerminalNexus(["--at", "nowhere"])
  assert.equal(place.status, 2)
  assert.match(place.stderr, /no place named "nowhere": the places are menu, campaign, challenge, settings and about/)
  assert.doesNotMatch(place.stderr + place.stdout, new RegExp(ESC))
})

test("--keys and --scroll-margin are refused on a title menu route: only a campaign level reads them", () => {
  for (const argv of [["--at", "settings", "--keys", "Down"], ["--scroll-margin", "20"], ["--at", "menu", "--keys", "q", "--scroll-margin", "20"]]) {
    const result = runTerminalNexus(argv)
    assert.equal(result.status, 2, argv.join(" "))
    assert.match(result.stderr, /for a campaign level's Build Phase/, argv.join(" "))
  }
})

test("--help documents --at with every place and level, the old flags as its alias, and the one tuning flag", () => {
  // "A hotkey that is not displayed does not exist", applied to the command line: a flag nobody can
  // find is a flag nobody can try.
  const result = runTerminalNexus(["--help"])
  assert.match(result.stdout, /--at <route>/)
  for (const place of ["menu", "campaign", "challenge", "settings", "about"]) assert.match(result.stdout, new RegExp(`^ +${place} +the`, "m"))
  assert.match(result.stdout, /--at 'campaign\?level=vasse-test-1&round=3'/)
  assert.match(result.stdout, /vasse-test-1 +Perimeter, rounds 1 to 3/)
  assert.match(result.stdout, /--build-phase, --spike\n +the same as --at 'campaign\?level=vasse-test-1', kept for one more release/)
  assert.match(result.stdout, /--scroll-margin/)
  assert.match(result.stdout, /trainEvery=6&reducedMotion=true/)
})

test("a nonsense --scroll-margin is a clear error, not a silently ignored flag", () => {
  const result = runTerminalNexus(["--at", "campaign?level=vasse-test-1", "--scroll-margin", "wide"])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /--scroll-margin must be an integer/)
})
