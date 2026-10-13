import { defineCheck } from '../helpers.js';
import { ruleKeyFor } from './schemaRules.js';

const CONTENT_TYPES = ['FAQPage', 'HowTo', 'Article', 'BlogPosting', 'NewsArticle', 'Product'];
const QUESTION_RE = /\?\s*$/;

/** Does the visible page look like an FAQ, an article, or a how-to? */
function detectPageShape(page) {
  const questionHeadings = page.headings.filter((h) => h.level >= 2 && QUESTION_RE.test(h.text)).length;
  return {
    faqLike: questionHeadings >= 3 || page.detailsElements >= 3 || page.headings.some((h) => /faq|frequently asked/i.test(h.text)),
    articleLike: page.hasArticleElement && page.wordCount >= 300,
    howToLike: page.headings.some((h) => /^how to\b/i.test(h.text)) && page.lists > 0,
  };
}

export default defineCheck({
  id: 'content-schema',
  category: 'structuredData',
  title: 'Answer-friendly schema (FAQPage, HowTo, Article, Product)',
  impact: 'medium',
  effort: 'medium',

  run({ page, isHomepage }) {
    const present = [...new Set(page.jsonLd.nodes.flatMap((n) => n.types).filter((t) => CONTENT_TYPES.includes(ruleKeyFor(t))))];
    const shape = detectPageShape(page);
    const expected = [shape.faqLike && 'FAQPage', shape.articleLike && 'Article', shape.howToLike && 'HowTo'].filter(Boolean);
    const missingExpected = expected.filter((t) => !present.some((p) => p === t || (t === 'Article' && /Article|BlogPosting/.test(p))));

    if (present.length && !missingExpected.length) {
      return { score: 100, details: { summary: `Content schema found: ${present.join(', ')}.`, present }, recommendation: '' };
    }
    if (missingExpected.length) {
      return {
        score: present.length ? 60 : 25,
        details: { summary: `This page looks like it contains ${missingExpected.join(' and ')} content but has no matching schema.`, present, expected: missingExpected },
        recommendation: `Add ${missingExpected.join(' and ')} JSON-LD that mirrors the visible content. ${missingExpected.includes('FAQPage') ? 'FAQPage schema gives AI engines clean question/answer pairs to quote.' : ''}`.trim(),
      };
    }
    return {
      score: isHomepage ? 70 : 50,
      status: 'warn',
      details: { summary: 'No content-type schema found. Fine for some pages, but FAQ, how-to, article and product pages should have it.', present },
      recommendation: 'Where it fits the content, add FAQPage, HowTo, Article/BlogPosting or Product schema.',
    };
  },
});
