# Lab walkthrough: the repeatable process

"Instructor completes the lab live" videos: a simulated VS Code window, a narrated voice (free Kokoro, or your
ElevenLabs voice), and students code along with pause cards. The bundled examples are a one-file lab (Threat Log
Analyzer, `example-lab-threat-log.spec.mjs`) and an extended two-file lab (Modular Security Toolkit,
`example-lab-security-toolkit.spec.mjs`).

**Nothing ships without the EDITOR step (step 9).** A single misspelling on screen is what students report.

## 0 · Scaffold
```bash
bash <skill>/assets/lab-kit/new-lab.sh mNN-<slug>-walkthrough [parent-dir]    # or OUT_DIR=... / DEST=...
```
That gives you the patched build + template, `lab-helpers.mjs`, `tts-kokoro-beats.mjs`, `tts-eleven-beats.mjs`,
`qa-editor.mjs`, the words gate in `qa/lib/`, `EDITOR.md`, and an example spec as a starting point
(`STARTER=security-toolkit | threat-log | lesson`).

## 1 · Capture the assignment (the source of truth)
Copy the assignment page as students see it (your LMS page text, read-only) into `qa/assignment.txt`
with the URL and capture date. Note: copied page text often collapses runs of spaces, so don't copy a sample
output's alignment from it. Show the program's REAL output on doc pages instead.

## 2 · The program
Start from your reference solution (and any notes on expected values and common mistakes). Put it in the
spec's `CODE` map (line number → text). Rules: ASCII only in the header (no em dashes), the assignment's
EXACT data, every requirement and rubric row present, lines ≤ ~54 chars so they fit before the minimap
(the window is the real app's geometry: Menlo 14, 15 lines, see `vscode-sim.md`), pycodestyle clean.
Use a placeholder name in the header comment (the examples use "Alex Rivera"), never a real student's.
Set `qa: { program: "<file>.py" }`.

### 2b · Real VS Code colors (mandatory once the program files exist)
`writePrograms(CODE, FILES)` writes the files when the spec is first imported (`node -e 'import("./demo.spec.mjs")'`).
Then read their colors from VS Code itself:
`node <skill>/assets/vscode/tools/tokens.mjs <file1.py> <file2.py>` → `qa/vscode-tokens.json`
(TextMate + Pylance semantic + bracket-pair colors, Dark 2026; needs VS Code and `puppeteer-core`). `lab-helpers.mjs`
uses it for every `T()`/`pre()` line; re-run it whenever a program line changes. The build must print **no**
`⚠ no real VS Code colors for:`.

## 3 · Beat script (in `demo.spec.mjs`)
Structure, in order:
1. title
2. doc **why this topic matters** (for a security course: why it matters in cybersecurity)
3. doc **why this language** for the job
4. doc assignment + sample output (the real output)
5. doc requirements
6. doc rubric + submit
7. `fileCreate` from an empty folder
8. build in steps; each step ends with a `pauseOverlay` STEP n OF m card that has "pause if you have questions".
   **At the pause, everything the step asks them to type must be on screen.** Close the terminal
   first (`{do:"terminal-close"}`, Cmd+J), keep the step's first lines in view, and split a step that is longer than
   one screen (~15 lines) into two pauses. The build fails on a pause that hides a typed line (spec-format.md,
   "Pause visibility")
9. **trace**: Variables panel (`debug`), yellow `S()` current-line bar, `V()` values, the narration says the line number + what Python evaluates + the result
10. run it ("predict, then verify")
11. pause: run + screenshot + submit
12. outro

**Extended version**: for labs whose core concepts may be new to students, make a second,
longer cut (the threat-log lab went from 12 to 20+ min). After the rubric page, add:
1. ~6 BACKGROUND doc slides: overview comparison table, one slide per concept with examples and
   real-world uses, "how they fit together" with a step table, and one slide per new syntax (e.g. list comprehension)
2. live **Python shell practice** (`createRepl()` → `RP.R(code, at)`), where every `>>>` output is produced
   by real Python via `repl_harness.py` (tracebacks included, so show the errors on purpose)
3. a "predict the output" quiz slide, with the answers revealed live in the shell (paste the quiz's setup
   lines at paste speed so the reveals keep up with the voice), then a pause card "try them in the shell"
3b. a traced report loop (`.items()` in the Variables panel), an optional ungraded "challenge" slide, and a recap
   table mapping each concept to where it appears in the lab
4. a "common mistakes" slide before the final submit pause
Renumber the pause steps, and update the spoken step numbers too.
REPL rules (enforced by `seq()` and `qa-editor.mjs`): call `RP.R()` in ON-SCREEN order, because Python runs them
in call order. The QA FAILs if what Python ran differs from what's on screen. Terminal lines are strictly
sequential (type → output → next line). A compound line (`for …:`) is followed by a `"... "` term-type.
Multi-line blocks: `RP.RB(["for p in ports:", "    if p == 22:", "        continue", "    print(p)"], at, cps, { ats, runAt })`
types the `>>>` line, each `... ` body line, the empty `... ` Enter, then the real output.

**Keep the shell's memory on screen.** Each shell beat cuts to a fresh terminal, so `ports = [...]` from an earlier
screen vanishes while later lines still use it, and students ask "what's going on?". Wrap every shell beat in
`B(...RP.shell({ ...beat }, (at) => [...]))`: it adds a SHELL Variables panel on the left that starts with
what the session already holds and updates as each line runs. The values come from the real Python session
(`repl_harness.py` vars mode), loop variables included. A new `createRepl()` session starts with an empty panel. And
**say it**: when a beat reuses something from an earlier screen, the narration points at the panel ("the shell still
remembers ports, it's there on the left"), with a `{do:"redbox", target:"debug", hold: 3.3}`. Panel-box holds must be at least 3.2 s, or the pulse overlaps its fade (lint).
Long values (a tuple) switch the panel to a 13 px font automatically.

**Multi-file labs (two files).** Put every file in one `CODE` map with an offset per file:
`security_utils.py` at `CODE[1..]`, `toolkit_main.py` at `CODE[101..]`, and declare
`files: [{ name: "security_utils.py", base: 0 }, { name: "toolkit_main.py", base: 100, from: "newfile2" }]` in the spec.
A beat's `file: "toolkit_main.py"` makes its editor scene show that file. The gutter shows file line numbers
(n − base), the Explorer lists every file that exists by then (sorted, active one highlighted), and the other files show as
inactive tabs. A second `fileCreate` beat (with `file:`) creates the next file next to the first. `T`/`M`/`P`/`S`/`pre`
all take the absolute line (e.g. `T(108, …)`). Say file line numbers in the narration ("line twenty nine"), not absolute ones.
`writePrograms(CODE, FILES)` at the top of the spec writes the real files, and `qa-editor.mjs` compiles and PEP-8-checks
each one. It verifies each terminal block against the file its typed `python3 <file>.py` command ran.

Draft loading: `LAB_DRAFT=1` lets the spec load before audio exists (anchors written for Whisper's spelling, like "ip"
and digits, would otherwise throw). Use it for the narration extract and the first TTS run.

Helpers (`createLab(CODE)`): `T` type, `P` paste a block (data copied from the assignment), `C` callout,
`H` highlight, `S` step, `V` var, `pre` prefill. Time every action with `at("spoken phrase")`.

**Red-box marks are mandatory.** As you speak, the student should see exactly what you are referencing. Every time
the narration points at something already on screen, a red box goes around exactly that text at the moment the words
are spoken. Use them on code in the editor, code and table cells on slides, and terminal output. Helpers:
- `M(line, "text", at, {n, to, hold})` boxes the n-th `text` in a code line. `to:` boxes lines `line..to` (a whole loop body, or the indent with `"    "`).
- `MD("text", at, {n, whole, hold})` boxes text on a doc slide. A `.codename` chip gets boxed whole; `whole: true` matches a table cell exactly (`<td>0</td>`); raw HTML like `"square <b>[ ]</b>"` also works.
- `MO("text", at)` boxes text in the latest terminal output (multi-line with `\n`). `MC("text", at)` boxes text in the latest typed terminal line.
- `{do:"redbox", target:"debug"|"newfile"|"runbtn"|"terminal"|"tab"|"sidebarfile"}` rings a UI element.

How long a box stays up:
- By default a box comes down at the **end of the sentence** that contains its phrase (read from the Whisper punctuation, +0.5 s).
  It also comes down when the next mark starts, and never stays up more than 6 s.
- `hold:` sets an exact time, and lets boxes stack.

Build checks:
- The build FAILs when a mark's text isn't on screen.
- It also FAILs, listing every case at once, when a mark would wait more than 0.5 s for its text to be typed. The voice would
  already be past it (boxes showing up 4–7 s late is the typical symptom).
- **Fix the typing, never delete the mark.** Code that is explained but never boxed is a defect. Fixes:
  - start the line one phrase earlier, or at the beat's first words
  - raise cps to 14–16 for long lines (header comments and f-string prints)
  - or reword the sentence so it explains the line after it's typed ("Inside the curly braces, …")
  - or paste a repeated line ("I'll just copy the first border line and paste it" → `P(6, 6, at(...))`)
- **Anchor a mark on the words that name the code, not on a later phrase.** Anchoring later only hides the lag from the
  build check (e.g. `.items()` said 2 s before it was typed, while its box was anchored on the next sentence).
  Report and comment lines are long. Type them at 14–16 cps, starting on the beat's first words, and comments at 16 cps
  so they don't push back the line that gets explained.
- `until: "phrase"` brings a box down when that word is spoken (end a box mid-sentence when the sentence moves on).
- End times follow the **script's** sentences, mapped to transcript word times. Whisper's punctuation doesn't
  match the script, so it isn't used.
- It WARNs when a box is up for less than 0.6 s. Merge those, or give them a `hold`.

Box size: boxes are padded 3 px with a 2.5 px border, so they don't cut into the next character. Slide targets are trimmed, so a box never starts on a space.

How many: about one mark per sentence that names code, a value, or a table cell (an extended lab can have 200). Don't
mark words that are being typed at that moment; the focus rail already shows them.
**Never make `.code-text` `position: relative`**, because it re-anchors `.line-callout` onto the code. Editor boxes live in
`.code-line`, offset by the 88px gutter.
Editor scrolling = a beat with `viewTop` (and `transition: "cut"`) starts a new window; keep ≤ 14
lines visible. `terminalMax: true` for outputs longer than ~12 lines. A `"cut"` transition now also zeroes opacity,
because children tweened to `visibility: visible` (pause cards, terminal lines, panel rows) ignore a parent's
`visibility: hidden` (otherwise a pause card can leak into the following minutes). `term-type` with `prompt:` simulates
`input()`. Callouts go on short or blank lines (they cover code on lines over ~45 chars); one callout
per line per scene.

ElevenLabs narration: clean words (no Kokoro respellings), **except** for the voice-only respellings in
`tts-eleven-beats.mjs` `SAY`. Example: "tuple" is read as "toople" when the presenter says TOO-pul (long U, like "two")
and the clone said "tuh-pul". The narration and captions keep the real word; add per-lab entries with
`say: [[/re/g, "…"]]` in the spec. Say identifiers as words ("by type", "threat underscore log dot P Y"), IPs as
"ten dot zero dot zero dot five", keywords in quotes (`"if"`, `"and"`), elif as `"ell-iff"`. Sync phrases: avoid
number words above twelve and "I P" (Whisper writes 25 / IP); anchor on nearby plain words.

**A slower pace for beginners.** If students ask you to slow down, `voiceSpeed: 0.92` + `sentencePause: 0.7` in the
spec gives about 160 wpm (against ~180–200 at the ElevenLabs default 1.09 + 0.45). Set it once in your voice notes
(SKILL.md, "Voice & branding") and use it for every spec.

Pace: an ElevenLabs clone stops about 0.4 s at a full stop, but long chained sentences have far fewer full stops than a
lab script, so at speed 1.09 such a script can run at 224 wpm against 188. Slowing the voice (`voiceSpeed`) helps only
a little. `sentencePause: 0.45` in the spec adds that much silence at every sentence end: `tts-eleven-beats.mjs` cuts
it into the one take (no seams) at the longest quiet stretch, found from the audio levels, because Whisper's word times
drift (it ran "hello dot P Y" together and started the next sentence early). Never use `<break>` tags or separate takes
per sentence: both failed before. To voice just a few beats while you try a setting: `ONLY=id,id node tts-eleven-beats.mjs`.

**Windows: `python`, not `python3`.** The video is recorded on a Mac, but some students use Windows, where the
command is `python`. In every beat that types `python3` (the shell start, any restart, the program run) and in the
run/submit pause cards, say it out loud ("If you're on Windows, type python, not python three") and show it on screen
(`stepsOverlay` item or pause-card hint `Windows: python <file>.py`). EDITOR rule 11 checks this.

## 3b · Humanizer pass and script review (before any paid audio; the ElevenLabs script enforces it)
`tts-eleven-beats.mjs` refuses to make a new paid take until the words gate passes
(`node qa/lib/narration.cjs . --gate`; rules in `references/script-review.md`):
the narration lint has no FAIL, `qa/humanizer-diff.md` exists, and an independent reviewer subagent wrote
`qa/script-review.md` with `VERDICT: PASS` and the current `narration-sha`. Kokoro drafts don't need the gate.

Narration must sound like the presenter teaching, not like AI. After the beat script is approved and **before**
`tts-eleven-beats.mjs` runs, invoke the `humanizer` skill on every beat's `narration`:
- Pull all narrations out of the spec into one file (`qa/narration.txt`, one `## <beat id>` header per beat)
  and run the humanizer on it. Watch for openers like "let's dive in" or "great question", "it's important to note",
  "not just X but Y", lists of three, the same opener on every beat (starting with "Now," or "So," is fine; what's
  wrong is identical rhythm), announcing a checklist instead of starting it ("we'll check off every one"), puffed-up
  words (crucial, powerful, seamless, robust), and summaries that restate the beat.
- Keep what the humanizer must NOT touch: TTS spellings (`"ell-iff"`, "dot P Y", IPs spelled as words),
  quoted keywords, identifiers said as words, `at("phrase")` sync anchors (if a phrase changes, update its
  `at()` too), rubric terms, and the plain teaching register (short sentences, "you", "we").
- Write the changes back into the spec and keep a before/after in `qa/humanizer-diff.md`. Big rewrites go back
  to the user before audio. Small wording fixes don't.
- Re-running the humanizer later (after editor fixes reword a beat) only re-voices the beats that changed.

## 4 · Audio
```bash
node tts-kokoro-beats.mjs     # free Kokoro + Whisper, cached per beat (the default)
# or, for ElevenLabs (needs ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID and a passing words gate):
node tts-eleven-beats.mjs
node build-demo.mjs           # beat map + warnings
```
Fix every `sync miss` by matching the phrase to the transcript wording. Only changed narration gets regenerated.

**Captions come from the SCRIPT, not from Whisper** (the build's default). Whisper only times them. Its text can put
"Efor Ein events", "seam tools" and "in the loop" on screen. So `captionFixes` map the *spoken script forms* to
on-screen forms, applied longest key first:
`["threat underscore log dot P Y", "threat_log.py"]`, `["I P", "IP"]`, `["ten dot zero dot zero dot five", <the IP>]`,
`["e index three", "e[3]"]`, `["by type", "by_type"]`, `["P E P 8", "PEP 8"]`, `["python three", "python3"]`.
After building, read the caption text dump once:
`grep -o 'id="cap-[^"]*">[^<]*' index.html | sed 's/.*">//' | tr '\n' ' '`.
Caption timing guards in the build:
- every caption group stays up ≥ 0.8 s
- only one caption is on screen at a time (boundary clamp)
- a word's highlight always lands while its caption is up
- a transcript that runs past the speech in the wav is rescaled (warns "rescaled caption timing")
Transcription uses `medium.en`; `small.en` drifted up to 1.7 s at the end of some clips.

When the speech check shows a word that BOTH transcriptions hear wrong ("wants" heard as "ones"),
reword that line and re-voice it rather than arguing with it.

## 5 · Build checks
`npx hyperframes lint` → 0 errors, no overlapping-tween warnings. No `⚠ no real VS Code colors` lines and no
"lines visible — only N fit" warnings (15 editor lines; an open terminal leaves ~5 above a 200px panel; use
`viewTop`, `terminalHeight` or `terminalMax`). No "run while unsaved" warning: every run of a file that was just
typed is preceded by `{do:"save", at}` and the narration says "save it with Command S, or Control S on Windows"
(VS Code does not auto-save by default; an unsaved run would print nothing in the real app). Then a pre-render visual pass:
`npx hyperframes snapshot --at <end of every beat> --no-end --describe false` and read every contact sheet.

## 6 · Dry-run the editor checks before rendering (cheap)
`PYCODESTYLE_PY=<venv python> node qa-editor.mjs /none` runs the code, terminal, speech and spelling
checks without a video. Fix every FAIL **before** the 20-minute render (this is where a glued caption word like
"Eindex" gets caught).

## 7 · Render
**Always chain the build onto the render:** `node build-demo.mjs && npx hyperframes render …`. Otherwise a spec fix
can miss the video because the build wasn't re-run. `qa-editor.mjs` FAILs on a stale index.html or a stale mp4.
Slide and editor code turns off font ligatures (JetBrains Mono drew `>=` as `≥`, which students would type).
`npx hyperframes render --output renders/mNN-labNN-<slug>-walkthrough.mp4 --quality standard`
(~1.6× real time).
**Disk:** multi-worker screenshot capture can fall back to writing every frame to disk (~83 GB for 22 min) and
fill the drive (ENOSPC mid-render). Set `HF_CAPTURE_PARALLEL_STREAM=true` so frames stream into the encoder, and check
`df -h` first. Use hyperframes 0.8.x or later for `snapshot` and `render`; 0.6.69's snapshot times out on a big composition.

For YouTube: `node finish-lab.mjs` masters the render to −14 LUFS and writes `final/<folder>.mp4`, `.srt`, `.vtt` and
`chapters.txt` (beats with `chapter: "Title"`).

## 8 · Automated editor checks on the real mp4
`node qa-editor.mjs` writes `qa/editor-report.md`, `qa/frames/`, `qa/sheets/`. It checks:
- code on screen == CODE
- the program compiles and is PEP 8 clean
- every terminal block == a real run
- transcript vs script
- spelling near-misses in captions and in OCR of the frames
- the narration lint and script review (`qa/lib/narration.cjs`)

What the automated checks can't catch: a wrong word that is a real word ("account" for "a count") or a
broken code fragment. That's why step 9 reads the captions against the script.

## 9 · EDITOR sign-off (independent reviewer)
Spawn a fresh reviewer subagent with `EDITOR.md`. It reads every contact sheet frame against the
assignment, the code and the narration, clears or escalates every WARN, and writes
`qa/editor-signoff.md` (PASS/FAIL + defect table). On FAIL: fix → rebuild → re-render → re-run 8 → re-review.

## 10 · Deliver
Only with a PASS signoff. Give the user the mp4 path, the length, the signoff summary, and anything you changed from
their reference solution.
