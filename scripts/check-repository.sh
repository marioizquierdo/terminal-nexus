#!/usr/bin/env bash

# Repository validation for Terminal Nexus.
#
# This script is the only feedback loop that exists before a runtime is selected, so it checks
# invariants rather than literals. Doing correct canon work must never break it: the canon version
# and the current gate are *derived* from the documents, not hardcoded here.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

failures=0

fail() {
  echo "FAIL: $*" >&2
  failures=$((failures + 1))
}

# A handful of documents under concept/ are frozen historical artifacts, not living canon - e.g. the
# actual pre-canon-split spec, kept verbatim for reference. They predate current terminology by
# definition, so requiring a canon-version/metadata header on them, or rewriting retired words out of
# them, would falsify the record rather than fix a bug. List them explicitly; every check below that
# cares about canon versioning, the metadata header, or retired terminology skips a listed path.
historical_archives=(
  "concept/2026-08-19 - original spec.md"
)

is_historical_archive() {
  local candidate="$1"
  for archive in "${historical_archives[@]}"; do
    [[ "$candidate" == "$archive" ]] && return 0
  done
  return 1
}

# Markdown files, excluding VCS and dependency directories.
markdown_files() {
  find . -type f -name '*.md' \
    -not -path './.git/*' \
    -not -path './node_modules/*' \
    -print | sort
}

# ---------------------------------------------------------------------------
# 1. Required files
# ---------------------------------------------------------------------------

required_files=(
  "README.md"
  "DEVELOPMENT.md"
  "AGENTS.md"
  "CLAUDE.md"
  "CONTRIBUTING.md"
  "LICENSE"
  "LICENSE-CREATIVE"
  "NOTICE"
  "concept/README.md"
  "specs/README.md"
  "specs/terminal-nexus-concept.md"
  "specs/terminal-nexus-lore.md"
  "specs/engine.md"
  "specs/commander-armies.md"
  "specs/campaigns.md"
  "specs/project-governance.md"
  "specs/open-questions.md"
  "specs/ascii-art-references.md"
  "specs/ascii-effects.md"
  "specs/templates/gate-report.md"
  "specs/backlog-pulse-completion.md"
  "milestones/README.md"
  "milestones/milestone-01-grid-battles.md"
  "milestones/milestone-02-campaign-design.md"
  "milestones/milestone-03-game-menu.md"
  "milestones/milestone-04-campaign-menu.md"
  "milestones/milestone-05-build-phase.md"
  "milestones/milestone-06-pulse-phase.md"
  "milestones/milestone-07-worker-economy.md"
  "milestones/milestone-08-commander.md"
  "milestones/milestone-09-mission-cutscenes.md"
  "milestones/milestone-10-first-and-second-missions.md"
  ".devcontainer/devcontainer.json"
  ".github/workflows/ci.yml"
)

for required_file in "${required_files[@]}"; do
  [[ -f "$required_file" ]] || fail "missing required file: $required_file"
done

# ---------------------------------------------------------------------------
# 2. Canon version agreement (derived from specs/README.md)
# ---------------------------------------------------------------------------

canon_version="$(sed -n 's/^\*\*Canon version:\*\* \(.*\)$/\1/p' specs/README.md | head -1)"

if [[ -z "$canon_version" ]]; then
  fail "specs/README.md does not declare a canon version"
else
  while IFS= read -r doc; do
    is_historical_archive "$doc" && continue
    declared="$(sed -n 's/^\*\*Canon version:\*\* \(.*\)$/\1/p' "$doc" | head -1)"
    if [[ -z "$declared" ]]; then
      fail "$doc does not declare a canon version"
    elif [[ "$declared" != "$canon_version" ]]; then
      fail "$doc declares canon version '$declared'; specs/README.md declares '$canon_version'"
    fi
  done < <(find specs concept -type f -name '*.md' -print | sort)

  # AGENTS.md restates canon invariants as a summary, so it drifts silently unless it is versioned
  # alongside them.
  agents_version="$(sed -n 's/^\*\*Canon version:\*\* \(.*\)$/\1/p' AGENTS.md | head -1)"
  if [[ -z "$agents_version" ]]; then
    fail "AGENTS.md does not declare a canon version"
  elif [[ "$agents_version" != "$canon_version" ]]; then
    fail "AGENTS.md declares canon version '$agents_version'; specs/README.md declares '$canon_version'"
  fi
fi

# ---------------------------------------------------------------------------
# 3. Required metadata header on every canon document
# ---------------------------------------------------------------------------

while IFS= read -r doc; do
  [[ "$doc" == "specs/README.md" ]] && continue
  is_historical_archive "$doc" && continue
  for field in "Document role" "Status" "Canon version" "Updated" "License"; do
    grep -Fq "**${field}:**" "$doc" || fail "$doc is missing the '${field}' metadata field"
  done
done < <(find specs concept -type f -name '*.md' -print | sort)

# Milestones are trackers, not versioned canon (AGENTS.md Section 1): they carry their own
# lighter header and are not required to agree with specs/README.md's canon version, since a
# session checks tasks off mid-milestone independently of any canon-version bump.
while IFS= read -r doc; do
  for field in "Document role" "Status" "Updated" "License"; do
    grep -Fq "**${field}:**" "$doc" || fail "$doc is missing the '${field}' metadata field"
  done
done < <(find milestones -maxdepth 1 -type f -name 'milestone-*.md' -print | sort)

# ---------------------------------------------------------------------------
# 4. Exactly one CURRENT milestone, agreeing with milestones/README.md
# ---------------------------------------------------------------------------

current_milestones=()
while IFS= read -r doc; do
  status="$(sed -n 's/^\*\*Status:\*\* \(.*\)$/\1/p' "$doc" | head -1)"
  case "$status" in
    CURRENT) current_milestones+=("$doc") ;;
    GATED | COMPLETE | REVISE | BLOCKED | STOPPED) ;;
    *) fail "$doc declares status '$status'; expected one of CURRENT, GATED, COMPLETE, REVISE, BLOCKED, STOPPED" ;;
  esac
done < <(find milestones -maxdepth 1 -type f -name 'milestone-*.md' -print | sort)

current_gate=""
if (( ${#current_milestones[@]} != 1 )); then
  fail "expected exactly one milestone marked CURRENT; found ${#current_milestones[@]}: ${current_milestones[*]:-none}"
else
  current_milestone="${current_milestones[0]}"
  current_basename="$(basename "$current_milestone")"

  if ! grep -Eq "^\*\*Active gate:\*\* " "$current_milestone"; then
    fail "$current_milestone is CURRENT but does not declare an active gate"
  fi

  current_gate="$(sed -n 's/^\*\*Active gate:\*\* \(.*\)$/\1/p' "$current_milestone" | head -1)"

  if ! grep -Eq "^\|[^|]*${current_basename}[^|]*\| CURRENT \|" milestones/README.md; then
    fail "milestones/README.md does not mark $current_basename as CURRENT"
  fi

  readme_current_rows="$(grep -cE '^\|[^|]*\| CURRENT \|' milestones/README.md || true)"
  if [[ "$readme_current_rows" != "1" ]]; then
    fail "milestones/README.md has ${readme_current_rows} CURRENT rows; exactly one is allowed"
  fi
fi

# ---------------------------------------------------------------------------
# 5. Open-question references resolve
# ---------------------------------------------------------------------------

defined_questions="$(sed -n 's/^### \(Q[0-9]\+\) .*$/\1/p' specs/open-questions.md | sort -u)"

referenced_questions="$(grep -rhoE '\bQ[0-9]+\b' specs concept milestones --include='*.md' 2>/dev/null | sort -u || true)"

while IFS= read -r question; do
  [[ -z "$question" ]] && continue
  if ! grep -Fxq "$question" <<< "$defined_questions"; then
    fail "$question is referenced but not defined in specs/open-questions.md"
  fi
done <<< "$referenced_questions"

# Every OPEN question must carry a recommendation; a question without one is unfinished.
while IFS= read -r question; do
  [[ -z "$question" ]] && continue
  block="$(awk -v q="### $question " '
    index($0, q) == 1 { capture = 1; next }
    /^### / { capture = 0 }
    capture { print }
  ' specs/open-questions.md)"
  if grep -q '^\*\*Status:\*\* OPEN' <<< "$block" && ! grep -q '\*\*Recommendation' <<< "$block"; then
    fail "$question is OPEN but offers no recommendation"
  fi
done <<< "$defined_questions"

# ---------------------------------------------------------------------------
# 6. Authority markers
# ---------------------------------------------------------------------------
#
# Only RULE and GUIDANCE exist. Retired markers linger in prose after a simplification, so catch them.

retired_markers="$(grep -RIn --include='*.md' -E '\*\*(LAW|UNPROVEN)\*\*|— (LAW|UNPROVEN)\b|Authority: (LAW|UNPROVEN)' \
  specs concept 2>/dev/null | grep -v 'stale-ok' || true)"
if [[ -n "$retired_markers" ]]; then
  fail "retired authority markers (only RULE and GUIDANCE exist):"
  printf '%s\n' "$retired_markers" >&2
fi

# ---------------------------------------------------------------------------
# 7. Agent entry point
# ---------------------------------------------------------------------------

grep -Fq '@AGENTS.md' CLAUDE.md || fail "CLAUDE.md must import AGENTS.md"

# ---------------------------------------------------------------------------
# 8. Retired terminology and stale links
# ---------------------------------------------------------------------------
#
# A line may quote retired terminology deliberately — the concept-art index has to name what the art
# says. Mark such a line with the comment <!-- stale-ok --> and it is exempt.

retired_terms=(
  '\bveils?\b'
  '\bplanning phase\b'
  '\bbattlefields?\b'
  'terminal-nexus-spec\.md'
  'terminal-nexus-spike1\.md'
)

for term in "${retired_terms[@]}"; do
  hits="$(grep -RInEi "$term" --include='*.md' --include='*.sh' \
    --exclude-dir='.git' --exclude-dir='node_modules' . 2>/dev/null \
    | grep -v 'stale-ok' \
    | grep -v '^\./scripts/check-repository\.sh:' || true)"

  # Drop hits inside a listed historical archive - it is expected to use retired terminology
  # verbatim, since it predates the rename.
  if [[ -n "$hits" ]]; then
    filtered=""
    while IFS= read -r hit; do
      [[ -z "$hit" ]] && continue
      hit_path="${hit%%:*}"
      hit_path="${hit_path#./}"
      is_historical_archive "$hit_path" && continue
      filtered+="$hit"$'\n'
    done <<< "$hits"
    hits="${filtered%$'\n'}"
  fi

  if [[ -n "$hits" ]]; then
    fail "retired terminology matching '$term':"
    printf '%s\n' "$hits" >&2
  fi
done

# ---------------------------------------------------------------------------
# 9. Structural checks
# ---------------------------------------------------------------------------

node -e "JSON.parse(require('node:fs').readFileSync('.devcontainer/devcontainer.json', 'utf8'))" \
  || fail ".devcontainer/devcontainer.json is not valid JSON"

node scripts/check-markdown-links.mjs || fail "broken local Markdown links"

while IFS= read -r markdown_file; do
  fence_count="$(grep -c '^```' "$markdown_file" || true)"
  if (( fence_count % 2 != 0 )); then
    fail "unbalanced fenced code block: $markdown_file"
  fi
done < <(markdown_files)

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --check || fail "whitespace errors in the working tree"
  git diff --cached --check || fail "whitespace errors in the index"
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------

if (( failures > 0 )); then
  echo >&2
  echo "Repository checks failed with ${failures} problem(s)." >&2
  exit 1
fi

echo "Repository checks passed."
echo
echo "  Canon version : ${canon_version}"
echo "  Current gate  : ${current_gate:-unknown}"
echo
echo "Read specs/README.md for the reading order, then the gate above."
