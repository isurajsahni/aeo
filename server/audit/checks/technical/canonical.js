import { defineCheck } from '../helpers.js';

/** Compare URLs ignoring protocol/host case, "www.", trailing slash, fragment and tracking params. */
export function normalizeForCompare(href, base) {
  try {
    const url = new URL(href, base);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|gclid|fbclid)/i.test(key)) url.searchParams.delete(key);
    return `${url.hostname.replace(/^www\./, '').toLowerCase()}${url.pathname.replace(/\/+$/, '') || '/'}${url.search}`;
  } catch {
    return null;
  }
}

export default defineCheck({
  id: 'canonical',
  category: 'technical',
  title: 'Canonical URL',
  impact: 'medium',
  effort: 'low',

  run({ page, finalUrl }) {
    const { canonicals } = page;
    if (!canonicals.length) {
      return {
        score: 40,
        status: 'warn',
        details: { summary: 'No canonical link. Duplicate URL variants (tracking parameters, www vs non-www) may split signals.' },
        recommendation: 'Add <link rel="canonical" href="..."> with the absolute, preferred URL of this page.',
      };
    }
    if (new Set(canonicals).size > 1) {
      return {
        score: 30,
        status: 'fail',
        details: { summary: `${canonicals.length} different canonical tags found; crawlers may ignore all of them.`, canonicals },
        recommendation: 'Keep exactly one canonical tag per page.',
      };
    }

    const canonical = new URL(canonicals[0], finalUrl).href;
    const isSelf = normalizeForCompare(canonical, finalUrl) === normalizeForCompare(finalUrl, finalUrl);
    const isAbsolute = /^https?:\/\//i.test(canonicals[0]);

    if (!isSelf) {
      return {
        score: 50,
        status: 'warn',
        details: { summary: `The canonical points to a different URL (${canonical}), so this page is marked as a duplicate and may not be cited itself.`, canonical, pageUrl: finalUrl },
        recommendation: 'If this page should be cited in its own right, make its canonical point to itself.',
      };
    }
    return {
      score: isAbsolute ? 100 : 85,
      status: 'pass',
      details: { summary: `Self-referencing canonical${isAbsolute ? '' : ' (relative URL; absolute is safer)'}.`, canonical },
      recommendation: isAbsolute ? '' : 'Use an absolute URL in the canonical tag.',
    };
  },
});
