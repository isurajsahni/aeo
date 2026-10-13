/**
 * Shared helpers for check modules.
 *
 * A check module default-exports defineCheck({ id, category, title, impact, effort, run }).
 * `run(ctx)` is a pure function of the audit context and returns:
 *   { score: 0-100, status?: 'pass'|'warn'|'fail', details?, recommendation?, impact?, effort? }
 * or skip(reason) when the check doesn't apply. The runner adds the weight from
 * config/scoring.json and normalizes the output.
 */

const IMPACTS = new Set(['high', 'medium', 'low']);

export function defineCheck(definition) {
  const { id, category, title, run } = definition;
  if (!id || !category || !title || typeof run !== 'function') {
    throw new Error(`Invalid check definition: ${id ?? JSON.stringify(definition)}`);
  }
  if (!IMPACTS.has(definition.impact) || !IMPACTS.has(definition.effort)) {
    throw new Error(`Check ${id} must declare impact and effort as high|medium|low`);
  }
  return Object.freeze(definition);
}

/** Map a 0-100 score to a status. Thresholds can be tuned per check. */
export const statusFromScore = (score, { pass = 80, warn = 50 } = {}) => (score >= pass ? 'pass' : score >= warn ? 'warn' : 'fail');

/** Result for a check that doesn't apply to this page; excluded from scoring. */
export const skip = (reason) => ({ skipped: true, status: 'warn', score: 0, details: { summary: reason }, recommendation: '' });

export const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

export const clampScore = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export const daysSince = (isoOrTime) => (Date.now() - new Date(isoOrTime).getTime()) / 86_400_000;

export const plural = (n, word, pluralWord = `${word}s`) => `${n} ${n === 1 ? word : pluralWord}`;
