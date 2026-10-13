import { defineCheck, statusFromScore } from '../helpers.js';

export default defineCheck({
  id: 'content-depth',
  category: 'content',
  title: 'Enough substantive content',
  impact: 'medium',
  effort: 'medium',

  run({ page }) {
    const words = page.wordCount;
    const score = words >= 600 ? 100 : words >= 300 ? 75 : words >= 150 ? 40 : 15;
    return {
      score,
      status: statusFromScore(score, { pass: 75, warn: 40 }),
      details: { summary: `The main content has ${words} words.`, wordCount: words },
      recommendation:
        score >= 75
          ? ''
          : 'Thin pages give AI engines little to quote. Expand the main content to cover the questions customers ask about this topic (aim for 600+ useful words), without padding.',
    };
  },
});
