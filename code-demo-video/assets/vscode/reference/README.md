# Real VS Code captures (ground truth for reviewers and pixel tests)

**The captures themselves are not shipped with the skill.** Make them once with your own VS Code; `tools/state-test.sh`
diffs the kit against them and stops with a clear message when one is missing. Rendering videos does not need them.

The kit was measured against VS Code 1.138, macOS 26, theme Dark 2026, Retina 2x, page captures via the DevTools port
(no macOS traffic lights / rounded corners / shadow — those come from AppKit, see tools/). Unless the table says
otherwise: editor and terminal font 14, an 850x436 pt window.

| File | State | Window focus |
|---|---|---|
| real-editor-focused.png | port_check.py open, cursor 1:1 | **focused** (authority for title/status bar colors #191a1b) |
| real-unsaved-badge-focused.png | an edited, unsaved file: tab dot + "1" badge on the Explorer icon | **focused** |
| real-explorer-hover-newfile.png | pointer on the folder header's New File button | unfocused (bars #121314) |
| real-explorer-name-box.png | the inline name box after New File | unfocused |
| real-terminal.png | zsh panel after `python3 port_check.py` (panel 266pt, editor cursor 1:1) | focused |
| real-editor-13.png | **editor.fontSize 13**, the default 850 window: bmi.py open, cursor 1:1; 16 rows of 20 px | **focused** |
| real-editor-12-w920.png | **editor.fontSize 12, 920x436 window** (1840x872): bmi.py (19 lines) open, cursor 1:1; 17 rows plus 16 of the 18th row's 18 px | **focused** |
| real-terminal-12-w920.png | **editor and terminal.integrated.fontSize 12, 920 window**: zsh panel 200pt after `python3 bmi.py` (11 xterm rows of 14, top 46; all five panel tabs), editor cursor 1:1 | focused |

## The files to have open

The test programs are in `tools/state-tests/common.mjs`, byte for byte: `port_check.py` (`PORT_CHECK`) in a folder
named `pixel-demo` (plus an empty `notes.py` / `hello.py` for the Explorer states), and `bmi.py` (`BMI`) in a folder
named `projects`. Use a generic shell prompt (`student@MacBook-Pro <folder> %`), never your own user or machine name.

## Capturing

Start the throwaway VS Code with `tools/launch.sh` (its own profile, never your settings), open the folder, then
capture each state with `tools/state.mjs ... focus shot=reference/<file>.png`. The size captures (13, 12) use a second
throwaway profile (`VSCODE_REF_HOME=~/.cache/vscode-pixel-ref-size VSCODE_REF_PORT=9341`, `editor.fontSize` /
`terminal.integrated.fontSize` set to 12, or 13 for real-editor-13.png, in its settings.json) with `VSCODE_REF_W=920`
(850 for the 13 capture):
`state.mjs nopanel sidebar=200 click=500,200 key=Meta+ArrowUp park wait=4000 focus wait=1500 shot=...` (the wait lets the
scrollbar slider fade), then `"cmd:Terminal: Kill All Terminals" nopanel panel wait=3000 panelh=200 wait=1500
type:"python3 bmi.py" enter park wait=2500 focus wait=1500 shot=...`. The status bar shows your interpreter version;
set `statusRight` in `tools/state-tests/common.mjs` to match it.

Then `tools/state-test.sh all` diffs the kit against these (editor + name box bit-identical, terminal within 1/255:
the status bar text differs by ±1 between the app's own captures). Re-capture after a VS Code update.

Screenshots of VS Code show Microsoft's product UI; keep your captures local unless you're comfortable redistributing them.
