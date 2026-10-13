import { defineCheck, skip } from '../helpers.js';

const ARTICLE_TYPES = /^(Article|BlogPosting|NewsArticle|TechArticle|Report|ScholarlyArticle)$/;

export default defineCheck({
  id: 'author-byline',
  category: 'trust',
  title: 'Author byline and bio',
  impact: 'medium',
  effort: 'low',

  run({ page }) {
    const articleNodes = page.jsonLd.nodes.filter((n) => n.types.some((t) => ARTICLE_TYPES.test(t)));
    const isArticle = articleNodes.length > 0 || (page.hasArticleElement && page.wordCount >= 300) || page.og['og:type'] === 'article';
    if (!isArticle) return skip('Not an article/blog page. Bylines matter most on articles, guides and blog posts.');

    const schemaAuthors = articleNodes.flatMap((n) => [n.data.author].flat().filter(Boolean));
    const authorPersons = schemaAuthors.filter((a) => typeof a === 'object');
    const hasByline = schemaAuthors.length > 0 || page.authorSignals.length > 0;
    const hasProfile =
      authorPersons.some((a) => a.url || a.sameAs || a.description) ||
      page.links.some((l) => l.internal && (/\/(author|authors|team|people|staff)\//.test(l.path) || l.rel.includes('author')));

    const score = (hasByline ? 60 : 0) + (hasProfile ? 40 : 0);
    return {
      score,
      details: {
        summary: !hasByline
          ? 'No author byline found. Anonymous content carries less weight with AI engines judging expertise.'
          : hasProfile
            ? 'Author byline with a linked profile/bio found.'
            : 'Author byline found, but no author bio or profile page.',
        schemaAuthors: schemaAuthors.map((a) => (typeof a === 'string' ? a : a.name ?? '(unnamed)')),
        visibleSignals: page.authorSignals.slice(0, 5),
      },
      recommendation:
        score === 100
          ? ''
          : 'Show a named author with credentials on each article, link to an author bio page, and add author as a Person (name, url, sameAs, jobTitle) in the Article schema.',
    };
  },
});
