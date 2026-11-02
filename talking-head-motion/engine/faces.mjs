#!/usr/bin/env node
// Where the presenter's face is, through the camera recording, so the corner circle and the left card stay on it.
//   node engine/faces.mjs <project dir>          (macOS only: uses the Vision framework through swift)
//
// Samples the camera twice a second, finds the face in each frame with macOS Vision (lib/faces.swift), and writes
// faces.json: { source, fps, faces: [[t, x%, y%] | [t, null]] }. build.mjs then frames each pip and split beat on the
// median face position across that beat, unless the beat sets its own "face". Re-run after every new cut: build.mjs
// refuses a faces.json made from an older camera file.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENGINE as HERE, positional, projectDir, usage } from "./lib/project.mjs";

const argv = process.argv.slice(2);
const USAGE = usage("usage: node engine/faces.mjs <project dir>\n  macOS Vision face track of the camera (2 frames a second) → faces.json.", argv);
const target = positional(argv)[0];
if (!target) { console.error(USAGE); process.exit(1); }
const D = projectDir(target);
const spec = existsSync(join(D, "beats.json")) ? JSON.parse(readFileSync(join(D, "beats.json"), "utf8")) : {};
const src = spec.camera?.src || (existsSync(join(D, "raw", "camera.mp4")) ? "raw/camera.mp4" : "raw/standin.mp4");
const FPS = 2;

const tmp = mkdtempSync(join(tmpdir(), "beats-faces-"));
try {
  console.log(`finding the face in ${src} (${FPS} frames a second)…`);
  execFileSync("ffmpeg", ["-v", "error", "-i", join(D, src), "-vf", `fps=${FPS},scale=640:-2`, "-q:v", "4", join(tmp, "f%05d.jpg")]);
  const out = execFileSync("swift", [join(HERE, "lib", "faces.swift"), tmp], { encoding: "utf8", maxBuffer: 64 << 20 });
  const faces = out.trim().split("\n").map((l) => {
    const [f, cx, cy] = l.trim().split(/\s+/);
    const t = +((+f.match(/\d+/)[0] - 1) / FPS + 0.5 / FPS).toFixed(2);   // fps filter frames sit mid-interval
    return cx === "-" ? [t, null] : [t, +(cx * 100).toFixed(1), +(cy * 100).toFixed(1)];
  });
  const found = faces.filter((x) => x[1] != null).length;
  writeFileSync(join(D, "faces.json"), JSON.stringify({ source: src, sourceMtime: statSync(join(D, src)).mtimeMs, fps: FPS, faces }) + "\n");
  console.log(`→ faces.json: a face in ${found} of ${faces.length} frames`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
