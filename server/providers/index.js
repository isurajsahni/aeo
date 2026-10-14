import { config } from '../config/index.js';
import { AnthropicAdapter } from './anthropic.js';
import { GeminiAdapter } from './gemini.js';
import { OpenAIAdapter } from './openai.js';
import { PerplexityAdapter } from './perplexity.js';

/** Every supported provider. Order = display order. */
const FACTORIES = {
  openai: (settings) => new OpenAIAdapter(settings),
  anthropic: (settings) => new AnthropicAdapter(settings),
  perplexity: (settings) => new PerplexityAdapter(settings),
  gemini: (settings) => new GeminiAdapter(settings),
};

export const PROVIDER_IDS = Object.keys(FACTORIES);

let cache = null;

/**
 * Providers enabled by environment: an API key is set, and (if VISIBILITY_PROVIDERS
 * is set) the provider is listed there. Built once and reused.
 */
export function getEnabledProviders({ settings = config.visibility } = {}) {
  if (cache && settings === config.visibility) return cache;
  const enabled = PROVIDER_IDS.filter((id) => settings.providers[id]?.apiKey && (!settings.only.length || settings.only.includes(id))).map((id) =>
    FACTORIES[id]({ ...settings.providers[id], timeoutMs: settings.timeoutMs }),
  );
  if (settings === config.visibility) cache = enabled;
  return enabled;
}

/** For tests: replace the provider set. */
export function setProvidersForTesting(providers) {
  cache = providers;
}
