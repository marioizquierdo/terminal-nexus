@AGENTS.md

# Claude-specific entry point

Use the imported repository instructions as the operating contract.

On Claude Code on the web:

- work on the task branch created for the session;
- propose changes through a pull request;
- never push directly to `main`;
- run `./scripts/check-repository.sh` first and again before handoff — it prints the canon version and
  the current milestone's own active gate, so orient from its output rather than a hardcoded filename
  here (AGENTS.md Section 1 has the full reading order; that stays the one place it is written down);
- implement only the gate the current milestone marks as its **Active gate**;
- register an undecided fork in `docs/milestones/open-questions.md` with a recommendation, then keep working on
  everything the answer does not touch;
- before any interface work — a screen, a menu, a popup, an effect, a key — read
  `docs/system-design/ui-patterns.md`: its goals (section 0) and its checklist for a new screen first, then the
  patterns you touch. When two rules disagree the goals decide, and when your change adds, bends or
  retires a pattern, update that document in the same pull request;
- when a choice is Mario's to feel — a timing, a look, whether a feature should exist — put both
  answers behind an **Experiment** (Settings → Experiments in the Build Phase, `d` jumps there;
  `src/build/experiments.ts`), ask him in the pull request to flip it and to paste the **settings export**
  as a comment, and start the game with `--settings "<that text>"` to see what he saw; he asked for
  exactly this (AGENTS.md Section 5). Remove an Experiment once its question is answered, normally
  before the pull request is accepted;
- size a pull request's **Demo** to the change — a code block, screenshots, a GIF, or a playable page
  only when it must be played (the `pr-description` skill);
- stop with evidence for Mario rather than continuing to the next gate;
- open or update pull requests using the `pr-description` skill;
- **write anything Mario reads in plain English** — describe the actual idea or decision, not the
  document section it lives in. Internal shorthand is for notes aimed at the next agent only.
  AGENTS.md Section 5 has the rule and examples.
