# AI-Generation Signal Reference

This file expands on the seven signal categories in `SKILL.md`. Use it as a checklist when analyzing a submission — walk through each category, note what you observed, and only after going through all seven, decide on the assessment band.

A central principle: **no single signal is diagnostic.** A student who writes formally and uses "moreover" is not an AI user. The pattern that matters is *convergence* — multiple categories firing on the same submission, across many sentences, in ways that don't have a benign explanation.

---

## 1. Burstiness & sentence rhythm

**What humans do:** Sentence lengths vary wildly. A 4-word sentence next to a 32-word one. Fragments. Run-ons when excited. Short emphatic statements. Then dense ones.

**What AI tends to do:** Cluster around 15-25 word sentences. Smooth, even rhythm across paragraphs. Few sentences under 8 words. Few sentences over 35.

**How to check:** Eyeball the sentence-length distribution across a paragraph. If almost every sentence falls in a tight band, that's a signal. Read it aloud mentally — does it have a pulse, or is it metronomic?

**Caveat:** Some students write evenly by nature. Some assignments (formal lab reports) encourage even rhythm. Weight this lower for technical writing.

---

## 2. Lexical fingerprints

Words and phrases that appear disproportionately in AI output as of early 2026. Models change; this list reflects current GPT-4/5, Claude, and Gemini outputs.

**High-signal phrases** (rare in student prose, common in AI):
- "delve into" / "delving into"
- "it's important to note that"
- "navigate the complexities"
- "in the ever-evolving landscape"
- "tapestry of" / "rich tapestry"
- "underscore the importance"
- "leverage" (as a verb in non-business contexts)
- "robust" (applied to ideas or arguments rather than systems)
- "multifaceted"
- "in conclusion," at the start of a final paragraph
- "moreover," "furthermore," "additionally," used as paragraph openers
- "this highlights the need for"
- "a nuanced understanding of"
- "speaks volumes"
- "at the heart of"
- "paramount" / "of paramount importance"

**Medium-signal phrases** (occur in human writing but cluster heavily in AI):
- "various" / "a variety of"
- "key" used as an adjective everywhere ("key insight," "key takeaway," "key factor")
- "ultimately,"
- "essentially,"
- "indeed,"
- "it is worth noting"

**What to look for:** Not one occurrence — clustering. Three or four of these in a 400-word piece is a signal. One "delve" is meaningless. The student may just have read a lot.

**Caveat:** ESL students and students mimicking formal academic register can hit these phrases naturally. They learned to write from sources that overuse them.

---

## 3. Structural tells

**Tidy three-point structure.** AI loves enumerated arguments: "There are three main reasons..." followed by exactly three reasons, each one paragraph. Real student writing is messier — sometimes two reasons, sometimes a fourth tacked on, sometimes a digression.

**Balanced paragraphs.** Every paragraph roughly the same length. Each paragraph one self-contained idea with topic sentence, support, conclusion. This is what writing instructors teach, so students do produce it — but AI produces it *with eerie consistency*.

**Mechanical transitions.** Every paragraph opens with "Furthermore," "Moreover," "Additionally," "In addition," "On the other hand." Real students vary or just don't use transitions.

**Symmetric conclusions.** AI conclusions tend to restate the introduction's framing in mirror form, sometimes verbatim phrase reuse.

**Caveat:** Some students were taught the five-paragraph essay rigorously and produce textbook structure. Look at it alongside other signals.

---

## 4. Hedging and stance

**What humans do:** Take a position. Sometimes a wrong one, sometimes overstated, but a position. Strong adjectives. Personal reactions. "I think X is mostly nonsense because..."

**What AI tends to do:** Hedge constantly. "While there are many perspectives to consider..." "It's important to recognize that various factors..." Avoid committing. Present "both sides" even when the prompt asked for an argument. Use evaluative language that doesn't actually evaluate ("interesting," "thought-provoking," "complex").

**How to check:** Can you summarize the writer's actual position in one sentence? If the answer is "no, they sort of said multiple things were valid," that's a signal — especially on a prompt that asked for a stance.

**Caveat:** Some students are conflict-averse and hedge naturally. Some assignments don't call for a stance. Weight by what the prompt asked for.

---

## 5. Specificity gap

This is the strongest signal for course-based work and the hardest one for AI to fake without being given the material.

**What real student writing does:** References specific class moments. "In the Caesar Cipher lab we did last week, I had a bug where..." "The example Professor [name] gave with the dictionary lookup..." "When I ran the port scanner on my own machine..." Personal, specific, course-anchored detail.

**What AI tends to do:** General, plausible-sounding statements that could apply to any class on the topic. "Caesar Ciphers are a foundational concept in cryptography that involve shifting letters by a fixed amount." Correct, but generic — could have been written without ever attending the class.

**How to check:** Ask yourself: "Could a smart student who never attended this class have written this paragraph?" If yes for the whole piece, that's a strong signal. Look for anchors to the actual course: specific assignments, specific code the student wrote, specific lecture references, specific tools used.

**This signal weighs heavily.** Absence of any course-specific anchor in a piece that should have them is one of the more reliable tells, because AI can't fabricate it without access to the course materials.

**Caveat:** Some prompts genuinely don't call for course-specific references (a general reflection on cybersecurity ethics, for example). Calibrate to what the assignment asked for.

---

## 6. Voice consistency

**What to look for:** Does the register stay flat across the whole submission, or does it shift?

**Sudden polish.** A piece that's rough in the first paragraph and suddenly sophisticated in the third is a copy-paste signal — likely an AI-generated section pasted into student writing.

**Sudden roughness.** The reverse — polished AI prose with a clumsy student-written sentence wedged in — also happens, often in the conclusion where students added their own ending.

**Vocabulary jumps.** A writer who uses "stuff" and "things" suddenly uses "paradigm" and "ontology." A writer using SAT vocabulary suddenly uses "gonna" once.

**Comparing to prior work.** If you have other submissions from the same student, compare voice. This is the single most useful signal, but only available when the instructor flags it.

**Caveat:** Real student writing has its own inconsistencies — drafts, edits, getting tired toward the end. Don't flag minor variation; flag jumps.

---

## 7. Surface artifacts

These are mechanical tells from the copy-paste process itself.

**Mixed quote styles.** "Curly quotes" next to "straight quotes" in the same document — sign of pasting from a chatbot UI into a plain-text editor or vice versa.

**Markdown bleed.** "**Conclusion:**" with literal asterisks in the prose. Bullet points that became dashes. Code fence backticks left in.

**Em dash patterns.** AI uses em dashes — like this — in a particular rhythm. Many em dashes in a short piece, especially used as parenthetical pause rather than for emphasis, is a soft signal. (Note: many human writers love em dashes too. Don't flag em dash usage alone.)

**Hallucinated citations or facts.** A reference to a textbook chapter that doesn't exist. A quote attributed to someone who didn't say it. A technical claim that's almost-but-not-quite right. If you can check against course material, do.

**Unicode oddities.** Non-breaking spaces, zero-width characters, weird apostrophes. These come from pasting from web UIs.

**Non-breaking hyphens in compound modifiers.** Look for `Unix‑like`, `open‑source`, `community‑driven`, `rolling‑release`, `beginner‑friendly` rendered with U+2011 (non-breaking hyphen) instead of a regular hyphen-minus. Most students type a normal `-` from their keyboard; chatbots commonly emit the typographically "correct" non-breaking hyphen in compound modifiers. Several compound modifiers in a row using U+2011 is a near-certain paste-from-LLM tell. (Visual inspection alone won't catch this — copy a token into a tool that shows code points if you're unsure.)

**Unfilled LLM template placeholders.** Literal bracketed or "insert" text left in the submission: `[insert detail here]`, `[your distro]`, `[name of book]`, "insert their distro's package manager," "TODO: add example." This is the strongest single piece of direct evidence the detector encounters — it indicates the student asked an LLM for a template-with-slots and pasted the output without filling in the slots. A student writing from their own brain does not type the phrase "insert their distro's package manager." Treat this as a smoking-gun signal worthy of escalating the band on its own.

**Forward date/version anachronisms.** Reference to a model version, news event, or technology that the student couldn't reasonably have written about in their own voice ("As GPT-5 demonstrated..." in a Week 2 assignment).

**Backward date/version anachronisms (training-cutoff fingerprint).** The inverse of the above and arguably more common: technical claims using versions that were *current as of the AI training cutoff* but are now visibly outdated. As of mid-2026, this looks like a student calling Fedora 40, Alpine 3.20, Ubuntu 24.04, or Node 20 "the current version" when those are 1–2 years stale. The fingerprint is that the staleness clusters around a specific cutoff date (April 2024 for many models, late 2024 / early 2025 for others) — not random staleness. Cross-check claimed "current" versions against actual current versions before flagging.

---

## Calibrating the assessment band

After walking through all seven categories, count how many fired and how strongly:

- **Low concern:** 0-1 weak signals. Submission reads as authentic.
- **Some signals:** 2-3 categories with weak-to-moderate signals, plausibly explained by formality, ESL, or careful editing.
- **Multiple signals:** 3+ categories firing clearly, including at least one of {specificity gap, voice consistency, surface artifacts} — those are the harder-to-fake categories.
- **Strong signals across categories:** 5+ categories firing strongly, including specificity gap or surface artifacts. The pattern is hard to explain benignly.

**Direct-evidence override.** Two surface artifacts are strong enough that they escalate the band on their own, even if other categories are quiet:
- An **unfilled LLM template placeholder** in the submitted text (literal `[insert X]`, "insert their distro's package manager," etc.). This alone takes the band to at minimum "Multiple signals" and usually "Strong signals across categories." A student writing without an LLM cannot produce this artifact.
- A **clear training-cutoff version cluster** — two or more independent technical claims using versions that were current as of a specific known model training cutoff and are now visibly stale, when the student had access to current information. Takes the band to at minimum "Multiple signals."

These overrides exist because the false-positive cost on these specific artifacts is near zero — they are very hard to produce by accident.

**Confidence:**
- **Low:** Submission under 250 words, or the signals are ambiguous.
- **Moderate:** 250-600 words with reasonably clear signals either way.
- **High:** 600+ words with clearly converging signals (in either direction — high confidence that something is *fine* is also valuable).

**When in doubt, drop a band.** A false flag damages a student more than a missed flag damages a course.
