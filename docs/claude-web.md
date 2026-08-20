# Claude Code on the web setup

Claude Code on the web works in an isolated remote environment, creates a task branch, and can return work as a pull request. It does not run inside GitHub Codespaces; Codespaces is the parallel browser-based editor and test environment for humans.

## One-time setup after publication

1. Open [Claude Code on the web](https://claude.ai/code).
2. Connect GitHub and install the Claude GitHub App when prompted.
3. Grant the app access to `marioizquierdo/terminal-nexus`.
4. Create or select an environment with **Trusted** network access.
5. Add no secrets for Milestone 1A. Claude Web itself does not require an Anthropic API key for this repository workflow.
6. Leave the environment setup script empty for the first session. Runtime selection belongs to the current gate; do not install an unreviewed floating Bun version.

After Gate 1A pins the toolchain, update the environment setup, `DEVELOPMENT.md`, dev container, and CI together. Keep setup under five minutes and never put credentials in a script or repository.

## First session prompt

```text
Read CLAUDE.md and follow AGENTS.md.

Run ./scripts/check-repository.sh first — it prints the canon version and the active gate.

Then read:
1. specs/terminal-nexus-concept.md
2. specs/engine.md Section 0 first, and take the authority markers literally.
   Then Sections 1, 3, and 4 - the three worlds, the Grid and its layers, the Pulse.
3. specs/milestone-1-spike-battle.md, through the active gate
4. specs/open-questions.md Section 4
5. specs/project-governance.md Sections 2-4

Copy specs/templates/gate-report.md into the spike and fill in its first section before
writing code: question, smallest artifact, automated evidence, owner observation,
exclusions, stop conditions.

Implement only the active gate. Gate 1A builds the headless run and a minimal ASCII
view together - the headless report is how you iterate, the view is how Mario judges
it. Selection, inspection, and scrolling are out of scope; use a small Grid that fits
the viewport. Run every available verification command and finish with a PASS, REVISE, STOP, or
BLOCKED evidence report for Mario. Register anything you could not decide in
specs/open-questions.md with a recommendation.
```

## Environment notes

Measured on 2026-08-20: the task container provides **Bun 1.3.11** and **Node 22.22.2**; Deno is not
installed. Milestone 1 dropped its Deno probe partly for this reason — see
`specs/milestone-1-spike-battle.md` Section 3.2.

Gate 1A will pin the runtime it selects. Until then, leave the environment setup script empty rather
than installing a floating version to save a session thirty seconds.

## Optional GitHub `@claude` automation

Claude Code on the web does not require a repository GitHub Action. If issue and pull-request comments should invoke `@claude`, install Anthropic's Claude GitHub App and add the official Claude Code Action separately. That workflow requires an `ANTHROPIC_API_KEY` repository secret or an explicitly configured Bedrock/Vertex identity. Never commit credentials.
