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
  assert.match(result.stdout, /Skirmish, Story, Settings, About, Exit/)
})

test("an unknown --colors is a clear error, not a silent fallback", () => {
  const result = runTerminalNexus(["--colors", "hd"])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unknown colour depth/)
})

test("--capability, this setting's old name, is refused with the name that replaced it", () => {
  const result = runTerminalNexus(["--capability", "truecolor"])
  assert.equal(result.status, 2)
  assert.match(result.stderr, /--capability is gone: it is called --colors now/)
})

test("an argument the game does not read is refused before any screen, and a removed flag names what replaced it", () => {
  // A command pasted from an older note must not open somewhere it did not mean: the title menu cannot reach the
  // Build Phase, so an ignored --build-phase would strand whoever typed it there.
  const old = runTerminalNexus(["--build-phase"])
  assert.equal(old.status, 2)
  assert.equal(old.stdout, "")
  assert.equal(old.stderr, "terminal-nexus: --build-phase is gone: --at 'story?mission=vasse-test-1' opens its Build Phase.\nterminal-nexus --help lists every option.\n")
  const several = runTerminalNexus(["--spike", "--fast", "skirmish-testing/rules/melee-kill.save.json"])
  assert.equal(several.status, 2)
  assert.match(several.stderr, /--spike is gone: --at 'story\?mission=vasse-test-1'/)
  assert.match(several.stderr, /unknown option --fast\./)
  assert.match(several.stderr, /unexpected "skirmish-testing\/rules\/melee-kill\.save\.json"\./)
  // A retired option says what changed, its value refused with it.
  const retired = runTerminalNexus(["--tile-width", "2"])
  assert.equal(retired.status, 2)
  assert.equal(retired.stderr, "terminal-nexus: --tile-width is gone: a tile is one column wide at every terminal size.\nterminal-nexus --help lists every option.\n")
  // What the game does read still opens: a flag and an option it knows.
  const known = runTerminalNexus(["--reduced-motion", "--theme", "light"])
  assert.equal(known.status, 0, known.stderr)
})

test("an unknown --theme is a clear error", () => {
  const result = runTerminalNexus(["--theme", "sepia"])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unknown theme/)
})

test("--at reaches the screen loop its route names: a story mission and a Skirmish the Build Phase, a title menu place the menu", () => {
  // Same rule as a plain launch: no terminal, no escape sequences, one line — the screen loop's own, which is how
  // this shows which loop the route reached.
  for (const [route, loop] of [
    ["story?mission=vasse-test-1&round=2", /^terminal-nexus needs an interactive terminal for the Build Phase\.$/],
    ["story?mission=vasse-test-1", /^terminal-nexus needs an interactive terminal for the Build Phase\.$/],
    ["settings", /^terminal-nexus needs an interactive terminal for its menu\.$/],
    ["skirmish", /^terminal-nexus needs an interactive terminal for the Build Phase\.$/],
    ["skirmish?seed=7", /^terminal-nexus needs an interactive terminal for the Build Phase\.$/],
    ["skirmish?load=saves/crossing-round-4.save.json", /^terminal-nexus needs an interactive terminal for the Build Phase\.$/],
    ["story", /^terminal-nexus needs an interactive terminal for its menu\.$/],
    ["", /^terminal-nexus needs an interactive terminal for its menu\.$/],
  ] as const) {
    const result = runTerminalNexus(["--at", route])
    assert.equal(result.status, 0, `--at "${route}": ${result.stderr}`)
    assert.equal(result.stderr, "")
    assert.doesNotMatch(result.stdout, new RegExp(ESC), `--at "${route}" wrote an escape sequence`)
    assert.match(result.stdout.trimEnd(), loop, `--at "${route}"`)
  }
})

test("a route that is not a place is refused before any screen, every problem at once, naming what exists", () => {
  const result = runTerminalNexus(["--at", "story?mission=nowhere&round=9&colour=red"])
  assert.equal(result.status, 2)
  assert.equal(result.stdout, "")
  assert.match(result.stderr, /--at "story\?mission=nowhere&round=9&colour=red" is not a place in the game:/)
  assert.match(result.stderr, /story takes no colour: it reads mission and round/)
  assert.match(result.stderr, /no mission "nowhere": the missions are vasse-test-1 \(/)
  const place = runTerminalNexus(["--at", "nowhere"])
  assert.equal(place.status, 2)
  assert.match(place.stderr, /no place named "nowhere": the places are menu, skirmish, story, settings and about/)
  // An old note's route says what replaced it.
  const old = runTerminalNexus(["--at", "campaign?level=vasse-test-1"])
  assert.equal(old.status, 2)
  assert.match(old.stderr, /campaign is Story now: story, or story\?mission=vasse-test-1/)
  assert.doesNotMatch(place.stderr + place.stdout, new RegExp(ESC))
})

test("--keys and --scroll-margin are refused on a title menu route: only a Build Phase reads them", () => {
  for (const argv of [["--at", "settings", "--keys", "Down"], ["--scroll-margin", "20"], ["--at", "menu", "--keys", "q", "--scroll-margin", "20"]]) {
    const result = runTerminalNexus(argv)
    assert.equal(result.status, 2, argv.join(" "))
    assert.match(result.stderr, /for a Build Phase/, argv.join(" "))
  }
})

test("--help documents --at with every place and level, and the one tuning flag", () => {
  // "A hotkey that is not displayed does not exist", applied to the command line: a flag nobody can
  // find is a flag nobody can try.
  const result = runTerminalNexus(["--help"])
  assert.match(result.stdout, /--at <route>/)
  for (const place of ["menu", "story", "settings", "about"]) assert.match(result.stdout, new RegExp(`^ +${place} +the`, "m"))
  assert.match(result.stdout, /^ +skirmish +a Skirmish/m)
  assert.match(result.stdout, /--at 'story\?mission=vasse-test-1'/)
  assert.match(result.stdout, /--at 'story\?mission=vasse-test-1&round=3'/)
  assert.match(result.stdout, /--load <file>/)
  assert.match(result.stdout, /--p1 <who>, --p2 <who>/)
  assert.match(result.stdout, /vasse-test-1 +Perimeter, rounds 1 to 3/)
  assert.match(result.stdout, /--scroll-margin/)
  assert.match(result.stdout, /jumpStep=12&reducedMotion=true/)
})

test("--load opens a save at its Build Phase, with --p1 and --p2 as the skirmish command takes them, and refuses what the screen cannot play", () => {
  const loaded = runTerminalNexus(["--load", "saves/crossing-round-4.save.json", "--p2", "script:turtle"])
  assert.equal(loaded.status, 0, loaded.stderr)
  assert.match(loaded.stdout.trimEnd(), /^terminal-nexus needs an interactive terminal for the Build Phase\.$/)
  // A save the loader refuses is refused by name, every problem at once, before any screen.
  const missing = runTerminalNexus(["--load", "nowhere.save.json"])
  assert.equal(missing.status, 2)
  assert.match(missing.stderr, /^terminal-nexus: cannot read the save nowhere\.save\.json/u)
  const notSave = runTerminalNexus(["--load", "package.json"])
  assert.equal(notSave.status, 2)
  assert.match(notSave.stderr, /package\.json is not a save the game can load:\n {2}format: /u)
  // The screen plays p1; p2 a script.
  const spectating = runTerminalNexus(["--load", "saves/crossing-round-4.save.json", "--p1", "script:rush"])
  assert.equal(spectating.status, 2)
  assert.match(spectating.stderr, /no slot is a player: watching two scripts \(spectating\) is not built yet/u)
  const versus = runTerminalNexus(["--at", "skirmish", "--p2", "build:"])
  assert.equal(versus.status, 2)
  assert.match(versus.stderr, /both slots are players: two players at one screen wait for Versus/u)
  const unknown = runTerminalNexus(["--at", "skirmish", "--p2", "script:aggro"])
  assert.equal(unknown.status, 2)
  assert.match(unknown.stderr, /--p2 script:aggro: no script "aggro"/u)
  // --p1 and --p2 are a Skirmish's; --load and --at are two ways to say where.
  const story = runTerminalNexus(["--at", "story?mission=vasse-test-1", "--p2", "script:rush"])
  assert.equal(story.status, 2)
  assert.match(story.stderr, /name who plays a Skirmish's slots/u)
  const both = runTerminalNexus(["--at", "settings", "--load", "saves/crossing-round-4.save.json"])
  assert.equal(both.status, 2)
  assert.match(both.stderr, /give one of them/u)
})

test("a nonsense --scroll-margin is a clear error, not a silently ignored flag", () => {
  const result = runTerminalNexus(["--at", "story?mission=vasse-test-1", "--scroll-margin", "wide"])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /--scroll-margin must be an integer/)
})
