@AGENTS.md

# Claude-specific entry point

Follow the imported repository instructions. What is specific to a Claude session:

- On Claude Code on the web, work on the task branch created for the session, propose changes
  through a pull request, and never push to `main`.
- Run `./scripts/check-repository.sh` first and again before handing back.
- Use the skills: `playtest` to see a change and make pictures, `grid-screenshots` for the engine
  tool's own view, `feedback-round` when Mario sends playtest feedback, a settings export or an
  Activity Logs export, `duel` to fight armies against each other after an army change, and `pr-description` for every pull
  request body.
