# The VS Code window — anatomy & rules

The editor scene's window is a **measured copy of the real app** (VS Code 1.138, macOS 26, Dark 2026).
How it was built, how it is tested and how to re-measure it: `vscode-pixel-perfect.md`. The build generates it
from the spec via `vscode/vscode-window.mjs` (`vscWindowHTML`) + `vscode/vscode-window.css`; never hand-edit
the chrome and never "fix it by eye" — re-measure and run `tools/state-test.sh all` (must stay bit-identical).

## Anatomy (logical px; `.vsc-z` draws it 2x into the 1700×872 slot at 110,62; `windowWidth` 920: 1840×872 at 40,62)

```
.vsc                      outer box: macOS window (16pt corners, hairline, shadow); the pause card scales it.
│                         Carries the size variables (--vsc-fs, --vsc-lh, --vsc-gut, --vsc-mm, --vsc-t*): geomCSS()
└── .vsc-z                850×436 (windowWidth × 436), transform: scale(2)
    ├── .vsc-titlebar     35: AppKit traffic lights · ← → · command center (folder) · 4 layout icons
    │                     (.tbp-off/.tbp-on: the panel icon flips when the terminal opens)
    ├── .vsc-body
    │   ├── .vsc-activity 48: Explorer (active) · Search · Source Control · Run and Debug · ··· | Accounts · Manage
    │   ├── .vsc-sidebar  200: EXPLORER ··· · folder pane header (#scN-fhd; .hover shows New File/Folder/
    │   │                 Refresh/Collapse, #scN-newfile) · .sb-files (.sb-row, .main, .active; the inline
    │   │                 name box #scN-fcin) · .dv-panel (VARIABLES pane) · OUTLINE · TIMELINE
    │   └── .vsc-editor
    │       ├── .vsc-tabs       35: .vsc-tabgroup (.vsc-tab-on/.vsc-tab-off, min 120 wide) · ▷⌄ (.vsc-runbtn) ⫿ ···
    │       ├── .vsc-breadcrumb 22: icon · file › …
    │       ├── .vsc-code       Menlo 14/21: .vsc-sticky (pinned headers) · .code-line.cl-N
    │       │                   (.lh-cur / .lh-dbg overlays · .gutter 72 · .code-text · .ig guides · .mk-box)
    │       │                   · .vsc-minimap (.mm-line mirrors, filled while typing) · .vsc-ruler (.rc)
    │       │                   · .vsc-watermark (empty editor)
    │       └── .vsc-terminal   panel (display:none until terminal-open; .max = Maximize Panel Size):
    │                           PROBLEMS OUTPUT TERMINAL ··· | zsh + ⌄ ⫿ 🗑 ··· | ⛶ ✕ · .term-body (rows 16)
    │                           · .term-ruler (command marks)
    └── .vsc-status       22: remote · ⊗0 ⚠0 | Ln/Col (#scN-stK) · Spaces · UTF-8 · LF · {} Python · interpreter · 🔔
```

## What the build derives for you

- **Real colors** for every code line from `qa/vscode-tokens.json` (`tools/tokens.mjs`); the build prints
  `⚠ no real VS Code colors for: …` for any line it had to color with the fallback tokenizer.
- **Files**: Explorer rows (sorted), tabs (in `spec.files` order), breadcrumb and status language all come from
  `spec.file` / `spec.files` / a beat's `file`.
- **Cursor + current line**: the cursor sits on the line being typed (solid while typing, 0.5s blink when idle),
  leaves when the terminal takes focus; the current-line highlight and active line number follow it.
- **Lines exist when they are written**: a new file shows only line 1; a line appears when the cursor reaches it.
- **Indent guides, minimap, overview-ruler cursor mark, sticky scroll** (when `viewTop` is inside a block: the
  enclosing headers are pinned above it, like Monaco), the scroll shadow, the empty-editor watermark.
- **Terminal**: the stock macOS prompt `student@MacBook-Pro <folder> % ` (override: `spec.terminalPrompt`),
  shell-integration dots and ruler marks, block cursor, output appears at once.
- **Status bar** Ln/Col follows typing and debugger steps; interpreter = `spec.statusRight`
  (default `Python 3.14.4 (homebrew)`).

## Space

The editor area is 322 logical px = **15 lines** with no panel. An open terminal panel takes `terminalHeight`
(beat) or `spec.panelHeight` (default **200** → 5 code lines stay visible above it, 10 terminal rows).
`terminalMax: true` maximizes the panel over the whole editor column (REPL sessions). Sticky-scroll rows count
against the 15. **53 characters** fit before the minimap. The build warns when a scene overflows (code lines, terminal
rows, a typed line under the minimap at a pause).

**A longer program** (2026-10-18): set `editorFontSize` 13, then 12, then widen the window with `windowWidth` (up to
920). `terminalFontSize` 12 fits more output. Each is the real app's setting, measured
(`vscode-pixel-perfect.md`), and the build derives everything from it: lines that fit, panel fits, marks, callouts,
the minimap, the pause card's shrink, the warnings.

| `editorFontSize` | `windowWidth` | lines, no panel | above a 200 panel | 160 panel | 140 panel | characters a line |
|---|---|---|---|---|---|---|
| 14 (default) | 850 (default) | 15 | 5 | 7 | 8 | 53 |
| 13 | 850 | 16 | 6 | 8 | 9 | 57 |
| 12 | 850 | 17 | 6 | 9 | 10 | 62 |
| 14 | 920 | 15 | 5 | 7 | 8 | 61 |
| 13 | 920 | 16 | 6 | 8 | 9 | 65 |
| 12 | 920 | 17 | 6 | 9 | 10 | 70 |

The width only adds characters (the window keeps its height); a size adds lines and characters. "Lines" are whole
rows: at 12 the 18th row shows 16 of its 18 px, as in the app. Characters stop at the minimap, which widens with the
window and with a smaller font (Monaco shares the width between them: 62 → 79 px).

| `terminalFontSize` | rows in a 200 panel | 160 | 140 | maximized | columns at 850 | at 920 |
|---|---|---|---|---|---|---|
| 14 (default) | 10 | 7 | 6 | 21 | 67 | 75 |
| 13 | 11 | 8 | 7 | 22 | 72 | 81 |
| 12 | 11 | 8 | 7 | 24 | 78 | 88 |

The terminal size is its own setting: it doesn't follow `editorFontSize`. Wider windows also show more panel tabs, as
the app does: DEBUG CONSOLE from 899, PORTS (and no `···`) from 916.

## Rules

1. **The editor is never rebranded or restyled.** `branding` (a brand.json) touches title/outro/cards only.
2. Annotations (marks, callouts, pause/steps cards, out-rings) are the only non-VS-Code pixels in the window.
3. `white-space: pre` everywhere code is drawn; write real leading spaces in the spec.
4. Long lines are not shrunk — keep code ≤ 53 chars (the table above at other sizes) or split it the way the real
   code would be split; a program that still doesn't fit gets `editorFontSize` 13 → 12, then `windowWidth`.
5. Multi-line terminal output is one `term-out` (`lines: [...]`); output is instant, only humans type.
