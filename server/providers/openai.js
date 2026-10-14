import OpenAI from 'openai';
import { collectCitations, normalizeLocation, ProviderAdapter } from './base.js';

/** ChatGPT-style answer: the Responses API with the web_search tool. */
export class OpenAIAdapter extends ProviderAdapter {
  constructor({ apiKey, model, timeoutMs, client } = {}) {
    super({ id: 'openai', label: 'ChatGPT', model });
    this.client = client ?? new OpenAI({ apiKey, timeout: timeoutMs });
  }

  async ask({ prompt, location }) {
    const loc = normalizeLocation(location);
    const response = await this.client.responses.create({
      model: this.model,
      input: prompt,
      tools: [{ type: 'web_search', ...(loc && { user_location: { type: 'approximate', ...loc } }) }],
    });

    const text = (response.output_text ?? '').trim();
    return {
      text,
      citations: collectCitations(response.output, { types: ['url_citation'] }),
      model: response.model ?? this.model,
      usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 },
    };
  }
}
