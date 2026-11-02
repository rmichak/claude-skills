#!/bin/bash
# stop.sh - quit the throwaway VS Code (matched by its own profile path; your normal VS Code is untouched)
P="${VSCODE_REF_HOME:-$HOME/.cache/vscode-pixel-ref}"
for pid in $(pgrep -f "user-data-dir=$P/ud"); do kill "$pid" 2>/dev/null; done
# a leftover "save changes?" prompt can block the quit: after 5 s, force it (only this throwaway profile matches)
for _ in 1 2 3 4 5; do pgrep -f "user-data-dir=$P/ud" >/dev/null || break; sleep 1; done
for pid in $(pgrep -f "user-data-dir=$P/ud"); do kill -9 "$pid" 2>/dev/null; done
