// tokens.mjs <file.py>... [--out qa/vscode-tokens.json]
// Read every line of each program EXACTLY as the real VS Code colors it - TextMate grammar + Pylance
// semantic tokens + bracket-pair colors - and save it for lab-helpers.mjs (tok()) and build-demo.mjs.
// Uses the throwaway VS Code from launch.sh (Dark 2026, never your own settings).
//   node <skill>/assets/vscode/tools/tokens.mjs security_utils.py toolkit_main.py
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { workbench } from "./cdp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const outIx = args.indexOf("--out");
const out = resolve(outIx >= 0 ? args[outIx + 1] : "qa/vscode-tokens.json");
const files = args.filter((a, i) => outIx < 0 || (i !== outIx && i !== outIx + 1)).map((f) => resolve(f));
if (!files.length) throw new Error("usage: tokens.mjs <file>... [--out qa/vscode-tokens.json]");
for (const f of files) if (!existsSync(f)) throw new Error(`no such file: ${f}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (c) => {
  const m = c.match(/rgba?\((\d+), (\d+), (\d+)/);
  return m ? [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, "0")).join("") : "";
};

spawnSync(join(HERE, "launch.sh"), [dirname(files[0])], { stdio: "inherit" });
const result = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
for (const file of files) {
  spawnSync(join(HERE, "launch.sh"), [file], { stdio: "inherit" });
  const { browser, page, cdp } = await workbench({ width: 1600, height: 4000, dpr: 1 });
  // wait for this file to be the active editor, then for Pylance's semantic tokens to land
  for (let i = 0; i < 40; i++) {
    if ((await page.evaluate(() => document.title)).startsWith(basename(file))) break;
    await sleep(250);
  }
  await sleep(3500);
  // the editor's default text color: spans in it get no class (they inherit, like the real editor)
  const fg = (await page.evaluate(() => getComputedStyle(document.querySelector(".monaco-workbench")).getPropertyValue("--vscode-editor-foreground").trim())).replace("#", "").toLowerCase();
  const lines = await page.evaluate(() => {
    const ed = document.querySelector(".part.editor .editor-group-container.active .monaco-editor .view-lines") || document.querySelector(".part.editor .monaco-editor .view-lines");
    const out = {};
    for (const vl of ed.querySelectorAll(".view-line")) {
      const top = parseFloat(vl.style.top);
      const lh = parseFloat(getComputedStyle(vl).lineHeight);
      out[Math.round(top / lh) + 1] = [...vl.querySelectorAll(":scope > span > span")].map((s) => {
        const cs = getComputedStyle(s);
        // the TOKEN color (mtkN class) under any decoration (bracket-pair colors are decorations): the minimap uses it
        const mtk = [...s.classList].find((c) => /^mtk\d+$/.test(c));
        let base = cs.color;
        if (mtk && s.classList.length > 1) { const probe = document.createElement("span"); probe.className = mtk; vl.appendChild(probe); base = getComputedStyle(probe).color; probe.remove(); }
        return [cs.color, s.textContent.replace(/\u00a0/g, " "), cs.fontStyle === "italic", base];
      });
    }
    return out;
  });
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  browser.disconnect();
  const src = readFileSync(file, "utf8").replace(/\n$/, "").split("\n");
  const map = {};
  let bad = 0;
  src.forEach((text, i) => {
    const spans = lines[i + 1];
    if (!spans) return void bad++;
    const segs = [];
    for (const [c, t, it, b] of spans) {
      const h = hex(c), bh = hex(b || c);
      const cls = h === fg && !it ? "" : `c-${h}${it ? "-i" : ""}`;
      const last = segs[segs.length - 1];
      const myBase = bh !== h ? bh : null; // 3rd element only when the token color differs from what is drawn
      if (last && last[0] === cls && (last[2] || null) === myBase) last[1] += t;
      else segs.push(myBase ? [cls, t, myBase] : [cls, t]);
    }
    const joined = segs.map((s) => s[1]).join("");
    if (joined !== text) return void bad++;
    if (map[text] && JSON.stringify(map[text]) !== JSON.stringify(segs)) console.warn(`⚠ ${basename(file)}: "${text.trim()}" is colored two ways in this file; using the first`);
    else map[text] = segs;
  });
  result[basename(file)] = map;
  console.log(`${basename(file)}: ${Object.keys(map).length} distinct lines${bad ? `, ${bad} not read (line mismatch)` : ""}`);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`wrote ${out}`);
