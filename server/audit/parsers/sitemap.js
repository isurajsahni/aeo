import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, trimValues: true, processEntities: false });
const asArray = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);

/**
 * Parse sitemap XML (urlset or sitemapindex).
 * @returns {{ type: 'urlset'|'index', entries: { loc: string, lastmod: string|null }[] }}
 */
export function parseSitemap(xml) {
  if (!xml || !/<(urlset|sitemapindex)[\s>]/i.test(xml)) {
    throw new Error('Not a valid sitemap: expected a <urlset> or <sitemapindex> root element');
  }
  const doc = parser.parse(xml);

  if (doc.sitemapindex) {
    return { type: 'index', entries: asArray(doc.sitemapindex.sitemap).map(toEntry).filter((e) => e.loc) };
  }
  return { type: 'urlset', entries: asArray(doc.urlset?.url).map(toEntry).filter((e) => e.loc) };
}

const toEntry = (node) => ({ loc: String(node?.loc ?? '').trim(), lastmod: node?.lastmod ? String(node.lastmod).trim() : null });

/** Summarize entries for the sitemap check. */
export function summarizeSitemapEntries(entries) {
  const dates = entries
    .map((e) => (e.lastmod ? Date.parse(e.lastmod) : NaN))
    .filter((t) => Number.isFinite(t) && t <= Date.now() + 86_400_000);
  return {
    urlCount: entries.length,
    lastmodCoverage: entries.length ? dates.length / entries.length : 0,
    newestLastmod: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
  };
}
