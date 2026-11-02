// geom.mjs - the editor and terminal geometry of the real app at its current settings (editor.fontSize,
// terminal.integrated.fontSize, window width): every number vscWindowGeom() in vscode-window.mjs needs for a font
// size or a window width. Prints JSON. Open a file (and the terminal, for the terminal numbers) first.
//   VSCODE_REF_W=920 node tools/geom.mjs
import { workbench } from "./cdp.mjs";
const { browser, page } = await workbench();
const g = await page.evaluate(() => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(4), y: +b.y.toFixed(4), w: +b.width.toFixed(4), h: +b.height.toFixed(4) }; };
  const q = (s, root = document) => root.querySelector(s);
  const ed = q(".part.editor .monaco-editor");
  const out = { window: { w: innerWidth, h: innerHeight } };
  if (ed) {
    const cs = getComputedStyle(q(".view-lines", ed));
    const vl = q(".view-line", ed);
    // the typical half-width char: Monaco's own measure is what lays out columns; a long run of one glyph gives it
    const probe = document.createElement("span");
    probe.style.cssText = `position:absolute;white-space:pre;font-family:${cs.fontFamily};font-size:${cs.fontSize};letter-spacing:${cs.letterSpacing};font-feature-settings:${cs.fontFeatureSettings}`;
    probe.textContent = "n".repeat(256);
    vl.appendChild(probe);
    const cw = probe.getBoundingClientRect().width / 256;
    probe.remove();
    const mm = q(".minimap", ed), mmc = mm && q("canvas.minimap-decorations-layer, canvas", mm);
    out.editor = {
      fontFamily: cs.fontFamily, fontSize: cs.fontSize, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
      charWidth: cw, viewLine: r(vl), editor: r(ed),
      margin: r(q(".margin", ed)), glyphMargin: r(q(".glyph-margin", ed)),
      lineNumbers: r(q(".margin-view-overlays .line-numbers", ed)), folding: r(q(".margin-view-overlays .cldr", ed)),
      content: r(q(".monaco-scrollable-element.editor-scrollable", ed)),
      minimap: r(mm), minimapCanvas: mmc ? { w: mmc.width, h: mmc.height, css: r(mmc) } : null,
      shadow: r(q(".minimap-shadow-hidden, .minimap-shadow-visible", ed)),
      ruler: r(q(".decorationsOverviewRuler", ed)), vScroll: r(q(".scrollbar.vertical", ed)),
      cursor: r(q(".cursors-layer .cursor", ed)), currentLine: r(q(".view-overlays .current-line", ed)),
      currentLineMargin: r(q(".margin-view-overlays .current-line", ed)),
      guides: [...ed.querySelectorAll(".core-guide")].slice(0, 6).map((e) => r(e)),
      sticky: r(q(".sticky-widget", ed)), stickyLine: r(q(".sticky-line-content, .sticky-widget-lines .sticky-line-content", ed)),
      stickyNumber: r(q(".sticky-line-number", ed)),
      lineNumberText: (() => { const ln = q(".margin-view-overlays .line-numbers", ed); return ln ? getComputedStyle(ln).cssText.length ? { fs: getComputedStyle(ln).fontSize, lh: getComputedStyle(ln).lineHeight, w: ln.getBoundingClientRect().width, pr: getComputedStyle(ln).paddingRight, tw: (() => { const rg = document.createRange(); rg.selectNodeContents(ln); const b = rg.getBoundingClientRect(); return { x: b.x, w: b.width }; })() } : null : null; })(),
    };
  }
  const xt = q(".part.panel .xterm");
  if (xt) {
    const rows = q(".xterm-rows", xt), row = rows && rows.children[0];
    const span = row && q("span", row);
    out.terminal = {
      panel: r(q(".part.panel")), xterm: r(xt), screen: r(q(".xterm-screen", xt)), rows: r(rows), row: r(row),
      rowStyle: row ? { h: row.style.height, lh: row.style.lineHeight } : null,
      font: rows ? { family: getComputedStyle(rows).fontFamily, size: getComputedStyle(rows).fontSize, ls: getComputedStyle(rows).letterSpacing, lh: getComputedStyle(rows).lineHeight } : null,
      firstSpan: r(span), firstSpanStyle: span ? span.getAttribute("style") : null,
      cursor: r(q(".xterm-cursor", xt)), viewport: r(q(".xterm-viewport", xt)),
      decoration: r(q(".terminal-command-decoration", xt)),
      ruler: r(q(".part.panel .decorationsOverviewRuler, .part.panel canvas.decorationsOverviewRuler")),
      // xterm's own measured cell (the renderer's dimensions), when the API is reachable through the DOM
      measure: r(q(".xterm-char-measure-element", xt)),
    };
  }
  out.titlebar = {
    cc: r(q(".command-center .action-item.command-center-center") || q(".command-center")),
    back: r(q(".command-center-quick-pick .action-item, .titlebar-center .action-item")),
    layout: [...document.querySelectorAll(".titlebar-right .layout-dropdown-container .action-item, .titlebar-right .action-toolbar-container .action-item")].map((e) => r(e)),
    center: [...document.querySelectorAll(".titlebar-center .action-item")].map((e) => r(e)),
  };
  return out;
});
console.log(JSON.stringify(g, null, 1));
browser.disconnect();
