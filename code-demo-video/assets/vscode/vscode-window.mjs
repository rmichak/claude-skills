// vscode-window.mjs - the VS Code window, measured from the real app (see vscode-window.css and tools/).
// build-demo.mjs calls vscWindowHTML() once per editor scene; the timeline hooks (ids/classes) are the
// same ones the old mock used, so marks, typing, callouts and pause cards keep working.
import { readFileSync, existsSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// codicon / seti code points, read from the real app's --vscode-icon-*-content variables (tools/glyphs.mjs)
export const ICON = {
  explorer: "eaf0", search: "ec70", scm: "ea68", run: "eb91", extensions: "eae6", more: "ea7c", accounts: "eb99", gear: "eb51",
  arrowLeft: "ea9b", arrowRight: "ea9c", layout: "ebeb", panelLeft: "ebf3", panelLeftOff: "ec02", panelOn: "ebf2", panelOff: "ec01", auxOff: "ec00",
  chevDown: "eab4", chevRight: "eab6", closeSmall: "ecee", close: "ea76", play: "eb2c", split: "eb56",
  newFile: "ea7f", newFolder: "ea80", refresh: "eb37", collapse: "eac5",
  remote: "eb3a", error: "ea87", warning: "ea6c", bracket: "eb0f", bell: "eaa2",
  debugStackframe: "eb8b", terminal: "ea85", plus: "ea60", trash: "ea81", maximize: "eb4c", decoOk: "ea71", decoErr: "ebfb", decoRun: "eabc",
};
const ci = (name, cls = "") => `<span class="ci${cls ? " " + cls : ""}">&#x${ICON[name]};</span>`;
// seti file icons (vs-seti-icon-theme.json): glyph + color per language
export const FILE_ICON = {
  python: ["e07b", "#519aba"], bash: ["e089", "#8dc149"], shell: ["e089", "#8dc149"], javascript: ["e051", "#cbcb41"],
  html: ["e048", "#e37933"], json: ["e055", "#cbcb41"], markdown: ["e060", "#519aba"], csv: ["e01e", "#8dc149"], css: ["e01d", "#519aba"],
  plain: ["e023", "#d4d7d6"],
};
export const fileIcon = (lang, { id, style } = {}) => {
  const [g, c] = FILE_ICON[lang] || FILE_ICON.plain;
  return `<span class="fi"${id ? ` id="${id}"` : ""} style="color:${c}${style ? ";" + style : ""}">&#x${g};</span>`;
};
/* window geometry (logical px), measured in VS Code 1.138 with tools/geom.mjs. The defaults (editor.fontSize 14,
   terminal.integrated.fontSize 14, an 850x436 window) are what vscode-window.css is written for; vscGeom() derives
   the rest, and geomCSS() overrides the CSS variables when a spec asks for a smaller font or a wider window. */
// editor.fontSize -> Menlo line height, glyph margin (= the line height), line-number column (3 digits), folding
// column, and Monaco's typicalHalfwidthCharacterWidth (columns, indent guides, the minimap's share of the width)
export const EDITOR_FONT = {
  14: { lineHeight: 21, glyph: 21, numbers: 25, folding: 26, charWidth: 8.4296875 },
  13: { lineHeight: 20, glyph: 20, numbers: 23, folding: 26, charWidth: 7.828125 },
  12: { lineHeight: 18, glyph: 18, numbers: 22, folding: 26, charWidth: 7.2265625 },
};
// terminal.integrated.fontSize is its own setting: it does NOT follow editor.fontSize (unset, it's 12 on macOS; the
// reference profile sets 14). xterm's row height per size; the columns, the cell and the rows' letter-spacing all
// follow from Menlo's advance (1233/2048 em, what xterm and VS Code measure with canvas measureText) - see vscGeom
export const TERMINAL_FONT = { 14: { row: 16 }, 13: { row: 15 }, 12: { row: 14 } };
const MENLO_ADVANCE = 1233 / 2048;
// windowWidth: the window stays centered on the 1920 canvas and keeps its height (the captions don't move). 920 is
// the widest that leaves the frame's shadow and the labels room (1840 px drawn, 40 px each side)
export const WINDOW_WIDTH = { min: 850, max: 920 };
// the panel's title bar shows as many view tabs as fit, the way VS Code's CompositeBar decides it: the active
// TERMINAL always shows, and an overflow "..." costs 44 (overflowActionSize) whenever they don't all fit, in the
// panel width minus 16 padding and the 238.36 toolbar (zsh ... close). Tab widths measured (SF 11px, uppercase).
// Measured: 850-898 px PROBLEMS OUTPUT TERMINAL ..., 899-915 + DEBUG CONSOLE, 916+ all five (no "...")
const PANEL_TABS = [["Problems", 83.84], ["Output", 70.03], ["Debug Console", 118.86], ["Terminal", 79.61], ["Ports", 60.97]];
export function panelTabs(editorWidth) {
  const size = Object.fromEntries(PANEL_TABS), act = "Terminal", c = editorWidth - 16 - 238.36;
  let items = PANEL_TABS.map(([n]) => n), a = 0, n = items.length;
  const r = items.length;
  for (let u = 0; u < items.length; u++) { if (a + size[items[u]] > c) { n = u; break; } a += size[items[u]]; }
  if (r > n) items = items.slice(0, n);
  if (!items.includes(act)) { a += size[act]; items.push(act); }
  while (a > c && items.length) a -= size[items.length > 1 ? items.splice(items.length - 2, 1)[0] : items.pop()];
  if (r > items.length) a += 44;
  while (a > c && items.length) a -= size[items.length > 1 && items[items.length - 1] === act ? items.splice(items.length - 2, 1)[0] : items.pop()];
  return { tabs: PANEL_TABS.map(([n]) => n).filter((x) => items.includes(x)), more: r > items.length };
}
export function vscGeom({ fontSize = 14, terminalFontSize = 14, width = 850 } = {}) {
  const ef = EDITOR_FONT[fontSize], tf = TERMINAL_FONT[terminalFontSize];
  if (!ef) throw new Error(`editorFontSize ${fontSize}: measured sizes are ${Object.keys(EDITOR_FONT).join(", ")}`);
  if (!tf) throw new Error(`terminalFontSize ${terminalFontSize}: measured sizes are ${Object.keys(TERMINAL_FONT).join(", ")}`);
  if (!(Number.isInteger(width) && width >= WINDOW_WIDTH.min && width <= WINDOW_WIDTH.max))
    throw new Error(`windowWidth ${width}: a whole number from ${WINDOW_WIDTH.min} to ${WINDOW_WIDTH.max}`);
  const editor = width - 48 - 200; // the editor column: activity bar 48, side bar 200
  const gutter = ef.glyph + ef.numbers + ef.folding;
  // Monaco's minimap width (EditorLayoutInfoComputer: minimap.scale 1 on a 2x screen, renderCharacters): the text and
  // the minimap share the width in proportion to their character widths (1 px for the minimap), 14 is the scrollbar,
  // 2 the cursor's room, +8 MINIMAP_GUTTER_WIDTH. Matches all six measured points: 62/66/71 at 850, 69/74/79 at 920
  const minimap = Math.floor((editor - gutter - 14 - 2) / (ef.charWidth + 1)) + 8;
  // the terminal: VS Code gives xterm floor(width / charWidth) columns (the panel less 20 padding and the 14 scrollbar);
  // xterm's DOM renderer makes each row round(charWidth x cols) css px wide, so a cell is that / cols, and sets the
  // rows' letter-spacing to cell - charWidth. So the spacing changes with the column count: at 12, 0.00616 in the 850
  // window and 0.00266 at 920, exactly as the app reports them (and 0.00412 at the default 14 / 850, where the CSS
  // keeps its render-tested 0.0041). A one-character span (the prompt's first cell) is the cell ceiled to 1/64 px.
  const charW = terminalFontSize * MENLO_ADVANCE, termCols = Math.floor((editor - 20 - 14) / charW);
  const cell = Math.round(charW * termCols) / termCols;
  return {
    scale: 2, width, height: 436, sidebar: 200, editor, left: (1920 - 2 * width) / 2,
    fontSize, lineHeight: ef.lineHeight, charWidth: ef.charWidth, glyph: ef.glyph, gutter, minimap, ruler: 14,
    cols: Math.floor((editor - gutter - minimap - 14) / ef.charWidth), // characters a line shows before the minimap
    terminalFontSize, termRow: tf.row, termCols, termCellExact: cell, termCell: Math.ceil(cell * 64) / 64,
    termLetterSpacing: +(cell - charW).toFixed(8),
    panelTabs: panelTabs(editor),
  };
}
export const GEOM = vscGeom();
// rows of code that fit: the editor area is 322 (436 - title 35 - tabs 35 - breadcrumbs 22 - status 22), less an open panel
export const codeRows = (g, panel = 0) => Math.floor((g.height - 35 - 22 - 35 - 22 - panel) / g.lineHeight);
// xterm rows that fit in a panel of height h (its 35 title bar off), and where the first row starts: xterm sits at
// the BOTTOM of the panel, the leftover above it (measured at 4 panel heights x 3 sizes + maximized: 266 -> 42,
// 200 -> 40, maximized -> 43 at 14)
export const termRows = (g, h) => Math.floor((h - 35) / g.termRow);
export const termTop = (g, h) => 35 + ((h - 35) % g.termRow);
export const MAX_PANEL = 436 - 35 - 22; // Maximize Panel Size: the whole editor column
// the CSS variables vscode-window.css reads (defaults there = GEOM), as one override rule; "" for the default window
export function geomCSS(g) {
  const d = GEOM, v = [];
  const add = (k, a, b) => { if (a !== b) v.push(`${k}: ${a}px`); };
  add("--vsc-w", g.width, d.width); add("--vsc-fs", g.fontSize, d.fontSize); add("--vsc-lh", g.lineHeight, d.lineHeight);
  add("--vsc-gut", g.gutter, d.gutter); add("--vsc-glyph-x", (g.glyph - 16) / 2, (d.glyph - 16) / 2); add("--vsc-mm", g.minimap, d.minimap);
  add("--vsc-tfs", g.terminalFontSize, d.terminalFontSize); add("--vsc-trow", g.termRow, d.termRow); add("--vsc-tcell", g.termCell, d.termCell);
  // the spacing and the block cursor follow the column count, so they change with the width as well as the size
  if (g.termLetterSpacing !== d.termLetterSpacing) v.push(`--vsc-tls: ${g.termLetterSpacing}px`, `--vsc-tcur: ${g.termCellExact}px`);
  add("--vsc-tmax", g.termCols * g.termCell, d.termCols * d.termCell);
  if (g.width !== d.width) v.push(`left: ${g.left}px`, `width: ${2 * g.width}px`);
  return v.length ? `.vsc { ${v.join("; ")}; }\n` : "";
}
// the command center is 38vw (+2 border) wide and centered 26 px right of the window's middle; back/forward sit left of
// it and the four layout controls are right-anchored. Chrome floors both to 1/64 px. 850: 288.5 / 325, 920: 310.2 / 351.6
const lu = (x) => Math.floor(x * 64) / 64;
function titleBar(w) {
  const ccw = lu(0.38 * w) + 2, ccx = lu(w / 2 + 26 - ccw / 2);
  return { ccx, ccw, back: ccx - 58, fwd: ccx - 32, lay: [w - 112, w - 86, w - 60, w - 34] };
}

export function themeCSS(theme = "dark-2026") {
  const f = join(HERE, `theme-${theme}.css`);
  if (!existsSync(f)) throw new Error(`no VS Code theme ${theme} (${f}); dump it with tools/theme-css.mjs`);
  return readFileSync(f, "utf8");
}
export function windowCSS(theme) {
  return themeCSS(theme) + "\n" + readFileSync(join(HERE, "vscode-window.css"), "utf8");
}
export const ASSETS = ["codicon.ttf", "seti.woff", "letterpress-dark.svg", "tlights.svg", "tlights-edited.svg", "pointer.svg"].map((f) => join(HERE, f));
// the Mac's system UI font and Menlo Regular, copied into <dir> (the project's vscode/) when missing. They are
// Apple's fonts, so they stay on this machine: copied per project at build time, never stored in the skill.
export function ensureSystemFonts(dir) {
  const ui = join(dir, "SFNS.ttf"), mono = join(dir, "Menlo-Regular.ttf");
  if (!existsSync(ui)) copyFileSync("/System/Library/Fonts/SFNS.ttf", ui);
  if (!existsSync(mono)) {
    const r = spawnSync("python3", ["-c", `from fontTools.ttLib import TTCollection; TTCollection("/System/Library/Fonts/Menlo.ttc").fonts[0].save(${JSON.stringify(mono)})`], { encoding: "utf8" });
    if (r.status !== 0) throw new Error("could not extract Menlo Regular (pip install fonttools): " + r.stderr);
  }
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/*
 o = {
   id, folder, lang,
   explorer: [{ name, lang, cls, attrs, nameHTML }],   rows, already sorted; cls "main active" etc.
   explorerHover, newFileId, sidebarExtra,             folder-header actions visible; New File button id; debug pane
   tabs: [{ name, lang, on, attrs, id }], tabsAttrs,   tab group (empty -> no tabs bar content)
   breadcrumb: { name, lang, attrs } | null,
   codeHTML, codeAttrs, minimapHTML, rulerHTML, watermark,
   panel: null | { height, bodyHTML, attrs, shell },
   status: { lnColHTML, lang, interp, attrs, problems } | { bare: true },
   geom                                                vscGeom() (default GEOM)
 }
*/
export function vscWindowHTML(o) {
  const g = o.geom || GEOM, tb = titleBar(g.width);
  const folderUp = esc((o.folder || "demo").toUpperCase());
  const tabs = o.tabs || [];
  const tabsHTML = tabs
    .map((t) => `<div class="vsc-tab ${t.on ? "vsc-tab-on" : "vsc-tab-off"}"${t.id ? ` id="${t.id}"` : ""}${t.attrs || ""}>${fileIcon(t.lang || o.lang)}<span class="tab-label">${esc(t.name)}</span><span class="tab-x"><span class="ci tx-close">&#x${ICON.closeSmall};</span><span class="ci tx-dirty" style="display:none">&#x${ICON.decoOk};</span></span></div>`)
    .join("");
  const bc = o.breadcrumb;
  const p = o.panel;
  const st = o.status || {};
  return `<div class="vsc">
          <div class="vsc-z">
          <div class="vsc-titlebar">
            <img class="tb-lights" src="vscode/tlights.svg" alt=""${o.lightsId ? ` id="${o.lightsId}"` : ""} /><img class="tb-lights" src="vscode/tlights-edited.svg" alt="" style="display:none"${o.lightsId ? ` id="${o.lightsId}-ed"` : ""} />
            <span class="tb-act dis" style="left:${tb.back}px">${ci("arrowLeft")}</span><span class="tb-act dis" style="left:${tb.fwd}px">${ci("arrowRight")}</span>
            <div class="tb-cc" style="left:${tb.ccx}px;width:${tb.ccw}px">${esc(o.folder || "demo")}</div>
            <span class="tb-act tb-lay" style="left:${tb.lay[0]}px">${ci("layout")}</span><span class="tb-act tb-lay" style="left:${tb.lay[1]}px">${ci("panelLeft")}</span><span class="tb-act tb-lay vsc-tb-panel" style="left:${tb.lay[2]}px"><span class="ci tbp-off"${p?.open ? ' style="display:none"' : ""}>&#x${ICON.panelOff};</span><span class="ci tbp-on"${p?.open ? "" : ' style="display:none"'}>&#x${ICON.panelOn};</span></span><span class="tb-act tb-lay" style="left:${tb.lay[3]}px">${ci("auxOff")}</span>
          </div>
          <div class="vsc-body">
            <div class="vsc-activity">
              <div class="act on">&#x${ICON.explorer};<span class="act-badge"${o.badgeId ? ` id="${o.badgeId}"` : ""} style="display:none">1</span></div><div class="act">&#x${ICON.search};</div><div class="act">&#x${ICON.scm};</div><div class="act">&#x${ICON.run};</div><div class="act">&#x${ICON.more};</div>
              <div class="act-spacer"></div>
              <div class="act">&#x${ICON.accounts};</div><div class="act act-gear">&#x${ICON.gear};</div>
            </div>
            <div class="vsc-sidebar">
              <div class="sb-title"><h2>Explorer</h2><span class="sb-btn">${ci("more")}</span></div>
              <div class="pane-hd${o.explorerHover ? " hover" : ""}"${o.folderHeaderId ? ` id="${o.folderHeaderId}"` : ""}><span class="ci tw">&#x${ICON.chevDown};</span><span class="ttl">${folderUp}</span><span class="acts"><span class="sb-btn"${o.newFileId ? ` id="${o.newFileId}"` : ""}>${ci("newFile")}</span><span class="sb-btn">${ci("newFolder")}</span><span class="sb-btn">${ci("refresh")}</span><span class="sb-btn">${ci("collapse")}</span></span></div>
              <div class="sb-files">${(o.explorer || []).map((r) => `<div class="sb-row${r.cls ? " " + r.cls : ""}"${r.attrs || ""}>${r.iconHTML ?? fileIcon(r.lang || o.lang)}${r.nameHTML ?? `<div>${esc(r.name)}</div>`}</div>`).join("\n              ")}</div>
              ${o.sidebarExtra || ""}
              <div class="pane-hd bt"><span class="ci tw">&#x${ICON.chevRight};</span><span class="ttl">Outline</span></div>
              <div class="pane-hd bt"><span class="ci tw">&#x${ICON.chevRight};</span><span class="ttl">Timeline</span></div>
            </div>
            <div class="vsc-editor">
              <div class="vsc-tabs"${o.tabsAttrs || ""}><div class="vsc-tabgroup">${tabsHTML}</div>${tabs.length ? `<div class="ed-acts"${o.edActsAttrs || ""}><span class="vsc-runbtn">${ci("play", "play")}${ci("chevDown", "drop")}</span>${ci("split").replace('class="ci"', 'class="ci" style="left:43px"')}${ci("more").replace('class="ci"', 'class="ci" style="left:69px"')}</div>` : ""}</div>
              ${bc ? `<div class="vsc-breadcrumb"${bc.attrs || ""}>${fileIcon(bc.lang || o.lang)}${bc.nameHTML ?? `<span>${esc(bc.name)}</span>`}${ci("chevRight")}<span class="bc-dots">&hellip;</span></div>` : ""}
              <div class="vsc-code"${o.codeAttrs || ""}>
                ${o.watermark ? `<div class="vsc-watermark"${o.watermarkAttrs || ""}><div class="lp"></div></div>` : ""}
                ${o.codeHTML || ""}
                ${o.minimapHTML !== undefined ? `<div class="vsc-minimap"${o.edChromeAttrs ? o.edChromeAttrs("mm") : ""} data-layout-ignore>${o.minimapHTML}</div><div class="vsc-ruler"${o.edChromeAttrs ? o.edChromeAttrs("rl") : ""} data-layout-ignore>${o.rulerHTML || ""}</div>` : ""}
              </div>
              <span class="mm-mark"${o.mmMarkId ? ` id="${o.mmMarkId}"` : ""}></span>
              ${p ? `<div class="vsc-terminal${p.max ? " max" : ""}" style="height:${p.height || 300}px${p.open ? ";display:flex" : ""}" data-layout-allow-overflow>
                <div class="pn-head">
                  <div class="pn-tabs">${g.panelTabs.tabs.map((t) => `<div class="pn-tab${t === "Terminal" ? " on" : ""}"><span>${t}</span></div>`).join("")}${g.panelTabs.more ? `<div class="pn-tab more">${ci("more")}</div>` : ""}</div>
                  <span class="pn-shell" style="right:194px">${ci("terminal")}${esc(p.shell || "zsh")}</span>
                  <span class="pn-act" style="right:168px">${ci("plus")}</span><span class="pn-act chev" style="right:155px">&#x${ICON.chevDown};</span>
                  <span class="pn-act" style="right:129px">${ci("split")}</span><span class="pn-act" style="right:103px">${ci("trash")}</span><span class="pn-act" style="right:77px">${ci("more")}</span>
                  <span class="pn-sep" style="right:68px"></span>
                  <span class="pn-act g" style="right:38px">${ci("maximize")}</span><span class="pn-act g" style="right:12px">${ci("close")}</span>
                </div>
                <div class="term-body" style="top:${termTop(g, p.max ? MAX_PANEL : p.height || 300)}px">
                  ${p.bodyHTML || ""}
                </div>
                <div class="term-ruler" style="top:${termTop(g, p.max ? MAX_PANEL : p.height || 300)}px">${p.rulerHTML || ""}</div>
              </div>` : ""}
            </div>
          </div>
          <div class="vsc-status"${st.attrs || ""}>
            <div class="st-left">
              <div class="st-item">${ci("remote")}</div>
              <div class="st-item">${ci("error")} ${st.errors ?? 0} ${ci("warning")} ${st.warnings ?? 0}</div>
            </div>
            <div class="st-right">${st.bare ? "" : `<span class="st-full"${st.fullAttrs || ""}>
              <div class="st-item">${st.lnColHTML || "Ln 1, Col 1"}</div>
              <div class="st-item">Spaces: 4</div>
              <div class="st-item">UTF-8</div>
              <div class="st-item">LF</div>
              <div class="st-item compact-r">${ci("bracket")}</div><div class="st-item compact-l">${esc(st.lang || "Python")}</div>
              <div class="st-item">${esc(st.interp || "Python 3.14.4 (homebrew)")}</div></span>`}
              <div class="st-item">${ci("bell")}</div>
            </div>
          </div>
          ${o.pointerHTML || ""}
          </div>
        </div>`;
}
