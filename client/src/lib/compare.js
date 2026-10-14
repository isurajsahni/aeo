/**
 * Compare two audits of the same project: `base` (older) vs `next` (newer).
 * Pure function; returns score deltas and per-check changes, regressions first.
 */
const RANK = { fail: 0, warn: 1, pass: 2 };

const changeOf = (a, b) => {
  if (!a || a.skipped) return b && !b.skipped ? 'new' : 'unchanged';
  if (!b || b.skipped) return 'removed';
  if (RANK[b.status] !== RANK[a.status]) return RANK[b.status] > RANK[a.status] ? 'improved' : 'regressed';
  if (Math.abs(b.score - a.score) >= 5) return b.score > a.score ? 'improved' : 'regressed';
  return 'unchanged';
};

const ORDER = { regressed: 0, improved: 1, new: 2, removed: 3, unchanged: 4 };

export function compareAudits(base, next) {
  const delta = (a, b) => (a == null || b == null ? null : b - a);
  const baseCats = Object.fromEntries((base.scores?.categories ?? []).map((c) => [c.id, c]));

  const categories = (next.scores?.categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    before: baseCats[c.id]?.score ?? null,
    after: c.score,
    delta: delta(baseCats[c.id]?.score, c.score),
  }));

  const baseChecks = Object.fromEntries((base.checks ?? []).map((c) => [c.id, c]));
  const nextChecks = Object.fromEntries((next.checks ?? []).map((c) => [c.id, c]));
  const ids = [...new Set([...Object.keys(nextChecks), ...Object.keys(baseChecks)])];

  const checks = ids
    .map((id) => {
      const a = baseChecks[id];
      const b = nextChecks[id];
      return { id, title: (b ?? a).title, category: (b ?? a).category, before: a ?? null, after: b ?? null, change: changeOf(a, b), delta: delta(a?.skipped ? null : a?.score, b?.skipped ? null : b?.score) };
    })
    .sort((x, y) => ORDER[x.change] - ORDER[y.change] || Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0));

  const count = (change) => checks.filter((c) => c.change === change).length;
  return {
    overall: { before: base.scores?.overall ?? null, after: next.scores?.overall ?? null, delta: delta(base.scores?.overall, next.scores?.overall) },
    grade: { before: base.scores?.grade ?? null, after: next.scores?.grade ?? null },
    categories,
    checks,
    counts: { improved: count('improved'), regressed: count('regressed'), unchanged: count('unchanged') },
  };
}
