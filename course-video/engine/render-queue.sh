#!/bin/bash
# render-queue.sh --course "<course repo>" [--out <dir>] [--brand <dir>] NN NN NN ...
# Build module lectures one at a time (avoids CPU/RAM thrash). Skips modules with no voiceover.md yet, and modules
# whose project already has final/mNN-lecture.mp4. Logs to <out>/queue.log.
#
# Example: engine/render-queue.sh --course "$HOME/Courses/CS101" --out "$HOME/Videos/course-videos" 02 03 04
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
USAGE="usage: render-queue.sh --course <repo> [--out <dir>] [--brand <dir>] NN ..."
COURSE="" ; OUT="${COURSE_VIDEO_OUT:-$PWD/course-videos}" ; BRAND_ARGS=()
while [[ $# -gt 0 && "$1" == --* ]]; do
  case "$1" in
    --course) COURSE="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --brand) BRAND_ARGS=(--brand "$2"); shift 2 ;;
    --help) echo "$USAGE"; exit 0 ;;
    *) echo "unknown option $1" >&2; echo "$USAGE" >&2; exit 2 ;;
  esac
done
[[ -d "$COURSE" && $# -gt 0 ]] || { echo "$USAGE" >&2; exit 2; }
COURSE="$(cd "$COURSE" && pwd)"
mkdir -p "$OUT" && OUT="$(cd "$OUT" && pwd)"
CID=$(basename "$COURSE" | sed -E 's/^([A-Za-z]+[0-9]+).*/\1/' | tr 'A-Z' 'a-z')
QLOG="$OUT/queue.log"
say() { echo "[$(date +%F\ %T)] $*" | tee -a "$QLOG"; }

say "=== render-queue start: $CID modules $* ==="
for raw in "$@"; do
  NN=$(printf "%02d" "$((10#$raw))")
  vo="$COURSE/content/module-${NN}/slides/voiceover.md"
  if [[ ! -f "$vo" ]]; then say "m${NN}: SKIP (no voiceover.md yet)"; continue; fi
  final="$OUT/$CID/m${NN}-lecture/final/m${NN}-lecture.mp4"
  if [[ -s "$final" ]]; then say "m${NN}: SKIP (final exists: $final)"; continue; fi
  say "m${NN}: building..."
  if bash "$DIR/build-module.sh" --course "$COURSE" --out "$OUT" ${BRAND_ARGS[@]+"${BRAND_ARGS[@]}"} "$NN" >>"$QLOG" 2>&1; then
    say "m${NN}: DONE ($(du -h "$final" 2>/dev/null | cut -f1))"
  else
    say "m${NN}: FAILED (see queue.log) — continuing to next"
  fi
done
say "=== render-queue complete ==="
