import { z } from 'zod';
import { MAX_COMPETITORS } from '../models/Project.js';
import { domainField } from './common.js';

const name = z.string({ error: 'Name is required' }).trim().min(1, 'Name is required').max(100, 'Name is too long');
const notes = z.string().trim().max(2000, 'Notes must be at most 2000 characters');
const competitors = z
  .array(domainField)
  .max(MAX_COMPETITORS, `You can add up to ${MAX_COMPETITORS} competitors`)
  .transform((list) => [...new Set(list)]);

export const createProjectSchema = z.object({
  name,
  domain: domainField,
  competitors: competitors.default([]),
  notes: notes.default(''),
});

// Defined separately (not `.partial()`) so omitted fields are never reset to defaults.
export const updateProjectSchema = z
  .object({
    name: name.optional(),
    domain: domainField.optional(),
    competitors: competitors.optional(),
    notes: notes.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Provide at least one field to update',
  });
