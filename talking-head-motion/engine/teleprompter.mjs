#!/usr/bin/env node
// A teleprompter for the presenter's on-camera take, read chunk by chunk.
//   node engine/teleprompter.mjs <project dir> [--config <file>]
//
// Reads script.md "## Script": paragraphs separated by a blank line, and inside a paragraph one CHUNK per line
// (one or two sentences the presenter reads, then pauses). Chunks are numbered 1.1, 1.2, 2.1… so a retake is easy to find
// and the cut keeps the last clean read of each. Optional teleprompter.json beside it:
//   { "chapters": { "1": "Intro", "3": "PHP2Shell" },            // a heading before paragraph N
//     "say":      { "CISA": "SIS-uh", "KEV": "kev" },             // a pronunciation box under the word, every time
//     "notes":    { "1.4": "Recording Oct 25? Say four days." } } // an amber note above a chunk
// Writes teleprompter.html (Space / → next chunk, ← back, + − size, M mirror, P pronunciations, F full screen) and teleprompter.txt.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, positional, projectDir, rgba, tokens, usage } from "./lib/project.mjs";

const argv = process.argv.slice(2);
usage("usage: node engine/teleprompter.mjs <project dir> [--config <file>]\n  script.md \"## Script\" → teleprompter.html + teleprompter.txt (optional teleprompter.json beside it).", argv);
const D = projectDir(positional(argv)[0] || ".");
if (!existsSync(join(D, "script.md"))) { console.error(`✗ no script.md in ${D}`); process.exit(1); }
const tok = tokens(loadConfig(D, argv));
const md = readFileSync(join(D, "script.md"), "utf8");
const m = md.match(/## Script[^\n]*\n([\s\S]*?)(\n## |\s*$)/);
if (!m) { console.error("✗ script.md has no ## Script section"); process.exit(1); }
const cfg = existsSync(join(D, "teleprompter.json")) ? JSON.parse(readFileSync(join(D, "teleprompter.json"), "utf8")) : {};
const say = cfg.say || {}, chapters = cfg.chapters || {}, notes = cfg.notes || {};
const paras = m[1].trim().split(/\n\s*\n/).map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean)).filter((p) => p.length);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// longest keys first, whole words only (a key may hold spaces or dots: "Node.js", "php -v")
const keys = Object.keys(say).sort((a, b) => b.length - a.length);
const rx = keys.length ? new RegExp(`(?<![A-Za-z0-9])(${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![A-Za-z0-9])`, "g") : null;
const marked = (text) => {
  if (!rx) return esc(text);
  let out = "", last = 0;
  for (const mm of text.matchAll(rx)) {
    out += esc(text.slice(last, mm.index)) + `<span class="w">${esc(mm[0])}<span class="say">${esc(say[mm[0]])}</span></span>`;
    last = mm.index + mm[0].length;
  }
  return out + esc(text.slice(last));
};

let html = "", txt = "", n = 0;
paras.forEach((chunks, i) => {
  const p = i + 1;
  if (chapters[p]) html += `<h2>${esc(chapters[p])}</h2>`;
  html += `<section>`;
  chunks.forEach((c, j) => {
    const id = `${p}.${j + 1}`;
    if (notes[id]) html += `<div class="note">${esc(notes[id])}</div>`;
    html += `<div class="chunk" id="c${n++}"><span class="cn">${id}</span><p>${marked(c)}</p></div>`;
    txt += `${id}  ${c}\n`;
  });
  html += `</section>`;
  txt += "\n";
});
const table = keys.slice().sort((a, b) => a.localeCompare(b)).map((k) => `<tr><td>${esc(k)}</td><td>${esc(say[k])}</td></tr>`).join("");

writeFileSync(join(D, "teleprompter.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Teleprompter</title>
<style>
:root{--bg:${tok.bg};--ink:${tok.fg};--muted:${tok.muted};--cyan:${tok.accent};--amber:${tok.warm};--size:58px}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:${tok.sans}}
#wrap{max-width:1500px;margin:0 auto;padding:30vh 7vw 80vh}
body.mirror #wrap{transform:scaleX(-1)}
#guide{position:fixed;left:0;right:0;top:30vh;height:2px;background:${rgba(tok.accent, 0.35)};pointer-events:none}
#hud{position:fixed;right:16px;bottom:12px;font:14px ui-monospace,Menlo,monospace;color:var(--muted);background:${rgba(tok.bg, 0.88)};padding:8px 12px;border-radius:8px}
h2{font:600 22px ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);margin:2.4em 0 .6em}
section{margin:0 0 1.8em;padding-top:.2em;border-top:1px solid ${rgba(tok.muted, 0.14)}}
.chunk{position:relative;margin:.55em 0;opacity:.32;transition:opacity .2s}
.chunk.on{opacity:1}
.cn{position:absolute;left:-5.6vw;top:.45em;font:500 18px ui-monospace,Menlo,monospace;color:var(--muted)}
.chunk.on .cn{color:var(--cyan)}
p{font-size:var(--size);line-height:1.62;margin:0}
.w{position:relative;display:inline-block;border-bottom:3px solid ${rgba(tok.warm, 0.75)}}
.say{position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:4px;white-space:nowrap;font:600 calc(var(--size)*.36) ui-monospace,Menlo,monospace;color:var(--bg);background:var(--amber);padding:1px 8px;border-radius:6px;line-height:1.3}
body.nosay .say{display:none} body.nosay .w{border-bottom:none}
:fullscreen body,:fullscreen #wrap{cursor:none} :fullscreen #hud{opacity:.35}
.note{font:500 19px ui-monospace,Menlo,monospace;color:var(--amber);margin:.8em 0 .2em}
#top{font-size:19px;line-height:1.5;color:var(--muted);border:1px solid ${rgba(tok.muted, 0.3)};border-radius:12px;padding:20px 28px;margin-bottom:3em}
#top b{color:var(--ink)} #top li{margin:.25em 0}
table{border-collapse:collapse;margin-top:.6em;font-size:18px} td{padding:3px 22px 3px 0} td:first-child{color:var(--ink);font-weight:600} td:last-child{font-family:ui-monospace,Menlo,monospace;color:var(--amber)}
</style></head><body>
<div id="guide"></div>
<div id="wrap">
<div id="top">
<b>How to read this</b>
<ul>
<li>Read one numbered chunk, pause a beat, then press <b>Space</b> or <b>→</b> (a presentation clicker works) for the next one. <b>←</b> goes back.</li>
<li>Flubbed it? Just read the same chunk again. Don't stop recording. The edit keeps the last clean read of each chunk.</li>
<li>Amber boxes under a word show how to say it. <b>P</b> hides them once you're comfortable. <b>+ −</b> text size · <b>M</b> mirror.</li>
<li><b>F</b> goes full screen: no browser bars or border, and the mouse pointer hides. <b>F</b> or <b>Esc</b> comes back.</li>
</ul>
<b>Pronunciations</b>
<table>${table}</table>
</div>
${html}
</div>
<div id="hud"></div>
<script>
const cs=[...document.querySelectorAll('.chunk')];let i=-1;const hud=document.getElementById('hud');
function go(k){i=Math.max(0,Math.min(cs.length-1,k));cs.forEach((c,j)=>c.classList.toggle('on',j===i));
const y=innerHeight*0.30;window.scrollTo({top:scrollY+cs[i].getBoundingClientRect().top-y,behavior:'smooth'});
hud.textContent=cs[i].querySelector('.cn').textContent+' · '+(i+1)+' / '+cs.length;}
addEventListener('keydown',e=>{const r=document.documentElement;const s=parseInt(getComputedStyle(r).getPropertyValue('--size'));
if(['Space','ArrowRight','PageDown','ArrowDown','Enter'].includes(e.code)){e.preventDefault();go(i+1);}
else if(['ArrowLeft','PageUp','ArrowUp','Backspace'].includes(e.code)){e.preventDefault();go(i-1);}
else if(e.key==='+'||e.key==='='){r.style.setProperty('--size',(s+4)+'px');}
else if(e.key==='-'){r.style.setProperty('--size',Math.max(30,s-4)+'px');}
else if(e.key==='m'||e.key==='M'){document.body.classList.toggle('mirror');}
else if(e.key==='p'||e.key==='P'){document.body.classList.toggle('nosay');}
else if(e.key==='f'||e.key==='F'){e.preventDefault();if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen();}
else if(e.key==='Home'){e.preventDefault();i=-1;window.scrollTo({top:0});hud.textContent='';}});
hud.textContent='Press Space to start · '+cs.length+' chunks';
</script></body></html>`);
writeFileSync(join(D, "teleprompter.txt"), txt);
console.log(`→ teleprompter.html: ${paras.length} paragraphs, ${n} chunks, ${keys.length} pronunciations · teleprompter.txt`);
