import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { corsMiddleware, securityHeaders } from './middleware/security.js';
import { serveClient } from './middleware/serveClient.js';
import routes from './routes/index.js';
import { logger } from './utils/logger.js';

/**
 * Build the Express app without starting a server or connecting to the DB,
 * so tests can mount it directly with supertest.
 */
export function createApp() {
  const app = express();

  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = req.headers['x-request-id'] ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/api/health' || req.url.endsWith('/status') },
      // Compact request logs: method, URL, status and timing are enough to debug with.
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use('/api', securityHeaders, corsMiddleware, express.json({ limit: '100kb' }), cookieParser(), apiLimiter, routes);

  if (config.serveClient) app.use(serveClient());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
