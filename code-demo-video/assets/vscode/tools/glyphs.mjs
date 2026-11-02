// glyphs.mjs - every icon glyph (codicon + seti) visible in the real workbench: name -> code point, color, size
import { workbench } from "./cdp.mjs";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
const { browser, page } = await workbench();
const found = await page.evaluate(() => {
  const out = {};
  for (const el of document.querySelectorAll("*")) {
    for (const ps of ["::before", "::after"]) {
      const s = getComputedStyle(el, ps);
      const fam = s.fontFamily;
      if (!/codicon|seti/.test(fam)) continue;
      const c = s.content.replace(/^"|"$/g, "");
      if (!c || c === "none" || c === "normal") continue;
      const cp = c.codePointAt(0);
      if (!cp || cp < 0xe000) continue;
      const cls = (el.getAttribute("class") || "").split(/\s+/);
      const name = /seti/.test(fam) ? cls.filter((k) => /file-icon|folder-icon/.test(k)).join(" ") : (cls.find((k) => k.startsWith("codicon-")) || cls.join("."));
      out[`${/seti/.test(fam) ? "seti" : "codicon"}:${name}`] = { cp: "\\" + cp.toString(16), color: s.color, size: s.fontSize };
    }
  }
  return out;
});
const f = "out/glyphs.json";
const all = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
Object.assign(all, found);
writeFileSync(f, JSON.stringify(all, null, 1));
for (const [k, v] of Object.entries(found)) console.log(k.slice(0, 110), v.cp, v.color, v.size);
browser.disconnect();
