import { z } from 'zod';
import { config } from '../config/index.js';

export const startAuditSchema = z.object({
  // Optional page URL on the project's domain; defaults to the homepage. For site crawls, the start page.
  url: z.string().trim().max(2048, 'URL is too long').optional().or(z.literal('').transform(() => undefined)),
  mode: z.enum(['single', 'site']).default('single'),
  maxPages: z.coerce
    .number()
    .int()
    .min(2, 'Crawl at least 2 pages')
    .max(config.crawler.maxCrawlPages, `Crawl at most ${config.crawler.maxCrawlPages} pages`)
    .default(config.crawler.defaultCrawlPages),
});

export const pageParams = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id'),
  pageId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id'),
});
