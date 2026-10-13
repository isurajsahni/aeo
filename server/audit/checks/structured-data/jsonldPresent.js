import { defineCheck, statusFromScore } from '../helpers.js';

export default defineCheck({
  id: 'jsonld-present',
  category: 'structuredData',
  title: 'Valid JSON-LD structured data',
  impact: 'high',
  effort: 'medium',

  run({ page }) {
    const { blocks, nodes, errors, types } = page.jsonLd;

    if (!blocks) {
      return {
        score: 0,
        details: {
          summary: page.hasMicrodata
            ? 'No JSON-LD found (the page uses Microdata instead). JSON-LD is the format AI and search engines parse most reliably.'
            : 'No JSON-LD structured data found. AI engines rely on it to understand what your business and pages are about.',
        },
        recommendation: 'Add JSON-LD <script type="application/ld+json"> blocks describing your Organization (or LocalBusiness) and the page content (Article, FAQPage, Product...).',
      };
    }

    const score = Math.max(20, 100 - errors.length * 35 - (nodes.length ? 0 : 40));
    return {
      score,
      status: statusFromScore(score, { pass: 90, warn: 50 }),
      details: {
        summary: errors.length
          ? `${blocks} JSON-LD block(s) found, but ${errors.length} could not be parsed and will be ignored by crawlers.`
          : `${blocks} JSON-LD block(s) found with ${types.length} schema type(s): ${types.join(', ') || 'none'}.`,
        blocks,
        types,
        parseErrors: errors,
      },
      recommendation: errors.length ? 'Fix the invalid JSON-LD (validate it at validator.schema.org). Common causes: trailing commas, unescaped quotes, or template tags left in the output.' : '',
    };
  },
});
