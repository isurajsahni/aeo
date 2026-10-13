import { daysSince, defineCheck } from '../helpers.js';

/** Collect every date signal: schema, meta tags, <time>, and a believable Last-Modified header. */
export function collectDates({ page, response, fetchedAt }) {
  const dates = [...page.dates];
  for (const node of page.jsonLd.nodes) {
    for (const field of ['dateModified', 'datePublished', 'uploadDate']) {
      const value = node.data[field];
      if (typeof value === 'string' && Number.isFinite(Date.parse(value))) dates.push({ source: `${node.types[0]}.${field}`, value, time: Date.parse(value) });
    }
  }
  // Dynamic pages often send Last-Modified = now, which says nothing about the content.
  const lastModified = Date.parse(response.headers['last-modified'] ?? '');
  if (Number.isFinite(lastModified) && Math.abs(Date.parse(fetchedAt) - lastModified) > 3_600_000) {
    dates.push({ source: 'Last-Modified header', value: response.headers['last-modified'], time: lastModified });
  }
  return dates.filter((d) => d.time <= Date.now() + 86_400_000);
}

export default defineCheck({
  id: 'content-freshness',
  category: 'content',
  title: 'Content freshness signals',
  impact: 'medium',
  effort: 'low',

  run(ctx) {
    const dates = collectDates(ctx);
    if (!dates.length) {
      return {
        score: 30,
        status: 'warn',
        details: { summary: 'No publish or update dates found. AI engines prefer content they can tell is current.' },
        recommendation: 'Show a visible "Last updated" date and add dateModified to your schema (and article:modified_time for articles).',
      };
    }

    const newest = dates.reduce((a, b) => (b.time > a.time ? b : a));
    const age = Math.round(daysSince(newest.time));
    let score = age <= 180 ? 100 : age <= 365 ? 75 : age <= 730 ? 40 : 15;
    // A Last-Modified header alone is weak evidence: it often reflects a deploy, not a content update.
    const headerOnly = dates.every((d) => d.source === 'Last-Modified header');
    if (headerOnly) score = Math.min(score, 75);

    return {
      score,
      status: headerOnly ? 'warn' : score >= 75 ? 'pass' : score >= 40 ? 'warn' : 'fail',
      details: {
        summary: `Most recent date signal is ${age} day(s) old (${newest.source}: ${newest.value}).${headerOnly ? ' The only signal is the Last-Modified header, which often reflects a deploy rather than a content update.' : ''}`,
        newestDate: new Date(newest.time).toISOString(),
        ageDays: age,
        signals: dates.slice(0, 10).map((d) => ({ source: d.source, value: d.value })),
      },
      recommendation: headerOnly
        ? 'Add a visible "Last updated" date and dateModified in your schema so freshness is explicit, not inferred from server headers.'
        : score >= 75 ? '' : 'Review and refresh this content, then update its dateModified. Stale pages are cited less for time-sensitive questions.',
    };
  },
});
