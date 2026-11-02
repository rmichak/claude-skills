# diff.py <real.png> <mock.png> <out-prefix> [state] - pixel diff of the VS Code window, per region.
# A pixel "differs" when any channel is off by more than TOL (TOL=0: any difference at all). The window frame
# (rounded corners, hairline) and the native traffic lights are masked: the real capture is the page, not the frame.
import sys, json
from PIL import Image, ImageChops
real, mock, out = sys.argv[1:4]
state = sys.argv[4] if len(sys.argv) > 4 else "editor"
import os
TOL = int(os.environ.get("TOL", 24))
a = Image.open(real).convert("RGB"); b = Image.open(mock).convert("RGB")
assert a.size == b.size, (a.size, b.size)
W, H = a.size
d = ImageChops.difference(a, b)
px = d.load(); A = a.load()
# regions in logical px (x0,y0,x1,y1) - the window is WL x 436 drawn at 2x (850 by default; the kit's windowWidth).
# MM = the minimap's width (62 at the default; vscode-window.mjs vscGeom), PANEL_TOP = the panel's top edge
WL = W // 2; MM = float(os.environ.get("MM", 62)); PT = float(os.environ.get("PANEL_TOP", 114)); EX = WL - MM - 14
R = {"titlebar": (0, 0, WL, 35), "activity": (0, 35, 48, 414), "sidebar": (48, 35, 248, 414), "tabs": (248, 35, WL, 70),
     "breadcrumb": (248, 70, WL, 92), "status": (0, 414, WL, 436)}
if state == "term": R.update({"editor": (248, 92, EX, PT), "panel": (248, PT, WL, 414)})
else: R.update({"editor": (248, 92, EX, 414), "minimap": (EX, 92, WL, 414)})
R = {k: tuple(int(v) for v in r) for k, r in R.items()}
mask = lambda x, y: x < 2 or y < 2 or x >= W - 2 or y >= H - 2 or (x < 150 and y < 70) or (x < 40 and y > 830) or (x > W - 40 and y > 830) or (x > W - 40 and y < 40)  # traffic lights (native) + rounded corners
heat = Image.eval(a, lambda v: v // 3).copy(); H2 = heat.load()
res = {}
for name, (x0, y0, x1, y1) in R.items():
    n = bad = 0
    for y in range(y0 * 2, min(y1 * 2, H)):
        for x in range(x0 * 2, min(x1 * 2, W)):
            if mask(x, y): continue
            n += 1
            if max(px[x, y]) > TOL:
                bad += 1; H2[x, y] = (255, 40, 40)
    res[name] = round(100 * (1 - bad / max(n, 1)), 2)
tot = sum(1 for y in range(H) for x in range(W) if not mask(x, y))
badall = sum(1 for y in range(H) for x in range(W) if not mask(x, y) and max(px[x, y]) > TOL)
res["ALL"] = round(100 * (1 - badall / tot), 3)
# what the test skips (native traffic lights, window frame) is tinted slate blue, so a viewer can see it isn't counted
for y in range(H):
    for x in range(W):
        if mask(x, y):
            r0, g0, b0 = H2[x, y]; H2[x, y] = (int(r0 * 0.3 + 60 * 0.7), int(g0 * 0.3 + 84 * 0.7), int(b0 * 0.3 + 140 * 0.7))
heat.save(out + "-heat.png")
cells = {}
for y in range(H):
    for x in range(W):
        if not mask(x, y) and max(px[x, y]) > TOL: cells[(x // 20, y // 20)] = cells.get((x // 20, y // 20), 0) + 1
top = sorted(cells.items(), key=lambda kv: -kv[1])[:int(sys.argv[5]) if len(sys.argv) > 5 else 12]
print("worst cells (logical x,y):", " ".join(f"{cx*10},{cy*10}:{n}" for (cx, cy), n in top))
Image.fromarray if False else None
# side-by-side strip for eyeballing: real | mock
sb = Image.new("RGB", (W, H * 2)); sb.paste(a, (0, 0)); sb.paste(b, (0, H)); sb.save(out + "-pair.png")
# flat-area mismatches: a pixel off by more than 6 where the REAL image is flat around it (no edge within 1px)
# cannot be antialiasing; it is a wrong color or a missing/misplaced line. These are the defects that matter.
G = a.convert("L").load()
flat = []
for y in range(1, H - 1):
    for x in range(1, W - 1):
        if mask(x, y) or max(px[x, y]) <= 6: continue
        n = [G[x + i, y + j] for i in (-1, 0, 1) for j in (-1, 0, 1)]
        if max(n) - min(n) <= 3: flat.append((x, y))
res["flat_bad_px"] = len(flat)
# exact numbers, independent of TOL: share of pixels identical bit for bit, and the largest difference anywhere
diffs = [max(px[x, y]) for y in range(H) for x in range(W) if not mask(x, y)]
res["identical_pct"] = round(100 * sum(1 for v in diffs if v == 0) / len(diffs), 3)
res["max_diff"] = max(diffs)
if flat:
    from collections import Counter
    c = Counter((x // 20 * 10, y // 20 * 10) for x, y in flat)
    res["flat_bad_cells"] = " ".join(f"{k[0]},{k[1]}:{v}" for k, v in c.most_common(8))
print(json.dumps(res))
