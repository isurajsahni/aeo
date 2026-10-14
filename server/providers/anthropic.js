import Anthropic from '@anthropic-ai/sdk';
import { collectCitations, normalizeLocation, ProviderAdapter } from './base.js';

const MAX_CONTINUATIONS = 3;

/**
 * Claude, with the web search server tool on (as on claude.ai with search enabled).
 * Server-side refusal fallbacks are enabled so a safety decline is retried on a
 * fallback model instead of returning no answer.
 */
export class AnthropicAdapter extends ProviderAdapter {
  constructor({ apiKey, model, timeoutMs, client } = {}) {
    super({ id: 'anthropic', label: 'Claude', model });
    this.client = client ?? new Anthropic({ apiKey, timeout: timeoutMs });
  }

  async ask({ prompt, location }) {
    const loc = normalizeLocation(location);
    const tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5, ...(loc && { user_location: { type: 'approximate', ...loc } }) }];
    const messages = [{ role: 'user', content: prompt }];
    const usage = { inputTokens: 0, outputTokens: 0 };
    const contents = [];
    let response;

    for (let turn = 0; turn <= MAX_CONTINUATIONS; turn += 1) {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        // A consumer-style question: low effort keeps latency and cost close to a chat answer.
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        tools,
        messages,
      });
      usage.inputTokens += response.usage?.input_tokens ?? 0;
      usage.outputTokens += response.usage?.output_tokens ?? 0;
      contents.push(...response.content);

      // The server-side search loop can pause; re-send to let it resume (no extra user message).
      if (response.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: response.content });
    }

    if (response.stop_reason === 'refusal') {
      throw Object.assign(new Error(`Claude declined to answer (${response.stop_details?.category ?? 'refusal'})`), { code: 'REFUSED' });
    }

    const text = contents
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    // Sources Claude cited in its answer first, then other search results it saw.
    const cited = collectCitations(contents.filter((b) => b.type === 'text'), { types: ['web_search_result_location'] });
    const searched = collectCitations(contents.filter((b) => b.type === 'web_search_tool_result'), { types: ['web_search_result'] });
    return { text, citations: cited.length ? cited : searched, model: response.model ?? this.model, usage };
  }
}
