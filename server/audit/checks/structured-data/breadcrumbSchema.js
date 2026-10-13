import { defineCheck, skip } from '../helpers.js';
import { validateNode } from './schemaRules.js';

export default defineCheck({
  id: 'breadcrumb-schema',
  category: 'structuredData',
  title: 'BreadcrumbList schema',
  impact: 'low',
  effort: 'low',

  run({ page, isHomepage }) {
    const breadcrumb = page.jsonLd.nodes.find((n) => n.types.includes('BreadcrumbList'));
    if (!breadcrumb) {
      if (isHomepage) return skip('Breadcrumbs are not needed on the homepage.');
      return {
        score: 0,
        details: { summary: 'No BreadcrumbList schema. Breadcrumbs help AI engines understand where this page sits in your site.' },
        recommendation: 'Add BreadcrumbList JSON-LD matching the visible breadcrumb trail (Home > Section > Page).',
      };
    }
    const result = validateNode(breadcrumb);
    const items = [breadcrumb.data.itemListElement].flat().filter(Boolean).length;
    return {
      score: result.issues.length || result.missingRequired.length ? 50 : 100,
      details: { summary: result.issues.length ? `BreadcrumbList found with problems: ${result.issues.join('; ')}.` : `Valid BreadcrumbList with ${items} items.`, items },
      recommendation: result.issues.length ? 'Give every breadcrumb item a position, name and item URL.' : '',
    };
  },
});
