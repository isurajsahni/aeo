import axios from 'axios';
import { ProviderAdapter } from './base.js';

const ENDPOINT = 'https://api.perplexity.ai/v1/sonar';
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Perplexity Sonar (search is built in). Perplexity has no official Node SDK,
 * so this calls its HTTPS API directly, with a small retry for rate limits and 5xx.
 */
export class PerplexityAdapter extends ProviderAdapter {
  constructor({ apiKey, model, timeoutMs, http = axios } = {}) {
    super({ id: 'perplexity', label: 'Perplexity', model });
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.http = http;
  }

  async ask({ prompt, location }) {
    const where = [location?.city, location?.region, location?.country].filter(Boolean).join(', ');
    const body = { model: this.model, messages: [{ role: 'user', content: where ? `${prompt}\n\n(I am in ${where}.)` : prompt }] };

    let data;
    for (let attempt = 0; ; attempt += 1) {
      try {
        ({ data } = await this.http.post(ENDPOINT, body, {
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          timeout: this.timeoutMs,
        }));
        break;
      } catch (err) {
        const status = err.response?.status;
        if (attempt < 2 && (RETRYABLE.has(status) || !status)) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
          continue;
        }
        throw Object.assign(new Error(`Perplexity request failed: ${err.response?.data?.error?.message ?? err.message}`), { status });
      }
    }

    // Prefer the structured search results (with titles); fall back to the plain URL list.
    const results = Array.isArray(data.search_results) ? data.search_results.filter((r) => r?.url).map((r) => ({ url: r.url, title: r.title ?? null })) : [];
    const citations = results.length ? results : (data.citations ?? []).filter((u) => typeof u === 'string').map((url) => ({ url, title: null }));

    return {
      text: (data.choices?.[0]?.message?.content ?? '').trim(),
      citations,
      model: data.model ?? this.model,
      usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
    };
  }
}
