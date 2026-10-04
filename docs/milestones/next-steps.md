# Terminal Nexus — next steps

*What waits on Mario, the small carry-over from finished work, and the cleanup queue. Delete an item when
it is done.*

## Waiting on Mario

- **Play the Commander's third round** (his notes on pull request 60): open places by route —
  `./bin/terminal-nexus.ts --at 'campaign?level=vasse-test-1&round=2'` opens round 2, `--at settings` the
  Settings screen, and `--help` lists every route. Watch her whole cadence on the second test level:
  `--at 'campaign?level=vasse-test-2'`, she falls in round 1, round 2 opens on a line saying she is out, and
  round 3 on her return. The army files change nothing on screen: PERIMETER offers what it always did, now from
  data. The second round's intro and the raid's intent are unchanged.
- **Play the Activity logs** (pull request 51): on the playtest page open the "Activity logs" demo, press
  Esc then `a`, change the filter, press `e`, and paste the export into the pull request. Also look at the
  About screen (Menu, then `4`).
- **Turn on GitHub Discussions** (repository Settings → General → Features) with an Announcements
  category; the About screen then links to it (`src/title-menu/about.ts` has the slot). Why this and not
  Discord: [the parked feedback pipeline](../history/reports/2026-10-01-feedback-pipeline-parked.md).
- **Run the key-release probe in iTerm2**: `node scripts/probe-key-release.mjs`, hold an arrow, let it go,
  tap it, `q`. Lines saying `release` mean the Key releases Experiment's `auto` works there; `legacy`
  means `auto` and `off` feel the same.
- **Open questions** (each has a recommendation in the register): an order primitive as its own step (Q69, which
  would also let Vasse hold the line; the thinking is in [`scripted-opponent.md`](../game-design/scripted-opponent.md)),
  letter hotkeys for buildings (Q67), and the exploring click, the wheel step and the light theme's light (Q63;
  Q62 and Q64 are answered).
- **Experiments that came back without an export** stay at their first guesses until he sends one: the menu
  spike's (Battle Round flash, Flash strength, Popup pulse, the keyboard navigation numbers), and the round
  loop's and the Barracks's under THE MISSION (Next round, Barracks trains, Troopers a round),
  with the Activity logs' **Barracks** filter beside them.

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
- With her in the squads, a round 1 with Turrets built ends near 9.8 seconds, before the Barracks's first
  trooper at the default pace; with nothing built it ends near 11 seconds and the Barracks trains one.

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

**From step 6C** ([the Barracks report](../history/reports/2026-10-01-barracks-trains.md) has the outcomes):

- A recipe costs nothing and nothing competes, so the seeded contention process is not built; it comes with
  cost and supply in the worker economy.
- Only a mission's listed buildings train: a barracks in a `grid` scenario still trains nothing.


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
