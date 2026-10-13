/**
 * Extract JSON-LD from a cheerio document.
 * Flattens arrays and @graph containers and also collects typed objects nested
 * inside other nodes (e.g. an Article's author Person or publisher Organization).
 */
export function extractJsonLd($) {
  const nodes = [];
  const errors = [];
  let blocks = 0;

  $('script').each((index, el) => {
    const type = ($(el).attr('type') ?? '').toLowerCase().trim();
    if (type !== 'application/ld+json') return;
    blocks += 1;

    const raw = ($(el).html() ?? '').trim();
    if (!raw) {
      errors.push({ block: index, message: 'Empty JSON-LD block' });
      return;
    }
    try {
      collect(JSON.parse(stripJsonComments(raw)), nodes, false);
    } catch (err) {
      errors.push({ block: index, message: err.message });
    }
  });

  return { blocks, nodes, errors, types: [...new Set(nodes.flatMap((n) => n.types))] };
}

// Some CMSs wrap JSON-LD in HTML comments or CDATA.
const stripJsonComments = (raw) => raw.replace(/^<!--|-->$/g, '').replace(/^\/\*<!\[CDATA\[\*\/|\/\*\]\]>\*\/$/g, '').trim();

/** "http://schema.org/Article" | "schema:Article" | "Article" -> "Article" */
export const normalizeType = (type) => String(type).replace(/^https?:\/\/schema\.org\//i, '').replace(/^schema:/i, '').trim();

function collect(value, nodes, nested, depth = 0) {
  if (depth > 12 || value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collect(item, nodes, nested, depth + 1);
    return;
  }

  if (Array.isArray(value['@graph'])) {
    for (const item of value['@graph']) collect(item, nodes, false, depth + 1);
  }

  const rawType = value['@type'];
  if (rawType) {
    const types = (Array.isArray(rawType) ? rawType : [rawType]).map(normalizeType);
    nodes.push({ types, data: value, nested });
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === '@graph' || key.startsWith('@')) continue;
    if (child && typeof child === 'object') collect(child, nodes, true, depth + 1);
  }
}
