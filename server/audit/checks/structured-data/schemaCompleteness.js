import { defineCheck, skip, statusFromScore } from '../helpers.js';
import { validateNode } from './schemaRules.js';

export default defineCheck({
  id: 'schema-completeness',
  category: 'structuredData',
  title: 'Schema required fields present',
  impact: 'medium',
  effort: 'low',

  run({ page }) {
    const results = page.jsonLd.nodes.map(validateNode).filter(Boolean);
    if (!results.length) return skip('No supported schema types to validate (Organization, LocalBusiness, Article, FAQPage, HowTo, Product, BreadcrumbList, Person).');

    // Top-level nodes carry the page's meaning; nested ones (e.g. an author Person) count half.
    const weighted = results.reduce((acc, r) => ({ total: acc.total + r.score * (r.nested ? 0.5 : 1), weight: acc.weight + (r.nested ? 0.5 : 1) }), { total: 0, weight: 0 });
    const score = Math.round(weighted.total / weighted.weight);
    const problems = results.filter((r) => r.missingRequired.length || r.issues.length);

    // Missing required fields can invalidate a schema object entirely, so never call that a pass.
    const status = statusFromScore(score, { pass: 85, warn: 55 });
    return {
      score,
      status: problems.length && status === 'pass' ? 'warn' : status,
      details: {
        summary: problems.length
          ? `${problems.length} of ${results.length} schema object(s) are missing required fields or have errors.`
          : `All ${results.length} schema object(s) have their required fields.`,
        objects: results.map((r) => ({
          type: r.type,
          score: r.score,
          missingRequired: r.missingRequired.join(', ') || '—',
          missingRecommended: r.missingRecommended.join(', ') || '—',
          issues: r.issues.join('; ') || '—',
        })),
      },
      recommendation: problems.length
        ? `Fix: ${problems.map((p) => `${p.type} (${[...p.missingRequired.map((f) => `add ${f}`), ...p.issues].join(', ')})`).join('; ')}.`
        : score < 85
          ? 'Add the recommended fields listed above to give AI engines more context.'
          : '',
    };
  },
});
