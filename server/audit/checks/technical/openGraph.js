import { defineCheck, statusFromScore } from '../helpers.js';

const REQUIRED = ['og:title', 'og:description', 'og:image', 'og:url'];

export default defineCheck({
  id: 'open-graph',
  category: 'technical',
  title: 'Open Graph tags',
  impact: 'low',
  effort: 'low',

  run({ page }) {
    const missing = REQUIRED.filter((tag) => !page.og[tag]);
    const score = Math.round(((REQUIRED.length - missing.length) / REQUIRED.length) * 100);
    return {
      score,
      status: statusFromScore(score, { pass: 100, warn: 50 }),
      details: {
        summary: missing.length ? `Missing Open Graph tags: ${missing.join(', ')}.` : 'All core Open Graph tags are present.',
        tags: Object.fromEntries(REQUIRED.map((tag) => [tag, page.og[tag] ?? '—'])),
        twitterCard: page.og['twitter:card'] ?? null,
      },
      recommendation: missing.length ? `Add ${missing.join(', ')}. Link previews in AI chat interfaces and social apps are built from these tags.` : '',
    };
  },
});
