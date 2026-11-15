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

### F301 — a sandbox is a setup and a timer; and does the lore still need the Grid?

> So why do you think it is a sandbox now? Is it just a concept? [...] a battle round is actually a different concept.
> It's just basically the concept of here is the setup that was prepared by previous rounds and by previous building.
> However it got there, doesn't matter. And then you start a timer and you run the battle simulation through it. [...]
> the skirmish tool is basically only concerned about parsing input parameters and then relying into the engines [...]
> It just needs to be clear and share as much code as possible so we are not reinventing the wheel over and over.

> what do you think is the grid that we mentioned on the lore? [...] can you write a paragraph that describes what
> could make for a really cool Nexus grid idea in the lore? And then just be frank and think, do we still need this?

**Built.** A sandbox is only a way to write the setup by hand; the Battle Round it plays is the battle engine's one
entry (`resolvePulse`), which a battle's Battle Round now runs through too, where it used to drive the tick itself (a
whole battle's report is identical before and after). The Grid stays: it is the word a player reads on screen, and
the lore now says what it is, ground the ancient protocol has squared off, where things move cell by cell, time moves
in pulses and the same plans play out the same way, which is the game's own rules told as fiction.
