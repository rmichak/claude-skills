// On-screen words and their spoken times.
// A beat's text is plain words with two marks: *emphasis* (the brand's accent word) and ~strike~.
// Every on-screen word lands when the presenter says it (the style's main trick): we find it in the
// camera transcript inside the beat's window and reveal it a hair early.

const NUM = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };

// "Ten," "10" and "ten" all compare equal; so do "AI's"/"AIs" and "percent"/"%"
export function norm(s) {
  let t = String(s).toLowerCase().replace(/[’']/g, "").replace(/percent/g, "%").replace(/[^a-z0-9%]/g, "");
  if (t in NUM) t = String(NUM[t]);
  return t;
}

export function parseText(text) {
  const ws = []; let em = false, strike = false, cur = null;
  for (const ch of String(text ?? "")) {
    if (ch === "*") { em = !em; continue; }
    if (ch === "~") { strike = !strike; continue; }
    if (/\s/.test(ch)) { cur = null; continue; }
    if (!cur) ws.push(cur = { text: "", em: false, strike: false });
    cur.text += ch; cur.em ||= em; cur.strike ||= strike;
  }
  return ws;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export { esc };

// <span class="w"> per word, so each can be revealed on its own
export function wordsHtml(ws, cls = "w") {
  return ws.map((w) => `<span class="${cls}${w.em ? " em" : ""}${w.strike ? " strike" : ""}">${esc(w.text)}</span>`).join(" ");
}

// Index of the first transcript word where `phrase` starts, searching from `from`. -1 if it isn't said.
export function findPhrase(words, phrase, from = 0) {
  const want = String(phrase).split(/\s+/).map(norm).filter(Boolean);
  if (!want.length) return -1;
  for (let i = Math.max(0, from); i <= words.length - want.length; i++) {
    let k = 0;
    while (k < want.length && norm(words[i + k].text) === want[k]) k++;
    if (k === want.length) return i;
  }
  return -1;
}

// The spoken time of each on-screen word inside [t0, t1], in order. A word that isn't said (a label,
// a number shown as digits but said differently) follows the previous one by `gap`.
export function syncTimes(ws, words, t0, t1, { lead = 0.1, gap = 0.12, first = null, unsaid = false } = {}) {
  // unsaid: text he doesn't speak (a qualifier, a source), so never pin it to a spoken word that happens to match
  const win = unsaid ? [] : words.filter((w) => w.start >= t0 - 0.35 && w.start < t1);
  let j = 0, prev = first ?? t0 + 0.05;
  return ws.map((w) => {
    const n = norm(w.text);
    for (let k = j; n && k < win.length && k < j + 14; k++) {
      if (norm(win[k].text) === n) { j = k + 1; prev = Math.max(t0 + 0.02, win[k].start - lead); return prev; }
    }
    prev = prev + gap;
    return Math.min(prev, Math.max(t0, t1 - 0.4));
  });
}
