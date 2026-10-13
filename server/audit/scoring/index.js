import { scoringConfig } from '../../config/scoring.js';

const IMPACT_VALUE = { high: 3, medium: 2, low: 1 };
const EFFORT_VALUE = { low: 1, medium: 2, high: 3 };

export function gradeFor(score, grades = scoringConfig.grades) {
  if (score == null) return null;
  return [...grades].sort((a, b) => b.min - a.min).find((g) => score >= g.min)?.grade ?? 'F';
}

const weightedAverage = (items, valueKey, weightKey) => {
  const usable = items.filter((i) => i[valueKey] != null && i[weightKey] > 0);
  const totalWeight = usable.reduce((sum, i) => sum + i[weightKey], 0);
  if (!totalWeight) return null;
  return Math.round(usable.reduce((sum, i) => sum + i[valueKey] * i[weightKey], 0) / totalWeight);
};

/**
 * Per-category scores: weighted average of the category's non-skipped checks.
 * Categories with no scoreable checks get score null and don't affect the overall score.
 */
export function scoreCategories(results, config = scoringConfig) {
  return Object.entries(config.categories)
    .map(([id, category]) => {
      const inCategory = results.filter((r) => r.category === id);
      const scored = inCategory.filter((r) => !r.skipped);
      const score = weightedAverage(scored, 'score', 'weight');
      return {
        id,
        name: category.name,
        weight: category.weight,
        score,
        grade: gradeFor(score, config.grades),
        counts: {
          pass: scored.filter((r) => r.status === 'pass').length,
          warn: scored.filter((r) => r.status === 'warn').length,
          fail: scored.filter((r) => r.status === 'fail').length,
          skipped: inCategory.length - scored.length,
        },
      };
    })
    .filter((c) => c.counts.pass + c.counts.warn + c.counts.fail + c.counts.skipped > 0);
}

/** How a fix should be framed, from its impact and effort. */
export function fixBucket(impact, effort) {
  if (impact !== 'low' && effort === 'low') return 'quick-win';
  if (impact === 'high') return 'major-project';
  if (effort === 'high') return 'deprioritize';
  return 'fill-in';
}

/**
 * Prioritized fix list. Ranked by impact ÷ effort first; within that, by how far the
 * check is from passing and how much it weighs in the score.
 */
export function prioritizeFixes(results, { limit = 25 } = {}) {
  const maxWeight = Math.max(1, ...results.map((r) => r.weight));
  return results
    .filter((r) => !r.skipped && r.status !== 'pass' && r.recommendation && r.weight > 0)
    .map((r) => {
      const ratio = IMPACT_VALUE[r.impact] / EFFORT_VALUE[r.effort];
      const gap = (100 - r.score) / 100;
      const priority = Math.round((ratio * 10 + gap * 3 + (r.weight / maxWeight) * 2) * 100) / 100;
      return {
        checkId: r.id,
        title: r.title,
        category: r.category,
        status: r.status,
        score: r.score,
        impact: r.impact,
        effort: r.effort,
        bucket: fixBucket(r.impact, r.effort),
        recommendation: r.recommendation,
        priority,
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

const VERDICTS = {
  A: 'It is well prepared to be found, understood and cited by AI assistants.',
  B: 'It is in good shape for AI assistants, with a few gaps holding it back.',
  C: 'AI assistants can use it, but several gaps limit how often it gets cited.',
  D: 'Significant gaps make it hard for AI assistants to understand and cite it.',
  F: 'Major issues are likely keeping it out of AI-generated answers.',
};

/** A short plain-English summary for the report header. */
export function buildSummary({ label, overall, grade, categories, fixes }) {
  const scored = categories.filter((c) => c.score != null);
  const parts = [`${label} scores ${overall}/100 (grade ${grade}). ${VERDICTS[grade] ?? ''}`.trim()];

  if (scored.length > 1) {
    const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
    const worst = scored.reduce((a, b) => (b.score < a.score ? b : a));
    if (best.id !== worst.id) parts.push(`Strongest area: ${best.name} (${best.score}). Weakest: ${worst.name} (${worst.score}).`);
  }

  const quickWins = fixes.filter((f) => f.bucket === 'quick-win').length;
  if (fixes.length) {
    parts.push(`Top priority: ${fixes[0].title.charAt(0).toLowerCase()}${fixes[0].title.slice(1)}.${quickWins ? ` ${quickWins} quick win${quickWins === 1 ? '' : 's'} (high value, low effort) ${quickWins === 1 ? 'is' : 'are'} ready to tackle.` : ''}`);
  } else {
    parts.push('No outstanding fixes. Keep content fresh and re-audit regularly.');
  }
  return parts.join(' ');
}

/** Full scoring for a set of check results. */
export function scoreAudit(results, { label = 'This page', config = scoringConfig } = {}) {
  const categories = scoreCategories(results, config);
  const overall = weightedAverage(categories, 'score', 'weight') ?? 0;
  const grade = gradeFor(overall, config.grades);
  const fixes = prioritizeFixes(results);
  return { overall, grade, categories, fixes, summary: buildSummary({ label, overall, grade, categories, fixes }) };
}
