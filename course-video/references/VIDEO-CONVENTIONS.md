# Video Conventions — HyperFrames coding videos

Conventions for every course video this skill builds. (Voice/pronunciation rules live in the brand folder's
`PRONUNCIATIONS.md`; the example is `example-brand/PRONUNCIATIONS.md`.)

## Highlight the code being discussed

**Point the student's eyes at the exact code under discussion.** Two behaviors, applied by default
to every coding video:

### A. Logic walk-through → moving line highlight
When the narration steps through *how code runs* (if/elif order, nesting, tracing values), animate a
highlight bar down the code **line-by-line, synced to the words** ("first… then… and notice line 7…").
**In-context only:** the line-highlight and the window glow must **clear once the narration moves on**
from reading the code (don't leave it stuck on the last line) — clear ~1.8s after the last code line is
spoken. `build-lecture.mjs` does this automatically (matches each code row to its spoken token, then
fades the highlight + glow at the code-discussion end).

### B. Snippet reference → window callout
When narration points at a code block ("in this example…", "this line…"), **frame the code window
with an accent border + soft glow** (optional slight scale-up) while it's discussed, and remove it when
the topic moves on. For a single token (a variable / operator / flag), tint or box **just that token**.

## HyperFrames mechanism (reuse what already exists)

- **Line highlight:** the `.code.tracer` + `.step-hl` pattern (add it to your deck's CSS). A
  positioned semi-transparent bar inside the `.code` block, moved per line:
  `tl.to("#sX-hl", { top: <line px> }, T)`. Use `.ln-row.dim` (opacity 0.3) for skipped/untaken lines.
- **Window callout:** `tl.to("#sX-code", { boxShadow: "0 0 0 3px <accent at .55>, 0 0 28px <accent at .35>", borderColor: "<accent>" }, T)` on focus; revert on the `out` time.
- **Token highlight:** wrap the token in a `.tok` span and tint/box it in the accent colour.
- **Palette:** brand accent = "look here", green = correct / the result, red = error / untaken branch.
- **Sync:** transcribe the scene's narration clip (word-level Whisper) and pin each line/step to its
  spoken trigger — the same "find real timings" technique used for the note panels (SKILL.md step 3).
  The highlight should land *as* the line is spoken, not before.
- Keep inactive highlight/border elements `visibility:hidden` so the WCAG contrast checker skips them.
- **Verify from rendered frames** — confirm each highlight sits on the right line/token and clears on `out`.
- Deeper patterns: `hyperframes` skill → `references/css-patterns.md` (seek-safe marker sweeps,
  line-step bar, circles, underlines); this skill's SKILL.md → §4b "Highlight the code being discussed".

## Emphasize Python keywords & operators

When narration says a **Python keyword/operator that is also an ordinary English word**
(`for`, `while`, `if`, `and`, `or`, `not`, `in`, `is`, `break`, `continue`, `else`, `def`, `import`,
`try`, `except`, `return`, `class`, …), it must land as a distinct term, not melt into the sentence.
Kokoro has no stress/SSML control, so the only lever is **punctuation that isolates the word with pauses**.

**Finalized technique (tested by ear):**
- `for` is the worst offender (super-common English word) → **dashes**: `a — for — loop`, `— for — p in ports`.
- `while` and the others → **quotes inline**: `the "while" loop`, `"break"`, `"continue"`, `we write "while" count …`.
- **Dashes when formally defining/introducing** a keyword; quotes for ordinary inline mentions.
- Do NOT emphasize when the word is plain English (`for example`, `looking for`) — only the keyword sense.

Both generators encode this: `build-narration.mjs` → `emphasizeKeywords()` (Kokoro path).

**ElevenLabs path (clone voice) — same need, different lever.** The clone does NOT set keywords/operators
apart on its own either (the "ElevenLabs emphasizes naturally" assumption turned out to be
wrong). The clean-mode generator runs `emphasizeKeywordsEleven()`, which uses **quotes** for everything
(`if`/`elif`/`else`/`while` and `and`/`or`/`not`) — quotes beat em-dashes in A/B listening for the ElevenLabs voice.
Detection is **automatic by context** (high precision): it quotes only the naming/keyword sense
(`the "if" statement`, `The first is "and", which…`, `the actual words "and", "or", and "not"`) and leaves
**expression operators** (`443 and protocol`, `"WARN" or severity`, `so not is_locked`) and **plain English**
(`does not use`, `and then`) untouched. Quotes change only prosody, so Whisper captions stay correct.
(`elif` is additionally respelled `ell-iff` for pronunciation and caption-patched back — see PRONUNCIATIONS.md.)

### A. Audio
- **Single operator being defined** → recast to name it and set the word off with a dash + stop:
  `The first operator is — and. It is true only when both sides are true.`
- **List of operators** → quote each one:
  `Python uses the actual words: "and", "or", and "not".`
- **Do NOT emphasize when the operator is read inside a condition** (e.g. "x greater than 5 *and* y
  less than 5", "True *and* True is True") — there it's part of the expression and should stay natural.

### B. Slides / visuals
Render operators as prominent keywords, not filler — bold, **accent colour / chip**, larger weight — so
`and` / `or` / `not` clearly read as distinct terms (e.g. logic-gate labels and any inline mention).
