# demo.spec.mjs — full schema

The spec is a plain ES module exporting one object. `build-demo.mjs` reads it, ffprobes the
narration wavs, runs the timing cascade, and writes `index.html` from `template.html`.

## Top level

| Key | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | project slug, used in logs |
| `mode` | `"explainer" \| "walkthrough"` | yes | documentation only — beats define actual structure |
| `branding` | `"neutral" \| <brand id> \| <path to brand.json or its folder>` | no (neutral) | neutral = blue/gold title/outro/pause cards; anything else takes its colours from a `brand.json` → `video.code_theme` (found as a path, `$BRANDS_DIR/<id>/brand.json`, or `brands/<id>/brand.json` in the project or a parent folder; see "Brand scenes"); editor never rebranded |
| `clipMode` | boolean | no (false) | true → title/outro beats dropped, 0.5s hold frames added at both ends, no final fade. For splicing into a bigger video. Also via `--clip` flag |
| `course`, `module` | string | no | meta line on title card + editor label |
| `docLabel` | string | no (`"ASSIGNMENT"`) | the last part of a doc slide's top label; `""` shows only course and module |
| `voiceSpeed` | number | no (1.09; 0.92 for a slower beginner pace) | the ElevenLabs speed (0.7–1.2) in `tts-eleven-beats.mjs`; a new value is a new paid take of every beat. The effect is weak: 0.92 made takes only 6–11% longer, and 0.85 stretched the words instead of adding pauses. Try it on one beat first: `ONLY=<beat id> node tts-eleven-beats.mjs` |
| `sentencePause` | number (s) | no (0) | extra silence `tts-eleven-beats.mjs` cuts into each ElevenLabs take at every sentence end of the narration, in the real gap (one take, no seams); the vo `.json` word times move with it. 0.45 suits long chained sentences; 0.7 with speed 0.92 gives a slower beginner pace (~160 wpm) |
| `chapter` (on a beat) | string | no | a YouTube chapter starts at this beat. The build writes `timeline.json` (beats, chapters, caption groups); `finish-lab.mjs` turns it into `final/chapters.txt` (checked: the first at 0:00, at least 3, at least 10 s apart), `final/<folder>.srt`/`.vtt`, and the −14 LUFS master `final/<folder>.mp4` |
| `title` | object | if a title beat exists | `{ hero, accent?, sub?, chip?, ghost? }` — accent renders in accent color after hero; ghost is the oversized faded background text |
| `file` | object | yes | `{ name, lang, folder?, siblings? }` — lang: `python \| bash \| javascript \| plain` (file badge color) |
| `statusRight` | string | no | status-bar text next to the checkmark, e.g. `"Python 3.12.1"` |
| `terminalPrompt` | string | no | default `student@{folder} % ` |
| `captions` | boolean | no (true) | false disables caption generation even when transcripts exist |
| `focus` | boolean | no (true) | line-focus border. Each typed line lights with a blue left-rail + tint while it's typed/explained, releasing when focus moves to the next typed line. Set `false` to disable globally (rare). Brand-neutral blue `#3794ff` — the editor is never rebranded |
| `captionFixes` | `[[from, to], ...]` | no | repairs TTS respellings in captions: `[["pie thawn", "Python"]]`. Matching is case/punctuation-insensitive and can span multiple transcript words (timings merge) |
| `voice` | object | no | documentation of what was used; TTS is run by the workflow, not the build |
| `beats` | array | yes | see below |

## Beats

One beat = one narration clip + the visuals that accompany it. Audio file naming is fixed:
beat at index *i* (0-based, original order) reads `audio/vo-{i+1 padded to 2}-{id}.wav`
and optional transcript `audio/vo-NN-{id}.json`.

| Key | Type | Notes |
|---|---|---|
| `id` | string | used in audio filename — keep short, no spaces |
| `scene` | `"title" \| "editor" \| "pause" \| "outro" \| "browser" \| "doc" \| "sting" \| "recap" \| "endscreen"` | consecutive `editor` beats share ONE editor window; any other kind is its own full-screen scene. A `pauseOverlay` editor beat closes its editor scene (next step starts fresh). **Prefer `pauseOverlay` over the full-screen `pause` scene** — it keeps the code visible behind a small card. |
| `narration` | string | the TTS text (respelled per PRONUNCIATIONS.md) |
| `voDelay` | number | seconds after beat start before audio plays. Defaults: 0.5 (first beat), 0.8 (first beat of a new scene), 0.3 (subsequent editor beats) |
| `holdAfter` | number | silence held after narration ends (default 0.6). Pause cards use 4 |
| `minDur` | number | the beat lasts at least this long (default 2.9 for `sting`, 20 for `endscreen`) |
| `transition` | `"zoom" \| "blur" \| "cut"` | transition INTO this beat's scene. Default: title→editor zoom, everything else blur |
| `prefill` | `[{ line, segs }]` | lines rendered instantly (already "written"). Use for recap-after-pause — never re-type what the student just wrote |
| `actions` | array | see below |
| `viewTop` | number | editor beats — first visible line number ("scrolled" editor, true line numbers). 15 lines fit (17 at `editorFontSize` 12); 5 above the default terminal panel. Set on the FIRST beat of an editor scene. Long walkthrough files: scroll later scenes (`viewTop: 5`), and put the run scene's terminal view at the print block (`viewTop: 12`) |
| `pauseOverlay` | boolean | **editor beats only** — renders the "your turn" prompt as a small bottom-right card OVER the still-visible editor (not a full-screen scene), so students can pause and still see the code they just watched you type. Needs `step`/`task`/`checklist` (and optional `hint`) just like a pause scene. The beat types nothing; it closes its editor scene. **This is the preferred pause style.** |
| `step` | `{ n, of }` | pause scenes AND `pauseOverlay` beats — the STEP n OF m badge |
| `badge` | string | instead of `step`: a checkpoint card with its own badge, e.g. `"PREDICT THE OUTPUT"`. Its code lines must be in view, but it asks for no typing, so the step's commands carry on to the next STEP card |
| `task` | string | pause scenes AND `pauseOverlay` beats — card headline |
| `checklist` | string[] | pause scenes AND `pauseOverlay` beats — 2–3 items max |
| `hint` | string | pause scenes AND `pauseOverlay` beats — optional mono hint line |
| `fileCreate` | boolean | editor beats — the "absolute beginner" opening: the Explorer starts empty, the New File icon pulses, a sidebar row appears and the filename types in, then the editor "opens" it (tab + breadcrumb fade in). Use for the very first beat so students see HOW to create/open the file. |
| `fileCreateAt` | number | with `fileCreate` — seconds into the beat when the filename starts typing (sync to narration "click New File and type the name"). Default 1.8. |
| `fileOpenAt` | number | with `fileCreate` — seconds into the beat when the editor opens the file / the tab appears (sync to narration "press enter"). Default = right after the name finishes. |
| `outro` | `{ headline, accent?, bullets?, foot? }` | outro beats only |
| `sting` | `{ chip?, title?, course?, free?, word? }` | sting beats (course lessons): the brand emblem lands with a ring pulse and the wordmark (2.6 s), then, when `title` is set, slides left while the lesson card comes in and the voice (the promise line) starts. Narration is optional: without it, it's the bare 2.9 s sting |
| `recap` | `{ tag?, head?, lines[] }` | recap beats: three lines, on screen and spoken. `{do:"recap-line", n, at}` actions bring line n in on its words |
| `endscreen` | `{ head?, next:{label,title}, playlist:{label,title} }` | the last 20 s: two 16:9 frames where YouTube's end-screen elements go (next lesson left, playlist right). Narration optional |
| `stepsOverlay` | `{ title, items[], at?, hold? }` | editor beats — a small RED-bordered card (top-right) listing the literal steps for something you can't click-by-click animate (open the terminal, create a file). Fades in at `at` (default 1.0s into beat), out after `hold`. Use it alongside narrating the steps, especially for terminal/file actions. |
| `doc` | `{ title?, tag?, body, callout? }` | doc beats only — a clean white "handout/paper" sheet for showing the **assignment instructions** at the very start. `body` is raw HTML (NOT escaped) using `.doc-body` base styles + helper classes: `.ex` (dark code-output block), `.codename` (inline code chip), `.doc-table`/`td.pts` (rubric table). `tag` is a small mono label, `callout: {text, at}` adds a gold chip. Use 2–3 doc beats to walk Purpose → Requirements → Rubric/Submit before any code. |
| `browser` | `{ pageHTML, pageStyle?, url?, tab?, engine?, callout? }` | browser beats only — a Chrome-style window rendering an ACTUAL page. `pageHTML` is raw HTML with inline styles (NOT escaped — keep it self-contained, no external refs); `pageStyle` styles the viewport (e.g. `background:#0f172a; text-align:center;`); `callout: {text, at}` adds a gold chip. Use for HTML/CSS lessons: editor scene types the code, browser scene shows the real rendered result |

## Actions

`at` is **relative to the beat's start**: a number, or `"prev+N"` (N seconds after the previous
action in this beat ends).

| Action | Fields | What happens |
|---|---|---|
| `type` | `line, at, cps?, segs` | code types char-by-char into syntax-colored spans, with blinking cursor. `segs` = `[[tokClass, text], ...]` — hand-tokenize per references/syntax-colors.md. **Default cps 8 — simulate a real person typing each character; never instant-fill a line (no cps above ~14, even for `====` borders).** Don't raise cps to fit; split the beat. The line auto-gets the **focus border** while it types/explains (see `focus`) |
| `highlight-line` vs focus | — | `highlight-line` is a one-shot gold pulse for recap sweeps over PREFILLED lines; the blue **focus border** is automatic on TYPED lines. Don't put a `highlight-line` on a line you also type in the same scene |
| `term-type` | `at, cps?, text` | command types at a fresh terminal prompt. Default cps 10 |
| `term-out` | `at, lines, callout?` | output block appears (multi-line ok). `callout: "label"` adds the gold ring + ✓ LABEL tag. A fresh prompt appears automatically 1.2s after the last term-out |
| `terminal-open` | `at` | terminal panel opens (instantly, as in VS Code). Required before any term-* action in the scene |
| `terminal-close` | `at` | Cmd+J: the panel hides and the editor gets its full height back; focus and the blinking cursor return to the editor. Use it before a pause card whose code the panel would cover |
| `callout` | `line, at, text` | gold chip flies in to the right of a code line |
| `highlight-line` | `line, at` | gold background pulse on a code line (recap sweeps) |
| `file-activate` | `at` | sidebar file row lights up (the "file created" moment). If used, the row starts inactive |
| `redbox` | `at, target, hold?` (or `line, at, hold?`) | **draws a pulsing RED highlight ring around a UI element to draw the student's eye.** `target`: `"newfile"` (New File icon), `"runbtn"` (▷ Run button), `"terminal"`, `"tab"`, `"sidebarfile"`; or pass `line: N` for a code line. `hold` = seconds the ring stays (default 3). Use it whenever you point at something ("click the New File icon", "the Run button", "here's the terminal"). |

## Timing cascade (what the build computes)

```
beat.start    = previous beat's end (first beat: 0, or 0.5 in clipMode)
audioAt       = beat.start + voDelay
visualEnd     = latest action end (typing end = at + totalChars/cps)
beat.end      = max(audioAt + audioDur + holdAfter, visualEnd + 0.6)
duration      = last beat.end + 1.0   (0.5 in clipMode)
```

Scene boundaries get transitions at the incoming beat's start. The build prints a **beat map**
(start/audio/end/midpoint per beat) plus ready-made `inspect --at` and frame-extraction
commands — use those exact times for verification.

## Warnings the build emits and how to fix them

| Warning | Fix |
|---|---|
| `visuals run Ns past narration` | raise that action's `cps`, split the beat, or add narration |
| `only ~N narration words per typed line` | explain each line as you type it — add narration for each line, or split the beat so each line gets its own |
| `no transcript ... captions skipped` | run `npx hyperframes transcribe` on that wav (workflow step 7) |
| `clipMode: dropping ...` | expected — title/outro don't belong in spliced clips |

## Real-app VS Code window fields (2026-10-15)

| Field | Where | Meaning |
|---|---|---|
| `vscodeTheme` | spec | theme file `vscode/theme-<name>.css` (default `dark-2026`; dump others with `tools/theme-css.mjs`) |
| `statusRight` | spec | interpreter text in the status bar (default `Python 3.14.4 (homebrew)`) |
| `terminalPrompt` | spec | shell prompt (default the stock macOS `student@MacBook-Pro <folder> % `) |
| `editorFontSize` | spec | the real `editor.fontSize`: **14** (default), 13 or 12, each measured in the app. Line height 21 / 20 / 18, gutter 72 / 69 / 66: **15 / 16 / 17 lines** and 53 / 57 / 62 characters before the minimap. Lines that fit, panel fits, marks, callouts, the minimap and the warnings all follow it. For a program that doesn't fit: 13, then 12, then `windowWidth`. Full table: `vscode-sim.md` (Space) |
| `terminalFontSize` | spec | the real `terminal.integrated.fontSize`, its own setting (it doesn't follow `editorFontSize`): **14** (default), 13 or 12. Rows 16 / 15 / 14 px: 10 / 11 / 11 rows in the default 200 panel, 67 / 72 / 78 columns. Smaller text shows longer output; the build warns when output runs past the panel's last row |
| `windowWidth` | spec | the window's width in logical px, **850** (default) to 920, a whole number. The window stays centered (920 → 1840 px at x 40) and keeps its height, so captions and cards don't move. Adds characters, not lines: 61 / 65 / 70 at 14 / 13 / 12 in a 920 window. Wider panels show more tabs, as the app does (DEBUG CONSOLE from 899, PORTS from 916), and the pause card shrinks the window a little more (0.72 at 920) to keep its 20 px gap |
| `panelHeight` | spec | terminal panel height in logical px (default 200 → 5 code lines stay visible, 10 terminal rows) |
| `terminalHeight` | first beat of a scene | panel height for that scene |
| `terminalMax` | first beat of a scene | Maximize Panel Size: the panel covers the editor column (REPL sessions) |
| `before.cursorLine` | fileCreate beat | line of the earlier file that keeps the current-line highlight until the new file opens |
| `debug.fontSizeLogical` | debug beat | Variables pane font in logical px (default the real 11); the old `debug.fontSize` is ignored |
| `scene: "compare"` + `compare: { real, heat?, file, folder, lines:[a,b], cursor, interp, labels, stat, caption, start? }` | beat | pixel-test scene: a real capture over the generated window; actions `{do:"wipe", at, dur, to}` (to = share showing the REAL capture) and `{do:"heat", at}` |
| `stepsOverlay.pos: "bottom"` | beat | the steps card sits low (over the terminal's empty area) instead of top-right over code |
| `{do: "redbox", target: "termdot"}` | action | rings the shell-integration dot of the scene's first command |
| `{do: "redbox", target: "minimap"}` | action | rings the minimap |
| `{do: "save", at}` | action | Cmd+S: the file's tab goes from the unsaved dot back to ×. Typing makes the tab dirty; running the file (`python3 file.py`) before a save is a build warning — say "save it with Command S, or Control S on Windows" |
| `export const CODE` | spec module | needed for sticky-scroll headers (lines above `viewTop`) and compare scenes |

Code colors: `qa/vscode-tokens.json` from `assets/vscode/tools/tokens.mjs` (lab specs get it through
`lab-helpers.mjs`; plain specs can use classes `c-RRGGBB` / `c-RRGGBB-i` in `segs`, which the build turns into CSS).
A seg may carry a third element, the underlying token color (`["c-da70d6", "{", "ff7b72"]`): VS Code's bracket-pair
colors are decorations, so the minimap draws the base color; `tokens.mjs` adds it whenever the two differ.

## Pause visibility (build-enforced)

At every `pauseOverlay` beat the build checks what the step (everything since the previous pause) asked students
to type:
- **Editor lines** (`type` actions in the file on screen) must all be in view at the pause. The visible range is
  `viewTop` .. `viewTop + 15 − sticky rows − 1` (16 at `editorFontSize` 13, 17 at 12), or only `fitTerm` lines while
  a terminal panel is open, or none under `terminalMax`.
- Pasted lines (`P(...)`) count as typed: the student types them too.
- **Width:** a typed line must fit before the minimap (53 characters at the default layout; up to 70 at
  `editorFontSize` 12 in a 920 window). Past that it runs under the minimap at 10% visibility. Shorten it, split it
  the way real code would be split, or use a smaller `editorFontSize` / wider `windowWidth`.
- **Terminal input** (`term-type` text) must be in the open panel, or appear verbatim on the card (task, checklist,
  hint) when the panel is closed.

Each failure prints `ERROR: pause <id> (step n): students can't see line(s) …` and the build exits 1. All pauses are
reported at once. The fixes: `{do:"terminal-close"}` before the pause; a `viewTop` (+ `prefill`) on the pause beat
so it shows the whole step (a cut, like scrolling up); or two pauses for a step longer than one screen.

**Callouts** must also not cover code: a callout is right-anchored at the minimap edge, so the build fails when it
would overlap the code on its row, and says how many characters fit there.

**Callouts** are checked as well. A gold callout lives on its row, so a callout whose row isn't written yet when it
fires (or is out of view, or under the panel) would never show, and the build fails on it. Anchor callouts on a
written line in view, or create blank rows on cue with `T(n)` (Enter).

## Brand scenes (sting, recap, end screen)

A brand profile is a folder with a `brand.json` (and optionally `assets/`). Point `branding` at it by path, or give
it an id and keep it at `$BRANDS_DIR/<id>/brand.json` or `brands/<id>/brand.json` in the project or a parent folder:

```json
{
  "brand": { "name": "My Channel" },
  "video": {
    "identity": { "name": "My Channel", "handle": "@mychannel" },
    "emblem": "assets/emblem.png",
    "fonts": { "display": "Bricolage Grotesque", "code": "JetBrains Mono" },
    "code_theme": {
      "bg": "#0e1116", "accentA": "#5bb8ff", "accentB": "#ffc83d",
      "inkHi": "#f4f8fc", "inkMid": "#b9c9d8", "inkMeta": "#8fb6d9",
      "glowA": "rgba(91, 184, 255, 0.2)", "glowA0": "rgba(91, 184, 255, 0)",
      "glowB": "rgba(255, 200, 61, 0.15)", "glowB0": "rgba(255, 200, 61, 0)"
    }
  }
}
```

`code_theme` keys become CSS variables on the title/outro/pause/brand cards (never on the VS Code window). For any
brand other than `neutral`, the build copies the brand's emblem (`video.emblem`, relative to the brand.json) to
`brand/emblem.png` and its display and code fonts (`video.fonts.display` / `.code`, a `.woff2` in the brand folder's
`assets/fonts/` whose name starts with the family name without spaces) to `fonts/brand-display.woff2`
and `fonts/brand-mono.woff2`, and uses them in these three scenes. Without them the scenes fall back to the template's fonts and
show no emblem. A beat with no narration (only `sting` and `endscreen` may) has no wav and no captions.
