// The Nexus Pulse (commander-armies.md, how the Nexus Pulse deals): the hand the Grid Nexus deals as each round
// opens, from the army's Nexus power pool by a schedule of rarities, War Chest beside it, one kept — and what each
// of PERIMETER's powers does once kept, from the moment it is picked to the end of the mission. The dealer is
// seeded and repeatable, and draws from a stream of its own, so dealing never moves a battle.

import { test } from "node:test"
import assert from "node:assert/strict"
import type { PowerCard, Rarity, Role, ScheduleSlot } from "../src/armies/index.ts"
import { DEFAULT_SCHEDULE, dealable, dealHand, PERIMETER, PERIMETER_LEVEL, rarityOrder, slotsFor, weightOf } from "../src/armies/index.ts"
import { nexusDraftOf, STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { wavesStat } from "../src/build/card.ts"
import { hint } from "../src/build/help.ts"
import { buildLayout } from "../src/build/layout.ts"
import { popupSpec } from "../src/build/popup.ts"
import type { BuildContext } from "../src/build/state.ts"
import { createBuildState, nexusPowers, nexusTile } from "../src/build/state.ts"
import { missionPlay } from "../src/cli/pulse-run.ts"
import { starterContext } from "../src/cli/starter.ts"
import { gridDistance } from "../src/grid/coords.ts"
import { buildSide, compose, ENTER, keys, panelLines, screenText, TAB } from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"

const POOL = PERIMETER_LEVEL.offer.powers
const play = missionPlay(PERIMETER)
const VASSE = "unit.citizen.vasse"
const TROOPER = "unit.citizen.trooper"
const BARRACKS = "structure.citizen.barracks"

/** One of PERIMETER's powers, by id. */
function power(id: string): PowerCard {
  const card = POOL.find((candidate) => candidate.id === id)
  assert.ok(card !== undefined, `PERIMETER offers no power "${id}"`)
  return card
}

/** Round 1 of PERIMETER with this hand dealt — the given powers, then War Chest — so a test picks what it means to. */
function dealt(...ids: string[]): BuildContext {
  return { ...starterContext(), nexusDraft: nexusDraftOf({ powers: [...ids.map(power), power("war-chest")] }) }
}

/** A Build Phase on `context` that keeps what it picks and plays PERIMETER's rounds, as the game's does. */
function side(context: BuildContext): BuildSide {
  return buildSide({ context, keep: play.keep, startPulse: play.startPulse, nextRound: play.nextRound })
}

/** A Build Phase state on `context`, as a round opens. */
function opened(context: BuildContext) {
  return createBuildState(context, STARTER_START_CURSOR, buildLayout({ columns: 80, rows: 24 }, context.grid).viewport)
}

// --- The dealer ----------------------------------------------------------------------------------------------

/** PERIMETER's own schedule: the hands its Nexus Pulse deals, round by round. */
const SCHEDULE = PERIMETER_LEVEL.offer.schedule
/** The Barracks standing on the starter map as round 1 opens, by card. */
const BARRACKS_STANDS: ReadonlySet<string> = new Set(["barracks"])

/** The hand PERIMETER deals in `round`, with `kept` kept, as the mission deals it. */
function perimeterHand(round: number, kept: readonly PowerCard[] = [], seed = PERIMETER.seed, standing = BARRACKS_STANDS): PowerCard[] {
  return dealHand({ pool: POOL, kept, seed, round, standing, ...(SCHEDULE === undefined ? {} : { schedule: SCHEDULE }) })
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
  const hand = perimeterHand(1)
  // PERIMETER's round 1: two commons and an uncommon, then War Chest.
  assert.deepEqual(
    hand.map((each) => `${each.id} ${each.rarity}`),
    ["reserve-callup common", "drill-schedule common", "standing-order uncommon", "war-chest common"],
  )
  assert.deepEqual(perimeterHand(1), hand, "the same deal came out different")
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
  // Over many seeds no hand holds a power twice, and every power the pool deals turns up, Drill Schedule II
  // once Drill Schedule is kept.
  const seen = new Set<string>()
  for (let seed = 0; seed < 200; seed += 1) {
    for (const round of [1, 2, 3]) {
      for (const kept of [[], [power("drill-schedule")]]) {
        const each = perimeterHand(round, kept, seed)
        assert.equal(new Set(each.map((dealt) => dealt.id)).size, each.length, `seed ${seed}, round ${round}: a power dealt twice`)
        for (const dealt of each) seen.add(dealt.id)
      }
    }
  }
  assert.deepEqual([...seen].sort(), POOL.map((each) => each.id).sort())
  // The round the game opens deals exactly this.
  assert.deepEqual(
    starterContext().nexusDraft.map((option) => [option.hotkey, option.card.id]),
    hand.map((each, index) => [String(index + 1), each.id]),
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
  // PERIMETER's Drill Schedule needs a Barracks standing as the round opens: without one it is never dealt.
  for (let seed = 0; seed < 100; seed += 1) {
    assert.ok(!perimeterHand(1, [], seed, new Set()).some((each) => each.id === "drill-schedule"), `seed ${seed}: dealt with no Barracks`)
  }
})

test("an upgrade waits for its power, joins the hand once it is kept, and is listed in its place once kept itself", () => {
  const drill = power("drill-schedule")
  const second = power("drill-schedule-ii")
  assert.ok(!dealable(POOL, [], 1, BARRACKS_STANDS).includes(second), "Drill Schedule II was dealable before Drill Schedule was kept")
  assert.ok(dealable(POOL, [drill], 2, BARRACKS_STANDS).includes(second))
  assert.deepEqual(
    perimeterHand(2, [drill]).map((each) => each.id),
    ["aid-station-permit", "reserve-callup", "drill-schedule-ii", "war-chest"],
  )
  // Kept, it takes its power's place under ACTIVE; what both do adds up: three waves.
  const context = play.keep(play.keep(starterContext(), drill), second)
  assert.deepEqual(
    nexusPowers(context, opened(context)).active.map((each) => each.name),
    ["Drill Schedule II"],
  )
  const barracks = context.catalog.find((item) => item.contentId === BARRACKS)
  assert.equal(barracks?.spawns?.waves, 3)
})

test("a level's schedule makes sure of a power: PERIMETER's round 2 deals Aid Station Permit first, unless it was kept", () => {
  for (let seed = 0; seed < 50; seed += 1) {
    for (const kept of [[power("drill-schedule")], [power("standing-order")], [power("reserve-callup")]]) {
      assert.equal(perimeterHand(2, kept, seed)[0]?.id, "aid-station-permit", `seed ${seed}: round 2 did not deal Aid Station Permit first`)
    }
    // Kept already: the slot deals from its rarity instead.
    const after = perimeterHand(2, [power("aid-station-permit")], seed)
    assert.ok(!after.some((each) => each.id === "aid-station-permit"))
    assert.equal(after[0]?.rarity, "uncommon")
  }
})

test("a power kept once is never dealt again; one that may be kept again, Reserve Callup, is", () => {
  const once = [power("standing-order"), power("aid-station-permit"), power("drill-schedule"), power("drill-schedule-ii")]
  for (let seed = 0; seed < 50; seed += 1) {
    assert.deepEqual(
      perimeterHand(3, once, seed).map((each) => each.id),
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
  // The first seed after the mission's that deals round 1 another hand.
  const seed = Array.from({ length: 50 }, (_, offset) => PERIMETER.seed + offset + 1).find((each) => ids(perimeterHand(1, [], each)) !== ids(perimeterHand(1)))
  assert.ok(seed !== undefined, "no seed near the mission's deals round 1 another hand")
  const other: BuildContext = { ...context, nexusDraft: nexusDraftOf({ powers: perimeterHand(1, [], seed) }) }
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
  assert.deepEqual(options, ["Reserve Callup common", "Drill Schedule common", "Standing Order uncommon", "War Chest -"])
  const shown = side(context)
  keys(shown, "n")
  assert.match(screenText(shown), /\[3\] Standing Order +uncommon/)
  assert.match(screenText(shown), /\[4\] War Chest +[:|]/)
})

// --- What each power does once kept ----------------------------------------------------------------------------

test("Aid Station Permit puts the Aid Station on the menu at once, under the next digit, for the rest of the mission", () => {
  const permit = side(dealt("aid-station-permit"))
  keys(permit, "n", "1")
  assert.deepEqual(
    permit.build.round.catalog.map((item) => `${item.hotkey} ${item.label} ${item.cost}`),
    ["1 Barracks 40", "2 Hatchery 30", "3 Turret 15", "4 Aid Station 25"],
  )
  assert.match(panelLines(permit, compose(permit)).join("\n"), /\[4\] Aid Station +25/)
  keys(permit, "4")
  assert.equal(permit.build.state.armed, 3, "the Aid Station cannot be placed in the round it is unlocked")
  // The round after has it still, kept.
  const resolved = play.startPulse(permit.build.round, permit.build.state)
  assert.ok(resolved !== null)
  const next = play.nextRound(permit.build.round, permit.build.state, resolved)
  assert.ok(next !== null)
  assert.equal(next.catalog.at(-1)?.label, "Aid Station")
  assert.deepEqual(next.kept?.map((card) => card.id), ["aid-station-permit"])
  assert.ok(!next.nexusDraft.some((option) => option.card.id === "aid-station-permit"), "a permit kept was dealt again")
})

test("the Aid Station's card says what one heal mends and how far it reaches, and its hints fit the bottom line at 80 columns", () => {
  const permit = side(dealt("aid-station-permit"))
  keys(permit, "n", "1", TAB, "4")
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

test("Drill Schedule sends every Barracks a second wave: its card says so, and the battle trains twice as many", () => {
  const trainedIn = (context: BuildContext): number => {
    const resolved = play.startPulse(context, opened(context))
    assert.ok(resolved !== null)
    return resolved.timeline.events.filter((event) => event.kind === "entity.spawned" && event.trainedBy !== undefined).length
  }
  const drill = side(dealt("drill-schedule"))
  const without = trainedIn(drill.build.round)
  keys(drill, "n", "1")
  assert.deepEqual(wavesStat(drill.build.round, BARRACKS, drill.build.state), { label: "WAVES", value: "4 at 5s, 15s" })
  assert.ok(without > 0, "PERIMETER's Barracks trains nothing in round 1")
  assert.equal(trainedIn(drill.build.round), without * 2)
})

test("Standing Order doubles By the Book's reach: her card says range 8, and the battle runs on it", () => {
  const order = side(dealt("standing-order"))
  const reach = order.build.round.registry.get(VASSE).aura?.radius
  keys(order, "n", "1")
  assert.equal(order.build.round.registry.get(VASSE).aura?.radius, (reach ?? 0) * 2)
  assert.equal(reach, 4)
  // Her card, explored where she arrives.
  const vasse = (order.build.round.incoming ?? []).find((entity) => entity.contentId === VASSE)
  assert.ok(vasse !== undefined)
  order.build.run([{ kind: "look-at", x: vasse.anchor.x, y: vasse.anchor.y }, { kind: "explore" }])
  assert.match(screenText(order).replace(/\s+\|?\s*/g, " "), /within range 8/)
  const resolved = play.startPulse(order.build.round, order.build.state)
  assert.ok(resolved !== null)
  assert.equal(resolved.timeline.registry.get(VASSE).aura?.radius, 8)
})

test("Reserve Callup: two troopers join at the Nexus — shown arriving the moment it is picked, set down as the round starts", () => {
  const callup = side(dealt("reserve-callup"))
  const before = callup.build.round
  keys(callup, "n", "1")
  const after = callup.build.round
  const troopers = (context: BuildContext) => (context.incoming ?? []).filter((entity) => entity.player === "A" && entity.contentId === TROOPER)
  assert.equal(troopers(after).length, troopers(before).length + 2, "the two troopers are not shown arriving")
  // Beside the Grid Nexus: the two new ones are its nearest troopers.
  const nexus = nexusTile(after)
  assert.ok(nexus !== null)
  const near = (entity: Readonly<{ anchor: Readonly<{ x: number; y: number }> }>) => gridDistance(entity.anchor, nexus)
  const added = troopers(after).filter((entity) => !troopers(before).some((was) => was.anchor.x === entity.anchor.x && was.anchor.y === entity.anchor.y))
  assert.equal(added.length, 2)
  for (const entity of added) assert.ok(near(entity) <= 8, `a called-up trooper stands ${near(entity)} from the Nexus`)
  // The battle sets them down where they were shown.
  const resolved = play.startPulse(after, callup.build.state)
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
  const next = play.nextRound(after, callup.build.state, resolved)
  assert.ok(next !== null)
  assert.deepEqual(next.callups, [])
  assert.deepEqual(nexusPowers(after, callup.build.state).active.map((power) => power.name), ["Reserve Callup"])
  assert.deepEqual(nexusPowers(next, opened(next)).active, [])
})

test("a power kept lasts: the next round lists it as active, and the round's hand is dealt without it", () => {
  const order = side(dealt("standing-order"))
  keys(order, "n", "1")
  const resolved = play.startPulse(order.build.round, order.build.state)
  assert.ok(resolved !== null)
  const next = play.nextRound(order.build.round, order.build.state, resolved)
  assert.ok(next !== null)
  assert.equal(next.registry.get(VASSE).aura?.radius, 8, "Standing Order did not last into the next round")
  const state = { ...opened(next), popup: "nexus-powers" as const }
  const rows = popupSpec(next, state)?.rows ?? []
  const texts = rows.flatMap((row) => ("text" in row ? [row.text] : "label" in row ? [row.label] : []))
  const active = texts.indexOf("ACTIVE")
  assert.ok(active >= 0 && texts.slice(active).includes("Standing Order"), "the kept power is not listed as active")
  assert.ok(!next.nexusDraft.some((option) => option.card.id === "standing-order"))
  assert.equal(next.nexusDraft.at(-1)?.name, "War Chest")
})

// --- Optional, or required ---------------------------------------------------------------------------------------

test("the Nexus pick Experiment: required refuses Start Battle Round until a power is kept; optional starts without one", () => {
  const optional = buildSide()
  keys(optional, "s")
  assert.equal(optional.build.state.popup, "battle-round", "an optional pick held the round back")

  const required = buildSide()
  required.build.dispatch({ kind: "experiment-adjust", field: "powerPick", step: 1 })
  assert.equal(required.build.state.experiments.powerPick, "required")
  keys(required, "s")
  assert.equal(required.build.state.popup, null, "the round opened with the pick still waiting")
  assert.equal(required.build.state.status.text, "Pick a Nexus power first: [n].")
  keys(required, "n", "1", "s")
  assert.equal(required.build.state.popup, "battle-round")
})
