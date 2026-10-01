# Terminal Nexus — next steps

*What waits on Mario, the small carry-over from finished work, and the cleanup queue. Delete an item when
it is done.*

## Waiting on Mario

- **Play the Commander**: PERIMETER, round 1. Vasse is the `@` among the squads; put the Explore cursor on
  her for her card. Press `d` during a round: **Vasse's health**, under THE MISSION. At 20 she falls in round
  2 and round 3 opens without her (the feed, the result, the bottom line and the Battle Round screen say so).
  Her return cannot happen inside PERIMETER's three rounds; the pull request's pictures show it from the
  Commander's own test map. Then paste the settings export.
- **Play the Activity logs** (pull request 51): on the playtest page open the "Activity logs" demo, press
  Esc then `a`, change the filter, press `e`, and paste the export into the pull request. Also look at the
  About screen (Menu, then `4`).
- **Turn on GitHub Discussions** (repository Settings → General → Features) with an Announcements
  category; the About screen then links to it (`src/title-menu/about.ts` has the slot). Why this and not
  Discord: [the parked feedback pipeline](../history/reports/2026-10-01-feedback-pipeline-parked.md).
- **Run the key-release probe in iTerm2**: `node scripts/probe-key-release.mjs`, hold an arrow, let it go,
  tap it, `q`. Lines saying `release` mean the Key releases Experiment's `auto` works there; `legacy`
  means `auto` and `off` feel the same.
- **Open questions** (each has a recommendation in the register): building Vasse without authoring the whole
  Citizens army, which the Commander milestone does under the recommendation (Q34); how much of what is coming a
  player sees without spending a Nexus power, before the Nexus draft step picks PERIMETER's two (Q71); an order
  primitive as its own step (Q69; the thinking is in [`scripted-opponent.md`](../game-design/scripted-opponent.md)),
  letter hotkeys for buildings (Q67), whether the player ever reads "Pulse" (Q68), and the exploring click, the
  wheel step and the light theme's light (Q63; Q62 and Q64 are answered).
- **Experiments that came back without an export** stay at their first guesses until he sends one: the menu
  spike's (Battle Round flash, Flash strength, Popup pulse, the keyboard navigation numbers), and the round
  loop's and the Barracks's under THE MISSION (Next round, Incoming wave, Barracks trains, Troopers a round),
  with the Activity logs' **Barracks** filter beside them.

## Carry-over

Small, none blocking.

**From step 6B** ([the round-loop report](../history/reports/2026-09-30-round-loop-and-missions.md) has the reasons):

- PERIMETER is played on the Build Phase's starter map, with regions named for its landmarks; its own map is Q38's.
- Every unit engages the nearest enemy: `order` has one verb, `advance` (Q69).
- A new Nexus power is dealt every round (the placeholder draft adds 30 or 2000 credits) on top of the
  credits carried over. Real Nexus powers are Milestone 8's.
- The incoming wave is a forecast placed against the map without the plan; a building on an arrival's
  tile moves it when the round starts.
- The walk home is a straight glide over whole tiles, with no routing. Watch again replays a Pulse
  already resolved; it must never resolve a new one.

**From step 8A** ([the Commander report](../history/reports/2026-10-01-commander-vasse.md) has the outcomes):

- Vasse's return is never seen in PERIMETER: she cannot fall before round 2 there, and a fall in round 2 is
  back in a round 4 that does not exist. The named scenario (`tests/commander-fixture.ts`) proves it.
- She falls in PERIMETER's last round in every plan measured, at every health the Experiment offers, so the
  mission always ends with "Vasse fell."; the milestone hoped PERIMETER would not force her death. No health
  keeps her alive there and still lets a plan that builds nothing lose: holding her back waits on Q69.
- Her doctrine's "hold, then advance" waits on an order the kernel can keep (Q69); she engages the nearest
  enemy like every unit, from just behind the line.
- In round 1 she is incoming with the squads, so her card is the incoming one ("Yours, next round"), not her
  own ("Your Commander"); from round 2 on it is hers.
- With her in the squads, a round 1 with Turrets built ends near 9.8 seconds, before the Barracks's first
  trooper at the default pace; with nothing built it ends near 11 seconds and the Barracks trains one.

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
| One launch-options module for the command line and `#settings=` / `#keys=` | A new option can reach one and not the other | small |
| A host-conformance test: run a key script through the terminal path and the page (headless Chromium) and compare frames | Turns the by-hand check we did into a test | small to medium |

## Not measured yet

- iTerm2: key releases (the probe), Option and Esc handling as measured in step 5A's table, OSC 52 clipboard once "Applications in terminal may access clipboard" is on.
- Any terminal but iTerm2 and tmux: WezTerm, Ghostty, kitty, Alacritty, Windows Terminal, GNOME/VTE.
- The playtest page on a real phone and on an iPad with a hardware keyboard (Esc, Option).
- The thin map-edge glyphs on a terminal font that lacks box-drawing weights.
