// measure.mjs - dump the real workbench: theme vars, element boxes + computed styles, CSS, DOM
import { workbench } from "./cdp.mjs";
import { writeFileSync } from "node:fs";
const tag = process.argv[2] || "m";
const { browser, page } = await workbench();
const data = await page.evaluate(() => {
  const wb = document.querySelector(".monaco-workbench");
  const cs = getComputedStyle(wb);
  const vars = {};
  for (let i = 0; i < cs.length; i++) { const p = cs[i]; if (p.startsWith("--vscode-")) vars[p] = cs.getPropertyValue(p).trim(); }
  // every visible element with its box + the styles that matter for a look-alike
  const keep = ["font-family", "font-size", "font-weight", "line-height", "letter-spacing", "color", "background-color", "border-top", "border-right", "border-bottom", "border-left", "border-radius", "padding", "margin", "opacity", "text-transform", "box-shadow", "outline", "white-space", "display", "position", "z-index", "background-image", "-webkit-mask-image", "font-variant-ligatures", "font-feature-settings", "text-overflow", "overflow", "width", "height", "top", "left", "transform", "content"];
  const out = [];
  const walk = (el, depth, path) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") return;
    if (r.width === 0 && r.height === 0 && !el.children.length) return;
    const st = {};
    for (const k of keep) st[k] = s.getPropertyValue(k);
    const before = getComputedStyle(el, "::before").content;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    out.push({ d: depth, tag: el.tagName.toLowerCase(), id: el.id || undefined, cls: el.getAttribute("class") || "", role: el.getAttribute("role") || undefined, aria: el.getAttribute("aria-label") || undefined, text: own.slice(0, 80) || undefined, before: before && before !== "none" && before !== "normal" ? before : undefined, x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), st });
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(document.body, 0);
  let css = "";
  for (const sh of [...document.styleSheets, ...(document.adoptedStyleSheets || [])]) { try { for (const r of sh.cssRules) css += r.cssText + "\n"; } catch (e) { css += `/* unreadable ${sh.href} */\n`; } }
  return { vars, els: out, css, html: document.documentElement.outerHTML, fonts: [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`) };
});
writeFileSync(`out/${tag}-vars.json`, JSON.stringify(data.vars, null, 1));
writeFileSync(`out/${tag}-els.json`, JSON.stringify(data.els));
writeFileSync(`out/${tag}.css`, data.css);
writeFileSync(`out/${tag}.html`, data.html);
console.log(Object.keys(data.vars).length, "vars;", data.els.length, "elements;", (data.css.length / 1024).toFixed(0), "KB css;", (data.html.length / 1024).toFixed(0), "KB html; fonts:", [...new Set(data.fonts)].join(" | "));
browser.disconnect();
