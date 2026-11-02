// The words gate for paid-voice scripts (the lab kit's tts-eleven-beats.mjs). Call it only when a new ElevenLabs
// take is about to be made: cached takes cost nothing and were made from words that were already checked.
//   import { wordsGate } from "./qa/lib/gate.mjs"; wordsGate(process.cwd(), ["hook", "setup"]);
// Exits 2 with the reasons when the script isn't humanized, linted and reviewed for exactly these words.
// SKIP_SCRIPT_REVIEW="<reason>" lets one run through; the reason is logged to qa/overrides.log.
// Rules for the reviewer: references/script-review.md in the code-demo-video skill.
import { createRequire } from "node:module";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const { gate } = createRequire(import.meta.url)("./narration.cjs");

export function wordsGate(dir, what = []) {
  const g = gate(dir);
  const label = what.length ? ` (${what.length} new take${what.length === 1 ? "" : "s"}: ${what.slice(0, 6).join(", ")}${what.length > 6 ? "…" : ""})` : "";
  if (g.ok) { console.error(`✓ words gate: reviewed script, narration-sha ${g.sha}${label}`); return g; }
  const skip = process.env.SKIP_SCRIPT_REVIEW;
  if (skip) {
    const qa = join(dir, "qa");
    mkdirSync(qa, { recursive: true });
    appendFileSync(join(qa, "overrides.log"), `${new Date().toISOString()}  voiced without a passing review${label}: ${skip}\n  ${g.problems.join("\n  ")}\n`);
    console.error(`! words gate skipped (SKIP_SCRIPT_REVIEW: ${skip}); logged to qa/overrides.log`);
    return g;
  }
  console.error(`✗ Not voicing yet${label}. The script has to pass the words gate first:`);
  for (const p of g.problems) console.error("  - " + p);
  console.error("  See the skill's references/script-review.md. Drafts in Kokoro don't need it.");
  console.error('  To voice anyway (logged): SKIP_SCRIPT_REVIEW="<reason>" node tts-eleven-beats.mjs');
  process.exit(2);
}
