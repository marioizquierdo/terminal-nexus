// The Skirmish setup screen (src/cli/title-screens.ts, src/skirmish/setup.ts) and what it opens: New game's rows, each
// with a default so Enter starts at once, coming round when chosen; Load game's list and a loaded save's controllers,
// credits and modifiers changed before it opens; two players, an agent and p2 alone refused with the reason; the
// screen playing a round exactly as `playNext` plays it headless, profiles, credits shares and modifiers included;
// spectating, with nothing to build; and a battle's result going back to the setup screen.

import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildLayout } from "../src/build/layout.ts"
import type { BuildContext } from "../src/build/state.ts"
import { createBuildState, menuEntries, nexusTile, withoutScene } from "../src/build/state.ts"
import { TitleScreens, shippedSaves } from "../src/cli/title-screens.ts"
import type { SaveEntry } from "../src/cli/title-screens.ts"
import type { LevelDestination } from "../src/cli/route.ts"
import { formatRoute, parseRoute } from "../src/cli/route.ts"
import { planOnRound, playedOf, positionOf, skirmishLevel } from "../src/cli/skirmish-play.ts"
import { listSaves } from "../src/cli/skirmish-files.ts"
import { readProfiles } from "../src/skirmish/profile-files.ts"
import { SHIPPED_PROFILES, SHIPPED_SAVES } from "../src/skirmish/shipped-players.ts"
import type { SaveFile, SaveSetup } from "../src/skirmish/save.ts"
import { duelOf, SAVE_FORMAT } from "../src/skirmish/save.ts"
import { playNext } from "../src/skirmish/play.ts"
import { controllerChoices, nextValue, setupDefaults, startProblem } from "../src/skirmish/setup.ts"
import { screenProblem } from "../src/skirmish/slots.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import { frameToText } from "../src/view/frame.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runGamePlaytest } from "../src/playtest/game.ts"
import { BuildSession } from "../src/view/build-session.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import type { SidePlan } from "../src/duel/index.ts"

const ENTER = "\r"

/** The title screens on a fixed clock, the shipped profiles and the shipped saves, with what they open kept. */
function screens(extra: Partial<ConstructorParameters<typeof TitleScreens>[0]> = {}): { screens: TitleScreens; opened: LevelDestination[] } {
  const opened: LevelDestination[] = []
  const made = new TitleScreens({
    settings: { ...DEFAULT_SETTINGS, colors: "monochrome" },
    now: () => 1_234_567_890,
    playerName: "marioiz",
    profiles: SHIPPED_PROFILES,
    saves: () => shippedSaves(SHIPPED_PROFILES),
    onOpen: (at) => opened.push(at),
    onQuit: () => {},
    ...extra,
  })
  return { screens: made, opened }
}

const keys = (title: TitleScreens, text: string): void => {
  for (const key of text) title.handleKey(key)
}

test("the profiles and example saves the browser page carries are exactly the files in players/scripts/ and saves/", () => {
  assert.deepEqual(new Map([...readProfiles()].sort()), new Map([...SHIPPED_PROFILES].sort()))
  const files = readdirSync("saves").filter((name) => name.endsWith(".save.json")).map((name) => `saves/${name}`).sort()
  assert.deepEqual([...SHIPPED_SAVES.keys()].sort(), files)
  for (const [path, text] of SHIPPED_SAVES) assert.deepEqual(JSON.parse(text), JSON.parse(readFileSync(path, "utf8")), path)
})

test("Skirmish on the title menu opens New game and Load game, and the routes name each screen", () => {
  const { screens: title } = screens()
  title.handleKey("1")
  assert.equal(title.screen, "skirmish")
  assert.match(frameToText(title.frame()), /\[1\] New game[\s\S]*\[2\] Load game[\s\S]*\[3\] Back/u)
  title.handleKey("\u001b")
  assert.equal(title.screen, "top")
  for (const [route, place] of [["skirmish?setup", "skirmish"], ["skirmish?setup=new", "new-game"], ["skirmish?setup=load", "load-game"]] as const) {
    assert.deepEqual(parseRoute(route), { kind: "title", place })
    assert.equal(formatRoute({ kind: "title", place }), route)
  }
  assert.throws(() => parseRoute("skirmish?setup=maybe"), /setup is the Skirmish screen/u)
  assert.throws(() => parseRoute("skirmish?seed"), /seed needs a value/u)
})

test("New game opens on Start with every row at its default, so Enter starts at once: Vasse as the player against Dob Hunter's steady profile", () => {
  const { screens: title, opened } = screens()
  title.follow("new-game")
  const text = frameToText(title.frame())
  assert.match(text, /\[1\] Map +The Crossing/u)
  assert.match(text, /p1 \(west\) played by +Player: marioiz/u)
  assert.match(text, /p2 \(east\) played by +Scripted: steady/u)
  assert.match(text, /Goal +Elimination/u)
  assert.match(text, /\[e\] Seed +567890/u)
  title.handleKey(ENTER)
  assert.equal(opened.length, 1)
  const round = withoutScene(opened[0]!.level.firstRound())
  const { setup } = positionOf(round)
  assert.deepEqual(setup, setupDefaults(567890, "marioiz", SHIPPED_PROFILES))
  assert.notEqual(round.spectating, true)
})

test("each row comes round to its next value when chosen: the map, a Commander, who plays a slot, its credits, a modifier", () => {
  const { screens: title } = screens()
  title.follow("new-game")
  keys(title, "1259")
  const setup = title.newGame
  assert.equal(setup.map, "pocket")
  assert.equal(setup.slots.p1.commander, "averno")
  assert.equal(setup.slots.p2.commander, "vasse")
  assert.deepEqual(setup.modifiers, ["fast-rounds"])
  // Who plays a slot: the player, every profile by name, and the agent, dimmed.
  assert.deepEqual(controllerChoices("marioiz", SHIPPED_PROFILES), ["player:marioiz", "script:agro", "script:agro-rich", "script:defensive", "script:steady", "agent:curious"])
  const p2 = (setup: SaveSetup): SaveSetup => nextValue(setup, { kind: "controller", slot: "p2" }, "marioiz", SHIPPED_PROFILES)
  const agent = p2(title.newGame)
  assert.equal(agent.slots.p2.controller, "agent:curious")
  assert.match(startProblem(agent) ?? "", /agent players are not built yet/u)
  const both = p2(agent)
  assert.equal(both.slots.p2.controller, "player:marioiz")
  assert.match(startProblem(both) ?? "", /Two players at one screen wait for Versus/u)
  // A profile's credits are its own unless the slot's are set; setting it to the profile's drops the option.
  const rich = p2(p2(both))
  assert.equal(rich.slots.p2.controller, "script:agro-rich")
  assert.equal(rich.slots.p2.options, undefined)
  const credits = nextValue(rich, { kind: "credits", slot: "p2" }, "marioiz", SHIPPED_PROFILES)
  assert.deepEqual(credits.slots.p2.options, { credits: 1.5 })
})

test("two players at the screen, an agent, and p2 as the only player are refused on Start, the reason said; the seed is typed", () => {
  const { screens: title, opened } = screens()
  title.follow("new-game")
  title.handleKey("6") // p2: from steady to the agent
  title.handleKey("s")
  assert.equal(opened.length, 0)
  assert.match(title.notice ?? "", /agent players are not built yet/u)
  assert.match(frameToText(title.frame()), /Agent: curious \(not built yet\)/u)
  title.handleKey("6") // p2: the player too
  title.handleKey("s")
  assert.equal(opened.length, 0)
  assert.match(title.notice ?? "", /Two players at one screen wait for Versus/u)
  // The seed: chosen, its digits type, Backspace takes one off and Enter keeps it.
  title.handleKey("e")
  assert.equal(title.typingSeed, true)
  keys(title, "4219")
  title.handleKey("\u007f")
  title.handleKey(ENTER)
  assert.equal(title.newGame.seed, 421)
  title.handleKey("e")
  keys(title, "77")
  title.handleKey("\u001b")
  assert.equal(title.newGame.seed, 421, "Esc keeps the seed it was")
  assert.equal(title.screen, "new-game", "Esc out of the seed stays on New game")
})

test("Load game lists the saves with their round and Commanders, and a loaded save's controllers and modifiers change before it opens, not its map", () => {
  const folder = mkdtempSync(join(tmpdir(), "tn-saves-"))
  try {
    writeFileSync(join(folder, "broken.save.json"), "{", "utf8")
    const entries = listSaves(SHIPPED_PROFILES, folder)
    assert.equal(entries[0]?.save, null, "a save that cannot be loaded is listed, saying why")
    assert.match(entries[0]?.problem ?? "", /not JSON/u)
    assert.ok(entries.some((entry) => entry.shown === "saves/crossing-round-4.save.json"))
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
  const { screens: title, opened } = screens()
  title.follow("load-game")
  const text = frameToText(title.frame())
  assert.match(text, /\[2\] crossing-round-4 +round 4 +Edda Vasse v Dob Hunter/u)
  title.handleKey("2")
  assert.equal(title.screen, "load-edit")
  assert.match(frameToText(title.frame()), /crossing-round-4\.save\.json: round 4 of 8, Edda Vasse/u)
  title.handleKey("1") // p1: the first profile
  title.handleKey("6") // double-income on
  assert.equal(title.loadedSetup?.slots.p1.controller, "script:agro")
  assert.deepEqual(title.loadedSetup?.modifiers, ["double-income"])
  title.handleKey("s")
  assert.equal(opened.length, 1)
  const round = withoutScene(opened[0]!.level.firstRound())
  const position = positionOf(round)
  assert.equal(position.setup.map, "crossing")
  assert.equal(position.duel.round, 4)
  assert.equal(position.file, "saves/crossing-round-4.save.json")
  assert.equal(round.spectating, true, "both slots scripts: spectating")
})

/** A setup with a profile in p2 whose credits share and the modifiers both change the battle. */
const RICH: SaveSetup = { ...setupDefaults(77, "marioiz", SHIPPED_PROFILES), modifiers: ["double-income", "fast-rounds"], slots: { p1: { commander: "vasse", controller: "player:marioiz", options: { credits: 0.75 } }, p2: { commander: "dob", controller: "script:agro-rich" } } }

test("the screen plays a round exactly as playNext plays it headless: the same setup and plan give the same duel, profiles, credits and modifiers included", { timeout: 120_000 }, () => {
  const save: SaveFile = { format: SAVE_FORMAT, setup: RICH }
  const level = skirmishLevel(save, {}, { profiles: SHIPPED_PROFILES })
  const context = withoutScene(level.firstRound())
  const plan: SidePlan = { power: 1, build: [{ building: "turret", x: 10, y: 11 }], stance: "attack" }
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
  const opened = createBuildState(context, nexusTile(context) ?? { x: 0, y: 0 }, viewport)
  const planned = planOnRound(context, opened, plan, level.play.keep as NonNullable<typeof level.play.keep>)
  const resolved = level.play.startPulse(planned.context, planned.state)
  assert.ok(resolved !== null)
  const onScreen = playedOf(resolved)
  assert.ok(onScreen !== undefined)
  const headless = playNext(RICH, duelOf(save, SHIPPED_PROFILES), { p1: { ...plan, stance: "attack" } }, SHIPPED_PROFILES)
  assert.deepEqual(onScreen.duel, headless.state)
  // The share and the modifiers acted: p2 earns more than the curve, p1 less, and the round was half as long.
  assert.equal(onScreen.duel.setup.pulseTicks, Math.round(RICH.roundTicks / 2))
  assert.deepEqual(onScreen.duel.setup.income, { A: 1.5, B: 2.5 })
})

test("spectating: with no player the Build Phase offers only Explore Map and Start next round, and the round is both scripts' plans", { timeout: 120_000 }, () => {
  const setup: SaveSetup = { ...RICH, slots: { p1: { commander: "vasse", controller: "script:defensive" }, p2: { commander: "dob", controller: "script:agro" } } }
  assert.equal(screenProblem(setup), null)
  const save: SaveFile = { format: SAVE_FORMAT, setup }
  const level = skirmishLevel(save, {}, { profiles: SHIPPED_PROFILES })
  const context: BuildContext = withoutScene(level.firstRound())
  assert.equal(context.spectating, true)
  assert.equal(context.catalog.length, 0)
  assert.equal(context.nexusDraft.length, 0)
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
  const session = new BuildSession({ context, cursor: nexusTile(context) ?? { x: 0, y: 0 }, viewport, startPulse: level.play.startPulse, nextRound: level.play.nextRound })
  const layout = buildLayout({ columns: 80, rows: 24 }, context.grid)
  const text = frameToText(sessionFrame(session, layout))
  assert.match(text, /\[e\] Explore Map/u)
  assert.match(text, /\[s\] Start next round/u)
  assert.doesNotMatch(text, /Nexus Pulse/u)
  assert.equal(menuEntries(context).length, 3)
  session.handleData("n", layout)
  assert.match(session.state.status.text, /scripts pick their own powers/u)
  session.handleData("s", layout)
  assert.equal(session.state.committed, true, "Start next round begins it at once")
  const played = session.pulse === null ? undefined : playedOf(session.pulse.resolved)
  assert.ok(played !== undefined)
  assert.deepEqual(played.duel, playNext(setup, duelOf(save, SHIPPED_PROFILES), {}, SHIPPED_PROFILES).state)
})

/** A Build Phase frame, composed as the screen composes it. */
const sessionFrame = (session: BuildSession, layout: ReturnType<typeof buildLayout>): ReturnType<typeof composeBuildFrame> =>
  composeBuildFrame({ context: session.round, state: session.state, layout, glyphPack: "ascii", reducedMotion: true }, "monochrome")

test("a battle's result offers the setup screen beside the same battle again and a new seed, and going there opens New game on that battle's setup", { timeout: 240_000 }, () => {
  // pocket-short, both slots scripts: four rounds at most, played by watching.
  const run = runGamePlaytest({
    start: { kind: "title", place: "load-game" },
    saves: () => shippedSaves(SHIPPED_PROFILES),
    steps: parseKeyScript("4 1 s Esc s wait~1000*40 Enter Esc s wait~1000*40 m"),
  })
  const result = run.frames[run.frames.length - 2]
  assert.ok(result !== undefined && result.screen === "build")
  const text = frameToText(result.frame)
  assert.match(text, /\[m\] +Setup screen/u)
  assert.match(text, /\[n\] +New seed/u)
  assert.match(text, /\[enter\] Same battle again/u)
  assert.match(text, /WINS|DRAWN/u)
  const back = run.frames[run.frames.length - 1]
  assert.equal(back?.screen, "title")
  assert.equal(back?.title, "new-game")
  assert.match(frameToText(back!.frame), /Map +The Pocket[\s\S]*Marshal Averno/u)
})

test("the game's playtest walks from the title menu through New game into the Build Phase, and Save game writes there", { timeout: 60_000 }, () => {
  const folder = mkdtempSync(join(tmpdir(), "tn-play-"))
  try {
    const run = runGamePlaytest({
      start: { kind: "title", place: "menu" },
      savesFolder: folder,
      steps: parseKeyScript("1 1 1 s Esc n 1 Esc v Bksp*40 m i n e Enter"),
    })
    const screensSeen = run.frames.map((frame) => frame.title ?? frame.screen)
    assert.deepEqual(screensSeen.slice(0, 4), ["top", "skirmish", "new-game", "new-game"])
    assert.equal(run.frames[4]?.screen, "build", "Start's own frame is the battle it opened")
    const saved = JSON.parse(readFileSync(join(folder, "mine.save.json"), "utf8")) as SaveFile
    assert.equal(saved.setup.map, "pocket")
    assert.equal(saved.setup.slots.p1.controller, "player:player")
    const entries: readonly SaveEntry[] = listSaves(SHIPPED_PROFILES, folder)
    assert.equal(entries[0]?.shown.endsWith("mine.save.json"), true, "the newest save is listed first")
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})
