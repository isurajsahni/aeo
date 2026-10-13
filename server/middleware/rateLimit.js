import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

// In-memory stores are fine for a single instance. When running several API
// instances, switch to a shared store (e.g. rate-limit-redis) on the Redis we already run.

function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (_req, res) => {
      res.status(429).json({ error: { message, code: 'RATE_LIMITED' } });
    },
  });
}

/** General API limit per IP. */
export const apiLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: 'Too many requests. Please slow down and try again shortly.',
});

/** Audits are expensive (crawling + headless browser), so cap them per user. */
export const auditLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  keyGenerator: (req) => `user:${req.user.id}`,
  handler: (_req, res) => {
    res.status(429).json({ error: { message: 'You have started a lot of audits this hour. Please wait a bit and try again.', code: 'RATE_LIMITED' } });
  },
});

/** Stricter limit on login/register to slow down credential stuffing. */
export const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
});
