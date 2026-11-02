# engine: narrated slide lectures (Mode B, batch)

This engine batch-builds narrated slide lectures from a course's slide deck and its per-slide `voiceover.md`. The
course-video skill's Mode B covers the same steps for building one lecture by hand.

```bash
# one module, from a course repo laid out as content/module-NN/slides/{module-NN-slides.html,voiceover.md}
#   + content/_template/{slides.css,<images>}
engine/build-module.sh --course "$HOME/Courses/CS101" --out "$HOME/Videos/course-videos" 13

# or point at the files directly
engine/build-module.sh --deck deck.html --voiceover voiceover.md --template ./_template --id cs101 4

# several modules, one at a time (skips any module that already has final/mNN-lecture.mp4)
engine/render-queue.sh --course "<course repo>" --out "<dir>" 02 03 04
```

## Settings

| Setting | Flag | Env | Default |
|---|---|---|---|
| Output root | `--out` | `COURSE_VIDEO_OUT` | `./course-videos` |
| Brand folder (holds `brand.json`) | `--brand` | `COURSE_VIDEO_BRAND` | the skill's `example-brand/` |
| Project id (folder under the output root) | `--id` | | from the course folder name (`CS101Foo` → `cs101`), else `course` |
| Kokoro voice / speed | | `KOKORO_VOICE`, `KOKORO_SPEED` | `af_heart`, `0.95` |
| HyperFrames CLI version | | `HYPERFRAMES_VERSION` | latest |
| ElevenLabs (finals only) | | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (both required), `ELEVENLABS_MODEL_ID`, `ELEVENLABS_SPEED`, … | not used unless you run `tts-eleven.mjs` |

The project lands at `<out>/<id>/mNN-lecture/`. The deliverable is `final/mNN-lecture.mp4`.

## How it behaves

- **Words stay in the course repo.** The first build copies `deck.html` and `voiceover-source.md` into the project
  and writes `script.md`. After that, those files stay **frozen**: a rebuild reuses the cached audio, and new text
  paired with old audio would drift. After a script edit, pass `--refresh-source` to re-copy the words. Then delete
  the affected `assets/audio/sceneNN.wav` and `narration/sceneNN.json` files so those scenes get re-voiced.
- **Brand.** Each run copies the brand folder's `brand.json` into the project. `build-lecture.mjs` takes the code
  highlight colour (`video.palette.accent`), the caption box (`video.palette.canvas`) and the caption font
  (`fonts.mono`) from it. `build-narration.mjs` applies its `video.voice.respellings`.
- **Template assets.** `slides.css` and the images in the template folder (`--template`, or the course's
  `content/_template/`) are copied to `assets/`. Links in the deck such as `../../_template/logo.svg` are rewritten
  to `assets/logo.svg`.
- **Voice.** The engine builds with Kokoro `af_heart` @ 0.95, which is free, local and unlimited. For an
  ElevenLabs final, run these inside the project:
  1. `VOICE=eleven node build-narration.mjs`
  2. `node tts-eleven.mjs`, which requires `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`
  3. re-transcribe
  4. `node patch-captions.mjs`
  5. `node build-lecture.mjs`

  `tts-eleven.mjs` refuses to spend quota until the script passes the words gate (`qa/lib/`, see
  `../references/script-review.md`). A full course runs to a few hundred thousand characters, so check the
  remaining quota first.
- **`--no-render`** stops after lint. Use it to check a rebuild without spending a long render.
- **`_scripts/`** holds the generators: `build-narration.mjs`, `build-lecture.mjs`, `patch-captions.mjs` and
  `tts-eleven.mjs`. Each build copies them into the project, so a project keeps working if the skill changes.
- **`qa/`** holds the words gate (`narration.cjs` + `gate.mjs`). Each build copies it to the project's `qa/lib/`.

## Requirements

Node 18+, `ffmpeg`/`ffprobe`, and `npx` with network access (the HyperFrames CLI fetches itself; it provides
`tts`, `transcribe`, `lint` and `render`). Kokoro runs in Python through `hyperframes tts`. If `kokoro-onnx`
lives in a non-default Python, export `HYPERFRAMES_PYTHON=/path/to/python3`. Run `npx hyperframes doctor` if
unsure.
