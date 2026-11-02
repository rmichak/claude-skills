#!/usr/bin/env bash
# new-lab.sh — scaffold a lab walkthrough project from the lab kit.
#   bash new-lab.sh <project-name> [parent-dir]
# Where it goes: $DEST if set (the exact project folder), else <parent-dir>/<project-name>, else
# $OUT_DIR/<project-name>, else ./<project-name> in the current directory.
# It copies the patched build, template, fonts, helpers, TTS scripts, QA editor + words gate (qa/lib/), EDITOR.md,
# and an example spec as a starting point (replace CODE + beats). The default example is the extended two-file
# "Modular Security Toolkit" walkthrough; pick another with STARTER=threat-log | lesson | security-toolkit.
set -euo pipefail
NAME="${1:?usage: new-lab.sh <project-name> [parent-dir]}"
KIT="$(cd "$(dirname "$0")" && pwd)"
ASSETS="$(dirname "$KIT")"
SKILL="$(dirname "$ASSETS")"
PARENT="${2:-${OUT_DIR:-$PWD}}"
DEST="${DEST:-$PARENT/$NAME}"
case "${STARTER:-security-toolkit}" in
  security-toolkit) SPEC="$KIT/example-lab-security-toolkit.spec.mjs" ;;
  threat-log) SPEC="$KIT/example-lab-threat-log.spec.mjs" ;;
  lesson) SPEC="$KIT/lesson-starter.spec.mjs" ;;
  *) echo "unknown STARTER=${STARTER} (security-toolkit | threat-log | lesson)" >&2; exit 1 ;;
esac
[ -e "$DEST" ] && { echo "exists: $DEST" >&2; exit 1; }
mkdir -p "$DEST"/{audio,renders,qa,fonts}
cp "$ASSETS/build-demo.mjs" "$ASSETS/template.html.src" "$DEST/"
cp "$ASSETS/fonts/"*.woff2 "$DEST/fonts/"
# the VS Code window (measured from the real app) + its fonts/images/theme/minimap atlas; the Mac's SF + Menlo are
# copied into vscode/ by build-demo.mjs at build time (Apple fonts stay local, never in the skill)
mkdir -p "$DEST/vscode" && cp "$ASSETS/vscode/"{codicon.ttf,seti.woff,letterpress-dark.svg,tlights.svg,tlights-edited.svg,pointer.svg,minimap-atlas-2x.hex,vscode-window.css,vscode-window.mjs} "$ASSETS/vscode/"theme-*.css "$DEST/vscode/"
mkdir -p "$DEST/qa/lib" && cp "$KIT/check-marks.mjs" "$KIT/pick-take.mjs" "$DEST/qa/" && cp "$KIT/lab-helpers.mjs" "$KIT/repl_harness.py" "$KIT/tts-eleven-beats.mjs" "$KIT/tts-kokoro-beats.mjs" "$KIT/finish-lab.mjs" "$KIT/qa-editor.mjs" "$KIT/EDITOR.md" "$DEST/"
# the narration words gate + lint (tts-eleven-beats.mjs and qa-editor.mjs load it from qa/lib/)
cp "$SKILL/engine/qa/gate.mjs" "$SKILL/engine/qa/narration.cjs" "$DEST/qa/lib/"
cp "$SPEC" "$DEST/demo.spec.mjs"
cat > "$DEST/hyperframes.json" <<'JSON'
{
  "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
  "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  "paths": { "blocks": "compositions", "components": "compositions/components", "assets": "assets" }
}
JSON
printf '{ "name": "%s", "private": true, "type": "module" }\n' "$NAME" > "$DEST/package.json"
printf '{ "id": "%s", "name": "%s" }\n' "$NAME" "$NAME" > "$DEST/meta.json"
echo "created $DEST"
echo "next: ${LAB_NEXT:-save the assignment text into qa/assignment.txt, then edit demo.spec.mjs (CODE, beats, file, qa)}"
echo "then:  node $ASSETS/vscode/tools/tokens.mjs <program files>   (real VS Code colors -> qa/vscode-tokens.json)"
