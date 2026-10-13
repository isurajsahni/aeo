import { defineCheck } from '../helpers.js';

const AUTHORITATIVE = /(\.gov|\.edu|\.ac\.[a-z]{2}|\.gov\.[a-z]{2}|wikipedia\.org|who\.int|nih\.gov|europa\.eu)$/i;

export default defineCheck({
  id: 'outbound-citations',
  category: 'trust',
  title: 'Cites external sources',
  impact: 'low',
  effort: 'medium',

  run({ page }) {
    const citations = page.links.filter((l) => l.external && l.inMain && !l.social);
    const domains = [...new Set(citations.map((l) => l.host))];
    const authoritative = domains.filter((d) => AUTHORITATIVE.test(d));

    const score = domains.length >= 3 ? 100 : domains.length >= 1 ? 60 + (authoritative.length ? 20 : 0) : 30;
    return {
      score,
      status: score >= 80 ? 'pass' : 'warn',
      details: {
        summary: domains.length
          ? `The main content links to ${domains.length} external domain(s)${authoritative.length ? `, including ${authoritative.length} authoritative source(s)` : ''}.`
          : 'The main content does not link to any external sources.',
        domains: domains.slice(0, 15),
        authoritative,
      },
      recommendation:
        score >= 80
          ? ''
          : 'Back up claims, statistics and advice with links to credible sources (studies, official bodies, industry data). Well-sourced content is treated as more trustworthy.',
    };
  },
});
