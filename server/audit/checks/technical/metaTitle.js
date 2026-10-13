import { defineCheck, statusFromScore } from '../helpers.js';

export const TITLE_RANGE = { min: 30, max: 60 };

export default defineCheck({
  id: 'meta-title',
  category: 'technical',
  title: 'Title tag length',
  impact: 'medium',
  effort: 'low',

  run({ page }) {
    const title = page.title;
    if (!title) {
      return { score: 0, details: { summary: 'The page has no <title>.' }, recommendation: `Add a descriptive <title> of ${TITLE_RANGE.min}-${TITLE_RANGE.max} characters with the main topic and brand.` };
    }

    const length = [...title].length;
    let score = length >= TITLE_RANGE.min && length <= TITLE_RANGE.max ? 100 : length >= 20 && length <= 70 ? 70 : 40;
    if (page.titleCount > 1) score -= 20;

    return {
      score,
      status: statusFromScore(score),
      details: {
        summary: `Title is ${length} characters${page.titleCount > 1 ? ` and the page has ${page.titleCount} <title> tags` : ''}. Recommended: ${TITLE_RANGE.min}-${TITLE_RANGE.max}.`,
        title,
        length,
      },
      recommendation:
        score >= 80
          ? ''
          : length < TITLE_RANGE.min
            ? 'Lengthen the title to describe the page topic clearly (what it is, for whom, where), ending with the brand name.'
            : length > TITLE_RANGE.max
              ? `Shorten the title to ${TITLE_RANGE.max} characters or fewer so it isn't truncated, keeping the key topic first.`
              : 'Keep a single <title> tag per page.',
    };
  },
});
