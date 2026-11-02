// editor state at editorFontSize 13 in the default 850 window: bmi.py open (16 rows of 20 px fit), cursor 1:1, focused
// -> reference/real-editor-13.png (compare scene, overlays hidden by state-test.sh)
import { createLab, writePrograms } from "./lab-helpers.mjs";
import { BMI, BASE } from "./common.mjs";
export const CODE = { ...BMI };
const FILES = [{ name: "bmi.py", base: 0 }];
writePrograms(CODE, FILES);
const L = createLab(CODE);
L.B({ id: "title", scene: "title", narration: "state test" }); // the state scene enters with a scale transition, as in a video
L.B({ id: "st", scene: "compare", transition: "zoom", narration: "editor state test",
  compare: { real: "real.png", heat: "real.png", file: "bmi.py", folder: "projects", lines: [1, 20], cursor: 1,
    interp: "Python 3.15.0", labels: ["REAL", "GENERATED"], stat: "", caption: "" } });
export default { ...BASE, editorFontSize: 13, terminalFontSize: 13, statusRight: "Python 3.15.0", id: "st-editor13", module: "EDITOR 13", file: { name: "bmi.py", lang: "python", folder: "projects" }, files: FILES, beats: L.beats };
