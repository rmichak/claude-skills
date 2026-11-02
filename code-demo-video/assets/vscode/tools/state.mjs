// state.mjs - put the throwaway VS Code into a known layout, then screenshot it
import { workbench, shot } from "./cdp.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { browser, page, cdp } = await workbench();
const rect = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
async function command(name) {
  await page.keyboard.down("Meta"); await page.keyboard.down("Shift"); await page.keyboard.press("KeyP"); await page.keyboard.up("Shift"); await page.keyboard.up("Meta");
  await sleep(400); await page.keyboard.type(name, { delay: 5 }); await sleep(500); await page.keyboard.press("Enter"); await sleep(700);
}
const want = process.argv.slice(2);
for (const step of want) {
  if (step === "noaux") { if (await page.evaluate(() => !!document.querySelector(".part.auxiliarybar:not([style*='display: none'])") && document.querySelector(".part.auxiliarybar").offsetWidth > 0)) await command("View: Close Secondary Side Bar"); }
  else if (step.startsWith("sidebar=")) {
    const w = +step.split("=")[1]; const sb = await rect(".part.sidebar");
    const x0 = sb.x + sb.w, y0 = sb.y + sb.h / 2;
    await page.mouse.move(x0, y0); await sleep(150); await page.mouse.down(); await page.mouse.move(x0 - 20, y0, { steps: 4 }); await page.mouse.move(sb.x + w, y0, { steps: 8 }); await page.mouse.up(); await sleep(400);
  }
  else if (step.startsWith("panelh=")) {
    // drag the panel's top sash so the panel is H logical px tall (the kit's panelHeight / terminalHeight)
    const h = +step.split("=")[1]; const pn = await rect(".part.panel");
    const x0 = pn.x + pn.w / 2, y0 = pn.y + 1, y1 = pn.y + pn.h - h + 1; // the sash grabs 1px below the top edge
    await page.mouse.move(x0, y0); await sleep(150); await page.mouse.down(); await page.mouse.move(x0, y0 - 20, { steps: 4 }); await page.mouse.move(x0, y1, { steps: 8 }); await page.mouse.up(); await sleep(600);
  }
  else if (step.startsWith("cmd:")) await command(step.slice(4));
  else if (step === "nopanel" || step === "panel") {
    const vis = await page.evaluate(() => { const p = document.querySelector(".part.panel"); return !!p && p.getBoundingClientRect().height > 0; });
    if (vis !== (step === "panel")) { await page.keyboard.down("Meta"); await page.keyboard.press("KeyJ"); await page.keyboard.up("Meta"); await sleep(700); }
  }
  else if (step.startsWith("open:")) { await page.keyboard.down("Meta"); await page.keyboard.press("KeyP"); await page.keyboard.up("Meta"); await sleep(500); await page.keyboard.type(step.slice(5), { delay: 10 }); await sleep(700); await page.keyboard.press("Enter"); await sleep(900); }
  else if (step.startsWith("type:")) { await page.keyboard.type(step.slice(5), { delay: 20 }); await sleep(300); }
  else if (step === "enter") { await page.keyboard.press("Enter"); await sleep(1500); }
  else if (step === "esc") { await page.keyboard.press("Escape"); await sleep(300); }
  else if (step.startsWith("key=")) { // key=Meta+ArrowUp: a chord (Cmd+Up = cursorTop: caret to 1:1, view to the top)
    const ks = step.slice(4).split("+"), main = ks.pop();
    for (const m of ks) await page.keyboard.down(m);
    await page.keyboard.press(main);
    for (const m of ks.reverse()) await page.keyboard.up(m);
    await sleep(500);
  }
  else if (step.startsWith("wait=")) await sleep(+step.split("=")[1]);
  else if (step.startsWith("click=")) { const [x, y] = step.split("=")[1].split(",").map(Number); await page.mouse.click(x, y); await sleep(400); }
  else if (step === "park") { await page.mouse.move(700, 17); await sleep(1600); }
  else if (step === "focus") { const { execFileSync } = await import("node:child_process"); const P = process.env.VSCODE_REF_HOME || process.env.HOME + "/.cache/vscode-pixel-ref"; const pid = execFileSync("pgrep", ["-f", "--", "--extensions-dir=" + P + "/ext --remote-debugging-port=" + (process.env.VSCODE_REF_PORT || 9339)]).toString().trim().split("\n")[0]; const act = new URL("./activate", import.meta.url).pathname; if (!(await import("node:fs")).existsSync(act)) execFileSync("swiftc", ["-O", "-o", act, act + ".swift"]); /* compiled once from activate.swift */ execFileSync(act, [pid]); await sleep(900); }
  else if (step === "active") await page.evaluate(() => { document.querySelectorAll(".part.titlebar.inactive").forEach((e) => e.classList.remove("inactive")); const t = document.querySelector(".part.titlebar"); t.style.backgroundColor = "var(--vscode-titleBar-activeBackground)"; t.style.color = "var(--vscode-titleBar-activeForeground)"; });
  else if (step.startsWith("shot=")) await shot(cdp, step.split("=")[1]);
}
console.log(JSON.stringify({ sidebar: await rect(".part.sidebar"), editor: await rect(".part.editor"), panel: await rect(".part.panel"), aux: await rect(".part.auxiliarybar") }));
browser.disconnect();
