// editor state at editorFontSize 12 in a 920-wide window: bmi.py open (19 lines: 17 rows fit, the 18th shows 16 of its
// 18 px), cursor 1:1, focused -> reference/real-editor-12-w920.png (compare scene, overlays hidden by state-test.sh)
import { createLab, writePrograms } from "./lab-helpers.mjs";
import { BMI, SIZE12, BASE } from "./common.mjs";
export const CODE = { ...BMI };
const FILES = [{ name: "bmi.py", base: 0 }];
writePrograms(CODE, FILES);
const L = createLab(CODE);
L.B({ id: "title", scene: "title", narration: "state test" }); // the state scene enters with a scale transition, as in a video
L.B({ id: "st", scene: "compare", transition: "zoom", narration: "editor state test",
  compare: { real: "real.png", heat: "real.png", file: "bmi.py", folder: "projects", lines: [1, 20], cursor: 1,
    interp: SIZE12.statusRight, labels: ["REAL", "GENERATED"], stat: "", caption: "" } });
export default { ...BASE, ...SIZE12, id: "st-editor12", module: "EDITOR 12", file: { name: "bmi.py", lang: "python", folder: "projects" }, files: FILES, beats: L.beats };
