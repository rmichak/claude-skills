---
name: course-video
description: >-
  Build a branded, captioned course video with HyperFrames. It has two modes. (A) Enhance an existing
  screen recording (.mp4) with a branded title card, word-by-word captions, fly-in note panels and on-screen
  code highlights. (B) Build a narrated lecture from a module's slide deck + per-slide voiceover.md: TTS
  narration, each slide a scene, word-by-word captions, in-context line-by-line code highlighting. Drafts use
  free local Kokoro (af_heart @ 0.95); finals can use your own ElevenLabs voice via env vars once the script is
  locked. Brand (palette, fonts, pronunciations) comes from a brand folder (example-brand/ included). Bundles
  the pronunciation rules and the code-animation + keyword-emphasis conventions so videos stay consistent
  without re-explaining. Use whenever the user wants to caption, brand, enhance, narrate, or add
  notes/code-highlights to a course recording, lecture, walkthrough, slide deck, or demo, with phrasings like
  "make a lecture video from these slides", "narrate this module", "add CC and notes to this recording",
  "fly in notes about the commands", or "enhance this walkthrough", even when they don't say "HyperFrames".
  Also trims the front off a recording before enhancing.
---

# Course Video Builder

Produce a branded, captioned course video. In **Mode A** the raw screen recording stays the predominant
full-frame layer. On top of it go a short branded title card, **word-by-word closed captions** transcribed from
the audio, and **fly-in note panels**. The panels surface relevant detail (a command's syntax and flags, or a
concept or step) exactly when the instructor talks about it.

This is a proven pipeline. Per video you mostly edit one config block. The default flow is **proof-first**:
render a short segment, confirm the look, then render the whole thing.

Below, `<SKILL_DIR>` is this skill's folder (e.g. `~/.claude/skills/course-video`).

> **Core principle: point the student's eyes.** Any time a segment is *just code on screen while the instructor
> talks through the logic*, put a visible highlight on the exact thing being discussed. Don't make students hunt
> the page for what "this line" or "that variable" refers to. Draw a box, border or tint around it, synced to when
> it's spoken, and remove it when the topic moves on. A simple highlight or border is enough. Step through the code
> line by line when that helps. See **[Highlight the code being discussed](#4b--highlight-the-code-being-discussed)**.

## Two production modes: pick by what you're handed

- **Mode A: enhance a screen recording.** You have a `walkthrough.mp4`. Overlay a branded title card,
  word-by-word captions, fly-in note panels and code highlights on top of it. This is the **Workflow** section
  below.
- **Mode B: lecture from a slide deck + voiceover.** There's no recording. You have a module's slide deck (HTML
  pages with `class="slide"`, styled by a shared `slides.css`) and a per-slide `voiceover.md`. Generate TTS
  narration, render each slide as a scene, and add word-by-word captions and in-context code highlighting.
  See **[Mode B](#mode-b--build-a-lecture-from-a-slide-deck--voiceover)**, or batch it with
  `engine/build-module.sh` (`engine/README.md`).

Both modes share the **Brand**, **Voice** and **Conventions** sections below.

## Brand (both modes)

All brand values live in one folder holding `brand.json` (plus a human-readable `brand.yaml`, a
`PRONUNCIATIONS.md`, and optionally a logo and `captions.css`). The skill ships `example-brand/`, a neutral
placeholder ("Example College", slate and blue). To use your own:

1. Copy `example-brand/` somewhere outside the skill (e.g. `~/brands/my-school/`), then edit `brand.json`:
   - `brand.name` and `url`
   - `video.palette` (primary, primary_dark, accent, accent_bright, canvas, term_green)
   - `fonts.display` and `fonts.mono`
   - `video.voice.respellings` (whole-word TTS fixes for your terms)
   - optionally a logo (`example-brand/LOGO.md`)
2. Point the skill at it: `export COURSE_VIDEO_BRAND=~/brands/my-school`. You can also pass
   `engine/build-module.sh --brand <dir>`, or copy `brand.json` into the project (Mode A: next to
   `build-data.mjs`; Mode B: the project root).

What reads the brand:
- Mode A's `build-data.mjs` writes the palette and fonts into the `BRAND` block of `index.html`.
- Mode B's `build-lecture.mjs` takes the highlight colour, caption box and caption font from it.
- `build-narration.mjs` applies the respellings.

Without a brand file, the neutral built-in palette applies.

## Voice (both modes)

- **Drafts: Kokoro `af_heart` @ speed 0.95** (free, local, unlimited). Build and review every video in Kokoro
  first: `npx hyperframes tts <file> --voice af_heart --speed 0.95 -o <out>.wav`.
- **Finals (optional): your ElevenLabs voice**, once the script is locked. Run `engine/_scripts/tts-eleven.mjs`
  (copied into each Mode B project). It reads everything from the environment:
  - `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`: **required, never stored in the skill or the project**.
  - optional `ELEVENLABS_MODEL_ID` (default `eleven_turbo_v2_5`), `ELEVENLABS_STABILITY` (0.5),
    `ELEVENLABS_SIMILARITY` (0.75) and `ELEVENLABS_SPEED` (0.92).

  It refuses to spend quota until the script passes the words gate (`references/script-review.md`;
  `SKIP_SCRIPT_REVIEW="<reason>"` overrides it, and the override is logged). Mind your plan's monthly character
  quota: check the remaining characters before voicing a batch, and keep the wav files, because re-generating
  spends them again.
- **When using ElevenLabs, build the narration in clean mode** (`VOICE=eleven node build-narration.mjs`). That
  skips the Kokoro respellings ("pie-thawn" would be read literally) and applies the ElevenLabs-specific ones and
  the quote emphasis instead. Everything downstream (transcribe, captions, code highlight, render) is the same as
  on the af_heart path.
- If the narration is an AI voice (including a clone of the instructor), say so where the video is published
  (`brand.json` `video.voice.disclosure`).

## Humanize generated narration & scripts (both modes): REQUIRED

Any narration or script text **you generate** for a video must go through a humanizer pass before it's used.
Use the `humanizer` skill if it's installed; otherwise do a careful manual pass for AI tells (see the lint in
`references/script-review.md`). TTS faithfully speaks whatever AI-isms you leave in, so an un-humanized script
produces a video that *sounds* AI-written. Steer it toward a spoken, read-aloud teaching voice: this is narration
spoken to students, not an article.

- **What to humanize:** prose **you wrote**. In Mode B that's `voiceover-source.md`. In Mode A it's any note-card
  `summary`/`bullets` and title text you authored.
- **What NOT to humanize:** text transcribed from a real recording. Mode A captions are the instructor's *actual
  spoken words*, so leave them exactly as transcribed.
- **Order matters: humanize the RAW script first, before the mechanical passes.** The Kokoro respellings and
  keyword emphasis (`applyConventions()` in `build-narration.mjs`) and the Whisper caption transcript come
  *after*. So the flow is: write the script → **humanizer pass** → `build-narration.mjs` → TTS. Humanizing after
  the respellings would rewrite "pie-thawn" and the quote/dash emphasis into nonsense.
- **Preserve structure:** the humanizer must keep every `### Slide N` header and the one-block-per-slide split
  intact. Re-run the **count check** afterwards: the headers must still equal the slide count.

## Conventions (both modes): applied automatically by the generators

These are baked into the lecture generators, so you don't re-explain them per video:

- **Pronunciations** (`<brand>/PRONUNCIATIONS.md`; the example is
  [example-brand/PRONUNCIATIONS.md](example-brand/PRONUNCIATIONS.md)). Kokoro respellings:
  - Python → pie-thawn, Kali → kal-ee, elif → el-if, str → stir, `re` → "R E", OOP → "O O P", VS Code, macOS
  - decimals → "…point…", IP/dotted addresses → "…dot…"
  - plus the brand's own `respellings`

  These are **Kokoro-only and skipped for ElevenLabs**, which has its own short list. Add new module-specific
  terms as you confirm them.
- **[references/VIDEO-CONVENTIONS.md](references/VIDEO-CONVENTIONS.md)** covers keyword/operator emphasis:
  - `for` → em-dashes; `while`/`break`/`if`/etc. → quotes; dashes when *defining* an operator.

  It also covers **in-context** code highlighting: a line-by-line highlight bar synced to the narration plus an
  accent window glow on the code block, both cleared once the narration moves on. Palette: accent = "look here",
  green = correct/result, red = error/untaken branch. Inactive overlays stay `visibility:hidden`.

`engine/_scripts/build-narration.mjs` (`applyConventions()`) encodes the pronunciations, keyword emphasis and
IP/decimal handling. `engine/_scripts/build-lecture.mjs` encodes the 2× slide scaling, captions, code
highlights, entrance animations, and the float-safe timing cascade.

## Prerequisites

- `node` ≥ 18, `ffmpeg`, and `npx hyperframes` (the CLI fetches itself). Run `npx hyperframes doctor` if unsure.
- Captions use **local Whisper** (free, offline, word-level timestamps) via `hyperframes transcribe`.
- Kokoro runs in Python through `hyperframes tts`. If `kokoro-onnx` is installed in a non-default Python, export
  `HYPERFRAMES_PYTHON=/path/to/python3`.
- Renders are CPU/GPU and memory heavy. On a low-RAM machine, use `--workers 2` and warn the user that
  `validate`/`inspect` may hit a 10s page-load timeout on large (>250MB) source videos (see Gotchas).

## Workflow (Mode A: enhance a screen recording)

### 1 · Scaffold the project

Keep one folder per video (e.g. `~/Videos/course-videos/<course>/mNN-rec-<topic>/`), not next to the source
video, so there's one copy of everything:

```bash
mkdir -p <video-folder> && cd <video-folder>
npx --yes hyperframes@0.8.164 init build --example blank --non-interactive
mv "<source>.mp4" build/walkthrough.mp4      # move, don't copy: this is the one raw copy (keep mp4s out of git)
cp <SKILL_DIR>/assets/index.html  build/index.html
cp <SKILL_DIR>/assets/build-data.mjs build/build-data.mjs
cp <SKILL_DIR>/assets/design.md   build/design.md
cp "${COURSE_VIDEO_BRAND:-<SKILL_DIR>/example-brand}/brand.json" build/brand.json
mkdir -p build/fonts   # put the brand's .woff2 files here (Inter-Variable.woff2 + JetBrainsMono-Variable.woff2 for the example)
```

The brand values (palette, fonts) come from `build/brand.json`, which `build-data.mjs` writes into
`index.html`. The example brand uses Inter and JetBrains Mono (both SIL OFL; download them from Google Fonts).

### 2 · Transcribe the audio (word-level)

```bash
cd build
npx hyperframes transcribe walkthrough.mp4 --model small.en
```

Use `small.en` only for English audio. For another language, use `--model small --language <code>`; the `.en`
models translate non-English audio instead of transcribing it. The output is `transcript.json`, a flat array of
`{text,start,end}` words. It drives **both** the captions and the note timing.

### 3 · Study the content and find real timings ⚠ most important step

Recordings improvise and diverge from any written script, and Whisper mangles short command tokens. So derive
the notes and their timing from the **actual transcript**, not a lesson plan. Probe it without dumping it into
context, with a small node script:

```js
// probe.mjs — node probe.mjs (inside build/)
import { readFileSync } from "node:fs";
const TRIM = 0; // set to your front-trim seconds
const W = JSON.parse(readFileSync("transcript.json", "utf8")).filter(w => w.start >= TRIM);
const off=[]; let p=0, parts=[]; for(const w of W){off.push(p);parts.push(w.text);p+=w.text.length+1;}
const txt = parts.join(" ");
const at = ci => { let i=0; for(let k=0;k<off.length;k++){ if(off[k]<=ci) i=k; else break;} return i; };
const fmt = t => `${Math.floor(t/60)}:${(t%60).toFixed(1).padStart(4,"0")}`;
const probe = re => { const m=txt.match(re); return m ? `${fmt(W[at(m.index)].start)}  …${txt.slice(Math.max(0,m.index-20),m.index+44).replace(/\s+/g," ")}…` : "NONE"; };
for (const [k,re] of Object.entries({ /* candidate terms → regexes */ })) console.log(k.padEnd(12), probe(re));
```

For each candidate note, confirm three things: it's actually covered, *when* the teaching starts, and how the
term was transcribed. A companion guide or lesson plan tells you what to look for, but trust the transcript for
timing. See [references/note-kb-guide.md](references/note-kb-guide.md) for trigger-design rules.

### 4 · Fill in the config block of `build-data.mjs`

Edit **only** the CONFIG block:
- `TITLE_CARD`: `kicker` (e.g. course code · course name), `title`, `subtitle`, `prompt` (`""` hides the mono
  line), `ghost` (big watermark text, e.g. the course code; `""` for none), `logo` (an image in `build/`; `""`
  for none).
- `TRIM_START`: seconds to drop off the front (0 = none).
- `PROOF`: a `{start,len}` window that contains a couple of notes for the look check.
- `NOTES`: one entry per fly-in card. It's a unified schema in which every field is optional except
  `trigger` + `title`.
  - Command cards use `code:true` + `subtitle` + `syntax`/`example`/`rows`.
  - Concept cards use `kicker` + `bullets`.

  The full field list and trigger guidance are in [references/note-kb-guide.md](references/note-kb-guide.md).

### 4b · Highlight the code being discussed

Whenever a stretch of the recording is **code on screen + the instructor narrating the logic**, don't leave
students scanning for "this line" or "that variable". Put a marker on the exact spot, synced to when it's
spoken, and clear it when the discussion moves on. This is the single biggest comprehension win for code
segments, so treat it as the default, not an extra.

**What a marker is** (cheapest first; a simple one is plenty):
- a **border/box** drawn around the line(s), block, function, or token being discussed;
- a soft **highlight tint** (an accent or green wash) over that region;
- an **arrow / underline** pointing at a single token (a variable, an operator, a flag);
- a **moving highlight that steps line by line** when the instructor walks through execution order. Advance it
  on each "and then…", and dim lines that were skipped (e.g. an untaken `if` branch). Use this when the *flow*
  is the point, not just one line.

**How it's built in this pipeline.** A marker is just another timed overlay, the same mechanism as the fly-in
note panels: a positioned, semi-transparent element over the recording, shown and hidden on the transcript
clock.
- Add a `HIGHLIGHTS` array alongside `NOTES` in `build-data.mjs`. Each entry is
  `{ trigger, atLine|box, style: "border"|"tint"|"arrow", out }`, with the rectangle positioned over the code
  region in the recording.
- The code lives **inside the recorded video**, so you must eyeball the pixel rectangle from a representative
  frame (`ffmpeg -ss <t> -i walkthrough.mp4 -frames:v 1`), then place the overlay there.
- Keep markers `visibility:hidden` when inactive so the WCAG checker skips them (the same rule as notes).
- Trigger and verify the timing from the transcript exactly as for notes (step 3). The highlight should land
  *as* the instructor says it, not before.

**Guidance:**
- One marker at a time per idea; don't light up the whole screen. Move or replace it as the topic moves.
- Match the brand palette: accent for "look here", green for "this is correct/the result", red only for an error
  or skip.
- A border or tint is enough for a held explanation. Save the line-by-line step for genuine execution
  walk-throughs.
- If the instructor edits the code while talking, re-check the rectangle, because the line may have moved.
- Verify every highlight from rendered frames (step 5): it must sit on the right region and clear on `out`.

> Authoring code-execution highlights from scratch (not over a recording)? If the `hyperframes` skill is
> installed, its `references/css-patterns.md` covers seek-safe marker sweeps, circles, underlines and a moving
> line-highlight bar pattern.

### 5 · Proof: generate, validate, render a short segment

```bash
node build-data.mjs proof            # writes data.js, bakes timing + brand into index.html; prints the note map
npx hyperframes lint                 # must be clean
npx hyperframes validate             # WCAG/console check (may time out on huge videos — see Gotchas)
npx hyperframes inspect --at <title,note1,note2,...>   # layout overflow check at hero frames
npx hyperframes render --output renders/proof.mp4 --quality standard --workers 3
```

Then **verify by extracting frames** (don't trust "it rendered") and show the user:

```bash
mkdir -p frames && for t in 2 <note-times>; do ffmpeg -loglevel error -y -ss $t -i renders/proof.mp4 -frames:v 1 frames/p_$t.png; done
```

Read the PNGs and check that:
- the title card is correct,
- notes fly in synced to the terminal or screen,
- captions paint on word by word,
- panels are gone when inactive.

Get the user's OK, or iterate on NOTES and styling.

### 6 · Full render

```bash
node build-data.mjs full
npx hyperframes render --output renders/<Name>.mp4 --quality standard --workers 3
mkdir -p ../final && mv renders/<Name>.mp4 ../final/<folder-name>.mp4
```

Verify the output:
- `ffprobe -show_entries format=duration` should equal the `total` that `build-data.mjs` printed.
- `Capturing frame N/N` should match `total × fps`.
- Spot-check frames at a few note times. If you trimmed, also check a frame just after the title card to confirm
  the recording starts at the trim point.

Report the final path, duration and size.

## Mode B — Build a lecture from a slide deck + voiceover

Use this when there's **no recording**, just a module's slide deck and a per-slide script.
- **Inputs:** a deck HTML (top-level `<div class="slide …">` pages on a shared `slides.css`) and a
  `voiceover.md` with one `### Slide N` (or `## Slide N`) block per deck page.
- **Output:** `final/mNN-lecture.mp4` in the project. Don't copy MP4s into the course repo; record the video in
  something like a `VIDEOS.md` there instead.

The discipline is the same proof-first one, and the two generators do the heavy lifting, so each module is mostly
copy-config-run. **For a whole module or course, `engine/build-module.sh` runs B1–B7 in one go**
(`engine/README.md`). The steps below are the by-hand version.

### B1 · Scaffold

Make a project folder (e.g. `<out>/<course>/mNN-lecture/`), then:
- `npx --yes hyperframes init mNN-lecture --example blank --non-interactive`
- copy the deck's `slides.css` and any images it links → `assets/`
- copy this skill's scripts from **`engine/_scripts/`** → project root: `build-narration.mjs`,
  `build-lecture.mjs`, `tts-eleven.mjs`, `patch-captions.mjs`
- copy `engine/qa/` → `qa/lib/` (the words gate for ElevenLabs)
- copy your brand's `brand.json` → project root
- copy the deck → `deck.html` and the voiceover → `voiceover-source.md` (with `## Slide` headers turned into
  `### Slide`)
- copy the voiceover into the project's `script.md` too. It's the frozen record of what the video says, because
  the course `voiceover.md` keeps changing after the render.

### B2 · Count check (stop if mismatch)

The number of top-level `.slide` pages in `deck.html` must equal the number of `### Slide` blocks in
`voiceover-source.md`. If they differ, reconcile them before going further. Drift here misaligns every scene
downstream.

### B2b · Humanize the script (required, before narration)

Run `voiceover-source.md` through the humanizer pass (see *Humanize generated narration & scripts* above) and save
the cleaned result back to `voiceover-source.md`. Do this **before** B3, because `build-narration.mjs` applies
the Kokoro respellings and has to run on the already-humanized text. The humanizer must keep every `### Slide N`
header. Re-run the **B2 count check** afterwards to confirm the block count still matches the deck.

### B3 · Narration

- Default (af_heart): `node build-narration.mjs` writes `narration/sceneNN.txt` with all conventions applied
  (respellings, keyword emphasis, IP/decimal handling, brand respellings). It logs any leftover `python` or bare
  decimals as a self-check.
- ElevenLabs (only if asked): `VOICE=eleven node build-narration.mjs` gives clean/raw text with no Kokoro
  respellings.

### B4 · TTS

- Default: for each scene, run
  `npx hyperframes tts narration/sceneNN.txt --voice af_heart --speed 0.95 -o assets/audio/sceneNN.wav`.
- ElevenLabs (only if asked):
  `ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… node tts-eleven.mjs`. It loops over every `narration/sceneNN.txt`,
  sends each to ElevenLabs, and converts the result with `ffmpeg` to `assets/audio/sceneNN.wav` (44.1 kHz mono).
  It checks the words gate first.

### B5 · Transcribe (word-level, for captions)

For each clip, run `npx hyperframes transcribe assets/audio/sceneNN.wav --model small.en`, then move the emitted
`transcript.json` to `narration/sceneNN.json`. Whisper usually re-hears the respellings as the real word, so
captions stay correct.

**ElevenLabs only: B5b · Patch captions.** A few ElevenLabs respellings don't survive Whisper: `ell-iff` is heard
as "LIF". Whisper also mis-hears a couple of tokens even when the audio is right (`dict` → "dick", `kwargs` →
"quarks"). Run `node patch-captions.mjs` **after** transcribe and **before** build-lecture. It rewrites those
mis-heard caption tokens back to the correct on-screen spelling and leaves the audio untouched. Quote-emphasized
keywords and operators need no patch, because quotes change only prosody.

### B6 · Generate the composition

`node build-lecture.mjs` writes `index.html` + `assets/cc-data.js`:
- each `.slide` wrapped in a scene and `transform: scale(2)` (origin top-left) to fill 1920×1080 crisply,
- word-by-word captions,
- in-context code-line highlights and window glow in the brand accent,
- entrance animations,
- the float-safe timing cascade (`scene data-duration = sceneDur − 0.01`, to avoid overlap).

### B7 · Lint, render, place

`npx hyperframes lint` must be clean. Then run
`npx hyperframes render --output renders/mNN-lecture.mp4 --quality standard --workers 2`.
- Verify frames: the title, a code slide with a highlight and a caption word, and the wrap.
- Confirm that the `ffprobe` duration ≈ the sum of the clip durations.
- Move the file to the project's `final/mNN-lecture.mp4`.

> **Why the 2× scale:** a typical deck stylesheet is a *print* stylesheet (e.g. 254 mm × 142.9 mm ≈ 960×540 px).
> Wrapping each `.slide` and scaling it 2× fills 1080p while keeping every element addressable for the entrance
> animations, code highlights and caption sync. If your deck is already 1920×1080, drop the scale in
> `build-lecture.mjs` (`.slide-wrap`).

## Gotchas (learned the hard way)

- **Render duration comes from STATIC html attributes**, read at compile time before any runtime JS.
  `build-data.mjs` bakes `data-duration`/`data-media-start` into `index.html` for this reason. If a "full" render
  comes out the length of the proof, you ran `render` without re-running `node build-data.mjs full` first.
  Always regenerate before rendering.
- **Detection is windowed.** A command spoken in a trimmed or discarded section can't claim a card. That's good,
  but it means triggers must match something said *after* `TRIM_START`.
- **Whisper ≠ the script.** Trigger on distinctive spoken phrases, not literal tokens. Verify every note's
  timestamp.
- **Fonts:** self-host the brand fonts. Copy the `.woff2` files into the build's `fonts/`; the template's
  `@font-face` rules load them. Arial/Arimo are *not* in the renderer's font list and will warn and fall back.
- **Contrast false-positives:** note and caption text sits over the video, so inactive overlays are
  `visibility:hidden` and the WCAG checker skips them. Keep that; don't switch to opacity-only.
- **Big videos + low RAM:** `validate`/`inspect` load the page in headless Chrome with a 10s navigation timeout.
  A 290MB video under memory pressure can exceed it. `lint` still works, so verify the layout from rendered
  frames instead, and consider `--workers 2`.
- **Always verify by looking at rendered frames**, never by the render exit code alone.
- **Guardrails** (from `brand.json`): no student names, IDs or grades on screen. Code shown on screen must run
  for real first.

## Regenerating / tweaking later

Everything is regenerable. Edit the `NOTES` or title in `build-data.mjs`, run `node build-data.mjs full`, and
re-render. A brand change only needs `build/brand.json` replaced and `build-data.mjs` re-run. The composition
HTML and `design.md` rarely need touching.
