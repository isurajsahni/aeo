import answerFormats from '../../audit/checks/content/answerFormats.js';
import contentFreshness from '../../audit/checks/content/contentFreshness.js';
import directAnswers, { judgeSection } from '../../audit/checks/content/directAnswers.js';
import headingHierarchy from '../../audit/checks/content/headingHierarchy.js';
import questionHeadings from '../../audit/checks/content/questionHeadings.js';
import readability from '../../audit/checks/content/readability.js';
import { countSyllables, fleschReadingEase } from '../../audit/parsers/readability.js';
import { check } from '../helpers/context.js';

const words = (n) => Array.from({ length: n }, () => 'tooth').join(' ');

describe('question-headings', () => {
  test('fails with no subheadings', () => {
    expect(check(questionHeadings, { body: '<main><h1>Only</h1></main>' })).toMatchObject({ status: 'fail', score: 0 });
  });

  test('scores the share of question headings against a 30% target', () => {
    const body = '<main><h1>T</h1><h2>What is whitening?</h2><h2>Our team</h2><h2>Prices</h2><h3>How long does it take</h3><h2>Gallery</h2></main>';
    const result = check(questionHeadings, { body });
    // 2 of 5 = 40% (above the 30% target)
    expect(result).toMatchObject({ status: 'pass', score: 100 });
    expect(result.details.questionHeadings).toEqual(['What is whitening?', 'How long does it take']);
  });

  test('gives partial credit below the target', () => {
    const body = '<main><h1>T</h1><h2>Why us?</h2>' + '<h2>Section</h2>'.repeat(9) + '</main>';
    // 1 of 10 = 10% -> 10/30 = 33
    expect(check(questionHeadings, { body }).score).toBe(33);
  });
});

describe('direct-answers', () => {
  test('judges section openings by length', () => {
    expect(judgeSection({ blocks: [{ tag: 'p', words: 30 }] }).verdict).toBe('concise');
    expect(judgeSection({ blocks: [{ tag: 'p', words: 120 }] }).verdict).toBe('too-long');
    expect(judgeSection({ blocks: [{ tag: 'p', words: 3 }] }).verdict).toBe('too-short');
    expect(judgeSection({ blocks: [{ tag: 'ul', words: 200 }] }).verdict).toBe('concise');
    expect(judgeSection({ blocks: [] }).verdict).toBe('missing');
  });

  test('scores question sections that open with a concise answer', () => {
    const body = `<main><h1>Guide</h1>
      <h2>What is teeth whitening?</h2><p>${words(30)}</p><p>${words(200)}</p>
      <h2>How much does it cost?</h2><p>${words(150)}</p>
      <h2>Is it safe?</h2><div><p>${words(25)}</p></div>
      <h2>Contact</h2><p>${words(5)}</p></main>`;
    const result = check(directAnswers, { body });
    // 3 question sections -> 2 concise
    expect(result.score).toBe(67);
    expect(result.status).toBe('warn');
    expect(result.details.sections.map((s) => s.verdict)).toEqual(['concise', 'too-long', 'concise']);
  });
});

describe('heading-hierarchy', () => {
  test('passes a clean outline', () => {
    const result = check(headingHierarchy, { body: '<h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2>' });
    expect(result).toMatchObject({ status: 'pass', score: 100 });
  });

  test('penalizes missing H1 and skipped levels', () => {
    const result = check(headingHierarchy, { body: '<h2>B</h2><h4>Skipped</h4>' });
    expect(result.score).toBe(50); // -35 no H1, -15 one skip
    expect(result.details.skippedLevels).toHaveLength(1);
  });

  test('penalizes multiple H1s', () => {
    expect(check(headingHierarchy, { body: '<h1>A</h1><h1>B</h1>' }).score).toBe(80);
  });
});

describe('readability', () => {
  test('counts syllables reasonably', () => {
    expect(countSyllables('cat')).toBe(1);
    expect(countSyllables('dentist')).toBe(2);
    expect(countSyllables('appointment')).toBe(3);
  });

  test('scores plain prose higher than dense prose', () => {
    const plain = 'We fix teeth. It does not hurt. You can book online. The visit takes one hour. We open at nine. '.repeat(6);
    const dense = 'Comprehensive orthodontic interventions necessitate multidisciplinary collaboration, encompassing periodontal evaluation, radiographic visualization, and individualized therapeutic considerations. '.repeat(4);
    expect(fleschReadingEase(plain).score).toBeGreaterThan(80);
    expect(fleschReadingEase(dense).score).toBeLessThan(10);
  });

  test('is skipped for non-English pages and thin pages', () => {
    expect(check(readability, { rawHtml: '<html lang="pa"><body><p>ਸਤ ਸ੍ਰੀ ਅਕਾਲ</p></body></html>' }).skipped).toBe(true);
    expect(check(readability, { body: '<p>Too short.</p>' }).skipped).toBe(true);
  });
});

describe('answer-formats', () => {
  test('rewards lists, tables and FAQ sections', () => {
    const body = '<main><ul><li>a</li><li>b</li></ul><table><tr><th>x</th></tr><tr><td>1</td></tr></table><h2>FAQs</h2></main>';
    expect(check(answerFormats, { body })).toMatchObject({ status: 'pass', score: 100 });
    expect(check(answerFormats, { body: '<main><p>Just text.</p></main>' }).score).toBe(0);
  });
});

describe('content-freshness', () => {
  test('uses the newest date signal', () => {
    const recent = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const result = check(contentFreshness, { head: `<meta property="article:modified_time" content="${recent}">` });
    expect(result).toMatchObject({ status: 'pass', score: 100 });
  });

  test('flags old content and missing dates', () => {
    expect(check(contentFreshness, { head: '<meta property="article:modified_time" content="2019-01-01">' }).score).toBe(15);
    expect(check(contentFreshness).status).toBe('warn');
  });
});
