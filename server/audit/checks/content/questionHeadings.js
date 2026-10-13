import { defineCheck, percent, statusFromScore } from '../helpers.js';
import { isQuestion } from './questions.js';

const TARGET_PERCENT = 30;

export default defineCheck({
  id: 'question-headings',
  category: 'content',
  title: 'Question-style H2/H3 headings',
  impact: 'medium',
  effort: 'low',

  run({ page }) {
    const subheadings = page.headings.filter((h) => (h.level === 2 || h.level === 3) && h.text);
    if (!subheadings.length) {
      return {
        score: 0,
        details: { summary: 'The page has no H2/H3 subheadings, so there are no clear sections for AI engines to match to questions.' },
        recommendation: 'Break the content into sections with H2/H3 headings phrased the way customers ask, e.g. "How much does teeth whitening cost?"',
      };
    }

    const questions = subheadings.filter((h) => isQuestion(h.text));
    const share = percent(questions.length, subheadings.length);
    const score = Math.min(100, Math.round((share / TARGET_PERCENT) * 100));

    return {
      score,
      status: statusFromScore(score),
      details: {
        summary: `${questions.length} of ${subheadings.length} H2/H3 headings (${share}%) are phrased as questions. Aim for at least ${TARGET_PERCENT}%.`,
        questionHeadings: questions.slice(0, 10).map((h) => h.text),
        otherHeadings: subheadings.filter((h) => !isQuestion(h.text)).slice(0, 10).map((h) => h.text),
      },
      recommendation:
        score >= 80
          ? ''
          : 'Rephrase some headings as the questions people type or ask AI assistants (who, what, how, how much, best...). Matching the question wording makes the section easier to retrieve and cite.',
    };
  },
});
