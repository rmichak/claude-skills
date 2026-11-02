// terminal state at terminalFontSize 12 (editor 12, 920-wide window): the default 200 panel after `python3 bmi.py`,
// cursor on line 1 -> reference/real-terminal-12-w920.png. xterm's 11 rows of 14 px sit at the panel's bottom (top 46),
// and the title bar has room for all five panel tabs. Line 1 is listed LAST in prefill so the build parks the editor
// cursor there (state-test.sh fixes Col 38 -> Col 1: the real capture's cursor sat at 1:1).
import { createLab, writePrograms } from "./lab-helpers.mjs";
import { BMI, SIZE12, BASE } from "./common.mjs";
export const CODE = { ...BMI };
const FILES = [{ name: "bmi.py", base: 0 }];
writePrograms(CODE, FILES);
const L = createLab(CODE);
L.B({ id: "title", scene: "title", narration: "state test" }); // the state scene enters with a scale transition, as in a video
L.B(
  { id: "st", scene: "editor", transition: "zoom", file: "bmi.py", viewTop: 1, terminalHeight: 200, narration: "terminal state test",
    prefill: [...L.pre(2, 19), { line: 20, segs: [["", ""]] }, ...L.pre(1, 1)] },
  () => [
    { do: "terminal-open", at: 0.5 },
    { do: "term-type", at: 1, text: "python3 bmi.py", cps: 14 },
    { do: "term-out", at: 3.2, lines: ["Ana: BMI 21.3 (healthy)", "Ben: BMI 28.4 (overweight)"] },
  ]
);
export default { ...BASE, ...SIZE12, id: "st-terminal12", module: "TERMINAL 12", file: { name: "bmi.py", lang: "python", folder: "projects" }, files: FILES, beats: L.beats };
