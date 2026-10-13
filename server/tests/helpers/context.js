import { buildContext } from '../../audit/context.js';
import { runCheck } from '../../audit/runChecks.js';

/** Wrap body markup in a minimal document. */
export const html = (body, head = '') =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;

export const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

/**
 * Build an audit context from fixtures with sensible defaults (a clean HTTPS 200 page).
 * Override any part: { body, head, url, robotsTxt, llmsTxt, sitemap, renderedHtml, pageSpeed, ... }.
 */
export function makeContext({
  url = 'https://example.com/',
  body = '<main><h1>Title</h1></main>',
  head = '',
  rawHtml,
  status = 200,
  headers = {},
  redirects = [],
  robotsTxt,
  robotsStatus,
  llmsTxt,
  sitemap,
  httpVariant = { status: 200, finalUrl: url, redirectsToHttps: true },
  renderedHtml,
  renderError,
  pageSpeed,
  pageSpeedError,
} = {}) {
  return buildContext({
    url,
    fetchedAt: new Date().toISOString(),
    page: { url, status, headers: { 'content-type': 'text/html', ...headers }, text: rawHtml ?? html(body, head), redirects, durationMs: 120 },
    robots: { status: robotsStatus ?? (robotsTxt == null ? 404 : 200), text: robotsTxt ?? null },
    llmsTxt: llmsTxt ?? { url: `${new URL(url).origin}/llms.txt`, status: 404, text: null },
    sitemap,
    httpVariant,
    renderedHtml,
    renderError,
    pageSpeed,
    pageSpeedError,
  });
}

/** Run a single check module against a fixture context. */
export const check = (module, overrides) => runCheck(module, makeContext(overrides));
