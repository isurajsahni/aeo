import { defineCheck } from '../helpers.js';

const ABOUT = { path: /\/(about|about-us|who-we-are|our-story|company|team)(\/|$|\.)/, text: /^(about|about us|our story|who we are|our team|company)$/i };
const CONTACT = { path: /\/(contact|contact-us|get-in-touch|locations?)(\/|$|\.)/, text: /^(contact|contact us|get in touch|locations?)$/i };

const findLink = (links, pattern) => links.find((l) => l.internal && (pattern.path.test(l.path) || pattern.text.test(l.text)));

export default defineCheck({
  id: 'about-contact',
  category: 'trust',
  title: 'About and Contact pages linked',
  impact: 'medium',
  effort: 'low',

  run({ page }) {
    const about = findLink(page.links, ABOUT);
    const contact = findLink(page.links, CONTACT);
    const directContact = page.links.filter((l) => l.protocol === 'tel:' || l.protocol === 'mailto:');

    const score = (about ? 50 : 0) + (contact ? 50 : directContact.length ? 30 : 0);
    const missing = [!about && 'an About page', !contact && 'a Contact page'].filter(Boolean);

    return {
      score,
      status: score >= 100 ? 'pass' : score >= 50 ? 'warn' : 'fail',
      details: {
        summary: missing.length ? `No link to ${missing.join(' or ')} found on this page.` : 'Links to About and Contact pages found.',
        aboutPage: about?.href ?? null,
        contactPage: contact?.href ?? null,
        phoneOrEmailLinks: directContact.slice(0, 5).map((l) => l.href),
      },
      recommendation: missing.length
        ? `Link to ${missing.join(' and ')} from the main navigation or footer. They tell AI engines (and people) who runs the site and how to reach them, a core trust signal.`
        : '',
    };
  },
});
