import { defineCheck, statusFromScore } from '../helpers.js';

export default defineCheck({
  id: 'https',
  category: 'technical',
  title: 'HTTPS everywhere',
  impact: 'high',
  effort: 'low',

  run({ finalUrl, httpVariant, response }) {
    if (!finalUrl.startsWith('https:')) {
      return {
        score: 0,
        details: { summary: 'The page is served over plain HTTP.', finalUrl },
        recommendation: 'Serve the site over HTTPS (free certificates from Let’s Encrypt or your host) and redirect all HTTP URLs to HTTPS.',
      };
    }

    const redirects = httpVariant?.redirectsToHttps ?? false;
    const hsts = Boolean(response.headers['strict-transport-security']);
    const score = 60 + (redirects ? 30 : 0) + (hsts ? 10 : 0);
    const issues = [!redirects && 'the HTTP version does not redirect to HTTPS', !hsts && 'no HSTS header'].filter(Boolean);

    return {
      score,
      status: statusFromScore(score, { pass: 90, warn: 60 }),
      details: {
        summary: issues.length ? `Served over HTTPS, but ${issues.join(' and ')}.` : 'Served over HTTPS, HTTP redirects to HTTPS, and HSTS is enabled.',
        httpRedirectsToHttps: redirects,
        httpVersionResult: httpVariant?.error ?? httpVariant?.finalUrl ?? null,
        hsts,
      },
      recommendation: issues.length ? `Fix: ${issues.map((i) => (i.startsWith('no HSTS') ? 'add a Strict-Transport-Security header' : 'add a 301 redirect from HTTP to HTTPS')).join(', ')}.` : '',
    };
  },
});
