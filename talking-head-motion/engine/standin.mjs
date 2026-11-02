#!/usr/bin/env node
// A free rehearsal camera, so the beats can be planned, built and watched before the presenter records.
//   node engine/standin.mjs <project dir> [--voice af_heart] [--speed 0.95] [--config <file>]
//
// Reads the talking points under "## Script" in script.md, voices them with Kokoro (local, no quota), and
// puts the presenter's cut-out portrait (config presenter.portrait; a plain backdrop when there's none) on a soft
// backdrop with a slow push-in. Writes raw/standin.mp4. The build uses it only while raw/camera.mp4 doesn't exist,
// and marks every frame REHEARSAL. It's never a deliverable: this format's voice is the presenter's own recording.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, pinFor, positional, projectDir, usage } from "./lib/project.mjs";

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const USAGE = usage("usage: node engine/standin.mjs <project dir> [--voice af_heart] [--speed 0.95] [--config <file>]\n  Voices script.md \"## Script\" with Kokoro over the presenter's portrait → raw/standin.mp4 (REHEARSAL).", argv);
const target = positional(argv, ["--voice", "--speed", "--config"])[0];
if (!target) { console.error(USAGE); process.exit(1); }
const D = projectDir(target);
const cfg = loadConfig(D, argv);
const pin = pinFor(D, cfg);
if (!existsSync(join(D, "script.md"))) { console.error(`✗ no script.md in ${D}`); process.exit(1); }
const script = readFileSync(join(D, "script.md"), "utf8");
const m = script.match(/## Script[^\n]*\n([\s\S]*?)(\n## |\s*$)/);
const text = (m ? m[1] : "").replace(/<!--[\s\S]*?-->/g, "").replace(/^\s*[-*>#].*$/gm, (l) => l.replace(/^\s*[-*>#]+\s*/, "")).replace(/\n{2,}/g, "\n\n").trim();
if (!text || /\(Write/.test(text)) { console.error("✗ script.md has no talking points under ## Script yet"); process.exit(1); }
const portrait = cfg.path(cfg.presenter.portrait);
if (portrait && !existsSync(portrait)) { console.error(`✗ no portrait at ${portrait} (config presenter.portrait)`); process.exit(1); }
if (!portrait) console.log("  no presenter.portrait in the config: the stand-in is a plain backdrop with the voice");

const tmp = mkdtempSync(join(tmpdir(), "beats-standin-"));
try {
  writeFileSync(join(tmp, "say.txt"), text);
  const voice = opt("--voice", cfg.kokoro.voice), speed = String(opt("--speed", cfg.kokoro.speed));
  console.log(`voicing ${text.split(/\s+/).length} words with Kokoro ${voice} @ ${speed} (free)…`);
  // HyperFrames runs Kokoro with the first python3 on PATH; if kokoro-onnx lives in another Python, export
  // HYPERFRAMES_PYTHON=/path/to/that/python3 before running this
  const env = { ...process.env };
  try {
    // One take per paragraph with a short pause between, so the rehearsal breathes the way a real take does
    const paras = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.45", "-c:a", "pcm_s16le", join(tmp, "gap.wav")]);
    const list = [];
    paras.forEach((p, i) => {
      writeFileSync(join(tmp, `p${i}.txt`), p);
      execFileSync("npx", ["--yes", `hyperframes@${pin}`, "tts", join(tmp, `p${i}.txt`), "-o", join(tmp, `p${i}.raw.wav`), "-v", voice, "-s", speed], { stdio: ["ignore", "pipe", "pipe"], env });
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(tmp, `p${i}.raw.wav`), "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", join(tmp, `p${i}.wav`)]);
      // a pause after the last one too: Kokoro stops dead on the last phoneme, and Whisper stamps the final words of
    // a file that ends mid-sound past its end (a real take ends in a breath of silence anyway)
    list.push(`file '${join(tmp, `p${i}.wav`)}'`, `file '${join(tmp, "gap.wav")}'`, ...(i === paras.length - 1 ? [`file '${join(tmp, "gap.wav")}'`] : []));
    });
    writeFileSync(join(tmp, "list.txt"), list.join("\n") + "\n");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(tmp, "list.txt"), "-c", "copy", join(tmp, "say.wav")]);
  } catch {
    // A stand-in is only a rehearsal, so fall back to the Mac's own voice rather than stop
    console.log("  Kokoro failed (check HYPERFRAMES_PYTHON points at a Python with kokoro-onnx); using the macOS `say` voice instead");
    try { execFileSync("say", ["-v", "Reed (English (US))", "-r", "180", "-f", join(tmp, "say.txt"), "-o", join(tmp, "say.aiff")], { stdio: "ignore" }); }
    catch { execFileSync("say", ["-r", "180", "-f", join(tmp, "say.txt"), "-o", join(tmp, "say.aiff")]); }
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(tmp, "say.aiff"), "-ar", "44100", "-ac", "1", join(tmp, "say.wav")]);
  }
  const secs = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(tmp, "say.wav")]).toString().trim();
  mkdirSync(join(D, "raw"), { recursive: true });
  // a warm-grey wall with a soft light behind the head, the portrait low in frame like a desk shot, a slow push-in
  const frames = Math.ceil(secs * 30) + 30;
  const zoom = `zoompan=z='1+0.04*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih*0.42-(ih/zoom*0.42)':d=1:s=1920x1080:fps=30`;
  const bg = ["-f", "lavfi", "-i", `gradients=s=1920x1080:c0=0x5b5650:c1=0x2e2b28:x0=960:y0=380:x1=960:y1=1300:d=${secs + 1}:r=30`];
  const [inputs, graph, audio] = portrait
    ? [[...bg, "-loop", "1", "-i", portrait, "-i", join(tmp, "say.wav")], `[1:v]scale=-1:1000[p];[0:v][p]overlay=x=(W-w)/2:y=H-h+40,format=yuv420p,${zoom}[v]`, "2:a"]
    : [[...bg, "-i", join(tmp, "say.wav")], `[0:v]format=yuv420p,${zoom}[v]`, "1:a"];
  execFileSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", graph,
    "-map", "[v]", "-map", audio, "-t", String(secs + 0.4), "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-c:a", "aac", "-b:a", "160k", "-shortest", join(D, "raw", "standin.mp4")]);
  console.log(`→ raw/standin.mp4 (${secs.toFixed(1)} s). Next: node engine/transcribe.mjs ${target}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
