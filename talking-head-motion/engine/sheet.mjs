#!/usr/bin/env node
// A contact sheet of the build: one still per beat (at the moment its words have all landed) plus the camera
// between beats, written to qa/sheets/.
//   node engine/sheet.mjs <project dir>
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, pinFor, positional, projectDir, usage } from "./lib/project.mjs";

const argv = process.argv.slice(2);
const USAGE = usage("usage: node engine/sheet.mjs <project dir>\n  One still per beat (after build.mjs) → qa/sheets/contact-sheet-*.jpg.", argv);
const target = positional(argv)[0];
if (!target) { console.error(USAGE); process.exit(1); }
const D = projectDir(target);
if (!existsSync(join(D, "qa", "beats-timing.json"))) { console.error("✗ no qa/beats-timing.json: run node engine/build.mjs <dir> first"); process.exit(1); }
const timing = JSON.parse(readFileSync(join(D, "qa", "beats-timing.json"), "utf8"));
const pin = pinFor(D, loadConfig(D, argv));

// 75% into each beat (its words are on screen), and the middle of each camera-only stretch over 2 s
const times = [
  ...timing.beats.map((b) => b.t0 + (b.t1 - b.t0) * 0.75),
  ...timing.segments.filter((s) => s.mode === "full" && s.t1 - s.t0 > 2).map((s) => (s.t0 + s.t1) / 2),
].sort((a, b) => a - b).map((t) => t.toFixed(2));
const out = join(D, "qa", "sheets", new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"));
mkdirSync(out, { recursive: true });
execFileSync("npx", ["--yes", `hyperframes@${pin}`, "snapshot", D, "--at", times.join(","), "--no-end", "-o", out, "--describe", "false"], { stdio: ["ignore", "inherit", "inherit"] });
// keep the newest contact sheets at qa/sheets/ (the stills stay in the dated folder)
for (const f of readdirSync(out).filter((x) => /^contact-sheet.*\.jpe?g$/.test(x))) copyFileSync(join(out, f), join(D, "qa", "sheets", f));
console.log(`→ ${out.replace(D + "/", "")} (${times.length} stills); contact sheets copied to qa/sheets/`);
