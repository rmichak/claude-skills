// cdp.mjs - connect to the throwaway VS Code (launch.sh) and hand back the workbench page
import { createRequire } from "node:module";
// puppeteer-core: PPTR=<path to a puppeteer-core install>, else resolved from the current folder, then from here
// (install it once: npm i -g puppeteer-core, or npm i puppeteer-core in the project)
function loadPuppeteer() {
  const tries = [process.env.PPTR, "puppeteer-core"].filter(Boolean);
  for (const base of [process.cwd() + "/", import.meta.url]) {
    const req = createRequire(base);
    for (const t of tries) { try { return req(t); } catch {} }
  }
  throw new Error("puppeteer-core not found: npm i puppeteer-core (or set PPTR=<path to puppeteer-core>)");
}
const puppeteer = loadPuppeteer();
// the window is 850x436 pt by default; VSCODE_REF_W sets a wider one (the kit's windowWidth), for measuring and captures
export async function workbench({ width = +(process.env.VSCODE_REF_W || 850), height = 436, dpr = 2 } = {}) {
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${process.env.VSCODE_REF_PORT || 9339}`, defaultViewport: null, protocolTimeout: 20000 });
  const pages = await browser.pages();
  const want = process.env.VSCODE_REF_TITLE; // pick a window by its title when several are open
  const cands = pages.filter((p) => /workbench\.html/.test(p.url()));
  let page = cands[0];
  if (want) for (const p of cands) if ((await p.title()).includes(want)) page = p;
  if (!page) throw new Error("no workbench page: " + pages.map((p) => p.url()).join(", "));
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile: false });
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true }); // render as the focused (active) window
  await page.evaluate(() => { window.dispatchEvent(new Event("resize")); window.dispatchEvent(new Event("focus")); });
  await new Promise((r) => setTimeout(r, 600));
  return { browser, page, cdp };
}
export async function shot(cdp, file) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  (await import("node:fs")).writeFileSync(file, Buffer.from(data, "base64"));
}
