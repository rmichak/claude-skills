// lists MO/MC marks that would fire before the terminal text they box exists (beat-relative times)
const m = await import("../demo.spec.mjs");
for (const b of m.default.beats) {
  const acts = b.actions || [];
  for (const k of acts.filter((a) => a.do === "mark" && (a.out || a.cmd))) {
    const want = k.out || k.cmd;
    const src = acts.filter((a) => (k.out ? a.do === "term-out" && (a.lines || []).join("\n").includes(want) : a.do === "term-type" && (a.text || "").includes(want)));
    if (!src.length) { console.log(`${b.id}: "${want.slice(0, 40)}" NOT FOUND`); continue; }
    const t = Math.min(...src.map((a) => a.at + (k.cmd ? (a.text.indexOf(want) + want.length) / (a.cps || 8) : 0)));
    if (t > k.at - 0.05) console.log(`${b.id}: "${want.slice(0, 40).replace(/\n/g, "⏎")}" mark ${k.at} < ready ${t.toFixed(2)} (late ${(t - k.at).toFixed(2)}s)`);
  }
}
