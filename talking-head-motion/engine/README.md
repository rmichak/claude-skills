# engine: a talking head + motion beats

The engine behind the `talking-head-motion` skill. The presenter's recording plays start to finish with its own
sound. Branded beats land on the words they say, and the camera moves between full frame, a punch-in, the corner
circle and a card on the left. Colours, fonts, the logo and the music come from the config (below). Nothing in the
engine names a colour. The skill's `SKILL.md` covers how to plan the beats, and `../references/motion-grammar.md`
explains the style.

Every script takes the project folder (or any folder inside it) and prints its usage with `--help`.

## The run

```bash
E=<skill>/engine                          # this folder
node $E/teleprompter.mjs <dir>            # optional: a chunked teleprompter page for recording the take
node $E/standin.mjs   <dir>               # optional: free rehearsal camera from script.md (before the presenter records)
node $E/transcribe.mjs <dir>              # Whisper word timings → narration.words.json + transcript.md
node $E/faces.mjs      <dir>              # optional, macOS: where the face is (Vision) → faces.json
node $E/background.mjs <dir> <image>      # optional, macOS: swap the room behind the presenter → raw/camera-bg.mp4
# plan beats.json against transcript.md (the skill)
node $E/build.mjs      <dir>              # → index.html + compositions/bNN.html + qa/beats-timing.json
(cd <dir> && npx --yes hyperframes@0.8.168 check)
node $E/sheet.mjs      <dir>              # one still per beat → qa/sheets/
node $E/finish.mjs     <dir>              # render, master −14 LUFS, captions, final/<folder>.mp4 (--draft: renders/ only)
```

`finish.mjs` refuses a rehearsal build unless it gets `--draft`. Only a real `raw/camera.mp4` goes to `final/`.

## Requirements

- **Node 18+** (uses the built-in `fetch`). The engine itself has no npm dependencies to install.
- **ffmpeg / ffprobe** on `PATH`.
- **HyperFrames CLI**, run through `npx --yes hyperframes@<pin>`. The pin defaults to `0.8.168`, the version this
  engine was tested with. Set `"hyperframes"` in the config or in a project `video.json` to change it. HyperFrames
  also provides `transcribe` (local Whisper), `tts` (local Kokoro), `snapshot` and `render`.
- **GSAP** (animation runtime, not bundled because it has its own license). `build.mjs` uses
  `engine/vendor/gsap.min.js` if present, else the `gsap` npm package (`npm install` in this folder), else it
  downloads `gsap@3.14.2` once from jsDelivr into `engine/vendor/` (set `GSAP_VERSION` to change it).
- **Kokoro** (optional, rehearsal only): `hyperframes tts` runs it with the first `python3` on `PATH`. If
  `kokoro-onnx` lives in another Python, export `HYPERFRAMES_PYTHON=/path/to/python3`. If Kokoro fails, the
  stand-in falls back to the macOS `say` voice.
- **macOS + Xcode command-line tools** (optional) for `faces.mjs` and `background.mjs`, which run Swift scripts
  against Apple's Vision framework (`lib/faces.swift`, `lib/personmask.swift`).

## Config

The presenter and brand live in one JSON file. Lookup order, first found wins:
`--config <file>`, then `$BEATS_CONFIG`, then `<project>/beats.config.json`, then `engine/config.json`. A
gitignored copy of `config.example.json` is the usual place. Without any of these, the neutral defaults in
`lib/project.mjs` apply. The file is deep-merged over the defaults, so it only needs the keys you change.
Relative paths resolve against the config file's own folder.

| Key | What it does |
|---|---|
| `presenter.name` | Used in messages and the teleprompter. |
| `presenter.portrait` | A cut-out PNG (transparent background) of the presenter. `standin.mjs` puts it on the rehearsal backdrop. Without it the stand-in is the backdrop and the voice. |
| `presenter.face` | Where the face sits in the 1920×1080 frame (`"x% y%"`). This is the default for the corner circle, the left card and punch-ins. `beats.json` `camera.face` and `faces.json` refine it. |
| `brand.name` | The end card's title when there's no logo. |
| `brand.cta` | The line under the logo on the end card (a URL or handle). `beats.json` `outro.url` overrides it. |
| `brand.logo` | PNG/JPG/SVG for the end card. |
| `brand.logoKeyBackground` | `true` for a logo flattened onto a solid background. The colour in its top-left corner is keyed out. |
| `brand.music` | An audio file for the bed under the voice (about −12 dB, looped and faded). None when `null`. |
| `brand.palette` | `background`, `surface`, `raised` (stage and cards), `accent` + `accentDeep` (accent words, glows, the rail), `warm` (strike-through, "wait" verdicts), `success` ("go" verdicts), `foreground`, `muted`, `highlight` (headline ink). |
| `brand.fonts.sans` / `.mono` | `{ family, file, weight }`. A `file` (.woff2/.ttf) is embedded. A `family` alone must be installed. With neither, the system stack is used. The mono face sets the accent words and credits. |
| `hyperframes` | The HyperFrames CLI version. |
| `kokoro` | `{ voice, speed }` for the rehearsal stand-in (default `af_heart` @ 0.95). |

## Files in a project

| File | What it is |
|---|---|
| `script.md` | The talking points under `## Script`. The stand-in and the teleprompter read them. |
| `raw/camera.mp4` | The presenter's take (keep it out of git). Trim the front first. |
| `raw/standin.mp4` | The rehearsal camera. Used only while there's no camera.mp4. Every frame says REHEARSAL. |
| `narration.words.json` | `{ source, model, words: [{ text, start, end }] }`. Made by transcribe.mjs. finish.mjs makes the captions from it. |
| `transcript.md` | The take as timed sentences. Plan beats against these exact words. |
| `transcript-fixes.json` | `{ "Clod": "Claude", "PHP 2 shell": "PHP2Shell" }`: Whisper corrections, applied on every transcribe. A key with spaces fixes a run of words. A fix that reads as several words (`"php -v"`) stays several words, with the time shared, so beats can anchor to them. The fixes apply to the captions too. Never edit the outputs. |
| `beats.json` | The plan (below). |
| `video.json` | Optional: `{ "title", "hyperframes": "<pin>", "render": { "resolution": "landscape-4k", "videoBitrate": "40M" } }`. |
| `beats.config.json` | Optional: a per-project config (see Config). |
| `teleprompter.json` | Optional: `{ "chapters": { "1": "Intro" }, "say": { "CISA": "SIS-uh" }, "notes": { "1.4": "…" } }`. |
| `index.html`, `compositions/bNN.html` | Generated. Edit beats.json and rebuild. Hand edits are overwritten. |
| `qa/beats-timing.json` | Each beat's resolved start/end and camera mode (sheet.mjs reads it). |

## beats.json

```json
{
  "title": "…",
  "camera": { "face": "50% 38%", "in": 0, "out": null, "reframe": true },
  "music": { "volume": 0.12 },
  "beats": [
    { "type": "pop", "at": "3 AI tools", "count": 3, "text": "AI tools that actually *stick*" },
    { "type": "chapter", "at": "start with the inbox", "n": 1, "of": 3, "title": "The *inbox*" }
  ]
}
```

- **camera.face**: where the face is in the frame (x% y%). The corner circle and left card crop around it, and
  punch-ins zoom toward it. A **faces.json** comes from `faces.mjs` (macOS Vision, 2 frames a second). Re-run it
  after every new cut. With one, each corner-circle and left-card beat frames the median face position across that
  beat instead, so the circle stays on the presenter when they shift. A beat's own `"face": "x% y%"` overrides both.
- **camera.in / out** (seconds) use part of a longer take, such as just the intro. **camera.src** points at
  another file (e.g. `raw/camera-bg.mp4`).
- **camera.reframe: false** turns off the push-and-slide that makes room for pop text. Use it when the presenter
  already sits to one side.
- **camera.panel: true** sets pop text on a dark glass card instead of the soft scrim alone. Use it for a bright
  room or a busy wall, where light text over the wall reads poorly.
- **outro**: `{ "dur": 7 }` ends on a brand end card instead of the take's last frame. The camera fades out over
  the last 0.6 s of the take. The logo (`brand.logo`, else `brand.name` as a title) and the CTA text
  (`brand.cta`, or `"url"`) come up on the stage, and the music fades out across the card. 7 s leaves room for
  YouTube's end-screen elements.
- **music**: the bed from `brand.music` under the voice (about −12 dB at 0.12), faded at both ends and looped if
  the take is longer. `"music": false` for none. `"src"` uses another file in the project.

### Timing, for every beat

- **at**: a phrase the presenter says, matched to transcript.md (case and punctuation ignored, numbers as digits
  or words). Each beat searches after the previous beat's anchor, so a repeated phrase finds the next occurrence.
  If the phrase isn't there, the build fails and shows the next transcript words. Use **start** (seconds) when
  there's no phrase.
- **End:** by default the beat lasts for the sentence it starts in. **until** (a later phrase) or **dur**
  (seconds) overrides that. Gaps under 0.6 s between beats are closed, so the camera doesn't flash for a moment.
  Gaps under 1 s between two beats that both keep the corner circle (or the left card) are closed too, so it
  doesn't balloon to full frame and back.
- **lead**: how early before the anchor word the beat starts (default 0.15 s). A negative lead starts it after the
  word, which gives the previous beat's last word time to land (about 0.3–0.4 s).
- **cam**: override the camera for this beat: `full`, `punch`, `pip` (corner circle), `split` (left card), `off`.
- Text fields take `*accent*` (mono face, accent colour, glow) and `~strike~`. Every word appears as it's spoken.
  Words the presenter doesn't say follow the previous one by 0.12 s.

### Beat types

| type | Fields | Camera | Use it for |
|---|---|---|---|
| `pop` | `text`, `icon`?, `count`? + `suffix`?, `sub`? (a small qualifier line), `side` (`right`/`left`) | full, reframed | The hook; a number or idea beside the presenter while they talk. |
| `headline` | `text`, `sub`?, `size: "xl"`?, `source`? | off | One line that is the point. |
| `chapter` | `n`, `of`, `title` | off | Each topic. The rail shows progress: one node per chapter. |
| `tiles` | `n`, `title`?, `labels`?, `light`? (`"all"` or a list) | off | The agenda ("three things") and the recap. By default each tile lights when its number is said. |
| `stat` | `value`, `prefix`?, `suffix`?, `caption`?, `title`?, `source`? | off | One number that matters. It counts up to the spoken value. |
| `list` | `items` (`text`, `sub`?, `icon`?), `title`?, `check`? (1-based) | pip | Steps or features, each arriving as it's named. |
| `pills` | `items` (`text`, `icon`?), `title`? | off | Two or three words that sum it up ("Faster" / "Cheaper"). |
| `verdict` | `title`, `options` (2), `pick`, `tone`? (`go`/`wait`), `clickAt`? (phrase) | split | The presenter's call: a pointer clicks one option and it lights. |
| `shot` | `src` (image in the project), `title`?, `source` | pip | A real screenshot (never a fake one), with its source credit. |
| `icons` | `items` (`icon`, `text`), `title`? | off | A row of things, each named. |
| `flow` | `items` (`icon`, `text`), `title`? | pip | A → B → C: how something works. |
| `quote` | `who`, `role`?, `text`, `source`? | split | A real person's words, from factcheck.md. |
| `cam` | `cam` | as set | Camera only: a punch-in, or the corner circle with nothing else. |

The icons are inline SVG, defined in `lib/icons.mjs`: doc, slides, chat, chart, mail, calendar, bolt, shield,
lock, user, users, search, gear, play, mic, globe, sparkle, check, x, clock, dollar, phone, bot, folder, link,
arrow, warning, cart, store, pen, idea, target, rocket, heart, star, home. To get a new one, add it there rather
than using an emoji or an icon font. A render can't fetch fonts.

## A different background (no green screen, macOS)

`background.mjs` masks the presenter in every frame of `raw/camera.mp4` with macOS Vision person segmentation.
It's accurate and runs at about 30 fps on Apple silicon. The mask is cached as `raw/camera.mask.mp4`. The script
then keys the presenter over the image, cover-scaled and blurred like a real lens (`--blur`, default 7).

Vision makes moving hands glassy. A clean-plate difference matte catches them, built from the empty room every
30 s. The matte uses the current frame only, because averaging with earlier frames made gesturing hands
see-through, and its edges are feathered.

The result is `raw/camera-bg.mp4`. Point `camera.src` at it, then re-run transcribe.mjs and faces.mjs.

- HyperFrames' `remove-background` (u2net_human_seg) was compared on a real take. It left a light halo and ran
  about 10× slower.
- Use a free image with a clear license (CC0 or public domain; Openverse's API finds them), not a busy one.
  The lens blur hides a 1024-px source.

## How it's built (and why)

- **One camera layer, moved only by transforms.** Each mode is a clip-path window cut from the 1920×1080 recording
  plus an x/y/scale that puts it in place. `left/top/width` snap to whole pixels and stutter in frame capture, and
  `hyperframes check` rejects them.
- **The ring around the corner/left camera** is drop-shadows on an unclipped shell, so it follows the crop. It
  comes in after the camera fades in and leaves before it fades out. Otherwise it tints the video.
- **One sub-composition per beat** (`compositions/bNN.html`), so the HyperFrames timeline shows one row per beat and
  the root stays small. A beat's tweens use beat-local time. Anything on the stage (the rail pulse) is scheduled
  on the main timeline, because a sub-composition can't animate its host.
- **Counters** tween `innerText` with `snap`, not an onUpdate callback, because seeking suppresses callbacks. GSAP
  reads "01" as the number 1, so the chapter's leading zero is a static digit.
- **Pop beats reframe the camera.** The frame pushes in 1.3× and slides away from the text, clamped so the frame
  edge never shows. A centred presenter would otherwise have the words cross their face. That push-in lives on the
  zoom layer. Every move into the corner circle or the left card resets it, including from a camera-off beat.
  Missing that path shows half a face in the circle.

## Known gaps

- No sound effects yet. No UI-mock beat yet: use `shot` with a real screenshot.
- Captions are sidecar files (`renders/captions.srt` / `.vtt`) built from the transcript. Nothing is burned in,
  because the beats are the text.
