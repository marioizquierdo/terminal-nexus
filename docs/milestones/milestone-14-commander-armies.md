# Milestone 14 — Commander Armies

**Status:** PLANNED
**Depends on:** Milestone 8 (the Commander, her presence on screen and her return; the Nexus Pulse's dealing)

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

Not started. Each waits for the Commander milestone to finish; the order is a first guess.

### Step 14A — What a Commander Army is, and the power curve

Design, with what the loader can check.

- [ ] The anatomy of a Commander Army, written as the authoring template and checked by the army file's loader where
      it can be: the Commander (unit, automatic abilities), the starting package, the tech tree in tiers, the Nexus
      power pool and how the army bends the schedule, its voice and its motif, and the build focus it leans on.
- [ ] The expected power curve: what a round's credits, a tier of the tree and a Nexus Pulse's pick are each expected
      to be worth, round by round, as numbers an author designs against, and what an army may trade along it.
- [ ] Guidelines for catch-up, for whoever designs an army: what keeps a lucky early hand from running away (the
      schedule's commons first, kept powers public, hard counters in the tree, the curve devaluing an early lead,
      the defender's ground), and what an army must not do (hidden rubber-banding, rewards for falling behind).

### Step 14B — The curve on the Grid

- [ ] The tree has tiers whose units are much stronger than the first, and the credits a round brings grow, along
      the curve 14A writes.
- [ ] A test level of about six rounds, reachable by route, where survivors stack and the curve can be played.
- [ ] Measured and written down: how much of the last round's army came from the first rounds.

### Step 14C — Marshal Averno

- [ ] Averno is a second Commander on Vasse's buildings, with his own automatic abilities, a build that leans
      forward where hers holds, a few powers that act on the enemy, and his structural quirk: some rounds, one card
      in his hand comes from the Ravel Nexus (an army bending the schedule, which the Nexus Pulse milestone had
      planned).
- [ ] He is played beside Vasse on the same level; the pull request says whether they read apart in two rounds.

### Step 14D — Catch-up, measured

- [ ] A headless duel: two scripted sides drafting from the Nexus Pulse on one map, over many seeds, measuring how
      often a lucky early hand predicts the winner.
- [ ] The guidelines of 14A revised by what it shows; any catch-up mechanic it suggests is registered with a
      recommendation, not built.

## Out of scope

The full Citizens roster and its balance (Milestone 12), Dob Hunter and any Ravel Commander, multiplayer itself,
a catch-up mechanic built, and any input from the player during a Battle Round.
