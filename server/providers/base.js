/**
 * Provider adapter interface for AI visibility testing.
 *
 * Each adapter asks one AI assistant a question the way a real user would (with web
 * search on, where the provider offers it) and normalizes the answer:
 *
 *   ask({ prompt, location }) -> { text, citations: [{ url, title }], model, usage: { inputTokens, outputTokens } }
 *
 * Adding a provider = one new class extending ProviderAdapter + one line in providers/index.js.
 * Adapters take their SDK client in the constructor, so tests inject fakes.
 */
export class ProviderAdapter {
  /** @param {{ id: string, label: string, model: string }} meta */
  constructor({ id, label, model }) {
    this.id = id;
    this.label = label;
    this.model = model;
  }

  // eslint-disable-next-line no-unused-vars
  async ask({ prompt, location }) {
    throw new Error(`${this.id}: ask() not implemented`);
  }

  describe() {
    return { id: this.id, label: this.label, model: this.model };
  }
}

/**
 * Collect URL citations from any provider response by walking the object.
 * Response shapes differ between providers and change between API versions; walking
 * for the citation markers each documents is more robust than hard-coding paths.
 */
export function collectCitations(value, { types = ['url_citation', 'web_search_result_location', 'web_search_result'] } = {}) {
  const found = new Map();
  const visit = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 40) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    if (types.includes(node.type) && typeof node.url === 'string' && /^https?:\/\//i.test(node.url) && !found.has(node.url)) {
      found.set(node.url, { url: node.url, title: typeof node.title === 'string' ? node.title : null });
    }
    for (const child of Object.values(node)) if (child && typeof child === 'object') visit(child, depth + 1);
  };
  visit(value, 0);
  return [...found.values()];
}

/** Normalize a location object to the fields the providers accept. */
export const normalizeLocation = (location) =>
  location && (location.city || location.country || location.region)
    ? { city: location.city || undefined, region: location.region || undefined, country: location.country ? location.country.toUpperCase() : undefined }
    : null;
