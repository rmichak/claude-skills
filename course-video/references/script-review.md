# Script review: the words gate before paid narration

A paid voice (ElevenLabs) only reads a script that was humanized, linted and reviewed for **exactly these words**.
Kokoro drafts don't need any of this: drafting is how you hear the script. The gate lives in `engine/qa/`
(`narration.cjs` + `gate.mjs`); `engine/build-module.sh` copies it into each project's `qa/lib/`, and `tts-eleven.mjs`
runs it before voicing. It reads the lecture narration from `narration/sceneNN.txt` (Mode B).

## What the gate checks

```bash
node qa/lib/narration.cjs .            # the lint: FAIL / WARN lines with the scene id and a fix
node qa/lib/narration.cjs . --gate     # exit 0 only when all three below hold
node qa/lib/narration.cjs . --hash     # the current narration-sha
```

1. **Lint has no FAIL.** FAIL = tells a listener spots at once: "let's dive in", "it's important to note",
   "not just X, but Y", "That's not X. That's Y.", hype words (game-changer, supercharge, level up), AI vocabulary
   (delve, seamless, robust, pivotal, crucial, tapestry), stock YouTube lines (buckle up, stay tuned), promising a
   checklist instead of doing it. WARN = fine once, a pattern when repeated (sincerity adverbs, rhetorical questions,
   stagey reactions, many one-word punchlines, em dashes, too many `[pause]` marks, very short average sentences).
2. **`qa/humanizer-diff.md` exists**: the `humanizer` skill ran on the narration and the before/after is recorded.
3. **`qa/script-review.md` passes these words.** An independent reviewer (a fresh subagent that didn't write the
   script) reads every scene and writes the file, starting with:

   ```
   VERDICT: PASS            (or FAIL)
   narration-sha: <output of node qa/lib/narration.cjs . --hash>
   ```

   then a table of any lines it changed or flagged. Editing any narration afterwards changes the sha, so the review
   goes stale and the changed lines get reviewed again. Voice-only respellings (`SAY`, `say:`) and pause lengths are
   not part of the hash and can change freely.

## What the reviewer reads for

- Does each scene sound like a person teaching a class, in the presenter's own register (short sentences, "you", "we")?
- Every lint FAIL is fixed, and every WARN is either fixed or justified.
- No filler openers, no lists of three for rhythm, no summaries that just restate the slide, no fake enthusiasm.
- The same transition doesn't start scene after scene.
- Every `### Slide N` block is still there (the count must match the deck), and quoted keywords survive.

## Presenter profile (optional)

Point `VOICE_MARKERS` at a JSON file (or save it as `qa/voice-markers.json`) to tune the lint to a real presenter:

```json
{ "absent": ["phrases the presenter never says"], "sentenceWordsMean": 19 }
```

`absent` phrases become WARNs; `sentenceWordsMean` is shown next to the short-sentence warning.

## Overrides

`SKIP_SCRIPT_REVIEW="<reason>" node tts-eleven.mjs` voices without a passing gate and appends the reason and the
open problems to `qa/overrides.log`. Use it for experiments, not for the take you publish.
