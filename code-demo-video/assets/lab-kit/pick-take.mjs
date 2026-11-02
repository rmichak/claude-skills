// pick-take.mjs — when the clone's pronunciation of one word varies between takes, generate takes of ONE beat
// until a take passes the EDITOR acceptance test: the word is heard correctly by small.en AND medium.en, on the
// whole beat and on isolated cuts around every occurrence. The winner is installed as that beat's cached audio,
// so `node tts-eleven-beats.mjs` picks it up (and re-transcribes it).
//   LAB_DRAFT=1 node qa/pick-take.mjs <beat id> <word> [max takes]      e.g.  node qa/pick-take.mjs q2 int 6
import { writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import spec from "../demo.spec.mjs";

const [id, word, maxArg] = process.argv.slice(2);
const MAX = +(maxArg || 6);
const b = spec.beats.find((x) => x.id === id);
if (!b) throw new Error(`no beat ${id}`);
// keep these identical to tts-eleven-beats.mjs (voice, model, settings, SAY + spec.say + beat.say)
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID, MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";
const SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true, speed: spec.voiceSpeed ?? 1.09 };
const SAY = [[/\btuples\b/gi, "tooples"], [/\btuple\b/gi, "toople"]];
const text = [...SAY, ...(spec.say || []), ...(b.say || [])].reduce((s, [re, to]) => s.replace(re, to), b.narration);
const hash = createHash("sha1").update(VOICE_ID + MODEL_ID + JSON.stringify(SETTINGS) + text).digest("hex").slice(0, 12);
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY || !VOICE_ID) { console.error("✗ set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID"); process.exit(2); }
const HF = process.env.HF_BIN || "npx";
const hfArgs = (a) => (HF === "npx" ? ["--yes", "hyperframes", ...a] : a);
const dir = `qa/takes/${id}`;
mkdirSync(dir, { recursive: true });
// several words: "S ?S ?H,shell" — every one must be heard as often as the script says it
const wants = word.split(",").map((w) => ({ re: new RegExp(`\\b${w}\\b`, "i"), n: (b.narration.match(new RegExp(`\\b${w}\\b`, "gi")) || []).length }));

function transcribe(wav, model) {
  const d = `${wav}.${model}`;
  mkdirSync(d, { recursive: true });
  copyFileSync(wav, `${d}/x.wav`);
  rmSync(`${d}/transcript.json`, { force: true });
  spawnSync(HF, hfArgs(["transcribe", "x.wav", "--model", model]), { cwd: d, stdio: "ignore" });
  return existsSync(`${d}/transcript.json`) ? JSON.parse(readFileSync(`${d}/transcript.json`, "utf8")) : [];
}
const hitsOf = (words, re) => words.filter((w) => re.test(w.text));

for (let k = 1; k <= MAX; k++) {
  const base = `${dir}/take${k}`;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: SETTINGS }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  writeFileSync(base + ".mp3", Buffer.from(await res.arrayBuffer()));
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", base + ".mp3", "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", base + ".wav"]);
  const med = transcribe(base + ".wav", "medium.en");
  const sml = transcribe(base + ".wav", "small.en");
  let ok = wants.every(({ re, n }) => hitsOf(med, re).length === n && hitsOf(sml, re).length === n);
  const notes = wants.map(({ re, n }) => `whole ${re.source}: medium ${hitsOf(med, re).length}/${n}, small ${hitsOf(sml, re).length}/${n}`);
  if (ok) {
    // isolated cuts around each occurrence (medium's word times), two lead-ins, both models
    for (const { re: want } of wants) for (const w of hitsOf(med, want)) for (const lead of [0.5, 0.9]) {
      const cut = `${base}-cut-${w.start.toFixed(2)}-${lead}.wav`;
      spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(Math.max(0, w.start - lead)), "-t", "2.4", "-i", base + ".wav", "-ar", "16000", "-ac", "1", cut]);
      for (const m of ["small.en", "medium.en"]) {
        const t = transcribe(cut, m).map((x) => x.text).join(" ");
        const pass = want.test(t);
        notes.push(`cut ${w.start.toFixed(2)}-${lead} ${m}: ${pass ? "ok" : "MISS"} "${t}"`);
        if (!pass) ok = false;
      }
    }
  }
  console.log(`take ${k}: ${ok ? "PASS" : "fail"}\n  ` + notes.join("\n  "));
  if (ok) {
    copyFileSync(base + ".wav", `audio/cache/${hash}.wav`);
    rmSync(`audio/cache/${hash}.medium.json`, { force: true }); // re-transcribed by tts-eleven-beats.mjs
    console.log(`installed take ${k} as audio/cache/${hash}.wav — now run: LAB_DRAFT=1 node tts-eleven-beats.mjs`);
    process.exit(0);
  }
}
console.log(`no passing take in ${MAX}; reword the line`);
process.exit(1);
