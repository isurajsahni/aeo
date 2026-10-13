import { PoliteFetcher } from '../audit/crawler/httpClient.js';
import { gatherContext } from '../audit/context.js';
import { runChecks } from '../audit/runChecks.js';
import { scoreAudit } from '../audit/scoring/index.js';
import { html, jsonLd } from './helpers/context.js';

/** A fake website: URL -> response. Anything else is a 404. */
function fakeSite(routes) {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    const route = routes[url];
    if (!route) return { url, status: 404, headers: {}, contentType: 'text/html', text: 'Not found', redirects: [] };
    return { url: route.finalUrl ?? url, status: 200, headers: route.headers ?? {}, contentType: route.contentType ?? 'text/html', text: route.text, redirects: route.redirects ?? [] };
  };
  return { fetcher: new PoliteFetcher({ delayMs: 0, fetchImpl }), requested };
}

const homepage = html(
  `<header><nav><a href="/about">About</a><a href="/contact">Contact</a></nav></header>
   <main>
     <h1>Smile Dental Ludhiana</h1>
     <h2>What does a teeth cleaning cost?</h2>
     <p>A standard cleaning at our clinic costs ₹1,500 and takes about 45 minutes, including a check-up.</p>
     <h2>How do I book an appointment?</h2>
     <ul><li>Call us</li><li>Book online</li></ul>
   </main>
   <footer><a href="/privacy">Privacy policy</a></footer>`,
  `<title>Smile Dental | Family Dentist in Ludhiana</title>
   <meta name="description" content="Family dental clinic in Ludhiana offering cleanings, whitening, implants and braces. Book online today.">
   <link rel="canonical" href="https://example.com/">
   ${jsonLd({ '@context': 'https://schema.org', '@type': 'Dentist', name: 'Smile Dental', url: 'https://example.com', address: { '@type': 'PostalAddress', addressLocality: 'Ludhiana' } })}`,
);

describe('audit pipeline (offline)', () => {
  test('gathers context from a site, runs every check and scores it', async () => {
    const { fetcher, requested } = fakeSite({
      'https://example.com/robots.txt': { text: 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml', contentType: 'text/plain' },
      'https://example.com/': { text: homepage, headers: { 'strict-transport-security': 'max-age=1' } },
      'https://example.com/llms.txt': { text: '# Smile Dental\n> Dentist in Ludhiana\n## Pages\n- [Home](https://example.com/)', contentType: 'text/plain' },
      'https://example.com/sitemap.xml': {
        text: `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc><lastmod>${new Date().toISOString()}</lastmod></url></urlset>`,
        contentType: 'application/xml',
      },
      'http://example.com/': { text: homepage, finalUrl: 'https://example.com/' },
    });

    const stages = [];
    const ctx = await gatherContext('https://example.com/', {
      fetcher,
      render: async () => ({ html: homepage }),
      pageSpeed: async () => ({ source: 'lab', lcpMs: 1800, tbtMs: 100, cls: 0.02, performanceScore: 95 }),
      onProgress: (stage) => stages.push(stage),
    });

    expect(stages).toEqual(['robots', 'page', 'discovery', 'render']);
    expect(requested).toContain('https://example.com/sitemap.xml');
    expect(ctx.sitemap).toMatchObject({ found: true, fromRobots: true, urlCount: 1, includesAuditedUrl: true });

    const results = runChecks(ctx);
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    expect(byId['ai-crawler-robots'].status).toBe('pass');
    expect(byId['llms-txt'].status).toBe('pass');
    expect(byId['js-rendering'].status).toBe('pass');
    expect(byId['organization-schema'].details.type).toBe('Dentist');
    expect(byId['about-contact'].status).toBe('pass');
    expect(byId['core-web-vitals'].status).toBe('pass');

    const scores = scoreAudit(results, { label: 'example.com' });
    expect(scores.overall).toBeGreaterThan(50);
    expect(scores.categories.map((c) => c.id)).toEqual(['crawlerAccess', 'structuredData', 'content', 'trust', 'technical']);
    expect(scores.fixes.length).toBeGreaterThan(0);
  });

  test('refuses to audit a page our crawler is disallowed from', async () => {
    const { fetcher } = fakeSite({ 'https://example.com/robots.txt': { text: 'User-agent: AEOAuditBot\nDisallow: /', contentType: 'text/plain' } });
    await expect(gatherContext('https://example.com/', { fetcher })).rejects.toMatchObject({ code: 'ROBOTS_DISALLOWED' });
  });

  test('fails clearly on HTTP errors and non-HTML pages', async () => {
    await expect(gatherContext('https://example.com/missing', { fetcher: fakeSite({}).fetcher })).rejects.toMatchObject({ code: 'PAGE_HTTP_ERROR' });

    const { fetcher } = fakeSite({ 'https://example.com/file.pdf': { text: '%PDF-1.7', contentType: 'application/pdf' } });
    await expect(gatherContext('https://example.com/file.pdf', { fetcher })).rejects.toMatchObject({ code: 'NOT_HTML' });
  });

  test('a failing renderer or PageSpeed call degrades to a skipped check, not a failed audit', async () => {
    const { fetcher } = fakeSite({ 'https://example.com/': { text: homepage } });
    const ctx = await gatherContext('https://example.com/', {
      fetcher,
      render: async () => {
        throw new Error('Chromium missing');
      },
      pageSpeed: async () => {
        throw Object.assign(new Error('quota'), { response: { status: 429 } });
      },
    });
    const byId = Object.fromEntries(runChecks(ctx).map((r) => [r.id, r]));
    expect(byId['js-rendering']).toMatchObject({ skipped: true });
    expect(byId['core-web-vitals'].details.summary).toMatch(/PAGESPEED_API_KEY/);
  });
});
