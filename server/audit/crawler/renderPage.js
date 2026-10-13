import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { assertPublicHost } from '../../utils/ssrf.js';

// Resources that don't affect the text content of the page. Skipping them makes rendering much faster.
const SKIPPED_RESOURCE_TYPES = new Set(['image', 'media', 'font', 'stylesheet', 'websocket', 'manifest', 'texttrack', 'eventsource']);

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = import('playwright')
      .then(({ chromium }) => chromium.launch({ headless: true }))
      .catch((err) => {
        browserPromise = null;
        if (/Executable doesn't exist|browserType\.launch/i.test(err.message)) {
          throw new Error('Headless Chromium is not installed. Run: npx playwright install chromium-headless-shell');
        }
        throw err;
      });
  }
  return browserPromise;
}

/**
 * Load a page in headless Chromium and return the DOM after JavaScript has run.
 * Every network request the page makes is checked against the SSRF guard first.
 *
 * @returns {{ html: string, durationMs: number, blockedRequests: number }}
 */
export async function renderPage(url, { timeoutMs = config.render.timeoutMs } = {}) {
  const startedAt = Date.now();
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: config.crawler.userAgent,
    serviceWorkers: 'block',
    javaScriptEnabled: true,
    viewport: { width: 1280, height: 900 },
  });

  const hostChecks = new Map();
  let blockedRequests = 0;

  try {
    await context.route('**/*', async (route) => {
      const request = route.request();
      if (SKIPPED_RESOURCE_TYPES.has(request.resourceType())) return route.abort();

      let hostname;
      try {
        const target = new URL(request.url());
        if (target.protocol !== 'http:' && target.protocol !== 'https:') throw new Error('scheme');
        hostname = target.hostname.replace(/^\[|\]$/g, '');
        if (!hostChecks.has(hostname)) hostChecks.set(hostname, assertPublicHost(hostname).then(() => true, () => false));
        if (await hostChecks.get(hostname)) return route.continue();
      } catch {
        // fall through to abort
      }
      blockedRequests += 1;
      return route.abort('blockedbyclient');
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    // Give client-side frameworks a moment to fetch data and render.
    await page.waitForLoadState('networkidle', { timeout: Math.min(8000, timeoutMs) }).catch(() => {});
    const html = await page.content();
    return { html, durationMs: Date.now() - startedAt, blockedRequests };
  } finally {
    await context.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (!browserPromise) return;
  const pending = browserPromise;
  browserPromise = null;
  try {
    await (await pending).close();
  } catch (err) {
    logger.warn({ err }, 'Failed to close headless browser');
  }
}
