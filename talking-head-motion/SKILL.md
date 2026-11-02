---
name: talking-head-motion
description: |
  Plan and build a "talking head + motion beats" video: the presenter on camera, cut against branded motion
  graphics that land on the words they say (text pops beside them, chapter cards, numbered tiles, stat cards,
  verdict buttons with a cursor click, screenshots with their face in the corner circle). Writes beats.json from
  the camera transcript and runs the bundled engine (HyperFrames + ffmpeg + local Whisper). Use for intros, topic
  overviews and news round-ups where someone is on camera, or a whole video in that style. Triggers on:
  "talking head with animations", "motion beats", "animate my intro", "beats.json", "talking-head-motion",
  "on camera + motion".
---

# Talking head + motion beats

The engine lives in this skill's `engine/` folder. `engine/README.md` has the full beats.json reference and the
config keys. Below, `<skill>` is this skill's folder (for example `~/.claude/skills/talking-head-motion`) and
`<dir>` is the video's project folder. Read `references/motion-grammar.md` once, for the grammar. The look comes
from the user's config (palette, fonts, logo). Never copy a reference video's colours or type.

## Requirements

- Node 18+, `ffmpeg`/`ffprobe` on PATH, and network access for `npx --yes hyperframes@0.8.168` (the pinned
  HyperFrames CLI). HyperFrames provides `transcribe` (local Whisper), `tts` (local Kokoro), `snapshot` and
  `render`. Nothing is sent to a paid API.
- GSAP comes from `engine/vendor/`, from `npm install` in `engine/`, or a one-time download (engine/README.md).
- Optional, macOS only: Xcode command-line tools for `faces.mjs` (face tracking) and `background.mjs` (swap the
  room without a green screen).
- Optional: `HYPERFRAMES_PYTHON=/path/to/python3` if Kokoro (`kokoro-onnx`) is installed in a non-default Python.
  Kokoro is only for the rehearsal stand-in.

## Voice & branding (fill in once)

Copy `engine/config.example.json` to `engine/config.json`, which is gitignored. A per-project
`<dir>/beats.config.json` or `--config <file>` overrides it.

- `presenter.name`, `presenter.portrait` (a transparent cut-out PNG for the rehearsal stand-in), and
  `presenter.face` (where the face sits in frame).
- `brand.name`, `brand.cta`, `brand.logo`, `brand.music`, `brand.palette`, `brand.fonts`.

Without a config, a neutral dark palette and system fonts are used. Write the talking points in the presenter's
own voice. If they have a style guide (phrases they use, words they avoid), keep it beside the project and read
it before drafting. If a `humanizer` skill is installed, run its pass on the talking points.

## Starting one

Make a project folder with a `script.md` holding a `## Script` section (and, optionally, a `video.json` with a
`title`). The voice is the presenter's own take. Nothing is synthesized for a deliverable. Every on-screen claim
needs a line in `factcheck.md` (the claim, the source URL, the date checked).

```
<dir>/
  script.md            # ## Script — the talking points
  factcheck.md         # every on-screen claim and its source
  raw/camera.mp4       # the take (later)
  assets/shots/        # real screenshots for `shot` beats
```

## 1. Talking points (script.md, "## Script")

Write what the presenter will say, then do the humanizer pass. It's spoken on camera, so write for the beats:

- One idea per paragraph, one to three sentences each. A beat lasts for the sentence it illustrates.
- **Say every number and every list item out loud** ("three tools", "one, your inbox. Two, your calendar").
  Tiles light on spoken numbers, and list rows and pills arrive on spoken words.
- Put a verdict line in each topic ("Should you try it? If…, yes.") when the video judges something.
- Keep it short: an intro or overview runs 1–3 minutes.

For recording, `node <skill>/engine/teleprompter.mjs <dir>` writes `teleprompter.html`, a chunked prompter with
pronunciation boxes (optional `teleprompter.json`). Put one line per chunk in `## Script`.

## 2. The camera

The presenter records the take to `<dir>/raw/camera.mp4` and trims the front first. Until then, a free
rehearsal camera lets the beats be planned and watched: `node <skill>/engine/standin.mjs <dir>`. It reads
script.md with Kokoro over the presenter's portrait (or a plain backdrop), and every frame says REHEARSAL.

Then run `node <skill>/engine/transcribe.mjs <dir>` and read `transcript.md`, which holds the words actually
said. Put mishearings (brand names especially) in `transcript-fixes.json` and re-run the transcribe step.

Optional on macOS:
- `node <skill>/engine/faces.mjs <dir>` tracks the face, so the corner circle follows them.
- `node <skill>/engine/background.mjs <dir> <image>` swaps the room behind them.

## 3. Plan beats.json against transcript.md

Anchor every beat with `"at"` to words that appear in transcript.md. Copy them exactly as Whisper wrote them;
digits and number words both match. Rules, from the grammar:

1. **A new picture every 2–4 seconds** through the dense parts. Leave the presenter full frame for the hook's
   first seconds, for asides and jokes, and for anything personal. Aim for about 25–35% of the running time with
   the camera full frame (the build prints the figure).
2. **On-screen text is a 2–6 word phrase of what they're saying**, never a paraphrase they don't say. Mark one
   `*accent*` word per phrase, the word that carries the point.
3. **Pick the beat by what the sentence does:**
   - a number → `stat` (or `pop` with `count` while they're on camera)
   - "N things" → `tiles` with `labels`
   - a new topic → `chapter` (`n` of `of`)
   - a list → `list`
   - a two-word contrast → `pills`
   - a process → `flow`
   - a judgement → `verdict`
   - "look at this" → `shot` (a real screenshot with `source`)
   - the point of the section → `headline`
   - a person's words → `quote`, only if they're in factcheck.md
4. **Vary the camera:** don't run more than two `off` beats in a row without the presenter (`pip`, `split` or a
   gap). `pop` keeps them on screen and reframes them aside. The type's default camera is usually right; override
   it with `cam`.
5. **Agenda = recap.** If the intro shows `tiles` for the topics, close with the same `tiles` lit (`"light": "all"`).
6. Use `until` when a beat has to run past its sentence (lists, flows, verdicts), and `clickAt` to land the
   verdict click on the word that decides it ("yes").
7. Images go under `<dir>/assets/shots/`: real screenshots only, each with `source`.
8. End with `"outro": { "dur": 7 }` for a brand end card (logo or name + CTA from the config).

## 4. Build and look

```bash
node <skill>/engine/build.mjs <dir>          # fails loudly with the next transcript words if an anchor isn't said
(cd <dir> && npx --yes hyperframes@0.8.168 check)   # must pass
node <skill>/engine/sheet.mjs <dir>          # one still per beat → qa/sheets/contact-sheet-*.jpg
```

Read the contact sheet, then fix and rebuild. Check that:
- no text crosses the presenter's face,
- nothing sits under the corner circle (bottom-right),
- every accent word is the right one,
- no beat shows a sentence before it's said.

For motion, `node <skill>/engine/finish.mjs <dir> --draft` renders `renders/<folder>.draft.mp4`.

## 5. Finish and review

Rendering and mastering only happen on the real take. `node <skill>/engine/finish.mjs <dir>` renders, masters to
−14 LUFS / −1 dBTP, writes `renders/captions.srt` + `.vtt` from the transcript, and puts the result at
`final/<folder>.mp4`. It refuses a rehearsal build.

Then a review pass by someone (or a fresh agent) who didn't build it. They watch the draft or final and the
contact sheet, and check:
- every on-screen claim against factcheck.md,
- every screenshot's source credit,
- that text sync, face clearance and loudness are right.

The presenter gives the final sign-off.

With the presenter's real voice and face, motion graphics alone aren't altered or synthetic content. A rehearsal
stand-in (synthetic voice) must never be published. Check the platform's altered-content setting on upload.
