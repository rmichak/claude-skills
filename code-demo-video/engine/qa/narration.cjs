#!/usr/bin/env node
/* The words gate: every script is humanized, linted and reviewed before a paid voice reads it.

   narrationOf(dir)  the words the voice will read, from whichever source the project uses:
                     demo spec beats > narration/scene*.txt > script.md "## Script" > narration.txt
   lint(n)           known AI tells. FAIL blocks the voice; WARN is for the reviewer.
   reviewState(dir)  qa/script-review.md: PASS for the current words (narration-sha matches), stale, fail or none
   gate(dir)         what the paid-voice step checks: lint has no FAIL, qa/humanizer-diff.md exists,
                     and qa/script-review.md says PASS for exactly these words
   editorState(dir, takeFile)  qa/editor-signoff.md: PASS for this take (take-bytes matches), stale, fail or none

   CLI:  node <skill>/engine/qa/narration.cjs <project dir> [--lint] [--hash] [--gate] [--json]
   Rules for the reviewer: references/script-review.md in the code-demo-video skill.

   Optional presenter profile: a JSON file named by VOICE_MARKERS (or <project>/qa/voice-markers.json):
     { "absent": ["phrases the presenter never says", ...], "sentenceWordsMean": 19 }
   With it, the lint also WARNs on those phrases and compares sentence length against the presenter's own. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return null; } };

// the project root is the nearest folder with a video.json (builds can run in a subfolder)
function productionDir(dir) {
  let d = path.resolve(dir);
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(d, "video.json"))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return path.resolve(dir);
}

// every spec writes narration as a double-quoted string literal next to an id
function specBeats(text) {
  const units = [];
  const re = /\bnarration\s*:\s*("(?:[^"\\\n]|\\.)*")/g;
  let m;
  while ((m = re.exec(text))) {
    let words;
    try { words = JSON.parse(m[1]); } catch { continue; }
    const before = text.slice(Math.max(0, m.index - 4000), m.index);
    const ids = [...before.matchAll(/\bid\s*:\s*"([^"]+)"/g)];
    units.push({ id: ids.length ? ids[ids.length - 1][1] : `beat ${units.length + 1}`, text: words });
  }
  return units;
}

function narrationOf(dir) {
  const d = productionDir(dir);
  for (const f of ["short.spec.mjs", "demo.spec.mjs"]) {
    const t = read(path.join(d, f));
    if (t) { const units = specBeats(t); if (units.length) return { dir: d, source: f, units }; }
  }
  for (const sub of ["narration", "hyperframes-eleven/narration", "hyperframes/narration"]) {
    const nd = path.join(d, sub);
    if (fs.existsSync(nd)) {
      const files = fs.readdirSync(nd).filter((f) => /^scene\d+\.txt$/.test(f)).sort();
      if (files.length) return { dir: d, source: `${sub}/scene*.txt`, units: files.map((f) => ({ id: f.replace(/\.txt$/, ""), text: read(path.join(nd, f)).trim() })) };
    }
  }
  const s = read(path.join(d, "script.md"));
  const m = s && s.match(/## Script[^\n]*\n\n([\s\S]*?)\n\n## Scene plan/);
  if (m && !m[1].includes("(Write the narration here")) return { dir: d, source: "script.md", units: paragraphs(m[1]) };
  const n = read(path.join(d, "narration.txt"));
  if (n) return { dir: d, source: "narration.txt", units: paragraphs(n) };
  return { dir: d, source: null, units: [] };
}
const paragraphs = (t) => t.trim().split(/\n\s*\n/).map((p, i) => ({ id: `paragraph ${i + 1}`, text: p.trim() })).filter((u) => u.text);

// the hash covers the written words only: the voice's respellings (SAY / say:) and pause lengths can change freely
function hashOf(n) {
  const body = n.units.map((u) => u.text.replace(/\s+/g, " ").trim()).join("\n");
  return crypto.createHash("sha1").update(body).digest("hex").slice(0, 12);
}

/* ---------- lint ---------- */
// FAIL: tells a listener spots at once. Each comes with what to do instead.
const FAIL = [
  [/\bcheck (?:them |it |those |these )?off (?:every|each|all)\b|\bwe'll check off\b/i, "promises a checklist instead of doing it (\"These are the requirements, and we'll check off every one\"). Name the first requirement and start."],
  [/^here'?s the thing[.!:]?$/i, "stand-alone hook. Make the point and keep going."],
  [/\b(?:let'?s|we'?ll) (?:dive|jump) (?:in|into|right in)\b|\bdeep dive\b|\bdive (?:in|into)\b/i, "filler opener. Say what you're going to do and start."],
  [/\b(?:let'?s|we'?ll) (?:break (?:it|this|that) down|unpack)\b/i, "filler. Just explain it."],
  [/\bthat'?s the whole (?:lesson|point|story|trick|secret|channel)\b/i, "announces a lesson instead of stating it."],
  [/\bhere'?s where (?:it|things) gets? (?:interesting|good|fun|tricky)\b/i, "YouTube teaser. Say what happens."],
  [/\b(?:buckle up|without further ado|stick around|stay tuned|plot twist|spoiler alert|picture this|imagine a world)\b/i, "stock YouTube line."],
  [/\bby the end of this (?:video|lesson|module)\b/i, "promise-of-outcome opener. Open with what the video does (\"In this video, we're going to…\")."],
  [/\blet me walk you through\b/i, "filler. Say \"we're going to walk through\" or just start."],
  [/\b(?:game[- ]changer|supercharge|unlock(?:s|ing)? the|level up|next level)\b/i, "hype word."],
  [/\b(?:delve|delving|seamless(?:ly)?|robust|pivotal|crucial|tapestry|landscape of|realm of|testament to)\b/i, "AI vocabulary. Use the plain word."],
  [/\bit'?s (?:important|worth) (?:to note|noting)\b/i, "filler. If it matters, say it."],
  [/\bnot (?:just|only) [^.?!,;]{1,40}, but (?:also )?\b/i, "\"not just X, but Y\". Say Y."],
];
// patterns that run across sentences, checked on the whole beat or paragraph
const FAIL_SPAN = [
  [/\b(?:this|that|it)(?:'s| is| was)(?: not|n't) (?:just |really )?(?:a |an |the )?[^.?!]{1,40}[.?!]\s+(?:it|that|this)(?:'s| is| was) /i, "\"That's not X. That's Y.\" (the top AI tell). Say what it is."],
];
// WARN: fine once, a pattern when repeated. The reviewer reads each one.
const WARN = [
  [/\b(?:honestly|genuinely|seriously|literally|truly)\b/i, "sincerity adverb. Cut unless it's really how the presenter talks."],
  [/\bwhy does (?:this|that|it) matter\?/i, "rhetorical question answered right away."],
  [/\b(?:yeah|wow|boom)\b[.!,]/i, "stagey reaction word."],
  [/\b(?:the reality is|now here'?s)\b/i, "stock framing."],
  [/\bhere'?s the thing\b/i, "a stock hook. Once per video at most."],
];
// one- or two-word sentences used as punchlines ("Not authority." "Seventeen thousand.") are counted, not flagged one by one
const PUNCH = /^(?:not |no |and |but |so )?[a-z']+(?: [a-z']+)?[.!]$/i;
const SAFE_SHORT = /^(?:okay|ok|all right|alright|now|so|right|good|perfect|done|first|second|third|next|yes|no|welcome back|hey everyone|hi everyone|watch|step \w+|number \w+|let's check|let's see)[.!]$/i;

function sentencesOf(text) {
  return text.replace(/\[(?:beat|pause)\]/g, " ").split(/(?<=[.?!])\s+(?=["“(A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
}

// optional presenter profile (see the header): VOICE_MARKERS=<file>, else <project>/qa/voice-markers.json
function markers(dir) {
  const f = process.env.VOICE_MARKERS || (dir ? path.join(dir, "qa", "voice-markers.json") : null);
  if (!f) return null;
  try { return JSON.parse(read(f)); } catch { return null; }
}

function lint(n) {
  const out = [];
  const add = (level, unit, rule, quote) => out.push({ level, unit, rule, quote: quote.length > 160 ? quote.slice(0, 157) + "…" : quote });
  const M = markers(n.dir);
  const absent = (M && Array.isArray(M.absent) ? M.absent : []).map((p) => String(p).toLowerCase()).filter((p) => p.length > 3);
  let words = 0, beats = 0;
  const punch = [];
  for (const u of n.units) {
    beats += (u.text.match(/\[(?:beat|pause)\]/g) || []).length;
    const flat = u.text.replace(/\[(?:beat|pause)\]/g, " ").replace(/\s+/g, " ");
    for (const [re, why] of FAIL_SPAN) { const m = flat.match(re); if (m) add("FAIL", u.id, why, flat.slice(m.index, m.index + 140)); }
    for (const s of sentencesOf(u.text)) {
      words += s.split(/\s+/).length;
      for (const [re, why] of FAIL) if (re.test(s)) add("FAIL", u.id, why, s);
      for (const [re, why] of WARN) if (re.test(s)) add("WARN", u.id, why, s);
      if (PUNCH.test(s) && !SAFE_SHORT.test(s)) punch.push(`${s} (${u.id})`);
      const low = s.toLowerCase();
      for (const p of absent) if (low.includes(p) && !out.some((o) => o.quote === s && o.level === "FAIL")) add("WARN", u.id, `"${p}" is on the presenter's never-says list (voice-markers.json)`, s);
    }
  }
  // whole-script shape
  const sents = n.units.flatMap((u) => sentencesOf(u.text));
  if (words >= 300) {
    const mean = words / Math.max(sents.length, 1);
    if (mean < 13) add("WARN", "whole script", `sentences average ${mean.toFixed(1)} words${M && M.sentenceWordsMean ? ` (the presenter averages ${M.sentenceWordsMean})` : ""}; scripts under 13 read as clipped, scripted lines.`, "");
  }
  if (punch.length && punch.length / Math.max(words, 1) > 3 / 1000) add("WARN", "whole script", `${punch.length} one- or two-word punchline sentences. Land a point with a plain full sentence ("So that's how we create directories.").`, punch.slice(0, 6).join(" · "));
  const dashes = n.units.reduce((k, u) => k + (u.text.match(/—/g) || []).length, 0);
  if (dashes > 2) add("WARN", "whole script", `${dashes} em dashes. People don't talk in dashes; a period or comma gives the voice a real pause.`, "");
  // pause markers on almost every line make a staged, dramatic read
  if (words > 80 && beats / words > 1 / 35) add("WARN", "whole script", `${beats} [beat]/[pause] marks in ${words} words. That many staged pauses sounds read, not talked; keep them for real breaks.`, "");
  return { words, findings: out, fails: out.filter((o) => o.level === "FAIL").length, warns: out.filter((o) => o.level === "WARN").length };
}

/* ---------- review files ---------- */
function field(text, name) {
  const m = text && text.match(new RegExp(`^\\s*${name}\\s*:\\s*(.+)$`, "im"));
  return m ? m[1].trim() : null;
}

function reviewState(dir) {
  const n = narrationOf(dir);
  const file = path.join(n.dir, "qa", "script-review.md");
  const t = read(file);
  const sha = n.units.length ? hashOf(n) : null;
  if (!t) return { state: "none", sha, source: n.source };
  const verdict = (field(t, "VERDICT") || "").toUpperCase();
  const reviewed = (field(t, "narration-sha") || "").replace(/[^0-9a-f]/gi, "").toLowerCase();
  const at = fs.statSync(file).mtime.toISOString();
  if (verdict.startsWith("PASS")) return { state: reviewed && reviewed === sha ? "pass" : "stale", sha, reviewed, at, source: n.source };
  return { state: verdict.startsWith("FAIL") ? "fail" : "none", sha, reviewed, at, source: n.source };
}

function gate(dir) {
  const n = narrationOf(dir);
  const problems = [];
  if (!n.units.length) problems.push("no narration found (spec beats, narration/scene*.txt or script.md ## Script)");
  const l = lint(n);
  if (l.fails) problems.push(`${l.fails} line(s) fail the narration lint: run node ${path.relative(process.cwd(), __filename) || __filename} ${path.relative(process.cwd(), n.dir) || "."} --lint`);
  if (!fs.existsSync(path.join(n.dir, "qa", "humanizer-diff.md"))) problems.push("no qa/humanizer-diff.md: the humanizer pass hasn't been recorded");
  const r = reviewState(n.dir);
  if (r.state === "none") problems.push("no qa/script-review.md: an independent reviewer hasn't passed this script (references/script-review.md)");
  else if (r.state === "fail") problems.push("qa/script-review.md says FAIL");
  else if (r.state === "stale") problems.push(`the words changed after the review (reviewed ${r.reviewed || "?"}, now ${r.sha}): review the changed lines again`);
  return { ok: problems.length === 0, problems, sha: n.units.length ? hashOf(n) : null, source: n.source, lint: l };
}

function editorState(dir, takeFile) {
  const d = productionDir(dir);
  const file = path.join(d, "qa", "editor-signoff.md");
  const t = read(file);
  if (!t) return { state: "none" };
  const verdict = (field(t, "VERDICT") || "").toUpperCase();
  const at = fs.statSync(file).mtime.toISOString();
  if (!verdict.startsWith("PASS")) return { state: verdict.startsWith("FAIL") ? "fail" : "none", at };
  const bytes = field(t, "take-bytes");
  // sign-offs without take-bytes still count; new ones name the exact file
  if (!bytes || !takeFile) return { state: "pass", at, take: field(t, "take") };
  let size = null;
  try { size = fs.statSync(takeFile).size; } catch {}
  return { state: size != null && String(size) === bytes.replace(/[^0-9]/g, "") ? "pass" : "stale", at, take: field(t, "take") };
}

module.exports = { narrationOf, hashOf, lint, reviewState, gate, editorState, productionDir };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("usage: node narration.cjs <project dir> [--lint] [--hash] [--gate] [--json]");
    process.exit(0);
  }
  const dir = args.find((a) => !a.startsWith("--")) || ".";
  const json = args.includes("--json");
  const n = narrationOf(dir);
  if (args.includes("--hash")) { console.log(n.units.length ? hashOf(n) : ""); process.exit(n.units.length ? 0 : 1); }
  if (args.includes("--gate")) {
    const g = gate(dir);
    if (json) console.log(JSON.stringify(g, null, 1));
    else if (g.ok) console.log(`✓ script reviewed: ${g.source}, narration-sha ${g.sha}`);
    else { console.error("✗ This script can't be voiced yet:"); for (const p of g.problems) console.error("  - " + p); console.error("  See references/script-review.md."); }
    process.exit(g.ok ? 0 : 2);
  }
  const l = lint(n);
  if (json) { console.log(JSON.stringify({ source: n.source, sha: n.units.length ? hashOf(n) : null, ...l }, null, 1)); process.exit(l.fails ? 1 : 0); }
  console.log(`${path.relative(process.cwd(), n.dir) || n.dir}: ${n.source || "no narration"} · ${n.units.length} unit(s) · ${l.words} words · narration-sha ${n.units.length ? hashOf(n) : "-"}`);
  for (const f of l.findings) console.log(`${f.level}  [${f.unit}] ${f.rule}${f.quote ? `\n      “${f.quote}”` : ""}`);
  console.log(`${l.fails} FAIL, ${l.warns} WARN`);
  process.exit(l.fails ? 1 : 0);
}
