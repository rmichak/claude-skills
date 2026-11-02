// terminal state: zsh panel (266pt) after `python3 port_check.py`, cursor on line 1 -> reference/real-terminal.png.
// Line 1 is listed LAST in prefill so the build parks the editor cursor there (state-test.sh fixes Col 42 -> Col 1,
// the real capture's cursor sat at 1:1).
import { createLab, writePrograms } from "./lab-helpers.mjs";
import { PORT_CHECK, BASE } from "./common.mjs";
export const CODE = { ...PORT_CHECK };
const FILES = [{ name: "port_check.py", base: 0 }];
writePrograms(CODE, FILES);
const L = createLab(CODE);
L.B({ id: "title", scene: "title", narration: "state test" }); // the state scene enters with a scale transition, as in a video
L.B(
  { id: "st", scene: "editor", transition: "zoom", file: "port_check.py", viewTop: 1, terminalHeight: 266, narration: "terminal state test",
    prefill: [...L.pre(2, 13), { line: 14, segs: [["", ""]] }, ...L.pre(1, 1)] },
  () => [
    { do: "terminal-open", at: 0.5 },
    { do: "term-type", at: 1, text: "python3 port_check.py", cps: 14 },
    { do: "term-out", at: 3.2, lines: ["Port 443 is well-known"] },
  ]
);
export default { ...BASE, id: "st-terminal", module: "TERMINAL", file: { name: "port_check.py", lang: "python", folder: "pixel-demo" }, files: FILES, beats: L.beats };
