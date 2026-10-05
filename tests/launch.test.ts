// What a run starts from (src/cli/launch.ts): where it opens, the settings text it starts with and the keys it
// plays first, read once for every way of starting one — the game's command line, the scripted playtest's, the
// browser page's address and a demo. What each then does with a launch is in its own tests: the game's in
// `tests/terminal-nexus-cli.test.ts`, the playtest's in `tests/route-open.test.ts`, the page's and the demos' in
// `tests/web.test.ts`.

import { test } from "node:test"
import assert from "node:assert/strict"
import { parseArgs } from "../src/cli/args.ts"
import { LAUNCH_PARTS, readLaunch } from "../src/cli/launch.ts"
import type { Launch } from "../src/cli/launch.ts"
import { DEFAULT_LEVEL_ROUTE, RouteError, parseRoute } from "../src/cli/route.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { readAddress } from "../src/web/address.ts"
import { checkDemos } from "../src/web/demos.ts"

/** Where a launch opens, as plain data. */
const where = ({ destination }: Launch): string =>
  destination.kind === "title" ? `title ${destination.place}` : `level ${destination.level.id} round ${destination.round}`

test("a launch opens where its route says, and where its host starts without one", () => {
  // The game's bare command opens the title menu; the page, a demo and the scripted playtest the default level.
  assert.equal(where(readLaunch({}, "menu").launch), "title menu")
  assert.equal(where(readLaunch({ at: undefined }, DEFAULT_LEVEL_ROUTE).launch), "level vasse-test-1 round 1")
  assert.equal(where(readLaunch({ at: "about" }, "menu").launch), "title about")
  assert.equal(where(readLaunch({ at: "" }, DEFAULT_LEVEL_ROUTE).launch), "title menu")
  assert.equal(where(readLaunch({ at: "campaign?level=vasse-test-1" }, "menu").launch), "level vasse-test-1 round 1")
  assert.equal(where(readLaunch({ at: "campaign?level=vasse-test-1&round=3" }, "menu").launch), "level vasse-test-1 round 3")
})

test("a launch keeps its settings text as written, and reads its keys as a key script", () => {
  const { launch, problems } = readLaunch({ at: "campaign?level=vasse-test-1&round=2", settings: "jumpStep=12&reducedMotion=true", keys: "Esc n 1" }, "menu")
  assert.deepEqual(problems, [])
  assert.equal(launch.settings, "jumpStep=12&reducedMotion=true")
  assert.deepEqual(launch.keys, parseKeyScript("Esc n 1"))
  // An empty script is no keys, and no problem; a launch with neither part keeps neither.
  assert.deepEqual(readLaunch({ keys: "" }, "menu").launch.keys, [])
  assert.deepEqual(Object.keys(readLaunch({}, "menu").launch), ["destination"])
})

test("what a launch cannot read is said part by part and left out: a route that is not a place opens the host's start", () => {
  const route = "campaign?level=nowhere&colour=red"
  const { launch, problems } = readLaunch({ at: route, settings: "foo=1", keys: "Esc Dwn" }, DEFAULT_LEVEL_ROUTE)
  assert.deepEqual(problems.map((problem) => problem.part), ["at", "keys"])
  const [at, keys] = problems
  // Every problem with the route at once, as the route grammar refuses it.
  assert.ok(at?.error instanceof RouteError)
  assert.throws(() => parseRoute(route), (error: unknown) => error instanceof RouteError && error.message === at.error.message)
  assert.match(keys?.error.message ?? "", /unknown key "Dwn"/u)
  assert.equal(where(launch), "level vasse-test-1 round 1")
  assert.equal(launch.keys, undefined)
  // Each host reads a settings text over its own saved settings, so it is kept as written.
  assert.equal(launch.settings, "foo=1")
})

test("every launch part arrives through the game's argument parser whole, in both of its forms", () => {
  // A parser that took an unknown option for a flag would drop the text: the route, the settings or the keys.
  for (const part of LAUNCH_PARTS) {
    const text = part === "at" ? "campaign?level=vasse-test-1&round=2" : "a=1&b=2 c"
    assert.equal(parseArgs([`--${part}`, text]).options.get(part), text, `--${part}`)
    assert.equal(parseArgs([`--${part}=${text}`]).options.get(part), text, `--${part}=`)
    assert.deepEqual([...parseArgs([`--${part}`, text]).flags], [], `--${part}`)
    assert.throws(() => parseArgs([`--${part}`]), new RegExp(`option --${part} needs a value`, "u"))
  }
})

test("the page's address and a demo read every launch part", () => {
  const written: Readonly<Record<(typeof LAUNCH_PARTS)[number], string>> = { at: "settings", settings: "theme=light", keys: "Esc" }
  for (const part of LAUNCH_PARTS) {
    assert.deepEqual(readAddress(`#${part}=${written[part]}`), { [part]: written[part] }, `#${part}=`)
    assert.equal(checkDemos([{ label: "x", try: "-", [part]: written[part] }], "demos.json")[0]?.[part], written[part], `a demo's ${part}`)
  }
})
