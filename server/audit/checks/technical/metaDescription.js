import { defineCheck, statusFromScore } from '../helpers.js';

export const DESCRIPTION_RANGE = { min: 70, max: 160 };

export default defineCheck({
  id: 'meta-description',
  category: 'technical',
  title: 'Meta description length',
  impact: 'low',
  effort: 'low',

  run({ page }) {
    const description = page.metaDescription;
    if (!description) {
      return {
        score: 0,
        details: { summary: 'No meta description.' },
        recommendation: `Write a ${DESCRIPTION_RANGE.min}-${DESCRIPTION_RANGE.max} character meta description that summarizes the page in one or two plain sentences. AI engines often reuse it as the page summary.`,
      };
    }
    const length = [...description].length;
    const score = length >= DESCRIPTION_RANGE.min && length <= DESCRIPTION_RANGE.max ? 100 : length >= 50 && length <= 200 ? 70 : 40;
    return {
      score,
      status: statusFromScore(score),
      details: { summary: `Meta description is ${length} characters. Recommended: ${DESCRIPTION_RANGE.min}-${DESCRIPTION_RANGE.max}.`, description, length },
      recommendation: score >= 80 ? '' : length < DESCRIPTION_RANGE.min ? 'Expand the meta description into a full one-to-two sentence summary.' : 'Trim the meta description so the key message fits in 160 characters.',
    };
  },
});
