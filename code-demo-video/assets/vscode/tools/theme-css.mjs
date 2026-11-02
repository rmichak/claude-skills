// theme-css.mjs <vars.json> <theme-name> - write ../theme-<name>.css: the --vscode-* colors that
// vscode-window.css uses, taken from a dump of the RUNNING app (measure.mjs -> out/<tag>-vars.json).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const [varsFile, name] = process.argv.slice(2);
const vars = JSON.parse(readFileSync(varsFile, "utf8"));
const css = readFileSync(join(HERE, "..", "vscode-window.css"), "utf8");
const used = [...new Set([...css.matchAll(/var\((--vscode-[A-Za-z0-9-]+)/g)].map((m) => m[1]))].sort();
const missing = used.filter((v) => !(v in vars));
let body = used.filter((v) => v in vars).map((v) => `  ${v}: ${vars[v]};`).join("\n");
// Derived: the overview-ruler cursor mark. The app paints it on a canvas (editorCursor.foreground at alpha 179/255,
// its top device row at 108/255) as FLAT colors; a CSS color-mix in a gradient gets dithered by Chrome, so the
// exact blended colors are precomputed here (measured on Dark 2026: rgb(90,91,92) / rgb(137,139,140)).
const hex = (c) => (/^#([0-9a-f]{6})/i.exec(c || "") || [])[1];
const bgH = hex(vars["--vscode-editor-background"]), cuH = hex(vars["--vscode-editorCursor-foreground"]);
if (bgH && cuH) {
  const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [bg, cu] = [rgb(bgH), rgb(cuH)];
  const mix = (a) => `rgb(${bg.map((b, i) => Math.round(b + (cu[i] - b) * a)).join(", ")})`;
  body += `\n  --vsc-ruler-cur0: ${mix(108 / 255)};\n  --vsc-ruler-cur: ${mix(179 / 255)};`;
}
// Derived: the terminal ruler's "running" mark, a translucent color the app also paints flat (canvas, alpha in /255)
const rgba = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(vars["--vscode-terminalCommandDecoration-defaultBackground"] || "");
const pbH = hex(vars["--vscode-terminal-background"]) || hex(vars["--vscode-panel-background"]);
if (rgba && pbH) {
  const pb = [0, 2, 4].map((i) => parseInt(pbH.slice(i, i + 2), 16)), a = Math.round(+rgba[4] * 255) / 255;
  body += `\n  --vsc-trm-run: rgb(${pb.map((b, i) => Math.round(b + (+rgba[i + 1] - b) * a)).join(", ")});`;
}
writeFileSync(join(HERE, "..", `theme-${name}.css`), `/* VS Code theme "${name}": colors dumped from the running app (tools/theme-css.mjs). */\n.vsc-z {\n${body}\n}\n`);
console.log(`theme-${name}.css: ${used.length - missing.length} vars; not in this theme (CSS fallback used): ${missing.join(", ") || "none"}`);
