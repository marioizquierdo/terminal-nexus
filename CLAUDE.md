@AGENTS.md

# Claude-specific entry point

What is specific to a Claude session, on top of the imported repository instructions:

- On Claude Code on the web, work on the task branch created for the session and propose changes
  through a pull request; `main` changes only by a merged pull request, never by a push.
- Use the skills: `playtest` to see a change and make pictures, `grid` to run or debug one battle or
  write a sandbox, `grid-screenshots` for the engine tool's view on a real terminal, `skirmish` to
  play whole battles headless and fight armies against each other after a change, `remeasure` after
  a rule, content or power-curve change and when many pinned tests fail at once, `feedback-round`
  when Mario sends playtest feedback or an export, `pr-description` for every pull request body, and
  `writing-for-agents` when creating or editing a skill, `AGENTS.md` or `CLAUDE.md`.
