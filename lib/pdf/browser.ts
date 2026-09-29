/** Headless Chromium pool for HTML -> PDF rendering. */
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

interface PoolState {
  browser: Promise<Browser> | null;
  idle: Page[];
  active: number;
  waiters: (() => void)[];
  renders: number;
}

const g = globalThis as unknown as { __acgPdfPool?: PoolState };
const state: PoolState = (g.__acgPdfPool ??= { browser: null, idle: [], active: 0, waiters: [], renders: 0 });

const RECYCLE_AFTER = 2000; // restart Chromium periodically to bound memory growth

async function getBrowser(): Promise<Browser> {
  if (!state.browser) {
    if (!env.chromiumPath) throw new Error("Chromium not found. Set CHROMIUM_PATH to a Chrome/Chromium executable.");
    state.browser = puppeteer
      .launch({
        executablePath: env.chromiumPath,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--font-render-hinting=none", "--disable-extensions"],
      })
      .then((b) => {
        b.on("disconnected", () => {
          state.browser = null;
          state.idle = [];
        });
        return b;
      })
      .catch((err) => {
        state.browser = null;
        throw err;
      });
  }
  return state.browser;
}

async function acquire(): Promise<Page> {
  while (state.active >= env.pdfConcurrency) {
    await new Promise<void>((r) => state.waiters.push(r));
  }
  state.active++;
  try {
    const idle = state.idle.pop();
    if (idle && !idle.isClosed()) return idle;
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    // Everything is inlined as data: URIs; block all network access from rendered content.
    page.on("request", (req) => {
      const u = req.url();
      if (u.startsWith("data:") || u === "about:blank") req.continue();
      else req.abort("blockedbyclient");
    });
    return page;
  } catch (err) {
    state.active--;
    state.waiters.shift()?.();
    throw err;
  }
}

function release(page: Page, broken = false) {
  state.active--;
  if (!broken && !page.isClosed()) state.idle.push(page);
  else page.close().catch(() => {});
  state.waiters.shift()?.();
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const page = await acquire();
  let broken = false;
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true, timeout: 120_000 });
    return Buffer.from(pdf);
  } catch (err) {
    broken = true;
    throw err;
  } finally {
    release(page, broken);
    state.renders++;
    if (state.renders >= RECYCLE_AFTER && state.active === 0) {
      state.renders = 0;
      await closeBrowser();
    }
  }
}

export async function closeBrowser() {
  const b = state.browser;
  state.browser = null;
  state.idle = [];
  if (b) {
    try {
      await (await b).close();
    } catch (err) {
      log.warn("pdf.browser.close_failed", { error: String(err) });
    }
  }
}
