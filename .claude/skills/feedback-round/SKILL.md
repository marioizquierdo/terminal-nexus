---
name: feedback-round
description: Run one round of owner (Mario) feedback end to end — log his words item by item, add the round as a step on the current milestone, split the work across parallel agents in worktrees, merge and reconcile it, update the design documents, regenerate the screenshots, republish the playable page, and rewrite the pull request. Use whenever Mario sends playtest feedback or a pasted settings export, or when a change is big enough to split across several agents. Read it before spawning your first worktree agent.
---

# A feedback round, start to finish

This is the exact procedure and its traps, in the order you meet them. What the practice is and why
it works is the feedback loop in [`DEVELOPMENT.md`](../../../DEVELOPMENT.md); how each trap was found
is in [`docs/history/lessons-learned.md`](../../../docs/history/lessons-learned.md).

## 0. Read what he sent, twice

The second reading finds what the first skipped. Look for: an item that contradicts a rule in the
design documents (say so, and reverse it by his words, not yours); an item that *sounds* built but
only half is (round 3's "keep scrolling while armed" — the agent built "a click activates" and missed
the scrolling half); a **pasted settings export** (that is answers, not description — start the game
with it, as the feedback loop in `DEVELOPMENT.md` says); and an ambiguity to register rather than
guess ("press `b`" — a letter, or the building's digit?).

## 1. Log it before building it

`docs/history/feedback/<date>-<round>.md`, one `### F<n>` per point, numbered on from the last log. His
words in a blockquote, verbatim; under it a status — **Built**, **Scheduled**, **Open**, **Contested** —
and, once done, one plain paragraph of what now happens. Nothing may be dropped silently. Add the
round as a step on the current milestone (`docs/milestones/`), with its definition of done as
checkboxes, and run `./scripts/check-repository.sh`.

## 2. Split the work by files, not by feature

Group items that touch the same code into **one** agent; put items on different files in parallel.
Round 4 was three agents: placement and focus (reducer, menu rows), Settings and popups (overlay,
top bar), and the export adoption (defaults and deletions). Tell each agent, in its prompt:

- `git reset --hard <sha>` **first** — a worktree may start from `main`, not your branch. Pin the SHA.
- Read `AGENTS.md`, `CLAUDE.md`, `docs/system-design/ui-patterns.md` and the feedback items, whose quoted words are
  the spec.
- **Which files are its own and which belong to the other agents.** Ask for new Experiments as a block
  of their own at the end of `EXPERIMENT_FIELDS`, and never to reorder or reformat existing entries.
- **Do not edit `docs/game-design/`, `docs/system-design/`, `docs/milestones/`, `docs/history/`,
  `AGENTS.md` or `docs/screenshots/`.** It returns *proposed design-document text*, plain English,
  ready to paste. You apply it (one voice).
- Commit on the worktree branch with the attribution lines; do not push.
- Definition of finished: `npm run typecheck`, `npm test`, `npm run test:bun`,
  `./scripts/check-repository.sh`, and the changed flows looked at with the `playtest` skill.
- Report: SHAs, what changed and every decision in plain words, tests whose *meaning* (not just
  numbers) changed, proposed design-document text, and what is left or surprising.

## 3. Merge in order, verify, and send conflicts home

`git cherry-pick <sha>...` the smallest, most disjoint work first. When one agent's work conflicts in
more than three or four files, **do not resolve it yourself** — `SendMessage` the agent that wrote it,
give it the merged head SHA and a list of what landed meanwhile, and ask it to rebase and keep both
sides. It knows both intents; you do not. After every merge: typecheck, the full test run, and play
the flow yourself with `node scripts/playtest.mjs` — a merge that passes tests can still be wrong.
Clean each worktree (`git worktree remove --force`, `git branch -D`) as its agent finishes.

## 4. Update the documents

Apply the agents' proposed text to the design documents (`docs/system-design/grid-engine.md`,
`effects.md`, `ui-patterns.md`) and to `docs/milestones/open-questions.md`. In one pass:

- Move answered questions from `open-questions.md` to `docs/history/answered-questions.md`, and
  register new ones with a recommendation.
- Tick the step's checkboxes in its milestone file.
- Add one line to the timeline in `docs/history/README.md`.
- Write the pull request description with the `pr-description` skill.

Nothing else is needed: there is no version to bump and no separate report. **When a rule is reversed, grep the old sentence**
(`grep -rn "never scrolls"`) — the same fact lives in several documents and the stale copy is always
the one you did not think of.

## 5. Pictures, page, pull request

- `node scripts/capture-spike-screenshots.mjs` regenerates the pictures (it edits `docs/screenshots/`); open
  the new ones and look at them before linking any. Prefer `--settings` over key counts to set an
  Experiment in a capture flow — every added or removed Experiment shifts a "Down*6".
- `bun scripts/build-web.mjs`, copy `dist/terminal-nexus-playtest.html` to your scratchpad, and
  publish it to the **same** artifact URL. The Artifact tool refuses until you have read the live
  version; read it, confirm nothing on the live page is missing from yours (a rebuild of the previous
  commit should equal it apart from the build time), then publish.
- Rewrite the pull request with the `pr-description` skill — **against `main`**, the whole change, not
  the last round. Run its Demo steps exactly as written; the last round's `Esc, then s` did not work
  from the map. The connector appends a second footer: read the body back.

## 6. Then wait, lightly

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
  tuned on (`docs/milestones/next-steps.md`, Q66).
- **Agents cannot run a script that writes `docs/screenshots/`** if they were told not to touch it — leave
  the regeneration to yourself and name which captions changed.
