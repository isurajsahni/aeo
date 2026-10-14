import { createApp } from './app.js';
import { config } from './config/index.js';
import { closeBrowser } from './audit/crawler/renderPage.js';
import { connectDB, disconnectDB } from './config/db.js';
import { closeAuditRunner, initAuditRunner, recoverInterruptedAudits } from './services/auditRunner.js';
import { logger } from './utils/logger.js';

async function start() {
  await connectDB(config.mongoUri);
  await initAuditRunner();
  await recoverInterruptedAudits();

  const server = createApp().listen(config.port, () => {
    logger.info(`API listening on http://localhost:${config.port} (${config.env})`);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');

    // Force-exit if connections don't drain in time.
    const timer = setTimeout(() => process.exit(1), 10_000);
    timer.unref();

    server.close(async () => {
      await closeAuditRunner();
      await closeBrowser();
      await disconnectDB().catch((err) => logger.error({ err }, 'Error closing MongoDB'));
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled promise rejection'));

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
