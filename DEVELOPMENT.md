# Developing Terminal Nexus

The practices manual: how to run, test and see the game, how work is planned and tried, how Mario's
feedback flows back in, and how a design change lands. Each section says what the practice is and why
it is shaped that way; the exact runnable procedures are the skills under `.claude/skills/`, linked
from the practice they serve. Nothing here is history; the dated record is `docs/history/`.

## 1. Toolchain and commands

Node 22.18 or newer, or Bun 1.3 or newer, run the TypeScript sources directly. **There is no build
step**, so relative imports carry explicit `.ts` extensions and the code stays inside erasable-syntax
TypeScript (no enums, no parameter properties). `tsconfig.json` is for type checking and editors.

```bash
npm install         # only type checking and the OpenTUI backend need it; the kernel has no dependency

npm run typecheck   # tsc --noEmit, then the browser page's one DOM file against tsconfig.web.json
npm test            # Node's runner over tests/*.test.ts
npm run test:bun    # the same suite under Bun, one file at a time
npm run check       # ./scripts/check-repository.sh — the repository validator

# grid — the engine, editor and replay tool. <map> is a .map.json path, suffix optional.
./bin/grid.ts scenarios/citizen-mirror-skirmish                       # watch (the default)
./bin/grid.ts scenarios/citizens-versus-ravels --glyphs unicode --capability truecolor
./bin/grid.ts scenarios/citizen-mirror-skirmish --headless --log-level info --ticks 120
./bin/grid.ts scenarios/citizen-mirror-skirmish --headless --events events.jsonl --json
./bin/grid.ts scenarios/citizen-mirror-skirmish --verify --runs 20   # same hashes every run?
./bin/grid.ts scenarios/citizen-mirror-skirmish --headless --turn 90 # jump straight to tick 90
npm run maps                                                          # every checked-in map

# terminal-nexus — the game. No map; straight to the menu.
./bin/terminal-nexus.ts
./bin/terminal-nexus.ts --build-phase                                       # the Build Phase (a temporary flag; --spike still works)
./bin/terminal-nexus.ts --build-phase --settings "$(pbpaste)"               # start from a pasted settings export
./bin/terminal-nexus.ts --build-phase --keys "n 1 1 Enter"                  # open already in a state

bun scripts/build-web.mjs                                             # the browser playtest page
```

`watch` options on either program: `--capability monochrome|color16|color256|truecolor`,
`--theme dark|light`, `--glyphs ascii|unicode`, `--tile-width 1|2` (2 needs 128 columns),
`--no-effects`, `--reduced-motion`, `--speed`, `--seed`, `--cosmetic-seed`, `--backend auto|ansi|opentui`,
`--save-log <file>`. ASCII and monochrome are the floor; everything above them is fidelity, never
information. `--capability` defaults to the best tier the terminal advertises; `--theme` to `dark`.

Pinned versions, re-checked rather than remembered:

| | Version | Note |
| --- | --- | --- |
| Node.js | 22.22.2 | Runs TypeScript with no build step from 22.18 |
| Bun | 1.3.11 | Same sources, same hashes |
| `typescript` | 7.0.2 | Type checking only |
| `@types/node` | 22.20.1 | Type checking only |
| `@opentui/core` | 0.5.6 | Terminal backend. Its native core loads under Bun, not under Node |
| `gifenc` | 1.0.3 | Dev only: GIFs of a scripted playtest |
| `pngjs` | 7.0.0 | Dev only: reads Chromium's PNGs for GIFs and "is this shot unchanged?" |

The `grid` skill (`.claude/skills/grid/SKILL.md`) has the full command line, the report grammar and
how to author a map.

## 2. Testing

Run both runtimes before every push. Node's runner takes the whole glob at once and isolates each
file; `bun test` runs one file at a time through `scripts/run-tests.sh`, because its `node:test` shim
rejects a test registered while another file is running and lacks `t.skip()`. Cross-runtime agreement
is the only cheap test of the serialization and iteration assumptions many runs on one runtime never
catch.

What the suite proves, by area, is in [`docs/system-design/testing.md`](docs/system-design/testing.md):
determinism (identical hashes across runs and runtimes, one call equals tick by tick, the kernel
imports no renderer and calls no clock), the Grid's occupancy and collision masks, every rule with a
named scenario, structured-cell snapshots across backends, the terminal lifecycle through one
disposer, and the browser page held to the terminal's characters, colours and keys.

Things that bite:

- **Bun has a 5000 ms per-test timeout; Node does not.** A test whose cost scales with the fixture
  count (`for (const name of scenarioFiles())`) creeps up on it silently. Give it an explicit
  `{ timeout: 120_000 }` (third-argument form; identical under Node). Run the Bun suite once before
  adding a scenario file.
- **Timing tests flake under load.** With agents building in parallel the frame-budget tests have
  failed once and passed alone. Re-run the file alone and measure before and after; never loosen a
  test to make a busy machine pass.
- **A red assertion in the live-loop test looks like a hang.** `tests/build-lifecycle.test.ts` leaves
  the terminal loop running when an assertion throws, so Node never exits. Run it alone with
  `node --test --test-timeout=30000`.
- **Silent parsers.** An unknown command-line option is treated as a flag. Register every
  value-taking option in `src/cli/args.ts` and test that it arrives.

The validator, `./scripts/check-repository.sh`, is the cheapest reviewer and runs in CI. It checks
the required files, that exactly one milestone is current and names its step, that every question
id cited resolves and every open question has a recommendation, that only RULE, GUIDANCE and IDEA
exist as markers, that retired words stay retired outside `docs/history/`, and that links resolve,
fences balance and the tree has no whitespace errors. Add a check whenever you catch yourself
remembering a rule instead of relying on one.

## 3. Seeing a change

A passing test says nothing about spacing, density or where the eye goes. Look.

**The scripted playtest** (`node scripts/playtest.mjs`, the `playtest` skill) presses keys on the Build
Phase screen without a terminal and keeps what the screen showed after every key: text for every step
in `.playtest/<name>.txt`, PNGs on request (`--png final`, `--png all`), an animated GIF of the whole
sequence (`--gif`). Keys go through the real keyboard and mouse adapters as the bytes a terminal
sends, one at a time, and every frame comes from the composer the live screen uses, so there is no
capture race. `--settings "<text>"` starts from a pasted export; `--activity [filter]` prints what the
run recorded in the Activity Logs, as the game's window would export it; `--size`, `--capability`,
`--theme` and `--glyphs` set the terminal. The key names (`Down`, `S-Left`, `Name*N`, `Name~MS`, `wait~MS`,
`click:X,Y`, `Right/release`) are at the top of `src/playtest/keys.ts`.

```bash
node scripts/playtest.mjs --keys "Down Down Space*4"                       # every step's status, then the final screen
node scripts/playtest.mjs --keys "Down Down Space*4" --gif --png final --name hatchery-run
node scripts/playtest.mjs --keys "n 2 s s wait~1000*20"                    # a Pulse, twenty seconds in
```

Output goes to `.playtest/`, which git ignores. Pass `--out docs/screenshots` only for an image a pull
request will show, and keep a GIF under about 1 MB (`--scale 1` quarters it).

**Screenshots of the real terminal** (`node scripts/capture-screenshots.mjs`, the `grid-screenshots`
skill) drive `grid` inside a tmux pseudo-terminal, so the ANSI backend takes the path a person gets,
pause at an exact tick and render the pane to a PNG through the Chromium already present for
Playwright. `scripts/capture-build-phase-screenshots.mjs` covers the Build Phase at the sizes that matter
(80 × 24, 104 × 32, 128 × 24, and 79 × 24 for the resize gate); most of its shots are composed
in-process through the scripted playtest, a few stay on tmux because the terminal path is what they
prove. An unchanged shot is not rewritten: every image records a hash of the page it came from, so a
regeneration touches only the pictures a change shows up in. Set an Experiment by name with
`--settings`, never by counting rows.

**The browser playtest page** (`bun scripts/build-web.mjs`, one self-contained HTML file) runs the
real menu, Build Phase and Pulse through a stand-in terminal, painted on a canvas, with an on-screen
key bar for the keys a phone lacks. It is a development tool, never a platform: the build fails if
anything the page reaches imports a Node-only module, and a terminal at 80 × 24 stays the acceptance
target. It cannot show raw keyboard mode, terminal cleanup, signals, a real terminal's own key
encodings, the OpenTUI backend or frame timing. Published as a private claude.ai page on a pull
request only when a change must be played to be judged. Beside the screen it has a text box for each
export (the settings, the Activity Logs), and `bun scripts/build-web.mjs --demos <file>` adds a button
per demo, each starting the Build Phase from a key script with given settings and saying what to try
(`scripts/build-web.mjs` describes the file; a bad key script fails the build; keep a pull request's
file in `scripts/demos/` until its question is answered).

**The log is the feedback loop for the kernel.** `grid --headless` writes fixed-column lines to one
stream, `[tick] LEVEL kind subject [-> object] detail...`, at `ERROR`, `WARN` (default), `INFO`,
`DEBUG` or `TRACE`, closed by a `report` line with the outcome, losses and hashes. It grows by adding
kinds, never by reshaping columns. When a test needs structure rather than a story, assert on
`--events` JSONL instead. The Build Phase and the menus have their own record, the **Activity Logs**:
one structured logger (`src/log/`) whose events are declared in `src/log/activity.ts` with a default
level and typed, described properties, and which the game menu's `[a] Activity logs` lists newest
first, filters and exports (the clipboard, and `activity-export.txt` beside the settings export).
`node scripts/lib/key-echo.mjs` prints exactly what each key sends in the
terminal it runs in; `node scripts/probe-modified-keys.mjs` surveys Shift+Arrow and friends. Measure a
terminal before trusting a remembered escape sequence.

## 4. Planning: milestones and steps

Work is planned in **milestones**, tracked in `docs/milestones/`. A milestone answers one question
about the game ("can a player start the Pulse, watch it resolve, and land in the next Build Phase?")
and is small enough to be played and judged as a whole. Its file holds:

- the question, and what it depends on (named milestones, accepted);
- its **steps**: a checkbox list, each one pull request's worth, each with a definition of done in
  plain words;
- its status (`PLANNED`, `CURRENT`, `COMPLETE`) and, while current, its **current step**.

`docs/milestones/README.md` is the sequence, the build order and the reason for it. Only one
milestone is current, and the validator holds the index and the file to the same answer. Milestone
numbers are identities, never an order: read the build-order column.

**A session takes one step.** It starts from the current step, builds it, proves it (tests, a
playtest, pictures), opens a pull request and stops. A step is done when its pull request is merged
and Mario has played it; ticking the box and adding one line to `docs/history/README.md` is the whole
bookkeeping. The next step waits for his word; "time remains" is never a reason to start it. A
milestone is complete when its steps are, and its file moves to `docs/history/milestones/`.
Promoting the next milestone is Mario's call, recorded in the index.

What belongs to no step goes in `docs/milestones/next-steps.md`: what waits on Mario, small carry-over,
the cleanup queue. Delete an item when it is done. Work no milestone owns yet is
`docs/milestones/backlog.md`.

The milestone sequence builds the first level of the campaign one system at a time, the match
experience before the content, because a played loop early is worth more than any one part being
good. Prefer the honest, connected, ugly step over the beautiful one that dead-ends; playing the whole
thing is what says which part deserved the polish.

## 5. Spikes

A **spike** is a small, throwaway build that answers one question reading cannot: does this
architecture absorb fourteen new unit designs, is the menu clearer when every row does something on
the map, can the page run in a browser at all. Use one when the design documents disagree, when a
recommendation was written before the thing existed, or when the cheapest way to settle an argument
is to build both sides.

- Keep it to the smallest thing that answers the question, on its own branch, with the question
  written at the top of the pull request.
- Its code is disposable by default. Promote what survives into the real place with its tests;
  delete the rest rather than leaving a second way of doing things.
- Its findings are the deliverable. The pull request description carries them; when they need more
  than a page (a measurement series, a design the next milestone builds on), write a report in
  `docs/history/reports/` named by date and subject and link it. Put surprises and discarded
  approaches first; that is the part the next reader wants.
- If it changes the design, change the design document in the same pull request (§7).

The unit-architecture spike and the menu spike in `docs/history/reports/` are the pattern.

## 6. The feedback loop

Mario plays merged builds, several at a time, and sends long, specific feedback, sometimes with a
pasted **settings export**. This is the most valuable input the project gets; the loop is built to
turn it around within hours. The exact procedure is the `feedback-round` skill; the shape:

1. **Log his words first**, item by item, in `docs/history/feedback/<date>-<round>.md`: a numbered
   item per point, his words in a blockquote, then its status (Built, Scheduled, Open, Contested) and,
   once done, a plain paragraph of what now happens. Nothing is dropped silently. Read the message
   twice; the second reading finds the half an agent would otherwise miss.
2. **Turn it into steps** on the current milestone, split across agents by files (not by feature),
   each agent in its own worktree from a pinned commit, each owning files the others do not touch.
3. **Ask him to feel a choice through an Experiment.** Settings (Esc on the menu, then `s`) lists the
   player's own saved settings and, below them under `d`, the **Experiments**: live-editable, never
   saved, each naming the question it serves. Every setting is declared once with its tier in
   `src/build/all-settings.ts`: *player* (shown and saved), *experiment* (shown for his playtests,
   exported) or *tuned* (a constant). When a choice is his to feel rather than read about, ship both
   answers behind an Experiment defaulting to the recommended one and ask him in the pull request, in
   plain words, to flip it: "press `d`, set Battle Round flash to 300 ms, and tell me which you
   prefer." A new behaviour whose worth is in doubt ships with an on/off Experiment.
4. **Ask what happened with an Activity Logs filter.** When the question is not a feeling but an
   interaction ("what did the taps do when it felt slow?"), declare an event where it happens and a
   filter for it at the top of `ACTIVITY_FILTERS` in `src/log/activity.ts`, check with
   `playtest.mjs --activity` that a flow logs it, and ask him to play, open Esc then `a`, export and paste
   it. Remove both once answered, as an Experiment is.
5. **His export is the answer.** Export settings (`e` in Settings) copies every setting and
   Experiment as `name = value` text, changed Experiments first; he pastes it into the pull request.
   Reproduce exactly what he saw with `--settings "<text>"` on the game, the playtest script or
   `#settings=` on the browser page. Then settle each Experiment it answers: his value becomes the
   default, its tier becomes *tuned* with who chose it and when, and the Experiment is deleted. A few
   stay longer (a number that depends on the player's keyboard, placeholder content) or graduate into
   real Settings.
6. **Size the Demo to the change.** A code block or nothing when nothing shows on screen; screenshots
   for a look; a GIF for movement or timing; a playable page only when it must be played. The
   `pr-description` skill has the shape, phone-readable, leading with what the player will see.
7. **Rewrite the pull request against `main`** after every round, the whole change, not the last
   round; then wait lightly, and do not start the next step.

What four rounds taught is in `docs/history/lessons-learned.md`.

## 7. Changing the design

The design documents (`docs/game-design/`, `docs/system-design/`) describe the current design.
Every statement is **RULE** (built and depended on; the code implements it and a named test holds it),
**GUIDANCE** (the recommended default; anything unmarked) or **IDEA** (a sketch nothing depends on).

- **Follow a RULE.** Changing one is a design change: the pull request changes the sentence, the code
  and the test together, says so in plain words for Mario, and names what the change costs.
- **Depart from GUIDANCE when the work shows better**, and say why in the pull request.
- **Build an IDEA only when a milestone step asks for it.**
- A document describes; it does not schedule. That something is described is never a reason to
  build it.

**What a session decides alone**: reversible module boundaries, names, local data shapes, test
organisation, diagnostics, fixtures, comparison modes, simplifying or discarding code built only to
answer a step's question, and reporting that the favoured answer failed.

**What a session never does alone**: promote a hypothesis into a RULE without it being built and
played; absorb a later milestone because the architecture makes it convenient; build a generic
framework before two concrete uses reveal its contract; treat a passing test as proof of how
something feels; hide a blocker by changing a pinned runtime, fixture or target; add a secret, a
service or an external write.

**When the design does not answer you**, in this order: decide it yourself if it is reversible; make
it observable (an Experiment, a toggle, a side-by-side fixture) so Mario can look at both answers;
register it in `docs/milestones/open-questions.md` if it is genuinely his call, with the question in a
sentence, why it blocks, the options, their costs and **a recommendation** (the validator rejects an
open question without one); then keep working on everything the answer does not touch. Stop entirely
only when proceeding under any assumption would waste the work. Question ids are permanent and never
reused; an answered question moves to `docs/history/answered-questions.md` with the decision and the
document that now owns it.

**When a rule is reversed, grep the old sentence.** The same fact tends to live in a design document,
the interface patterns, a test name and a feedback log, and the stale copy is always the one you did
not think of. One home per fact; everything else links.

**Retired words.** "Canon", "gate", "evidence" and the old folder paths are retired outside `docs/history/`; the validator rejects them. <!-- stale-ok -->
Say "the design documents", "milestone step", "screenshots", "in scope".

## 8. Writing for Mario

Everything a person reads — pull requests, commit messages, chat replies, any document written for
Mario rather than for the next agent — says **what the thing is**, not where it is filed.

- Bad: "per the engine document's section on match structure, proceeding under the recommendation
  for the open question about Nexus drafts."
- Good: "the Nexus offers the player a small choice of upgrades each round; nobody has designed what
  those are yet."

He does not have section numbers, question ids or feedback item numbers memorised and should not
have to; those index things for the next agent, and a reply that says "item 87" has failed. A sentence he
has to look up before he can judge it has failed. Name the rule, decision or idea in plain English;
if the source matters, put it in parentheses after the idea. Define a project word (milestone step,
Experiment, Recall) the first time it appears in anything he reads, or use an ordinary word. Say what
no person has tried yet and what is known to be broken. Internal shorthand is fine where the audience
is the next agent: a note in a design document for the next session, a code comment.

Interface work has its own rulebook: read [`docs/system-design/ui-patterns.md`](docs/system-design/ui-patterns.md),
its goals and its checklist for a new screen, before changing a screen, a menu, a popup, an effect or
a key; when two rules disagree, the goals decide; a change that adds, bends or retires a pattern
updates that document in the same pull request and names the pattern so the next screen reuses it.

## 9. Environments

- **Local checkout.** Any editor and terminal with the pinned toolchain. The validator needs Bash,
  Node and standard POSIX tools.
- **GitHub Codespaces.** `.devcontainer/devcontainer.json` supplies an editor, a shell, Node and the
  GitHub CLI.
- **Claude Code on the web.** An isolated task environment that works on a branch, verifies, and
  returns a pull request; [`docs/claude-web.md`](docs/claude-web.md) has the setup. Measured there:
  Bun and Node are present, Deno is not.

Update `README.md`, this file, the dev container, CI and the agent instructions together whenever a
development command changes.

## 10. Licensing

Code and technical work are Apache-2.0; lore and creative work are CC BY-SA 4.0. See `README.md`,
`NOTICE` and `CONTRIBUTING.md` before importing third-party code, art, fiction, fonts or assets.
