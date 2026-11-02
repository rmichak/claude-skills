// The beat library: one renderer per beat type. Each returns the beat's HTML and schedules its tweens on the
// main timeline at global seconds, keyed to the words the presenter says (c.sync). The camera mode for each type
// is in CAMERA; a beat can override it with "cam".
// Motion vocabulary (references/motion-grammar.md in the skill): words rise out of a blur as they're spoken,
// objects pop with a small overshoot, numbers count, lit things glow.
import { parseText, wordsHtml, esc } from "./text.mjs";
import { icon, CURSOR } from "./icons.mjs";

// full = the presenter fills the frame · punch = full, zoomed · pip = corner circle · split = card on the left · off = graphic only
export const CAMERA = { pop: "full", cam: "full", headline: "off", chapter: "off", tiles: "off", stat: "off", list: "pip",
  pills: "off", verdict: "split", shot: "pip", icons: "off", flow: "pip", quote: "split" };

const WORD_IN = [{ opacity: 0, y: 18, filter: "blur(10px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.42, ease: "power3.out" }];
const POP_IN = [{ opacity: 0, scale: 0.82, y: 12, filter: "blur(6px)" }, { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", duration: 0.5, ease: "back.out(1.8)" }];

// a block of words that land as they're spoken; returns the HTML and schedules the reveals
function said(c, key, text, cls, opts = {}) {
  const ws = parseText(text);
  if (!ws.length) return "";
  const times = c.sync(ws, opts);
  const html = ws.map((w, i) => `<span id="${c.id}-${key}${i}" class="w${w.em ? " em" : ""}${w.strike ? " strike" : ""}">${esc(w.text)}</span>`).join(" ");
  times.forEach((t, i) => c.fromTo(`#${c.id}-${key}${i}`, ...WORD_IN, t));
  return `<div class="${cls}">${html}</div>`;
}

// when a label is spoken (its first word that's said), or `fallback`
function spokenAt(c, text, fallback) {
  const ws = parseText(text);
  const t = c.sync(ws.slice(0, 1), { gap: 0, first: fallback - 0.05 })[0];
  return Math.max(c.t0 + 0.05, t ?? fallback);
}

const items = (b) => (b.items || []).map((x) => (typeof x === "string" ? { text: x } : x));
const credit = (b) => (b.source ? `<div class="credit">${esc(b.source)}</div>` : "");

export const BEATS = {
  // Text beside the presenter while they talk: an app-style icon, a number that counts, and the words as he says them.
  pop(b, c) {
    const side = b.side === "left" ? "left" : "right";
    let h = `<div class="scrim ${side}" data-layout-allow-overflow></div><div class="area side-${side}"><div class="pop${c.panel ? " panel" : ""}">`;
    if (b.icon) { h += `<div id="${c.id}-icon" class="appicon">${icon(b.icon, 72, 2)}</div>`; c.fromTo(`#${c.id}-icon`, ...POP_IN, c.t0); }
    if (b.count != null) {
      h += `<div class="num"><span id="${c.id}-num">0</span>${esc(b.suffix || "")}</div>`;
      const t = spokenAt(c, String(b.count), c.t0 + 0.15);
      c.fromTo(`#${c.id}-num`, { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.25 }, t - 0.35);
      c.count(`#${c.id}-num`, b.count, t - 0.35, 0.6);
    }
    // "sub": a small qualifier under the words (a source, a caveat), in 0.9 s after the beat starts
    h += said(c, "t", b.text, "ptext") + (b.sub ? said(c, "s", b.sub, "psub", { first: c.t0 + 0.9, gap: 0.04, unsaid: true }) : "") + `</div></div>`;
    c.fromTo(`#${c.id} .scrim`, { opacity: 0 }, { opacity: 1, duration: 0.35 }, c.t0);
    return h;
  },

  // A kinetic headline on the brand stage (or over the corner camera).
  headline(b, c) {
    return `<div class="area ${c.area}"><div class="hl${b.size === "xl" ? " xl" : ""}">${said(c, "h", b.text, "line")}</div>${b.sub ? said(c, "s", b.sub, "subline") : ""}</div>${credit(b)}`;
  },

  // Chapter card: the number counts up, the title lands as it's spoken, and the rail lights one node per chapter.
  chapter(b, c) {
    const n = +b.n || 1, of = Math.max(+b.of || n, n);
    const nodes = Array.from({ length: of }, (_, i) => `<i id="${c.id}-n${i}" class="node"></i>`).join("");
    c.count(`#${c.id}-ones`, n, c.t0 + 0.1, Math.min(0.5, 0.08 * n + 0.1));
    c.fromTo(`#${c.id}-num`, { opacity: 0, filter: "blur(14px)", scale: 0.94 }, { opacity: 1, filter: "blur(0px)", scale: 1, duration: 0.55, ease: "power3.out" }, c.t0);
    for (let i = 0; i < of; i++) {
      c.fromTo(`#${c.id}-n${i}`, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, c.t0 + 0.05 * i);
      if (i < n) c.to(`#${c.id}-n${i}`, { backgroundColor: c.tok.accent, borderColor: c.tok.accent, boxShadow: `0 0 0 0 ${c.glow(0)}, 0 0 22px 4px ${c.glow(0.75)}`, duration: 0.25 }, c.t0 + 0.25 + 0.07 * i);
    }
    // the pulse lives on the stage (the main composition), so it's scheduled there; CSS holds it hidden between chapters
    c.main.fromTo("#stage .pulse", { x: 0, opacity: 0 }, { x: 1600, opacity: 1, duration: 1.6, ease: "power2.inOut", immediateRender: false }, c.t0);
    c.main.to("#stage .pulse", { opacity: 0, duration: 0.3 }, c.t0 + 1.6);
    const title = b.title ? said(c, "h", b.title, "chtitle", { first: c.t0 + 0.45 }) : "";
    return `<div class="area full"><div class="chap"><div id="${c.id}-num" class="chnum">${n < 10 ? "0" : ""}<span id="${c.id}-ones">0</span></div>${title}</div></div><div class="nodes">${nodes}</div>`;
  },

  // Numbered keycaps: an agenda ("ten things"), then a recap that lights the ones covered.
  tiles(b, c) {
    const n = Math.min(+b.n || 5, 12), cols = n > 6 ? Math.ceil(n / 2) : n;
    const light = b.light === "all" ? [...Array(n)].map((_, i) => i + 1) : Array.isArray(b.light) ? b.light : null;
    const labels = b.labels || [];
    const keys = Array.from({ length: n }, (_, i) => `<div class="keycol"><div id="${c.id}-k${i + 1}" class="key">${i + 1}</div>${labels[i] ? `<div id="${c.id}-kl${i + 1}" class="keylab">${esc(labels[i])}</div>` : ""}</div>`).join("");
    for (let i = 1; i <= n; i++) c.fromTo(`#${c.id}-k${i}`, ...POP_IN, c.t0 + 0.035 * i);
    // light: a list, "all", or (default) each key as its number is spoken, falling back to a quick run
    const lit = light || [...Array(n)].map((_, i) => i + 1);
    lit.forEach((k, i) => {
      const t = light ? c.t0 + 0.45 + 0.09 * i : spokenAt(c, String(k), c.t0 + 0.5 + ((c.t1 - c.t0 - 0.9) * i) / Math.max(lit.length, 1));
      c.to(`#${c.id}-k${k}`, { color: c.tok.hi, borderColor: c.glow(0.85), boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), 0 0 0 1px ${c.glow(0.55)}, 0 20px 60px ${c.glow(0.38)}`, duration: 0.3 }, t);
      if (labels[k - 1]) c.fromTo(`#${c.id}-kl${k}`, ...WORD_IN, t + 0.1);
    });
    return `<div class="area ${c.area}">${b.title ? said(c, "h", b.title, "title") : ""}<div class="tiles" style="grid-template-columns:repeat(${cols},${labels.length ? 260 : 164}px)">${keys}</div></div>`;
  },

  // One number that matters: counts up inside a glass card, the caption lands as it's spoken.
  stat(b, c) {
    const t = spokenAt(c, String(b.value), c.t0 + 0.2);
    c.fromTo(`#${c.id}-card`, ...POP_IN, c.t0);
    c.count(`#${c.id}-num`, +b.value, Math.max(c.t0 + 0.2, t - 0.5), 0.9);
    return `<div class="area ${c.area}">${b.title ? said(c, "h", b.title, "title") : ""}<div id="${c.id}-card" class="stat glass"><div class="statnum">${esc(b.prefix || "")}<span id="${c.id}-num">0</span>${esc(b.suffix || "")}</div>${b.caption ? said(c, "c", b.caption, "statcap") : ""}<div class="under"></div></div></div>${credit(b)}`;
  },

  // Stacked rows that arrive as each one is named; "check" ticks some of them.
  list(b, c) {
    const rows = items(b), checks = new Set(b.check || []);
    let at = c.t0 + 0.3;
    const html = rows.map((r, i) => {
      at = spokenAt(c, r.text, at + 0.35);
      c.fromTo(`#${c.id}-r${i}`, { opacity: 0, x: -28, filter: "blur(8px)" }, { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.45, ease: "power3.out" }, at);
      if (checks.has(i + 1)) c.fromTo(`#${c.id}-c${i}`, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2.4)" }, at + 0.35);
      return `<div id="${c.id}-r${i}" class="row glass">${r.icon ? `<span class="ico">${icon(r.icon, 48)}</span>` : ""}<span class="txt"><span class="lab">${esc(r.text)}</span>${r.sub ? `<span class="sub">${esc(r.sub)}</span>` : ""}</span>${checks.has(i + 1) ? `<span id="${c.id}-c${i}" class="tick">${icon("check", 32, 3)}</span>` : ""}</div>`;
    }).join("");
    return `<div class="area ${c.area}">${b.title ? said(c, "h", b.title, "title") : ""}<div class="rows">${html}</div></div>`;
  },

  // Two or three big pills ("Faster" / "Cheaper") that pop as each word is said.
  pills(b, c) {
    let at = c.t0 + 0.1;
    const html = items(b).map((p, i) => {
      at = spokenAt(c, p.text, at + 0.3);
      c.fromTo(`#${c.id}-p${i}`, ...POP_IN, at);
      return `<div id="${c.id}-p${i}" class="pill glass">${p.icon ? icon(p.icon, 66) : ""}<span>${esc(p.text)}</span><div class="under"></div></div>`;
    }).join("");
    return `<div class="area ${c.area}">${b.title ? said(c, "h", b.title, "title") : ""}<div class="pills">${html}</div></div>`;
  },

  // The presenter's verdict: two buttons, a pointer glides in and clicks one, and it lights up.
  verdict(b, c) {
    const opts = b.options || ["Try it today", "Skip for now"];
    const pick = Math.min(Math.max(+(b.pick ?? 0), 0), opts.length - 1);
    const color = (b.tone || (pick === 0 ? "go" : "wait")) === "go" ? c.tok.ok : c.tok.warm;
    const click = Math.min(c.t1 - 0.7, Math.max(c.t0 + 1.0, b.clickAt != null ? spokenAt(c, b.clickAt, c.t0 + 1.2) : c.t0 + (c.t1 - c.t0) * 0.55));
    const html = opts.map((o, i) => `<div id="${c.id}-o${i}" class="opt glass">${esc(o)}${i === pick ? `<div id="${c.id}-cur" class="cursor" data-layout-allow-overflow>${CURSOR}</div>` : ""}</div>`).join("");
    opts.forEach((_, i) => c.fromTo(`#${c.id}-o${i}`, ...POP_IN, c.t0 + 0.25 + 0.1 * i));
    c.fromTo(`#${c.id}-cur`, { opacity: 0, x: 260, y: 170 }, { opacity: 1, x: 0, y: 0, duration: 0.7, ease: "power2.inOut" }, click - 0.75);
    c.to(`#${c.id}-o${pick}`, { scale: 0.95, duration: 0.08, yoyo: true, repeat: 1, ease: "power1.inOut" }, click);
    c.to(`#${c.id}-o${pick}`, { color: c.tok.hi, borderColor: c.rgba(color, 0.9), boxShadow: `inset 0 1px 0 rgba(255,255,255,.1), 0 0 0 1px ${c.rgba(color, 0.6)}, 0 18px 70px ${c.rgba(color, 0.45)}`, duration: 0.3 }, click + 0.05);
    opts.forEach((_, i) => { if (i !== pick) c.to(`#${c.id}-o${i}`, { opacity: 0.4, duration: 0.3 }, click + 0.05); });
    return `<div class="area ${c.area}">${said(c, "h", b.title || "", "vtitle")}<div class="opts">${html}</div></div>`;
  },

  // A screenshot or image in a card, slowly pushing in, with its source credit.
  shot(b, c) {
    c.asset(b.src);
    c.fromTo(`#${c.id}-shot`, { opacity: 0, y: 30, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "power3.out" }, c.t0);
    c.fromTo(`#${c.id}-img`, { scale: 1 }, { scale: 1.05, duration: c.t1 - c.t0, ease: "none" }, c.t0);
    return `<div class="area ${c.area}">${b.title ? said(c, "h", b.title, "title") : ""}<div id="${c.id}-shot" class="shot"><img id="${c.id}-img" src="${esc(b.src)}" alt="" data-layout-allow-overflow></div></div>${credit(b)}`;
  },

  // A row of glowing icon tiles with labels, each popping as it's named.
  icons(b, c) {
    let at = c.t0 + 0.1;
    const html = items(b).map((x, i) => {
      at = spokenAt(c, x.text, at + 0.3);
      c.fromTo(`#${c.id}-i${i}`, ...POP_IN, at);
      return `<div id="${c.id}-i${i}" class="ic"><div class="tile glass">${icon(x.icon || "sparkle", 80)}<div class="under"></div></div><div class="lab">${esc(x.text)}</div></div>`;
    }).join("");
    return `<div class="area ${c.area}">${b.title ? said(c, "h", b.title, "title") : ""}<div class="icons">${html}</div></div>`;
  },

  // A → B → C: nodes connected by lines that draw in as each step is named.
  flow(b, c) {
    let at = c.t0 + 0.1;
    const parts = items(b).map((x, i) => {
      at = spokenAt(c, x.text, at + 0.4);
      c.fromTo(`#${c.id}-f${i}`, ...POP_IN, at);
      if (i) c.fromTo(`#${c.id}-l${i}`, { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: "power2.out" }, at - 0.3);
      return `${i ? `<div id="${c.id}-l${i}" class="link"></div>` : ""}<div id="${c.id}-f${i}" class="ic"><div class="tile glass">${icon(x.icon || "sparkle", 72)}<div class="under"></div></div><div class="lab">${esc(x.text)}</div></div>`;
    }).join("");
    return `<div class="area ${c.area}">${b.title ? said(c, "h", b.title, "title") : ""}<div class="flow">${parts}</div></div>`;
  },

  // A quote from a person, the words landing as the presenter reads them.
  quote(b, c) {
    const initials = String(b.who || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    c.fromTo(`#${c.id}-q`, ...POP_IN, c.t0);
    return `<div class="area ${c.area}"><div id="${c.id}-q" class="quote glass"><div class="who"><div class="av">${esc(initials)}</div><div><div class="name">${esc(b.who || "")}</div>${b.role ? `<div class="role">${esc(b.role)}</div>` : ""}</div></div>${said(c, "q", b.text, "qtext", { gap: 0.09 })}</div></div>${credit(b)}`;
  },

  // Camera only: a punch-in, or the corner/split camera with nothing else on screen.
  cam() { return ""; },
};

export function css(tok, rgba) {
  const g = (a) => rgba(tok.accent, a);
  const bgA = (a) => rgba(tok.bg, a), mutedA = (a) => rgba(tok.muted, a);
  return `
.in{position:absolute;inset:0}
.area{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;text-align:center}
.area.full{inset:96px 140px}
.area.pip{inset:80px 140px 220px 140px}
.area.split{left:790px;right:110px;top:110px;bottom:110px;align-items:flex-start;text-align:left;gap:40px}
.area.side-right{left:1080px;right:90px;top:0;bottom:0;align-items:flex-start;text-align:left}
.area.side-left{left:90px;right:1080px;top:0;bottom:0;align-items:flex-start;text-align:left}
.w{display:inline-block}
.hl,.title,.vtitle,.ptext,.chtitle,.subline{text-wrap:balance}
.em{font-family:${tok.mono};font-weight:500;color:${tok.accent};text-shadow:0 0 30px ${g(0.45)}}
.strike{color:${tok.muted};text-decoration:line-through;text-decoration-color:${tok.warm};text-decoration-thickness:5px}
.hl{font-size:96px;font-weight:600;line-height:1.08;letter-spacing:-0.02em;color:${tok.hi};max-width:1520px}
.hl.xl{font-size:136px}
.split .hl{font-size:72px}
.subline{font-size:46px;font-weight:500;color:${tok.muted};max-width:1300px}
.title{font-size:68px;font-weight:600;letter-spacing:-0.01em;color:${tok.hi};max-width:1500px}
.split .title,.vtitle{font-size:72px;font-weight:600;line-height:1.1;color:${tok.hi};max-width:980px}
.scrim{position:absolute;top:0;bottom:0;width:1240px}
.scrim.right{right:-180px;background:radial-gradient(ellipse 52% 46% at 56% 50%,${bgA(0.72)},${bgA(0)} 100%)}
.scrim.left{left:-180px;background:radial-gradient(ellipse 52% 46% at 44% 50%,${bgA(0.72)},${bgA(0)} 100%)}
.pop{display:flex;flex-direction:column;gap:22px;align-items:flex-start}
.pop.panel{background:${bgA(0.82)};border:1px solid ${mutedA(0.22)};border-radius:26px;padding:30px 44px 36px;box-shadow:0 30px 90px rgba(0,0,0,.45)}
.appicon{width:138px;height:138px;border-radius:36px;display:grid;place-items:center;color:${tok.hi};background:linear-gradient(160deg,${tok.accent},${tok.accentDeep});box-shadow:0 14px 50px ${g(0.5)},inset 0 1px 0 rgba(255,255,255,.4)}
.pop .num{font-size:210px;font-weight:300;line-height:.86;letter-spacing:-0.04em;color:${tok.hi};font-variant-numeric:tabular-nums;text-shadow:0 4px 40px ${bgA(0.7)}}
.psub{font-size:36px;font-weight:500;line-height:1.3;color:${tok.muted};max-width:820px;margin-top:-6px}
.ptext{font-size:86px;font-weight:600;line-height:1.06;letter-spacing:-0.02em;color:${tok.hi};text-shadow:0 2px 30px ${bgA(0.75)}}
.glass{position:relative;isolation:isolate;background:linear-gradient(180deg,${rgba(tok.raised, 0.94)},${rgba(tok.surface, 0.94)});border:1px solid ${mutedA(0.16)};border-radius:28px;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 0 0 0 ${g(0)},0 30px 80px rgba(0,0,0,.45)}
.under{position:absolute;left:12%;right:12%;bottom:-46px;height:110px;background:radial-gradient(ellipse at 50% 0%,${g(0.5)},${g(0)} 70%);filter:blur(16px);z-index:0}
.glass > :not(.under):not(.cursor){position:relative;z-index:1}
.chap{display:flex;align-items:baseline;gap:40px}
.chnum{font-size:250px;font-weight:200;line-height:1;letter-spacing:-0.05em;color:${tok.hi};font-variant-numeric:tabular-nums}
.chtitle{font-size:96px;font-weight:600;letter-spacing:-0.02em;color:${tok.hi}}
.nodes{position:absolute;left:0;right:0;top:901px;display:flex;justify-content:center;gap:110px}
.node{display:block;width:20px;height:20px;border-radius:50%;background:${tok.raised};border:2px solid ${mutedA(0.4)};box-shadow:0 0 0 0 ${g(0)},0 0 0 0 ${g(0)}}
.tiles{display:grid;gap:28px;justify-items:center}
.keycol{display:flex;flex-direction:column;align-items:center;gap:22px}
.keylab{font-size:40px;font-weight:600;color:${tok.fg}}
.key{width:164px;height:164px;border-radius:38px;display:grid;place-items:center;font-size:80px;font-weight:300;color:${mutedA(0.72)};background:linear-gradient(180deg,${tok.raised},${tok.surface});border:1px solid ${mutedA(0.14)};box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 0 0 0 ${g(0)},0 20px 50px rgba(0,0,0,.45)}
.stat{padding:54px 110px 64px;min-width:700px;text-align:center}
.statnum{font-size:220px;font-weight:300;line-height:1;letter-spacing:-0.04em;color:${tok.hi};font-variant-numeric:tabular-nums}
.statcap{font-size:48px;font-weight:500;color:${tok.fg};margin-top:16px}
.credit{position:absolute;left:56px;bottom:40px;font:500 20px ${tok.mono};color:${tok.muted}}
.rows{display:flex;flex-direction:column;gap:22px;width:940px}
.split .rows{width:900px}
.row{display:flex;align-items:center;gap:28px;padding:28px 36px;text-align:left;border-radius:22px}
.row .ico{color:${tok.accent};display:grid}
.row .txt{display:flex;flex-direction:column;gap:4px}
.row .lab{font-size:46px;font-weight:600;color:${tok.hi}}
.row .sub{font-size:28px;color:${tok.muted}}
.tick{margin-left:auto;width:56px;height:56px;border-radius:50%;background:${tok.accent};color:${tok.bg};display:grid;place-items:center;box-shadow:0 0 24px ${g(0.6)}}
.pills{display:flex;gap:52px}
.pill{display:flex;align-items:center;gap:26px;padding:44px 82px;font-size:84px;font-weight:600;color:${tok.hi};border-radius:999px}
.pill svg{color:${tok.accent}}
.opts{display:flex;gap:34px}
.opt{position:relative;padding:38px 66px;border-radius:28px;font-size:54px;font-weight:600;color:${tok.muted}}
.cursor{position:absolute;right:-34px;bottom:-46px;opacity:0}
.cursor svg{display:block}
.shot{position:relative;border-radius:22px;overflow:hidden;border:1px solid ${mutedA(0.22)};box-shadow:0 40px 110px rgba(0,0,0,.6),0 0 90px ${g(0.12)}}
.shot img{display:block;max-width:1240px;max-height:620px;width:auto;height:auto}
.icons,.flow{display:flex;align-items:center;gap:56px}
.flow{gap:0}
.ic{display:flex;flex-direction:column;align-items:center;gap:20px}
.ic .tile{width:188px;height:188px;border-radius:46px;display:grid;place-items:center;color:${tok.accent}}
.flow .ic .tile{width:168px;height:168px;border-radius:42px}
.ic .lab{font-size:38px;font-weight:600;color:${tok.fg};max-width:320px}
.link{display:block;width:170px;height:3px;margin:0 22px 66px;background:linear-gradient(90deg,${tok.accent},${g(0.25)});transform-origin:left center;box-shadow:0 0 14px ${g(0.6)}}
.quote{padding:50px 58px;max-width:980px;text-align:left}
.who{display:flex;gap:18px;align-items:center;margin-bottom:26px}
.av{width:66px;height:66px;border-radius:50%;background:${tok.raised};display:grid;place-items:center;font-weight:600;color:${tok.accent};font-size:28px;border:1px solid ${g(0.4)}}
.name{font-size:28px;font-weight:600;color:${tok.hi}}
.role{font-size:22px;color:${tok.muted}}
.qtext{font-size:54px;line-height:1.24;font-weight:500;color:${tok.hi}}
`;
}
