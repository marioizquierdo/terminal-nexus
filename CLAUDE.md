@AGENTS.md

# Claude-specific entry point

What is specific to a Claude session, on top of the imported repository instructions:

- On Claude Code on the web, work on the task branch created for the session and propose changes
  through a pull request; `main` changes only by a merged pull request, never by a push.
- Use the skills: `skirmish` to verify a change headless (a Battle Round from a sandbox, read from its
  log and pictures, or whole battles, armies against each other), `playtest` to see a change on screen
  and make pictures, `remeasure` after
  a rule, content or power-curve change and when many pinned tests fail at once, `feedback-round`
  when Mario sends playtest feedback or an export, `pr-description` for every pull request body, and
  `writing-for-agents` when creating or editing a skill, `AGENTS.md` or `CLAUDE.md`.
