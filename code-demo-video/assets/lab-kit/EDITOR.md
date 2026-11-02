# EDITOR step: sign-off before any walkthrough video is delivered

Added after a student reported a misspelled "Hello" (unconfirmed: the review found the typing mid-word,
"Hel", plus two captions that capitalized a lowercase "hello12345"). Nothing ships until this step passes.

## Who does it

An **independent reviewer**: a fresh subagent with no stake in the build. It gets only this file,
the paths below, and the instruction to fail anything it can't verify. The builder doesn't
review their own video.

## Inputs

| What | Where |
|---|---|
| Assignment as students see it (your LMS page, captured that day) | `qa/assignment.txt` |
| Automated report | `qa/editor-report.md` (from `node qa-editor.mjs`) |
| Contact sheets from the **rendered mp4** (mid + end of every beat) | `qa/sheets/*.jpg`, full frames in `qa/frames/` |
| Script, code, beats | `demo.spec.mjs` (`CODE` is the program; narration per beat) |
| The real program | `<program>.py` (written and run by qa-editor.mjs) |

## Pass rules

1. **`qa/editor-report.md` has 0 FAIL.** Every WARN gets looked at and either fixed or written up
   as "checked, fine" with the reason (a Whisper mishearing of a respelled word is fine; a voice that
   actually says the wrong value is not).
2. **Assignment accuracy.** Every doc page (purpose, sample output, requirements, rubric points,
   submit instructions) matches `qa/assignment.txt`: same requirement wording, same point values,
   same file name, same exact data. Sample output on a doc page has to be the program's real output.
3. **Rubric coverage.** Every rubric row is built on screen *and* named in the narration. List each
   row with the beat id where it's covered.
4. **Every frame on the sheets is read, not skimmed.** For each frame, check:
   - **Spelling**: every word in code, terminal, callouts, the Variables panel, pause cards, captions
     and doc pages. Pay extra attention to identifiers, IPs, passwords, filenames, and doubled letters (ll, ss, tt).
   - **Nothing clipped**: no text crossing the window, sheet, terminal or card edges; the full
     terminal output plus the trailing prompt is visible.
   - **Picture matches the voice**: the caption in the frame describes what is lit, typed or shown
     at that moment (yellow bar on the line being narrated, value in the panel matching the words).
   - **Code on screen = the program**: indentation, punctuation, and values in the panel are the real
     values at that point in the trace.
   - **Pause cards**: step n of m in order, checklist matches what was just built.
5. **Captions**: read them against the script narration, word for word. They are built from the
   script (Whisper only times them), so any difference is a `captionFixes` mistake. Spelled the way the
   code spells things (`by_type`, `threat_log.py`, `PEP 8`), case matches what's described (a lowercase
   copy stays lowercase), no glued words ("Efor"), and no real-but-wrong words ("account" for "a count").
   **No burned captions for YouTube** (`burnCaptions: false`: YouTube's CC track carries them). Then the captions are
   `final/<slug>.srt`, which finish-lab.mjs builds from timeline.json:
   read that file against the script instead, and check that no frame shows a caption line. The bottom band (y 880-1040)
   still stays clear, because YouTube draws its CC there.
6. **Red-box marks** (students must see exactly what's being referenced): whenever the
   narration points at code, a value or a slide cell, a red box is around **that exact text** in the frame.
   It must not be off by a column, on the wrong line, or around text that hasn't been typed yet. A frame where the voice names on-screen
   code and nothing is boxed is a defect (missing mark). Gold callouts must still sit at the right edge,
   not on top of the code.
7. **Pronunciation**: listen to at least one beat that says each respelled word (`SAY` in
   tts-eleven-beats.mjs, e.g. tuple = TOO-pul).
8. **Callout boxes and output rings** never cover characters on neighboring lines (e.g. a ring that hid the
   `_` in `threat_log.py`).
9. **No AI-sounding narration.** Read every beat's narration (the spec, or `qa/narration.txt`) as if you're the
   student. It should sound like the presenter talking a class through the lab. Flag filler openers
   ("let's dive in", "great question"), "it's important to note",
   "not just X but Y", lists of three, puffed-up words (crucial, powerful, seamless, robust, delve),
   the same transition starting beat after beat, summaries that repeat the beat, and fake enthusiasm. Confirm
   `qa/humanizer-diff.md` exists, because the humanizer pass is mandatory, and that `qa/script-review.md` is a PASS for the
   narration in the video (`qa/editor-report.md` "words" section: 0 FAIL, which includes the narration lint in
   `qa/lib/`). If the presenter has a style profile (`VOICE_MARKERS`, the skill's "Voice & branding" notes), read it
   against that. Never announce checklists ("we'll check off every one"). A line that reads as AI blocks sign-off the
   same way a wrong box does. In the defect table, quote the line and give the rewrite.

10. **Shell memory is visible** (otherwise students ask "what's going on?"). In every
   Python-shell beat, anything the code uses that was defined on an earlier screen must be visible, either in the SHELL
   Variables panel or on the same screen, and the narration says so when the beat starts by reusing it. The panel's
   values match the session at that moment (loop variables keep their last value; a new `python3` session starts empty).

11. **Windows command is called out.** Every place a student is told to type `python3` (start or
   restart the shell, run the program, the run/submit pause cards), the narration also says that on Windows the
   command is `python`, and the screen shows the Windows form at that moment. FAIL if any `python3` instruction lacks both.
   **Say-it-once variant** (for a long course whose viewers already know it; decide per course, in the skill's
   "Voice & branding" notes):
   - The voice says it ONCE, at the first run near the start of the video ("on Windows, type python instead of
     python3"), and the screen shows the Windows form at that moment. FAIL if that first callout is missing.
   - After that, the voice just says "run the program", "run it" or "run Python". FAIL if the voice repeats the
     Windows callout later in the video.
   - YOUR TURN and Run-it cards still show the Windows form as a quiet second line (everything a student types is on
     screen), but no other run needs it on screen.

12. **The VS Code window looks real** ("pixel perfect to the real app, so it's hard to tell it's not real").
   Compare editor frames with a real VS Code (Dark 2026) window (a screenshot of your own, or the skill's
   `assets/vscode/reference/real-editor-focused.png` if you captured one)
   and FAIL on anything a VS Code user would notice: hand-drawn icons or boxes in the chrome, wrong code colors
   (every line must come from `qa/vscode-tokens.json`: the build log shows no `⚠ no real VS Code colors`), a line
   number for a line that hasn't been written yet, a terminal that slides in, a blinking terminal cursor, missing
   shell-integration dots, no pointer during a mouse action, no auto-indent / auto-closed brackets while typing, two
   current lines lit at once, an edited file whose tab never shows the unsaved dot or that is run before it is saved, no terminal cursor while it has focus, the wrong prompt format, tabs/breadcrumbs/status that don't match the open file, or
   code running under the minimap that the real editor would show differently. Annotations (red marks, gold
   callouts, cards) are allowed; they must not look like part of VS Code.
13. **A pause shows everything the step asks them to type** (when the terminal window takes over the code window,
   students can't see what to type and have to back the video up).
   Read the frame at EVERY pause card, after the card is up and the window has shrunk:
   - every code line typed since the previous pause is on screen, including the header and the first lines of a
     long step. It isn't under the terminal panel or a maximized terminal, isn't scrolled off, and isn't under
     sticky rows or the card. Its END is readable too: no line runs under the minimap (53 characters fit).
   - every terminal command or input of that step is visible in the open terminal, or written on the card.
   The build enforces the line part (`ERROR: pause … students can't see line(s) …`). It can't judge a step whose
   lines live in two files, so check those by eye. FAIL any pause where a student would have to rewind to see
   what to type.

## Output

Write `qa/editor-signoff.md`. Start it with these three lines, then the defect table (timestamp, frame file,
what's wrong, the fix):

```
VERDICT: PASS            (or FAIL)
take: final/<folder>.mp4
take-bytes: <stat -f %z final/<folder>.mp4>
```

Don't publish a take whose size doesn't match `take-bytes`. On FAIL, the builder fixes, rebuilds, re-renders, re-runs `qa-editor.mjs`, and the
reviewer re-checks the changed beats. Only a PASS signoff ships.
