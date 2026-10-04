// Routes (src/cli/route.ts): a place in the game written like a web address without its site, the one grammar
// `--at`, the title menu's rows, the browser page's `#at=` and a demo's `at` read. What a route opens on the real
// screen loops is `tests/route-open.test.ts`.

import { test } from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_LEVEL, LEVELS } from "../src/cli/levels.ts"
import { TOP_LEVEL_ITEMS } from "../src/cli/menu.ts"
import { DEFAULT_LEVEL_ROUTE, PLACES, PLACE_NAMES, RouteError, allRoutes, formatRoute, parseRoute } from "../src/cli/route.ts"
import type { Destination } from "../src/cli/route.ts"

/** A destination as plain data: its kind, and its place or its level's id and round. */
const plain = (destination: Destination): string =>
  destination.kind === "title" ? `title ${destination.place}` : `level ${destination.level.id} round ${destination.round}`

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
    ["campaign", "title campaign"],
    ["challenge", "title challenge"],
    // An address's habits: a slash, a capital, an empty query, a trailing &, percent-encoding.
    ["/settings/", "title settings"],
    ["Settings", "title settings"],
    ["campaign?", "title campaign"],
    ["campaign?level=vasse-test-1", "level vasse-test-1 round 1"],
    ["campaign?level=vasse-test-1&round=1", "level vasse-test-1 round 1"],
    ["campaign?level=vasse-test-1&round=2", "level vasse-test-1 round 2"],
    ["campaign?level=vasse-test-1&round=3&", "level vasse-test-1 round 3"],
    ["campaign?round=3&level=vasse-test-1", "level vasse-test-1 round 3"],
    ["CAMPAIGN?Level=vasse-test-1&ROUND=2", "level vasse-test-1 round 2"],
    ["campaign?level=vasse%2Dtest%2D1&round=%32", "level vasse-test-1 round 2"],
  ]
  for (const [route, expected] of cases) assert.equal(plain(parseRoute(route)), expected, `"${route}"`)
})

test("an encoded ? is part of the place's name, not the start of a query", () => {
  // The query is split off before anything is decoded, so `%3F` cannot start one: the name is refused whole.
  assert.match(problemsOf("campaign%3Flevel%3Dvasse-test-1")[0] ?? "", /no place named "campaign\?level=vasse-test-1"/u)
})

test("a route counts Battle Rounds from 1, as the screen does, on every level", () => {
  for (const level of LEVELS) {
    for (let round = 1; round <= level.rounds; round += 1) {
      const destination = parseRoute(`campaign?level=${level.id}&round=${round}`)
      assert.equal(destination.kind === "level" ? destination.round : null, round, `${level.id} round ${round}`)
    }
  }
})

test("every route the game has reads back to itself, and each place lists the routes it names", () => {
  const routes = allRoutes()
  assert.equal(new Set(routes).size, routes.length, "a route is listed twice")
  for (const route of routes) assert.equal(formatRoute(parseRoute(route)), route)
  // Every place, every level and every round of it: the table the routing page, --help and the opening test read.
  assert.deepEqual(PLACE_NAMES, ["menu", "campaign", "challenge", "settings", "about"])
  for (const name of PLACE_NAMES) assert.ok(routes.includes(name), `the place ${name} is not among the routes`)
  for (const level of LEVELS) {
    for (let round = 1; round <= level.rounds; round += 1) {
      assert.ok(routes.includes(formatRoute({ kind: "level", level, round })), `${level.id} round ${round} is not among the routes`)
    }
  }
  assert.equal(formatRoute({ kind: "level", level: DEFAULT_LEVEL, round: 1 }), "campaign?level=vasse-test-1")
  assert.equal(formatRoute({ kind: "level", level: DEFAULT_LEVEL, round: 3 }), "campaign?level=vasse-test-1&round=3")
  // The default level's route is its first round, the one the page and the scripted playtest open unless told.
  assert.equal(DEFAULT_LEVEL_ROUTE, "campaign?level=vasse-test-1")
  // A title place's route is its name, and opens itself.
  for (const name of PLACE_NAMES) {
    const destination = parseRoute(name)
    if (name !== "campaign") assert.deepEqual(PLACES[name]?.routes(), [name])
    assert.equal(destination.kind, "title")
  }
})

test("a broken route is refused whole: every problem at once, each naming what exists", () => {
  const places = "the places are menu, campaign, challenge, settings and about"
  const levels = `the levels are ${LEVELS.map((level) => `${level.id} (${level.title}, rounds 1 to ${level.rounds})`).join(", ")}`
  const cases: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["nowhere", [`no place named "nowhere": ${places}`]],
    ["nowhere?level=x&level=y", [`no place named "nowhere": ${places}`, "level is given twice"]],
    ["settings?level=vasse-test-1", ["settings takes no level: it reads no query"]],
    ["menu?x=1&y=2", ["menu takes no x: it reads no query", "menu takes no y: it reads no query"]],
    [
      "campaign?level=nowhere&round=9&colour=red",
      ["campaign takes no colour: it reads level and round", `no level "nowhere": ${levels}`],
    ],
    ["campaign?level=vasse-test-1&round=0", ['level "vasse-test-1" has rounds 1 to 3, not 0']],
    ["campaign?level=vasse-test-1&round=4", ['level "vasse-test-1" has rounds 1 to 3, not 4']],
    ["campaign?level=vasse-test-1&round=two", ['round must be a whole number, not "two"']],
    ["campaign?level=vasse-test-1&round=-1", ['round must be a whole number, not "-1"']],
    // A route counts Battle Rounds: the word it once took for them is a name the place does not read.
    ["campaign?level=vasse-test-1&wave=0", ["campaign takes no wave: it reads level and round"]],
    ["campaign?round=2", ["a round needs a level: campaign?level=vasse-test-1&round=2"]],
    ["campaign?level", ["level needs a value: level=..."]],
    ["campaign?level=&round=2", ["level needs a value: level=...", "a round needs a level: campaign?level=vasse-test-1&round=2"]],
    ["campaign?=3", ['"=3" has no name before its =']],
    ["campaign?level=vasse-test-1&level=vasse-test-1", ["level is given twice"]],
    ["campaign?level=%zz", ['"%zz" is not readable: a % must start an escape like %20']],
  ]
  for (const [route, expected] of cases) assert.deepEqual(problemsOf(route), expected, `"${route}"`)
  // The message says the route and every problem, for a command line that shows only the message.
  assert.throws(() => parseRoute("campaign?level=nowhere&colour=red"), (error: unknown) => {
    assert.ok(error instanceof RouteError)
    assert.match(error.message, /^"campaign\?level=nowhere&colour=red" is not a place in the game: campaign takes no colour.*; no level "nowhere"/u)
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
    assert.deepEqual(parseRoute(item.route), { kind: "title", place: item.id }, `the ${item.id} row's route leads elsewhere`)
  }
  // Every title menu place but the menu itself has its row, and only one.
  for (const name of PLACE_NAMES.filter((place) => place !== "menu")) {
    assert.equal(routes.filter((route) => route === name).length, 1, `${name} is named by ${routes.filter((route) => route === name).length} rows`)
  }
})
