import { defineCheck, percent, statusFromScore } from '../helpers.js';

/** AI crawlers worth allowing. `purpose` explains the trade-off of blocking each one. */
export const AI_CRAWLERS = [
  { token: 'GPTBot', owner: 'OpenAI', purpose: 'Model training for ChatGPT' },
  { token: 'OAI-SearchBot', owner: 'OpenAI', purpose: 'ChatGPT search results and citations' },
  { token: 'ClaudeBot', owner: 'Anthropic', purpose: 'Claude training and web knowledge' },
  { token: 'PerplexityBot', owner: 'Perplexity', purpose: 'Perplexity answers and citations' },
  { token: 'Google-Extended', owner: 'Google', purpose: 'Gemini and Vertex AI grounding' },
  { token: 'Applebot-Extended', owner: 'Apple', purpose: 'Apple Intelligence training' },
  { token: 'CCBot', owner: 'Common Crawl', purpose: 'Open dataset used by many AI models' },
];

export default defineCheck({
  id: 'ai-crawler-robots',
  category: 'crawlerAccess',
  title: 'AI crawlers allowed in robots.txt',
  impact: 'high',
  effort: 'low',

  run({ robots, finalUrl }) {
    if (!robots.found) {
      const serverError = robots.status >= 500 || robots.error;
      return serverError
        ? {
            score: 50,
            status: 'warn',
            details: { summary: `robots.txt could not be read (${robots.error?.message ?? `HTTP ${robots.status}`}). Some crawlers treat an unreachable robots.txt as "disallow everything".`, robotsUrl: robots.url },
            recommendation: 'Make sure /robots.txt returns HTTP 200 (or 404) reliably.',
          }
        : {
            score: 100,
            details: { summary: 'No robots.txt found, so every AI crawler is allowed by default.', robotsUrl: robots.url },
            recommendation: 'Optional: add a robots.txt that explicitly allows AI crawlers and links to your sitemap.',
          };
    }

    const bots = AI_CRAWLERS.map((bot) => ({
      bot: bot.token,
      owner: bot.owner,
      purpose: bot.purpose,
      allowed: robots.parser.isAllowed(finalUrl, bot.token) !== false,
    }));
    const blocked = bots.filter((b) => !b.allowed);
    const score = percent(bots.length - blocked.length, bots.length);

    return {
      score,
      status: blocked.length === 0 ? 'pass' : statusFromScore(score, { pass: 101, warn: 50 }),
      details: {
        summary: blocked.length
          ? `${blocked.length} of ${bots.length} AI crawlers are blocked from this page: ${blocked.map((b) => b.bot).join(', ')}.`
          : `All ${bots.length} major AI crawlers can access this page.`,
        crawlers: bots,
        robotsUrl: robots.url,
      },
      recommendation: blocked.length
        ? `Allow ${blocked.map((b) => b.bot).join(', ')} in robots.txt (e.g. "User-agent: ${blocked[0].bot}" followed by "Allow: /"). Blocking search crawlers such as OAI-SearchBot and PerplexityBot removes you from those AI answers entirely. Blocking training-only crawlers (GPTBot, Google-Extended, CCBot) can be a deliberate policy choice, but it reduces how well models know your brand.`
        : '',
    };
  },
});
