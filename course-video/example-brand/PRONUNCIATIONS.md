# TTS Pronunciation Overrides — course videos

The HyperFrames `tts` CLI (Kokoro `af_heart`) has **no phoneme/pronunciation flag**. It reads the narration
text literally. To fix a mispronounced word, **respell it phonetically in the scene's `narration/sceneNN.txt`**,
then regenerate that one clip:

```bash
npx hyperframes tts narration/sceneNN.txt --voice af_heart --speed 0.95 --output assets/audio/sceneNN.wav
```

Then re-transcribe that clip and rebuild the captions.

**Check that the captions survive.** After regenerating, run `transcribe`. If Whisper hears the respelling as
the real word (it does for Python and Kali below), the on-screen caption stays correct automatically. If Whisper
writes the phonetic spelling instead, add a display-text override when building captions (`patch-captions.mjs`).

> This only matters for **TTS** videos. A video narrated in the instructor's own recorded voice is fixed by
> re-recording, not respelling.

The built-in rules live in `engine/_scripts/build-narration.mjs` (`applyConventions()` for Kokoro and
`applyElevenConventions()` for ElevenLabs). For brand-specific whole-word extras, add them to `brand.json`
under `video.voice.respellings`: `{ "kokoro": { "GUI": "gooey" }, "eleven": { … } }`.

## Known overrides (Kokoro path, applied automatically)

| Word | Respell in narration as | Target sound | Notes |
|------|-------------------------|--------------|-------|
| Kali | `kal-ee` | KAL-ee | "a" like **Al/Albert** (not "KAH-lee"). Kali Linux. |
| Python | `pie-thawn` | PIE-thawn | "PY" rhymes with "eye", "thon" → "thawn". |
| elif | `el-if` | EL-if | First syllable like the start of "**el**ephant", second like "if". Shorthand for "else if". |
| str (the type) | `stir` | stir | Bare `str` is read as "S-D-R" (garbled). "stir" lands as one clean syllable. Scope it to the standalone token. Do NOT touch "string" or "instructor". |
| re (the module) | `R E` | letters R-E | Bare module `re` is read as the English word **"read"** ("import read", "read.search"). Scope it to real module contexts only (`import re`, `re dot …`, `re HOWTO`), so it never hits the "re" in *you're / we're*. |
| OOP | `O O P` | letters O-O-P | Guarantees letter pronunciation. |
| VS Code | `V S Code` | "V-S Code" | Bare `VS` can read as "versus". |
| macOS | `mac O S` | "mac-O-S" | Avoids "mackos". |
| GUI | `gooey` | GOO-ee | Say it as a word, not letter by letter (`G U I`). Example brand respelling (`brand.json`). Whisper writes it back as "GUI", so captions stay right. |

> **Kokoro note:** `regex` reads correctly as "REJ-ex" on the af_heart path, so leave it there.
> **Module-specific terms:** scan each new module's narration and add rows above as you confirm them. Test with
> a `pron-tests/` clip first.

## ElevenLabs-only overrides (clean mode)

The ElevenLabs path runs the **clean** script, without the Kokoro respellings, because the ElevenLabs voice
reads "pie-thawn" and the like literally. But it does **not** pronounce every token right, and it does **not**
set Python keywords and operators apart on its own; they melt into the sentence. So when `VOICE=eleven`,
`build-narration.mjs` → `applyElevenConventions()` applies these:

| Word | Respell as | Target sound | Notes |
|------|------------|--------------|-------|
| regex | `rej-ex` (`Rej-ex` when capitalized) | REJ-eks | ElevenLabs otherwise mis-says it. Scope it to the token `regex` only, never "regular expression". Whisper re-hears it as "regex", so captions stay correct. Some takes split it into two beats ("rej / ex") and Whisper writes **"reg x"**. Check every take that says it, and redraw any that come out that way. |
| dict | `dikt`, or quote the phrase (`"group dict"`) | DIKT | At slower speeds, plain `dict` can be misheard badly, including as an offensive word. A quoted phrase is often the most reliable fix. Even `dikt` can lose its "t", so check every take that says it, on tight and whole-scene clips. Captions stay "dict" (patched by `patch-captions.mjs`). |
| backslash n | `backslash N` | BACK-slash EN | Takes can drop the "n" entirely, and `backslash en` can come out "backslash Ian". Generate a few candidates and keep the clean one. |
| elif | `ell-iff` | ELL-if | ElevenLabs says plain `elif` as "AH-lif"; `ell-iff` comes out "ELL-if". Whisper hears `ell-iff` as **"LIF"**, so `patch-captions.mjs` (run after transcribe, before build-lecture) corrects the captions back to "elif". |

**`with`.** Quotes alone barely set it apart: the voice still runs "with open lets" together. Naming it works:
'the "with" statement, like "with" open, …' comes out clean. In narration, call it the "with" statement (or
keyword) and quote the word every time it's said.

**Keyword/operator quote emphasis (ElevenLabs path).** `applyElevenConventions()` also calls
`emphasizeKeywordsEleven()`. It wraps the Python keywords `if`/`elif`/`else`/`while` and the operators
`and`/`or`/`not` in **quotes**, which tested better than em-dashes. It does this **only in the naming/keyword
sense** (`the "if" statement`, `The first is "and", which…`, `the actual words "and", "or", and "not"`). It
**never** does it inside an expression (`443 and protocol`, `"WARN" or severity`) or in plain English
(`does not use`, `and then`). Quotes change only the spoken prosody, so Whisper captions stay correct and the
quoted words need no patch.

**Whisper caption check.** Common Whisper mis-hearings of correctly spoken tokens: `re` → "read"/"remodel",
`str` → "this TR", `dict` → "dick", `kwargs` → "quarks". If the audio sounds right, don't respell it. Patch the
captions instead (`patch-captions.mjs` does `dict`/`kwargs`). These read fine, so leave them alone: `int`, `os`,
`sys`, `args`, `enum`, `API`, `CLI`, `IP`, `ASCII`, `hex`, `env`, `PATH`.

Add ElevenLabs-only rows here as you confirm them. A/B a `pron-tests/` clip **in the ElevenLabs voice** first.
Kokoro respellings do NOT belong here, because ElevenLabs reads them literally.

## Technique cheat-sheet

- **Hyphenate syllables** to force stress and vowels: `kal-ee`, `pie-thawn`.
- **Periods for acronyms** → letter by letter: `S.S.H.`, `A.C.`, `user I.D.`
- **Decimal numbers** (section or version refs like `4.2`) → spell the point: `four point two`. A bare `4.2`
  makes Kokoro treat the `.` as a sentence end, which puts a hard pause mid-reference. On-screen text like
  `§4.2` is fine; only the spoken narration needs respelling.
- **IP / dotted addresses** (`10.0.0.x`) → say "dot" and keep the digits: `10 dot 0 dot 0 dot …`. Do NOT run
  the decimal → "point" rule on these, which would turn them into "ten point zero…". `build-narration.mjs`
  handles addresses (3+ octets) before the decimal rule.
- **Commas** insert a small pause.
- **Homophones** are fair game: swap in a word that sounds identical.
- **Verify by ear first.** Generate a few candidates into a `pron-tests/` folder and listen before baking them
  in and re-rendering:
  ```bash
  npx hyperframes tts "with a name of kal-ee and an ID." --voice af_heart --speed 0.95 --output pron-tests/test.wav
  ```
- **A respelling can change a clip's length.** If the clip still fits the scene's audio slot, just bump that
  `<audio data-duration>`. If it overflows, recompute the scene-start cascade (re-run `build-lecture.mjs`).

**`tuple`** is usually said TOO-pul (long U, like "two"). Kokoro gets it right. If your ElevenLabs voice says
"tuh-pul", add `"eleven": { "tuple": "toople", "tuples": "tooples" }` to `video.voice.respellings`.
