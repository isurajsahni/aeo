import { fleschReadingEase } from '../../parsers/readability.js';
import { defineCheck, skip, statusFromScore } from '../helpers.js';

const band = (fre) =>
  fre >= 70 ? 'easy' : fre >= 60 ? 'plain English' : fre >= 50 ? 'fairly difficult' : fre >= 30 ? 'difficult' : 'very difficult';

export default defineCheck({
  id: 'readability',
  category: 'content',
  title: 'Readability (Flesch Reading Ease)',
  impact: 'medium',
  effort: 'medium',

  run({ page }) {
    if (page.lang && !/^en\b/i.test(page.lang)) return skip(`Readability scoring uses an English formula; the page language is "${page.lang}".`);
    const result = fleschReadingEase(page.proseText);
    if (!result) return skip('Not enough paragraph text on the page to measure readability.');

    const fre = result.score;
    const score = fre >= 60 ? 100 : fre >= 30 ? Math.round(40 + ((fre - 30) / 30) * 60) : 30;

    return {
      score,
      status: statusFromScore(score, { pass: 80, warn: 50 }),
      details: {
        summary: `Flesch Reading Ease ${fre} (${band(fre)}), averaging ${result.wordsPerSentence} words per sentence.`,
        fleschReadingEase: fre,
        wordsPerSentence: result.wordsPerSentence,
        syllablesPerWord: result.syllablesPerWord,
        sentences: result.sentences,
      },
      recommendation:
        score >= 80
          ? ''
          : 'Aim for a Flesch score of 60+: shorter sentences (15-20 words), plain words, one idea per sentence. Clear, quotable sentences are easier for AI engines to extract.',
    };
  },
});
