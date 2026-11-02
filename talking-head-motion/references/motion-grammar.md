# The talking-head motion grammar

This style is common in tech and news-roundup videos. A presenter talks to camera, and almost every sentence
gets its own motion graphic. Each graphic lands on the words being said. The engine (`../engine/`) implements the
grammar below. The look (palette, type, logo) comes from your config, not from any reference video. Take the
grammar from videos you admire, never their colours, type or signature graphics.

## How to analyze a reference video yourself

| Step | Tool | What it establishes |
|---|---|---|
| Metadata | `yt-dlp -j` | Title, chapters, length. |
| Download | `yt-dlp` (keep it in a scratch folder, only for study) | The source file. |
| Visual breakdown | `ffmpeg` frames at 1 fps → contact sheets | The beat catalog and how often the picture changes. |
| Motion detail | `ffmpeg` strips at 4–10 fps around a few transitions | How each beat enters, counts, lights and leaves. |
| Script + timing | `hyperframes transcribe` (Whisper) word timings | Words per minute; how early on-screen words lead the spoken word. |
| Audio | `silencedetect`, `astats`, `ebur128` | Whether a music bed runs throughout, how far under the voice, final loudness. |
| Picture share | `signalstats` mean luma per second | How much of the running time is the camera vs. graphics. |

## The grammar (what makes it work)

1. **A new picture every 2–4 seconds.** Each sentence gets its own visual. Nothing holds longer than a sentence.
2. **The words on screen are the words being said.** A two-to-six word phrase from the sentence ("An animated
   video from a *prompt*", "Faster and *cheaper*"), each word appearing as it's spoken, about 0.1 s early.
3. **One accent word per phrase**, set apart in a second face and colour.
4. **The speaker never really leaves.** Full frame for the hook and the asides; otherwise a corner circle over
   graphics, or a rounded card on the left beside text. The full frame shrinks into the corner through a small
   card in about 0.3 s.
5. **Jump-cut punch-ins** on the full-frame camera between sentences, and a push-in when text sits beside them.
6. **Every object enters the same way:** rising out of a blur, slight overshoot. Lit things glow from underneath.
7. **Numbers count.** A stat climbs to its value in about a second, and chapter numbers count up from 00.
8. **A verdict per topic:** "Try it / Wait" buttons beside the camera card; a cursor glides in and clicks one,
   which lights. It's the same component every chapter, so it becomes a ritual.
9. **The agenda and the recap are the same object:** numbered tiles at the start, lit one by one as each item is
   named in the recap, with small labels naming what each was.
10. **Sources on every screenshot**, small, bottom-left.

## The beat catalog

| Beat | What it looks like | Engine type |
|---|---|---|
| Text pop beside the speaker: app icon + counting number + words | "3 → 10 new *things*" | `pop` |
| Numbered tiles (agenda / recap) | 1–10 keycaps | `tiles` |
| Chapter card: big counted number + title | "01 New models" | `chapter` (on the rail, with progress nodes) |
| Kinetic headline alone on the stage | "Faster and *cheaper*" | `headline` |
| Icon tiles with labels | "Three sizes" | `icons` |
| Stat card, number counting up | "40% *less*" | `stat` |
| Stacked rows, one gets a check | three product tiers | `list` |
| Two big pills | "Faster" / "Cheaper" | `pills` |
| Verdict buttons + cursor click | "Try it / Wait" | `verdict` |
| Screenshot in a card, speaker in the corner circle | a product page | `shot` |
| Node → connectors → nodes | "how it works" | `flow` |
| Quote card from a named person | a real quote | `quote` |
| UI mock (toggle flips, a prompt types) | — | not built yet; use `shot` with a real screenshot |

## The engine's own signature (change it in the config, not the code)

- Ground: the palette's `background` with an accent bloom from below and a faint warm one.
- Signature: a straight accent rail across the lower third. Chapter cards light one node per chapter, so the
  progress is visible.
- Accent word: the mono face in the accent colour, with a soft glow.
- Glow under every card in the accent colour. Verdict "go" uses `success`, "wait" uses `warm`.
- Corner camera: a circle with an accent ring that follows the crop.
- Hook pops: the camera reframes (1.3× push, slid aside) to make room, for a presenter who sits centred.

## Numbers to aim for

- A visual change every 2–4 s. The camera full frame about 25–35% of the running time (the build prints it).
- On-screen phrase: 2–6 words, one accent word.
- Music bed under the voice by about 10–12 dB, continuous, fading at the ends. Master to −14 LUFS.
- Chapters roughly every 60–90 s in a long video. In a 1–3 minute intro, one per topic.
