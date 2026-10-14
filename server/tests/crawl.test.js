import { aggregateResults } from '../audit/aggregate.js';
import { PoliteFetcher } from '../audit/crawler/httpClient.js';
import { crawlSite } from '../audit/crawler/siteCrawler.js';
import { normalizeCrawlUrl, shouldCrawl } from '../audit/crawler/urls.js';
import { scoreAudit } from '../audit/scoring/index.js';
import { html } from './helpers/context.js';

describe('crawl URL rules', () => {
  test.each([
    ['https://Example.com/About/#team', 'https://example.com/About'],
    ['https://example.com/blog/?utm_source=x&b=2&a=1', 'https://example.com/blog?a=1&b=2'],
    ['https://example.com/', 'https://example.com/'],
    ['https://example.com:443/x/', 'https://example.com/x'],
    ['/pricing', 'https://example.com/pricing'],
  ])('normalizes %p', (input, expected) => {
    expect(normalizeCrawlUrl(input, 'https://example.com/')).toBe(expected);
  });

  test('rejects non-http schemes', () => {
    expect(normalizeCrawlUrl('mailto:hi@example.com')).toBeNull();
    expect(normalizeCrawlUrl('javascript:void(0)')).toBeNull();
  });

  test('stays on the same site (www-insensitive) and skips files and app paths', () => {
    expect(shouldCrawl('https://www.example.com/services', 'example.com')).toBe(true);
    expect(shouldCrawl('https://blog.example.com/', 'example.com')).toBe(false);
    expect(shouldCrawl('https://other.com/', 'example.com')).toBe(false);
    expect(shouldCrawl('https://example.com/brochure.pdf', 'example.com')).toBe(false);
    expect(shouldCrawl('https://example.com/wp-admin/edit.php', 'example.com')).toBe(false);
    expect(shouldCrawl('https://example.com/shop?add-to-cart=12', 'example.com')).toBe(false);
  });
});

/** A fake site served from a URL -> response map; everything else 404s. */
function fakeSite(routes) {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    const route = routes[url];
    if (!route) return { url, status: 404, headers: {}, contentType: 'text/html', text: 'Not found', redirects: [] };
    return { url: route.finalUrl ?? url, status: route.status ?? 200, headers: {}, contentType: route.contentType ?? 'text/html', text: route.text, redirects: [] };
  };
  return { fetcher: new PoliteFetcher({ delayMs: 0, fetchImpl }), requested };
}

const page = (title, links = [], body = '') =>
  html(`<nav>${links.map((l) => `<a href="${l}">${l}</a>`).join('')}</nav><main><h1>${title}</h1>${body}</main>`, `<title>${title} | Example Clinic Ludhiana</title>`);

describe('site crawl (offline)', () => {
  const routes = {
    'https://example.com/robots.txt': { text: 'User-agent: *\nDisallow: /private\nSitemap: https://example.com/sitemap.xml', contentType: 'text/plain' },
    'https://example.com/': { text: page('Home', ['/about', '/services', '/private/admin', '/brochure.pdf', 'https://other.com/', '/about#team']) },
    'https://example.com/about': { text: page('About', ['/', '/team']) },
    'https://example.com/services': { text: page('Services', ['/services/whitening']) },
    'https://example.com/services/whitening': { text: page('Whitening') },
    'https://example.com/team': { status: 500, text: 'oops' },
    'https://example.com/sitemap.xml': {
      contentType: 'application/xml',
      text: '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/contact</loc></url></urlset>',
    },
    'https://example.com/contact': { text: page('Contact') },
  };

  const run = async (maxPages) => {
    const { fetcher, requested } = fakeSite(routes);
    const saved = [];
    const stages = new Set();
    const result = await crawlSite('https://example.com/', {
      maxPages,
      fetcher,
      render: async (url) => ({ html: routes[url]?.text ?? '' }),
      pageSpeed: async () => ({ source: 'lab', lcpMs: 2000, tbtMs: 100, cls: 0.01 }),
      renderMaxPages: 2,
      onProgress: (stage) => stages.add(stage),
      onPage: (entry) => saved.push(entry),
    });
    return { result, saved, requested, stages };
  };

  test('discovers pages breadth-first, respects robots.txt and records failed pages', async () => {
    const { result, saved, requested, stages } = await run(25);

    const audited = saved.filter((s) => !s.error).map((s) => s.url);
    expect(audited).toEqual([
      'https://example.com/',
      'https://example.com/about',
      'https://example.com/services',
      'https://example.com/contact', // from the sitemap, after the start page's links
      'https://example.com/services/whitening',
    ]);
    expect(saved.find((s) => s.error)).toMatchObject({ url: 'https://example.com/team', statusCode: 500, error: { code: 'PAGE_HTTP_ERROR' } });

    // Never fetched: disallowed, a file, another site.
    expect(requested).not.toContain('https://example.com/private/admin');
    expect(requested.some((u) => u.endsWith('.pdf') || u.includes('other.com'))).toBe(false);
    expect(result).toMatchObject({ audited: 5, failed: 1, skippedByRobots: 1 });
    expect(stages.has('crawl')).toBe(true);
  });

  test('stops at maxPages', async () => {
    const { result, saved } = await run(2);
    expect(saved).toHaveLength(2);
    expect(result.audited).toBe(2);
  });

  test('renders only the first N pages and measures vitals on the start page only', async () => {
    const { saved } = await run(25);
    const byUrl = Object.fromEntries(saved.filter((s) => !s.error).map((s) => [s.url, s.results]));
    const status = (url, id) => byUrl[url].find((r) => r.id === id);
    expect(status('https://example.com/', 'js-rendering').skipped).toBe(false);
    expect(status('https://example.com/about', 'js-rendering').skipped).toBe(false);
    expect(status('https://example.com/contact', 'js-rendering')).toMatchObject({ skipped: true });
    expect(status('https://example.com/about', 'core-web-vitals').details.summary).toMatch(/start page/);
  });

  test('aggregates into one result per check that scores like a single audit', async () => {
    const { saved } = await run(25);
    const pages = saved.filter((s) => !s.error).map((s) => ({ url: s.url, results: s.results }));
    const results = aggregateResults(pages);

    expect(results).toHaveLength(pages[0].results.length);
    const title = results.find((r) => r.id === 'meta-title');
    expect(title.details).toMatchObject({ pagesChecked: 5 });

    const scores = scoreAudit(results, { label: 'example.com' });
    expect(scores.overall).toBeGreaterThan(0);
    expect(scores.categories).toHaveLength(5);
  });
});

describe('aggregateResults', () => {
  const r = (id, score, status, extra = {}) => ({ id, category: 'content', title: id, score, status, weight: 1, details: { summary: `${id} ${score}` }, recommendation: 'fix it', impact: 'medium', effort: 'low', skipped: false, ...extra });

  test('averages page checks, lists the worst pages and never calls a mixed result a pass', () => {
    const [result] = aggregateResults([
      { url: 'https://example.com/', results: [r('heading-hierarchy', 100, 'pass')] },
      { url: 'https://example.com/a', results: [r('heading-hierarchy', 100, 'pass')] },
      { url: 'https://example.com/b', results: [r('heading-hierarchy', 55, 'warn')] },
    ]);
    expect(result.score).toBe(85);
    expect(result.status).toBe('warn');
    expect(result.details).toMatchObject({ pagesChecked: 3, pagesPassing: 2, pagesWarning: 1 });
    expect(result.details.worstPages).toEqual([{ page: '/b', score: 55, finding: 'heading-hierarchy 55' }]);
  });

  test('ignores pages where the check was skipped, and takes site checks from the start page', () => {
    const results = aggregateResults([
      { url: 'https://example.com/', results: [r('author-byline', 0, 'warn', { skipped: true }), r('sitemap', 90, 'pass')] },
      { url: 'https://example.com/blog/post', results: [r('author-byline', 60, 'warn'), r('sitemap', 0, 'fail')] },
    ]);
    expect(results.find((x) => x.id === 'author-byline')).toMatchObject({ score: 60, skipped: false });
    expect(results.find((x) => x.id === 'sitemap')).toMatchObject({ score: 90, status: 'pass' });
  });
});
