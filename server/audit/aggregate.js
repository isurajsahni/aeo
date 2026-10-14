import { checksById } from './checks/index.js';
import { statusFromScore } from './checks/helpers.js';
import { displayPath } from './crawler/urls.js';

const WORST_PAGES_SHOWN = 8;

/**
 * Combine per-page check results from a site crawl into one result per check.
 *
 * - Site-scope checks (llms.txt, sitemap, HTTPS, Core Web Vitals) come from the start page.
 * - Page-scope checks are averaged over the pages where they applied; a check is only
 *   "pass" if every page passes, and the details list the worst pages.
 *
 * @param pages [{ url, results }] with the start page first
 */
export function aggregateResults(pages) {
  if (!pages.length) return [];
  const [start] = pages;

  return start.results.map((base) => {
    if (checksById.get(base.id)?.scope === 'site') return base;

    const applicable = pages
      .map((page) => ({ url: page.url, result: page.results.find((r) => r.id === base.id) }))
      .filter((entry) => entry.result && !entry.result.skipped);

    if (!applicable.length) return base; // skipped everywhere

    const score = Math.round(applicable.reduce((sum, e) => sum + e.result.score, 0) / applicable.length);
    const count = (status) => applicable.filter((e) => e.result.status === status).length;
    const passing = count('pass');
    const allPass = passing === applicable.length;
    const worst = [...applicable].sort((a, b) => a.result.score - b.result.score).filter((e) => e.result.status !== 'pass');
    const scoreStatus = statusFromScore(score);

    return {
      ...base,
      score,
      // A site-wide average can look fine while some pages fail; never call that a pass.
      status: allPass ? 'pass' : scoreStatus === 'pass' ? 'warn' : scoreStatus,
      details: {
        summary: allPass
          ? `Passes on all ${applicable.length} pages.`
          : `Passes on ${passing} of ${applicable.length} pages. Worst: ${displayPath(worst[0].url)} (${worst[0].result.details.summary ?? `score ${worst[0].result.score}`})`,
        pagesChecked: applicable.length,
        pagesPassing: passing,
        pagesWarning: count('warn'),
        pagesFailing: count('fail'),
        worstPages: worst.slice(0, WORST_PAGES_SHOWN).map((e) => ({ page: displayPath(e.url), score: e.result.score, finding: e.result.details.summary ?? '' })),
      },
      recommendation: allPass ? '' : worst.find((e) => e.result.recommendation)?.result.recommendation ?? base.recommendation,
      skipped: false,
    };
  });
}
