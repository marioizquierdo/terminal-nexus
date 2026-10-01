---
name: feedback-round
description: Run one round of owner (Mario) feedback end to end — log his words item by item, add the round as a step on the current milestone, split the work across parallel agents in worktrees, merge and reconcile it, update the design documents, regenerate the screenshots, republish the playable page, and rewrite the pull request. Use whenever Mario sends playtest feedback, a pasted settings export or an Activity Logs export, or when a change is big enough to split across several agents. Read it before spawning your first worktree agent.
---
# A feedback round, start to finish

The exact procedure and its traps, in the order you meet them. What the practice is and why it works
is [`DEVELOPMENT.md`](../../../DEVELOPMENT.md) section 6 (log his words, turn them into steps, ask
him to feel a choice through an Experiment, settle each Experiment his export answers); how each
trap was found is in [`docs/history/lessons-learned.md`](../../../docs/history/lessons-learned.md).

## 0. Read what he sent, twice, and log it

The second reading finds what the first skipped. Look for: an item that contradicts a rule in the
design documents (say so, and reverse it by his words, not yours); an item that *sounds* built but
only half is (round 3's "keep scrolling while armed": the agent built "a click activates" and missed
the scrolling half); a **pasted settings export** (answers, not description: start the game with it,
`--settings "<text>"`); a **pasted Activity Logs export** (its header names the build and the filter,
each line is one event, oldest first: replay the moment with his settings and the keys it implies, and
read it against the event's description in `src/log/activity.ts`); an ambiguity to register rather
than guess ("press `b`": a letter, or the building's digit?). Screenshots and voice notes arrive as
ordinary text and pictures: log them the same way.

Log it before building: `docs/history/feedback/<date>-<round>.md`, one `### F<n>` per point, numbered
on from the last log, his words verbatim in a blockquote, then a status (**Built**, **Scheduled**,
**Open**, **Contested**) and, once done, one plain paragraph of what now happens. Add the round as a
step on the current milestone (`docs/milestones/`) with its definition of done as checkboxes, then run
`./scripts/check-repository.sh`. The `F<n>` numbers are for agents: in anything Mario reads, name the
request in a few words and link the log.

## 1. Split the work by files, not by feature

Group items that touch the same code into **one** agent; put items on different files in parallel.
Round 4 was three agents: placement and focus (reducer, menu rows), Settings and popups (overlay,
top bar), and the export adoption (defaults and deletions). Tell each agent, in its prompt:

- `git reset --hard <sha>` **first** — a worktree may start from `main`, not your branch. Pin the SHA.
- Read `AGENTS.md`, `CLAUDE.md`, `docs/system-design/ui-patterns.md` and the feedback items, whose quoted words are
  the spec.
- **Which files are its own and which belong to the other agents.** Ask for new Experiments as a block
  of their own at the end of `ALL_SETTINGS` in `src/build/all-settings.ts`, and never to reorder or
  reformat existing entries.
- **Do not edit `docs/game-design/`, `docs/system-design/`, `docs/milestones/`, `docs/history/`,
  `AGENTS.md` or `docs/pr-pictures/`.** It returns *proposed design-document text*, plain English,
  ready to paste. You apply it (one voice).
- Commit on the worktree branch with the attribution lines; do not push.
- Definition of finished: `npm run typecheck`, `npm test`, `npm run test:bun`,
  `./scripts/check-repository.sh`, and the changed flows looked at with the `playtest` skill.
- Report: SHAs, what changed and every decision in plain words, tests whose *meaning* (not just
  numbers) changed, proposed design-document text, and what is left or surprising.

## 2. Merge in order, verify, and send conflicts home

`git cherry-pick <sha>...` the smallest, most disjoint work first. When one agent's work conflicts in
more than three or four files, **do not resolve it yourself** — `SendMessage` the agent that wrote it,
give it the merged head SHA and a list of what landed meanwhile, and ask it to rebase and keep both
sides. It knows both intents; you do not. After every merge: typecheck, the full test run, and play
the flow yourself with `node scripts/playtest.mjs` — a merge that passes tests can still be wrong.
Clean each worktree (`git worktree remove --force`, `git branch -D`) as its agent finishes.

## 3. Update the documents

Apply the agents' proposed text to the design documents (`docs/system-design/` and
`docs/game-design/`; `ui-patterns.md` for any screen, menu or key) and to
`docs/milestones/open-questions.md`. In one pass:

- Move answered questions from `open-questions.md` to `docs/history/answered-questions.md`, and
  register new ones with a recommendation.
- Tick the step's checkboxes in its milestone file.
- Add one line to the timeline in `docs/history/README.md`.
- Settle each Experiment his export answers (his value becomes the default, its tier becomes *tuned*,
  the Experiment is deleted), as DEVELOPMENT.md section 6 says.
- Write the pull request description with the `pr-description` skill.

Nothing else is needed: there is no version to bump and no separate report. **When a rule is reversed, grep the old sentence**
(`grep -rn "never scrolls"`) — the same fact lives in several documents and the stale copy is always
the one you did not think of.

## 4. Pictures, page, pull request

- Make the pictures with the `playtest` skill into `docs/pr-pictures/` (one or two, one commit, linked
  by that commit's SHA; the branch's last commit removes the folder: the `pr-description` skill's
  "Pictures that display on a phone"). `node scripts/capture-build-phase-screenshots.mjs` writes the
  fuller set to `.playtest/screenshots/`; open the images and look at them before linking any. Prefer
  `--settings` over key counts to set an Experiment in a capture flow, because every added or removed
  Experiment shifts a "Down*6". A picture for the record goes in `docs/history/screenshots/` with a
  dated name and a row in its README.
- `bun scripts/build-web.mjs`, copy `dist/terminal-nexus-playtest.html` to your scratchpad, and
  publish it to the **same** artifact URL. The Artifact tool refuses until you have read the live
  version; read it, confirm nothing on the live page is missing from yours (a rebuild of the previous
  commit should equal it apart from the build time), then publish.
- Rewrite the pull request with the `pr-description` skill — **against `main`**, the whole change, not
  the last round. Run its Demo steps exactly as written; the last round's "Esc, then `s`" did not work
  from the map (it is "Esc, Esc, then `s`" there). The connector appends a second footer: read the body back.

## 5. Then wait, lightly

Subscribe to the pull request, set an hourly `send_later` check-in, and **do not start the next
step**. Stop the check-in when it merges, delete the trigger, and reset the branch:
`git checkout -B <branch> origin/main`.

## Traps worth naming

- **Time-based tests flake while agents build in parallel** (the machine load reached 10). Rerun the
  file alone; measure the frame cost before and after; never loosen a test to make a busy machine pass.
- **A bulk edit of a long register can eat it.** Assert the size of what you cut and stop if it is
  off; find a block's end with the *nearer* of `\n### ` and `\n## `.
- **A parser that treats unknown options as flags drops a new option silently.** Register every
  value-taking option (`src/cli/args.ts`) and test that it arrives.
- **A default that suits one input device can fail on another.** A 150 ms hold window is right for a
  fast OS key repeat and turns a slow one's first repeat into a tap. Say which device a number was
  tuned on (`docs/milestones/next-steps.md` records it).
- **Two agents will each write the helper neither owns.** Both agents of the Activity Logs round needed
  a colour-depth name for the logs and each wrote the same table in its own file. When agents share a
  need in a folder neither owns, write the helper yourself before splitting, or name in the prompts which
  agent writes it.
- **Tell an agent where its scratch output goes** (a `tmp/` in its worktree, never `/`), or it may write
  captures into the filesystem root.
- **Pictures made in a worktree stay in that worktree's `.playtest/`** (git-ignored). Ask the agent
  for the key script that reaches the state, and make the pictures yourself on the merged branch.
