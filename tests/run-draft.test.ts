// A run's army and its draft (docs/game-design/runs.md): what a run starts with, the cards it can be offered, the dealer's
// rarity weights, tier gate, pity offset and variety, what a choice does to the army, and that a Doctrine and a cut-down
// roster are what the battle is played on.

import { test } from "node:test"
import assert from "node:assert/strict"
import { handOf, loadoutOf, newDuel, armyOf } from "../src/duel/index.ts"
import type { Roster } from "../src/duel/index.ts"
import {
  DRAFT_SIZE,
  RARITY_WEIGHTS,
  REQUISITION_FOR_SKIPPING,
  cardsOf,
  choose,
  dealDraft,
  drafted,
  duelFor,
  keyOf,
  newRun,
  offerable,
  ownedCards,
  rarityWeights,
  removable,
  startingRoster,
  tierFor,
  withCard,
  withoutCard,
} from "../src/run/index.ts"

const VASSE = startingRoster("vasse")
const keys = (cards: readonly Parameters<typeof keyOf>[0][]): string[] => cards.map(keyOf)

test("a run starts a Commander with the small army her file lists, and a Doctrine is never started with", () => {
  assert.deepEqual(VASSE, { buildings: ["barracks", "depot", "turret"], powers: ["reserve-callup", "drill-schedule"], doctrines: [] })
  assert.deepEqual(startingRoster("averno"), VASSE)
  assert.deepEqual(startingRoster("dob"), { buildings: ["den", "stash", "turret"], powers: ["scrap-rush", "hot-shift"], doctrines: [] })
  assert.deepEqual(keys(ownedCards("vasse", VASSE)), ["structure:barracks", "structure:depot", "structure:turret", "power:reserve-callup", "power:drill-schedule"])
})

test("a Commander's run can deal her own army's tagged cards: no foreign Nexus's, nothing offered beside every hand", () => {
  const vasse = keys(cardsOf("vasse"))
  for (const key of ["structure:garrison", "structure:battery", "structure:hatchery", "power:standing-order", "power:aid-station-permit", "doctrine:heavy-rounds-standard", "doctrine:long-barrels", "doctrine:production-line-standard"]) {
    assert.ok(vasse.includes(key), `${key} is not among Vasse's cards`)
  }
  assert.ok(!vasse.includes("power:war-chest"), "War Chest is the owner's testing tool, never dealt")
  assert.ok(!vasse.includes("structure:aid-station"), "the Aid Station is added by a power, never dealt by itself")
  const averno = keys(cardsOf("averno"))
  assert.ok(!averno.includes("power:scrap-rush") && !averno.includes("power:runner-crew"), "Averno's cards from the Ravel Nexus are not his to be offered")
  assert.ok(!averno.includes("doctrine:sharpened-scrap"), "nor are the Ravels' Doctrines")
  assert.ok(keys(cardsOf("dob")).includes("doctrine:crowded-dens"))
  // Every card carries what a draft deals it by.
  for (const card of cardsOf("vasse")) assert.ok(card.name !== "" && card.line !== "" && card.tier >= 1 && card.tier <= 3, `${keyOf(card)} is missing words or a tier`)
})

test("a draft deals a tier at its battle: tier t from battle 2t - 1, and a card needs what it requires", () => {
  assert.deepEqual([2, 3, 4, 5, 6].map(tierFor), [1, 2, 2, 3, 3])
  const early = keys(offerable("vasse", VASSE, 2))
  const later = keys(offerable("vasse", VASSE, 3))
  for (const key of ["structure:garrison", "structure:battery", "doctrine:production-line-standard"]) {
    assert.ok(!early.includes(key), `${key} is dealt before its tier`)
    assert.ok(later.includes(key), `${key} is not dealt from battle 3`)
  }
  // Never what the army already holds, and an upgrade only once its power is held.
  assert.ok(!later.includes("structure:barracks") && !later.includes("power:drill-schedule"))
  assert.ok(later.includes("power:drill-schedule-ii"), "Drill Schedule II follows Drill Schedule, which the army holds")
  assert.ok(!keys(offerable("vasse", withoutCard(VASSE, { kind: "power", id: "drill-schedule" }), 3)).includes("power:drill-schedule-ii"))
  // A structure whose tech tree needs a building the army lacks is not dealt.
  assert.ok(!keys(offerable("vasse", withoutCard(VASSE, { kind: "structure", id: "barracks" }), 3)).includes("structure:garrison"))
})

test("a card can be removed unless something the army holds needs it: the last producer, a building's tree, a power's upgrade", () => {
  assert.deepEqual(keys(removable("vasse", VASSE)), ["structure:depot", "structure:turret", "power:reserve-callup", "power:drill-schedule"], "the Barracks is the last that trains units")
  const more = withCard(withCard(VASSE, { kind: "structure", id: "hatchery" }), { kind: "structure", id: "garrison" })
  const free = keys(removable("vasse", more))
  assert.ok(free.includes("structure:hatchery"), "with two producers a Hatchery may go")
  assert.ok(!free.includes("structure:barracks"), "the Garrison needs the Barracks")
  const upgraded = withCard(VASSE, { kind: "power", id: "drill-schedule-ii" })
  assert.ok(!keys(removable("vasse", upgraded)).includes("power:drill-schedule"), "Drill Schedule II upgrades Drill Schedule")
})

test("a draft is dealt from the seed and the battle it prepares, never the path to it", () => {
  const deal = (seed: number, battle: number, pity = 0) => dealDraft({ commander: "vasse", roster: VASSE, seed, battle, pity })
  assert.deepEqual(deal(7, 3), deal(7, 3), "the same seed and army deal the same draft")
  assert.notDeepEqual(
    Array.from({ length: 12 }, (_, seed) => keys(deal(seed, 3).offer.cards).join()),
    Array.from({ length: 12 }, (_, seed) => keys(deal(seed, 4).offer.cards).join()),
    "another battle deals other cards",
  )
  const dealt = deal(1, 3)
  assert.equal(dealt.offer.battle, 3)
  assert.equal(dealt.offer.cards.length, DRAFT_SIZE)
  assert.equal(new Set(keys(dealt.offer.cards)).size, DRAFT_SIZE, "three different cards")
  assert.equal(dealt.offer.requisition, REQUISITION_FOR_SKIPPING)
  const allowed = new Set(keys(offerable("vasse", VASSE, 3)))
  for (const card of dealt.offer.cards) assert.ok(allowed.has(keyOf(card)), `${keyOf(card)} was not dealable`)
  // A family the offer lacks comes before rarity: with all three families in the pool, a draft holds all three.
  for (let seed = 0; seed < 60; seed += 1) {
    const families = new Set(deal(seed, 3).offer.cards.map((card) => card.kind))
    assert.equal(families.size, 3, `seed ${seed} dealt ${[...families].join(", ")}`)
  }
})

test("a draft deals fewer than three when the army has run out of cards, and none when it holds everything", () => {
  let roster: Roster = VASSE
  for (const card of cardsOf("vasse")) if (!keys(ownedCards("vasse", roster)).includes(keyOf(card))) roster = withCard(roster, card)
  assert.equal(dealDraft({ commander: "vasse", roster, seed: 1, battle: 9, pity: 0 }).offer.cards.length, 0)
  const nearly = withoutCard(withoutCard(roster, { kind: "doctrine", id: "long-barrels" }), { kind: "structure", id: "hatchery" })
  assert.equal(dealDraft({ commander: "vasse", roster: nearly, seed: 1, battle: 9, pity: 0 }).offer.cards.length, 2)
})

test("rarity weighs a hundred as 60, 37 and 3, and the pity offset moves a rare up and a common down", () => {
  const all = new Set(["common", "uncommon", "rare"] as const)
  assert.deepEqual(RARITY_WEIGHTS, { common: 60, uncommon: 37, rare: 3 })
  assert.deepEqual(rarityWeights(all, 0).map((entry) => entry.weight), [60, 37, 3])
  assert.deepEqual(rarityWeights(all, 10).map((entry) => entry.weight), [50, 37, 13])
  assert.deepEqual(rarityWeights(all, 100).map((entry) => entry.weight), [1, 37, 103], "a common never weighs nothing")
  assert.deepEqual(rarityWeights(new Set(["common", "rare"] as const), 0).map((entry) => entry.rarity), ["common", "rare"], "a rarity with no card is left out")
})

test("dealt many times from fixed seeds, rares come as often as their weight and the pity offset say", () => {
  // Dob's pool is the one with a rare (Hot Dice); take the family variety out of it by counting only slots that can deal it.
  const rate = (pity: number): number => {
    let rares = 0
    let slots = 0
    for (let seed = 0; seed < 1500; seed += 1) {
      const { offer } = dealDraft({ commander: "dob", roster: startingRoster("dob"), seed, battle: 3, pity })
      rares += offer.cards.filter((card) => card.rarity === "rare").length
      slots += offer.cards.length
    }
    return rares / slots
  }
  const base = rate(0)
  const lifted = rate(30)
  assert.ok(base > 0, "a rare was never dealt")
  assert.ok(base < 0.2, `a rare came ${(base * 100).toFixed(1)}% of the time at no pity: far above its weight`)
  assert.ok(lifted > base * 2, `the pity offset did not lift the rare: ${(base * 100).toFixed(1)}% to ${(lifted * 100).toFixed(1)}%`)
  // Pity builds by one for each card dealt that is not a rare, and a rare resets it.
  const { pity } = dealDraft({ commander: "vasse", roster: VASSE, seed: 3, battle: 3, pity: 4 })
  assert.equal(pity, 7, "Vasse has no rare, so three cards add three")
})

test("a choice changes the army: a card taken joins the end of its family, one removed leaves, the requisition is the draft's", () => {
  const { offer } = dealDraft({ commander: "vasse", roster: VASSE, seed: 1, battle: 3, pity: 0 })
  const card = offer.cards[0]!
  const taken = choose(VASSE, offer, { kind: "take", card: keyOf(card) })
  assert.ok(typeof taken !== "string")
  assert.deepEqual(taken.requisition, 0)
  assert.ok(keys(ownedCards("vasse", taken.roster)).includes(keyOf(card)))
  const gone = choose(VASSE, offer, { kind: "remove", card: "structure:turret" })
  assert.ok(typeof gone !== "string")
  assert.ok(!gone.roster.buildings.includes("turret"))
  const asked = choose(VASSE, offer, { kind: "requisition" })
  assert.ok(typeof asked !== "string")
  assert.deepEqual([asked.roster, asked.requisition], [VASSE, REQUISITION_FOR_SKIPPING])
  // What is not on offer, or cannot go, is refused and the army does not change.
  assert.match(choose(VASSE, offer, { kind: "take", card: "structure:barracks" }) as string, /not among the cards on offer/)
  assert.match(choose(VASSE, offer, { kind: "remove", card: "structure:barracks" }) as string, /not a card the army can remove/)
})

test("a run settles a draft once, records it, and the next battle's duel is played on the army it left", () => {
  const run = { ...newRun({ seed: 1, commander: "vasse" }) }
  const { offer, pity } = dealDraft({ commander: "vasse", roster: run.army, seed: 1, battle: 2, pity: 0 })
  const waiting = { ...run, draft: offer, pity }
  const card = offer.cards[0]!
  const settled = drafted(waiting, { kind: "take", card: keyOf(card) })
  assert.equal(settled.draft, null)
  assert.deepEqual(settled.drafts, [{ battle: 2, offered: keys(offer.cards), choice: { kind: "take", card: keyOf(card) } }])
  assert.throws(() => drafted(settled, { kind: "requisition" }), /no draft/)
  assert.throws(() => drafted(waiting, { kind: "take", card: "structure:nothing" }), /not among the cards/)
  const battle = settled.definition.battles[1]!
  const duel = newDuel(duelFor(settled, battle))
  assert.deepEqual(duel.sides.A.roster, settled.army)
  assert.equal(duel.sides.B.roster, undefined, "the opponent plays its Commander's whole army")
})

test("a battle is played on the roster: a Doctrine is kept from round one, and what the army lacks cannot be built or dealt", () => {
  const roster: Roster = { ...VASSE, doctrines: ["heavy-rounds-standard"] }
  const duel = newDuel({ map: "crossing", seed: 3, rounds: 6, pulseTicks: 600, commanders: { A: "vasse", B: "dob" }, rosters: { A: roster } })
  assert.deepEqual(duel.sides.A.kept, ["heavy-rounds-standard"])
  const army = armyOf(duel, "A")
  assert.deepEqual(army.buildings.map((card) => card.id), ["turret", "barracks", "depot"].filter((id) => army.buildings.some((card) => card.id === id)))
  assert.ok(!army.buildings.some((card) => card.id === "garrison" || card.id === "battery"), "the Garrison was not drafted")
  const whole = loadoutOf(armyOf(newDuel({ map: "crossing", seed: 3, rounds: 6, pulseTicks: 600, commanders: { A: "vasse", B: "dob" } }), "A"), { kept: [] })
  const fielded = loadoutOf(army, duel.sides.A)
  const damage = (loadout: typeof whole): number => (loadout.registry.get("structure.bench.beamturret").attack?.damage ?? 0)
  assert.equal(damage(fielded), damage(whole) + 3, "the Doctrine's three damage is on every Turret from the first round")
  assert.equal(whole.catalog.length > fielded.catalog.length, true, "a run's army builds from a smaller menu")
  // Neither the Pulse nor the run's pool deals a Doctrine or a power the army lacks.
  for (let seed = 0; seed < 40; seed += 1) {
    const hand = handOf({ ...duel, setup: { ...duel.setup, seed } }, "A").map((card) => card.id)
    for (const id of hand) assert.ok(roster.powers.includes(id), `${id} is in the hand but not in the pool`)
  }
  for (let seed = 0; seed < 20; seed += 1) {
    const free = handOf(newDuel({ map: "crossing", seed, rounds: 6, pulseTicks: 600, commanders: { A: "vasse", B: "dob" } }), "A").map((card) => card.id)
    assert.ok(!free.some((id) => id.endsWith("-standard") || id === "long-barrels"), "a Doctrine was dealt by the Nexus Pulse")
  }
})
