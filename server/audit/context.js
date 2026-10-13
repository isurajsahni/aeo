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

/**
 * Fetch everything an audit of one page needs. Network-facing; dependencies are
 * injectable so the whole pipeline can run against fixtures in tests.
 */
export async function gatherContext(
  url,
  {
    fetcher = new PoliteFetcher(),
    render = renderPage,
    pageSpeed = fetchCoreWebVitals,
    renderEnabled = config.render.enabled,
    pageSpeedEnabled = config.pageSpeed.enabled,
    onProgress = () => {},
  } = {},
) {
  const requested = new URL(url);

  // 1. robots.txt: we respect it for our own crawler token, and audit it for AI bots.
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

  // 2. The page itself.
  await onProgress('page', 'Fetching the page', 20);
  let page;
  try {
    page = await fetcher.fetch(requested.href, { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' });
  } catch (err) {
    throw new AppError(422, `Could not fetch ${requested.href}: ${err.message}`, { code: err.code ?? 'FETCH_FAILED' });
  }
  if (page.status >= 400) {
    throw new AppError(422, `${page.url} returned HTTP ${page.status}. Check the URL and try again.`, { code: 'PAGE_HTTP_ERROR' });
  }
  if (!isHtml(page.contentType, page.text)) {
    throw new AppError(422, `${page.url} is not an HTML page (content-type: ${page.contentType || 'unknown'})`, { code: 'NOT_HTML' });
  }

  // Redirected to another origin (e.g. apex -> www)? Use that origin's robots.txt from here on.
  const final = new URL(page.url);
  if (final.origin !== requested.origin) {
    robots = buildRobots(`${final.origin}/robots.txt`, await fetcher.tryFetch(`${final.origin}/robots.txt`, { accept: 'text/plain' }));
    assertAllowed(final.href);
  }

  // 3. Site-level AI discovery files.
  await onProgress('discovery', 'Checking llms.txt and sitemap', 35);
  const llms = await fetcher.tryFetch(`${final.origin}/llms.txt`, { accept: 'text/markdown,text/plain;q=0.9,*/*;q=0.5' });
  const sitemap = await gatherSitemap(fetcher, final.origin, robots, final.href);

  let httpVariant = null;
  if (final.protocol === 'https:') {
    const res = await fetcher.tryFetch(final.href.replace(/^https:/, 'http:'), { accept: 'text/html' });
    httpVariant = { status: res.status, finalUrl: res.url, redirectsToHttps: Boolean(res.url?.startsWith('https:')), error: res.error?.message };
  }

  // 4. JS rendering and Core Web Vitals are slow and independent, so run them in parallel.
  await onProgress('render', 'Rendering JavaScript and measuring Core Web Vitals', 55);
  const [rendered, vitals] = await Promise.allSettled([
    renderEnabled ? render(final.href) : Promise.reject(new Error('JavaScript rendering is disabled (RENDER_ENABLED=false)')),
    pageSpeedEnabled ? pageSpeed(final.href) : Promise.reject(new Error('PageSpeed Insights is disabled (PAGESPEED_ENABLED=false)')),
  ]);

  const describeVitalsError = (err) =>
    err?.response?.status === 429
      ? 'PageSpeed Insights quota exceeded. Add a PAGESPEED_API_KEY to .env for reliable results.'
      : `PageSpeed Insights failed: ${err?.response?.data?.error?.message ?? err?.message}`;

  return buildContext({
    url: requested.href,
    page,
    robots,
    llmsTxt: { url: `${final.origin}/llms.txt`, status: llms.status, contentType: llms.contentType ?? '', text: llms.text?.slice(0, 200_000) ?? null, finalUrl: llms.url, error: llms.error },
    sitemap,
    httpVariant,
    renderedHtml: rendered.status === 'fulfilled' ? rendered.value.html : null,
    renderError: rendered.status === 'rejected' ? rendered.reason.message : null,
    pageSpeed: vitals.status === 'fulfilled' ? vitals.value : null,
    pageSpeedError: vitals.status === 'rejected' ? describeVitalsError(vitals.reason) : null,
  });
}
