import { defineCheck, statusFromScore } from '../helpers.js';
import { validateNode } from './schemaRules.js';

/**
 * Organization / LocalBusiness schema is how AI engines connect a website to a real-world entity.
 * sameAs links (LinkedIn, Wikipedia, Google Business Profile...) strengthen that entity match.
 */
export default defineCheck({
  id: 'organization-schema',
  category: 'structuredData',
  title: 'Organization or LocalBusiness schema',
  impact: 'high',
  effort: 'low',

  run({ page }) {
    const candidates = page.jsonLd.nodes
      .map((node) => ({ node, result: validateNode(node) }))
      .filter(({ result }) => result && (result.ruleKey === 'Organization' || result.ruleKey === 'LocalBusiness'))
      // Prefer top-level nodes and LocalBusiness (more specific) when several exist.
      .sort((a, b) => Number(a.result.nested) - Number(b.result.nested) || b.result.score - a.result.score);

    if (!candidates.length) {
      return {
        score: 0,
        details: { summary: 'No Organization or LocalBusiness schema found, so AI engines have to guess who is behind this site.' },
        recommendation:
          'Add Organization JSON-LD (or a LocalBusiness subtype such as Dentist or Restaurant for local businesses) with name, url, logo, description, contact details and sameAs links to your official profiles.',
      };
    }

    const { node, result } = candidates[0];
    const sameAs = [node.data.sameAs].flat().filter(Boolean);
    const score = Math.min(100, result.score + (sameAs.length >= 2 ? 10 : 0));
    const missing = [...result.missingRequired, ...result.missingRecommended];

    return {
      score,
      status: statusFromScore(score),
      details: {
        summary: `${result.type} schema found${missing.length ? `, missing: ${missing.join(', ')}` : ' with all key fields'}.`,
        type: result.type,
        name: node.data.name ?? null,
        missingRequired: result.missingRequired,
        missingRecommended: result.missingRecommended,
        sameAs,
        issues: result.issues,
      },
      recommendation: missing.length || sameAs.length < 2
        ? `Complete your ${result.type} schema: ${[...missing, sameAs.length < 2 && 'at least 2 sameAs profile links'].filter(Boolean).join(', ')}.`
        : '',
    };
  },
});
