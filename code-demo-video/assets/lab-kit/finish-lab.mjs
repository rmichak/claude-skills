// finish-lab.mjs — master a lab-kit render and write what YouTube needs next to it.
//   node finish-lab.mjs [renders/<folder>.mp4]
// 1. Master the sound to −14 LUFS integrated, true peak ≤ −1 dBTP: a two-pass ffmpeg loudnorm
//    (aimed at −1.5, since the AAC encode adds a little overshoot). Picture copied untouched.
// 2. Captions: final/<folder>.srt + .vtt from timeline.json (the build's own caption groups, so the YouTube track
//    matches the burned-in captions, captionFixes included). Upload final/<folder>.srt as the YouTube caption track.
// 3. Chapters: final/chapters.txt from the beats that carry `chapter: "Title"` in the spec, checked against
//    YouTube's rules (the first at 0:00, at least three, at least 10 s apart).
// 4. The mastered take goes to final/<folder>.mp4 (an existing final is set aside in .stale/<date>/).
// The editor pass (EDITOR.md, qa/editor-signoff.md) comes next. Don't publish without it.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { basename, join } from "node:path";

const folder = basename(process.cwd());
const raw = process.argv[2] || `renders/${folder}.mp4`;
if (!existsSync(raw)) { console.error(`✗ no render at ${raw}`); process.exit(1); }
if (!existsSync("timeline.json")) { console.error("✗ no timeline.json: run node build-demo.mjs first"); process.exit(1); }
const T = JSON.parse(readFileSync("timeline.json", "utf8"));
mkdirSync("final", { recursive: true });

// 1 · master
const lastJson = (txt) => { const a = txt.lastIndexOf("{"); return JSON.parse(txt.slice(a, txt.indexOf("}", a) + 1)); };
const fin = `final/${folder}.mp4`;
if (existsSync(fin)) { const s = join(".stale", new Date().toISOString().slice(0, 10)); mkdirSync(s, { recursive: true }); renameSync(fin, join(s, `${Date.now()}-${folder}.mp4`)); }
// A take whose peaks can't take the gain sends loudnorm to its dynamic limiter, and the AAC encode can overshoot that
// limit (Lab 8.6 take 7: limit −1.5 → −0.73 dBTP). Step the limit down until the encoded file is ≤ −1 dBTP.
let m, after;
for (const tp of [-1.5, -2, -2.5, -3]) {
  m = lastJson(spawnSync("ffmpeg", ["-hide_banner", "-i", raw, "-af", `loudnorm=I=-14:TP=${tp}:LRA=11:print_format=json`, "-f", "null", "-"], { encoding: "utf8" }).stderr);
  const ln = `loudnorm=I=-14:TP=${tp}:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  // asetpts: loudnorm's end-of-stream flush mis-stamps one frame (~2.9 s from the end), which put a gap of up to 0.1 s in the timeline
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-c:v", "copy", "-af", ln + ",asetpts=N/SR/TB", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", fin]);
  after = lastJson(spawnSync("ffmpeg", ["-hide_banner", "-i", fin, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { encoding: "utf8" }).stderr);
  if (+after.input_tp <= -1) break;
  console.log(`  true peak ${after.input_tp} dBTP at limit ${tp}: mastering again with a lower limit`);
}
console.log(`master: ${m.input_i} → ${after.input_i} LUFS, true peak ${after.input_tp} dBTP → ${fin}`);

// 2 · captions
const ts = (s, sep) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), mi = Math.floor(ms / 60000) % 60, se = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(se).padStart(2, "0")}${sep}${String(ms % 1000).padStart(3, "0")}`; };
const cues = T.captions.filter((c) => c.text && c.end > c.start);
writeFileSync(`final/${folder}.srt`, cues.map((c, i) => `${i + 1}\n${ts(c.start, ",")} --> ${ts(c.end, ",")}\n${c.text}\n`).join("\n"));
writeFileSync(`final/${folder}.vtt`, "WEBVTT\n\n" + cues.map((c) => `${ts(c.start, ".")} --> ${ts(c.end, ".")}\n${c.text}\n`).join("\n"));
console.log(`captions: ${cues.length} cues → final/${folder}.srt (+ .vtt)`);

// 3 · chapters
const mmss = (s) => { const t = Math.floor(s); return t >= 3600 ? `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}` : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const ch = T.beats.filter((b) => b.chapter).map((b) => ({ t: b.start, title: b.chapter }));
const problems = [];
if (!ch.length || ch[0].t > 0.5) problems.push("the first chapter must start at 0:00 (put `chapter:` on the first beat)");
if (ch.length < 3) problems.push(`YouTube needs at least 3 chapters (found ${ch.length})`);
ch.forEach((c, i) => { const next = ch[i + 1]?.t ?? T.duration; if (next - c.t < 10) problems.push(`"${c.title}" is ${(next - c.t).toFixed(1)} s long (YouTube's minimum is 10 s)`); });
if (ch.length) ch[0].t = 0;
writeFileSync("final/chapters.txt", ch.map((c) => `${mmss(c.t)} ${c.title}`).join("\n") + "\n");
console.log(`chapters: ${ch.length} → final/chapters.txt${problems.length ? "\n  ⚠ " + problems.join("\n  ⚠ ") : " (YouTube's rules: OK)"}`);
const secs = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", fin]).toString().trim();
console.log(`DONE → ${fin} (${mmss(secs)}). Next: the editor pass (EDITOR.md).`);
