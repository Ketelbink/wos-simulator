#!/usr/bin/env bash
# Read-only comparison of our main branch with piddlyminx/wos-simulator.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_URL="https://github.com/piddlyminx/wos-simulator.git"
cd "$ROOT_DIR"

git fetch --quiet --no-tags origin main
git fetch --quiet --no-tags "$UPSTREAM_URL" \
  '+refs/heads/main:refs/remotes/upstream/main'

ours="refs/remotes/origin/main"
theirs="refs/remotes/upstream/main"
base="$(git merge-base "$ours" "$theirs" || true)"
if [[ -z "$base" ]]; then
  echo "Cannot find a common ancestor. This may be a shallow clone." >&2
  echo "Fetch complete history for both branches, then run this command again:" >&2
  echo "  git fetch --unshallow origin main" >&2
  echo "  git fetch --no-tags $UPSTREAM_URL main" >&2
  exit 2
fi

count_files() {
  if [[ -z "$1" ]]; then printf '0'; else printf '%s\n' "$1" | wc -l | tr -d ' '; fi
}

upstream_files="$(git diff --name-only "$base" "$theirs")"
our_files="$(git diff --name-only "$base" "$ours")"
overlap="$(comm -12 <(printf '%s\n' "$upstream_files" | sed '/^$/d' | sort) \
                     <(printf '%s\n' "$our_files" | sed '/^$/d' | sort))"

echo "# Upstream comparison — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo
echo "- Our main: $(git rev-parse --short=12 "$ours")"
echo "- piddlyminx main: $(git rev-parse --short=12 "$theirs")"
echo "- Common ancestor: $(git rev-parse --short=12 "$base")"
echo "- Upstream-only commits: $(git rev-list --count "$ours..$theirs")"
echo "- Our-only commits: $(git rev-list --count "$theirs..$ours")"
echo "- Upstream files changed since split: $(count_files "$upstream_files")"
echo "- Files changed on both sides: $(count_files "$overlap")"
echo

if git merge-base --is-ancestor "$theirs" "$ours"; then
  echo "Upstream is already contained in our main. There are no new upstream commits."
  exit 0
fi

echo "## Upstream commits since the common ancestor"
git log --no-merges --date=short --format='- %h %ad %s' "$base..$theirs"
echo

for group in heroes engine testcases dashboard other; do
  echo "## $group"
  found=0
  while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    case "$group:$file" in
      heroes:simulator/config/*) ;;
      engine:simulator/src/*) ;;
      testcases:testcases/*|testcases:docs/mechanics-audit/*) ;;
      dashboard:dashboard/*) ;;
      other:simulator/config/*|other:simulator/src/*|other:testcases/*|other:docs/mechanics-audit/*|other:dashboard/*) continue ;;
      other:*) ;;
      *) continue ;;
    esac
    printf -- '- `%s`\n' "$file"
    found=1
  done <<< "$upstream_files"
  if [[ "$found" -eq 0 ]]; then echo '- None'; fi
  echo
done

echo "## Files changed on both sides — manual review"
if [[ -z "$overlap" ]]; then
  echo '- None'
else
  while IFS= read -r file; do printf -- '- `%s`\n' "$file"; done <<< "$overlap"
fi
echo
echo "Review the commits and evidence before cherry-picking or merging. This command does not change main or deploy."
