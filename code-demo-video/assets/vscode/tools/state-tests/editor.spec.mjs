// editor state: port_check.py open, cursor 1:1, focused window -> reference/real-editor-focused.png (compare scene,
// overlays hidden by state-test.sh, exactly like pixel-test.sh)
import { createLab, writePrograms } from "./lab-helpers.mjs";
import { PORT_CHECK, BASE } from "./common.mjs";
export const CODE = { ...PORT_CHECK };
const FILES = [{ name: "port_check.py", base: 0 }];
writePrograms(CODE, FILES);
const L = createLab(CODE);
L.B({ id: "title", scene: "title", narration: "state test" }); // the state scene enters with a scale transition, as in a video
L.B({ id: "st", scene: "compare", transition: "zoom", narration: "editor state test",
  compare: { real: "real.png", heat: "real.png", file: "port_check.py", folder: "pixel-demo", lines: [1, 14], cursor: 1,
    interp: "Python 3.14.4 (homebrew)", labels: ["REAL", "GENERATED"], stat: "", caption: "" } });
export default { ...BASE, id: "st-editor", module: "EDITOR", file: { name: "port_check.py", lang: "python", folder: "pixel-demo" }, files: FILES, beats: L.beats };
