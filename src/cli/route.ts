// Routes: a place in the game written like a web address without its site — a path naming the place, then
// optionally `?` and `name=value` pairs joined by `&`. One grammar for every way of going somewhere: `--at` on
// the game and on the scripted playtest, the title menu's rows (each names the route it opens), the browser
// page's `#at=` links and a demo's `at`.
//
//   menu                                    the title menu; an empty route is this one
//   settings   about   story                the title menu's own screens
//   skirmish                                a Skirmish on the defaults, on a seed the game chooses, as its title menu row starts one
//   skirmish?seed=1234                      ... on that seed
//   skirmish?load=saves/crossing.save.json  a save file, opened at its Build Phase
//   story?mission=vasse-test-1              that mission's Build Phase, at its first round
//   story?mission=vasse-test-1&round=3      ... at round 3: a Battle Round, counted from 1 as the screen counts
//
// **A route counts Battle Rounds, from 1**, as the screen does: the owner settled the word (2026-10-04, "let's
// settle in Battle Rounds"), so there is one way to name a round.
//
// **A broken route is refused whole, with every problem at once**, each naming what was written and what exists
// instead: the places, a place's query names, the missions, a mission's rounds. Names are read whatever their case
// and may be percent-encoded, as an address's are; a mission's id and a file's name are matched exactly. The places
// the Skirmish milestone renamed (`campaign`, `challenge`) are refused with the route that replaced them.
//
// **Adding a place is one entry in `PLACES`**: what it opens, the query names it reads, where they lead, and the
// routes it names (which `--help`, the routing page's table and the test that opens every route all read). A
// place that opens a screen nothing opens yet also needs that screen's loop to follow it; the `Destination`
// type makes the type checker name every place that has to learn it.
//
// Pure: no terminal, no file, no clock — a Skirmish's route says what to open (a seed, a file), and the host opens it
// (`./skirmish-open.ts`). It knows the levels (`./levels.ts`), which is why it lives in the application shell rather
// than beside the title menu.

import type { PlayableLevel } from "./levels.ts"
import { DEFAULT_LEVEL, LEVELS, levelById } from "./levels.ts"
import { SKIRMISH_SEED_LIMIT, isSkirmishSeed } from "../skirmish/words.ts"

/** The title menu's places: each opens one of its screens. */
export type TitlePlace = "menu" | "story" | "settings" | "about"

/**
 * Where a route leads: a place on the title menu; a level's Build Phase at one of its rounds (a story mission's, or a
 * Skirmish a host has opened); or **a Skirmish to open** — on the seed the route names or one the game chooses from
 * the clock, which a route never reads, or the save file it names, which a route never reads either. The host opens
 * it (`openSkirmish`, `./skirmish-open.ts`) into a level, with the slots its command line names.
 */
export type Destination =
  | Readonly<{ kind: "title"; place: TitlePlace }>
  | Readonly<{ kind: "level"; level: PlayableLevel; round: number }>
  | Readonly<{ kind: "skirmish"; seed?: number; load?: string }>

export type TitleDestination = Extract<Destination, { kind: "title" }>
export type LevelDestination = Extract<Destination, { kind: "level" }>
export type SkirmishDestination = Extract<Destination, { kind: "skirmish" }>

/** A route that is not a place in the game: every problem with it, each a sentence naming what exists. */
export class RouteError extends Error {
  readonly route: string
  readonly problems: readonly string[]

  constructor(route: string, problems: readonly string[]) {
    super(`"${route}" is not a place in the game: ${problems.join("; ")}`)
    this.name = "RouteError"
    this.route = route
    this.problems = problems
  }
}

type Query = ReadonlyMap<string, string>

/** One place a route can name. */
type Place = Readonly<{
  /** What it opens, in a few words: `--help` and the routing page say it. */
  opens: string
  /** The query names it reads, each with what it means. */
  query: Readonly<Record<string, string>>
  /** Where its query leads, or `null` with the problems said into `problems`. Reads only its own names. */
  resolve: (query: Query, problems: string[]) => Destination | null
  /** Every route it names, to list and to test. */
  routes: () => readonly string[]
}>

/** A title menu place: no query, and always the same screen. */
const titlePlace = (place: TitlePlace, opens: string): Place => ({
  opens,
  query: {},
  resolve: () => ({ kind: "title", place }),
  routes: () => [place],
})

/** A mission as a problem names it: its id, its title and its rounds. */
const describeLevel = (level: PlayableLevel): string => `${level.id} (${level.title}, rounds 1 to ${level.rounds})`

/** `story`: the Story screen, or with a mission, that mission's Build Phase at a round. */
function story(query: Query, problems: string[]): Destination | null {
  const id = query.get("mission")
  const round = query.get("round")
  if (id === undefined) {
    if (round !== undefined) {
      problems.push(`a round needs a mission: ${DEFAULT_LEVEL_ROUTE}&round=2`)
      return null
    }
    return { kind: "title", place: "story" }
  }
  const level = levelById(id)
  if (level === undefined) {
    problems.push(`no mission "${id}": the missions are ${LEVELS.map(describeLevel).join(", ")}`)
    return null
  }
  if (round !== undefined && !/^\d+$/u.test(round)) {
    problems.push(`round must be a whole number, not "${round}"`)
    return null
  }
  const counted = round === undefined ? 1 : Number(round)
  if (counted < 1 || counted > level.rounds) {
    problems.push(`mission "${level.id}" has rounds 1 to ${level.rounds}, not ${counted}`)
    return null
  }
  return { kind: "level", level, round: counted }
}

/** `skirmish`: a new Skirmish on the defaults, on the seed given or one the game chooses; or a save file, at its Build
 *  Phase. A seed and a file are two different battles, so not both. */
function skirmish(query: Query, problems: string[]): Destination | null {
  const seed = query.get("seed")
  const load = query.get("load")
  const before = problems.length
  if (seed !== undefined && load !== undefined) problems.push("seed starts a new battle and load opens a saved one: not both")
  if (seed !== undefined && (!/^\d+$/u.test(seed) || !isSkirmishSeed(Number(seed)))) {
    problems.push(`seed must be a whole number from 0 to ${SKIRMISH_SEED_LIMIT - 1}, not "${seed}"`)
  }
  if (problems.length > before) return null
  if (load !== undefined) return { kind: "skirmish", load }
  return seed === undefined ? { kind: "skirmish" } : { kind: "skirmish", seed: Number(seed) }
}

/** The places the Skirmish milestone renamed, each with what replaced it: a pasted note says where to go now. */
const RENAMED: Readonly<Record<string, string>> = {
  campaign: "campaign is Story now: story, or story?mission=vasse-test-1",
  challenge: "Challenge runs are retired: skirmish starts one battle (skirmish?seed=1234)",
}

/**
 * Every place a route can name, in the title menu's order after the menu itself. **Adding a place is one entry
 * here.**
 */
export const PLACES: Readonly<Record<string, Place>> = {
  menu: titlePlace("menu", "the title menu: Skirmish, Story, Settings, About, Exit"),
  skirmish: {
    opens: "a Skirmish: one battle on the defaults, on a seed the game chooses or the seed given; or a save file",
    query: {
      seed: `a new battle's seed, a whole number from 0 to ${SKIRMISH_SEED_LIMIT - 1}; one the game chooses unless given`,
      load: "a save file to open at its Build Phase, as the game's --load takes it",
    },
    resolve: skirmish,
    routes: () => ["skirmish", "skirmish?seed=1", "skirmish?load=saves/crossing-round-4.save.json"],
  },
  story: {
    opens: "the Story screen; with a mission, that mission's Build Phase at a round",
    query: {
      mission: "the mission's id",
      round: "the Battle Round to open at, counted from 1 as the screen counts; 1 unless given",
    },
    resolve: story,
    routes: () => [
      "story",
      ...LEVELS.flatMap((level) => Array.from({ length: level.rounds }, (_, index) => formatRoute({ kind: "level", level, round: index + 1 }))),
    ],
  },
  settings: titlePlace("settings", "the title menu's Settings screen"),
  about: titlePlace("about", "the title menu's About screen: who made the game, and which build this is"),
}

/** The place names, in order. */
export const PLACE_NAMES: readonly string[] = Object.keys(PLACES)

/** A percent-encoded part of a route, decoded, or `null` with the problem said. */
function decoded(text: string, problems: string[]): string | null {
  try {
    return decodeURIComponent(text)
  } catch {
    problems.push(`"${text}" is not readable: a % must start an escape like %20`)
    return null
  }
}

/** A route's query: its `name=value` pairs, names lower-cased; problems said into `problems`. */
function readQuery(text: string, problems: string[]): Map<string, string> {
  const query = new Map<string, string>()
  for (const pair of text.split("&")) {
    if (pair === "") continue
    const at = pair.indexOf("=")
    const name = decoded(at < 0 ? pair : pair.slice(0, at), problems)?.trim().toLowerCase()
    const value = at < 0 ? "" : (decoded(pair.slice(at + 1), problems)?.trim() ?? null)
    if (name === undefined || value === null) continue
    if (name === "") {
      problems.push(`"${pair}" has no name before its =`)
      continue
    }
    if (value === "") {
      problems.push(`${name} needs a value: ${name}=...`)
      continue
    }
    if (query.has(name)) {
      problems.push(`${name} is given twice`)
      continue
    }
    query.set(name, value)
  }
  return query
}

/** "a, b and c". */
function listed(names: readonly string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1] ?? ""}`
}

/**
 * Where `text` leads. Throws a `RouteError` with every problem at once when it is not a place in the game: an
 * unknown place, a query name the place does not read, a value it cannot take — each naming what exists.
 */
export function parseRoute(text: string): Destination {
  const problems: string[] = []
  const trimmed = text.trim()
  const mark = trimmed.indexOf("?")
  // A leading or trailing slash is an address's habit, not part of the name.
  const rawPath = (mark < 0 ? trimmed : trimmed.slice(0, mark)).replace(/^\/+|\/+$/gu, "")
  const path = (decoded(rawPath, problems) ?? rawPath).toLowerCase()
  const query = readQuery(mark < 0 ? "" : trimmed.slice(mark + 1), problems)
  const name = path === "" ? "menu" : path
  const place = Object.hasOwn(PLACES, name) ? PLACES[name] : undefined
  if (place === undefined) {
    const renamed = Object.hasOwn(RENAMED, name) ? RENAMED[name] : undefined
    problems.unshift(renamed ?? `no place named "${path}": the places are ${listed(PLACE_NAMES)}`)
    throw new RouteError(text, problems)
  }
  const known = Object.keys(place.query)
  for (const key of query.keys()) {
    if (Object.hasOwn(place.query, key)) continue
    problems.push(known.length === 0 ? `${name} takes no ${key}: it reads no query` : `${name} takes no ${key}: it reads ${listed(known)}`)
  }
  const destination = place.resolve(query, problems)
  if (destination === null || problems.length > 0) throw new RouteError(text, problems)
  return destination
}

/** A destination's route as the game writes it: the shortest that leads there (round 1 is left unsaid). */
export function formatRoute(destination: Destination): string {
  if (destination.kind === "title") return destination.place
  if (destination.kind === "skirmish") {
    if (destination.load !== undefined) return `skirmish?load=${destination.load}`
    return destination.seed === undefined ? "skirmish" : `skirmish?seed=${destination.seed}`
  }
  // A Skirmish names its own route: its seed, or its file.
  if (destination.level.route !== undefined) return destination.level.route
  const round = destination.round === 1 ? "" : `&round=${destination.round}`
  return `story?mission=${destination.level.id}${round}`
}

/** Every route the game has, place by place, each mission at each of its rounds. */
export function allRoutes(): readonly string[] {
  return PLACE_NAMES.flatMap((name) => PLACES[name]?.routes() ?? [])
}

/** The default mission's route, which opens its first round: where a demo and the scripted playtest open when
 *  nothing names a place. */
export const DEFAULT_LEVEL_ROUTE = formatRoute({ kind: "level", level: DEFAULT_LEVEL, round: 1 })
