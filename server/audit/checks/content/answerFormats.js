import { defineCheck, statusFromScore } from '../helpers.js';

export default defineCheck({
  id: 'answer-formats',
  category: 'content',
  title: 'Lists, tables and FAQ sections',
  impact: 'medium',
  effort: 'low',

  run({ page }) {
    const faqSection =
      page.headings.some((h) => /\bfaqs?\b|frequently asked/i.test(h.text)) ||
      page.detailsElements >= 2 ||
      page.jsonLd.types.includes('FAQPage');

    const score = (page.lists > 0 ? 45 : 0) + (page.tables > 0 ? 20 : 0) + (faqSection ? 35 : 0);
    const missing = [!page.lists && 'bulleted or numbered lists', !page.tables && 'a comparison/pricing table', !faqSection && 'an FAQ section'].filter(Boolean);

    return {
      score,
      status: statusFromScore(score, { pass: 65, warn: 35 }),
      details: {
        summary: `Found ${page.lists} list(s), ${page.tables} table(s) and ${faqSection ? 'an' : 'no'} FAQ section in the main content.`,
        lists: page.lists,
        tables: page.tables,
        faqSection,
      },
      recommendation: missing.length
        ? `AI engines lift structured formats straight into answers. Consider adding ${missing.join(', ')} where they fit the content.`
        : '',
    };
  },
});
