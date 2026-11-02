// tts-kokoro-beats.mjs — the free, local Kokoro narration of every beat in demo.spec.mjs (af_heart @ 0.95, the
// default voice). It writes the same files as tts-eleven-beats.mjs (audio/vo-NN-<id>.wav + the Whisper .json), so
// the build runs on the draft, and the clone overwrites them once the script is locked. Cached by text in
// audio/cache-kokoro/. Drafts don't need the words gate: drafting is how you hear the script
// (references/script-review.md). The paid clone does. Kokoro can also be the final voice.
// Also writes audio/kokoro-draft.mp3 (every beat in order, short gaps) and audio/kokoro-draft.txt (where each
// beat starts in it), for listening to the script before any paid narration.
//   node tts-kokoro-beats.mjs            KOKORO_VOICE=am_michael node tts-kokoro-beats.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync, readdirSync } from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import spec from "./demo.spec.mjs";

const VOICE = process.env.KOKORO_VOICE || "af_heart";
const SPEED = process.env.KOKORO_SPEED || "0.95";
// Kokoro-only respellings (see a pronunciation list such as the course-video skill's PRONUNCIATIONS.md). These
// apply to what Kokoro reads only; captions keep the real word. A spec can add `sayKokoro: [[/re/g, "…"]]`.
export const KOKORO_SAY = [
  [/\bPython\b/g, "pie-thawn"],
  [/\bVS Code\b/g, "V S Code"],
  [/\bmacOS\b/g, "mac O S"],
  [/\belif\b/gi, "el-if"],
  [/\bpython\b/g, "pie-thawn"], // lowercase too: "python three", "the python course folder"
  [/\bstr\b/g, "S T R"], // run together, heard as "SDR" (l03, l05)
  // Python keywords said as keywords. Kokoro reads for/if/and/or/in as unstressed little words, so "a for loop"
  // sounds like "a fer loop". These spellings give the stressed vowel, checked with
  // kokoro_onnx's phonemizer: four = fˈɔːɹ, iff = ˈɪf, annd = ˈænd, oar = ˈɔːɹ, inn = ˈɪn. Only keyword uses: the
  // English "for every letter" stays as it is, so a script with other keyword readings ("True and False" as code)
  // adds its own `sayKokoro`.
  [/\bfor (loops?|line|keyword|statement)\b/g, "four $1"],
  [/\bfor (i|j|n|x|c|letter|level|item|word|char|floor|num|number|name) in\b/g, "four $1 inn"],
  [/\bif (statements?|line|block|keyword|check|condition)\b/g, "iff $1"],
  [/\b(an|the) if\b/g, "$1 iff"],
  [/\bthe (and|or|in|if|for) (operator|keyword)\b/g, (m, w, k) => `the ${{ and: "annd", or: "oar", in: "inn", if: "iff", for: "four" }[w]} ${k}`],
  [/\bin range\b/g, "inn range"],
];
const spoken = (t, b = {}) => [...KOKORO_SAY, ...(spec.sayKokoro || []), ...(b.sayKokoro || [])].reduce((s, [re, to]) => s.replace(re, to), t);

// once the clone has voiced this production (tts-eleven-beats.mjs keeps its paid takes in audio/cache/), a draft run
// would put Kokoro back over the clone's vo-NN files. The paid takes stay in audio/cache/ either way, and
// `node tts-eleven-beats.mjs` restores them for free, but don't do it by accident.
if (existsSync("audio/cache") && readdirSync("audio/cache").some((f) => f.endsWith(".wav")) && !process.env.KOKORO_OVER_CLONE) {
  console.error("✗ this production already has clone takes (audio/cache/). A Kokoro run would replace the clone's vo files with the draft.\n  Set KOKORO_OVER_CLONE=1 to do it anyway; `node tts-eleven-beats.mjs` puts the clone back (free, from its cache).");
  process.exit(2);
}
mkdirSync("audio/cache-kokoro", { recursive: true });
// beat i keeps its number even when an earlier beat is silent (the build names files by spec order)
const jobs = spec.beats
  .map((b, i) => ({ b, nn: String(i + 1).padStart(2, "0") }))
  .filter(({ b }) => b.narration)
  .map(({ b, nn }) => {
    const text = spoken(b.narration, b);
    const h = createHash("sha1").update(`kokoro ${VOICE} ${SPEED} ${text}`).digest("hex").slice(0, 12);
    return { b, text, base: `audio/vo-${nn}-${b.id}`, cache: `audio/cache-kokoro/${h}` };
  });
// drop stale vo files whose names no longer match a beat
const want = new Set(jobs.flatMap((j) => [j.base + ".wav", j.base + ".json"]));
for (const f of readdirSync("audio")) if (/^vo-/.test(f) && !want.has("audio/" + f)) rmSync("audio/" + f);

function tts(j) {
  if (existsSync(j.cache + ".wav")) return;
  const r = spawnSync("npx", ["--yes", "hyperframes", "tts", j.text, "--voice", VOICE, "--speed", SPEED, "--output", j.cache + ".raw.wav"], { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0 || !existsSync(j.cache + ".raw.wav")) throw new Error(`kokoro failed on ${j.b.id}`);
  // 44.1 kHz mono, like the clone's takes, so the build and the QA see one format
  const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", j.cache + ".raw.wav", "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", j.cache + ".wav"]);
  rmSync(j.cache + ".raw.wav", { force: true });
  if (ff.status !== 0) throw new Error(`ffmpeg failed on ${j.b.id}`);
  console.error(`  kokoro ${j.b.id}`);
}
for (const j of jobs) tts(j);

for (const j of jobs) {
  copyFileSync(j.cache + ".wav", j.base + ".wav");
  const tj = j.cache + ".medium.json"; // medium.en tracks timing better than small.en
  if (!existsSync(tj)) {
    const dir = `audio/cache-kokoro/tx-${j.b.id}`;
    mkdirSync(dir, { recursive: true });
    copyFileSync(j.cache + ".wav", `${dir}/a.wav`);
    const r = spawnSync("npx", ["--yes", "hyperframes", "transcribe", `${dir}/a.wav`, "--model", "medium.en"], { stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0 || !existsSync(`${dir}/transcript.json`)) throw new Error(`transcribe failed on ${j.b.id}`);
    copyFileSync(`${dir}/transcript.json`, tj);
    rmSync(dir, { recursive: true, force: true });
    console.error(`  transcribed ${j.b.id}`);
  }
  copyFileSync(tj, j.base + ".json");
}

// one file to listen to: every beat in order, 0.7 s apart (2 s after a pause card, where the video holds)
const dur = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", f]).toString());
const gapOf = (b) => (b.pauseOverlay || b.scene === "pause" ? 2 : 0.7);
const inputs = jobs.flatMap((j) => ["-i", j.base + ".wav"]);
const pads = jobs.map((j, k) => `[${k}:a]apad=pad_dur=${gapOf(j.b)}[a${k}]`).join(";");
const cat = `${jobs.map((_, k) => `[a${k}]`).join("")}concat=n=${jobs.length}:v=0:a=1[out]`;
const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", `${pads};${cat}`, "-map", "[out]", "-ar", "44100", "-ac", "1", "-b:a", "128k", "audio/kokoro-draft.mp3"]);
if (ff.status !== 0) throw new Error(`ffmpeg failed on the draft mp3: ${ff.stderr}`);
let t = 0;
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const index = jobs.map((j) => { const line = `${mmss(t)}  ${j.b.id}`; t += dur(j.base + ".wav") + gapOf(j.b); return line; });
const words = jobs.reduce((n, j) => n + j.b.narration.split(/\s+/).filter(Boolean).length, 0);
writeFileSync("audio/kokoro-draft.txt", `Kokoro draft (${VOICE} @ ${SPEED}): ${jobs.length} beats, ${words} words, ${mmss(t)}\n\n${index.join("\n")}\n`);
console.error(`done: ${jobs.length} beats, ${mmss(t)} of narration → audio/kokoro-draft.mp3 (index: audio/kokoro-draft.txt)`);
