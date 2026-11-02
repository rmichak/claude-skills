// tts-eleven-beats.mjs — ElevenLabs narration (e.g. your own voice clone) for every beat in demo.spec.mjs.
// Writes audio/vo-NN-<id>.wav (44.1 kHz mono) and transcribes each with Whisper → vo-NN-<id>.json.
// With `sentencePause` in the spec, the vo files get that much silence at each sentence end. A full run also writes
// audio/clone-draft.mp3 (+ .txt index), the takes in order, for listening before the build.
// Cached by narration hash in audio/cache/, so only changed beats hit the API / Whisper again.
// Env: ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (both required); ELEVENLABS_MODEL_ID (default eleven_turbo_v2_5).
// Optional: the narration words gate (engine/qa) runs before any new paid take; see the skill's references/script-review.md.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync, readdirSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import spec from "./demo.spec.mjs";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";
// a spec can slow the voice with `voiceSpeed` (ElevenLabs takes 0.7-1.2). At 1.09, long chained sentences read at
// ~224 wpm against ~188 for a short-sentence lab script. A new speed is a new take of every beat.
const SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true, speed: spec.voiceSpeed ?? 1.09 };
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY || !VOICE_ID) {
  console.error("✗ set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (the voice to read the narration), or use the free");
  console.error("  Kokoro draft instead: node tts-kokoro-beats.mjs");
  process.exit(2);
}

// SAY: respellings applied only to what the voice reads (narration + captions keep the real word).
// Example: a clone that says "tuh-ple" when you say "tuple" with a long U, like "two-pull".
// A spec can add more with `say: [[/regex/g, "respelling"], ...]`.
export const SAY = [
  [/\btuples\b/gi, "tooples"],
  [/\btuple\b/gi, "toople"],
];
// a beat can add its own with `say:` too (7.6: quoting "int" fixed some takes and broke others, so it is per beat)
const spoken = (t, b = {}) => [...SAY, ...(spec.say || []), ...(b.say || [])].reduce((s, [re, to]) => s.replace(re, to), t);

mkdirSync("audio/cache", { recursive: true });
const PAUSE = spec.sentencePause || 0;
let cutsMade = 0;
const jobs = spec.beats.map((b, i) => {
  const nn = String(i + 1).padStart(2, "0");
  const text = spoken(b.narration, b);
  const h = createHash("sha1").update(VOICE_ID + MODEL_ID + JSON.stringify(SETTINGS) + text).digest("hex").slice(0, 12);
  return { b, text, base: `audio/vo-${nn}-${b.id}`, cache: `audio/cache/${h}` };
});
// words gate (references/script-review.md): a new paid take needs a humanized, linted, reviewed script.
// This script is copied into the project; new-lab.sh copies the gate to qa/lib/. Otherwise it looks in
// $CODE_DEMO_VIDEO_DIR/engine/qa/ and ~/.claude/skills/code-demo-video/engine/qa/.
async function wordsGate(what) {
  const home = process.env.HOME || "";
  const tries = ["qa/lib/gate.mjs", process.env.CODE_DEMO_VIDEO_DIR && `${process.env.CODE_DEMO_VIDEO_DIR}/engine/qa/gate.mjs`, `${home}/.claude/skills/code-demo-video/engine/qa/gate.mjs`].filter(Boolean);
  const lib = tries.find((p) => existsSync(p));
  if (!lib) { console.error(`✗ can't find the words gate (looked in ${tries.join(", ")}): copy the skill's engine/qa/ to qa/lib/`); process.exit(2); }
  (await import(new URL(`file://${resolvePath(lib)}`).href)).wordsGate(process.cwd(), what);
}
// ONLY=id,id voices just those beats (to try a setting on one beat before paying for all of them)
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const todo = only ? jobs.filter((j) => only.includes(j.b.id)) : jobs;
if (only && todo.length !== only.length) { console.error(`✗ ONLY names a beat that isn't in the spec: ${only.filter((id) => !jobs.some((j) => j.b.id === id))}`); process.exit(2); }
const uncached = todo.filter((j) => !existsSync(j.cache + ".wav"));
if (uncached.length) await wordsGate(uncached.map((j) => j.b.id));
// drop stale vo files whose names no longer match a beat
const want = new Set(jobs.flatMap((j) => [j.base + ".wav", j.base + ".json"]));
for (const f of readdirSync("audio")) if (/^vo-/.test(f) && !want.has("audio/" + f)) rmSync("audio/" + f);

async function tts(j) {
  if (existsSync(j.cache + ".wav")) return;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: j.text, model_id: MODEL_ID, voice_settings: SETTINGS }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} on ${j.b.id}: ${(await res.text()).slice(0, 300)}`);
  writeFileSync(j.cache + ".mp3", Buffer.from(await res.arrayBuffer()));
  const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", j.cache + ".mp3", "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", j.cache + ".wav"]);
  rmSync(j.cache + ".mp3", { force: true });
  if (ff.status !== 0) throw new Error(`ffmpeg failed on ${j.b.id}`);
  console.error(`  tts ${j.b.id}`);
}
// 4 concurrent requests
const queue = [...todo];
await Promise.all([0, 1, 2, 3].map(async () => { while (queue.length) await tts(queue.shift()); }));

for (const j of todo) {
  copyFileSync(j.cache + ".wav", j.base + ".wav");
  const tj = j.cache + ".medium.json"; // transcripts cached per model (medium.en tracks timing better)
  if (!existsSync(tj)) {
    const dir = `audio/cache/tx-${j.b.id}`;
    mkdirSync(dir, { recursive: true });
    copyFileSync(j.cache + ".wav", `${dir}/a.wav`);
    const r = spawnSync("npx", ["--yes", "hyperframes", "transcribe", `${dir}/a.wav`, "--model", "medium.en"], { stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0 || !existsSync(`${dir}/transcript.json`)) throw new Error(`transcribe failed on ${j.b.id}`);
    copyFileSync(`${dir}/transcript.json`, tj);
    rmSync(dir, { recursive: true, force: true });
    console.error(`  transcribed ${j.b.id}`);
  }
  if (PAUSE) addPauses(j, tj); else copyFileSync(tj, j.base + ".json");
}
console.error(`done: ${todo.length} beats${PAUSE ? `, ${cutsMade} sentence-end pauses of ${PAUSE} s` : ""}`);
if (!only) listeningFile();

// `sentencePause: 0.45` in the spec: that much more silence at every sentence end of the script (a clone stops ~0.45 s
// at a full stop, but long chained sentences have a third as many full stops a minute, so a script like that ran at
// 224 wpm against 188; 0.45 s brought it back). Cut into the one take, in
// the real gap between the sentences, so there are no seams; the Whisper word times move by the same amounts (a
// re-transcribed splice puts the gaps in the wrong places). The vo files change; the paid take in audio/cache/ doesn't.
function addPauses(j, tj) {
  const SR = 44100, raw = `${j.base}.raw`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", j.cache + ".wav", "-f", "s16le", "-ar", String(SR), "-ac", "1", raw]);
  const buf = readFileSync(raw), a = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
  const w = JSON.parse(readFileSync(tj, "utf8"));
  // line the script's words up with Whisper's (python3 = python three, 3.15 = three point fifteen, hello.py = hello dot p y)
  const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"];
  const norm = (t) => t.toLowerCase().replace(/(\d+)\.(\d+)/g, (_, x, y) => ` ${NUM[x] ?? x} point ${NUM[y] ?? y} `)
    .replace(/\.(?=[a-z])/g, " dot ").replace(/--/g, " two dashes ").replace(/\bvscode\b/g, "v s code").replace(/\bvs\b/g, "v s")
    .replace(/([a-z])(\d+)\b/g, "$1 $2").replace(/\b\d+\b/g, (d) => NUM[d] ?? d).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const toks = (words) => words.flatMap((x, i) => norm(x).map((t) => ({ t, i })));
  const sw = j.b.narration.split(/\s+/).filter(Boolean), A = toks(sw), B = toks(w.map((x) => x.text));
  const L = Array.from({ length: A.length + 1 }, () => new Int32Array(B.length + 1));
  for (let x = A.length - 1; x >= 0; x--) for (let y = B.length - 1; y >= 0; y--) L[x][y] = A[x].t === B[y].t ? L[x + 1][y + 1] + 1 : Math.max(L[x + 1][y], L[x][y + 1]);
  const match = new Map(); for (let x = 0, y = 0; x < A.length && y < B.length;) { if (A[x].t === B[y].t) { match.set(x, B[y].i); x++; y++; } else if (L[x + 1][y] >= L[x][y + 1]) x++; else y++; }
  // after each sentence-final script word: the Whisper word it matched, else the word before the next match
  const after = new Set();
  sw.forEach((word, i) => {
    if (i === sw.length - 1 || !/[.?!]["')\]]*$/.test(word)) return;
    const last = A.findLastIndex((t) => t.i === i);
    if (match.has(last)) return after.add(match.get(last));
    const next = A.findIndex((t, x) => t.i > i && match.has(x));
    if (next >= 0) after.add(match.get(next) - 1);
  });
  // Whisper's word times drift: it stretches a sentence's last word over the silence after it, or runs "hello dot P Y"
  // together and starts the next sentence early. So look from that word's start to past the next word's end, take the
  // longest stretch under -40 dBFS (10 ms frames, 5 ms apart; the gap between words or a stop consonant is shorter)
  // and cut at its quietest frame
  const cuts = [], win = 441, hop = 220, quiet = 32768 * 10 ** (-40 / 20);
  for (const k of [...after].filter((k) => k >= 0 && k < w.length - 1).sort((x, y) => x - y)) {
    const lo = Math.max(0, Math.floor(w[k].start * SR)), hi = Math.min(a.length - win, Math.ceil((w[k + 1].end + 0.1) * SR));
    let run = null, best = null;
    for (let s = lo; s <= hi; s += hop) {
      let e = 0; for (let q = s; q < s + win; q++) e += a[q] * a[q];
      const rms = Math.sqrt(e / win);
      if (rms < quiet) { run ??= { from: s, to: s, min: rms, at: s }; run.to = s; if (rms < run.min) { run.min = rms; run.at = s; } }
      else { if (run && (!best || run.to - run.from > best.to - best.from)) best = run; run = null; }
    }
    if (run && (!best || run.to - run.from > best.to - best.from)) best = run;
    const len = best ? (best.to - best.from + win) / SR : 0;
    if (len < 0.15) { console.error(`  ⚠ ${j.b.id}: no gap after "${w[k].text}" (longest quiet stretch ${(len * 1000).toFixed(0)} ms), no pause there`); continue; }
    cuts.push({ at: best.at + win / 2, k, gap: len });
  }
  const gap = new Int16Array(Math.round(PAUSE * SR)), parts = []; let p = 0;
  for (const c of cuts) { parts.push(a.subarray(p, c.at), gap); p = c.at; }
  parts.push(a.subarray(p));
  writeFileSync(raw, Buffer.concat(parts.map((x) => Buffer.from(x.buffer, x.byteOffset, x.byteLength))));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "s16le", "-ar", String(SR), "-ac", "1", "-i", raw, "-c:a", "pcm_s16le", j.base + ".wav"]);
  rmSync(raw, { force: true });
  const shift = (k) => cuts.filter((c) => c.k < k).length * PAUSE;
  writeFileSync(j.base + ".json", JSON.stringify(w.map((x, k) => ({ ...x, start: +(x.start + shift(k)).toFixed(3), end: +(x.end + shift(k)).toFixed(3) })), null, 2) + "\n");
  cutsMade += cuts.length;
}

// one file to listen to before the build: every take in order, 0.7 s apart (2 s after a pause card), plus where each beat starts
function listeningFile() {
  const voiced = todo.filter((j) => j.b.narration);
  const dur = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
  const gapOf = (b) => (b.pauseOverlay || b.scene === "pause" ? 2 : 0.7);
  const fc = voiced.map((j, k) => `[${k}:a]apad=pad_dur=${gapOf(j.b)}[a${k}]`).join(";") + ";" + voiced.map((_, k) => `[a${k}]`).join("") + `concat=n=${voiced.length}:v=0:a=1[out]`;
  const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...voiced.flatMap((j) => ["-i", j.base + ".wav"]), "-filter_complex", fc, "-map", "[out]", "-ar", "44100", "-ac", "1", "-b:a", "128k", "audio/clone-draft.mp3"]);
  if (ff.status !== 0) throw new Error(`ffmpeg failed on the listening file: ${ff.stderr}`);
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  let t = 0; const index = voiced.map((j) => { const line = `${mmss(t)}  ${j.b.id}`; t += dur(j.base + ".wav") + gapOf(j.b); return line; });
  writeFileSync("audio/clone-draft.txt", `Clone (${MODEL_ID}, speed ${SETTINGS.speed}${PAUSE ? `, ${PAUSE} s at sentence ends` : ""}): ${voiced.length} beats, ${mmss(t)}\n\n${index.join("\n")}\n`);
  console.error(`listening file: audio/clone-draft.mp3 (${mmss(t)}; index audio/clone-draft.txt)`);
}
