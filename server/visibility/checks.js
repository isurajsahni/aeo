import { defineCheck, skip, statusFromScore } from '../audit/checks/helpers.js';

/**
 * Category F (AI Visibility) checks. Unlike A-E they read the latest AI visibility run
 * for the project (ctx.visibility = run summary), not the page. They are attached to an
 * audit when a run no older than VISIBILITY_MAX_AGE_DAYS exists; otherwise they are
 * skipped and the category doesn't affect the score.
 */

// Rates that earn full marks. A brand named in 60% of answers to its own target
// questions is doing very well: answers vary and usually list several businesses.
export const TARGETS = { mentionRate: 0.6, citationRate: 0.4, shareOfVoice: 0.5 };

const pct = (r) => `${Math.round(r * 100)}%`;
const noRun = () => skip('No AI visibility test yet. Add target prompts and run one from the project’s AI visibility page.');
const scaled = (value, target) => Math.min(100, Math.round((value / target) * 100));

const missingPrompts = (summary) =>
  summary.prompts
    .filter((p) => p.responses > 0 && p.mentions === 0)
    .slice(0, 5)
    .map((p) => `"${p.text}"`);

export const visibilityChecks = [
  defineCheck({
    id: 'ai-mention-rate',
    category: 'aiVisibility',
    scope: 'site',
    title: 'Brand mentioned in AI answers',
    impact: 'high',
    effort: 'high',
    run({ visibility }) {
      if (!visibility?.totals.responses) return noRun();
      const { mentionRate, mentions, responses } = visibility.totals;
      const score = scaled(mentionRate, TARGETS.mentionRate);
      const gaps = missingPrompts(visibility);
      return {
        score,
        status: statusFromScore(score),
        details: {
          summary: `Mentioned in ${mentions} of ${responses} AI answers (${pct(mentionRate)}). Target: ${pct(TARGETS.mentionRate)}.`,
          byAssistant: visibility.providers.map((p) => ({ assistant: p.label, mentionRate: pct(p.mentionRate), answers: p.responses })),
          promptsNeverMentioned: gaps,
        },
        recommendation:
          score >= 80
            ? ''
            : `Publish pages that directly answer the prompts where you are never mentioned${gaps.length ? ` (${gaps.slice(0, 3).join(', ')})` : ''}, and fix the crawler access, structured data and content issues above so AI assistants can find and trust them.`,
      };
    },
  }),
  defineCheck({
    id: 'ai-citation-rate',
    category: 'aiVisibility',
    scope: 'site',
    title: 'Website cited as a source',
    impact: 'high',
    effort: 'high',
    run({ visibility }) {
      if (!visibility?.totals.responses) return noRun();
      const { citationRate, citations, responses } = visibility.totals;
      const score = scaled(citationRate, TARGETS.citationRate);
      return {
        score,
        status: statusFromScore(score),
        details: {
          summary: `Your site is linked as a source in ${citations} of ${responses} answers (${pct(citationRate)}). Target: ${pct(TARGETS.citationRate)}.`,
          byAssistant: visibility.providers.map((p) => ({ assistant: p.label, citationRate: pct(p.citationRate) })),
        },
        recommendation: score >= 80 ? '' : 'Earn citations with pages that hold quotable facts (prices, hours, services, FAQs) in the HTML, Organization/LocalBusiness schema, and an llms.txt pointing to them.',
      };
    },
  }),
  defineCheck({
    id: 'ai-provider-coverage',
    category: 'aiVisibility',
    scope: 'site',
    title: 'Visible across AI assistants',
    impact: 'medium',
    effort: 'high',
    run({ visibility }) {
      if (!visibility?.providersTested) return noRun();
      const { providersMentioning, providersTested } = visibility;
      const score = Math.round((providersMentioning / providersTested) * 100);
      const missing = visibility.providers.filter((p) => p.responses > 0 && p.mentions === 0).map((p) => p.label);
      return {
        score,
        status: statusFromScore(score),
        details: {
          summary: `Mentioned by ${providersMentioning} of ${providersTested} AI assistants tested.${missing.length ? ` Never mentioned by: ${missing.join(', ')}.` : ''}`,
          neverMentionedBy: missing,
        },
        recommendation: missing.length
          ? `Check that ${missing.join(' and ')} can crawl the site (robots.txt rules for their bots) and that the business is listed on the sources they rely on (Google Business Profile, Bing Places, review sites).`
          : '',
      };
    },
  }),
  defineCheck({
    id: 'ai-share-of-voice',
    category: 'aiVisibility',
    scope: 'site',
    title: 'Share of voice vs competitors',
    impact: 'medium',
    effort: 'high',
    run({ visibility }) {
      if (!visibility?.totals.responses) return noRun();
      if (visibility.shareOfVoice.length < 2) return skip('Add competitor domains to the project to measure share of voice.');
      const brand = visibility.shareOfVoice.find((v) => v.isBrand);
      const leader = visibility.shareOfVoice[0];
      const score = scaled(brand.share, TARGETS.shareOfVoice);
      return {
        score,
        status: statusFromScore(score),
        details: {
          summary: `Your brand has ${pct(brand.share)} of brand mentions in these answers${leader.isBrand ? ', more than any competitor' : `; ${leader.name} leads with ${pct(leader.share)}`}.`,
          shareOfVoice: visibility.shareOfVoice.map((v) => ({ name: v.isBrand ? 'Your brand' : v.name, mentions: v.mentions, share: pct(v.share) })),
        },
        recommendation: score >= 80 ? '' : 'Compare your pages with the competitors AI assistants mention more often: their structured data, reviews and question-led content are what you need to match or beat.',
      };
    },
  }),
  defineCheck({
    id: 'ai-sentiment',
    category: 'aiVisibility',
    scope: 'site',
    title: 'Sentiment when mentioned',
    impact: 'medium',
    effort: 'medium',
    run({ visibility }) {
      if (!visibility?.totals.mentions) return skip('The brand was not mentioned, so there is no sentiment to measure.');
      const { positive, neutral, negative } = visibility.totals.sentiment;
      const total = positive + neutral + negative || 1;
      const score = Math.round(((positive + neutral * 0.7) / total) * 100);
      return {
        score,
        status: negative ? (score >= 80 ? 'warn' : statusFromScore(score)) : statusFromScore(score),
        details: { summary: `Of ${total} mentions: ${positive} positive, ${neutral} neutral, ${negative} negative.`, positive, neutral, negative },
        recommendation: negative ? 'Read the negative answers on the AI visibility page and address the issues they raise (reviews, outdated information, complaints).' : score >= 80 ? '' : 'Give AI assistants concrete strengths to repeat: awards, review ratings, specialisms and testimonials, in plain text and schema.',
      };
    },
  }),
];
