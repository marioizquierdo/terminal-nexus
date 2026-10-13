# Commander armies (2026-10-13)

After the Nexus Pulse merged (pull request 68), Mario asked for the Commander milestone to be re-evaluated and a new
plan made, then answered the plan. These notes continue
[`2026-10-08-keyboard-without-acceleration.md`](2026-10-08-keyboard-without-acceleration.md)'s numbering. His words
are voice transcription, kept as they arrived. Status values: **Built**, **Scheduled**, **Open**, **Contested**.

### F163 — Re-evaluate the milestone and make a new plan

> Let's move into more detailed commander design. I think we already covered a lot with previous updates so start by
> re-evaluating the milestone and making a new plan.
>
> We still don't have a fully playable version of the game. The perimeter level is a playground for experimentation
> and that is fine for now. The part I'm most i terested in covering now is the "structure" if a commander army,
> thinking about ways to differentiate commanders from each other, goving them character and presence in the UI,
> checkong if the resurrection mechanic through Nexus Pulses works well and is clear in the UI, and start thinking
> about catch-up mechanics (specially for multiplayer or player vs ai mode, if one player gets a lucky draw during
> first rounds, how to counter that without helplessly falling behind).

**Scheduled.** The plan, which he accepted (F166): the Commander milestone ends with one more step, the Commander's
presence on screen and her return, which is the one claim the milestone had not proved ("a player understands what
her death did"). The rest is a new milestone, Commander Armies
([`milestone-14-commander-armies.md`](../../milestones/milestone-14-commander-armies.md)): what a Commander Army is,
the expected power curve, a second Commander, and the guidelines for catch-up.

### F164 — Survivors stack; later units are much stronger

> Some games like this one reture all units between rounds, so only buildings count, but I like being able to keep
> fighting with the previous units if they survive (stacking with the new army), but new unlocked units shohld be a
> lot stronger so that makes the initial moves more exoratory and opportinistic and the last few moves more decisive.

**Scheduled** for Commander Armies: survivors keep coming home and fighting again (as Recall already does), and the
expected power curve says how much stronger what each round brings should be, so early rounds explore and late ones
decide.

### F165 — The plan

> Let me know what is your best plan to address Commanders!

**Built** as the plan in the session, written into the milestones with F166's answers.

### F166 — His answers

> ok let's do this. Yes let's write the steps on your plan and finish this milestone. Averno looks good. For the
> catch up mechanic, no nees to implement the flag mechanic yet, only update deaign and documentation guidelines for
> deaigning a commander's army. We can focus on the expected power curve, with some rules on expected power per nexus
> pulse, so armies can build around this curve with different tradeoffs. Commanders can have different abilities, it
> depens on the commander; what mattes is the build's focus on commander or unit's or economy, etc. They will he
> asymetric by design. Active skills are still automatic, the user has no input durinf a battle round.

**Scheduled**, each into the plan:

- The Commander milestone finishes with its last step, the Commander on screen and her return.
- The second Commander is Marshal Averno.
- Catch-up is design and guidelines for authoring a Commander Army, not a mechanic built: no catch-up Experiment
  yet.
- The expected power curve, with rules for the power each Nexus Pulse is expected to bring, is the frame an army
  builds around with its own trade-offs.
- Commanders have whatever abilities suit them; what sets an army apart is what its build leans on (the Commander,
  the units, the economy, and so on). Asymmetric by design.
- An active skill is still automatic: the player gives no input during a Battle Round.
