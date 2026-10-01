# Milestone 8 — Commander

**Status:** PLANNED
**Depends on:** Milestone 5 (the Build Phase is where the upgrade pick lives), Milestone 6 (the Pulse is where the Commander acts)

This milestone widens Level 1's scope on purpose. Earlier plans deferred the Commander mechanic to
Mission 3 (RESTORATION) and said not to author a Commander Army before Milestone 12. The plan now puts
a real Commander in Level 1. What does and does not change because of that is spelled out under
"Is this a Commander Army?" below.

## Question

Can Commander Edda Vasse exist as a real, persistent frontline unit, with the death, absence and
restoration mechanic that the Commander section of
[`docs/system-design/grid-engine.md`](../system-design/grid-engine.md) describes and nothing has built
yet? And can the player pick from a small, real Nexus upgrade draft during the Build Phase, without
this becoming "author the Citizens Commander Army" ahead of Milestone 12?

## What it builds

- **The Commander mechanic.** A persistent `@`-class unit on the `units` layer that competes for
  investment like any other build choice. When it dies it is absent for the rest of that Pulse and for
  one full Build Phase and Pulse, after which the Prime Nexus may replicate it again. Commander death
  is not the victory condition: PERIMETER's victory and defeat (settled while building the mission runner) never depend on Vasse.
- **Vasse, named.** Her doctrine in [`docs/game-design/commander-armies.md`](../game-design/commander-armies.md),
  "fortify, verify, then advance", becomes her behaviour profile and stat shape, scoped to what
  PERIMETER needs and not a full roster entry. Her full card, with candidate powers and what she
  deliberately cannot do, is in the same document. She is the Commander that ships first (Q43).
- **A small, real Nexus upgrade draft.** The engine design says the Grid Nexus offers a small draft of
  upgrades and admits none of it is designed. This milestone designs and builds the smallest real
  version: one or two options, scoped to the mission, filling the upgrade-pick slot Milestone 5
  already built. The draft comes from the Commander Army's own Nexus power pool, dealt as a hand at the
  start of each Build Phase, one kept. Vasse's PERIMETER army is that shape at its smallest: a pool of
  two, a hand of two, one kept per Build Phase across the mission's three Pulses. That is enough to
  build the dealing mechanism once, not as a placeholder.

## Steps

### Step 8A — The Commander mechanic

- [ ] Vasse is a persistent `@` on the `units` layer.
- [ ] Death, absence for the rest of that Pulse and one full cycle, and restoration work on a named
      scenario that hashes the same every run.

### Step 8B — The Nexus draft, dealt from a pool

- [ ] A hand is dealt at each Build Phase from the army's Nexus power pool, one is kept, and it fills
      Milestone 5's slot.
- [ ] PERIMETER has two real, mechanically distinct powers. The pick may never be declined (Q45,
      answered).
- [ ] A power is a name and one plain line of description. The effect kinds behind it are code names
      the player never sees (Q42, answered); build two or three of the six, not all.
- [ ] The dealer built here is the one Milestone 11's run draft reuses at the next scale.

Both modes need both steps, which is why this milestone sits before either mode shell in the build
order ([`README.md`](README.md)).

## Is this a Commander Army?

No, and this is the exact line. A Commander Army (see the Commander Army design) is the complete set of
choices legally available to one player in one match: starting resources, every legal unit and
structure, the full upgrade pool, faction rules, portraits, barks, effect motifs and balance
hypotheses. This milestone builds one named Commander's mechanic and a two-option draft scoped to one
mission. Everything else the player can do in PERIMETER is still the disposable Citizen fixture roster,
with no balance claim, as Milestone 1 shipped it. Building the mechanism a Commander Army will need,
and using it once and narrowly for a story character the mission already requires, is not the same as
choosing and locking the real Citizens roster (Q34).

The recommendation: build the mechanism and Vasse specifically, keep the draft to the one or two
options this mission needs, and do not treat this milestone as Milestone 12's roster selection. Say so
in the pull request, so a later reader does not mistake "Vasse exists" for "the Citizens Commander Army
is locked."

Mission 3 is where the belief ramp spends the death, absence and restoration beat in the story
("Vasse dies mid-Pulse, and play continues"). Building the mechanic now need not spend that beat early:
PERIMETER's map and raid strength should simply not force Vasse's death, so the mechanism exists and
is testable without the story using it before Mission 3 is ready.

## Out of scope

- The full Citizens Commander Army (Milestone 12).
- A second or third proposed Commander. Director Denz stays untouched.
- Nexus powers beyond the small upgrade draft.
- Any Ravel-side Commander. Speaker Corvane appears in PERIMETER's dialogue but is not a playable or
  mechanically modeled unit here.

## How it is judged

Automated: the Commander's death, absence and restoration timing follows the cadence the engine design
specifies, on a named scenario, with the same hash across many runs and both runtimes. The draft's
effect is deterministic and asserted, not merely "looks right."

Human: a player can tell Vasse apart from an ordinary trooper on sight, understands what her death did
when it happens, and can explain what the upgrade they picked changed.

## Done when

- [ ] The Commander mechanic (persistent unit, death, absence, restoration) is built and tested against
      the engine design's cadence.
- [ ] The upgrade draft offers a real, mechanically distinct choice, not a cosmetic one.
- [ ] The pull request says plainly that the Citizens Commander Army is still not locked.
- [ ] `./scripts/check-repository.sh` passes.
