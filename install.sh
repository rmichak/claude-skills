#!/usr/bin/env bash
# install.sh — symlink each skill dir in this repo into ~/.claude/skills/
#
# Usage:
#   ./install.sh             # install all skills
#   ./install.sh watch       # install only the named skill(s)
#   ./install.sh watch humanizer
#
# Behavior:
#   - Idempotent: re-running is safe.
#   - If ~/.claude/skills/<name> is already a symlink, it gets replaced.
#   - If ~/.claude/skills/<name> is a real directory (not a symlink), the script
#     refuses to touch it and prints a warning. You decide what to do.
#   - Creates ~/.claude/skills/ if it doesn't exist.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"

mkdir -p "$SKILLS_DIR"

# Auto-discover skills: any top-level dir in the repo with a SKILL.md.
all_skills=()
for d in "$REPO_DIR"/*/; do
  name="$(basename "$d")"
  if [[ -f "$d/SKILL.md" ]]; then
    all_skills+=("$name")
  fi
done

# Pick which skills to install: args override, otherwise install all.
if [[ $# -gt 0 ]]; then
  targets=("$@")
else
  targets=("${all_skills[@]}")
fi

installed=0
skipped=0
replaced=0

for name in "${targets[@]}"; do
  src="$REPO_DIR/$name"
  dest="$SKILLS_DIR/$name"

  if [[ ! -d "$src" || ! -f "$src/SKILL.md" ]]; then
    echo "  skip: $name (no SKILL.md found at $src)" >&2
    skipped=$((skipped + 1))
    continue
  fi

  if [[ -L "$dest" ]]; then
    current="$(readlink "$dest")"
    if [[ "$current" == "$src" ]]; then
      echo "  ok:   $name (already linked)"
      installed=$((installed + 1))
      continue
    fi
    rm "$dest"
    ln -s "$src" "$dest"
    echo "  link: $name (replaced existing symlink: $current -> $src)"
    replaced=$((replaced + 1))
    continue
  fi

  if [[ -e "$dest" ]]; then
    echo "  WARN: $name exists at $dest and is NOT a symlink. Refusing to overwrite." >&2
    echo "        Move or delete it manually, then re-run this script." >&2
    skipped=$((skipped + 1))
    continue
  fi

  ln -s "$src" "$dest"
  echo "  link: $name"
  installed=$((installed + 1))
done

echo
echo "Done. installed=$installed replaced=$replaced skipped=$skipped"
echo "Skills directory: $SKILLS_DIR"
