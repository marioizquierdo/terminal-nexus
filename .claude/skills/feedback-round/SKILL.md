---
name: feedback-round
description: Run one round of owner (Mario) feedback end to end — log his words item by item, turn it into a gate, split the work across parallel agents in worktrees, merge and reconcile it, write the canon text and gate report, regenerate evidence, republish the playable page, and rewrite the pull request. Use whenever Mario sends playtest feedback or a pasted settings export, or when a change is big enough to split across several agents. Read it before spawning your first worktree agent.
---

# A feedback round, start to finish

Four rounds ran this way on the Build Phase (gates 5G-5K, September 2026) and it works. What follows is
the procedure and the traps, in the order you meet them. The story of how each trap was found is in
[`docs/history/lessons-learned.md`](../../../docs/history/lessons-learned.md).

## 0. Read what he sent, twice

Mario writes long, generous, specific feedback, and the second reading finds what the first skipped.
Look for: an item that contradicts a canon rule (say so, and reverse it by his words, not yours); an
item that *sounds* built but only half is (round 3's "keep scrolling while armed" — the agent built
"a click activates" and missed the scrolling half); a **pasted settings export** (that is answers, not
description — see `AGENTS.md` Section 2, item 1); and an ambiguity to register rather than guess ("press
`b`" — a letter, or the building's digit?).

## 1. Log it before building it

`docs/history/feedback/<date>-<round>.md`, one `### F<n>` per point, numbered on from the last log. His words
in a blockquote, verbatim; under it a status — **Built**, **Scheduled**, **Open**, **Contested** — and,
once done, one plain paragraph of what now happens. Nothing may be dropped silently. Add the gate to
`docs/milestones/completed/milestone-05-build-phase.md` (or the current milestone) with a definition of done as
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
- **Do not edit `specs/`, `docs/milestones/`, `AGENTS.md`, `evidence/` and do not bump the canon.** It returns
  *proposed canon text*, plain English, ready to paste. You apply it (one voice, one version bump).
- Commit on the worktree branch with the attribution lines; do not push.
- Definition of finished: `npm run typecheck`, `npm test`, `npm run test:bun`,
  `./scripts/check-repository.sh`, and the changed flows looked at with the `playtest` skill.
- Report: SHAs, what changed and every decision in plain words, tests whose *meaning* (not just
  numbers) changed, proposed canon text, and what is left or surprising.

## 3. Merge in order, verify, and send conflicts home

`git cherry-pick <sha>...` the smallest, most disjoint work first. When one agent's work conflicts in
more than three or four files, **do not resolve it yourself** — `SendMessage` the agent that wrote it,
give it the merged head SHA and a list of what landed meanwhile, and ask it to rebase and keep both
sides. It knows both intents; you do not. After every merge: typecheck, the full test run, and play
the flow yourself with `node scripts/playtest.mjs` — a merge that passes tests can still be wrong.
Clean each worktree (`git worktree remove --force`, `git branch -D`) as its agent finishes.

## 4. Write the canon and the report

Apply the agents' proposed text to `docs/system-design/grid-engine.md` (and `ascii-effects.md`, `open-questions.md`),
`AGENTS.md`, `docs/system-design/ui-patterns.md`. Then, in one pass: bump the canon version everywhere (the validator
names what you missed), add the governance ledger row, move answered questions to the Answered table,
register new ones with a recommendation, tick the gate's checklist, and fill a gate report from
`.github/pull_request_template.md`. **When a rule is reversed, grep the old sentence** (`grep -rn "never
scrolls"`) — the same fact lives in five documents and the stale copy is always the one you did not
think of.

## 5. Evidence, page, pull request

- `node scripts/capture-spike-screenshots.mjs` regenerates the pictures (it edits `evidence/`); open
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

Subscribe to the pull request, set an hourly `send_later` check-in, and **do not start the next gate**.
Stop the check-in when it merges, delete the trigger, and reset the branch:
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
- **Agents cannot run a script that writes `evidence/`** if they were told not to touch it — leave
  the regeneration to yourself and name which captions changed.
