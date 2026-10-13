/** Rough English syllable count; accurate enough for Flesch scoring. */
export function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/**
 * Flesch Reading Ease (0-100+, higher = easier).
 * 60-70 is plain English; most AI-cited explainer content sits around 50-70.
 */
export function fleschReadingEase(text) {
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().split(/\s+/).length >= 3);
  const words = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  if (!sentences.length || words.length < 30) return null;

  const syllables = words.reduce((total, word) => total + countSyllables(word), 0);
  const wordsPerSentence = words.length / sentences.length;
  const syllablesPerWord = syllables / words.length;
  const score = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;

  return {
    score: Math.round(score * 10) / 10,
    words: words.length,
    sentences: sentences.length,
    wordsPerSentence: Math.round(wordsPerSentence * 10) / 10,
    syllablesPerWord: Math.round(syllablesPerWord * 100) / 100,
  };
}
