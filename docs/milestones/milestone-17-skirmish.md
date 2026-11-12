# Milestone 17 — Skirmish

**Status:** CURRENT
**Current step:** 17A — the banner (the prototype built in the runs milestone, waiting on the owner's playtest).
**Depends on:** [the runs milestone](../history/milestones/milestone-11-challenge-runs.md) (duels on the Build Phase screen, building actions, the kept front, troop movement, the
banner prototype), Milestone 14 (three Commander Armies and the duel scripts)

Made current on 2026-11-11 ([the owner's words](../history/feedback/2026-11-11-game-modes.md)): "Let's turn Skirmish into
the center stone for game design and testing." Sharpened on 2026-11-12 ([his words](../history/feedback/2026-11-12-the-new-focus.md)):
"now we have to rush a little more towards making sure the UI is comfortable, placing banners actually feels strategic
and it is also comfortable and clear, showing visual feedback about what the enemy is doing… Before we get there, we
have to make sure that the basic game at least is fun and it can be configured in a few different ways." The design it
builds against is [`game-modes.md`](../game-design/game-modes.md). Most of the battle exists: a Challenge battle is
already a duel on the Build Phase screen against a script.

**The goal is a basic game worth showing to friends**: one battle against an enemy on equal ground, comfortable to
play, where the banner and the read of the enemy are real decisions, and that can be set up a few different ways. Polish
of the look (effects, art, more terminology) waits behind it.

**While 17A waits on Mario's playtest**, the next session takes step 17C, then 17D; neither depends on his answer
about the banner. The worker economy (Milestone 7) may be built beside the banner, at the owner's word. The rest follow
in order.

## Question

Can a player start a Skirmish in a key or two — any Commander against any script, on a chosen map, with the opponent's
credits set, or from a battle file — read what the enemy did, answer it with their build and their banner, and finish a
battle they want to play again; and is a Skirmish where every change is seen, tested and commented on?

## Steps

Small, in order, each finishable on its own and each one pull request. Every step that changes the screen is played by
an agent before it is offered to Mario (DEVELOPMENT.md, the feedback loop).

### Step 17A — The banner

Moved from the runs milestone. The owner, 2026-10-31 ([his words](../history/feedback/2026-10-31-banner-first.md)):
"test placing the banner on the map first, because the UX to do it is the big question… if we can't, we will fallback
to the stance." Tried behind the Battle banner Experiment.

- [x] **The placement, as a prototype**: Start Battle docks a panel over the menu with the target and stance, the camera
      on the banner; Change Target makes the cursor a pulsing banner that names the spot under it, refuses ground troops
      cannot reach, and plants with a ring and a stance choice ([`ui-patterns.md`](../system-design/ui-patterns.md),
      "The battle banner"). Where no enemy Nexus stands, the default is the level's own target.
- [x] The march line runs to the banner, from the Nexus and from the Commander, and on to the enemy when aggressive.
- [ ] The owner plays it in a Challenge battle (an enemy Nexus to aim at, which PERIMETER lacks) and says whether it is
      comfortable and clear, or a stance row replaces it (step 17B).
- [ ] **A banner** placed in the Build Phase, aggressive or defensive; by default on the enemy Nexus, aggressive.
      Aggressive elsewhere: the army goes there first, then on to the enemy Nexus. Defensive: it holds the line there.
- [ ] The duel scripts place one, so a kept front has an answer: a script whose front is beaten holds or falls back.
      Duels carry it.
- [ ] **Strategic, measured**: over seeds, the duels say whether where a banner goes changes who wins (a script that
      plants well beats the same script planting at the default), and whether rush and turtle now reach each other's
      Nexus. A banner that never changes an outcome is decoration, and the step says so.

### Step 17B — The stance row, only if the banner fails

Built only if the owner chooses the stance over the banner in step 17A.

- [ ] A Build Phase row for the army's stance for the coming round: aggressive, hold the line, defensive.
- [ ] The duel scripts choose one, as step 17A's last items say for the banner.

### Step 17C — Skirmish on the title menu, and the names

- [ ] The title menu's rows: Skirmish, Story, Settings, About, Exit. Skirmish starts one battle with the defaults
      (Vasse against Dob Hunter's `balanced` script on the Crossing, a seed from the clock).
- [ ] The names in the code, the files and the routes: `skirmish` and `skirmish?seed=<n>`; `story` and
      `story?mission=<id>&round=<n>` for a mission; the `campaigns/` folder and the `campaign` words become Story's.
- [ ] The run retired: its draft, its next-battle screen and its summary, `src/run/`, the army files' `run` field and the
      routes that open it. What a Skirmish needs from it (a duel on the Build Phase screen, the result dialog) moves to
      Skirmish, and the player's side fields the Commander's whole army, not the run's small one.
- [ ] The Story row opens what Campaign opens today: a placeholder screen until the Story menu (Milestone 4).
- [ ] The tests that pinned a run are deleted with it or re-pinned on a Skirmish, each with a reason.
- [ ] The playable browser page opens on a Skirmish.

### Step 17D — Notes from a playtest

The parked idea of notes made inside the game ([why it was parked](../history/reports/2026-10-01-feedback-pipeline-parked.md)),
brought back on 2026-11-12: a playtest note should be the moment itself, not a paragraph describing how to reach it.

- [ ] **A session record**: every battle keeps its seed, settings, setup and the named commands pressed, in order, with
      their times. It is small, since every action is already a named command and the battle is deterministic. Kept on
      the player's machine (and in the browser page's memory), the last few battles only.
- [ ] **A note key**, on every screen: it opens one line to type into (Enter alone is fine), and saves a note file with
      the line, the screen as text, the session record up to that moment and the last Activity Logs events. The browser
      page copies the same note as text to paste.
- [ ] **A note replays**: the game, the playtest script and the browser page open a note file at its moment, so an agent
      sees exactly what the player saw (`--note <file>`).
- [ ] The feedback round skill reads note files the way it reads a settings export.
- [ ] Optional, behind an Experiment: one keypress at the end of a round to rate it, 1 to 5, kept in the session record.

This is a session record, not the replay format (still in the backlog): no content locks, no version checks, and only
the game that wrote a note promises to replay it.

### Step 17E — Reading the opponent

The owner, 2026-11-11 after showing the game ([his words](../history/feedback/2026-11-11-showing-the-game.md)): "when
the battle begins, see what they built, and… after what you saw happen… go back and analyze their base"; and
2026-11-12: "showing visual feedback about what the enemy is doing in a skirmish mode. So you can see what the enemy
plays new and how they're plotting to counter your build." The plans stay hidden while both sides build.

- [ ] **The reveal**: as the Battle Round starts, what the enemy did this Build Phase is marked on the Grid for a few
      seconds and said in one line: its new buildings and upgrades, its Nexus power, its banner and stance.
- [ ] **After the battle**: in the next Build Phase the enemy's base stands as it is, its new things still marked until
      the player has looked, and the panel says in a line or two what changed on its side (built, lost, its army now).
      Explore Map's card on any enemy structure says when it was built.
- [ ] **During the battle**: pointing at a unit shows its card, as Explore Map does in the Build Phase (the battle
      screen note in the backlog). Playback stays read-only.
- [ ] Measured by eye: a playtest at 80 × 24 and at the largest size reads the reveal without pausing.

### Step 17F — The setup screen

- [ ] A screen before the battle with every required setting the screen sets ([`game-modes.md`](../game-design/game-modes.md),
      what a Skirmish is set up with): your Commander, the opponent's Commander, its script and its credits, the map,
      the seed. Every row has a default, so Enter starts at once.
- [ ] Keys, mouse and driver, its hotkeys shown, adapting across the viewport range like every other screen
      ([`ui-patterns.md`](../system-design/ui-patterns.md), the checklist for a new screen).
- [ ] The result dialog offers the same battle again, a new seed, or the setup screen.

### Step 17G — The battle file

- [ ] `--battle <file>` starts a Skirmish from a JSON battle file: every required setting, including each side's
      credits, roster, and buildings and units already on the Grid, and a settings text.
- [ ] The duel commands take a battle file too, so the same file is played on screen and measured headless.
- [ ] A file the loader refuses is refused by name, every problem at once.
- [ ] A few battle files checked in as examples and demos, each played by a test: a mirror, a Commander against
      another with units already in place, and a short battle of four rounds on a small map, so a playtest fits in ten
      minutes.

### Step 17H — The opponent's credits

- [ ] The opponent's credits, at the start and each round, as a share of the curve's (the owner, 2026-11-11: "the
      skirmish could configure the enemy script playstyle and also the amount of credits. So we don't need to say
      difficulty"). On the setup screen and in a battle file.
- [ ] Measured: over seeds, each script against the others at a few shares, so the setup can say plainly how much
      harder each share plays.

### Step 17I — A battle that stays open

The duels found that an early lead decides a battle: the side ahead after round 2 wins 50 of 54
([the report](../history/reports/2026-10-21-the-march.md)). A battle decided in round 2 is not one a player wants to
finish, so this comes before friends play.

- [ ] Measured first: on Skirmish's defaults, how often the side ahead after round 1, 2 and 3 wins, and by how much.
- [ ] Two or three ways to keep a battle open, each behind an Experiment and measured over seeds (for example: the side
      behind earns more, the Nexus fights back harder when hurt, the kept front gives ground). Mario plays the best and
      picks; the question goes to the register with a recommendation.

### Step 17J — Skirmish, the place to test

- [ ] The playtest script, its skill, the browser page and the screenshot capture start from a Skirmish (or a battle
      file) instead of PERIMETER; a mission is still opened by its route when a change is about a mission.
- [ ] **An agent plays first**: the playtest skill plays a whole Skirmish through the driver and writes a short player's
      diary: what confused it, how many keys the common tasks took (placing a building, placing the banner, starting a
      round), how long the screen stood with nothing to decide, and which choices made no difference. Every step that
      changes the screen runs it before Mario is asked.
- [ ] The testing pages say which battle file shows which rule ([`testing-ground.md`](../system-design/testing-ground.md)).

### Step 17K — Playing it, then friends

- [ ] Mario plays Skirmish against each Commander and script, with the note key; his notes become feedback rounds. What
      makes a battle enjoyable becomes the defaults, and the first idea of the later list worth building is named.
- [ ] When he says the basic game is fun, the browser page goes to his friends with the note key, and their notes are
      the next feedback round.

## Out of scope

Each is in the later list of [`game-modes.md`](../game-design/game-modes.md) or the backlog, and waits for its own step or
milestone:

- Versus, and anything over a network.
- A Build Phase clock, modifiers, a pre-battle pick, more than two sides, random maps.
- A smarter opponent than the duel scripts, and Claude as an opponent (Milestone 19).
- Presets of opponent and credits offered as challenges.
- Pausing and rewinding a battle, and the replay format.
- The endless stand, and every mission (Story's milestones).
- The worker economy (Milestone 7, next, which may be built beside the banner).
- New effects, art and visual polish beyond what a step above needs to be read.

## How it is judged

Automated: a Skirmish is deterministic (the same battle file, seed and plans give the same hash on Node and Bun); every
battle file checked in is played by a test; a note file replays to the screen it was taken on; the setup screen at
every colour depth and across the viewport range; the driver plays a whole Skirmish with no terminal, and the agent's
player's diary reports the keys each common task takes.

Human, and this is the real test: Mario starts a Skirmish in a key or two, reads what the enemy did, answers it, plays to
the end, can say why he won or lost, and wants another with a different Commander. Then his friends do.

## Done when

- [ ] Steps 17A, 17C to 17K are built and tested (17B only if the stance replaced the banner).
- [ ] No mode, route, file or screen says Campaign or Challenge.
- [ ] `./scripts/check-repository.sh` passes.
