#!/usr/bin/env bash
# bump_version.sh — Increment the Flutter app version in pubspec.yaml and functions/package.json.
# Usage: ./scripts/bump_version.sh [patch|minor|major]
set -euo pipefail

BUMP_TYPE="${1:-}"
if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "Error: argument must be 'patch', 'minor', or 'major'" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PUBSPEC="$REPO_ROOT/zupurb_app/pubspec.yaml"
PKG_JSON="$REPO_ROOT/functions/package.json"

# ---------- Read current version from pubspec.yaml ----------
CURRENT_VERSION_LINE="$(grep '^version:' "$PUBSPEC")"
# Expected format: version: X.Y.Z+BUILD
CURRENT_FULL="${CURRENT_VERSION_LINE#version: }"   # e.g. 1.0.0+1
CURRENT_SEMVER="${CURRENT_FULL%+*}"                  # e.g. 1.0.0
CURRENT_BUILD="${CURRENT_FULL##*+}"                  # e.g. 1

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_SEMVER"

# ---------- Increment ----------
case "$BUMP_TYPE" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
esac

NEW_SEMVER="$MAJOR.$MINOR.$PATCH"
NEW_BUILD=$((CURRENT_BUILD + 1))
NEW_FULL="$NEW_SEMVER+$NEW_BUILD"

# ---------- Write pubspec.yaml ----------
# Use sed with a portable in-place replacement
sed -i.bak "s/^version: .*/version: $NEW_FULL/" "$PUBSPEC"
rm -f "$PUBSPEC.bak"

# ---------- Write functions/package.json (semver only) ----------
if [[ -f "$PKG_JSON" ]]; then
  if grep -q '"version"' "$PKG_JSON"; then
    # Update existing version field
    sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_SEMVER\"/" "$PKG_JSON"
    rm -f "$PKG_JSON.bak"
  else
    # Insert version after the opening brace (first line)
    sed -i.bak "1s/{/{\"version\": \"$NEW_SEMVER\",/" "$PKG_JSON"
    # Tidy: split the injected line using node if available, otherwise leave as-is
    # Simpler: use python to pretty-print
    if command -v python3 &>/dev/null; then
      python3 -c "
import json, sys
with open('$PKG_JSON') as f:
    data = json.load(f)
data_out = {'version': '$NEW_SEMVER', **data}
with open('$PKG_JSON', 'w') as f:
    json.dump(data_out, f, indent=2)
    f.write('\n')
"
    fi
    rm -f "$PKG_JSON.bak"
  fi
fi

# ---------- Report ----------
echo "Bumped version: $CURRENT_FULL -> $NEW_FULL (build: $CURRENT_BUILD -> $NEW_BUILD)"
exit 0
