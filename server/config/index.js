import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';
import { parseDuration } from '../utils/duration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// One .env file at the monorepo root is shared by the client and the server.
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/aeo_audit'),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'JWT_EXPIRES_IN must look like 15m, 12h or 7d')
    .default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  COOKIE_SECURE: booleanish.optional(),

  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Serve the built React app from Express (one origin for UI + API). Defaults to on in production.
  SERVE_CLIENT: booleanish.optional(),

  // --- Sign-ups ---
  ALLOW_REGISTRATION: booleanish.default(true),
  // Optional comma-separated allowlist: full emails and/or "@domain" entries.
  SIGNUP_ALLOWLIST: z.string().default(''),

  // --- Crawler ---
  CRAWLER_USER_AGENT: z
    .string()
    .default('Mozilla/5.0 (compatible; AEOAuditBot/1.0; +https://github.com/aeo-audit)'),
  CRAWLER_ROBOTS_TOKEN: z.string().default('AEOAuditBot'),
  CRAWL_DELAY_MS: z.coerce.number().int().min(0).max(30_000).default(500),
  FETCH_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15_000),
  MAX_RESPONSE_BYTES: z.coerce.number().int().min(10_000).default(5 * 1024 * 1024),
  MAX_REDIRECTS: z.coerce.number().int().min(0).max(10).default(5),
  MAX_CONCURRENT_AUDITS: z.coerce.number().int().min(1).max(20).default(2),

  // --- JS rendering (Playwright) ---
  RENDER_ENABLED: booleanish.default(true),
  RENDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(25_000),

  // --- Google PageSpeed Insights ---
  PAGESPEED_ENABLED: booleanish.default(true),
  PAGESPEED_API_KEY: z.string().optional(),
  PAGESPEED_TIMEOUT_MS: z.coerce.number().int().min(5000).max(180_000).default(60_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${problems}\nSee .env.example for reference.`);
}

const env = parsed.data;
const isProd = env.NODE_ENV === 'production';

// Refuse to boot in production with settings that are only safe locally.
if (isProd) {
  const problems = [
    /replace-me/i.test(env.JWT_SECRET) && 'JWT_SECRET is still the .env.example placeholder; generate a random one',
    env.COOKIE_SECURE === false && 'COOKIE_SECURE=false sends session cookies over plain HTTP',
    env.CLIENT_ORIGIN.includes('localhost') && 'CLIENT_ORIGIN still points to localhost; set it to your public URL',
  ].filter(Boolean);
  if (problems.length) throw new Error(`Unsafe production configuration:\n  - ${problems.join('\n  - ')}`);
}

/** Typed, validated, read-only application config. Import this instead of reading process.env. */
export const config = Object.freeze({
  env: env.NODE_ENV,
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  mongoUri: env.MONGODB_URI,
  redisUrl: env.REDIS_URL,
  corsOrigins: env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  trustProxy: env.TRUST_PROXY,
  serveClient: env.SERVE_CLIENT ?? isProd,
  bcryptRounds: env.BCRYPT_ROUNDS,
  registration: Object.freeze({
    open: env.ALLOW_REGISTRATION,
    allowlist: env.SIGNUP_ALLOWLIST.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean),
  }),
  jwt: Object.freeze({
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    maxAgeMs: parseDuration(env.JWT_EXPIRES_IN),
    issuer: 'aeo-audit',
  }),
  cookie: Object.freeze({
    name: 'aeo_token',
    secure: env.COOKIE_SECURE ?? isProd,
  }),
  crawler: Object.freeze({
    userAgent: env.CRAWLER_USER_AGENT,
    robotsToken: env.CRAWLER_ROBOTS_TOKEN,
    delayMs: env.CRAWL_DELAY_MS,
    timeoutMs: env.FETCH_TIMEOUT_MS,
    maxBytes: env.MAX_RESPONSE_BYTES,
    maxRedirects: env.MAX_REDIRECTS,
    maxConcurrentAudits: env.MAX_CONCURRENT_AUDITS,
  }),
  render: Object.freeze({
    enabled: env.RENDER_ENABLED,
    timeoutMs: env.RENDER_TIMEOUT_MS,
  }),
  pageSpeed: Object.freeze({
    enabled: env.PAGESPEED_ENABLED,
    apiKey: env.PAGESPEED_API_KEY || undefined,
    timeoutMs: env.PAGESPEED_TIMEOUT_MS,
  }),
});
