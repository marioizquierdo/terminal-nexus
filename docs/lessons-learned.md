# Terminal Nexus — lessons learned

**Document role:** What working this way taught us, dated, for the next session and for Mario
**Status:** WORKING — add a dated section after each stretch of work; move a lesson into the canon or a skill once it has proved itself twice
**Updated:** 2026-09-30 (the loop at the end of the menu spike; its second round and a general review; earlier the Build Phase rounds, gates 5G-5K)
**License:** Apache-2.0

Four rounds of Mario's playtest feedback on the Build Phase, each one built, merged and put back in
front of him within hours. Nothing here is a rule; the procedure is the
[`feedback-round`](../.claude/skills/feedback-round/SKILL.md) skill, and where a lesson became a rule
it says where.

## What worked, and why it is worth keeping

1. **His words, logged verbatim, item by item, with a status.** `docs/feedback/` turned four long
   messages into 40 numbered items, none dropped, each ending in "Built" and a plain paragraph. He
   can check his own words against what was built, and the next agent starts from what he said rather
   than from what a summary remembers.
2. **A choice he can feel beats a paragraph he must judge.** Experiments plus the settings export turned
   "which speed feels right?" into one paste: seven numbers and four open questions were settled by
   a single export (round 4). It also gave agents a way to *reproduce what he saw* (`--settings`).
3. **Pure functions of time paid for themselves.** The reducer has no clock; interpolation, the
   animation tracks and the key ramp are pure, so a test asks "what is drawn 80 ms after this?"
   without waiting. Every one of this session's timing features was tested in milliseconds.
4. **Playing it without a terminal.** The scripted playtest (`scripts/playtest.mjs`) and `--keys`
   meant every claim was checked by pressing the keys. It found real things tests had not: the undo
   message read "barracks undone", `--keys` was silently dropped by the argument parser, and the pull
   request's own Demo step ("Esc, then `s`") did not work from the map.
5. **Parallel agents in their own worktrees, from a pinned commit.** Two to three agents at a time,
   each owning files, returning *proposed* canon text that one person (the orchestrator) applied. The
   canon stayed in one voice and the version bumped once per round.
6. **The Demo sized to the change.** A code block for a doc change, a screenshot for a look, a GIF for
   motion, a playable page only when it has to be played — his own rule, and it kept rounds cheap.
7. **Re-reading his quote against what an agent built.** Round 3 asked to "keep clicking … to keep
   scrolling, and double click will place". The agent built "a click activates" and correctly left
   armed clicks still (the canon said so); only re-reading the quote found the missing half.
8. **Small pure primitives named after what game engines already call them.** Tweens, animation
   tracks, particles and shading (`ascii-effects.md` 1.2) are four small modules. "Formalise it like a
   game engine" was the right instinct: each is a page of code and a page of tests.

## What bit us

1. **Parallel agents collide in shared files.** `debug.ts`, `state.ts`, `view/build.ts` and the
   screenshot script were touched by three agents at once. Asking each to append its flags as a block of
   its own kept `debug.ts` clean; the Settings work still conflicted in eight files, and the right fix
   was to send it back to the agent that wrote it, not to resolve it blind.
2. **Scripts that count rows break with every Experiment.** "`d Down*6`" and "v 18 more" were recounted
   three times. Fix: set an Experiment by name (`--settings`) wherever a flow only needs the value
   (pending: `docs/next-steps.md`).
3. **One fact, five homes.** The armed-click rule lived in AGENTS.md, `engine.md`, `ui-patterns.md`, a
   test name and a feedback log; after Mario reversed it, one copy stayed stale for a whole round. On a
   reversal, grep the old sentence.
4. **A bulk edit almost ate the register.** A script meant to move one open question found "the next
   `### `" — which, for the last entry, was in the Answered section — and would have cut about 900
   lines. Its own size assertion stopped it before writing. Assert what you cut.
5. **Time-based tests flake under load.** With four agents building, the frame-budget tests failed once
   and passed alone and in every later run (machine load about 10). We measured before and after
   instead of loosening them.
6. **Silent parsers.** An unknown command-line option is treated as a flag, so `--keys "…"` did
   nothing and said nothing. A test that the option *arrives* would have caught it on day one.
7. **A number tuned on one keyboard.** His 150 ms "hold window" is right for a fast key repeat and turns
   a slow one's first repeat into a tap. The game guesses "held" from gaps because a terminal sends no
   key-up; that guess is the reason for Q66.
8. **Naming debt.** Debug Mode became Settings with Experiments, but `debug.ts`, `DebugFlags` and
   `BuildState.debug` kept the old name, and dozens of comments said "Debug Mode" until this cleanup.
   A rename is mechanical but touches ~200 lines; do it in a pull request of its own. (Paid on
   2026-09-30, below: `experiments.ts`, and `popup` for what the code called an overlay.)
9. **The gate history in `AGENTS.md` grows a paragraph per gate.** Section 2 is now ~120 lines every
   session reads first. Compact it after Mario accepts a milestone (`docs/next-steps.md`).
10. **Tooling wrinkles, none serious.** The GitHub connector adds a second footer to a pull request body
    (read it back). The Artifact tool refuses a republish until you have read the live version. The
    connector and the check-in trigger disconnected or failed a few times: retry, and keep no state
    only in a trigger.

11. **A red assertion in the live-loop test looks like a hang** (gate 6A round 2).
    `tests/build-lifecycle.test.ts` leaves the terminal loop running when an assertion throws, so Node
    never exits and a fifteen-minute "run" is really a one-line failure. Run it alone with
    `node --test --test-timeout=30000`, and run the whole suite the same way when editing it.
12. **"Only this flashes" needs a scope.** Reversed video is also the cursor and a spark out on the map,
    so a test that says "nothing else is reversed" over the whole frame is false on the first fight.
    Assert inside the panel, and assert the light's cells on the border.
13. **A colour cue is tuned by looking at it in four places.** The light read well in the dark theme and
    needed checking in the light theme (where "toward white" is dark ink), in monochrome (bold) and at
    16 colours (a step, not a blend) before the pull request could call it done.

## The menu spike's second round and the general review (2026-09-30)

1. **Renames first, by one hand, then parallel agents.** The review wanted about a dozen renames that
   touch every layer (popup, see-through, experiments, the game menu, the Battle Round). Doing them
   sequentially, by hand, before starting the three fix agents meant the agents all built on the new
   names, and their merges met one conflict (an import line in a test). The reverse order would have
   put the same rename into three branches.
2. **Let the compiler find a renamed string literal.** Changing a union member (`"menu"` to
   `"game-menu"`) and reading the type errors found every comparison, `case` and assignment in the
   source; only runtime assertions in tests (`assert.equal(x, "menu")`) escaped it, and one failing test
   named each of those.
3. **A worktree agent may start from `main`, not from the branch.** All three fix agents found their
   worktree at `main`'s commit and fast-forwarded to the branch tip because the prompt named the commit
   to start from. Always name it, and say what to do if the worktree is elsewhere.
4. **Two agents' changes can meet only when merged.** The renderers agent's capture script read
   `SETTINGS_ORDER`; the reducer agent deleted it in the same hour. Both passed their own tests; the
   capture script (plain JavaScript, not typechecked) failed only when run after the merge. Run the
   evidence script after merging, not only each agent's checks.
5. **A review agent that only reads is cheap and finds real bugs.** Four read-only reviewers (by
   area) returned about seventy-five findings, three of them bugs confirmed by running the code. Asking
   each to say which findings it had verified, and to mark mechanical versus behavioural, made triage
   quick.
6. **Keep the tests for last when the code under them moves.** Reorganising the tests while three
   agents changed the code they test would have conflicted everywhere; one test agent afterwards, on the
   merged code, had a stable target.
7. **Timing tests flake while agents build.** The frame-budget test failed once in three runs with two
   agents testing at the same time (load 8 on 4 cores) and passed alone. Re-run before believing it.
8. **Settle the export and add the round's Experiment slots before splitting** (third round). Doing the
   export's retirements and adding both new Experiments' fields by hand first meant neither agent had to
   touch the Experiments list, the one file every round's agents had collided in; the two merges met no
   conflict at all.

## The loop itself, at the end of the menu spike (2026-09-30)

Round 3 and the notes at the end of pull request 49 were the smoothest stretch yet. Mario played on a
laptop and on a phone, sent notes, and each round was built, evidenced and back in front of him within
hours. What made the loop itself work, rather than any one feature:

1. **The settings became the channel, so they got a structure.** Experiments began as a debug popup.
   By the end, every setting is declared once with its tier — the player's own, an Experiment for
   Mario, or a tuned constant — so an agent asking a question, Mario answering it, and the answer
   becoming a constant are each a one-word edit (`src/build/all-settings.ts`). When a way of talking
   to the owner works, give it a real place in the code.
2. **An export is a message, and old messages must still read.** A renamed setting maps to its new
   name and a settled one is skipped quietly, so a paste from last week still reproduces what he saw.
3. **Recorded timing made feel reproducible.** The playtest notation learned timing (`Right~250`), so
   "the third quick tap should speed up" became a script, a test and a GIF. This is the seed of the
   feedback pipeline ([`feedback-pipeline.md`](feedback-pipeline.md)).
4. **Rounds grow opportunistic fixes; name them.** A round of feedback always turns up small
   refactors and bugs beside what was asked. The pull request's **Additional changes** section (now in
   the pr-description skill) says so openly instead of burying them.
5. **Check "merged" against the remote before acting on it.** Mario said the pull request was merged;
   `main` did not contain it. Checking before resetting the branch kept the follow-up on the right pull
   request. A claim about GitHub's state costs one fetch to verify.
6. **Tell an agent where to write.** One agent saved its captures into the filesystem root, and the
   cleanup was then refused by the safety check. Name the output folder in the prompt (the scratchpad).
7. **The prompt for the next session lives in the repository.** The 6B prompt is in `docs/next-steps.md`
   as well as in the chat, so a new session, or Mario on another machine, finds it without scrollback.
8. **Say what a device cannot test.** The phone's key bar only taps; holds need a laptop. Each
   pull request says which checks need which device, so a phone review is not mistaken for a full one.
9. **A proposal is cheap; write it before building it.** The deep dive on a feedback pipeline took an
   hour, and Mario cut it to something far simpler the next morning — nothing built was thrown away.
   For a large idea, write the plan, the risks and a milestone first, and expect the owner to trim it.

## Habits to keep

- Say what you did not verify: "no human has played this build", "the probe has not run in iTerm2".
- Put the reason a number is what it is beside the number (`DEFAULT_MOVEMENT`), and the device it was
  tuned on.
- Leave the branch clean for the next session: merged worktrees removed, the branch reset to `main`,
  the trigger deleted.
