// The Nexus Pulse (commander-armies.md, how the Nexus Pulse deals): the hand the Nexus deals as each round
// opens, from the army's Nexus power pool by a schedule of rarities, War Chest beside it, one kept — and what each
// of Vasse's powers does once kept, from the moment it is picked to the end of the battle, on the starter map's
// Skirmish. The dealer is seeded and repeatable, and draws from a stream of its own, so dealing never moves a battle.

import { test } from "node:test"
import assert from "node:assert/strict"
import { auraOf } from "../src/engine/abilities/index.ts"
import type { PowerCard, Rarity, Role, ScheduleSlot } from "../src/armies/index.ts"
import { ARMIES, DEFAULT_SCHEDULE, dealable, dealHand, rarityOrder, slotsFor, weightOf } from "../src/armies/index.ts"
import type { Schedule } from "../src/armies/index.ts"
import { nexusDraftOf, STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { wavesStat } from "../src/build/card.ts"
import { hint } from "../src/build/help.ts"
import { buildLayout } from "../src/build/layout.ts"
import { popupSpec } from "../src/build/popup.ts"
import type { BuildContext } from "../src/build/state.ts"
import { createBuildState, nexusPowers, nexusTile } from "../src/build/state.ts"
import { STARTER_LEVEL, starterContext } from "../src/cli/starter.ts"
import { keepPower, skirmishLevel } from "../src/cli/skirmish-play.ts"
import type { PlayableLevel } from "../src/cli/levels.ts"
import type { SaveFile } from "../src/skirmish/save.ts"
import starterSave from "../saves/starter.save.json" with { type: "json" }
import { tileDistance } from "../src/engine/geometry/coords.ts"
import { buildSide, compose, ENTER, keys, panelLines, screenText, TAB } from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"

/** Every Nexus power Vasse's army offers: what her hands are dealt from. */
const POOL = ARMIES.arsenals["vasse"]?.powers ?? []
const play = STARTER_LEVEL.play
const VASSE = "unit.citizen.vasse"
const TROOPER = "unit.citizen.trooper"
const BARRACKS = "structure.citizen.barracks"

/** One of Vasse's powers, by id. */
function power(id: string): PowerCard {
  const card = POOL.find((candidate) => candidate.id === id)
  assert.ok(card !== undefined, `Vasse's army offers no power "${id}"`)
  return card
}

/** The starter map's Skirmish on `seed`. */
const starterOn = (seed: number): PlayableLevel => {
  const save = starterSave as unknown as SaveFile
  return skirmishLevel({ ...save, setup: { ...save.setup, seed } })
}

/** **A starter map's Skirmish whose round-1 hand deals `id`**: the first seed that does, and the digit it is under, so a
 *  test picks what it means to — the battle keeps the card at that place in its own hand. */
function dealt(id: string): Readonly<{ level: PlayableLevel; digit: string }> {
  for (let seed = 1; seed < 200; seed += 1) {
    const level = starterOn(seed)
    const index = level.firstRound().nexusDraft.findIndex((option) => option.card.id === id)
    if (index >= 0) return { level, digit: String(index + 1) }
  }
  throw new Error(`no seed deals ${id} in round 1`)
}

/** A Build Phase on a level's round 1 that keeps what it picks and plays its rounds, as the game's does. */
function side(level: PlayableLevel = STARTER_LEVEL, context: BuildContext = level.firstRound()): BuildSide {
  return buildSide({ context, keep: level.play.keep, startPulse: level.play.startPulse, nextRound: level.play.nextRound })
}

/** A Build Phase state on `context`, as a round opens. */
function opened(context: BuildContext) {
  return createBuildState(context, STARTER_START_CURSOR, buildLayout({ columns: 80, rows: 24 }, context.terrain).viewport)
}

// --- The dealer ----------------------------------------------------------------------------------------------

/** A Barracks standing as the round opens, by card. */
const BARRACKS_STANDS: ReadonlySet<string> = new Set(["barracks"])

/** The hand Vasse's pool deals in `round` by the game's schedule (her army gives none of its own), with `kept` kept. */
function vasseHand(round: number, kept: readonly PowerCard[] = [], seed = 1, standing = BARRACKS_STANDS, schedule: Schedule = DEFAULT_SCHEDULE): PowerCard[] {
  return dealHand({ pool: POOL, kept, seed, round, standing, schedule })
}

/** A power for the dealer's own tests: it adds nothing, and its id is its name. */
function card(id: string, rarity: Rarity, role: Role, extra: Partial<PowerCard> = {}): PowerCard {
  return { id, name: id, description: `${id}.`, effect: { credits: 0 }, rarity, role, ...extra }
}

/** The ids of the hand `pool` deals in round 1 by a one-entry schedule of `deal`. */
function handOf(pool: readonly PowerCard[], deal: readonly ScheduleSlot[], seed = 1, round = 1): string[] {
  return dealHand({ pool, kept: [], seed, round, schedule: [{ round: 1, deal }] }).map((each) => each.id)
}

test("a hand deals one card for each slot of its round's schedule, War Chest beside them; the same deal is the same hand", () => {
  const hand = vasseHand(1)
  // Round 1: two commons and an uncommon, then War Chest.
  assert.deepEqual(
    hand.map((each) => `${each.id} ${each.rarity}`),
    ["reserve-callup common", "drill-schedule common", "aid-station-permit uncommon", "war-chest common"],
  )
  assert.deepEqual(vasseHand(1), hand, "the same deal came out different")
  // The game's own schedule deals three a round, its rarities rising: an uncommon in round 1, two from round 2,
  // a rare from round 4.
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 9].map((round) => slotsFor(DEFAULT_SCHEDULE, round).join(" ")),
    [
      "common common uncommon",
      "common uncommon uncommon",
      "common uncommon uncommon",
      "common uncommon rare",
      "common uncommon rare",
      "uncommon uncommon rare",
      "uncommon uncommon rare",
    ],
  )
  // Over many seeds no hand holds a power twice, and every power her hands deal turns up, Drill Schedule II once Drill
  // Schedule is kept. (Her faction's upgrades of a building, Standard Heavy Rounds and its kind, are her pool's too and
  // never dealt into a hand: a building's actions buy them, `tests/building-upgrades.test.ts`.)
  const seen = new Set<string>()
  for (let seed = 0; seed < 200; seed += 1) {
    for (const round of [1, 2, 3]) {
      for (const kept of [[], [power("drill-schedule")]]) {
        const each = vasseHand(round, kept, seed)
        assert.equal(new Set(each.map((dealt) => dealt.id)).size, each.length, `seed ${seed}, round ${round}: a power dealt twice`)
        for (const dealt of each) seen.add(dealt.id)
      }
    }
  }
  assert.deepEqual([...seen].sort(), ["aid-station-permit", "drill-schedule", "drill-schedule-ii", "reserve-callup", "standing-order", "war-chest"])
  // The round the game opens deals one card a slot of the schedule's round 1, by the battle's own seed: a Skirmish
  // offers no War Chest.
  assert.deepEqual(
    starterContext().nexusDraft.map((option) => `${option.hotkey} ${option.card.id} ${option.card.rarity}`),
    ["1 reserve-callup common", "2 aid-station-permit uncommon", "3 standing-order uncommon"],
  )
})

test("each card comes from its slot's rarity; with none left, the nearest lower one, then a higher one, never a legendary unless asked", () => {
  const pool = [
    card("c1", "common", "troops"),
    card("c2", "common", "production"),
    card("u1", "uncommon", "support"),
    card("r1", "rare", "offense"),
    card("l1", "legendary", "commander"),
  ]
  assert.deepEqual(handOf(pool, ["rare", "uncommon", "legendary"]), ["r1", "u1", "l1"])
  const [c1, c2, u1, r1, l1] = pool as [PowerCard, PowerCard, PowerCard, PowerCard, PowerCard]
  // No rare left: a rare slot deals the nearest lower rarity, never the legendary above it.
  assert.deepEqual(handOf([c1, u1, l1], ["rare"]), ["u1"])
  // No common left: a common slot deals upward, but stops short of a legendary, so the hand is short.
  assert.deepEqual(handOf([u1, l1], ["common", "common"]), ["u1"])
  // A slot that asks for a legendary deals one; with none, the nearest lower.
  assert.deepEqual(handOf([c1, l1], ["legendary"]), ["l1"])
  assert.deepEqual(handOf([c1, c2, r1], ["legendary"]), ["r1"])
  assert.deepEqual(rarityOrder("common"), ["common", "uncommon", "rare"])
  assert.deepEqual(rarityOrder("rare"), ["rare", "uncommon", "common"])
  assert.deepEqual(rarityOrder("legendary"), ["legendary", "rare", "uncommon", "common"])
})

test("a hand deals different roles while its rarity has them, and repeats a role only when it has no other", () => {
  const twin = card("twin", "common", "troops")
  const other = card("other", "common", "troops")
  const builder = card("builder", "common", "production")
  for (let seed = 0; seed < 100; seed += 1) {
    const hand = handOf([twin, other, builder], ["common", "common"], seed)
    assert.ok(hand.includes("builder"), `seed ${seed}: two troops cards dealt beside a production one`)
  }
  assert.deepEqual(handOf([twin, other], ["common", "common"]).sort(), ["other", "twin"])
})

test("a power's chance raises its odds in the rounds it names: Reserve Callup is twice as likely in rounds 1 to 3", () => {
  const callup = power("reserve-callup")
  assert.deepEqual([1, 2, 3, 4].map((round) => weightOf(callup, round)), [2, 2, 2, 1])
  const lucky = card("lucky", "common", "troops", { chance: [{ from: 1, to: 3, times: 3 }] })
  const plain = card("plain", "common", "production")
  const count = (round: number): number => {
    let dealt = 0
    for (let seed = 0; seed < 600; seed += 1) if (handOf([lucky, plain], ["common"], seed, round)[0] === "lucky") dealt += 1
    return dealt
  }
  // Three in four while the chance holds; one in two after.
  const early = count(2)
  const late = count(5)
  assert.ok(early >= 410 && early <= 490, `round 2 dealt the lucky power ${early} times in 600`)
  assert.ok(late >= 260 && late <= 340, `round 5 dealt the lucky power ${late} times in 600`)
})

test("a power is dealt only while its requirements hold: a power kept, a building standing, a round reached", () => {
  const first = card("first", "common", "troops")
  const after = card("after", "common", "support", { requires: { powers: ["first"] } })
  const built = card("built", "common", "production", { requires: { buildings: ["barracks"] } })
  const late = card("late", "common", "offense", { requires: { round: 3 } })
  const pool = [first, after, built, late]
  assert.deepEqual(dealable(pool, [], 1).map((each) => each.id), ["first"])
  assert.deepEqual(dealable(pool, [first], 3, BARRACKS_STANDS).map((each) => each.id), ["after", "built", "late"])
  // Drill Schedule needs a Barracks standing as the round opens: without one it is never dealt.
  for (let seed = 0; seed < 100; seed += 1) {
    assert.ok(!vasseHand(1, [], seed, new Set()).some((each) => each.id === "drill-schedule"), `seed ${seed}: dealt with no Barracks`)
  }
})

test("an upgrade waits for its power, joins the hand once it is kept, and is listed in its place once kept itself", () => {
  const drill = power("drill-schedule")
  const second = power("drill-schedule-ii")
  assert.ok(!dealable(POOL, [], 1, BARRACKS_STANDS).includes(second), "Drill Schedule II was dealable before Drill Schedule was kept")
  assert.ok(dealable(POOL, [drill], 2, BARRACKS_STANDS).includes(second))
  assert.deepEqual(
    vasseHand(2, [drill]).map((each) => each.id),
    ["reserve-callup", "standing-order", "drill-schedule-ii", "war-chest"],
  )
  // Kept, it takes its power's place under ACTIVE; what both do adds up: three waves.
  const context = keepPower(keepPower(starterContext(), drill), second)
  assert.deepEqual(
    nexusPowers(context, opened(context)).active.map((each) => each.name),
    ["Drill Schedule II"],
  )
  const barracks = context.catalog.find((item) => item.contentId === BARRACKS)
  assert.equal(barracks?.spawns?.waves, 3)
})

test("a schedule makes sure of a power: one whose round 2 names Aid Station Permit deals it first, unless it was kept", () => {
  // As a Commander's army may write one (`Commander.schedule`): Averno's deals a Ravel card in rounds 2 and 4.
  const sure: Schedule = [
    { round: 1, deal: ["common", "common", "uncommon"] },
    { round: 2, deal: [{ power: "aid-station-permit" }, "common", "uncommon"] },
  ]
  for (let seed = 0; seed < 50; seed += 1) {
    for (const kept of [[power("drill-schedule")], [power("standing-order")], [power("reserve-callup")]]) {
      assert.equal(vasseHand(2, kept, seed, BARRACKS_STANDS, sure)[0]?.id, "aid-station-permit", `seed ${seed}: round 2 did not deal Aid Station Permit first`)
    }
    // Kept already: the slot deals from its rarity instead.
    const after = vasseHand(2, [power("aid-station-permit")], seed, BARRACKS_STANDS, sure)
    assert.ok(!after.some((each) => each.id === "aid-station-permit"))
    assert.equal(after[0]?.rarity, "uncommon")
  }
})

test("a power kept once is never dealt again; one that may be kept again, Reserve Callup, is", () => {
  const once = POOL.filter((each) => each.id !== "reserve-callup" && each.always !== true)
  for (let seed = 0; seed < 50; seed += 1) {
    assert.deepEqual(
      vasseHand(3, once, seed).map((each) => each.id),
      ["reserve-callup", "war-chest"],
      `seed ${seed}: with only Reserve Callup left, the hand holds it and War Chest`,
    )
  }
  assert.deepEqual(
    dealable(POOL, [power("reserve-callup")], 1, BARRACKS_STANDS).map((each) => each.id),
    ["reserve-callup", "drill-schedule", "standing-order", "aid-station-permit"],
  )
})

test("dealing draws from a stream of its own: whatever the hand, a round with no power kept plays the same battle", () => {
  const context = starterContext()
  const ids = (hand: readonly PowerCard[]): string => hand.map((each) => each.id).join(" ")
  // The first seed after the first that deals round 1 another hand: shown in place of the round's own, nothing kept.
  const seed = Array.from({ length: 50 }, (_, offset) => offset + 2).find((each) => ids(vasseHand(1, [], each)) !== ids(vasseHand(1)))
  assert.ok(seed !== undefined, "no seed near the first deals round 1 another hand")
  const other: BuildContext = { ...context, nexusDraft: nexusDraftOf({ powers: vasseHand(1, [], seed) }) }
  const first = play.startPulse(context, opened(context))
  const second = play.startPulse(other, opened(other))
  assert.ok(first !== null && second !== null)
  assert.equal(second.timeline.stateHash, first.timeline.stateHash)
  assert.equal(second.timeline.eventsHash, first.timeline.eventsHash)
})

test("the Nexus Pulse popup says how rare each dealt power is at the end of its row, and nothing for War Chest", () => {
  const context = starterContext()
  const state = { ...opened(context), popup: "nexus-powers" as const }
  const spec = popupSpec(context, state)
  assert.equal(spec?.title, "NEXUS PULSE")
  const options = (spec?.rows ?? []).flatMap((row) => (row.kind === "option" ? [`${row.label} ${row.tag ?? "-"}`] : []))
  assert.deepEqual(options, ["Reserve Callup common", "Aid Station Permit uncommon", "Standing Order uncommon"])
  const shown = side()
  keys(shown, "n")
  assert.match(screenText(shown), /\[3\] Standing Order +uncommon/)
  // War Chest, beside every hand where a level offered it: a Skirmish deals none.
  const chest: BuildContext = { ...context, nexusDraft: nexusDraftOf({ powers: [...context.nexusDraft.map((option) => option.card), power("war-chest")] }) }
  const chestRows = (popupSpec(chest, { ...opened(chest), popup: "nexus-powers" as const })?.rows ?? []).flatMap((row) => (row.kind === "option" ? [`${row.label} ${row.tag ?? "-"}`] : []))
  assert.equal(chestRows.at(-1), "War Chest -")
})

// --- What each power does once kept ----------------------------------------------------------------------------

test("Aid Station Permit puts the Aid Station on the menu at once, under the next digit, for the rest of the battle", () => {
  const { level, digit } = dealt("aid-station-permit")
  const permit = side(level)
  keys(permit, "n", digit)
  assert.deepEqual(
    permit.build.round.catalog.map((item) => `${item.hotkey} ${item.label} ${item.cost}`),
    ["1 Hatchery 30", "2 Turret 15", "3 Barracks 40", "4 Supply Depot 30", "5 Garrison 100", "6 Battery 50", "7 Aid Station 25"],
  )
  assert.match(panelLines(permit, compose(permit)).join("\n"), /\[7\] Aid Station +25/)
  keys(permit, "7")
  assert.equal(permit.build.state.armed, 6, "the Aid Station cannot be placed in the round it is unlocked")
  // The round after has it still, kept.
  const resolved = level.play.startPulse(permit.build.round, permit.build.state)
  assert.ok(resolved !== null)
  const next = level.play.nextRound(permit.build.round, permit.build.state, resolved)
  assert.ok(next !== null)
  assert.equal(next.catalog.at(-1)?.label, "Aid Station")
  assert.deepEqual(next.kept?.map((card) => card.id), ["aid-station-permit"])
  assert.ok(!next.nexusDraft.some((option) => option.card.id === "aid-station-permit"), "a permit kept was dealt again")
})

test("the Aid Station's card says what one heal mends and how far it reaches, and its hints fit the bottom line at 80 columns", () => {
  const { level, digit } = dealt("aid-station-permit")
  const permit = side(level)
  keys(permit, "n", digit, TAB, "7")
  assert.match(panelLines(permit, compose(permit)).join("\n"), /^HEAL +4\nRANGE +2$/m)
  // The longest building name yet: placing it, and exploring it once planned, each hint is one whole line.
  const fits = (): string => {
    const text = hint(permit.build.round, permit.build.state).text
    assert.ok(text.length <= permit.layout.footerLimit, `"${text}" is ${text.length} long`)
    return text
  }
  assert.match(fits(), /^Place the Aid Station: /)
  keys(permit, ENTER, "e")
  assert.match(fits(), /^Planned Aid Station: /)
})

test("Drill Schedule sends every Barracks a second wave: its card says so, and the battle runs on it", () => {
  // A Barracks standing as round 2 opens deals it (it needs one): round 1 builds one beside the Nexus, and a Supply
  // Depot so the army has room for a second wave, and keeps nothing.
  let found: Readonly<{ level: PlayableLevel; round: BuildContext; digit: string }> | null = null
  for (let seed = 1; seed < 200 && found === null; seed += 1) {
    const level = starterOn(seed)
    const first = level.firstRound()
    const state = {
      ...opened(first),
      planned: [
        { ordinal: 0, contentId: BARRACKS, anchor: { x: 21, y: 13 } },
        { ordinal: 1, contentId: "structure.citizen.depot", anchor: { x: 13, y: 13 } },
      ],
    }
    const resolved = level.play.startPulse(first, state)
    const round = resolved === null ? null : level.play.nextRound(first, state, resolved)
    const index = round?.nexusDraft.findIndex((option) => option.card.id === "drill-schedule") ?? -1
    if (round !== null && round !== undefined && index >= 0) found = { level, round, digit: String(index + 1) }
  }
  assert.ok(found !== null, "no seed deals Drill Schedule in round 2")
  const { level, round, digit } = found
  const battle = (context: BuildContext, state = opened(context)) => {
    const resolved = level.play.startPulse(context, state)
    assert.ok(resolved !== null)
    return resolved.timeline
  }
  const trained = (timeline: ReturnType<typeof battle>): number =>
    timeline.events.filter((event) => event.kind === "entity.spawned" && event.trainedBy !== undefined).length
  const drill = side(level, round)
  const without = battle(drill.build.round)
  keys(drill, "n", digit)
  assert.deepEqual(wavesStat(drill.build.round, BARRACKS, drill.build.state), { label: "WAVES", value: "4 at 5s, 15s" })
  assert.ok(trained(without) > 0, "the Barracks trains nothing in round 2")
  const doubled = battle(drill.build.round, drill.build.state)
  assert.equal(doubled.registry.get(BARRACKS).production?.waves, (without.registry.get(BARRACKS).production?.waves ?? 0) * 2)
  // The second wave comes 15 seconds in: twice the troopers, the Supply Depot giving the army room for them.
  assert.equal(trained(doubled), trained(without) * 2)
})

test("Standing Order doubles By the Book's reach: her card says range 8, and the battle runs on it", () => {
  const { level, digit } = dealt("standing-order")
  const order = side(level)
  const reach = auraOf(order.build.round.registry.get(VASSE))?.radius
  keys(order, "n", digit)
  assert.equal(auraOf(order.build.round.registry.get(VASSE))?.radius, (reach ?? 0) * 2)
  assert.equal(reach, 4)
  // Her card, explored where she arrives.
  const vasse = (order.build.round.incoming ?? []).find((entity) => entity.contentId === VASSE)
  assert.ok(vasse !== undefined)
  order.build.run([{ kind: "look-at", x: vasse.anchor.x, y: vasse.anchor.y }, { kind: "explore" }])
  assert.match(screenText(order).replace(/\s+\|?\s*/g, " "), /within range 8/)
  const resolved = level.play.startPulse(order.build.round, order.build.state)
  assert.ok(resolved !== null)
  assert.equal(auraOf(resolved.timeline.registry.get(VASSE))?.radius, 8)
})

test("Reserve Callup: two troopers join at the Nexus — shown arriving the moment it is picked, set down as the round starts", () => {
  const { level, digit } = dealt("reserve-callup")
  const callup = side(level)
  const before = callup.build.round
  keys(callup, "n", digit)
  const after = callup.build.round
  const troopers = (context: BuildContext) => (context.incoming ?? []).filter((entity) => entity.player === "A" && entity.contentId === TROOPER)
  assert.equal(troopers(after).length, troopers(before).length + 2, "the two troopers are not shown arriving")
  // Beside the Nexus: the two new ones are its nearest troopers.
  const nexus = nexusTile(after)
  assert.ok(nexus !== null)
  const near = (entity: Readonly<{ anchor: Readonly<{ x: number; y: number }> }>) => tileDistance(entity.anchor, nexus)
  const added = troopers(after).filter((entity) => !troopers(before).some((was) => was.anchor.x === entity.anchor.x && was.anchor.y === entity.anchor.y))
  assert.equal(added.length, 2)
  for (const entity of added) assert.ok(near(entity) <= 8, `a called-up trooper stands ${near(entity)} from the Nexus`)
  // The battle sets them down where they were shown.
  const resolved = level.play.startPulse(after, callup.build.state)
  assert.ok(resolved !== null)
  const opening = resolved.timeline.states[0]
  assert.ok(opening !== undefined)
  for (const entity of added) {
    assert.ok(
      opening.entities.some((unit) => unit.player === "A" && unit.contentId === TROOPER && unit.anchor.x === entity.anchor.x && unit.anchor.y === entity.anchor.y),
      "a trooper shown arriving is not where the battle sets it down",
    )
  }
  // The round after calls nobody up again by itself, and lists nothing as active: the call-up was spent as the
  // round started, and the troopers it brought are units like any other. The power may be dealt again.
  const next = level.play.nextRound(after, callup.build.state, resolved)
  assert.ok(next !== null)
  assert.deepEqual(next.callups, [])
  assert.deepEqual(nexusPowers(after, callup.build.state).active.map((power) => power.name), ["Reserve Callup"])
  assert.deepEqual(nexusPowers(next, opened(next)).active, [])
})

test("a power kept lasts: the next round lists it as active, and the round's hand is dealt without it", () => {
  const { level, digit } = dealt("standing-order")
  const order = side(level)
  keys(order, "n", digit)
  const resolved = level.play.startPulse(order.build.round, order.build.state)
  assert.ok(resolved !== null)
  const next = level.play.nextRound(order.build.round, order.build.state, resolved)
  assert.ok(next !== null)
  assert.equal(auraOf(next.registry.get(VASSE))?.radius, 8, "Standing Order did not last into the next round")
  const state = { ...opened(next), popup: "nexus-powers" as const }
  const rows = popupSpec(next, state)?.rows ?? []
  const texts = rows.flatMap((row) => ("text" in row ? [row.text] : "label" in row ? [row.label] : []))
  const active = texts.indexOf("ACTIVE")
  assert.ok(active >= 0 && texts.slice(active).includes("Standing Order"), "the kept power is not listed as active")
  assert.ok(!next.nexusDraft.some((option) => option.card.id === "standing-order"))
})

// --- Optional, or required ---------------------------------------------------------------------------------------

test("the Nexus pick Experiment: required refuses Start Battle Round until a power is kept; optional starts without one", () => {
  const optional = buildSide()
  keys(optional, "s")
  assert.equal(optional.build.state.popup, "banner-place", "an optional pick held the round back")

  const required = buildSide()
  required.build.dispatch({ kind: "experiment-adjust", field: "powerPick", step: 1 })
  assert.equal(required.build.state.experiments.powerPick, "required")
  keys(required, "s")
  assert.equal(required.build.state.popup, null, "the round opened with the pick still waiting")
  assert.equal(required.build.state.status.text, "Pick a Nexus power first: [n].")
  keys(required, "n", "1", "s")
  assert.equal(required.build.state.popup, "banner-place")
})
