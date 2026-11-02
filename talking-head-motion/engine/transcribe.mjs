#!/usr/bin/env node
// Word timings for the camera recording, which every beat anchors to.
//   node engine/transcribe.mjs <project dir> [--model medium.en]
//
// Runs local Whisper (hyperframes transcribe) on a copy of the camera's sound in a temp folder: the CLI
// writes transcript.json next to its input, which would otherwise overwrite a transcript.json in the project.
// Writes narration.words.json ({ source, model, words: [{ text, start, end }] }, the shape
// engine/finish.mjs turns into YouTube captions) and transcript.md, the recording as timed
// sentences for planning beats.json. transcript-fixes.json ({ "Clod": "Claude" }) corrects what
// Whisper mishears; it's applied on every run, so keep fixes there rather than editing the output.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, pinFor, positional, projectDir, usage } from "./lib/project.mjs";

const argv = process.argv.slice(2);
const USAGE = usage("usage: node engine/transcribe.mjs <project dir> [--model medium.en]\n  Local Whisper word timings for the camera → narration.words.json + transcript.md.", argv);
const target = positional(argv, ["--model", "--config"])[0];
const model = argv.includes("--model") ? argv[argv.indexOf("--model") + 1] : "medium.en";
if (!target) { console.error(USAGE); process.exit(1); }
const D = projectDir(target);
const readJSON = (f, d) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };

const spec = readJSON(join(D, "beats.json"), {});
const src = spec.camera?.src || (existsSync(join(D, "raw", "camera.mp4")) ? "raw/camera.mp4" : "raw/standin.mp4");
if (!existsSync(join(D, src))) { console.error(`✗ no camera recording at raw/camera.mp4 (or a stand-in at raw/standin.mp4)`); process.exit(1); }
const pin = pinFor(D, loadConfig(D, argv));

const tmp = mkdtempSync(join(tmpdir(), "beats-tx-"));
try {
  console.log(`transcribing ${src} (Whisper ${model}, local)…`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(D, src), "-vn", "-ac", "1", "-ar", "16000", join(tmp, "audio.wav")]);
  execFileSync("npx", ["--yes", `hyperframes@${pin}`, "transcribe", join(tmp, "audio.wav"), "-d", tmp, "--json", "--model", model], { stdio: ["ignore", "ignore", "pipe"] });
  const raw = readJSON(join(tmp, "transcript.json"), null);
  if (!Array.isArray(raw) || !raw.length) throw new Error("Whisper returned no words");

  const all = Object.entries(readJSON(join(D, "transcript-fixes.json"), {}));
  // a key with spaces fixes a run of words: { "PHP 2 shell": "PHP2Shell" } merges the three into one word that keeps
  // the first word's start, the last word's end and the last word's trailing punctuation
  const phrases = all.filter(([from]) => /\s/.test(from.trim())), fixes = all.filter(([from]) => !/\s/.test(from.trim()));
  const fix = (t) => fixes.reduce((s, [from, to]) => s.replace(new RegExp(`^${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^A-Za-z0-9]*$)`, "i"), to), t);
  const bare = (t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, "");
  let words = raw.map((w) => ({ text: String(w.text).trim(), start: +(+w.start).toFixed(3), end: +(+w.end).toFixed(3) })).filter((w) => w.text);
  for (const [from, to] of phrases) {
    const want = from.trim().split(/\s+/).map(bare), out = [];
    for (let i = 0; i < words.length; i++) {
      if (want.every((x, k) => words[i + k] && bare(words[i + k].text) === x)) {
        const last = words[i + want.length - 1];
        out.push({ text: to + (last.text.match(/[^A-Za-z0-9]*$/)?.[0] || ""), start: words[i].start, end: last.end });
        i += want.length - 1;
      } else out.push(words[i]);
    }
    words = out;
  }
  words = words.map((w) => ({ ...w, text: fix(w.text) }));
  // a fix that reads as several words ("php -v", "Forkast News") becomes several words again, sharing the span by
  // length, so beats can anchor to each word and the captions keep the spacing
  words = words.flatMap((w) => {
    const parts = w.text.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return [w];
    const total = parts.reduce((a, p) => a + p.length, 0), span = w.end - w.start;
    let t = w.start;
    return parts.map((p) => { const d = span * p.length / total, o = { text: p, start: +t.toFixed(3), end: +(t + d).toFixed(3) }; t += d; return o; });
  });
  writeFileSync(join(D, "narration.words.json"), JSON.stringify({ source: src, model, made: new Date().toISOString(), words }, null, 1) + "\n");

  // timed sentences, for writing beats.json against what was actually said
  const lines = []; let cur = [];
  for (const w of words) { cur.push(w); if (/[.?!]["”)]?$/.test(w.text)) { lines.push(cur); cur = []; } }
  if (cur.length) lines.push(cur);
  const ts = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  writeFileSync(join(D, "transcript.md"), `# Transcript of ${src}\n\nWhisper ${model}. Each line starts at the time shown. Anchor beats to these exact words (beats.json "at").\n` +
    `Fix mishearings in transcript-fixes.json and re-run engine/transcribe.mjs, never by editing this file.\n\n` +
    lines.map((l) => `[${ts(l[0].start)}] ${l.map((w) => w.text).join(" ")}`).join("\n") + "\n");
  console.log(`→ narration.words.json (${words.length} words, ${ts(words[words.length - 1].end)}) and transcript.md`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
