import { defineCheck, statusFromScore } from '../helpers.js';

export default defineCheck({
  id: 'status-redirects',
  category: 'technical',
  title: 'HTTP status and redirect chain',
  impact: 'high',
  effort: 'low',

  run({ response, url, finalUrl }) {
    const hops = response.redirects.length;
    const temporary = response.redirects.filter((r) => r.status === 302 || r.status === 307);

    if (response.status !== 200) {
      return {
        score: 0,
        details: { summary: `The page returned HTTP ${response.status}.`, status: response.status },
        recommendation: 'Make sure the page returns HTTP 200.',
      };
    }

    const score = Math.max(0, (hops <= 1 ? 100 : hops === 2 ? 70 : 40) - (temporary.length ? 10 : 0));
    return {
      score,
      status: statusFromScore(score, { pass: 90, warn: 60 }),
      details: {
        summary: hops ? `HTTP 200 after ${hops} redirect(s)${temporary.length ? `, ${temporary.length} of them temporary (302/307)` : ''}.` : 'HTTP 200 with no redirects.',
        requestedUrl: url,
        finalUrl,
        redirectChain: response.redirects.map((r) => `${r.status}: ${r.from} → ${r.to}`),
        responseTimeMs: response.durationMs,
      },
      recommendation:
        score >= 90
          ? ''
          : `Link directly to the final URL and collapse redirect chains into a single 301.${temporary.length ? ' Use 301 (permanent) instead of 302/307 for permanent moves.' : ''}`,
    };
  },
});
