import { config } from '../config/index.js';
import { runAudit } from '../audit/runAudit.js';
import { Audit } from '../models/Audit.js';
import { logger } from '../utils/logger.js';

/**
 * Where audits run. Two drivers behind one interface:
 *  - bullmq: jobs in Redis, processed by a BullMQ worker (in this process or `npm run worker`).
 *    Survives restarts and scales to several workers.
 *  - inline: an in-process queue with a concurrency limit. No Redis needed; audits in
 *    flight are lost on restart.
 * QUEUE_DRIVER=auto (the default) picks bullmq when Redis answers, inline otherwise.
 */
let driver = 'inline';
let queueModule = null;

export const activeDriver = () => driver;

export async function initAuditRunner({ startWorker = config.queue.runWorker } = {}) {
  if (config.queue.driver !== 'inline') {
    try {
      const { probeRedis } = await import('../queues/connection.js');
      await probeRedis();
      queueModule = await import('../queues/audit.queue.js');
      queueModule.getAuditQueue();
      if (startWorker) queueModule.startAuditWorker();
      driver = 'bullmq';
    } catch (err) {
      if (config.queue.driver === 'bullmq') throw new Error(`QUEUE_DRIVER=bullmq but Redis is unavailable: ${err.message}`);
      logger.warn({ reason: err.message }, 'Redis unavailable: running audits in-process (QUEUE_DRIVER=auto). Start Redis for a durable queue.');
    }
  }
  logger.info({ driver }, 'Audit runner ready');
  return driver;
}

// ---------- inline driver ----------
const waiting = [];
let active = 0;

function drainInline() {
  while (active < config.crawler.maxConcurrentAudits && waiting.length) {
    const auditId = waiting.shift();
    active += 1;
    runAudit(auditId)
      .catch((err) => logger.error({ err, auditId }, 'Audit runner error'))
      .finally(() => {
        active -= 1;
        drainInline();
      });
  }
}

// ---------- public API ----------
export async function enqueueAudit(auditId) {
  if (driver === 'bullmq') {
    await queueModule.addAuditJob(auditId);
    return;
  }
  waiting.push(String(auditId));
  setImmediate(drainInline);
}

const interrupted = {
  status: 'failed',
  error: { message: 'The audit was interrupted by a server restart. Please run it again.', code: 'INTERRUPTED' },
  progress: { stage: 'failed', message: 'Interrupted', percent: 100 },
};

/**
 * On boot: audits stuck "queued"/"running" with no live job can never finish, so fail them.
 * With BullMQ, audits whose job still exists are left alone; the worker will pick them up.
 */
export async function recoverInterruptedAudits() {
  const inFlight = await Audit.find({ status: { $in: ['queued', 'running'] } }).select('_id');
  const orphaned = [];
  for (const { _id } of inFlight) {
    const state = driver === 'bullmq' ? await queueModule.getAuditJobState(_id) : null;
    if (!state || state === 'completed' || state === 'failed') orphaned.push(_id);
  }
  if (orphaned.length) {
    await Audit.updateMany({ _id: { $in: orphaned } }, interrupted);
    logger.warn({ count: orphaned.length }, 'Marked interrupted audits as failed');
  }
}

export async function closeAuditRunner() {
  if (queueModule) await queueModule.closeAuditQueue();
}
