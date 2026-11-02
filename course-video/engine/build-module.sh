#!/bin/bash
# build-module.sh — build a branded, captioned slide lecture for one module (Mode B, batch).
#
#   engine/build-module.sh --course "<course repo>" [options] NN
#   engine/build-module.sh --deck <deck.html> --voiceover <voiceover.md> [--template <dir>] [options] NN
#
# options: [--id <name>] [--out <dir>] [--brand <dir>] [--refresh-source] [--no-render]
#
# Words come from the course repo (they stay there). With --course, the layout is:
#   <course>/content/module-NN/slides/module-NN-slides.html   (the deck, styled by the template's slides.css)
#   <course>/content/module-NN/slides/voiceover.md            (one "## Slide N" or "### Slide N" block per deck page)
#   <course>/content/_template/                               (slides.css + any images the deck links)
# Or point at the files directly with --deck / --voiceover (and --template for slides.css + images).
#
# The build lives in the output folder (--out, else $COURSE_VIDEO_OUT, else ./course-videos):
#   <out>/<id>/mNN-lecture/                     HyperFrames project; deck.html + voiceover-source.md are copied in
#                                               ONCE and then stay frozen
#   <out>/<id>/mNN-lecture/final/mNN-lecture.mp4   the deliverable
# The brand (palette, fonts, respellings) comes from --brand, else $COURSE_VIDEO_BRAND, else the skill's
# example-brand/. Its brand.json is copied into the project on every run.
#
# --refresh-source re-copies the deck and voiceover (and re-freezes script.md). Without it, an existing project
# keeps exactly the words its audio was made from, because TTS skips scenes whose .wav already exists and new text
# would otherwise be paired with old audio.
#
# Pipeline (SKILL.md Mode B): narration split -> Kokoro TTS -> Whisper transcribe ->
#   compose (2x slides, word-by-word captions, code-line highlights) -> lint -> render -> final/.
# Resumable: re-running skips scenes whose .wav / .json already exist.
# Env: KOKORO_VOICE (af_heart), KOKORO_SPEED (0.95), HYPERFRAMES_VERSION (unset = latest).
set -uo pipefail
ENGINE="$(cd "$(dirname "$0")" && pwd)"
SKILL="$(cd "$ENGINE/.." && pwd)"
SCR="$ENGINE/_scripts"
USAGE="usage: build-module.sh (--course <repo> | --deck <file> --voiceover <file> [--template <dir>]) [--id <name>] [--out <dir>] [--brand <dir>] [--refresh-source] [--no-render] NN"
COURSE="" ; DECK="" ; VO="" ; TPL="" ; CID="" ; REFRESH=0 ; RENDER=1
OUT="${COURSE_VIDEO_OUT:-$PWD/course-videos}"
BRAND="${COURSE_VIDEO_BRAND:-$SKILL/example-brand}"
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && { echo "$USAGE"; exit 0; }
while [[ $# -gt 1 ]]; do
  case "$1" in
    --course) COURSE="$2"; shift 2 ;;
    --deck) DECK="$2"; shift 2 ;;
    --voiceover) VO="$2"; shift 2 ;;
    --template) TPL="$2"; shift 2 ;;
    --id) CID="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --brand) BRAND="$2"; shift 2 ;;
    --refresh-source) REFRESH=1; shift ;;
    --no-render) RENDER=0; shift ;;
    -h|--help) echo "$USAGE"; exit 0 ;;
    *) echo "unknown option $1" >&2; echo "$USAGE" >&2; exit 2 ;;
  esac
done
[[ $# -eq 1 && "$1" =~ ^[0-9]+$ ]] || { echo "$USAGE" >&2; exit 2; }
NN=$(printf "%02d" "$((10#$1))")
HF="hyperframes${HYPERFRAMES_VERSION:+@$HYPERFRAMES_VERSION}"
VOICE="${KOKORO_VOICE:-af_heart}" ; SPEED="${KOKORO_SPEED:-0.95}"

if [[ -n "$COURSE" ]]; then
  [[ -d "$COURSE" ]] || { echo "--course must be the course repo folder" >&2; exit 2; }
  COURSE="$(cd "$COURSE" && pwd)"
  SRC="$COURSE/content/module-${NN}/slides"
  DECK="${DECK:-$SRC/module-${NN}-slides.html}"
  VO="${VO:-$SRC/voiceover.md}"
  TPL="${TPL:-$COURSE/content/_template}"
  # "cs101" from ".../CS101SomeCourseRepo"
  [[ -n "$CID" ]] || CID=$(basename "$COURSE" | sed -E 's/^([A-Za-z]+[0-9]+).*/\1/' | tr 'A-Z' 'a-z')
fi
[[ -n "$DECK" && -n "$VO" ]] || { echo "$USAGE" >&2; exit 2; }
[[ -n "$CID" ]] || CID="course"
mkdir -p "$OUT" && OUT="$(cd "$OUT" && pwd)"
PROJ="$OUT/$CID/m${NN}-lecture"
LOG() { echo "[$(date +%H:%M:%S)] [$CID m${NN}] $*"; }

[[ -f "$DECK" ]] || { LOG "MISSING deck: $DECK"; exit 1; }
[[ -f "$VO" ]]   || { LOG "MISSING voiceover (author it first): $VO"; exit 1; }
DECK="$(cd "$(dirname "$DECK")" && pwd)/$(basename "$DECK")"
VO="$(cd "$(dirname "$VO")" && pwd)/$(basename "$VO")"

if [[ ! -f "$PROJ/hyperframes.json" ]]; then
  LOG "Scaffold $PROJ"
  mkdir -p "$(dirname "$PROJ")"
  (cd "$(dirname "$PROJ")" && npx --yes "$HF" init "m${NN}-lecture" --example blank --non-interactive >/dev/null 2>&1)
  [[ -f "$PROJ/hyperframes.json" ]] || { LOG "hyperframes init failed (run: npx --yes $HF doctor)"; exit 1; }
  REFRESH=1
fi
cd "$PROJ"
mkdir -p assets assets/audio narration renders final qa/lib
# the deck's stylesheet + images from the template folder (the deck links them as ../../_template/<file>)
if [[ -n "$TPL" && -d "$TPL" ]]; then
  [[ -f assets/slides.css || ! -f "$TPL/slides.css" ]] || cp "$TPL/slides.css" assets/slides.css
  for f in "$TPL"/*.{svg,png,jpg,jpeg,webp,gif}; do [[ -f "$f" && ! -f "assets/$(basename "$f")" ]] && cp "$f" assets/; done
fi
[[ -f assets/slides.css ]] || LOG "WARNING: no assets/slides.css (pass --template <dir with slides.css>); slides will render unstyled"
cp "$SCR/build-narration.mjs" "$SCR/build-lecture.mjs" "$SCR/tts-eleven.mjs" "$SCR/patch-captions.mjs" .
cp "$ENGINE/qa/gate.mjs" "$ENGINE/qa/narration.cjs" qa/lib/
if [[ -f "$BRAND/brand.json" ]]; then cp "$BRAND/brand.json" brand.json; LOG "Brand: $BRAND"
else LOG "WARNING: no brand.json in $BRAND — using the built-in neutral palette"; fi
if [[ $REFRESH -eq 1 || ! -f deck.html || ! -f voiceover-source.md ]]; then
  LOG "Copy words (deck + voiceover) and freeze script.md"
  cp "$DECK" deck.html
  sed 's/^## Slide/### Slide/' "$VO" > voiceover-source.md
  { printf '# Script (frozen)\n\nThe exact narration this build uses (`voiceover-source.md`). The live text is in: `%s`.\n\n---\n\n' "$VO"; cat voiceover-source.md; } > script.md
else
  LOG "Keeping the frozen deck.html + voiceover-source.md (pass --refresh-source to re-copy)"
fi

NSL=$(grep -c '^### Slide' voiceover-source.md)
LOG "voiceover blocks: $NSL (must equal the deck's top-level .slide pages: SKILL.md B2)"

LOG "Narration"
node build-narration.mjs 2>&1 | sed "s/^/[m${NN}] /"
SCENES=$(ls narration/scene*.txt | sed -E 's#.*scene([0-9]+)\.txt#\1#' | sort)

LOG "TTS (Kokoro $VOICE @$SPEED)"
for nn in $SCENES; do
  out="assets/audio/scene${nn}.wav"
  [[ -s "$out" ]] && { LOG "TTS $nn skip"; continue; }
  npx --yes "$HF" tts "narration/scene${nn}.txt" --voice "$VOICE" --speed "$SPEED" -o "$out" >/dev/null 2>>tts.err \
    || { LOG "TTS $nn FAILED"; tail -3 tts.err; exit 1; }
  LOG "TTS $nn ok"
done

LOG "Transcribe (small.en)"
for nn in $SCENES; do
  dest="narration/scene${nn}.json"
  [[ -s "$dest" ]] && { LOG "TX $nn skip"; continue; }
  npx --yes "$HF" transcribe "assets/audio/scene${nn}.wav" --model small.en >/dev/null 2>>tx.err
  if   [[ -f "assets/audio/transcript.json" ]]; then mv "assets/audio/transcript.json" "$dest"
  elif [[ -f transcript.json ]]; then mv transcript.json "$dest"
  elif [[ -f "assets/audio/scene${nn}.json" ]]; then mv "assets/audio/scene${nn}.json" "$dest"
  elif [[ -f "scene${nn}.json" ]]; then mv "scene${nn}.json" "$dest"; fi
  [[ -s "$dest" ]] || { LOG "TX $nn FAILED"; tail -3 tx.err; exit 1; }
  LOG "TX $nn ok"
done

LOG "Compose"
node build-lecture.mjs 2>&1 | sed "s/^/[m${NN}] /"
LOG "Lint"
npx --yes "$HF" lint 2>&1 | tail -3
[[ $RENDER -eq 1 ]] || { LOG "Stopping before render (--no-render)"; exit 0; }
LOG "Render (standard, workers 2)"
npx --yes "$HF" render --output renders/m${NN}-lecture.mp4 --quality standard --workers 2 2>&1 | tail -8
[[ -s renders/m${NN}-lecture.mp4 ]] || { LOG "RENDER produced no file"; exit 1; }
DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 renders/m${NN}-lecture.mp4)
mv renders/m${NN}-lecture.mp4 "final/m${NN}-lecture.mp4"
LOG "DONE -> $PROJ/final/m${NN}-lecture.mp4  (${DUR}s). Record it wherever you track course videos (e.g. a VIDEOS.md in the course repo)."
