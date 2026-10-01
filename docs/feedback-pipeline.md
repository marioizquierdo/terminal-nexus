# Terminal Nexus — feedback beyond the playtest page (parked)

**Document role:** What was considered for collecting feedback at scale, why it is parked, and what to watch for
**Status:** WORKING — parked by the owner on 2026-10-01; the feedback loop that is built is `docs/ui-patterns.md` section 15
**Updated:** 2026-10-01
**License:** Apache-2.0

## What was proposed, and why it is parked

At the end of the menu spike (2026-09-30) Mario asked for a deep dive on a feedback pipeline. He wanted
notes made inside the game — point at something, say why, collect a few — sent to the pull request, a
GitHub issue or a file. And he wanted an agent on GitHub to sort those reports against the canon: first
his own, then friends', then any player's. The proposal had in-game notes carrying the recorded keys, a
session log, routing by build, a triage spec, and a scheduled triage agent, as a Milestone 13.

He chose a simpler approach (feedback F87): "the problem is actually larger than expected. Let's keep it
focused on the claude.ai artifacts … let's just keep doing what we were doing before, and use more
traditional ways." Screenshots and voice go into the pull request or the session; friends get a
claude.ai link to a build with dedicated settings and logs they can export. Milestone 13 was withdrawn.

What was built instead (feedback F88-F92) is section 15 of `docs/ui-patterns.md`:

- Experiments for what to feel;
- the Activity Logs (`src/log/`) for what happened;
- the playtest page, holding both exports and demo buttons.

## What to watch for

Mario (F95): "a system that allows to play the game, pause at anytime, and talk to the microphone while
pointing at things with the mouse, perhaps even have a replay feature that can go back and show something
in slow motion. I don't think we should build such system here … But it would be good to keep an eye in
case someone makes that system and we see easy ways to integrate with it."

If one appears, this game already has what such a system would need to plug into:

- **Exact replays.** A seeded kernel, a Build Phase with no clock, and every input a named command. The
  playtest key notation records keys, their timing and clicks (`Right~250`, `click@40,7`), and `--keys`
  / `#keys=` replay them, so any moment is a build, a settings export and a key script.
- **Screens as text.** The engine draws a grid of styled cells before any terminal sees it, so a moment
  can be read, diffed or redrawn in slow motion from presentation time, since effects are pure
  functions of time.
- **Pointing with a meaning.** A click resolves to what it landed on (a menu row, a tile, a popup row),
  so a pointer on screen can be named.
- **A structured record.** The Activity Logs' events are declared with typed properties and export as
  one line each.

## Somewhere public to post updates (F94)

Mario would like to post development updates somewhere public, and does not like Discord. A light
investigation (2026-10-01):

- **GitHub Discussions, with an Announcements category** — recommended. It sits next to the code, and in
  an Announcements category only maintainers can start a discussion while anyone can comment. People
  follow it by watching the repository, and each category has an Atom feed for feed readers. Later,
  "Ideas" and "Show and tell" categories give the community a place too. Enable it in the repository's
  Settings → General → Features → Discussions; once it exists, its link goes on the About screen
  (`src/menu/about.ts`).
- **GitHub Releases** for playable milestones: release notes and a link to that build's page. Releases
  have an Atom feed of their own (`/releases.atom`).
- **Later, for players outside GitHub:** an itch.io page with devlogs; followers get them in their feed
  and by email. Publishing a build there would be a distribution decision for Mario, since the playtest
  page is a development tool, not a platform (`specs/engine.md` 10.2).
