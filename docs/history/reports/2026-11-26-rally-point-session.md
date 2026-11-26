# The rally point session, 2026-11-24 to 2026-11-26 — a retro

_One long session (Claude Code, the CLI, on Mario's Mac) that took the banner from a screen that did nothing to
rally points for both sides, merged as [#106](https://github.com/marioizquierdo/terminal-nexus/pull/106). Mario's own
words and every decision under them are in [the feedback log](../feedback/2026-11-25-rally-point.md) (F303–F342);
this page is what the session learned, decided and left, for whoever picks the work up next._

## What we found out

- **The banner was decoration in a Skirmish.** The Build Phase showed it and the panel worked, but the Skirmish's plan
  never carried it to the round. Its tests checked the panel, not where the units went. Lesson recorded in
  [lessons-learned](../lessons-learned.md): a control is not done until the battle reads it.
- **"Cancelled" buildings were destroyed buildings.** About 1,500 scripted rounds showed the round never refuses a
  building the Build Phase accepted, except a clash (both sides on the same ground). What vanished was destroyed in
  its first battle, often within five in-game seconds, beside enemy troops that had regrouped in the base, and the game
  never said so. It now opens the next round on "Lost in the battle: …".
- **The troops stayed home because the round second-guessed the screen.** The enemy builds in secret the same round;
  when its new buildings filled the rally point's area, the round refused the spot and quietly used the default. The
  rule now: if the screen lets you place it, the troops march to it.
- **The regroup faced the wrong way** once the side's target became the rally point: it formed across the line from
  the Commander to her target, so a Commander beside or past it turned the ranks to the map's edge. It now forms on the
  rally point facing the enemy.
- **An existing definition already did half of the army-group work**: the engagement's 5-tile reach
  (`src/battle/reading/engagements.ts`), made in the Skirmish milestone for the round's report. Army groups reuse it.
- **Tooling on a Mac**: the repository check used a GNU-only `sed` pattern (fixed); one Save game test fails on a Mac
  because the temporary folder's path has a capital letter (still open); the routing timing test (11 ms budget) can
  fail on a slow CI runner (passed on a re-run).

## What we decided (Mario's word, each in the feedback log)

- **The rally point replaces the stance**, for both sides: a plan's `rally` is a tile, `HOME_NEXUS` or `ENEMY_NEXUS`
  (a list, so map hotspots can join it); the scripts place theirs; the troops hold it; nothing releases them mid-round.
- **Placing it**: Start sends the cursor there, the movement keys' arrows flash outward, the bottom line says
  `[arrows] Set Rally Point. [enter] Start battle.`, nothing else is written on the map; Enter plays the **prelude**
  (both sides' arrows, the enemy's new buildings one by one), then the fight; a settled round **fast-forwards**.
- **Between rounds**: straight back to the Build Phase; the army forms on its rally point facing the enemy; Watch last
  battle on `w`. The rally point starts 30% of the way to the enemy.
- **Vocabulary**: army, army group, front, army group formation, marching, engaging, re-targeting, regrouping, rally
  point and banner; tick, in-game second, frame, real time — in the [glossary](../../game-design/glossary.md) and the
  "Its words" table of [movement.md](../../system-design/movement.md).
- **Story stops** (F325): new mechanics are built in Skirmish only; Story returns as a scripting layer once Skirmish
  and a few Commander Armies are solid.
- **Not now**: no warning for building beside enemy troops; no balance work (UX first).

## What is left

In [next-steps.md](../../milestones/next-steps.md), "Cleanup and refactor queue":

- **Army groups** (the next pull request): front and back by the nearest enemy army group, the half-speed rule within
  an army group, arriving and forming up at the rally point mid-round, the regroup by army group. Changes every
  battle: measured before and after.
- **Story stops**: PERIMETER and the mission runner leave the game; the Build Phase's test base moves onto a Skirmish
  save.
- **Small leftovers** listed there too: the prelude's camera, the flash Experiments' labels, the map files' unused
  `hold` areas, the Mac-only Save game test, the headless mirror that runs past its rounds, the CI timing test.

## How the session worked

- Four feedback rounds, each logged before any code, split across two or three worktree agents by files, merged by
  cherry-pick, played with the scripted playtest, then documented. One merge conflicted in eight files and went back
  to its agent to rebase, which worked cleanly.
- Mario's design questions were asked as short multiple-choice questions with a recommendation; he once stopped a set
  to fix the vocabulary first, which saved a wrong name.
- Measurements: before and after on both maps for each rule change; a headless run without `--rounds` on the
  Crossing never finished, so every tally since runs with `--rounds 8`.
