import { GoogleGenAI } from '@google/genai';
import { collectCitations, ProviderAdapter } from './base.js';

/** Gemini with Google Search grounding, via the Interactions API. */
export class GeminiAdapter extends ProviderAdapter {
  constructor({ apiKey, model, client } = {}) {
    super({ id: 'gemini', label: 'Gemini', model });
    this.client = client ?? new GoogleGenAI({ apiKey });
  }

  async ask({ prompt, location }) {
    // The Interactions API has no location parameter; state it the way a user would.
    const where = [location?.city, location?.region, location?.country].filter(Boolean).join(', ');
    const interaction = await this.client.interactions.create({
      model: this.model,
      input: where ? `${prompt}\n\n(I am in ${where}.)` : prompt,
      tools: [{ type: 'google_search' }],
    });

    return {
      text: (interaction.output_text ?? '').trim(),
      citations: collectCitations(interaction.steps ?? interaction, { types: ['url_citation'] }),
      model: interaction.model ?? this.model,
      usage: {
        inputTokens: interaction.usage?.total_input_tokens ?? interaction.usage?.input_tokens ?? 0,
        outputTokens: interaction.usage?.total_output_tokens ?? interaction.usage?.output_tokens ?? 0,
      },
    };
  }
}
