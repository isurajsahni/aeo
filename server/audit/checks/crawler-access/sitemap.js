import { daysSince, defineCheck, statusFromScore } from '../helpers.js';

export default defineCheck({
  id: 'sitemap',
  category: 'crawlerAccess',
  scope: 'site', // evaluated once per site (from the start page), not per page
  title: 'XML sitemap with fresh lastmod dates',
  impact: 'medium',
  effort: 'low',

  run({ sitemap }) {
    if (!sitemap.found) {
      return {
        score: 0,
        details: { summary: 'No XML sitemap found in robots.txt or at /sitemap.xml.', tried: sitemap.tried ?? [] },
        recommendation: 'Publish an XML sitemap with <lastmod> dates and reference it in robots.txt with a "Sitemap:" line.',
      };
    }
    if (sitemap.parseError) {
      return {
        score: 20,
        details: { summary: `A sitemap exists at ${sitemap.url} but could not be parsed: ${sitemap.parseError}`, url: sitemap.url },
        recommendation: 'Fix the sitemap XML so it validates against the sitemaps.org schema.',
      };
    }

    const ageDays = sitemap.newestLastmod ? Math.round(daysSince(sitemap.newestLastmod)) : null;
    const freshness = ageDays == null ? 0 : ageDays <= 90 ? 20 : ageDays <= 365 ? 10 : 0;
    const coverage = sitemap.lastmodCoverage >= 0.8 ? 15 : sitemap.lastmodCoverage > 0 ? 7 : 0;
    const score = 50 + (sitemap.fromRobots ? 15 : 0) + freshness + coverage;

    const issues = [
      !sitemap.fromRobots && 'it is not referenced in robots.txt',
      ageDays == null && 'no <lastmod> dates',
      ageDays != null && ageDays > 90 && `the newest <lastmod> is ${ageDays} days old`,
      sitemap.lastmodCoverage > 0 && sitemap.lastmodCoverage < 0.8 && `only ${Math.round(sitemap.lastmodCoverage * 100)}% of URLs have <lastmod>`,
    ].filter(Boolean);

    return {
      score,
      status: statusFromScore(score, { pass: 80, warn: 50 }),
      details: {
        summary: `Found ${sitemap.type === 'index' ? `a sitemap index with ${sitemap.childCount} sitemaps` : `a sitemap with ${sitemap.urlCount} URLs`}${issues.length ? `, but ${issues.join('; ')}` : ' with fresh lastmod dates'}.`,
        url: sitemap.url,
        type: sitemap.type,
        urlCount: sitemap.urlCount,
        newestLastmod: sitemap.newestLastmod,
        lastmodCoveragePercent: Math.round((sitemap.lastmodCoverage ?? 0) * 100),
        referencedInRobots: sitemap.fromRobots,
        includesAuditedUrl: sitemap.includesAuditedUrl,
      },
      recommendation: issues.length ? `Improve the sitemap: ${issues.map((i) => i.replace(/^it is not/, 'reference it')).join('; ')}. Keep <lastmod> accurate (only change it when content changes).` : '',
    };
  },
});
