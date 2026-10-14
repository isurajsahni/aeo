import { config } from '../../config/index.js';
import { contextFor, fetchPage, gatherPageExtras, gatherSite, pageProblem } from '../context.js';
import { runChecks } from '../runChecks.js';
import { PoliteFetcher } from './httpClient.js';
import { displayPath, normalizeCrawlUrl, shouldCrawl } from './urls.js';

/**
 * Breadth-first crawl of one site, auditing each page as it goes.
 *
 * Discovery order: links on the start page first (navigation usually holds the
 * important pages), then sitemap URLs, then links found on later pages.
 * robots.txt is respected for our crawler token, the PoliteFetcher spaces requests
 * per host, and every request goes through the SSRF-safe HTTP client.
 *
 * Expensive extras are capped: JS rendering for the first `renderMaxPages` pages,
 * PageSpeed for the start page only. Results are streamed to `onPage` so the caller
 * can persist them; the crawler keeps no page data in memory.
 *
 * @returns {{ site, audited: number, failed: number, discovered: number, skippedByRobots: number }}
 */
export async function crawlSite(
  startUrl,
  {
    maxPages = config.crawler.defaultCrawlPages,
    fetcher = new PoliteFetcher(),
    render,
    pageSpeed,
    renderEnabled = config.render.enabled,
    pageSpeedEnabled = config.pageSpeed.enabled,
    renderMaxPages = config.render.maxPages,
    onProgress = () => {},
    onPage = () => {},
  } = {},
) {
  const site = await gatherSite(startUrl, { fetcher, onProgress });
  const siteHost = new URL(site.startPage.url).hostname;
  const token = config.crawler.robotsToken;

  const seen = new Set();
  const queue = [];
  const enqueue = (href, depth) => {
    const url = normalizeCrawlUrl(href, site.startPage.url);
    if (!url || seen.has(url) || !shouldCrawl(url, siteHost)) return;
    seen.add(url);
    queue.push({ url, depth });
  };

  enqueue(site.startPage.url, 0);
  const stats = { audited: 0, failed: 0, skippedByRobots: 0 };
  let rendered = 0;

  while (queue.length && stats.audited + stats.failed < maxPages) {
    const { url, depth } = queue.shift();
    const isStart = stats.audited + stats.failed === 0;
    const done = stats.audited + stats.failed;
    await onProgress('crawl', `Auditing page ${done + 1} of up to ${maxPages}: ${displayPath(url)}`, Math.min(85, 40 + Math.round((45 * done) / maxPages)));

    let page;
    if (isStart) {
      page = site.startPage;
    } else {
      if (site.robots.parser.isAllowed(url, token) === false) {
        stats.skippedByRobots += 1;
        continue;
      }
      page = await fetchPage(fetcher, url);
      const problem = pageProblem(page);
      if (problem) {
        stats.failed += 1;
        await onPage({ url, depth, statusCode: page.status, error: problem });
        continue;
      }
      // Redirected off-site, or onto a page we already have: nothing new to audit.
      const finalUrl = normalizeCrawlUrl(page.url);
      if (!shouldCrawl(finalUrl, siteHost) || (finalUrl !== url && seen.has(finalUrl))) continue;
      seen.add(finalUrl);
    }

    const extras = await gatherPageExtras(page.url, {
      render,
      pageSpeed,
      renderEnabled: renderEnabled && rendered < renderMaxPages ? true : renderEnabled ? `JavaScript rendering runs on the first ${renderMaxPages} pages of a crawl only` : false,
      pageSpeedEnabled: pageSpeedEnabled && isStart ? true : pageSpeedEnabled ? 'Core Web Vitals are measured on the start page of a crawl' : false,
    });
    if (extras.renderedHtml) rendered += 1;

    const ctx = contextFor(site, page, extras);
    const results = runChecks(ctx);
    stats.audited += 1;
    await onPage({ url, depth, ctx, results });

    for (const link of ctx.page.links) if (link.internal) enqueue(link.href, depth + 1);
    if (isStart) for (const loc of site.sitemap.urls ?? []) enqueue(loc, 1);
  }

  return { site, ...stats, discovered: seen.size };
}
