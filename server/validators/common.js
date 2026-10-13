import { z } from 'zod';
import { isValidDomainInput, normalizeDomain } from '../utils/domain.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const idParams = z.object({ id: objectId });

/** Accepts "example.com" or a full URL and outputs a normalized bare hostname. */
export const domainField = z
  .string({ error: 'Domain is required' })
  .trim()
  .min(1, 'Domain is required')
  .max(300, 'Domain is too long')
  .refine(isValidDomainInput, 'Enter a valid public domain, e.g. example.com')
  .transform((value) => normalizeDomain(value));
