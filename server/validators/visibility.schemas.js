import { z } from 'zod';
import { config } from '../config/index.js';
import { PROVIDER_IDS } from '../providers/index.js';
import { objectId } from './common.js';

const location = z
  .object({
    city: z.string().trim().max(80).optional().default(''),
    region: z.string().trim().max(80).optional().default(''),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === '' || /^[A-Z]{2}$/.test(v), 'Use a 2-letter country code, e.g. IN')
      .optional()
      .default(''),
  })
  .nullable()
  .optional()
  .transform((loc) => (loc && (loc.city || loc.region || loc.country) ? loc : null));

const text = z.string({ error: 'Prompt is required' }).trim().min(3, 'Prompt is too short').max(500, 'Prompt is too long (500 characters max)');

export const createPromptSchema = z.object({ text, location, active: z.boolean().default(true) });

export const updatePromptSchema = z
  .object({ text: text.optional(), location, active: z.boolean().optional() })
  .refine((body) => Object.values(body).some((v) => v !== undefined), { message: 'Provide at least one field to update' });

export const promptParams = z.object({ id: objectId, promptId: objectId });

export const startRunSchema = z.object({
  providers: z.array(z.enum(PROVIDER_IDS)).min(1, 'Pick at least one AI assistant').optional(),
  runsPerPrompt: z.coerce.number().int().min(1).max(10).default(config.visibility.runsPerPrompt),
  promptIds: z.array(objectId).min(1).optional(),
});

export const resultsQuery = z.object({
  prompt: objectId.optional(),
  provider: z.enum(PROVIDER_IDS).optional(),
});
