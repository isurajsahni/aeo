import { scoringConfig } from '../config/scoring.js';
import { checks as allChecks } from './checks/index.js';
import { clampScore, statusFromScore } from './checks/helpers.js';

/**
 * Run one check against a context and normalize its output to the standard result shape:
 * { id, category, title, status, score, weight, details, recommendation, impact, effort, skipped }
 * A check that throws is reported as skipped instead of failing the whole audit.
 */
export function runCheck(check, ctx, weights = scoringConfig.checks) {
  let output;
  try {
    output = check.run(ctx) ?? {};
  } catch (err) {
    output = { skipped: true, score: 0, status: 'warn', details: { summary: `This check could not run: ${err.message}` }, recommendation: '' };
  }

  const score = clampScore(output.score);
  return {
    id: check.id,
    category: check.category,
    title: check.title,
    status: output.status ?? statusFromScore(score),
    score,
    weight: weights[check.id] ?? 1,
    details: output.details ?? {},
    recommendation: output.recommendation ?? '',
    impact: output.impact ?? check.impact,
    effort: output.effort ?? check.effort,
    skipped: Boolean(output.skipped),
  };
}

export function runChecks(ctx, { checks = allChecks, weights = scoringConfig.checks } = {}) {
  return checks.map((check) => runCheck(check, ctx, weights));
}
