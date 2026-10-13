import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { logger } from '../utils/logger.js';
import { appSecurityHeaders } from './security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

/**
 * Serve the built React app from the same origin as the API, so the session
 * cookie is first-party and no cross-origin setup is needed in production.
 * Hashed assets are cached for a year; index.html is never cached so deploys show up immediately.
 */
export function serveClient(distDir = CLIENT_DIST) {
  const router = express.Router();
  const indexHtml = path.join(distDir, 'index.html');

  if (!existsSync(indexHtml)) {
    logger.warn({ distDir }, 'Client build not found; run `npm run build`. Only the API will be served.');
    return router;
  }

  router.use(appSecurityHeaders);
  router.use('/assets', express.static(path.join(distDir, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  router.use(express.static(distDir, { index: false, maxAge: '1h' }));

  // Client-side routes (/projects/123, /audits/456...) all load the SPA shell.
  router.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });

  return router;
}
