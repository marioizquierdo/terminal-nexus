---
name: feedback-round
description: A feedback round, end to end: log Mario's words, schedule the work as a milestone step, split it across parallel worktree agents, merge, update the design documents, remake the pictures and playable page, rewrite the pull request. Use when Mario sends playtest feedback, a pasted settings export, an Activity Logs export or playtest note files, and before spawning the first worktree agent of any change big enough to split.
---

# A feedback round, start to finish

This is the procedure and its traps. The practice and why it works are in [`DEVELOPMENT.md`](../../../DEVELOPMENT.md),
"The feedback loop" (log his words, turn them into steps, ask him to feel a choice through an Experiment, settle each
Experiment his export answers). How each trap was found is in
[`docs/history/lessons-learned.md`](../../../docs/history/lessons-learned.md).

## 1. Read what he sent, twice, and log it

Done when every item is in the log with a status, the round is a step on the current milestone, and
`./scripts/check-repository.sh` passes.

The second reading finds what the first skipped. Look for:

- An item that contradicts a rule in the design documents: say so, and reverse the rule by his words, not yours.
- An item that *sounds* built but is half built ("keep scrolling while armed" read as only "a click activates"): list
  each half it names.
- An ambiguity to register rather than guess ("press `b`": a letter, or the building's digit?).
- A **pasted settings export**: answers, not description. Start the game with it (`--settings "<text>"`).
- A **pasted Activity Logs export**: its header names the build and the filter, each line is one event, oldest first.
  Replay the moment with his settings and the keys it implies, and read it against the event's description in
  `src/log/activity.ts`.
- **Playtest notes** (`*.note.json`, from `~/.terminal-nexus/notes/` or pasted from the browser page's text box; `!`
  writes one on any screen). A note is the moment itself (`src/cli/notes.ts`): its `line` is his words (log them
  verbatim), `screen` what he saw as text, `activity` the last events oldest first, `pressed` every named command since
  the round opened with milliseconds. Open it with `node scripts/playtest.mjs --note <file> --print final`; add
  `--keys` to go on from there and `--png final` for the picture the log quotes. `terminal-nexus --note <file>` opens it
  live. Only the build that wrote it (`build`) promises to replay it, so open it on that commit when the rules have
  moved.
- Screenshots and voice notes arrive as text and pictures: log them the same way.

The log is `docs/history/feedback/<date>-<round>.md`: one `### F<n>` per point, numbered on from the last log, his words
verbatim in a blockquote, a status (**Built**, **Scheduled**, **Open**, **Contested**) and, once done, one plain
paragraph of what now happens. The milestone step (`docs/milestones/`) carries its definition of done as checkboxes.
The `F<n>` numbers are for agents: anything Mario reads names the request in a few words and links the log.

## 2. Split the work by files, not by feature

Done when every item sits with exactly one agent and no file belongs to two agents.

Group items that touch the same code into one agent; items on different files go in parallel. An agent's prompt carries:

- `git reset --hard <sha>` first, with the SHA pinned: a worktree may start from `main`, not your branch.
- Read `AGENTS.md`, `CLAUDE.md`, `docs/system-design/ui-patterns.md` and the feedback items, whose quoted words are the spec.
- Which files are its own and which belong to the other agents. New Experiments go in a block of their own at the end
  of `ALL_SETTINGS` in `src/build/all-settings.ts`, with existing entries left in order and format. When agents share
  a need in a folder none owns, write the helper yourself before splitting (two agents once wrote the same
  colour-depth table), or name the one agent that writes it.
- Design documents (`docs/game-design/`, `docs/system-design/`, `docs/milestones/`, `docs/history/`, `AGENTS.md`,
  `docs/pr-pictures/`) are yours: the agent returns proposed text in plain English, ready to paste, and you apply it
  in one voice.
- Scratch output goes in a `tmp/` in its worktree, since a capture can otherwise land in the filesystem root. Pictures
  made in a worktree stay in its git-ignored `.playtest/`, so the agent returns the key script that reaches the state
  and you make the pictures on the merged branch.
- Commit on the worktree branch with the attribution lines; never push.
- Definition of finished: `npm run typecheck`, `npm test`, `npm run test:bun`, `./scripts/check-repository.sh`, and the
  changed flows looked at with the `playtest` skill.
- Report: SHAs, what changed and every decision in plain words, tests whose meaning (not just numbers) changed,
  proposed design-document text, what is left or surprising.

## 3. Merge in order, verify, and send conflicts home

Done when every agent's work is on the branch, typecheck and both test runtimes are green, and you have played the
changed flows with `node scripts/playtest.mjs`: a merge that passes tests can still be wrong.

`git cherry-pick <sha>...` the smallest, most disjoint work first. A conflict across more than three or four files goes
back to the agent that wrote it (`SendMessage`, with the merged head SHA and what landed meanwhile, asking it to rebase
and keep both sides): it knows both intents. Remove each worktree as its agent finishes (`git worktree remove --force`,
`git branch -D`).

## 4. Update the documents

Done when each of these holds:

- The agents' proposed text is in `docs/system-design/` and `docs/game-design/` (`ui-patterns.md` for any screen, menu
  or key).
- Answered questions moved from `docs/milestones/open-questions.md` to `docs/history/answered-questions.md`; new ones
  registered with a recommendation.
- The step's checkboxes are ticked in its milestone file.
- "Waiting on Mario" in `docs/milestones/next-steps.md` retires the asks this round answered or made stale and stays at
  five or fewer, each opening with Play, Watch, Decide or Do (the validator checks both).
- One line is added to the timeline in `docs/history/README.md`.
- Each Experiment his export answers is settled (DEVELOPMENT.md, "The feedback loop").
- A reversed rule has its old sentence grepped (`grep -rn "never scrolls"`): the same fact lives in several documents
  and the stale copy is the one you did not think of.

There is no version to bump and no separate report.

## 5. Pictures, page, pull request

Done when the pictures are looked at, the playable page is republished, and the pull request body is read back from
GitHub.

- Make the pictures with the `playtest` skill into `docs/pr-pictures/` (one or two, one commit, linked by that commit's
  SHA; the branch's last commit removes the folder: the `pr-description` skill, "Pictures that display on a phone").
  `node scripts/capture-build-phase-screenshots.mjs` writes the fuller set to `.playtest/screenshots/`; open every
  image before linking it. Set an Experiment in a capture flow with `--settings`, since every added or removed
  Experiment shifts a key count like "Down*6". A picture for the record goes in `docs/history/screenshots/` with a
  dated name and a row in its README.
- `bun scripts/build-web.mjs`, copy `dist/terminal-nexus-playtest.html` to your scratchpad, and publish it to the same
  artifact URL. The Artifact tool refuses until you have read the live version: read it, confirm nothing on the live
  page is missing from yours (a rebuild of the previous commit equals it apart from the build time), then publish.
- Rewrite the pull request with the `pr-description` skill, against `main`, the whole change. Run its Demo steps
  exactly as written, because a step like "Esc, then `s`" can be wrong from the map ("Esc, Esc, then `s`" there).

## 6. Then wait, lightly

Subscribe to the pull request, set an hourly `send_later` check-in, and leave the next step unstarted. When it merges,
stop the check-in, delete the trigger, and reset the branch: `git checkout -B <branch> origin/main`.

## Traps

- **Time-based tests flake while agents build in parallel** (machine load reached 10). Rerun the file alone and measure
  the frame cost before and after; a busy machine is never a reason to loosen a test.
- **A bulk edit of a long register can eat it.** Assert the size of what you cut and stop if it is off; find a block's
  end with the nearer of `\n### ` and `\n## `.
- **A value-taking option missing from `VALUE_OPTIONS` (`src/cli/args.ts`) is read as a flag and its text dropped.**
  Register every new one and test that it arrives.
- **A default tuned on one input device can fail on another.** A 150 ms hold window suits a fast OS key repeat and
  turns a slow one's first repeat into a tap. Say which device a number was tuned on (`docs/milestones/next-steps.md`
  records it).
