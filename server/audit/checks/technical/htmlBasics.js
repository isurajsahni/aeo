import { defineCheck } from '../helpers.js';

export default defineCheck({
  id: 'html-basics',
  category: 'technical',
  title: 'Language and mobile viewport',
  impact: 'low',
  effort: 'low',

  run({ page }) {
    const score = (page.lang ? 50 : 0) + (page.hasViewport ? 50 : 0);
    const missing = [!page.lang && 'a lang attribute on <html>', !page.hasViewport && 'a responsive viewport meta tag'].filter(Boolean);
    return {
      score,
      status: score === 100 ? 'pass' : score ? 'warn' : 'fail',
      details: { summary: missing.length ? `Missing ${missing.join(' and ')}.` : `Language declared (${page.lang}) and mobile viewport set.`, lang: page.lang, viewport: page.hasViewport },
      recommendation: missing.length ? `Add ${missing.join(' and ')} (e.g. <html lang="en"> and <meta name="viewport" content="width=device-width, initial-scale=1">).` : '',
    };
  },
});
