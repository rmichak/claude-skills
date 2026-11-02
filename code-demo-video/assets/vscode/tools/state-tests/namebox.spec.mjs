// name-box state: Explorer New File clicked, "hello.py" typed into the inline box -> reference/real-explorer-name-box.png
// (that capture is UNFOCUSED, so only the sidebar is compared; the New File button keeps its hover in ours because
// the pointer is still on it, the capture's pointer was parked elsewhere - masked).
import { createLab, writePrograms } from "./lab-helpers.mjs";
import { PORT_CHECK, BASE } from "./common.mjs";
export const CODE = { ...PORT_CHECK, 101: "", 201: "# notes" };
const FILES = [{ name: "notes.py", base: 200 }, { name: "port_check.py", base: 0 }, { name: "hello.py", base: 100, from: "newfile" }];
writePrograms(CODE, FILES);
const L = createLab(CODE);
L.B({ id: "title", scene: "title", narration: "state test" }); // the state scene enters with a scale transition, as in a video
L.B({ id: "st", scene: "editor", transition: "zoom", file: "hello.py", viewTop: 101, fileCreate: true, fileCreateAt: 1.5, fileOpenAt: 5.5,
  before: { file: "port_check.py", lines: [...L.pre(1, 13), { line: 14, segs: [["", ""]] }] }, narration: "name box state test" });
export default { ...BASE, id: "st-namebox", module: "NAMEBOX", file: { name: "hello.py", lang: "python", folder: "pixel-demo" }, files: FILES, beats: L.beats };
