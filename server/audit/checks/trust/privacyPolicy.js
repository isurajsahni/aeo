import { defineCheck } from '../helpers.js';

export default defineCheck({
  id: 'privacy-policy',
  category: 'trust',
  title: 'Privacy policy linked',
  impact: 'low',
  effort: 'low',

  run({ page }) {
    const privacy = page.links.find((l) => /privacy/.test(l.path) || /privacy/i.test(l.text));
    const terms = page.links.find((l) => /\/(terms|tos|terms-of-service|terms-and-conditions)/.test(l.path) || /^terms/i.test(l.text));
    return {
      score: privacy ? 100 : 0,
      details: {
        summary: privacy ? `Privacy policy linked${terms ? ', along with terms of service' : ''}.` : 'No privacy policy link found on this page.',
        privacyPolicy: privacy?.href ?? null,
        terms: terms?.href ?? null,
      },
      recommendation: privacy ? '' : 'Add a privacy policy and link it from the site footer. It is a basic legitimacy signal for both users and AI quality systems.',
    };
  },
});
