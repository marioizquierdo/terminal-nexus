# Skirmish saves

Example save files: a Skirmish's setup, and the battle as it stands at the opening of a Build Phase. The format is
[`save.schema.json`](save.schema.json); what each part means, and the `skirmish` command that plays them, is
[`skirmish-saves.md`](../docs/system-design/skirmish-saves.md).

| Save | What it is |
| --- | --- |
| `crossing-new.save.json` | A new battle with the setup screen's defaults: Vasse played by a person against Dob Hunter's `balanced` script |
| `crossing-round-4.save.json` | The same battle three rounds in, bases built and armies regrouped |
| `mirror-vasse.save.json` | Vasse against Vasse, both slots scripted: a battle to watch |
| `pocket-short.save.json` | Four rounds on the small map, Averno against Dob's `rush`: a playtest in ten minutes |

```text
npm run skirmish -- --load saves/crossing-round-4.save.json             the brief of the slot a player plans
npm run skirmish -- --load saves/crossing-round-4.save.json --p1 build:plan.json --battle --save mine.save.json
```

The test suite loads each one, plays its next round, and checks the file is as the game writes it. After a change to
the rules or the content, `node scripts/make-example-saves.ts` writes them again.
