@AGENTS.md

# Claude-specific entry point

Follow the imported repository instructions. What is specific to a Claude session:

- On Claude Code on the web, work on the task branch created for the session, propose changes
  through a pull request, and never push to `main`.
- Run `./scripts/check-repository.sh` first and again before handing back.
- Use the skills: `playtest` to see a change and make pictures, `grid-screenshots` for the engine
  tool's own view, `feedback-round` when Mario sends playtest feedback or a settings export, and
  `pr-description` for every pull request body.
- When a choice is Mario's to feel, put both answers behind an Experiment (Settings → Experiments in
  the Build Phase, `d` jumps there; `src/build/all-settings.ts`), ask him in the pull request to flip
  it and paste the settings export, and reproduce what he saw with `--settings "<that text>"`.
- Write anything Mario reads in plain English: the idea or the decision, never the document section
  it lives in.
