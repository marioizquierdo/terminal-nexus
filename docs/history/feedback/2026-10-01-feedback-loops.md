# Feedback loops — the owner's direction (2026-10-01)

At the end of the menu spike Mario asked for a deep dive on a feedback pipeline: notes made inside the
game, routed to pull requests and issues, and an agent that sorts them. Claude wrote one, with a proposed
Milestone 13. He read it and asked for a simpler approach instead, in two messages (the first was cut
off mid-sentence and restated in the second). They continue
[`2026-09-30-menu-spike-followup.md`](2026-09-30-menu-spike-followup.md)'s numbering, on a pull request of
their own. Status values: **Built**, **Scheduled**, **Open**, **Contested**.

### F87 — A simpler approach: the claude.ai page and ordinary ways

> We can make a PR to add the Milestone 13. But now that I think of the scope in more detail, I think we
> need a simpler approach. … Collecting feedback is great, but the problem is actually larger than
> expected. Let's keep it focused on the claude.ai artifacts, because we already know that the game is
> playable on the terminal emulator, and the artifact can provide more powerful tools for debugging
> outside of the game. When I initially share the game with friends, I will do it through sharing
> claude.ai links. So, instead of trying to make an advanced system to allow anyone to provide feedback,
> let's just keep doing what we were doing before, and use more traditional ways.

> I think I can manage everything else manually for now, it will be enough. I can take screenshots and
> use voice when I'm describing feedback, and I can do that on the Github pull request or here on the
> Claude session directly. And when I want my friends to test the game, I can give them a build that has
> dedicated settings and logs they can export.

**Built.** No Milestone 13: the proposed milestone is withdrawn, and the deep dive is cut down to a short
note of what was parked and why (`docs/history/reports/2026-10-01-feedback-pipeline-parked.md`), with a
backlog entry.

### F88 — Feedback loops stated as part of the design

> Make sure the design intent for feedback loops is properly stated on our internal documentation. It
> should be a small section in our designs (e.g. ui-design.md) and some notes on workflow files (e.g. the
> PR writing skill, and any other relevant steps for the loop). The intent is clear, the current design
> already has a lot of this, and the technology we are using enables a lot of it as well. Don't be
> verbose, but make sure that feedback loops are part of our core design and cleanly explained.

**Built.** The interface rules (`docs/system-design/ui-patterns.md`) have a **Feedback loops** section: the game is built to be judged by
playing it, feedback travels the ordinary way, and three tools make it precise — Experiments (which feels
right?), the Activity Logs (what happened?) and the claude.ai page (both exports, and demo buttons). Goal
10 and the new-screen checklist point at it. `AGENTS.md` gained two sentences, one rule and one row in its
file map (after the documentation reorganisation made it short), `CLAUDE.md` one sentence, and the pull
request, feedback-round and playtest skills each say how they use it; `runtime.md` states the logging rule.

### F89 — Settings as the agent's way to ask during a demo

> Make sure that the settings mechanism is explicitly stated as a way for the coding agent to create
> quick feedback loops during a demo. This is mostly stated on the PR skill, but it could also be part of
> the code comments around the settings area, and used as example on design docs of how game builds can
> incorporate feedback loops.

**Built.** The settings module's header (`src/build/all-settings.ts`) now opens with it: the experiment tier
is how an agent asks the owner a question during a demo, with the worked example ("press `d`, set Battle
Round flash to 300 ms, tell me which you prefer, and paste the export"); the interface rules
and `AGENTS.md` use the same example.

### F90 — Activity Logs: a structured logger

> Implement a structured logger. All logs have a timestamp and event fields, and arbitrary json
> key/values (string, number, boolean, null). We can call this system Activity Logs. In that module, we
> will define each event type, described as: event (name), defaultLevel (the usual error, warn, info,
> debug), and props (object that defines each property name, type and description). This will form a
> schema for valid events, that is self-documented through each field description, which will be useful
> for coding agents working with those events. The logger interface looks like `activity.log(event,
> props)`, where props may include the "level" if they want to log at a different level than the event's
> defaultLevel. For now we can have a global "activity" logger that is used to track user telemetry
> activity, what errors they see, what interactions they do. The implementation should just record events
> in memory, with a size limit, after that size is reached, it will rotate the older events. I believe we
> already have a logger system for the grid, please check if we can reuse the same logging system or
> structure, or improve that one to use the same interface. There could be other loggers, system logger,
> and battle wave (pulse) logger. It's useful to separate a few loggers, some may log into files, have
> different levels, etc. This design is flexible, this is just my suggestion, but it is best that all
> logging system is coherent and standard.

**Built.** `src/log/` is one structured logger. Every event is declared in a schema — its name, default
level, a sentence on what it means, and each property's type and meaning — and `activity.log(event,
props)` accepts only what is declared, with `level` in the props to log at another level. Entries carry a
sequence number, a timestamp, the level, the event and plain JSON values, in memory, the oldest dropped
past 5,000. The clock is passed in, so tests read exact times; logging never throws. `grid`'s battle
report turned out to be a report written after a battle from its events, not a logger, so it now shares
the same level vocabulary (and still prints them in capitals in its columns) rather than the same
interface; turning its lines into schema events is the next step if anyone needs them structured. The
kernel and the match layer may never reach the logs (an architecture test). One global `activity` logger
records the title menu, the Build Phase and the shells.

### F91 — The Activity logs window, and agents preparing events and filters

> Add a new mechanism for feedback and explain it on the PR skill. Agents should selectively add logs to
> record specific interactions where they are specifically interested in receiving feedback. Please build
> a generic system where the game can record events, and then export them through the menu. The menu
> should have a new option for "activity logs" that opens a scrolling window with logs in reverse
> chronological order. This screen will be ugly, but it should have simple filtering mechanism and an
> export button.

> The activity logger is specially designed to track user interactions, and here is what matters for us
> right now. This should be another mechanism that coding agents can exploit for a specific PR when they
> are creating a demo, just like with settings, they can prepare events and filters so I or my tester
> friends can do something, go to the activity logs on the menu, and export the relevant logs.

**Built.** The game menu has **`[a] Activity logs`**. The window lists what was recorded, newest first, under
a Filter row (Left and Right: Interactions, Problems, Everything), with `[e] Export logs`; the highlighted
entry is shown whole underneath with what its event means. The list holds still while it is read.
Export copies what the filter shows, oldest first, with the build and the filter at its top (the
clipboard and `~/.terminal-nexus/activity-export.txt`; on the page, a box under the screen) and a message
says how many went where. The game logs commands, refusals, placements and removals, popups, settings
changes, the Pulse's start and result, each key's move, errors, and each screen's start. For a demo, an
agent adds its event and a filter at the top of the list — the window opens on it — and asks for the
export; the pull request skill says how, and `scripts/playtest.mjs --activity` shows what a run
recorded.

### F92 — The claude.ai page: exports and quick links

> Using the claude.ai artifact to manage exports and have quick links to relevant interactions is the
> other part of the coin. This should also be explicit on our feedback loop documentation, so coding
> agents can take advantage of this structure.

**Built.** The playtest page holds both exports in boxes under the screen, each with a Copy button, and a
row of **demo buttons**: `bun scripts/build-web.mjs --demos <file>` stamps in a pull request's demos — a
label, what to try, keys and settings — and a button starts the Build Phase there and says what to try.
The interface rules and the pull request skill tell agents to use them; `#keys=` and
`#settings=` still work.

### F93 — An About screen on the main menu

> Include a new section on the game's main menu: About. That should list me as the author of the game
> "Designed and developed by: Mario Izquierdo". Then point at the Github repository:
> https://github.com/marioizquierdo/terminal-nexus/ and include a section for contributions. Something like
> this "Terminal Nexus is an Open Source game designed to b modular, extensible and agent friendly. Feel
> free to submit issues, PRs, fork, or develop your own mods."

**Built.** The title menu has an About row above Exit (Exit's key moved from 4 to 5). It says: Terminal
Nexus; Designed and developed by: Mario Izquierdo; the repository's address; a Contributions heading with
his paragraph ("designed to be"); and which build is running, so a playtester can name it. Back, Esc, its
key and a click all work; it fits at 80 × 24, and the browser page's Menu mode shows it. A community link
is one line to add in one place (`src/menu/about.ts`) once he picks where updates go.

### F94 — Somewhere public to post updates

> I am still thinking what is the best way to manage a community. Maybe still too early for that, but I
> wish we could post updates somewhere public as we develop. I don't really like Discord. Maybe Github has
> a way to create a developer feed? Just investigate a little bit here, eventually we should add the main
> community page link on the About section.

**Open — recommendation made.** **GitHub Discussions with an Announcements category**: only maintainers can
start a post there and anyone can comment, people follow it by watching the repository, and each
category has an Atom feed; "Ideas" and "Show and tell" categories can come later for the community.
Releases (with their own feed) suit playable milestones, and an itch.io devlog suits players outside
GitHub later. Enabling Discussions is a repository setting only he can switch on; once it exists, its
link is one line on the About screen. The details are in `docs/history/reports/2026-10-01-feedback-pipeline-parked.md`.

### F95 — A richer playtest system, one day, from someone else

> In the future, we may be able to make a build on a system that allows to play the game, pause at
> anytime, and talk to the microphone while pointing at things with the mouse, perhaps even have a replay
> feature that can go back and show something in slow motion. I don't think we should build such system
> here 😛 But it would be good to keep an eye in case someone makes that system and we see easy ways to
> integrate with it. For now, I am already insanely happy with the ability to make playable builds as
> claude.ai artifacts and the ability of our software to incorporate ways to have quick feedback loops.

**Noted.** Kept in `docs/history/reports/2026-10-01-feedback-pipeline-parked.md` and in the backlog as something to watch for, with what this game already has
that such a system could plug into.

### F96 — A quality pass, and how an agent finds all this

> Make sure to do a general quality pass before publishing the new PR; review the general design
> documents, and audit the typical path that an agent performs to discover the functionality on this
> repo: starting from AGENTS.md, see if there are enough clues to find about the feedback loop design
> without being too verbose or distracting (those agents will already have plenty of context to worry
> about so we don't want to saturate them).

**Built.** Every document an agent reads on the way in now leads to the loop in a line or two: `CLAUDE.md`
(close the loop by playing), `AGENTS.md` (how we work, the rules, the file map), `DEVELOPMENT.md`'s feedback
loop, the interface rules' goals, checklist and feedback-loop section, the pull request, feedback-round and playtest skills, and the headers of the two code files
an agent edits to ask (`all-settings.ts`, `activity.ts`). Nothing long was added to the entry points. Every place
that listed the game menu or the title menu was found and updated. Typecheck, both test suites, the
repository checks and a run of the built page in a headless browser all pass.
