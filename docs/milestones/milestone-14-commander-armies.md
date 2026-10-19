# Milestone 14 — Commander Armies

**Status:** CURRENT
**Current step:** 14C, round 3 — no side wins by where it stands: every tie broken by what a unit faces, then a seeded draw, so mirror duels split evenly.
**Depends on:** Milestone 8 (the Commander, her presence on screen and her return; the Nexus Pulse's dealing; complete)

Made current by Mario on 2026-10-15: "let's move to next milestone", then, with the plan in front of him, "Go ahead
please".

The owner, 2026-10-12, once the Nexus Pulse dealt by schedule: "The part I'm most interested in covering now is the
'structure' of a commander army, thinking about ways to differentiate commanders from each other, giving them
character and presence in the UI ... and start thinking about catch-up mechanics" ([his
words](../history/feedback/2026-10-13-commander-armies.md)). The Commander milestone built one Commander and said it
was not a Commander Army; this milestone says what one is, gives a second Commander to set beside her, and writes the
rules every army is built against. It still does not lock the Citizens' roster or its balance (Milestone 12).

## Question

Can two Commanders on the same buildings feel different within two rounds, because each army leans its build on
something of its own (the Commander, the units, the economy), against one expected power curve that keeps early
rounds exploratory and late rounds decisive, and that a lucky early hand cannot run away with?

## What the owner settled for it (2026-10-13)

- **Asymmetric by design.** A Commander has whatever abilities suit them; what sets an army apart is what its build
  leans on: the Commander, the units, the economy, and so on.
- **Every ability is automatic.** An active skill fires by its own rule: the player gives no input during a Battle
  Round.
- **Survivors stack.** Units that survive come home and fight again beside the new ones; what a later round brings is
  much stronger, so the opening rounds explore and the last ones decide.
- **The power curve has rules.** How much power each Nexus Pulse and each round is expected to bring is written
  down, so an army can trade along it: ahead early and behind late, or the reverse.
- **Catch-up is a design guideline first.** No catch-up mechanic is built in this milestone: no Experiment for it.

## Steps

One step per pull request; the order is a first guess.

### Step 14A — What a Commander Army is, and the power curve

Design, with what the loader can check. Built; the numbers are first guesses for 14B to put on the Grid.

- [x] The anatomy of a Commander Army, written as the authoring template and checked by the army file's loader where
      it can be: the Commander (unit, automatic abilities), the starting package, the tech tree in tiers, the Nexus
      power pool and how the army bends the schedule, its voice and its motif, and the build focus it leans on.
- [x] The expected power curve: what a round's credits, a tier of the tree and a Nexus Pulse's pick are each expected
      to be worth, round by round, as numbers an author designs against, and what an army may trade along it.
- [x] Guidelines for catch-up, for whoever designs an army: what keeps a lucky early hand from running away (the
      schedule's commons first, kept powers public, hard counters in the tree, the curve devaluing an early lead,
      the defender's ground), and what an army must not do (hidden rubber-banding, rewards for falling behind).

### Step 14B — The curve on the Grid

Mario, 2026-10-15: "Let's define a tech tree and keep working to simplify and streamline thinking this will work for
both the campaign, runs and pvp"; and yes to credits carried over with each round's added, and to locked buildings
shown in the build menu with what they need ([his words](../history/feedback/2026-10-13-commander-armies.md)).
Built; the measurement found the opening is close to half of the last army, not a fifth, and the question of what
keeps an early lead from compounding is registered with a recommendation (a supply cap).

- [x] The tech tree is the army's data, one rule in every mode: a building card has a tier and the buildings it
      requires, the loader checks them, and a mode only decides which cards are offered.
- [x] A building whose requirements do not stand as the Build Phase opens is in the build menu, dim, and its card
      and the bottom line say what it needs; arming it is refused with the reason.
- [x] Credits every round: what was not spent carries over, and each round adds the curve's credits for it.
- [x] A second tier: a building that needs a Barracks standing and sends units much stronger than troopers.
- [x] A test level of six rounds, reachable by route, where survivors stack and the curve can be played.
- [x] Measured and written down: how much of the last round's army came from the first rounds.

### Step 14B, round 2 — Supply, and a building's actions

Mario's answer to what keeps an early lead from compounding, and a new idea ([his
words](../history/feedback/2026-10-13-commander-armies.md)): "go with your recommendation, supply cap ... Supply should
be controlled by another building", and actions on a building, chosen in Explore Map with their keys, "because it
affects the power curve". Built on the same pull request.

- [x] Supply: an army fields what its buildings give (the Grid Nexus, a Supply Depot), each unit taking its places,
      and a building waits while its side is full. The credits line shows it.
- [x] A building's actions on its card, each under its own key and clickable: Hold production, which keeps a
      building's wave home for one round.
- [x] The curve level measured again with supply.

### Step 14C — Marshal Averno

Mario, 2026-10-16: "go for Averno! :)" ([his words](../history/feedback/2026-10-13-commander-armies.md)).

- [x] Averno is a second Commander on Vasse's buildings, with his own automatic abilities, a build that leans
      forward where hers holds, a few powers that act on the enemy, and his structural quirk: some rounds, one card
      in his hand comes from the Ravel Nexus (an army bending the schedule, which the Nexus Pulse milestone had
      planned).
- [x] He is played beside Vasse on the same level; the pull request says whether they read apart in two rounds.
      They do: with the same build he falls in round 2 and she does not, and his side loses more in round 3 while he
      is out ([the measure](../game-design/commander-armies.md)). (His side also cleared round 1 sooner and lost less;
      since every tie goes by what a unit faces, then a draw, hers does, by a unit.) His level is her first five
      rounds: an empty base holds his round 4 with little to spare, and cannot hold her round 6.

### Step 14C, round 2 — The army structure, Dob Hunter, and duels

Mario, 2026-10-17, agreeing to the structure's improvements: "make a refactor/cleanup branch to solidify the
commander army files ... then define a new Commander Army on the new structure ... then try to test a pvp fight
between commanders" ([his words](../history/feedback/2026-10-13-commander-armies.md)).

- [x] Armies stack — `all`, a faction (`citizen`, `ravel`), a Commander (`vasse`, `averno`) — and every unit and
      structure an army brings is data in its file; campaigns are their own folders and a level may extend another.
- [x] Vasse's tuned values are her army's data, and the Experiments that tuned them are gone (By the Book stays).
- [x] A Nexus power's effect is one entry of a table and a unit's ability one entry of another, each saying its
      shape, its checks and what it does, so nothing branches on a kind; a test adds a kind of its own.
- [x] A third Commander, Dob Hunter, on the Ravel Nexus, with a bounty and loaded dice, written on the structure.
- [x] An adversarial review of whether the code explains itself, its findings applied.
- [x] Duels: two armies on one map, a round at a time, a script or a model planning each side through files; a
      bench of every pairing from both sides, and model games played.
- [x] The guide for writing an army ([`army-authoring.md`](../system-design/army-authoring.md)) and for duels and
      model against model ([`duels.md`](../system-design/duels.md)).

### Step 14C, round 3 — No side wins by where it stands

Mario, 2026-10-19: "when two troops equally strong attack each other at the same time, the solution should be
deterministic independently of the side" ([his words](../history/feedback/2026-10-13-commander-armies.md)).

- [x] Every tie a rule breaks goes by what the deciding unit faces (the enemy, or where it is headed), and what is
      still tied after that by a draw from the battle's seeded stream: never by reading order, compass order or
      ordinal. Where a building sets its units down, a unit's target among equally near enemies, a group's muster,
      Recall's homes and tiles, the order neighbouring buildings set units down in, a duel's placement, and how a wide
      unit measures its walk.
- [x] Two equal units that strike each other in the same tick both fall (it was already so; now a test says it).
- [x] A mirror battle stays a mirror, tick for tick, and mirror duels split about evenly over the bench.
- [x] Pathfinding round rocks and banners for rally points are registered for the routing work, not built.

### Step 14D — Catch-up, measured

The duel it needs is built (the round above); what is left is the measure.

- [ ] A headless duel: two scripted sides drafting from the Nexus Pulse on one map, over many seeds, measuring how
      often a lucky early hand predicts the winner.
- [ ] The guidelines of 14A revised by what it shows; any catch-up mechanic it suggests is registered with a
      recommendation, not built.

## Out of scope

The full Citizens roster and its balance (Milestone 12), a campaign for Dob Hunter or any Ravel Commander, multiplayer itself,
a catch-up mechanic built, and any input from the player during a Battle Round.
