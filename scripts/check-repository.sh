#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

required_files=(
  "README.md"
  "DEVELOPMENT.md"
  "AGENTS.md"
  "CLAUDE.md"
  "CONTRIBUTING.md"
  "LICENSE"
  "LICENSE-CREATIVE"
  "NOTICE"
  "specs/README.md"
  "specs/terminal-nexus-concept.md"
  "specs/terminal-nexus-lore.md"
  "specs/engine.md"
  "specs/commander-armies.md"
  "specs/campaigns.md"
  "specs/project-governance.md"
  "specs/milestone-1-spike-battle.md"
  "specs/milestone-2-deterministic-pulse.md"
  "specs/milestone-3-builder-editor.md"
  "specs/milestone-4-citizens-ravels.md"
  "specs/milestone-5-campaign-fragment.md"
  ".devcontainer/devcontainer.json"
  ".github/workflows/ci.yml"
)

for required_file in "${required_files[@]}"; do
  if [[ ! -f "$required_file" ]]; then
    echo "Missing required file: $required_file" >&2
    exit 1
  fi
done

if ! grep -Fq '**Canon version:** 2.0' specs/README.md; then
  echo "Specification index does not identify canon version 2.0." >&2
  exit 1
fi

if ! grep -Fq '**Status:** CURRENT — Gate 1A only' specs/milestone-1-spike-battle.md; then
  echo "Milestone 1 does not identify Gate 1A as the current sole authority." >&2
  exit 1
fi

if ! grep -Fq '@AGENTS.md' CLAUDE.md; then
  echo "CLAUDE.md must import AGENTS.md." >&2
  exit 1
fi

if grep -RInE 'terminal-nexus-spec[.]md|terminal-nexus-spike1[.]md' \
  --include='*.md' --include='*.sh' --exclude-dir='.git' .; then
  echo "Stale links to the retired monolithic canon remain." >&2
  exit 1
fi

if grep -RInEi '\bveils?\b' specs AGENTS.md README.md DEVELOPMENT.md; then
  echo "Stale planning-phase terminology remains; use Build Phase and Nexus Pulse." >&2
  exit 1
fi

node -e "JSON.parse(require('node:fs').readFileSync('.devcontainer/devcontainer.json', 'utf8'))"
node scripts/check-markdown-links.mjs

while IFS= read -r markdown_file; do
  fence_count="$(grep -c '^```' "$markdown_file" || true)"
  if (( fence_count % 2 != 0 )); then
    echo "Unbalanced fenced code block: $markdown_file" >&2
    exit 1
  fi
done < <(find . -type f -name '*.md' -not -path './.git/*' -print | sort)

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --check
  git diff --cached --check
fi

echo "Repository checks passed."
