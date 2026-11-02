// Shared by every engine script: find the project folder and load the presenter/brand config.
//
// A project is a folder holding script.md, beats.json, raw/camera.mp4 and the generated files. The scripts accept
// that folder or any folder inside it: they walk up (at most 4 levels) to the nearest folder with a beats.json,
// video.json or script.md.
//
// Config (presenter, brand, palette, fonts, logo, music) is looked up in this order, first one found wins:
//   1. --config <file> on the command line
//   2. $BEATS_CONFIG
//   3. <project>/beats.config.json
//   4. <engine>/config.json            (copy config.example.json there and edit it once)
//   5. the neutral defaults below
// The file is deep-merged over the defaults, so it only needs the keys you change. Relative paths in it (logo,
// music, portrait, font files) resolve against the config file's own folder.
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ENGINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const HYPERFRAMES_PIN = "0.8.168";   // the HyperFrames CLI version this engine was built and tested against

export const DEFAULTS = {
  presenter: {
    name: "the presenter",        // used in messages and the teleprompter
    portrait: null,               // a cut-out PNG of the presenter for the rehearsal stand-in (standin.mjs)
    face: "50% 38%",              // where the face sits in the camera frame (x% y%); beats.json camera.face overrides
  },
  brand: {
    name: "",                     // shown on the end card when there's no logo
    cta: "",                      // the line under the logo on the end card (a URL or handle)
    logo: null,                   // PNG/JPG/SVG for the end card
    logoKeyBackground: false,     // true: key out a solid background sampled from the logo's top-left corner
    music: null,                  // an audio file for the music bed under the voice (none when null)
    palette: {
      background: "#0f1216", surface: "#171b21", raised: "#212730",
      accent: "#5b9dff", accentDeep: "#2f6fd1", warm: "#f2a93b", success: "#2fbf71",
      foreground: "#e6e8eb", muted: "#9aa3ad", highlight: "#f5f7fa",
    },
    fonts: {
      // family: the CSS family name; file: a .woff2/.ttf to embed (else the family must be installed, or the
      // system stack is used); weight: the @font-face weight range
      sans: { family: null, file: null, weight: "100 900" },
      mono: { family: null, file: null, weight: "500" },
    },
  },
  hyperframes: HYPERFRAMES_PIN,
  kokoro: { voice: "af_heart", speed: 0.95 },   // the free local voice for the rehearsal stand-in
};

export const readJSON = (f, d) => {
  try { return JSON.parse(readFileSync(f, "utf8")); }
  catch (e) { if (d !== undefined) return d; console.error(`✗ ${f}: ${e.message}`); process.exit(1); }
};

// the project root: the nearest folder (this one or up to 4 above) with a beats.json, video.json or script.md
export function projectDir(arg) {
  let d = resolve(arg || ".");
  for (let i = 0; i < 5; i++) {
    if (["beats.json", "video.json", "script.md"].some((f) => existsSync(join(d, f)))) return d;
    const up = dirname(d);
    if (up === d) break;
    d = up;
  }
  return resolve(arg || ".");
}

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) out[k] = isObj(v) && isObj(a[k]) ? merge(a[k], v) : v;
  return out;
}

// --config <file> wins; then $BEATS_CONFIG, <project>/beats.config.json, <engine>/config.json, the defaults
export function loadConfig(D, argv = process.argv.slice(2)) {
  const flag = argv.includes("--config") ? argv[argv.indexOf("--config") + 1] : null;
  const candidates = [flag && resolve(flag), process.env.BEATS_CONFIG && resolve(process.env.BEATS_CONFIG),
    D && join(D, "beats.config.json"), join(ENGINE, "config.json")].filter(Boolean);
  const file = candidates.find((f) => existsSync(f));
  if ((flag || process.env.BEATS_CONFIG) && file !== candidates[0]) {
    console.error(`✗ config file not found: ${candidates[0]}`); process.exit(1);
  }
  const cfg = merge(DEFAULTS, file ? readJSON(file) : {});
  const base = file ? dirname(file) : ENGINE;
  cfg.file = file || null;
  cfg.path = (p) => (p ? (isAbsolute(p) ? p : resolve(base, p)) : null);
  return cfg;
}

// the colour tokens every beat and stylesheet uses
export function tokens(cfg) {
  const p = cfg.brand.palette;
  return {
    bg: p.background, surface: p.surface, raised: p.raised, accent: p.accent, accentDeep: p.accentDeep,
    warm: p.warm, ok: p.success, fg: p.foreground, muted: p.muted, hi: p.highlight,
    sans: fontStack(cfg.brand.fonts.sans.family, 'system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif'),
    mono: fontStack(cfg.brand.fonts.mono.family, 'ui-monospace,"SF Mono",Menlo,Consolas,monospace'),
  };
}
const fontStack = (family, fallback) => (family ? `"${String(family).replace(/"/g, "")}",${fallback}` : fallback);

export const rgba = (hex, a) => {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h.slice(0, 6), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
};

// the HyperFrames CLI version: the project's video.json, then the config, then the tested pin
export const pinFor = (D, cfg) => readJSON(join(D, "video.json"), {}).hyperframes || cfg.hyperframes || HYPERFRAMES_PIN;

// --help / -h: print the usage and exit 0
export function usage(text, argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) { console.log(text); process.exit(0); }
  return text;
}
// the first positional argument (skipping flags and the values of flags that take one)
export function positional(argv, valued = ["--config"]) {
  return argv.filter((a, i) => !a.startsWith("--") && !valued.includes(argv[i - 1]));
}
