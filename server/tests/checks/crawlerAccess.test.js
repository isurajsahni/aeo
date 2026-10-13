import aiCrawlerRobots from '../../audit/checks/crawler-access/aiCrawlerRobots.js';
import indexability from '../../audit/checks/crawler-access/indexability.js';
import jsRendering from '../../audit/checks/crawler-access/jsRendering.js';
import llmsTxt from '../../audit/checks/crawler-access/llmsTxt.js';
import sitemap from '../../audit/checks/crawler-access/sitemap.js';
import { check, html } from '../helpers/context.js';

describe('ai-crawler-robots', () => {
  test('passes when there is no robots.txt (everything allowed)', () => {
    const result = check(aiCrawlerRobots, { robotsTxt: null });
    expect(result).toMatchObject({ status: 'pass', score: 100, category: 'crawlerAccess' });
  });

  test('flags specific AI bots that are disallowed', () => {
    const result = check(aiCrawlerRobots, {
      robotsTxt: 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: *\nAllow: /',
    });
    const blocked = result.details.crawlers.filter((c) => !c.allowed).map((c) => c.bot);
    expect(blocked).toEqual(['GPTBot', 'CCBot']);
    expect(result.status).toBe('warn');
    expect(result.score).toBe(71);
    expect(result.recommendation).toMatch(/GPTBot, CCBot/);
  });

  test('fails when a wildcard rule blocks every crawler', () => {
    const result = check(aiCrawlerRobots, { robotsTxt: 'User-agent: *\nDisallow: /' });
    expect(result).toMatchObject({ status: 'fail', score: 0 });
  });

  test('respects path-specific rules for the audited URL', () => {
    const robotsTxt = 'User-agent: PerplexityBot\nDisallow: /private/';
    expect(check(aiCrawlerRobots, { robotsTxt, url: 'https://example.com/' }).status).toBe('pass');
    expect(check(aiCrawlerRobots, { robotsTxt, url: 'https://example.com/private/page' }).status).toBe('warn');
  });

  test('warns when robots.txt errors out', () => {
    expect(check(aiCrawlerRobots, { robotsTxt: null, robotsStatus: 503 }).status).toBe('warn');
  });
});

describe('llms-txt', () => {
  const llms = (text, extra = {}) => ({ llmsTxt: { url: 'https://example.com/llms.txt', status: 200, contentType: 'text/markdown', text, ...extra } });

  test('fails when missing', () => {
    expect(check(llmsTxt)).toMatchObject({ status: 'fail', score: 0 });
  });

  test('treats an HTML soft-404 as missing', () => {
    const result = check(llmsTxt, llms('<!doctype html><html>Not found</html>', { contentType: 'text/html' }));
    expect(result.status).toBe('fail');
    expect(result.details.summary).toMatch(/soft 404/);
  });

  test('passes a well-formed file', () => {
    const result = check(llmsTxt, llms('# Example Co\n\n> Dental clinic in Ludhiana.\n\n## Services\n- [Whitening](https://example.com/whitening): Teeth whitening\n'));
    expect(result).toMatchObject({ status: 'pass', score: 100 });
    expect(result.details.sections).toEqual(['Services']);
  });

  test('warns about a file missing structure', () => {
    const result = check(llmsTxt, llms('Example Co is a clinic.'));
    expect(result.status).toBe('warn');
    expect(result.recommendation).toMatch(/H1 title/);
  });
});

describe('js-rendering', () => {
  const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

  test('is skipped when the page could not be rendered', () => {
    expect(check(jsRendering, { renderError: 'Chromium missing' }).skipped).toBe(true);
  });

  test('passes when the raw HTML already contains the content', () => {
    const body = `<main><h1>Hello</h1><p>${words(300)}</p></main>`;
    const result = check(jsRendering, { body, renderedHtml: html(body) });
    expect(result).toMatchObject({ status: 'pass', score: 100 });
  });

  test('fails a client-side rendered page and lists JS-only headings', () => {
    const result = check(jsRendering, {
      body: '<div id="root"></div>',
      renderedHtml: html(`<main><h1>Pricing</h1><h2>Plans</h2><p>${words(400)}</p></main>`),
    });
    expect(result.status).toBe('fail');
    expect(result.details.headingsOnlyAfterJs).toEqual(['H1: Pricing', 'H2: Plans']);
  });
});

describe('indexability', () => {
  test('fails a noindex page', () => {
    const result = check(indexability, { head: '<meta name="robots" content="noindex, follow">' });
    expect(result).toMatchObject({ status: 'fail', score: 0 });
  });

  test('detects noindex in the X-Robots-Tag header', () => {
    expect(check(indexability, { headers: { 'x-robots-tag': 'noindex' } }).score).toBe(0);
  });

  test('penalizes nosnippet', () => {
    expect(check(indexability, { head: '<meta name="googlebot" content="nosnippet">' }).score).toBe(30);
  });

  test('passes a normal page', () => {
    expect(check(indexability).status).toBe('pass');
  });
});

describe('sitemap', () => {
  const recent = new Date(Date.now() - 10 * 86_400_000).toISOString();

  test('fails when no sitemap exists', () => {
    expect(check(sitemap, { sitemap: { found: false, tried: [] } }).status).toBe('fail');
  });

  test('passes a fresh sitemap referenced in robots.txt', () => {
    const result = check(sitemap, {
      sitemap: { found: true, fromRobots: true, url: 'https://example.com/sitemap.xml', type: 'urlset', urlCount: 40, lastmodCoverage: 1, newestLastmod: recent },
    });
    expect(result).toMatchObject({ status: 'pass', score: 100 });
  });

  test('warns about a stale sitemap without lastmod coverage', () => {
    const result = check(sitemap, {
      sitemap: { found: true, fromRobots: false, url: 'https://example.com/sitemap.xml', type: 'urlset', urlCount: 40, lastmodCoverage: 0, newestLastmod: null },
    });
    expect(result.status).toBe('warn');
    expect(result.score).toBe(50);
  });
});
