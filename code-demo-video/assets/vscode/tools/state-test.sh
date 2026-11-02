#!/bin/bash
# state-test.sh [editor|terminal|namebox|editor13|editor12|terminal12|all] - the window's pixel test for every reference state.
# For each state:
#   1. Scaffold a throwaway project (a fresh temp dir) from the CURRENT kit.
#   2. Build the state from tools/state-tests/<state>.spec.mjs. A title scene comes first, so the state scene
#      ENTERS with a scale transition like every real video.
#   3. RENDER it through the real render path (hyperframes render, PNG sequence, sequential frames). Don't use a
#      fresh-load snapshot: EDITOR round 6 found compositing layers that a snapshot draws sharp but the
#      sequential render leaves soft.
#   4. Crop the window from the frame at the state time and diff it against the real capture in vscode/reference/.
# Prints identical % and the largest difference (0 = bit-exact). Needs no running VS Code: the token colors ship
# in state-tests/vscode-tokens.json.
#   editor    port_check.py, cursor 1:1, focused         -> real-editor-focused.png       whole window
#   terminal  zsh panel after python3 port_check.py      -> real-terminal.png             whole window
#   namebox   Explorer New File, "hello.py" typed         -> real-explorer-name-box.png    sidebar (capture unfocused)
#   editor13  bmi.py at editorFontSize 13, 850 window     -> real-editor-13.png            whole window
#   editor12  bmi.py at editorFontSize 12, 920 window     -> real-editor-12-w920.png       whole window
#   terminal12 panel 200 at terminalFontSize 12, 920      -> real-terminal-12-w920.png     whole window
# Masked everywhere: the native traffic lights and the window frame (rounded corners, hairline). The real
# captures are DevTools page shots, and macOS's frame isn't part of them.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; VS="$(dirname "$HERE")"; ASSETS="$(dirname "$VS")"; KIT="$ASSETS/lab-kit"
HF="${HF_BIN:-$HOME/.npm/_npx/702923228c2ce1e6/node_modules/.bin/hyperframes}"
WHICH="${1:-all}"; [ "$WHICH" = all ] && STATES="editor terminal namebox editor13 editor12 terminal12" || STATES="$WHICH"
FPS=10
for st in $STATES; do
  P="$(mktemp -d "${TMPDIR:-/tmp}/vscode-state-$st.XXXXXX")"
  mkdir -p "$P"/{audio,qa,fonts,vscode}
  cp "$ASSETS/build-demo.mjs" "$ASSETS/template.html.src" "$KIT/lab-helpers.mjs" "$P/"
  cp "$ASSETS/fonts/"*.woff2 "$P/fonts/"
  cp "$VS/"{codicon.ttf,seti.woff,letterpress-dark.svg,tlights.svg,tlights-edited.svg,pointer.svg,minimap-atlas-2x.hex,vscode-window.css,vscode-window.mjs} "$VS/"theme-*.css "$P/vscode/"
  cp "$HERE/state-tests/common.mjs" "$P/"; cp "$HERE/state-tests/$st.spec.mjs" "$P/demo.spec.mjs"
  cp "$HERE/state-tests/vscode-tokens.json" "$P/qa/"
  printf '{ "paths": { "blocks": "compositions", "components": "compositions/components", "assets": "assets" } }\n' > "$P/hyperframes.json"
  printf '{ "name": "st-%s", "private": true, "type": "module" }\n' "$st" > "$P/package.json"
  printf '{ "id": "st-%s", "name": "st-%s" }\n' "$st" "$st" > "$P/meta.json"
  ffmpeg -v error -y -f lavfi -i anullsrc=r=44100:cl=mono -t 1.5 "$P/audio/vo-01-title.wav"
  ffmpeg -v error -y -f lavfi -i anullsrc=r=44100:cl=mono -t 6 "$P/audio/vo-02-st.wav"
  # AT = seconds into the state beat; X0/X1 = the window's left/right edge on the canvas (850 -> 110..1810, 920 -> 40..1880);
  # MM / PANEL_TOP = the minimap width and the panel's top edge, for diff.py's per-region numbers
  X0=110; X1=1810; MM=62; PANEL_TOP=114
  case "$st" in
    editor) REF="$VS/reference/real-editor-focused.png"; AT=3 ;;
    terminal) REF="$VS/reference/real-terminal.png"; AT=6 ;;
    namebox) REF="$VS/reference/real-explorer-name-box.png"; AT=3.3 ;;  # a lit phase of the caret (the capture shows it)
    editor13) REF="$VS/reference/real-editor-13.png"; AT=3; MM=66 ;;
    editor12) REF="$VS/reference/real-editor-12-w920.png"; AT=3; X0=40; X1=1880; MM=79 ;;
    terminal12) REF="$VS/reference/real-terminal-12-w920.png"; AT=6; X0=40; X1=1880; MM=79; PANEL_TOP=214 ;;
    *) echo "unknown state: $st" >&2; exit 1 ;;
  esac
  # the real captures aren't shipped with the skill: make them once with your own VS Code (vscode/reference/README.md)
  [ -f "$REF" ] || { echo "no reference capture $REF: capture it first (see vscode/reference/README.md)" >&2; exit 1; }
  case "$st" in editor|editor13|editor12) cp "$REF" "$P/real.png" ;; esac
  (cd "$P" && node build-demo.mjs > qa/build.log 2>&1)
  START="$(awk '$2 == "st" { print $4 }' "$P/qa/build.log")"
  # editor: hide the compare overlays (the real half, seam, heatmap, stat), as pixel-test.sh does
  # terminal: the real capture's editor cursor sat at 1:1; the build parks a prefilled cursor at the line end
  (cd "$P" && python3 - "$st" <<'PY'
import sys
s = open("index.html").read()
if sys.argv[1] in ("editor", "editor13", "editor12"): s = s.replace("</style>", ".cmp-seam,.cmp-real,.cmp-heat,.cmp-stat{display:none !important}</style>", 1)
if sys.argv[1] == "terminal": s = s.replace("Ln 1, Col 42", "Ln 1, Col 1")
if sys.argv[1] == "terminal12": s = s.replace("Ln 1, Col 38", "Ln 1, Col 1")
open("index.html", "w").write(s)
PY
  )
  # ONE worker: the page must live through the whole timeline (a worker that starts mid-scene hides layer bugs)
  (cd "$P" && "$HF" render . --format png-sequence --fps "$FPS" --workers 1 -o qa/seq > qa/render.log 2>&1)
  MM="$MM" PANEL_TOP="$PANEL_TOP" python3 - "$st" "$P" "$REF" "$HERE/diff.py" "$START" "$AT" "$FPS" "$X0" "$X1" <<'PY'
import sys, glob, json, os, subprocess
from PIL import Image, ImageChops
st, P, REF, DIFF, START, AT, FPS, X0, X1 = sys.argv[1:10]
frames = sorted(glob.glob(f"{P}/qa/seq/**/*.png", recursive=True))
idx = round((float(START) + float(AT)) * int(FPS))
gen = Image.open(frames[idx]).convert("RGB").crop((int(X0), 62, int(X1), 934))
gen.save(f"{P}/qa/generated.png")
if st != "namebox":
    out = subprocess.run(["python3", DIFF, REF, f"{P}/qa/generated.png", f"{P}/qa/d0", "term" if st.startswith("terminal") else "editor", "6"],
                         env={**os.environ, "TOL": "0"}, capture_output=True, text=True).stdout.strip().splitlines()[-1]
    r = json.loads(out)
    print(f"{st:9s} identical {r['identical_pct']}%  max diff {r['max_diff']}/255  regions {json.dumps({k: v for k, v in r.items() if k not in ('ALL', 'identical_pct', 'max_diff', 'flat_bad_px', 'flat_bad_cells')})}  frame {idx}/{len(frames)}  -> {P}/qa")
else:
    real = Image.open(REF).convert("RGB"); box = (96, 70, 496, 740)
    d = ImageChops.difference(real.crop(box), gen.crop(box)).load(); W, H = box[2] - box[0], box[3] - box[1]
    hover = lambda x, y: 186 <= x <= 240 and 66 <= y <= 116  # New File button: ours still hovered (pointer on it)
    v = [max(d[x, y]) for y in range(H) for x in range(W) if not hover(x, y)]
    print(f"{st:9s} sidebar identical {100 * sum(1 for a in v if a == 0) / len(v):.3f}%  max diff {max(v)}/255  frame {idx}/{len(frames)}  -> {P}/qa")
PY
done
