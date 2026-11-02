#!/usr/bin/env node
/**
 * code-demo-video builder: demo.spec.mjs + template.html + audio/*.wav → index.html
 *
 * - ffprobes every narration wav, runs the timing cascade, converts beat-relative
 *   action offsets to absolute timeline times
 * - generates scene HTML (title/editor/pause/outro), audio tags, caption groups
 * - bakes DEMO_DATA consumed by the template's runtime
 * - prints a beat map + pacing warnings
 *
 * Usage: node build-demo.mjs [spec.mjs] [--clip] [--print-map]
 */
import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`usage: node build-demo.mjs [spec.mjs] [--clip] [--print-map]
  Run in a project folder that holds demo.spec.mjs (or pass a spec path), template.html.src, vscode/ and audio/.
  --clip       drop title/outro, add 0.5 s hold frames at both ends (for splicing into a longer video)
  --print-map  print the beat map only; don't write index.html
Writes index.html + timeline.json and prints the beat map and pacing warnings.`);
  process.exit(0);
}
// the VS Code window: a measured copy of the real app (vscode/vscode-window.css + .mjs, copied in by new-lab.sh).
// Looked up in the project's vscode/, then next to this script, then in the installed skill.
const VSC_MOD = [
  resolve("vscode/vscode-window.mjs"),
  resolve(dirname(fileURLToPath(import.meta.url)), "vscode/vscode-window.mjs"),
  resolve(process.env.HOME || "", ".claude/skills/code-demo-video/assets/vscode/vscode-window.mjs"),
].find((p) => existsSync(p));
if (!VSC_MOD) {
  console.error("ERROR: vscode/vscode-window.mjs not found: copy the skill's assets/vscode/ into the project (new-lab.sh does this)");
  process.exit(1);
}
const { vscWindowHTML, windowCSS, vscGeom, geomCSS, codeRows, termRows, MAX_PANEL, ICON, fileIcon, ensureSystemFonts } = await import(pathToFileURL(VSC_MOD).href);
if (existsSync(resolve("vscode"))) ensureSystemFonts(resolve("vscode")); // the Mac's SF + Menlo, local only
if (!existsSync(resolve("vscode/codicon.ttf"))) console.warn("⚠ vscode/ assets missing — copy the skill's assets/vscode/ into the project (new-lab.sh does this)");

const args = process.argv.slice(2);
const specPath = resolve(args.find((a) => !a.startsWith("--")) || "demo.spec.mjs");
if (!existsSync(specPath)) {
  console.error(`ERROR: no spec at ${specPath}. Usage: node build-demo.mjs [spec.mjs] [--clip] [--print-map] (--help for more)`);
  process.exit(2);
}
const printOnly = args.includes("--print-map");
const specMod = await import(pathToFileURL(specPath).href);
const spec = specMod.default;
const SPEC_CODE = specMod.CODE || spec.code || null; // lab specs export CODE (line n -> text)
// the window's geometry: editor.fontSize / terminal.integrated.fontSize / window width, each measured in the real app
// (vscode-window.mjs). Defaults 14 / 14 / 850. A program that doesn't fit: editorFontSize 13 -> 12, then windowWidth
let GEOM;
try {
  GEOM = vscGeom({ fontSize: spec.editorFontSize ?? 14, terminalFontSize: spec.terminalFontSize ?? 14, width: spec.windowWidth ?? 850 });
} catch (e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}
// real VS Code token colors (vscode/tools/tokens.mjs -> qa/vscode-tokens.json), keyed by line text
const REAL_TOK = new Map();
try {
  for (const f of Object.values(JSON.parse(readFileSync(resolve("qa/vscode-tokens.json"), "utf8"))))
    for (const [line, segs] of Object.entries(f)) if (!REAL_TOK.has(line)) REAL_TOK.set(line, segs);
} catch {}
// the real app's theme colors (vscode/theme-<name>.css); THEME("tab-activeBackground") -> "#121314"
const VSC_THEME = spec.vscodeTheme || "dark-2026";
const VSC_CSS = windowCSS(VSC_THEME);
const THEME = (k) => {
  const m = VSC_CSS.match(new RegExp(`--vscode-${k}:\\s*([^;]+);`));
  if (!m) throw new Error(`VS Code theme ${VSC_THEME} has no --vscode-${k} (add it to vscode-window.css and re-dump)`);
  return m[1].trim();
};
// minimap: the page draws it with Monaco's own renderer + character atlas (vscode/minimap-atlas-2x.hex). Each
// character is 2x4 device px, colored by its TOKEN color; bracket-pair colors are decorations, which the real
// minimap does not use, so brackets get the plain foreground.
const TOK_HEX = { "tok-kw": "c586c0", "tok-decl": "ff7b72", "tok-const": "569cd6", "tok-fn": "d2a8ff", "tok-str": "a5d6ff", "tok-num": "b5cea8", "tok-comment": "8b949e", "tok-var": "c9d1d9", "tok-type": "4ec9b0", "tok-param": "ffa657", "tok-op": "d4d4d4" };
const BRACKET_HEX = /^c-(ffd700|da70d6|179fff)$|^tok-b\d$/;
function mmHex(cls, ch) {
  const fg = THEME("editor-foreground").replace("#", "").toLowerCase();
  if ("()[]{}".includes(ch) && (!cls || BRACKET_HEX.test(cls))) return fg;
  const m = /^c-([0-9a-f]{6})/.exec(cls || "");
  return m ? m[1] : TOK_HEX[cls] || fg;
}
function mmRow(segs) {
  let t = "";
  const c = [];
  // segs from tokens.mjs carry the token color under a decoration as a 3rd element (e.g. an f-string brace that
  // the editor shows in a bracket-pair color but the minimap shows in its token color)
  for (const [cls, txt, base] of segs) for (const ch of txt) { t += ch; c.push(ch === " " ? "" : base || mmHex(cls, ch)); }
  return { t, c };
}
const minimapData = []; // [{ id, rows: [{ row, t, c, at? }] }]

const warns = [];
const warn = (m) => warns.push(m);
const fail = (m) => {
  console.error("ERROR: " + m);
  process.exit(1);
};

/* ---------- validate ---------- */
const SCENE_KINDS = ["title", "editor", "pause", "outro", "browser", "doc", "compare", "sting", "recap", "endscreen"];
// brand scenes that may run without a voice (no narration, no wav): the helmet sting, a silent end screen
const SILENT_OK = ["sting", "endscreen"];
if (!spec.beats?.length) fail("spec.beats is empty");
if (!spec.file?.name) fail("spec.file.name required");
spec.beats.forEach((b, i) => {
  if (!SCENE_KINDS.includes(b.scene)) fail(`beat ${i} (${b.id}): unknown scene "${b.scene}"`);
  if (!b.narration && !SILENT_OK.includes(b.scene)) fail(`beat ${i} (${b.id}): narration required`);
  if (b.scene === "recap" && !b.recap?.lines?.length) fail(`beat ${i} (${b.id}): recap beats need recap:{lines:[...]} (three lines, on screen and spoken)`);
  // endscreen: {} = two bare 16:9 frames for YouTube's end-screen elements (no titles on them, so what goes in
  // them can change in YouTube); next/playlist {label, title} still label them when a lesson wants it
  if (b.scene === "endscreen" && typeof b.endscreen !== "object")
    fail(`beat ${i} (${b.id}): endscreen beats need endscreen:{} (bare frames) or {next:{label,title}, playlist:{label,title}}`);
  if (b.scene === "pause" && (!(b.step || b.badge) || !b.task || !b.checklist?.length))
    fail(`beat ${i} (${b.id}): pause beats need step:{n,of}, task, checklist[]`);
  if (b.pauseOverlay) {
    if (b.scene !== "editor")
      fail(`beat ${i} (${b.id}): pauseOverlay only works on scene:"editor" beats (so the code stays visible)`);
    if (!(b.step || b.badge) || !b.task || !b.checklist?.length)
      fail(`beat ${i} (${b.id}): pauseOverlay beats need step:{n,of}, task, checklist[]`);
  }
  if (b.scene === "outro" && !b.outro) fail(`beat ${i} (${b.id}): outro beats need outro:{headline,bullets}`);
  if (b.scene === "browser" && !b.browser?.pageHTML)
    fail(`beat ${i} (${b.id}): browser beats need browser:{pageHTML} (raw HTML with inline styles)`);
  if (b.scene === "doc" && !b.doc?.body)
    fail(`beat ${i} (${b.id}): doc beats need doc:{title?, body} (body is raw HTML)`);
  (b.actions || []).forEach((a, j) => {
    if (["type", "highlight-line", "callout"].includes(a.do) && !(a.line >= 1))
      fail(`beat ${i} action ${j}: "${a.do}" needs line >= 1`);
    if (a.do === "type" && !a.segs?.length) fail(`beat ${i} action ${j}: type needs segs [[cls,text],...]`);
  });
});

const clipMode = args.includes("--clip") || spec.clipMode === true;
let beats = spec.beats.map((b, i) => ({ ...b, origIndex: i }));
if (clipMode) {
  const dropped = beats.filter((b) => b.scene === "title" || b.scene === "outro");
  if (dropped.length) warn(`clipMode: dropping ${dropped.map((b) => b.id).join(", ")}`);
  beats = beats.filter((b) => b.scene === "editor" || b.scene === "pause");
}

/* ---------- script-text captions, timed by the Whisper transcript ---------- */
const NUMW_C = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12" };
const alignKey = (w) => { const k = w.toLowerCase().replace(/[^a-z0-9']/g, ""); return NUMW_C[k] || k; };
function scriptTimedWords(text, tw) {
  // emphasis quotes around keywords ("if", "and") are for the voice; drop them from the caption
  const sw = text.replace(/"/g, "").split(/\s+/).filter(Boolean).map((t) => ({ text: t, k: alignKey(t) }));
  const tk = tw.map((w) => alignKey(w.text));
  const m = sw.length, n = tw.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = sw[i].k && sw[i].k === tk[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  for (let i = 0, j = 0; i < m && j < n; ) {
    if (sw[i].k && sw[i].k === tk[j]) { sw[i].start = tw[j].start; sw[i].end = tw[j].end; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  // unmatched script words: spread between the neighboring anchors by character length
  const t0 = tw.length ? tw[0].start : 0, t1 = tw.length ? tw[tw.length - 1].end : 1;
  for (let i = 0; i < m; ) {
    if (sw[i].start !== undefined) { i++; continue; }
    let j = i;
    while (j < m && sw[j].start === undefined) j++;
    const a = i > 0 ? sw[i - 1].end : t0, z = j < m ? sw[j].start : t1;
    const total = sw.slice(i, j).reduce((s, w) => s + w.text.length + 1, 0);
    let cur = a;
    for (let k = i; k < j; k++) {
      const d = ((z - a) * (sw[k].text.length + 1)) / total;
      sw[k].start = +cur.toFixed(2); cur += d; sw[k].end = +cur.toFixed(2);
    }
    i = j;
  }
  for (let i = 1; i < m; i++) if (sw[i].start < sw[i - 1].start + 0.06) sw[i].start = +(sw[i - 1].start + 0.06).toFixed(2);
  return sw.map(({ text, start, end }) => ({ text, start, end: Math.max(end, start + 0.06) }));
}

/* ---------- speech end (last non-silent moment) of a wav, via ffmpeg silencedetect ---------- */
function speechEndOf(wav, dur) {
  // only a silence that runs to the END of the file marks the speech end (pauses between sentences don't)
  const r = spawnSync("ffmpeg", ["-i", wav, "-af", "silencedetect=n=-35dB:d=0.2", "-f", "null", "-"], { encoding: "utf8" });
  const err = r.stderr || "";
  const starts = [...err.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const ends = [...err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  const last = starts[starts.length - 1];
  if (last === undefined) return dur;
  const trailing = ends.length < starts.length || ends[ends.length - 1] >= dur - 0.05;
  return trailing ? last : dur;
}
// silence_end times inside the clip = where each spoken phrase starts
function pauseEndsOf(wav) {
  const r = spawnSync("ffmpeg", ["-i", wav, "-af", "silencedetect=n=-35dB:d=0.2", "-f", "null", "-"], { encoding: "utf8" });
  return [...(r.stderr || "").matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
}
/* ---------- audio probe + transcripts ---------- */
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// xterm draws a shell prompt's first character in its own cell-wide span (shell-integration prompt mark at
// column 0); the rest of the row starts exactly one cell in. Same here, so every later glyph lands on the same
// sub-pixel position as in the app.
const promptHTML = (pr) => (pr ? `<span class="t-c0">${esc(pr[0])}</span>${esc(pr.slice(1))}` : "");
const ffprobe = (f) =>
  parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", f]).toString()
  );

for (const b of beats) {
  const nn = String(b.origIndex + 1).padStart(2, "0");
  b.wav = `audio/vo-${nn}-${b.id}.wav`;
  if (!b.narration) { b.wav = null; b.audioDur = 0; b.words = null; continue; } // a silent brand scene
  if (!existsSync(b.wav)) fail(`missing ${b.wav} — run TTS for beat "${b.id}" first`);
  b.audioDur = ffprobe(b.wav);
  const tj = b.wav.replace(/\.wav$/, ".json");
  if (existsSync(tj)) {
    const raw = JSON.parse(readFileSync(tj, "utf8"));
    b.words = Array.isArray(raw) ? raw : raw.words || [];
    // Caption TEXT comes from the script; Whisper only supplies the timing. (Lab 6.6 editor
    // sign-off: Whisper text put "Efor Ein", "seam tools", "in the loop" on screen.)
    // spec.captionSource: "whisper" restores the old behavior.
    // guard: Whisper sometimes stretches timestamps past the end of the speech (6.6 rep4: "course."
    // at 13.6 s in a 12.6 s clip, captions trailed the voice by 1.7 s). Rescale to the real speech end.
    b.speechEnd = speechEndOf(b.wav, b.audioDur);
    // the last word must START before the speech ends (word ends naturally run a little long)
    const lastStart = b.words.length ? b.words[b.words.length - 1].start : 0;
    const lastEnd = b.words.length ? b.words[b.words.length - 1].end : 0;
    if (lastStart > b.speechEnd + 0.1) {
      // re-time only the FINAL phrase (words after the last pause) — rescaling the whole beat pulled
      // every earlier caption ahead of the voice (6.6 extended, "mistakes" beat)
      const tail = Math.max(0, ...pauseEndsOf(b.wav).filter((t) => t < b.speechEnd - 0.3));
      const i0 = b.words.findIndex((w) => w.start >= tail - 0.15);
      const from = i0 >= 0 ? b.words[i0].start : 0;
      const k = Math.max(0.2, (b.speechEnd - 0.2 - from) / Math.max(0.01, lastStart - from));
      b.words = b.words.map((w, wi) =>
        wi < i0 ? w : { ...w, start: +(from + (w.start - from) * k).toFixed(2), end: +(from + (w.end - from) * k).toFixed(2) }
      );
      warn(`beat ${b.id}: transcript ran ${(lastEnd - b.speechEnd).toFixed(2)}s past the speech — rescaled caption timing (re-transcribe with --model medium.en for a better fix)`);
    }
    if (spec.captionSource !== "whisper" && b.narration) b.words = scriptTimedWords(b.captionText || b.narration, b.words);
  } else {
    b.words = null;
    warn(`beat ${b.id}: no transcript ${tj} — captions skipped for this beat`);
  }
}


/* ---------- caption fixes (respelling → correct display text) ---------- */
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, "");
function applyFixes(words, fixes) {
  if (!fixes?.length || !words) return words;
  const out = [...words.map((w) => ({ ...w }))];
  // longest keys first, so "by severity dot items" wins over "by severity"
  for (const [from, to] of [...fixes].sort((a, b) => b[0].split(/\s+/).length - a[0].split(/\s+/).length)) {
    const keyParts = from.toLowerCase().split(/[\s-]+/).map(norm).filter(Boolean);
    for (let i = 0; i <= out.length - keyParts.length; i++) {
      const slice = out.slice(i, i + keyParts.length);
      if (slice.every((w, k) => norm(w.text) === keyParts[k])) {
        const trailPunct = (slice[slice.length - 1].text.match(/[.,!?;:]+$/) || [""])[0];
        out.splice(i, keyParts.length, {
          text: to + (/[.,:;!?]$/.test(to) ? "" : trailPunct), // "for x in y:" never becomes "for x in y:."
          start: slice[0].start,
          end: slice[slice.length - 1].end,
        });
      }
    }
  }
  return out;
}

/* ---------- timing cascade ---------- */
// cpsCode simulates a person typing character-by-character — keep it human (~8). Don't raise
// it to "fit" more; split the beat. Never instantly fill a line (no cps above ~14).
const DEF = { cpsCode: 8, cpsTerm: 8, hold: 0.6, voDelayFirst: 0.8, voDelayNext: 0.3 };
// brand scenes: the sting plays STING_LEN s before its voice (the promise line) starts; the end screen
// lasts the 20 s YouTube's end-screen elements can cover
const STING_LEN = 2.6;
const MIN_DUR = { sting: STING_LEN + 0.3, endscreen: 20 };
const actionDur = (a) => {
  if (a.do === "type") return a.segs.reduce((n, s) => n + s[1].length, 0) / (a.cps || DEF.cpsCode);
  if (a.do === "term-type") return a.text.length / (a.cps || DEF.cpsTerm);
  if (a.do === "term-out") return a.callout ? 1.4 : 0.6;
  if (a.do === "terminal-open") return 0.7;
  if (a.do === "terminal-close") return 0.3;
  if (a.do === "wipe") return a.dur ?? 3;
  return 0.8;
};

let cursor = clipMode ? 0.5 : 0;
let prevScene = null;
for (const b of beats) {
  b.start = cursor;
  b.newScene = b.scene !== "editor" || prevScene !== "editor";
  const voDelay = b.scene === "sting" ? Math.max(b.voDelay ?? 0, STING_LEN) : b.voDelay ?? (b.start === 0 ? 0.5 : b.newScene ? DEF.voDelayFirst : DEF.voDelayNext);
  b.audioAt = b.start + voDelay;
  const audioEnd = b.audioAt + b.audioDur;

  // resolve action times (relative -> absolute)
  let prevEnd = 0;
  b.absActions = (b.actions || []).map((a) => {
    let rel;
    if (typeof a.at === "number") rel = a.at;
    else if (typeof a.at === "string" && a.at.startsWith("prev+")) rel = prevEnd + parseFloat(a.at.slice(5));
    else fail(`beat ${b.id}: bad at "${a.at}" (number or "prev+N")`);
    const start = b.start + rel;
    const end = start + actionDur(a);
    prevEnd = rel + actionDur(a);
    return { ...a, absStart: start, absEnd: end };
  });
  const visualEnd = Math.max(b.start, ...b.absActions.map((a) => a.absEnd));
  if (visualEnd > audioEnd + 0.2 && b.absActions.length)
    warn(
      `beat ${b.id}: visuals run ${(visualEnd - audioEnd).toFixed(1)}s past narration — consider raising cps or trimming actions`
    );
  // Explain each line as you type it: each typed line wants its own spoken explanation.
  const typeCount = (b.actions || []).filter((a) => a.do === "type").length;
  const words = (b.narration || "").trim().split(/\s+/).filter(Boolean).length;
  if (b.scene === "editor" && typeCount >= 2 && words / typeCount < 8)
    warn(
      `beat ${b.id}: only ~${Math.round(words / typeCount)} narration words per typed line — explain each line as you type it (add narration or split the beat)`
    );
  b.end = Math.max(audioEnd + (b.holdAfter ?? DEF.hold), visualEnd + 0.6, b.start + (b.minDur ?? MIN_DUR[b.scene] ?? 0));
  cursor = b.end;
  prevScene = b.scene;
}
const fadeOut = !clipMode;
const duration = +(cursor + (clipMode ? 0.5 : 1.0)).toFixed(2);

/* ---------- scene grouping ---------- */
const scenes = [];
for (const b of beats) {
  const cur = scenes[scenes.length - 1];
  // A pauseOverlay beat closes its editor scene, so the next step starts a fresh
  // editor window (preserving the recap/prefill pattern). Otherwise consecutive
  // editor beats share one window.
  const lastBeat = cur?.beats[cur.beats.length - 1];
  const sameCompare = cur && cur.kind === "compare" && b.scene === "compare" && !b.transition;
  if (sameCompare || (cur && cur.kind === "editor" && b.scene === "editor" && !lastBeat?.pauseOverlay && b.viewTop === undefined && !b.transition)) {
    cur.beats.push(b);
    cur.end = b.end;
  } else {
    scenes.push({ id: `sc${scenes.length + 1}`, kind: b.scene, beats: [b], start: b.start, end: b.end });
  }
  b.sceneId = scenes[scenes.length - 1].id;
}
scenes[scenes.length - 1].end = duration;

const transitions = scenes.slice(1).map((s, i) => {
  const prev = scenes[i];
  const explicit = s.beats[0].transition;
  const type = explicit || (prev.kind === "title" && s.kind === "editor" ? "zoom" : "blur");
  return { at: +s.start.toFixed(2), type, from: prev.id, to: s.id };
});

/* ---------- HTML generators ---------- */
// the stock macOS zsh prompt (/etc/zshrc: "%n@%m %1~ %# ")
const prompt = spec.terminalPrompt || `student@MacBook-Pro ${spec.file.folder || "demo"} % `;
const langClass = `lang-${spec.file.lang || "plain"}`;

/* Tween CODE GENERATION.
 * hyperframes lint statically analyzes gsap calls; variable selectors become
 * "__unresolved__" and falsely overlap each other. So every tween is emitted as a
 * literal line (literal selector, literal time). Only tl.call typing and tl.set
 * captions stay data-driven. */
const typingData = [];
// what the current pause step asked the student to type (editor lines per file + terminal input), for the
// pause-visibility check (at a pause, everything they must type has to be ON SCREEN)
const STEP = { lines: [], cmds: [] };
// a pause card says STEP n OF m, or its own badge (a lesson's "PREDICT THE OUTPUT" checkpoint)
const pauseBadge = (b) => b.badge || `STEP ${b.step.n} OF ${b.step.of}`;
const DIRTY = new Map(); // file name -> unsaved edits that carry across cuts until a {do:"save"}
const pauseErrors = []; // reported together after every scene is built (one rebuild fixes them all)
const statusData = []; // status bar Ln/Col changes: [{id, t, txt}]
const J = [];
const emit = (l) => J.push("      " + l);
const n2 = (x) => (+x).toFixed(2);
function genBlink(id, t0, t1) {
  const reps = Math.max(1, Math.ceil((t1 - t0) / 0.38) - 1);
  emit(`tl.set("#${id}", { visibility: "visible" }, ${n2(t0)});`);
  emit(`tl.to("#${id}", { opacity: 0, duration: 0.38, yoyo: true, repeat: ${reps}, ease: "steps(1)" }, ${n2(t0)});`);
  emit(`tl.set("#${id}", { visibility: "hidden" }, ${n2(t1)});`);
}
// the real editor cursor (Monaco, cursorBlinking "blink"): solid while keys are going in, otherwise
// 0.5 s on / 0.5 s off. Blink runs only in whole on+off pairs so it always ends visible.
function blinkSpan(id, a, b) {
  // Monaco (editor.cursorBlinking "blink", measured in VS Code 1.138): solid for 0.5 s after the last change, then it
  // flips every 0.5 s (dark at a+0.5, lit at a+1.0, ...) for as long as nothing happens - any gap, any length. The
  // next change (b: a keystroke, a move) makes it solid again, whatever phase it was in.
  const flips = [];
  for (let t = a + 0.5; t < b - 0.03; t += 0.5) flips.push(t);
  if (!flips.length) return;
  // GSAP's steps(1) jumps in the MIDDLE of each 0.5 s half (it is (2p|0)), so the yoyo starts 0.25 s after a to put
  // the flips on a+0.5, a+1.0, ...; it must end by b, and a flip left over after it is a plain set
  const H = Math.min(flips.length, Math.floor((b - a - 0.25) / 0.5 + 1e-9));
  if (H >= 1) emit(`tl.to("#${id}", { opacity: 0, duration: 0.5, yoyo: true, repeat: ${H - 1}, ease: "steps(1)" }, ${n2(a + 0.25)});`);
  for (let i = Math.max(H, 0); i < flips.length; i++) emit(`tl.set("#${id}", { opacity: ${i % 2 === 0 ? 0 : 1} }, ${n2(flips[i])});`);
  if (flips.length % 2 === 1) emit(`tl.set("#${id}", { opacity: 1 }, ${n2(b)});`);
}
// firstKey / lastKey: the real keystroke times (keyTimes), so the idle blink counts from the last key itself
function genCursor(id, showAt, firstKey, lastKey, hideAt) {
  emit(`tl.set("#${id}", { visibility: "visible", opacity: 1 }, ${n2(showAt)});`);
  blinkSpan(id, showAt, firstKey);
  blinkSpan(id, lastKey, hideAt);
  emit(`tl.set("#${id}", { visibility: "hidden" }, ${n2(hideAt)});`);
}
// the terminal cursor does not blink (terminal.integrated.cursorBlinking: false)
function genSolid(id, t0, t1) {
  emit(`tl.set("#${id}", { visibility: "visible" }, ${n2(t0)});`);
  emit(`tl.set("#${id}", { visibility: "hidden" }, ${n2(t1)});`);
}
function genBreathe(sel, t0, t1, sc = 1.07) {
  let reps = Math.max(1, Math.ceil((t1 - t0) / 2.3) - 1);
  if (reps % 2 === 0) reps += 1; // odd → ends at base scale
  emit(`tl.to("${sel}", { scale: ${sc}, duration: 2.3, yoyo: true, repeat: ${reps}, ease: "sine.inOut" }, ${n2(t0)});`);
}

function titleSceneHTML(sc) {
  const t = spec.title || {};
  return `
      <div id="${sc.id}" class="scene"${sc !== scenes[0] ? ' style="opacity:0"' : ""}>
        <div class="glow glow-a" data-layout-ignore style="top:-350px;left:-250px;width:1300px;height:1300px;"></div>
        ${t.ghost === false ? "" : `<div class="ttl-ghost mono" data-layout-ignore>${esc(t.ghost || spec.file.name)}</div>`}
        <div class="ttl-corner tl"></div>
        <div class="ttl-corner br"></div>
        <div class="ttl-content">
          <div class="ttl-meta"><div class="ttl-meta-rule"></div><div>${esc(spec.course || "")}${spec.module ? " &middot; " + esc(spec.module) : ""}</div></div>
          <div class="ttl-hero">${esc(t.hero || "")}${t.accent ? ' <span class="accent">' + esc(t.accent) + "</span>" : ""}</div>
          <div class="ttl-bar"></div>
          <div class="ttl-sub">${esc(t.sub || "")}</div>
        </div>
        <div class="ttl-chip mono">${esc(t.chip || spec.module || "LESSON")}</div>
      </div>`;
}

/* compare scene (pixel test): a real VS Code capture laid exactly over the generated window in the same
   state, with a seam that wipes across ({do:"wipe", at, dur, to}: to = share of the window that shows the
   REAL capture, 1 = all real, 0 = all generated), then optionally the pixel-difference heatmap
   ({do:"heat", at}). beat.compare = { real, heat?, file, folder, lines:[a,b], cursor, interp, labels, stat } */
function compareSceneHTML(sc) {
  const cp = sc.beats[0].compare || fail(`compare scene ${sc.id}: beat.compare missing`);
  const files = spec.files || [{ name: spec.file.name, base: 0 }];
  const fm = files.find((x) => x.name === cp.file) || { base: 0 };
  const base = fm.base || 0;
  const [a, b] = cp.lines;
  const codeAt = (n) => (SPEC_CODE?.[base + n] ?? "");
  const ind = (t) => t.match(/^ */)[0].length;
  const isText = (n) => codeAt(n).trim() !== "";
  const cur = cp.cursor || 1;
  let code = "";
  const cmpRows = [];
  for (let n = a; n <= b; n++) {
    const t = codeAt(n);
    const segs = REAL_TOK.get(t) || [["", t]];
    const spans = segs.map(([c, x]) => `<span${c ? ` class="${c}"` : ""}>${esc(x)}</span>`).join("");
    let gi = ind(t);
    if (!isText(n)) { let u = n - 1, d = n + 1; while (u >= a && !isText(u)) u--; while (d <= b && !isText(d)) d++; gi = u < a || d > b ? 0 : Math.min(ind(codeAt(u)), ind(codeAt(d))); }
    let g = "";
    for (let c = 0; c < gi; c += 4) g += `<span class="ig" style="left:${(GEOM.gutter + c * GEOM.charWidth).toFixed(3)}px"></span>`;
    const isCur = n === cur;
    code += `<div class="code-line"><span class="lh lh-cur"${isCur ? ' style="visibility:visible"' : ""}></span><div class="gutter"${isCur ? ` style="color:${THEME("editorLineNumber-activeForeground")}"` : ""}>${n}</div><div class="code-text">${isCur ? '<span class="cursor" style="visibility:visible"></span>' : ""}${spans}</div>${g}</div>`;
    cmpRows.push({ row: n - 1, ...mmRow(segs) });
  }
  minimapData.push({ id: `${sc.id}-mmc`, rows: cmpRows });
  const edH = GEOM.height - 35 - 22 - 35 - 22;
  const win = vscWindowHTML({
    id: sc.id, folder: cp.folder || spec.file.folder, lang: "python",
    explorer: [{ name: cp.file, cls: "main active" }],
    tabs: [{ name: cp.file, on: true }],
    breadcrumb: { name: cp.file },
    codeHTML: code, minimapHTML: `<canvas class="mmc" id="${sc.id}-mmc" width="${2 * GEOM.minimap}" height="644"></canvas>`,
    rulerHTML: `<span class="rc" style="top:${(((cur - a) * GEOM.lineHeight * edH) / ((b - a + 1) * GEOM.lineHeight + edH - GEOM.lineHeight)).toFixed(1)}px"></span>`,
    status: { lnColHTML: `Ln ${cur}, Col 1`, lang: "Python", interp: cp.interp || spec.statusRight },
    geom: GEOM,
  });
  // timeline: wipes and heatmap
  let p = cp.start ?? 0.5; // share shown REAL at the start (0.5: real on the left half, generated on the right)
  let wipeEnd = -1;
  emit(`tl.set("#${sc.id}-seam", { x: ${(p * 2 * GEOM.width).toFixed(1)} }, ${n2(sc.start)});`);
  emit(`tl.set("#${sc.id}-real", { width: ${(p * 2 * GEOM.width).toFixed(1)} }, ${n2(sc.start)});`);
  for (const bb of sc.beats)
    for (const x of bb.absActions) {
      if (x.do === "wipe") {
        const to = x.to ?? 0;
        const dur = x.dur ?? 3;
        x.absStart = Math.max(x.absStart, wipeEnd + 0.05); // wipes never overlap (same element, same property)
        wipeEnd = x.absStart + dur;
        emit(`tl.fromTo("#${sc.id}-real", { width: ${(p * 2 * GEOM.width).toFixed(1)} }, { width: ${(to * 2 * GEOM.width).toFixed(1)}, duration: ${n2(dur)}, ease: "sine.inOut", immediateRender: false }, ${n2(x.absStart)});`);
        emit(`tl.fromTo("#${sc.id}-seam", { x: ${(p * 2 * GEOM.width).toFixed(1)} }, { x: ${(to * 2 * GEOM.width).toFixed(1)}, duration: ${n2(dur)}, ease: "sine.inOut", immediateRender: false }, ${n2(x.absStart)});`);
        // a label with no room at the frame edge fades out (left label as the seam reaches the left edge, etc.)
        const lOn = (q) => (q < 0.15 ? 0 : 1), rOn = (q) => (q > 0.85 ? 0 : 1);
        if (lOn(to) !== lOn(p)) emit(`tl.fromTo("#${sc.id}-labl", { opacity: ${lOn(p)} }, { opacity: ${lOn(to)}, duration: ${n2(Math.min(0.4, dur / 3))}, ease: "none", immediateRender: false }, ${n2(x.absStart + (lOn(to) ? dur * 0.4 : dur / 2))});`);
        if (rOn(to) !== rOn(p)) emit(`tl.fromTo("#${sc.id}-labr", { opacity: ${rOn(p)} }, { opacity: ${rOn(to)}, duration: ${n2(Math.min(0.4, dur / 3))}, ease: "none", immediateRender: false }, ${n2(x.absStart + (rOn(to) ? dur * 0.4 : dur / 2))});`);
        p = to;
      } else if (x.do === "heat") {
        emit(`tl.set("#${sc.id}-seam", { visibility: "hidden" }, ${n2(x.absStart)});`);
        emit(`tl.fromTo("#${sc.id}-heat", { opacity: 0, visibility: "visible" }, { opacity: 1, duration: 0.5, ease: "power1.out" }, ${n2(x.absStart)});`);
        emit(`tl.fromTo("#${sc.id}-stat", { opacity: 0, y: 12, visibility: "visible" }, { opacity: 1, y: 0, duration: 0.45, ease: "back.out(1.6)" }, ${n2(x.absStart + 0.5)});`);
      }
    }
  const [lL, lR] = cp.labels || ["REAL VS CODE", "GENERATED"];
  return `
      <div id="${sc.id}" class="scene"${sc !== scenes[0] ? ' style="opacity:0"' : ""}>
        <div class="glow glow-a" data-layout-ignore style="top:50%;left:50%;width:1750px;height:1100px;margin:-550px 0 0 -875px;"></div>
        <div class="ed-label mono">${esc(spec.editorLabel || `${spec.course || ""}${spec.module ? " — " + spec.module : ""}`)}</div>
        <div class="ed-label-r mono">${esc(cp.caption || "real vs generated")}</div>
        ${win}
        <div class="cmp-real" id="${sc.id}-real"><div class="cmp-real-in"><img src="${esc(cp.real)}" alt="" /><img class="cmp-tl" src="vscode/tlights.svg" alt="" /></div></div>
        <div class="cmp-seam" id="${sc.id}-seam" data-layout-allow-overflow><span class="cmp-lab l" id="${sc.id}-labl">${esc(lL)}</span><span class="cmp-lab r" id="${sc.id}-labr">${esc(lR)}</span></div>
        ${cp.heat ? `<div class="cmp-heat" id="${sc.id}-heat" style="visibility:hidden"><img src="${esc(cp.heat)}" alt="" /></div><div class="cmp-stat" id="${sc.id}-stat" style="visibility:hidden">${esc(cp.stat || "")}</div>` : ""}
      </div>`;
}

function browserSceneHTML(sc) {
  const b = sc.beats[0];
  const br = b.browser;
  // pageHTML is author-provided raw HTML (inline styles) — intentionally NOT escaped
  return `
      <div id="${sc.id}" class="scene" style="opacity:0">
        <div class="glow glow-a" data-layout-ignore style="top:50%;left:50%;width:1700px;height:1100px;margin:-550px 0 0 -850px;"></div>
        <div class="ed-label mono">${esc(spec.editorLabel || `${spec.course || ""}${spec.module ? " — " + spec.module : ""}`)}</div>
        <div class="ed-label-r mono">${esc(br.engine || "browser")} &middot; live preview</div>
        <div class="brw">
          <div class="brw-chrome">
            <div class="brw-tabs">
              <div class="brw-dots">
                <div class="brw-dot" style="background:#ff5f57"></div><div class="brw-dot" style="background:#febc2e"></div><div class="brw-dot" style="background:#28c840"></div>
              </div>
              <div class="brw-tab">${esc(br.tab || spec.file.name)}</div>
            </div>
            <div class="brw-urlrow">
              <div class="brw-nav">&larr;&nbsp;&nbsp;&rarr;&nbsp;&nbsp;&#8635;</div>
              <div class="brw-url">${esc(br.url || `file:///${spec.file.name}`)}</div>
            </div>
          </div>
          <div class="brw-page" style="${esc(br.pageStyle || "")}">${br.pageHTML}</div>
        </div>
        ${br.callout ? `<div class="brw-note" id="${sc.id}-note" data-layout-allow-overflow>${esc(br.callout.text)}</div>` : ""}
      </div>`;
}

function docSceneHTML(sc) {
  const d = sc.beats[0].doc;
  let body = d.body;
  for (const m of sceneMarks(sc)) {
    if (m.find === undefined) fail(`doc scene ${sc.id}: marks on slides need find:"text"`);
    body = wrapDocMark(body, m);
    emitMarkInline(m);
  }
  // d.body is author-provided raw HTML (inline styles / .doc-* classes) — NOT escaped
  return `
      <div id="${sc.id}" class="scene" style="opacity:0">
        <div class="glow glow-a" data-layout-ignore style="top:-300px;left:-250px;width:1300px;height:1300px;"></div>
        <div class="ed-label mono">${esc(spec.course || "")}${spec.module ? " &middot; " + esc(spec.module) : ""}${spec.docLabel === "" ? "" : " &middot; " + esc(spec.docLabel || "ASSIGNMENT")}</div>
        <div class="doc-sheet">
          ${d.tag ? `<div class="doc-tag">${esc(d.tag)}</div>` : ""}
          ${d.title ? `<div class="doc-title">${esc(d.title)}</div>` : ""}
          <div class="doc-body">${body}</div>
        </div>
        ${d.callout ? `<div class="brw-note" id="${sc.id}-note" data-layout-allow-overflow>${esc(d.callout.text)}</div>` : ""}
      </div>`;
}

function pauseSceneHTML(sc) {
  const b = sc.beats[0];
  return `
      <div id="${sc.id}" class="scene" style="opacity:0">
        <div class="glow glow-b" data-layout-ignore style="top:-300px;right:-350px;width:1250px;height:1250px;"></div>
        <div class="pc-inner">
          <div class="pc-glyph"><div></div><div></div></div>
          <div class="pc-badge mono">${esc(pauseBadge(b))}</div>
          <div class="pc-head">${esc(b.task)}</div>
          <div class="pc-list">
            ${b.checklist.map((c) => `<div class="pc-item"><div class="pc-box"></div><div>${esc(c)}</div></div>`).join("\n            ")}
          </div>
          ${b.hint ? `<div class="pc-hint">${esc(b.hint)}</div>` : ""}
        </div>
        <div class="pc-foot">&#9658;&nbsp;&nbsp;PRESS PLAY WHEN YOU&rsquo;RE DONE</div>
      </div>`;
}

function outroSceneHTML(sc) {
  const o = sc.beats[0].outro;
  return `
      <div id="${sc.id}" class="scene" style="opacity:0">
        <div class="glow glow-b" data-layout-ignore style="bottom:-420px;right:-300px;width:1400px;height:1400px;"></div>
        <div class="ot-inner">
          <div class="ot-head">${esc(o.headline)}${o.accent ? ' <span class="accent">' + esc(o.accent) + "</span>" : ""}</div>
          <div class="ot-list">
            ${(o.bullets || []).map((x) => `<div class="ot-item"><div class="ot-tick"></div><div>${esc(x)}</div></div>`).join("\n            ")}
          </div>
        </div>
        <div class="ot-rule"></div>
        <div class="ot-foot">${esc(o.foot || `${spec.course || ""}${spec.module ? " · " + spec.module : ""}`)}</div>
      </div>`;
}

/* ---------- brand scenes: sting, recap, end screen (course lessons) ----------
   The emblem and display font come from a brand profile (brand.json: video.emblem, video.fonts.display / .code,
   video.code_theme, video.identity) and are copied into the project (brand/emblem.png, fonts/brand-*.woff2),
   because a composition only loads local files. "neutral" has no emblem: text only.
   spec.branding is "neutral", a path to a brand.json (or to a folder holding one), or a brand id looked up as
   $BRANDS_DIR/<id>/brand.json, then brands/<id>/brand.json in the project or any folder above it. */
function findBrandJson(brandId) {
  const direct = resolve(brandId);
  if (/\.json$/i.test(brandId) && existsSync(direct)) return direct;
  if (existsSync(resolve(direct, "brand.json")) && /[\\/.]/.test(brandId)) return resolve(direct, "brand.json");
  if (process.env.BRANDS_DIR) {
    const p = resolve(process.env.BRANDS_DIR, brandId, "brand.json");
    if (existsSync(p)) return p;
  }
  for (let dir = process.cwd(); ; ) {
    const p = resolve(dir, "brands", brandId, "brand.json");
    if (existsSync(p)) return p;
    const up = resolve(dir, "..");
    if (up === dir) break;
    dir = up;
  }
  return null;
}
let BRAND_ART;
function brandArt() {
  if (BRAND_ART) return BRAND_ART;
  BRAND_ART = { emblem: null, display: false, mono: false, name: "", handle: "" };
  const id = spec.branding || "neutral";
  const bj = id === "neutral" ? null : findBrandJson(id);
  if (!bj) return BRAND_ART;
  const b = JSON.parse(readFileSync(bj, "utf8"));
  const bdir = dirname(bj), v = b.video || {};
  BRAND_ART.name = v.identity?.name || b.brand?.name || "";
  BRAND_ART.handle = v.identity?.handle || "";
  const em = v.emblem && resolve(bdir, v.emblem);
  if (em && existsSync(em)) {
    mkdirSync("brand", { recursive: true });
    copyFileSync(em, "brand/emblem.png");
    BRAND_ART.emblem = "brand/emblem.png";
  }
  const fdir = resolve(bdir, "assets/fonts");
  for (const [k, fam] of [["display", v.fonts?.display], ["mono", v.fonts?.code]]) {
    const f = fam && existsSync(fdir) && readdirSync(fdir).find((n) => n.startsWith(fam.replace(/\s+/g, "")) && n.endsWith(".woff2"));
    if (!f) continue;
    mkdirSync("fonts", { recursive: true });
    copyFileSync(resolve(fdir, f), `fonts/brand-${k}.woff2`);
    BRAND_ART[k] = true;
  }
  return BRAND_ART;
}
const emblemImg = (cls) => (brandArt().emblem ? `<img class="${cls}" src="${brandArt().emblem}" alt="" />` : "");

/* sting: the 2–3 s helmet in place of a title intro (strategy §5). The emblem lands with a ring pulse and the
   wordmark; at STING_LEN it slides left and the lesson card comes in while the voice says the promise line.
   beat.sting = { chip: "LESSON 01", title, course, free } — all optional; with no title it's the bare sting. */
function stingSceneHTML(sc) {
  const s = sc.beats[0].sting || {};
  const art = brandArt();
  return `
      <div id="${sc.id}" class="scene"${sc !== scenes[0] ? ' style="opacity:0"' : ""}>
        <div class="glow glow-a" data-layout-ignore style="top:50%;left:50%;width:1500px;height:1500px;margin:-750px 0 0 -750px;"></div>
        <div class="stg-mark">
          <div class="stg-ring"></div>
          ${emblemImg("stg-emb")}
          <div class="stg-word">${esc(s.word || art.name || spec.course || "")}</div>
        </div>
        ${s.title ? `<div class="stg-card">
          ${s.chip ? `<div class="stg-chip">${esc(s.chip)}</div>` : ""}
          <div class="stg-title">${esc(s.title)}</div>
          ${s.course ? `<div class="stg-course">${esc(s.course)}</div>` : ""}
          ${s.free ? `<div class="stg-free"><span class="stg-arrow">&#8595;</span>${esc(s.free)}</div>` : ""}
        </div>` : ""}
      </div>`;
}

/* recap: three lines, on screen and spoken (strategy §5, part 8). beat.recap = { tag?, head?, lines: [] };
   {do:"recap-line", n, at} actions bring line n in on its words, otherwise they stagger in. */
function recapSceneHTML(sc) {
  const r = sc.beats[0].recap;
  return `
      <div id="${sc.id}" class="scene" style="opacity:0">
        <div class="glow glow-b" data-layout-ignore style="bottom:-420px;right:-300px;width:1400px;height:1400px;"></div>
        <div class="rcp-top">${emblemImg("rcp-emb")}<div class="rcp-tag">${esc(r.tag || "RECAP")}</div></div>
        <div class="rcp-head">${esc(r.head || "Recap")}</div>
        <div class="rcp-list">
          ${r.lines.map((x, i) => `<div class="rcp-item" id="${sc.id}-rl${i}"><div class="rcp-n">${i + 1}</div><div class="rcp-t">${esc(x)}</div></div>`).join("\n          ")}
        </div>
      </div>`;
}

/* end screen: the last 20 s (strategy §5, part 9). Two 16:9 frames where YouTube's end-screen elements go:
   the next lesson on the left, the full playlist on the right (set them up in YouTube Studio to cover the
   frames). beat.endscreen = { head?, next: {label, title}, playlist: {label, title} } */
function endscreenSceneHTML(sc) {
  const e = sc.beats[0].endscreen;
  const art = brandArt();
  const slot = (side, x = {}) => `<div class="es-slot es-${side}">
          ${x.label ? `<div class="es-lab">${esc(x.label)}</div>` : ""}
          <div class="es-box"></div>
          ${x.title ? `<div class="es-title">${esc(x.title)}</div>` : ""}
        </div>`;
  return `
      <div id="${sc.id}" class="scene" style="opacity:0">
        <div class="glow glow-a" data-layout-ignore style="top:-300px;left:50%;width:1600px;height:1100px;margin-left:-800px;"></div>
        ${e.head ? `<div class="es-head">${esc(e.head)}</div>` : ""}
        ${slot("left", e.next)}
        ${slot("right", e.playlist)}
        <div class="es-foot">${emblemImg("es-emb")}<span>${esc(art.handle || art.name || "")}</span></div>
      </div>`;
}

/* ---------- debugger trace (step + var) ----------
   step: {do:"step", line, at} — persistent yellow "current line" marker (debugger style) that
         moves to the next step's line, cleared at scene end.
   var:  {do:"var", name, value, at} — sets a value in the sidebar VARIABLES panel (flashes).
   First beat of the scene: debug:{ vars:[[name, initialValue|null], ...] } lists the rows. */
function debugPanelHTML(sc) {
  const d = sc.beats[0].debug;
  if (!d) return "";
  const acts = sc.beats.flatMap((b) => b.absActions.filter((a) => a.do === "var"));
  let rows = "";
  d.vars.forEach(([name, init], ri) => {
    const states = [];
    if (init !== null && init !== undefined) states.push({ v: init, t: null });
    for (const a of acts.filter((a) => a.name === name).sort((x, y) => x.absStart - y.absStart)) states.push({ v: a.value, t: a.absStart });
    const rowId = `${sc.id}-dv${ri}`;
    const hidden = !states.length || states[0].t !== null;
    let vals = "";
    states.forEach((st, k) => {
      const vid = `${rowId}-v${k}`;
      const cls = st.v === "True" ? "dv-true" : st.v === "False" ? "dv-false" : /^['"]/.test(st.v) ? "dv-str" : "dv-num";
      const first = k === 0 && st.t === null;
      vals += `<span id="${vid}" class="dv-val ${cls}"${first ? "" : ' style="visibility:hidden"'}>${esc(st.v)}</span>`;
      if (st.t !== null) {
        const prev = k > 0 ? `${rowId}-v${k - 1}` : null;
        if (prev) emit(`tl.set("#${prev}", { visibility: "hidden" }, ${n2(st.t)});`);
        emit(`tl.set("#${vid}", { visibility: "visible" }, ${n2(st.t)});`);
        // the real debugger's "value changed" flash: debugView.valueChangedHighlight at 30%, fading over 1 s
        const nextT = states[k + 1]?.t;
        const fd = Math.min(1.0, nextT != null ? nextT - st.t - 0.02 : 1.0);
        emit(`tl.fromTo("#${rowId} .dv-cell", { backgroundColor: "rgba(86,156,214,0.3)" }, { backgroundColor: "rgba(86,156,214,0)", duration: ${n2(fd)}, ease: "none", immediateRender: false }, ${n2(st.t)});`);
      }
    });
    if (hidden && states.length) emit(`tl.set("#${rowId}", { visibility: "visible" }, ${n2(states[0].t)});`);
    // names starting with ' or a digit are dict entries → one level deeper
    const child = /^['"0-9]/.test(name);
    rows += `<div class="dv-row${child ? " dv-child" : ""}" id="${rowId}"${hidden ? ' style="visibility:hidden"' : ""}><span class="dv-name">${esc(name)}</span><span class="dv-colon">:</span><span class="dv-cell">${vals}</span></div>`;
  });
  // a real collapsible pane (same header as OUTLINE/TIMELINE); the badge text shows as the pane description
  return `<div class="dv-panel"${d.fontSizeLogical ? ` style="--dvfs:${d.fontSizeLogical}px"` : ""}>
                <div class="pane-hd bt"><span class="ci tw">&#x${ICON.chevDown};</span><span class="ttl">Variables</span><span class="desc">${esc((d.badge || "trace").toLowerCase())}</span></div>
                <div class="dv-scope"><span class="ci tw">&#x${ICON.chevDown};</span>${esc(d.scope || "Locals")}</div>
                ${rows}
              </div>`;
}
function emitSteps(sc) {
  const steps = sc.beats.flatMap((b) => b.absActions.filter((a) => a.do === "step")).sort((x, y) => x.absStart - y.absStart);
  steps.forEach((st, i) => {
    const next = steps[i + 1];
    const inAt = st.absStart;
    const outAt = next ? next.absStart : sc.end - 0.25;
    // the real debugger: the paused line gets editor.stackFrameHighlightBackground (whole line) and the
    // yellow debug-stackframe arrow in the glyph margin. Steps switch instantly, like stepping does.
    emit(`tl.set("#${sc.id} .cl-${st.line} .lh-dbg", { visibility: "visible" }, ${n2(inAt)});`);
    emit(`tl.set("#${sc.id} .cl-${st.line} .lh-dbg", { visibility: "hidden" }, ${n2(outAt)});`);
  });
}

/* ---------- marks: a red box around exactly what the narration is talking about ----------
   (as you speak, the student can see exactly what you are referencing)
   {do:"mark", line, text, n?, to?, at, hold?}  editor: n-th `text` in code line `line` (to: box lines line..to)
   {do:"mark", cmd, n?, at, hold?}              terminal: `cmd` inside the latest typed terminal line
   {do:"mark", out, n?, at, hold?}              terminal: `out` inside the latest output block shown by `at`
   {do:"mark", find, n?, at, hold?}             doc slide: n-th `find` in the slide (whole .codename chip
                                                when the match is the chip's entire text)
   A box stays up until the next mark in the scene starts (one box = "here, now"), at most MARK_MAX s,
   or exactly `hold` s. */
const MARK_MAX = 6;
const LATE_MARKS = []; // marks whose text isn't typed yet when the voice says the phrase (checked after all scenes)
function sceneMarks(sc) {
  const acts = sc.beats.flatMap((b) => b.absActions);
  const ms = acts.filter((a) => a.do === "mark");
  // a box never appears around text that isn't typed yet: hold it until the typing gets there
  for (const m of ms) {
    m.absUntil = m.until != null && typeof m.at === "number" ? m.absStart - m.at + m.until : null;
    m.phraseAt = m.absStart;
    if (m.line >= 1 && m.text !== undefined) {
      let ready = -Infinity;
      for (let ln = m.line; ln <= (m.to || m.line); ln++) {
        const ta = acts.filter((a) => a.do === "type" && a.line === ln).pop();
        if (!ta) continue;
        const src = ta.segs.map((x) => x[1]).join("");
        const col = ln === m.line ? Math.max(0, nthIndex(src, m.text, m.n || 1)) : 0;
        const upto = ln === m.line && !m.to ? col + m.text.length : src.length;
        ready = Math.max(ready, ta.absStart + upto / (ta.cps || DEF.cpsCode) + 0.1);
      }
      if (m.absStart < ready) m.absStart = ready;
    } else if (m.cmd !== undefined) {
      const ta = acts.filter((a) => a.do === "term-type" && a.absStart <= m.absStart && nthIndex(a.text, m.cmd, m.n || 1) >= 0).pop();
      if (ta) m.absStart = Math.max(m.absStart, ta.absStart + (nthIndex(ta.text, m.cmd, m.n || 1) + m.cmd.length) / (ta.cps || DEF.cpsTerm) + 0.1);
    }
  }
  const late = ms.filter((m) => m.absStart - m.phraseAt > 0.5);
  late.forEach((m) => LATE_MARKS.push(`scene ${sc.id} "${m.text || m.cmd}" +${(m.absStart - m.phraseAt).toFixed(1)}s`));
  for (const m of [])
      fail(`scene ${sc.id}: mark "${m.text || m.cmd}" waits ${(m.absStart - m.phraseAt).toFixed(1)}s for typing — the voice says it before the text exists. Mark something already on screen, or move the phrase`);
  ms.sort((a, b) => a.absStart - b.absStart);
  ms.forEach((m, i) => {
    const next = ms.slice(i + 1).find((x) => x.absStart > m.absStart + 0.05);
    const s = m.absStart;
    let e = m.hold != null ? s + m.hold : Math.min(next ? next.absStart : Infinity, s + MARK_MAX, m.absUntil ?? Infinity);
    e = Math.min(e, sc.end - 0.25);
    if (e - s < 0.6) warn(`scene ${sc.id}: mark "${m.text || m.find || m.out || m.cmd}" is only up ${(e - s).toFixed(2)}s`);
    m.markId = `${sc.id}-mk${i}`;
    m.markEnd = e;
  });
  return ms;
}
const nthIndex = (hay, needle, n = 1) => {
  let i = -1;
  for (let k = 0; k < n; k++) {
    i = hay.indexOf(needle, i + 1);
    if (i < 0) return -1;
  }
  return i;
};
// absolutely-positioned box (monospace text: columns are exact in ch units)
// xterm wraps a row at its column count: (panel width - 20 padding - 14 scrollbar) / cell (67 at the default 14 / 850;
// terminalFontSize 12 in a 920 window: 88). The build wraps program output the same way, so mark boxes, the output
// ring and the ruler rows match what's on screen (EDITOR m07 round 5: long output lines were clipped at the panel edge)
const TCOLS = GEOM.termCols;
const wrapT = (l) => { const out = []; for (let i = 0; i < l.length || i === 0; i += TCOLS) out.push(l.slice(i, i + TCOLS)); return out; };
function markBoxHTML(m, col, len, lines = 1, row = 0, x0 = "0px") {
  // logical px inside the 2x window (.vsc-z): 1.5px of air each side = 3 output px
  return `<span class="mk-box" id="${m.markId}" style="left:calc(${x0} + ${col}ch - 1.5px);width:calc(${len}ch + 3px);top:calc(${row}lh + 0.5px);height:calc(${lines}lh - 1px)"></span>`;
}
function emitMarkBox(m) {
  emit(`tl.fromTo("#${m.markId}", { visibility: "visible", opacity: 0, scale: 1.12 }, { visibility: "visible", opacity: 1, scale: 1, duration: 0.25, ease: "back.out(2)", immediateRender: false }, ${n2(m.absStart)});`);
  emit(`tl.to("#${m.markId}", { opacity: 0, duration: 0.2, ease: "power1.in" }, ${n2(m.markEnd - 0.2)});`);
  emit(`tl.set("#${m.markId}", { visibility: "hidden" }, ${n2(m.markEnd)});`);
}
const MK_OFF = "0 0 0 0px rgba(255,59,59,0), 0 0 0px 0px rgba(255,59,59,0)";
const MK_ON = "0 0 0 3px rgba(255,59,59,1), 0 0 16px 3px rgba(255,59,59,0.45)";
function emitMarkInline(m) {
  emit(`tl.fromTo("#${m.markId}", { boxShadow: "${MK_OFF}", backgroundColor: "rgba(255,59,59,0)" }, { boxShadow: "${MK_ON}", backgroundColor: "rgba(255,59,59,0.10)", duration: 0.25, ease: "power2.out", immediateRender: false }, ${n2(m.absStart)});`);
  emit(`tl.to("#${m.markId}", { boxShadow: "${MK_OFF}", backgroundColor: "rgba(255,59,59,0)", duration: 0.2, ease: "power1.in" }, ${n2(m.markEnd - 0.2)});`);
}
// wrap the n-th occurrence of `find` (text, not markup) in a doc body with <span class="mk">
function wrapDocMark(html, m) {
  m.find = m.find.trim();
  const variants = [m.find, m.find.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")];
  const toks = html.split(/(<[^>]+>)/);
  for (const f of variants) {
    let seen = 0;
    for (let i = 0; i < toks.length; i++) {
      if (toks[i].startsWith("<")) continue;
      let from = 0;
      for (;;) {
        // whole: only a text node that is exactly `find` (a table cell like <td>0</td>)
        const j = m.whole ? (from === 0 && toks[i].trim() === f ? toks[i].indexOf(f) : -1) : toks[i].indexOf(f, from);
        if (j < 0) break;
        if (++seen === (m.n || 1)) {
          const whole = j === 0 && f.length === toks[i].length;
          if (whole && /^<span class="codename"/.test(toks[i - 1] || "") && toks[i + 1] === "</span>") {
            toks[i - 1] = `<span class="mk mk-chip" id="${m.markId}">` + toks[i - 1];
            toks[i + 1] = "</span></span>";
          } else toks[i] = toks[i].slice(0, j) + `<span class="mk" id="${m.markId}">${f}</span>` + toks[i].slice(j + f.length);
          return toks.join("");
        }
        from = j + 1;
      }
    }
  }
  // fallback: an exact raw-HTML fragment (e.g. text that spans a <b>)
  const k = nthIndex(html, m.find, m.n || 1);
  if (k >= 0) return html.slice(0, k) + `<span class="mk" id="${m.markId}">${m.find}</span>` + html.slice(k + m.find.length);
  fail(`doc mark: "${m.find}" not found on the slide`);
}

// multi-file labs (7.6): spec.files = [{ name, base, from }]. A beat's `file` picks the scene's file; its lines
// live at CODE[base + n] and the gutter shows n. A file with `from: "<beat id>"` exists from that beat on
// (Explorer row + tab); before that only earlier files are listed.
const beatIndex = (id) => spec.beats.findIndex((b) => b.id === id);
function sceneFile(sc) {
  const name = sc.beats[0].file || spec.file.name;
  const files = spec.files || [{ name: spec.file.name, base: 0 }];
  const me = files.find((x) => x.name === name) || { name, base: 0 };
  const i0 = beatIndex(sc.beats[0].id);
  const listed = files.filter((x) => x.name === name || !x.from || beatIndex(x.from) <= i0);
  return { f: { ...spec.file, name }, base: me.base || 0, listed };
}
/* human typing rhythm: per-keystroke times instead of a metronome. Deterministic (seeded by the text), random
   +-35% swings paired so they cancel, and a short pause after a space or , ( : = taken back from the next two
   keys - so a line still starts and ends exactly where the timing model says, and no key drifts more than about
   one keystroke from the even schedule (mark boxes keep their 0.1 s margin). times[i] = char lead+i. */
function keyTimes(text, start, cps, lead = 0) {
  let r = 2166136261;
  for (const ch of text) r = Math.imul(r ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => { r ^= r << 13; r >>>= 0; r ^= r >>> 17; r ^= r << 5; r >>>= 0; return (r % 10000) / 10000; };
  const n = text.length, base = 1 / cps, d = new Array(n).fill(0);
  for (let k = lead + 1; k + 1 < n; k += 2) { const j = (rnd() - 0.5) * 0.7; d[k] += j; d[k + 1] -= j; }
  for (let k = lead + 1; k + 2 < n; k++) if (" ,(:=".includes(text[k - 1]) && text[k] !== " ") { d[k] += 0.5; d[k + 1] -= 0.25; d[k + 2] -= 0.25; }
  // a typist hesitates before reaching for a bracket or a quote (Shift + an awkward key: 0.15-0.3 s), and a little
  // before a closer, "_" or "." (0.08-0.15 s). The time is won back by typing the plain keys a little faster, never
  // closer than 50 ms apart, so the line still ends on schedule (EDITOR rounds 5-6)
  const hes = new Array(n).fill(0);
  for (let k = lead + 1; k < n; k++) {
    if ("(\"'{[".includes(text[k])) hes[k] = 0.15 + rnd() * 0.15;
    else if (")]}_.".includes(text[k])) hes[k] = 0.08 + rnd() * 0.07;
  }
  const w = new Array(n).fill(0);
  for (let k = lead + 1; k < n; k++) w[k] = Math.max(0.15, 1 + d[k]) * base; // the plain rhythm, seconds
  const total = w.reduce((a, v) => a + v, 0);
  // the floor scales with speed (fast lines can't all be 50 ms apart), and the hesitations get only the time the
  // plain keys can spare, so a line ALWAYS ends on schedule (at 18-22 cps it used to run long)
  const MIN = Math.min(0.05, base * 0.6), m0 = Math.max(0, n - 1 - lead);
  let H = hes.reduce((a, v) => a + v, 0);
  const room = Math.max(0, Math.min(0.4 * total, total - MIN * m0 * 1.15));
  if (H > room) { for (let k = 0; k < n; k++) hes[k] *= H > 0 ? room / H : 0; H = room; }
  let floored = new Set(), f = 1;
  for (let it = 0; it < 8; it++) {
    const free = w.reduce((a, v, k) => a + (k > lead && !floored.has(k) ? v : 0), 0);
    f = free > 0 ? (total - H - MIN * floored.size) / free : 1;
    const next = new Set([...floored, ...w.map((v, k) => (k > lead && v * f < MIN ? k : -1)).filter((k) => k >= 0)]);
    if (next.size === floored.size) break;
    floored = next;
  }
  const out = [];
  let t = start + lead / cps;
  for (let k = lead; k < n; k++) { if (k > lead) t += (floored.has(k) ? MIN : w[k] * f) + hes[k]; out.push(+t.toFixed(3)); }
  return out;
}
/* VS Code's auto-closing (editor.autoClosingBrackets/Quotes: languageDefined, Python pairs () [] {} "" '' and
   prefixed strings like f"): typing an opener inserts its closer after the cursor when the character after the
   cursor is whitespace/end or one of autoCloseBefore ;:.,=}])>; typing that closer later types over it. Brackets
   inside a string are not closed. Returns [{id, t, html}] states for the "tail" span after the cursor, timed to
   the keystrokes (char k lands at start + k/cps). Openers whose closer is on another line are not simulated. */
function autoCloseTails(text, segs, start, cps, lead, id, times) {
  const cls = [];
  for (const [c, t] of segs) for (const ch of t) cls.push(c);
  const match = {};
  const st = [];
  let q = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === q.ch) { match[q.i] = i; q = null; } continue; }
    if (ch === "#") break;
    if (ch === '"' || ch === "'") { q = { ch, i }; continue; }
    if ("([{".includes(ch)) st.push(i);
    else if (")]}".includes(ch) && st.length) match[st.pop()] = i;
  }
  const ACB = new Set([";", ":", ".", ",", "=", "}", "]", ")", ">", " ", "\t"]);
  const out = [];
  let tail = [];
  let last = "";
  for (let k = lead; k < text.length; k++) {
    if (tail.length && tail[0] === k) tail.shift(); // overtype the auto-inserted closer
    else if (match[k] !== undefined) {
      const next = tail.length ? text[tail[0]] : undefined;
      if (next === undefined || ACB.has(next)) tail.unshift(match[k]);
    }
    const html = tail.map((i) => `<span${cls[i] ? ` class="${cls[i]}"` : ""}>${esc(text[i])}</span>`).join("");
    if (html !== last) { out.push({ id, t: times ? times[k - lead] : +(start + k / cps).toFixed(3), html, mt: tail.map((i) => text[i]).join(""), mc: tail.map((i) => mmHex(cls[i], text[i])) }); last = html; }
  }
  return out;
}
function editorSceneHTML(sc) {
  const { f, base: lineBase, listed } = sceneFile(sc);
  const others = listed.filter((x) => x.name !== f.name);
  // beat.before = { file, lines: pre(a, b) }: what the editor shows before a second file is created
  const bf = sc.beats.find((b) => b.fileCreate)?.before;
  const prevView = bf && others.length ? (() => {
    // the earlier file stays on screen as the real editor would show it: indent guides, its minimap, and the
    // current-line highlight on the line its cursor was left on (the Explorer has focus, so no cursor)
    const pf = (spec.files || []).find((x) => x.name === bf.file) || { base: 0 };
    const txt = (p) => p.segs.map(([, t]) => t).join("");
    const ind = (t) => t.match(/^ */)[0].length;
    const L2 = bf.lines;
    const curLn = bf.cursorLine ?? L2[0]?.line;
    const html = L2.map((p, i) => {
      let gi = ind(txt(p));
      if (!txt(p).trim()) {
        let u = i - 1, d = i + 1;
        while (u >= 0 && !txt(L2[u]).trim()) u--;
        while (d < L2.length && !txt(L2[d]).trim()) d++;
        gi = u < 0 || d >= L2.length ? 0 : Math.min(ind(txt(L2[u])), ind(txt(L2[d])));
      }
      let g = "";
      for (let c = 0; c < gi; c += 4) g += `<span class="ig" style="left:${(GEOM.gutter + c * GEOM.charWidth).toFixed(3)}px"></span>`;
      const cur = p.line === curLn;
      return `<div class="code-line"><span class="lh lh-cur"${cur ? ' style="visibility:visible"' : ""}></span><div class="gutter"${cur ? ` style="color:${THEME("editorLineNumber-activeForeground")}"` : ""}>${p.line - (pf.base || 0)}</div><div class="code-text">${cur ? `<span id="${sc.id}-prevcur" class="cursor"></span>` : ""}${p.segs.map(([cls, t]) => `<span${cls ? ` class="${cls}"` : ""}>${esc(t)}</span>`).join("")}</div>${g}</div>`;
    }).join("\n");
    minimapData.push({ id: `${sc.id}-mmc-prev`, rows: L2.map((p) => ({ row: p.line - (pf.base || 0) - 1, ...mmRow(p.segs) })) });
    return { name: bf.file, html };
  })() : null;
  const marks = sceneMarks(sc);
  const CODE_OF = (n, e) => (e?.prefill || e?.typeAction?.segs || []).map((x) => x[1]).join("");
  // terminal marks attach to the latest typed line / output block (by time) that contains them
  const allActs = sc.beats.flatMap((bb) => bb.absActions);
  for (const m of marks) {
    if (m.cmd !== undefined) {
      m.host = allActs.filter((a) => a.do === "term-type" && a.absStart <= m.absStart && nthIndex(a.text, m.cmd, m.n || 1) >= 0).pop();
      if (!m.host) fail(`scene ${sc.id}: mark cmd "${m.cmd}" — no typed terminal line contains it by ${n2(m.absStart)}`);
    } else if (m.out !== undefined) {
      m.host = allActs.filter((a) => a.do === "term-out" && a.absStart <= m.absStart + 0.05 && nthIndex(a.lines.join("\n"), m.out, m.n || 1) >= 0).pop();
      if (!m.host) fail(`scene ${sc.id}: mark out "${m.out}" — no terminal output contains it by ${n2(m.absStart)}`);
    } else if (!(m.line >= 1)) fail(`scene ${sc.id}: editor marks need line+text, cmd, or out`);
  }
  // collect lines: prefill + typed (+ callouts)
  const lines = new Map(); // line# -> {prefill?:segs, typeAction?, callouts:[]}
  let hasTerm = false;
  let lastTyped = null;
  for (const b of sc.beats) {
    for (const p of b.prefill || []) {
      lines.set(p.line, { ...(lines.get(p.line) || {}), prefill: p.segs, callouts: lines.get(p.line)?.callouts || [] });
    }
    for (const a of b.absActions) {
      if (a.do === "type") {
        lines.set(a.line, { ...(lines.get(a.line) || {}), typeAction: a, callouts: lines.get(a.line)?.callouts || [] });
        lastTyped = a;
      } else if (a.do === "paste") {
        // pasted block (e.g. copied from the assignment): lines render hidden, appear together at `at`
        for (const p of a.lines)
          lines.set(p.line, { ...(lines.get(p.line) || {}), prefill: p.segs, revealAt: a.absStart, callouts: lines.get(p.line)?.callouts || [] });
      } else if (a.do === "callout") {
        const e = lines.get(a.line) || { callouts: [] };
        e.callouts = e.callouts || [];
        e.callouts.push(a);
        lines.set(a.line, e);
      } else if (["term-type", "term-out", "terminal-open"].includes(a.do)) hasTerm = true;
    }
  }
  // viewTop = "scrolled" editor: render lines viewTop..end with true line numbers.
  // 15 lines fit (17 at editorFontSize 12); 5 above the default 200 terminal panel (6 at 12).
  const viewTop = sc.beats[0].viewTop || 1;
  const maxLine = Math.max(viewTop + 2, ...lines.keys());
  for (const n of lines.keys())
    if (n < viewTop) fail(`scene ${sc.id}: line ${n} is above viewTop ${viewTop} — it would not be rendered`);
  for (const b of sc.beats)
    for (const a of b.absActions)
      if (a.do === "highlight-line" && a.line < viewTop)
        fail(`scene ${sc.id}: highlight-line ${a.line} is above viewTop ${viewTop}`);
  // real geometry: the editor area is 322 logical px (15 lines of 21px at 14, 16 of 20 at 13, 17 of 18 at 12); an
  // open terminal panel takes its height
  const fitAll = codeRows(GEOM);
  const fitTerm = codeRows(GEOM, sc.beats[0].terminalHeight || spec.panelHeight || 200);
  if (maxLine - viewTop + 1 > fitAll)
    warn(`scene ${sc.id}: ${maxLine - viewTop + 1} code lines visible — only ${fitAll} fit; raise viewTop on its beat`);
  if (hasTerm && !sc.beats[0].terminalMax && maxLine - viewTop + 1 > fitTerm)
    warn(`scene ${sc.id}: terminal opens but ${maxLine - viewTop + 1} lines are shown — only ${fitTerm} fit above the panel (lines below ${viewTop + fitTerm - 1} go under it); raise viewTop, lower terminalHeight, or use terminalMax`);
  let codeHTML = "";
  const mmId = `${sc.id}-mmc`;
  const mmRows = []; // canvas rows drawn at load (or at `at`)
  let segCounter = 0;
  const textOf = (n) => { const e = lines.get(n); return (e?.prefill || e?.typeAction?.segs || []).map((x) => x[1]).join(""); };
  // when each line's text exists on screen (prefill: always; typed: its start; pasted: its reveal)
  const appearAt = (n) => { const e = lines.get(n); return !e ? null : e.typeAction ? e.typeAction.absStart : e.revealAt ?? sc.start; };
  // indent guides (editor.guides.indentation): one 1px guide per 4-space level; a blank line takes the
  // smaller indent of its neighbours, like Monaco does
  const indentOf = (n) => textOf(n).match(/^ */)[0].length;
  const isText = (n) => textOf(n).trim() !== "";
  const guideIndent = (n) => {
    if (isText(n)) return indentOf(n);
    let up = n - 1, dn = n + 1;
    while (up >= viewTop && !isText(up)) up--;
    while (dn <= maxLine && !isText(dn)) dn++;
    if (up < viewTop || dn > maxLine) return 0;
    return Math.min(indentOf(up), indentOf(dn));
  };
  const stepLines = new Set(sc.beats.flatMap((bb) => bb.absActions.filter((a) => a.do === "step").map((a) => a.line)));
  const typedOrder = [];
  for (let n = viewTop; n <= maxLine; n++) {
    const entry = lines.get(n);
    let inner = "";
    if (entry?.prefill) {
      inner = entry.prefill.map(([cls, txt]) => `<span${cls ? ` class="${cls}"` : ""}>${esc(txt)}</span>`).join("");
      mmRows.push({ row: n - lineBase - 1, ...mmRow(entry.prefill), ...(entry.revealAt !== undefined ? { at: +entry.revealAt.toFixed(3) } : {}) });
    } else if (entry?.typeAction) {
      const a = entry.typeAction;
      const full = a.segs.map((x) => x[1]).join("");
      const lead = full.match(/^ */)[0].length;
      // auto-indent: the leading spaces arrive with Enter (VS Code indents), the typist starts after them
      const segs2 = [];
      a.segs.forEach(([cls, txt], k) => {
        if (k === 0 && lead > 0 && txt.length > lead && /^ +$/.test(txt.slice(0, lead))) segs2.push([cls, txt.slice(0, lead), true], [cls, txt.slice(lead)]);
        else segs2.push([cls, txt, k === 0 && lead > 0 && /^ +$/.test(txt)]);
      });
      a.targets = segs2.map(([cls, txt, instant]) => {
        const id = `${sc.id}-s${segCounter++}`;
        inner += `<span id="${id}"${cls ? ` class="${cls}"` : ""}></span>`;
        return { id, text: txt, instant };
      });
      const curId = `${sc.id}-cur-l${n}`;
      inner += `<span id="${curId}" class="cursor"></span><span id="${curId}-tail"></span>`;
      const cps = a.cps || DEF.cpsCode;
      const kt = keyTimes(full, +a.absStart.toFixed(2), cps, lead);
      // one typist: this line's keys end before the next typed line starts (else the status bar's Ln/Col flips back
      // to this line mid-way through the next one; EDITOR m07 redo n-E). Squeeze the rhythm to fit if needed.
      {
        const nextStart = Math.min(Infinity, ...sc.beats.flatMap((bb) => bb.absActions).filter((x) => x.do === "type" && x !== a && x.absStart > a.absStart + 0.001).map((x) => x.absStart));
        const endBy = nextStart - 0.12, t0 = kt[0], tn = kt[kt.length - 1];
        if (kt.length > 1 && tn > endBy && endBy > t0) for (let k = 0; k < kt.length; k++) kt[k] = +(t0 + ((kt[k] - t0) * (endBy - t0)) / (tn - t0)).toFixed(3);
      }
      const tEntry = {
        targets: a.targets.map((t) => (t.instant ? { id: t.id, text: t.text, instant: true } : { id: t.id, text: t.text })),
        start: +a.absStart.toFixed(2),
        cps,
        times: kt,
        tails: autoCloseTails(full, a.segs, +a.absStart.toFixed(2), cps, lead, `${curId}-tail`, kt),
        mm: { id: mmId, row: n - lineBase - 1, ...mmRow(a.segs) }, // the minimap row redraws on every keystroke
      };
      typingData.push(tEntry);
      typedOrder.push({ line: n, a, curId, entry: tEntry });
    }
    for (const c of entry?.callouts || []) {
      // a callout is right-anchored at the minimap edge (CSS: right = minimap + 20 = 82px at the default, JetBrains Mono
      // 9.5px ≈ 6.175px/char + 16px padding/border). It must not cover the code on its row (EDITOR m07 redo: it hid "= 1023:")
      {
        const rowText = SPEC_CODE?.[n] ?? (entry.typeAction?.segs || entry.prefill || []).map((x) => x[1]).join("");
        const right = GEOM.editor - GEOM.gutter - (GEOM.minimap + 20), w = c.text.length * 6.175 + 16;
        const codeEnd = rowText.replace(/\s+$/, "").length * GEOM.charWidth;
        if (codeEnd + 6 > right - w) {
          const fit = Math.max(0, Math.floor((right - codeEnd - 6 - 16) / 6.175));
          pauseErrors.push(`scene ${sc.id}: callout "${c.text}" covers the code on line ${n - lineBase} (${rowText.trim().length} chars) — at most ${fit} callout characters fit there; shorten it or anchor it on a shorter or blank line`);
        }
      }
      const id = `${sc.id}-co-l${n}-${Math.round(c.absStart * 10)}`;
      inner += `<span class="line-callout mono" id="${id}" data-layout-allow-overflow>${esc(c.text)}</span>`;
      emit(`tl.fromTo("#${id}", { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.45, ease: "back.out(1.6)" }, ${n2(c.absStart)});`);
    }
    if (entry?.revealAt !== undefined) {
      const rid = `${sc.id}-paste-l${n}`;
      inner = `<span id="${rid}" style="visibility:hidden">${inner}</span>`;
      emit(`tl.set("#${rid}", { visibility: "visible" }, ${n2(entry.revealAt)});`);
    }
    let lineBoxes = "";
    for (const m of marks.filter((m) => m.line === n)) {
      const src = CODE_OF(n, entry);
      const col = nthIndex(src, m.text, m.n || 1);
      if (col < 0) fail(`scene ${sc.id}: mark "${m.text}" not found in line ${n}: ${src}`);
      let len = m.text.length;
      let rows = 1;
      if (m.to) {
        rows = m.to - n + 1;
        for (let k = n; k <= m.to; k++) len = Math.max(len, CODE_OF(k, lines.get(k)).length - col);
      }
      lineBoxes += markBoxHTML(m, col, len, rows, 0, `${GEOM.gutter}px`); // = .gutter width (border-box)
      emitMarkBox(m);
    }
    // indent guides, shown once the line (or, for a blank line, its later neighbour) is on screen
    let guides = "";
    const gi = guideIndent(n);
    if (gi > 0) {
      let dn = n;
      while (!isText(dn)) dn++;
      const show = appearAt(dn);
      const gid = `${sc.id}-ig-l${n}`;
      const hidden = show != null && show > sc.start + 0.01;
      for (let c = 0; c < gi; c += 4)
        guides += `<span class="ig"${hidden ? ` id="${gid}-${c}"` : ""} style="${hidden ? "visibility:hidden;" : ""}left:${(GEOM.gutter + c * GEOM.charWidth).toFixed(3)}px"></span>`;
      if (hidden) for (let c = 0; c < gi; c += 4) emit(`tl.set("#${gid}-${c}", { visibility: "visible" }, ${n2(show)});`);
    }
    // current-line highlight and the debugger's paused-line highlight are overlays behind the text
    const over = `<span class="lh lh-cur"></span>${stepLines.has(n) ? `<span class="lh lh-dbg"><span class="dbg-arrow">&#x${ICON.debugStackframe};</span></span>` : ""}`;
    codeHTML += `<div class="code-line cl-${n}">${over}<div class="gutter">${n - lineBase}</div><div class="code-text">${inner}</div>${guides}${lineBoxes}</div>\n                `;
  }
  // the real minimap shows the whole file: lines above the view come from the program (CODE)
  if (SPEC_CODE && !sc.beats.some((bb) => bb.fileCreate))
    for (let k = lineBase + 1; k < viewTop; k++)
      if (SPEC_CODE[k] !== undefined) mmRows.push({ row: k - lineBase - 1, ...mmRow(REAL_TOK.get(SPEC_CODE[k]) || [["", SPEC_CODE[k]]]) });
  minimapData.push({ id: mmId, rows: mmRows });

  /* sticky scroll (editor.stickyScroll.enabled, on by default): when the view starts inside a block, the
     real editor pins the enclosing block headers (indentation folding: the nearest less-indented line above,
     then its parent...) at the top with a border + shadow. We show them above viewTop, so the spec's first
     line stays visible. A scrolled editor without sticky lines shows the 6px scroll shadow instead. */
  let stickyHTML = "";
  const scrolled = viewTop - lineBase > 1; // file line, not the CODE offset (multi-file labs)
  if (scrolled && SPEC_CODE) {
    const codeAt = (k) => (SPEC_CODE[k] ?? "");
    const ind = (t) => t.match(/^ */)[0].length;
    let k0 = viewTop;
    while (k0 <= maxLine && !codeAt(k0).trim()) k0++;
    const heads = [];
    let need = ind(codeAt(k0));
    for (let k = viewTop - 1; k >= lineBase + 1 && need > 0; k--) {
      const t = codeAt(k);
      if (!t.trim()) continue;
      if (ind(t) < need) { heads.unshift(k); need = ind(t); }
    }
    // Monaco pins a header only once it has scrolled off: a header sitting right above the first row is just
    // a normal row (e.g. view at 21 inside `if` (20) inside `def` (18): pinned 18, then rows 20, 21, ...)
    const extra = [];
    let first = viewTop;
    while (heads.length && heads[heads.length - 1] === first - 1) { extra.unshift(heads.pop()); first--; }
    const segsOf = (t) => REAL_TOK.get(t) || [["", t]];
    const rowHTML = (k, cls) => {
      const t = codeAt(k);
      let g = "";
      for (let c = 0; c < ind(t); c += 4) g += `<span class="ig" style="left:${(GEOM.gutter + c * GEOM.charWidth).toFixed(3)}px"></span>`;
      return `<div class="code-line ${cls}"><div class="gutter">${k - lineBase}</div><div class="code-text">${segsOf(t).map(([c2, txt]) => `<span${c2 ? ` class="${c2}"` : ""}>${esc(txt)}</span>`).join("")}</div>${cls === "sticky-line" ? "" : g}</div>`;
    };
    if (heads.length) stickyHTML = `<div class="vsc-sticky">${heads.map((k) => rowHTML(k, "sticky-line")).join("")}</div>`;
    stickyHTML += extra.map((k) => rowHTML(k, "above-line")).join("");
  }
  const scrollDeco = scrolled && !stickyHTML.includes("vsc-sticky") ? `<div class="vsc-scrolldeco"></div>` : "";
  const extraRows = (stickyHTML.match(/class="code-line /g) || []).length;
  if (extraRows && maxLine - viewTop + 1 + extraRows > fitAll)
    warn(`scene ${sc.id}: sticky-scroll rows (${extraRows}) + ${maxLine - viewTop + 1} lines > ${fitAll} — the last line(s) go off the bottom; raise viewTop`);

  /* the cursor and the current line, as in the real editor: the cursor lands on a line when typing starts
     there (a moment before, as if Enter/arrow keys moved it), stays solid while keys go in, blinks while
     idle, and leaves the editor when the terminal takes focus. The current-line highlight and the active
     line number follow it (they stay put while the terminal has focus). */
  const termFocus = sc.beats.flatMap((bb) => bb.absActions).filter((a) => a.do === "terminal-open" || a.do === "term-type").map((a) => a.absStart).sort((x, y) => x - y);
  typedOrder.sort((x, y) => x.a.absStart - y.a.absStart);
  const pfAll = sc.beats[0].prefill || [];
  const lastPfLine = pfAll.length ? pfAll[pfAll.length - 1].line : null;
  const fcB = sc.beats.find((bb) => bb.fileCreate);
  const fcOpenAt = fcB ? fcB.start + (fcB.fileOpenAt ?? (fcB.fileCreateAt ?? 1.8) + spec.file.name.length / 13 + 0.45) : null;
  const curEvents = []; // { t, line }: the current line changes
  const pastes = sc.beats.flatMap((bb) => bb.absActions).filter((a) => a.do === "paste" && a.lines?.length).sort((x, y) => x.absStart - y.absStart);
  const pasteBefore = (t) => pastes.filter((p) => p.absStart < t).pop();
  // a new file whose first typed line isn't line 1 (a pasted header first): the caret sits at 1:1 until then
  const l1Wait = fcB && typedOrder.length && (typedOrder[0].line !== lineBase + 1 || pasteBefore(typedOrder[0].a.absStart));
  typedOrder.forEach((o, i) => {
    const prev = typedOrder[i - 1];
    if (i === 0 && fcB && !l1Wait) o.showAt = Math.min(fcOpenAt, o.a.absStart - 0.05); // a new file opens with the cursor at 1:1
    else if (i === 0 && !lastPfLine && !fcB) o.showAt = sc.start;
    else o.showAt = Math.max(o.a.absStart - 0.35, prev ? prev.a.absEnd + 0.05 : fcB ? fcOpenAt : sc.start);
    const pb = pasteBefore(o.a.absStart);
    if (pb && pb.absStart + 0.05 > o.showAt && (!prev || pb.absStart > prev.a.absEnd)) o.showAt = Math.min(o.a.absStart - 0.02, pb.absStart + 0.3);
  });
  typedOrder.forEach((o, i) => {
    const showAt = o.showAt;
    const next = typedOrder[i + 1];
    // the cursor leaves the editor when the terminal takes focus (the panel appears 0.05 s before its action)
    const leave = termFocus.find((t) => t > o.a.absEnd);
    const pasteAfter = pastes.find((p) => p.absStart > o.a.absEnd);
    const hideAt = Math.min(next ? next.showAt : sc.end - 0.05, leave != null ? leave - 0.05 : Infinity, pasteAfter ? pasteAfter.absStart : Infinity);
    const keys = o.entry.times?.length ? o.entry.times : [o.a.absStart, o.a.absEnd];
    genCursor(o.curId, showAt, keys[0], keys[keys.length - 1], Math.max(hideAt, o.a.absEnd + 0.05));
    curEvents.push({ t: showAt, line: o.line });
    const t0 = o.entry.targets[0];
    if (t0?.instant) t0.at = +Math.min(showAt, o.a.absStart).toFixed(3); // Enter puts the indentation in
  });
  // an editor that opens on an existing file: the cursor sits at the end of the last prefilled line
  if (!fcB && lastPfLine && (!typedOrder.length || typedOrder[0].a.absStart - 0.35 > sc.start + 0.3)) {
    const firstStep = sc.beats.flatMap((bb) => bb.absActions).filter((a) => a.do === "step").map((a) => a.absStart).sort((x, y) => x - y)[0];
    const until = Math.min(typedOrder.length ? typedOrder[0].a.absStart - 0.35 : sc.end - 0.05, termFocus[0] ?? Infinity, pastes[0]?.absStart ?? Infinity, firstStep ?? Infinity);
    curEvents.unshift({ t: sc.start, line: lastPfLine });
    if (until - sc.start > 0.3) {
      const pid = `${sc.id}-cur-pf`;
      codeHTML = codeHTML.replace(new RegExp(`(<div class="code-line cl-${lastPfLine}">[\\s\\S]*?<div class="code-text">[\\s\\S]*?)(</div>)`), `$1<span id="${pid}" class="cursor"></span>$2`);
      genCursor(pid, sc.start, sc.start, sc.start, until);
    }
  }
  // the caret at 1:1 of a new file, and at the end of each paste (VS Code leaves it after the pasted text)
  const addCaret = (line, id, atStart) => {
    const re = new RegExp(`(<div class="code-line cl-${line}"[^>]*>[\\s\\S]*?<div class="code-text">)([\\s\\S]*?)(</div>)`);
    codeHTML = codeHTML.replace(re, (m0, a1, a2, a3) => (atStart ? `${a1}<span id="${id}" class="cursor"></span>${a2}${a3}` : `${a1}${a2}<span id="${id}" class="cursor"></span>${a3}`));
  };
  const caretUntil = (t) => {
    const nt = typedOrder.find((o) => o.showAt > t + 0.01), np = pastes.find((p) => p.absStart > t + 0.01), nf = termFocus.find((x) => x > t);
    return Math.min(nt ? nt.showAt : Infinity, np ? np.absStart : Infinity, nf != null ? nf - 0.05 : Infinity, sc.end - 0.05);
  };
  if (l1Wait) {
    const id = `${sc.id}-cur-l1`;
    addCaret(lineBase + 1, id, true);
    curEvents.push({ t: fcOpenAt, line: lineBase + 1 });
    const until = caretUntil(fcOpenAt);
    if (until - fcOpenAt > 0.1) genCursor(id, fcOpenAt, fcOpenAt, fcOpenAt, until);
  }
  pastes.forEach((p, i) => {
    const last = p.lines[p.lines.length - 1].line, id = `${sc.id}-cur-p${i}`;
    addCaret(last, id, false);
    curEvents.push({ t: p.absStart, line: last });
    const until = caretUntil(p.absStart);
    if (until - p.absStart > 0.1) genCursor(id, p.absStart, p.absStart, p.absStart, until);
  });
  // debugger steps: VS Code reveals the paused line WITH the caret on it (the status bar Ln follows), so the caret
  // moves to the start of each step's line (EDITOR m07 round 5 n4: status said Ln 9 while the caret sat on 15)
  {
    const steps = sc.beats.flatMap((bb) => bb.absActions).filter((a) => a.do === "step").sort((x, y) => x.absStart - y.absStart);
    steps.forEach((st, i) => {
      const id = `${sc.id}-cur-s${i}`, until = Math.min(steps[i + 1] ? steps[i + 1].absStart : Infinity, caretUntil(st.absStart));
      addCaret(st.line, id, true);
      curEvents.push({ t: st.absStart, line: st.line }); // the active line number follows the caret
      if (until - st.absStart > 0.1) genCursor(id, st.absStart, st.absStart, st.absStart, until);
    });
  }
  // Cmd+J closes the panel: focus returns to the editor, and its cursor shows (and blinks) where it was
  for (const tc of sc.beats.flatMap((bb) => bb.absActions).filter((a) => a.do === "terminal-close").map((a) => a.absStart)) {
    const before = typedOrder.filter((o) => o.a.absEnd < tc).pop();
    const cid = before ? before.curId : codeHTML.includes(`id="${sc.id}-cur-pf"`) ? `${sc.id}-cur-pf` : null;
    if (!cid) continue;
    const nextTyped = typedOrder.find((o) => o.showAt > tc), nextFocus = termFocus.find((t) => t > tc);
    const until = Math.min(nextTyped ? nextTyped.showAt : sc.end - 0.05, nextFocus != null ? nextFocus - 0.05 : Infinity);
    if (until - tc > 0.1) genCursor(cid, tc, tc, tc, until);
  }
  curEvents.sort((x, y) => x.t - y.t);
  // a line exists once the cursor first reaches it or a later line (Enter makes it), like a real file being
  // written; prefilled / pasted lines exist from the start / their reveal. Lines past the end never show.
  const existAt = new Map(); // line -> when its row appears (absent = there from the start)
  {
    const reach = curEvents.map((e) => e.t);
    const maxPf = Math.max(0, ...[...lines.entries()].filter(([, e]) => e.prefill && e.revealAt === undefined).map(([k]) => k));
    for (let n = viewTop; n <= maxLine; n++) {
      const e = lines.get(n);
      let t = null;
      if (fcB && n === lineBase + 1) t = fcOpenAt;
      else if (n <= maxPf && !fcB) t = sc.start;
      else if (e?.revealAt !== undefined) t = e.revealAt;
      const later = curEvents.filter((ev) => ev.line >= n).map((ev) => ev.t);
      if (later.length) t = t == null ? Math.min(...later) : Math.min(t, ...later);
      if (t == null) t = Infinity;
      existAt.set(n, t);
      if (t <= sc.start + 0.01) continue;
      codeHTML = codeHTML.replace(`<div class="code-line cl-${n}">`, `<div class="code-line cl-${n}" style="visibility:hidden">`);
      if (t !== Infinity) emit(`tl.set("#${sc.id} .cl-${n}", { visibility: "visible" }, ${n2(t)});`);
    }
    void reach;
    // a gold callout lives on its row: a row that isn't written yet (or is below the view / under the panel)
    // hides it for good (EDITOR m07 round 5 m1: three callouts never appeared)
    const acts = sc.beats.flatMap((bb) => bb.absActions);
    for (const c of acts.filter((a) => a.do === "callout")) {
      const open = acts.filter((a) => a.do === "terminal-open" && a.absStart <= c.absStart).map((a) => a.absStart).pop();
      const closed = acts.filter((a) => a.do === "terminal-close" && a.absStart <= c.absStart).map((a) => a.absStart).pop();
      const rows = (open != null && (closed == null || closed < open) ? (sc.beats[0].terminalMax ? 0 : fitTerm) : fitAll) - extraRows;
      const te = existAt.has(c.line) ? existAt.get(c.line) : sc.start;
      if (c.line < viewTop || c.line > viewTop + rows - 1 || te > c.absStart + 0.05)
        pauseErrors.push(`scene ${sc.id}: callout "${c.text}" on line ${c.line - lineBase} never shows — that row is ${te > c.absStart + 0.05 ? "not written yet" : "out of view"} when it fires; anchor it to a written line in view`);
    }
  }
  const AF = THEME("editorLineNumber-activeForeground"), LF = THEME("editorLineNumber-foreground");
  let curNow = null;
  for (const ev of curEvents) {
    if (ev.line === curNow) continue;
    if (curNow != null) {
      emit(`tl.set("#${sc.id} .cl-${curNow} .lh-cur", { visibility: "hidden" }, ${n2(ev.t)});`);
      emit(`tl.set("#${sc.id} .cl-${curNow} .gutter", { color: "${LF}" }, ${n2(ev.t)});`);
    }
    emit(`tl.set("#${sc.id} .cl-${ev.line} .lh-cur", { visibility: "visible" }, ${n2(ev.t)});`);
    emit(`tl.set("#${sc.id} .cl-${ev.line} .gutter", { color: "${AF}" }, ${n2(ev.t)});`);
    curNow = ev.line;
  }

  emitSteps(sc);
  // unsaved file (files.autoSave is off by default): the tab shows the dirty dot from the first edit (a keystroke or
  // a paste) and KEEPS it across cuts until a save (EDITOR m07 redo m-A: it reset at every cut, so runs looked saved)
  {
    const acts = sc.beats.flatMap((bb) => bb.absActions);
    const edits = acts.filter((x) => x.do === "type" || x.do === "paste").sort((x, y) => x.absStart - y.absStart);
    const carried = !fcB && DIRTY.get(f.name) === true;
    const from = carried ? sc.start : edits[0]?.absStart;
    const lastEdit = edits.length ? Math.max(...edits.map((x) => x.absEnd ?? x.absStart)) : sc.start;
    if (from != null) {
      emit(`tl.set("#${sc.id}-tabmain .tx-close", { display: "none" }, ${n2(from)});`);
      emit(`tl.set("#${sc.id}-tabmain .tx-dirty", { display: "inline-block" }, ${n2(from)});`);
      emit(`tl.set("#${sc.id}-badge", { display: "block" }, ${n2(from)});`); // "1 unsaved file" on the Explorer icon
      emit(`tl.set("#${sc.id}-tl", { display: "none" }, ${n2(from)});`); // macOS: dot in the close button
      emit(`tl.set("#${sc.id}-tl-ed", { display: "block" }, ${n2(from)});`);
      const saved = acts.find((x) => x.do === "save" && x.absStart >= lastEdit);
      const run = acts.find((x) => x.do === "term-type" && x.absStart > lastEdit && new RegExp(`python3?\\s+${f.name.replace(".", "\\.")}`).test(x.text));
      if (run && (!saved || saved.absStart > run.absStart))
        warn(`scene ${sc.id}: ${f.name} is run (${run.text}) while unsaved — add {do:"save", at} (Cmd+S) before it; VS Code does not auto-save by default`);
    }
    // what later scenes inherit: still unsaved unless a save came after the last edit. {do:"save", all:true} saves
    // every file (e.g. VS Code's debug.saveBeforeStart when a debug session starts)
    const lastSave = Math.max(-Infinity, ...acts.filter((x) => x.do === "save").map((x) => x.absStart));
    if (acts.some((x) => x.do === "save" && x.all)) for (const k of DIRTY.keys()) DIRTY.set(k, false);
    DIRTY.set(f.name, (carried || edits.length > 0) && !(lastSave >= lastEdit));
  }
  // other runtime actions for this scene
  let termIdx = 0;
  let lastTermEnd = -1;
  let prevTermType = false, prevLastKey = -1, prevPaste = false; // one typist at one terminal: the previous typed line
  let termHTML = "";
  let termRuler = "";
  let lastOutId = null;
  let termRow = 0; // terminal rows used so far (GEOM.termRow each, 16 at 14): drives the overview-ruler marks
  // shell command lines get VS Code's shell-integration decoration: hollow while the prompt waits /
  // the command runs, then a filled blue dot (red on a traceback) once the next prompt appears
  const cmdLines = []; // { id, row, start, end, err }
  const TERM_ROW = GEOM.termRow;
  const decoHTML = (id) => `<span class="t-dec run" id="${id}-dr">&#x${ICON.decoRun};</span><span class="t-dec ok" id="${id}-dk" style="visibility:hidden">&#x${ICON.decoOk};</span><span class="t-dec err" id="${id}-de" style="visibility:hidden">&#x${ICON.decoErr};</span>`;
  const rulerMark = (id, row, hidden) => {
    const top = row * TERM_ROW - 6;
    const pos = top < 0 ? `top:0;height:${12 + top}px` : `top:${top}px`;
    return `<span class="trm run" id="${id}-mr" style="${hidden ? "visibility:hidden;" : ""}${pos}"></span><span class="trm ok" id="${id}-mk" style="visibility:hidden;${pos}"></span><span class="trm err" id="${id}-me" style="visibility:hidden;${pos}"></span>`;
  };
  // ring sizes are logical px: the window is drawn at 2x
  const RB_ON = "0 0 0 2px #ff3b3b", RB_GLOW = "0 0 0 4.5px rgba(255,59,59,0.28)", RB_OFF = "0 0 0 0px rgba(255,59,59,0)";
  for (const b of sc.beats) {
    for (const a of b.absActions) {
      if (a.do === "terminal-open") {
        // Ctrl+` / Terminal > New Terminal: the panel opens instantly and the editor above it shrinks
        emit(`tl.set("#${sc.id} .vsc-terminal", { display: "flex" }, ${n2(a.absStart - 0.05)});`);
        emit(`tl.set("#${sc.id} .tbp-off", { display: "none" }, ${n2(a.absStart - 0.05)});`);
        emit(`tl.set("#${sc.id} .tbp-on", { display: "inline-block" }, ${n2(a.absStart - 0.05)});`);
      } else if (a.do === "terminal-close") {
        // Cmd+J (View: Toggle Panel): the panel hides at once and the editor takes its full height back
        emit(`tl.set("#${sc.id} .vsc-terminal", { display: "none" }, ${n2(a.absStart)});`);
        emit(`tl.set("#${sc.id} .tbp-off", { display: "inline-block" }, ${n2(a.absStart)});`);
        emit(`tl.set("#${sc.id} .tbp-on", { display: "none" }, ${n2(a.absStart)});`);
      } else if (a.do === "save") {
        // Cmd+S / Ctrl+S: the tab's unsaved dot turns back into the close button
        emit(`tl.set("#${sc.id}-tabmain .tx-dirty", { display: "none" }, ${n2(a.absStart)});`);
        emit(`tl.set("#${sc.id}-tabmain .tx-close", { display: "inline-block" }, ${n2(a.absStart)});`);
        emit(`tl.set("#${sc.id}-badge", { display: "none" }, ${n2(a.absStart)});`);
        emit(`tl.set("#${sc.id}-tl-ed", { display: "none" }, ${n2(a.absStart)});`);
        emit(`tl.set("#${sc.id}-tl", { display: "block" }, ${n2(a.absStart)});`);
      } else if (a.do === "highlight-line")
        emit(
          `tl.fromTo("#${sc.id} .cl-${a.line}", { backgroundColor: "rgba(255,200,61,0)" }, { backgroundColor: "rgba(255,200,61,0.16)", duration: 0.4, yoyo: true, repeat: 1, ease: "sine.inOut" }, ${n2(a.absStart)});`
        );
      else if (a.do === "file-activate") {
        // clicking the file in the Explorer selects it (focus moves on to the editor right after)
        emit(`tl.set("#${sc.id} .sb-row.main", { attr: { class: "sb-row main active" } }, ${n2(a.absStart)});`);
      } else if (a.do === "redbox") {
        // red highlight ring around a UI element to draw the student's eye.
        // target: newfile | runbtn | terminal | tab | tabs | explorer | sidebarfile | debug | badge, or line: N
        const map = {
          newfile: `#${sc.id}-newfile`,
          runbtn: `#${sc.id} .vsc-runbtn`,
          terminal: `#${sc.id} .vsc-terminal`,
          tab: `#${sc.id} .vsc-tab-on`,
          tabs: `#${sc.id} .vsc-tabgroup`,
          explorer: `#${sc.id} .sb-files`,
          sidebarfile: `#${sc.id} .sb-row.main`,
          debug: `#${sc.id} .dv-panel`,
          termdot: `#${sc.id}-tline-0-dk`,
          minimap: `#${sc.id}-mmmark`,
          badge: `#${sc.id}-badge`, // the "1" on the Explorer icon: one file with unsaved changes
        };
        const sel = a.line ? `#${sc.id} .cl-${a.line}` : map[a.target];
        if (sel) {
          const ins = ["terminal", "runbtn", "debug", "explorer", "termdot"].includes(a.target) ? "inset " : "";
          const hold = a.hold ?? 3;
          emit(`tl.fromTo("${sel}", { boxShadow: "${ins}${RB_OFF}" }, { boxShadow: "${ins}${RB_ON}", duration: 0.35, ease: "power2.out" }, ${n2(a.absStart)});`);
          // the pulse fits inside the hold (lint: tweens on one element must not overlap)
          const pulses = Math.min(4, Math.floor((hold - 0.35) / 0.7));
          if (pulses >= 1) emit(`tl.to("${sel}", { boxShadow: "${ins}${RB_GLOW}", duration: 0.7, yoyo: true, repeat: ${pulses - 1}, ease: "sine.inOut" }, ${n2(a.absStart + 0.35)});`);
          emit(`tl.to("${sel}", { boxShadow: "${ins}${RB_OFF}", duration: 0.3, ease: "power2.in" }, ${n2(a.absStart + hold)});`);
        }
      } else if (a.do === "term-type") {
        const cmdId = `${sc.id}-tcmd-${termIdx}`;
        const curId = `${sc.id}-tcur-${termIdx}`;
        // a.prompt overrides the shell prompt (e.g. the program's own input() prompt, or ">>> " in the
        // Python shell); every term-type line after the first stays hidden until it starts typing
        const lineId = `${sc.id}-tline-${termIdx}`;
        const pr = a.prompt !== undefined ? a.prompt : prompt;
        const isShell = a.prompt === undefined;
        const hideLine = termIdx > 0;
        let boxes = "";
        for (const m of marks.filter((m) => m.host === a)) {
          boxes += markBoxHTML(m, pr.length + nthIndex(a.text, m.cmd, m.n || 1), m.cmd.length);
          emitMarkBox(m);
        }
        termHTML += `<div class="term-line" id="${lineId}"${hideLine ? ' style="visibility:hidden"' : ""}>${isShell ? decoHTML(lineId) : ""}<span class="${isShell ? "t-prompt" : ""}">${isShell && pr ? `<span class="t-c0">${esc(pr[0])}</span>` : ""}<span id="${cmdId}">${esc(isShell ? pr.slice(1) : pr)}</span></span><span id="${curId}" class="cursor tcur"></span>${boxes}</div>\n                  `;
        // the typed command goes into the SAME text node as the prompt (typeInto writes pre + typed), as in xterm:
        // a separate node starts its own text fragment, which moves later glyphs by a sub-pixel
        // one line at a time, like a real terminal (EDITOR m07 redo m-C/m-D): the next prompt (">>> ", "... ", the shell
        // prompt) appears when Enter ends the previous line (its last key + 0.15 s) or right after the output, never
        // earlier; typing that was scheduled to overlap the previous line waits for that Enter
        const cpsT = a.cps || DEF.cpsTerm;
        // paste speed (≥ 60 cps, or paste:true) = a pasted block: the REPL shows each pasted line at once, back to back
        const isPaste = !!a.paste || cpsT >= 60;
        const gap = isPaste && prevPaste ? 0.02 : 0.2;
        let startT = +a.absStart.toFixed(2);
        if (hideLine && prevTermType && startT < prevLastKey + gap) startT = +(prevLastKey + gap).toFixed(2);
        if (hideLine && !prevTermType && startT < lastTermEnd + 0.1) startT = +(lastTermEnd + 0.1).toFixed(2);
        const tkeys = isPaste ? [] : keyTimes(a.text, startT, cpsT);
        const lastKey = tkeys.length ? tkeys[tkeys.length - 1] : startT;
        const revealAt = !hideLine ? a.absStart - 0.5 : isPaste ? startT : prevTermType ? prevLastKey + 0.15 : Math.min(lastTermEnd + 0.05, startT - 0.05);
        if (hideLine) emit(`tl.set("#${lineId}", { visibility: "visible" }, ${n2(revealAt)});`);
        if (isShell) {
          // a shell prompt appearing means the previous command finished
          const prevCmd = cmdLines[cmdLines.length - 1];
          if (prevCmd && prevCmd.end == null) prevCmd.end = revealAt;
          cmdLines.push({ id: lineId, row: termRow, start: revealAt, end: null, err: false });
          termRuler += rulerMark(lineId, termRow, hideLine);
          if (hideLine) emit(`tl.set("#${lineId}-mr", { visibility: "visible" }, ${n2(revealAt)});`);
        }
        lastTermEnd = lastKey + 0.15;
        prevTermType = true;
        prevLastKey = lastKey;
        prevPaste = isPaste;
        typingData.push({
          targets: [isPaste ? { id: cmdId, text: a.text, pre: isShell ? pr.slice(1) : pr, instant: true, at: startT } : { id: cmdId, text: a.text, pre: isShell ? pr.slice(1) : pr }],
          start: startT,
          cps: cpsT,
          times: tkeys,
        });
        // the block cursor sits after the prompt from the moment the terminal has focus, moves with the keys,
        // and leaves the line on Enter (= when the next terminal action starts)
        const allT = sc.beats.flatMap((bb) => bb.absActions);
        const openT = allT.filter((x) => x.do === "terminal-open" && x.absStart <= a.absStart).map((x) => x.absStart).pop();
        const nextA = allT.filter((x) => (x.do === "term-out" || x.do === "term-type") && x.absStart > a.absStart + 0.01).sort((p1, p2) => p1.absStart - p2.absStart)[0];
        const curFrom = hideLine ? revealAt : Math.max(sc.start, openT ?? a.absStart - 0.5);
        // the cursor leaves this line on Enter: at the next line's prompt, or when the output appears
        const nextPaste = nextA?.do === "term-type" && (!!nextA.paste || (nextA.cps || DEF.cpsTerm) >= 60);
        const curTo = !nextA ? sc.end - 0.15 : nextA.do === "term-type" ? lastKey + (isPaste && nextPaste ? 0.02 : 0.15) : Math.max(nextA.absStart, lastKey + 0.1);
        genSolid(curId, curFrom, curTo);
        termIdx++;
        termRow += Math.max(1, Math.ceil((pr.length + a.text.length) / TCOLS)); // a long command wraps too
      } else if (a.do === "term-out") {
        const outId = `${sc.id}-tout-${termIdx}`;
        const ringId = a.callout ? `${sc.id}-ring-${termIdx}` : null;
        const tagId = a.callout ? `${sc.id}-tag-${termIdx}` : null;
        let boxes = "";
        const wl = a.lines.map(wrapT), vis = wl.flat();
        const rowsBefore = []; { let acc = 0; for (const w of wl) { rowsBefore.push(acc); acc += w.length; } }
        const txt = a.lines.join("\n");
        const posOf = (k) => { const li = txt.slice(0, k).split("\n").length - 1, c = k - (txt.lastIndexOf("\n", k - 1) + 1); return [rowsBefore[li] + Math.floor(c / TCOLS), c % TCOLS]; };
        for (const m of marks.filter((m) => m.host === a)) {
          const k = nthIndex(txt, m.out, m.n || 1);
          const [r0, c0] = posOf(k), [r1, c1] = posOf(k + Math.max(0, m.out.replace(/\n$/, "").length - 1));
          if (r0 === r1) boxes += markBoxHTML(m, c0, c1 - c0 + 1, 1, r0);
          else boxes += markBoxHTML(m, 0, Math.max(...vis.slice(r0, r1 + 1).map((v) => v.length)), r1 - r0 + 1, r0);
          emitMarkBox(m);
        }
        // the tag sits right of the ring; when that doesn't fit inside the panel it goes under the ring's right end
        // (the row below is the short prompt). A full-width block keeps its ring inside the panel too.
        const longest = Math.max(...vis.map((v) => v.length));
        const tagBelow = a.callout && longest * GEOM.termCell + 23 + (a.callout.length + 3) * 7.6 > TCOLS * GEOM.termCell;
        const full = longest >= TCOLS - 1;
        termHTML += `<div class="term-line"><span class="t-out-block${full ? " full" : ""}" id="${outId}" data-layout-allow-overflow>${esc(vis.join("\n"))}${boxes}${
          a.callout
            ? `<span class="out-ring" id="${ringId}"></span><span class="out-tag${tagBelow ? " below" : ""}" id="${tagId}">&#10003;&nbsp;${esc(a.callout.toUpperCase())}</span>`
            : ""
        }</span></div>\n                  `;
        // program output arrives all at once (only humans type), and never before Enter ends the command
        const outAt = prevTermType ? Math.max(a.absStart, lastTermEnd) : a.absStart;
        if (outAt - a.absStart > 0.3) warn(`scene ${sc.id}: output "${a.lines[0].slice(0, 30)}" waits ${(outAt - a.absStart).toFixed(1)}s for its command to finish typing — start the typing earlier or raise its cps`);
        emit(`tl.set("#${outId}", { visibility: "visible", opacity: 1 }, ${n2(outAt)});`);
        if (ringId)
          emit(
            `tl.fromTo("#${ringId}", { opacity: 0, scale: 1.22 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, ${n2(outAt + 0.35)});`
          );
        if (tagId)
          emit(
            `tl.fromTo("#${tagId}", { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.45, ease: "power2.out" }, ${n2(outAt + 0.7)});`
          );
        if (a.lines.some((l) => /^Traceback|^\w+Error:/.test(l)) && cmdLines.length) cmdLines[cmdLines.length - 1].err = true;
        lastOutId = { afterStart: a.absEnd, outStart: outAt, idx: termIdx };
        lastTermEnd = Math.max(lastTermEnd, outAt + 0.3);
        prevTermType = false;
        prevPaste = false;
        termIdx++;
        termRow += vis.length;
      }
    }
  }
  // no automatic trailing prompt when the scene's last terminal action is typing (e.g. ">>> " or exit())
  const termActs = sc.beats.flatMap((bb) => bb.absActions).filter((a) => a.do === "term-type" || a.do === "term-out");
  const endsTyping = termActs.length && termActs[termActs.length - 1].do === "term-type" && termActs[termActs.length - 1].absStart > (lastOutId?.afterStart ?? -1);
  if (lastOutId && !endsTyping) {
    const pId = `${sc.id}-tprompt-end`;
    const pCur = `${sc.id}-tcur-end`;
    // inside the Python shell the fresh prompt is ">>> ", not the shell prompt
    const lastType = sc.beats.flatMap((bb) => bb.absActions).filter((a) => a.do === "term-type").pop();
    const inRepl = lastType?.prompt === ">>> " || lastType?.prompt === "... ";
    const endAt = lastOutId.outStart + 0.25; // the program exits: the prompt is back almost at once
    termHTML += `<div class="term-line" id="${pId}" style="visibility:hidden">${inRepl ? "" : decoHTML(pId)}<span class="${inRepl ? "" : "t-prompt"}">${inRepl ? esc(">>> ") : promptHTML(prompt)}</span><span id="${pCur}" class="cursor tcur"></span></div>\n                  `;
    emit(`tl.set("#${pId}", { visibility: "visible" }, ${n2(endAt)});`);
    genSolid(pCur, endAt, sc.end - 0.15);
    if (!inRepl) {
      const prevCmd = cmdLines[cmdLines.length - 1];
      if (prevCmd && prevCmd.end == null) prevCmd.end = endAt;
      termRuler += rulerMark(pId, termRow, true);
      emit(`tl.set("#${pId}-mr", { visibility: "visible" }, ${n2(endAt)});`);
    }
  }
  // the terminal doesn't scroll here: rows past the panel's last row are cut off (xterm rows that fit: the panel less
  // its 35 title bar, over the row height - 10 at the default 200 panel, 11 at terminalFontSize 12)
  if (hasTerm) {
    const used = termRow + (lastOutId && !endsTyping ? 1 : 0);
    const fit = termRows(GEOM, sc.beats[0].terminalMax ? MAX_PANEL : sc.beats[0].terminalHeight || spec.panelHeight || 200);
    if (used > fit) warn(`scene ${sc.id}: the terminal shows ${used} rows but the panel holds ${fit} — the last ${used - fit} are cut off; raise terminalHeight, use terminalMax, or terminalFontSize 12 (${GEOM.terminalFontSize === 12 ? "already" : "rows " + GEOM.termRow + " -> 14"})`);
  }
  // finished commands: hollow -> blue (or red) dot, gray -> blue (or red) ruler mark
  for (const c of cmdLines) {
    if (c.end == null) continue;
    const k = c.err ? "e" : "k";
    emit(`tl.set("#${c.id}-dr", { visibility: "hidden" }, ${n2(c.end)});`);
    emit(`tl.set("#${c.id}-d${k}", { visibility: "visible" }, ${n2(c.end)});`);
    emit(`tl.set("#${c.id}-mr", { visibility: "hidden" }, ${n2(c.end)});`);
    emit(`tl.set("#${c.id}-m${k}", { visibility: "visible" }, ${n2(c.end)});`);
  }

  const hasFileActivate = sc.beats.some((b) => b.absActions.some((a) => a.do === "file-activate"));
  // live status bar (7.6 editor round 1): Ln/Col follows the cursor — each typed line (start → col 1, end → end
  // of line) and each debugger step — instead of one static value per scene
  const fcBeat = sc.beats.find((b) => b.fileCreate);
  const stEvents = [];
  let lastTypeEnd = -Infinity;
  for (const b of sc.beats)
    for (const a of b.absActions) {
      if (a.do === "type") {
        const L = a.segs.reduce((n, x) => n + x[1].length, 0);
        const ind0 = a.segs.map((x) => x[1]).join("").match(/^ */)[0].length; // auto-indent lands with Enter
        // Ln/Col changes when the cursor reaches the line (the same moment the cursor model moves it), not at the first key
        const reach = Math.max(a.absStart - 0.35, lastTypeEnd + 0.05, sc.start);
        const end = a.absEnd ?? a.absStart + L / (a.cps || DEF.cpsCode);
        stEvents.push({ t: reach, txt: `Ln ${a.line - lineBase}, Col ${ind0 + 1}` }, { t: end, txt: `Ln ${a.line - lineBase}, Col ${L + 1}` });
        lastTypeEnd = end;
      } else if (a.do === "step") stEvents.push({ t: a.absStart, txt: `Ln ${a.line - lineBase}, Col 1` });
      else if (a.do === "paste") {
        const last = a.lines[a.lines.length - 1];
        stEvents.push({ t: a.absStart, txt: `Ln ${last.line - lineBase}, Col ${last.segs.reduce((n, x) => n + x[1].length, 0) + 1}` });
      }
    }
  stEvents.sort((x, y) => x.t - y.t);
  const firstTyped = sc.beats.flatMap((b) => b.absActions).find((a) => a.do === "type");
  // where the cursor starts: a new file at 1:1, else the end of the last prefilled line (7.6 round 2: tm4 showed
  // the after-paste line before the paste), else the first line that gets typed
  const pf = sc.beats[0].prefill || [];
  const lastPf = pf[pf.length - 1];
  const st0 = fcBeat ? "Ln 1, Col 1"
    : lastPf ? `Ln ${lastPf.line - lineBase}, Col ${lastPf.segs.reduce((n, x) => n + x[1].length, 0) + 1}`
    : firstTyped ? `Ln ${firstTyped.line - lineBase}, Col 1` : "Ln 1, Col 1";
  // one live Ln/Col element: events here, and every keystroke from the typing runtime (typing entry .st)
  let statusHTML = `<span id="${sc.id}-st">${esc(st0)}</span>`;
  stEvents.forEach((e) => statusData.push({ id: `${sc.id}-st`, t: +e.t.toFixed(3), txt: e.txt }));
  for (const o of typedOrder) o.entry.st = { id: `${sc.id}-st`, ln: o.line - lineBase };

  /* overlay pause: a compact "your turn" card laid OVER the editor so the typed
     code stays visible behind/around it. Lives inside this editor scene (no
     separate full-screen pause scene). Appears at the pause beat's start and
     rides out with the scene transition. */
  /* PAUSE VISIBILITY: when a card tells students to pause, the paused frame must show
     everything that step asked them to type: every editor line it typed (in view, not under the terminal panel,
     not under sticky rows, not scrolled off) and every terminal command it typed (in the open panel, or written
     on the card). Close the panel with {do:"terminal-close"} (Cmd+J) before the pause, or move viewTop. */
  {
    const fileOf = (n) => { let best = null; for (const fl of spec.files || [{ name: spec.file.name, base: 0 }]) if ((fl.base || 0) < n && (!best || (fl.base || 0) > (best.base || 0))) best = fl; return best; };
    const panelH = sc.beats[0].terminalHeight || spec.panelHeight || 200;
    const acts = sc.beats.flatMap((bb) => bb.absActions);
    for (const b of sc.beats) {
      if (!b.pauseOverlay) {
        for (const a of b.absActions) {
          if (a.do === "type") STEP.lines.push(a.line);
          else if (a.do === "paste") STEP.lines.push(...a.lines.map((p) => p.line)); // pasted from the assignment: they type it too
          else if (a.do === "term-type" && (a.text || "").trim()) STEP.cmds.push(a.text.trim());
        }
        continue;
      }
      const tp = b.start + 0.6; // the card is up and the window has shrunk
      const lastOpen = acts.filter((a) => a.do === "terminal-open" && a.absStart <= tp).map((a) => a.absStart).pop();
      const lastClose = acts.filter((a) => a.do === "terminal-close" && a.absStart <= tp).map((a) => a.absStart).pop();
      const panelOpen = lastOpen != null && (lastClose == null || lastClose < lastOpen);
      const rows = (panelOpen ? (sc.beats[0].terminalMax ? 0 : fitTerm) : fitAll) - extraRows;
      const lastVisible = viewTop + rows - 1;
      const thisFile = fileOf(viewTop) || fileOf(lineBase + 1);
      const hidden = [], elsewhere = new Set(), wide = [];
      // columns before the minimap: the rest of a longer line runs UNDER it (10% visible) - not readable
      const cols = GEOM.cols;
      for (const n of [...new Set(STEP.lines)].sort((x, y) => x - y)) {
        const fl = fileOf(n);
        if (fl && thisFile && fl.name !== thisFile.name) { elsewhere.add(fl.name); continue; }
        if (n < viewTop || n > lastVisible) hidden.push(n - lineBase);
        else if ((SPEC_CODE?.[n] ?? "").length > cols) wide.push(`${n - lineBase} (${SPEC_CODE[n].length} chars)`);
      }
      if (wide.length)
        pauseErrors.push(`pause ${b.id} (step ${b.step?.n}): line(s) ${wide.join(", ")} run under the minimap — only ${cols} characters are readable; shorten or split the line the way real code would be split`);
      const why = panelOpen ? (sc.beats[0].terminalMax ? "the maximized terminal covers the editor" : `the terminal panel leaves room for only ${rows} line(s)`) : `only lines ${viewTop - lineBase}–${lastVisible - lineBase} are in view`;
      if (hidden.length)
        pauseErrors.push(`pause ${b.id} (step ${b.step?.n}): students can't see line(s) ${hidden.join(", ")} they were asked to type — ${why}. Add {do:"terminal-close"} (Cmd+J) before the pause, raise viewTop, or split the step`);
      if (elsewhere.size)
        warn(`pause ${b.id}: the step also typed into ${[...elsewhere].join(", ")}, which is not on screen at the pause — make sure the card says what goes there`);
      // a checkpoint card (badge, no step: "PREDICT THE OUTPUT") asks students to read the code, not to type it:
      // the lines must still be in view, but the step's commands carry on to the next STEP card
      if (b.badge && !b.step) continue;
      const card = [b.task, ...(b.checklist || []), b.hint || ""].join(" ").toLowerCase();
      if (!panelOpen) {
        const lost = STEP.cmds.filter((c) => !card.includes(c.toLowerCase()));
        if (lost.length) pauseErrors.push(`pause ${b.id} (step ${b.step?.n}): the terminal is closed at the pause, so these typed commands aren't visible and aren't on the card: ${lost.map((c) => JSON.stringify(c)).join(", ")} — keep the panel open or put them on the card`);
      }
      STEP.lines = []; STEP.cmds = [];
    }
  }

  let overlayHTML = "";
  sc.beats.forEach((b, bi) => {
    if (!b.pauseOverlay) return;
    const id = `${sc.id}-pov-${bi}`;
    overlayHTML += `
        <div class="pause-ov" id="${id}" style="visibility:hidden;opacity:0" data-layout-allow-overflow>
          <div class="pov-card">
            <div class="pov-toprow"><div class="pov-glyph"><span></span><span></span></div><div class="pov-badge mono">${esc(pauseBadge(b))}</div></div>
            <div class="pov-head">${esc(b.task)}</div>
            <div class="pov-list">
              ${b.checklist.map((c) => `<div class="pov-item"><div class="pov-box"></div><div>${esc(c)}</div></div>`).join("\n              ")}
            </div>
            ${b.hint ? `<div class="pov-hint">${esc(b.hint)}</div>` : ""}
            <div class="pov-foot">&#9658;&nbsp;&nbsp;PRESS PLAY WHEN YOU&rsquo;RE DONE</div>
          </div>
        </div>`;
    const t = b.start;
    // shrink the editor toward its top-left so the card has clear space on the right
    // (never overlaps code). The next scene is a fresh full-size editor. 0.74 puts the default window's right edge at
    // 1368, 20 px clear of the card (1920 - 46 - 486 = 1388); a wider window shrinks a little more to keep that gap
    const shrink = +Math.min(0.74, (1368 - GEOM.left) / (2 * GEOM.width)).toFixed(4);
    emit(`tl.to("#${sc.id} .vsc", { scale: ${shrink}, duration: 0.55, ease: "power3.out", transformOrigin: "0% 0%" }, ${n2(t + 0.1)});`);
    emit(`tl.fromTo("#${id}", { visibility: "hidden", opacity: 0 }, { visibility: "visible", opacity: 1, duration: 0.4, ease: "power2.out" }, ${n2(t + 0.25)});`);
    emit(`tl.fromTo("#${id} .pov-card", { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)" }, ${n2(t + 0.25)});`);
    emit(`tl.fromTo("#${id} .pov-item", { x: -16, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: "power2.out", stagger: 0.1 }, ${n2(t + 0.6)});`);
  });

  /* steps overlay: a small red-accented card (top-right) listing the literal steps for
     something we can't click-by-click animate (open the terminal, create a file). Fades
     in at `at`, out after `hold`. Beat property: stepsOverlay:{ title, items[], at?, hold? } */
  sc.beats.forEach((b, bi) => {
    const so = b.stepsOverlay;
    if (!so) return;
    const id = `${sc.id}-steps-${bi}`;
    overlayHTML += `
        <div class="steps-ov${so.pos === "bottom" ? " bottom" : ""}" id="${id}" style="visibility:hidden;opacity:0" data-layout-allow-overflow>
          <div class="steps-card">
            <div class="steps-title">${esc(so.title || "Steps")}</div>
            ${so.items.map((it, k) => `<div class="steps-item"><span class="steps-num mono">${k + 1}</span><div>${esc(it)}</div></div>`).join("\n            ")}
          </div>
        </div>`;
    const at = b.start + (so.at ?? 1.0);
    const hold = so.hold ?? Math.max(3, b.end - at - 0.6);
    emit(`tl.fromTo("#${id}", { visibility: "hidden", opacity: 0 }, { visibility: "visible", opacity: 1, duration: 0.4, ease: "power2.out" }, ${n2(at)});`);
    emit(`tl.fromTo("#${id} .steps-card", { x: 30, scale: 0.97 }, { x: 0, scale: 1, duration: 0.45, ease: "back.out(1.3)" }, ${n2(at)});`);
    emit(`tl.fromTo("#${id} .steps-item", { x: 14, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: "power2.out", stagger: 0.1 }, ${n2(at + 0.3)});`);
    emit(`tl.to("#${id}", { opacity: 0, duration: 0.4, ease: "power1.in" }, ${n2(at + hold)});`);
    emit(`tl.set("#${id}", { visibility: "hidden" }, ${n2(at + hold + 0.45)});`);
  });

  /* file-create (the real Explorer flow, measured from VS Code 1.138): the pointer comes over the
     Explorer and the folder header shows its actions; New File gets its hover background; click opens a
     focused name box at the top of the folder; the name types in (the icon turns into the Python icon
     when ".py" is typed); Enter turns the box into the file's row (sorted, selected), opens the file in a
     tab with the breadcrumb, and the empty-editor watermark gives way to the editor. Enabled by
     beat.fileCreate; fileCreateAt / fileOpenAt are seconds into that beat ("click New File" / "press Enter"). */
  const fc = sc.beats.find((b) => b.fileCreate);
  const fnameId = fc ? `${sc.id}-fname` : null;
  const firstFile = fc && !prevView; // nothing open yet: no tabs, no breadcrumb, bare status bar, watermark
  if (fc) {
    const nameStart = fc.start + (fc.fileCreateAt ?? 1.8);
    const nameKeys = keyTimes(f.name, +nameStart.toFixed(2), 13);
    typingData.push({ targets: [{ id: fnameId, text: f.name }], start: +nameStart.toFixed(2), cps: 13, times: nameKeys });
    const nameEnd = nameStart + f.name.length / 13;
    const openAt = fc.fileOpenAt != null ? fc.start + fc.fileOpenAt : nameEnd + 0.45;
    const hoverAt = Math.max(sc.start + 0.05, nameStart - 2.2);
    const btnAt = Math.max(hoverAt, nameStart - 1.4);
    const clickAt = Math.max(btnAt + 0.1, nameStart - 0.6);
    let hoverAtP = hoverAt, btnAtP = btnAt;
    // the macOS pointer: comes over the Explorer (header shows its actions as it arrives), onto New File, clicks;
    // macOS hides it as soon as typing starts
    {
      const ptr = `#${sc.id}-ptr`;
      const appear = Math.max(sc.start + 0.05, hoverAt - 1.0);
      emit(`tl.set("${ptr}", { visibility: "visible", x: 560, y: 250 }, ${n2(appear)});`);
      const d1 = Math.max(0.25, hoverAt - appear - 0.05), d2 = Math.max(0.2, btnAt - hoverAt - 0.15);
      emit(`tl.to("${ptr}", { x: 118, y: 81, duration: ${n2(d1)}, ease: "power2.inOut" }, ${n2(appear + 0.05)});`);
      emit(`tl.to("${ptr}", { x: 153, y: 81, duration: ${n2(d2)}, ease: "power1.inOut" }, ${n2(hoverAt + 0.05)});`);
      hoverAtP = appear + 0.05 + d1 * 0.62; // the pointer crosses into the Explorer header
      btnAtP = hoverAt + 0.05 + d2 * 0.6; // ...and onto the New File button
      emit(`tl.to("${ptr}", { scale: 0.88, transformOrigin: "5px 5px", duration: 0.08, yoyo: true, repeat: 1, ease: "power1.inOut" }, ${n2(clickAt - 0.12)});`);
      emit(`tl.set("${ptr}", { visibility: "hidden" }, ${n2(nameStart)});`);
    }
    emit(`tl.set("#${sc.id}-fhd", { attr: { class: "pane-hd hover" } }, ${n2(hoverAtP)});`);
    emit(`tl.set("#${sc.id}-newfile", { attr: { class: "sb-btn hov" } }, ${n2(btnAtP)});`);
    emit(`tl.set("#${sc.id}-fcin", { display: "flex" }, ${n2(clickAt)});`);
    if (prevView) genCursor(`${sc.id}-prevcur`, sc.start, sc.start, sc.start, clickAt); // the editor had focus until the click
    if (prevView) emit(`tl.set("#${sc.id}-prevrow", { attr: { class: "sb-row" } }, ${n2(openAt)});`);
    genCursor(`${sc.id}-fccur`, clickAt, nameKeys[0], nameKeys[nameKeys.length - 1], openAt);
    const dot = f.name.lastIndexOf(".");
    if (dot > 0) {
      const iconAt = nameStart + f.name.length / 13; // the language icon arrives with the last extension letter
      emit(`tl.set("#${sc.id}-fci0", { display: "none" }, ${n2(iconAt)});`);
      emit(`tl.set("#${sc.id}-fci1", { display: "inline-block" }, ${n2(iconAt)});`);
    }
    // Enter
    emit(`tl.set("#${sc.id}-fcin", { display: "none" }, ${n2(openAt)});`);
    emit(`tl.set("#${sc.id} .sb-row.main", { display: "flex" }, ${n2(openAt)});`);
    // the (hidden) pointer still rests on New File, so the header keeps its hover state
    if (firstFile) {
      emit(`tl.set("#${sc.id} .vsc-tabs", { display: "flex" }, ${n2(openAt)});`);
      emit(`tl.set("#${sc.id} .vsc-breadcrumb", { display: "flex" }, ${n2(openAt)});`);
      emit(`tl.set("#${sc.id}-wm", { display: "none" }, ${n2(openAt)});`);
      emit(`tl.set("#${sc.id}-stfull", { display: "contents" }, ${n2(openAt)});`);
    } else {
      emit(`tl.set("#${sc.id}-tabmain", { display: "flex" }, ${n2(openAt)});`);
      emit(`tl.set("#${sc.id}-prevtab", { attr: { class: "vsc-tab vsc-tab-off" } }, ${n2(openAt)});`);
      emit(`tl.set("#${sc.id}-prev", { display: "none" }, ${n2(openAt)});`);
      emit(`tl.set("#${sc.id}-prevmm", { display: "none" }, ${n2(openAt)});`);
      emit(`tl.set("#${sc.id}-bc0", { display: "none" }, ${n2(openAt)});`);
      emit(`tl.set("#${sc.id}-bc1", { display: "inline" }, ${n2(openAt)});`);
    }
    emit(`tl.set("#${sc.id}-newcode", { visibility: "visible" }, ${n2(openAt)});`);
    emit(`tl.set("#${sc.id}-newmm", { visibility: "visible" }, ${n2(openAt)});`);
    if (firstFile) {
      emit(`tl.set("#${sc.id}-edmm", { visibility: "visible" }, ${n2(openAt)});`);
      emit(`tl.set("#${sc.id}-edrl", { visibility: "visible" }, ${n2(openAt)});`);
    }
  }
  const sbActive = hasFileActivate || fc ? "" : " active";
  const LANG_NAME = { python: "Python", bash: "Shell Script", shell: "Shell Script", javascript: "JavaScript", html: "HTML", json: "JSON", markdown: "Markdown", plain: "Plain Text" };
  const sorted = [...listed].sort((x, y) => x.name.localeCompare(y.name));
  const explorer = sorted.map((o) =>
    o.name === f.name
      ? { name: o.name, cls: `main${fc ? " active" : sbActive}`, attrs: fc ? ' style="display:none"' : "" }
      : { name: o.name, cls: prevView && o.name === prevView.name ? "active" : "", attrs: prevView && o.name === prevView.name ? ` id="${sc.id}-prevrow"` : "" }
  );
  if (fc)
    explorer.unshift({
      name: f.name,
      attrs: ` id="${sc.id}-fcin" style="display:none"`,
      iconHTML: fileIcon("plain", { id: `${sc.id}-fci0` }) + fileIcon(f.lang || "plain", { id: `${sc.id}-fci1`, style: "display:none" }),
      nameHTML: `<div class="sb-input"><span id="${fnameId}"></span><span id="${sc.id}-fccur" class="cursor icur"></span></div>`,
    });
  const tabs = listed.map((o) =>
    o.name === f.name
      ? { name: o.name, on: true, id: `${sc.id}-tabmain`, attrs: fc && !firstFile ? ' style="display:none"' : "" }
      : { name: o.name, on: !!(prevView && o.name === prevView.name), id: prevView && o.name === prevView.name ? `${sc.id}-prevtab` : undefined }
  );
  // overview ruler: the cursor's position in the file (Monaco maps scrollHeight = lines + one screen)
  const edH = GEOM.height - 35 - 22 - 35 - 22;
  const scrollH = (maxLine - viewTop + 1) * GEOM.lineHeight + edH - GEOM.lineHeight;
  const rulerHTML = `<span class="rc" style="top:${(((lastPfLine || viewTop) - viewTop) * GEOM.lineHeight * edH / scrollH).toFixed(1)}px"></span>`;
  const panelH = sc.beats[0].terminalHeight || spec.panelHeight || 200;

  return `
      <div id="${sc.id}" class="scene"${sc !== scenes[0] ? ' style="opacity:0"' : ""}>
        <div class="glow glow-a" data-layout-ignore style="top:50%;left:50%;width:1750px;height:1100px;margin:-550px 0 0 -875px;"></div>
        <div class="ed-label mono">${esc(spec.editorLabel || `${spec.course || ""}${spec.module ? " — " + spec.module : ""}`)}</div>
        <div class="ed-label-r mono">${esc(spec.file.lang || "code")} &middot; visual studio code</div>
        ${vscWindowHTML({
          id: sc.id,
          folder: f.folder || "demo",
          lang: f.lang || "plain",
          explorer,
          folderHeaderId: `${sc.id}-fhd`,
          newFileId: `${sc.id}-newfile`,
          sidebarExtra: debugPanelHTML(sc),
          tabs,
          tabsAttrs: firstFile ? ' style="display:none"' : "",
          breadcrumb: { name: f.name, lang: f.lang, attrs: firstFile ? ' style="display:none"' : "", nameHTML: prevView ? `<span id="${sc.id}-bc0">${esc(prevView.name)}</span><span id="${sc.id}-bc1" style="display:none">${esc(f.name)}</span>` : undefined },
          watermark: firstFile,
          watermarkAttrs: ` id="${sc.id}-wm"`,
          codeHTML: `${scrollDeco}${stickyHTML}${prevView ? `<div class="code-prev" id="${sc.id}-prev" style="position:absolute;left:0;right:0;top:0">${prevView.html}</div>` : ""}${fc ? `<div id="${sc.id}-newcode" style="visibility:hidden">${codeHTML}</div>` : codeHTML}`,
          minimapHTML: fc
            ? `${prevView ? `<div id="${sc.id}-prevmm" style="position:absolute;left:0;right:0;top:0"><canvas class="mmc" id="${sc.id}-mmc-prev" width="${2 * GEOM.minimap}" height="644"></canvas></div>` : ""}<div id="${sc.id}-newmm" style="visibility:hidden"><canvas class="mmc" id="${mmId}" width="${2 * GEOM.minimap}" height="644"></canvas></div>`
            : `<canvas class="mmc" id="${mmId}" width="${2 * GEOM.minimap}" height="644"></canvas>`,
          rulerHTML,
          badgeId: `${sc.id}-badge`,
          lightsId: `${sc.id}-tl`,
          mmMarkId: `${sc.id}-mmmark`,
          pointerHTML: fc ? `<img class="vsc-pointer" id="${sc.id}-ptr" src="vscode/pointer.svg" alt="" />` : "",
          edChromeAttrs: firstFile ? (k) => ` id="${sc.id}-ed${k}" style="visibility:hidden"` : null,
          panel: hasTerm ? { height: panelH, max: !!sc.beats[0].terminalMax, bodyHTML: termHTML, rulerHTML: termRuler } : null,
          status: { lnColHTML: statusHTML, lang: LANG_NAME[f.lang] || "Plain Text", interp: spec.statusRight || "Python 3.14.4 (homebrew)", fullAttrs: ` id="${sc.id}-stfull"${firstFile ? ' style="display:none"' : ""}` },
          geom: GEOM,
        })}${overlayHTML}
      </div>`;
}

const sceneHTML = scenes
  .map((sc) =>
    sc.kind === "title"
      ? titleSceneHTML(sc)
      : sc.kind === "pause"
        ? pauseSceneHTML(sc)
        : sc.kind === "outro"
          ? outroSceneHTML(sc)
          : sc.kind === "browser"
            ? browserSceneHTML(sc)
            : sc.kind === "doc"
              ? docSceneHTML(sc)
              : sc.kind === "compare"
                ? compareSceneHTML(sc)
                : sc.kind === "sting"
                  ? stingSceneHTML(sc)
                  : sc.kind === "recap"
                    ? recapSceneHTML(sc)
                    : sc.kind === "endscreen"
                      ? endscreenSceneHTML(sc)
                      : editorSceneHTML(sc)
  )
  .join("\n");
if (pauseErrors.length) {
  for (const m of pauseErrors) console.error("ERROR: " + m);
  process.exit(1);
}

if (LATE_MARKS.length)
  fail(`${LATE_MARKS.length} mark(s) wait >0.5 s for typing; the voice explains code before it exists. Type those lines earlier/faster (cps ≤ 16), don't delete the mark:\n    ${LATE_MARKS.join("\n    ")}`);

/* ---------- scene entrances (literal tween code, fromTo only) ---------- */
for (const s of scenes) {
  const P = `#${s.id}`;
  if (s.kind === "title") {
    const t = s.start === 0 ? 0 : s.start + 0.15;
    if (spec.title?.ghost !== false) emit(`tl.fromTo("${P} .ttl-ghost", { opacity: 0, x: -40 }, { opacity: 0.09, x: 0, duration: 1.2, ease: "power1.out" }, ${n2(t + 0.4)});`);
    emit(`tl.fromTo("${P} .ttl-meta", { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, ${n2(t + 0.25)});`);
    emit(`tl.fromTo("${P} .ttl-meta-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power2.inOut" }, ${n2(t + 0.35)});`);
    emit(
      `tl.fromTo("${P} .ttl-hero", { y: 80, opacity: 0, filter: "blur(14px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.9, ease: "expo.out" }, ${n2(t + 0.55)});`
    );
    emit(`tl.fromTo("${P} .ttl-bar", { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: "power3.inOut" }, ${n2(t + 1.05)});`);
    emit(`tl.fromTo("${P} .ttl-sub", { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "sine.out" }, ${n2(t + 1.2)});`);
    emit(`tl.fromTo("${P} .ttl-chip", { x: 70, opacity: 0 }, { x: 0, opacity: 0.9, duration: 0.55, ease: "back.out(1.4)" }, ${n2(t + 1.4)});`);
    emit(`tl.fromTo("${P} .ttl-corner.tl", { scale: 0, opacity: 0 }, { scale: 1, opacity: 0.8, duration: 0.4, ease: "power2.out" }, ${n2(t + 1.55)});`);
    emit(`tl.fromTo("${P} .ttl-corner.br", { scale: 0, opacity: 0 }, { scale: 1, opacity: 0.8, duration: 0.4, ease: "power2.out" }, ${n2(t + 1.65)});`);
    emit(
      `tl.fromTo("${P} .glow", { x: 0, y: 0 }, { x: 60, y: -40, duration: ${n2(Math.min(5, s.end - s.start))}, ease: "sine.inOut" }, ${n2(t)});`
    );
  } else if (s.kind === "editor") {
    const t = s.start;
    emit(`tl.fromTo("${P} .vsc", { y: 26 }, { y: 0, duration: 0.55, ease: "power2.out" }, ${n2(t + 0.3)});`);
    emit(`tl.fromTo("${P} .ed-label", { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "power3.out" }, ${n2(t + 0.7)});`);
    emit(`tl.fromTo("${P} .ed-label-r", { opacity: 0 }, { opacity: 0.75, duration: 0.7, ease: "sine.out" }, ${n2(t + 1.0)});`);
    genBreathe(`${P} .glow`, t + 0.5, s.end);
  } else if (s.kind === "pause") {
    const t = s.start;
    emit(`tl.fromTo("${P} .pc-glyph", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.7)" }, ${n2(t + 0.3)});`);
    emit(`tl.fromTo("${P} .pc-badge", { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${n2(t + 0.5)});`);
    emit(
      `tl.fromTo("${P} .pc-head", { y: 50, opacity: 0, filter: "blur(8px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }, ${n2(t + 0.65)});`
    );
    emit(
      `tl.fromTo("${P} .pc-item", { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power2.out", stagger: 0.13 }, ${n2(t + 1.0)});`
    );
    if (s.beats[0].hint)
      emit(`tl.fromTo("${P} .pc-hint", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "sine.out" }, ${n2(t + 1.5)});`);
    emit(`tl.fromTo("${P} .pc-foot", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)" }, ${n2(t + 1.75)});`);
    genBreathe(`${P} .glow`, t + 0.4, s.end, 1.09);
  } else if (s.kind === "doc") {
    const t = s.start;
    const b = s.beats[0];
    emit(`tl.fromTo("${P} .doc-sheet", { y: 44, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65, ease: "power3.out" }, ${n2(t + 0.3)});`);
    emit(`tl.fromTo("${P} .ed-label", { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "power2.out" }, ${n2(t + 0.6)});`);
    if (b.doc.callout)
      emit(
        `tl.fromTo("#${s.id}-note", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }, ${n2(t + (b.doc.callout.at ?? 2.5))});`
      );
    genBreathe(`${P} .glow`, t + 0.4, s.end);
  } else if (s.kind === "browser") {
    const t = s.start;
    const b = s.beats[0];
    emit(`tl.fromTo("${P} .brw", { y: 34, scale: 0.98, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.65, ease: "power3.out" }, ${n2(t + 0.3)});`);
    emit(`tl.fromTo("${P} .ed-label", { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "power2.out" }, ${n2(t + 0.7)});`);
    emit(`tl.fromTo("${P} .ed-label-r", { opacity: 0 }, { opacity: 0.75, duration: 0.7, ease: "sine.out" }, ${n2(t + 1.0)});`);
    emit(`tl.fromTo("${P} .brw-page", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: "sine.out" }, ${n2(t + 1.0)});`);
    if (b.browser.callout)
      emit(
        `tl.fromTo("#${s.id}-note", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }, ${n2(t + (b.browser.callout.at ?? 2.5))});`
      );
    genBreathe(`${P} .glow`, t + 0.4, s.end);
  } else if (s.kind === "outro") {
    const t = s.start;
    emit(
      `tl.fromTo("${P} .ot-head", { y: 70, opacity: 0, filter: "blur(10px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.8, ease: "expo.out" }, ${n2(t + 0.35)});`
    );
    emit(
      `tl.fromTo("${P} .ot-item", { y: 40, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.5)", stagger: 0.14 }, ${n2(t + 0.9)});`
    );
    emit(`tl.fromTo("${P} .ot-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, ${n2(t + 1.4)});`);
    emit(`tl.fromTo("${P} .ot-foot", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "sine.out" }, ${n2(t + 1.7)});`);
    genBreathe(`${P} .glow`, t + 0.3, s.end, 1.1);
  } else if (s.kind === "sting") {
    const t = s.start === 0 ? 0 : s.start + 0.15;
    const st = s.beats[0].sting || {};
    if (brandArt().emblem)
      emit(`tl.fromTo("${P} .stg-emb", { scale: 0.55, opacity: 0, rotation: -10 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.75, ease: "back.out(1.7)" }, ${n2(t + 0.1)});`);
    emit(`tl.fromTo("${P} .stg-ring", { scale: 0.8, opacity: 0.9 }, { scale: 1.75, opacity: 0, duration: 1.1, ease: "power2.out" }, ${n2(t + 0.55)});`);
    emit(`tl.fromTo("${P} .stg-word", { y: 30, opacity: 0, scale: 1.18 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "expo.out" }, ${n2(t + 0.75)});`);
    if (st.title) {
      // the sting is done: the mark makes room and the lesson card comes in under the promise line
      const k = s.start + STING_LEN - 0.45;
      emit(`tl.fromTo("${P} .stg-mark", { x: 0, scale: 1 }, { x: -480, scale: 0.78, duration: 0.65, ease: "power3.inOut" }, ${n2(k)});`);
      if (st.chip) emit(`tl.fromTo("${P} .stg-chip", { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${n2(k + 0.35)});`);
      emit(`tl.fromTo("${P} .stg-title", { y: 50, opacity: 0, filter: "blur(10px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }, ${n2(k + 0.45)});`);
      if (st.course) emit(`tl.fromTo("${P} .stg-course", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "sine.out" }, ${n2(k + 0.7)});`);
      if (st.free) emit(`tl.fromTo("${P} .stg-free", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)" }, ${n2(k + 0.9)});`);
    }
    genBreathe(`${P} .glow`, t + 0.3, s.end, 1.1);
  } else if (s.kind === "recap") {
    const t = s.start;
    const b = s.beats[0];
    if (brandArt().emblem) emit(`tl.fromTo("${P} .rcp-emb", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(1.7)" }, ${n2(t + 0.25)});`);
    emit(`tl.fromTo("${P} .rcp-tag", { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${n2(t + 0.35)});`);
    emit(`tl.fromTo("${P} .rcp-head", { y: 50, opacity: 0, filter: "blur(8px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }, ${n2(t + 0.5)});`);
    const reveals = b.absActions.filter((a) => a.do === "recap-line");
    b.recap.lines.forEach((_, i) => {
      const a = reveals.find((r) => r.n === i);
      emit(`tl.fromTo("#${s.id}-rl${i}", { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${n2(a ? a.absStart : t + 1.1 + i * 0.45)});`);
    });
    genBreathe(`${P} .glow`, t + 0.3, s.end, 1.08);
  } else if (s.kind === "endscreen") {
    const t = s.start;
    if (s.beats[0].endscreen.head) emit(`tl.fromTo("${P} .es-head", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, ${n2(t + 0.3)});`);
    emit(`tl.fromTo("${P} .es-left", { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, ${n2(t + 0.4)});`);
    emit(`tl.fromTo("${P} .es-right", { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, ${n2(t + 0.55)});`);
    emit(`tl.fromTo("${P} .es-foot", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "sine.out" }, ${n2(t + 0.9)});`);
    genBreathe(`${P} .glow`, t + 0.3, s.end, 1.08);
  }
}

/* ---------- transitions (the transition IS the exit + hard visibility kill) ---------- */
for (const tr of transitions) {
  const F = `#${tr.from}`,
    T = `#${tr.to}`;
  if (tr.type === "zoom") {
    emit(`tl.to("${F}", { scale: 2.4, opacity: 0, filter: "blur(8px)", duration: 0.4, ease: "power3.in" }, ${n2(tr.at)});`);
    emit(
      `tl.fromTo("${T}", { scale: 0.55, opacity: 0, filter: "blur(8px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.45, ease: "power3.out" }, ${n2(tr.at + 0.15)});`
    );
    emit(`tl.set("${F}", { visibility: "hidden" }, ${n2(tr.at + 0.7)});`);
  } else if (tr.type === "blur") {
    emit(`tl.to("${F}", { filter: "blur(10px)", scale: 1.03, opacity: 0, duration: 0.5, ease: "power2.inOut" }, ${n2(tr.at)});`);
    emit(
      `tl.fromTo("${T}", { filter: "blur(10px)", scale: 0.97, opacity: 0 }, { filter: "blur(0px)", scale: 1, opacity: 1, duration: 0.5, ease: "power2.inOut" }, ${n2(tr.at + 0.1)});`
    );
    emit(`tl.set("${F}", { visibility: "hidden" }, ${n2(tr.at + 0.8)});`);
  } else {
    emit(`tl.set("${T}", { opacity: 1 }, ${n2(tr.at)});`);
    // opacity 0 as well: a child that was tweened to visibility:"visible" (pause card, terminal lines,
    // VARIABLES rows) ignores its parent's visibility:hidden and would leak into later scenes
    emit(`tl.set("${F}", { opacity: 0, visibility: "hidden" }, ${n2(tr.at + 0.02)});`);
  }
}

/* ---------- final fade (the one allowed exit) ---------- */
if (fadeOut) {
  const last = scenes[scenes.length - 1];
  emit(`tl.to("#${last.id}", { opacity: 0, duration: 0.7, ease: "power1.in" }, ${n2(duration - 0.8)});`);
  emit(`tl.set("#${last.id}", { visibility: "hidden" }, ${n2(duration - 0.05)});`);
}

/* ---------- audio tags ---------- */
const audioHTML = beats
  .map((b, i) => {
    if (!b.wav) return null; // silent brand scene
    const dur = Math.floor(b.audioDur * 100) / 100;
    return `<audio id="vo${i + 1}" data-start="${b.audioAt.toFixed(2)}" data-duration="${dur.toFixed(2)}" data-track-index="2" src="${b.wav}"></audio>`;
  })
  .filter(Boolean)
  .join("\n      ");

/* ---------- captions ---------- */
const capHTML = [];
const capData = [];
const capText = new Map(); // caption group id -> its words (timeline.json, for the .srt)
if (spec.captions !== false) {
  beats.forEach((b, bi) => {
    if (!b.words?.length) return;
    const words = applyFixes(b.words, spec.captionFixes);
    // groups: one per sentence when it fits (≤ 38 chars, ≤ 7 words); a longer sentence is cut into balanced
    // pieces, preferring a comma and never right after a word that leads into the next one ("would / show",
    // "doesn't / match", "the / real" read badly; EDITOR round 6 caught "show up / red" and "bit / for bit")
    const groups = [];
    const LEAD = new Set("the a an to of in on at for with by from into and or but that which who whose is are was were be been would will can could should may might must do does did doesn't don't didn't can't won't isn't aren't it's its your my our their his her this these those than then as if so not no very just because while when where since until after before about like through over under what how why".split(" "));
    const bare = (t) => t.toLowerCase().replace(/[^a-z']/g, "");
    // best partition of a sentence (dynamic programming): every piece ≤ 38 chars and ≤ 7 words when possible, no
    // one-word piece, balanced lengths, a comma is a good place to break, a lead-in word ("the", "would") is not
    const cut = (ws) => {
      const len = (a, b) => ws.slice(a, b).reduce((n, w) => n + w.text.length + 1, 0);
      if (ws.length <= 7 && len(0, ws.length) <= 38) return [ws];
      const N = ws.length, avg = len(0, N) / Math.max(Math.ceil(len(0, N) / 38), Math.ceil(N / 7));
      const best = new Array(N + 1).fill(Infinity), from = new Array(N + 1).fill(0);
      best[0] = 0;
      for (let b = 1; b <= N; b++)
        for (let a = Math.max(0, b - 7); a < b; a++) {
          const L = len(a, b);
          let c = best[a] + 8 + (L > 38 ? (L - 38) * 15 + (L > 44 ? 500 : 0) : 0) + (b - a === 1 ? 500 : 0) + ((L - avg) * (L - avg)) / 40;
          if (b < N) c += (/,$/.test(ws[b - 1].text) ? -10 : 0) + (LEAD.has(bare(ws[b - 1].text)) && !/[,;:]$/.test(ws[b - 1].text) ? 30 : 0)
            + (/^(VS Code|Command S|Control S|Cmd \+|Ctrl \+|[Pp]ort \d|[Ll]ine \d|[Ss]tep \w|Python \d|Module \d|Lab \d)/.test(`${ws[b - 1].text} ${ws[b].text}`) ? 40 : 0); // never split a compound
          if (c < best[b]) { best[b] = c; from[b] = a; }
        }
      const out = [];
      for (let b = N; b > 0; b = from[b]) out.unshift(ws.slice(from[b], b));
      return out;
    };
    let sent = [];
    for (const w of words) {
      sent.push(w);
      if (/[.!?]$/.test(w.text)) { groups.push(...cut(sent)); sent = []; }
    }
    if (sent.length) groups.push(...cut(sent));
    // readability floor: every caption group stays up ≥ 0.8 s. When Whisper squashes a stretch
    // (6.6 tr5: "and high three." got 0.07 s), push the next group's start later.
    const MIN_GROUP = 0.8;
    for (let gi = 1; gi < groups.length; gi++) {
      const minStart = groups[gi - 1][0].start + MIN_GROUP;
      if (groups[gi][0].start < minStart) {
        const shift = minStart - groups[gi][0].start;
        for (const w of groups[gi]) { w.start = +(w.start + shift).toFixed(2); w.end = +Math.max(w.end, w.start + 0.05).toFixed(2); }
      }
    }
    groups.forEach((grp, gi) => {
      const gid = `cap-${bi}-${gi}`;
      const spans = grp
        .map((w, wi) => `<span id="${gid}-w${wi}">${esc(w.text)}</span>`)
        .join(" ");
      capHTML.push(`<div class="cap-g" id="${gid}">${spans}</div>`);
      const next = groups[gi + 1];
      const start = +(b.audioAt + grp[0].start - 0.05).toFixed(2);
      // hide STRICTLY before the next group shows (next shows at next.start-0.05) —
      // and keep the final group short of the next beat's first caption
      const end = next
        ? +(b.audioAt + next[0].start - 0.08).toFixed(2)
        : Math.min(+(b.audioAt + grp[grp.length - 1].end + 0.7).toFixed(2), duration - 0.1);
      capText.set(gid, grp.map((w) => w.text).join(" "));
      capData.push({
        id: gid,
        start: Math.max(0, start),
        end,
        words: grp.map((w, wi) => ({ id: `${gid}-w${wi}`, t: +(b.audioAt + w.start).toFixed(2) })),
      });
    });
  });
}

/* ---------- DEMO_DATA + injection ---------- */
// one caption on screen at a time: a beat's last caption must end before the next beat's first one
// starts (6.6 round 3: two boundary captions drew on top of each other)
capData.sort((a, b) => a.start - b.start);
for (let i = 0; i < capData.length - 1; i++)
  if (capData[i].end > capData[i + 1].start - 0.03) capData[i].end = +(capData[i + 1].start - 0.03).toFixed(2);
for (const c of capData) for (const w of c.words) if (w.t > c.end - 0.05) w.t = +Math.max(c.start, c.end - 0.05).toFixed(2);
// burnCaptions: false (for YouTube, where the uploaded CC track carries the captions)
// keeps capData / capText / timeline.json's captions as they are (finish-lab.mjs makes the .srt from timeline.json) and
// drops only the burned layer: no caption HTML and no caption tl.sets. (captions: false would empty the .srt too.)
const burnCaps = spec.burnCaptions !== false;
const DEMO_DATA = { typing: typingData, captions: burnCaps ? capData : [], status: statusData, minimap: minimapData, mmBg: THEME("editor-background").replace("#", "") };

if (!printOnly) {
  // .src extension keeps hyperframes lint/inspect from discovering it as a second root composition
  const tplPath = existsSync(resolve("template.html.src")) ? resolve("template.html.src") : resolve("template.html");
  if (!existsSync(tplPath)) fail("template.html.src not found in project root — copy it from the skill's assets/");
  let html = readFileSync(tplPath, "utf8");
  // replaceAll + function-replacements: plain .replace() only hits the FIRST occurrence
  // and treats $-patterns in the replacement string specially
  html = html.replaceAll("__DURATION__", duration.toFixed(2));
  // Brand: "neutral" (default) uses the theme built into template.html.src. Anything else is a brand.json
  // (see findBrandJson: a path, $BRANDS_DIR/<id>/, or brands/<id>/ above the project) whose video.code_theme
  // overrides the template's color variables (bg, accentA, accentB, inkHi, inkMid, inkMeta, glowA, glowA0, glowB, glowB0).
  const brandId = spec.branding || "neutral";
  let brandClass = "";
  if (brandId !== "neutral") {
    const brandJson = findBrandJson(brandId);
    if (!brandJson) fail(`branding "${brandId}": no brand.json found (a path, $BRANDS_DIR/${brandId}/brand.json, or brands/${brandId}/brand.json above the project)`);
    const theme = JSON.parse(readFileSync(brandJson, "utf8")).video?.code_theme;
    if (!theme) fail(`branding "${brandId}": brand.json has no video.code_theme`);
    brandClass = `brand-${(brandId.replace(/[\\/]brand\.json$/i, "").replace(/\.json$/i, "").split(/[\\/]/).filter(Boolean).pop() || "custom").replace(/[^A-Za-z0-9_-]/g, "-")}`;
    const vars = Object.entries(theme).map(([k, v]) => `--${k}: ${v};`).join(" ");
    html = html.replace("</head>", () => `    <style>body.${brandClass} { ${vars} }</style>\n  </head>`);
  }
  // brand scenes use the brand's own display and code fonts when brandArt() found them
  const fontFaces = [["display", "BrandDisplay", "900"], ["mono", "BrandMono", "100 800"]]
    .filter(([k]) => BRAND_ART?.[k])
    .map(([k, fam, w]) => `@font-face { font-family: "${fam}"; src: url("fonts/brand-${k}.woff2") format("woff2"); font-weight: ${w}; font-display: block; }`);
  if (fontFaces.length) html = html.replace("</head>", () => `    <style>${fontFaces.join(" ")}</style>\n  </head>`);
  html = html.replaceAll('class="__BRAND__"', brandClass ? `class="${brandClass}"` : 'class=""');
  html = html.replace("<!--__AUDIO__-->", () => audioHTML);
  html = html.replace("<!--__SCENES__-->", () => sceneHTML);
  // real-token colors used anywhere (code, minimap, prefill): .c-RRGGBB / .c-RRGGBB-i
  const colorCSS = [...new Set([...sceneHTML.matchAll(/\bc-([0-9a-f]{6})(-i)?\b/g), ...JSON.stringify(typingData).matchAll(/\bc-([0-9a-f]{6})(-i)?\b/g)].map((m) => m[0]))]
    .map((c) => `.${c} { color: #${c.slice(2, 8)};${c.endsWith("-i") ? " font-style: italic;" : ""} }`).join("\n");
  // a smaller font or a wider window: the window's CSS variables, and (wider window) the labels over its corners and
  // the compare scene's real capture follow the window's left edge. Nothing for the default 14 / 14 / 850 window.
  const L = GEOM.left, W2 = 2 * GEOM.width;
  const geomRules = geomCSS(GEOM) + (GEOM.width === 850 ? "" : [
    `.ed-label { left: ${L + 10}px; } .ed-label-r { right: ${L + 10}px; }`,
    `.cmp-real, .cmp-seam, .cmp-heat { left: ${L}px; } .cmp-real { width: ${GEOM.width}px; } .cmp-real-in, .cmp-real img, .cmp-heat, .cmp-heat img { width: ${W2}px; }`,
  ].join("\n") + "\n");
  html = html.replace("/*__VSCODE_CSS__*/", () => VSC_CSS + "\n" + geomRules + colorCSS);
  html = html.replace("__MINIMAP_ATLAS__", () => readFileSync(VSC_MOD.replace(/vscode-window\.mjs$/, "minimap-atlas-2x.hex"), "utf8").trim());
  html = html.replace("<!--__CAPTIONS__-->", () => (burnCaps ? capHTML.join("\n        ") : ""));
  html = html.replace("/*__DEMO_DATA__*/ null", () => JSON.stringify(DEMO_DATA));
  html = html.replace("/*__TIMELINE__*/", () => J.join("\n").trimStart());
  writeFileSync("index.html", html);
  // timeline.json: what finish-lab.mjs needs for YouTube (the .srt captions and the chapters), straight from this build
  writeFileSync("timeline.json", JSON.stringify({
    duration: +duration.toFixed(2),
    beats: beats.map((b) => ({ id: b.id, scene: b.scene, start: +b.start.toFixed(2), end: +b.end.toFixed(2), ...(b.chapter ? { chapter: b.chapter } : {}) })),
    captions: capData.map((c) => ({ start: c.start, end: c.end, text: capText.get(c.id) })),
  }, null, 1) + "\n");
}

/* ---------- beat map ---------- */
console.log(`\n${spec.id || "demo"} — ${duration.toFixed(1)}s total, ${beats.length} beats, ${scenes.length} scenes${clipMode ? " (clipMode)" : ""}\n`);
console.log("idx  beat            scene    start   audio   end     mid(inspect)");
beats.forEach((b, i) => {
  console.log(
    `${String(i + 1).padEnd(4)} ${b.id.padEnd(15)} ${b.scene.padEnd(8)} ${b.start.toFixed(1).padStart(6)} ${b.audioDur
      .toFixed(1)
      .padStart(6)} ${b.end.toFixed(1).padStart(6)}  ${((b.start + b.end) / 2).toFixed(1)}`
  );
});
const inspectTimes = beats.map((b) => ((b.start + b.end) / 2).toFixed(1)).join(",");
console.log(`\ninspect: npx hyperframes inspect --at ${inspectTimes}`);
console.log(`frames:  for t in ${beats.map((b) => ((b.start + b.end) / 2).toFixed(1)).join(" ")}; do ffmpeg -y -v error -ss $t -i renders/OUT.mp4 -frames:v 1 /tmp/f$t.png; done`);
if (warns.length) {
  console.log("\nWARNINGS:");
  warns.forEach((w) => console.log("  ⚠ " + w));
}
if (!printOnly) console.log("\n✓ index.html written");
