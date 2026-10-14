/**
 * Standalone audit worker: `npm run worker`.
 * Use it to process audits outside the API process (set RUN_WORKER=false on the API),
 * e.g. on a bigger machine for headless Chromium, or to scale out with several workers.
 */
import { closeBrowser } from './audit/crawler/renderPage.js';
import { config } from './config/index.js';
import { connectDB, disconnectDB } from './config/db.js';
import { closeAuditQueue, startAuditWorker } from './queues/audit.queue.js';
import { probeRedis } from './queues/connection.js';
import { logger } from './utils/logger.js';

async function start() {
  await connectDB(config.mongoUri);
  await probeRedis();
  startAuditWorker();

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Worker shutting down (finishing active audits)');
    await closeAuditQueue();
    await closeBrowser();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  logger.fatal({ err }, 'Worker failed to start');
  process.exit(1);
});
