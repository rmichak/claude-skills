#!/usr/bin/env node
// Build a talking-head-motion project: the presenter's camera recording plus motion beats, as one HyperFrames
// composition (index.html at the project root).
//   node engine/build.mjs <project dir> [--config <file>]
//
// Inputs, all in the project folder:
//   beats.json            the beat plan (engine/README.md has the format)
//   raw/camera.mp4        the recording (raw/standin.mp4 is the free rehearsal stand-in, see standin.mjs)
//   narration.words.json  its word timings, from transcribe.mjs
// The camera plays start to finish with its own sound. Each beat is anchored to a phrase the presenter says ("at"),
// lasts for the sentence it illustrates unless it says otherwise ("until", "dur"), and moves the camera
// between full frame, a punch-in, the corner circle, the left card, or off. Writes index.html,
// qa/beats-timing.json, and the project files HyperFrames needs (package.json, hyperframes.json, assets/).
// Colours, fonts, logo, music and the presenter come from the config (engine/lib/project.mjs explains the lookup).
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, extname, join } from "node:path";
import { BEATS, CAMERA, css } from "./lib/beats.mjs";
import { findPhrase, norm, esc, syncTimes } from "./lib/text.mjs";
import { ENGINE, loadConfig, pinFor, positional, projectDir, readJSON, rgba, tokens, usage } from "./lib/project.mjs";

const HERE = ENGINE;
const argv = process.argv.slice(2);
const USAGE = usage("usage: node engine/build.mjs <project dir> [--config <file>]\n  Reads beats.json, raw/camera.mp4 (or raw/standin.mp4) and narration.words.json in the project;\n  writes index.html, compositions/bNN.html and qa/beats-timing.json.", argv);
const target = positional(argv)[0];
if (!target) { console.error(USAGE); process.exit(1); }
const D = projectDir(target);
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
if (!existsSync(join(D, "beats.json"))) fail(`no beats.json in ${D}`);

const spec = readJSON(join(D, "beats.json"));
const video = readJSON(join(D, "video.json"), {});
const cfg = loadConfig(D, argv);
const brand = cfg.brand;
const tok = tokens(cfg);

// ── the camera and its words ─────────────────────────────────────────────────
const camSrc = spec.camera?.src || (existsSync(join(D, "raw", "camera.mp4")) ? "raw/camera.mp4" : "raw/standin.mp4");
if (!existsSync(join(D, camSrc))) fail(`no camera recording: put it at raw/camera.mp4 (or make a rehearsal stand-in with engine/standin.mjs)`);
const rehearsal = camSrc.includes("standin");
const probe = (f) => +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim();
const camIn = +(spec.camera?.in || 0);
const camOut = spec.camera?.out != null ? +spec.camera.out : probe(join(D, camSrc));
const DUR = +(camOut - camIn).toFixed(3);
// "outro": { "dur": 7 } ends the video on a brand end card instead of the last frame of the presenter's face: the
// camera fades out with the last words and the card holds (7 s leaves room for YouTube's end-screen elements); the
// music fades out over it. "url" overrides the config's CTA text under the logo.
const outro = spec.outro ? { dur: 7, ...spec.outro } : null;
const TOTAL = +(DUR + (outro ? +outro.dur : 0)).toFixed(3);
const wj = readJSON(join(D, "narration.words.json"), null);
if (!wj) fail("no narration.words.json: run node engine/transcribe.mjs <dir> first");
if (wj.source && wj.source !== camSrc) fail(`narration.words.json was made from ${wj.source}, but the camera is ${camSrc}. Re-run transcribe.mjs.`);
// Whisper can stamp the last words of a take that ends mid-sound past the end of the file: clamp them to the end
// rather than lose them (an anchor on the closing line would otherwise fail)
const tail = (wj.words || []).filter((w) => w.start >= camIn);
const lastIn = tail.findIndex((w) => w.start >= camOut);
const W = tail.filter((w, i) => w.start < camOut || (lastIn >= 0 && i - lastIn < 4 && w.start < camOut + 2.5))
  .map((w) => ({ ...w, start: Math.min(w.start, camOut - 0.3) - camIn, end: Math.min(w.end, camOut - 0.05) - camIn }));
if (!W.length) fail("the transcript has no words inside the camera range");

// ── when each beat starts and ends ───────────────────────────────────────────
const beats = (spec.beats || []).map((b, i) => ({ ...b, id: `b${String(i + 1).padStart(2, "0")}` }));
let cursor = 0;
for (const b of beats) {
  if (!BEATS[b.type]) fail(`${b.id}: unknown beat type "${b.type}". Types: ${Object.keys(BEATS).join(", ")}`);
  if (b.start != null) { b.t0 = +b.start; b.k = W.findIndex((w) => w.end > b.t0); }
  else if (b.at) {
    const k = findPhrase(W, b.at, cursor);
    if (k < 0) {
      const near = W.slice(cursor, cursor + 40).map((w) => w.text).join(" ");
      fail(`${b.id} (${b.type}): "${b.at}" isn't in the transcript after ${W[cursor]?.start?.toFixed(1) ?? "?"} s.\n  Next words: ${near}`);
    }
    b.k = k; b.t0 = W[k].start - (b.lead ?? 0.15); cursor = k + 1;
  } else fail(`${b.id} (${b.type}): needs "at" (a phrase ${cfg.presenter.name} says) or "start" (seconds)`);
  b.t0 = Math.max(0, +b.t0.toFixed(3));
}
beats.sort((a, b) => a.t0 - b.t0);
const sentenceEnd = (k) => { for (let j = Math.max(k, 0); j < W.length; j++) if (/[.?!]["”)]?$/.test(W[j].text)) return W[j].end + 0.35; return DUR; };
beats.forEach((b, i) => {
  const next = beats[i + 1]?.t0 ?? DUR;
  let t1;
  if (b.until) {
    const k = findPhrase(W, b.until, Math.max(b.k, 0));
    if (k < 0) fail(`${b.id}: "until" phrase "${b.until}" isn't in the transcript after the beat starts`);
    t1 = W[k + String(b.until).split(/\s+/).filter((x) => norm(x)).length - 1].end + 0.3;
  } else if (b.dur != null) t1 = b.t0 + +b.dur;
  else t1 = sentenceEnd(b.k);
  t1 = Math.max(t1, b.t0 + 1.2);
  // don't flash the camera for half a second between two beats, nor balloon the corner circle (or left card) to full
  // frame and straight back between two beats that both keep it
  const mode = b.cam || CAMERA[b.type], nextMode = beats[i + 1] && (beats[i + 1].cam || CAMERA[beats[i + 1].type]);
  if (next - t1 < 0.6 || (next - t1 < 1.0 && mode === nextMode && mode !== "full")) t1 = next;
  b.t1 = +Math.min(t1, next, DUR).toFixed(3);
  b.mode = b.cam || CAMERA[b.type];
  if (b.t1 - b.t0 < 0.5) fail(`${b.id}: only ${(b.t1 - b.t0).toFixed(2)} s long (it overlaps the next beat)`);
});

// ── camera moves ─────────────────────────────────────────────────────────────
// full = the recording fills the frame · punch = full, pushed in · pip = corner circle · split = left card · off
// The recording is one 1920×1080 layer. Each mode is a window cut out of it (clip-path, in source pixels) plus a
// transform that puts the window where it goes. Transforms only: left/top/width snap to whole pixels and stutter
// under frame-by-frame capture (hyperframes check rejects them).
const toPx = (f) => String(f).split(/\s+/).map((v, i) => (parseFloat(v) / 100) * (i ? 1080 : 1920));
const [fx, fy] = toPx(spec.camera?.face || cfg.presenter.face || "50% 38%");
// faces.json (faces.mjs) tracks the face through the recording: a pip or split beat frames the median face position
// across the beat, so the circle and the card stay on the presenter when they shift in the chair. A beat's own "face" wins.
const ft = readJSON(join(D, "faces.json"), null);
const track = ft && ft.source === camSrc && Math.abs((ft.sourceMtime || 0) - statSync(join(D, camSrc)).mtimeMs) < 1 ? ft.faces.filter((f) => f[1] != null) : null;
if (ft && !track) console.warn(`! faces.json was made from another camera file: re-run engine/faces.mjs (framing on camera.face for now)`);
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const faceFor = (b) => {
  if (b.face) return toPx(b.face);
  const seen = (track || []).filter(([t]) => t >= b.t0 + camIn && t <= b.t1 + camIn);
  return seen.length ? [median(seen.map((f) => f[1])) * 19.2, median(seen.map((f) => f[2])) * 10.8] : [fx, fy];
};
const clampN = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const inset = (t, r, b, l, rad) => `inset(${t.toFixed(1)}px ${r.toFixed(1)}px ${b.toFixed(1)}px ${l.toFixed(1)}px round ${rad.toFixed(1)}px)`;
function place(X, Y, W, H, R, sw, [px, py] = [fx, fy]) {   // a W×H box on screen at X,Y showing an sw-wide source window around the face
  const s = W / sw, sh = H / s;
  const sx = clampN(px - sw / 2, 0, 1920 - sw), sy = clampN(py - sh * 0.42, 0, 1080 - sh);
  return { x: +(X - sx * s).toFixed(2), y: +(Y - sy * s).toFixed(2), scale: +s.toFixed(5), clipPath: inset(sy, 1920 - sx - sw, 1080 - sy - sh, sx, R / s) };
}
const FULL = { x: 0, y: 0, scale: 1, clipPath: inset(0, 0, 0, 0, 0) };
const geo = (mode, face) => mode === "pip" ? place(1640, 800, 216, 216, 108, 660, face) : mode === "split" ? place(110, 150, 580, 780, 34, 744, face) : FULL;
const MID = place(1340, 700, 480, 270, 26, 1920);   // the shrink to the corner passes through a small card
const segs = [];
let t = 0;
// a pop puts words beside the presenter, so the camera reframes to make room (off with camera.reframe: false, e.g.
// when they already sit to one side)
const reframe = spec.camera?.reframe !== false;
for (const b of beats) {
  if (b.t0 > t + 0.01) segs.push({ t0: t, t1: b.t0, mode: "full" });
  segs.push({ t0: b.t0, t1: b.t1, mode: b.mode, side: reframe && b.type === "pop" && b.mode === "full" ? (b.side === "left" ? "left" : "right") : null,
    face: b.mode === "pip" || b.mode === "split" ? faceFor(b) : null });
  t = b.t1;
}
if (t < DUR - 0.01) segs.push({ t0: t, t1: DUR, mode: "full" });

const J = JSON.stringify;
const at = (x) => (+x).toFixed(3);
const tweens = (L, base = 0) => ({   // timeline lines; a beat's own timeline counts from its start
  fromTo: (sel, a, b, x) => L.push(`tl.fromTo(${J(sel)}, ${J(a)}, ${J(b)}, ${at(Math.max(0, x - base))});`),
  to: (sel, v, x) => L.push(`tl.to(${J(sel)}, ${J(v)}, ${at(Math.max(0, x - base))});`),
  set: (sel, v, x) => L.push(`tl.set(${J(sel)}, ${J(v)}, ${at(Math.max(0, x - base))});`),
});
const L = [];
const T = tweens(L);
const CAM = "#cam-wrap";
const isFull = (m) => m === "full" || m === "punch";
const camOn = (m) => m !== "off";
// Full-frame framing, set as a jump cut at each change: a slight punch on every other return to the presenter, a bigger one
// for "punch", and for a pop a push-in that slides him away from the words (clamped so the frame edge never shows)
let zoomFlip = false;
const frameFor = (seg) => {
  if (seg.side) {
    const s = 1.3, x = seg.side === "right" ? Math.max(-300, -(s - 1) * (1920 - fx)) : Math.min(300, (s - 1) * fx);
    return { scale: s, x: +x.toFixed(1) };
  }
  return { scale: seg.mode === "punch" ? 1.16 : (zoomFlip = !zoomFlip) ? 1 : 1.07, x: 0 };
};
const first = segs[0].mode;
T.set(CAM, { ...geo(first, segs[0].face), opacity: camOn(first) ? 1 : 0 }, 0);
T.set("#cam-shell", { "--ring": isFull(first) ? 0 : 1 }, 0);
T.set("#stage", { opacity: isFull(first) ? 0 : 1 }, 0);
T.set("#cam-zoom", isFull(first) ? frameFor(segs[0]) : { scale: 1, x: 0 }, 0);
for (let i = 1; i < segs.length; i++) {
  const a = segs[i - 1].mode, b = segs[i].mode, x = segs[i].t0, face = segs[i].face;
  if (a === b && !isFull(b)) {                            // same window, a new beat: follow him if he has moved
    const p = segs[i - 1].face;
    if (b !== "off" && p && face && Math.hypot(face[0] - p[0], face[1] - p[1]) > 24) T.to(CAM, { ...geo(b, face), duration: 0.45, ease: "power2.inOut" }, x);
    continue;
  }
  if (isFull(a) && isFull(b)) { T.set("#cam-zoom", frameFor(segs[i]), x); continue; }
  if (isFull(b)) {                                        // back to the presenter
    if (a === "off") { T.set(CAM, { ...FULL, opacity: 1 }, x); T.set("#stage", { opacity: 0 }, x); }
    else { T.to(CAM, { ...FULL, duration: 0.5, ease: "power3.inOut" }, x - 0.1); T.to("#stage", { opacity: 0, duration: 0.35 }, x + 0.1); }
    T.to("#cam-shell", { "--ring": 0, duration: 0.2 }, a === "off" ? x : x + 0.2);
    T.set("#cam-zoom", frameFor(segs[i]), x);
    continue;
  }
  if (b === "off") {                                      // a graphic takes the whole frame
    if (isFull(a)) { T.set(CAM, { opacity: 0 }, x); T.set("#stage", { opacity: 1 }, x); }
    // the ring's glow would show through the fading video as a wash, so it goes first
    else { T.to("#cam-shell", { "--ring": 0, duration: 0.08 }, x - 0.08); T.to(CAM, { opacity: 0, duration: 0.2 }, x); }
    continue;
  }
  // into the corner or the left card
  if (isFull(a)) {
    T.set("#cam-zoom", { scale: 1, x: 0 }, x);
    T.to("#stage", { opacity: 1, duration: 0.3 }, x);
    if (b === "pip") { T.to(CAM, { ...MID, duration: 0.32, ease: "power2.in" }, x); T.to(CAM, { ...geo("pip", face), duration: 0.3, ease: "power2.out" }, x + 0.32); }
    else T.to(CAM, { ...geo(b, face), duration: 0.55, ease: "power3.inOut" }, x);
    T.to("#cam-shell", { "--ring": 1, duration: 0.3 }, x + 0.35);
  } else if (a === "off") {
    // a pop's push-in (up to 1.3×, slid 300 px) is still on the zoom layer: without the reset the circle shows half a face
    T.set("#cam-zoom", { scale: 1, x: 0 }, x);
    T.set(CAM, { ...geo(b, face) }, x);
    T.to(CAM, { opacity: 1, duration: 0.3 }, x + 0.1);
    T.to("#cam-shell", { "--ring": 1, duration: 0.25 }, x + 0.4);   // after the fade, or it tints the video
  } else T.to(CAM, { ...geo(b, face), duration: 0.5, ease: "power3.inOut" }, x);
}

// ── beats: one sub-composition each (compositions/bNN.html), so the timeline shows one row per beat ──
mkdirSync(join(D, "compositions"), { recursive: true });
const hosts = [];
for (const [i, b] of beats.entries()) {
  const area = b.mode === "split" ? "split" : b.mode === "pip" ? "pip" : "full";
  const LB = [];
  const B = tweens(LB, b.t0);
  const c = {
    id: b.id, t0: b.t0, t1: b.t1, area, tok, rgba, panel: !!spec.camera?.panel, glow: (a) => rgba(tok.accent, a), ...B, main: T,
    sync: (ws, o = {}) => syncTimes(ws, W, b.t0, b.t1, o),
    count: (sel, n, x, dur) => LB.push(`tl.fromTo(${J(sel)}, { innerText: 0 }, { innerText: ${+n}, snap: { innerText: 1 }, duration: ${dur}, ease: "power2.out" }, ${at(Math.max(0, x - b.t0))});`),
    steps: (sel, values, x, step) => values.forEach((v, k) => B.set(sel, { textContent: v }, x + step * k)),
    asset: (p) => { if (!p || !existsSync(join(D, p))) fail(`${b.id}: missing image ${p}`); },
  };
  const html = BEATS[b.type](b, c);
  if (b.t1 - b.t0 > 0.8) B.to(`#${b.id}-in`, { opacity: 0, filter: "blur(6px)", duration: 0.2 }, b.t1 - 0.2);
  const dur = at(b.t1 - b.t0);
  writeFileSync(join(D, "compositions", `${b.id}.html`), `<template>
  <div id="${b.id}" data-composition-id="${b.id}" data-width="1920" data-height="1080" data-duration="${dur}" style="position:absolute;inset:0">
    <div id="${b.id}-in" class="in">${html}</div>
  </div>
  <script>
    (() => {
      const tl = gsap.timeline({ paused: true });
      ${LB.join("\n      ")}
      window.__timelines["${b.id}"] = tl;
    })();
  </script>
</template>
`);
  hosts.push(`  <div id="el-${b.id}" class="beat" data-composition-id="${b.id}" data-composition-src="compositions/${b.id}.html" data-start="${at(b.t0)}" data-duration="${dur}" data-track-index="${2 + (i % 2)}"></div>`);
  if (beats[i + 1] && beats[i + 1].t0 < b.t1 - 0.01) fail(`${b.id} overlaps ${beats[i + 1].id}`);
}

// ── project files ────────────────────────────────────────────────────────────
// ── the end card ─────────────────────────────────────────────────────────────
let outroHost = "";
if (outro) {
  // the end card shows the config's logo, or the brand name as a title when there's no logo
  const logoSrc = cfg.path(brand.logo);
  if (logoSrc && !existsSync(logoSrc)) fail(`outro: brand logo missing at ${logoSrc} (config brand.logo)`);
  let logoRel = null;
  if (logoSrc) {
    mkdirSync(join(D, "assets", "brand"), { recursive: true });
    if (brand.logoKeyBackground) {
      // a logo flattened onto a solid background: key that colour out, or it shows as a box on the stage
      const corner = execFileSync("ffmpeg", ["-v", "error", "-i", logoSrc, "-vf", "crop=8:8:0:0,scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).toString("hex").slice(0, 6);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", logoSrc, "-vf", `colorkey=0x${corner}:0.08:0.06,format=rgba`, join(D, "assets", "brand", "logo.png")]);
      logoRel = "assets/brand/logo.png";
    } else {
      logoRel = `assets/brand/logo${extname(logoSrc).toLowerCase() || ".png"}`;
      copyFileSync(logoSrc, join(D, logoRel));
    }
  }
  const url = outro.url || brand.cta || "";
  const t0 = +(DUR - 0.6).toFixed(3), dur = +(TOTAL - t0).toFixed(3);
  // the last words are still landing: the camera fades over 0.6 s while the stage comes up behind it
  T.to("#cam-shell", { opacity: 0, duration: 0.6, ease: "power1.inOut" }, t0);
  T.to("#stage", { opacity: 1, duration: 0.6, ease: "power1.inOut" }, t0);
  T.fromTo("#stage .pulse", { opacity: 0, x: 0 }, { opacity: 1, x: 1600, duration: 2.4, ease: "power2.inOut" }, t0 + 0.4);
  T.to("#stage .pulse", { opacity: 0, duration: 0.4 }, t0 + 2.8);
  writeFileSync(join(D, "compositions", "outro.html"), `<template>
  <div id="outro" data-composition-id="outro" data-width="1920" data-height="1080" data-duration="${at(dur)}" style="position:absolute;inset:0">
    <div class="outro-card">
      ${logoRel ? `<img id="outro-logo" src="${logoRel}" alt="${esc(brand.name || "")}">` : `<div id="outro-logo" class="outro-name">${esc(brand.name || spec.title || video.title || "")}</div>`}
      ${url ? `<div id="outro-url" class="outro-url">${esc(url)}</div>` : ""}
    </div>
  </div>
  <script>
    (() => {
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("#outro-logo", { opacity: 0, y: 24, filter: "blur(10px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "power3.out" }, 0.5);
      ${url ? `tl.fromTo("#outro-url", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 1.3);` : ""}
      window.__timelines["outro"] = tl;
    })();
  </script>
</template>
`);
  outroHost = `\n  <div id="el-outro" class="beat" data-composition-id="outro" data-composition-src="compositions/outro.html" data-start="${at(t0)}" data-duration="${at(dur)}" data-track-index="4"></div>`;
}

const pin = pinFor(D, cfg);
if (!existsSync(join(D, "package.json"))) writeFileSync(join(D, "package.json"), J({ name: basename(D), private: true, type: "module",
  scripts: { dev: `npx --yes hyperframes@${pin} preview`, check: `npx --yes hyperframes@${pin} check`, render: `npx --yes hyperframes@${pin} render` } }, null, 2) + "\n");
if (!existsSync(join(D, "hyperframes.json"))) writeFileSync(join(D, "hyperframes.json"), J({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  paths: { blocks: "compositions", components: "compositions/components", assets: "assets" }, media: { autoProxy: true }, authoringSkill: "general-video" }, null, 2) + "\n");
for (const d of ["assets/vendor", "assets/fonts", "qa"]) mkdirSync(join(D, d), { recursive: true });
copyFileSync(await gsapFile(), join(D, "assets/vendor/gsap.min.js"));
// fonts named in the config with a file are embedded; a family without a file must be installed; none = system stack
const FONTS = [];
for (const role of ["sans", "mono"]) {
  const f = brand.fonts?.[role] || {};
  if (!f.file) continue;
  const src = cfg.path(f.file);
  if (!existsSync(src)) fail(`font missing: ${src} (config brand.fonts.${role}.file)`);
  const fam = f.family || basename(src).replace(/\.[^.]+$/, "");
  if (!f.family) tok[role] = `"${fam}",${tok[role]}`;
  copyFileSync(src, join(D, "assets/fonts", basename(src)));
  FONTS.push([basename(src), fam, f.weight || (role === "mono" ? "500" : "100 900")]);
}

// GSAP runs every timeline. It isn't bundled with the skill (its own license): engine/vendor/gsap.min.js if present,
// else the gsap npm package (npm install in engine/), else a one-time download from jsDelivr cached in engine/vendor/.
async function gsapFile() {
  const vendored = join(HERE, "vendor", "gsap.min.js");
  if (existsSync(vendored)) return vendored;
  try { return createRequire(join(HERE, "package.json")).resolve("gsap/dist/gsap.min.js"); } catch {}
  const GSAP = process.env.GSAP_VERSION || "3.14.2";
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/npm/gsap@${GSAP}/dist/gsap.min.js`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    mkdirSync(join(HERE, "vendor"), { recursive: true });
    writeFileSync(vendored, Buffer.from(await res.arrayBuffer()));
    console.log(`  downloaded GSAP ${GSAP} → engine/vendor/gsap.min.js (cached)`);
    return vendored;
  } catch (e) { fail(`GSAP not found (${e.message}). Run "npm install" in ${HERE}, or put gsap.min.js in ${join(HERE, "vendor")}`); }
}

// the music bed sits well under the voice (about −12 dB, like the reference) and fades at both ends
let bed = "";
const music = spec.music === false ? null : { volume: 0.12, ...(typeof spec.music === "object" ? spec.music : {}) };
if (music) {
  const src = music.src ? join(D, music.src) : cfg.path(brand.music);
  if (!src) console.log("  no music bed (set brand.music in the config, or music.src in beats.json)");
  else if (existsSync(src)) {
    if (!music.src) copyFileSync(src, join(D, "assets/music.mp3"));
    const rel = music.src || "assets/music.mp3";
    const len = probe(join(D, rel));
    const v = +music.volume;
    for (let s = 0, n = 0; s < TOTAL - 0.05; s += len - 2, n++) {          // loop with a 2 s overlap when the recording is longer than the bed
      const d = +Math.min(len, TOTAL - s).toFixed(3);
      const pts = [{ t: 0, v: 0 }, { t: n ? 2 : 1.5, v }, { t: Math.max(d - (s + d >= TOTAL - 0.05 ? 3 : 2), 2.1), v }, { t: d, v: 0 }];
      bed += `\n  <audio id="bed${n || ""}" src="${rel}" data-start="${at(s)}" data-duration="${at(d)}" data-track-index="${5 + (n % 2)}" data-volume="${v}" data-automation='${J({ version: 1, lanes: [{ target: "volume", points: pts }] })}'></audio>`;
    }
  } else console.warn(`! no music bed (${src} missing)`);
}

const face = spec.camera?.face || cfg.presenter.face || "50% 38%";
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<title>${esc(spec.title || video.title || basename(D))}</title>
<!-- generated by engine/build.mjs from beats.json. Edit beats.json and rebuild; hand edits here are overwritten. -->
<script src="assets/vendor/gsap.min.js"></script>
<style>
${FONTS.map(([f, fam, w]) => `@font-face{font-family:"${fam}";src:url("assets/fonts/${f}") format("${{ ".woff2": "woff2", ".woff": "woff", ".ttf": "truetype", ".otf": "opentype" }[extname(f).toLowerCase()] || "woff2"}");font-weight:${w};font-style:normal}`).join("\n")}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;background:#000}
#root{position:relative;width:100%;height:100%;overflow:hidden;background:${tok.bg};font-family:${tok.sans};color:${tok.fg}}
#stage{position:absolute;inset:0;z-index:1;opacity:0;background:radial-gradient(ellipse 75% 60% at 50% 122%,${rgba(tok.accent, 0.3)},${rgba(tok.accent, 0)} 70%),radial-gradient(ellipse 38% 34% at 88% 108%,${rgba(tok.warm, 0.13)},${rgba(tok.warm, 0)} 70%),radial-gradient(ellipse 60% 50% at 50% 30%,${rgba(tok.raised, 0.55)},${rgba(tok.bg, 0)} 75%),${tok.bg}}
#stage .rail{position:absolute;left:160px;right:160px;top:910px;height:2px;background:linear-gradient(90deg,${rgba(tok.accent, 0)},${rgba(tok.accent, 0.55)} 15%,${rgba(tok.accent, 0.55)} 85%,${rgba(tok.accent, 0)});box-shadow:0 0 18px ${rgba(tok.accent, 0.45)}}
#stage .pulse{position:absolute;left:152px;top:903px;width:16px;height:16px;border-radius:50%;background:${tok.hi};box-shadow:0 0 18px 6px ${rgba(tok.accent, 0.8)};opacity:0}
/* the ring around the corner/left camera follows its clipped shape: drop-shadows on the unclipped shell */
#cam-shell{--ring:0;position:absolute;inset:0;z-index:2;filter:drop-shadow(0 0 1.2px ${rgba(tok.accent, "calc(var(--ring) * 1)")}) drop-shadow(0 0 1.2px ${rgba(tok.accent, "calc(var(--ring) * 1)")}) drop-shadow(0 0 28px ${rgba(tok.accent, "calc(var(--ring) * .5)")})}
#cam-wrap{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden;transform-origin:0 0;background:${tok.bg}}
#cam-zoom{position:absolute;inset:0;transform-origin:${face.replace(/\s+/, " ")}}
#cam{display:block;width:100%;height:100%;object-fit:cover}
.beat{position:absolute;inset:0;z-index:3}
.outro-card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding-bottom:60px}
#outro-logo{width:980px;height:auto}
.outro-name{width:auto!important;font-size:120px;font-weight:600;letter-spacing:-0.02em;color:${tok.hi};margin-bottom:150px}
.outro-url{font:500 34px ${tok.mono};letter-spacing:.05em;color:${tok.accent};margin-top:-150px}
${rehearsal ? `#standin{position:absolute;left:28px;top:24px;z-index:4;padding:6px 12px;border-radius:8px;background:${rgba(tok.bg, 0.78)};font:500 18px ${tok.mono};color:${tok.fg}}` : ""}
${css(tok, rgba)}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${at(TOTAL)}" data-width="1920" data-height="1080">
  <div id="stage"><div class="rail"></div><div class="pulse"></div></div>
  <div id="cam-shell"><div id="cam-wrap"><div id="cam-zoom" data-layout-allow-overflow><video id="cam" class="clip" src="${esc(camSrc)}" playsinline data-has-audio="true" data-start="0" data-duration="${at(DUR)}"${camIn ? ` data-media-start="${at(camIn)}"` : ""} data-track-index="0" data-volume="1"></video></div></div></div>
${hosts.join("\n")}${outroHost}${bed}
${rehearsal ? `  <div id="standin">REHEARSAL · stand-in camera</div>` : ""}
</div>
<script>
const tl = gsap.timeline({ paused: true });
${L.join("\n")}
window.__timelines["main"] = tl;
</script>
</body>
</html>
`;
writeFileSync(join(D, "index.html"), html);
writeFileSync(join(D, "qa", "beats-timing.json"), J({ duration: TOTAL, camera: camSrc, outro: outro ? { start: DUR, dur: +outro.dur } : null, rehearsal, beats: beats.map(({ id, type, t0, t1, mode, text, title }) => ({ id, type, t0, t1, cam: mode, text: text || title || "" })), segments: segs }, null, 2) + "\n");

const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
console.log(`${basename(D)}: ${beats.length} beats over ${fmt(DUR)}${rehearsal ? " (REHEARSAL: stand-in camera)" : ""}`);
for (const b of beats) console.log(`  ${b.id}  ${b.type.padEnd(8)} ${fmt(b.t0)}–${fmt(b.t1)}  ${b.mode.padEnd(5)}  ${String(b.text || b.title || (b.items || []).map((x) => x.text || x).join(" · ") || "").slice(0, 60)}`);
const camSecs = segs.filter((s) => isFull(s.mode)).reduce((a, s) => a + s.t1 - s.t0, 0);
console.log(`  camera full frame ${Math.round((100 * camSecs) / DUR)}% of the time (aim for about 25–35%)`);
console.log(`→ index.html. Next: (cd <dir> && npx --yes hyperframes@${pin} check), then node engine/sheet.mjs <dir>`);
