// qa-editor.mjs — the automated half of the EDITOR step (see EDITOR.md for the human/agent half).
// Run after the render:  node qa-editor.mjs [renders/<file>.mp4]
// Writes qa/editor-report.md + qa/editor-report.json and contact sheets in qa/sheets/.
// Exit code 1 if any FAIL. WARN items must be looked at by the editor reviewer, not ignored.
//
// Checks
//  1 code      every typed / prefilled / pasted line on screen == CODE[line] (tokenizer round trip)
//  2 program   CODE written to the program file; it compiles; pycodestyle clean (real categories)
//  3 terminal  every term-out block == the REAL program output for that run's stdin
//  4 speech    Whisper transcript vs narration script, per beat: dropped / changed words
//  5 spelling  caption words and OCR'd frame text: near-misses of code/narration vocabulary
//              (e.g. "Helo" for "Hello") that are not real words → FAIL
//  6 sheets    end-of-beat + mid-beat frames from the actual mp4 → qa/sheets/*.jpg for the reviewer
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import spec, { CODE } from "./demo.spec.mjs";
import { codeText, norm, programFiles } from "./lab-helpers.mjs";

const mp4 = process.argv[2] || fs.readdirSync("renders").filter((f) => f.endsWith(".mp4")).map((f) => "renders/" + f).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
const results = []; // {check, level: PASS|WARN|FAIL, msg}
const add = (check, level, msg) => results.push({ check, level, msg });
fs.mkdirSync("qa/sheets", { recursive: true });
fs.mkdirSync("qa/frames", { recursive: true });

// ---------------------------------------------------------------- 0 freshness: render ← build ← spec
// (6.6 extended round 3: a spec change never reached the video because the build wasn't re-run)
{
  const m = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);
  const srcNewest = Math.max(m("demo.spec.mjs"), m("lab-helpers.mjs"), m("build-demo.mjs"), m("template.html.src"), ...fs.readdirSync("audio").filter((f) => /^vo-/.test(f)).map((f) => m("audio/" + f)));
  if (m("index.html") < srcNewest) add("freshness", "FAIL", "index.html is older than the spec/audio/build: run `node build-demo.mjs`, then re-render");
  else if (mp4 && fs.existsSync(mp4) && m(mp4) < m("index.html")) add("freshness", "FAIL", `${mp4} is older than index.html: the video doesn't contain the latest build, so re-render it`);
  else add("freshness", "PASS", "the video was rendered from the latest build of the latest spec");
}

// ---------------------------------------------------------------- 1 code on screen == CODE
let codeIssues = 0;
for (const b of spec.beats) {
  const check = (line, segs, where) => {
    const txt = segs.map((s) => s[1]).join("");
    if (txt !== CODE[line]) {
      codeIssues++;
      add("code", "FAIL", `beat ${b.id} ${where} line ${line}: on screen "${txt}" but CODE has "${CODE[line]}"`);
    }
  };
  for (const p of b.prefill || []) check(p.line, p.segs, "prefill");
  for (const a of b.actions || []) {
    if (a.do === "type") check(a.line, a.segs, "type");
    if (a.do === "paste") for (const p of a.lines) check(p.line, p.segs, "paste");
  }
}
if (!codeIssues) add("code", "PASS", "every typed, prefilled and pasted line matches CODE exactly");

// ---------------------------------------------------------------- 2 program file + PEP 8
// multi-file labs (7.6): spec.files = [{ name, base }] → one program file per range of CODE
const progs = spec.files ? programFiles(spec.files) : [{ name: spec.qa?.program || spec.file.name, from: 1, to: Infinity }];
const prog = spec.qa?.program || progs[progs.length - 1].name; // default run target
// the course's Python: the outputs on screen are 3.15.0's, and Homebrew's python3 is 3.14 (QA_PY overrides)
const QA_PY = process.env.QA_PY || (fs.existsSync("/usr/local/bin/python3.15") ? "/usr/local/bin/python3.15" : "python3");
const TRIVIAL = /^(E265|E261|E262|E712|W291|W293|W292|W391|E303|W605)$/;
for (const p of progs) {
  fs.writeFileSync(p.name, codeText(CODE, p.from, p.to));
  const comp = spawnSync("python3", ["-m", "py_compile", p.name], { encoding: "utf8" });
  add("program", comp.status === 0 ? "PASS" : "FAIL", comp.status === 0 ? `${p.name} compiles` : `${p.name} does not compile: ${comp.stderr}`);
  const pcs = [process.env.PYCODESTYLE_PY, "python3"].filter(Boolean).map((py) => spawnSync(py, ["-m", "pycodestyle", p.name], { encoding: "utf8" })).find((r) => r.status !== null && !/No module named/.test(r.stderr || ""));
  if (!pcs) add("program", "WARN", "pycodestyle not available — set PYCODESTYLE_PY to a python that has it");
  else {
    const real = (pcs.stdout || "").split("\n").filter(Boolean).filter((l) => !TRIVIAL.test((l.split(": ")[1] || "").split(" ")[0]));
    add("program", real.length ? "FAIL" : "PASS", real.length ? `PEP 8 (${p.name}): ` + real.join(" | ") : `${p.name}: PEP 8 clean (real categories)`);
  }
}

// ---------------------------------------------------------------- 3 terminal output == real run
const beatsByScene = []; // group consecutive editor beats that share a terminal the same way the build does
let runs = 0;
for (let i = 0; i < spec.beats.length; i++) {
  const b = spec.beats[i];
  const acts = b.actions || [];
  for (let k = 0; k < acts.length; k++) {
    const a = acts[k];
    if (a.do !== "term-out") continue;
    runs++;
    if (a.noVerify) { add("terminal", "PASS", `beat ${b.id}: banner/static output (not a program run): ${a.lines[0]}`); continue; }
    if (a.repl) {
      // Python shell demo: re-run the whole session in the real interpreter and compare
      const { replOutputs } = await import("./lab-helpers.mjs");
      const real = replOutputs(a.repl).pop();
      const shown = a.lines.join("\n");
      add("terminal", real === shown ? "PASS" : "FAIL", real === shown
        ? `beat ${b.id}: >>> ${a.repl[a.repl.length - 1]}  → matches real Python`
        : `beat ${b.id}: >>> ${a.repl[a.repl.length - 1]}  shown "${shown}" but Python prints "${real}"`);
      continue;
    }
    // stdin = every answer typed at the program's input() prompts (term-types with a prompt override) since the shell
    // command that started this run, in order (lesson 05: one run asks two questions)
    const answers = [];
    scan: for (let bi = i; bi >= 0 && bi > i - 3; bi--) {
      const list = (spec.beats[bi].actions || []).slice(0, bi === i ? k : undefined).reverse();
      for (const x of list) {
        if (x.do !== "term-type") continue;
        if (x.prompt === undefined) break scan; // the shell command: the run starts here
        answers.unshift(x);
      }
    }
    const stdin = answers.map((t) => t.text + "\n").join("");
    const prompts = answers.map((t) => t.prompt);
    // which file ran: the latest typed shell command "python3 <file>.py" before this output (7.6: two programs)
    let runFile = prog;
    for (let bi = i; bi >= 0; bi--) {
      const list = (spec.beats[bi].actions || []).slice(0, bi === i ? k : undefined).reverse();
      const cmd = list.find((x) => x.do === "term-type" && x.prompt === undefined && /^python3? \S+\.py$/.test(x.text || ""));
      if (cmd) { runFile = cmd.text.split(" ")[1]; break; }
    }
    // a file that grows during the lesson (lesson 04: run1 runs lines 1-7, the reveal 1-12) is run as it was on
    // screen at that moment: lines 1..upTo when the term-out says so (lessons 05, 06), else CODE up to the highest
    // line prefilled or typed since the scene began
    let runPath = runFile;
    if (runFile === prog && (spec.files || []).length <= 1) {
      let hi = a.upTo || 0;
      if (!hi) for (let bi = i; bi >= 0; bi--) {
        const bb = spec.beats[bi];
        for (const p of bb.prefill || []) hi = Math.max(hi, p.line);
        for (const x of (bb.actions || []).slice(0, bi === i ? k : undefined)) if (x.do === "type") hi = Math.max(hi, x.line);
        if (bb.prefill || bb.fileCreate) break;
      }
      if (hi) { runPath = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "qa-run-")), runFile); fs.writeFileSync(runPath, codeText(CODE, 1, hi)); }
    }
    const r = spawnSync(QA_PY, [runPath], { input: stdin, encoding: "utf8" });
    let out = r.stdout;
    for (const pr of prompts) if (out.startsWith(pr)) out = out.slice(pr.length);
    const actual = out.replace(/\n$/, "").split("\n");
    const shown = a.lines;
    const same = actual.length === shown.length && actual.every((l, j) => l === shown[j]);
    if (same) add("terminal", "PASS", `beat ${b.id}: python3 ${runFile}${runPath !== runFile ? " (as it was on screen)" : ""} output (${shown.length} lines${answers.length ? `, input ${answers.map((t) => `"${t.text}"`).join(", ")}` : ""}) matches the real run`);
    else {
      const j = shown.findIndex((l, x) => l !== actual[x]);
      add("terminal", "FAIL", `beat ${b.id}: shown output differs from the real run at line ${j + 1}: shown "${shown[j]}" vs real "${actual[j]}" (${shown.length} vs ${actual.length} lines)`);
    }
  }
}
if (!runs) add("terminal", "WARN", "no term-out blocks found");
// REPL order: what Python ran (a.repl history) must be exactly the >>> lines shown on screen, in the order
// they're typed (6.6 extended: a loop ran before the line that defined its dict → NameError on screen)
{
  const typed = []; // {key, text} in on-screen order; a "python3" command starts a fresh session
  let session = 0, orderIssues = 0, checked = 0;
  spec.beats.forEach((b, bi) => {
    const acts = (b.actions || []).map((a, k) => ({ a, k })).sort((x, y) => (+x.a.at || 0) - (+y.a.at || 0) || x.k - y.k);
    for (const { a } of acts) {
      if (a.do === "term-type" && a.prompt === undefined && /^python3?$/.test(a.text)) { session++; typed.length = 0; }
      if (a.do === "term-type" && a.prompt === ">>> " && a.text) typed.push(a.text);
      // a typed "... " line continues the block above it (RB multi-line for/if blocks, 5.6 extended)
      if (a.do === "term-type" && a.prompt === "... " && a.text && typed.length) typed[typed.length - 1] += "\n" + a.text;
      if (a.do === "term-out" && a.repl) {
        checked++;
        const want = typed.slice(-a.repl.length);
        if (JSON.stringify(want) !== JSON.stringify(a.repl)) {
          orderIssues++;
          add("terminal", "FAIL", `beat ${b.id}: Python ran [${a.repl.join(" | ")}] but the screen shows [${want.join(" | ")}] — statements run out of on-screen order`);
        }
      }
    }
  });
  if (checked && !orderIssues) add("terminal", "PASS", `${checked} shell outputs: Python ran exactly the lines shown, in on-screen order`);
}

// ---------------------------------------------------------------- 4 speech: transcript vs script
const lcsDiff = (a, b) => {
  const m = a.length, n = b.length, dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) i++, j++;
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push(["-", a[i++]]);
    else ops.push(["+", b[j++]]);
  }
  while (i < m) ops.push(["-", a[i++]]);
  while (j < n) ops.push(["+", b[j++]]);
  return ops;
};
// glue split forms so "e l l o" == "ello", an IP == "10 dot 0 dot 0 dot 5", "pw" == "p w"
const squash = (ws) => ws.filter((w) => w !== "dot" && w !== "underscore").join("").replace(/'/g, "");
// spoken numbers → digits so "twenty five" == "25", "thirteenth" == "13th", "two seventy" == "270"
const UNITS = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9 };
const TEENS = { 10: 10, 11: 11, 12: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const ORD = { first: "1st", second: "2nd", third: "3rd", fourth: "4th", fifth: "5th", thirteenth: "13th", twentieth: "20th" };
function numberize(ws) {
  const out = [];
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (ORD[w]) { out.push(ORD[w]); continue; }
    if (w in TENS) {
      let v = TENS[w];
      if (ws[i + 1] in UNITS && ws[i + 1] !== "0") v += UNITS[ws[++i]];
      // "two seventy" → 270
      if (out.length && /^[1-9]$/.test(out[out.length - 1])) out.push(String(+out.pop() * 100 + v));
      else out.push(String(v));
      continue;
    }
    if (w in TEENS) { out.push(String(TEENS[w])); continue; }
    out.push(w);
  }
  return out;
}
spec.beats.forEach((b, i) => {
  const nn = String(i + 1).padStart(2, "0");
  const f = `audio/vo-${nn}-${b.id}.json`;
  if (!fs.existsSync(f)) return add("speech", "FAIL", `beat ${b.id}: no transcript ${f}`);
  const heard = JSON.parse(fs.readFileSync(f, "utf8")).map((w) => w.text).join(" ");
  const said = numberize(norm(b.narration.replace(/"/g, ""))), got = numberize(norm(heard));
  if (squash(said) === squash(got)) return;
  const ops = lcsDiff(said, got);
  // collapse runs, then drop pairs that only differ by spacing/respelling
  const groups = [];
  let cur = null;
  for (const [op, w] of ops) {
    if (!cur) cur = { del: [], ins: [] };
    (op === "-" ? cur.del : cur.ins).push(w);
    if (op === "+" ) { groups.push(cur); cur = null; }
  }
  if (cur) groups.push(cur);
  const real = groups.filter((g) => squash(g.del) !== squash(g.ins));
  if (real.length)
    add("speech", "WARN", `beat ${b.id}: script vs heard → ${real.slice(0, 6).map((g) => `"${g.del.join(" ")}"→"${g.ins.join(" ")}"`).join(", ")}${real.length > 6 ? " …" : ""}`);
});

// ---------------------------------------------------------------- 5 spelling near-misses
const dict = new Set(fs.existsSync("/usr/share/dict/words") ? fs.readFileSync("/usr/share/dict/words", "utf8").toLowerCase().split("\n") : []);
const vocab = new Set();
const addWords = (s) => (s.match(/[A-Za-z][A-Za-z0-9_]{2,}/g) || []).forEach((w) => vocab.add(w.toLowerCase()));
Object.values(CODE).forEach(addWords);
[spec.file.name, spec.file.folder, spec.course, spec.module, spec.title?.hero, spec.title?.accent, spec.title?.sub, spec.statusRight, spec.terminalPrompt].filter(Boolean).forEach((x) => { addWords(x); vocab.add(String(x).toLowerCase().replace(/[^a-z0-9]/g, "")); });
spec.beats.forEach((b) => { addWords(b.narration); if (b.doc) addWords(b.doc.body.replace(/<[^>]+>/g, " ")); (b.checklist || []).forEach(addWords); addWords(b.task || ""); addWords(b.hint || ""); });
// code typed in the shell, and the on-screen forms the caption fixes produce, are real words too (7.6: ipaddress.ip_address)
spec.beats.forEach((b) => (b.actions || []).forEach((a) => { if (a.do === "term-type" && a.text) { addWords(a.text); vocab.add(a.text.toLowerCase().replace(/[^a-z0-9]/g, "")); } }));
(spec.captionFixes || []).forEach(([, to]) => { addWords(to); vocab.add(to.toLowerCase().replace(/[^a-z0-9]/g, "")); });
const lev1 = (a, b) => {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return e + (a.length - i) + (b.length - j) === 1;
};
const nearMiss = (w) => {
  const lw = w.toLowerCase();
  if (lw.length < 4 || vocab.has(lw) || dict.has(lw) || dict.has(lw.replace(/s$/, ""))) return null;
  for (const v of vocab) if (v.length >= 4 && lev1(lw, v)) return v;
  return null;
};
// captions as built
const html = fs.readFileSync("index.html", "utf8");
let capWords = [...html.matchAll(/id="cap-(\d+)-\d+-w\d+">([^<]*)</g)].map((m) => ({ beat: +m[1], w: m[2] }));
// no burned captions (burnCaptions: false; YouTube's CC track carries them): the caption words and timings come from
// timeline.json, which is what finish-lab.mjs turns into final/<folder>.srt, so the checks run on the CC track's words
const TL = fs.existsSync("timeline.json") ? JSON.parse(fs.readFileSync("timeline.json", "utf8")) : null;
const fromTimeline = !capWords.length && !!TL?.captions?.length;
if (fromTimeline) {
  const beatAt = (t) => Math.max(0, TL.beats.findIndex((bb) => t >= bb.start && t < bb.end));
  capWords = TL.captions.flatMap((c) => c.text.split(/\s+/).filter(Boolean).map((w) => ({ beat: beatAt(c.start), w })));
}
let capHits = 0;
for (const { beat, w } of capWords) {
  for (const tok of w.match(/[A-Za-z][A-Za-z0-9_]{3,}/g) || []) {
    const v = nearMiss(tok);
    if (v) { capHits++; add("spelling", "FAIL", `caption in beat ${spec.beats[beat]?.id}: "${w}" looks like a misspelling of "${v}"`); }
  }
}
// case check: a caption that capitalizes a token the narration says in lowercase on purpose (e.g. lowercase copy)
if (!capHits) add("spelling", "PASS", `${capWords.length} caption words${fromTimeline ? " (the CC track: timeline.json, no burned captions)" : ""}: no near-miss misspellings`);
// caption readability: every group on screen ≥ 0.7 s (6.6 round 2: "and high three." flashed for 2 frames)
{
  // with no burned captions DEMO_DATA has "captions":[] (the lazy match would run on into the minimap's data)
  const m = html.match(/"captions":(\[\](?=,)|\[.*?\}\]\}\])/);
  let caps = m ? JSON.parse(m[1]) : [];
  if (!caps.length && fromTimeline) caps = TL.captions.map((c, i) => ({ id: `cue ${i + 1} "${c.text}"`, start: c.start, end: c.end }));
  const short = caps.filter((c) => c.end - c.start < 0.7);
  if (!caps.length) add("captions", "WARN", "could not read caption timings from index.html");
  else if (short.length) short.forEach((c) => add("captions", "FAIL", `caption ${c.id} on screen only ${(c.end - c.start).toFixed(2)} s at ${c.start}s`));
  else add("captions", "PASS", `${caps.length} caption groups${fromTimeline ? " (CC track cues, timeline.json)" : ""}, all on screen ≥ 0.7 s`);
  const sorted = [...caps].sort((a, b) => a.start - b.start);
  const overl = sorted.filter((c, i) => i && sorted[i - 1].end > c.start);
  if (overl.length) overl.forEach((c) => add("captions", "FAIL", `caption ${c.id} at ${c.start}s starts before the previous caption ends — two lines on screen at once`));
  else if (caps.length) add("captions", "PASS", "no two captions on screen at the same time");
  // captions must not trail the voice: each beat's last word ≤ its speech end (+0.4 s)
  let late = 0;
  spec.beats.forEach((b, i) => {
    const nn = String(i + 1).padStart(2, "0");
    const wav = `audio/vo-${nn}-${b.id}.wav`, js = `audio/vo-${nn}-${b.id}.json`;
    if (!fs.existsSync(wav) || !fs.existsSync(js)) return;
    const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]).toString());
    const r = spawnSync("ffmpeg", ["-i", wav, "-af", "silencedetect=n=-35dB:d=0.2", "-f", "null", "-"], { encoding: "utf8" });
    const err = r.stderr || "";
    const sts = [...err.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
    const ens = [...err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
    const trailing = sts.length && (ens.length < sts.length || ens[ens.length - 1] >= dur - 0.05);
    const speechEnd = trailing ? sts[sts.length - 1] : dur;
    const w = JSON.parse(fs.readFileSync(js, "utf8"));
    const lastStart = w.length ? w[w.length - 1].start : 0;
    if (lastStart > speechEnd + 0.4) { late++; add("captions", "WARN", `beat ${b.id}: transcript's last word starts at ${lastStart}s but speech ends at ${speechEnd.toFixed(2)}s — the build rescales it; better: re-transcribe this beat with --model medium.en`); }
  });
  if (!late) add("captions", "PASS", "every beat's transcript ends inside its speech (captions don't trail the voice)");
}

// ---------------------------------------------------------------- 6 frames: OCR + contact sheets
if (!mp4 || !fs.existsSync(mp4)) add("frames", "FAIL", "no rendered mp4 found — render before running the editor step");
else {
  const map = execFileSync("node", ["build-demo.mjs", "--print-map"], { encoding: "utf8" }); // print-only: never rewrite index.html after the render
  const rows = map.split("\n").filter((l) => /^\d+\s+\S+\s+\S+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+$/.test(l.trim())).map((l) => l.trim().split(/\s+/));
  const shots = [];
  for (const [idx, id, scene, start, , end] of rows) {
    const s = +start, e = +end;
    shots.push({ id, t: +((s + e) / 2).toFixed(1), tag: "mid" }, { id, t: +(e - 0.8).toFixed(1), tag: "end" });
  }
  let ocrHits = 0;
  const ocrSeen = {};
  const tess = spawnSync("tesseract", ["--version"]).status === 0;
  shots.forEach((sh, k) => {
    const png = `qa/frames/${String(k).padStart(3, "0")}-${sh.id}-${sh.tag}-${sh.t}s.png`;
    spawnSync("ffmpeg", ["-y", "-v", "error", "-ss", String(sh.t), "-i", mp4, "-frames:v", "1", png]);
    sh.png = png;
    if (!tess) return;
    const txt = spawnSync("tesseract", [png, "-", "--psm", "11"], { encoding: "utf8" }).stdout || "";
    for (const tok of new Set(txt.match(/[A-Za-z][A-Za-z0-9_]{3,}/g) || [])) {
      const v = nearMiss(tok);
      // OCR is noisy: only flag near-misses of words that are actually code tokens or narration words ≥5 chars
      if (v && v.length >= 5) { ocrHits++; (ocrSeen[tok] ||= { v, pngs: [] }).pngs.push(png); }
    }
  });
  for (const [tok, o] of Object.entries(ocrSeen))
    add("ocr", "WARN", `OCR read "${tok}" (near "${o.v}") in ${o.pngs.length} frame(s): ${o.pngs.slice(0, 4).join(", ")}${o.pngs.length > 4 ? " …" : ""} — look at the frame`);
  if (!tess) add("ocr", "WARN", "tesseract not installed — OCR skipped");
  else if (!ocrHits) add("ocr", "PASS", `${shots.length} frames OCR'd: no near-miss misspellings`);
  // contact sheets: 3x3 per sheet, labelled
  const pngs = shots.map((s) => s.png);
  for (let s = 0; s * 9 < pngs.length; s++) {
    const list = pngs.slice(s * 9, s * 9 + 9);
    const args = ["-y", "-v", "error"];
    list.forEach((p) => args.push("-i", p));
    const filt = list.map((p, i) => `[${i}:v]scale=640:-1,drawtext=text='${path.basename(p, ".png").replace(/[:']/g, "")}':x=8:y=8:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.7[v${i}]`).join(";") +
      ";" + list.map((_, i) => `[v${i}]`).join("") + `xstack=inputs=${list.length}:layout=${list.map((_, i) => `${(i % 3) * 640}_${Math.floor(i / 3) * 360}`).join("|")}:fill=black[out]`;
    if (list.length === 1) spawnSync("ffmpeg", [...args, "-vf", "scale=640:-1", `qa/sheets/sheet-${String(s + 1).padStart(2, "0")}.jpg`]);
    else spawnSync("ffmpeg", [...args, "-filter_complex", filt, "-map", "[out]", "-frames:v", "1", `qa/sheets/sheet-${String(s + 1).padStart(2, "0")}.jpg`]);
  }
  add("frames", "PASS", `${shots.length} frames → qa/frames, ${Math.ceil(pngs.length / 9)} contact sheets → qa/sheets`);
}

// ---------------------------------------------------------------- words (narration lint + script review, engine/qa)
// AI tells FAIL here too, and the script review must be for the words in the video.
// The lib is qa/lib/narration.cjs (copied by new-lab.sh), else $CODE_DEMO_VIDEO_DIR/engine/qa/ or the installed skill.
{
  const tries = [path.resolve("qa/lib/narration.cjs"), process.env.CODE_DEMO_VIDEO_DIR && path.resolve(process.env.CODE_DEMO_VIDEO_DIR, "engine/qa/narration.cjs"),
    path.resolve(process.env.HOME || "", ".claude/skills/code-demo-video/engine/qa/narration.cjs")].filter(Boolean);
  const lib = tries.find((p) => fs.existsSync(p));
  if (!lib) add("words", "WARN", "engine/qa/narration.cjs not found (copy the skill's engine/qa/ to qa/lib/): narration lint skipped");
  else {
    const r = spawnSync(process.execPath, ["-e", `const w=require(${JSON.stringify(lib)});const n=w.narrationOf(".");console.log(JSON.stringify({lint:w.lint(n),review:w.reviewState(".")}))`], { encoding: "utf8" });
    try {
      const { lint, review } = JSON.parse(r.stdout);
      for (const f of lint.findings) add("words", f.level, `beat ${f.unit}: “${f.quote}” — ${f.rule}`);
      if (!lint.fails) add("words", "PASS", `narration lint: no AI tells (${lint.words} words)`);
      add("words", review.state === "pass" ? "PASS" : "FAIL", review.state === "pass" ? `qa/script-review.md passed these words (narration-sha ${review.sha})`
        : `qa/script-review.md is ${review.state} for the current words (narration-sha ${review.sha}): see the skill's references/script-review.md`);
    } catch { add("words", "WARN", "narration lint failed to run: " + (r.stderr || "").slice(0, 200)); }
  }
}

// ---------------------------------------------------------------- report
const fails = results.filter((r) => r.level === "FAIL").length;
const warns = results.filter((r) => r.level === "WARN").length;
const md = [
  `# Editor QA: ${spec.id}`,
  ``,
  `Video: \`${mp4}\` · ${new Date().toISOString().slice(0, 16)} · **${fails} FAIL, ${warns} WARN**`,
  ``,
  `Automated checks only. The editor reviewer still works through EDITOR.md on qa/sheets/ before delivery.`,
  ``,
  ...["freshness", "words", "code", "program", "terminal", "speech", "spelling", "captions", "ocr", "frames"].flatMap((c) => {
    const rs = results.filter((r) => r.check === c);
    return rs.length ? [`## ${c}`, ...rs.map((r) => `- **${r.level}** ${r.msg}`), ""] : [];
  }),
].join("\n");
fs.writeFileSync("qa/editor-report.md", md);
fs.writeFileSync("qa/editor-report.json", JSON.stringify(results, null, 2));
console.log(md);
process.exit(fails ? 1 : 0);
