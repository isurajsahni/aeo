import { defineCheck, percent, skip, statusFromScore } from '../helpers.js';

const norm = (t) => t.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Most AI crawlers (GPTBot, ClaudeBot, PerplexityBot...) do not execute JavaScript.
 * Content that only appears after JS runs is invisible to them.
 */
export default defineCheck({
  id: 'js-rendering',
  category: 'crawlerAccess',
  title: 'Content visible without JavaScript',
  impact: 'high',
  effort: 'high',

  run({ page, rendered, renderError }) {
    if (!rendered) return skip(`Could not compare with the JavaScript-rendered page: ${renderError}`);

    const rawWords = page.wordCount;
    const renderedWords = rendered.wordCount;
    const ratio = renderedWords > 0 ? Math.min(1, rawWords / renderedWords) : 1;

    const rawHeadings = new Set(page.headings.map((h) => norm(h.text)));
    const jsOnlyHeadings = rendered.headings.filter((h) => h.text && !rawHeadings.has(norm(h.text))).map((h) => `H${h.level}: ${h.text}`);

    let score = ratio >= 0.9 ? 100 : Math.round(ratio * 100);
    if (rawWords < 50 && renderedWords >= 150) score = Math.min(score, 10);

    const visible = percent(Math.min(rawWords, renderedWords), renderedWords || 1);
    return {
      score,
      status: statusFromScore(score, { pass: 85, warn: 50 }),
      details: {
        summary:
          score >= 85
            ? `${visible}% of the page's text is in the initial HTML, so AI crawlers that don't run JavaScript can read it.`
            : `Only ${visible}% of the page's text is in the initial HTML (${rawWords} of ${renderedWords} words). The rest only appears after JavaScript runs, which most AI crawlers do not do.`,
        rawHtmlWords: rawWords,
        renderedWords,
        percentVisibleWithoutJs: visible,
        headingsOnlyAfterJs: jsOnlyHeadings.slice(0, 15),
      },
      recommendation:
        score >= 85
          ? ''
          : 'Serve the main content in the initial HTML using server-side rendering (SSR) or static generation, e.g. Next.js/Nuxt SSR or pre-rendering. Avoid loading body copy, FAQs or prices with client-side fetches.',
    };
  },
});
