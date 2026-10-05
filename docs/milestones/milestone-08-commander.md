# Milestone 8 — Commander

**Status:** CURRENT
**Current step:** 8A, round 5 — Mario's notes after the Commander's pull request merged: build range from standing buildings and any tile in it, room around a Barracks, troops in waves on a building's own schedule, an optional Nexus pick, a unit's range when explored, a moving intent trail, and her voice settled beside her.
**Depends on:** Milestone 5 (the Build Phase is where the upgrade pick lives; complete), Milestone 6 (the Pulse is where the Commander acts; complete)

Made current by Mario on 2026-10-01, after he played the loop across rounds: "Get ready and start working on
the next milestone stage!"

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

Built; waiting for Mario's playtest.

- [x] Vasse is a persistent `@` on the `units` layer. She walks out of the annex with PERIMETER's squads,
      fights from just behind the line, comes home to the Nexus after each round, and her health is an
      Experiment.
- [x] Death, absence for the rest of that Pulse and one full cycle, and restoration work on a named
      scenario that hashes the same every run (`tests/commander-fixture.ts`, on Node and Bun). The feed, the
      result, the next Build Phase and its Battle Round say she is out, and then that she is back.
- [x] Built first, because Vasse made it urgent: Mario's answer that only the Nexus falling loses a round.

### Step 8A, round 2 — Her deck, her entrance, and the raid's intent

Mario's notes on the Commander's pull request ([his words](../history/feedback/2026-10-03-commander-round-2.md)):
the milestone is the Commander's concept, not PERIMETER's balance or her health. Built on the same pull request;
waiting for Mario's playtest.

- [x] Vasse's deck is defined once, with the content: her Commander, the credits she starts with, what she can
      build and her Nexus power pool. Any mode that lets a player pick her reads it whole.
- [x] A mission names the deck it plays and may override any part of it, since the Campaign develops the deck
      level by level. PERIMETER names Vasse's and says what it unlocks; the Build Phase is built from the
      result; validation refuses a deck or an override that names what does not exist.
- [x] Vasse is drawn bold at full strength wherever she stands, arriving included, in the Build Phase and in
      the Pulse.
- [x] A dialog box at the bottom of the screen: a speaker and a line, Enter or a click for the next, Esc to
      skip, the camera on whoever is talking. A mission writes its lines as data; PERIMETER opens with its
      pre-battle exchange.
- [x] She has an intro highlight when she shows up: as PERIMETER opens, and the round she is restored.
- [x] The raid is always shown (the Incoming wave Experiment settled and removed), and the Build Phase shows,
      without looking for it, what each group goes for first, along which way, how many and when. The
      prediction is the kernel's own, run on the plan as it stands.
- [x] Played as a player at 80 × 24; the pull request says what the raid's intent made the player plan.

### Step 8A, round 3 — Navigation by route, content bundles, and Commanders who die

Mario's notes on the second round ([his words](../history/feedback/2026-10-04-commander-round-3.md)). Built on
the same pull request.

- [x] `--at <route>` replaces `--build-phase`: the title menu's screens and a campaign level
      (`campaign?level=<id>`, with the round to open at) are routes, the same grammar for the browser page's
      direct links; `--settings` takes `foo=6&var=true`. The bare command opens the title menu; loading a saved
      game from a default location is written down, not built.
- [x] The routing schema is documented, and a test opens every route it names.
- [x] Content is organized as bundles, data rather than code, each naming the bundles it builds on: `common`
      (buildings and Nexus powers any Commander may use) and `vasse` (her Commander and her campaign: its levels
      in order, what each unlocks, and their missions). Validation refuses a broken bundle by name.
- [x] What a level offers is what its campaign has unlocked by then. PERIMETER is the campaign's first level;
      the Commander's cadence test map is a second, reachable by route, so her return can be played.
- [x] Commanders die as part of the game: the round one is out opens on a line saying so, and the campaign
      design and the lore teach it in the intro levels rather than saving it for a later mission.
- [x] The next iteration on intent, the player's own units' targets, is in the backlog.

### Step 8A, round 4 — Range and territory, a target for your troops, Vasse as a hero, and a cleanup

Mario's notes on the third round ([his words](../history/feedback/2026-10-04-commander-round-4.md)). Built on
the same pull request, by subagents.

- [x] A building with range shows it on the ghost while it is being placed, quietly; any building with a
      range can show it the same way.
- [x] Construction territory is built: a building may only be placed within the construction radius of the
      player's other buildings, rooted at the Grid Nexus, and the Build Phase shows where that is.
- [x] Each campaign level names the target the player's troops head for; they engage what comes within reach
      on the way, and the Build Phase says where they are going. Posts wait.
- [x] Vasse has a passive aura: the player's units near her take less damage.
- [x] Vasse speaks during the Nexus Pulse, behind an Experiment, with a light touch of the effect library.
- [x] A pool of Nexus powers for Vasse is designed for the Nexus draft step to build.
- [x] "Wave" is gone: Battle Round in the interface, Nexus Pulse in lore and design; a route counts rounds only.
- [x] Content bundles are armies: `armies/all` and `armies/vasse`.
- [x] A cleanup pass over what this milestone added leaves the code simpler, with behaviour unchanged: `--build-phase`
      and `--spike` gone (an argument the game does not read is refused, naming what replaced them), one
      launch-options module for the game, the scripted playtest, the page and its demos, one default level, the
      title menu's places in one table.

### Step 8A, round 5 — Placement by standing range, troops in waves, and polish

Mario's notes after the Commander's pull request merged ([his words](../history/feedback/2026-10-05-commander-round-5.md)).
Built on a new pull request, by subagents.

- [x] Only buildings standing when the Build Phase opens give build range; a building planned this phase gives
      none until the next round.
- [x] A building may be placed where at least one of its tiles is inside the build range.
- [x] A building that spawns units keeps room around it: no other building within its clearance, shown while
      placing, and the clearance is an Experiment.
- [x] A building's units spawn together in waves, from the building's own numbers: how many a wave, how many
      waves, how long between them; the first wave 5 seconds into the round. The Barracks sends 4 troopers in
      one wave, and the Barracks Experiments are gone.
- [x] A Nexus power that adds a wave is in Vasse's pool, as design.
- [x] A round can start with the Nexus power still unpicked.
- [x] Exploring a unit shows its range, the way a building's reach shows.
- [x] The raid's intent trail is a slow line of arrows, one every three tiles, each leaving a fading arrow
      behind; still under reduced motion.
- [x] Vasse speaks beside her on the map; the Vasse's voice Experiment is settled and gone.
- [x] Tall tiles: a spike shows range and movement with tiles as now, square tiles, and rows counting double
      in the rules, with what each costs and a recommendation; nothing is built for real before Mario decides.

### Step 8B — The Nexus draft, dealt from a pool

- [ ] A hand is dealt at each Build Phase from the army's Nexus power pool, one is kept, and it fills
      Milestone 5's slot.
- [ ] PERIMETER has two real, mechanically distinct powers. The pick is optional for now (Mario's fifth
      round: easier to test), reversing the earlier answer that it may never be declined (Q45); this step
      decides with him whether it stays optional once the powers are real.
- [ ] A power is a name and one plain line of description. The effect kinds behind it are code names
      the player never sees (Q42, answered); build two or three of the six, not all.
- [ ] The dealer built here is the one Milestone 11's run draft reuses at the next scale.

Both modes need both steps, which is why this milestone sits before either mode shell in the build
order ([`README.md`](README.md)).

## Is this a Commander Army?

Its shape, yes; its roster, no. A Commander Army (see the Commander Army design) is the complete set of
choices legally available to one player in one match: starting resources, every legal unit and structure,
the full upgrade pool, faction rules, portraits, barks, effect motifs and balance hypotheses. Mario settled
how much of that this milestone builds, on the Commander's pull request: "this milestone is more about
building the concept of the commander ... Make sure that the commander deck is properly organized, and
properly integrated with the campaign." The second round built her deck as one definition a Campaign level
overrode. In the third, Mario separated the campaign's deck from the run mode's ("from the development side
they don't have to be the same"), so content became data: `armies/all` with the buildings and Nexus powers any
Commander may use, and `vasse` with her Commander and her campaign, whose levels each offer what it has
unlocked by then (`armies/`; the question about building her early is answered).

What is still not this milestone: choosing and locking the Citizens' roster. Every building and power she is
offered is the disposable bench content, with no balance claim, as Milestone 1 shipped it; the roster, its
balance and her four designed powers come later.

Commanders die as part of the game. The plan was that PERIMETER would not force Vasse's death, to save it for
the third mission; measured, she falls in its last round in every plan, and Mario settled it in the third round:
"commanders die on this game, is part of the gameplay so we better integrate that into the lore and the campaign
intro levels". So PERIMETER letting her fall is the game working, and the intro levels teach it.

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
