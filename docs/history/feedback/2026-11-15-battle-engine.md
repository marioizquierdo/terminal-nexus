# The battle engine round, 2026-11-14 and 2026-11-15

_After the cleanup round. Logged once built; each point's status says what was done._

### F298 — could a sandbox be a Skirmish?

> Now let's focus for a little bit on the skirmish versus sandbox. [...] Why do we need a special sandbox mode? Will it
> be possible to cover everything we want on a sandbox in a special way of just making a skirmish mode? [...] I know
> right now skirmish does not have a simulation for doing build mode, but do we really need that? [...] If that's true,
> perhaps we can actually reduce the complexity here and simply document how to use a skirmish better.

> Yes, all three make sense, of course.

**Built.** The three proposals he accepted: the sandbox's Build Phase is removed, so a sandbox is always one Battle
Round; the `skirmish` command plays a sandbox and draws it (`--show`); the documents describe one save format. The
third proposal's other half, letting a sandbox play on past its first round, was left out: a board written by hand has
no Nexus Pulse, credits or Commander unless it places them, so a second round has nothing to be played by. A test that
needs several rounds starts a real Skirmish from a save.

### F299 — what is the grid, next to the `skirmish` command?

> what's the difference between the grid engine and the skirmish command? [...] The skirmish game mode that players
> can choose when starting a new game allows configuration to basically try out stuff. And the same thing a human can
> do configuring a skirmish is something that we translated into the skirmish command. [...] Then the grid, I
> believe, is the engine running behind. [...] So please take a look if it still makes sense calling it the grid [...]
> the documentation on testing for coding agents could be also streamlined and mention the skirmish command and all
> of the different ways to use it as a way to try the game from the CLI without having to use a UI.

**Built**, with F300.

### F300 — the Nexus battle engine; unit tests and verifiers; remove what no longer earns its place

> I believe you are adding too much weight into past decisions. [...] Right now, I will just get rid of this concept
> completely and focus on what it's actually doing, which is a Nexus battle engine. [...] You give this engine a state
> in the map and let it run for a given amount of time while recording what's happening inside and logging. [...]
> Notice that a build phase in this game is completely separated from the battle rounds. And the battle rounds are
> really just running the engine up to the point where the Nexus pulse tells them that it's time to retreat [...]
> Being able to test at the right layer is the key. When we talk about tests, we are talking about unit tests that
> are repeated on every single build and pull request. [...] There is a different type of testing when we say that the
> agent must verify certain behavior. Perhaps we should start naming them as verifiers or task verifiers [...] It's
> always easy to add, it's always hard to remove. [...] The command can go, and all of the functionality can be
> replicated through creating the proper save file and injecting it into a skirmish. [...] Please be liberal and
> remove as much complexity as we can.

**Built.**

- The `grid` command is gone, with its trials, variants and trial files, its live watch screen, the browser page's two
  battle replays and the scripts that drove it: a sandbox is a save the `skirmish` command plays and draws.
- The engine is named for what it does: the **battle engine**, in `src/engine/` (the tick loop, the state, the Grid's
  geometry, events, the seeded stream, routes, the ability kinds). A test holds that it imports nothing above it but
  the content definitions. "Kernel" is retired; the Grid stays the playfield's name.
- [`architecture.md`](../../system-design/architecture.md) (once the engine design) is organised around the four
  layers: the battle engine, the rules between rounds, the game, and the doors (the game, the `skirmish` command, the
  `measure` command).
- [`testing.md`](../../system-design/testing.md) separates **unit tests** (kept, fast, one rule at its layer, run on
  every build) from **verifiers** (the check a session runs to show its task works, kept only if its rule must hold for
  good). The sandbox page folded into the save page, and the `grid` skills into the `skirmish` skill.
- The old watch screen's frame, which only tests still used, is retired, and those tests now run on the frame the game
  draws.
