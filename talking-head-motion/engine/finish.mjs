#!/usr/bin/env node
// Render and master a talking-head-motion project after build.mjs.
//   node engine/finish.mjs <project dir> [--draft] [--master-only]
//
// 1. `npx hyperframes check`, then render with the project's pinned CLI (package.json "render" script).
//    The render goes to renders/<folder>.mp4. --draft renders at draft quality to renders/<folder>.draft.mp4.
// 2. Master the sound to −14 LUFS integrated, true peak ≤ −1 dBTP (two-pass loudnorm aimed at −1.5, since the AAC
//    encode adds a little overshoot). The picture is copied untouched.
// 3. Export YouTube captions (renders/captions.srt + .vtt) from narration.words.json, offset by the
//    narration's data-start in index.html, in lines of up to 42 characters.
// 4. Put the mastered take at final/<folder>.mp4. An existing final is set aside in final/previous/.
// A rehearsal (raw/standin.mp4) only ever renders as a draft. A review pass by fresh eyes comes next (SKILL.md).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join, basename } from "node:path";
import { positional, projectDir, readJSON, usage } from "./lib/project.mjs";

const argv = process.argv.slice(2);
const USAGE = usage("usage: node engine/finish.mjs <project dir> [--draft] [--master-only]\n  Render (HyperFrames), master to −14 LUFS, captions (.srt/.vtt) → final/<folder>.mp4 (--draft: renders/ only).", argv);
const draft = argv.includes("--draft");
const masterOnly = argv.includes("--master-only");   // reuse renders/<folder>.raw.mp4 and redo steps 3–4 only
const target = positional(argv)[0];
if (!target) { console.error(USAGE); process.exit(1); }
const D = projectDir(target);
if (!existsSync(join(D, "package.json")) || !existsSync(join(D, "index.html"))) { console.error("✗ no index.html/package.json: run node engine/build.mjs <dir> first"); process.exit(1); }
if (!draft && readJSON(join(D, "qa", "beats-timing.json"), {}).rehearsal) { console.error("✗ this build uses the rehearsal stand-in camera: record raw/camera.mp4 and rebuild, or render with --draft"); process.exit(1); }
const folder = basename(D);
const say = (m) => console.log(m);
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: D, stdio: ["ignore", "inherit", "inherit"], ...opts });
  if (r.status !== 0) { say(`✗ ${cmd} ${args.slice(0, 3).join(" ")} failed (exit ${r.status})`); process.exit(r.status || 1); }
};

const pkg = JSON.parse(readFileSync(join(D, "package.json"), "utf8"));
const pin = (pkg.scripts?.render || "").match(/hyperframes@([\d.]+)/)?.[1] || "latest";
const hf = ["--yes", `hyperframes@${pin}`];

const raw = join(D, "renders", `${folder}${draft ? ".draft" : ""}.raw.mp4`);
mkdirSync(join(D, "renders"), { recursive: true });
if (masterOnly && existsSync(raw)) say(`1–2/4 reusing ${raw.replace(D + "/", "")} (--master-only)`);
else {
  say(`1/4 check (hyperframes@${pin})`);
  run("npx", [...hf, "check"]);
  say(`2/4 render${draft ? " (draft quality)" : ""} → ${raw.replace(D + "/", "")}`);
  // optional video.json "render": {"resolution": "landscape-4k", "videoBitrate": "40M"}. YouTube gives a 1080p upload
  // a low-bitrate encode that looks soft; a 4K upload at 35–45 Mbps gets a far sharper one.
  const R = draft ? {} : readJSON(join(D, "video.json"), {}).render || {};
  const extra = [...(R.resolution ? ["--resolution", R.resolution] : []), ...(R.videoBitrate ? ["--video-bitrate", R.videoBitrate] : [])];
  // Multi-worker screenshot capture writes every frame to disk first: a 7-minute 4K render can want ~115 GB.
  // Streaming the workers' frames straight to the encoder needs no frame storage.
  const env = { ...process.env, HF_CAPTURE_PARALLEL_STREAM: process.env.HF_CAPTURE_PARALLEL_STREAM || "true" };
  run("npx", [...hf, "render", ".", "-o", raw, "--quality", draft ? "draft" : "delivery", ...extra, "--skill", "general-video"], { env });
}

say("3/4 master to −14 LUFS / −1 dBTP");
const probe = spawnSync("ffmpeg", ["-hide_banner", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
// loudnorm prints its JSON block, then ffmpeg keeps logging: take the last {...} block only
const lastJson = (txt) => { const a = txt.lastIndexOf("{"); return JSON.parse(txt.slice(a, txt.indexOf("}", a) + 1)); };
const m = lastJson(probe.stderr);
const ln = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
const mastered = join(D, "renders", `${folder}${draft ? ".draft" : ""}.mp4`);
// asetpts: loudnorm's end-of-stream flush mis-stamps one frame (~2.9 s from the end), which put a gap of up to 0.1 s in the timeline
// A real camera take has sharper transients than a synthetic voice (one mastered to −0.66 dBTP). When the true peak
// misses −1 dBTP, add a gentle peak limiter after the normalizer, lowering its ceiling until it holds.
let after;
for (const lim of [null, -2.0, -2.6, -3.2]) {
  const chain = ln + (lim == null ? "" : `,alimiter=limit=${Math.pow(10, lim / 20).toFixed(4)}:attack=2:release=60:level=false`) + ",asetpts=N/SR/TB";
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-c:v", "copy", "-af", chain, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", mastered]);
  const check = spawnSync("ffmpeg", ["-hide_banner", "-i", mastered, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  after = lastJson(check.stderr);
  if (+after.input_tp <= -1.0) { if (lim != null) say(`   peak limiter at ${lim} dBFS`); break; }
}
say(`   integrated ${after.input_i} LUFS, true peak ${after.input_tp} dBTP`);

say("4/4 captions + final");
const W = JSON.parse(readFileSync(join(D, "narration.words.json"), "utf8"));
const html = readFileSync(join(D, "index.html"), "utf8");
const tag = html.match(/<audio[^>]*id="narration"[^>]*>/)?.[0] || "";
const offset = +(tag.match(/data-start="([\d.]+)"/)?.[1] || 0);
const lines = []; let cur = [];
for (const w of W.words) {
  const text = [...cur.map((x) => x.text), w.text].join(" ");
  const newPara = cur.length && cur[cur.length - 1].p !== w.p;
  if (cur.length && (text.length > 42 || newPara || /[.?!]$/.test(cur[cur.length - 1].text) && text.length > 24)) { lines.push(cur); cur = []; }
  cur.push(w);
}
if (cur.length) lines.push(cur);
const ts = (s, sep) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), mi = Math.floor(ms / 60000) % 60, se = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(se).padStart(2, "0")}${sep}${String(ms % 1000).padStart(3, "0")}`; };
const cues = lines.map((l, i) => ({ i: i + 1, a: l[0].start + offset, b: Math.max(l[l.length - 1].end + offset, l[0].start + offset + 0.8), t: l.map((x) => x.text).join(" ") }));
cues.forEach((c, i) => { if (cues[i + 1] && c.b > cues[i + 1].a) c.b = cues[i + 1].a - 0.01; });
// Whisper can stretch a take's last word past the end of the file (by 0.7 s, seen): no cue may outlast the video
const end = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mastered]).toString().trim();
cues.forEach((c) => { c.b = Math.min(c.b, end - 0.05); c.a = Math.min(c.a, c.b - 0.3); });
writeFileSync(join(D, "renders", "captions.srt"), cues.map((c) => `${c.i}\n${ts(c.a, ",")} --> ${ts(c.b, ",")}\n${c.t}\n`).join("\n"));
writeFileSync(join(D, "renders", "captions.vtt"), "WEBVTT\n\n" + cues.map((c) => `${ts(c.a, ".")} --> ${ts(c.b, ".")}\n${c.t}\n`).join("\n"));

if (draft) { say(`DONE (draft) → ${mastered.replace(D + "/", "")}. Drafts never go to final/.`); process.exit(0); }
mkdirSync(join(D, "final"), { recursive: true });
const fin = join(D, "final", `${folder}.mp4`);
if (existsSync(fin)) { const s = join(D, "final", "previous"); mkdirSync(s, { recursive: true }); renameSync(fin, join(s, `${Date.now()}-${folder}.mp4`)); }
execFileSync("cp", [mastered, fin]);
const secs = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", fin]).toString().trim();
say(`DONE → final/${folder}.mp4 (${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")}) + renders/captions.srt/.vtt. Next: the review pass (SKILL.md, step 5).`);
