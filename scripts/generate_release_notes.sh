#!/usr/bin/env bash
# generate_release_notes.sh — Generate RELEASE_NOTES.md from git log since the previous tag.
# Output: writes RELEASE_NOTES.md to the repo root and prints to stdout.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_FILE="$REPO_ROOT/RELEASE_NOTES.md"

# ---------- Determine range ----------
if PREV_TAG="$(git -C "$REPO_ROOT" describe --tags --abbrev=0 HEAD^ 2>/dev/null)"; then
  RANGE="${PREV_TAG}..HEAD"
  SINCE_DESC="since $PREV_TAG"
else
  # No previous tag — use the very first commit
  FIRST_COMMIT="$(git -C "$REPO_ROOT" rev-list --max-parents=0 HEAD)"
  RANGE="${FIRST_COMMIT}..HEAD"
  SINCE_DESC="since initial commit"
fi

# ---------- Collect commits ----------
COMMITS="$(git -C "$REPO_ROOT" log "$RANGE" --pretty=format:"- %s (%h)" --no-merges 2>/dev/null || true)"

# ---------- Categorise ----------
FEAT=""
FIX=""
INFRA=""
TEST_NOTES=""
OTHER=""

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  # Strip the leading "- " to inspect the subject
  subject="${line#- }"
  if [[ "$subject" == feat:* || "$subject" == feat\(*  ]]; then
    FEAT="${FEAT}${line}"$'\n'
  elif [[ "$subject" == fix:* || "$subject" == fix\(* ]]; then
    FIX="${FIX}${line}"$'\n'
  elif [[ "$subject" == deploy:* || "$subject" == ci:* || "$subject" == ci\(* || "$subject" == deploy\(* ]]; then
    INFRA="${INFRA}${line}"$'\n'
  elif [[ "$subject" == test:* || "$subject" == test\(* ]]; then
    TEST_NOTES="${TEST_NOTES}${line}"$'\n'
  else
    OTHER="${OTHER}${line}"$'\n'
  fi
done <<< "$COMMITS"

# ---------- Build document ----------
CURRENT_TAG="$(git -C "$REPO_ROOT" describe --tags --abbrev=0 HEAD 2>/dev/null || echo "HEAD")"
DATE="$(date -u +%Y-%m-%d)"

{
  echo "# Release Notes — $CURRENT_TAG ($DATE)"
  echo ""
  echo "_Changes $SINCE_DESC_"
  echo ""

  if [[ -n "$FEAT" ]]; then
    echo "## New Features"
    echo ""
    printf '%s' "$FEAT"
    echo ""
  fi

  if [[ -n "$FIX" ]]; then
    echo "## Bug Fixes"
    echo ""
    printf '%s' "$FIX"
    echo ""
  fi

  if [[ -n "$INFRA" ]]; then
    echo "## Infrastructure"
    echo ""
    printf '%s' "$INFRA"
    echo ""
  fi

  if [[ -n "$TEST_NOTES" ]]; then
    echo "## Testing"
    echo ""
    printf '%s' "$TEST_NOTES"
    echo ""
  fi

  if [[ -n "$OTHER" ]]; then
    echo "## Other Changes"
    echo ""
    printf '%s' "$OTHER"
    echo ""
  fi

  if [[ -z "$COMMITS" ]]; then
    echo "_No commits found in range._"
    echo ""
  fi
} | tee "$OUTPUT_FILE"

echo "Release notes written to: $OUTPUT_FILE" >&2
exit 0
