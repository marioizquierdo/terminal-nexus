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
- register an undecided fork in `specs/open-questions.md` with a recommendation, then keep working on
  everything the answer does not touch;
- stop with evidence for Mario rather than continuing to the next gate.
