# Terminal Nexus — next steps

*What waits on Mario, the small carry-over from finished work, and the cleanup queue. Delete an item when
it is done.*

## Waiting on Mario

**At most five asks** (the validator counts them), because his time is the scarcest thing the project has. Each says
whether it is to **play**, **watch**, **decide** or **do**, and about how long it takes; each was tried by an agent first.
A new ask replaces an old one or waits its turn. Asks retired on 2026-11-12, and where each went, are in
[the history](../history/retired-asks-2026-11-12.md).

- **Play, about fifteen minutes: the banner, in a Challenge battle** (the title menu's Challenge row, `2`, which the
  Skirmish milestone turns into Skirmish; unlike PERIMETER it has an enemy Nexus to aim at). Esc skips its opening lines. Build as you like, press
  `s` for the start panel, `t` to change the target: move the banner with the arrows or the mouse, Enter, then `a`
  (aggressive) or `d` (defensive), and `s` to start. Is placing it comfortable and clear, or should a simpler stance row
  replace it? In a duel the banner does not move the army yet (the step's next item), so judge the placing, not the
  battle. While you are there, say anything about the kept front (survivors step back and form up in the first
  10 seconds), a building's actions (`e` onto a Barracks, then `c`), and the Nexus shooting back. In Settings, under
  Experiments, try the keyboard's Arrow step, Shift step, Shift pace and Hold pace, then export the settings and paste
  them with your notes.
- **Watch, five minutes: troops at a narrow door.** `./bin/grid.ts scenarios/engage/engage-gap2-melee-vs-mix`, then
  `./bin/grid.ts scenarios/engage/engage-gap2-airmix-vs-mix`: twelve troopers lose at a door two rows wide, and the same
  number with half of them in the air win. Does that read as good ground (a choice that matters) or as air too strong
  where the ground is tight? Does a unit that keeps its target read as commitment or as stubbornness?
- **Decide, one line: letter keys for buildings.** Your notes once said "press 'b' to build a barracks". Was `b` an
  example, or do you want letters? Recommended: the digits stay, since they never move when a building is added; if you
  want letters, one is shown beside the name wherever it is free.
- **Do, one minute: turn on GitHub Discussions** (the repository's Settings, General, Features) with an Announcements
  category, so the About screen can point friends to it when they play. Why this and not Discord:
  [the parked feedback pipeline](../history/reports/2026-10-01-feedback-pipeline-parked.md).

## Carry-over

Small, none blocking. What rounds on PERIMETER left unfinished moved to
[the first missions' milestone](milestone-10-first-and-second-missions.md), where PERIMETER is polished.

- A rarity on a Nexus Pulse card should read at a glance by a mark the monochrome floor keeps, not only by its style
  role (from the retired Nexus Pulse milestone).

**From step 8A's third round** ([Mario's notes](../history/feedback/2026-10-04-commander-round-3.md)):

- Only Nexus powers carry rarity and role, though the game modes design says every card does from the day it is
  authored: `tier` waits for Story's technology choice, which gates by it, and buildings carry no tags until something deals them.
- The army loader does not check that a Nexus power's line fits a panel row (28 columns at 80 × 24).
- The units' and buildings' definitions (stats, footprints) are still TypeScript in `src/content`; an army
  names them by id. Moving them into the army files is the next step for content.
- A claude.ai link cannot carry `#at=`; the published page opens a place through a demo's route instead.

**From the colour work of 2026-10-15** ([the colour depths](../history/feedback/2026-10-15-drop-16-colours.md) and
[the background](../history/feedback/2026-10-15-colours-and-background.md); the lessons file has the reasons):

- The ANSI writer sends the whole frame every time. With the game's background painted that is about 13 KB for a
  104 x 30 truecolor frame (8 KB before) and 24 KB at 200 x 60, a few milliseconds to build: nothing locally, but a
  diff against the last frame (only the cells that changed) would be the first thing to do for play over SSH.
- At 256 colours a faint wash (a territory's tint, a half-faded `player.a`) lands on the nearest of very few dark or
  pale colours, so it can read greyer or pinker than in millions. The matching is by how colours look now and the
  hue is kept down to a faint tint, but the cube is coarse at both ends; nothing more is tuned for it.
- The light theme's muted text is the palette's quietest readable text, 2.15:1 against the paper after its dim (the
  dark theme's is 2.9:1); the palette test holds 2:1. Darkening it costs the hierarchy with `chrome.value`.
- `NO_COLOR` (and `FORCE_COLOR`) are not read: the first-launch guess is `COLORTERM` and `TERM` only.
- The committed pictures under `docs/` were taken before the game painted its background (each carries its own page
  backdrop), and are regenerated, not rewritten, the next time a round touches them.
- OpenTUI's background is drawn through the test harness only; its live backend runs under Bun on a real terminal,
  and nobody has looked at it there since.
**From step 6C** ([the Barracks report](../history/reports/2026-10-01-barracks-trains.md) has the outcomes):

- A recipe costs nothing and nothing competes, so the seeded contention process is not built; it comes with
  cost and supply in the worker economy.
- Only the buildings a mission offers spawn: a barracks in a `grid` scenario still spawns nothing,
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
  it only shows when no Battle Round can start. Removing the line is one edit.
- **Polish navigation in a session of its own** (his request, third round of menu spike feedback): tune
  the hold cadence to his feel and play Key releases `auto` against `off` in iTerm2, then take the rest of
  the list in [`input.md`](../system-design/input.md) (a learned hold window, a hold that starts without
  waiting for the first repeat, the title menu's timing).

## Cleanup and refactor queue

| Item | Why | Size |
| --- | --- | --- |
| A `ScreenHost` interface and an `InputEvent` with `phase` | Fewer TTY fakes, real key releases, gamepad and touch-hold | see [`portability.md`](../system-design/portability.md) |
| The curve levels' empty-base walk is guarded once | The tests of a level's layout now walk it with its battles undecided, so a change to how battles play cannot fail them. Whether a base with nothing built lives to the last round (what a route to a later round plays) is one check over every level, which says how low the Nexus fell each round: at worst 210 of 400, on Averno's level in round 4. If it tips, shape what an empty base faces on that level (a lighter round-4 raid, or a free defender), not the rules | small |
| `src/cli/pulse-run.ts` still exports PERIMETER's mission connection for seven tests | The game no longer uses it; the tests can reach the mission another way | small |
| A host-conformance test: run a key script through the terminal path and the page (headless Chromium) and compare frames | Turns the by-hand check we did into a test; Milestone 20 needs it before friends play the page | small to medium |

## Not measured yet

- iTerm2: key releases (the probe), Option and Esc handling as measured in step 5A's table, OSC 52 clipboard once "Applications in terminal may access clipboard" is on.
- Any terminal but iTerm2 and tmux: WezTerm, Ghostty, kitty, Alacritty, Windows Terminal, GNOME/VTE.
- The playtest page on a real phone and on an iPad with a hardware keyboard (Esc, Option).
- The thin map-edge glyphs on a terminal font that lacks box-drawing weights.
