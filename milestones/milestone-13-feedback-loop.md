# Milestone 13 — Feedback Loop

**Document role:** Milestone tracker — a note made inside the game, with everything needed to replay it, reaching the people and agents who act on it
**Status:** GATED
**Depends on:** Milestone 6 (a played loop worth reporting on). 13A-13C need nothing else; 13D also needs a build Mario would hand a friend, at a stable link
**Updated:** 2026-09-30
**License:** Apache-2.0

> **A proposal, not yet placed in the build order.** Mario, 2026-09-30: "point somewhere in the
> interface, to take a screenshot and create a feedback artifact that includes some context metadata
> from the app itself, and attach a comment … bundle a bunch of feedback artifacts as if it were a
> shopping cart … post back to the Github PR … or if it is from a live build, a new Github issue …
> The next step is to build a feedback pipeline that I will use myself, then expand to playtesters,
> and eventually expand into the full player base." The reasoning, the options and the risks are in
> [`../docs/feedback-pipeline.md`](../docs/feedback-pipeline.md); this file is only the plan. It gains
> authority when Mario places it in [`README.md`](README.md)'s build order and promotes it.

## 1. Question

Can a player point at something in the game, say what they think about it, and have it arrive where
the people and agents who act on it will see it? It should arrive as a pull request comment, a GitHub
issue or a file, carrying enough to **replay exactly what they saw**. And can an agent sort those
reports against the canon — fixing what it may, asking Mario about what it may not — without anyone
handing it the project?

## 2. Gates — small, in order, each closable on its own

- **13A — Notes in the game.**
  - **Making a note.** One key on every screen (Mario picks it) pauses the presentation and puts a
    pointer over the whole screen. Enter pins it to a cell and a text box takes the comment; the
    web page's box is a real text box, so a phone or a laptop can dictate into it.
  - **What a note holds.** The comment; the target by name, from the same hit-test a click uses; the
    frame as text; the input since the screen opened, in the playtest key notation with its timing;
    the changed settings; the build stamp; the state's fingerprint and the presentation time; the
    terminal's size and abilities.
  - **The basket.** The top bar shows the count, and the game menu's `Feedback (n)` lists the notes,
    deletes one and previews the report.
  - **The report.** Markdown with a fenced data block, written to a file and copied: OSC 52 and a file
    in a terminal; the clipboard, a download and a text box on the web page.
  - **The agent's side.** `scripts/playtest.mjs` replays a note from its report. The feedback-round
    skill reads reports.
  - **Done when:** a note made in a terminal and one made on the web page each replay to the same
    fingerprint, and a report pasted into a pull request comment reads well on a phone.
- **13B — The session log.**
  - **What it records.** Named events at warn, info and debug, in a bounded buffer: commands and their
    answers, popups, the Pulse's start and result, the terminal's detected abilities, slow frames,
    caught errors.
  - **Where it goes.** `--log <file>` writes it; a report includes warn and info by default.
  - **What it may not do.** It is presentation-side only, and a test asserts that nothing in the rules
    reads it. It records no paths, user names or environment beyond the terminal's own variables.
- **13C — Routing and the triage spec.**
  - **One build stamp.** The terminal and the web page stamp builds in one shape: commit, branch, local
    changes, pull request.
  - **A report names its destination** from that stamp: a pull request build goes to that pull
    request; a `main` build to a new issue through `.github/ISSUE_TEMPLATE/feedback.yml`, opened in the
    reporter's browser with the report on the clipboard; anything else to a file. A small
    `scripts/send-feedback.mjs` posts a file with the user's own `gh` login. The game itself holds no
    token and opens no connection beyond the browser link.
  - **`specs/feedback.md`, a focused canon document:**
    - the report format and its version;
    - the closed list of triage outcomes, and for each what an agent may do and what waits for Mario;
    - the ladder of who may direct — Mario directs, everyone else informs;
    - report text as data;
    - privacy.
  - **Tried by hand.** A session runs the triage on Mario's own reports for at least two rounds; the
    spec changes where it was wrong.
- **13D — The triage routine and invited playtesters.**
  - **A live build.** A playtest page built from `main`, rebuilt on every merge, at a stable link.
  - **Who may report.** An allowlist of invited playtesters, and a path for those without a GitHub
    account (the file, or the page shared with them).
  - **The routine.** A scheduled Claude Code routine sweeps new `feedback` issues every hour. It
    validates each, replays it at its own commit and attaches the frame and a GIF. It sorts each into
    one outcome, then acts within that outcome's limits: a draft pull request whose first commit is
    the note as a failing test, an Experiment, an open question with a recommendation, or one
    clarifying question. It replies in plain words.
  - **The digest.** A weekly page for Mario: counts, fixes waiting for his merge, Experiments to feel,
    design questions, and notes counted per part of the screen.
  - **Limits.** The routine may comment and open draft pull requests, and nothing else. A budget per
    report and per day; a first-time reporter waits for a person's approval.

## 3. Explicitly not this milestone

- **Public reporting** for every player: a public endpoint, moderation, spam and abuse handling, a
  privacy policy. Named, not planned; it needs 13D's experience first.
- **Usage statistics of any kind.**
- **Audio recording:** dictation is the operating system's.
- **Image capture:** frames are text; pictures are rendered by the agent.
- **The kernel's full replay format.** A note's recorded input is a reproduction for its own build,
  not a saved-game format; the real replay format stays in `../specs/backlog-pulse-completion.md`.
- **Network code inside the game.**
- **Merging by an agent.**
- **Routing a report to a mod's own repository.** Named; it waits for mods to exist.

## 4. Acceptance

Automated:

- 13A's round trip: every note in a set of recorded sessions replays to its fingerprint, in Node and in
  the browser build.
- 13B's architecture test: nothing in the rules or the Build Phase's state reads the log.
- 13C's report parser rejects a malformed or oversized report with its reason.
- 13D's routine, run against a set of prepared issues (one of each outcome, one carrying hidden
  instructions), sorts each correctly and does nothing outside its limits.

Owner:

- Mario makes notes during a real playtest, on his laptop and on his phone, and a round of feedback
  goes through the loop without a hand-copied export or picture.
- For 13D, at least one friend's report arrives and is answered.

## 5. Questions for Mario (registered in `../specs/open-questions.md` when the milestone is promoted)

- **The note key.** `!` or backtick are free on every screen today; recommended `!`.
- **Placement in the build order.** Recommended: 13A-13C right after Milestone 6, 13D when a build is
  worth a friend's time.
- **How his own reports travel first.** Recommended: pasted into the pull request, which works
  everywhere. The alternative is a button on the claude.ai page that saves reports for the session to
  read.
- **Who the first invited playtesters are,** and whether they have GitHub accounts.
