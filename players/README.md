# Players

Who can plan a Skirmish slot besides a person (docs/system-design/skirmish-saves.md):

- **`scripts/`**: script profiles, one JSON file each. `script` is one of the duel's scripts (`balanced`, `rush`,
  `turtle`, and their `-area`, `-upgrade` and formation variants, `src/duel/players.ts`); `about` says how it plays in a
  line; `options.credits` is its share of the curve's income (1 unless set). A slot names one as `script:<file name>`;
  a duel script's own name works too (`script:rush`).
- **`agents/`**: agent profiles, one Markdown file each, for language-model players (`agent:<file name>`). Not built
  yet: the agent players' milestone decides the rest.
