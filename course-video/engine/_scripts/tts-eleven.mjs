// tts-eleven.mjs — OPTIONAL ElevenLabs narration for the lecture pipeline.
// Use ONLY when the user explicitly asks for their ElevenLabs voice. Default is Kokoro af_heart
// via `hyperframes tts` (see SKILL.md). Run build-narration.mjs with VOICE=eleven first so the
// narration/sceneNN.txt files are the CLEAN script (no Kokoro respellings — ElevenLabs says them right).
//
// Reads every narration/sceneNN.txt and writes assets/audio/sceneNN.wav (44.1 kHz mono).
// Then transcribe each wav with Whisper and run build-lecture.mjs exactly as in the af_heart path.
//
// Usage:   node tts-eleven.mjs
// Env (nothing is stored in the skill or the project):
//   ELEVENLABS_API_KEY        (required) your ElevenLabs API key
//   ELEVENLABS_VOICE_ID       (required) the voice to read with (your own clone, or a library voice)
//   ELEVENLABS_MODEL_ID       default eleven_turbo_v2_5
//   ELEVENLABS_STABILITY      default 0.5
//   ELEVENLABS_SIMILARITY     default 0.75
//   ELEVENLABS_SPEED          default 0.92   (0.7–1.2 on turbo/v2.5). A little under 1.0 is easier for students to follow.
//   SKIP_SCRIPT_REVIEW        "<reason>" voices without a passing words gate (logged to qa/overrides.log)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { resolve as resolvePath } from "node:path";
import { spawnSync } from "node:child_process";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";
const STABILITY = parseFloat(process.env.ELEVENLABS_STABILITY || "0.5");
const SIMILARITY = parseFloat(process.env.ELEVENLABS_SIMILARITY || "0.75");
const SPEED = parseFloat(process.env.ELEVENLABS_SPEED || "0.92");
// The key and voice come from the environment only (export them, or use your own secrets manager). No .env is read.
const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY || !VOICE_ID) {
  console.error(`ERROR: ${[!API_KEY && "ELEVENLABS_API_KEY", !VOICE_ID && "ELEVENLABS_VOICE_ID"].filter(Boolean).join(" and ")} not set. Export ${!API_KEY && !VOICE_ID ? "them" : "it"} first, e.g.\n  ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… node tts-eleven.mjs`);
  process.exit(1);
}

async function tts(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: STABILITY, similarity_boost: SIMILARITY, style: 0.0, use_speaker_boost: true, speed: SPEED },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return Buffer.from(await res.arrayBuffer());
}

const dir = new URL("./narration/", import.meta.url);
const scenes = readdirSync(dir).filter((f) => /^scene\d+\.txt$/.test(f)).sort();
if (!scenes.length) { console.error("ERROR: no narration/sceneNN.txt found — run build-narration.mjs (VOICE=eleven) first."); process.exit(1); }
// words gate (the skill's references/script-review.md): a new paid take needs a humanized, linted, reviewed script.
// This script is copied into the project; build-module.sh copies the gate to qa/lib/. Otherwise it looks in
// $COURSE_VIDEO_DIR/engine/qa/ and ~/.claude/skills/course-video/engine/qa/.
async function wordsGate(what) {
  const tries = ["qa/lib/gate.mjs", process.env.COURSE_VIDEO_DIR && `${process.env.COURSE_VIDEO_DIR}/engine/qa/gate.mjs`,
    `${homedir()}/.claude/skills/course-video/engine/qa/gate.mjs`].filter(Boolean);
  const lib = tries.find((f) => existsSync(f));
  if (!lib) { console.error(`✗ can't find the words gate (looked in ${tries.join(", ")}): copy the skill's engine/qa/ to qa/lib/`); process.exit(2); }
  (await import(new URL(`file://${resolvePath(lib)}`).href)).wordsGate(process.cwd(), what);
}
await wordsGate(scenes.map((f) => f.replace(/\.txt$/, "")));
mkdirSync(new URL("./assets/audio/", import.meta.url), { recursive: true });
console.error(`ElevenLabs voice=${VOICE_ID} model=${MODEL_ID} speed=${SPEED} — ${scenes.length} scenes`);

for (const f of scenes) {
  const nn = f.match(/scene(\d+)\.txt/)[1];
  const text = readFileSync(new URL(`./narration/${f}`, import.meta.url), "utf8").trim();
  const mp3 = await tts(text);
  const tmp = new URL(`./assets/audio/.scene${nn}.mp3`, import.meta.url);
  writeFileSync(tmp, mp3);
  const wav = new URL(`./assets/audio/scene${nn}.wav`, import.meta.url);
  const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp.pathname, "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", wav.pathname]);
  rmSync(tmp, { force: true });
  if (ff.status !== 0) { console.error(`ffmpeg failed on scene${nn}`); process.exit(1); }
  console.error(`  scene${nn}: ${(mp3.length / 1024).toFixed(0)} KB -> wav`);
}
console.error("done — now transcribe each wav (whisper) and run build-lecture.mjs");
