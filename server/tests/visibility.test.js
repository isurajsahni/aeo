import { runCheck } from '../audit/runChecks.js';
import { AnthropicAdapter } from '../providers/anthropic.js';
import { collectCitations } from '../providers/base.js';
import { GeminiAdapter } from '../providers/gemini.js';
import { OpenAIAdapter } from '../providers/openai.js';
import { PerplexityAdapter } from '../providers/perplexity.js';
import { analyzeAnswer, brandTerms, findMention, mentionRank, sentimentAround, targetsFor } from '../visibility/analyze.js';
import { visibilityChecks } from '../visibility/checks.js';
import { summarizeRun } from '../visibility/summarize.js';

const project = { name: 'Smile Dental (client)', domain: 'smiledental.in', competitors: ['brightsmile.com', 'city-dental.in'], brandTerms: ['Smile Dental Clinic'] };
const targets = targetsFor(project);

const answer = `Here are some of the best dentists in Ludhiana:

1. **City Dental Care**: popular for implants.
2. **Smile Dental Clinic**: highly rated, friendly staff and affordable cleanings.
3. BrightSmile Studio: cosmetic dentistry.

Sources: smiledental.in, brightsmile.com`;

describe('answer analysis', () => {
  test('derives brand terms from the name, aliases and domain', () => {
    expect(brandTerms(project)).toEqual(['smile dental', 'smile dental clinic', 'smiledental.in', 'smiledental']);
  });

  test('matches whole words only', () => {
    expect(findMention('We love SmileDental!', ['smiledental'])).toBe(8);
    expect(findMention('smiledentalcare.com is different', ['smiledental'])).toBe(-1);
  });

  test('finds the rank in a list answer', () => {
    expect(mentionRank(answer, targets.brand.terms)).toBe(2);
    expect(mentionRank('Smile Dental is good.', targets.brand.terms)).toBeNull();
  });

  test('reads sentiment around the mention', () => {
    expect(sentimentAround('Smile Dental is highly rated and trusted.', 0)).toBe('positive');
    expect(sentimentAround('Avoid Smile Dental: many complaints about billing.', 6)).toBe('negative');
    expect(sentimentAround('Smile Dental is on Main Street.', 0)).toBe('neutral');
  });

  test('analyzes a full answer: mention, rank, citation, competitors', () => {
    const result = analyzeAnswer({ text: answer, citations: [{ url: 'https://www.brightsmile.com/' }, { url: 'https://smiledental.in/services' }] }, targets);
    expect(result).toMatchObject({
      brandMentioned: true,
      rank: 2,
      listLength: 3,
      domainCited: true,
      citationPosition: 2,
      citedUrls: ['https://smiledental.in/services'],
      sentiment: 'positive',
      competitorsMentioned: ['brightsmile.com', 'city-dental.in'],
    });
  });

  test('a citation alone counts as being mentioned', () => {
    expect(analyzeAnswer({ text: 'Try the clinic on Mall Road.', citations: [{ url: 'https://smiledental.in/' }] }, targets).brandMentioned).toBe(true);
    expect(analyzeAnswer({ text: 'No idea.', citations: [] }, targets)).toMatchObject({ brandMentioned: false, rank: null, sentiment: null });
  });
});

describe('run summary and category F checks', () => {
  const providers = [{ id: 'openai', label: 'ChatGPT', model: 'm' }, { id: 'perplexity', label: 'Perplexity', model: 'm' }];
  const prompts = [{ id: 'p1', text: 'best dentist in ludhiana' }, { id: 'p2', text: 'teeth whitening cost ludhiana' }];
  const hit = (prompt, provider, extra = {}) => ({ prompt, provider, analysis: { brandMentioned: true, domainCited: true, rank: 2, sentiment: 'positive', competitorsMentioned: ['brightsmile.com'], ...extra } });
  const miss = (prompt, provider, extra = {}) => ({ prompt, provider, analysis: { brandMentioned: false, domainCited: false, rank: null, sentiment: null, competitorsMentioned: ['brightsmile.com', 'city-dental.in'], ...extra } });
  const results = [
    hit('p1', 'openai'), hit('p1', 'openai'), miss('p1', 'openai'),
    miss('p2', 'openai'), miss('p2', 'openai'), miss('p2', 'openai'),
    hit('p1', 'perplexity', { domainCited: false }), miss('p1', 'perplexity'), { prompt: 'p1', provider: 'perplexity', error: { message: '429' } },
    miss('p2', 'perplexity'), miss('p2', 'perplexity'), miss('p2', 'perplexity'),
  ];
  const summary = summarizeRun({ results, prompts, providers, competitors: ['brightsmile.com', 'city-dental.in'] });

  test('reports rates, not yes/no, per assistant and per prompt', () => {
    expect(summary.totals).toMatchObject({ responses: 11, errors: 1, mentions: 3, mentionRate: 0.273, citations: 2, avgRank: 2 });
    expect(summary.providers.find((p) => p.id === 'openai')).toMatchObject({ mentionRate: 0.333, promptCoverage: 0.5 });
    expect(summary.providers.find((p) => p.id === 'perplexity')).toMatchObject({ responses: 5, errors: 1, mentionRate: 0.2 });
    expect(summary.prompts.find((p) => p.promptId === 'p2')).toMatchObject({ mentions: 0, mentionRate: 0 });
    expect(summary.shareOfVoice[0]).toMatchObject({ name: 'brightsmile.com', mentions: 11 });
  });

  test('category F checks score from the summary', () => {
    const byId = Object.fromEntries(visibilityChecks.map((c) => [c.id, runCheck(c, { visibility: summary })]));
    expect(byId['ai-mention-rate']).toMatchObject({ category: 'aiVisibility', score: 46, status: 'fail' }); // 27% of a 60% target
    expect(byId['ai-mention-rate'].details.promptsNeverMentioned).toEqual(['"teeth whitening cost ludhiana"']);
    expect(byId['ai-provider-coverage'].score).toBe(100);
    expect(byId['ai-share-of-voice'].details.summary).toMatch(/brightsmile\.com leads/);
    expect(byId['ai-sentiment'].score).toBe(100);
  });

  test('without a run, category F is skipped and does not affect the score', () => {
    for (const check of visibilityChecks) expect(runCheck(check, { visibility: null }).skipped).toBe(true);
  });
});

describe('provider adapters (fake SDK clients)', () => {
  test('collectCitations finds url citations anywhere and de-duplicates', () => {
    const found = collectCitations({ a: [{ type: 'url_citation', url: 'https://x.com', title: 'X' }], b: { c: { type: 'url_citation', url: 'https://x.com' } } });
    expect(found).toEqual([{ url: 'https://x.com', title: 'X' }]);
  });

  test('OpenAI: Responses API with web search and user location', async () => {
    let sent;
    const client = {
      responses: {
        create: async (params) => {
          sent = params;
          return {
            model: 'gpt-5.5',
            output_text: 'Smile Dental is great.',
            output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: '...', annotations: [{ type: 'url_citation', url: 'https://smiledental.in', title: 'Smile' }] }] }],
            usage: { input_tokens: 10, output_tokens: 20 },
          };
        },
      },
    };
    const result = await new OpenAIAdapter({ model: 'gpt-5.5', client }).ask({ prompt: 'best dentist', location: { city: 'Ludhiana', country: 'in' } });
    expect(sent.tools).toEqual([{ type: 'web_search', user_location: { type: 'approximate', city: 'Ludhiana', region: undefined, country: 'IN' } }]);
    expect(result).toEqual({ text: 'Smile Dental is great.', citations: [{ url: 'https://smiledental.in', title: 'Smile' }], model: 'gpt-5.5', usage: { inputTokens: 10, outputTokens: 20 } });
  });

  test('Anthropic: web search tool, fallbacks, pause_turn resume, cited sources first', async () => {
    const calls = [];
    const responses = [
      { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', name: 'web_search' }], usage: { input_tokens: 5, output_tokens: 1 } },
      {
        stop_reason: 'end_turn',
        model: 'claude-opus-5-5',
        content: [
          { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://other.com', title: 'Other' }] },
          { type: 'text', text: 'Try Smile Dental.', citations: [{ type: 'web_search_result_location', url: 'https://smiledental.in', title: 'Smile', cited_text: '...' }] },
        ],
        usage: { input_tokens: 50, output_tokens: 30 },
      },
    ];
    const client = { beta: { messages: { create: async (params) => (calls.push(structuredClone(params)), responses.shift()) } } };
    const result = await new AnthropicAdapter({ model: 'claude-opus-5-5', client }).ask({ prompt: 'best dentist', location: null });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ model: 'claude-opus-5-5', fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'], tools: [{ type: 'web_search_20260209', name: 'web_search' }] });
    expect(calls[1].messages).toHaveLength(2); // the paused assistant turn is sent back, no extra user message
    expect(result).toMatchObject({ text: 'Try Smile Dental.', citations: [{ url: 'https://smiledental.in', title: 'Smile' }], usage: { inputTokens: 55, outputTokens: 31 } });
  });

  test('Anthropic: a refusal is reported as an error, not an empty answer', async () => {
    const client = { beta: { messages: { create: async () => ({ stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [], usage: {} }) } } };
    await expect(new AnthropicAdapter({ model: 'm', client }).ask({ prompt: 'x' })).rejects.toMatchObject({ code: 'REFUSED' });
  });

  test('Gemini: Interactions API with Google Search grounding', async () => {
    let sent;
    const client = {
      interactions: {
        create: async (params) => {
          sent = params;
          return { output_text: 'Smile Dental.', steps: [{ type: 'model_output', content: [{ type: 'text', annotations: [{ type: 'url_citation', url: 'https://smiledental.in', title: 'smiledental.in' }] }] }] };
        },
      },
    };
    const result = await new GeminiAdapter({ model: 'gemini-3.8-flash', client }).ask({ prompt: 'best dentist', location: { city: 'Ludhiana', country: 'IN' } });
    expect(sent).toMatchObject({ model: 'gemini-3.8-flash', tools: [{ type: 'google_search' }] });
    expect(sent.input).toMatch(/I am in Ludhiana, IN/);
    expect(result.citations).toEqual([{ url: 'https://smiledental.in', title: 'smiledental.in' }]);
  });

  test('Perplexity: Sonar endpoint, retries a 429, prefers structured search results', async () => {
    let attempts = 0;
    const http = {
      post: async (url, body, options) => {
        attempts += 1;
        expect(url).toBe('https://api.perplexity.ai/v1/sonar');
        expect(options.headers.Authorization).toBe('Bearer pk');
        if (attempts === 1) throw Object.assign(new Error('rate limited'), { response: { status: 429 } });
        return { data: { model: 'sonar', choices: [{ message: { content: 'Smile Dental [1]' } }], citations: ['https://a.com'], search_results: [{ url: 'https://smiledental.in', title: 'Smile' }], usage: { prompt_tokens: 3, completion_tokens: 4 } } };
      },
    };
    const result = await new PerplexityAdapter({ apiKey: 'pk', model: 'sonar', http }).ask({ prompt: 'best dentist' });
    expect(attempts).toBe(2);
    expect(result).toEqual({ text: 'Smile Dental [1]', citations: [{ url: 'https://smiledental.in', title: 'Smile' }], model: 'sonar', usage: { inputTokens: 3, outputTokens: 4 } });
  }, 10_000);
});
