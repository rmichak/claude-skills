#!/bin/bash
# pixel-test.sh <project> <real.png> <at-seconds> [out-dir]
# The end-to-end pixel test: build the project, render the frame at <at> with HyperFrames exactly as the video
# will be rendered (compare overlays hidden), crop the VS Code window, and diff it against a REAL capture of the
# same state (tools/state.mjs ... focus shot=...). Prints match % at four tolerances (0 = bit-exact)
# + flat-area defects + identical_pct / max_diff. d0-heat.png marks every pixel that differs at all.
set -euo pipefail
PROJ="$(cd "$1" && pwd)"; REAL="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"; AT="$3"; OUT="${4:-$PROJ/qa/pixel-test}"
HERE="$(cd "$(dirname "$0")" && pwd)"; HF="${HF_BIN:-$HOME/.npm/_npx/702923228c2ce1e6/node_modules/.bin/hyperframes}"
mkdir -p "$OUT"; cd "$PROJ"
LAB_DRAFT=1 node build-demo.mjs > "$OUT/build.log" 2>&1
cp index.html "$OUT/index.full.html"
python3 - <<'PY'
s=open('index.html').read(); open('index.html','w').write(s.replace('</style>','.cmp-seam,.cmp-real,.cmp-heat,.cmp-stat{display:none !important}</style>',1))
PY
"$HF" snapshot . --at "$AT" --no-end -o "$OUT/snap" --timeout 60000 > "$OUT/snap.log" 2>&1
cp "$OUT/index.full.html" index.html
python3 -c "
from PIL import Image; import glob
f=sorted(glob.glob('$OUT/snap/frame-*.png'))[0]; Image.open(f).convert('RGB').crop((110,62,1810,934)).save('$OUT/generated.png')"
for T in 24 6 2 0; do echo "TOL=$T $(TOL=$T python3 "$HERE/diff.py" "$REAL" "$OUT/generated.png" "$OUT/d$T" editor 6 | tail -1)"; done
