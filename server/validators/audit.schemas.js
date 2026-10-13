import { z } from 'zod';

export const startAuditSchema = z.object({
  // Optional page URL on the project's domain; defaults to the homepage.
  url: z.string().trim().max(2048, 'URL is too long').optional().or(z.literal('').transform(() => undefined)),
});
