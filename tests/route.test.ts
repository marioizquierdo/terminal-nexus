// Routes (src/cli/route.ts): a place in the game written like a web address without its site, the one grammar
// `--at`, the title menu's rows, the browser page's `#at=` and a demo's `at` read. What a route opens on the real
// screen loops is `tests/route-open.test.ts`.

import { test } from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_LEVEL, LEVELS } from "../src/cli/levels.ts"
import { TOP_LEVEL_ITEMS } from "../src/cli/menu.ts"
import { DEFAULT_LEVEL_ROUTE, PLACES, PLACE_NAMES, RouteError, allRoutes, formatRoute, parseRoute } from "../src/cli/route.ts"
import type { Destination } from "../src/cli/route.ts"
import { openSkirmish } from "../src/cli/skirmish-open.ts"
import { VALUE_OPTIONS } from "../src/cli/args.ts"
import { main as skirmishMain } from "../src/cli/skirmish.ts"
import { ASK_WORDS, askWords, readAsk } from "../src/skirmish/ask.ts"
import { SHIPPED_PROFILES } from "../src/skirmish/shipped-players.ts"

/** A destination as plain data: its kind, and its place or its level's id and round. */
const plain = (destination: Destination): string => {
  if (destination.kind === "title") return `title ${destination.place}`
  if (destination.kind === "skirmish") return `skirmish ${destination.load ?? destination.seed ?? "clock"}`
  return `level ${destination.level.id} round ${destination.round}`
}

/** The problems a route is refused with — failing the test when it is not refused. */
function problemsOf(route: string): readonly string[] {
  try {
    parseRoute(route)
  } catch (error) {
    assert.ok(error instanceof RouteError, `"${route}" threw something other than a RouteError: ${String(error)}`)
    assert.equal(error.route, route)
    return error.problems
  }
  assert.fail(`"${route}" was not refused`)
}

test("each route parses to the place it names", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["", "title menu"],
    ["menu", "title menu"],
    ["settings", "title settings"],
    ["about", "title about"],
    ["story", "title story"],
    ["skirmish", "skirmish clock"],
    // An address's habits: a slash, a capital, an empty query, a trailing &, percent-encoding.
    ["/settings/", "title settings"],
    ["Settings", "title settings"],
    ["story?", "title story"],
    ["story?mission=vasse-test-1", "level vasse-test-1 round 1"],
    ["story?mission=vasse-test-1&round=1", "level vasse-test-1 round 1"],
    ["story?mission=vasse-test-1&round=2", "level vasse-test-1 round 2"],
    ["story?mission=vasse-test-1&round=3&", "level vasse-test-1 round 3"],
    ["story?round=3&mission=vasse-test-1", "level vasse-test-1 round 3"],
    ["STORY?Mission=vasse-test-1&ROUND=2", "level vasse-test-1 round 2"],
    ["story?mission=vasse%2Dtest%2D1&round=%32", "level vasse-test-1 round 2"],
    // Skirmish: a seed, a save file, or neither (the game chooses the seed from the clock, which a route never reads).
    ["skirmish?seed=1234", "skirmish 1234"],
    ["skirmish?load=saves/crossing-round-4.save.json", "skirmish saves/crossing-round-4.save.json"],
    ["Skirmish?Load=tmp%2Fmine.save.json", "skirmish tmp/mine.save.json"],
  ]
  for (const [route, expected] of cases) assert.equal(plain(parseRoute(route)), expected, `"${route}"`)
})

test("an encoded ? is part of the place's name, not the start of a query", () => {
  // The query is split off before anything is decoded, so `%3F` cannot start one: the name is refused whole.
  assert.match(problemsOf("story%3Fmission%3Dvasse-test-1")[0] ?? "", /no place named "story\?mission=vasse-test-1"/u)
})

test("a route counts Battle Rounds from 1, as the screen does, on every level", () => {
  for (const level of LEVELS) {
    for (let round = 1; round <= level.rounds; round += 1) {
      const destination = parseRoute(`story?mission=${level.id}&round=${round}`)
      assert.equal(destination.kind === "level" ? destination.round : null, round, `${level.id} round ${round}`)
    }
  }
})

test("every route the game has reads back to itself, and each place lists the routes it names", () => {
  const routes = allRoutes()
  assert.equal(new Set(routes).size, routes.length, "a route is listed twice")
  for (const route of routes) assert.equal(formatRoute(parseRoute(route)), route)
  // Every place, every level and every round of it: the table the routing page, --help and the opening test read.
  assert.deepEqual(PLACE_NAMES, ["menu", "skirmish", "story", "settings", "about"])
  for (const name of PLACE_NAMES) assert.ok(routes.includes(name), `the place ${name} is not among the routes`)
  for (const level of LEVELS) {
    for (let round = 1; round <= level.rounds; round += 1) {
      assert.ok(routes.includes(formatRoute({ kind: "level", level, round })), `${level.id} round ${round} is not among the routes`)
    }
  }
  assert.equal(formatRoute({ kind: "level", level: DEFAULT_LEVEL, round: 1 }), "story?mission=vasse-test-1")
  assert.equal(formatRoute({ kind: "level", level: DEFAULT_LEVEL, round: 3 }), "story?mission=vasse-test-1&round=3")
  // The default level's route is its first round, the one the page and the scripted playtest open unless told.
  assert.equal(DEFAULT_LEVEL_ROUTE, "story?mission=vasse-test-1")
  // A title place's route is its name, and opens itself; a Skirmish's is a battle to open.
  for (const name of PLACE_NAMES) {
    const destination = parseRoute(name)
    // The Story names its missions' rounds too, and Skirmish a seed and a save.
    if (name !== "story" && name !== "skirmish") assert.deepEqual(PLACES[name]?.routes(), [name])
    assert.equal(destination.kind, name === "skirmish" ? "skirmish" : "title")
  }
})

test("a broken route is refused whole: every problem at once, each naming what exists", () => {
  const places = "the places are menu, skirmish, story, settings and about"
  const levels = `the missions are ${LEVELS.map((level) => `${level.id} (${level.title}, rounds 1 to ${level.rounds})`).join(", ")}`
  const cases: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["nowhere", [`no place named "nowhere": ${places}`]],
    ["nowhere?mission=x&mission=y", [`no place named "nowhere": ${places}`, "mission is given twice"]],
    ["settings?mission=vasse-test-1", ["settings takes no mission: it reads no query"]],
    // The places the Skirmish milestone renamed say what replaced them.
    ["campaign?level=vasse-test-1", ["campaign is Story now: story, or story?mission=vasse-test-1"]],
    ["challenge?seed=1", ["Challenge runs are retired: skirmish starts one battle (skirmish?seed=1234)"]],
    ["menu?x=1&y=2", ["menu takes no x: it reads no query", "menu takes no y: it reads no query"]],
    [
      "story?mission=nowhere&round=9&colour=red",
      ["story takes no colour: it reads mission and round", `no mission "nowhere": ${levels}`],
    ],
    ["story?mission=vasse-test-1&round=0", ['mission "vasse-test-1" has rounds 1 to 3, not 0']],
    ["story?mission=vasse-test-1&round=4", ['mission "vasse-test-1" has rounds 1 to 3, not 4']],
    ["story?mission=vasse-test-1&round=two", ['round must be a whole number, not "two"']],
    ["story?mission=vasse-test-1&round=-1", ['round must be a whole number, not "-1"']],
    // A route counts Battle Rounds: the word it once took for them is a name the place does not read.
    ["story?mission=vasse-test-1&wave=0", ["story takes no wave: it reads mission and round"]],
    ["story?round=2", ["a round needs a mission: story?mission=vasse-test-1&round=2"]],
    ["story?mission", ["mission needs a value: mission=..."]],
    ["story?mission=&round=2", ["mission needs a value: mission=...", "a round needs a mission: story?mission=vasse-test-1&round=2"]],
    ["story?=3", ['"=3" has no name before its =']],
    ["story?mission=vasse-test-1&mission=vasse-test-1", ["mission is given twice"]],
    ["story?level=vasse-test-1", ["story takes no level: it reads mission and round"]],
    ["story?mission=%zz", ['"%zz" is not readable: a % must start an escape like %20']],
    [
      "skirmish?seed=lots&round=2",
      ["skirmish takes no round: it reads load, seed, map, ticks, rounds, modifiers, p1, p2, p1-commander, p2-commander, p1-credits, p2-credits and setup", 'seed must be a whole number from 0 to 999999, not "lots"'],
    ],
    ["skirmish?seed=1000000", ['seed must be a whole number from 0 to 999999, not "1000000"']],
    ["skirmish?seed=1&load=x.save.json", ["seed sets up a new battle: a loaded save keeps its own"]],
  ]
  for (const [route, expected] of cases) assert.deepEqual(problemsOf(route), expected, `"${route}"`)
  // The message says the route and every problem, for a command line that shows only the message.
  assert.throws(() => parseRoute("story?mission=nowhere&colour=red"), (error: unknown) => {
    assert.ok(error instanceof RouteError)
    assert.match(error.message, /^"story\?mission=nowhere&colour=red" is not a place in the game: story takes no colour.*; no mission "nowhere"/u)
    return true
  })
})

test("each title menu row that opens a place names its route, the route of the place it is", () => {
  const routes = TOP_LEVEL_ITEMS.flatMap((item) => (item.route === undefined ? [] : [item.route]))
  for (const item of TOP_LEVEL_ITEMS) {
    if (item.id === "exit") {
      assert.equal(item.route, undefined, "Exit opens no place")
      continue
    }
    assert.ok(item.route !== undefined, `the ${item.id} row names no route`)
    const expected = { kind: "title", place: item.id }
    assert.deepEqual(parseRoute(item.route), expected, `the ${item.id} row's route leads elsewhere`)
  }
  // Every title menu place but the menu itself has its row, and only one.
  for (const name of PLACE_NAMES.filter((place) => place !== "menu")) {
    const naming = routes.filter((route) => route.split("?")[0] === name).length
    assert.equal(naming, 1, `${name} is named by ${naming} rows`)
  }
})

test("a Skirmish route names a seed or a save file, and reads back to itself", () => {
  assert.deepEqual(parseRoute("skirmish?seed=1234"), { kind: "skirmish", seed: 1234 })
  assert.equal(formatRoute(parseRoute("skirmish?seed=1234")), "skirmish?seed=1234")
  assert.deepEqual(parseRoute("skirmish?load=tmp/mine.save.json"), { kind: "skirmish", load: "tmp/mine.save.json" })
  assert.equal(formatRoute(parseRoute("skirmish?load=tmp/mine.save.json")), "skirmish?load=tmp/mine.save.json")
  // With neither, the title menu's Skirmish: the game picks the seed.
  assert.deepEqual(parseRoute("skirmish"), { kind: "skirmish" })
  assert.equal(formatRoute(parseRoute("skirmish")), "skirmish")
})

test("a Skirmish route sets up a new battle under the skirmish command's names, and a battle's own route names its setup", () => {
  const route = "skirmish?seed=7&map=pocket&p2=script:agro&p2-commander=averno&modifiers=fast-rounds,double-income"
  const destination = parseRoute(route)
  assert.deepEqual(destination, { kind: "skirmish", seed: 7, map: "pocket", slots: { p2: "script:agro" }, commanders: { p2: "averno" }, modifiers: ["fast-rounds", "double-income"] })
  assert.equal(formatRoute(destination), route)
  // A loaded save keeps its map, seed and Commanders: who plays, the credits shares, the rounds and the modifiers may change.
  assert.deepEqual(parseRoute("skirmish?load=saves/mine.save.json&p1=script:steady&rounds=10"), { kind: "skirmish", load: "saves/mine.save.json", rounds: 10, slots: { p1: "script:steady" } })
  assert.throws(() => parseRoute("skirmish?load=saves/mine.save.json&map=pocket"), /map sets up a new battle: a loaded save keeps its own/u)
  // Opened, the battle is that setup, and its route reads back to the same battle.
  const opened = openSkirmish({ seed: 7, map: "pocket", slots: { p2: "script:agro" }, commanders: { p2: "averno" }, modifiers: ["fast-rounds"] }, { profiles: SHIPPED_PROFILES })
  assert.equal(opened.level.route, "skirmish?seed=7&map=pocket&p2=script:agro&p2-commander=averno&modifiers=fast-rounds")
  assert.throws(() => openSkirmish({ map: "nowhere" }, { now: () => 0 }), /no map "nowhere"/u)
})

test("the route and the skirmish command read a Skirmish's words with one reader: the same words, the same refusals", () => {
  // The words the command takes are the words the route reads, and the game's command line takes each with its value.
  for (const word of Object.keys(ASK_WORDS)) {
    assert.ok(Object.hasOwn(PLACES["skirmish"]?.query ?? {}, word), `the route reads no ${word}`)
    assert.ok(VALUE_OPTIONS.has(word), `the game's command line would drop --${word}'s value`)
  }
  // The same problem, said each door's way.
  assert.throws(() => parseRoute("skirmish?seed=-3&p1-credits=0"), (error: unknown) => {
    const problems = (error as RouteError).problems
    return problems.includes('seed must be a whole number from 0 to 999999, not "-3"') && problems.includes('p1-credits is a share above 0 (1 is the curve\'s), not "0"')
  })
  assert.equal(skirmishMain(["--map", "pocket", "--seed", "-3", "--p1-credits", "0"], () => {}, SHIPPED_PROFILES, (line) => assert.match(line, /--seed must be a whole number from 0 to 999999, not "-3"\n--p1-credits is a share above 0/u)), 1)
  // A battle asked for on one door opens on the other: the route's words, read back, are the command's flags.
  const ask = readAsk((word) => new Map([["map", "pocket"], ["p2", "script:agro"], ["rounds", "4"]]).get(word)).ask
  assert.deepEqual(askWords(ask), [["map", "pocket"], ["rounds", "4"], ["p2", "script:agro"]])
  // A file whose name a route would misread is escaped, and reads back to itself.
  const odd = formatRoute({ kind: "skirmish", load: "my saves/a&b.save.json", slots: { p1: "build:" } })
  assert.equal(odd, "skirmish?load=my%20saves/a%26b.save.json&p1=build:")
  assert.deepEqual(parseRoute(odd), { kind: "skirmish", load: "my saves/a&b.save.json", slots: { p1: "build:" } })
})
