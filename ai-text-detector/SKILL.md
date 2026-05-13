---
name: ai-text-detector
description: Analyze written student prose (essays, lab reports, reflections, READMEs, discussion posts) for signals that suggest AI generation and produce a markdown review report the instructor can attach to a grade. Use this whenever the user asks to check, review, screen, audit, or flag a student submission for AI use, asks "is this AI-written," wants an AI-likelihood assessment on prose, or is grading written work and wants a second opinion on authenticity. Trigger even when the user doesn't explicitly say "AI detection" — phrasings like "does this feel AI-written," "screen these essays," or "check this submission for ChatGPT" all apply.
---

# AI Text Detector (Heuristic, Prose-Focused)

## What this skill does

Reads one or more student-written prose submissions and produces a per-submission markdown report estimating the likelihood the text was AI-generated, citing specific passages and explaining the reasoning. No external API calls — analysis is done by reading the text and applying a structured set of heuristics.

## What this skill is NOT

- **Not a verdict tool.** No heuristic detector — including this one — is reliable enough to accuse a student. Reports are framed as "signals to investigate," not "this is AI." This framing is non-negotiable; it protects the instructor and the student.
- **Not for code.** Designed for prose. If a submission is mostly code, say so and stop — code has different signals and this skill will produce noise.
- **Not for very short text.** Under ~150 words the signals are too sparse to be meaningful. Note this in the report and decline a confidence score.

## Workflow

### 1. Locate the submissions

If the user pointed at a file or folder, read it. If they pasted text inline, use that. If multiple files are present, process each separately and produce one report per file. Common locations to check when the user is vague: the current working directory, `submissions/`, `student-work/`, or wherever the instructor keeps grading folders.

### 2. Triage before analyzing

For each submission, check:
- **Word count.** Under 150 words → skip the scoring, note "insufficient length for reliable heuristic analysis" and move on.
- **Content type.** Mostly code with sparse comments → skip with a note. Mixed code + prose → extract the prose portions (README body, written explanations, reflection sections) and analyze those.
- **Assignment context.** If the user mentioned the assignment (e.g., "Caesar Cipher reflection"), keep that in mind — a 200-word reflection on a technical task should sound technical, and over-polished general prose is more suspect than in an open-ended essay.

### 3. Apply the signal checklist

Read `references/signals.md` for the full taxonomy. Walk through every signal category for each submission. The categories are:

1. **Burstiness & sentence rhythm** — human writing varies wildly in sentence length; AI prose tends to cluster around medium-length sentences.
2. **Lexical fingerprints** — characteristic AI vocabulary ("delve," "moreover," "it's important to note," "in conclusion," "tapestry," "navigate," "leverage," "robust," "underscore"). These shift as models update; the reference file is current as of early 2026.
3. **Structural tells** — tidy 3-point lists, perfectly balanced paragraphs, every paragraph opening with a topic sentence, mechanical transitions.
4. **Hedging and stance** — AI tends toward measured neutrality and over-qualification ("it's worth considering," "various factors"); students writing in their own voice usually pick a position.
5. **Specificity gap** — AI produces plausible-sounding generalities. Real student work tends to reference specific class moments, specific code they wrote, specific bugs, specific names from lecture. The absence of any anchor to the actual course material is a strong signal.
6. **Voice consistency** — does the register stay flat across the whole piece, or does it shift? Sudden polish in one paragraph after rougher prose elsewhere is a copy-paste signal.
7. **Surface artifacts** — em dashes used in a uniform pattern, curly quotes mixed with straight quotes (paste signal), markdown formatting bleeding into prose ("**Conclusion:**"), citations to nonexistent sources, hallucinated technical details.

### 4. Score with appropriate humility

Assign one of four bands, never a precise percentage:

- **Low concern** — reads as authentic student writing. May have some generic phrasing but nothing systematic.
- **Some signals** — a few tells, but plausibly explained by ESL writing, formal register, or a careful student. Worth a glance, not a conversation.
- **Multiple signals** — pattern is consistent across categories. Worth raising in a follow-up conversation with the student about their process.
- **Strong signals across categories** — heavy convergence of tells. Still not proof. Suggests the instructor ask the student to walk through their work.

If you can only find one or two signals, do not escalate to "multiple signals" just to seem thorough. False positives on ESL students and technical writers are the well-documented failure mode here — err toward the lower band when uncertain.

### 5. Write the report

ALWAYS use this exact template, one file per submission:

```markdown
# AI-Generation Review: [filename or student identifier]

**Word count:** [N]
**Assessment band:** [Low concern / Some signals / Multiple signals / Strong signals across categories]
**Confidence:** [Low / Moderate / High] — based on length and signal clarity

## Summary

[2-3 sentence plain-language summary of what you found and what the instructor should do with it.]

## Signals observed

[For each signal category where you found something, a subsection. Skip categories with no findings — don't pad.]

### [Signal category name]
[Brief explanation of what you saw, with a short quoted passage as evidence. Quote passages, don't summarize them — the instructor needs to see the actual text.]

> "[exact passage from the submission]"

[Why this is a signal, with appropriate hedging.]

## Signals absent or weak

[1-2 sentences on what would have raised concern but didn't appear — e.g., "Specific references to class examples appear throughout, including the Week 4 Port Scanner discussion, which weighs against AI generation."]

## Recommended next step

[One concrete suggestion. Examples:
- "No follow-up needed."
- "Worth a brief check-in: ask the student to summarize their approach verbally."
- "Recommend a process conversation — ask the student to walk through how they arrived at the argument in paragraph 3."
- "Consider asking the student to revise with more specific references to course material."]

---
*This report is a heuristic analysis, not a verdict. AI detectors of all kinds — including this one — have well-documented false-positive rates, especially on ESL writers, formal technical prose, and short submissions. Treat findings as signals to investigate, not evidence of misconduct.*
```

### 6. Save and present

Save reports to `./ai-review/[original-filename]-review.md` next to where the submissions live (create the folder if needed). If you processed multiple files, also write a one-page `./ai-review/_summary.md` listing each file with its band, sorted so the highest-concern items are at the top — that's what the instructor will scan first.

## Tone and framing

The instructor (Randy) uses these reports to make decisions about real students. Two things follow:

- **Quote, don't paraphrase, when citing signals.** The instructor needs to see the actual prose to make their own judgment. Saying "the conclusion uses generic AI phrasing" is useless; quoting the conclusion is useful.
- **Don't bury the lede.** If the assessment is "Low concern," say so in the first paragraph so the instructor doesn't have to read the whole report to find out the submission is fine.

## Edge cases

- **ESL writing.** Non-native English writers often produce prose that triggers AI detectors — formal register, careful constructions, less idiomatic word choice. If the submission has minor grammatical patterns suggesting non-native English (article usage, preposition choice), explicitly note this in the report and weight signals more conservatively. The cost of falsely flagging an ESL student is high.
- **Technical writing.** Lab reports and technical reflections naturally use measured, structured prose. The "structural tells" category should be weighted lower when the assignment calls for technical writing.
- **Heavily edited AI output.** A student who used AI then rewrote substantial portions may produce a hybrid that scores in the middle band. The right response is the same as for any middle-band result: a conversation, not an accusation.
- **The student's previous work.** If the instructor has prior submissions from the same student available, comparing voice consistency across assignments is a stronger signal than any single-document analysis. Suggest this comparison when the band is "Multiple signals" or higher.
