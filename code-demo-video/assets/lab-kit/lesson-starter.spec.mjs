// STARTER: one lesson of a free YouTube coding course (copy it to demo.spec.mjs in a lab-kit project).
// Replace the program, the narration and the slides; keep the nine parts in this order:
//   1 hook (0:00-0:15): the payoff first (the finished program running, or the bug this lesson fixes), then one
//     line on what the viewer will be able to do. No "Welcome to".
//   2 sting + promise line (about 0:15): the 2-3 s helmet, then "the free code is linked below, lesson N of a free
//     beginner course". The free brand gets said out loud here.
//   3 two to four concept beats: the idea in plain language, shown visually (a slide, the Variables panel, a
//     highlighted line), typed at 8 characters a second, then run. 13-15 code lines a scene at most, and 53
//     characters a line (phones). The code doesn't fit (a project lesson's longer program): try editorFontSize 13
//     -> 12 (16 / 17 lines, 57 / 62 characters), then windowWidth up to 920 (70 characters at 12); the spec-level
//     options are in references/spec-format.md, the limits in references/vscode-sim.md.
//   4 predict the output: a PREDICT card before the run, then the reveal (raw material for a Short).
//   5 your turn: a STEP n OF m card with everything to type on screen; the narration ends "Pause the video now,
//     and ..." and the card holds 4 s.
//   6 the common mistake: a red box on the bug, the real traceback, the fix.
//   7 the boss level, only where the manifest says `boss:` (a 30-60 s turtle drawing or mini-build).
//   8 the recap card: three lines, on screen and spoken.
//   9 NO end screen (optional style choice): the recap closes with the sign-off and the video ends there. Never
//     mention the next lesson: YouTube's up-next and related videos, and the playlist, do that.
// Length: the most useful lesson wins. Don't cut teaching to hit a runtime and don't pad.
// Voice: write the way the presenter really talks. Narration stays a plain double-quoted string, which is what the
// words gate reads. Windows: every python3 gets "on Windows, type python" said AND shown (or said once at the
// first run; see EDITOR.md rule 11).
// Voice: node tts-kokoro-beats.mjs (free Kokoro af_heart @ 0.95) can be the final voice; tts-eleven-beats.mjs
// is the paid option.
// Branding: "neutral", or a brand.json (see references/spec-format.md, "Brand scenes") for the sting/recap emblem.
import { readFileSync } from "node:fs";
import { createLab, writePrograms } from "./lab-helpers.mjs";

// lesson.json (optional, next to the spec): { "course": { "name", "python_version" }, "lesson": { "n", "slug",
// "title", "card", "boss" }, "next": { ... } }. Without it, the placeholders below are used.
let META = {};
try { META = JSON.parse(readFileSync(new URL("./lesson.json", import.meta.url), "utf8")); } catch {}
const course = { name: "Example Python Course", python_version: "3.13", ...META.course };
const lesson = { n: 1, slug: "lesson-01", title: "Your first program", ...META.lesson };
const NN = String(lesson.n).padStart(2, "0");

// ---------------------------------------------------------------- the program (source of truth)
export const CODE = {
  1: "# Starter program: replace it with the lesson's code.",
  2: 'name = "coder"',
  3: 'print(f"Hello, {name}!")',
};
const FILES = [{ name: `lesson${NN}.py`, base: 0 }];
writePrograms(CODE, FILES); // the real file, next to the spec: the QA editor runs it and diffs the terminal
const RUN = `python3 ${FILES[0].name}`;
const OUT = ["Hello, coder!"]; // paste the REAL output of a run on your Python

const L = createLab(CODE);
const { B, T, C, M, MD, MO, pre } = L;

// ================================================================= BEATS
// 1 · hook
B({
  id: "hook",
  scene: "editor",
  prefill: pre(1, 3),
  narration:
    "This is the hook. Show the finished program running first, and then say in one sentence what you're going to be able to do after this lesson.",
}, (at) => [
  { do: "terminal-open", at: at("finished program") },
  { do: "term-type", at: at("running first"), text: RUN, cps: 14 },
  { do: "term-out", at: at("and then say"), lines: OUT },
]);

// 2 · sting + promise line
B({
  id: "promise",
  scene: "sting",
  sting: {
    chip: `LESSON ${NN}`,
    title: lesson.card || lesson.title,
    course: `${course.name} · free course`,
    free: "Free code for this lesson: link in the description",
  },
  narration:
    "The free code for this lesson is linked in the description, and this is one lesson of a free Python course for beginners.",
});

// 3 · concept beats: the idea first, then the code
B({
  id: "idea1",
  scene: "doc",
  doc: {
    tag: `LESSON ${NN} · THE IDEA`,
    title: "One idea, in plain words",
    body: `<p>Explain the idea with an everyday example before any code.</p>
<span class="ex">${OUT.join("\n")}</span>`,
  },
  narration:
    "So this is where the idea gets explained in plain words, with an everyday example, before we write any code.",
}, (at) => [MD(OUT[0], at("everyday example"))]);

B({
  id: "code1",
  scene: "editor",
  fileCreate: true,
  fileCreateAt: "new file",
  narration:
    "In the Explorer, I'm going to click the new file button and name it lesson dot P Y. Then I type a comment, a variable called name, and a print that says hello to that name.",
}, (at) => [
  T(1, at("then I type"), 16),
  T(2, at("a variable called")),
  T(3, at("and a print")),
]);

// 4 · predict the output (before the run)
B({
  id: "predict",
  scene: "editor",
  pauseOverlay: true,
  badge: "PREDICT THE OUTPUT",
  task: "What will this print?",
  checklist: ["Read line 3", "Say your answer out loud"],
  holdAfter: 4,
  narration: "Before I run it, what do you think this prints? Pause the video now, and make your guess.",
});

B({
  id: "run1",
  scene: "editor",
  prefill: pre(1, 3),
  narration:
    "So I'm going to save it with Command S, or Control S on Windows, and run it with python three. If you're on Windows, you're going to type python, without the three.",
}, (at) => [
  { do: "save", at: at("save it") },
  { do: "terminal-open", at: at("and run it") },
  { do: "term-type", at: at("and run it"), text: RUN, cps: 14 },
  { do: "term-out", at: at("if you're on windows"), lines: OUT },
  MO(OUT[0], at("without the three")),
]);

// 5 · your turn
B({
  id: "yourturn",
  scene: "editor",
  pauseOverlay: true,
  step: { n: 1, of: 1 },
  task: "Your turn: change the name and run it",
  checklist: ["Put your own name on line 2", "Save, then run it"],
  hint: `${RUN}   (Windows: python ${FILES[0].name})`,
  holdAfter: 4,
  narration: "Now it's your turn. Pause the video now, and change the name on line two to your own name, then save it and run it.",
});

// 6 · the common mistake (paste the REAL traceback)
B({
  id: "mistake",
  scene: "doc",
  doc: {
    tag: "COMMON MISTAKE",
    title: "A typo in a variable name",
    body: `<span class="ex">Traceback (most recent call last):
  File "lesson${NN}.py", line 3, in &lt;module&gt;
NameError: name 'nme' is not defined</span>
<p>Fix: spell the name the same way every time.</p>`,
  },
  narration:
    "A very common mistake is a typo in a variable name. Python stops and gives you a name error, and the fix is to spell the name the same way every time.",
}, (at) => [MD("NameError", at("a name error"))]);

// 7 · the boss level: only when the manifest row has `boss:` (lesson.boss). Add it here as editor beats.

// 8 · recap
B({
  id: "recap",
  scene: "recap",
  recap: {
    tag: `LESSON ${NN} · RECAP`,
    head: "Three things to remember",
    lines: ["The first thing to remember", "The second thing", "The third thing"],
  },
  // the recap is the last beat: it closes with the sign-off (no end screen, no next-lesson teaser)
  narration: "So the first thing to remember is this. The second thing is that. And the third thing is the other one. I hope you found this useful, and reach out in the comments if you have any questions.",
}, (at) => [
  { do: "recap-line", n: 0, at: at("the first thing") },
  { do: "recap-line", n: 1, at: at("the second thing") },
  { do: "recap-line", n: 2, at: at("and the third") },
]);

export default {
  id: lesson.slug.split("/").pop(),
  mode: "walkthrough",
  branding: process.env.BRAND || "neutral",
  course: course.name,
  module: `LESSON ${NN}`,
  docLabel: "", // doc slides carry the course and lesson only (the default says ASSIGNMENT)
  file: { name: FILES[0].name, lang: "python", folder: "python-course" },
  files: FILES,
  statusRight: course.python_status || `Python ${course.python_version}`,
  // anonymous channel: a generic Mac prompt, never a real user or machine name
  terminalPrompt: "student@MacBook-Pro python-course % ",
  qa: { program: FILES[0].name, runs: [{ stdin: "" }] },
  // the clone's pace: a little slower than the default 1.09, plus 0.45 s more at each sentence end.
  // Only tts-eleven-beats.mjs reads them; Kokoro ignores both
  voiceSpeed: 0.92,
  sentencePause: 0.45,
  captionFixes: [
    ["V S Code", "VS Code"],
    ["python three", "python3"],
    ["dot P Y", ".py"],
    ["command S", "Command S"],
    ["control S", "Control S"],
  ],
  voice: { draft: "kokoro af_heart @ 0.95", final: "kokoro af_heart @ 0.95" }, // or final: ElevenLabs (tts-eleven-beats.mjs)
  beats: L.beats,
};
