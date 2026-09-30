# The menu spike — the owner's notes at the merge (2026-09-30)

**Document role:** The owner's notes when he merged the menu spike, item by item, with what became of each
**Status:** WORKING — every item is Built, Scheduled, Open or Contested
**Updated:** 2026-09-30
**License:** Apache-2.0

Mario merged the menu spike (pull request 49, rounds 1-3) and sent these notes the same day "for a
smaller follow-up PR". They continue [`2026-09-30-menu-spike-round-3.md`](2026-09-30-menu-spike-round-3.md)'s
numbering. Status values: **Built**, **Scheduled**, **Open**, **Contested**.

### F82 — The merge

> fucking As man! this was a really cool one. Merged.

**Noted.** The menu spike's three rounds are merged; this follow-up is a pull request of its own.

### F83 — Every popup breathes; the Battle Round screen opens with a double flash

> Popup pulse effect is very nice, but it is so subtle that I didn't even notice. This subtle version
> works well for all popups because it is very unobstrussive. For the battle round popup, add an
> additional opening effect that overrides the default border pulse. Give it a initial double flash
> pulse, with more contrast range, that works as a highlight, then it stays on the default pulse
> animation. Refactor code to account for new abstraction.

**Open.**

### F84 — A building's card: title, subtitle, description, stats

> Building card: theren's no need to show the "planned" or "to build" state. That is obvious from the
> rest of the UI. Instead, use that subtitle space for the subtitle explanation. The text below should
> be longer explanation with more details if needed. For now, just elaborate a little more on the
> examples. So the cards have title, subtitle, description, stats. I am also thinking that there may be
> modifications for the way it looks when building, exploring during build phase, or exploring during
> battle. For example, the title may not be needed when building because it is already the menu item on
> top. But don't worry about this now, we will address it later during other polish rounds. Just add a
> subtitle for now and cleanup/prepare the code for possible changes later, keep it simple whenever
> possible and directly linked to the abstraction.

**Open.**

### F85 — Settings in sections, and one ladder from experiment to constant

> Let's improve the settings window a little more. Instead of having general settings and then
> experiments, make more groups, and leave an extra space between sections. We may implement expanding a
> section later, but for now just keep it with title and settings in the section. This will allow us to
> add more settings and will be easier for me to find them. Add a section specially for keyboard
> navigation, and add a few more settings back, preparing for the upcoming round of polish for keyboard
> navigation. Refactor the code to account for the hierarchy of settings, some are experimental (for
> me), some are in-game user-facing settings, and some are constants in code only. We may promote
> settings to be user-facing, change sections, move them into constants (so we can still refer and
> update them), and at some point we can cleanup and solidify the constants and move them closer to
> their code module because they no longer need tuning. This system is very powerful and it is allowing
> communication between you and me, thanks!

**Open.**

### F86 — A prompt for the next milestone

> Then, give me a prompt to copy-paste into a new session to start working on the next milestone :)

**Open.**
