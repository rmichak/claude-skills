---
name: code-demo-video
description: >-
  Use when the user wants a short coding video without screen recording — a simulated VS Code
  window where code types itself with TTS voiceover and terminal output, for an LMS embed, YouTube,
  or splicing into a bigger lecture video. Triggers: "code demo video", "typing demo video",
  "make a video showing this code", "explainer video for <topic>", "assignment walkthrough
  video", "lab walkthrough video", "pause-and-try video", "simulated VS Code video",
  "interactive coding example video" — for any course or audience and any language (Python,
  Bash, JavaScript), even when HyperFrames isn't mentioned. Narration defaults to the free local
  Kokoro voice; ElevenLabs (e.g. your own voice clone) is optional via environment variables.
---

# Code Demo Video Builder

Builds a 30s–10min video of someone "coding" in VS Code — except nobody coded on camera. The
editor window is a **measured copy of the real app** (VS Code 1.138 on macOS 26, Dark 2026: real
geometry, fonts, icons, theme colors, and code colors read from VS Code itself; the render is bit-identical
to real captures of the app), the typing is character-by-character animation, the terminal output is
real program output, the voice is TTS, and word-synced captions are burned in. Everything is
generated from one spec file; re-rendering after a change takes ~30 seconds.

**Two modes:**

- **Explainer** — narrated concept demo: code types while the voice explains, terminal proves
  the result, callouts point at what matters. 60–120s.
- **Guided walkthrough** — steps a student through an assignment. Each step: demo with example
  values → **`pauseOverlay` "STEP n OF m — Your turn"** card (small, bottom-right, code stays
  visible) → recap with the student's code prefilled. For beginner labs this is the
  **detailed** form: read the assignment (doc scenes) → create the file (`fileCreate`) → build it,
  explaining every term → run. ~8 min.

## Requirements

| What | Why |
|---|---|
| macOS | the VS Code window uses the Mac's own SF and Menlo fonts (copied from `/System/Library/Fonts` into each project at build time; Apple fonts are never bundled) |
| Node.js 18+ | the builder and the lab-kit scripts (no npm dependencies) |
| HyperFrames CLI (`npx hyperframes`) | `tts` (Kokoro), `transcribe` (Whisper), `lint`, `validate`, `inspect`, `snapshot`, `render` |
| ffmpeg + ffprobe | audio conversion, durations, mastering, frame extraction |
| Python 3 + `pip install fonttools` | Menlo extraction; `repl_harness.py` (real Python output for shell beats); `pycodestyle` and `Pillow` are optional (QA / pixel tests) |
| VS Code + `puppeteer-core` | only for the measuring kit (`assets/vscode/tools/`: `tokens.mjs` for real code colors, pixel tests) |

### Environment variables

| Variable | Needed for | Default |
|---|---|---|
| `ELEVENLABS_API_KEY` | ElevenLabs narration (`tts-eleven-beats.mjs`, `pick-take.mjs`) | — (Kokoro needs no key) |
| `ELEVENLABS_VOICE_ID` | the ElevenLabs voice to use (your clone or a library voice) | — (required with ElevenLabs; no built-in default) |
| `ELEVENLABS_MODEL_ID` | ElevenLabs model | `eleven_turbo_v2_5` |
| `KOKORO_VOICE`, `KOKORO_SPEED` | the Kokoro voice | `af_heart`, `0.95` |
| `OUT_DIR` / `DEST` | where `new-lab.sh` creates a project (`DEST` = the exact folder) | current directory |
| `STARTER` | which example spec `new-lab.sh` copies (`security-toolkit`, `threat-log`, `lesson`) | `security-toolkit` |
| `BRANDS_DIR` | folder of `<brand-id>/brand.json` profiles for `branding: "<id>"` | `brands/` in the project or any parent |
| `CODE_DEMO_VIDEO_DIR` | where this skill lives, if not `~/.claude/skills/code-demo-video` | — |
| `SKIP_SCRIPT_REVIEW="<reason>"` | voice with ElevenLabs without a passing script review (logged to `qa/overrides.log`) | — |
| `VOICE_MARKERS` | optional presenter profile for the narration lint (see `references/script-review.md`) | `qa/voice-markers.json` if present |

Keep keys in your shell environment or a secrets manager; never write them into a spec or a committed file.

## Voice & branding (fill in for your channel or course)

The skill ships brand-neutral. Decide these once and write them here (or in your own notes) so every video matches:

- **Draft voice:** Kokoro `af_heart` @ 0.95 (free, local). Use it for every draft; it can also be the final voice.
- **Final voice:** _e.g. Kokoro, or ElevenLabs voice `<your voice id>` at speed `<0.92–1.09>` with `sentencePause` `<0–0.7>`_.
  A slower final read (speed ~0.92 plus ~0.7 s at each sentence end, about 160 wpm) is easier for beginners to follow.
- **Presenter style:** _how you open, words you use or avoid (feed these to `VOICE_MARKERS` if you like)_.
- **Branding:** `neutral` (blue/gold) by default; for your own colors, emblem and fonts create a `brand.json`
  (`references/spec-format.md`, "Brand scenes") and set `branding` to its id or path. The VS Code editor itself is NEVER rebranded.
- **Pronunciations:** keep a respelling list for TTS (the `course-video` skill ships a generic `PRONUNCIATIONS.md`
  you can start from) and mirror every respelling in the spec's `captionFixes`.
- **Windows reminder policy:** say "on Windows, type python" at every run (default), or once at the first run (rule 11 in `assets/lab-kit/EDITOR.md`).

## Defaults

| Setting | Default |
|---|---|
| Canvas / fps | 1920×1080, 30fps, H.264 mp4 |
| Voice | Kokoro `af_heart` @ 0.95 (`npx hyperframes tts`). ElevenLabs optional: `tts-eleven-beats.mjs` with `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`; the spec's `voiceSpeed` / `sentencePause` tune the pace |
| Branding | `neutral` (blue/gold), or your `brand.json`. The VS Code editor itself is NEVER rebranded |
| Captions | ON — word-synced, auto-built from Whisper transcripts |
| Typing speed | **8 cps code, 8 cps terminal — simulate a person typing each character. NEVER instant-fill a line (no cps > ~14, even for `====` borders).** Don't raise to "fit"; split the beat |
| Line focus | AUTO — the line being typed gets a blue left-rail + tint, released when focus moves to the next line. Disable with `focus: false` at spec top level |
| Pauses | `pauseOverlay` (small card over the editor) — NOT the full-screen `pause` scene. Code stays visible while they pause |
| VS Code window | The real app, measured (`references/vscode-pixel-perfect.md`): macOS title bar + command center, activity bar, Explorer, tabs, breadcrumbs, gutter, minimap, overview ruler, sticky scroll, zsh terminal panel, status bar. Code colors come from VS Code itself (`vscode/tools/tokens.mjs`) |
| Length | explainer 60–120s · quick walkthrough ≤ 4 min · **detailed beginner walkthrough ~8 min** · clipMode 20–60s |
| Code that doesn't fit | 15 lines × 53 chars by default. A longer program: `editorFontSize` 13 → 12 (17 lines × 62), then `windowWidth` up to 920 (70 chars); `terminalFontSize` 12 for long output. Real app settings, measured (references/vscode-sim.md, Space) |

**Pace it slow, explain every line — and every Python term.** Each typed line gets its own spoken
explanation; the focus border shows which line you mean, one gold callout per concept. For
beginners, define terms the first time they appear (comment, variable, string, `print()`,
f-string, `{ }`, snake_case). The build warns if a beat types ≥2 lines with <~8 narration words/line.

**Beginner-walkthrough must-dos (see references/narration-and-pause-cards.md):**
read the assignment first (doc scenes) · start from an empty folder and show the exact New-File
steps · explain how to open the terminal (Terminal menu / Ctrl+\`) when it first appears · mention
the Python-extension Run button + syntax highlighting once · `pauseOverlay` so code stays visible ·
**at every pause, everything the step asks them to type is ON SCREEN**: the terminal never covers the code
(close it with `{do:"terminal-close"}` = Cmd+J before the card), the step's first lines aren't scrolled off, and a
step longer than ~15 lines becomes two pauses. The build fails otherwise. · nothing cut off (terminal is sized
for full output; keep ≤13 code lines per editor scene).
**Windows students: `python`, not `python3`.** The video runs on a Mac, so it types `python3`, but on Windows the
command is just `python`. Every time a student is told to type `python3` (to start the shell, restart it, or run the
program), the voice says so ("on Windows, type python instead") and the on-screen overlay or pause card shows the
Windows form (`Windows: python host_sweep.py`). Don't rely on small print alone. For a long course whose viewers
already know this, you can say it ONCE at the first run instead; YOUR TURN and Run-it cards still show the Windows
form (EDITOR.md rule 11).

## The VS Code window is the real app — keep it that way

The goal is a window that is "pixel perfect to the real app, so it's hard to tell it's not real." It is
built from measurements of VS Code itself and verified with a pixel diff. Standing rules:
- **Never draw or restyle VS Code chrome by hand.** Geometry, fonts and colors live in `assets/vscode/`
  (`vscode-window.css`, `vscode-window.mjs`, `theme-*.css`), measured from the live app with
  `assets/vscode/tools/`. If something looks off, re-measure it (`look.mjs`) — don't eyeball a fix.
- **Code colors come from VS Code:** after the program files exist, run
  `node <skill>/assets/vscode/tools/tokens.mjs <files>` (→ `qa/vscode-tokens.json`). The build
  warns `⚠ no real VS Code colors for:` on any line it had to color with the fallback tokenizer; fix those.
- **Show real UI states, not effects:** Explorer hover + inline New File box, tabs, the panel opening
  instantly, the real cursor, shell-integration dots, the debugger's stack-frame line. Annotations (red marks,
  gold callouts, cards) are the only non-VS-Code pixels.
- **Proof:** `assets/vscode/tools/state-test.sh all` renders the editor, terminal and Explorer name-box states with
  HyperFrames and diffs them against real captures (`assets/vscode/reference/`): editor and name box are
  bit-identical (max difference 0/255), the terminal is within 1/255. Run it after ANY change to the window
  CSS/DOM/runtime. The captures are not shipped; make them once with your own VS Code
  (`assets/vscode/reference/README.md`).
- The fonts are the Mac's own SF + Menlo, copied into each project's `vscode/` by the build (Apple fonts: they
  stay local, never in the skill). HyperFrames would otherwise swap them for web look-alikes.

## Prerequisite skills — invoke, don't duplicate

- `hyperframes` — composition rules (only needed if hand-tweaking the generated HTML)
- `hyperframes-cli` — lint / inspect / render commands
- `hyperframes-media` — `tts` and `transcribe` usage
- `humanizer` (optional, recommended) — the narration pass before any paid voice

## Lab walkthroughs ("instructor does the lab live"): use the lab kit

For a walkthrough of a programming lab (code-along pause steps, a debugger-style trace, live Python-shell
practice), **follow `references/lab-walkthrough-process.md` step by step**. Scaffold with
`bash <skill>/assets/lab-kit/new-lab.sh <project-name> [parent-dir]`. The kit adds:
- `lab-helpers.mjs`: real VS Code token colors (`qa/vscode-tokens.json`, fallback tokenizer), word-synced
  `at("phrase")`, the T/P/C/H/S/V helpers, and **M/MD/MO/MC red-box
  marks**. These are mandatory: box exactly the code, cell or output the voice is referencing, as it's said
- `vscode/`: the real-app VS Code window (CSS, DOM builder, theme, codicon/seti fonts, traffic lights)
- `tts-kokoro-beats.mjs`: the free Kokoro narration (af_heart @ 0.95) of every beat, cached, plus `audio/kokoro-draft.mp3` to listen to
- `tts-eleven-beats.mjs`: optional ElevenLabs narration of the same beats, same file names, cached, with `SAY` voice-only respellings (tuple → "toople")
- `qa/lib/`: the narration lint + words gate (`engine/qa/`), which `tts-eleven-beats.mjs` runs before any paid take
- example specs: `example-lab-security-toolkit.spec.mjs` (extended, two files, shell practice; the default),
  `example-lab-threat-log.spec.mjs` (one file, Variables-panel trace), `lesson-starter.spec.mjs` (a YouTube course
  lesson in nine parts with `sting` / `recap` brand scenes; reads an optional `lesson.json`)
- `qa-editor.mjs`: the automated editor checks
- `EDITOR.md`: the reviewer sign-off

**The EDITOR sign-off is mandatory before delivery:** `qa-editor.mjs` on the rendered mp4 (0 FAIL),
then an independent reviewer subagent working through `EDITOR.md` (including rule 9, no AI-sounding narration),
which writes `qa/editor-signoff.md` = PASS. A single on-screen misspelling is what students notice, so never skip it.

## Workflow

**1 · Intake.** Mode, topic (or read the assignment file + rubric for walkthroughs), language,
branding, target length, voice. For walkthroughs: map rubric items → pause-card steps.

**2 · Write the beat script.** Per-beat narration at ~2.5 words/sec (references/narration-and-pause-cards.md),
respelled for TTS. **Show the user the script + beat list for approval BEFORE generating any audio** — it's the
cheapest iteration point. Before a paid ElevenLabs take, run the `humanizer` skill on the narration and the script
review (`references/script-review.md`; `tts-eleven-beats.mjs` refuses without it). Kokoro drafts don't need it.

**3 · Scaffold.** Lab walkthroughs: `new-lab.sh` (above). Quick explainers:
```bash
npx hyperframes init <project-name> --example blank --non-interactive
cd <project-name>
cp <skill>/assets/template.html.src <skill>/assets/build-demo.mjs .
mkdir -p vscode && cp <skill>/assets/vscode/{codicon.ttf,seti.woff,letterpress-dark.svg,tlights.svg,tlights-edited.svg,pointer.svg,minimap-atlas-2x.hex,vscode-window.css,vscode-window.mjs,theme-dark-2026.css} vscode/
mkdir -p fonts audio && cp <skill>/assets/fonts/BricolageGrotesque-Variable.woff2 fonts/
```
The `.src` extension is load-bearing — a second root `.html` with `data-composition-id`
makes lint fail with `multiple_root_compositions`.

**4 · Write `demo.spec.mjs`.** Schema: references/spec-format.md. Hand-tokenize code per
references/syntax-colors.md (or use real VS Code colors via `tokens.mjs`). Start from `assets/example-explainer.spec.mjs` or
`assets/example-walkthrough.spec.mjs`. Add every respelling to `captionFixes`.

**5 · TTS per beat.** Beat i (0-based) with id X → `audio/vo-{i+1, 2 digits}-X.wav`:
```bash
npx hyperframes tts "<beat narration>" --voice af_heart --speed 0.95 --output audio/vo-01-title.wav
```
Only regenerate clips whose narration changed. (Lab-kit projects: `node tts-kokoro-beats.mjs` does steps 5–6 for every beat.)

**6 · Transcribe per beat (captions).** Transcribe writes `audio/transcript.json` (next to
the input) — rename it after each run:
```bash
npx hyperframes transcribe audio/vo-01-title.wav --model small.en   # English narration
mv audio/transcript.json audio/vo-01-title.json
```

**7 · Build.**
```bash
node build-demo.mjs            # → index.html + beat map + warnings   (--help for options)
```
Fix every warning (raise `cps`, adjust `holdAfter`, add missing transcript), re-run.

**8 · Quality gates.**
```bash
npx hyperframes lint           # must be 0 errors; only composition_file_too_large is acceptable
npx hyperframes validate       # WCAG contrast + console errors (GSAP "target not found" = bug)
npx hyperframes inspect --at <times from the beat map>
```

**9 · Render.**
```bash
npx hyperframes render --output renders/<course>-<module>-<slug>.mp4 --quality standard
```
**For YouTube, render the final take in 4K:** `--resolution landscape-4k --quality looks`. Chrome draws the same
composition at device scale 2, so nothing moves, and the code text gets twice the pixels. A 1080p upload of a code
video looks fuzzy on YouTube: YouTube re-encodes 1080p screen content at about 0.5 Mbps, while a 4K upload gets the
better codec and more bits at every quality, 1080p included. Drafts can stay 1080p. A 4K take of the same build
needs a quick editor re-check (same audio and captions, new take-bytes).

**10 · REVIEW — watch the video, frame by frame (MANDATORY — do NOT skip or deliver without it).**
Extract a frame at EVERY beat midpoint (and a few extra frames inside long beats — file-create,
each pause, the run output) and READ each one. This is a real QA pass, not a formality. Check every frame against
this checklist:

  1. **Nothing cut off.** No callout, code line, terminal output line, doc text, or card may touch
     or cross the right/bottom edge. The full terminal output (every line + trailing prompt) must
     be inside the panel. Doc-sheet text must not overflow the sheet. If anything is clipped → fix
     (right-anchored callouts handle this automatically; for output raise the terminal room / fewer
     code lines; for docs shorten the section).
  2. **Pause card never overlaps code.** The editor auto-shrinks so the card sits in clear space —
     confirm no code is under the card and the code is still legible (smaller, to the left).
  3. **Voiceover matches what's on screen.** Read the caption in the frame and confirm the visual
     matches the words AT THAT MOMENT: when narration says "click the New File icon", the New File
     redbox is firing and the name is about to type; when it says "press enter, it opens", the tab
     appears; when it names a line/term, THAT line is lit / being typed. Re-time actions (`at`,
     `fileCreateAt`, `fileOpenAt`, `terminal-open` time, redbox/stepsOverlay `at`) so the picture
     tracks the words. Misalignment is a defect, not a nicety.
  4. **Captions spelled right** (check `captionFixes`), pause cards complete, redboxes on the right
     element, doc pages readable, syntax colors correct, focus border on the line being discussed.

Iterate (fix → rebuild → re-render → re-review) until a full pass is clean. Only then deliver the
mp4 path + beat map. When building several modules, run this review on EACH one — a clean lint and
inspect do NOT replace watching the frames.

## Embedding

- **LMS (Canvas, Moodle, …)**: upload/embed the mp4 directly; keep ≤ 4 min; descriptive filename
  (`m02-variables-explainer.mp4`).
- **Inside a bigger video**: set `clipMode: true` (or `node build-demo.mjs --clip`) — title and
  outro are dropped, 0.5s hold frames are added at both ends for clean splice points, no final fade.
- **YouTube**: `burnCaptions: false` and upload `final/<slug>.srt` (lab kit: `node finish-lab.mjs` masters to −14 LUFS
  and writes the captions and chapters).

## Gotcha quick list (details: references/gotchas.md)

audio data-duration is built, never hand-typed · fromTo not from · finite repeats only ·
transitions end in visibility kills · glows are data-layout-ignore · local woff2 fonts only ·
keep the SRI'd GSAP tag · rebuild after every spec/audio change · deterministic JS only ·
typing doesn't rewind when scrubbing (renderer is fine) · always read rendered frames.

## Files

| Path | What |
|---|---|
| `assets/template.html.src` | battle-tested composition shell: VS Code chrome, all scene kinds, token CSS, caption layer, runtime (typeInto/blink/transitions) |
| `assets/build-demo.mjs` | spec → index.html: ffprobe, timing cascade, scene/audio/caption generation, beat map |
| `assets/example-explainer.spec.mjs` | working ~35s example (hello-world) |
| `assets/example-walkthrough.spec.mjs` | working ~80s pause-card example |
| `assets/fonts/` | bundled Bricolage Grotesque variable woff2 + its `OFL.txt` |
| `assets/lab-kit/` | the lab walkthrough kit (scaffold, helpers, TTS, QA, EDITOR.md, example specs) |
| `engine/qa/` | narration lint + words gate (`narration.cjs`, `gate.mjs`); `new-lab.sh` copies it to each project's `qa/lib/` |
| `assets/vscode/` | the real-app VS Code window: `vscode-window.css/.mjs`, `theme-dark-2026.css`, codicon/seti fonts, letterpress, traffic lights |
| `assets/vscode/tools/` | measuring kit: throwaway VS Code (`launch.sh`/`stop.sh`), `tokens.mjs` (real code colors), `state.mjs`, `measure.mjs`, `look.mjs`, `glyphs.mjs`, `theme-css.mjs`, `state-test.sh` (+ `state-tests/`), `pixel-test.sh` + `diff.py`, AppKit helpers (`*.swift`; `activate` is compiled from `activate.swift` on first use) |
| `references/spec-format.md` | full spec schema + timing model + build warnings + brand.json |
| `references/lab-walkthrough-process.md` | the repeatable lab walkthrough process |
| `references/script-review.md` | the humanizer + independent script review that gates paid narration |
| `references/vscode-pixel-perfect.md` | how the window copies the real app, how to re-measure, the pixel test, the gotchas |
| `references/vscode-sim.md` | window anatomy, what the build derives, space limits, hard rules |
| `references/syntax-colors.md` | legacy Dark+ token tables (the window now uses real VS Code colors; see vscode-pixel-perfect.md) |
| `references/narration-and-pause-cards.md` | script math, pause-card + recap patterns |
| `references/gotchas.md` | the 14 failure modes and their fixes |

## Attribution / third-party assets

| Asset | Source | License |
|---|---|---|
| `assets/fonts/BricolageGrotesque-Variable.woff2` | Bricolage Grotesque, © 2022 The Bricolage Grotesque Project Authors (github.com/ateliertriay/bricolage) | SIL Open Font License 1.1 (`assets/fonts/OFL.txt`) |
| `assets/vscode/codicon.ttf` | Codicons, the VS Code icon font, © Microsoft Corporation (github.com/microsoft/vscode-codicons) | icons CC BY 4.0, code MIT |
| `assets/vscode/seti.woff` | Seti UI file-icon font as shipped in VS Code's `theme-seti` extension, © Jesse Weed (github.com/jesseweed/seti-ui) | MIT |
| `assets/vscode/letterpress-dark.svg`, `minimap-atlas-2x.hex`, the colors in `theme-dark-2026.css` | taken from Visual Studio Code / Monaco (github.com/microsoft/vscode), © Microsoft Corporation | MIT |
| `assets/vscode/tlights.svg`, `tlights-edited.svg`, `pointer.svg` | original drawings of the window buttons and arrow pointer, made for this skill (no Apple artwork is shipped). For pixel-exact captures, `tools/tlights.swift` / `tools/pointer.swift` render your own Mac's versions locally; point the references at their output if you use them. | same license as this repo (MIT) |

Full license texts for the MIT-licensed assets are in [`assets/vscode/THIRD-PARTY-NOTICES.md`](assets/vscode/THIRD-PARTY-NOTICES.md).

Visual Studio Code is a trademark of Microsoft Corporation; macOS is a trademark of Apple Inc. This skill is not
affiliated with or endorsed by either. The VS Code window is a measured simulation for teaching videos.
