import { defineCheck } from '../helpers.js';

const parseDirectives = (value = '') =>
  value
    .toLowerCase()
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

export default defineCheck({
  id: 'indexability',
  category: 'crawlerAccess',
  title: 'Page is indexable and quotable',
  impact: 'high',
  effort: 'low',

  run({ page, response }) {
    const headerValue = response.headers['x-robots-tag'];
    const directives = [
      ...page.robotsMeta.flatMap((m) => parseDirectives(m.content).map((d) => ({ source: `<meta name="${m.name}">`, directive: d }))),
      ...parseDirectives(Array.isArray(headerValue) ? headerValue.join(',') : headerValue).map((d) => ({ source: 'X-Robots-Tag header', directive: d })),
    ];

    const has = (re) => directives.filter((d) => re.test(d.directive));
    const noindex = has(/^(noindex|none)$/);
    const nosnippet = has(/^(nosnippet|max-snippet:\s*0)$/);

    if (noindex.length) {
      return {
        score: 0,
        details: { summary: `The page tells crawlers not to index it (${noindex.map((d) => `${d.directive} via ${d.source}`).join('; ')}). AI search engines will not cite it.`, directives },
        recommendation: 'Remove the noindex directive if this page should appear in AI answers and search.',
      };
    }
    if (nosnippet.length) {
      return {
        score: 30,
        details: { summary: `Snippets are disabled (${nosnippet.map((d) => d.directive).join(', ')}). AI engines may refuse to quote this page.`, directives },
        recommendation: 'Remove nosnippet / max-snippet:0 so answer engines can quote your content.',
      };
    }
    return {
      score: page.noSnippetElements > 0 ? 90 : 100,
      details: {
        summary: page.noSnippetElements
          ? `Indexable. ${page.noSnippetElements} element(s) use data-nosnippet and won't be quoted.`
          : 'No noindex or nosnippet directives found.',
        directives,
      },
      recommendation: '',
    };
  },
});
