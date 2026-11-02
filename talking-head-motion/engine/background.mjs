#!/usr/bin/env node
// Swap the room behind the presenter for another background, without a green screen.
//   node engine/background.mjs <project dir> <image> [--blur 7]     (macOS only: Vision person segmentation)
//
// 1. A person mask for every frame of raw/camera.mp4 (macOS Vision, lib/personmask.swift): raw/camera.mask.mp4.
// 2. Vision goes soft on a moving hand, so the room shows through the fingers. The camera is
//    locked off on a plain wall, so a clean plate catches what Vision misses: every 30 s, the median of 29 frames
//    is the empty room wherever the presenter isn't sitting (raw/camera.plate.mp4). Anything that differs from it in
//    brightness or colour is the presenter. Near the body the plate holds a blurred ghost, so that difference is switched off
//    wherever the mask is on for more than about a third of those 30 s (raw/camera.presence.mp4).
//    The matte is max(Vision mask, plate difference outside the presence zone) for the current frame only, feathered.
//    (No temporal smoothing: averaging with earlier frames left gesturing hands glassy.)
// 3. Composite over the image, cover-scaled to 1920×1080 and blurred like a real lens (sigma --blur, default 7).
//    The sound is copied. Writes raw/camera-bg.mp4.
// Steps 1–2 are cached and rebuilt when the camera file is newer. Then point beats.json at the result
// ("camera": { "src": "raw/camera-bg.mp4" }) and re-run transcribe.mjs and faces.mjs, which check their source.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ENGINE as HERE, positional, projectDir, usage } from "./lib/project.mjs";

const argv = process.argv.slice(2);
const USAGE = usage("usage: node engine/background.mjs <project dir> <image> [--blur 7]\n  Keys the presenter (macOS Vision) over a new background → raw/camera-bg.mp4.", argv);
const [target, image] = positional(argv, ["--blur"]);
const blur = argv.includes("--blur") ? +argv[argv.indexOf("--blur") + 1] : 7;
if (!target || !image) { console.error(USAGE); process.exit(1); }
const D = projectDir(target);
const raw = (f) => join(D, "raw", f);
const cam = raw("camera.mp4"), mask = raw("camera.mask.mp4"), plate = raw("camera.plate.mp4"), presence = raw("camera.presence.mp4"), out = raw("camera-bg.mp4");
const img = resolve(D, image);
if (!existsSync(cam)) { console.error("✗ no raw/camera.mp4"); process.exit(1); }
if (!existsSync(img)) { console.error(`✗ no image at ${img}`); process.exit(1); }
const stale = (f) => !existsSync(f) || statSync(f).mtimeMs < statSync(cam).mtimeMs;
const ff = (...a) => execFileSync("ffmpeg", ["-v", "error", "-y", ...a], { stdio: "inherit" });
const dur = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", cam]).toString().trim();

if (stale(mask)) {
  console.log("1/3 person mask (macOS Vision)…");
  execFileSync("swift", [join(HERE, "lib", "personmask.swift"), cam, mask], { stdio: "inherit" });
} else console.log("1/3 person mask: reusing raw/camera.mask.mp4");

// one still per 30 s chunk (the last chunk ends at the end), held for its chunk as a 30 fps video
function perChunk(src, vf, dst) {
  const tmp = mkdtempSync(join(tmpdir(), "beats-bg-"));
  try {
    const n = Math.max(1, Math.ceil(dur / 30)), list = [];
    for (let k = 0; k < n; k++) {
      const s = Math.max(0, Math.min(30 * k, dur - 30)), f = join(tmp, `${String(k).padStart(2, "0")}.png`);
      ff("-ss", `${s}`, "-t", "30", "-i", src, "-vf", vf, "-update", "1", f);
      list.push(`file '${f}'`, `duration ${k < n - 1 ? 30 : (dur - 30 * (n - 1)).toFixed(3)}`);
    }
    list.push(list[list.length - 2]);
    writeFileSync(join(tmp, "list.txt"), list.join("\n"));
    ff("-f", "concat", "-safe", "0", "-i", join(tmp, "list.txt"), "-vf", "fps=30", "-t", `${dur}`, "-c:v", "libx264", "-crf", "10", "-preset", "fast", "-pix_fmt", "yuv420p", dst);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
if (stale(plate) || stale(presence)) {
  console.log("2/3 clean plates and presence, one per 30 s…");
  // tmedian only outputs full windows: 30 frames at 1 fps give the 29-frame median first
  perChunk(cam, "fps=1,tmedian=radius=14", plate);
  perChunk(mask, "fps=1,format=gray,tmix=frames=29,lut=y='if(gt(val,90),255,0)',gblur=sigma=14,lut=y='if(gt(val,40),255,0)',gblur=sigma=6", presence);
} else console.log("2/3 clean plates: reusing raw/camera.plate.mp4 and raw/camera.presence.mp4");

console.log(`3/3 composite over ${image} (blur ${blur})…`);
// format before split pins the colour camera: a gray consumer downstream would otherwise turn the picture gray
const graph = [
  "[0]format=yuv420p,split[cam][c1]",
  "[2]format=yuv420p[pl]",
  "[c1][pl]blend=all_mode=difference,extractplanes=y+u+v[dy][du][dv]",
  "[du]scale=1920:1080[du2]", "[dv]scale=1920:1080[dv2]",
  "[du2][dv2]blend=all_mode=addition,lut=y='val*3'[duv]",
  // threshold 22: lower reads camera noise as the presenter (speckles all over the new room)
  "[dy][duv]blend=all_mode=lighten,lut=y='clip((val-22)*10,0,255)',erosion,erosion,dilation,dilation,dilation,gblur=sigma=2[diff]",
  "[3]format=gray,negate[free]",
  "[diff][free]blend=all_mode=multiply[d]",
  "[1]format=gray[m]",
  // current frame only: a 3-frame mean (tried for the hair edge) left a gesturing hand at 0.7–0.85 alpha, and the
  // hair barely needed it (frame-to-frame change at the head edge only 11% lower with it)
  "[m][d]blend=all_mode=lighten,gblur=sigma=1.2[matte]",
  `[4]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=${blur},eq=brightness=-0.03:saturation=0.9,format=yuv420p[bg]`,
  "[cam][matte]alphamerge[p]",
  "[bg][p]overlay=shortest=1:format=auto,format=yuv420p[v]",
].join(";");
ff("-i", cam, "-i", mask, "-i", plate, "-i", presence, "-loop", "1", "-framerate", "30", "-i", img, "-filter_complex", graph,
  "-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-r", "30", "-c:a", "copy", "-movflags", "+faststart", out);
const frames = (f) => parseInt(execFileSync("ffprobe", ["-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", f]).toString(), 10);   // ffprobe can print "14880," here
const [a, b] = [frames(cam), frames(out)];
console.log(`→ raw/camera-bg.mp4: ${b} frames (camera ${a})`);
if (a !== b) { console.error("✗ frame count differs from the camera"); process.exit(1); }
