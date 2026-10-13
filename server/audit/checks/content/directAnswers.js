import { defineCheck, percent, statusFromScore } from '../helpers.js';
import { isQuestion } from './questions.js';

// The first block under a heading should deliver the answer within ~40-60 words.
export const MAX_ANSWER_WORDS = 60;
export const MIN_ANSWER_WORDS = 8;

/** Classify the opening of a section: concise answer, too long, too short, or missing. */
export function judgeSection(section) {
  const first = section.blocks[0];
  if (!first) return { verdict: 'missing', words: 0 };
  if (first.tag === 'ul' || first.tag === 'ol' || first.tag === 'table' || first.tag === 'dl') return { verdict: 'concise', words: first.words, note: 'opens with a list/table' };
  if (first.words < MIN_ANSWER_WORDS) return { verdict: 'too-short', words: first.words };
  if (first.words > MAX_ANSWER_WORDS) return { verdict: 'too-long', words: first.words };
  return { verdict: 'concise', words: first.words };
}

export default defineCheck({
  id: 'direct-answers',
  category: 'content',
  title: 'Direct answers right under headings',
  impact: 'high',
  effort: 'medium',

  run({ page }) {
    const sections = page.sections.filter((s) => (s.level === 2 || s.level === 3) && s.heading);
    if (!sections.length) {
      return {
        score: 0,
        details: { summary: 'No H2/H3 sections with paragraph content were found to evaluate.' },
        recommendation: `Structure content as heading + short answer: put a ${MIN_ANSWER_WORDS}-${MAX_ANSWER_WORDS} word direct answer in the first paragraph under each H2/H3, then expand below it.`,
      };
    }

    // Question headings are what AI engines match against, so judge those when there are enough of them.
    const questionSections = sections.filter((s) => isQuestion(s.heading));
    const useQuestions = questionSections.length >= 3;
    const evaluated = useQuestions ? questionSections : sections;
    const judged = evaluated.map((s) => ({ heading: s.heading, ...judgeSection(s) }));
    const concise = judged.filter((j) => j.verdict === 'concise');
    const score = percent(concise.length, judged.length);

    return {
      score,
      status: statusFromScore(score, { pass: 70, warn: 40 }),
      details: {
        summary: `${concise.length} of ${judged.length} ${useQuestions ? 'question ' : ''}sections open with a concise answer (${MIN_ANSWER_WORDS}-${MAX_ANSWER_WORDS} words).`,
        sections: judged.slice(0, 15).map((j) => ({ heading: j.heading, firstBlockWords: j.words, verdict: j.verdict })),
      },
      recommendation:
        score >= 70
          ? ''
          : `Rewrite the first paragraph under each heading to answer it directly in ${MIN_ANSWER_WORDS}-${MAX_ANSWER_WORDS} words (lead with the answer, not background), then add detail. ${judged.filter((j) => j.verdict === 'too-long').length} section(s) open with overly long paragraphs.`,
    };
  },
});
