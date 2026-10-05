# Terminal Nexus — next steps

*What waits on Mario, the small carry-over from finished work, and the cleanup queue. Delete an item when
it is done.*

## Waiting on Mario

- **Play the Commander's fifth round** (his notes after pull request 60 merged), from `./bin/terminal-nexus.ts
  --at 'campaign?level=vasse-test-1'`: press `1` to arm a Barracks. The dotted ground is the build range,
  given only by what stood when the round opened, and a building needs one tile on it; the dim ticks round
  each Barracks and Hatchery are the room it keeps, where nothing may stand. Explore Map (`e`) over a marksman
  draws its range; the raid's trail is a slow line of arrows. Start the battle without picking a Nexus power:
  four troopers come out of the Barracks together at five seconds, and Vasse speaks beside her. Under THE
  MISSION in Settings (`d`), **Barracks room** (1 or 2 tiles) is new beside **Build range** and **By the
  Book**; paste the settings export.
- **Decide the tall tiles** (his note on range skewed vertically): [the spike's
  report](../history/reports/2026-10-05-tall-tiles-spike.md) compares tiles as now, square tiles and rows
  counting double. Recommended: build rows counting double as an Experiment, with square tiles beside it, so
  he can feel both before the distance rules change; it is a step of its own.
- **Play the Activity logs** (pull request 51): on the playtest page open the "Activity logs" demo, press
  Esc then `a`, change the filter, press `e`, and paste the export into the pull request. Also look at the
  About screen (Menu, then `4`).
- **Turn on GitHub Discussions** (repository Settings → General → Features) with an Announcements
  category; the About screen then links to it (`src/title-menu/about.ts` has the slot). Why this and not
  Discord: [the parked feedback pipeline](../history/reports/2026-10-01-feedback-pipeline-parked.md).
- **Run the key-release probe in iTerm2**: `node scripts/probe-key-release.mjs`, hold an arrow, let it go,
  tap it, `q`. Lines saying `release` mean the Key releases Experiment's `auto` works there; `legacy`
  means `auto` and `off` feel the same.
- **Open questions** (each has a recommendation in the register): the tall tiles (Q24, above), an order primitive as its own step (Q69, which
  would also let Vasse hold the line; the thinking is in [`scripted-opponent.md`](../game-design/scripted-opponent.md)),
  letter hotkeys for buildings (Q67), and the exploring click, the wheel step and the light theme's light (Q63;
  Q62 and Q64 are answered).
- **Experiments that came back without an export** stay at their first guesses until he sends one: the menu
  spike's (Battle Round flash, Flash strength, Popup pulse, the keyboard navigation numbers), and the round
  loop's under THE MISSION (Next round).

## Carry-over

Small, none blocking.

**From step 6B** ([the round-loop report](../history/reports/2026-09-30-round-loop-and-missions.md) has the reasons):

- PERIMETER is played on the Build Phase's starter map, with regions named for its landmarks; its own map is Q38's.
- Every unit engages the nearest enemy: `order` has one verb, `advance` (Q69).
- A new Nexus power is dealt every round (the placeholder draft adds 30 or 2000 credits) on top of the
  credits carried over. Real Nexus powers are Milestone 8's.
- The incoming raid is a forecast placed against the map without the plan; a building on an arrival's
  tile moves it when the round starts.
- The walk home is a straight glide over whole tiles, with no routing. Watch again replays a Pulse
  already resolved; it must never resolve a new one.

**From step 8A** ([the Commander report](../history/reports/2026-10-01-commander-vasse.md) has the outcomes):

- Vasse's return is never seen in PERIMETER: she cannot fall before round 2 there, and a fall in round 2 is
  back in a round 4 that does not exist. The campaign's second test level shows it:
  `--at 'campaign?level=vasse-test-2&round=3'`.
- Her doctrine's "hold, then advance" waits on an order the kernel can keep (Q69); she engages the nearest
  enemy like every unit, from just behind the line.
- In round 1 she is incoming with the squads, so her card is the incoming one ("Yours, next round"), not her
  own ("Your Commander"); from round 2 on it is hers.

**From step 8A's second round** ([Mario's notes](../history/feedback/2026-10-03-commander-round-2.md)):

- The raid's intent is its first target only: after first contact the raid retargets, nearest enemy each
  tick, and where the fight then goes is not shown. A group arriving seconds in is foreseen against the
  round's opening.
- At 16 colours and in monochrome an arriving unit is drawn at full strength (the wash shows only where
  colours blend), so arriving and present enemies look alike there; the panel's heading and the card's
  "Incoming" say which. At 256 colours the washes come out grey, and washed orange turns pinkish.
- Both of her campaign's levels offer the same cards (PERIMETER unlocks all of `armies/all`, the cadence level
  nothing new), so what a level offers changes nothing on screen yet; it shows when a level unlocks a card of
  its own (the Nexus draft step).
- PERIMETER opens on its intro, so a key script for the game, the playtest or the browser page starts with
  `Esc` (the documented examples do).

**From step 8A's third round** ([Mario's notes](../history/feedback/2026-10-04-commander-round-3.md)):

- No card carries rarity, tier and role yet, though the game modes design says every card does from the day
  it is authored: the army files' cards are the bench placeholders, and the first step that deals cards from a
  pool adds the tags.
- The army loader does not check that a Nexus power's line fits a panel row (28 columns at 80 × 24).
- The units' and buildings' definitions (stats, footprints) are still TypeScript in `src/content`; an army
  names them by id. Moving them into the army files is the next step for content.
- A claude.ai link cannot carry `#at=`; the published page opens a place through a demo's route instead.

**From step 8A's fourth round** ([Mario's notes](../history/feedback/2026-10-04-commander-round-4.md)):

- A lone Turret or Hatchery east of the Barracks draws round 1's probe against the ridge, out of the line's
  reach, and the round runs to time (still survived): units step greedily and have no pathfinding.
- Round 2 with nothing built is still won, so "the second round needs something built" holds neither before
  this round nor after it; the level was not tuned for it.
- By the Book's reach is drawn only where colours blend: at 16 colours and in monochrome her card says what it
  does.
- The forecast carries the player's troops as one more forecast group (`TroopsGroup`); a `post` field on the
  raid's group would be one shape fewer.
- `src/cli/pulse-run.ts` still exports PERIMETER's mission connection for seven tests; the game no longer uses
  it.
- Building inside a raid's public coverage waits for a raid that stands buildings at the start of a Build Phase.
- The title screen's motto keeps the lore's word ("Build. Commit. Pulse. Understand. Adapt.").

**From step 8A's fifth round** ([Mario's notes](../history/feedback/2026-10-05-commander-round-5.md)):

- PERIMETER is easier: a Barracks's four troopers at five seconds hold its last round even with nothing built
  (narrowly, the Nexus at 77 of 400), and Vasse now lives through it in most plans, so her health Experiment
  matters only in round 3. The raid is not retuned until the tall-tiles question settles movement and range.
- The battle feed gives each unit of a wave its own line ("5.0s trooper trained" four times), and a swarmer
  reads "spawnling" there (the feed's short ids); one line a wave would read better.
- Without chaining, round 1's build range is the Nexus's and the Barracks's alone, and reaching further takes a
  round a step. A room of one tile leaves a Barracks's corners open, corner to corner; Barracks room 2 with
  Build range 2 leaves nowhere for a Barracks. The room shows only while a building is armed.
- Her round-opening line rarely fits now that first contact comes sooner: the moments that matter more come first.
- The tests' shared PERIMETER plan (`STRONG`, `tests/mission.test.ts`) puts its Hatchery outside the build range;
  the tests skip the placement check, so the plan could not be placed in the game as written.
- At 16 colours each moving arrow is a pair for a moment (its copy looks like itself). The trail is the second
  animation that never settles, beside a popup's breath: the screen redraws five to seven times a second while
  it moves. Moving arrows may strengthen the worry, in the backlog, that lanes of arrows read as a tower defence.

**From step 6C** ([the Barracks report](../history/reports/2026-10-01-barracks-trains.md) has the outcomes):

- A recipe costs nothing and nothing competes, so the seeded contention process is not built; it comes with
  cost and supply in the worker economy.
- Only the buildings a campaign level offers spawn: a barracks in a `grid` scenario still spawns nothing,
  and the bench Hatchery there keeps its own breeding.


**From the Build Phase and the menu spike** ([report](../history/reports/2026-09-30-menu-spike.md)):

- The restart-needed message has no live trigger: no Experiment needs a restart today. When the first
  one appears, play it.
- The Controls page is written by hand (`controlsPage`, `src/build/help.ts`): a new key needs a line there
  as well as in `src/build/keyboard.ts`. A test holds every bracketed key a hint names to a real binding;
  the page's own lines are checked by eye.
- The focus arrow on a shallow diagonal steps a row every few columns, a comet of `-` with a `\` at each
  step; worth his eye along with the Experiment.
- Three same-state tests click tiles chosen outside the click's edge zones (build-phase, build-nexus,
  build-experiments); if the edge zone changes, move those tiles.
- The committed plan's fallback panel still prints `[esc] menu` beside the top bar's own `menu [esc]`;
  it only shows when no Pulse can start. Removing the line is one edit.
- **Polish navigation in a session of its own** (his request, third round of menu spike feedback): tune
  the hold cadence to his feel and play Key releases `auto` against `off` in iTerm2, then take the rest of
  the list in [`input.md`](../system-design/input.md) (a learned hold window, a hold that starts without
  waiting for the first repeat, the title menu's timing).

## Cleanup and refactor queue

| Item | Why | Size |
| --- | --- | --- |
| A `ScreenHost` interface and an `InputEvent` with `phase` | Fewer TTY fakes, real key releases, gamepad and touch-hold | see [`portability.md`](../system-design/portability.md) |
| A host-conformance test: run a key script through the terminal path and the page (headless Chromium) and compare frames | Turns the by-hand check we did into a test | small to medium |

## Not measured yet

- iTerm2: key releases (the probe), Option and Esc handling as measured in step 5A's table, OSC 52 clipboard once "Applications in terminal may access clipboard" is on.
- Any terminal but iTerm2 and tmux: WezTerm, Ghostty, kitty, Alacritty, Windows Terminal, GNOME/VTE.
- The playtest page on a real phone and on an iPad with a hardware keyboard (Esc, Option).
- The thin map-edge glyphs on a terminal font that lacks box-drawing weights.
