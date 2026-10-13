import cors from 'cors';
import helmet from 'helmet';
import { config } from '../config/index.js';

/** Security headers. The API only serves JSON, so the strictest CSP is safe. */
export const securityHeaders = helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  crossOriginResourcePolicy: { policy: 'same-site' },
});

/** Security headers for the React app (HTML/JS/CSS) when Express serves it in production. */
export const appSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // React sets inline style attributes (progress bars, gauge); Inter comes from Google Fonts.
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
});

/** CORS with an explicit origin allowlist and credentials (cookies) enabled. */
export const corsMiddleware = cors({
  origin(origin, callback) {
    // Same-origin requests and server-to-server tools (curl, health checks) send no Origin.
    if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  maxAge: 600,
});
