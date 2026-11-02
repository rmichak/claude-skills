// look.mjs <selector>... - live computed style + box of the first match (and ::before/::after) in the real app
import { workbench } from "./cdp.mjs";
const { browser, page } = await workbench();
const props = ["font-family", "font-size", "font-weight", "line-height", "letter-spacing", "color", "background-color", "border-top", "border-right", "border-bottom", "border-left", "border-radius", "padding", "margin", "opacity", "text-transform", "box-shadow", "outline", "outline-offset", "width", "height", "top", "left", "right", "bottom", "position", "content", "display", "align-items", "justify-content", "gap", "-webkit-font-smoothing", "text-rendering", "font-variant-ligatures", "font-feature-settings"];
const dflt = { "border-top": /^0px/, "border-right": /^0px/, "border-bottom": /^0px/, "border-left": /^0px/, "border-radius": /^0px$/, padding: /^0px$/, margin: /^0px$/, opacity: /^1$/, "text-transform": /^none$/, "box-shadow": /^none$/, outline: /none|^0px/, "outline-offset": /^0px$/, top: /auto/, left: /auto/, right: /auto/, bottom: /auto/, position: /static/, content: /normal|none/, "align-items": /normal/, "justify-content": /normal/, gap: /normal/, "letter-spacing": /normal/, "-webkit-font-smoothing": /auto/, "text-rendering": /auto/, "font-variant-ligatures": /normal/, "font-feature-settings": /normal/ };
for (const sel of process.argv.slice(2)) {
  const r = await page.evaluate((sel, props, dfltSrc) => {
    const dflt = Object.fromEntries(Object.entries(dfltSrc).map(([k, v]) => [k, new RegExp(v)]));
    const el = document.querySelector(sel);
    if (!el) return `${sel}: (none)`;
    const fmt = (s) => props.filter((p) => !(dflt[p] && dflt[p].test(s.getPropertyValue(p)))).map((p) => `${p}:${s.getPropertyValue(p)}`).join("; ");
    const b = el.getBoundingClientRect();
    let out = `${sel} [${b.x.toFixed(2)},${b.y.toFixed(2)} ${b.width.toFixed(2)}x${b.height.toFixed(2)}]\n   ${fmt(getComputedStyle(el))}`;
    for (const ps of ["::before", "::after"]) { const s = getComputedStyle(el, ps); if (s.content && s.content !== "none" && s.content !== "normal") out += `\n   ${ps}: ${fmt(s)}`; }
    return out;
  }, sel, props, Object.fromEntries(Object.entries(dflt).map(([k, v]) => [k, v.source])));
  console.log(r);
}
browser.disconnect();
