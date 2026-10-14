import robotsParser from 'robots-parser';
import { config } from '../config/index.js';
import { fetchCoreWebVitals } from '../services/pagespeed.service.js';
import { AppError } from '../utils/AppError.js';
import { PoliteFetcher } from './crawler/httpClient.js';
import { renderPage } from './crawler/renderPage.js';
import { extractPage } from './parsers/extractPage.js';
import { parseSitemap, summarizeSitemapEntries } from './parsers/sitemap.js';

const MAX_ROBOTS_CRAWL_DELAY_MS = 10_000;

const isHtml = (contentType, text) => /html|xml/i.test(contentType) || /^\s*<(!doctype|html)/i.test(text ?? '');

/** Turn robots.txt fetch results into the shape checks expect. Pure. */
export function buildRobots(robotsUrl, fetched = {}) {
  const found = fetched.status === 200 && typeof fetched.text === 'string' && !/^\s*<(!doctype|html)/i.test(fetched.text);
  return {
    url: robotsUrl,
    status: fetched.status ?? null,
    found,
    text: found ? fetched.text.slice(0, 100_000) : null,
    error: fetched.error ?? null,
    parser: robotsParser(robotsUrl, found ? fetched.text : ''),
  };
}

/**
 * Build the audit context from already-fetched raw data. Pure, so every check
 * can be unit-tested with fixtures and no network.
 */
export function buildContext(raw) {
  const finalUrl = raw.page.url ?? raw.url;
  const final = new URL(finalUrl);
  const robotsUrl = `${final.origin}/robots.txt`;

  return {
    url: raw.url,
    finalUrl,
    origin: final.origin,
    isHomepage: final.pathname === '/' || final.pathname === '',
    fetchedAt: raw.fetchedAt ?? new Date().toISOString(),
    response: {
      status: raw.page.status,
      headers: raw.page.headers ?? {},
      contentType: raw.page.contentType ?? raw.page.headers?.['content-type'] ?? '',
      redirects: raw.page.redirects ?? [],
      durationMs: raw.page.durationMs ?? null,
    },
    page: extractPage(raw.page.text ?? '', finalUrl),
    robots: raw.robots?.parser ? raw.robots : buildRobots(robotsUrl, raw.robots),
    llmsTxt: raw.llmsTxt ?? { url: `${final.origin}/llms.txt`, status: null },
    sitemap: raw.sitemap ?? { found: false },
    httpVariant: raw.httpVariant ?? null,
    rendered: raw.renderedHtml ? extractPage(raw.renderedHtml, finalUrl) : null,
    renderError: raw.renderError ?? (raw.renderedHtml ? null : 'JavaScript rendering was not run'),
    pageSpeed: raw.pageSpeed ?? null,
    pageSpeedError: raw.pageSpeedError ?? (raw.pageSpeed ? null : 'PageSpeed Insights was not run'),
  };
}

async function gatherSitemap(fetcher, origin, robots, pageUrl) {
  const declared = robots.parser.getSitemaps().filter((u) => /^https?:\/\//i.test(u)).slice(0, 3);
  const candidates = declared.length ? declared : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const result = { found: false, fromRobots: declared.length > 0, declared, tried: [] };

  for (const url of candidates) {
    const res = await fetcher.tryFetch(url, { accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5' });
    result.tried.push({ url, status: res.status, error: res.error?.message });
    if (res.status !== 200) continue;

    try {
      let parsed = parseSitemap(res.text);
      Object.assign(result, { found: true, url: res.url, type: parsed.type });

      if (parsed.type === 'index') {
        result.childCount = parsed.entries.length;
        const indexSummary = summarizeSitemapEntries(parsed.entries);
        // Sample the most recently modified child sitemap for URL-level data.
        const child = [...parsed.entries].sort((a, b) => (Date.parse(b.lastmod) || 0) - (Date.parse(a.lastmod) || 0))[0];
        if (child) {
          const childRes = await fetcher.tryFetch(child.loc, { accept: 'application/xml,text/xml;q=0.9' });
          if (childRes.status === 200) {
            parsed = parseSitemap(childRes.text);
            result.sampledChild = child.loc;
          }
        }
        result.indexNewestLastmod = indexSummary.newestLastmod;
      }

      Object.assign(result, summarizeSitemapEntries(parsed.entries));
      // A sample of URLs seeds site crawls.
      result.urls = parsed.entries.slice(0, 1000).map((e) => e.loc);
      const normalized = (u) => u.replace(/\/$/, '').replace('://www.', '://');
      result.includesAuditedUrl = parsed.entries.some((e) => normalized(e.loc) === normalized(pageUrl));
      if (result.indexNewestLastmod && (!result.newestLastmod || result.indexNewestLastmod > result.newestLastmod)) {
        result.newestLastmod = result.indexNewestLastmod;
      }
    } catch (err) {
      Object.assign(result, { found: true, url: res.url, parseError: err.message });
    }
    return result;
  }
  return result;
}

const HTML_ACCEPT = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5';

/** Why a fetched response can't be audited as a page, or null if it can. */
export function pageProblem(page) {
  if (page.error) return { code: page.error.code ?? 'FETCH_FAILED', message: page.error.message };
  if (page.status >= 400) return { code: 'PAGE_HTTP_ERROR', message: `${page.url} returned HTTP ${page.status}` };
  if (!isHtml(page.contentType, page.text)) return { code: 'NOT_HTML', message: `${page.url} is not an HTML page (content-type: ${page.contentType || 'unknown'})` };
  return null;
}

/** Fetch a page for auditing; returns { error } instead of throwing (used by the crawler). */
export const fetchPage = (fetcher, url) => fetcher.tryFetch(url, { accept: HTML_ACCEPT });

/**
 * Site-level gathering, done once per audit: robots.txt (respected for our own token),
 * the start page, llms.txt, the sitemap and the http:// variant.
 */
export async function gatherSite(url, { fetcher = new PoliteFetcher(), onProgress = () => {} } = {}) {
  const requested = new URL(url);

  await onProgress('robots', 'Reading robots.txt', 10);
  let robots = buildRobots(`${requested.origin}/robots.txt`, await fetcher.tryFetch(`${requested.origin}/robots.txt`, { accept: 'text/plain' }));
  const assertAllowed = (target) => {
    if (robots.parser.isAllowed(target, config.crawler.robotsToken) === false) {
      throw new AppError(422, `robots.txt disallows ${config.crawler.robotsToken} from crawling ${target}`, { code: 'ROBOTS_DISALLOWED' });
    }
  };
  assertAllowed(requested.href);
  const crawlDelay = robots.parser.getCrawlDelay(config.crawler.robotsToken);
  if (crawlDelay) fetcher.setDelay(Math.min(crawlDelay * 1000, MAX_ROBOTS_CRAWL_DELAY_MS));

  await onProgress('page', 'Fetching the page', 20);
  const startPage = await fetchPage(fetcher, requested.href);
  const problem = pageProblem(startPage);
  if (problem) {
    const message = problem.code === 'PAGE_HTTP_ERROR' ? `${problem.message}. Check the URL and try again.` : `Could not audit ${requested.href}: ${problem.message}`;
    throw new AppError(422, message, { code: problem.code });
  }

  // Redirected to another origin (e.g. apex -> www)? Use that origin's robots.txt from here on.
  const final = new URL(startPage.url);
  if (final.origin !== requested.origin) {
    robots = buildRobots(`${final.origin}/robots.txt`, await fetcher.tryFetch(`${final.origin}/robots.txt`, { accept: 'text/plain' }));
    assertAllowed(final.href);
  }

  await onProgress('discovery', 'Checking llms.txt and sitemap', 35);
  const llms = await fetcher.tryFetch(`${final.origin}/llms.txt`, { accept: 'text/markdown,text/plain;q=0.9,*/*;q=0.5' });
  const sitemap = await gatherSitemap(fetcher, final.origin, robots, final.href);

  let httpVariant = null;
  if (final.protocol === 'https:') {
    const res = await fetcher.tryFetch(final.href.replace(/^https:/, 'http:'), { accept: 'text/html' });
    httpVariant = { status: res.status, finalUrl: res.url, redirectsToHttps: Boolean(res.url?.startsWith('https:')), error: res.error?.message };
  }

  return {
    requestedUrl: requested.href,
    startPage,
    robots,
    llmsTxt: { url: `${final.origin}/llms.txt`, status: llms.status, contentType: llms.contentType ?? '', text: llms.text?.slice(0, 200_000) ?? null, finalUrl: llms.url, error: llms.error },
    sitemap,
    httpVariant,
  };
}

const describeVitalsError = (err) =>
  err?.response?.status === 429
    ? 'PageSpeed Insights quota exceeded. Add a PAGESPEED_API_KEY to .env for reliable results.'
    : `PageSpeed Insights failed: ${err?.response?.data?.error?.message ?? err?.message}`;

/**
 * Slow, optional per-page extras: the JS-rendered DOM and Core Web Vitals, in parallel.
 * Pass a string instead of `true` for an enabled flag to skip with that reason.
 */
export async function gatherPageExtras(url, { render = renderPage, pageSpeed = fetchCoreWebVitals, renderEnabled = config.render.enabled, pageSpeedEnabled = config.pageSpeed.enabled } = {}) {
  const skipReason = (flag, fallback) => Promise.reject(new Error(typeof flag === 'string' ? flag : fallback));
  const [rendered, vitals] = await Promise.allSettled([
    renderEnabled === true ? render(url) : skipReason(renderEnabled, 'JavaScript rendering is disabled (RENDER_ENABLED=false)'),
    pageSpeedEnabled === true ? pageSpeed(url) : skipReason(pageSpeedEnabled, 'PageSpeed Insights is disabled (PAGESPEED_ENABLED=false)'),
  ]);
  return {
    renderedHtml: rendered.status === 'fulfilled' ? rendered.value.html : null,
    renderError: rendered.status === 'rejected' ? rendered.reason.message : null,
    pageSpeed: vitals.status === 'fulfilled' ? vitals.value : null,
    pageSpeedError: vitals.status === 'rejected' ? (typeof pageSpeedEnabled === 'string' ? pageSpeedEnabled : describeVitalsError(vitals.reason)) : null,
  };
}

/** Combine site-level data, one fetched page and its extras into a check context. */
export const contextFor = (site, page, extras = {}) =>
  buildContext({ url: page.requestedUrl ?? page.url, page, robots: site.robots, llmsTxt: site.llmsTxt, sitemap: site.sitemap, httpVariant: site.httpVariant, ...extras });

/**
 * Fetch everything a single-page audit needs. Network-facing; dependencies are
 * injectable so the whole pipeline can run against fixtures in tests.
 */
export async function gatherContext(url, { fetcher = new PoliteFetcher(), onProgress = () => {}, ...extrasOptions } = {}) {
  const site = await gatherSite(url, { fetcher, onProgress });
  await onProgress('render', 'Rendering JavaScript and measuring Core Web Vitals', 55);
  const extras = await gatherPageExtras(site.startPage.url, extrasOptions);
  return contextFor({ ...site }, { ...site.startPage, requestedUrl: site.requestedUrl }, extras);
}
