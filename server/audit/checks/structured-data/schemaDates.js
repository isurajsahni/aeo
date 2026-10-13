import { defineCheck, skip, statusFromScore } from '../helpers.js';
import { isIsoDate, ruleKeyFor } from './schemaRules.js';

const DATED_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle']);

export default defineCheck({
  id: 'schema-dates',
  category: 'structuredData',
  title: 'datePublished and dateModified in schema',
  impact: 'medium',
  effort: 'low',

  run({ page }) {
    const articles = page.jsonLd.nodes.filter((n) => n.types.some((t) => DATED_TYPES.has(ruleKeyFor(t))));
    if (!articles.length) {
      const webPage = page.jsonLd.nodes.find((n) => n.types.includes('WebPage') && isIsoDate(n.data.dateModified));
      if (webPage) return { score: 100, details: { summary: `WebPage schema has dateModified (${webPage.data.dateModified}).` }, recommendation: '' };
      return skip('No Article/BlogPosting schema on this page, so publication dates are not expected.');
    }

    const rows = articles.map((n) => ({
      type: n.types[0],
      datePublished: n.data.datePublished ?? '—',
      dateModified: n.data.dateModified ?? '—',
      publishedValid: isIsoDate(n.data.datePublished),
      modifiedValid: isIsoDate(n.data.dateModified),
    }));
    const score = Math.round(rows.reduce((sum, r) => sum + (r.publishedValid ? 50 : 0) + (r.modifiedValid ? 50 : 0), 0) / rows.length);
    const missing = [rows.some((r) => !r.publishedValid) && 'a valid datePublished', rows.some((r) => !r.modifiedValid) && 'a valid dateModified'].filter(Boolean);

    return {
      score,
      status: statusFromScore(score),
      details: {
        summary: missing.length ? `Article schema is missing ${missing.join(' and ')}.` : 'Article schema has valid datePublished and dateModified.',
        articles: rows.map(({ type, datePublished, dateModified }) => ({ type, datePublished, dateModified })),
      },
      recommendation: missing.length ? `Add ${missing.join(' and ')} (ISO 8601, e.g. 2026-05-14T09:00:00+05:30) to your Article schema. AI engines favour content with clear, recent dates.` : '',
    };
  },
});
