import { defineCheck, statusFromScore } from '../helpers.js';

export default defineCheck({
  id: 'heading-hierarchy',
  category: 'content',
  title: 'Logical heading hierarchy',
  impact: 'medium',
  effort: 'low',

  run({ page }) {
    const { headings } = page;
    const issues = [];
    const h1s = headings.filter((h) => h.level === 1);

    if (h1s.length === 0) issues.push({ penalty: 35, message: 'No H1 heading' });
    if (h1s.length > 1) issues.push({ penalty: 20, message: `${h1s.length} H1 headings (use exactly one)` });
    if (headings.length && headings[0].level !== 1 && h1s.length) issues.push({ penalty: 5, message: `The first heading is an H${headings[0].level}, not the H1` });

    const skips = [];
    for (let i = 1; i < headings.length; i += 1) {
      if (headings[i].level > headings[i - 1].level + 1) skips.push(`H${headings[i - 1].level} → H${headings[i].level} ("${headings[i].text.slice(0, 50)}")`);
    }
    if (skips.length) issues.push({ penalty: Math.min(45, skips.length * 15), message: `${skips.length} skipped heading level(s)` });

    const empty = headings.filter((h) => !h.text).length;
    if (empty) issues.push({ penalty: Math.min(20, empty * 10), message: `${empty} empty heading(s)` });

    const score = Math.max(0, 100 - issues.reduce((sum, i) => sum + i.penalty, 0));
    return {
      score,
      status: statusFromScore(score),
      details: {
        summary: issues.length ? issues.map((i) => i.message).join('; ') + '.' : `Clean hierarchy: one H1 and ${headings.length - 1} properly nested subheadings.`,
        h1: h1s.map((h) => h.text),
        skippedLevels: skips.slice(0, 10),
        outline: headings.slice(0, 30).map((h) => `${'  '.repeat(h.level - 1)}H${h.level}: ${h.text || '(empty)'}`),
      },
      recommendation: issues.length
        ? 'Use exactly one H1 for the page topic, then H2 for main sections and H3 for sub-points without skipping levels. A clean outline helps AI engines split your page into answerable chunks.'
        : '',
    };
  },
});
