import { checks } from '../audit/checks/index.js';
import { defineCheck } from '../audit/checks/helpers.js';
import { runCheck, runChecks } from '../audit/runChecks.js';
import { fixBucket, gradeFor, prioritizeFixes, scoreAudit, scoreCategories } from '../audit/scoring/index.js';
import { scoringConfig } from '../config/scoring.js';
import { makeContext } from './helpers/context.js';

const result = (overrides) => ({
  id: 'x',
  category: 'technical',
  title: 'X',
  status: 'pass',
  score: 100,
  weight: 1,
  details: {},
  recommendation: '',
  impact: 'medium',
  effort: 'medium',
  skipped: false,
  ...overrides,
});

const config = {
  categories: { a: { name: 'A', weight: 3 }, b: { name: 'B', weight: 1 }, empty: { name: 'Empty', weight: 5 } },
  grades: scoringConfig.grades,
};

describe('grades', () => {
  test.each([
    [95, 'A'],
    [90, 'A'],
    [89, 'B'],
    [70, 'C'],
    [60, 'D'],
    [12, 'F'],
    [null, null],
  ])('%p -> %p', (score, grade) => expect(gradeFor(score)).toBe(grade));
});

describe('category scoring', () => {
  test('uses check weights and ignores skipped checks', () => {
    const categories = scoreCategories(
      [
        result({ id: '1', category: 'a', score: 100, weight: 3 }),
        result({ id: '2', category: 'a', score: 0, weight: 1, status: 'fail' }),
        result({ id: '3', category: 'a', score: 0, weight: 10, skipped: true }),
      ],
      config,
    );
    expect(categories).toHaveLength(1); // categories without checks are dropped
    expect(categories[0]).toMatchObject({ id: 'a', score: 75, grade: 'C', counts: { pass: 1, warn: 0, fail: 1, skipped: 1 } });
  });

  test('a category whose checks are all skipped has no score', () => {
    const [category] = scoreCategories([result({ category: 'a', skipped: true })], config);
    expect(category.score).toBeNull();
  });
});

describe('overall score', () => {
  test('is the category-weighted average of scored categories', () => {
    const { overall, grade } = scoreAudit([result({ category: 'a', score: 80 }), result({ category: 'b', score: 40 })], { config });
    // (80*3 + 40*1) / 4 = 70
    expect(overall).toBe(70);
    expect(grade).toBe('C');
  });

  test('changing weights in config changes the score without code changes', () => {
    const results = [result({ category: 'a', score: 80 }), result({ category: 'b', score: 40 })];
    const reweighted = { ...config, categories: { ...config.categories, a: { name: 'A', weight: 1 } } };
    expect(scoreAudit(results, { config: reweighted }).overall).toBe(60);
  });

  test('produces a plain-English summary', () => {
    const { summary } = scoreAudit(
      [result({ category: 'a', score: 90 }), result({ id: 'fixme', title: 'Meta title', category: 'b', score: 20, status: 'fail', recommendation: 'Fix it', impact: 'high', effort: 'low' })],
      { label: 'example.com', config },
    );
    expect(summary).toMatch(/^example\.com scores 73\/100 \(grade C\)\./);
    expect(summary).toMatch(/Strongest area: A \(90\)\. Weakest: B \(20\)\./);
    expect(summary).toMatch(/Top priority: meta title\. 1 quick win/);
  });
});

describe('fix prioritization', () => {
  test('ranks by impact vs effort, excluding passes, skips and checks with no recommendation', () => {
    const fixes = prioritizeFixes([
      result({ id: 'hard', impact: 'high', effort: 'high', status: 'fail', score: 0, recommendation: 'r' }),
      result({ id: 'quick', impact: 'high', effort: 'low', status: 'warn', score: 60, recommendation: 'r' }),
      result({ id: 'minor', impact: 'low', effort: 'low', status: 'fail', score: 0, recommendation: 'r' }),
      result({ id: 'passing', status: 'pass', recommendation: 'r' }),
      result({ id: 'skipped', status: 'warn', skipped: true, recommendation: 'r' }),
      result({ id: 'silent', status: 'fail', recommendation: '' }),
    ]);
    expect(fixes.map((f) => f.checkId)).toEqual(['quick', 'hard', 'minor']);
    expect(fixes[0].bucket).toBe('quick-win');
  });

  test('buckets', () => {
    expect(fixBucket('high', 'low')).toBe('quick-win');
    expect(fixBucket('high', 'high')).toBe('major-project');
    expect(fixBucket('low', 'high')).toBe('deprioritize');
    expect(fixBucket('low', 'low')).toBe('fill-in');
  });
});

describe('check runner', () => {
  test('every registered check returns the standard result shape for a real-looking page', () => {
    const ctx = makeContext({ body: '<main><h1>Hi</h1><h2>What is it?</h2><p>A short answer of a few words here.</p></main>' });
    const results = runChecks(ctx);
    expect(results).toHaveLength(checks.length);
    expect(new Set(results.map((r) => r.id)).size).toBe(checks.length);
    for (const r of results) {
      expect(r).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          category: expect.stringMatching(/^(crawlerAccess|structuredData|content|trust|technical)$/),
          status: expect.stringMatching(/^(pass|warn|fail)$/),
          score: expect.any(Number),
          weight: expect.any(Number),
          impact: expect.stringMatching(/^(high|medium|low)$/),
          effort: expect.stringMatching(/^(high|medium|low)$/),
        }),
      );
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  test('every check has a weight in scoring.json', () => {
    const missing = checks.filter((c) => scoringConfig.checks[c.id] == null).map((c) => c.id);
    expect(missing).toEqual([]);
  });

  test('a check that throws is reported as skipped instead of crashing the audit', () => {
    const broken = defineCheck({ id: 'broken', category: 'technical', title: 'Broken', impact: 'low', effort: 'low', run: () => { throw new Error('boom'); } });
    const r = runCheck(broken, makeContext());
    expect(r).toMatchObject({ skipped: true, status: 'warn' });
    expect(r.details.summary).toMatch(/boom/);
  });
});
