// lab-helpers.mjs — shared helpers for lab walkthrough specs (code-demo-video skill).
// A spec does:  const L = createLab(CODE);  L.B({...beat}, (at) => [L.T(5, at("phrase")), ...]);
// then exports default { ..., beats: L.beats } and `export const CODE`.
//
// at("spoken phrase", n=1, off=0) → beat-relative seconds where that phrase is SPOKEN, read from the
// beat's Whisper transcript (audio/vo-NN-<id>.json). Before TTS exists it falls back to a
// words/second estimate, so the spec builds either way. Number words and digits match each other.
import fs from "node:fs";

export const VO = 0.5; // voDelay on every beat: transcript time + VO = beat-relative time
const WPS = 2.75; // fallback estimate before audio exists
export const CPS = 8; // human typing speed

// ---------------------------------------------------------------- real token colors
// qa/vscode-tokens.json (vscode/tools/tokens.mjs) holds every program line exactly as the REAL VS Code
// colors it: TextMate grammar + Pylance semantic tokens + bracket-pair colors. A line found there uses
// those colors (class c-RRGGBB); anything else falls back to the tiny tokenizer below.
const REAL = new Map();
try {
  const j = JSON.parse(fs.readFileSync("qa/vscode-tokens.json", "utf8"));
  for (const f of Object.values(j)) for (const [line, segs] of Object.entries(f)) if (!REAL.has(line)) REAL.set(line, segs);
} catch {}
export const realTokens = () => REAL.size;
export function tok(src) {
  src = src ?? ""; // a blank line that CODE doesn't list (typing it = pressing Enter)
  if (REAL.has(src)) return REAL.get(src).map((s) => [...s]);
  if (REAL.size && src.trim() && !process.env.LAB_QUIET) console.warn(`⚠ no real VS Code colors for: ${src}  (re-run vscode/tools/tokens.mjs)`);
  return py(src);
}

// ---------------------------------------------------------------- tiny Python tokenizer (fallback; Dark 2026 classes)
// classes match the REAL Dark 2026 colors (probed with vscode/tools/tokens.mjs, see template .tok-*):
// kw #c586c0 control · decl #ff7b72 def/class/lambda · const #569cd6 True/False/None + and/or/not/is/in ·
// type #4ec9b0 classes/builtin types/modules · fn #d2a8ff · var #c9d1d9 · op #d4d4d4 · b1-b3 bracket levels
const KW = new Set(["if", "elif", "else", "for", "while", "return", "import", "from", "break", "continue", "try", "except", "with", "as", "assert", "raise", "pass", "finally"]);
const DECL = new Set(["def", "class", "lambda"]);
const CONST = new Set(["True", "False", "None", "and", "or", "not", "is", "in"]);
const TYPES = new Set(["int", "str", "float", "list", "dict", "tuple", "set", "bool", "range"]);
// exception classes are colored as types wherever they appear: except ValueError as err
const EXC = new Set(["ValueError", "TypeError", "KeyError", "IndexError", "ZeroDivisionError", "AssertionError", "Exception"]);
export function py(src, depth0 = 0) {
  const segs = [];
  const push = (c, t) => {
    const last = segs[segs.length - 1];
    if (last && last[0] === c) last[1] += t;
    else segs.push([c, t]);
  };
  let depth = depth0; // bracket-pair colorization: level 1/2/3 cycle by nesting depth
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m;
    if (rest[0] === "#") { push("tok-comment", rest); break; }
    if ((m = rest.match(/^f"[^"]*"/))) {
      // f-string: f prefix like def, string parts tok-str, {expr} braces are brackets, inner expr tokenized
      push("tok-decl", "f");
      const body = m[0].slice(1);
      let j = 0, buf = "";
      while (j < body.length) {
        if (body[j] === "{") {
          if (buf) push("tok-str", buf), (buf = "");
          const close = body.indexOf("}", j);
          const inner = body.slice(j + 1, close);
          const [expr, fmt] = inner.split(/:(?=[^)]*$)/);
          push(`tok-b${(depth % 3) + 1}`, "{");
          for (const s2 of py(expr, depth + 1)) push(s2[0], s2[1]);
          if (fmt !== undefined) push("", ":" + fmt);
          push(`tok-b${(depth % 3) + 1}`, "}");
          j = close + 1;
        } else buf += body[j++];
      }
      if (buf) push("tok-str", buf);
      i += m[0].length;
      continue;
    }
    if ((m = rest.match(/^"[^"]*"|^'[^']*'/))) { push("tok-str", m[0]); i += m[0].length; continue; }
    if ((m = rest.match(/^[A-Za-z_]\w*/))) {
      const w = m[0];
      const after = src.slice(i + w.length);
      push(KW.has(w) ? "tok-kw" : DECL.has(w) ? "tok-decl" : CONST.has(w) ? "tok-const" : EXC.has(w) || TYPES.has(w) || /^[A-Z][a-z]/.test(w) ? "tok-type" : after.startsWith("(") ? "tok-fn" : "tok-var", w);
      i += w.length;
      continue;
    }
    if ((m = rest.match(/^\d+(\.\d+)?/))) { push("tok-num", m[0]); i += m[0].length; continue; }
    if ("([{".includes(rest[0])) { push(`tok-b${(depth % 3) + 1}`, rest[0]); depth++; i++; continue; }
    if (")]}".includes(rest[0])) { depth = Math.max(0, depth - 1); push(`tok-b${(depth % 3) + 1}`, rest[0]); i++; continue; }
    if ((m = rest.match(/^(\*\*|\/\/|[<>=!]=|[+\-*\/%]=|[+\-*\/%<>=])/))) { push("tok-op", m[0]); i += m[0].length; continue; }
    push("", rest[0]);
    i++;
  }
  return segs;
}

// ---------------------------------------------------------------- word sync
const NUMW = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12" };
export const norm = (s) =>
  s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean).map((w) => NUMW[w] || w);
export function syncer(id, narration = "") {
  const f = fs.existsSync("audio") && fs.readdirSync("audio").find((n) => n.endsWith(`-${id}.json`));
  const tw = f
    ? JSON.parse(fs.readFileSync("audio/" + f, "utf8")).flatMap((w) => norm(w.text).map((t) => ({ t, s: w.start, e: w.end })))
    : null;
  const nw = norm(narration);
  // script sentence boundaries (in nw word indexes): sentence k covers [bounds[k], bounds[k+1])
  const bounds = [0];
  for (const sen of narration.split(/(?<=[.?!])\s+/)) bounds.push(bounds[bounds.length - 1] + norm(sen).length);
  const ends = new Map(); // returned time -> time the SCRIPT sentence containing that phrase ends (+0.5)
  const find = (arr, get, p, n) => {
    let c = 0;
    for (let i = 0; i <= arr.length - p.length; i++) if (p.every((x, j) => get(arr[i + j]) === x) && ++c === n) return i;
    return -1;
  };
  // end of the sentence being spoken at beat-relative time t (+0.5 s): a mark comes down when its
  // sentence ends instead of lingering into the next topic (6.6 editor round: boxes held a flat 6 s)
  const raw = f ? JSON.parse(fs.readFileSync("audio/" + f, "utf8")) : null;
  const sentenceEnd = (t) => {
    if (!raw) return null;
    const ts = t - VO;
    let i = raw.findIndex((w) => w.end > ts);
    if (i < 0) return null;
    while (i < raw.length - 1 && !/[.?!:;]["')]*$/.test(raw[i].text)) i++;
    return +(VO + raw[i].end + 0.5).toFixed(2);
  };
  const atFn = (phrase, n = 1, off = 0) => {
    const p = norm(phrase);
    if (tw) {
      const i = find(tw, (w) => w.t, p, n);
      if (i >= 0) {
        const t = +(VO + tw[i].s + off).toFixed(2);
        const si = find(nw, (w) => w, p, n);
        if (si >= 0) {
          const k = bounds.findIndex((b, j) => j > 0 && b > si); // sentence end (exclusive) in nw
          const tail = nw.slice(Math.max(bounds[k - 1], bounds[k] - 2), bounds[k]);
          // the sentence's last words, at or after the phrase in the transcript
          for (let j = i; j <= tw.length - tail.length; j++)
            if (tail.every((x, q) => tw[j + q].t === x)) { ends.set(t, +(VO + tw[j + tail.length - 1].e + 0.5).toFixed(2)); break; }
        }
        return t;
      }
      // fallback (7.6): compare with the spaces squeezed out, so Whisper's glued spellings still match
      // ("P W equals" → "pw equals", "e for e in" → "Efor Ein", "I P address" → "IP address")
      {
        let flat = "", owner = [];
        tw.forEach((w, k) => { for (const ch of w.t) { flat += ch; owner.push(k); } });
        const want = p.join("");
        let from = 0, c = 0, hit = -1;
        while ((hit = flat.indexOf(want, from)) >= 0) { if (++c === n) break; from = hit + 1; }
        if (hit >= 0) return +(VO + tw[owner[hit]].s + off).toFixed(2);
      }
      console.warn(`  sync miss [${id}]: "${phrase}" — using estimate`);
    }
    const i = find(nw, (w) => w, p, n);
    if (i < 0 && process.env.LAB_DRAFT) return VO; // draft (TTS run): a missing anchor warns instead of throwing // draft load before audio: anchors written for Whisper's spelling ("ip", digits)
    if (i < 0) throw new Error(`phrase not in narration [${id}]: "${phrase}"`);
    return +(VO + i / WPS + off).toFixed(2);
  };
  atFn.sentenceEnd = (t) => ends.get(t) ?? sentenceEnd(t);
  return atFn;
}

// ---------------------------------------------------------------- beat + action builders
export function createLab(CODE) {
  const beats = [];
  const T = (line, at, cps = CPS) => ({ do: "type", line, at, cps, segs: tok(CODE[line]) });
  const C = (line, at, text) => ({ do: "callout", line, at, text });
  const H = (line, at) => ({ do: "highlight-line", line, at });
  const S = (line, at) => ({ do: "step", line, at }); // debugger current-line bar
  const V = (name, value, at) => ({ do: "var", name, value, at }); // VARIABLES panel value
  // paste: a block of lines appears at once (copied from the assignment) — the only non-typed code
  const P = (from, to, at) => ({ do: "paste", from, to, at, lines: rangeSegs(from, to) });
  const rangeSegs = (a, b) => {
    const out = [];
    for (let n = a; n <= b; n++) if (CODE[n] !== undefined) out.push({ line: n, segs: tok(CODE[n]) });
    return out;
  };
  const pre = rangeSegs;
  // marks: red box on exactly what the narration is pointing at, at the moment it's said
  //   M(line, "text", at)   editor code      MD("text", at)  doc slide
  //   MO("text", at)        terminal output  MC("text", at)  typed terminal line
  // opts: { n: which occurrence, to: last line of a multi-line box, hold: seconds, until: "phrase" it comes down at }
  const M = (line, text, at, o = {}) => ({ do: "mark", line, text, at, ...o });
  const MD = (find, at, o = {}) => ({ do: "mark", find, at, ...o });
  const MO = (out, at, o = {}) => ({ do: "mark", out, at, ...o });
  const MC = (cmd, at, o = {}) => ({ do: "mark", cmd, at, ...o });
  // typing never overlaps: each type starts after the previous one ends
  function seq(actions) {
    let prevEnd = 0;
    // terminal: one thing at a time, like a person at a real prompt — type, see the output, then type
    // the next line (6.6 extended: two REPL lines were typing at once)
    let termEnd = -1, prevPaste = false;
    for (const a of actions) {
      if (a.do === "term-type" && typeof a.at === "number") {
        // a pasted block (paste speed, ≥ 60 cps) lands all at once: its lines follow each other with no gap
        const paste = !!a.paste || (a.cps || 8) >= 60, gap = paste && prevPaste ? 0.02 : 0.3;
        if (a.at < termEnd + gap) a.at = +(termEnd + gap).toFixed(2);
        termEnd = paste ? a.at : a.at + (a.text || "").length / (a.cps || 8);
        prevPaste = paste;
      } else if (a.do === "term-out" && typeof a.at === "number") {
        if (a.at < termEnd + 0.35) a.at = +(termEnd + 0.35).toFixed(2);
        termEnd = a.at + 0.3;
        prevPaste = false;
      } else if (a.do === "var" && a.withTerm) {
        a.at = +Math.max(0.1, termEnd + 0.15).toFixed(2); // shell panel: the value lands as the line runs
      }
    }
    // a terminal-output box waits for the output it points at (7.6): the first output containing its text that
    // appears at or after ~1.5 s before the box. Never box an older match (5.6 round 3: the `continue` run's 22
    // was boxed for the `break` run's 22).
    const outs = actions.filter((a) => a.do === "term-out" && typeof a.at === "number");
    for (const m of actions) {
      if (m.do !== "mark" || m.out === undefined || typeof m.at !== "number") continue;
      const has = outs.filter((o) => (o.lines || []).join("\n").includes(m.out));
      // the latest match already visible, or about to appear (≤ 1.5 s): never a later, unrelated one (7.6 round 2:
      // a box on int("443")'s 443 jumped ahead to the "443" + 1 inside a later traceback)
      const target = has.filter((o) => o.at <= m.at + 1.5).pop();
      if (target && m.at < target.at + 0.1) m.at = +(target.at + 0.1).toFixed(2);
    }
    for (const a of actions) {
      if (a.do === "type") {
        if (typeof a.at === "string") a.at = +(prevEnd + parseFloat(a.at.split("+")[1] || 0)).toFixed(2);
        if (a.at < prevEnd + 0.25) a.at = +(prevEnd + 0.25).toFixed(2);
        prevEnd = a.at + a.segs.reduce((s, x) => s + x[1].length, 0) / a.cps;
      }
    }
    return actions;
  }
  function B(o, fn) {
    o.voDelay ??= VO;
    const at = syncer(o.id, o.narration);
    for (const k of ["fileCreateAt", "fileOpenAt"]) if (typeof o[k] === "string") o[k] = at(o[k]);
    if (o.stepsOverlay && typeof o.stepsOverlay.at === "string") o.stepsOverlay.at = at(o.stepsOverlay.at);
    if (fn) o.actions = seq(fn(at));
    for (const a of o.actions || []) if (a.do === "mark" && typeof a.until === "string") a.until = +(at(a.until) + 0.5).toFixed(2); // until: "spoken word"
    for (const a of o.actions || [])
      if (a.do === "mark" && a.hold == null && a.until == null && typeof a.at === "number") {
        const e = at.sentenceEnd(a.at);
        if (e != null) a.until = Math.max(e, a.at + 1.4);
      }
    beats.push(o);
  }
  return { beats, B, T, C, H, S, V, P, pre, M, MD, MO, MC };
}

// write CODE out as the real program file (the QA editor runs it and diffs the terminal output)
export function codeText(CODE, from = 1, to = Infinity) {
  const max = Math.min(to, Math.max(...Object.keys(CODE).map(Number).filter((n) => n >= from && n <= to)));
  let o = "";
  for (let i = from; i <= max; i++) o += (CODE[i] ?? "") + "\n";
  return o;
}
// multi-file labs (7.6): spec.files = [{ name, base }]. File k holds CODE[base + 1 ..] up to the next file's base.
export function programFiles(files) {
  return files.map((f, k) => ({ name: f.name, from: (f.base || 0) + 1, to: k + 1 < files.length ? files[k + 1].base : Infinity }));
}
// write every program file into the project, so shell demos that `import` it and the QA runs see the real code
export function writePrograms(CODE, files) {
  for (const p of programFiles(files)) fs.writeFileSync(p.name, codeText(CODE, p.from, p.to));
}

// ---------------------------------------------------------------- Python shell (REPL) demos
// Every >>> line is run in a REAL Python (repl_harness.py, default python3.13) and the video shows
// exactly what the interactive shell prints — results, print() output, 3.13-style tracebacks.
import { spawnSync } from "node:child_process";
export const PY = process.env.LAB_PY || "python3.13";
export function replOutputs(history) {
  const r = spawnSync(PY, ["repl_harness.py"], { input: JSON.stringify(history), encoding: "utf8" });
  if (r.status !== 0) throw new Error(`repl_harness failed: ${r.stderr}`);
  return JSON.parse(r.stdout);
}
function replVars(history) {
  const r = spawnSync(PY, ["repl_harness.py"], { input: JSON.stringify({ stmts: history, vars: true }), encoding: "utf8" });
  if (r.status !== 0) throw new Error(`repl_harness failed: ${r.stderr}`);
  return JSON.parse(r.stdout).vars;
}
export function createRepl() {
  const hist = [];
  // the shell's memory, mirrored into a Variables panel on every shell beat (a fresh screen hid
  // `ports = [...]` while later lines still used it, so students couldn't see it)
  const state = new Map(); // name -> repr shown in the panel
  const order = [];
  const varActs = () => {
    const acts = [];
    for (const [k, v] of Object.entries(replVars(hist))) {
      if (!order.includes(k)) order.push(k);
      if (state.get(k) !== v) { state.set(k, v); acts.push({ do: "var", name: k, value: v, at: 0, withTerm: true }); }
    }
    return acts;
  };
  const banner = () => {
    const r = spawnSync(PY, ["-c", "import sys; print(f'Python {sys.version} on {sys.platform}')"], { encoding: "utf8" });
    return [r.stdout.trim(), 'Type "help", "copyright", "credits" or "license" for more information.'];
  };
  // R(code, at): type `code` at the >>> prompt, then show the real output (if any)
  const R = (code, at, cps = 10) => {
    hist.push(code);
    const outs = replOutputs(hist);
    const out = outs[outs.length - 1];
    const acts = [{ do: "term-type", prompt: ">>> ", at, text: code, cps }];
    if (out !== "") acts.push({ do: "term-out", at: +(at + code.length / cps + 0.4).toFixed(2), lines: out.split("\n"), repl: [...hist] });
    return acts.concat(varActs());
  };
  // RB([lines], at): a multi-line block (for/if/while) the way the shell takes it — the first line at
  // >>>, each body line at "... ", then an empty "... " (Enter on the blank line runs it), then the
  // real output. seq() lays the lines out one after another, so they can all share `at`.
  // `ats` (optional) pins individual lines to spoken phrases; `runAt` pins the final Enter.
  const RB = (lines, at, cps = 10, { ats = [], runAt } = {}) => {
    const src = lines.join("\n");
    hist.push(src);
    const outs = replOutputs(hist);
    const out = outs[outs.length - 1];
    const acts = lines.map((text, i) => ({ do: "term-type", prompt: i ? "... " : ">>> ", at: ats[i] ?? at, text, cps }));
    acts.push({ do: "term-type", prompt: "... ", at: runAt ?? at, text: "", cps });
    if (out !== "") acts.push({ do: "term-out", at: runAt != null ? +(runAt + 0.5).toFixed(2) : at, lines: out.split("\n"), repl: [...hist] });
    return acts.concat(varActs());
  };
  // shell(beat, fn) → [beat, fn'] for B(...): gives the beat a SHELL Variables panel that starts with
  // what the shell already remembers and fills in as each line runs
  const shell = (o, fn) => [o, (at) => {
    const start = new Map(state);
    const acts = fn(at);
    const names = order.filter((n) => start.has(n) || acts.some((a) => a.do === "var" && a.name === n));
    // long values (a tuple) get a smaller font so name and value never run together in the sidebar
    const widest = Math.max(0, ...names.map((n) => n.length + Math.max((start.get(n) || "").length, ...acts.filter((a) => a.do === "var" && a.name === n).map((a) => a.value.length))));
    o.debug = { badge: "SHELL", fontSize: widest > 22 ? 13 : 16, vars: names.map((n) => [n, start.get(n) ?? null]) };
    return acts;
  }];
  return { R, RB, shell, banner, version: () => banner()[0].split(" ")[1] };
}
