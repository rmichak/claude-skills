#!/bin/bash
# launch.sh [folder] [file...] - start a THROWAWAY VS Code (isolated profile, never your own settings) with a
# DevTools port, for measuring the real app and reading real token colors. Reuses a running instance.
# Profile: ~/.cache/vscode-pixel-ref (created on first use: Dark 2026 default theme, AI features off, no
# welcome pages, Python + Pylance cloned from ~/.vscode/extensions, stock macOS zsh prompt, sRGB output).
set -euo pipefail
APP="/Applications/Visual Studio Code.app/Contents/MacOS/Code"
P="${VSCODE_REF_HOME:-$HOME/.cache/vscode-pixel-ref}"
PORT="${VSCODE_REF_PORT:-9339}"
if [ ! -d "$P/ud/User" ]; then
  mkdir -p "$P/ud/User" "$P/ext" "$P/zdot" "$P/ws"
  # newest installed copy of each Python extension (APFS clone: instant, no extra disk)
  for id in ms-python.python ms-python.vscode-pylance ms-python.debugpy ms-python.vscode-python-envs; do
    src=$(ls -d "$HOME/.vscode/extensions/$id-"* 2>/dev/null | sort -V | tail -1 || true)
    [ -n "$src" ] && cp -cR "$src" "$P/ext/"
  done
  echo 'PS1="student@MacBook-Pro %1~ %# "' > "$P/zdot/.zshrc"
  cat > "$P/ud/User/settings.json" <<JSON
{
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "workbench.welcomePage.walkthroughs.openOnInstall": false,
  "workbench.secondarySideBar.defaultVisibility": "hidden",
  "security.workspace.trust.enabled": false,
  "update.mode": "none",
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false,
  "extensions.ignoreRecommendations": true,
  "telemetry.telemetryLevel": "off",
  "chat.disableAIFeatures": true,
  "window.restoreWindows": "none",
  "editor.fontSize": 14,
  "editor.cursorBlinking": "solid",
  "terminal.integrated.fontSize": 14,
  "terminal.integrated.gpuAcceleration": "off",
  "terminal.integrated.defaultProfile.osx": "zsh",
  "terminal.integrated.env.osx": { "ZDOTDIR": "$P/zdot" },
  "git.openRepositoryInParentFolders": "never",
  "python.terminal.activateEnvironment": false
}
JSON
fi
up() { node -e 'fetch("http://127.0.0.1:'"$PORT"'/json/version").then(r=>r.json()).then(()=>process.exit(0)).catch(()=>process.exit(1))'; }
ours() { pgrep -f -- "--user-data-dir=$P/ud --extensions-dir=$P/ext --remote-debugging-port=$PORT" >/dev/null; }
if ours; then
  # hand the files to the running instance (same profile -> it forwards and exits)
  [ $# -gt 0 ] && "$APP" --user-data-dir="$P/ud" --extensions-dir="$P/ext" -r "$@" >/dev/null 2>&1
  exit 0
fi
if up; then echo "port $PORT is taken by something else; set VSCODE_REF_PORT" >&2; exit 1; fi
"$APP" --user-data-dir="$P/ud" --extensions-dir="$P/ext" --remote-debugging-port="$PORT" --force-color-profile=srgb \
  --skip-release-notes --skip-welcome --disable-workspace-trust --new-window "$@" > "$P/code.log" 2>&1 &
for i in $(seq 1 40); do up && { sleep 4; exit 0; }; sleep 1; done
echo "VS Code did not open its DevTools port" >&2; exit 1
