# The VS Code window: a measured copy of the real app

Since 2026-10-15 the editor window in every code-demo and lab video isn't a drawing of VS Code. It's the real
app, measured element by element and rebuilt. It's then checked with a pixel diff against real captures, and the
HyperFrames render of the window is **bit-identical** to the real app:

| State (reference capture) | Compared | Identical | Largest difference |
|---|---|---|---|
| editor: `port_check.py`, cursor 1:1, focused (`real-editor-focused.png`) | whole window | **100%** (1,457,733 px) | **0/255** |
| Explorer New File name box, "hello.py" typed (`real-explorer-name-box.png`) | sidebar (that capture is unfocused) | **100%** | **0/255** |
| zsh terminal after `python3 port_check.py` (`real-terminal.png`) | whole window | 99.86% (panel 100%) | 1/255, status bar text only |

The terminal state's last 1/255 is the real app's own variance. Its two captures (editor and terminal) differ from
EACH OTHER by exactly this ±1 on the status-bar text. Ours matches the editor capture bit for bit.

The masked areas are the native traffic lights and the window frame (16pt rounded corners, hairline, shadow). The
references are DevTools page captures, and macOS draws the frame, not VS Code. Those parts are AppKit's own renders
and measurements (`tools/tlights.swift`, `radius.swift`). `pixel-test.sh` can render a proof-of-concept video with a
live real/generated wipe and the diff heatmap, which has no red.

## Font sizes and window widths (2026-10-18)

`editorFontSize`, `terminalFontSize` and `windowWidth` (spec-format.md) are the app's own settings, measured in a
second throwaway VS Code at each size (`tools/geom.mjs`, 6 editor points: 14/13/12 × 850/920; 12 terminal points:
14/13/12 × panel 266/200/160/140; widths 850–920 for the title and panel bars):

| editor.fontSize | line height | gutter (glyph + numbers + folding) | Monaco char width | minimap at 850 / 920 |
|---|---|---|---|---|
| 14 | 21 | 72 = 21 + 25 + 26 | 8.4296875 | 62 / 69 |
| 13 | 20 | 69 = 20 + 23 + 26 | 7.828125 | 66 / 74 |
| 12 | 18 | 66 = 18 + 22 + 26 | 7.2265625 | 71 / 79 |

| terminal.integrated.fontSize | xterm row | columns at 850 / 920 | rows' letter-spacing at 850 / 920 |
|---|---|---|---|
| 14 | 16 | 67 / 75 | 0.00412 (the CSS keeps its render-tested 0.0041) / −0.00204 |
| 13 | 15 | 72 / 81 | 0.00667 / 0.00050 |
| 12 | 14 | 78 / 88 | 0.00616 / 0.00266 |

The terminal's numbers all come from Menlo's advance, `size × 1233/2048` (what VS Code and xterm measure with canvas
`measureText`): VS Code gives xterm `floor(width / advance)` columns; xterm's DOM renderer makes a row
`round(advance × cols)` px wide, a cell that / cols, and sets the rows' **letter-spacing to cell − advance**. So the
spacing changes with the window width (it looked random until this: 0.00616 and 0.00266 at 12 are the 850 and 920
windows), and the formula reproduces every value the app reported, to 8 decimals. A one-character span (the prompt's
first cell) is the cell ceiled to 1/64 px (8.4375 / 7.84375 / 7.234375).

What follows from them (`vscode-window.mjs`: `EDITOR_FONT`, `TERMINAL_FONT`, `vscGeom`, `geomCSS`; the CSS reads
variables on `.vsc`, whose defaults are the 14 / 14 / 850 numbers, so the default window is unchanged):
- **The terminal size is its own setting.** Unset, it stays 12 on macOS whatever `editor.fontSize` is (checked at
  editor 12, 13, 14). The reference profile sets 14, hence the kit default.
- **Minimap width** is Monaco's formula, `floor((editor − gutter − 14 − 2) / (charWidth + 1)) + 8`: text and minimap
  share the width by character width, so a smaller font or a wider window widens the minimap. It matches all six
  points. Everything right-anchored at it follows: the current-line band, callouts (right = minimap + 20), the
  minimap mark, the character limit.
- **Glyph-margin icons** (the debugger's arrow, breakpoints) stay 16 px, centered in the lineHeight-wide margin:
  left 2.5 at 14, 1 at 12. Sticky-scroll rows are one line height; the gutter and the minimap edge don't change.
- **The shell-integration dot** is a 16 px box whose line-height is the row (14 at terminal 12): at 16 it drew the
  glyph a pixel low (161/255 in the first terminal-12 test).
- **The TERMINAL tab's underline** is the label's own box, 59.609 wide. Our label is 1/64 px wider, so `right: 10px`
  rounded to 60 px; the old `right: 11px` only drew 59 at the default tab position. The CSS sets the real width, which
  rounds like the app's: 420–479 at 850, 539–598 at 920 (it drew 58 there before).
- **xterm sits at the bottom of the panel.** Its first row starts at `35 + (panelHeight − 35) mod rowHeight`, and
  the leftover is above it: 42 at 266 (the reference state), but **40 at the default 200 and 43 maximized**, where the
  kit used to draw a fixed 42. Measured at every point above; the kit now follows it (`termTop`).
- **The title bar:** the command center is `38vw + 2` wide (Chrome floors it to 1/64 px), centered 26 px right of the
  window's middle; back/forward sit 58 and 32 left of it; the four layout controls are right-anchored. Checked at 850,
  885, 903 and 920.
- **The panel's tabs:** VS Code's CompositeBar shows as many as fit in `panel − 16 − 238.36` (the toolbar), keeps the
  active TERMINAL, and charges 44 (`overflowActionSize`) for the `···` it draws 26 wide. Ported as `panelTabs()`:
  PROBLEMS OUTPUT TERMINAL ··· up to 898, + DEBUG CONSOLE from 899, all five (no ···) from 916, exactly the
  thresholds measured.
- The window stays centered on the canvas at its height; 920 (1840 px at x 40) is the widest, leaving the frame's
  shadow and the corner labels room. The pause card shrinks the window to keep the card's 20 px gap (0.74 → 0.72).

Proof, three more reference states (`state-test.sh editor13 editor12 terminal12`):

| State (reference capture) | Identical | Largest difference |
|---|---|---|
| editor13: bmi.py at 13, 850 window (`real-editor-13.png`) | **100%** | **0/255** |
| editor12: bmi.py at 12, 920 window, 17 rows + 16 px of the 18th (`real-editor-12-w920.png`) | **100%** | **0/255** |
| terminal12: the 200 panel at terminal 12, 920 window, all five tabs (`real-terminal-12-w920.png`) | 99.979% (panel 100%) | 1/255, activity bar only |

The terminal12 ±1 is the app's own variance again: its editor and terminal captures differ by exactly those 338 px
(the `···` and Accounts icons, re-composited when the panel opens). Ours matches the editor capture there.

## What it copies (VS Code 1.138, macOS 26 Tahoe, theme Dark 2026, editor.fontSize 14, Retina 2x)

| Part | Source of truth |
|---|---|
| Geometry | every box is measured from the live DOM (`tools/measure.mjs`, `tools/look.mjs`). Title 35, activity 48, sidebar 200, tabs 35, breadcrumbs 22, gutter 72 (glyph 21 + numbers 25 + folding 26), Menlo 14/21, minimap 62, overview ruler 14, status 22. Terminal: rows 16, xterm at the panel's bottom (text 42 below the panel top at 266, 40 at 200), letter-spacing 0.0041px (xterm's cell − Menlo's advance: 0.00412 at 67 columns; it changes with the column count, see "Font sizes and window widths"), the prompt's first char in its own 8.4375px cell span |
| Scale | the window is 850×436 logical px drawn 2x by `.vsc-z { transform: scale(2) }`, exactly like a Retina screen. Output is the old 1700×872 window slot, so captions, labels and cards did not move |
| Colors | the running app's `--vscode-*` variables (`vscode/theme-dark-2026.css`, made by `tools/theme-css.mjs`), plus derived FLAT colors for what the app paints on canvases (ruler cursor mark, terminal "running" mark) |
| Icons | VS Code's own `codicon.ttf` and `seti.woff`, with code points read from the app (`tools/glyphs.mjs`) |
| Fonts | the Mac's own SF (`/System/Library/Fonts/SFNS.ttf`) and Menlo Regular, copied into the project's `vscode/` at build time (never stored in the skill), plus Apple's SF tracking by size (13px −0.076, 12px 0, 11px +0.065) |
| Text rendering | macOS font smoothing as in the app: HyperFrames injects `text-rendering: geometricPrecision` on every element, which the window overrides (`.vsc-z * { text-rendering: auto }`) |
| Compositing | where the app draws in its own layers, so do we: the title-bar layout controls, the Manage gear, xterm's text rows. A glyph blended in a transparent layer rounds its edges differently by ±1. Use `will-change: opacity`, **never `transform`** (see gotchas) |
| Minimap | **Monaco's own minimap renderer**, ported to the page runtime. It uses the prebaked 2x character atlas (`minimap-atlas-2x.hex`, decoded and softened ×12/15 like `MinimapCharRenderer`), 2×4 device-px cells and token colors blended into the background on a canvas. The canvas has `opacity: 0.9`, and the minimap has no background of its own, so the current-line band shows through it as in the app |
| Window frame | macOS 26: 16pt corners, and traffic lights rendered by AppKit itself (`tools/tlights.swift`), placed where VS Code puts them (x 11, y 10) |
| Code colors | **read from VS Code itself** (`tools/tokens.mjs` → `qa/vscode-tokens.json`): TextMate + Pylance semantic tokens + bracket-pair colors. A segment is `[class, text]`, or `[class, text, baseHex]` when a decoration (bracket pair) recolors it: the minimap draws the base token color, as Monaco does. The tokenizer in `lab-helpers.mjs` is only a fallback |
| Behavior | real UI states, not effects (see below) |

### Behavior (what gives a fake away in motion)

- **Pointer and Explorer.** The macOS arrow pointer (AppKit's own image) moves to the Explorer and onto New File,
  then clicks. It hides when typing starts, as macOS does. Explorer hover actions and the inline New File box work
  as in the app, and the box's icon turns into the language icon when the extension is typed.
- **Typing.**
  - Auto-indent: the leading spaces arrive with Enter.
  - Auto-closing brackets and quotes appear after the cursor and are typed over by the closer (VS Code's
    autoCloseBefore rules).
  - Human rhythm: deterministic per-key swings, short pauses after spaces and punctuation, a **0.15–0.3 s
    hesitation before a bracket or quote**, and 0.08–0.15 s before a closer, `_` or `.`. The time is won back by
    typing the plain keys faster, but never closer than 50 ms apart, so every line still ends on schedule. The same
    rhythm applies to the Explorer name box and to terminal commands.
  - Ln/Col updates on every keystroke.
- **Unsaved file.** The tab's unsaved dot shows from the first edit until a `{do:"save"}` (Cmd+S). It carries across
  cuts until then, and the build warns if a file is run while unsaved. `{do:"save", all:true}` saves every file,
  which is what VS Code does when a debug session starts (`debug.saveBeforeStart`). While the file is unsaved you also get the "1" badge on the Explorer icon and macOS's
  document-edited dot in the red close button (AppKit's render).
- **Cursor** (measured, `editor.cursorBlinking: "blink"`).
  - It's solid for 0.5 s after any change, then flips every 0.5 s for as long as it's idle, at any gap length.
  - The next keystroke makes it solid again, whatever the phase.
  - It's a thin 2px cursor, with the current-line highlight and the active line number.
- **New file.** A new file has only line 1, with the caret at 1:1, and lines appear as Enter makes them (typing a
  blank line, `T(n)` of an empty CODE line, is pressing Enter).
- **Paste.** A paste is an edit: the unsaved dot and badge appear, and the caret and current line jump to the end
  of the pasted text, where VS Code leaves them.
- **Editor extras.** Indent guides. A minimap that fills in as you type. Sticky scroll plus the scroll shadow when a
  view starts inside a block.
- **Terminal.**
  - The panel opens instantly and the editor shrinks; Maximize Panel Size is `terminalMax`.
  - zsh with the stock macOS prompt.
  - The typed command goes into the prompt's own text node, as in xterm.
  - One line at a time, like a person at a real prompt. The next prompt (`>>>`, `...`, the shell prompt) appears
    when Enter ends the previous line, or right after the output, and the previous line's cursor goes with it.
    Typing that would overlap waits for that Enter, and output never shows before its command is typed. A
    paste-speed block (≥ 60 cps, or `paste: true`) shows all its lines at once, as a real REPL shows a paste.
  - Rows wrap at xterm's column count (67 at the default layout), so long output and the Python banner wrap like
    the real terminal. Mark boxes and the output ring follow the wrapped rows.
  - The block cursor doesn't blink and stays while the terminal has focus. The prompt comes back right after the
    output.
  - Shell-integration dots: hollow while running, blue when done, red on a traceback. Each has an overview-ruler mark.
- **Debugger.** Steps show the yellow stack-frame line plus the arrow, and the caret and status-bar Ln move to that
  line (VS Code opens the frame with the selection there). Variables use the real debug pane: Menlo 11,
  `name: value`, a blue flash when a value changes, and long values end in "…".
- **Empty editor.** The letterpress watermark and a bare status bar.

Annotations stay annotations: red mark boxes, gold callouts, pause and steps cards, output rings. They're drawn
in the window's logical px so they scale with it.

## Files

- `assets/vscode/vscode-window.css` is the window CSS, in the real app's logical px. Don't tune it by eye.
- `assets/vscode/vscode-window.mjs` holds `vscWindowHTML()` (the DOM), `ICON`, `FILE_ICON`, `GEOM` and `ensureSystemFonts()`.
- `assets/vscode/theme-dark-2026.css` holds the dumped colors plus the derived flat canvas colors. For another
  theme, dump it (below) and set `spec.vscodeTheme`.
- `assets/vscode/minimap-atlas-2x.hex` is Monaco's prebaked minimap font. The build inlines it into the runtime.
- `assets/vscode/codicon.ttf`, `seti.woff`, `letterpress-dark.svg`, `tlights.svg`, `tlights-edited.svg` and
  `pointer.svg` are copied into each project by `new-lab.sh`.
- `assets/vscode/reference/` holds the real captures, the ground truth for the tests and for reviewers. They are not
  shipped with the skill: capture them once with your own VS Code (`reference/README.md`).
- `assets/vscode/tools/` is the measuring and testing kit (below).

## The measuring kit (`assets/vscode/tools/`)

The measuring tools drive a **throwaway VS Code** through its DevTools port 9339. `launch.sh` starts it with:
- its profile in `~/.cache/vscode-pixel-ref`, never your own settings
- Dark 2026, AI features off, no welcome pages
- Python and Pylance cloned from `~/.vscode/extensions`
- the stock macOS zsh prompt, a solid cursor for deterministic shots, and `--force-color-profile=srgb`

`stop.sh` quits only that instance. The tests need no VS Code.

To measure without disturbing that instance (lesson builds use it for `tokens.mjs`), run a second one with its own
profile and port: `VSCODE_REF_HOME=~/.cache/vscode-pixel-ref-size VSCODE_REF_PORT=9341 tools/launch.sh <folder> <file>`.
Every tool reads `VSCODE_REF_PORT` (and `state.mjs focus` the profile), its `settings.json` is yours to change
(`editor.fontSize`, `terminal.integrated.fontSize`), and `VSCODE_REF_W=920` makes the window wider. Stop it with the
same two variables in front of `stop.sh`.

| Tool | Does |
|---|---|
| `tokens.mjs <file>...` | real token colors for every line → `qa/vscode-tokens.json`. Run it in every lab, after the programs exist |
| `state.mjs <steps>` | puts the app into a state and screenshots it: `nopanel`/`panel`, `sidebar=200`, **`panelh=200`** (drags the panel's sash to that height), `open:<file>`, `cmd:<palette command>`, `type:`, `enter`, **`key=Meta+ArrowUp`** (a chord), `click=x,y`, `park`, `wait=ms`, **`focus`** (really activates the window: `activate <pid>`), `shot=out/x.png` |
| `geom.mjs` | the editor and terminal geometry at the app's current settings (line height, gutter parts, char width, minimap, cursor, guides, sticky rows, xterm row/cell/top/columns, title bar): the numbers behind `EDITOR_FONT` / `TERMINAL_FONT` |
| `measure.mjs <tag>` | dumps theme vars, every visible element's box and computed style, the CSS and the DOM to `out/` |
| `look.mjs <selector>...` | computed style and box of one element (and its ::before/::after) |
| `glyphs.mjs` | every codicon/seti glyph in view, with its code point and color |
| `theme-css.mjs <vars.json> <name>` | writes `theme-<name>.css` with the variables the window CSS uses, plus the derived flat colors |
| **`state-test.sh [editor\|terminal\|namebox\|editor13\|editor12\|terminal12\|all]`** | **the regression test**. It builds each reference state in a fresh temp project from the current kit, behind a title scene so it ENTERS with a zoom like a real video. It renders through the real render path (PNG sequence, one worker that lives through the whole timeline) and diffs the frame against `reference/`. Expect editor 100%/0, namebox 100%/0, terminal ≥99.85%/1 (status ±1, see above), editor13 and editor12 100%/0, terminal12 ≥99.97%/1 (activity bar ±1) |
| `pixel-test.sh <project> <real.png> <at>` | a quick check of a project's own compare scene (the POC): build, snapshot the frame at `<at>` (overlays hidden), crop, diff at 24/6/2/0 tolerance. A snapshot loads the page fresh at `<at>`, so it can't see render-path bugs. Gate claims on `state-test.sh` |
| `diff.py real.png gen.png out [state] [n]` | the diff itself: per-region match %, worst cells, heatmap (`TOL=0` marks every pixel that differs at all), `flat_bad_px`, `identical_pct`, `max_diff` |
| `tlights.swift`, `radius.swift`, `activate.swift`, `pointer.swift` | macOS-side truths without Screen Recording permission: the traffic lights and pointer rendered by AppKit, the window corner radius, real focus |

## Re-measuring (a VS Code update, another theme, another font size)

1. Run `tools/launch.sh <folder> <file>`. Then, in a scratch dir, run
   `node tools/state.mjs nopanel sidebar=200 click=330,100 park focus shot=out/ref.png`.
   Re-capture the `reference/` states the same way: `panel`, `type:`, `enter`, the New File click.
2. Run `node tools/measure.mjs editor`, and `look.mjs` on anything that moved. Change `vscode-window.css` to the
   measured numbers.
3. Run `node tools/theme-css.mjs out/editor-vars.json dark-2026` after any CSS change that uses a new variable.
4. Run `tools/state-test.sh all` until every state is back to the numbers above. Read `max_diff`, not only the
   match %: one flipped glyph is a real bug.

## Gotchas learned building it (each one cost a round)

- **HyperFrames swaps system fonts.** Its compiler puts "Inter" in front of any generic primary (`-apple-system`)
  and maps SF Pro, SF Mono and Courier New to web look-alikes. So the window uses named families ("VSC UI",
  "VSC Mono") with `@font-face` pointing at the Mac's own font files.
- **HyperFrames injects `html,body,*{text-rendering:geometricPrecision}`.** That turns off macOS font smoothing,
  which left about 12% less ink than the app. `.vsc-z, .vsc-z * { text-rendering: auto }` brings it back exactly.
  An earlier `-webkit-text-stroke` workaround only approximated it, so it's gone. Plain headless Chrome doesn't
  inject this, so test on HyperFrames renders (`state-test.sh`, `pixel-test.sh`), never in a bare browser.
- **Layers change glyph edges by ±1.** The app draws some things in their own transparent compositing layers: the
  title-bar layout controls, the Manage gear, xterm's rows. Mirror that with `will-change: transform` on exactly
  those. Don't put it on things with an opaque background, like the status bar (that broke the text).
- **`will-change: transform` freezes a layer at the size it was first drawn.** Every scene is first drawn
  pre-scaled for its entrance (a 0.55× zoom), and the pause card shrinks the window to 0.74×. So in the video the
  layered icons stayed blurred: up to 74/255 off, EDITOR round 6. A fresh-load snapshot draws them sharp, which is
  why the snapshot test passed. `will-change: opacity` gives the same layer and is re-rastered at the current
  scale. Test layers only with `state-test.sh`, which renders sequentially with one worker; a short multi-worker
  render can start mid-scene and hide the bug.
- **Text fragments.** Two DOM text nodes are two fragments. The second starts at a LayoutUnit-snapped x, which can
  move a later glyph to another quarter-pixel position. Keep text that is one run in the app as one node: the
  terminal prompt plus the typed command (`typeInto` `pre`), and xterm's first-cell span.
- **Inside the 2x subtree, boxes snap to whole CSS px.** Use gradients for half-px (= device-px) lines and
  offsets: ruler border, cursor mark, terminal marks.
- **Chrome dithers gradients whose colors aren't integers.** That includes color-mix() results and translucent
  colors over a background. The app paints those on canvases as flat colors. Precompute the exact blended colors
  per theme (`theme-css.mjs`: `--vsc-ruler-cur*`, `--vsc-trm-run`).
- **GSAP `steps(1)` jumps in the MIDDLE of a tween** (it's `(2p|0)`). A 0.5 s steps(1) yoyo blink flips 0.25 s
  after it starts, which is why the cursor went dark 0.25 s early through EDITOR round 5. `blinkSpan` starts the yoyo
  0.25 s late.
- **HyperFrames lint counts `clip-path` as a heavy overlay.** About 40 heavy overlays capture as black frames. Never
  put one on every line; use `overflow: hidden` (the code text clips at the content edge, as in Monaco).
- **Real focus matters.** An unfocused VS Code draws the title and status bars in `#121314`; a focused one uses
  `#191a1b`. Capture references with `state.mjs ... focus`. CDP focus emulation isn't enough, because VS Code takes
  window focus from its native side.
- **sRGB.** Without `--force-color-profile=srgb` the capture is in the display's color space, and saturated colors
  shift (#179fff came out as (83,154,253)).
- **A loose diff hides real bugs.** At tolerance 24, a missing activity-bar border (42 vs 25) passed. Test at
  tolerance 0 and read `max_diff`.
- **`*` doesn't match pseudo-elements.** Box-sizing for `::before/::after` must be set explicitly.
- **Release builds disable Electron's `--inspect`.** The native traffic lights and corner radius come from AppKit
  (Swift) instead, and real focus from `NSRunningApplication.activate`.
- The xterm WebGL canvas doesn't capture in the background, so the reference profile uses the DOM renderer.
- **`visibility: hidden` leaks children.** An element hidden that way still shows any child that sets
  `visibility: visible` inline. Hide whole views with `display: none`.
- **Wipes:** GSAP `clip-path` tweens didn't track the seam in HyperFrames renders. The compare wipe animates the
  width of a wrapper instead.
- **GSAP resolves selector strings when the timeline is BUILT.** A class that moves later (`.vsc-tab-on`) hits the
  wrong element, so target state changes by id (`#scN-tabmain`).
- **clipMode** used to start its first scene hidden (`opacity:0` for any scene starting after 0 s). The first scene
  is now always visible.

## Known nits

- The Explorer name box caret uses Monaco's blink. The app's native `<input>` caret follows the macOS insertion-point
  period, which hasn't been measured.
